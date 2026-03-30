// View extra?da de app.js
function renderWeek() {
  const grid = document.getElementById('weekGrid');
  grid.className = '';
  grid.style.cssText = '';
  grid.innerHTML = '';

  // Atualizar label da semana
  document.getElementById('weekLabel').textContent = getWeekLabel(currentWeekOffset);

  const weekDates = getWeekDates(currentWeekOffset);

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

    header.className = `flex items-center gap-2 mb-3 ${isToday ? 'text-blue-500 font-bold' : 'text-gray-400'} `;
    header.innerHTML = `
    <span> ${day}</span>
        <span class="${isToday ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-gray-500'} text-xs px-2 py-0.5 rounded-full font-mono">${dayNum}</span>
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

