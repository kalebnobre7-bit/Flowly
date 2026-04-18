// renderToday movido de js/app.js

function getFlowlyDayTaskStats(dateStr) {
  const metricsApi = window.FlowlyTaskMetrics || {};
  const countTasks = metricsApi.countDayTasks || window.countDayTasks;
  if (typeof countTasks === 'function') return countTasks(dateStr);
  return { total: 0, completed: 0 };
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
  const dateLabel = new Date().toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const today = dayNames[new Date().getDay()];
  const dateStr = localDateStr();

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
  const routinePending = pendingEntries.filter((entry) => entry.period === 'Rotina').length;
  const moneyEntries = pendingEntries.filter(
    (entry) => String(entry.task.priority || '').toLowerCase() === 'money'
  );
  const nextTask = moneyEntries[0] || pendingEntries[0] || null;
  const progressPct =
    actionableEntries.length > 0 ? Math.round((completedCount / actionableEntries.length) * 100) : 0;
  const totalTasksPreview =
    (allTasksData[dateStr]
      ? Object.values(allTasksData[dateStr]).reduce(
          (sum, tasks) => sum + (Array.isArray(tasks) ? tasks.length : 0),
          0
        )
      : 0) + routineTasks.length;
  const focusModeLabel =
    moneyEntries.length > 0
      ? 'Caixa'
      : pendingEntries.length > 5
        ? 'Ataque'
        : pendingEntries.length > 0
          ? 'Fechamento'
          : 'Livre';
  const dailyTarget = actionableEntries.length > 0 ? Math.min(5, actionableEntries.length) : 0;
  const focusLabel = nextTask ? nextTask.task.text : 'Dia sem travas';
  const heroInsight = (() => {
    if (moneyEntries.length > 0) {
      return `${moneyEntries.length} tarefa(s) mexem com caixa hoje. Fecha esse bloco antes de abrir outra frente.`;
    }
    if (pendingEntries.length > 0) {
      return `${pendingEntries.length} pendência(s) abertas. O objetivo é limpar o stack sem espalhar energia.`;
    }
    return 'Sem pressão imediata. Dá para puxar algo novo com intenção ou revisar o dia com calma.';
  })();

  const latestCompletionTs = getLatestCompletionTimestamp();
  const lastCompletedText = formatLastCompletionDisplay(latestCompletionTs);
  const durationSamplesMs = todayPersistedTasks
    .filter((task) => task && task.completed && task.createdAt && task.completedAt)
    .map((task) => new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime())
    .filter((ms) => Number.isFinite(ms) && ms >= 0);

  const avgTaskDurationText =
    durationSamplesMs.length > 0
      ? formatElapsedShort(
          Math.round(durationSamplesMs.reduce((sum, ms) => sum + ms, 0) / durationSamplesMs.length)
        )
      : 'Sem base';

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
  const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;
  const routineTotal = routineTasks.length;
  const routineCompleted = routineTasks.filter((task) => task.completed).length;

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
    ? 'flowly-btn flowly-btn--ghost flowly-btn--sm is-active'
    : 'flowly-btn flowly-btn--ghost flowly-btn--sm';
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

  if (!focusOnlyMode) {
    const dashboard = document.createElement('section');
    dashboard.className = 'today-dashboard-section';
    dashboard.innerHTML = `
      <div class="flowly-stat-strip today-dashboard-strip">
        <div class="flowly-stat-card flowly-stat-card--inline">
          <span class="flowly-stat-card__label">Hoje</span>
          <span class="flowly-stat-card__value">${escapeTodayText(today)}</span>
        </div>
        <div class="flowly-stat-strip__divider"></div>
        <div class="flowly-stat-card flowly-stat-card--inline">
          <span class="flowly-stat-card__label">Progresso</span>
          <span class="flowly-stat-card__value">${completedCount}/${actionableEntries.length || 0}</span>
        </div>
        <div class="flowly-stat-strip__divider"></div>
        <div class="flowly-stat-card flowly-stat-card--inline">
          <span class="flowly-stat-card__label">Foco</span>
          <span class="flowly-stat-card__value">${moneyEntries.length > 0 ? 'Foco Dinheiro' : focusModeLabel}</span>
        </div>
        <div class="flowly-stat-strip__divider"></div>
        <div class="flowly-stat-card flowly-stat-card--inline">
          <span class="flowly-stat-card__label">Próxima Ação</span>
          <span class="flowly-stat-card__value" title="${escapeTodayText(focusLabel)}">${escapeTodayText(focusLabel)}</span>
        </div>
      </div>
    `;
    grid.appendChild(dashboard);
  }

  const taskShell = document.createElement('section');
  taskShell.className = focusOnlyMode ? 'today-task-panel today-task-panel--focus' : 'today-task-panel';

  const taskListWrap = document.createElement('div');
  taskListWrap.className = focusOnlyMode ? 'today-task-list-wrap today-task-list-wrap--focus' : 'today-task-list-wrap';

  const taskList = document.createElement('div');
  taskList.className = focusOnlyMode
    ? 'today-task-list today-task-list--dashboard today-task-list--focus'
    : 'today-task-list today-task-list--dashboard';

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
      <p>Nenhuma tarefa para hoje.</p>
      <p>Clique para adicionar uma tarefa ou arraste algo da semana para começar.</p>
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

  if (!focusOnlyMode) {
    const workspace = document.createElement('section');
    workspace.className = 'today-workspace';
    workspace.appendChild(taskShell);

    const insights = document.createElement('section');
    insights.className = 'today-insights-grid';
    insights.innerHTML = `
      <article class="today-insight-card">
        <div class="today-card-label">Visão Geral</div>
        <div class="today-insight-list">
          <div><span>Pendentes</span><strong>${pendingEntries.length}</strong></div>
          <div><span>Rotina</span><strong>${routineCompleted}/${routineTotal}</strong></div>
          <div><span>Última conclusão</span><strong>${escapeTodayText(lastCompletedText)}</strong></div>
          <div><span>Média por tarefa</span><strong>${escapeTodayText(avgTaskDurationText)}</strong></div>
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
          ${weekCompleted}/${weekTotal} tarefas fechadas na semana corrente • streak ${
            streak > 0 ? `${streak} dia${streak > 1 ? 's' : ''}` : 'zerado'
          }.
        </p>
      </article>
    `;
    workspace.appendChild(insights);
    grid.appendChild(workspace);
    return;
  }

  grid.appendChild(taskShell);
}
