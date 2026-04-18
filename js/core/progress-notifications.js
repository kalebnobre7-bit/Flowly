(function () {
  async function saveNotifSettingsToSupabase() {
    if (!flowlyPwa) return;
    await flowlyPwa.saveNotifSettingsToSupabase();
  }

  async function requestNotificationPermission() {
    if (!flowlyPwa) return { ok: false, reason: 'unavailable' };
    return flowlyPwa.requestNotificationPermission();
  }

  async function sendTestNotification() {
    if (!flowlyPwa) return { ok: false, reason: 'unavailable' };
    return flowlyPwa.sendTestNotification();
  }

  function getProgressNotificationState() {
    try {
      return JSON.parse(localStorage.getItem('flowly_progress_notif_state') || '{}');
    } catch (e) {
      return {};
    }
  }

  function setProgressNotificationState(state) {
    localStorage.setItem('flowly_progress_notif_state', JSON.stringify(state || {}));
  }

  function sendProgressNotification() {
    if (!flowlyPwa) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const notifSettings = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
    if (notifSettings.enabled !== true) return;
    if (notifSettings.progressEnabled === false) return;

    const snapshot = window.FlowlyTaskMetrics.getDailyNotificationSnapshot(localDateStr());
    if (snapshot.total <= 0 || snapshot.completed <= 0) return;

    const state = getProgressNotificationState();
    const currentDay = snapshot.dateStr;
    const prev = state[currentDay] || { completed: 0, total: 0 };
    if (snapshot.completed <= prev.completed) return;

    const body = window.FlowlyTaskMetrics.renderNotifTemplate(
      notifSettings.progressTemplate || 'Estamos no caminho, {completed}/{total}',
      snapshot
    );

    flowlyPwa.sendProgressNotification({
      completed: snapshot.completed,
      total: snapshot.total,
      percentage: snapshot.percentage,
      title: 'Flowly | Progresso',
      body,
      tag: 'flowly-progress'
    });

    state[currentDay] = { completed: snapshot.completed, total: snapshot.total };
    setProgressNotificationState(state);
  }

  function sendDailyStats() {
    const stats = window.FlowlyTaskMetrics.countDayTasks(localDateStr());
    const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

    if (flowlyPwa) {
      flowlyPwa.sendDailyStats({
        completed: stats.completed,
        total: stats.total,
        percentage
      });
    }
  }

  const enableLocalSmartNotifFallback =
    localStorage.getItem('flowly_notif_local_fallback') === 'true';

  if (
    enableLocalSmartNotifFallback &&
    flowlyPwa &&
    typeof flowlyPwa.startSmartDailyNotifications === 'function'
  ) {
    flowlyPwa.startSmartDailyNotifications({
      getSnapshot: function () {
        return window.FlowlyTaskMetrics.getDailyNotificationSnapshot(localDateStr());
      }
    });
  }

  const originalSaveToLocalStorage = saveToLocalStorage;
  saveToLocalStorage = function () {
    originalSaveToLocalStorage();
    setTimeout(sendProgressNotification, 250);
  };

  window.saveNotifSettingsToSupabase = saveNotifSettingsToSupabase;
  window.requestNotificationPermission = requestNotificationPermission;
  window.sendTestNotification = sendTestNotification;
  window.sendDailyStats = sendDailyStats;
  window.FlowlyProgressNotifications = {
    getProgressNotificationState,
    setProgressNotificationState,
    sendProgressNotification
  };
})();
