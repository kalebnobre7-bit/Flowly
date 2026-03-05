
import { getWeekDates, localDateStr, getWeekLabel } from '../utils/date.js';
import { getAllTasksData, getWeeklyRecurringTasks, getDailyRoutine, saveToLocalStorage } from '../core/state.js';
import { createTaskElement } from '../components/task.js';
import { createDropZone, handleDragStart, handleDragEnd, handleDragOver } from '../components/drag-drop.js';

let _currentWeekOffset = 0;

export function renderWeek(weekOffset) {
    _currentWeekOffset = weekOffset || _currentWeekOffset;
    const grid = document.getElementById('weekGrid');

    // Clear classes and styles
    grid.className = '';
    grid.style.cssText = '';
    grid.innerHTML = '';
    grid.classList.remove('today-container');

    // Update Header Label
    const label = document.getElementById('weekLabel');
    if (label) label.textContent = getWeekLabel(_currentWeekOffset);

    // Get Dates
    const dates = getWeekDates(_currentWeekOffset);
    const allData = getAllTasksData();

    dates.forEach(({ name: day, dateStr }) => {
        const col = document.createElement('div');
        col.className = 'day-column bg-[#1c1c1e]/40 p-3 rounded-lg flex flex-col gap-2 min-h-[300px] border border-white/5';
        col.dataset.day = day;
        col.dataset.date = dateStr;

        // Header
        const header = document.createElement('div');
        const dayNum = dateStr.split('-')[2];
        const isToday = dateStr === localDateStr();

        header.innerHTML = `
            <div class="flex justify-between items-end pb-2 mb-2 border-b border-white/5">
                <span class="text-xs font-bold uppercase tracking-wider ${isToday ? 'text-blue-400' : 'text-gray-400'}">${day}</span>
                <span class="text-lg font-light ${isToday ? 'text-blue-400' : 'text-gray-400'}">${dayNum}</span>
            </div>
        `;
        col.appendChild(header);

        // Tasks Container
        const taskList = document.createElement('div');
        taskList.className = 'flex flex-col gap-2 flex-1 relative';

        // 1. Routine Tasks (Virtual)
        const routineTasks = getRoutineTasksForDate(dateStr);
        routineTasks.forEach(task => {
            const el = createTaskElement(day, dateStr, 'Rotina', task, -1);
            taskList.appendChild(el);
        });

        // 2. Persisted Tasks
        const dayTasks = allData[dateStr] || {};
        Object.entries(dayTasks).forEach(([period, tasks]) => {
            if (period === 'Rotina') return;
            if (Array.isArray(tasks)) {
                tasks.forEach((task, index) => {
                    const el = createTaskElement(day, dateStr, period, task, index);
                    el.addEventListener('dragstart', handleDragStart);
                    el.addEventListener('dragend', handleDragEnd);
                    taskList.appendChild(el);

                    // Drop Zone AFTER task
                    const dz = createDropZone(day, dateStr, period, index + 1);
                    taskList.appendChild(dz);
                });
            }
        });

        // Add Quick Task Button
        const addBtn = document.createElement('button');
        addBtn.className = 'mt-2 w-full py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded transition-colors dashed-border';
        addBtn.textContent = '+ Adicionar tarefa';
        addBtn.onclick = () => { /* showQuickAddInput(col, day, dateStr) */ };

        col.appendChild(taskList);
        col.appendChild(addBtn);

        // Drop Listeners on Column
        col.addEventListener('dragover', handleDragOver);
        col.addEventListener('drop', (e) => {
            e.preventDefault();
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            // Default drop at end of list
            document.dispatchEvent(new CustomEvent('task-dropped', {
                detail: {
                    source: data,
                    target: { date: dateStr, period: 'Tarefas', index: 9999 }
                }
            }));
        });

        grid.appendChild(col);
    });
}

// Helper para tarefas de rotina (não exportado)
function getRoutineTasksForDate(dateStr) {
    const routine = getDailyRoutine();
    const recurs = getWeeklyRecurringTasks();
    const dayOfWeek = new Date(dateStr).getDay(); // 0-6

    const tasks = [];

    // Daily
    routine.forEach(t => {
        tasks.push({ ...t, isRoutine: true, completed: false }); // Todo: check completion state history
    });

    // Weekly
    recurs.forEach(t => {
        if (t.daysOfWeek.includes(dayOfWeek)) {
            tasks.push({ ...t, isWeeklyRecurring: true, completed: false });
        }
    });

    return tasks;
}
