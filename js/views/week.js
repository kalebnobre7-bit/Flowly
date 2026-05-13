window.toggleSmartWeek = function() {
  const isSmart = localStorage.getItem('flowly_smart_week') === 'true';
  localStorage.setItem('flowly_smart_week', isSmart ? 'false' : 'true');
  currentWeekOffset = 0; // reset offset when switching Modes
  renderView(); // Re-render the current view (week)
};

window.toggleWeekendsWeek = function() {
  const settings = safeJSONParse(localStorage.getItem('flowly_view_settings'), {});
  settings.showWeekends = settings.showWeekends === false;
  localStorage.setItem('flowly_view_settings', JSON.stringify(settings));
  currentWeekOffset = 0;
  renderView();
};

function renderWeek() {
  const grid = document.getElementById('weekGrid');
  grid.className = 'week-grid';
  grid.style.cssText = '';
  grid.innerHTML = '';

  const isSmartWeek = localStorage.getItem('flowly_smart_week') === 'true';
  const viewSettings = getViewSettings();
  const showWeekends = viewSettings.showWeekends !== false;
  grid.classList.toggle('smart-week-5', isSmartWeek);
  grid.classList.toggle('week-grid--workdays', !showWeekends || isSmartWeek);

  // Atualizar label da semana e botão de toggle
  const smartBtn = document.getElementById('btnSmartWeekToggle');
  if (smartBtn) {
    smartBtn.classList.toggle('is-active', isSmartWeek);
    smartBtn.setAttribute('aria-pressed', isSmartWeek ? 'true' : 'false');
  }

  const weekendsBtn = document.getElementById('btnWeekendsToggle');
  if (weekendsBtn) {
    weekendsBtn.classList.toggle('is-active', showWeekends);
    weekendsBtn.setAttribute('aria-pressed', showWeekends ? 'true' : 'false');
    const text = weekendsBtn.querySelector('span');
    if (text) text.textContent = showWeekends ? 'Fim semana' : 'Só úteis';
  }

  document.getElementById('weekLabel').textContent = isSmartWeek ? 'Foco de 5 Dias' : getWeekLabel(currentWeekOffset);

  let weekDates = [];
  if (isSmartWeek) {
    const start = new Date();
    // Allow smart view to navigate in 5-day leaps
    start.setDate(start.getDate() + (currentWeekOffset * 5));
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    for(let i=0; i<5; i++){
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2,'0');
        const day = String(d.getDate()).padStart(2,'0');
        weekDates.push({ dateStr: `${y}-${m}-${day}`, name: dayNames[d.getDay()] });
    }
  } else {
    weekDates = getWeekDates(currentWeekOffset);
  }

  grid.style.setProperty('--week-column-count', weekDates.length);

  // HIDRATAR A SEMANA: Garantir que as rotinas existam no banco para todos os dias visíveis
  weekDates.forEach(({ dateStr }) => hydrateRoutineForDate(dateStr));

  weekDates.forEach(({ name: day, dateStr }) => {
    // Ler tarefas persistidas (sem rotina/recorrentes)
    const dayTasks = allTasksData[dateStr] || {};

    const col = document.createElement('div');
    col.className = 'day-column';
    col.dataset.day = day;
    col.dataset.date = dateStr;

    // Drag Events (coluna como drop zone de fallback)
    col.addEventListener('dragover', (e) => e.preventDefault());
    col.addEventListener('drop', columnDropFallback);

    const todayStr = localDateStr();
    const isToday = dateStr === todayStr;
    const isPast = dateStr < todayStr;

    if (isToday) col.classList.add('today-active');
    if (isPast) col.classList.add('past-day');
    if (dateStr > todayStr) col.classList.add('future-day');

    const header = document.createElement('div');
    const dayNum = dateStr.split('-')[2].replace(/^0/, '');
    const dayAbbr = day.substring(0, 3).toUpperCase();

    header.className = 'day-col-header';
    header.innerHTML =
      '<span class="day-col-name">' + dayAbbr + '</span>' +
      '<span class="day-col-num">' + dayNum + '</span>';
    col.appendChild(header);

    // Flatten all tasks
    let allTasks = [];

    // 1. Adicionar tarefas de rotina e recorrentes semanais (geradas dinamicamente, index = -1)
    const routineTasks = getRoutineTasksForDate(dateStr);
    routineTasks.forEach((task, routineIndex) => {
      allTasks.push({
        task,
        day,
        dateStr,
        period: 'Rotina',
        originalIndex: routineIndex
      });
    });

    // 2. Adicionar tarefas normais persistidas (excluindo período 'Rotina' se foi salvo indevidamente)
    Object.entries(dayTasks).forEach(([period, tasks]) => {
      if (period === 'Rotina') return; // Pular - rotinas são geradas dinamicamente acima
      if (Array.isArray(tasks)) {
        tasks.forEach((task, index) => {
          if (task && typeof task === 'object') {
            allTasks.push({
              task,
              day,
              dateStr,
              period,
              originalIndex: index
            });
          }
        });
      }
    });

    // ===== ORDENAÃ‡ÃƒO UNIFICADA =====
    getProjectMirrorEntriesForDate(dateStr, day).forEach((entry) => {
      allTasks.push(entry);
    });

    allTasks = unifiedTaskSort(allTasks);

    // Renderizar
    allTasks.forEach(({ task, day, dateStr, period, originalIndex }) => {
      col.appendChild(createTaskElement(day, dateStr, period, task, originalIndex));
    });

    // ===== STUB VISÍVEL PARA NOVA TAREFA =====
    const addStub = document.createElement('div');
    addStub.className = 'quick-task-stub';
    addStub.innerHTML = '<i data-lucide="plus" class="quick-task-stub__icon"></i><span>Adicionar tarefa</span>';
    addStub.addEventListener('click', (e) => {
      e.stopPropagation();
      insertQuickTaskInput(col, dateStr, 'Tarefas', addStub);
    });
    col.appendChild(addStub);

    // ===== DROP ZONE NO FINAL PADRONIZADA =====
    // Usa createDropZone com index = allTasks.length para inserir no fim
    const endDropZone = createDropZone(day, dateStr, 'Tarefas', allTasks.length);
    endDropZone.classList.add('week-end-dropzone');
    endDropZone.innerText = '';

    // Atalho: clique na zona final abre input de nova tarefa
    endDropZone.addEventListener('click', (e) => {
      if (!document.body.classList.contains('dragging-active')) {
        insertQuickTaskInput(col, dateStr, 'Tarefas', addStub);
      }
    });

    col.appendChild(endDropZone);

    // Adicionar área clicável para nova tarefa (estilo Notion)
    col.addEventListener('click', (e) => {
      // Só adicionar se clicar na área vazia (não em tasks ou inputs existentes)
      if (e.target === col || e.target.tagName === 'H2' || e.target.tagName === 'H3') {
        insertQuickTaskInput(col, dateStr, 'Tarefas', endDropZone);
      }
    });

    grid.appendChild(col);
  });

  const columns = Array.from(grid.querySelectorAll('.day-column'));
  const resetColumns = () => {
    grid.style.gridTemplateColumns = `repeat(${columns.length}, minmax(0, 1fr))`;
  };
  resetColumns();
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    columns.forEach((col, index) => {
      col.addEventListener('mouseenter', () => {
        const template = columns.map((_, i) => (i === index ? '1.32fr' : '0.94fr')).join(' ');
        grid.style.gridTemplateColumns = template;
      });
      col.addEventListener('mouseleave', resetColumns);
    });
  }

  if (window.lucide) lucide.createIcons();
}

// Função de Ordenação Unificada (Regra: Rotina -> Concluídas -> Pendentes)

