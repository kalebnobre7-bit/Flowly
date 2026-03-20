const STATIC_CACHE = 'flowly-static-v6';

const APP_SCOPE_URL = new URL(self.registration.scope);
const APP_SCOPE_PATH = APP_SCOPE_URL.pathname.endsWith('/')
  ? APP_SCOPE_URL.pathname
  : `${APP_SCOPE_URL.pathname}/`;
const INDEX_URL = `${APP_SCOPE_PATH}index.html`;

function scopedPath(path = '') {
  return `${APP_SCOPE_PATH}${path}`;
}

function scopedUrl(path = '') {
  return new URL(path, APP_SCOPE_URL).toString();
}

const STATIC_ASSETS = [
  APP_SCOPE_PATH,
  INDEX_URL,
  scopedPath('manifest.json'),
  scopedPath('logo_flowly.png'),
  scopedPath('favicon.svg'),
  scopedPath('lightning.svg'),
  scopedPath('styles.css'),
  scopedPath('bento-theme.css'),
  scopedPath('js/app.js')
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isStaticAsset(url) {
  return /\.(?:js|css|png|svg|ico|json|html)$/i.test(url.pathname);
}

function isCodeAsset(url) {
  return /\.(?:js|css|html)$/i.test(url.pathname);
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
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
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
          caches.open(STATIC_CACHE).then((cache) => cache.put(INDEX_URL, responseClone));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(INDEX_URL);
          return cachedPage || Response.error();
        })
    );
    return;
  }

  if (!isStaticAsset(requestUrl)) return;

  if (isCodeAsset(requestUrl)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

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

function buildNotificationOptions(overrides = {}) {
  return {
    icon: scopedPath('logo_flowly.png'),
    badge: scopedPath('logo_flowly.png'),
    vibrate: [200, 100, 200],
    ...overrides
  };
}

self.addEventListener('message', (event) => {
  const { data } = event;
  if (!data || !data.type) return;

  if (data.type === 'SEND_PROGRESS_NOTIFICATION') {
    showProgressNotification(data);
    return;
  }

  if (data.type === 'DAILY_STATS') {
    const options = buildNotificationOptions({
      body: `Voce completou ${data.completed} de ${data.total} tarefas hoje (${data.percentage}%)`,
      tag: 'flowly-daily-summary',
      requireInteraction: true
    });
    self.registration.showNotification('Resumo do dia', options);
  }
});

function showProgressNotification(data) {
  const completed = Number(data.completed || 0);
  const total = Number(data.total || 0);
  const percentage = Number(data.percentage || 0);

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

  const customTitle = typeof data.title === 'string' && data.title.trim().length > 0 ? data.title.trim() : `${prefix} ${title}`;
  const customBody = typeof data.body === 'string' && data.body.trim().length > 0 ? data.body.trim() : body;
  const customTag = typeof data.tag === 'string' && data.tag.trim().length > 0 ? data.tag.trim() : 'flowly-progress';

  const options = buildNotificationOptions({
    body: customBody,
    tag: customTag,
    requireInteraction: false
  });

  self.registration.showNotification(customTitle, options);
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

  const targetUrl = data.url ? scopedUrl(data.url) : scopedUrl('');

  const options = buildNotificationOptions({
    body: data.body,
    tag: data.tag || 'flowly-push',
    requireInteraction: false,
    data: {
      url: targetUrl,
      type: data.type
    },
    actions: [
      { action: 'open', title: 'Abrir Flowly' },
      { action: 'close', title: 'Fechar' }
    ]
  });

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    const targetUrl = (event.notification.data && event.notification.data.url) || scopedUrl('');

    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }

        return undefined;
      })
    );
  }
});
