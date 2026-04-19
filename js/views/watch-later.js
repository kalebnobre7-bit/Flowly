(function () {
  const STORAGE_KEY = 'flowly.watchLater.v1';

  function loadVideos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveVideos(videos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
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

  async function addVideo(input) {
    const id = parseYouTubeId(input);
    if (!id) return { ok: false, reason: 'invalid' };

    const videos = loadVideos();
    if (videos.some((v) => v.id === id)) return { ok: false, reason: 'duplicate' };

    const placeholder = {
      id,
      title: 'Carregando…',
      author: '',
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      addedAt: new Date().toISOString(),
      watched: false
    };
    videos.unshift(placeholder);
    saveVideos(videos);
    renderWatchView();

    const meta = await fetchOEmbed(id);
    if (meta) {
      const all = loadVideos();
      const idx = all.findIndex((v) => v.id === id);
      if (idx !== -1) {
        all[idx].title = meta.title || all[idx].title;
        all[idx].author = meta.author_name || '';
        all[idx].thumbnail = meta.thumbnail_url || all[idx].thumbnail;
        saveVideos(all);
        renderWatchView();
      }
    } else {
      const all = loadVideos();
      const idx = all.findIndex((v) => v.id === id);
      if (idx !== -1 && all[idx].title === 'Carregando…') {
        all[idx].title = `Video ${id}`;
        saveVideos(all);
        renderWatchView();
      }
    }
    return { ok: true };
  }

  function removeVideo(id) {
    const videos = loadVideos().filter((v) => v.id !== id);
    saveVideos(videos);
    renderWatchView();
  }

  function toggleWatched(id) {
    const videos = loadVideos();
    const v = videos.find((x) => x.id === id);
    if (!v) return;
    v.watched = !v.watched;
    saveVideos(videos);
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

  function renderWatchView() {
    const view = document.getElementById('watchView');
    if (!view) return;

    const videos = loadVideos();
    const pending = videos.filter((v) => !v.watched);
    const watched = videos.filter((v) => v.watched);

    const emptyState = `
      <div class="watch-empty">
        <div class="watch-empty__icon"><i data-lucide="play-circle"></i></div>
        <h3>Sua lista está vazia</h3>
        <p>Cole um link do YouTube acima para salvar vídeos e assistir depois.</p>
      </div>`;

    const videoCard = (v) => `
      <article class="watch-card${v.watched ? ' is-watched' : ''}" data-video-id="${v.id}">
        <a class="watch-card__thumb" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener noreferrer">
          <img src="${escapeHtml(v.thumbnail)}" alt="" loading="lazy" onerror="this.src='https://i.ytimg.com/vi/${v.id}/hqdefault.jpg'" />
          <span class="watch-card__play"><i data-lucide="play"></i></span>
        </a>
        <div class="watch-card__body">
          <a class="watch-card__title" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener noreferrer">${escapeHtml(v.title)}</a>
          <div class="watch-card__meta">
            ${v.author ? `<span class="watch-card__author">${escapeHtml(v.author)}</span>` : ''}
            <span class="watch-card__added">${formatAddedDate(v.addedAt)}</span>
          </div>
        </div>
        <div class="watch-card__actions">
          <button type="button" class="watch-card__action" data-watch-action="toggle" data-id="${v.id}" title="${v.watched ? 'Marcar como não assistido' : 'Marcar como assistido'}">
            <i data-lucide="${v.watched ? 'rotate-ccw' : 'check'}"></i>
          </button>
          <button type="button" class="watch-card__action watch-card__action--danger" data-watch-action="remove" data-id="${v.id}" title="Remover">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </article>`;

    view.innerHTML = `
      <div class="flowly-page watch-page">
        <header class="flowly-page-header">
          <div class="flowly-page-header__title">
            <h1>Assistir depois</h1>
            <p class="flowly-page-header__subtitle">Sua playlist pessoal do YouTube</p>
          </div>
        </header>

        <form class="watch-add" id="watchAddForm" autocomplete="off">
          <div class="watch-add__field">
            <i data-lucide="link-2" class="watch-add__icon"></i>
            <input
              type="text"
              id="watchAddInput"
              class="watch-add__input"
              placeholder="Cole o link do YouTube aqui…"
              aria-label="Link do YouTube"
            />
          </div>
          <button type="submit" class="flowly-btn flowly-btn--primary">
            <i data-lucide="plus"></i>
            <span>Salvar</span>
          </button>
        </form>
        <div id="watchFeedback" class="watch-feedback" role="status" aria-live="polite"></div>

        ${
          videos.length === 0
            ? emptyState
            : `
          <section class="watch-section">
            <div class="watch-section__header">
              <h2>Para assistir <span class="watch-section__count">${pending.length}</span></h2>
            </div>
            <div class="watch-grid">
              ${pending.length ? pending.map(videoCard).join('') : '<p class="watch-section__empty">Tudo assistido. Bom trabalho!</p>'}
            </div>
          </section>

          ${
            watched.length
              ? `
            <section class="watch-section watch-section--watched">
              <div class="watch-section__header">
                <h2>Assistidos <span class="watch-section__count">${watched.length}</span></h2>
              </div>
              <div class="watch-grid">
                ${watched.map(videoCard).join('')}
              </div>
            </section>`
              : ''
          }
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
        const result = await addVideo(value);
        if (result.ok) {
          input.value = '';
          showFeedback('Salvo na lista', 'success');
        } else if (result.reason === 'duplicate') {
          showFeedback('Vídeo já está na lista', 'warn');
        } else {
          showFeedback('Link inválido — cole uma URL do YouTube', 'error');
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
        if (action === 'remove') removeVideo(id);
        if (action === 'toggle') toggleWatched(id);
      });
    }
  }

  window.renderWatchView = renderWatchView;
})();
