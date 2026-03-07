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
            morning_notif_time: notifSettings.morningTime || '09:00',
            evening_notif_time: notifSettings.eveningTime || '22:00',
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

    function sendProgressNotification(payload) {
      if (!serviceWorkerRegistration || !serviceWorkerRegistration.active) return;

      serviceWorkerRegistration.active.postMessage({
        type: 'SEND_PROGRESS_NOTIFICATION',
        completed: payload.completed,
        total: payload.total,
        percentage: payload.percentage
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
      sendDailyStats
    };
  }

  window.FlowlyPwa = { create: createFlowlyPwa };
})();
