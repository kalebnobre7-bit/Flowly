const CACHE_NAME = 'flowly-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo_flowly.png',
  '/favicon.svg'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch - estratégia Network First com fallback para cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone a resposta
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Sistema de Notificações
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATIONS') {
    scheduleNotifications();
  }

  if (event.data && event.data.type === 'SEND_PROGRESS_NOTIFICATION') {
    const { completed, total, percentage } = event.data;
    showProgressNotification(completed, total, percentage);
  }
});

// Função para agendar notificações
function scheduleNotifications() {
  const now = new Date();
  const notifications = [
    { hour: 9, minute: 0, title: 'Bom dia! ☀️', body: 'Suas tarefas de hoje estão te esperando!' },
    { hour: 15, minute: 0, title: 'Como está o progresso? 📊', body: 'Já completou suas tarefas da tarde?' },
    { hour: 20, minute: 0, title: 'Última chance! ⏰', body: 'Ainda dá tempo de completar suas tarefas!' },
    { hour: 23, minute: 0, title: 'Resumo do dia 🌙', body: 'Veja como foi seu desempenho hoje' }
  ];

  notifications.forEach((notif) => {
    const scheduledTime = new Date();
    scheduledTime.setHours(notif.hour, notif.minute, 0, 0);

    // Se o horário já passou hoje, agendar para amanhã
    if (scheduledTime < now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const delay = scheduledTime.getTime() - now.getTime();

    setTimeout(() => {
      showNotification(notif.title, notif.body, notif.hour);
      // Reagendar para o próximo dia
      setTimeout(() => scheduleNotifications(), 1000);
    }, delay);
  });
}

// Mostrar notificação
function showNotification(title, body, hour) {
  const options = {
    body: body,
    icon: '/logo_flowly.png',
    badge: '/logo_flowly.png',
    vibrate: [200, 100, 200],
    tag: `flowly-${hour}`,
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Abrir Flowly', icon: '/logo_flowly.png' },
      { action: 'close', title: 'Fechar', icon: '/logo_flowly.png' }
    ],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  // Buscar dados do localStorage para notificação de resumo
  if (hour === 23) {
    self.clients.matchAll().then((clients) => {
      if (clients.length > 0) {
        clients[0].postMessage({ type: 'GET_DAILY_STATS' });
      }
    });
  }

  self.registration.showNotification(title, options);
}

// Mostrar notificação de progresso
function showProgressNotification(completed, total, percentage) {
  let title, body, emoji;

  if (percentage >= 80) {
    emoji = '🎉';
    title = 'Excelente progresso!';
    body = `${completed}/${total} tarefas concluídas (${percentage}%)! Continue assim!`;
  } else if (percentage >= 50) {
    emoji = '💪';
    title = 'Bom trabalho!';
    body = `${completed}/${total} tarefas concluídas (${percentage}%). Você consegue!`;
  } else if (percentage >= 20) {
    emoji = '📝';
    title = 'Vamos lá!';
    body = `${completed}/${total} tarefas concluídas (${percentage}%). Mantenha o foco!`;
  } else {
    emoji = '⏰';
    title = 'Hora de começar!';
    body = `${completed}/${total} tarefas concluídas. Vamos fazer acontecer!`;
  }

  const options = {
    body: body,
    icon: '/logo_flowly.png',
    badge: '/logo_flowly.png',
    vibrate: [200, 100, 200],
    tag: 'flowly-progress',
    requireInteraction: false
  };

  self.registration.showNotification(`${emoji} ${title}`, options);
}

// Click em notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Se já tem uma janela aberta, focar nela
          for (let client of clientList) {
            if (client.url === '/' && 'focus' in client) {
              return client.focus();
            }
          }
          // Senão, abrir nova janela
          if (self.clients.openWindow) {
            return self.clients.openWindow('/');
          }
        })
    );
  }
});

// Listener para mensagens do cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'DAILY_STATS') {
    const { completed, total, percentage } = event.data;

    const options = {
      body: `Você completou ${completed} de ${total} tarefas hoje (${percentage}%)`,
      icon: '/logo_flowly.png',
      badge: '/logo_flowly.png',
      vibrate: [200, 100, 200],
      tag: 'flowly-daily-summary',
      requireInteraction: true
    };

    self.registration.showNotification('🌙 Resumo do dia', options);
  }
});
