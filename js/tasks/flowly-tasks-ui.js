// task ui and drag-drop helpers moved from js/app.js

function insertQuickTaskInput(container, dateStr, period, beforeElement = null) {
  // Verificar se já existe um input ativo no container
  const existingInput = container.querySelector('.quick-task-input');
  if (existingInput) {
    existingInput.focus();
    return;
  }

  const inputContainer = document.createElement('div');
  inputContainer.className = 'quick-task-container';
  inputContainer.style.padding = '5px 6px';

  // Checkbox placeholder (visual apenas)
  const checkboxPlaceholder = document.createElement('div');
  checkboxPlaceholder.style.width = '16px';
  checkboxPlaceholder.style.height = '16px';
  checkboxPlaceholder.style.borderRadius = '4px';
  checkboxPlaceholder.style.border = '1.5px solid rgba(255,255,255,0.15)';
  checkboxPlaceholder.style.flexShrink = '0';
  checkboxPlaceholder.style.marginTop = '2px';
  inputContainer.appendChild(checkboxPlaceholder);

  // Input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'quick-task-input flex-1';
  input.placeholder = 'Escreva a tarefa...';
  input.autocomplete = 'off';
  input.setAttribute('data-form-type', 'other');
  inputContainer.appendChild(input);

  // Inserção no DOM
  if (beforeElement) {
    container.insertBefore(inputContainer, beforeElement);
  } else {
    container.appendChild(inputContainer);
  }

  input.focus();

  // Handlers
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();

      createTaskViaSexta(dateStr, input.value.trim(), period);
      inputContainer.remove();
    }

    if ((e.key === 'Backspace' || e.key === 'Delete') && input.value.trim() === '') {
      e.preventDefault();
      inputContainer.remove();
    }

    if (e.key === 'Escape') {
      inputContainer.remove();
    }
  });

  input.addEventListener('blur', () => {
    // Pequeno delay para permitir clique em botões se houver
    setTimeout(() => {
      if (document.activeElement !== input && input.value.trim() === '') {
        inputContainer.remove();
      }
    }, 100);
  });
}

function createTaskElement(day, dateStr, period, task, index) {
  const container = document.createElement('div');

  const isRoutineTask = task.isRoutine || task.isRecurring || period === 'Rotina';
  const isProjectMirror = task.isProjectMirror === true;
  const normalizedIndex = Number.isInteger(index) ? index : -1;
  const actionDateStr = isProjectMirror ? task.mirrorSourceDateStr || dateStr : dateStr;
  const actionPeriod = isProjectMirror ? task.mirrorSourcePeriod || period : period;
  const actionIndex = isProjectMirror
    ? Number.isInteger(task.mirrorSourceIndex)
      ? task.mirrorSourceIndex
      : -1
    : normalizedIndex;
  const actionTask = allTasksData?.[actionDateStr]?.[actionPeriod]?.[actionIndex] || task;

  // Top Drop Zone
  if (normalizedIndex >= 0 && !isProjectMirror) {
    container.appendChild(createDropZone(day, dateStr, period, normalizedIndex));
  }

  const el = document.createElement('div');
  el.className = `task-item ${task.isHabit ? 'is-habit' : ''} `;
  el.draggable = normalizedIndex >= 0 && !isProjectMirror;
  el.dataset.day = day;
  el.dataset.date = dateStr;
  el.dataset.period = period;
  el.dataset.index = normalizedIndex;
  if (isProjectMirror) {
    el.classList.add('task-item--project-mirror');
    el.dataset.sourceDate = actionDateStr;
    el.dataset.sourcePeriod = actionPeriod;
    el.dataset.sourceIndex = String(actionIndex);
  }
  if (isRoutineTask) {
    el.dataset.routineKey = getRoutineKey(task);
  }

  // Aplicar indent de árvore hierárquica (Notion-style)
  el.tabIndex = 0; // Make focusable for keyboard events

  if (task.depth && task.depth > 0) {
    el.style.marginLeft = `${task.depth * 28}px`;
    el.style.borderLeft = '2px solid rgba(255,255,255,0.08)';
    el.style.paddingLeft = '12px';
    const fontSize = 16 - task.depth * 1;
    el.style.fontSize = `${fontSize}px`;
    el.style.opacity = '0.9';
  } else if (task.indent && task.indent > 0) {
    // Fallback legado
    el.style.paddingLeft = `${task.indent * 24}px`;
  }

  el.onkeydown = (e) => {
    if (isProjectMirror) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.handleTaskIndent === 'function') {
        window.handleTaskIndent(dateStr, period, index, e.shiftKey);
      }
    }
  };

  const childrenCount = isProjectMirror
    ? Number(task.renderChildrenCount || 0)
    : normalizedIndex >= 0
      ? getTaskChildrenCount(dateStr, period, task)
      : 0;
  const hasChildren = childrenCount > 0;
  const isCollapsed = hasChildren ? isTaskGroupCollapsed(task) : false;

  let collapseBtn = null;
  if (hasChildren) {
    collapseBtn = document.createElement('button');
    collapseBtn.className = 'task-collapse-btn';
    collapseBtn.type = 'button';
    collapseBtn.innerHTML = `${isCollapsed ? '▶' : '▼'} <span>${childrenCount}</span>`;
    collapseBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isProjectMirror) {
        window.toggleTaskTreeCollapse(task);
        return;
      }
      window.toggleTaskChildrenCollapse(dateStr, period, normalizedIndex);
    };
  }

  if (task.isProjectAnchor) {
    el.classList.add('task-item--project-anchor');
    el.draggable = false;
    el.dataset.projectId = task.projectId || '';
    el.dataset.sourceDate = actionDateStr;
    el.dataset.sourcePeriod = actionPeriod;
    el.dataset.sourceIndex = String(actionIndex);
    el.title = 'Abrir tarefa do projeto';

    const anchorCheckbox = document.createElement('span');
    anchorCheckbox.className = 'task-project-anchor-checkbox';
    el.appendChild(anchorCheckbox);

    const anchorBody = document.createElement('div');
    anchorBody.className = 'task-project-anchor-body';
    anchorBody.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.toggleTaskExpansion(actionTask, el);
    };

    const anchorTitle = document.createElement('span');
    anchorTitle.className = 'task-project-anchor-title';
    anchorTitle.textContent = task.text || 'Projeto';
    anchorBody.appendChild(anchorTitle);

    const anchorMetaParts = [
      task.projectName && task.projectName !== task.text ? `em ${task.projectName}` : null,
      task.projectScheduleText || null
    ].filter(Boolean);

    if (anchorMetaParts.length > 0) {
      const anchorMeta = document.createElement('div');
      anchorMeta.className = 'task-project-anchor-meta';
      anchorMeta.textContent = anchorMetaParts.join(' • ');
      anchorBody.appendChild(anchorMeta);
    }

    el.appendChild(anchorBody);
    if (collapseBtn) {
      collapseBtn.style.marginLeft = 'auto';
      el.appendChild(collapseBtn);
    }
    container.appendChild(el);
    return container;
  }

  // Label (criado primeiro para ser referenciado pelos callbacks)
  // Label (criado primeiro para ser referenciado pelos callbacks)
  const label = document.createElement('span');
  // Removemos task-completed daqui para não afetar todos os filhos
  label.className = `task-label color-${task.color || 'default'}`;
  // Aplicar cor azul se for tarefa de rotina
  if (task.isRoutine || task.isRecurring || period === 'Rotina') {
    label.style.color = 'var(--accent-blue)';
  }

  // Cor da DIFICULDADE (Prioridade) - sobrepõe rotina se existir
  if (task.priority && task.priority !== 'none' && task.priority !== 'null') {
    const customPrio = getTaskPriorities().find((p) => p.id === task.priority);
    if (customPrio) {
      label.style.color = customPrio.color;
    }
  }

  // Normalizar texto da tarefa (garantir que não seja undefined)
  if (task.text === undefined || task.text === null) {
    task.text = '';
  }

  // Se a tarefa está vazia, mostrar placeholder
  // Modificação da Estrutura para separar Texto (line-through) do Horário (sem line-through)
  const textContentSpan = document.createElement('span');
  textContentSpan.className = 'task-content-span';

  if (task.text.trim() === '') {
    label.textContent = '';
    label.style.color = '#666';
    label.setAttribute('data-placeholder', 'Clique para editar...');
    label.style.position = 'relative';
  } else {
    textContentSpan.textContent = task.text;
    if (task.completed) {
      textContentSpan.classList.add('task-completed');
    }
    label.appendChild(textContentSpan);
  }

  // Single Click Toggle Expansion
  label.onclick = (e) => {
    e.preventDefault();
    window.toggleTaskExpansion(actionTask, el);
  };

  // Make element flex and handle alignment
  el.style.display = 'flex';
  el.style.alignItems = 'center';

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'checkbox-custom';
  checkbox.checked = task.completed;
  if (isProjectMirror) {
    checkbox.disabled = true;
    checkbox.tabIndex = -1;
  }
  checkbox.onchange = (e) => {
    if (isProjectMirror) return;
    if (e.target.checked && task.timerStartedAt) {
      stopTaskTimer(task);
    }
    task.completed = e.target.checked;
    if (!task.createdAt) task.createdAt = new Date().toISOString();
    if (task.completed && navigator.vibrate) {
      const vs = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
      if (vs.haptics !== false) navigator.vibrate(15);
    }

    // Atualiza visualmente o span de texto interno
    const innerText = label.querySelector('.task-content-span');
    if (innerText) {
      innerText.classList.toggle('task-completed', task.completed);
    }

    // Se for rotina ou habito, usar a função centralizada que sincroniza com Supabase
    if (task.isRoutine || task.isRecurring || task.isHabit || period === 'Rotina') {
      if (task.completed) {
        task.completedAt = new Date().toISOString();
      } else {
        task.completedAt = null;
      }

      // Usa a função global que já lida com habitsHistory + localStorage + Supabase
      // IMPORTANTE: Passar dateStr para marcar no dia CORRETO, não apenas hoje
      if (typeof markHabitCompleted === 'function') {
        markHabitCompleted(task.text, task.completed, dateStr);
      }
    } else {
      // Apenas salvar se for tarefa comum
      // USAR NOVO TOGGLE HANDLER para reordenar array
      window.toggleTaskStatus(dateStr, period, index, task.completed, el);
      // Nota: toggleTaskStatus já chama saveToLocalStorage e renderView
    }
  };
  el.appendChild(checkbox);

  // Horário de Conclusão — mostrar pra TODAS as tarefas concluídas (incluindo rotinas)
  if (
    (currentView === 'today' || currentView === 'week') &&
    task.completed &&
    task.text.trim() !== ''
  ) {
    const timeSource =
      task.completedAt ||
      (task.isHabit && habitsHistory[task.text] && habitsHistory[task.text][dateStr]) ||
      null;
    if (timeSource && typeof timeSource === 'string') {
      const timeSpan = document.createElement('span');
      timeSpan.className = 'task-time';
      timeSpan.textContent = ' · ' + formatTaskTime(timeSource);
      timeSpan.style.cssText =
        'font-size:11px;color:var(--text-tertiary);margin-left:6px;font-weight:normal;text-decoration:none;opacity:0.6;white-space:nowrap;';
      label.appendChild(timeSpan);
    }
  }

  if (task.projectName) {
    const projectMeta = document.createElement('span');
    projectMeta.className = 'task-project-meta';
    projectMeta.textContent = ` em ${task.projectName}`;
    label.appendChild(projectMeta);
  }

  const trackedTimeMs = getTaskTimerTotalMs(task);
  if (trackedTimeMs > 0 || task.timerStartedAt) {
    const timerMeta = document.createElement('span');
    timerMeta.className = `task-timer-meta${task.timerStartedAt ? ' is-running' : ''}`;
    timerMeta.textContent = ` · ${formatDurationClock(trackedTimeMs)}`;
    timerMeta.dataset.liveTimer = '1';
    timerMeta.dataset.sourceDate = actionDateStr;
    timerMeta.dataset.sourcePeriod = actionPeriod;
    timerMeta.dataset.sourceIndex = String(actionIndex);
    label.appendChild(timerMeta);
  }

  el.appendChild(label);
  if (collapseBtn) {
    collapseBtn.style.marginLeft = 'auto';
    el.appendChild(collapseBtn);
  }

  // Drag Events
  el.ondragstart = handleDragStart;
  el.ondragend = handleDragEnd;

  container.appendChild(el);
  return container;
}

function createDropZone(day, dateStr, period, index) {
  const dz = document.createElement('div');
  dz.className = 'task-drop-zone';
  dz.dataset.day = day;
  dz.dataset.date = dateStr;
  dz.dataset.period = period;
  dz.dataset.insertAt = index;

  dz.ondragover = (e) => {
    e.preventDefault();
    dz.classList.add('show');

    const rect = dz.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;

    if (offsetX > 40) {
      dz.style.marginLeft = '28px';
      dz.dataset.indentIntent = 'true';
      dz.dataset.outdentIntent = 'false';
      dz.style.borderLeft = '2px solid rgba(255,255,255,0.2)';
      dz.style.paddingLeft = '8px';
    } else if (offsetX < 10) {
      dz.style.marginLeft = '0px';
      dz.dataset.outdentIntent = 'true';
      dz.dataset.indentIntent = 'false';
      dz.style.borderLeft = 'none';
      dz.style.paddingLeft = '0px';
    } else {
      dz.style.marginLeft = '0px';
      dz.dataset.indentIntent = 'false';
      dz.dataset.outdentIntent = 'false';
      dz.style.borderLeft = 'none';
      dz.style.paddingLeft = '0px';
    }
  };
  dz.ondragleave = () => {
    dz.classList.remove('show');
    dz.style.marginLeft = '0px';
    dz.style.borderLeft = 'none';
    dz.style.paddingLeft = '0px';
  };
  dz.ondrop = (e) => handleDropZoneDrop(e, dz);
  return dz;
}

// --- Editing Logic ---

function startEditing(label, task, taskDiv) {
  if (currentEditingTask) finishEditing();
  currentEditingTask = { label, task, original: task.text };

  label.contentEditable = true;
  label.focus();
  taskDiv.draggable = false;

  // Select all text
  const range = document.createRange();
  range.selectNodeContents(label);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  label.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishEditing();
    }
    if (e.key === 'Escape') {
      label.textContent = currentEditingTask.original;
      finishEditing();
    }
    // Delete ou Backspace em tarefa vazia = deletar a tarefa
    if ((e.key === 'Backspace' || e.key === 'Delete') && label.textContent.trim() === '') {
      e.preventDefault();
      label.textContent = ''; // Garantir que está vazio
      finishEditing(); // Vai deletar a tarefa automaticamente
    }
    // TAB para indent (estilo Notion)
    if (e.key === 'Tab') {
      e.preventDefault();
      const taskItem = label.closest('.task-item');
      const currentIndent = parseInt(task.indent || 0);

      if (e.shiftKey) {
        // Shift+Tab = desindentar
        if (currentIndent > 0) {
          task.indent = currentIndent - 1;
          taskItem.style.paddingLeft = `${task.indent * 24} px`;
        }
      } else {
        // Tab = indentar
        if (currentIndent < 3) {
          // Máximo 3 níveis
          task.indent = currentIndent + 1;
          taskItem.style.paddingLeft = `${task.indent * 24} px`;
        }
      }

      saveToLocalStorage();
    }
  };
  label.onblur = finishEditing;
}

async function finishEditing() {
  if (!currentEditingTask) return;
  const { label, task } = currentEditingTask;
  const newText = label.textContent.trim();

  // Se a tarefa ficou vazia, deletar
  if (!newText || newText === '') {
    const taskElement = label.closest('.task-item');
    const dateStr = taskElement.dataset.date;
    const period = taskElement.dataset.period;
    const index = parseInt(taskElement.dataset.index);

    if (allTasksData[dateStr] && allTasksData[dateStr][period]) {
      const taskToDelete = allTasksData[dateStr][period][index] || task;

      // OPTIMISTIC DELETE: splice first, render, then fire Supabase in background
      const localIdx = allTasksData[dateStr][period].findIndex(
        (t) =>
          (taskToDelete.supabaseId && t.supabaseId === taskToDelete.supabaseId) ||
          t.text === taskToDelete.text
      );
      if (localIdx >= 0) allTasksData[dateStr][period].splice(localIdx, 1);

      if (allTasksData[dateStr][period].length === 0) delete allTasksData[dateStr][period];
      if (Object.keys(allTasksData[dateStr] || {}).length === 0) delete allTasksData[dateStr];

      localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
      currentEditingTask = null;
      renderView();

      // Fire backend DELETE non-blocking
      deleteTaskFromSupabase(taskToDelete, dateStr, period).catch((err) =>
        console.error('[Delete/finishEditing] Background sync error:', err)
      );
      return;
    }

    currentEditingTask = null;
    renderView();
    return;
  }

  // Tarefa tem texto, salvar normalmente
  task.text = newText;
  label.contentEditable = false;
  label.closest('.task-item').draggable = true;

  // Remover placeholder se tinha
  if (label.hasAttribute('data-placeholder')) {
    label.removeAttribute('data-placeholder');
    label.style.color = '';
  }

  saveToLocalStorage();
  currentEditingTask = null;
}

function showTaskInput(btn, day, period) {
  const input = document.createElement('input');
  input.className = 'task-input';
  input.placeholder = 'Nova tarefa...';
  btn.replaceWith(input);
  input.focus();

  const save = () => {
    if (input.value.trim()) {
      if (!weekData[day][period]) weekData[day][period] = [];
      weekData[day][period].push({
        text: input.value.trim(),
        completed: false,
        color: 'default',
        isHabit: false
      });
      saveToLocalStorage();
    }
    renderView();
  };

  input.onkeydown = (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') renderView();
  };
  input.onblur = () => setTimeout(save, 100);
}

// --- Drag & Drop Handlers ---

function handleDragStart(e) {
  const period = this.dataset.period;
  const dateStr = this.dataset.date;
  const index = parseInt(this.dataset.index);
  const routineKey = this.dataset.routineKey || null;

  if (period === 'Rotina' || routineKey) {
    draggedTask = {
      day: this.dataset.day,
      dateStr,
      period,
      index,
      routineKey,
      isRoutineDrag: true,
      task: { text: this.querySelector('.task-content-span')?.textContent || '' }
    };

    document.body.classList.add('dragging-active');
    setTimeout(() => this.classList.add('opacity-50'), 0);
    return;
  }

  // Usar allTasksData para buscar a tarefa
  const dayData = allTasksData[dateStr] || {};
  const task = (dayData[period] || [])[index];
  if (!task) {
    e.preventDefault();
    return;
  }

  draggedTask = {
    day: this.dataset.day,
    dateStr: dateStr,
    period: period,
    index: index,
    isRoutineDrag: false,
    task: task
  };

  document.body.classList.add('dragging-active');
  setTimeout(() => this.classList.add('opacity-50'), 0);
}

function handleDragEnd(e) {
  document.body.classList.remove('dragging-active');
  this.classList.remove('opacity-50');
  document.querySelectorAll('.day-column').forEach((c) => c.classList.remove('drag-over'));
}

function handleDragOver(e) {
  e.preventDefault();
}

function handleDropZoneDrop(e, dz) {
  e.stopPropagation();
  dz.classList.remove('show');
  if (!draggedTask) return;

  const indentIntent = dz.dataset.indentIntent === 'true';
  const outdentIntent = dz.dataset.outdentIntent === 'true';

  const targetDateStr = dz.dataset.date;
  const targetPeriod = dz.dataset.period;
  let insertAt = parseInt(dz.dataset.insertAt);

  const sourceDateStr = draggedTask.dateStr;
  const sourcePeriod = draggedTask.period;
  const sourceIndex = draggedTask.index;

  if (draggedTask.isRoutineDrag) {
    if (targetPeriod !== 'Rotina') {
      draggedTask = null;
      renderView();
      return;
    }

    const routineKey = draggedTask.routineKey || getRoutineKey(draggedTask.task);
    const movedOnTarget = reorderRoutineTasksForDate(targetDateStr, routineKey, insertAt);
    if (!movedOnTarget) {
      reorderRoutineTasksForDate(sourceDateStr, routineKey, insertAt);
    }

    draggedTask = null;
    renderView();
    return;
  }

  const moveResult = moveTaskSubtree({
    sourceDateStr,
    sourcePeriod,
    sourceIndex,
    targetDateStr,
    targetPeriod,
    insertAt,
    indentIntent,
    outdentIntent
  });

  if (moveResult.moved) {
    saveToLocalStorage();
    (async () => {
      for (const d of moveResult.datesToSync || []) await syncDateToSupabase(d);
    })();
  }

  renderView();
  draggedTask = null;
}

// Sincroniza todas as tarefas de uma data via Upsert seguro para preservar parent_id
async function syncDateToSupabase(dateStr) {
  let syncUser = currentUser;
  if (!syncUser) {
    try {
      const result = await supabaseClient.auth.getSession();
      const session = result && result.data ? result.data.session : null;
      if (session && session.user) {
        currentUser = session.user;
        syncUser = session.user;
      }
    } catch (err) {
      console.error('[SyncDate] Falha ao recuperar sessao:', err);
    }
  }

  if (!syncUser) {
    if (typeof scheduleUnsyncedTasksSync === 'function') {
      scheduleUnsyncedTasksSync(600);
    }
    return;
  }
  markLocalSupabaseMutation(2400);
  _isSyncingDate = true;

  try {
    const periods = allTasksData[dateStr] || {};
    const updates = [];
    const inserts = [];

    const { data: remoteRows, error: remoteError } = await supabaseClient
      .from('tasks')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('day', dateStr);

    if (remoteError) {
      throw remoteError;
    }

    Object.entries(periods).forEach(([period, tasks]) => {
      if (!Array.isArray(tasks)) return;

      tasks.forEach((task, index) => {
        if (!task.text || task.text.trim() === '') return;
        if (task.isWeeklyRecurring || task.isRoutine || task.isRecurring) return;

        const payload = {
          user_id: syncUser.id,
          day: dateStr,
          period,
          text: task.text,
          completed: task.completed || false,
          color: task.color || 'default',
          type: task.type || 'OPERATIONAL',
          priority: task.priority || null,
          parent_id: task.parent_id || null,
          project_id: task.projectId || null,
          project_name: task.projectName || null,
          position: typeof task.position === 'number' ? task.position : index,
          is_habit: task.isHabit || false,
          created_at: task.createdAt || undefined,
          completed_at: task.completed ? task.completedAt || undefined : null,
          timer_total_ms: Math.max(0, Number(task.timerTotalMs || 0) || 0),
          timer_started_at: task.timerStartedAt || null,
          timer_last_stopped_at: task.timerLastStoppedAt || null,
          timer_sessions_count: Math.max(0, Math.floor(Number(task.timerSessionsCount || 0) || 0)),
          updated_at: task.updatedAt || new Date().toISOString()
        };

        if (task.supabaseId && task.supabaseId.indexOf('-') > -1) {
          payload.id = task.supabaseId;
          updates.push(payload);
        } else {
          inserts.push({ taskRef: task, payload });
        }
      });
    });

    if (updates.length > 0) {
      const { data, error } = await supabaseClient
        .from('tasks')
        .upsert(updates, { onConflict: 'id' })
        .select('id, updated_at');

      if (error) {
        throw error;
      }

      if (Array.isArray(data)) {
        const updatedById = new Map(data.map((row) => [row.id, row.updated_at || null]));
        Object.values(periods).forEach((tasks) => {
          if (!Array.isArray(tasks)) return;
          tasks.forEach((task) => {
            if (!task || !task.supabaseId) return;
            if (updatedById.has(task.supabaseId)) {
              task.updatedAt = updatedById.get(task.supabaseId) || task.updatedAt;
              task._syncPending = false;
            }
          });
        });
      }
    }

    if (inserts.length > 0) {
      const payloadsToInsert = inserts.map((i) => i.payload);
      const { data, error } = await supabaseClient.from('tasks').insert(payloadsToInsert).select();

      if (error) {
        throw error;
      }

      if (Array.isArray(data) && data.length > 0) {
        const usedLocalIdx = new Set();

        data.forEach((row) => {
          const rowPos = typeof row.position === 'number' ? row.position : null;
          const localIdx = inserts.findIndex((item, idx) => {
            if (usedLocalIdx.has(idx)) return false;

            const sameParent = (item.payload.parent_id || null) === (row.parent_id || null);
            const samePosition = rowPos === null || item.payload.position === rowPos;

            return (
              item.payload.text === row.text &&
              item.payload.period === row.period &&
              sameParent &&
              samePosition
            );
          });

          if (localIdx >= 0) {
            inserts[localIdx].taskRef.supabaseId = row.id;
            inserts[localIdx].taskRef.updatedAt = row.updated_at || inserts[localIdx].taskRef.updatedAt;
            inserts[localIdx].taskRef._syncPending = false;
            usedLocalIdx.add(localIdx);
          }
        });
      }
    }

    const localIds = new Set();
    Object.values(periods).forEach((tasks) => {
      if (!Array.isArray(tasks)) return;

      tasks.forEach((task) => {
        if (!task || !task.supabaseId || task.supabaseId.indexOf('-') === -1) return;
        localIds.add(task.supabaseId);
      });
    });

    const staleIds = (remoteRows || [])
      .map((row) => row.id)
      .filter((id) => id && !localIds.has(id));

    if (staleIds.length > 0) {
      await supabaseClient.from('tasks').delete().in('id', staleIds);
    }

    localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
  } catch (e) {
    console.error('Error syncing date:', e);
    if (typeof scheduleUnsyncedTasksSync === 'function') {
      scheduleUnsyncedTasksSync(1500);
    }
  } finally {
    _isSyncingDate = false;
  }
}
// --- Menus ---
function showEditToolbar(e, task, label) {
  const toolbar = document.getElementById('editToolbar');
  toolbar.style.left = e.pageX + 'px';
  toolbar.style.top = e.pageY + 'px';
  toolbar.classList.add('show');

  // Setup buttons (simplified)
  toolbar.querySelector('[data-action="color"]').onclick = (ev) => {
    ev.stopPropagation();
    showColorMenu(ev, task, label);
  };
  toolbar.querySelector('[data-action="habit"]').onclick = () => {
    task.isHabit = !task.isHabit;

    if (task.isHabit) {
      const alreadyInRecurring = allRecurringTasks.some((t) => t.text === task.text);
      if (!alreadyInRecurring) {
        allRecurringTasks.push({
          text: task.text,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          priority: task.priority || 'none',
          color: task.color || 'default',
          isHabit: true,
          createdAt: new Date().toISOString()
        });
      }
      alert(`"${task.text}" marcado como hábito e adicionado à Rotina!`);
    } else {
      const recurringIdx2 = allRecurringTasks.findIndex((t) => t.text === task.text);
      if (recurringIdx2 !== -1) allRecurringTasks.splice(recurringIdx2, 1);
      alert(`"${task.text}" removido dos hábitos e da Rotina.`);
    }

    saveToLocalStorage();
    syncRecurringTasksToSupabase();
    renderView();
    toolbar.classList.remove('show');
  };
  toolbar.querySelector('[data-action="delete"]').onclick = async () => {
    // Delete logic
    const taskElement = label.closest('.task-item');
    const dateStr = taskElement.dataset.date;
    const period = taskElement.dataset.period;
    const index = parseInt(taskElement.dataset.index);

    // Buscar a tarefa
    if (!allTasksData[dateStr] || !allTasksData[dateStr][period]) return;
    const taskToDelete = allTasksData[dateStr][period][index] || task;

    // OPTIMISTIC DELETE: remove from local state and render immediately,
    // then fire Supabase DELETE in the background (non-blocking)
    const localIdx = allTasksData[dateStr][period].findIndex(
      (t) =>
        (taskToDelete.supabaseId && t.supabaseId === taskToDelete.supabaseId) ||
        t.text === taskToDelete.text
    );
    if (localIdx >= 0) allTasksData[dateStr][period].splice(localIdx, 1);

    if (allTasksData[dateStr][period].length === 0) delete allTasksData[dateStr][period];
    if (Object.keys(allTasksData[dateStr] || {}).length === 0) delete allTasksData[dateStr];

    localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
    renderView();

    deleteTaskFromSupabase(taskToDelete, dateStr, period).catch((err) =>
      console.error('[Delete/editToolbar] Background sync error:', err)
    );
  };
}

function showColorMenu(e, task, label) {
  const menu = document.getElementById('colorMenu');
  const rect = document.getElementById('editToolbar').getBoundingClientRect();
  // Fix positioning (scroll aware)
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
  const scrollTop = window.scrollY || document.documentElement.scrollTop;

  menu.style.left = rect.left + scrollLeft + 'px';
  menu.style.top = rect.bottom + scrollTop + 8 + 'px';
  menu.classList.add('show');

  menu.querySelectorAll('.color-swatch').forEach((s) => {
    s.onclick = () => {
      const color = s.dataset.color;
      task.color = color;
      task.updatedAt = new Date().toISOString();
      task._syncPending = true;
      saveToLocalStorage();
      renderView();
      const taskElement = label.closest('.task-item');
      const dateStr = taskElement && taskElement.dataset ? taskElement.dataset.date : null;
      const period = taskElement && taskElement.dataset ? taskElement.dataset.period : null;
      if (dateStr && period && period !== 'Rotina') {
        syncDateToSupabase(dateStr).catch((err) =>
          console.error('[ColorMenu] Background sync error:', err)
        );
      }
    };
  });
}

// --- Init ---
document.addEventListener('click', (e) => {
  if (!e.target.closest('#editToolbar') && !e.target.closest('#colorMenu')) {
    document.getElementById('editToolbar').classList.remove('show');
    document.getElementById('colorMenu').classList.remove('show');
  }
  const userDropdown = document.getElementById('userDropdown');
  if (userDropdown && !e.target.closest('#userDropdown') && !e.target.closest('#btnUser')) {
    userDropdown.classList.remove('show');
  }
});

const btnUserEl = document.getElementById('btnUser');
if (btnUserEl) {
  btnUserEl.onclick = () => {
    const drop = document.getElementById('userDropdown');
    if (!drop) return;
    drop.style.display = drop.style.display === 'flex' ? 'none' : 'flex';
  };
}

const btnLogoutEl = document.getElementById('btnLogout');
if (btnLogoutEl) {
  btnLogoutEl.onclick = signOut;
}

// Event listeners para opÇÕES do quick add menu
document.querySelectorAll('.quick-add-option').forEach((option) => {
  option.onclick = async () => {
    const type = option.dataset.type;
    document.getElementById('quickAddMenu').style.display = 'none';

    if (type === 'routine') {
      const text = prompt('Digite a tarefa de rotina diária:');
      if (text && text.trim()) {
        allRecurringTasks.push({
          text: text.trim(),
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          priority: null,
          color: 'default',
          type: 'OPERATIONAL',
          isHabit: true,
          createdAt: new Date().toISOString()
        });
        saveToLocalStorage();
        syncRecurringTasksToSupabase();
        renderView();
      }
    } else if (type === 'weekly') {
      showWeeklyRecurrenceDialog();
    } else if (type === 'custom') {
      // Abre um prompt para tarefa customizada (ex: adicionar em data específica)
      const text = prompt('Digite a tarefa:');
      if (text && text.trim()) {
        const dateStr = localDateStr();
        const period = 'Tarefas';

        if (!allTasksData[dateStr]) allTasksData[dateStr] = {};
        if (!allTasksData[dateStr][period]) allTasksData[dateStr][period] = [];

        const currentList = allTasksData[dateStr]?.[period] || [];
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

        if (!allTasksData[dateStr]) allTasksData[dateStr] = {};
        if (!allTasksData[dateStr][period]) allTasksData[dateStr][period] = [];
        allTasksData[dateStr][period].push(newTask);
        saveToLocalStorage();
        renderView();
        syncTaskToSupabase(dateStr, period, newTask).then((r) => {
          if (r.success) saveToLocalStorage();
        });
      }
    }
  };
});

// Event listeners do modal de tarefa semanal
if (typeof bindWeeklyDayButtons === 'function') {
  bindWeeklyDayButtons();
}

// Listeners do modal semanal — só vinculam se os elementos existirem no HTML
// (podem ser gerados dinamicamente via renderSettingsView, portanto usamos delegação)
document.addEventListener('keydown', (e) => {
  const weeklyModal = document.getElementById('weeklyModal');
  if (!weeklyModal || !weeklyModal.classList.contains('show')) return;
  const weeklyTaskText = document.getElementById('weeklyTaskText');
  if (!weeklyTaskText) return;
  if (document.activeElement === weeklyTaskText) {
    if (e.key === 'Enter') {
      const btnSave = document.getElementById('btnSaveWeekly');
      if (btnSave) btnSave.click();
    }
    if (e.key === 'Escape') {
      const btnCancel = document.getElementById('btnCancelWeekly');
      if (btnCancel) btnCancel.click();
    }
  }
});

// Handlers de export/import/clear estão dentro de renderSettingsView()

// Normalizar tarefas (corrigir text: undefined e remover recorrentes/rotina persistidas)
window.handleTaskIndent = function (dateStr, period, index, shiftKey) {
  const list = allTasksData[dateStr]?.[period] || [];
  if (list.length === 0) return;

  const visualList = unifiedTaskSort(list.map((task, originalIndex) => ({ task, originalIndex })));
  const visualIndex = visualList.findIndex((entry) => entry.originalIndex === index);
  if (visualIndex < 0) return;

  const currentTask = visualList[visualIndex].task;

  if (shiftKey) {
    if (!currentTask.parent_id) return;
    currentTask.parent_id = null;
  } else {
    if (visualIndex === 0) return;
    const prevTask = visualList[visualIndex - 1].task;
    if (prevTask.depth >= 2) return;

    const possibleParentId = prevTask.supabaseId || prevTask.text;
    if (prevTask.parent_id === possibleParentId) return;
    currentTask.parent_id = possibleParentId;
  }

  saveToLocalStorage();
  syncTaskToSupabase(dateStr, period, currentTask);
  renderView();
};
