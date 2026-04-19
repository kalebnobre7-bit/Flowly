(function () {
  const STORAGE_KEY = 'flowly.goals.v2';
  const V1_KEY = 'flowly.goals.v1';
  const UI_KEY = 'flowly.goals.ui.v1';

  const COLORS = [
    { id: 'green', hex: '#22c55e' },
    { id: 'blue', hex: '#3b82f6' },
    { id: 'purple', hex: '#a855f7' },
    { id: 'pink', hex: '#ec4899' },
    { id: 'amber', hex: '#f59e0b' },
    { id: 'red', hex: '#ef4444' },
    { id: 'slate', hex: '#94a3b8' }
  ];

  const EMOJI_PRESETS = [
    '🎯','🏆','📚','💪','🏃','🧘','💰','💡','✍️','🎨',
    '🎸','🧠','🌱','🔥','⭐','🌊','🚀','📈','🏋️','🍎',
    '💼','🎓','🌎','🧗','🏊','🚴','🧪','🎬','🧱','🛠️'
  ];

  const SORT_OPTIONS = [
    { id: 'manual',    label: 'Ordem manual' },
    { id: 'deadline',  label: 'Prazo' },
    { id: 'progress',  label: 'Progresso' },
    { id: 'title',     label: 'Título' },
    { id: 'createdAt', label: 'Mais recentes' }
  ];

  let uiState = loadUIState();
  let activePopover = null;
  let dragState = { id: null };

  function loadUIState() {
    try {
      return {
        view: 'cards',
        sort: 'manual',
        ...JSON.parse(localStorage.getItem(UI_KEY) || '{}')
      };
    } catch {
      return { view: 'cards', sort: 'manual' };
    }
  }

  function saveUIState() {
    localStorage.setItem(UI_KEY, JSON.stringify(uiState));
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(normalize);
      }
    } catch {}
    try {
      const v1 = JSON.parse(localStorage.getItem(V1_KEY) || '[]');
      if (Array.isArray(v1) && v1.length) {
        const migrated = v1.map((g, i) => normalize({ ...g, order: i }));
        save(migrated);
        return migrated;
      }
    } catch {}
    return [];
  }

  function normalize(g) {
    return {
      id: g.id || uid(),
      icon: g.icon || '🎯',
      color: COLORS.find((c) => c.id === g.color) ? g.color : 'green',
      title: String(g.title || 'Nova meta'),
      description: String(g.description || ''),
      target: Math.max(1, Number(g.target) || 1),
      current: Math.max(0, Number(g.current) || 0),
      unit: String(g.unit || ''),
      deadline: g.deadline || null,
      category: String(g.category || ''),
      order: typeof g.order === 'number' ? g.order : 0,
      createdAt: g.createdAt || new Date().toISOString(),
      completedAt: g.completedAt || null
    };
  }

  function save(goals) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  }

  function uid() {
    return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function reorderIndices(goals) {
    goals.forEach((g, i) => (g.order = i));
  }

  function createGoal(title) {
    const t = String(title || '').trim();
    if (!t) return null;
    const goals = load();
    const goal = normalize({
      title: t,
      order: -1
    });
    goals.unshift(goal);
    reorderIndices(goals);
    save(goals);
    return goal;
  }

  function removeGoal(id) {
    const goals = load().filter((g) => g.id !== id);
    reorderIndices(goals);
    save(goals);
  }

  function patchGoal(id, patch) {
    const goals = load();
    const g = goals.find((x) => x.id === id);
    if (!g) return null;
    Object.assign(g, patch);
    g.target = Math.max(1, Number(g.target) || 1);
    g.current = Math.max(0, Math.min(g.target, Number(g.current) || 0));
    if (g.current >= g.target && !g.completedAt) g.completedAt = new Date().toISOString();
    if (g.current < g.target) g.completedAt = null;
    save(goals);
    return g;
  }

  function toggleComplete(id) {
    const goals = load();
    const g = goals.find((x) => x.id === id);
    if (!g) return;
    if (g.completedAt) {
      g.completedAt = null;
      if (g.current >= g.target) g.current = Math.max(0, g.target - 1);
    } else {
      g.current = g.target;
      g.completedAt = new Date().toISOString();
    }
    save(goals);
  }

  function moveGoal(dragId, targetId, position) {
    if (!dragId || !targetId || dragId === targetId) return;
    const goals = load();
    const dragIdx = goals.findIndex((g) => g.id === dragId);
    const targetIdx = goals.findIndex((g) => g.id === targetId);
    if (dragIdx < 0 || targetIdx < 0) return;
    const [moved] = goals.splice(dragIdx, 1);
    const insertAt = goals.findIndex((g) => g.id === targetId);
    goals.splice(position === 'after' ? insertAt + 1 : insertAt, 0, moved);
    reorderIndices(goals);
    save(goals);
  }

  function sortGoals(goals) {
    const arr = [...goals];
    switch (uiState.sort) {
      case 'deadline':
        arr.sort((a, b) => {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return a.deadline.localeCompare(b.deadline);
        });
        break;
      case 'progress':
        arr.sort((a, b) => b.current / b.target - a.current / a.target);
        break;
      case 'title':
        arr.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
        break;
      case 'createdAt':
        arr.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        break;
      case 'manual':
      default:
        arr.sort((a, b) => a.order - b.order);
    }
    return arr;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDeadline(iso) {
    if (!iso) return null;
    try {
      const target = new Date(iso + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = Math.round((target - today) / 86400000);
      const label = target.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      if (diff < 0) return { text: `Atrasada · ${label}`, tone: 'late' };
      if (diff === 0) return { text: `Hoje`, tone: 'soon' };
      if (diff === 1) return { text: `Amanhã`, tone: 'soon' };
      if (diff <= 7) return { text: `${diff} dias · ${label}`, tone: 'soon' };
      return { text: label, tone: 'normal' };
    } catch {
      return null;
    }
  }

  function pct(g) {
    return Math.min(100, Math.round((g.current / g.target) * 100));
  }

  /* ---------- PARTIAL DOM UPDATES (avoid full re-render during inline edits) ---------- */

  function updateProgressVisual(id) {
    const card = document.querySelector(`[data-goal-id="${id}"]`);
    if (!card) return;
    const g = load().find((x) => x.id === id);
    if (!g) return;
    const p = pct(g);
    const bar = card.querySelector('.goal-card__progress-bar');
    if (bar) bar.style.width = p + '%';
    const pctEl = card.querySelector('.goal-card__pct');
    if (pctEl) pctEl.textContent = p + '%';
    const curEl = card.querySelector('[data-goal-field="current"]');
    if (curEl && curEl.tagName !== 'INPUT') curEl.textContent = g.current;
    const tgtEl = card.querySelector('[data-goal-field="target"]');
    if (tgtEl && tgtEl.tagName !== 'INPUT') tgtEl.textContent = g.target;
    const decBtn = card.querySelector('[data-goal-action="dec"]');
    if (decBtn) decBtn.toggleAttribute('disabled', g.current <= 0);
    const incBtn = card.querySelector('[data-goal-action="inc"]');
    if (incBtn) incBtn.toggleAttribute('disabled', !!g.completedAt);
    card.classList.toggle('is-done', !!g.completedAt);

    const statsEl = document.querySelector('.goals-stats');
    if (statsEl) refreshStats(statsEl);
  }

  function refreshStats(statsEl) {
    const goals = load();
    const active = goals.filter((g) => !g.completedAt);
    const done = goals.filter((g) => g.completedAt);
    const avg = active.length
      ? Math.round(active.reduce((a, g) => a + pct(g), 0) / active.length)
      : 0;
    const values = statsEl.querySelectorAll('.goals-stat__value');
    if (values[0]) values[0].textContent = active.length;
    if (values[1]) values[1].textContent = avg + '%';
    if (values[2]) values[2].textContent = done.length;
  }

  /* ---------- POPOVERS ---------- */

  function closePopover() {
    if (activePopover) {
      activePopover.remove();
      activePopover = null;
      document.removeEventListener('click', onDocClickForPopover, true);
    }
  }

  function onDocClickForPopover(e) {
    if (!activePopover) return;
    if (!activePopover.contains(e.target) && !e.target.closest('[data-popover-anchor]')) {
      closePopover();
    }
  }

  function openPopover(anchor, content) {
    closePopover();
    const rect = anchor.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'goal-popover';
    pop.innerHTML = content;
    document.body.appendChild(pop);
    const pw = pop.offsetWidth;
    let left = rect.left;
    if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
    if (left < 12) left = 12;
    pop.style.left = left + 'px';
    pop.style.top = rect.bottom + 6 + window.scrollY + 'px';
    activePopover = pop;
    setTimeout(() => document.addEventListener('click', onDocClickForPopover, true), 0);
    if (window.lucide) lucide.createIcons();
    return pop;
  }

  function openEmojiPicker(anchor, id) {
    const html = `
      <div class="goal-popover__section">
        <div class="goal-popover__grid">
          ${EMOJI_PRESETS.map(
            (e) => `<button type="button" class="goal-emoji-btn" data-emoji="${e}">${e}</button>`
          ).join('')}
        </div>
      </div>
      <div class="goal-popover__section goal-popover__section--tight">
        <input type="text" class="goal-popover__custom" placeholder="Ou digite um emoji..." maxlength="4" />
      </div>`;
    const pop = openPopover(anchor, html);
    pop.querySelectorAll('[data-emoji]').forEach((btn) => {
      btn.addEventListener('click', () => {
        patchGoal(id, { icon: btn.dataset.emoji });
        const card = document.querySelector(`[data-goal-id="${id}"] .goal-icon`);
        if (card) card.textContent = btn.dataset.emoji;
        closePopover();
      });
    });
    const input = pop.querySelector('.goal-popover__custom');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = input.value.trim();
          if (val) {
            patchGoal(id, { icon: val });
            const iconEl = document.querySelector(`[data-goal-id="${id}"] .goal-icon`);
            if (iconEl) iconEl.textContent = val;
          }
          closePopover();
        }
      });
    }
  }

  function openColorPicker(anchor, id) {
    const html = `
      <div class="goal-popover__section">
        <div class="goal-popover__colors">
          ${COLORS.map(
            (c) =>
              `<button type="button" class="goal-color-btn goal-color-btn--${c.id}" data-color="${c.id}" title="${c.id}"></button>`
          ).join('')}
        </div>
      </div>`;
    const pop = openPopover(anchor, html);
    pop.querySelectorAll('[data-color]').forEach((btn) => {
      btn.addEventListener('click', () => {
        patchGoal(id, { color: btn.dataset.color });
        const card = document.querySelector(`[data-goal-id="${id}"]`);
        if (card) {
          COLORS.forEach((c) => card.classList.remove('goal-color-' + c.id));
          card.classList.add('goal-color-' + btn.dataset.color);
        }
        closePopover();
      });
    });
  }

  function openSortMenu(anchor) {
    const html = `
      <div class="goal-popover__section">
        ${SORT_OPTIONS.map(
          (o) =>
            `<button type="button" class="goal-popover__item${
              uiState.sort === o.id ? ' is-active' : ''
            }" data-sort="${o.id}">
              <i data-lucide="${uiState.sort === o.id ? 'check' : 'circle'}"></i>
              <span>${o.label}</span>
            </button>`
        ).join('')}
      </div>`;
    const pop = openPopover(anchor, html);
    pop.querySelectorAll('[data-sort]').forEach((btn) => {
      btn.addEventListener('click', () => {
        uiState.sort = btn.dataset.sort;
        saveUIState();
        closePopover();
        renderGoalsView();
      });
    });
  }

  /* ---------- INLINE EDIT HELPERS ---------- */

  function attachEditableText(el, id, field, { numeric } = {}) {
    if (!el) return;
    el.addEventListener('focus', () => el.classList.add('is-editing'));
    el.addEventListener('blur', () => {
      el.classList.remove('is-editing');
      const raw = el.textContent.replace(/\n/g, ' ').trim();
      if (numeric) {
        const n = Number(raw) || 0;
        patchGoal(id, { [field]: n });
        updateProgressVisual(id);
        const g = load().find((x) => x.id === id);
        if (g) el.textContent = g[field];
      } else {
        if (field === 'title' && !raw) {
          const g = load().find((x) => x.id === id);
          el.textContent = g ? g.title : 'Sem título';
          return;
        }
        patchGoal(id, { [field]: raw });
      }
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        el.blur();
      }
    });
  }

  function attachDeadlineEdit(pill, id) {
    if (!pill) return;
    pill.addEventListener('click', (e) => {
      if (e.target.closest('input')) return;
      const input = document.createElement('input');
      input.type = 'date';
      const g = load().find((x) => x.id === id);
      input.value = (g && g.deadline) || '';
      input.className = 'goal-inline-date';
      pill.innerHTML = '';
      pill.appendChild(input);
      input.focus();
      input.showPicker && input.showPicker();
      const commit = () => {
        patchGoal(id, { deadline: input.value || null });
        renderCardDeadline(id);
      };
      input.addEventListener('change', commit);
      input.addEventListener('blur', commit);
    });
  }

  function renderCardDeadline(id) {
    const card = document.querySelector(`[data-goal-id="${id}"]`);
    if (!card) return;
    const pill = card.querySelector('[data-goal-field="deadline"]');
    if (!pill) return;
    const g = load().find((x) => x.id === id);
    if (!g) return;
    const dl = formatDeadline(g.deadline);
    pill.className =
      'goal-card__pill goal-card__pill--deadline ' +
      (dl ? 'goal-card__pill--' + dl.tone : 'goal-card__pill--muted');
    pill.setAttribute('data-goal-field', 'deadline');
    pill.innerHTML = dl
      ? `<i data-lucide="calendar"></i><span>${escapeHtml(dl.text)}</span>`
      : `<i data-lucide="calendar-plus"></i><span>Adicionar prazo</span>`;
    if (window.lucide) lucide.createIcons();
    attachDeadlineEdit(pill, id);
  }

  /* ---------- RENDER ---------- */

  function viewSwitcherHtml() {
    const opt = (id, icon, label) =>
      `<button type="button" class="goals-viewswitch__btn${
        uiState.view === id ? ' is-active' : ''
      }" data-view="${id}" title="${label}">
        <i data-lucide="${icon}"></i>
      </button>`;
    return `<div class="goals-viewswitch">${opt('cards', 'layout-grid', 'Cards')}${opt(
      'list',
      'list',
      'Lista'
    )}</div>`;
  }

  function toolbarHtml() {
    const currentSort = SORT_OPTIONS.find((o) => o.id === uiState.sort) || SORT_OPTIONS[0];
    return `
      <div class="goals-toolbar">
        <form class="goals-quickadd" id="goalQuickAdd" autocomplete="off">
          <i data-lucide="plus" class="goals-quickadd__icon"></i>
          <input type="text" id="goalQuickInput" class="goals-quickadd__input"
            placeholder="Nova meta e Enter — edite tudo no card depois" />
        </form>
        <div class="goals-toolbar__right">
          <button type="button" class="goals-toolbar__btn" data-popover-anchor data-action="sort">
            <i data-lucide="arrow-up-down"></i>
            <span>${escapeHtml(currentSort.label)}</span>
            <i data-lucide="chevron-down" class="goals-toolbar__chev"></i>
          </button>
          ${viewSwitcherHtml()}
        </div>
      </div>`;
  }

  function cardHtml(g) {
    const p = pct(g);
    const dl = formatDeadline(g.deadline);
    const unitLabel = g.unit ? ` <span class="goal-card__unit" data-goal-field="unit" contenteditable="plaintext-only" spellcheck="false">${escapeHtml(g.unit)}</span>` : `<button type="button" class="goal-card__unit goal-card__unit--add" data-goal-action="add-unit">+ unidade</button>`;
    return `
      <article class="goal-card goal-color-${g.color}${g.completedAt ? ' is-done' : ''}" data-goal-id="${g.id}" draggable="true">
        <div class="goal-card__accent"></div>
        <div class="goal-card__head">
          <button type="button" class="goal-icon" data-popover-anchor data-action="emoji" data-id="${g.id}">${escapeHtml(g.icon)}</button>
          <h3 class="goal-card__title" data-goal-field="title" contenteditable="plaintext-only" spellcheck="false">${escapeHtml(g.title)}</h3>
          <div class="goal-card__menu">
            <button type="button" class="goal-action" data-popover-anchor data-action="color" data-id="${g.id}" title="Cor">
              <i data-lucide="palette"></i>
            </button>
            <button type="button" class="goal-action" data-goal-action="toggle" data-id="${g.id}" title="${g.completedAt ? 'Reabrir' : 'Concluir'}">
              <i data-lucide="${g.completedAt ? 'rotate-ccw' : 'check'}"></i>
            </button>
            <button type="button" class="goal-action goal-action--danger" data-goal-action="remove" data-id="${g.id}" title="Remover">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>

        <div class="goal-card__notes-wrap">
          <div class="goal-card__notes" data-goal-field="description" contenteditable="plaintext-only" spellcheck="false"
               data-placeholder="Anote algo — contexto, porquê, próximo passo...">${escapeHtml(g.description)}</div>
        </div>

        <div class="goal-card__progress-wrap">
          <div class="goal-card__progress"><div class="goal-card__progress-bar" style="width:${p}%"></div></div>
          <div class="goal-card__progress-labels">
            <span class="goal-card__count">
              <span data-goal-field="current" contenteditable="plaintext-only" spellcheck="false" inputmode="numeric">${g.current}</span><span class="goal-card__sep"> / </span><span data-goal-field="target" contenteditable="plaintext-only" spellcheck="false" inputmode="numeric">${g.target}</span>${unitLabel}
            </span>
            <span class="goal-card__pct">${p}%</span>
          </div>
        </div>

        <div class="goal-card__foot">
          <div class="goal-card__stepper">
            <button type="button" class="goal-step" data-goal-action="dec" data-id="${g.id}" aria-label="−" ${g.current <= 0 ? 'disabled' : ''}><i data-lucide="minus"></i></button>
            <button type="button" class="goal-step goal-step--primary" data-goal-action="inc" data-id="${g.id}" aria-label="+" ${g.completedAt ? 'disabled' : ''}><i data-lucide="plus"></i></button>
          </div>
          <div class="goal-card__pills">
            ${g.category
              ? `<span class="goal-card__pill goal-card__pill--category"><i data-lucide="hash"></i><span data-goal-field="category" contenteditable="plaintext-only" spellcheck="false">${escapeHtml(g.category)}</span></span>`
              : `<button type="button" class="goal-card__pill goal-card__pill--add" data-goal-action="add-category"><i data-lucide="hash"></i><span>Tag</span></button>`}
            <button type="button" class="goal-card__pill goal-card__pill--deadline ${dl ? 'goal-card__pill--' + dl.tone : 'goal-card__pill--muted'}" data-goal-field="deadline">
              <i data-lucide="${dl ? 'calendar' : 'calendar-plus'}"></i>
              <span>${dl ? escapeHtml(dl.text) : 'Adicionar prazo'}</span>
            </button>
          </div>
        </div>
      </article>`;
  }

  function listRowHtml(g) {
    const p = pct(g);
    const dl = formatDeadline(g.deadline);
    return `
      <div class="goal-row goal-color-${g.color}${g.completedAt ? ' is-done' : ''}" data-goal-id="${g.id}" draggable="true">
        <button type="button" class="goal-row__icon" data-popover-anchor data-action="emoji" data-id="${g.id}">${escapeHtml(g.icon)}</button>
        <div class="goal-row__main">
          <div class="goal-row__title" data-goal-field="title" contenteditable="plaintext-only" spellcheck="false">${escapeHtml(g.title)}</div>
          ${g.description ? `<div class="goal-row__notes" data-goal-field="description" contenteditable="plaintext-only" spellcheck="false">${escapeHtml(g.description)}</div>` : ''}
        </div>
        <div class="goal-row__progress">
          <div class="goal-row__bar"><div class="goal-row__bar-fill" style="width:${p}%"></div></div>
          <span class="goal-row__count">
            <span data-goal-field="current" contenteditable="plaintext-only" spellcheck="false" inputmode="numeric">${g.current}</span>/<span data-goal-field="target" contenteditable="plaintext-only" spellcheck="false" inputmode="numeric">${g.target}</span>
            ${g.unit ? ` <span data-goal-field="unit" contenteditable="plaintext-only" spellcheck="false">${escapeHtml(g.unit)}</span>` : ''}
          </span>
        </div>
        <button type="button" class="goal-row__deadline ${dl ? 'goal-card__pill--' + dl.tone : 'goal-card__pill--muted'}" data-goal-field="deadline">
          <i data-lucide="${dl ? 'calendar' : 'calendar-plus'}"></i>
          <span>${dl ? escapeHtml(dl.text) : 'prazo'}</span>
        </button>
        <div class="goal-row__actions">
          <button type="button" class="goal-action" data-popover-anchor data-action="color" data-id="${g.id}" title="Cor"><i data-lucide="palette"></i></button>
          <button type="button" class="goal-action" data-goal-action="toggle" data-id="${g.id}"><i data-lucide="${g.completedAt ? 'rotate-ccw' : 'check'}"></i></button>
          <button type="button" class="goal-action goal-action--danger" data-goal-action="remove" data-id="${g.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>`;
  }

  function renderGoalsView() {
    const view = document.getElementById('goalsView');
    if (!view) return;

    const goals = sortGoals(load());
    const active = goals.filter((g) => !g.completedAt);
    const done = goals.filter((g) => g.completedAt);
    const avg = active.length
      ? Math.round(active.reduce((a, g) => a + pct(g), 0) / active.length)
      : 0;

    const isCards = uiState.view === 'cards';
    const wrapClass = isCards ? 'goals-grid' : 'goals-list';
    const renderItem = isCards ? cardHtml : listRowHtml;

    const emptyState = `
      <div class="goals-empty">
        <div class="goals-empty__icon">🎯</div>
        <h3>Defina sua primeira meta</h3>
        <p>Digite acima e pressione Enter. Depois clique em qualquer coisa no card para editar — título, progresso, cor, emoji, tag, prazo, notas.</p>
      </div>`;

    view.innerHTML = `
      <div class="flowly-page goals-page">
        <header class="flowly-page-header">
          <div class="flowly-page-header__title">
            <h1>Metas</h1>
            <p class="flowly-page-header__subtitle">Edite tudo inline. Clique, digite, arraste.</p>
          </div>
          <div class="goals-stats">
            <div class="goals-stat"><span class="goals-stat__value">${active.length}</span><span class="goals-stat__label">Ativas</span></div>
            <div class="goals-stat"><span class="goals-stat__value">${avg}%</span><span class="goals-stat__label">Progresso</span></div>
            <div class="goals-stat"><span class="goals-stat__value">${done.length}</span><span class="goals-stat__label">Concluídas</span></div>
          </div>
        </header>

        ${toolbarHtml()}

        ${
          goals.length === 0
            ? emptyState
            : `
          ${active.length ? `
            <section class="goals-section">
              <div class="goals-section__header">
                <h2>Em andamento <span class="goals-section__count">${active.length}</span></h2>
              </div>
              <div class="${wrapClass}">${active.map(renderItem).join('')}</div>
            </section>` : ''}
          ${done.length ? `
            <section class="goals-section goals-section--done">
              <div class="goals-section__header">
                <h2>Concluídas <span class="goals-section__count">${done.length}</span></h2>
              </div>
              <div class="${wrapClass}">${done.map(renderItem).join('')}</div>
            </section>` : ''}
        `}
      </div>`;

    bindGoalsView();
    if (window.lucide) lucide.createIcons();
  }

  /* ---------- BINDINGS ---------- */

  function bindGoalsView() {
    const view = document.getElementById('goalsView');
    if (!view) return;

    // Quick-add
    const form = document.getElementById('goalQuickAdd');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('goalQuickInput');
        const val = input.value.trim();
        if (!val) return;
        createGoal(val);
        input.value = '';
        renderGoalsView();
      });
    }

    // Inline editable fields (contenteditable)
    view.querySelectorAll('[data-goal-field]').forEach((el) => {
      if (el.tagName === 'INPUT') return;
      const card = el.closest('[data-goal-id]');
      if (!card) return;
      const id = card.dataset.goalId;
      const field = el.dataset.goalField;
      if (field === 'deadline') {
        attachDeadlineEdit(el, id);
      } else if (field === 'current' || field === 'target') {
        attachEditableText(el, id, field, { numeric: true });
      } else {
        attachEditableText(el, id, field);
      }
    });

    // Actions (stepper, toggle, remove, add-category, add-unit)
    view.querySelectorAll('[data-goal-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const action = btn.dataset.goalAction;
        const id = btn.dataset.id || btn.closest('[data-goal-id]')?.dataset.goalId;
        if (!id) return;
        if (action === 'inc') {
          const g = load().find((x) => x.id === id);
          if (g) patchGoal(id, { current: g.current + 1 });
          const after = load().find((x) => x.id === id);
          if (after && after.completedAt) renderGoalsView();
          else updateProgressVisual(id);
        } else if (action === 'dec') {
          const g = load().find((x) => x.id === id);
          if (g) patchGoal(id, { current: g.current - 1 });
          const after = load().find((x) => x.id === id);
          if (after && !after.completedAt && btn.closest('.is-done')) renderGoalsView();
          else updateProgressVisual(id);
        } else if (action === 'toggle') {
          toggleComplete(id);
          renderGoalsView();
        } else if (action === 'remove') {
          removeGoal(id);
          renderGoalsView();
        } else if (action === 'add-category') {
          const span = document.createElement('span');
          span.className = 'goal-card__pill goal-card__pill--category';
          span.innerHTML = `<i data-lucide="hash"></i><span data-goal-field="category" contenteditable="plaintext-only" spellcheck="false"></span>`;
          btn.replaceWith(span);
          if (window.lucide) lucide.createIcons();
          const editable = span.querySelector('[data-goal-field]');
          attachEditableText(editable, id, 'category');
          editable.focus();
        } else if (action === 'add-unit') {
          const editable = document.createElement('span');
          editable.className = 'goal-card__unit';
          editable.dataset.goalField = 'unit';
          editable.setAttribute('contenteditable', 'plaintext-only');
          editable.setAttribute('spellcheck', 'false');
          btn.replaceWith(editable);
          attachEditableText(editable, id, 'unit');
          editable.focus();
        }
      });
    });

    // Popover anchors (emoji, color, sort)
    view.querySelectorAll('[data-popover-anchor]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = anchor.dataset.action;
        const id = anchor.dataset.id;
        if (activePopover && activePopover.dataset.anchorId === anchor.dataset.anchorId) {
          closePopover();
          return;
        }
        if (action === 'emoji') openEmojiPicker(anchor, id);
        else if (action === 'color') openColorPicker(anchor, id);
        else if (action === 'sort') openSortMenu(anchor);
      });
    });

    // View switcher
    view.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        uiState.view = btn.dataset.view;
        saveUIState();
        renderGoalsView();
      });
    });

    // Drag & drop (manual sort only)
    view.querySelectorAll('[data-goal-id]').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        if (e.target.closest('[contenteditable="plaintext-only"]')) {
          e.preventDefault();
          return;
        }
        if (uiState.sort !== 'manual') return;
        dragState.id = el.dataset.goalId;
        el.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', el.dataset.goalId); } catch {}
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('is-dragging');
        view.querySelectorAll('.is-drop-before, .is-drop-after').forEach((n) => {
          n.classList.remove('is-drop-before', 'is-drop-after');
        });
        dragState.id = null;
      });
      el.addEventListener('dragover', (e) => {
        if (!dragState.id || dragState.id === el.dataset.goalId) return;
        if (uiState.sort !== 'manual') return;
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const after = (e.clientY - rect.top) / rect.height > 0.5;
        el.classList.toggle('is-drop-before', !after);
        el.classList.toggle('is-drop-after', after);
      });
      el.addEventListener('dragleave', () => {
        el.classList.remove('is-drop-before', 'is-drop-after');
      });
      el.addEventListener('drop', (e) => {
        if (!dragState.id || uiState.sort !== 'manual') return;
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const after = (e.clientY - rect.top) / rect.height > 0.5;
        moveGoal(dragState.id, el.dataset.goalId, after ? 'after' : 'before');
        renderGoalsView();
      });
    });
  }

  window.renderGoalsView = renderGoalsView;
})();
