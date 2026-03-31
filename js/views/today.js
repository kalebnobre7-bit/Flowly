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

  grid.className = focusOnlyMode ? 'flowly-shell today-container today-focus-mode' : 'flowly-shell today-container';
  grid.style.cssText = '';
  grid.innerHTML = '';

  const dayTasks = allTasksData[dateStr] || {};
  const todayPersistedTasks = [];
  const routineTasks = getRoutineTasksForDate(dateStr);
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
  const projectMirrorCount = allTasks.filter((entry) => entry.task && entry.task.isProjectMirror).length;
  const completedCount = actionableEntries.filter((entry) => entry.task && entry.task.completed).length;
  const pendingEntries = actionableEntries.filter((entry) => entry.task && !entry.task.completed);
  const routinePending = pendingEntries.filter((entry) => entry.period === 'Rotina').length;
  const moneyEntries = pendingEntries.filter(
    (entry) => String(entry.task.priority || '').toLowerCase() === 'money'
  );
  const nextTask = moneyEntries[0] || pendingEntries[0] || null;
  const focusLabel = nextTask ? nextTask.task.text : 'Stack limpo';
  const progressPct =
    actionableEntries.length > 0 ? Math.round((completedCount / actionableEntries.length) * 100) : 0;
  const focusModeLabel =
    moneyEntries.length > 0
      ? 'Caixa'
      : pendingEntries.length > 5
        ? 'Ataque'
        : pendingEntries.length > 0
          ? 'Fechamento'
          : 'Livre';
  const totalTasksPreview =
    (allTasksData[dateStr]
      ? Object.values(allTasksData[dateStr]).reduce(
          (sum, tasks) => sum + (Array.isArray(tasks) ? tasks.length : 0),
          0
        )
      : 0) + routineTasks.length;
  const heroInsight = (() => {
    if (moneyEntries.length > 0) {
      return `${moneyEntries.length} tarefa(s) mexem com caixa hoje. Fecha esse bloco antes de abrir outra frente.`;
    }
    if (pendingEntries.length > 0) {
      return `${pendingEntries.length} pendência(s) ativas. O objetivo é reduzir ruído e fechar o dia com clareza.`;
    }
    return 'Dia aberto. Dá para puxar algo novo com intenção ou usar a tela como painel de revisão.';
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
  const routineRate = routineTotal > 0 ? Math.round((routineCompleted / routineTotal) * 100) : 0;
  const totalTasks = actionableEntries.length;
  const pendingTasks = pendingEntries.length;
  const ringColor =
    progressPct >= 70
      ? 'var(--accent-green)'
      : progressPct >= 40
        ? 'var(--accent-orange)'
        : progressPct > 0
          ? 'var(--accent-red)'
          : 'rgba(255,255,255,0.14)';
  const circumference = 2 * Math.PI * 24;
  const dashOffset = circumference - (circumference * progressPct) / 100;

  const focusToggleWrap = document.createElement('div');
  focusToggleWrap.className = focusOnlyMode
    ? 'today-focus-toggle-wrap focus-active'
    : 'today-focus-toggle-wrap';
  const focusToggleBtn = document.createElement('button');
  focusToggleBtn.className = 'today-focus-toggle-btn';
  focusToggleBtn.textContent = focusOnlyMode ? 'Mostrar dados' : 'Modo foco';
  focusToggleBtn.onclick = (event) => {
    event.stopPropagation();
    const currentSettings = safeJSONParse(localStorage.getItem('flowly_today_view_settings'), {});
    currentSettings.focusOnlyMode = !(currentSettings.focusOnlyMode === true);
    localStorage.setItem('flowly_today_view_settings', JSON.stringify(currentSettings));
    renderView();
  };
  focusToggleWrap.appendChild(focusToggleBtn);
  grid.appendChild(focusToggleWrap);

  const masthead = document.createElement('section');
  masthead.className = focusOnlyMode
    ? 'flowly-page-masthead today-masthead today-masthead--focus'
    : 'flowly-page-masthead today-masthead';
  masthead.innerHTML = `
    <div class="flowly-page-header today-masthead-copy">
      <div class="flowly-page-kicker">Painel de hoje</div>
      <h2 class="flowly-page-title">${escapeTodayText(today)}</h2>
      <p class="flowly-page-subtitle">${escapeTodayText(heroInsight)}</p>
      <div class="flowly-inline-pills today-inline-pills">
        <span class="flowly-soft-pill flowly-soft-pill--accent">Modo ${escapeTodayText(
          focusModeLabel
        )}</span>
        <span class="flowly-soft-pill">${pendingTasks} pendentes</span>
        <span class="flowly-soft-pill">${moneyEntries.length} de caixa</span>
        <span class="flowly-soft-pill">${projectMirrorCount} projeto(s) espelhado(s)</span>
      </div>
    </div>

    <aside class="today-focus-card flowly-panel">
      <div class="today-focus-card-head">
        <div>
          <div class="today-card-kicker">Próxima ação</div>
          <strong>${escapeTodayText(focusLabel)}</strong>
        </div>
        <span class="flowly-soft-pill ${moneyEntries.length > 0 ? 'flowly-soft-pill--accent' : ''}">${
          moneyEntries.length > 0 ? 'Caixa primeiro' : 'Stack do dia'
        }</span>
      </div>
      <p>${escapeTodayText(
        nextTask
          ? 'Fecha essa antes de abrir outra frente. O resto da tela serve para limpar o backlog sem perder prioridade.'
          : 'Sem trava urgente agora. Você pode puxar uma nova frente ou usar o dia para reorganizar o fluxo.'
      )}</p>
      <div class="today-focus-card-grid">
        <div class="today-focus-mini">
          <span>${escapeTodayText(dateLabel)}</span>
          <strong>${totalTasksPreview}</strong>
          <small>tarefas mapeadas hoje</small>
        </div>
        <div class="today-focus-mini">
          <span>Progresso</span>
          <strong>${progressPct}%</strong>
          <small>${completedCount}/${actionableEntries.length || 0} concluídas</small>
        </div>
      </div>
    </aside>
  `;
  grid.appendChild(masthead);

  if (!focusOnlyMode) {
    const statsGrid = document.createElement('section');
    statsGrid.className = 'flowly-stat-grid today-stat-grid';
    statsGrid.innerHTML = `
      <article class="flowly-stat-card">
        <span>Planejadas</span>
        <strong>${totalTasksPreview}</strong>
        <small>${routineTasks.length} de rotina e ${projectMirrorCount} ligadas a projetos</small>
      </article>
      <article class="flowly-stat-card">
        <span>Pendentes</span>
        <strong>${pendingTasks}</strong>
        <small>${routinePending} ainda dependem da rotina do dia</small>
      </article>
      <article class="flowly-stat-card">
        <span>Progressão</span>
        <strong>${completedCount}/${actionableEntries.length || 0}</strong>
        <small>${progressPct}% do stack operacional já foi fechado</small>
      </article>
      <article class="flowly-stat-card">
        <span>Leitura do dia</span>
        <strong>${moneyEntries.length > 0 ? 'Dinheiro' : focusModeLabel}</strong>
        <small>${
          moneyEntries.length > 0
            ? `${moneyEntries.length} tarefa(s) com impacto financeiro`
            : `${streak > 0 ? streak + ' dia(s)' : 'sem streak'} de consistência`
        }</small>
      </article>
    `;
    grid.appendChild(statsGrid);
  }

  const workspace = document.createElement('section');
  workspace.className = focusOnlyMode ? 'today-workspace today-workspace--focus' : 'today-workspace';

  const main = document.createElement('div');
  main.className = 'today-main today-main--rebuilt';

  const taskStage = document.createElement('section');
  taskStage.className = focusOnlyMode ? 'today-stage flowly-panel today-stage--focus' : 'today-stage flowly-panel';
  taskStage.innerHTML = `
    <div class="today-stage-head">
      <div>
        <div class="today-card-kicker">Stack operacional</div>
        <h3>${focusOnlyMode ? 'Modo foco' : 'Hoje sem ruído'}</h3>
        <p>${
          focusOnlyMode
            ? 'Lista limpa para executar. O restante da leitura volta quando você sair do modo foco.'
            : 'Tudo que entra aqui precisa ajudar a fechar o dia. Arraste, conclua ou reorganize sem perder contexto.'
        }</p>
      </div>
      <div class="today-stage-pills">
        <span class="today-stage-pill ${pendingTasks > 0 ? 'today-stage-pill--accent' : ''}">${pendingTasks} abertas</span>
        <span class="today-stage-pill">${completedCount} feitas</span>
        <span class="today-stage-pill">${routineCompleted}/${routineTotal} rotina</span>
      </div>
    </div>
  `;

  const taskStageBody = document.createElement('div');
  taskStageBody.className = 'today-stage-body';

  const taskList = document.createElement('div');
  taskList.className = 'today-task-list today-task-list--rebuilt';

  allTasks.forEach(({ task, day, dateStr: entryDate, period, originalIndex }) => {
    taskList.appendChild(createTaskElement(day, entryDate, period, task, originalIndex));
  });

  const endDropZone = createDropZone(today, dateStr, 'Tarefas', allTasks.length);
  endDropZone.classList.add('flex-grow', 'min-h-[40px]', 'today-end-dropzone');
  endDropZone.innerText = '';
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
      <p>Clique aqui para adicionar uma tarefa ou arraste algo da semana para começar.</p>
    `;
    empty.addEventListener('click', () => {
      insertQuickTaskInput(taskList, dateStr, 'Tarefas', endDropZone);
      empty.remove();
    });
    taskList.insertBefore(empty, endDropZone);
  }

  taskStageBody.addEventListener('click', (event) => {
    if (
      event.target === taskStageBody ||
      event.target === taskList ||
      event.target.classList.contains('today-stage-body')
    ) {
      insertQuickTaskInput(taskList, dateStr, 'Tarefas', endDropZone);
    }
  });

  taskStageBody.appendChild(taskList);
  taskStage.appendChild(taskStageBody);
  main.appendChild(taskStage);
  workspace.appendChild(main);

  if (!focusOnlyMode) {
    const weekBarsMarkup = weekDates
      .map(({ name, dateStr: weekDateStr }) => {
        const { total, completed } = getFlowlyDayTaskStats(weekDateStr);
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        const isToday = weekDateStr === dateStr;
        const barColor =
          pct >= 80
            ? 'var(--accent-green)'
            : pct >= 50
              ? 'var(--accent-blue)'
              : pct > 0
                ? 'var(--accent-orange)'
                : 'rgba(255,255,255,0.08)';
        const height = total > 0 ? Math.max(10, Math.round(pct * 0.46)) : 8;
        return `
          <div class="today-week-bar-col ${isToday ? 'is-today' : ''}">
            <div class="today-week-bar-shell">
              <div class="today-week-bar-fill" style="height:${height}px;background:${barColor};"></div>
            </div>
            <span>${escapeTodayText(String(name || '').slice(0, 3))}</span>
          </div>
        `;
      })
      .join('');

    const sidebar = document.createElement('aside');
    sidebar.className = 'today-sidebar';
    sidebar.innerHTML = `
      <section class="today-side-card flowly-panel today-side-card--progress">
        <div class="today-card-kicker">Progresso</div>
        <div class="today-progress-shell">
          <div class="today-ring">
            <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4"></circle>
              <circle
                cx="32"
                cy="32"
                r="24"
                fill="none"
                stroke="${ringColor}"
                stroke-width="4"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${dashOffset}"
                stroke-linecap="round"
                transform="rotate(-90 32 32)"
              ></circle>
            </svg>
            <div class="today-ring-text">${progressPct}%</div>
          </div>
          <div class="today-progress-copy">
            <strong>${completedCount} de ${totalTasks}</strong>
            <p>tarefas concluídas no stack do dia</p>
          </div>
        </div>
        <div class="today-progress-bar">
          <div class="today-progress-bar-fill" style="width:${progressPct}%;background:${ringColor};"></div>
        </div>
      </section>

      <section class="today-side-card flowly-panel">
        <div class="today-card-kicker">Resumo rápido</div>
        <div class="today-side-list">
          <div class="today-side-row">
            <span>Pendentes</span>
            <strong class="${pendingTasks > 0 ? 'is-warm' : 'is-good'}">${pendingTasks}</strong>
          </div>
          <div class="today-side-row">
            <span>Rotina</span>
            <strong class="${routineRate >= 80 ? 'is-good' : routineRate >= 50 ? 'is-cool' : ''}">${routineCompleted}/${routineTotal}</strong>
          </div>
          <div class="today-side-row">
            <span>Última conclusão</span>
            <strong class="${latestCompletionTs ? 'is-cool' : ''}">${escapeTodayText(lastCompletedText)}</strong>
          </div>
          <div class="today-side-row">
            <span>Média por tarefa</span>
            <strong class="${durationSamplesMs.length > 0 ? 'is-cool' : ''}">${escapeTodayText(avgTaskDurationText)}</strong>
          </div>
          <div class="today-side-row">
            <span>Streak</span>
            <strong class="${streak >= 3 ? 'is-good' : ''}">${
              streak > 0 ? `${streak} dia${streak > 1 ? 's' : ''}` : '—'
            }</strong>
          </div>
          <div class="today-side-row">
            <span>Semana</span>
            <strong class="${weekRate >= 70 ? 'is-good' : weekRate >= 40 ? 'is-cool' : ''}">${weekRate}%</strong>
          </div>
        </div>
      </section>

      <section class="today-side-card flowly-panel">
        <div class="today-card-kicker">Esta semana</div>
        <div class="today-week-chart">${weekBarsMarkup}</div>
        <p class="today-side-footnote">${weekCompleted}/${weekTotal} tarefas fechadas na semana corrente.</p>
      </section>
    `;
    workspace.appendChild(sidebar);
  }

  grid.appendChild(workspace);
}
