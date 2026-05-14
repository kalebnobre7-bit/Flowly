(function () {
  const STORAGE_KEY = 'flowly.shopping.v1';

  const PRIORITY_META = {
    alta:  { label: 'Alta',  dot: '🔴', color: '#ef4444' },
    media: { label: 'Média', dot: '🟡', color: '#f59e0b' },
    baixa: { label: 'Baixa', dot: '🟢', color: '#22c55e' },
  };

  const PRIORITY_ORDER = ['alta', 'media', 'baixa'];

  /* ------------------------------------------------------------------ */
  /*  Persistence                                                          */
  /* ------------------------------------------------------------------ */

  function load() {
    return safeJSONParse(localStorage.getItem(STORAGE_KEY), []).map(normalize);
  }

  function save(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    syncToSupabase(items);
  }

  let _syncTimer = null;
  function syncToSupabase(items) {
    if (!window.supabaseClient || !window.currentUser) return;
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
      try {
        const payload = (items || []).map((item) => ({
          id:         item.id,
          user_id:    window.currentUser.id,
          name:       item.name,
          price:      item.price,
          priority:   item.priority,
          category:   item.category || null,
          status:     item.status,
          deadline:   item.deadline || null,
          notes:      item.notes || null,
          created_at: item.createdAt,
          bought_at:  item.boughtAt || null,
          updated_at: new Date().toISOString(),
        }));
        if (payload.length === 0) return;
        await window.supabaseClient
          .from('shopping_goals')
          .upsert(payload, { onConflict: 'id' });
      } catch (_) {}
    }, 800);
  }

  async function loadFromSupabase() {
    if (!window.supabaseClient || !window.currentUser) return;
    try {
      const { data, error } = await window.supabaseClient
        .from('shopping_goals')
        .select('*')
        .eq('user_id', window.currentUser.id)
        .order('created_at', { ascending: false });
      if (error && String(error.code) === '42P01') return;
      if (error || !data) return;
      if (data.length === 0) return;
      const remote = data.map((row) =>
        normalize({
          id:        row.id,
          name:      row.name,
          price:     row.price,
          priority:  row.priority,
          category:  row.category,
          status:    row.status,
          deadline:  row.deadline,
          notes:     row.notes,
          createdAt: row.created_at,
          boughtAt:  row.bought_at,
        })
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
      if (typeof renderShoppingView === 'function') renderShoppingView();
    } catch (_) {}
  }
  window.loadShoppingFromSupabase = loadFromSupabase;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                              */
  /* ------------------------------------------------------------------ */

  function normalize(item) {
    return {
      id:        item.id || uid(),
      name:      String(item.name || 'Novo item'),
      price:     Number(item.price) || 0,
      priority:  PRIORITY_ORDER.includes(item.priority) ? item.priority : 'media',
      category:  String(item.category || ''),
      status:    ['pendente', 'economizando', 'comprado'].includes(item.status)
                   ? item.status
                   : 'pendente',
      deadline:  item.deadline || null,
      notes:     String(item.notes || ''),
      createdAt: item.createdAt || new Date().toISOString(),
      boughtAt:  item.boughtAt || null,
    };
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatBRL(n) {
    return Number(n || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  }

  function formatDeadline(iso) {
    if (!iso) return null;
    try {
      const target = new Date(iso + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = Math.round((target - today) / 86400000);
      const label = target.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      if (diff < 0) return { text: `Atrasado · ${label}`, tone: 'late' };
      if (diff === 0) return { text: 'Hoje', tone: 'soon' };
      if (diff === 1) return { text: 'Amanhã', tone: 'soon' };
      if (diff <= 7) return { text: `${diff} dias · ${label}`, tone: 'soon' };
      return { text: label, tone: 'normal' };
    } catch {
      return null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  State                                                               */
  /* ------------------------------------------------------------------ */

  let _filter = 'todas';   // 'todas' | 'pendentes' | 'compradas'
  let _showForm = false;

  /* ------------------------------------------------------------------ */
  /*  HTML builders                                                       */
  /* ------------------------------------------------------------------ */

  function summaryHtml(items) {
    const pendentes  = items.filter((i) => i.status !== 'comprado');
    const comprados  = items.filter((i) => i.status === 'comprado');
    const totalPend  = pendentes.reduce((s, i) => s + i.price, 0);
    return `
      <div class="shopping-summary">
        <div class="shopping-summary__stat">
          <span class="shopping-summary__value shopping-summary__value--accent">${escapeHtml(formatBRL(totalPend))}</span>
          <span class="shopping-summary__label">Total pendente</span>
        </div>
        <div class="shopping-summary__divider"></div>
        <div class="shopping-summary__stat">
          <span class="shopping-summary__value">${pendentes.length}</span>
          <span class="shopping-summary__label">Pendentes</span>
        </div>
        <div class="shopping-summary__divider"></div>
        <div class="shopping-summary__stat">
          <span class="shopping-summary__value">${comprados.length}</span>
          <span class="shopping-summary__label">Comprados</span>
        </div>
      </div>`;
  }

  function addFormHtml() {
    return `
      <div class="shopping-add-form${_showForm ? ' is-visible' : ''}" id="shoppingAddForm">
        <div class="shopping-add-form__body">
          <div class="shopping-add-form__row shopping-add-form__row--2">
            <div class="shopping-field">
              <label class="shopping-field__label">Nome <span class="shopping-field__req">*</span></label>
              <input type="text" id="shAddName" class="shopping-input" placeholder="Ex.: iPhone 16" autocomplete="off" />
            </div>
            <div class="shopping-field">
              <label class="shopping-field__label">Preço R$</label>
              <input type="number" id="shAddPrice" class="shopping-input" placeholder="0,00" min="0" step="0.01" />
            </div>
          </div>
          <div class="shopping-add-form__row shopping-add-form__row--3">
            <div class="shopping-field">
              <label class="shopping-field__label">Prioridade</label>
              <select id="shAddPriority" class="shopping-select">
                <option value="alta">Alta</option>
                <option value="media" selected>Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
            <div class="shopping-field">
              <label class="shopping-field__label">Categoria</label>
              <input type="text" id="shAddCategory" class="shopping-input" placeholder="Ex.: Tecnologia" autocomplete="off" />
            </div>
            <div class="shopping-field">
              <label class="shopping-field__label">Deadline</label>
              <input type="date" id="shAddDeadline" class="shopping-input" />
            </div>
          </div>
          <div class="shopping-add-form__actions">
            <button type="button" class="shopping-btn shopping-btn--ghost" id="shCancelBtn">Cancelar</button>
            <button type="button" class="shopping-btn shopping-btn--primary" id="shSaveBtn">
              <i data-lucide="check"></i> Salvar
            </button>
          </div>
        </div>
      </div>`;
  }

  function itemHtml(item) {
    const isDone     = item.status === 'comprado';
    const isSaving   = item.status === 'economizando';
    const dl         = formatDeadline(item.deadline);
    const priorityMeta = PRIORITY_META[item.priority] || PRIORITY_META.media;

    return `
      <div class="shopping-item${isDone ? ' is-done' : ''}" data-sh-id="${escapeHtml(item.id)}">
        <label class="shopping-item__check-wrap" title="${isDone ? 'Marcar como pendente' : 'Marcar como comprado'}">
          <input
            type="checkbox"
            class="shopping-item__checkbox"
            data-sh-action="toggle"
            data-sh-id="${escapeHtml(item.id)}"
            ${isDone ? 'checked' : ''}
          />
          <span class="shopping-item__checkmark"></span>
        </label>

        <div class="shopping-item__body">
          <div class="shopping-item__top">
            <span class="shopping-item__name">${escapeHtml(item.name)}</span>
            <span class="shopping-price">${escapeHtml(formatBRL(item.price))}</span>
          </div>
          <div class="shopping-item__meta">
            <span class="shopping-priority-badge shopping-priority-badge--${escapeHtml(item.priority)}">
              ${escapeHtml(priorityMeta.dot)} ${escapeHtml(priorityMeta.label)}
            </span>
            ${item.category
              ? `<span class="shopping-chip"><i data-lucide="hash"></i>${escapeHtml(item.category)}</span>`
              : ''}
            ${dl
              ? `<span class="shopping-chip shopping-chip--deadline shopping-chip--${escapeHtml(dl.tone)}">
                   <i data-lucide="calendar"></i>${escapeHtml(dl.text)}
                 </span>`
              : ''}
            ${isSaving
              ? `<span class="shopping-chip shopping-chip--saving">
                   <i data-lucide="piggy-bank"></i>Economizando
                 </span>`
              : ''}
          </div>
        </div>

        <div class="shopping-item__actions">
          <button
            type="button"
            class="shopping-action${isSaving ? ' is-active' : ''}"
            data-sh-action="saving"
            data-sh-id="${escapeHtml(item.id)}"
            title="${isSaving ? 'Remover modo economizando' : 'Marcar como economizando'}"
          >
            <i data-lucide="piggy-bank"></i>
          </button>
          <button
            type="button"
            class="shopping-action shopping-action--danger"
            data-sh-action="delete"
            data-sh-id="${escapeHtml(item.id)}"
            title="Remover"
          >
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>`;
  }

  function groupHtml(priority, items) {
    const meta  = PRIORITY_META[priority];
    const count = items.length;
    return `
      <div class="shopping-group" data-sh-priority="${escapeHtml(priority)}">
        <div class="shopping-group__header">
          <span class="shopping-group__dot">${meta.dot}</span>
          <span class="shopping-group__title">${meta.label}</span>
          <span class="shopping-group__count">${count}</span>
        </div>
        <div class="shopping-group__list">
          ${count === 0
            ? `<div class="shopping-group__empty">Nenhum item nesta prioridade</div>`
            : items.map(itemHtml).join('')}
        </div>
      </div>`;
  }

  function emptyStateHtml() {
    return `
      <div class="shopping-empty">
        <div class="shopping-empty__icon">
          <i data-lucide="shopping-cart"></i>
        </div>
        <h3>Nenhuma meta de compra ainda</h3>
        <p>Adicione o que você quer comprar!</p>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /*  Main render                                                         */
  /* ------------------------------------------------------------------ */

  function renderShoppingView() {
    const view = document.getElementById('shoppingView');
    if (!view) return;

    const allItems = load();

    // Apply filter
    let filtered;
    if (_filter === 'pendentes') {
      filtered = allItems.filter((i) => i.status !== 'comprado');
    } else if (_filter === 'compradas') {
      filtered = allItems.filter((i) => i.status === 'comprado');
    } else {
      filtered = allItems;
    }

    // Build groups (only groups that have items under filter, but always show all 3 headers)
    const grouped = {};
    PRIORITY_ORDER.forEach((p) => { grouped[p] = []; });
    filtered.forEach((item) => {
      if (grouped[item.priority]) grouped[item.priority].push(item);
    });

    const hasAny = filtered.length > 0;

    view.innerHTML = `
      <div class="shopping-page">
        <header class="flowly-page-header">
          <div class="flowly-page-header__title">
            <h1>Lista de Compras</h1>
            <p class="flowly-page-header__subtitle">Metas de compra por prioridade</p>
          </div>
        </header>

        <div class="shopping-topbar">
          <button type="button" class="shopping-btn shopping-btn--primary" id="shToggleForm">
            <i data-lucide="plus"></i> Nova compra
          </button>
          <div class="shopping-filter-tabs">
            <button type="button" class="shopping-filter-tab${_filter === 'todas'     ? ' is-active' : ''}" data-sh-filter="todas">Todas</button>
            <button type="button" class="shopping-filter-tab${_filter === 'pendentes' ? ' is-active' : ''}" data-sh-filter="pendentes">Pendentes</button>
            <button type="button" class="shopping-filter-tab${_filter === 'compradas' ? ' is-active' : ''}" data-sh-filter="compradas">Compradas</button>
          </div>
        </div>

        ${summaryHtml(allItems)}

        ${addFormHtml()}

        <div class="shopping-groups">
          ${hasAny
            ? PRIORITY_ORDER.map((p) => groupHtml(p, grouped[p])).join('')
            : emptyStateHtml()}
        </div>
      </div>`;

    bindShoppingView();
    if (window.lucide) lucide.createIcons();
  }

  /* ------------------------------------------------------------------ */
  /*  Bindings                                                            */
  /* ------------------------------------------------------------------ */

  function bindShoppingView() {
    const view = document.getElementById('shoppingView');
    if (!view) return;

    // Toggle add form
    const toggleBtn = view.querySelector('#shToggleForm');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        _showForm = !_showForm;
        const form = view.querySelector('#shoppingAddForm');
        if (form) {
          form.classList.toggle('is-visible', _showForm);
          if (_showForm) {
            const nameInput = form.querySelector('#shAddName');
            if (nameInput) nameInput.focus();
          }
        }
      });
    }

    // Cancel form
    const cancelBtn = view.querySelector('#shCancelBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        _showForm = false;
        const form = view.querySelector('#shoppingAddForm');
        if (form) {
          form.classList.remove('is-visible');
          resetForm(form);
        }
      });
    }

    // Save form
    const saveBtn = view.querySelector('#shSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const form = view.querySelector('#shoppingAddForm');
        if (!form) return;
        const nameVal = form.querySelector('#shAddName').value.trim();
        if (!nameVal) {
          form.querySelector('#shAddName').focus();
          return;
        }
        const priceVal    = parseFloat(form.querySelector('#shAddPrice').value) || 0;
        const priorityVal = form.querySelector('#shAddPriority').value;
        const categoryVal = form.querySelector('#shAddCategory').value.trim();
        const deadlineVal = form.querySelector('#shAddDeadline').value || null;

        const items = load();
        items.unshift(normalize({
          name:     nameVal,
          price:    priceVal,
          priority: priorityVal,
          category: categoryVal,
          deadline: deadlineVal,
        }));
        save(items);

        _showForm = false;
        resetForm(form);
        renderShoppingView();
      });
    }

    // Filter tabs
    view.querySelectorAll('[data-sh-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        _filter = btn.dataset.shFilter;
        renderShoppingView();
      });
    });

    // Item actions (toggle, saving, delete) — delegated
    view.querySelector('.shopping-groups').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sh-action]');
      if (!btn) return;
      const action = btn.dataset.shAction;
      const id     = btn.dataset.shId;
      if (!id) return;

      const items = load();
      const item  = items.find((i) => i.id === id);
      if (!item) return;

      if (action === 'toggle') {
        if (item.status === 'comprado') {
          item.status   = 'pendente';
          item.boughtAt = null;
        } else {
          item.status   = 'comprado';
          item.boughtAt = new Date().toISOString();
        }
        save(items);
        renderShoppingView();
      } else if (action === 'saving') {
        item.status = item.status === 'economizando' ? 'pendente' : 'economizando';
        save(items);
        renderShoppingView();
      } else if (action === 'delete') {
        const idx = items.findIndex((i) => i.id === id);
        if (idx !== -1) {
          items.splice(idx, 1);
          save(items);
          renderShoppingView();
        }
      }
    });

    // Checkbox change (separate from click delegation for accessibility)
    view.querySelectorAll('.shopping-item__checkbox').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        // Already handled by the click delegation above via data-sh-action="toggle"
        // Prevent double-fire: do nothing extra here
        e.stopPropagation();
      });
    });
  }

  function resetForm(form) {
    form.querySelector('#shAddName').value     = '';
    form.querySelector('#shAddPrice').value    = '';
    form.querySelector('#shAddPriority').value = 'media';
    form.querySelector('#shAddCategory').value = '';
    form.querySelector('#shAddDeadline').value = '';
  }

  window.renderShoppingView = renderShoppingView;
})();
