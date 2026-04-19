// ============================================================
//  MONTH VIEW — v4
//  Células adensadas com preview de tarefas, mini-agenda lateral,
//  atalhos de teclado, coluna de nº semana e quick-add.
// ============================================================

const FLOWLY_BR_HOLIDAYS = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência do Brasil',
  '10-12': 'N.S. Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '12-25': 'Natal',
  '12-31': 'Réveillon'
};

const MC_ICONS = {
  birthday: `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v2"/><path d="M12 8v2"/><path d="M17 8v2"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>`,
  holiday:  `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  important:`<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="12"/><circle cx="12" cy="18" r="1" fill="currentColor"/></svg>`,
  reminder: `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  check:    `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  circle:   `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
  wallet:   `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>`,
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  plus:     `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  open:     `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l10-10"/><path d="M8 7h9v9"/></svg>`
};

const MONTH_EVENT_TYPES = {
  birthday:  { icon: MC_ICONS.birthday,  color: 'var(--ds-purple)',  bg: 'rgba(168,85,247,0.14)',  label: 'Aniversário' },
  holiday:   { icon: MC_ICONS.holiday,   color: 'var(--ds-info)',    bg: 'rgba(59,130,246,0.14)',  label: 'Feriado'     },
  important: { icon: MC_ICONS.important, color: 'var(--ds-accent)',  bg: 'rgba(242,116,5,0.14)',   label: 'Importante'  },
  reminder:  { icon: MC_ICONS.reminder,  color: 'var(--ds-success)', bg: 'rgba(34,197,94,0.14)',   label: 'Lembrete'    }
};

let selectedMcDate = null;
let mcKeyHandler = null;

function mcEscape(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function getMonthEvents() {
  try { return JSON.parse(localStorage.getItem('flowly_month_events') || '{}'); }
  catch { return {}; }
}

function saveMonthEvent(key, event) {
  const all = getMonthEvents();
  if (!all[key]) all[key] = [];
  all[key].push(event);
  localStorage.setItem('flowly_month_events', JSON.stringify(all));
}

function getIsoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getMonthFinanceSummary(year, month) {
  try {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const allData = JSON.parse(localStorage.getItem('flowly_finance_data') || '{}');
    let income = 0, expense = 0;
    Object.entries(allData).forEach(([d, e]) => {
      if (!d.startsWith(prefix)) return;
      (e.transactions || []).forEach((tx) => {
        if (tx.type === 'income')  income  += Number(tx.amount || 0);
        if (tx.type === 'expense') expense += Number(tx.amount || 0);
      });
    });
    const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
    return { income, expense, balance: income - expense, fmt, hasData: income > 0 || expense > 0 };
  } catch { return { income: 0, expense: 0, balance: 0, fmt: (v) => `R$ ${v}`, hasData: false }; }
}

function gatherDayData(dateStr) {
  const dayTasks = allTasksData[dateStr] || {};
  const monthEvents = getMonthEvents();
  const mmdd = dateStr.slice(5);

  const ignored = new Set([
    ...weeklyRecurringTasks.map((t) => t.text),
    ...dailyRoutine.map((t) => t.text)
  ]);

  const tasks = [];
  Object.entries(dayTasks).forEach(([period, list]) => {
    if (!Array.isArray(list)) return;
    list.forEach((t) => {
      if (ignored.has(t.text)) return;
      tasks.push({ ...t, period });
    });
  });
  (typeof getRoutineTasksForDate === 'function' ? getRoutineTasksForDate(dateStr) : []).forEach((t) => {
    tasks.push({ ...t, period: 'Rotina' });
  });

  const total = tasks.length;
  const done  = tasks.filter((t) => t.completed).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : -1;
  const pctColor = pct === 100 ? 'var(--ds-success)' : pct >= 50 ? 'var(--ds-accent)' : 'var(--ds-text-muted)';

  const customEvts = (monthEvents[dateStr] || []).concat(monthEvents[mmdd] || []);
  const holiday    = FLOWLY_BR_HOLIDAYS[mmdd];
  const events     = [...(holiday ? [{ type: 'holiday', name: holiday }] : []), ...customEvts];

  return { tasks, total, done, pct, pctColor, events };
}

let openMcModal = () => {};

function renderMcAgenda(view) {
  const agendaEl = view.querySelector('#mcAgenda');
  if (!agendaEl) return;

  const dateStr  = selectedMcDate || localDateStr();
  const data     = gatherDayData(dateStr);
  const date     = new Date(dateStr + 'T00:00:00');
  const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const months   = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const isToday  = dateStr === localDateStr();

  const eventsHTML = data.events.length ? `
    <section class="mc-agenda-section">
      <h3 class="mc-agenda-section-title">Eventos</h3>
      <div class="mc-agenda-events">
        ${data.events.map((e) => {
          const cfg = MONTH_EVENT_TYPES[e.type] || MONTH_EVENT_TYPES.important;
          return `<div class="mc-agenda-event" style="color:${cfg.color};background:${cfg.bg}">
            ${cfg.icon}<span>${mcEscape(e.name)}</span>
          </div>`;
        }).join('')}
      </div>
    </section>` : '';

  const progressHTML = data.total > 0 ? `
    <div class="mc-agenda-progress">
      <div class="mc-agenda-progress-track"><div class="mc-agenda-progress-fill" style="width:${data.pct}%;background:${data.pctColor}"></div></div>
      <span>${data.done}/${data.total} · ${data.pct}%</span>
    </div>` : '';

  const tasksHTML = data.tasks.length ? `
    <div class="mc-agenda-tasks">
      ${data.tasks.map((t) => `
        <div class="mc-agenda-task${t.completed ? ' mc-agenda-task--done' : ''}">
          <span class="mc-agenda-task-icon">${t.completed ? MC_ICONS.check : MC_ICONS.circle}</span>
          <span class="mc-agenda-task-text">${mcEscape(t.text || '')}</span>
          ${t.period ? `<span class="mc-agenda-task-period">${mcEscape(t.period)}</span>` : ''}
        </div>`).join('')}
    </div>` : `<div class="mc-agenda-empty">Sem tarefas neste dia</div>`;

  agendaEl.innerHTML = `
    <header class="mc-agenda-head">
      <div class="mc-agenda-head-info">
        <span class="mc-agenda-weekday">${weekdays[date.getDay()]}${isToday ? ' · Hoje' : ''}</span>
        <h2 class="mc-agenda-date">${date.getDate()} <span>${months[date.getMonth()]}</span></h2>
      </div>
      <button class="mc-agenda-open" data-go-to-date="${dateStr}" title="Abrir este dia">${MC_ICONS.open}</button>
    </header>
    ${eventsHTML}
    <section class="mc-agenda-section">
      <div class="mc-agenda-section-head">
        <h3 class="mc-agenda-section-title">Tarefas</h3>
        ${progressHTML}
      </div>
      ${tasksHTML}
    </section>
    <footer class="mc-agenda-actions">
      <button type="button" class="flowly-btn flowly-btn--ghost flowly-btn--sm" data-mc-add-task="${dateStr}">${MC_ICONS.plus}<span>Tarefa</span></button>
      <button type="button" class="flowly-btn flowly-btn--ghost flowly-btn--sm" data-mc-add-event="${dateStr}">${MC_ICONS.plus}<span>Evento</span></button>
    </footer>
  `;

  bindAgendaActions(view);
}

function bindAgendaActions(view) {
  const agendaEl = view.querySelector('#mcAgenda');
  if (!agendaEl) return;

  const openBtn = agendaEl.querySelector('[data-go-to-date]');
  if (openBtn) {
    openBtn.onclick = () => {
      if (typeof goToDate === 'function') goToDate(openBtn.dataset.goToDate);
    };
  }

  const addTaskBtn = agendaEl.querySelector('[data-mc-add-task]');
  if (addTaskBtn) {
    addTaskBtn.onclick = async () => {
      const dateStr = addTaskBtn.dataset.mcAddTask;
      if (!window.FlowlyDialogs || typeof window.FlowlyDialogs.prompt !== 'function') return;
      const text = await window.FlowlyDialogs.prompt('Nova tarefa:', {
        title: 'Adicionar tarefa',
        confirmLabel: 'Criar',
        inputPlaceholder: 'Ex: Ligar para o cliente'
      });
      if (!text || !text.trim()) return;
      const period = 'Tarefas';
      if (!allTasksData[dateStr]) allTasksData[dateStr] = {};
      if (!allTasksData[dateStr][period]) allTasksData[dateStr][period] = [];
      const currentList = allTasksData[dateStr][period];
      const newTask = {
        text: text.trim(),
        completed: false,
        color: 'default',
        type: 'OPERATIONAL',
        priority: null,
        parent_id: null,
        position: currentList.length,
        isHabit: false,
        supabaseId: null,
        timerTotalMs: 0,
        timerStartedAt: null,
        timerLastStoppedAt: null,
        timerSessionsCount: 0
      };
      currentList.push(newTask);
      if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
      if (typeof syncTaskToSupabase === 'function') {
        syncTaskToSupabase(dateStr, period, newTask).then((r) => {
          if (r && r.success && typeof saveToLocalStorage === 'function') saveToLocalStorage();
        });
      }
      selectedMcDate = dateStr;
      if (typeof renderView === 'function') renderView();
    };
  }

  const addEvtBtn = agendaEl.querySelector('[data-mc-add-event]');
  if (addEvtBtn) {
    addEvtBtn.onclick = () => openMcModal(addEvtBtn.dataset.mcAddEvent);
  }
}

function shiftMcSelectedDay(delta) {
  const base = new Date((selectedMcDate || localDateStr()) + 'T00:00:00');
  base.setDate(base.getDate() + delta);
  const newStr = localDateStr(base);
  const { year, month } = getMonthDates(currentMonthOffset);
  if (base.getFullYear() !== year || base.getMonth() !== month) {
    const deltaMonths = (base.getFullYear() - year) * 12 + (base.getMonth() - month);
    currentMonthOffset += deltaMonths;
  }
  selectedMcDate = newStr;
  if (typeof renderView === 'function') renderView();
}

function installMcKeyHandler() {
  if (mcKeyHandler) document.removeEventListener('keydown', mcKeyHandler);
  mcKeyHandler = (e) => {
    const monthView = document.getElementById('monthView');
    if (!monthView || monthView.offsetParent === null) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
    const modal = document.getElementById('mcModal');
    if (modal && modal.style.display !== 'none' && modal.style.display !== '') return;

    if (e.key === 'ArrowLeft' && e.altKey)       { currentMonthOffset -= 1; if (typeof renderView === 'function') renderView(); e.preventDefault(); }
    else if (e.key === 'ArrowRight' && e.altKey) { currentMonthOffset += 1; if (typeof renderView === 'function') renderView(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft')              { shiftMcSelectedDay(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight')             { shiftMcSelectedDay(1); e.preventDefault(); }
    else if (e.key === 'ArrowUp')                { shiftMcSelectedDay(-7); e.preventDefault(); }
    else if (e.key === 'ArrowDown')              { shiftMcSelectedDay(7); e.preventDefault(); }
    else if (e.key === 't' || e.key === 'T')     {
      currentMonthOffset = 0; selectedMcDate = localDateStr();
      if (typeof renderView === 'function') renderView();
      e.preventDefault();
    }
    else if (e.key === 'Enter' && selectedMcDate) {
      if (typeof goToDate === 'function') goToDate(selectedMcDate);
      e.preventDefault();
    }
  };
  document.addEventListener('keydown', mcKeyHandler);
}

// ════════════════════════════════════════════════════════════
function renderMonth() {
  const view = document.getElementById('monthView');
  if (!view) return;

  const { firstDay, lastDay, month, year } = getMonthDates(currentMonthOffset);
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
    .map((m) => (typeof fixMojibakeText === 'function' ? fixMojibakeText(m) : m));

  const todayStr   = localDateStr();
  const finance    = getMonthFinanceSummary(year, month);
  const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  if (!selectedMcDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedMcDate)) {
    selectedMcDate = todayStr;
  }
  // If selected is outside visible month, keep it (ok). User just navigated — we show its agenda.
  const selDate = new Date(selectedMcDate + 'T00:00:00');
  const selInThisMonth = selDate.getFullYear() === year && selDate.getMonth() === month;

  // ── Build cells ──────────────────────────────────────────
  let cells = '';
  const totalCells = firstDayOfWeek + lastDay.getDate();
  const rows = Math.ceil(totalCells / 7);

  for (let row = 0; row < rows; row++) {
    const weekStart = new Date(year, month, 1 - firstDayOfWeek + row * 7);
    cells += `<div class="mc-week-num">${getIsoWeek(weekStart)}</div>`;

    for (let col = 0; col < 7; col++) {
      const cellIndex = row * 7 + col;
      if (cellIndex < firstDayOfWeek || cellIndex >= firstDayOfWeek + lastDay.getDate()) {
        cells += `<div class="mc-day mc-day--empty"></div>`;
        continue;
      }

      const day     = cellIndex - firstDayOfWeek + 1;
      const date    = new Date(year, month, day);
      const dateStr = localDateStr(date);
      const isToday = dateStr === todayStr;
      const isSelected = selInThisMonth && dateStr === selectedMcDate;
      const isWE    = date.getDay() === 0 || date.getDay() === 6;

      const data = gatherDayData(dateStr);

      // Dots for extra events beyond the 2 chips
      const extraDots = data.events.slice(2).map((e) => {
        const cfg = MONTH_EVENT_TYPES[e.type] || MONTH_EVENT_TYPES.important;
        return `<span class="mc-dot" style="background:${cfg.color}"></span>`;
      }).join('');

      // Up to 2 event chips
      const evtChips = data.events.slice(0, 2).map((e) => {
        const cfg = MONTH_EVENT_TYPES[e.type] || MONTH_EVENT_TYPES.important;
        const name = e.name.length > 18 ? e.name.slice(0, 16) + '…' : e.name;
        return `<div class="mc-event-label" style="color:${cfg.color};background:${cfg.bg}">${cfg.icon}<span>${mcEscape(name)}</span></div>`;
      }).join('');
      const evtMore = data.events.length > 2
        ? `<div class="mc-event-more">+${data.events.length - 2}</div>`
        : '';

      // Task previews (up to 3 visible)
      const pendingTasks = data.tasks.filter((t) => !t.completed);
      const previewTasks = pendingTasks.length ? pendingTasks.slice(0, 3) : data.tasks.slice(0, 3);
      const taskPreviewHTML = previewTasks.length ? `
        <div class="mc-day-tasks">
          ${previewTasks.map((t) => `
            <div class="mc-day-task${t.completed ? ' mc-day-task--done' : ''}" title="${mcEscape(t.text || '')}">
              <span class="mc-day-task-dot"></span>
              <span class="mc-day-task-text">${mcEscape(t.text || '')}</span>
            </div>`).join('')}
          ${data.tasks.length > previewTasks.length
            ? `<div class="mc-day-task-more">+${data.tasks.length - previewTasks.length} tarefa${data.tasks.length - previewTasks.length > 1 ? 's' : ''}</div>`
            : ''}
        </div>` : '';

      const cls = [
        'mc-day',
        isToday ? 'mc-day--today' : '',
        isWE ? 'mc-day--weekend' : '',
        isSelected ? 'mc-day--selected' : ''
      ].filter(Boolean).join(' ');

      cells += `
        <div class="${cls}" data-mc-select="${dateStr}" data-date="${dateStr}">
          <div class="mc-day-top">
            <span class="mc-day-num${isToday ? ' mc-day-num--active' : ''}">${day}</span>
            <div class="mc-day-meta">
              ${extraDots}
              ${data.pct >= 0 ? `<span class="mc-pct" style="color:${data.pctColor}">${data.pct}%</span>` : ''}
            </div>
            <button type="button" class="mc-add-btn" data-mc-add-event="${dateStr}" title="Adicionar evento">${MC_ICONS.plus}</button>
          </div>
          ${data.pct >= 0 ? `<div class="mc-bar"><div class="mc-bar-fill" style="width:${data.pct}%;background:${data.pctColor}"></div></div>` : ''}
          ${evtChips ? `<div class="mc-event-row">${evtChips}${evtMore}</div>` : ''}
          ${taskPreviewHTML}
        </div>`;
    }
  }

  // ── Finance strip ────────────────────────────────────────
  const finStrip = finance.hasData
    ? `<div class="mc-fin-strip">
        <span class="mc-fin-label">${MC_ICONS.wallet} ${monthNames[month]}</span>
        <span class="mc-fin-kpi mc-fin-kpi--in">↑ ${finance.fmt(finance.income)}</span>
        <span class="mc-fin-divider"></span>
        <span class="mc-fin-kpi mc-fin-kpi--out">↓ ${finance.fmt(finance.expense)}</span>
        <span class="mc-fin-divider"></span>
        <span class="mc-fin-kpi mc-fin-kpi--bal${finance.balance < 0 ? ' mc-fin-kpi--neg' : ''}">= ${finance.fmt(finance.balance)}</span>
      </div>`
    : `<div class="mc-fin-strip mc-fin-strip--empty">${MC_ICONS.wallet}<span>Sem movimentações em ${monthNames[month]}</span></div>`;

  const legendHTML = Object.entries(MONTH_EVENT_TYPES).map(([, c]) =>
    `<span class="mc-legend-item" title="${c.label}"><span class="mc-legend-icon" style="color:${c.color}">${c.icon}</span><span class="mc-legend-txt">${c.label}</span></span>`
  ).join('');

  const modalHTML = `
    <div id="mcModal" class="mc-modal-bg" style="display:none">
      <div class="mc-modal">
        <div class="mc-modal-head">
          <span>Adicionar evento</span>
          <button id="mcModalClose" class="mc-modal-close">${MC_ICONS.plus}</button>
        </div>
        <div class="mc-modal-body">
          <input id="mcEventDate" type="date" style="display:none">
          <label class="mc-field">
            <span>Título</span>
            <input id="mcEventName" type="text" class="finance-input" placeholder="Ex: Aniversário da Ana">
          </label>
          <label class="mc-field">
            <span>Tipo</span>
            <select id="mcEventType" class="finance-input">
              <option value="birthday">Aniversário</option>
              <option value="important">Importante</option>
              <option value="reminder">Lembrete</option>
              <option value="holiday">Feriado</option>
            </select>
          </label>
          <label class="mc-field mc-field--row">
            <input id="mcEventRecurring" type="checkbox" checked>
            <span>Repetir todo ano</span>
          </label>
        </div>
        <div class="mc-modal-foot">
          <button id="mcEventSave" class="btn-primary btn--sm">Salvar</button>
          <button id="mcModalClose2" class="btn-secondary btn--sm">Cancelar</button>
        </div>
      </div>
    </div>`;

  view.innerHTML = `
    <div class="flowly-shell flowly-shell--wide mc-shell">

      <header class="flowly-page-header mc-header">
        <div class="flowly-page-header__title">
          <h1>${monthNames[month]} <span class="mc-title-year">${year}</span></h1>
          <p class="flowly-page-header__subtitle">Visão mensal · ← → dias · ↑ ↓ semanas · Alt+← → mês · T hoje</p>
        </div>
        <div class="flowly-page-header__actions">
          <div class="mc-legend">${legendHTML}</div>
          <div class="mc-nav">
            <button data-month-nav="-1" class="flowly-btn flowly-btn--ghost flowly-btn--icon flowly-btn--sm" title="Mês anterior">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button data-month-nav="current" class="flowly-btn flowly-btn--ghost flowly-btn--sm">Hoje</button>
            <button data-month-nav="1" class="flowly-btn flowly-btn--ghost flowly-btn--icon flowly-btn--sm" title="Próximo mês">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </header>

      ${finStrip}

      <div class="mc-body">
        <div class="mc-calendar">
          <div class="mc-weekdays">
            <div class="mc-weekday mc-weekday--wk" title="Número da semana ISO">SEM</div>
            ${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((d, i) =>
              `<div class="mc-weekday${i >= 5 ? ' mc-weekday--we' : ''}">${d}</div>`
            ).join('')}
          </div>
          <div class="mc-grid" id="mcGrid">${cells}</div>
        </div>

        <aside id="mcAgenda" class="mc-agenda" aria-label="Agenda do dia selecionado"></aside>
      </div>

    </div>
    ${modalHTML}`;

  // ── Modal wiring ─────────────────────────────────────────
  const modalEl  = document.getElementById('mcModal');
  const nameInp  = document.getElementById('mcEventName');
  const typeInp  = document.getElementById('mcEventType');
  const dateInp  = document.getElementById('mcEventDate');
  const recurInp = document.getElementById('mcEventRecurring');

  openMcModal = (dateStr) => {
    dateInp.value = dateStr;
    nameInp.value = '';
    modalEl.style.display = 'flex';
    nameInp.focus();
  };
  const closeModal = () => { modalEl.style.display = 'none'; };

  document.getElementById('mcModalClose').onclick  = closeModal;
  document.getElementById('mcModalClose2').onclick = closeModal;
  modalEl.onclick = (e) => { if (e.target === modalEl) closeModal(); };

  document.getElementById('mcEventSave').onclick = () => {
    const name = (nameInp.value || '').trim();
    if (!name) { nameInp.focus(); return; }
    const key = recurInp.checked ? dateInp.value.slice(5) : dateInp.value;
    saveMonthEvent(key, { name, type: typeInp.value, recurring: recurInp.checked });
    closeModal();
    selectedMcDate = dateInp.value;
    if (typeof renderView === 'function') renderView();
  };
  nameInp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  document.getElementById('mcEventSave').click();
    if (e.key === 'Escape') closeModal();
  });

  // ── Month navigation ─────────────────────────────────────
  view.querySelectorAll('[data-month-nav]').forEach((btn) => {
    btn.onclick = () => {
      const a = btn.dataset.monthNav;
      if (a === 'current') { currentMonthOffset = 0; selectedMcDate = todayStr; }
      else currentMonthOffset += Number(a);
      if (typeof renderView === 'function') renderView();
    };
  });

  // ── Day select (click) ───────────────────────────────────
  view.querySelectorAll('[data-mc-select]').forEach((cell) => {
    cell.onclick = (e) => {
      if (e.target.closest('.mc-add-btn')) return;
      const dateStr = cell.dataset.mcSelect;
      if (selectedMcDate === dateStr) {
        if (typeof goToDate === 'function') goToDate(dateStr);
        return;
      }
      view.querySelectorAll('.mc-day--selected').forEach((c) => c.classList.remove('mc-day--selected'));
      cell.classList.add('mc-day--selected');
      selectedMcDate = dateStr;
      renderMcAgenda(view);
    };
  });

  // ── Add-event buttons on cells ───────────────────────────
  view.querySelectorAll('.mc-add-btn[data-mc-add-event]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openMcModal(btn.dataset.mcAddEvent);
    };
  });

  // ── Agenda + keyboard ────────────────────────────────────
  renderMcAgenda(view);
  installMcKeyHandler();
}
