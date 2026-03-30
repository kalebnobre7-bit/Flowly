// renderToday movido de js/app.js

function getFlowlyDayTaskStats(dateStr) {
  const metricsApi = window.FlowlyTaskMetrics || {};
  const countTasks = metricsApi.countDayTasks || window.countDayTasks;
  if (typeof countTasks === 'function') return countTasks(dateStr);
  return { total: 0, completed: 0 };
}

function renderToday() {
  const grid = document.getElementById('todayView');
  const todayViewSettings = safeJSONParse(localStorage.getItem('flowly_today_view_settings'), {});
  const focusOnlyMode = todayViewSettings.focusOnlyMode === true;

  grid.className = focusOnlyMode ? 'today-container today-focus-mode' : 'today-container';
  grid.style.cssText = '';
  grid.innerHTML = '';

  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const today = days[new Date().getDay()];
  const dateStr = localDateStr();

  // ===== LEFT: Main area =====
  const main = document.createElement('div');
  main.className = 'today-main';

  // Focus toggle (daily view)
  const focusToggleWrap = document.createElement('div');
  focusToggleWrap.className = focusOnlyMode
    ? 'today-focus-toggle-wrap focus-active'
    : 'today-focus-toggle-wrap';

  const focusToggleBtn = document.createElement('button');
  focusToggleBtn.className = 'today-focus-toggle-btn';
  focusToggleBtn.textContent = focusOnlyMode ? 'Mostrar dados' : 'Modo foco';
  focusToggleBtn.onclick = (e) => {
    e.stopPropagation();
    const current = safeJSONParse(localStorage.getItem('flowly_today_view_settings'), {});
    current.focusOnlyMode = !(current.focusOnlyMode === true);
    localStorage.setItem('flowly_today_view_settings', JSON.stringify(current));
    renderView();
  };
  focusToggleWrap.appendChild(focusToggleBtn);
  main.appendChild(focusToggleWrap);

  // Header
  const header = document.createElement('div');
  header.className = 'today-header';
  header.innerHTML = `<h1> ${today}</h1> <p>${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>`;

  const totalTasksPreview = allTasksData[dateStr]
    ? Object.values(allTasksData[dateStr]).reduce(
        (sum, tasks) => sum + (Array.isArray(tasks) ? tasks.length : 0),
        0
      ) + getRoutineTasksForDate(dateStr).length
    : getRoutineTasksForDate(dateStr).length;

  // Task list container
  const taskList = document.createElement('div');
  taskList.className = 'today-task-list';

  // Buscar tarefas de hoje
  const dayTasks = allTasksData[dateStr] || {};
  const todayPersistedTasks = [];
  let allTasks = [];

  // 1. Rotina diária + recorrentes semanais
  const routineTasks = getRoutineTasksForDate(dateStr);
  routineTasks.forEach((task, routineIndex) => {
    allTasks.push({ task, day: today, dateStr, period: 'Rotina', originalIndex: routineIndex });
  });

  getProjectMirrorEntriesForDate(dateStr, today).forEach((entry) => {
    allTasks.push(entry);
  });

  // 2. Tarefas normais persistidas
  Object.entries(dayTasks).forEach(([period, tasks]) => {
    if (period === 'Rotina') return;
    if (Array.isArray(tasks)) {
      tasks.forEach((task, index) => {
        if (task && typeof task === 'object') {
          allTasks.push({ task, day: today, dateStr, period, originalIndex: index });
          todayPersistedTasks.push(task);
        }
      });
    }
  });

  // Render all tasks (Unified Sort)
  allTasks = unifiedTaskSort(allTasks);

  const actionableEntries = allTasks.filter((entry) => entry.task && !entry.task.isProjectMirror);
  const completedCount = actionableEntries.filter((entry) => entry.task && entry.task.completed).length;
  const pendingEntries = actionableEntries.filter((entry) => entry.task && !entry.task.completed);
  const routinePending = pendingEntries.filter((entry) => entry.period === 'Rotina').length;
  const moneyEntries = pendingEntries.filter((entry) => String(entry.task.priority || '').toLowerCase() === 'money');
  const nextTask = moneyEntries[0] || pendingEntries[0] || null;
  const focusLabel = nextTask ? nextTask.task.text : 'Dia zerado por aqui';
  const progressPct = actionableEntries.length > 0 ? Math.round((completedCount / actionableEntries.length) * 100) : 0;
  const focusModeLabel = moneyEntries.length > 0 ? 'Caixa' : pendingEntries.length > 5 ? 'Ataque' : pendingEntries.length > 0 ? 'Fechamento' : 'Livre';

  if (!focusOnlyMode) {
    const todayHero = document.createElement('div');
    todayHero.className = 'today-hero';
    todayHero.innerHTML = `
      <div class="today-hero-main">
        <div class="today-hero-kicker">Painel de hoje</div>
        <h1>${today}</h1>
        <p>${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <div class="today-hero-pills">
          <span class="today-hero-pill today-hero-pill--accent">Modo ${focusModeLabel}</span>
          <span class="today-hero-pill">Meta 5 concluídas</span>
        </div>
      </div>
      <div class="today-hero-metrics">
        <div class="today-hero-card accent">
          <span class="today-hero-card-label">Planejadas</span>
          <strong class="today-hero-card-value">${totalTasksPreview}</strong>
          <span class="today-hero-card-sub">tarefas mapeadas pro dia</span>
        </div>
        <div class="today-hero-card">
          <span class="today-hero-card-label">Pendentes</span>
          <strong class="today-hero-card-value">${pendingEntries.length}</strong>
          <span class="today-hero-card-sub">${routinePending} de rotina ainda abertas</span>
        </div>
      </div>
    `;
    main.appendChild(todayHero);

    const summaryStrip = document.createElement('div');
    summaryStrip.className = 'today-summary-strip';
    summaryStrip.innerHTML = `
      <div class="today-summary-card primary">
        <span class="today-summary-label">Próxima ação</span>
        <strong class="today-summary-value">${focusLabel}</strong>
        <span class="today-summary-sub">${nextTask ? 'fecha essa antes de abrir outra frente' : 'aproveita pra puxar algo novo com intenção'}</span>
      </div>
      <div class="today-summary-card compact">
        <span class="today-summary-label">Progresso</span>
          <strong class="today-summary-value">${completedCount}/${actionableEntries.length || 0}</strong>
        <span class="today-summary-sub">${progressPct}% concluído</span>
      </div>
      <div class="today-summary-card compact">
        <span class="today-summary-label">Prioridade</span>
        <strong class="today-summary-value">${moneyEntries.length > 0 ? 'Dinheiro' : focusModeLabel}</strong>
        <span class="today-summary-sub">${moneyEntries.length > 0 ? moneyEntries.length + ' tarefa(s) com impacto financeiro' : 'estado operacional do dia'}</span>
      </div>
    `;
    main.appendChild(summaryStrip);
  }

  allTasks.forEach(({ task, day, dateStr, period, originalIndex }) => {
    taskList.appendChild(createTaskElement(day, dateStr, period, task, originalIndex));
  });

  // ===== UNIFIED DROP ZONE (Igual a renderWeek) =====
  // Usa createDropZone com index = allTasks.length para inserir no fim
  const endDropZone = createDropZone(today, dateStr, 'Tarefas', allTasks.length);
  endDropZone.classList.add('flex-grow', 'min-h-[40px]'); // Estilo para ocupar espaço
  endDropZone.innerText = '';

  // Atalho: clique na zona final abre input de nova tarefa
  endDropZone.addEventListener('click', (e) => {
    if (!document.body.classList.contains('dragging-active')) {
      insertQuickTaskInput(taskList, dateStr, 'Tarefas', endDropZone);
    }
  });

  taskList.appendChild(endDropZone);

  main.appendChild(taskList);

  // Empty state
  if (allTasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'today-empty';
    empty.innerHTML = `<p> Nenhuma tarefa para hoje</p> <p>Clique para adicionar uma tarefa</p>`;
    // Inserir empty state DENTRO da taskList ou logo após, mas mantendo a dropzone funcional?
    // Melhor: Se vazio, dropzone já serve. O texto ajuda.
    // Vamos manter o empty state visual, mas o clique nele aciona o input.
    empty.addEventListener('click', () => {
      insertQuickTaskInput(taskList, dateStr, 'Tarefas', endDropZone);
      empty.remove();
    });
    taskList.insertBefore(empty, endDropZone);
  }

  // Clickable area for quick add (Container principal)
  main.style.cursor = 'text';
  main.style.minHeight = '50vh';
  main.addEventListener('click', (e) => {
    // Só acionar se clicar no container vazio ("fundo"), não em elementos interativos
    if (e.target === main || e.target === taskList || e.target.classList.contains('today-main')) {
      insertQuickTaskInput(taskList, dateStr, 'Tarefas', endDropZone);
    }
  });

  grid.appendChild(main);

  if (focusOnlyMode) {
    return;
  }


  // ===== RIGHT: Sidebar stats =====
  const sidebar = document.createElement('div');
  sidebar.className = 'today-sidebar';

  // Calcular stats
  const totalTasks = actionableEntries.length;
  const completedTasks = allTasks.filter((t) => t.task.completed).length;
  const pendingTasks = totalTasks - completedTasks;
  const todayRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Rotina stats
  const routineTotal = routineTasks.length;
  const routineCompleted = routineTasks.filter((t) => t.completed).length;
  const routineRate = routineTotal > 0 ? Math.round((routineCompleted / routineTotal) * 100) : 0;

  const latestCompletionTs = getLatestCompletionTimestamp();
  const lastCompletedTask = latestCompletionTs
    ? { completedAt: new Date(latestCompletionTs).toISOString() }
    : null;
  const lastCompletedText = formatLastCompletionDisplay(latestCompletionTs);

  const durationSamplesMs = todayPersistedTasks
    .filter((t) => t && t.completed && t.createdAt && t.completedAt)
    .map((t) => new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime())
    .filter((ms) => Number.isFinite(ms) && ms >= 0);

  const avgTaskDurationText =
    durationSamplesMs.length > 0
      ? formatElapsedShort(
          Math.round(durationSamplesMs.reduce((sum, ms) => sum + ms, 0) / durationSamplesMs.length)
        )
      : 'Sem dados';

  // Streak
  let streak = 0;
  const checkD = new Date();
  for (let i = 0; i < 60; i++) {
    const cds = localDateStr(checkD);
    const { total: sTotal, completed: sCompleted } = getFlowlyDayTaskStats(cds);
    if (sTotal > 0 && sCompleted === sTotal) {
      streak++;
    } else if (i > 0 || (i === 0 && sTotal > 0)) {
      break;
    }
    checkD.setDate(checkD.getDate() - 1);
  }

  // Semana
  const weekDates = getWeekDates(0);
  let weekTotal = 0,
    weekCompleted = 0;
  weekDates.forEach(({ dateStr: wds }) => {
    const { total: wt, completed: wc } = getFlowlyDayTaskStats(wds);
    weekTotal += wt;
    weekCompleted += wc;
  });
  const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

  // Ring color
  const ringColor =
    todayRate >= 70
      ? 'var(--accent-green)'
      : todayRate >= 40
        ? 'var(--accent-orange)'
        : todayRate > 0
          ? 'var(--accent-red)'
          : 'rgba(255,255,255,0.1)';
  const ringPct = todayRate;
  const circumference = 2 * Math.PI * 19;
  const dashOffset = circumference - (circumference * ringPct) / 100;

  // Build sidebar HTML
  sidebar.innerHTML = `
    <!--Progresso do dia-->
                
                
                
                
                
                
                
                <div class="stat-section">
                
                
                
                
                
                
                
                    <div class="stat-section-title">Progresso</div>
                
                
                
                
                
                
                
                    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
                
                
                
                
                
                
                
                        <div class="stat-ring">
                
                
                
                
                
                
                
                            <svg width="48" height="48" viewBox="0 0 48 48">
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                <circle cx="24" cy="24" r="19" fill="none" stroke="${ringColor}" stroke-width="3"
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                    stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                    stroke-linecap="round"/>
                
                
                
                
                
                
                
                            </svg>
                
                
                
                
                
                
                
                            <div class="stat-ring-text">${todayRate}%</div>
                
                
                
                
                
                
                
                        </div>
                
                
                
                
                
                
                
                        <div>
                
                
                
                
                
                
                
                            <div style="font-size: 13px; color: var(--text-secondary);">${completedTasks} de ${totalTasks}</div>
                
                
                
                
                
                
                
                            <div style="font-size: 11px; color: var(--text-tertiary);">tarefas concluídas</div>
                
                
                
                
                
                
                
                        </div>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                    <div class="progress-bar-mini">
                
                
                
                
                
                
                
                        <div class="progress-bar-mini-fill" style="width: ${todayRate}%; background: ${ringColor};"></div>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                </div>

                
                
                
                
                
                
                
                <!--Resumo -->
                
                
                
                
                
                
                
                <div class="stat-section">
                
                
                
                
                
                
                
                    <div class="stat-section-title">Resumo</div>
                
                
                
                
                
                
                
                    <div class="stat-card">
                
                
                
                
                
                
                
                        <span class="stat-label">Pendentes</span>
                
                
                
                
                
                
                
                        <span class="stat-value ${pendingTasks > 0 ? 'orange' : 'green'}">${pendingTasks}</span>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                    <div class="stat-card">
                
                
                
                
                
                
                
                        <span class="stat-label">Rotina</span>
                
                
                
                
                
                
                
                        <span class="stat-value ${routineRate >= 80 ? 'green' : routineRate >= 50 ? 'blue' : ''}">${routineCompleted}/${routineTotal}</span>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                                        <div class="stat-card">
                        <span class="stat-label">Ultima conclusao</span>
                        <span class="stat-value ${lastCompletedTask ? 'blue' : ''}">${lastCompletedText}</span>
                    </div>

                    <div class="stat-card">
                        <span class="stat-label">Media por tarefa</span>
                        <span class="stat-value ${durationSamplesMs.length > 0 ? 'blue' : ''}">${avgTaskDurationText}</span>
                    </div>
<div class="stat-card">
                
                
                
                
                
                
                
                        <span class="stat-label">Streak</span>
                
                
                
                
                
                
                
                        <span class="stat-value ${streak >= 3 ? 'green' : ''}">${streak > 0 ? streak + ' dia' + (streak > 1 ? 's' : '') : '—'}</span>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                    <div class="stat-card">
                
                
                
                
                
                
                
                        <span class="stat-label">Semana</span>
                
                
                
                
                
                
                
                        <span class="stat-value ${weekRate >= 70 ? 'green' : weekRate >= 40 ? 'blue' : ''}">${weekRate}%</span>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                </div>

                
                
                
                
                
                
                
                <!--Mini semana-->
    <div class="stat-section">
        <div class="stat-section-title">Esta semana</div>
        <div style="display: flex; gap: 6px; align-items: flex-end;">
            ${weekDates
              .map(({ name, dateStr: wds }) => {
                const { total: wt, completed: wc } = getFlowlyDayTaskStats(wds);

                const pct = wt > 0 ? Math.round((wc / wt) * 100) : 0;

                const isToday = wds === dateStr;

                const barColor =
                  pct >= 80
                    ? 'var(--accent-green)'
                    : pct >= 50
                      ? 'var(--accent-blue)'
                      : pct > 0
                        ? 'var(--accent-orange)'
                        : 'rgba(255,255,255,0.06)';

                const barH = wt > 0 ? Math.max(6, pct * 0.4) : 4;

                return `<div style="flex: 1; text-align: center;">
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                <div style="height: 40px; display: flex; align-items: flex-end; justify-content: center;">
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                    <div style="width: 100%; max-width: 20px; height: ${barH}px; background: ${barColor}; border-radius: 2px; ${isToday ? 'box-shadow: 0 0 6px ' + barColor + ';' : ''}"></div>
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                <div style="font-size: 10px; color: ${isToday ? 'var(--accent-blue)' : 'var(--text-tertiary)'}; margin-top: 4px; font-weight: ${isToday ? '600' : '400'};">${String(name || '').slice(0, 3)}</div>
                
                
                
                
                
                
                
                            </div>`;
              })
              .join('')}
        </div>
    </div>
`;

  grid.appendChild(sidebar);
}

// Função unificada para inserção de input de tarefa
