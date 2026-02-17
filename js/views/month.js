
import { getMonthDates, localDateStr } from '../utils/date.js';
import { getAllTasksData } from '../core/state.js';
import { createTaskElement } from '../components/task.js';

export function renderMonth(container = document.getElementById('monthView')) {
    container.innerHTML = ''; // Limpar container

    const { firstDay, lastDay, month, year } = getMonthDates(/* currentMonthOffset */);
    const monthName = firstDay.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // HEADER
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-6';
    header.innerHTML = `
        <button class="p-2 hover:bg-white/10 rounded-full" onclick="changeMonth(-1)"><i data-lucide="chevron-left"></i></button>
        <span class="text-xl font-bold capitalize">${monthName}</span>
        <button class="p-2 hover:bg-white/10 rounded-full" onclick="changeMonth(1)"><i data-lucide="chevron-right"></i></button>
    `;
    container.appendChild(header);

    // GRID
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-7 gap-2';

    // Dias da semana (Labels)
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    days.forEach(day => {
        const label = document.createElement('div');
        label.className = 'text-center text-sm text-gray-400 py-2';
        label.textContent = day;
        grid.appendChild(label);
    });

    // Células vazias antes do dia 1
    for (let i = 0; i < firstDay.getDay(); i++) {
        const empty = document.createElement('div');
        empty.className = 'aspect-square';
        grid.appendChild(empty);
    }

    // Dias do mês
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(year, month, day);
        const dateStr = localDateStr(date);
        const tasks = getAllTasksData()[dateStr] || {};

        let totalCount = 0;
        let completedCount = 0;

        Object.values(tasks).forEach(periodTasks => {
            if (Array.isArray(periodTasks)) {
                totalCount += periodTasks.length;
                completedCount += periodTasks.filter(t => t.completed).length;
            }
        });

        const cell = document.createElement('div');
        cell.className = 'aspect-square bg-[#1c1c1e] bg-opacity-40 rounded-lg p-2 border border-white/5 hover:border-blue-500/50 cursor-pointer transition-all';
        cell.onclick = () => { /* goToDate(dateStr) */ };

        const dayNum = document.createElement('div');
        dayNum.className = 'text-sm font-medium mb-1';
        dayNum.textContent = day;

        if (dateStr === localDateStr()) { // Hoje
            dayNum.className += ' text-blue-400 font-bold';
            cell.className += ' bg-blue-500/10 border-blue-500/30';
        }

        cell.appendChild(dayNum);

        // Task Indicators (Dots)
        if (totalCount > 0) {
            const progress = document.createElement('div');
            progress.className = 'flex gap-1 mt-auto';
            const percentage = (completedCount / totalCount) * 100;
            const bar = document.createElement('div');
            bar.className = 'h-1 rounded-full w-full bg-gray-700 overflow-hidden';
            bar.innerHTML = `<div class="h-full bg-${percentage === 100 ? 'green' : 'blue'}-500" style="width: ${percentage}%"></div>`;
            progress.appendChild(bar);
            cell.appendChild(progress);
        }

        grid.appendChild(cell);
    }

    container.appendChild(grid);
}
