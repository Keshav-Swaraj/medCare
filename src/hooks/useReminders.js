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
    const interval = setInterval(() => {
      const current = getPermission();
      setPermissionState(prev => prev !== current ? current : prev);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── Register service worker ───────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch((err) => console.error('[MedCare SW] Registration failed:', err));
  }, []);

  // permissionState is synced via interval above (no duplicate needed)

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
    
    // Step 1: Request permission if not granted
    if (Notification.permission !== 'granted') {
      try {
        const result = await Notification.requestPermission();
        console.log('[MedCare] Permission requested. Result:', result);
        setPermissionState(result);
        if (result !== 'granted') {
          alert('Please allow notifications in your browser settings to enable reminders.\n\nChrome: Click the lock icon in the address bar → Site settings → Notifications → Allow');
          return;
        }
      } catch (err) {
        console.error('[MedCare] Permission request failed:', err);
        alert('Could not request notification permission. Please enable it in browser settings.');
        return;
      }
    }

    // Step 2: Check service worker support
    if (!('serviceWorker' in navigator)) {
      // Fallback: use Notification API directly
      try {
        const medNames = meds.slice(0, 3).map(m => m.name || m.medicine_name || 'Medicine').join(', ');
        new Notification('💊 MedCare Reminder Test', {
          body: meds.length > 0
            ? `You have medicines to take: ${medNames}`
            : 'Your reminder system is working correctly!',
          icon: '/favicon.svg',
        });
        console.log('[MedCare] Notification sent via Notification API fallback.');
      } catch (e) {
        console.error('[MedCare] Fallback notification failed:', e);
      }
      return;
    }

    // Step 3: Ensure service worker is registered and ready
    try {
      // Re-register to make sure SW is active
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const reg = await navigator.serviceWorker.ready;
      
      if (!reg.active) {
        console.warn('[MedCare] SW not active yet, waiting...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const medNames = meds.slice(0, 3).map(m => m.name || m.medicine_name || 'Medicine').join(', ');
      const todayStr = new Date().toISOString().split('T')[0];

      // Send via SW message for full reminder experience (with action buttons)
      if (reg.active) {
        reg.active.postMessage({
          type: 'TEST_NOTIFICATION',
          payload: {
            slotKey: `${todayStr}|test`,
            label: 'Test',
            medicines: meds.slice(0, 3).map(m => ({ name: m.name || m.medicine_name || 'Medicine' })),
          }
        });
        console.log('[MedCare] Test notification sent via SW message.');
      } else {
        // Fallback: show directly via registration
        await reg.showNotification('💊 MedCare Reminder Test', {
          body: meds.length > 0
            ? `You have medicines to take: ${medNames}`
            : 'Your reminder system is working correctly!',
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: 'medcare-test',
          renotify: true,
        });
        console.log('[MedCare] Notification sent via SW registration fallback.');
      }
    } catch (err) {
      console.error('[MedCare] Failed to show notification:', err);
      // Last resort fallback: direct Notification API
      try {
        new Notification('💊 MedCare Reminder Test', {
          body: 'Your reminder system is working correctly!',
        });
      } catch (e) {
        console.error('[MedCare] All notification methods failed:', e);
        alert('Notifications failed. Please check your browser settings.');
      }
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
