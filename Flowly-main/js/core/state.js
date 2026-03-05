
import { safeJSONParse } from '../utils/helpers.js';
import { supabaseClient } from '../services/supabase.js';

let dailyRoutine = safeJSONParse(localStorage.getItem('dailyRoutine'), [
    { text: "Oração e Salmo", completed: false, color: "default", isHabit: true },
    { text: "Venvanse", completed: false, color: "default", isHabit: true },
    { text: "Ler metas e mantra; celular na gaveta", completed: false, color: "default", isHabit: true }
]);

let weeklyRecurringTasks = safeJSONParse(localStorage.getItem('weeklyRecurringTasks'), []);
let allTasksData = safeJSONParse(localStorage.getItem('allTasksData'), {});
let habitsHistory = safeJSONParse(localStorage.getItem('habitsHistory'), {});
let routineStates = safeJSONParse(localStorage.getItem('routineStates'), {});
let weekData = safeJSONParse(localStorage.getItem('weekData'), {});

let _currentUser = null;

// Getters
export const getDailyRoutine = () => dailyRoutine;
export const getWeeklyRecurringTasks = () => weeklyRecurringTasks;
export const getAllTasksData = () => allTasksData;
export const getHabitsHistory = () => habitsHistory;
export const getRoutineStates = () => routineStates;
export const getWeekData = () => weekData;
export const getCurrentUser = () => _currentUser;

// Setters
export const setCurrentUser = (user) => { _currentUser = user; };
export const setDailyRoutine = (routine) => { dailyRoutine = routine; saveToLocalStorage(); };
export const setWeeklyRecurringTasks = (tasks) => { weeklyRecurringTasks = tasks; saveToLocalStorage(); };
export const setAllTasksData = (data) => { allTasksData = data; saveToLocalStorage(); };
export const setHabitsHistory = (history) => { habitsHistory = history; saveToLocalStorage(); };
export const setRoutineStates = (states) => { routineStates = states; saveToLocalStorage(); };

// Sync Logic
let _isSyncingDate = false;

export function saveToLocalStorage() {
    localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
    localStorage.setItem('weeklyRecurringTasks', JSON.stringify(weeklyRecurringTasks));
    localStorage.setItem('dailyRoutine', JSON.stringify(dailyRoutine));
    localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory));
    localStorage.setItem('routineStates', JSON.stringify(routineStates));
    localStorage.setItem('weekData', JSON.stringify(weekData));

    if (_currentUser && !_isSyncingDate) {
        // Trigger sync (apenas tarefas normais, não rotina nem recorrentes)
        Object.entries(allTasksData).forEach(([dateStr, periods]) => {
            Object.entries(periods).forEach(([period, tasks]) => {
                if (Array.isArray(tasks)) {
                    tasks.forEach(task => {
                        if (!task.isRoutine && !task.isWeeklyRecurring) {
                            syncTaskToSupabase(dateStr, period, task);
                        }
                    });
                }
            });
        });
    }
}

// Supabase Sync functions
async function syncTaskToSupabase(dateStr, period, task) {
    if (!_currentUser) return;
    if (task.supabaseId) {
        await supabaseClient.from('tasks').update({
            text: task.text,
            completed: task.completed,
            color: task.color,
            is_habit: task.isHabit,
            updated_at: new Date().toISOString()
        }).eq('id', task.supabaseId);
    } else {
        const { data } = await supabaseClient.from('tasks').insert({
            user_id: _currentUser.id,
            day: dateStr,
            period: period,
            text: task.text,
            completed: task.completed,
            color: task.color,
            is_habit: task.isHabit
        }).select();
        if (data && data[0]) task.supabaseId = data[0].id;
    }
}

export async function loadDataFromSupabase(currentUser) {
    if (!currentUser) return;
    _currentUser = currentUser;

    const { data: tasks, error } = await supabaseClient.from('tasks').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: true });

    if (tasks && tasks.length > 0) {
        // IDs a deletar do Supabase (apenas datas inválidas)
        const idsToDelete = [];

        // Limpa dados locais e reconstrói a partir do Supabase
        allTasksData = {};
        tasks.forEach(task => {
            const dateStr = task.day;

            if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !task.period) {
                if (task.id) idsToDelete.push(task.id);
                return;
            }

            if (!task.text || task.text.trim() === '') {
                if (task.id) idsToDelete.push(task.id);
                return;
            }

            if (!allTasksData[dateStr]) allTasksData[dateStr] = {};
            if (!allTasksData[dateStr][task.period]) allTasksData[dateStr][task.period] = [];
            allTasksData[dateStr][task.period].push({
                text: task.text,
                completed: task.completed,
                color: task.color || 'default',
                isHabit: task.is_habit,
                supabaseId: task.id
            });
        });

        if (idsToDelete.length > 0) {
            await supabaseClient.from('tasks').delete().in('id', idsToDelete);
        }

        normalizeAllTasks();
        saveToLocalStorage(); // Now uses the simplified save
    }

    const { data: habits } = await supabaseClient.from('habits_history').select('*').eq('user_id', currentUser.id);
    if (habits) {
        habitsHistory = {};
        habits.forEach(h => {
            if (!habitsHistory[h.habit_name]) habitsHistory[h.habit_name] = {};
            habitsHistory[h.habit_name][h.date] = h.completed;
        });
        saveToLocalStorage();
    }
}

export async function syncHabitToSupabase(habitText, date, completed) {
    if (!_currentUser) return;
    await supabaseClient.from('habits_history').upsert({
        user_id: _currentUser.id, habit_name: habitText, date, completed
    }, { onConflict: 'user_id,habit_name,date' });
}

export async function migrateLocalDataToSupabase(currentUser) {
    if (!currentUser) return;
    _currentUser = currentUser;

    const { data: existingTasks } = await supabaseClient.from('tasks').select('id').eq('user_id', currentUser.id).limit(1);
    const hasSupabaseData = existingTasks && existingTasks.length > 0;

    if (hasSupabaseData) {
        // Local data is overwritten if cloud data exists
        return;
    }

    const inserts = [];
    Object.entries(allTasksData).forEach(([dateStr, periods]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
        Object.entries(periods).forEach(([period, tasks]) => {
            if (Array.isArray(tasks)) {
                tasks.forEach(task => {
                    if (!task.text) return;
                    inserts.push({
                        user_id: currentUser.id,
                        day: dateStr,
                        period: period,
                        text: task.text,
                        completed: task.completed || false,
                        color: task.color || 'default',
                        is_habit: task.isHabit || false
                    });
                });
            }
        });
    });

    if (inserts.length > 0) {
        const { data: inserted } = await supabaseClient.from('tasks').insert(inserts).select();
        if (inserted) {
            inserted.forEach(row => {
                const tasks = allTasksData[row.day]?.[row.period];
                if (tasks) {
                    const match = tasks.find(t => t.text === row.text && !t.supabaseId);
                    if (match) match.supabaseId = row.id;
                }
            });
            saveToLocalStorage();
        }
    }
}

export function normalizeAllTasks() {
    let hasChanges = false;
    const weeklyTextsSet = new Set(weeklyRecurringTasks.map(rt => rt.text));
    const routineTextsSet = new Set(dailyRoutine.map(rt => rt.text));

    Object.entries(allTasksData).forEach(([dateStr, periods]) => {
        if (periods['Rotina']) {
            delete periods['Rotina'];
            hasChanges = true;
        }
        if (periods._routineHydrated) {
            delete periods._routineHydrated;
            hasChanges = true;
        }

        Object.entries(periods).forEach(([period, tasks]) => {
            if (Array.isArray(tasks)) {
                const filtered = tasks.filter(task => {
                    if (task.isWeeklyRecurring || task.isRoutine) return false;
                    if (task.text && weeklyTextsSet.has(task.text)) return false;
                    return true;
                });
                if (filtered.length !== tasks.length) {
                    allTasksData[dateStr][period] = filtered;
                    hasChanges = true;
                }
                allTasksData[dateStr][period].forEach(task => {
                    if (task.text === undefined || task.text === null) {
                        task.text = '';
                        hasChanges = true;
                    }
                });
                if (allTasksData[dateStr][period].length === 0) {
                    delete allTasksData[dateStr][period];
                    hasChanges = true;
                }
            }
        });
        if (Object.keys(allTasksData[dateStr] || {}).length === 0) {
            delete allTasksData[dateStr];
            hasChanges = true;
        }
    });

    if (hasChanges) {
        saveToLocalStorage();
    }
}

// Legacy support
function loadFromLocalStorage() {
    // Already handled by initial load
}
