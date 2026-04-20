(function () {
  const STORAGE_KEY = 'flowly.watchLater.v1';

  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => ({ kind: item && item.kind ? item.kind : 'youtube', ...item }));
    } catch {
      return [];
    }
  }

  function saveItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function parseYouTubeId(input) {
    if (!input) return null;
    const s = String(input).trim();
    const idRegex = /^[a-zA-Z0-9_-]{11}$/;
    if (idRegex.test(s)) return s;
    const patterns = [
      /(?:youtube\.com\/watch\?(?:[^&]+&)*v=)([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/
    ];
    for (const re of patterns) {
      const m = s.match(re);
      if (m) return m[1];
    }
    return null;
  }

  function parseUrl(input) {
    if (!input) return null;
    const raw = String(input).trim();
    if (!raw) return null;
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`;
    try {
      const u = new URL(withScheme);
      if (!u.hostname || !u.hostname.includes('.')) return null;
      return u;
    } catch {
      return null;
    }
  }

  async function fetchOEmbed(videoId) {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('oembed ' + res.status);
      return await res.json();
    } catch {
      return null;
    }
  }

  async function addItem(input) {
    const ytId = parseYouTubeId(input);
    if (ytId) return addYouTube(ytId);

    const url = parseUrl(input);
    if (url) return addLink(url);

    return { ok: false, reason: 'invalid' };
  }

  async function addYouTube(id) {
    const items = loadItems();
    if (items.some((v) => v.kind === 'youtube' && v.id === id)) {
      return { ok: false, reason: 'duplicate' };
    }

    const placeholder = {
      kind: 'youtube',
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      title: 'Carregando…',
      author: '',
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      addedAt: new Date().toISOString(),
      watched: false
    };
    items.unshift(placeholder);
    saveItems(items);
    renderWatchView();

    const meta = await fetchOEmbed(id);
    const all = loadItems();
    const idx = all.findIndex((v) => v.kind === 'youtube' && v.id === id);
    if (idx === -1) return { ok: true };
    if (meta) {
      all[idx].title = meta.title || all[idx].title;
      all[idx].author = meta.author_name || '';
      all[idx].thumbnail = meta.thumbnail_url || all[idx].thumbnail;
    } else if (all[idx].title === 'Carregando…') {
      all[idx].title = `Video ${id}`;
    }
    saveItems(all);
    renderWatchView();
    return { ok: true };
  }

  function addLink(url) {
    const href = url.toString();
    const items = loadItems();
    if (items.some((v) => v.kind === 'link' && v.url === href)) {
      return { ok: false, reason: 'duplicate' };
    }

    const host = url.hostname.replace(/^www\./, '');
    const pathPreview = (url.pathname === '/' ? '' : url.pathname).slice(0, 80);
    const titleGuess = pathPreview
      ? `${host}${pathPreview}`
      : host;

    const item = {
      kind: 'link',
      id: `link_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      url: href,
      host,
      title: titleGuess,
      favicon: `https://icons.duckduckgo.com/ip3/${host}.ico`,
      addedAt: new Date().toISOString(),
      watched: false
    };
    items.unshift(item);
    saveItems(items);
    renderWatchView();
    return { ok: true };
  }

  function removeItem(id) {
    const items = loadItems().filter((v) => v.id !== id);
    saveItems(items);
    renderWatchView();
  }

  function toggleWatched(id) {
    const items = loadItems();
    const v = items.find((x) => x.id === id);
    if (!v) return;
    v.watched = !v.watched;
    saveItems(items);
    renderWatchView();
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatAddedDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now - d;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'hoje';
      if (diffDays === 1) return 'ontem';
      if (diffDays < 7) return `${diffDays} dias atrás`;
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  }

  function videoCard(v) {
    return `
      <article class="watch-card${v.watched ? ' is-watched' : ''}" data-item-id="${escapeHtml(v.id)}">
        <a class="watch-card__thumb" href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer">
          <img src="${escapeHtml(v.thumbnail)}" alt="" loading="lazy" onerror="this.src='https://i.ytimg.com/vi/${escapeHtml(v.id)}/hqdefault.jpg'" />
          <span class="watch-card__play"><i data-lucide="play"></i></span>
        </a>
        <div class="watch-card__body">
          <a class="watch-card__title" href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(v.title)}</a>
          <div class="watch-card__meta">
            ${v.author ? `<span class="watch-card__author">${escapeHtml(v.author)}</span>` : ''}
            <span class="watch-card__added">${formatAddedDate(v.addedAt)}</span>
          </div>
        </div>
        <div class="watch-card__actions">
          <button type="button" class="watch-card__action" data-watch-action="toggle" data-id="${escapeHtml(v.id)}" title="${v.watched ? 'Marcar como não assistido' : 'Marcar como assistido'}">
            <i data-lucide="${v.watched ? 'rotate-ccw' : 'check'}"></i>
          </button>
          <button type="button" class="watch-card__action watch-card__action--danger" data-watch-action="remove" data-id="${escapeHtml(v.id)}" title="Remover">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </article>`;
  }

  function linkCard(v) {
    return `
      <article class="watch-link${v.watched ? ' is-watched' : ''}" data-item-id="${escapeHtml(v.id)}">
        <a class="watch-link__main" href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer">
          <span class="watch-link__icon">
            <img src="${escapeHtml(v.favicon)}" alt="" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.add('watch-link__icon--fallback');" />
            <i data-lucide="link-2"></i>
          </span>
          <span class="watch-link__body">
            <span class="watch-link__title">${escapeHtml(v.title || v.host)}</span>
            <span class="watch-link__meta">
              <span class="watch-link__host">${escapeHtml(v.host)}</span>
              <span class="watch-link__added">${formatAddedDate(v.addedAt)}</span>
            </span>
          </span>
        </a>
        <div class="watch-link__actions">
          <button type="button" class="watch-card__action" data-watch-action="toggle" data-id="${escapeHtml(v.id)}" title="${v.watched ? 'Marcar como não lido' : 'Marcar como lido'}">
            <i data-lucide="${v.watched ? 'rotate-ccw' : 'check'}"></i>
          </button>
          <button type="button" class="watch-card__action watch-card__action--danger" data-watch-action="remove" data-id="${escapeHtml(v.id)}" title="Remover">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </article>`;
  }

  function renderWatchView() {
    const view = document.getElementById('watchView');
    if (!view) return;

    const items = loadItems();
    const videosPending = items.filter((v) => v.kind === 'youtube' && !v.watched);
    const videosWatched = items.filter((v) => v.kind === 'youtube' && v.watched);
    const linksPending = items.filter((v) => v.kind === 'link' && !v.watched);
    const linksWatched = items.filter((v) => v.kind === 'link' && v.watched);

    const emptyState = `
      <div class="watch-empty">
        <div class="watch-empty__icon"><i data-lucide="play-circle"></i></div>
        <h3>Sua lista está vazia</h3>
        <p>Cole um link do YouTube ou de qualquer site acima para salvar e voltar depois.</p>
      </div>`;

    const videoSection = (title, list) => `
      <section class="watch-section">
        <div class="watch-section__header">
          <h2>${title} <span class="watch-section__count">${list.length}</span></h2>
        </div>
        <div class="watch-grid">${list.map(videoCard).join('')}</div>
      </section>`;

    const linkSection = (title, list) => `
      <section class="watch-section">
        <div class="watch-section__header">
          <h2>${title} <span class="watch-section__count">${list.length}</span></h2>
        </div>
        <div class="watch-link-list">${list.map(linkCard).join('')}</div>
      </section>`;

    view.innerHTML = `
      <div class="flowly-page watch-page">
        <header class="flowly-page-header">
          <div class="flowly-page-header__title">
            <h1>Assistir depois</h1>
            <p class="flowly-page-header__subtitle">Vídeos do YouTube e links de sites pra voltar depois</p>
          </div>
        </header>

        <form class="watch-add" id="watchAddForm" autocomplete="off">
          <div class="watch-add__field">
            <i data-lucide="link-2" class="watch-add__icon"></i>
            <input
              type="text"
              id="watchAddInput"
              class="watch-add__input"
              placeholder="Cole um link do YouTube ou de qualquer site…"
              aria-label="Link para salvar"
            />
          </div>
          <button type="submit" class="flowly-btn flowly-btn--primary">
            <i data-lucide="plus"></i>
            <span>Salvar</span>
          </button>
        </form>
        <div id="watchFeedback" class="watch-feedback" role="status" aria-live="polite"></div>

        ${
          items.length === 0
            ? emptyState
            : `
          ${videosPending.length ? videoSection('Vídeos', videosPending) : ''}
          ${linksPending.length ? linkSection('Links', linksPending) : ''}
          ${videosWatched.length ? videoSection('Vídeos assistidos', videosWatched) : ''}
          ${linksWatched.length ? linkSection('Links lidos', linksWatched) : ''}
        `
        }
      </div>`;

    bindWatchView();
    if (window.lucide) lucide.createIcons();
  }

  function showFeedback(message, type = 'info') {
    const el = document.getElementById('watchFeedback');
    if (!el) return;
    el.textContent = message;
    el.dataset.type = type;
    el.classList.add('is-visible');
    setTimeout(() => el.classList.remove('is-visible'), 2400);
  }

  function bindWatchView() {
    const form = document.getElementById('watchAddForm');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('watchAddInput');
        if (!input) return;
        const value = input.value.trim();
        if (!value) return;
        const result = await addItem(value);
        if (result.ok) {
          input.value = '';
          showFeedback('Salvo na lista', 'success');
        } else if (result.reason === 'duplicate') {
          showFeedback('Esse link já está na lista', 'warn');
        } else {
          showFeedback('Link inválido — cole uma URL', 'error');
        }
      });
    }

    const view = document.getElementById('watchView');
    if (view && !view.dataset.boundClick) {
      view.dataset.boundClick = '1';
      view.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-watch-action]');
        if (!btn) return;
        e.preventDefault();
        const action = btn.dataset.watchAction;
        const id = btn.dataset.id;
        if (!id) return;
        if (action === 'remove') removeItem(id);
        if (action === 'toggle') toggleWatched(id);
      });
    }
  }

  window.renderWatchView = renderWatchView;
})();
