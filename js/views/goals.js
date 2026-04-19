(function () {
  const STORAGE_KEY = 'flowly.goals.v1';

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function save(goals) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  }

  function uid() {
    return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function createGoal({ title, target, unit, deadline }) {
    const goals = load();
    const goal = {
      id: uid(),
      title: String(title || '').trim(),
      target: Math.max(1, Number(target) || 1),
      current: 0,
      unit: String(unit || '').trim(),
      deadline: deadline || null,
      createdAt: new Date().toISOString(),
      completedAt: null
    };
    if (!goal.title) return { ok: false, reason: 'no-title' };
    goals.unshift(goal);
    save(goals);
    renderGoalsView();
    return { ok: true };
  }

  function updateProgress(id, delta) {
    const goals = load();
    const g = goals.find((x) => x.id === id);
    if (!g) return;
    g.current = Math.max(0, Math.min(g.target, g.current + delta));
    if (g.current >= g.target && !g.completedAt) g.completedAt = new Date().toISOString();
    if (g.current < g.target) g.completedAt = null;
    save(goals);
    renderGoalsView();
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
    renderGoalsView();
  }

  function removeGoal(id) {
    save(load().filter((g) => g.id !== id));
    renderGoalsView();
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
    if (!iso) return '';
    try {
      const target = new Date(iso + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
      const label = target.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      if (diffDays < 0) return { text: `Atrasada · ${label}`, tone: 'late' };
      if (diffDays === 0) return { text: `Hoje · ${label}`, tone: 'soon' };
      if (diffDays === 1) return { text: `Amanhã · ${label}`, tone: 'soon' };
      if (diffDays <= 7) return { text: `${diffDays} dias · ${label}`, tone: 'soon' };
      if (diffDays <= 30) return { text: `${diffDays} dias · ${label}`, tone: 'normal' };
      return { text: label, tone: 'normal' };
    } catch {
      return '';
    }
  }

  function goalCard(g) {
    const pct = Math.min(100, Math.round((g.current / g.target) * 100));
    const done = !!g.completedAt;
    const dl = formatDeadline(g.deadline);
    const unitLabel = g.unit ? ` ${escapeHtml(g.unit)}` : '';
    return `
      <article class="goal-card${done ? ' is-done' : ''}" data-goal-id="${g.id}">
        <div class="goal-card__head">
          <h3 class="goal-card__title">${escapeHtml(g.title)}</h3>
          <div class="goal-card__actions">
            <button type="button" class="goal-action" data-goal-action="toggle" data-id="${g.id}" title="${done ? 'Reabrir' : 'Marcar concluída'}">
              <i data-lucide="${done ? 'rotate-ccw' : 'check'}"></i>
            </button>
            <button type="button" class="goal-action goal-action--danger" data-goal-action="remove" data-id="${g.id}" title="Remover">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>

        <div class="goal-card__progress-wrap">
          <div class="goal-card__progress">
            <div class="goal-card__progress-bar" style="width: ${pct}%"></div>
          </div>
          <div class="goal-card__progress-labels">
            <span class="goal-card__count">${g.current}<span class="goal-card__sep"> / ${g.target}</span>${unitLabel}</span>
            <span class="goal-card__pct">${pct}%</span>
          </div>
        </div>

        <div class="goal-card__foot">
          <div class="goal-card__stepper">
            <button type="button" class="goal-step" data-goal-action="dec" data-id="${g.id}" aria-label="Reduzir" ${g.current <= 0 ? 'disabled' : ''}>
              <i data-lucide="minus"></i>
            </button>
            <button type="button" class="goal-step goal-step--primary" data-goal-action="inc" data-id="${g.id}" aria-label="Progredir" ${done ? 'disabled' : ''}>
              <i data-lucide="plus"></i>
            </button>
          </div>
          ${
            dl
              ? `<span class="goal-card__deadline goal-card__deadline--${dl.tone}">
                  <i data-lucide="calendar"></i>${escapeHtml(dl.text)}
                </span>`
              : '<span class="goal-card__deadline goal-card__deadline--muted">Sem prazo</span>'
          }
        </div>
      </article>`;
  }

  function renderGoalsView() {
    const view = document.getElementById('goalsView');
    if (!view) return;

    const goals = load();
    const active = goals.filter((g) => !g.completedAt);
    const done = goals.filter((g) => g.completedAt);

    const totalActive = active.length;
    const totalDone = done.length;
    const avgProgress = active.length
      ? Math.round(
          active.reduce((acc, g) => acc + Math.min(100, (g.current / g.target) * 100), 0) /
            active.length
        )
      : 0;

    const emptyState = `
      <div class="goals-empty">
        <div class="goals-empty__icon"><i data-lucide="target"></i></div>
        <h3>Defina sua primeira meta</h3>
        <p>Metas concretas, com número e prazo, são mais fáceis de bater. Comece abaixo.</p>
      </div>`;

    view.innerHTML = `
      <div class="flowly-page goals-page">
        <header class="flowly-page-header">
          <div class="flowly-page-header__title">
            <h1>Metas</h1>
            <p class="flowly-page-header__subtitle">Progresso concreto, no seu ritmo</p>
          </div>
          <div class="goals-stats">
            <div class="goals-stat"><span class="goals-stat__value">${totalActive}</span><span class="goals-stat__label">Ativas</span></div>
            <div class="goals-stat"><span class="goals-stat__value">${avgProgress}%</span><span class="goals-stat__label">Progresso</span></div>
            <div class="goals-stat"><span class="goals-stat__value">${totalDone}</span><span class="goals-stat__label">Concluídas</span></div>
          </div>
        </header>

        <form class="goal-add" id="goalAddForm" autocomplete="off">
          <div class="goal-add__row">
            <div class="goal-add__field goal-add__field--title">
              <i data-lucide="flag" class="goal-add__icon"></i>
              <input type="text" id="goalAddTitle" class="goal-add__input" placeholder="Nova meta (ex: Ler 12 livros)" required />
            </div>
            <div class="goal-add__field goal-add__field--target">
              <input type="number" id="goalAddTarget" class="goal-add__input" placeholder="Meta" min="1" step="1" value="1" required />
            </div>
            <div class="goal-add__field goal-add__field--unit">
              <input type="text" id="goalAddUnit" class="goal-add__input" placeholder="Unidade (livros, km)" />
            </div>
            <div class="goal-add__field goal-add__field--date">
              <i data-lucide="calendar" class="goal-add__icon"></i>
              <input type="date" id="goalAddDeadline" class="goal-add__input goal-add__input--date" />
            </div>
            <button type="submit" class="flowly-btn flowly-btn--primary goal-add__submit">
              <i data-lucide="plus"></i>
              <span>Criar</span>
            </button>
          </div>
        </form>

        ${
          goals.length === 0
            ? emptyState
            : `
          ${
            active.length
              ? `
            <section class="goals-section">
              <div class="goals-section__header">
                <h2>Em andamento <span class="goals-section__count">${active.length}</span></h2>
              </div>
              <div class="goals-grid">
                ${active.map(goalCard).join('')}
              </div>
            </section>`
              : `<p class="goals-section__empty">Nenhuma meta ativa no momento.</p>`
          }

          ${
            done.length
              ? `
            <section class="goals-section goals-section--done">
              <div class="goals-section__header">
                <h2>Concluídas <span class="goals-section__count">${done.length}</span></h2>
              </div>
              <div class="goals-grid">
                ${done.map(goalCard).join('')}
              </div>
            </section>`
              : ''
          }
        `
        }
      </div>`;

    bindGoalsView();
    if (window.lucide) lucide.createIcons();
  }

  function bindGoalsView() {
    const form = document.getElementById('goalAddForm');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('goalAddTitle').value;
        const target = document.getElementById('goalAddTarget').value;
        const unit = document.getElementById('goalAddUnit').value;
        const deadline = document.getElementById('goalAddDeadline').value;
        const res = createGoal({ title, target, unit, deadline });
        if (res.ok) form.reset();
      });
    }

    const view = document.getElementById('goalsView');
    if (view && !view.dataset.boundClick) {
      view.dataset.boundClick = '1';
      view.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-goal-action]');
        if (!btn) return;
        e.preventDefault();
        const action = btn.dataset.goalAction;
        const id = btn.dataset.id;
        if (!id) return;
        if (action === 'inc') updateProgress(id, 1);
        else if (action === 'dec') updateProgress(id, -1);
        else if (action === 'toggle') toggleComplete(id);
        else if (action === 'remove') removeGoal(id);
      });
    }
  }

  window.renderGoalsView = renderGoalsView;
})();
