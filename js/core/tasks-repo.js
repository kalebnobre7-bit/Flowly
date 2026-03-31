(function () {
  function createFlowlyTasksRepo(deps) {
    const supabaseClient = deps.supabaseClient;
    const debugLog = deps.debugLog || function () {};

    const getCurrentUser = deps.getCurrentUser;
    const getAllTasksData = deps.getAllTasksData;
    const setAllTasksData = deps.setAllTasksData;
    const getAllRecurringTasks = deps.getAllRecurringTasks;
    const setAllRecurringTasks = deps.setAllRecurringTasks;
    const getHabitsHistory = deps.getHabitsHistory;
    const setHabitsHistory = deps.setHabitsHistory;
    const setCustomTaskTypes = deps.setCustomTaskTypes;
    const setCustomTaskPriorities = deps.setCustomTaskPriorities;
    const setDbUserSettings = deps.setDbUserSettings;

    const normalizeAllTasks = deps.normalizeAllTasks;
    const syncRecurringTasksToSupabase = deps.syncRecurringTasksToSupabase;
    const syncTaskToSupabase = deps.syncTaskToSupabase;
    const renderView = deps.renderView;
    const renderRoutineView = deps.renderRoutineView;

    let rtDebounceTimer = null;
    let rtReloadInFlight = false;
    let rtReloadQueued = false;

    function sortAndNormalizePositions(allData) {
      Object.values(allData || {}).forEach(function (periods) {
        if (!periods || typeof periods !== 'object') return;
        Object.values(periods).forEach(function (tasks) {
          if (!Array.isArray(tasks)) return;
          tasks.sort(function (a, b) {
            const pA = typeof a.position === 'number' ? a.position : 0;
            const pB = typeof b.position === 'number' ? b.position : 0;
            if (pA !== pB) return pA - pB;
            return String(a.supabaseId || a.text || '').localeCompare(
              String(b.supabaseId || b.text || '')
            );
          });
          tasks.forEach(function (task, index) {
            task.position = index;
          });
        });
      });
    }

    function mergeLocalTaskIntoRemote(remoteTask, localTask) {
      if (!remoteTask || !localTask) {
        return { shouldSyncBack: false };
      }

      const remoteUpdatedTs = remoteTask.updatedAt ? new Date(remoteTask.updatedAt).getTime() : 0;
      const localUpdatedTs = localTask.updatedAt ? new Date(localTask.updatedAt).getTime() : 0;
      const preferLocal = localTask._syncPending === true || localUpdatedTs > remoteUpdatedTs;
      let changed = false;

      if (!remoteTask.projectId && localTask.projectId) {
        remoteTask.projectId = localTask.projectId;
        changed = true;
      }
      if (!remoteTask.projectName && localTask.projectName) {
        remoteTask.projectName = localTask.projectName;
        changed = true;
      }
      if ((remoteTask.priority == null || remoteTask.priority === '') && localTask.priority) {
        remoteTask.priority = localTask.priority;
        changed = true;
      }
      if ((!remoteTask.type || remoteTask.type === 'OPERATIONAL') && localTask.type && localTask.type !== 'OPERATIONAL') {
        remoteTask.type = localTask.type;
        changed = true;
      }
      if ((!remoteTask.color || remoteTask.color === 'default') && localTask.color && localTask.color !== 'default') {
        remoteTask.color = localTask.color;
        changed = true;
      }

      if (preferLocal && typeof localTask.completed === 'boolean' && remoteTask.completed !== (localTask.completed === true)) {
        remoteTask.completed = localTask.completed === true;
        remoteTask.completedAt = localTask.completed === true ? localTask.completedAt || remoteTask.completedAt : null;
        changed = true;
      }
      if (preferLocal && localTask.color && remoteTask.color !== localTask.color) {
        remoteTask.color = localTask.color;
        changed = true;
      }
      if (preferLocal && typeof localTask.position === 'number' && remoteTask.position !== localTask.position) {
        remoteTask.position = localTask.position;
        changed = true;
      }
      if (preferLocal && (remoteTask.priority || null) !== (localTask.priority || null)) {
        remoteTask.priority = localTask.priority || null;
        changed = true;
      }
      if (preferLocal && localTask.type && remoteTask.type !== localTask.type) {
        remoteTask.type = localTask.type;
        changed = true;
      }
      if (preferLocal && localTask.updatedAt && remoteTask.updatedAt !== localTask.updatedAt) {
        remoteTask.updatedAt = localTask.updatedAt;
        changed = true;
      }
      if (localTask._syncPending === true && remoteTask._syncPending !== true) {
        remoteTask._syncPending = true;
        changed = true;
      }
      if (!remoteTask.timerStartedAt && localTask.timerStartedAt) {
        remoteTask.timerStartedAt = localTask.timerStartedAt;
        changed = true;
      }
      if (!remoteTask.timerLastStoppedAt && localTask.timerLastStoppedAt) {
        remoteTask.timerLastStoppedAt = localTask.timerLastStoppedAt;
        changed = true;
      }
      if ((Number(remoteTask.timerTotalMs || 0) || 0) < (Number(localTask.timerTotalMs || 0) || 0)) {
        remoteTask.timerTotalMs = Math.max(0, Number(localTask.timerTotalMs || 0) || 0);
        changed = true;
      }
      if ((Number(remoteTask.timerSessionsCount || 0) || 0) < (Number(localTask.timerSessionsCount || 0) || 0)) {
        remoteTask.timerSessionsCount = Math.max(
          0,
          Math.floor(Number(localTask.timerSessionsCount || 0) || 0)
        );
        changed = true;
      }

      return {
        shouldSyncBack:
          changed && (localTask._syncPending === true || localUpdatedTs > remoteUpdatedTs)
      };
    }

    async function runRealtimeReload() {
      if (rtReloadInFlight) {
        rtReloadQueued = true;
        return;
      }
      rtReloadInFlight = true;
      try {
        await loadDataFromSupabase();
        if (typeof renderView === 'function') renderView();
        if (typeof renderRoutineView === 'function') renderRoutineView();
      } finally {
        rtReloadInFlight = false;
        if (rtReloadQueued) {
          rtReloadQueued = false;
          setTimeout(runRealtimeReload, 80);
        }
      }
    }

    function scheduleRealtimeReload(reason, delayMs) {
      const suppressUntil = Number(window._flowlySuppressRealtimeUntil || 0);
      const now = Date.now();
      const delay = Math.max(0, delayMs || 0, suppressUntil > now ? suppressUntil - now + 120 : 0);
      debugLog('[Realtime] schedule reload:', reason, 'delay=', delay);
      if (rtDebounceTimer) clearTimeout(rtDebounceTimer);
      rtDebounceTimer = setTimeout(runRealtimeReload, delay);
    }

    async function migrateLocalDataToSupabase() {
      const currentUser = getCurrentUser();
      if (!currentUser) return;

      const { data: existingTasks } = await supabaseClient
        .from('tasks')
        .select('id')
        .eq('user_id', currentUser.id)
        .limit(1);

      const hasSupabaseData = existingTasks && existingTasks.length > 0;
      if (hasSupabaseData) {
        localStorage.removeItem('weekData');
        return;
      }

      const localTasksData = JSON.parse(localStorage.getItem('allTasksData') || '{}');
      const inserts = [];

      Object.entries(localTasksData).forEach(function ([dateStr, periods]) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;

        Object.entries(periods).forEach(function ([period, tasks]) {
          if (!Array.isArray(tasks)) return;

          tasks.forEach(function (task, index) {
            if (!task.text) return;
            if (!task.createdAt || Number.isNaN(new Date(task.createdAt).getTime())) {
              task.createdAt = new Date().toISOString();
            }
            inserts.push({
              user_id: currentUser.id,
              day: dateStr,
              period: period,
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
              created_at: task.createdAt,
              completed_at: task.completed ? task.completedAt || undefined : null,
              timer_total_ms: Math.max(0, Number(task.timerTotalMs || 0) || 0),
              timer_started_at: task.timerStartedAt || null,
              timer_last_stopped_at: task.timerLastStoppedAt || null,
              timer_sessions_count: Math.max(0, Math.floor(Number(task.timerSessionsCount || 0) || 0))
            });
          });
        });
      });

      if (inserts.length > 0) {
        const { data: inserted } = await supabaseClient.from('tasks').insert(inserts).select();

        if (inserted) {
          const allTasksData = getAllTasksData();
          inserted.forEach(function (row) {
            const tasks = allTasksData[row.day] && allTasksData[row.day][row.period];
            if (!tasks) return;
            const match = tasks.find(function (t, idx) {
              return (
                t.text === row.text &&
                !t.supabaseId &&
                (t.parent_id || null) === (row.parent_id || null) &&
                (typeof t.position === 'number' ? t.position : idx) === Number(row.position)
              );
            });
            if (match) match.supabaseId = row.id;
          });
          localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
        }
      }

      localStorage.removeItem('weekData');
    }

    async function loadDataFromSupabase() {
      const currentUser = getCurrentUser();
      if (!currentUser) return;

      try {
        const [typesRes, priosRes, settingsRes] = await Promise.all([
          supabaseClient.from('task_types').select('*').eq('user_id', currentUser.id),
          supabaseClient.from('task_priorities').select('*').eq('user_id', currentUser.id),
          supabaseClient.from('user_settings').select('*').eq('user_id', currentUser.id).single()
        ]);

        if (typesRes.data) setCustomTaskTypes(typesRes.data);
        if (priosRes.data) setCustomTaskPriorities(priosRes.data);

        if (settingsRes.data) {
          const nextSettings = {
            enable_week_hover_animation: settingsRes.data.enable_week_hover_animation !== false
          };
          setDbUserSettings(nextSettings);

          if (!nextSettings.enable_week_hover_animation) {
            document.body.classList.add('no-week-hover');
          } else {
            document.body.classList.remove('no-week-hover');
          }
        }
      } catch (e) {
        debugLog('Error loading custom settings', e);
      }

      const { data: tasks, error } = await supabaseClient
        .from('tasks')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('day', { ascending: true })
        .order('period', { ascending: true })
        .order('position', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching tasks from Supabase:', error);
        alert(
          'Erro critico ao carregar tarefas do servidor:\n' +
            (error.message || JSON.stringify(error))
        );
        return;
      }

      const localSnapshot = (function () {
        try {
          return JSON.parse(localStorage.getItem('allTasksData') || 'null');
        } catch (e) {
          return null;
        }
      })();

      const idsToDelete = [];
      const remoteTaskIds = new Set();
      const nextAllTasksData = {};
      const remoteRecurringTasks = [];

      if (tasks && tasks.length > 0) {
        tasks.forEach(function (task) {
          if (task.id) remoteTaskIds.add(task.id);
          if (task.day === 'ROUTINE') return;

          if (task.day === 'RECURRING') {
            remoteRecurringTasks.push({
              text: task.text,
              daysOfWeek: (function () {
                try {
                  return JSON.parse(task.period);
                } catch (e) {
                  return [0, 1, 2, 3, 4, 5, 6];
                }
              })(),
              priority: null,
              color: task.color || 'default',
              type: task.type || 'OPERATIONAL',
              isHabit: task.is_habit || false,
              createdAt: task.created_at || new Date().toISOString(),
              supabaseId: task.id
            });
            return;
          }

          const dateStr = task.day;
          if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !task.period) {
            if (task.id) idsToDelete.push(task.id);
            return;
          }

          if (!task.text || task.text.trim() === '') {
            if (task.id) idsToDelete.push(task.id);
            return;
          }

          if (!nextAllTasksData[dateStr]) nextAllTasksData[dateStr] = {};
          if (!nextAllTasksData[dateStr][task.period]) nextAllTasksData[dateStr][task.period] = [];

          nextAllTasksData[dateStr][task.period].push({
            text: task.text,
            completed: task.completed,
            color: task.color || 'default',
            type: task.type || 'OPERATIONAL',
            priority: task.priority || null,
            parent_id: task.parent_id || null,
            projectId: task.project_id || null,
            projectName: task.project_name || '',
            position: Number(task.position) || 0,
            isHabit: task.is_habit,
            supabaseId: task.id,
            _syncPending: false,
            createdAt: task.created_at || task.updated_at || new Date().toISOString(),
            updatedAt: task.updated_at || task.created_at || null,
            completedAt: task.completed ? task.completed_at || task.updated_at || new Date().toISOString() : null,
            timerTotalMs: Math.max(0, Number(task.timer_total_ms || 0) || 0),
            timerStartedAt: task.timer_started_at || null,
            timerLastStoppedAt: task.timer_last_stopped_at || null,
            timerSessionsCount: Math.max(0, Math.floor(Number(task.timer_sessions_count || 0) || 0))
          });
        });

        if (idsToDelete.length > 0) {
          await supabaseClient.from('tasks').delete().in('id', idsToDelete);
        }
      }

      const pendingLocalSync = [];
      if (localSnapshot && typeof localSnapshot === 'object') {
        Object.entries(localSnapshot).forEach(function ([dateStr, periods]) {
          if (!periods || typeof periods !== 'object') return;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;

          Object.entries(periods).forEach(function ([period, tasksInPeriod]) {
            if (!Array.isArray(tasksInPeriod)) return;
            if (!period || period === 'Rotina') return;
            if (!nextAllTasksData[dateStr]) nextAllTasksData[dateStr] = {};
            if (!nextAllTasksData[dateStr][period]) nextAllTasksData[dateStr][period] = [];

            const serverTasks = nextAllTasksData[dateStr][period];
            const localSeenKeys = new Set();

            tasksInPeriod.forEach(function (localTask, localIndex) {
              if (!localTask || !localTask.text || localTask.text.trim() === '') return;

              const normalizedText = localTask.text.trim().replace(/\s+/g, ' ');
              const dedupeKey = JSON.stringify({
                text: normalizedText.toLowerCase(),
                parent_id: localTask.parent_id || null,
                type: localTask.type || 'OPERATIONAL',
                priority: localTask.priority || null,
                isHabit: localTask.isHabit === true
              });

              // Nunca deixar o snapshot local ressuscitar duplicadas antigas.
              if (localSeenKeys.has(dedupeKey)) return;
              localSeenKeys.add(dedupeKey);

              const localTaskId =
                typeof localTask.supabaseId === 'string' && localTask.supabaseId.indexOf('-') > -1
                  ? localTask.supabaseId
                  : null;
              const localTaskHasValidRemoteId = localTaskId && remoteTaskIds.has(localTaskId);

              // If the task was already loaded from remote by id, merge local-only metadata
              // (ex.: vínculo de projeto) when the remote payload still doesn't carry it.
              if (localTaskHasValidRemoteId) {
                const remoteMatch = serverTasks.find(function (serverTask) {
                  return serverTask && serverTask.supabaseId === localTaskId;
                });
                if (remoteMatch) {
                  const mergeResult = mergeLocalTaskIntoRemote(remoteMatch, localTask);
                  if (mergeResult.shouldSyncBack) {
                    pendingLocalSync.push({ dateStr: dateStr, period: period, task: remoteMatch });
                  }
                }
                return;
              }

              const taskToKeep = {
                text: normalizedText,
                completed: localTask.completed === true,
                color: localTask.color || 'default',
                type: localTask.type || 'OPERATIONAL',
                priority: localTask.priority || null,
                parent_id: localTask.parent_id || null,
                projectId: localTask.projectId || null,
                projectName: localTask.projectName || '',
                position:
                  typeof localTask.position === 'number'
                    ? localTask.position
                    : serverTasks.length + localIndex,
                isHabit: localTask.isHabit === true,
                supabaseId: null,
                _syncPending: localTask._syncPending === true,
                updatedAt: localTask.updatedAt || null,
                completedAt: localTask.completedAt || null,
                timerTotalMs: Math.max(0, Number(localTask.timerTotalMs || 0) || 0),
                timerStartedAt: localTask.timerStartedAt || null,
                timerLastStoppedAt: localTask.timerLastStoppedAt || null,
                timerSessionsCount: Math.max(0, Math.floor(Number(localTask.timerSessionsCount || 0) || 0))
              };

              const remoteMatch = serverTasks.find(function (serverTask) {
                return (
                  serverTask &&
                  String(serverTask.text || '').trim().toLowerCase() ===
                    taskToKeep.text.trim().toLowerCase() &&
                  (serverTask.parent_id || null) === (taskToKeep.parent_id || null) &&
                  (serverTask.type || null) === (taskToKeep.type || null) &&
                  (serverTask.priority || null) === (taskToKeep.priority || null) &&
                  (serverTask.isHabit === true) === (taskToKeep.isHabit === true)
                );
              });

              if (remoteMatch) {
                const mergeResult = mergeLocalTaskIntoRemote(remoteMatch, localTask);
                if (mergeResult.shouldSyncBack) {
                  pendingLocalSync.push({ dateStr: dateStr, period: period, task: remoteMatch });
                }
                return;
              }

              serverTasks.push(taskToKeep);
              pendingLocalSync.push({ dateStr: dateStr, period: period, task: taskToKeep });
            });
          });
        });
      }

      sortAndNormalizePositions(nextAllTasksData);
      setAllTasksData(nextAllTasksData);

      pendingLocalSync.forEach(function (entry) {
        syncTaskToSupabase(entry.dateStr, entry.period, entry.task);
      });
      const allRecurringTasks = getAllRecurringTasks();
      const localNewTasks = allRecurringTasks.filter(function (t) {
        return !t.supabaseId;
      });

      // Prefer cloud recurring tasks, but preserve local unsynced recurring tasks until sync completes.
      let nextRecurringTasks = [];
      const uniqueTextMap = new Map();

      remoteRecurringTasks.forEach(function (t) {
        if (!t || !t.text) return;
        uniqueTextMap.set(t.text, t);
      });

      localNewTasks.forEach(function (t) {
        if (!t || !t.text) return;
        if (!uniqueTextMap.has(t.text)) uniqueTextMap.set(t.text, t);
      });

      nextRecurringTasks = Array.from(uniqueTextMap.values());

      setAllRecurringTasks(nextRecurringTasks);
      localStorage.setItem('allRecurringTasks', JSON.stringify(nextRecurringTasks));

      if (localNewTasks.length > 0) {
        await syncRecurringTasksToSupabase();
      }

      if (typeof normalizeAllTasks === 'function') normalizeAllTasks();
      localStorage.setItem('allTasksData', JSON.stringify(getAllTasksData()));

      const { data: habits } = await supabaseClient
        .from('habits_history')
        .select('*')
        .eq('user_id', currentUser.id);

      if (habits) {
        const nextHabitsHistory = getHabitsHistory() || {};
        habits.forEach(function (h) {
          const name = h.habit_name;
          const date = h.date;
          if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

          if (!nextHabitsHistory[name]) nextHabitsHistory[name] = {};

          if (h.completed === false) {
            delete nextHabitsHistory[name][date];
            return;
          }

          const existing = nextHabitsHistory[name][date];
          const serverTs = typeof h.completed_at === 'string' ? h.completed_at : (typeof h.created_at === 'string' ? h.created_at : null);

          if (typeof existing === 'string' && existing.trim() !== '') {
            nextHabitsHistory[name][date] = existing;
          } else if (serverTs) {
            nextHabitsHistory[name][date] = serverTs;
          } else {
            nextHabitsHistory[name][date] = new Date().toISOString();
          }
        });
        setHabitsHistory(nextHabitsHistory);
        localStorage.setItem('habitsHistory', JSON.stringify(nextHabitsHistory));
      }

      if (!window._flowlySubscription) {
        const channelUser = getCurrentUser();
        const userFilter = channelUser ? `user_id=eq.${channelUser.id}` : null;

        debugLog('[Realtime] Iniciando subscricao...');
        window._flowlySubscription = supabaseClient
          .channel(`flowly_changes_${channelUser ? channelUser.id : 'anon'}`)
          .on(
            'postgres_changes',
            userFilter
              ? { event: '*', schema: 'public', table: 'tasks', filter: userFilter }
              : { event: '*', schema: 'public', table: 'tasks' },
            function (payload) {
              const uid =
                (payload.new && payload.new.user_id) || (payload.old && payload.old.user_id);
              const activeUser = getCurrentUser();
              if (activeUser && uid === activeUser.id) {
                scheduleRealtimeReload('tasks', 220);
              }
            }
          )
          .on(
            'postgres_changes',
            userFilter
              ? { event: '*', schema: 'public', table: 'habits_history', filter: userFilter }
              : { event: '*', schema: 'public', table: 'habits_history' },
            function (payload) {
              const uid =
                (payload.new && payload.new.user_id) || (payload.old && payload.old.user_id);
              const activeUser = getCurrentUser();
              if (activeUser && uid === activeUser.id) {
                scheduleRealtimeReload('habits', 180);
              }
            }
          )
          .subscribe();
      }
    }

    return {
      migrateLocalDataToSupabase: migrateLocalDataToSupabase,
      loadDataFromSupabase: loadDataFromSupabase
    };
  }

  window.FlowlyTasksRepo = {
    create: createFlowlyTasksRepo
  };
})();





