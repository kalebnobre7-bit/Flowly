function markLocalSupabaseMutation(ms) {
  const until = Date.now() + (ms || 1800);
  const prev = Number(window._flowlySuppressRealtimeUntil || 0);
  window._flowlySuppressRealtimeUntil = Math.max(prev, until);
}

function normalizePendingDeleteKey(task, day, period) {
  return JSON.stringify({
    supabaseId:
      task && typeof task.supabaseId === 'string' && task.supabaseId.indexOf('-') > -1
        ? task.supabaseId
        : null,
    text: String((task && task.text) || '')
      .trim()
      .toLowerCase(),
    day: day || null,
    period: period || null
  });
}

function persistPendingTaskDeletes() {
  localStorage.setItem('flowlyPendingTaskDeletes', JSON.stringify(pendingTaskDeletes || []));
}

function queuePendingTaskDelete(task, day, period) {
  if (!task) return;
  if (!Array.isArray(pendingTaskDeletes)) pendingTaskDeletes = [];

  const entry = {
    supabaseId:
      typeof task.supabaseId === 'string' && task.supabaseId.indexOf('-') > -1 ? task.supabaseId : null,
    text: String(task.text || ''),
    day: day || null,
    period: period || null,
    queuedAt: new Date().toISOString()
  };
  const key = normalizePendingDeleteKey(entry, entry.day, entry.period);
  pendingTaskDeletes = pendingTaskDeletes.filter(function (item) {
    return normalizePendingDeleteKey(item, item && item.day, item && item.period) !== key;
  });
  pendingTaskDeletes.push(entry);
  persistPendingTaskDeletes();
}

function clearPendingTaskDelete(task, day, period) {
  if (!Array.isArray(pendingTaskDeletes) || pendingTaskDeletes.length === 0) return;
  const key = normalizePendingDeleteKey(task, day, period);
  const nextQueue = pendingTaskDeletes.filter(function (item) {
    return normalizePendingDeleteKey(item, item && item.day, item && item.period) !== key;
  });
  if (nextQueue.length === pendingTaskDeletes.length) return;
  pendingTaskDeletes = nextQueue;
  persistPendingTaskDeletes();
}

let _unsyncedSyncInFlight = false;
let _unsyncedSyncTimer = null;
let _isSyncingDate = false;
let _pendingDeleteSyncInFlight = false;

function scheduleUnsyncedTasksSync(delay) {
  if (_unsyncedSyncTimer) clearTimeout(_unsyncedSyncTimer);
  if (typeof recordSyncEvent === 'function') {
    recordSyncEvent('queue', 'Sincronizacao pendente agendada', { delay: delay == null ? 600 : delay });
  }
  _unsyncedSyncTimer = setTimeout(() => {
    _unsyncedSyncTimer = null;
    syncUnsyncedTasksToSupabase();
  }, delay == null ? 600 : delay);
}

async function ensureCurrentUserForSync() {
  if (currentUser) return currentUser;

  try {
    const result = await supabaseClient.auth.getSession();
    const session = result && result.data ? result.data.session : null;
    if (session && session.user) {
      currentUser = session.user;
      return currentUser;
    }
  } catch (err) {
    console.error('[Auth] Falha ao recuperar sessao para sincronizacao:', err);
  }

  return null;
}

async function syncUnsyncedTasksToSupabase() {
  if (_unsyncedSyncInFlight) return;
  if (!tasksSyncService) return;

  const user = await ensureCurrentUserForSync();
  if (!user) return;

  _unsyncedSyncInFlight = true;
  try {
    await flushPendingTaskDeletesToSupabase();
    let hasChanges = false;

    for (const [dateStr, periods] of Object.entries(allTasksData || {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

      for (const [period, tasks] of Object.entries(periods || {})) {
        if (!Array.isArray(tasks) || period === 'Rotina') continue;

        for (const task of tasks) {
          if (!task || !task.text || task.text.trim() === '') continue;
          if (task.isWeeklyRecurring || task.isRoutine || task.isRecurring) continue;
          const hasRemoteId =
            typeof task.supabaseId === 'string' && task.supabaseId.indexOf('-') > -1;
          const needsSync = task._syncPending === true || !hasRemoteId;
          if (!needsSync) continue;

          markLocalSupabaseMutation();
          const result = await tasksSyncService.syncTaskToSupabase(dateStr, period, task);
          if (result && result.success) {
            task._syncPending = false;
            hasChanges = true;
          }
        }
      }
    }

    const hasUnsyncedRecurring = (allRecurringTasks || []).some(
      (task) => task && (!task.supabaseId || String(task.supabaseId).indexOf('-') === -1)
    );
    if (hasUnsyncedRecurring) {
      await syncRecurringTasksToSupabase();
    }

    if (hasChanges) saveToLocalStorage();
  } catch (err) {
    console.error('[Sync] Erro ao sincronizar tarefas pendentes:', err);
    if (typeof recordSyncEvent === 'function') {
      recordSyncEvent('error', 'Erro ao sincronizar tarefas pendentes', {
        error: err && err.message ? err.message : String(err || '')
      });
    }
  } finally {
    _unsyncedSyncInFlight = false;
  }
}

async function flushPendingTaskDeletesToSupabase() {
  if (_pendingDeleteSyncInFlight) return;
  if (!tasksSyncService) return;
  if (!Array.isArray(pendingTaskDeletes) || pendingTaskDeletes.length === 0) return;

  const user = await ensureCurrentUserForSync();
  if (!user) return;

  _pendingDeleteSyncInFlight = true;
  try {
    const queue = pendingTaskDeletes.slice();
    for (const entry of queue) {
      if (!entry || (!entry.supabaseId && !entry.text)) {
        clearPendingTaskDelete(entry, entry && entry.day, entry && entry.period);
        continue;
      }

      const result = await tasksSyncService.deleteTaskFromSupabase(entry, entry.day, entry.period);
      if (!result || result.success !== true) {
        throw new Error((result && result.errorText) || 'Falha ao remover tarefa pendente');
      }
      clearPendingTaskDelete(entry, entry && entry.day, entry && entry.period);
    }
  } catch (err) {
    console.error('[Delete] Erro ao sincronizar exclusoes pendentes:', err);
    if (typeof recordSyncEvent === 'function') {
      recordSyncEvent('error', 'Erro ao sincronizar exclusoes pendentes', {
        error: err && err.message ? err.message : String(err || '')
      });
    }
  } finally {
    _pendingDeleteSyncInFlight = false;
  }
}

async function syncRecurringTasksToSupabase() {
  if (!tasksSyncService) return;

  const user = await ensureCurrentUserForSync();
  if (!user) {
    scheduleUnsyncedTasksSync(2000);
    finishSyncActivity(false, 'Login necessario para sincronizar');
    return;
  }

  markLocalSupabaseMutation();
  startSyncActivity('Sincronizando recorrencias...');
  try {
    await tasksSyncService.syncRecurringTasksToSupabase();
    finishSyncActivity(true);
  } catch (err) {
    finishSyncActivity(false, 'Falha ao sincronizar recorrencias');
    throw err;
  }
}

async function syncTaskToSupabase(dateStr, period, task) {
  if (!tasksSyncService) {
    return { success: false, errorText: 'Sync service indisponivel.' };
  }

  const user = await ensureCurrentUserForSync();
  if (!user) {
    scheduleUnsyncedTasksSync(2000);
    finishSyncActivity(false, 'Login necessario para sincronizar');
    return { success: false, errorText: 'Usuario nao autenticado para sincronizacao.' };
  }

  markLocalSupabaseMutation();
  startSyncActivity('Sincronizando alteracoes...');
  const result = await tasksSyncService.syncTaskToSupabase(dateStr, period, task);

  if (!result || !result.success) {
    scheduleUnsyncedTasksSync(1500);
    finishSyncActivity(false, (result && result.errorText) || 'Falha ao sincronizar');
    return result;
  }

  finishSyncActivity(true);
  return result;
}

async function deleteTaskFromSupabase(task, day, period) {
  if (!tasksSyncService) return;

  queuePendingTaskDelete(task, day, period);

  markLocalSupabaseMutation();
  startSyncActivity('Removendo tarefa na nuvem...');
  try {
    const result = await tasksSyncService.deleteTaskFromSupabase(task, day, period);
    if (!result || result.success !== true) {
      throw new Error((result && result.errorText) || 'Falha ao remover tarefa');
    }
    clearPendingTaskDelete(task, day, period);
    finishSyncActivity(true);
  } catch (err) {
    scheduleUnsyncedTasksSync(1200);
    finishSyncActivity(false, 'Falha ao remover tarefa');
    throw err;
  }
}

async function syncHabitToSupabase(habitText, date, completed) {
  if (!tasksSyncService) return;

  markLocalSupabaseMutation();
  startSyncActivity('Sincronizando habitos...');
  try {
    await tasksSyncService.syncHabitToSupabase(habitText, date, completed);
    finishSyncActivity(true);
  } catch (err) {
    finishSyncActivity(false, 'Falha ao sincronizar habitos');
    throw err;
  }
}

window.flushPendingTaskDeletesToSupabase = flushPendingTaskDeletesToSupabase;
window.queuePendingTaskDelete = queuePendingTaskDelete;
window.clearPendingTaskDelete = clearPendingTaskDelete;
