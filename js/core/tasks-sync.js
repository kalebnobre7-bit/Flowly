(function () {
  function createTasksSync(deps) {
    const supabaseClient = deps.supabaseClient;
    const getCurrentUser = deps.getCurrentUser;
    const getAllRecurringTasks = deps.getAllRecurringTasks;
    const setAllRecurringTasks = deps.setAllRecurringTasks;

    function ensureTaskSyncTimestamps(task) {
      const nowIso = new Date().toISOString();
      if (!task.createdAt || Number.isNaN(new Date(task.createdAt).getTime())) {
        task.createdAt = nowIso;
      }
      if (!task.updatedAt || Number.isNaN(new Date(task.updatedAt).getTime())) {
        task.updatedAt = nowIso;
      }
      if (task.completed === true && (!task.completedAt || Number.isNaN(new Date(task.completedAt).getTime()))) {
        task.completedAt = task.updatedAt || nowIso;
      }
    }

    async function syncRecurringTasksToSupabase() {
      const currentUser = getCurrentUser();
      if (!currentUser) return;

      const allRecurringTasks = getAllRecurringTasks();

      const { data: serverTasks } = await supabaseClient
        .from('tasks')
        .select('id, text, period, color, type, is_habit')
        .eq('user_id', currentUser.id)
        .eq('day', 'RECURRING');

      const localIds = new Set(
        allRecurringTasks
          .map(function (t) {
            return t.supabaseId;
          })
          .filter(Boolean)
      );
      const toDelete = (serverTasks || [])
        .filter(function (t) {
          return !localIds.has(t.id);
        })
        .map(function (t) {
          return t.id;
        });

      if (toDelete.length > 0) {
        await supabaseClient.from('tasks').delete().in('id', toDelete);
      }

      for (const task of allRecurringTasks) {
        const payload = {
          user_id: currentUser.id,
          day: 'RECURRING',
          period: JSON.stringify(task.daysOfWeek || []),
          text: task.text,
          is_habit: task.isHabit || false,
          type: task.type || 'OPERATIONAL',
          color: task.color || 'default'
        };

        if (task.supabaseId) {
          await supabaseClient.from('tasks').update(payload).eq('id', task.supabaseId);
        } else {
          const { data } = await supabaseClient.from('tasks').insert(payload).select();
          if (data && data[0]) task.supabaseId = data[0].id;
        }
      }

      setAllRecurringTasks(allRecurringTasks);
      localStorage.setItem('allRecurringTasks', JSON.stringify(allRecurringTasks));
    }

    async function syncTaskToSupabase(dateStr, period, task) {
      const currentUser = getCurrentUser();
      if (!currentUser) return { success: false, errorText: 'Usuario nao autenticado.' };

      try {
        ensureTaskSyncTimestamps(task);
        let data;
        let error;

        const payloadBase = {
          text: task.text,
          completed: task.completed === true,
          color: task.color || 'default',
          type: task.type || 'OPERATIONAL',
          priority: task.priority || null,
          parent_id: task.parent_id || null,
          project_id: task.projectId || null,
          project_name: task.projectName || null,
          position: typeof task.position === 'number' ? task.position : null,
          is_habit: task.isHabit || false,
          created_at: task.createdAt,
          timer_total_ms: Math.max(0, Number(task.timerTotalMs || 0) || 0),
          timer_started_at: task.timerStartedAt || null,
          timer_last_stopped_at: task.timerLastStoppedAt || null,
          timer_sessions_count: Math.max(0, Math.floor(Number(task.timerSessionsCount || 0) || 0)),
          updated_at: task.updatedAt || new Date().toISOString(),
          completed_at: task.completed === true ? task.completedAt || new Date().toISOString() : null
        };

        if (task.supabaseId && task.supabaseId.includes('-')) {
          const updatePayload = {
            ...payloadBase,
            day: dateStr,
            period
          };

          ({ data, error } = await supabaseClient
            .from('tasks')
            .update(updatePayload)
            .eq('id', task.supabaseId)
            .select());
        } else {
          const insertPayload = {
            user_id: currentUser.id,
            day: dateStr,
            period,
            ...payloadBase
          };

          ({ data, error } = await supabaseClient.from('tasks').insert([insertPayload]).select());
        }

        if (error && /completed_at/i.test(String(error.message || ''))) {
          const fallbackPayloadBase = {
            text: task.text,
            completed: task.completed === true,
            color: task.color || 'default',
            type: task.type || 'OPERATIONAL',
            priority: task.priority || null,
            parent_id: task.parent_id || null,
            project_id: task.projectId || null,
            project_name: task.projectName || null,
            position: typeof task.position === 'number' ? task.position : null,
            is_habit: task.isHabit || false,
            created_at: task.createdAt,
            timer_total_ms: Math.max(0, Number(task.timerTotalMs || 0) || 0),
            timer_started_at: task.timerStartedAt || null,
            timer_last_stopped_at: task.timerLastStoppedAt || null,
            timer_sessions_count: Math.max(0, Math.floor(Number(task.timerSessionsCount || 0) || 0)),
            updated_at: task.updatedAt || new Date().toISOString()
          };

          if (task.supabaseId && task.supabaseId.includes('-')) {
            ({ data, error } = await supabaseClient
              .from('tasks')
              .update({ ...fallbackPayloadBase, day: dateStr, period })
              .eq('id', task.supabaseId)
              .select());
          } else {
            ({ data, error } = await supabaseClient
              .from('tasks')
              .insert([{ user_id: currentUser.id, day: dateStr, period, ...fallbackPayloadBase }])
              .select());
          }
        }

        if (error) {
          console.error('[Sync] Erro:', error.message);
          return { success: false, errorText: error.message };
        }

        const arr = Array.isArray(data) ? data : [data];
        if (arr && arr[0] && arr[0].id) {
          task.supabaseId = arr[0].id;
          task.updatedAt = arr[0].updated_at || payloadBase.updated_at;
          task._syncPending = false;
          return { success: true, data: arr[0] };
        }

        return { success: false, errorText: 'Resposta vazia do Supabase.' };
      } catch (err) {
        console.error('[Sync] Erro fatal:', err);
        return { success: false, errorText: err.message };
      }
    }

    async function deleteTaskFromSupabase(task, day, period) {
      const currentUser = getCurrentUser();
      if (!currentUser || !task) {
        return { success: false, errorText: 'Usuario nao autenticado ou tarefa invalida.' };
      }

      try {
        if (task.supabaseId) {
          const { error } = await supabaseClient.from('tasks').delete().eq('id', task.supabaseId);
          if (error) {
            console.error('[Delete] Error by ID:', error.message);
            return { success: false, errorText: error.message };
          }
          return { success: true, deletedId: task.supabaseId };
        }

        // Fallback para tarefas sem supabaseId (legacy): resolve um id e deleta apenas esse registro
        if (task.text && day && period) {
          const { data: oneTask, error: findError } = await supabaseClient
            .from('tasks')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('text', task.text)
            .eq('day', day)
            .eq('period', period)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (findError) {
            console.error('[Delete] Error finding fallback task:', findError.message);
            return { success: false, errorText: findError.message };
          }

          if (oneTask && oneTask.id) {
            const { error } = await supabaseClient.from('tasks').delete().eq('id', oneTask.id);
            if (error) {
              console.error('[Delete] Error by resolved ID:', error.message);
              return { success: false, errorText: error.message };
            }
            return { success: true, deletedId: oneTask.id };
          }
        }
        return { success: true, missing: true };
      } catch (err) {
        console.error('[Delete] Fatal:', err.message);
        return { success: false, errorText: err && err.message ? err.message : String(err || '') };
      }
    }

    async function syncHabitToSupabase(habitText, date, completed) {
      const currentUser = getCurrentUser();
      if (!currentUser) return;
      if (completed) {
        let { error } = await supabaseClient.from('habits_history').upsert(
          {
            user_id: currentUser.id,
            habit_name: habitText,
            date: date,
            completed: true,
            completed_at: new Date().toISOString()
          },
          { onConflict: 'user_id,habit_name,date' }
        );
        if (error && /completed_at/i.test(String(error.message || ''))) {
          ({ error } = await supabaseClient.from('habits_history').upsert(
            {
              user_id: currentUser.id,
              habit_name: habitText,
              date: date,
              completed: true
            },
            { onConflict: 'user_id,habit_name,date' }
          ));
        }
      } else {
        await supabaseClient
          .from('habits_history')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('habit_name', habitText)
          .eq('date', date);
      }
    }

    return {
      syncRecurringTasksToSupabase: syncRecurringTasksToSupabase,
      syncTaskToSupabase: syncTaskToSupabase,
      deleteTaskFromSupabase: deleteTaskFromSupabase,
      syncHabitToSupabase: syncHabitToSupabase
    };
  }

  window.FlowlyTasksSync = {
    create: createTasksSync
  };
})();


