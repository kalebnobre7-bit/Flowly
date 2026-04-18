(function () {
  function createRoutineService(deps) {
    const localDateStr = deps.localDateStr;
    const getAllRecurringTasks = deps.getAllRecurringTasks;
    const getHabitsHistory = deps.getHabitsHistory;
    const setHabitsHistory = deps.setHabitsHistory;
    const getCurrentUser = deps.getCurrentUser;
    const supabaseClient = deps.supabaseClient;

    function getTaskStartDateKey(task) {
      const raw = task && (task.startDate || task.createdAt || task.created_at);
      if (!raw) return null;

      const parsed = new Date(raw);
      const ts = parsed.getTime();
      if (!Number.isFinite(ts)) return null;

      const localStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      return localDateStr(localStart);
    }

    function isTaskActiveForDate(task, dateStr) {
      const startDateKey = getTaskStartDateKey(task);
      if (!startDateKey) return true;
      return dateStr >= startDateKey;
    }

    function getRoutineTasksForDate(dateStr) {
      const tasks = [];
      const dateParts = dateStr.split('-');
      const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      const dayOfWeek = dateObj.getDay();
      const allRecurringTasks =
        typeof normalizeRecurringTasksList === 'function'
          ? normalizeRecurringTasksList(getAllRecurringTasks())
          : getAllRecurringTasks();
      const habitsHistory = getHabitsHistory();

      allRecurringTasks.forEach(function (habit) {
        if (!habit || habit._deletedPending) return;
        if (!isTaskActiveForDate(habit, dateStr)) return;

        let isForToday = false;
        if (habit.daysOfWeek && Array.isArray(habit.daysOfWeek)) {
          if (habit.daysOfWeek.includes(dayOfWeek)) isForToday = true;
        } else if (habit.isHabit) {
          isForToday = true;
        }

        if (!isForToday) return;

        const historyValue = habitsHistory[habit.text] && habitsHistory[habit.text][dateStr];
        const completedAt = typeof historyValue === 'string' ? historyValue : null;

        tasks.push({
          text: habit.text,
          routineId:
            typeof ensureRecurringTaskIdentity === 'function'
              ? ensureRecurringTaskIdentity(habit)
              : habit.routineId || habit.supabaseId || habit.text,
          routineKey:
            typeof getRecurringTaskIdentity === 'function'
              ? getRecurringTaskIdentity(habit)
              : habit.routineId || habit.supabaseId || habit.text,
          completed: !!historyValue,
          completedAt: completedAt,
          color: habit.color || 'default',
          priority: habit.priority || 'none',
          isRecurring: true,
          isHabit: true,
          recurrence: habit.daysOfWeek
        });
      });

      return tasks;
    }

    function getAllHabits() {
      const habits = [];
      const habitMap = new Map();
      const today = localDateStr();
      const allRecurringTasks =
        typeof normalizeRecurringTasksList === 'function'
          ? normalizeRecurringTasksList(getAllRecurringTasks())
          : getAllRecurringTasks();
      const habitsHistory = getHabitsHistory();

      allRecurringTasks.forEach(function (task) {
        if (!task || task._deletedPending) return;
        if (!isTaskActiveForDate(task, today)) return;

        if (
          (task.isHabit || (task.daysOfWeek && task.daysOfWeek.length > 0)) &&
          !habitMap.has(task.text)
        ) {
          const isCompleted = habitsHistory[task.text] && habitsHistory[task.text][today];
          habitMap.set(task.text, {
            text: task.text,
            color: task.color,
            completedToday: !!isCompleted,
            isHabit: true
          });
        }
      });

      return Array.from(habitMap.values());
    }

    function getHabitStreak(habitText) {
      const habitsHistory = getHabitsHistory();
      if (!habitsHistory[habitText]) return 0;
      const today = new Date();
      let streak = 0;
      let currentDate = new Date(today);

      while (true) {
        const dateKey = localDateStr(currentDate);
        if (habitsHistory[habitText][dateKey]) {
          streak += 1;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }
      return streak;
    }

    function getHabitCompletionRate(habitText, days) {
      const windowDays = typeof days === 'number' ? days : 30;
      const habitsHistory = getHabitsHistory();
      if (!habitsHistory[habitText]) return 0;
      const today = new Date();
      let completed = 0;

      for (let i = 0; i < windowDays; i += 1) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = localDateStr(date);
        if (habitsHistory[habitText][dateKey]) completed += 1;
      }

      return Math.round((completed / windowDays) * 100);
    }

    function markHabitCompleted(habitText, completed, targetDate) {
      const dateKey = targetDate || localDateStr();
      const habitsHistory = getHabitsHistory();
      if (!habitsHistory[habitText]) habitsHistory[habitText] = {};

      if (completed) habitsHistory[habitText][dateKey] = new Date().toISOString();
      else delete habitsHistory[habitText][dateKey];

      setHabitsHistory(habitsHistory);
      localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory));

      const currentUser = getCurrentUser();
      if (!currentUser) return;

      if (completed) {
        supabaseClient
          .from('habits_history')
          .upsert(
            {
              user_id: currentUser.id,
              habit_name: habitText,
              date: dateKey,
              completed: true,
              completed_at: habitsHistory[habitText][dateKey]
            },
            { onConflict: 'user_id,habit_name,date' }
          )
          .then(function (res) {
            if (res.error && /completed_at/i.test(String(res.error.message || ''))) {
              return supabaseClient
                .from('habits_history')
                .upsert(
                  {
                    user_id: currentUser.id,
                    habit_name: habitText,
                    date: dateKey,
                    completed: true
                  },
                  { onConflict: 'user_id,habit_name,date' }
                )
                .then(function (fallbackRes) {
                  if (fallbackRes.error) console.error('Erro ao marcar hábito:', fallbackRes.error);
                });
            }
            if (res.error) console.error('Erro ao marcar hábito:', res.error);
          });
      } else {
        supabaseClient
          .from('habits_history')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('habit_name', habitText)
          .eq('date', dateKey)
          .then(function (res) {
            if (res.error) console.error('Erro ao desmarcar hábito:', res.error);
          });
      }
    }

    return {
      getRoutineTasksForDate: getRoutineTasksForDate,
      getAllHabits: getAllHabits,
      getHabitStreak: getHabitStreak,
      getHabitCompletionRate: getHabitCompletionRate,
      markHabitCompleted: markHabitCompleted
    };
  }

  window.FlowlyRoutineService = {
    create: createRoutineService
  };
})();
