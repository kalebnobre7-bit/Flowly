// ============================================================
//  MONTH VIEW — minimalista v3
//  Sem emojis — ícones Lucide SVG inline
//  Hover popover com detalhes completos do dia
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

// Lucide SVG strings inline (sem emoji)
const MC_ICONS = {
  birthday: `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v2"/><path d="M12 8v2"/><path d="M17 8v2"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>`,
  holiday:  `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  important:`<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="12"/><circle cx="12" cy="18" r="1" fill="currentColor"/></svg>`,
  reminder: `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  // used in popover
  check:    `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  circle:   `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
  wallet:   `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>`,
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  plus:     `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
};

const MONTH_EVENT_TYPES = {
  birthday:  { icon: MC_ICONS.birthday,  color: 'var(--ds-purple)',  bg: 'rgba(168,85,247,0.14)',  label: 'Aniversário' },
  holiday:   { icon: MC_ICONS.holiday,   color: 'var(--ds-info)',    bg: 'rgba(59,130,246,0.14)',   label: 'Feriado'     },
  important: { icon: MC_ICONS.important, color: 'var(--ds-accent)',  bg: 'rgba(242,116,5,0.14)',    label: 'Importante'  },
  reminder:  { icon: MC_ICONS.reminder,  color: 'var(--ds-success)', bg: 'rgba(34,197,94,0.14)',    label: 'Lembrete'    }
};

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

function getMonthFinanceSummary(year, month) {
  try {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const allData = JSON.parse(localStorage.getItem('flowly_finance_data') || '{}');
    let income = 0, expense = 0;
    Object.entries(allData).forEach(([d, e]) => {
      if (!d.startsWith(prefix)) return;
      (e.transactions || []).forEach(tx => {
        if (tx.type === 'income')  income  += Number(tx.amount || 0);
        if (tx.type === 'expense') expense += Number(tx.amount || 0);
      });
    });
    const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
    return { income, expense, balance: income - expense, fmt, hasData: income > 0 || expense > 0 };
  } catch { return { income: 0, expense: 0, balance: 0, fmt: v => `R$ ${v}`, hasData: false }; }
}

// ── Popover singleton ────────────────────────────────────────
let mcPopover = null;
let mcPopoverTimer = null;

function buildDayPopover(dateStr, container) {
  const dayTasks = allTasksData[dateStr] || {};
  const monthEvents = getMonthEvents();
  const date = new Date(dateStr + 'T00:00:00');
  const mmdd = dateStr.slice(5);
  const weekdays = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const months   = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  // Gather all tasks
  const ignored = new Set([
    ...weeklyRecurringTasks.map(t => t.text),
    ...dailyRoutine.map(t => t.text)
  ]);
  const allTasks = [];
  Object.entries(dayTasks).forEach(([period, tasks]) => {
    if (!Array.isArray(tasks)) return;
    tasks.forEach(t => {
      if (ignored.has(t.text)) return;
      allTasks.push({ ...t, period });
    });
  });
  // Add routine tasks
  getRoutineTasksForDate(dateStr).forEach(t => {
    allTasks.push({ ...t, period: 'Rotina' });
  });

  // Events
  const customEvts = (monthEvents[dateStr] || []).concat(monthEvents[mmdd] || []);
  const holiday = FLOWLY_BR_HOLIDAYS[mmdd];
  const allEvts = [
    ...(holiday ? [{ type: 'holiday', name: holiday }] : []),
    ...customEvts
  ];

  const totalT  = allTasks.length;
  const doneT   = allTasks.filter(t => t.completed).length;
  const pct     = totalT > 0 ? Math.round((doneT / totalT) * 100) : null;

  // Build tasks HTML
  const tasksHTML = allTasks.length > 0
    ? allTasks.map(t => `
        <div class="mc-pop-task${t.completed ? ' mc-pop-task--done' : ''}">
          <span class="mc-pop-task-icon">${t.completed ? MC_ICONS.check : MC_ICONS.circle}</span>
          <span class="mc-pop-task-text">${t.text || ''}</span>
          ${t.period ? `<span class="mc-pop-task-period">${t.period}</span>` : ''}
        </div>`).join('')
    : `<div class="mc-pop-empty">Sem tarefas neste dia</div>`;

  // Events HTML
  const evtsHTML = allEvts.map(e => {
    const cfg = MONTH_EVENT_TYPES[e.type] || MONTH_EVENT_TYPES.important;
    return `<div class="mc-pop-event" style="color:${cfg.color};background:${cfg.bg}">
      ${cfg.icon}<span>${e.name}</span>
    </div>`;
  }).join('');

  // Progress bar
  const progHTML = pct !== null ? `
    <div class="mc-pop-progress">
      <div class="mc-pop-progress-track">
        <div class="mc-pop-progress-fill" style="width:${pct}%;background:${pct === 100 ? 'var(--ds-success)' : pct >= 50 ? 'var(--ds-accent)' : 'var(--ds-text-muted)'}"></div>
      </div>
      <span>${doneT}/${totalT} tarefas · ${pct}%</span>
    </div>` : '';

  const pop = document.createElement('div');
  pop.className = 'mc-popover';
  pop.innerHTML = `
    <div class="mc-pop-head">
      <span class="mc-pop-weekday">${weekdays[date.getDay()]}</span>
      <span class="mc-pop-date">${date.getDate()} ${months[date.getMonth()]}</span>
      <button class="mc-pop-add" data-add-event="${dateStr}" title="Adicionar evento">${MC_ICONS.plus}</button>
    </div>
    ${evtsHTML ? `<div class="mc-pop-events">${evtsHTML}</div>` : ''}
    ${progHTML}
    <div class="mc-pop-tasks">${tasksHTML}</div>
  `;
  return pop;
}

function showMcPopover(cell, dateStr, container) {
  hideMcPopover();
  const pop = buildDayPopover(dateStr, container);
  container.appendChild(pop);
  mcPopover = pop;

  // Position relative to cell
  const cellRect = cell.getBoundingClientRect();
  const contRect = container.getBoundingClientRect();
  const popW = 220;
  const popMaxH = 320;

  let left = cellRect.left - contRect.left + cell.offsetWidth + 4;
  let top  = cellRect.top  - contRect.top;

  // Flip left if overflow right
  if (left + popW > container.offsetWidth - 8) {
    left = cellRect.left - contRect.left - popW - 4;
  }
  // Flip up if overflow bottom
  if (top + popMaxH > container.offsetHeight) {
    top = Math.max(4, container.offsetHeight - popMaxH - 4);
  }

  pop.style.left = `${Math.max(4, left)}px`;
  pop.style.top  = `${Math.max(4, top)}px`;

  // Bind add button inside popover
  const addBtn = pop.querySelector('[data-add-event]');
  if (addBtn) {
    addBtn.onclick = (e) => {
      e.stopPropagation();
      hideMcPopover();
      openMcModal(dateStr);
    };
  }
}

function hideMcPopover() {
  if (mcPopover) {
    mcPopover.remove();
    mcPopover = null;
  }
}

let openMcModal = () => {}; // will be assigned in renderMonth

// ════════════════════════════════════════════════════════════
function renderMonth() {
  const view = document.getElementById('monthView');
  if (!view) return;

  const { firstDay, lastDay, month, year } = getMonthDates(currentMonthOffset);
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
    .map(m => typeof fixMojibakeText === 'function' ? fixMojibakeText(m) : m);

  const today       = localDateStr();
  const monthEvents = getMonthEvents();
  const finance     = getMonthFinanceSummary(year, month);
  const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  // ── Build cells ──────────────────────────────────────────
  let cells = '';

  for (let i = 0; i < firstDayOfWeek; i++) {
    cells += `<div class="mc-day mc-day--empty"></div>`;
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date    = new Date(year, month, day);
    const dateStr = localDateStr(date);
    const isToday = dateStr === today;
    const isWE    = date.getDay() === 0 || date.getDay() === 6;
    const mmdd    = `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Tasks
    const dayTasks = allTasksData[dateStr] || {};
    let total = 0, done = 0;
    const ignored = new Set([...weeklyRecurringTasks.map(t => t.text), ...dailyRoutine.map(t => t.text)]);
    Object.entries(dayTasks).forEach(([period, tasks]) => {
      if (!Array.isArray(tasks)) return;
      const valid = tasks.filter(t => !ignored.has(t.text));
      total += valid.length;
      done  += valid.filter(t => t.completed).length;
    });
    // Include routines in count
    const routines = getRoutineTasksForDate(dateStr);
    total += routines.length;
    done  += routines.filter(t => t.completed).length;

    const pct      = total > 0 ? Math.round((done / total) * 100) : -1;
    const pctColor = pct === 100 ? 'var(--ds-success)' : pct >= 50 ? 'var(--ds-accent)' : 'var(--ds-text-muted)';

    // Events
    const customEvts = (monthEvents[dateStr] || []).concat(monthEvents[mmdd] || []);
    const holiday    = FLOWLY_BR_HOLIDAYS[mmdd];
    const allEvts    = [...(holiday ? [{ type: 'holiday', name: holiday }] : []), ...customEvts];

    // Dot indicators (max 3)
    const dots = allEvts.slice(0, 3).map(e => {
      const cfg = MONTH_EVENT_TYPES[e.type] || MONTH_EVENT_TYPES.important;
      return `<span class="mc-dot" style="background:${cfg.color}"></span>`;
    }).join('');

    // First event — icon only (no emoji, no text on cell)
    const firstEvt = allEvts[0];
    const evtChip = firstEvt
      ? (() => {
          const cfg = MONTH_EVENT_TYPES[firstEvt.type] || MONTH_EVENT_TYPES.important;
          const name = firstEvt.name.length > 14 ? firstEvt.name.slice(0, 12) + '…' : firstEvt.name;
          return `<div class="mc-event-label" style="color:${cfg.color};background:${cfg.bg}">${cfg.icon}<span>${name}</span>${allEvts.length > 1 ? `<em>+${allEvts.length - 1}</em>` : ''}</div>`;
        })()
      : '';

    cells += `
      <div class="mc-day${isToday ? ' mc-day--today' : ''}${isWE ? ' mc-day--weekend' : ''}"
           data-go-to-date="${dateStr}"
           data-date="${dateStr}">
        <div class="mc-day-top">
          <span class="mc-day-num${isToday ? ' mc-day-num--active' : ''}">${day}</span>
          <div class="mc-day-meta">${dots}${pct >= 0 ? `<span class="mc-pct" style="color:${pctColor}">${pct}%</span>` : ''}</div>
          <button class="mc-add-btn" data-add-event="${dateStr}">${MC_ICONS.plus}</button>
        </div>
        ${pct >= 0 ? `<div class="mc-bar"><div class="mc-bar-fill" style="width:${pct}%;background:${pctColor}"></div></div>` : ''}
        ${evtChip}
      </div>`;
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

  // ── Legend ───────────────────────────────────────────────
  const legendHTML = Object.entries(MONTH_EVENT_TYPES).map(([, c]) =>
    `<span class="mc-legend-item" title="${c.label}"><span class="mc-legend-icon" style="color:${c.color}">${c.icon}</span><span class="mc-legend-txt">${c.label}</span></span>`
  ).join('');

  // ── Modal ────────────────────────────────────────────────
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

  // ── Assemble ─────────────────────────────────────────────
  view.innerHTML = `
    <div class="flowly-shell flowly-shell--wide mc-shell">

      <div class="mc-header">
        <div class="mc-header-left">
          <div class="flowly-page-kicker">Visão mensal</div>
          <h2 class="mc-title">${monthNames[month]} <span>${year}</span></h2>
        </div>
        <div class="mc-header-right">
          <div class="mc-legend">${legendHTML}</div>
          <div class="mc-nav">
            <button data-month-nav="-1" class="mc-nav-btn" title="Mês anterior">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button data-month-nav="current" class="mc-nav-today">Hoje</button>
            <button data-month-nav="1" class="mc-nav-btn" title="Próximo mês">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>

      ${finStrip}

      <div class="mc-weekdays">
        ${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((d,i) =>
          `<div class="mc-weekday${i>=5?' mc-weekday--we':''}">${d}</div>`
        ).join('')}
      </div>

      <div class="mc-grid" id="mcGrid">${cells}</div>

    </div>
    ${modalHTML}`;

  // ── Assign modal opener ──────────────────────────────────
  const modalEl  = document.getElementById('mcModal');
  const nameInp  = document.getElementById('mcEventName');
  const typeInp  = document.getElementById('mcEventType');
  const dateInp  = document.getElementById('mcEventDate');
  const recurInp = document.getElementById('mcEventRecurring');
  const grid     = document.getElementById('mcGrid');

  openMcModal = (dateStr) => {
    dateInp.value = dateStr;
    nameInp.value = '';
    modalEl.style.display = 'flex';
    nameInp.focus();
  };

  const closeModal = () => { modalEl.style.display = 'none'; };

  document.getElementById('mcModalClose').onclick  = closeModal;
  document.getElementById('mcModalClose2').onclick = closeModal;
  modalEl.onclick = e => { if (e.target === modalEl) closeModal(); };

  document.getElementById('mcEventSave').onclick = () => {
    const name = (nameInp.value || '').trim();
    if (!name) { nameInp.focus(); return; }
    const key = recurInp.checked ? dateInp.value.slice(5) : dateInp.value;
    saveMonthEvent(key, { name, type: typeInp.value, recurring: recurInp.checked });
    closeModal();
    renderMonth();
  };
  nameInp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  document.getElementById('mcEventSave').click();
    if (e.key === 'Escape') closeModal();
  });

  // ── Month navigation ─────────────────────────────────────
  view.querySelectorAll('[data-month-nav]').forEach(btn => {
    btn.onclick = () => {
      const a = btn.dataset.monthNav;
      if (a === 'current') currentMonthOffset = 0;
      else currentMonthOffset += Number(a);
      hideMcPopover();
      renderView();
    };
  });

  // ── Day click → navigate ──────────────────────────────────
  view.querySelectorAll('[data-go-to-date]').forEach(cell => {
    cell.onclick = e => {
      if (e.target.closest('.mc-add-btn')) return;
      hideMcPopover();
      goToDate(cell.dataset.goToDate);
    };
  });

  // ── Add-event buttons on cells ────────────────────────────
  view.querySelectorAll('.mc-add-btn[data-add-event]').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      hideMcPopover();
      openMcModal(btn.dataset.addEvent);
    };
  });

  // ── Hover popover ────────────────────────────────────────
  if (!grid) return;
  grid.addEventListener('mouseenter', (e) => {
    const cell = e.target.closest('.mc-day:not(.mc-day--empty)');
    if (!cell) return;
    clearTimeout(mcPopoverTimer);
    mcPopoverTimer = setTimeout(() => {
      showMcPopover(cell, cell.dataset.date, grid);
    }, 200);
  }, true);

  grid.addEventListener('mouseleave', (e) => {
    const related = e.relatedTarget;
    if (related && (related.closest('.mc-popover') || related.closest('.mc-day'))) return;
    clearTimeout(mcPopoverTimer);
    mcPopoverTimer = setTimeout(hideMcPopover, 120);
  }, true);

  // Keep popover alive when hovering it
  grid.addEventListener('mouseover', (e) => {
    if (e.target.closest('.mc-popover')) {
      clearTimeout(mcPopoverTimer);
    }
  });
}
