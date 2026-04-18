/* ============================================================
   MedCare Service Worker — Medicine Reminder System
   Handles: scheduling, notification actions, grace-period fallback
   ============================================================ */

const CACHE_NAME = 'medcare-sw-v1';

// ── Install & Activate ────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// ── Timers map: slotKey → timeoutId ──────────────────────────
const scheduledTimers = {};
// Grace-period timers: slotKey → timeoutId
const graceTimers = {};
// Track which notifications are waiting for response
const pendingSlots = {};

// ── Message from main app ─────────────────────────────────────
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'SCHEDULE_REMINDERS') {
    scheduleAll(payload);
  }

  if (type === 'MARK_TAKEN_FROM_PAGE') {
    // User tapped on dashboard checkbox manually — cancel grace timer
    const { slotKey } = payload;
    clearGraceTimer(slotKey);
    delete pendingSlots[slotKey];
  }

  if (type === 'TEST_NOTIFICATION') {
    console.log('[MedCare SW] Received TEST_NOTIFICATION', payload);
    fireNotification(payload.slotKey, payload.label, payload.medicines);
  }
});

// ── Schedule all upcoming dose slots ─────────────────────────
function scheduleAll(payload) {
  const { slots, userId, journeyId } = payload;
  // payload.slots = [{ slotKey, label, targetTime, medicines }]
  const now = Date.now();

  slots.forEach(({ slotKey, label, targetTime, medicines }) => {
    // Clear old timer if exists
    if (scheduledTimers[slotKey]) {
      clearTimeout(scheduledTimers[slotKey]);
    }

    const delay = targetTime - now;
    if (delay <= 0) return; // Already past — skip

    scheduledTimers[slotKey] = setTimeout(() => {
      fireNotification(slotKey, label, medicines, userId, journeyId);
    }, delay);
  });
}

// ── Fire a notification ───────────────────────────────────────
function fireNotification(slotKey, label, medicines, userId, journeyId) {
  const medNames = medicines.map(m => m.name || m.medicine_name || 'Medicine').join(', ');
  const title = `💊 Time for your ${label} dose`;
  const body = medicines.length > 0
    ? `${medNames}`
    : 'Tap to log your dose.';

  pendingSlots[slotKey] = { userId, journeyId, medicines, label };

  const options = {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: slotKey,            // Replaces previous notification with same tag
    requireInteraction: true, // Stays until user interacts
    data: { slotKey, userId, journeyId, medicines, label },
    actions: [
      { action: 'taken', title: '✅ Taken' },
      { action: 'skip',  title: '❌ Not Taken' },
    ],
    tag: slotKey,
    renotify: true,
  };

  self.registration.showNotification(title, options);

  // Grace period: 10 minutes (or 5s for tests)
  const isTest = slotKey.includes('test');
  const delay = isTest ? 5000 : 10 * 60 * 1000;

  graceTimers[slotKey] = setTimeout(() => {
    if (pendingSlots[slotKey]) {
      // No response yet — fire follow-up alert
      self.registration.showNotification('⚠️ Missed Dose Alert', {
        body: `You haven't confirmed your ${label} dose. Marking as Not Taken.`,
        icon: '/favicon.svg',
        tag: `${slotKey}-missed`,
        data: { slotKey, userId, journeyId, medicines, label, autoMissed: true },
      });
      // Broadcast to all open tabs to mark as not_taken
      broadcastFeedback(slotKey, 'not_taken', userId, journeyId, medicines);
      delete pendingSlots[slotKey];
    }
  }, delay);
}

function clearGraceTimer(slotKey) {
  if (graceTimers[slotKey]) {
    clearTimeout(graceTimers[slotKey]);
    delete graceTimers[slotKey];
  }
}

// ── Notification click / action handler ──────────────────────
self.addEventListener('notificationclick', (event) => {
  const { slotKey, userId, journeyId, medicines, label, autoMissed } = event.notification.data || {};
  event.notification.close();

  if (autoMissed) {
    // Just open the app
    event.waitUntil(openApp());
    return;
  }

  const action = event.action; // 'taken' | 'skip' | '' (body click)
  const status = action === 'skip' ? 'not_taken' : 'taken';

  clearGraceTimer(slotKey);
  delete pendingSlots[slotKey];

  // Broadcast to app tabs
  event.waitUntil(
    broadcastFeedback(slotKey, status, userId, journeyId, medicines)
      .then(() => openApp())
  );
});

// ── Notification dismissed without action ─────────────────────
self.addEventListener('notificationclose', (event) => {
  // Grace timer already running — do nothing extra here
});

// ── Broadcast feedback to all open clients ────────────────────
async function broadcastFeedback(slotKey, status, userId, journeyId, medicines) {
  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  allClients.forEach(client => {
    client.postMessage({
      type: 'REMINDER_FEEDBACK',
      payload: { slotKey, status, userId, journeyId, medicines },
    });
  });
}

// ── Open / focus app tab ──────────────────────────────────────
async function openApp() {
  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of allClients) {
    if (client.url.includes('/agent')) {
      return client.focus();
    }
  }
  return self.clients.openWindow('/agent');
}
