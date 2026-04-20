// renderToday movido de js/app.js

function getFlowlyDayTaskStats(dateStr) {
  const metricsApi = window.FlowlyTaskMetrics || {};
  const countTasks = metricsApi.countDayTasks || window.countDayTasks;
  if (typeof countTasks === 'function') return countTasks(dateStr);
  return { total: 0, completed: 0 };
}

function getTodayGreeting(hour) {
  if (hour < 5) return 'Boa madrugada';
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getTodayFocusLabel(moneyCount, pendingCount) {
  if (moneyCount > 0) return { title: 'Foco no caixa', hint: `${moneyCount} de impacto financeiro` };
  if (pendingCount > 6) return { title: 'Modo ataque', hint: 'Dia cheio, fecha em blocos curtos' };
  if (pendingCount > 0) return { title: 'Modo fechamento', hint: 'Poucas pendências, fecha tudo' };
  return { title: 'Dia livre', hint: 'Puxa algo com intenção ou descansa' };
}

function renderToday() {
  const grid = document.getElementById('todayView');
  if (!grid) return;

  const escapeTodayText = (value) =>
    String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const todayViewSettings = safeJSONParse(localStorage.getItem('flowly_today_view_settings'), {});
  const focusOnlyMode = todayViewSettings.focusOnlyMode === true;
  const now = new Date();
  const dateLabel = now.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long'
  });
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const today = dayNames[now.getDay()];
  const dateStr = localDateStr();
  const greeting = getTodayGreeting(now.getHours());

  grid.className = focusOnlyMode
    ? 'flowly-shell today-container today-focus-mode'
    : 'flowly-shell today-container';
  grid.style.cssText = '';
  grid.innerHTML = '';

  const dayTasks = allTasksData[dateStr] || {};
  const routineTasks = getRoutineTasksForDate(dateStr);
  const todayPersistedTasks = [];
  let allTasks = [];

  routineTasks.forEach((task, routineIndex) => {
    allTasks.push({ task, day: today, dateStr, period: 'Rotina', originalIndex: routineIndex });
  });

  getProjectMirrorEntriesForDate(dateStr, today).forEach((entry) => {
    allTasks.push(entry);
  });

  Object.entries(dayTasks).forEach(([period, tasks]) => {
    if (period === 'Rotina' || !Array.isArray(tasks)) return;
    tasks.forEach((task, index) => {
      if (!task || typeof task !== 'object') return;
      allTasks.push({ task, day: today, dateStr, period, originalIndex: index });
      todayPersistedTasks.push(task);
    });
  });

  allTasks = unifiedTaskSort(allTasks);

  const actionableEntries = allTasks.filter((entry) => entry.task && !entry.task.isProjectMirror);
  const completedCount = actionableEntries.filter((entry) => entry.task && entry.task.completed).length;
  const pendingEntries = actionableEntries.filter((entry) => entry.task && !entry.task.completed);
  const moneyEntries = pendingEntries.filter(
    (entry) => String(entry.task.priority || '').toLowerCase() === 'money'
  );
  const nextEntry = moneyEntries[0] || pendingEntries[0] || null;
  const progressPct =
    actionableEntries.length > 0 ? Math.round((completedCount / actionableEntries.length) * 100) : 0;
  const focusInfo = getTodayFocusLabel(moneyEntries.length, pendingEntries.length);

  const heroInsight = (() => {
    if (actionableEntries.length === 0) return 'Zerado. Aproveita para planejar ou puxar algo novo.';
    if (completedCount === actionableEntries.length)
      return `Dia fechado — ${completedCount} tarefa${completedCount > 1 ? 's' : ''} concluída${completedCount > 1 ? 's' : ''}.`;
    if (moneyEntries.length > 0)
      return `${moneyEntries.length} tarefa${moneyEntries.length > 1 ? 's' : ''} de caixa. Fecha esse bloco antes de abrir outra frente.`;
    return `${pendingEntries.length} pendência${pendingEntries.length > 1 ? 's' : ''} aberta${pendingEntries.length > 1 ? 's' : ''}. Limpa o stack sem espalhar energia.`;
  })();

  const latestCompletionTs = getLatestCompletionTimestamp();
  const lastCompletedText = formatLastCompletionDisplay(latestCompletionTs);
  const durationSamplesMs = todayPersistedTasks
    .filter((task) => task && task.completed && task.createdAt && task.completedAt)
    .map((task) => new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime())
    .filter((ms) => Number.isFinite(ms) && ms >= 0);
  const hasAvgBase = durationSamplesMs.length > 0;
  const avgTaskDurationText = hasAvgBase
    ? formatElapsedShort(
        Math.round(durationSamplesMs.reduce((sum, ms) => sum + ms, 0) / durationSamplesMs.length)
      )
    : '—';

  let streak = 0;
  const checkDate = new Date();
  for (let index = 0; index < 60; index += 1) {
    const checkDateStr = localDateStr(checkDate);
    const { total, completed } = getFlowlyDayTaskStats(checkDateStr);
    if (total > 0 && completed === total) {
      streak += 1;
    } else if (index > 0 || (index === 0 && total > 0)) {
      break;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  const weekDates = getWeekDates(0);
  let weekTotal = 0;
  let weekCompleted = 0;
  weekDates.forEach(({ dateStr: weekDateStr }) => {
    const { total, completed } = getFlowlyDayTaskStats(weekDateStr);
    weekTotal += total;
    weekCompleted += completed;
  });
  const routineTotal = routineTasks.length;
  const routineCompleted = routineTasks.filter((task) => task.completed).length;

  const streakText = streak > 0 ? `🔥 ${streak} dia${streak > 1 ? 's' : ''} em chamas` : 'Inicia um streak hoje';

  const pageHeader = document.createElement('header');
  pageHeader.className = 'flowly-page-header';
  pageHeader.innerHTML = `
    <div class="flowly-page-header__title">
      <h1>Hoje</h1>
      <p class="flowly-page-header__subtitle">${escapeTodayText(today)} · ${escapeTodayText(dateLabel)}</p>
    </div>
    <div class="flowly-page-header__actions"></div>
  `;
  const focusToggleBtn = document.createElement('button');
  focusToggleBtn.type = 'button';
  focusToggleBtn.className = focusOnlyMode
    ? 'flowly-btn flowly-btn--ghost--subtle flowly-btn--sm is-active'
    : 'flowly-btn flowly-btn--ghost--subtle flowly-btn--sm';
  focusToggleBtn.setAttribute('aria-pressed', focusOnlyMode ? 'true' : 'false');
  focusToggleBtn.textContent = focusOnlyMode ? 'Mostrar dados' : 'Modo foco';
  focusToggleBtn.onclick = (event) => {
    event.stopPropagation();
    const currentSettings = safeJSONParse(localStorage.getItem('flowly_today_view_settings'), {});
    currentSettings.focusOnlyMode = !(currentSettings.focusOnlyMode === true);
    localStorage.setItem('flowly_today_view_settings', JSON.stringify(currentSettings));
    renderView();
  };
  pageHeader.querySelector('.flowly-page-header__actions').appendChild(focusToggleBtn);
  grid.appendChild(pageHeader);

  // ========== HERO ==========
  if (!focusOnlyMode) {
    const hero = document.createElement('section');
    hero.className = 'today-hero';

    const ringCirc = 2 * Math.PI * 44;
    const ringOffset = ringCirc - (ringCirc * progressPct) / 100;

    const nextTaskTitle = nextEntry ? nextEntry.task.text : '';
    const nextTaskIsMoney =
      nextEntry && String(nextEntry.task.priority || '').toLowerCase() === 'money';
    const nextTimerRunning = Boolean(nextEntry && nextEntry.task.timerStartedAt);
    const nextTaskPeriod = nextEntry ? nextEntry.period : '';

    hero.innerHTML = `
      <div class="today-hero__left">
        <span class="today-hero__eyebrow">${escapeTodayText(greeting)}</span>
        <h2 class="today-hero__title">${escapeTodayText(focusInfo.title)}</h2>
        <p class="today-hero__insight">${escapeTodayText(heroInsight)}</p>
        <div class="today-hero__meta">
          <span class="today-hero__pill">${escapeTodayText(focusInfo.hint)}</span>
          <span class="today-hero__pill today-hero__pill--ghost">${escapeTodayText(streakText)}</span>
        </div>
      </div>
      <div class="today-hero__right">
        <div class="today-hero__ring" role="img" aria-label="Progresso ${progressPct}%">
          <svg viewBox="0 0 100 100" class="today-ring-svg">
            <circle class="today-ring-track" cx="50" cy="50" r="44" />
            <circle class="today-ring-fill" cx="50" cy="50" r="44"
              stroke-dasharray="${ringCirc.toFixed(2)}"
              stroke-dashoffset="${ringOffset.toFixed(2)}" />
          </svg>
          <div class="today-ring-center">
            <span class="today-ring-pct">${progressPct}<small>%</small></span>
            <span class="today-ring-sub">${completedCount}/${actionableEntries.length || 0}</span>
          </div>
        </div>
        ${
          nextEntry
            ? `
          <div class="today-next-action ${nextTaskIsMoney ? 'is-money' : ''} ${nextTimerRunning ? 'is-running' : ''}"
               data-next-start="${nextTimerRunning ? '0' : '1'}">
            <div class="today-next-action__head">
              <span class="today-next-action__label">Próxima ação</span>
              ${nextTaskIsMoney ? '<span class="today-next-action__tag">💰 Caixa</span>' : ''}
            </div>
            <p class="today-next-action__text">${escapeTodayText(nextTaskTitle)}</p>
            <div class="today-next-action__foot">
              <span class="today-next-action__period">${escapeTodayText(nextTaskPeriod)}</span>
              <button type="button" class="today-next-action__btn">
                <i data-lucide="${nextTimerRunning ? 'pause' : 'play'}"></i>
                <span>${nextTimerRunning ? 'Pausar' : 'Começar'}</span>
              </button>
            </div>
          </div>
        `
            : `
          <div class="today-next-action today-next-action--empty">
            <span class="today-next-action__label">Próxima ação</span>
            <p class="today-next-action__text today-next-action__text--muted">${actionableEntries.length === 0 ? 'Adicione uma tarefa para começar.' : 'Tudo fechado por aqui.'}</p>
          </div>
        `
        }
      </div>
    `;

    const nextBtn = hero.querySelector('.today-next-action__btn');
    if (nextBtn && nextEntry) {
      nextBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const task = nextEntry.task;
        if (!task) return;
        const nowIso = new Date().toISOString();
        const syncDates = new Set();
        syncDates.add(nextEntry.dateStr);
        if (task.timerStartedAt) {
          if (typeof stopTaskTimer === 'function') stopTaskTimer(task, nowIso);
        } else if (typeof startTaskTimer === 'function') {
          startTaskTimer(task, nowIso).forEach((entry) => syncDates.add(entry.dateStr));
        }
        if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
        renderView();
        (async () => {
          for (const syncDate of syncDates) {
            if (typeof syncDateToSupabase === 'function') await syncDateToSupabase(syncDate);
          }
        })();
      });
    }

    grid.appendChild(hero);
  }

  // ========== TASK LIST ==========
  const taskShell = document.createElement('section');
  taskShell.className = focusOnlyMode ? 'today-task-panel today-task-panel--focus' : 'today-task-panel';

  const taskListWrap = document.createElement('div');
  taskListWrap.className = focusOnlyMode
    ? 'today-task-list-wrap today-task-list-wrap--focus'
    : 'today-task-list-wrap';

  const taskList = document.createElement('div');
  taskList.className = focusOnlyMode
    ? 'today-task-list today-task-list--dashboard today-task-list--focus'
    : 'today-task-list today-task-list--dashboard';

  // Inline quick-add at top
  const quickAddTop = document.createElement('button');
  quickAddTop.type = 'button';
  quickAddTop.className = 'today-quick-add';
  quickAddTop.innerHTML = '<i data-lucide="plus"></i><span>Adicionar tarefa</span>';
  quickAddTop.addEventListener('click', (event) => {
    event.stopPropagation();
    insertQuickTaskInput(taskList, dateStr, 'Tarefas', taskList.firstElementChild);
  });
  taskList.appendChild(quickAddTop);

  allTasks.forEach(({ task, day, dateStr: entryDate, period, originalIndex }) => {
    taskList.appendChild(createTaskElement(day, entryDate, period, task, originalIndex));
  });

  const endDropZone = createDropZone(today, dateStr, 'Tarefas', allTasks.length);
  endDropZone.classList.add('today-end-dropzone');
  endDropZone.innerText = '';
  endDropZone.setAttribute('aria-label', 'Adicionar tarefa');
  endDropZone.addEventListener('click', () => {
    if (!document.body.classList.contains('dragging-active')) {
      insertQuickTaskInput(taskList, dateStr, 'Tarefas', endDropZone);
    }
  });
  taskList.appendChild(endDropZone);

  if (allTasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'today-empty';
    empty.innerHTML = `
      <p>Tela limpa. Bom sinal.</p>
      <p>Clique para lançar a primeira tarefa ou arrasta algo da semana.</p>
    `;
    empty.addEventListener('click', () => {
      insertQuickTaskInput(taskList, dateStr, 'Tarefas', endDropZone);
      empty.remove();
    });
    taskList.insertBefore(empty, endDropZone);
  }

  taskListWrap.addEventListener('click', (event) => {
    if (
      event.target === taskListWrap ||
      event.target === taskList ||
      event.target.classList.contains('today-task-list-wrap')
    ) {
      insertQuickTaskInput(taskList, dateStr, 'Tarefas', endDropZone);
    }
  });

  taskListWrap.appendChild(taskList);
  taskShell.appendChild(taskListWrap);

  if (focusOnlyMode) {
    grid.appendChild(taskShell);
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    return;
  }

  const workspace = document.createElement('section');
  workspace.className = 'today-workspace';
  workspace.appendChild(taskShell);

  // ========== INSIGHTS ==========
  const insightRows = [
    { label: 'Pendentes', value: `${pendingEntries.length}` },
    { label: 'Rotina', value: `${routineCompleted}/${routineTotal}` },
    { label: 'Última conclusão', value: lastCompletedText }
  ];
  if (hasAvgBase) insightRows.push({ label: 'Média por tarefa', value: avgTaskDurationText });

  const insights = document.createElement('section');
  insights.className = 'today-insights-grid';
  insights.innerHTML = `
    <article class="today-insight-card">
      <div class="today-card-label">Visão Geral</div>
      <div class="today-insight-list">
        ${insightRows
          .map(
            (row) =>
              `<div><span>${escapeTodayText(row.label)}</span><strong>${escapeTodayText(row.value)}</strong></div>`
          )
          .join('')}
      </div>
    </article>

    <article class="today-insight-card">
      <div class="today-card-label">Esta semana</div>
      <div class="today-week-chart">
        ${weekDates
          .map(({ name, dateStr: weekDateStr }) => {
            const { total, completed } = getFlowlyDayTaskStats(weekDateStr);
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            const height = total > 0 ? Math.max(8, Math.round(pct * 0.42)) : 8;
            const isToday = weekDateStr === dateStr;
            const tone =
              pct >= 80
                ? 'var(--accent-green)'
                : pct >= 50
                  ? 'var(--accent-blue)'
                  : pct > 0
                    ? 'var(--accent-orange)'
                    : 'rgba(255,255,255,0.1)';
            return `
              <div class="today-week-bar-col ${isToday ? 'is-today' : ''}">
                <div class="today-week-bar-shell">
                  <div class="today-week-bar-fill" style="height:${height}px;background:${tone};"></div>
                </div>
                <span>${escapeTodayText(String(name || '').slice(0, 3))}</span>
              </div>
            `;
          })
          .join('')}
      </div>
      <p class="today-insight-footnote">
        ${weekCompleted}/${weekTotal} fechadas · ${escapeTodayText(streakText)}
      </p>
    </article>
  `;
  workspace.appendChild(insights);
  grid.appendChild(workspace);

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}
