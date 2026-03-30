function markLocalSupabaseMutation(ms) {
  const until = Date.now() + (ms || 1800);
  const prev = Number(window._flowlySuppressRealtimeUntil || 0);
  window._flowlySuppressRealtimeUntil = Math.max(prev, until);
}

let _unsyncedSyncInFlight = false;
let _unsyncedSyncTimer = null;
let _isSyncingDate = false;

function scheduleUnsyncedTasksSync(delay) {
  if (_unsyncedSyncTimer) clearTimeout(_unsyncedSyncTimer);
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
    let hasChanges = false;

    for (const [dateStr, periods] of Object.entries(allTasksData || {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

      for (const [period, tasks] of Object.entries(periods || {})) {
        if (!Array.isArray(tasks) || period === 'Rotina') continue;

        for (const task of tasks) {
          if (!task || !task.text || task.text.trim() === '') continue;
          if (task.isWeeklyRecurring || task.isRoutine || task.isRecurring) continue;
          if (typeof task.supabaseId === 'string' && task.supabaseId.indexOf('-') > -1) continue;

          markLocalSupabaseMutation();
          const result = await tasksSyncService.syncTaskToSupabase(dateStr, period, task);
          if (result && result.success) hasChanges = true;
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
  } finally {
    _unsyncedSyncInFlight = false;
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

  markLocalSupabaseMutation();
  startSyncActivity('Removendo tarefa na nuvem...');
  try {
    await tasksSyncService.deleteTaskFromSupabase(task, day, period);
    finishSyncActivity(true);
  } catch (err) {
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
