// task tree and sorting helpers moved from js/app.js

function getTaskTreeId(task) {
  if (!task) return '';
  return String(task.supabaseId || task.text || '').trim();
}

function buildTaskChildrenMap(list) {
  const safeList = Array.isArray(list) ? list : [];
  const orderMap = new Map();
  const childrenMap = new Map();

  safeList.forEach((task, index) => {
    const id = getTaskTreeId(task);
    if (id) orderMap.set(id, index);
  });

  safeList.forEach((task) => {
    if (!task || !task.parent_id || !orderMap.has(task.parent_id)) return;
    if (!childrenMap.has(task.parent_id)) childrenMap.set(task.parent_id, []);
    childrenMap.get(task.parent_id).push(task);
  });

  childrenMap.forEach((children) => {
    children.sort((a, b) => {
      const orderA = orderMap.get(getTaskTreeId(a));
      const orderB = orderMap.get(getTaskTreeId(b));
      return (orderA ?? Number.MAX_SAFE_INTEGER) - (orderB ?? Number.MAX_SAFE_INTEGER);
    });
  });

  return childrenMap;
}

function collectTaskSubtree(list, rootTask) {
  if (!Array.isArray(list) || !rootTask) return [];

  const childrenMap = buildTaskChildrenMap(list);
  const subtree = [];
  const visited = new Set();

  const visit = (task) => {
    if (!task || visited.has(task)) return;
    visited.add(task);
    subtree.push(task);

    const taskId = getTaskTreeId(task);
    if (!taskId || !childrenMap.has(taskId)) return;
    childrenMap.get(taskId).forEach((child) => visit(child));
  };

  visit(rootTask);
  return subtree;
}

function getTaskSubtreeBoundaryIndex(list, rootTask) {
  if (!Array.isArray(list) || !rootTask) return -1;
  const subtreeTasks = collectTaskSubtree(list, rootTask);
  if (subtreeTasks.length === 0) return -1;

  const subtreeSet = new Set(subtreeTasks);
  let lastIndex = -1;
  list.forEach((task, index) => {
    if (subtreeSet.has(task)) lastIndex = index;
  });
  return lastIndex;
}

function moveTaskSubtree({
  sourceDateStr,
  sourcePeriod,
  sourceIndex,
  targetDateStr,
  targetPeriod,
  insertAt,
  indentIntent = false,
  outdentIntent = false,
  forcedParentTask = null
}) {
  if (!allTasksData[sourceDateStr]) allTasksData[sourceDateStr] = {};
  if (!allTasksData[targetDateStr]) allTasksData[targetDateStr] = {};
  if (!allTasksData[sourceDateStr][sourcePeriod]) allTasksData[sourceDateStr][sourcePeriod] = [];
  if (!allTasksData[targetDateStr][targetPeriod]) allTasksData[targetDateStr][targetPeriod] = [];

  const sourceList = allTasksData[sourceDateStr][sourcePeriod];
  const rootTask = sourceList[sourceIndex];
  if (!rootTask) return { moved: false };

  const subtreeTasks = collectTaskSubtree(sourceList, rootTask);
  if (subtreeTasks.length === 0) return { moved: false };

  const subtreeSet = new Set(subtreeTasks);
  const subtreeIndexes = [];
  sourceList.forEach((task, index) => {
    if (subtreeSet.has(task)) subtreeIndexes.push(index);
  });

  if (subtreeIndexes.length === 0) return { moved: false };

  const movingWithinSameList = sourceDateStr === targetDateStr && sourcePeriod === targetPeriod;
  const firstSubtreeIndex = subtreeIndexes[0];
  const lastSubtreeIndex = subtreeIndexes[subtreeIndexes.length - 1];

  const hasReparentIntent = Boolean(forcedParentTask) || indentIntent || outdentIntent;
  if (
    movingWithinSameList &&
    !hasReparentIntent &&
    insertAt >= firstSubtreeIndex &&
    insertAt <= lastSubtreeIndex + 1
  ) {
    return { moved: false, noOp: true };
  }

  let normalizedInsertAt = Number.isFinite(insertAt) ? insertAt : sourceList.length;
  if (movingWithinSameList) {
    const removedBeforeInsert = subtreeIndexes.filter((index) => index < normalizedInsertAt).length;
    normalizedInsertAt -= removedBeforeInsert;
  }

  const sourceRemainder = sourceList.filter((task) => !subtreeSet.has(task));
  allTasksData[sourceDateStr][sourcePeriod] = sourceRemainder;

  const destinationList = movingWithinSameList ? sourceRemainder : allTasksData[targetDateStr][targetPeriod];
  normalizedInsertAt = Math.max(0, Math.min(normalizedInsertAt, destinationList.length));

  subtreeTasks.forEach((task) => {
    task.isRoutine = targetPeriod === 'Rotina';
  });

  destinationList.splice(normalizedInsertAt, 0, ...subtreeTasks);

  const movedRootTask = subtreeTasks[0];
  if (forcedParentTask) {
    movedRootTask.parent_id = getTaskTreeId(forcedParentTask) || null;
    subtreeTasks.forEach((task) => {
      task.projectId = forcedParentTask.projectId || null;
      task.projectName = forcedParentTask.projectName || '';
    });
  } else if (indentIntent && normalizedInsertAt > 0) {
    const prevTask = destinationList[normalizedInsertAt - 1];
    if (prevTask && !subtreeSet.has(prevTask) && (prevTask.depth || 0) < 2) {
      movedRootTask.parent_id = getTaskTreeId(prevTask);
      if (prevTask.projectId) {
        subtreeTasks.forEach((task) => {
          task.projectId = prevTask.projectId || null;
          task.projectName = prevTask.projectName || '';
        });
      }
    }
  } else if (outdentIntent) {
    movedRootTask.parent_id = null;
  } else if (
    movedRootTask.parent_id &&
    !destinationList.some((task) => getTaskTreeId(task) === movedRootTask.parent_id)
  ) {
    movedRootTask.parent_id = null;
  }

  destinationList.forEach((task, index) => {
    task.position = index;
  });

  if (!movingWithinSameList) {
    sourceRemainder.forEach((task, index) => {
      task.position = index;
    });
  }

  if (allTasksData[sourceDateStr][sourcePeriod].length === 0) {
    delete allTasksData[sourceDateStr][sourcePeriod];
  }

  return {
    moved: true,
    datesToSync: [...new Set([sourceDateStr, targetDateStr])]
  };
}

function persistCollapsedTaskGroups() {
  localStorage.setItem('flowlyCollapsedTaskGroups', JSON.stringify(collapsedTaskGroups || {}));
}

function isTaskGroupCollapsed(task, collapseKeyOverride) {
  const id = collapseKeyOverride || getTaskTreeId(task);
  return Boolean(id && collapsedTaskGroups && collapsedTaskGroups[id] === true);
}

function getTaskChildrenCount(dateStr, period, task) {
  const list = allTasksData?.[dateStr]?.[period] || [];
  const parentId = getTaskTreeId(task);
  if (!parentId) return 0;
  return list.filter((item) => item && item.parent_id === parentId).length;
}

window.toggleTaskTreeCollapse = function (task, collapseKeyOverride) {
  const id = collapseKeyOverride || getTaskTreeId(task);
  if (!id) return;
  collapsedTaskGroups[id] = !collapsedTaskGroups[id];
  if (!collapsedTaskGroups[id]) delete collapsedTaskGroups[id];
  persistCollapsedTaskGroups();
  renderView();
};

window.toggleTaskChildrenCollapse = function (dateStr, period, index) {
  const task = allTasksData?.[dateStr]?.[period]?.[index];
  if (!task) return;
  window.toggleTaskTreeCollapse(task);
};

function isProjectSubtasksCollapsed(task) {
  if (currentView !== 'projects' || !task || !task.projectId) return false;
  const project = findProjectById(task.projectId);
  return project ? project.collapseSubtasks !== false : false;
}

function unifiedTaskSort(taskList) {
  if (!taskList || taskList.length === 0) return [];

  const realTaskIds = new Set();
  taskList.forEach((item) => {
    if (!item || !item.task || item.task.isProjectMirror) return;
    const taskId = getTaskTreeId(item.task);
    if (taskId) realTaskIds.add(taskId);
  });

  const uniqueTaskList = [];
  const seenRenderKeys = new Set();
  const getRenderTreeKey = (item) => {
    if (!item || !item.task) return '';
    const taskId = getTaskTreeId(item.task);
    if (!taskId) return '';
    if (item.task.isProjectMirror) {
      return `mirror:${item.dateStr || ''}:${taskId}`;
    }
    return `task:${taskId}`;
  };
  const getRenderParentKey = (item) => {
    if (!item || !item.task || !item.task.parent_id) return '';
    if (item.task.isProjectMirror) {
      return `mirror:${item.dateStr || ''}:${String(item.task.parent_id).trim()}`;
    }
    return `task:${String(item.task.parent_id).trim()}`;
  };

  taskList.forEach((item) => {
    if (!item || !item.task) return;
    const task = item.task;
    if (task.isProjectMirror) {
      const mirrorSourceId = String(task.mirrorSourceTaskId || getTaskTreeId(task) || '').trim();
      if (mirrorSourceId && realTaskIds.has(mirrorSourceId)) return;
    }
    const renderKey = task.isProjectMirror
      ? `mirror:${task.mirrorSourceDateStr || item.dateStr}:${task.mirrorSourcePeriod || item.period}:${task.mirrorSourceIndex ?? item.originalIndex}`
      : `task:${task.supabaseId || ''}:${item.dateStr || ''}:${item.period || ''}:${String(task.text || '').trim().toLowerCase()}:${task.parent_id || ''}`;
    if (seenRenderKeys.has(renderKey)) return;
    seenRenderKeys.add(renderKey);
    uniqueTaskList.push(item);
  });

  const itemMap = new Map();
  const childrenMap = new Map();

  uniqueTaskList.forEach((item) => {
    if (!item.task) return;
    if (typeof item.task.position !== 'number') item.task.position = item.originalIndex || 0;
    const id = getRenderTreeKey(item);
    if (!id) return;
    itemMap.set(id, item);
  });

  const roots = [];

  uniqueTaskList.forEach((item) => {
    if (!item.task) return;
    const pId = getRenderParentKey(item);
    if (pId && itemMap.has(pId)) {
      if (!childrenMap.has(pId)) childrenMap.set(pId, []);
      childrenMap.get(pId).push(item);
    } else {
      roots.push(item);
    }
  });

  const sortFn = (a, b) => {
    const tA = a.task;
    const tB = b.task;

    // 1. Rotinas sempre no topo absoluto
    const isRoutineA = tA.isRoutine || tA.isRecurring || a.period === 'Rotina';
    const isRoutineB = tB.isRoutine || tB.isRecurring || b.period === 'Rotina';
    if (isRoutineA !== isRoutineB) return isRoutineA ? -1 : 1;
    if (isRoutineA && isRoutineB) {
      // Dentro de rotinas: concluídas primeiro, depois por ordem original
      if (tA.completed !== tB.completed) return tA.completed ? -1 : 1;
      return (a.originalIndex || 0) - (b.originalIndex || 0);
    }

    const isProjectAnchorA = false;
    const isProjectAnchorB = false;
    if (isProjectAnchorA !== isProjectAnchorB) return isProjectAnchorA ? -1 : 1;
    if (isProjectAnchorA && isProjectAnchorB) {
      const scheduleA = String(tA.projectScheduleText || '');
      const scheduleB = String(tB.projectScheduleText || '');
      const scheduleCmp = scheduleA.localeCompare(scheduleB);
      if (scheduleCmp !== 0) return scheduleCmp;
      return String(tA.text || '').localeCompare(String(tB.text || ''));
    }

    // 2. Concluídas em cima, pendentes embaixo
    if (tA.completed !== tB.completed) return tA.completed ? -1 : 1;

    // 3. Dentro de concluídas: ordenar por completedAt (mais antiga primeiro = ordem de conclusão)
    if (tA.completed && tB.completed) {
      const timeA = tA.completedAt ? new Date(tA.completedAt).getTime() : 0;
      const timeB = tB.completedAt ? new Date(tB.completedAt).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB; // mais antiga primeiro
    }

    // 4. Dentro de pendentes: por position, depois originalIndex
    if (tA.position !== tB.position && (tA.position !== 0 || tB.position !== 0)) {
      return tA.position - tB.position;
    }

    return (a.originalIndex || 0) - (b.originalIndex || 0);
  };

  roots.sort(sortFn);

  const flattened = [];

  const traverse = (item, depth) => {
    if (depth > 2) depth = 2; // Profundidade máxima inicial: 2 níveis
    item.task.depth = depth;
    flattened.push(item);

    const id = getRenderTreeKey(item);
    const mirrorCollapseKey =
      item.task && item.task.isProjectMirror ? `${item.dateStr || ''}:${getTaskTreeId(item.task)}` : null;
    const shouldCollapseChildren =
      (mirrorCollapseKey
        ? isTaskGroupCollapsed(item.task, mirrorCollapseKey)
        : isTaskGroupCollapsed(item.task)) || isProjectSubtasksCollapsed(item.task);
    if (childrenMap.has(id) && !shouldCollapseChildren) {
      const children = childrenMap.get(id);
      children.sort(sortFn);
      children.forEach((child) => traverse(child, depth + 1));
    }
  };

  roots.forEach((r) => traverse(r, 0));

  return flattened;
}

// Nova função global para toggle com reordenação
window.toggleTaskStatus = function (dateStr, period, index, isChecked, element) {
  // Se for Rotina/Hábito (index -1), usa a lógica específica de hábitos
  if (period === 'Rotina' || index === -1) {
    const taskText = element.querySelector('.task-label').textContent; // Hacky but works for generated routine items
    // Melhor pegar do dataset ou passar o objeto task direto, mas createTaskElement fecha o scope.
    // Vamos usar o markHabitCompleted direto no checkbox.onchange para rotinas,
    // e esta função APENAS para regular tasks.
    return;
  }

  const list = allTasksData[dateStr]?.[period];
  if (!list || !list[index]) return;

  const task = list[index];
  if (!task.createdAt) task.createdAt = new Date().toISOString();
  task.updatedAt = new Date().toISOString();

  // 1. Atualizar Estado
  task.completed = isChecked;
  task._syncPending = true;

  if (isChecked) {
    task.completedAt = new Date().toISOString();

    // 2. Mover: Logo abaixo da última tarefa já concluída
    // Como estamos na lista crua (sem separação de Routine),
    // precisamos achar onde termina o bloco de "Concluídos" dentro dessa lista.
    // Mas espere, unifiedSort mistura períodos se renderWeek juntasse períodos.
    // Mas allTasksData[date][period] é a fonte da verdade.
    // Se "period" é unico (ex: 'Tarefas'), a lista é autocontida.

    // Remover da posição atual
    list.splice(index, 1);

    // Achar nova posição:
    // Queremos inserir APÓS a última concluída.
    // Percorrer e achar índice.
    let insertIdx = 0;
    let foundCompleted = false;
    for (let i = 0; i < list.length; i++) {
      if (list[i].completed) {
        insertIdx = i + 1;
        foundCompleted = true;
      } else {
        // Se achou pendente e já passamos por completadas (ou no inicio se R->C->P),
        // Para R->C->P: Completadas vêm ANTES das Pendentes.
        // Então inserimos logo antes da primeira pendente?
        // Ou após a última concluída.
        // Se sort order é C -> P.
        // Lista ordenada: [C, C, C, P, P].
        // Task virou C. Deve ir para fim dos C.
        // InsertIdx deve ser index da primeira P.
        if (foundCompleted) break;
        // Se ainda nao achou completada, e achou pendente?
        // Se não tem completadas, insertIdx = 0.
      }
    }

    // Refinamento: Se ordenação é C -> P.
    // Inserir após a última C existente.
    // Se não houver C, inserir no topo (índice 0).
    // Mas cuidado com a ordem original das P.

    // Vamos simplificar: Inserir no final das concluídas.
    // Filtrar C e P.
    const completed = list.filter((t) => t.completed);
    const pending = list.filter((t) => !t.completed);

    // A task atual já foi removida. Adicionar em 'completed' no final.
    completed.push(task);

    // Reconstruir lista: Completed + Pending
    allTasksData[dateStr][period] = [...completed, ...pending];
  } else {
    task.completedAt = null;

    // 3. Mover: Topo das pendentes
    // Remover da posição atual
    list.splice(index, 1);

    // Separar
    const completed = list.filter((t) => t.completed);
    const pending = list.filter((t) => !t.completed);

    // Inserir no TOPO de pending
    pending.unshift(task);

    // Reconstruir: Completed + Pending
    allTasksData[dateStr][period] = [...completed, ...pending];
  }

  // Recalcular posicao de toda a lista para persistir a nova ordem corretamente
  allTasksData[dateStr][period].forEach((t, i) => {
    t.position = i;
  });

  // Salvar e sincronizar a data inteira para evitar divergencia de ordem no reload
  saveToLocalStorage();
  if (typeof syncDateToSupabase === 'function') {
    syncDateToSupabase(dateStr);
  } else if (typeof syncTaskToSupabase === 'function') {
    syncTaskToSupabase(dateStr, period, task);
  }

  // Re-renderizar TUDO para garantir consistencia visual imediata
  renderView();
};

// renderToday movido para js/views/today.js

function findFirstPendingTask(dateStr = localDateStr()) {
  const dayData = allTasksData[dateStr] || {};
  for (const [period, tasks] of Object.entries(dayData)) {
    if (!Array.isArray(tasks) || period === 'Rotina') continue;
    const index = tasks.findIndex((task) => task && !task.completed);
    if (index >= 0) {
      return { period, index, task: tasks[index] };
    }
  }
  return null;
}

function prioritizeTaskViaSexta(dateStr = localDateStr(), query = '') {
  const cleanQuery = String(query || '').trim().toLowerCase();
  if (!cleanQuery) return false;
  const dayData = allTasksData[dateStr] || {};

  for (const [period, tasks] of Object.entries(dayData)) {
    if (!Array.isArray(tasks) || tasks.length === 0) continue;
    const index = tasks.findIndex((task) => String(task.text || '').toLowerCase().includes(cleanQuery));
    if (index >= 0) {
      const [task] = tasks.splice(index, 1);
      task.completed = false;
      task.completedAt = null;
      tasks.unshift(task);
      tasks.forEach((item, idx) => {
        item.position = idx;
      });
      saveToLocalStorage();
      syncDateToSupabase(dateStr);
      renderView();
      return task;
    }
  }

  return false;
}

function createTaskViaSexta(dateStr, text, period = 'Tarefas') {
  const cleanText = String(text || '').trim();
  if (!cleanText) return false;

  const currentList = allTasksData[dateStr]?.[period] || [];
  const newTask = {
    text: cleanText,
    completed: false,
    color: 'default',
    type: 'OPERATIONAL',
    priority: null,
    parent_id: null,
    position: currentList.length,
    isHabit: false,
    supabaseId: null,
    _syncPending: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
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
  syncTaskToSupabase(dateStr, period, newTask).then((result) => {
    if (result && result.success) {
      saveToLocalStorage();
      return;
    }

    const errorText = String((result && result.errorText) || '');
    if (
      errorText &&
      !/Usuario nao autenticado para sincronizacao/i.test(errorText) &&
      !/Login necessario para sincronizar/i.test(errorText)
    ) {
      console.error('[Sexta] Sync falhou:', errorText);
    }
  });
  return true;
}

function normalizeSextaQuery(text = '') {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getSextaSearchEntries(preferredDateStr = localDateStr(), includeCompleted = true) {
  const allDates = Object.keys(allTasksData || {}).sort();
  const orderedDates = [
    preferredDateStr,
    ...allDates.filter((dateStr) => dateStr !== preferredDateStr)
  ];
  const entries = [];

  orderedDates.forEach((dateStr) => {
    const dayData = allTasksData[dateStr] || {};
    Object.entries(dayData).forEach(([period, tasks]) => {
      if (!Array.isArray(tasks) || period === 'Rotina') return;
      tasks.forEach((task, index) => {
        if (!task || !task.text) return;
        if (!includeCompleted && task.completed) return;
        entries.push({ dateStr, period, index, task });
      });
    });
  });

  return entries;
}

function findTaskEntryViaSexta(query, options = {}) {
  const normalizedQuery = normalizeSextaQuery(query);
  if (!normalizedQuery) return null;

  const preferredDateStr = options.preferredDateStr || localDateStr();
  const includeCompleted = options.includeCompleted !== false;
  const entries = getSextaSearchEntries(preferredDateStr, includeCompleted);
  const exactMatch = entries.find(
    (entry) => normalizeSextaQuery(entry.task.text) === normalizedQuery
  );
  if (exactMatch) return exactMatch;

  return (
    entries.find((entry) => normalizeSextaQuery(entry.task.text).includes(normalizedQuery)) || null
  );
}

function getRelativeDateStr(dayOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return localDateStr(date);
}

function removeTaskSubtreeFromDate(dateStr, period, rootTask, options = {}) {
  const dayData = allTasksData[dateStr];
  const list = dayData && dayData[period];
  if (!Array.isArray(list) || !rootTask) return { deleted: false, deletedTasks: [] };

  const subtreeTasks = collectTaskSubtree(list, rootTask);
  if (subtreeTasks.length === 0) return { deleted: false, deletedTasks: [] };

  if (options.queuePendingDeletes !== false && typeof window.queuePendingTaskDelete === 'function') {
    subtreeTasks.forEach((task) => {
      window.queuePendingTaskDelete(task, dateStr, period);
    });
  }

  const subtreeSet = new Set(subtreeTasks);
  const nextList = list.filter((task) => !subtreeSet.has(task));

  if (nextList.length > 0) {
    nextList.forEach((task, index) => {
      task.position = index;
    });
    allTasksData[dateStr][period] = nextList;
  } else {
    delete allTasksData[dateStr][period];
  }

  if (Object.keys(allTasksData[dateStr] || {}).length === 0) {
    delete allTasksData[dateStr];
  }

  if (typeof recordSyncEvent === 'function' && options.recordEvent !== false) {
    recordSyncEvent('queue', 'Exclusao local preparada para sincronizacao', {
      dateStr,
      period,
      count: subtreeTasks.length,
      text: String((rootTask && rootTask.text) || '')
    });
  }

  return {
    deleted: true,
    deletedTasks: subtreeTasks,
    count: subtreeTasks.length
  };
}

window.deleteTaskOptimistically = function (dateStr, period, task, options = {}) {
  const removal = removeTaskSubtreeFromDate(dateStr, period, task, options);
  if (!removal.deleted) return removal;

  saveToLocalStorage();
  if (options.render !== false) renderView();

  if (options.sync !== false && typeof syncDateToSupabase === 'function') {
    Promise.resolve(syncDateToSupabase(dateStr)).catch((err) => {
      console.error('[DeleteOptimistic] Background sync error:', err);
    });
  }

  return removal;
};

function deleteTaskViaSexta(query, preferredDateStr = localDateStr()) {
  const entry = findTaskEntryViaSexta(query, { preferredDateStr, includeCompleted: true });
  if (!entry) return null;

  const result = window.deleteTaskOptimistically(entry.dateStr, entry.period, entry.task);
  return result && result.deleted ? entry : null;
}

function completeTaskViaSexta(query, preferredDateStr = localDateStr()) {
  const entry = findTaskEntryViaSexta(query, { preferredDateStr, includeCompleted: false });
  if (!entry) return null;
  window.toggleTaskStatus(entry.dateStr, entry.period, entry.index, true, null);
  return entry;
}

function moveTaskViaSexta(query, targetDateStr, targetPeriod = 'Tarefas', preferredDateStr = localDateStr()) {
  const entry = findTaskEntryViaSexta(query, { preferredDateStr, includeCompleted: true });
  if (!entry) return null;

  const targetList = allTasksData[targetDateStr]?.[targetPeriod] || [];
  const moveResult = moveTaskSubtree({
    sourceDateStr: entry.dateStr,
    sourcePeriod: entry.period,
    sourceIndex: entry.index,
    targetDateStr,
    targetPeriod,
    insertAt: targetList.length
  });

  if (!moveResult.moved) return null;

  saveToLocalStorage();
  (async () => {
    for (const dateStr of moveResult.datesToSync || []) await syncDateToSupabase(dateStr);
  })();
  renderView();
  return entry;
}

function moveTaskToDate(dateStr, period, index, targetDateStr, targetPeriod = 'Tarefas') {
  const numericIndex = Number(index);
  if (!targetDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(targetDateStr))) return null;
  if (!allTasksData?.[dateStr]?.[period] || !allTasksData[dateStr][period][numericIndex]) return null;

  const targetList = allTasksData[targetDateStr]?.[targetPeriod] || [];
  const moveResult = moveTaskSubtree({
    sourceDateStr: dateStr,
    sourcePeriod: period,
    sourceIndex: numericIndex,
    targetDateStr,
    targetPeriod,
    insertAt: targetList.length
  });

  if (!moveResult.moved) return null;

  saveToLocalStorage();
  (async () => {
    for (const syncDate of moveResult.datesToSync || []) await syncDateToSupabase(syncDate);
  })();
  renderView();
  return moveResult;
}

window.moveTaskToDate = moveTaskToDate;

window.moveTaskUnderParent = function ({
  sourceDateStr,
  sourcePeriod,
  sourceIndex,
  parentDateStr,
  parentPeriod,
  parentIndex
}) {
  const numericSourceIndex = Number(sourceIndex);
  const numericParentIndex = Number(parentIndex);
  const sourceList = allTasksData?.[sourceDateStr]?.[sourcePeriod];
  const parentList = allTasksData?.[parentDateStr]?.[parentPeriod];
  if (!Array.isArray(sourceList) || !Array.isArray(parentList)) return null;

  const sourceTask = sourceList[numericSourceIndex];
  const parentTask = parentList[numericParentIndex];
  if (!sourceTask || !parentTask) return null;

  const sourceSubtree = collectTaskSubtree(sourceList, sourceTask);
  if (sourceSubtree.includes(parentTask)) return null;

  const parentBoundaryIndex = getTaskSubtreeBoundaryIndex(parentList, parentTask);
  if (parentBoundaryIndex < 0) return null;
  const movingWithinSameList = sourceDateStr === parentDateStr && sourcePeriod === parentPeriod;

  if (movingWithinSameList && numericSourceIndex === parentBoundaryIndex + 1) {
    sourceTask.parent_id = getTaskTreeId(parentTask) || null;
    sourceSubtree.forEach((task) => {
      task.projectId = parentTask.projectId || null;
      task.projectName = parentTask.projectName || '';
    });
    sourceList.forEach((task, index) => {
      task.position = index;
    });
    saveToLocalStorage();
    Promise.resolve(syncDateToSupabase(sourceDateStr)).catch((err) => {
      console.error('[MoveUnderParent] Background sync error:', err);
    });
    renderView();
    return { moved: true, datesToSync: [sourceDateStr], noReorder: true };
  }

  const moveResult = moveTaskSubtree({
    sourceDateStr,
    sourcePeriod,
    sourceIndex: numericSourceIndex,
    targetDateStr: parentDateStr,
    targetPeriod: parentPeriod,
    insertAt: parentBoundaryIndex + 1,
    forcedParentTask: parentTask
  });

  if (!moveResult.moved) return null;

  saveToLocalStorage();
  (async () => {
    for (const syncDate of moveResult.datesToSync || []) await syncDateToSupabase(syncDate);
  })();
  renderView();
  return moveResult;
};

window.createSubtaskForTask = function (parentTask, options = {}) {
  const targetDateStr = String(options.targetDateStr || localDateStr()).trim();
  const targetPeriod = String(options.targetPeriod || 'Tarefas').trim() || 'Tarefas';
  const text = String(options.text || '').trim();
  if (!parentTask || !text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) return null;

  if (!allTasksData[targetDateStr]) allTasksData[targetDateStr] = {};
  if (!allTasksData[targetDateStr][targetPeriod]) allTasksData[targetDateStr][targetPeriod] = [];

  const targetList = allTasksData[targetDateStr][targetPeriod];
  const newTask = {
    text,
    completed: false,
    color: parentTask.color || 'default',
    type: parentTask.type || 'OPERATIONAL',
    priority: parentTask.priority || null,
    parent_id: getTaskTreeId(parentTask) || null,
    position: targetList.length,
    isHabit: false,
    supabaseId: null,
    _syncPending: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    timerTotalMs: 0,
    timerStartedAt: null,
    timerLastStoppedAt: null,
    timerSessionsCount: 0,
    projectId: parentTask.projectId || null,
    projectName: parentTask.projectName || ''
  };

  targetList.push(newTask);
  saveToLocalStorage();
  renderView();
  if (typeof syncTaskToSupabase === 'function') {
    Promise.resolve(syncTaskToSupabase(targetDateStr, targetPeriod, newTask)).catch((err) => {
      console.error('[SubtaskCreate] Background sync error:', err);
    });
  }
  return newTask;
};
