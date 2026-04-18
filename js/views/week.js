window.toggleSmartWeek = function() {
  const isSmart = localStorage.getItem('flowly_smart_week') === 'true';
  localStorage.setItem('flowly_smart_week', isSmart ? 'false' : 'true');
  currentWeekOffset = 0; // reset offset when switching Modes
  renderView(); // Re-render the current view (week)
};

function renderWeek() {
  const grid = document.getElementById('weekGrid');
  grid.className = '';
  grid.style.cssText = '';
  grid.innerHTML = '';

  const isSmartWeek = localStorage.getItem('flowly_smart_week') === 'true';

  // Atualizar label da semana e botão de toggle
  const smartBtn = document.getElementById('btnSmartWeekToggle');
  if (smartBtn) {
    if (isSmartWeek) {
      smartBtn.classList.add('bg-blue-500/20', 'border-blue-500/50');
      smartBtn.classList.remove('bg-blue-500/10', 'border-blue-500/20');
    } else {
      smartBtn.classList.remove('bg-blue-500/20', 'border-blue-500/50');
      smartBtn.classList.add('bg-blue-500/10', 'border-blue-500/20');
    }
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

  // HIDRATAR A SEMANA: Garantir que as rotinas existam no banco para todos os dias visÃ­veis
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

    const header = document.createElement('h2');
    const dayNum = dateStr.split('-')[2].replace(/^0/, '');

    // Transformando header numa "strip col" emulado, evitando títulos soltos de uma palavra.
    header.className = `today-strip-col px-3 py-4 mb-2 border-b border-white/5`;
    header.innerHTML = `
      <span class="today-strip-label ${isToday ? 'text-accent-primary' : ''}">${day}</span>
      <span class="today-strip-value ${isToday ? 'text-accent-primary' : ''}" style="font-size: 20px;">${dayNum}</span>
    `;
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

    // 2. Adicionar tarefas normais persistidas (excluindo perÃ­odo 'Rotina' se foi salvo indevidamente)
    Object.entries(dayTasks).forEach(([period, tasks]) => {
      if (period === 'Rotina') return; // Pular - rotinas sÃ£o geradas dinamicamente acima
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

    // ===== DROP ZONE NO FINAL PADRONIZADA =====
    // Usa createDropZone com index = allTasks.length para inserir no fim
    const endDropZone = createDropZone(day.name, dateStr, 'Tarefas', allTasks.length);
    endDropZone.classList.add('flex-grow', 'min-h-[40px]'); // Estilo para ocupar espaÃ§o
    endDropZone.innerText = '';

    // Atalho: clique na zona final abre input de nova tarefa
    endDropZone.addEventListener('click', (e) => {
      if (!document.body.classList.contains('dragging-active')) {
        insertQuickTaskInput(col, dateStr, 'Tarefas', endDropZone);
      }
    });

    col.appendChild(endDropZone);

    // Adicionar Ã¡rea clicÃ¡vel para nova tarefa (estilo Notion)
    col.addEventListener('click', (e) => {
      // SÃ³ adicionar se clicar na Ã¡rea vazia (nÃ£o em tasks ou inputs existentes)
      if (e.target === col || e.target.tagName === 'H2' || e.target.tagName === 'H3') {
        insertQuickTaskInput(col, dateStr, 'Tarefas', endDropZone);
      }
    });

    grid.appendChild(col);
  });

  // --- Dynamic Column Hover Resizing ---
  const columns = grid.querySelectorAll('.day-column');
  grid.style.gridTemplateColumns = `repeat(${columns.length}, 1fr)`;
  columns.forEach((col, index) => {
    col.addEventListener('mouseenter', () => {
      // Use 0.9fr for others, 1.6fr for hovered
      const tmpl = Array(columns.length).fill('0.9fr');
      tmpl[index] = '1.6fr';
      grid.style.gridTemplateColumns = tmpl.join(' ');
    });

    col.addEventListener('mouseleave', () => {
      grid.style.gridTemplateColumns = `repeat(${columns.length}, 1fr)`;
    });
  });
}

// FunÃ§Ã£o de OrdenaÃ§Ã£o Unificada (Regra: Rotina -> ConcluÃ­das -> Pendentes)

