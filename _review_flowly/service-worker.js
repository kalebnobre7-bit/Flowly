const STATIC_CACHE = 'flowly-static-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo_flowly.png',
  '/favicon.svg',
  '/lightning.svg',
  '/styles.css',
  '/bento-theme.css',
  '/js/app.js'
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isStaticAsset(url) {
  return /\.(?:js|css|png|svg|ico|json|html)$/i.test(url.pathname);
}

function isApiRequest(url) {
  return (
    url.pathname.startsWith('/rest/v1/') ||
    url.pathname.startsWith('/auth/v1/') ||
    url.pathname.startsWith('/storage/v1/') ||
    url.pathname.startsWith('/realtime/v1/')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== STATIC_CACHE)
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (!isSameOrigin(requestUrl) || isApiRequest(requestUrl)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', responseClone));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match('/index.html');
          return cachedPage || Response.error();
        })
    );
    return;
  }

  if (!isStaticAsset(requestUrl)) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});

self.addEventListener('message', (event) => {
  const { data } = event;
  if (!data || !data.type) return;

  if (data.type === 'SEND_PROGRESS_NOTIFICATION') {
    showProgressNotification(data.completed, data.total, data.percentage);
    return;
  }

  if (data.type === 'DAILY_STATS') {
    const options = {
      body: `Voce completou ${data.completed} de ${data.total} tarefas hoje (${data.percentage}%)`,
      icon: '/logo_flowly.png',
      badge: '/logo_flowly.png',
      vibrate: [200, 100, 200],
      tag: 'flowly-daily-summary',
      requireInteraction: true
    };
    self.registration.showNotification('Resumo do dia', options);
  }
});

function showProgressNotification(completed, total, percentage) {
  let title;
  let body;
  let prefix;

  if (percentage >= 80) {
    prefix = 'Excelente';
    title = 'Excelente progresso!';
    body = `${completed}/${total} tarefas concluidas (${percentage}%). Continue assim!`;
  } else if (percentage >= 50) {
    prefix = 'Bom';
    title = 'Bom trabalho!';
    body = `${completed}/${total} tarefas concluidas (${percentage}%). Voce consegue!`;
  } else if (percentage >= 20) {
    prefix = 'Foco';
    title = 'Vamos la!';
    body = `${completed}/${total} tarefas concluidas (${percentage}%). Mantenha o foco!`;
  } else {
    prefix = 'Inicio';
    title = 'Hora de comecar!';
    body = `${completed}/${total} tarefas concluidas. Vamos fazer acontecer!`;
  }

  const options = {
    body,
    icon: '/logo_flowly.png',
    badge: '/logo_flowly.png',
    vibrate: [200, 100, 200],
    tag: 'flowly-progress',
    requireInteraction: false
  };

  self.registration.showNotification(`${prefix} ${title}`, options);
}

self.addEventListener('push', (event) => {
  let data = { title: 'Flowly', body: 'Nova notificacao', type: 'general' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/logo_flowly.png',
    badge: '/logo_flowly.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'flowly-push',
    requireInteraction: false,
    data: {
      url: data.url || '/',
      type: data.type
    },
    actions: [
      { action: 'open', title: 'Abrir Flowly' },
      { action: 'close', title: 'Fechar' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if ('focus' in client) {
              return client.focus();
            }
          }

          if (self.clients.openWindow) {
            return self.clients.openWindow('/');
          }

          return undefined;
        })
    );
  }
});
