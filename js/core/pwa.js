(function () {
  const DEFAULT_VAPID_PUBLIC_KEY =
    'BK4JxnBWNvnOhrAkcCha07sQqkxDWZyJ6Ws8W-WCZBUaJjqjNQq-CIlkDx7fY5VXH6ZSI0_qSrwmYkoUaBUh-7M';

  function toUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i += 1) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  function createFlowlyPwa(deps) {
    const supabaseClient = deps.supabaseClient;
    const getCurrentUser = deps.getCurrentUser;
    const debugLog = deps.debugLog || function () {};

    let serviceWorkerRegistration = null;
    let smartNotifTimer = null;

    const SMART_NOTIFICATION_SLOTS = [
      { key: 'morning', hour: 8, minute: 30 },
      { key: 'midday', hour: 12, minute: 30 },
      { key: 'night', hour: 23, minute: 0 }
    ];

    function getAssetUrl(assetFile) {
      try {
        return new URL(assetFile, window.location.href).toString();
      } catch (e) {
        return assetFile;
      }
    }

    async function saveNotifSettingsToSupabase() {
      const currentUser = getCurrentUser();
      if (!currentUser) return;

      const notifSettings = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

      try {
        await supabaseClient.from('user_settings').upsert(
          {
            user_id: currentUser.id,
            push_enabled: notifSettings.enabled === true,
            morning_notif_time: notifSettings.morningTime || '08:30',
            midday_notif_time: notifSettings.middayTime || '12:30',
            evening_notif_time: notifSettings.eveningTime || '23:00',
            inactivity_notif_enabled: notifSettings.inactivityEnabled !== false,
            inactivity_threshold_minutes: Math.max(
              30,
              Math.min(480, Number(notifSettings.inactivityThresholdMinutes) || 150)
            ),
            progress_notif_enabled: notifSettings.progressEnabled !== false,
            morning_notif_template:
              notifSettings.morningTemplate || 'Bom dia. Hoje voce tem {total} tarefas planejadas.',
            midday_notif_template:
              notifSettings.middayTemplate ||
              'Como estamos de produtividade? {completed}/{total} ({percentage}%).',
            night_notif_template:
              notifSettings.nightTemplate ||
              'Resumo do dia: {completed}/{total} ({percentage}%). Tempo total {totalDuration}. Hora de descansar.',
            inactivity_notif_template:
              notifSettings.inactivityTemplate || 'Bem, o que andou fazendo nas ultimas 3h?',
            progress_notif_template:
              notifSettings.progressTemplate || 'Estamos no caminho, {completed}/{total}',
            timezone: tz,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        );
      } catch (err) {
        console.error('Erro ao salvar notif settings:', err);
      }
    }

    async function subscribeToPush() {
      const currentUser = getCurrentUser();
      if (!serviceWorkerRegistration || !currentUser) return;

      if (!('PushManager' in window)) {
        debugLog('Push API nao suportada');
        return;
      }

      try {
        let subscription = await serviceWorkerRegistration.pushManager.getSubscription();

        if (!subscription) {
          const vapidKey = window._FLOWLY_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
          subscription = await serviceWorkerRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: toUint8Array(vapidKey)
          });
        }

        const subscriptionJson = subscription.toJSON();
        const { error } = await supabaseClient.from('push_subscriptions').upsert(
          {
            user_id: currentUser.id,
            endpoint: subscription.endpoint,
            p256dh: subscriptionJson.keys.p256dh,
            auth: subscriptionJson.keys.auth,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'user_id,endpoint'
          }
        );

        if (error) {
          console.error('Erro ao salvar push subscription:', error);
        } else {
          debugLog('Push subscription salva com sucesso');
        }

        await saveNotifSettingsToSupabase();
      } catch (err) {
        console.error('Falha ao subscribir push:', err);
      }
    }

    function initServiceWorker() {
      if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') {
        return;
      }

      navigator.serviceWorker
        .register('./service-worker.js')
        .then((registration) => {
          debugLog('Service Worker registrado:', registration);
          serviceWorkerRegistration = registration;
        })
        .catch((error) => {
          console.error('Erro ao registrar Service Worker:', error);
        });
    }

    async function requestNotificationPermission() {
      if (!('Notification' in window)) {
        debugLog('Este navegador nao suporta notificacoes');
        return { ok: false, reason: 'unsupported' };
      }

      if (!window.isSecureContext) {
        debugLog('Contexto inseguro para notificacoes');
        return { ok: false, reason: 'insecure-context' };
      }

      if (Notification.permission === 'granted') {
        debugLog('Permissao de notificacoes ja concedida');
        await subscribeToPush();
        return { ok: true, reason: 'already-granted' };
      }

      if (Notification.permission === 'denied') {
        return { ok: false, reason: 'denied' };
      }

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        debugLog('Permissao de notificacoes concedida');
        await subscribeToPush();
        showWelcomeNotification();
        return { ok: true, reason: 'granted' };
      }

      return { ok: false, reason: permission || 'default' };
    }

    function showWelcomeNotification() {
      if (!serviceWorkerRegistration) return;

      serviceWorkerRegistration.showNotification('Notificacoes ativadas!', {
        body: 'Voce recebera lembretes e atualizacoes de progresso',
        icon: getAssetUrl('logo_flowly.png'),
        badge: getAssetUrl('logo_flowly.png'),
        vibrate: [200, 100, 200],
        tag: 'flowly-welcome'
      });
    }

    async function sendTestNotification() {
      if (!('Notification' in window)) {
        return { ok: false, reason: 'unsupported' };
      }

      if (Notification.permission !== 'granted') {
        return { ok: false, reason: 'permission' };
      }

      try {
        if (!serviceWorkerRegistration && 'serviceWorker' in navigator) {
          serviceWorkerRegistration = await navigator.serviceWorker.ready;
        }

        const title = 'Teste de notificacao';
        const options = {
          body: 'Tudo certo. As notificacoes do Flowly estao funcionando.',
          icon: getAssetUrl('logo_flowly.png'),
          badge: getAssetUrl('logo_flowly.png'),
          vibrate: [120, 60, 120],
          tag: 'flowly-test'
        };

        if (
          serviceWorkerRegistration &&
          typeof serviceWorkerRegistration.showNotification === 'function'
        ) {
          await serviceWorkerRegistration.showNotification(title, options);
          return { ok: true, source: 'service-worker' };
        }

        new Notification(title, options);
        return { ok: true, source: 'notification-api' };
      } catch (err) {
        console.error('Falha ao enviar notificacao de teste:', err);
        return { ok: false, reason: 'error' };
      }
    }

    function formatDuration(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return '0m';
      const totalMinutes = Math.round(ms / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours <= 0) return `${Math.max(1, minutes)}m`;
      if (minutes <= 0) return `${hours}h`;
      return `${hours}h ${minutes}m`;
    }

    function getLocalDateKey(date = new Date()) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    function isSmartNotificationReady() {
      if (!('Notification' in window)) return false;
      if (!window.isSecureContext) return false;
      if (Notification.permission !== 'granted') return false;
      const notifSettings = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
      return notifSettings.enabled === true;
    }

    function getSmartSentRegistry() {
      try {
        return JSON.parse(localStorage.getItem('flowly_smart_notif_sent') || '{}');
      } catch (e) {
        return {};
      }
    }

    function hasSentSmartNotification(dayKey, slotKey) {
      const registry = getSmartSentRegistry();
      return registry[dayKey] && registry[dayKey][slotKey] === true;
    }

    function markSmartNotificationSent(dayKey, slotKey) {
      const registry = getSmartSentRegistry();
      if (!registry[dayKey]) registry[dayKey] = {};
      registry[dayKey][slotKey] = true;
      localStorage.setItem('flowly_smart_notif_sent', JSON.stringify(registry));
    }

    function shouldFireSlotNow(slot, now) {
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const slotMinutes = slot.hour * 60 + slot.minute;
      return nowMinutes >= slotMinutes && nowMinutes <= slotMinutes + 20;
    }

    function getMorningMessage(snapshot) {
      const total = snapshot.total || 0;
      const routineTotal = snapshot.routineTotal || 0;
      const body =
        total > 0
          ? `Bom dia. Hoje voce tem ${total} tarefa${total === 1 ? '' : 's'} planejada${
              total === 1 ? '' : 's'
            } (${routineTotal} de rotina).`
          : 'Bom dia. Hoje ainda nao ha tarefas planejadas. Que tal definir 3 prioridades?';
      return { title: 'Flowly | Bom dia', body, tag: 'flowly-smart-morning' };
    }

    function getMiddayMessage(snapshot) {
      const total = snapshot.total || 0;
      const completed = snapshot.completed || 0;
      const percentage = snapshot.percentage || 0;
      let mood = 'Ritmo constante';
      if (percentage >= 70) mood = 'Excelente produtividade';
      else if (percentage >= 40) mood = 'Bom progresso';
      else if (percentage < 20) mood = 'Hora de acelerar';

      const pending = Math.max(0, total - completed);
      const body =
        total > 0
          ? `${mood}: ${completed}/${total} concluidas (${percentage}%). Restam ${pending}.`
          : 'Sem tarefas registradas para hoje. Aproveite para planejar a tarde.';

      return { title: 'Flowly | Check de produtividade', body, tag: 'flowly-smart-midday' };
    }

    function getNightMessage(snapshot) {
      const total = snapshot.total || 0;
      const completed = snapshot.completed || 0;
      const percentage = snapshot.percentage || 0;
      const avgDurationText = formatDuration(snapshot.avgTaskDurationMs || 0);
      const totalDurationText = formatDuration(snapshot.totalTaskDurationMs || 0);
      const bestPeriod = snapshot.bestPeriod || 'sem periodo dominante';
      const insight =
        percentage >= 80
          ? 'Dia muito forte. Mantem esse padrao amanha.'
          : percentage >= 50
            ? `Voce performou melhor em ${bestPeriod}.`
            : 'Comece amanha por uma tarefa curta para ganhar tracao.';

      const body =
        total > 0
          ? `Resumo: ${completed}/${total} concluidas (${percentage}%). Tempo total ${totalDurationText}, media ${avgDurationText}. ${insight} Hora de descansar.`
          : 'Resumo: sem tarefas concluidas hoje. Reorganize prioridades e descanse para recomecar.';

      return { title: 'Flowly | Resumo do dia', body, tag: 'flowly-smart-night' };
    }

    async function showSmartNotification(message) {
      const options = {
        body: message.body,
        icon: getAssetUrl('logo_flowly.png'),
        badge: getAssetUrl('logo_flowly.png'),
        vibrate: [120, 60, 120],
        tag: message.tag
      };

      if (!serviceWorkerRegistration && 'serviceWorker' in navigator) {
        try {
          serviceWorkerRegistration = await navigator.serviceWorker.ready;
        } catch (e) {
          // fallback para Notification API abaixo
        }
      }

      if (
        serviceWorkerRegistration &&
        typeof serviceWorkerRegistration.showNotification === 'function'
      ) {
        await serviceWorkerRegistration.showNotification(message.title, options);
        return;
      }

      new Notification(message.title, options);
    }

    async function checkSmartDailyNotifications(getSnapshot) {
      if (!isSmartNotificationReady()) return;
      if (typeof getSnapshot !== 'function') return;

      const now = new Date();
      const dayKey = getLocalDateKey(now);
      const snapshot = getSnapshot() || {};

      for (const slot of SMART_NOTIFICATION_SLOTS) {
        if (!shouldFireSlotNow(slot, now)) continue;
        if (hasSentSmartNotification(dayKey, slot.key)) continue;

        let message = null;
        if (slot.key === 'morning') message = getMorningMessage(snapshot);
        if (slot.key === 'midday') message = getMiddayMessage(snapshot);
        if (slot.key === 'night') message = getNightMessage(snapshot);
        if (!message) continue;

        try {
          await showSmartNotification(message);
          markSmartNotificationSent(dayKey, slot.key);
        } catch (err) {
          console.error('Falha ao enviar notificacao diaria inteligente:', err);
        }
      }
    }

    function startSmartDailyNotifications(options = {}) {
      const getSnapshot = options.getSnapshot;
      if (typeof getSnapshot !== 'function') return;

      if (smartNotifTimer) {
        clearInterval(smartNotifTimer);
        smartNotifTimer = null;
      }

      checkSmartDailyNotifications(getSnapshot);
      smartNotifTimer = setInterval(() => {
        checkSmartDailyNotifications(getSnapshot);
      }, 60000);

      window.addEventListener('focus', () => checkSmartDailyNotifications(getSnapshot));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkSmartDailyNotifications(getSnapshot);
        }
      });
    }

    function sendProgressNotification(payload) {
      if (!serviceWorkerRegistration || !serviceWorkerRegistration.active) return;

      serviceWorkerRegistration.active.postMessage({
        type: 'SEND_PROGRESS_NOTIFICATION',
        completed: payload.completed,
        total: payload.total,
        percentage: payload.percentage,
        title: payload.title || '',
        body: payload.body || '',
        tag: payload.tag || 'flowly-progress'
      });
    }

    function sendDailyStats(payload) {
      if (!serviceWorkerRegistration || !serviceWorkerRegistration.active) return;

      serviceWorkerRegistration.active.postMessage({
        type: 'DAILY_STATS',
        completed: payload.completed,
        total: payload.total,
        percentage: payload.percentage
      });
    }

    return {
      initServiceWorker,
      requestNotificationPermission,
      saveNotifSettingsToSupabase,
      sendTestNotification,
      sendProgressNotification,
      sendDailyStats,
      startSmartDailyNotifications
    };
  }

  window.FlowlyPwa = { create: createFlowlyPwa };
})();
