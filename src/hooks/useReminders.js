import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

/* ============================================================
   useReminders — Medicine Reminder Hook
   ============================================================ */

const SLOT_HOURS  = { morning: 8, afternoon: 13, evening: 20 };
const SLOT_LABELS = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

function getPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  return Notification.permission;
}

export function useReminders({ meds = [], userId = null, journeyId = null, onStatusChange }) {
  // ── Reactive permission state ─────────────────────────────
  const [permissionState, setPermissionState] = useState(getPermission);

  // Sync whenever the browser permission changes (e.g. user revokes from settings)
  useEffect(() => {
    setPermissionState(getPermission());
  });

  // ── Register service worker ───────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch((err) => console.error('[MedCare SW] Registration failed:', err));
  }, []);

  // ── Sync permissionState on mount ───────────────────────
  // (No auto-request — Chrome silently denies requests not tied to a click)
  useEffect(() => {
    setPermissionState(getPermission());
  }, []);

  // ── Schedule reminders via SW ─────────────────────────────
  const scheduleReminders = useCallback(() => {
    if (permissionState !== 'granted') return;
    if (!meds.length || !userId) return;
    if (!('serviceWorker' in navigator)) return;

    const today    = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const slots    = [];

    ['morning', 'afternoon', 'evening'].forEach((slot) => {
      const slotMeds = meds.filter(m => m[slot]);
      if (!slotMeds.length) return;

      const targetDate = new Date(today);
      targetDate.setHours(SLOT_HOURS[slot], 0, 0, 0);
      if (Date.now() >= targetDate.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1); // push to tomorrow if past
      }

      slots.push({
        slotKey:    `${todayStr}|${slot}`,
        label:      SLOT_LABELS[slot],
        targetTime: targetDate.getTime(),
        medicines:  slotMeds,
      });
    });

    navigator.serviceWorker.ready.then(reg => {
      reg.active?.postMessage({
        type:    'SCHEDULE_REMINDERS',
        payload: { slots, userId, journeyId },
      });
    });
  }, [meds, userId, journeyId, permissionState]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(() => scheduleReminders());
  }, [scheduleReminders]);

  // ── Listen for feedback from SW ───────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = async (event) => {
      if (event.data?.type !== 'REMINDER_FEEDBACK') return;
      const { slotKey, status, medicines } = event.data.payload;
      onStatusChange?.(slotKey, status);
      if (!userId) return;
      const [dateStr, slot] = slotKey.split('|');
      const rows = medicines.map(med => ({
        user_id:       userId,
        journey_id:    journeyId || null,
        medicine_name: med.name || med.medicine_name,
        slot, log_date: dateStr, status,
        notified_at:   new Date().toISOString(),
        responded_at:  new Date().toISOString(),
      }));
      const { error } = await supabase.from('dose_logs').upsert(rows, {
        onConflict: 'user_id,medicine_name,slot,log_date',
      });
      if (error) console.error('[MedCare] dose_logs upsert error:', error);
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [userId, journeyId, onStatusChange]);

  // ── Mark taken (from dashboard checkbox) ─────────────────
  const markTaken = useCallback(async (medName, slot, dateStr) => {
    if (!userId) return;
    navigator.serviceWorker?.ready.then(reg =>
      reg.active?.postMessage({ type: 'MARK_TAKEN_FROM_PAGE', payload: { slotKey: `${dateStr}|${slot}` } })
    );
    const { error } = await supabase.from('dose_logs').upsert({
      user_id: userId, journey_id: journeyId || null,
      medicine_name: medName, slot, log_date: dateStr,
      status: 'taken', responded_at: new Date().toISOString(),
    }, { onConflict: 'user_id,medicine_name,slot,log_date' });
    if (error) console.error('[MedCare] markTaken error:', error);
  }, [userId, journeyId]);

  // ── Mark not taken ────────────────────────────────────────
  const markNotTaken = useCallback(async (medName, slot, dateStr) => {
    if (!userId) return;
    const { error } = await supabase.from('dose_logs').upsert({
      user_id: userId, journey_id: journeyId || null,
      medicine_name: medName, slot, log_date: dateStr,
      status: 'not_taken', responded_at: new Date().toISOString(),
    }, { onConflict: 'user_id,medicine_name,slot,log_date' });
    if (error) console.error('[MedCare] markNotTaken error:', error);
  }, [userId, journeyId]);

  // ── Reset dose (remove from log) ──────────────────────────
  const resetDose = useCallback(async (medName, slot, dateStr) => {
    if (!userId) return;
    const { error } = await supabase.from('dose_logs')
      .delete()
      .match({ user_id: userId, medicine_name: medName, slot, log_date: dateStr });
    if (error) console.error('[MedCare] resetDose error:', error);
  }, [userId]);

  // ── Send test notification (via SW registration — most reliable) ──
  const sendTestNotification = useCallback(async () => {
    console.log('[MedCare] Sending test notification. Permission:', Notification.permission);
    
    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      console.log('[MedCare] Permission requested. Result:', result);
      setPermissionState(result);
      if (result !== 'granted') {
        alert('Please allow notifications in your browser to enable reminders.');
        return;
      }
    }

    if (!('serviceWorker' in navigator)) {
      alert('Service Worker not supported in this browser.');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const medNames = meds.slice(0, 3).map(m => m.name || m.medicine_name || 'Medicine').join(', ');
      
      await reg.showNotification('💊 MedCare Reminder Test', {
        body: meds.length > 0
          ? `You have medicines to take: ${medNames}`
          : 'Your reminder system is working correctly!',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: 'medcare-test',
        renotify: true,
        requireInteraction: true,
        data: { slotKey: 'test', medicines: meds.slice(0, 2) }
      });
      console.log('[MedCare] Notification sent via SW registration.');
      
      // Fallback for user: If they don't see the popup, show an alert after 1s
      setTimeout(() => {
        if (confirm('Did you see the notification popup? If not, your Windows "Focus Assist" or Chrome settings are blocking it. Click OK to see the "Missed Dose" logic in action.')) {
          // Trigger the missed dose logic for them to see
          const todayStr = new Date().toISOString().split('T')[0];
          reg.active?.postMessage({
            type: 'TEST_NOTIFICATION',
            payload: { slotKey: `${todayStr}|morning`, label: 'Test', medicines: meds.slice(0, 1) }
          });
        }
      }, 1500);
    } catch (err) {
      console.error('[MedCare] Failed to show notification:', err);
      // Last resort fallback
      try {
        new Notification('MedCare Test (Fallback)');
      } catch (e) {}
    }
  }, [meds]);

  return {
    permissionGranted: permissionState === 'granted',
    permissionDenied:  permissionState === 'denied',
    markTaken,
    markNotTaken,
    resetDose,
    sendTestNotification,
  };
}

/* ── Load recent dose_logs from Supabase ──────────────────────
   Returns { 'YYYY-MM-DD|medName|slot': 'taken'|'not_taken' }  */
export async function loadRecentLogs(userId, days = 7) {
  if (!userId) return {};
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - days);
  const dateLimitStr = dateLimit.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('dose_logs')
    .select('medicine_name, slot, status, log_date')
    .eq('user_id', userId)
    .gte('log_date', dateLimitStr);

  if (error) {
    console.error('[MedCare] loadRecentLogs error:', error);
    return {};
  }
  const result = {};
  data.forEach(row => {
    result[`${row.log_date}|${row.medicine_name}|${row.slot}`] = row.status;
  });
  return result;
}
