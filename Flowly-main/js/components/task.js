
import { saveToLocalStorage, syncHabitToSupabase, getRoutineStates } from '../core/state.js';

export function createTaskElement(day, dateStr, period, task, index) {
    const div = document.createElement('div');

    // Add specific classes
    if (task.completed) div.classList.add('completed');
    if (task.isRoutine || task.isWeeklyRecurring) div.classList.add('routine-task');
    div.className = `task-item p-3 mb-2 rounded-lg flex items-center justify-between group transition-all duration-200 hover:bg-white/5 ${div.className}`;

    div.dataset.index = index;
    div.dataset.date = dateStr;
    div.dataset.period = period;
    div.draggable = true;

    // Checkbox
    const checkbox = document.createElement('div');
    checkbox.className = `w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors duration-200 ${task.completed ? 'bg-blue-500 border-blue-500' : 'border-gray-500 hover:border-blue-400'}`;
    checkbox.innerHTML = task.completed ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : '';

    checkbox.onclick = (e) => {
        e.stopPropagation();
        toggleTaskCompletion(task, dateStr, period, index);
    };

    // Text Content
    const content = document.createElement('span');
    content.className = `flex-1 ml-3 text-sm transition-colors duration-200 ${task.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`;
    content.textContent = task.text;

    // Actions
    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200';

    // Edit Button
    const editBtn = document.createElement('button');
    editBtn.className = 'p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors';
    editBtn.innerHTML = '<i data-lucide="edit-2" class="w-4 h-4"></i>';
    editBtn.onclick = (e) => {
        e.stopPropagation();
        startEditing(task, div);
    };

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'p-1 hover:bg-red-500/10 rounded text-gray-400 hover:text-red-400 transition-colors';
    deleteBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteTask(task, dateStr, period, index);
    };

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    div.appendChild(checkbox);
    div.appendChild(content);
    div.appendChild(actions);

    return div;
}

function toggleTaskCompletion(task, dateStr, period, index) {
    task.completed = !task.completed;
    if (task.isRoutine) {
        syncHabitToSupabase(task.text, dateStr, task.completed);
        const routineStates = getRoutineStates();
        if (!routineStates[dateStr]) routineStates[dateStr] = {};
        routineStates[dateStr][task.text] = task.completed;
    }
    saveToLocalStorage();
    // Trigger re-render (will be handled by view update)
    document.dispatchEvent(new CustomEvent('task-updated'));
}

function deleteTask(task, dateStr, period, index) {
    if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
        // Implementation for task deletion
        // Needs access to remove from array in state
        document.dispatchEvent(new CustomEvent('task-deleted', { detail: { dateStr, period, index } }));
    }
}

function startEditing(task, div) {
    // Dispatch event to show edit modal
    document.dispatchEvent(new CustomEvent('task-editing', { detail: { task, div } }));
}
