// --- Supabase & Storage Logic ---
const SUPABASE_URL = window._FLOWLY_SUPABASE_URL || '';
const SUPABASE_KEY = window._FLOWLY_SUPABASE_KEY || '';
const { createClient } = window.supabase;

// Inicializar flowly_persist_session como true por padrão (checkbox vem marcado)
if (localStorage.getItem('flowly_persist_session') === null) {
    localStorage.setItem('flowly_persist_session', 'true');
}

const customStorage = {
    getItem: (key) => {
        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
        console.log('[Storage] getItem:', key, value ? 'found' : 'not found');
        return value;
    },
    setItem: (key, value) => {
        const shouldPersist = localStorage.getItem('flowly_persist_session') !== 'false';
        console.log('[Storage] setItem:', key, 'persist:', shouldPersist);
        if (shouldPersist) {
            localStorage.setItem(key, value);
        } else {
            sessionStorage.setItem(key, value);
        }
    },
    removeItem: (key) => {
        console.log('[Storage] removeItem:', key);
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    }
};

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storage: customStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'flowly-auth'
    }
});

// Listener para mudanças de autenticação
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event, session ? 'user active' : 'no session');

    if (event === 'INITIAL_SESSION') {
        if (session) {
            currentUser = session.user;
            document.getElementById('authModal').classList.remove('show');
            document.getElementById('userEmail').textContent = session.user.email;
            await loadDataFromSupabase();
            renderView();
        } else {
            // Sem sessão inicial -> Mostrar Login
            document.getElementById('authModal').classList.add('show');
        }
    } else if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        document.getElementById('authModal').classList.remove('show');
        document.getElementById('userEmail').textContent = session.user.email;
        // Garantir carregamento se vier de redirecionamento ou OAuth
        if (!allTasksData || Object.keys(allTasksData).length === 0) {
            await loadDataFromSupabase();
            renderView();
        }
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        document.getElementById('authModal').classList.add('show');
        location.reload();
    }
});


let currentUser = null;
let currentView = 'week';
let draggedTask = null;
let currentEditingTask = null;
const width = 600;
let currentWeekOffset = 0; // 0 = semana atual, -1 = semana passada, +1 = próxima semana
let currentMonthOffset = 0; // 0 = mês atual

// View Management Functions
function setView(view) {
    currentView = view;

    // Hide all views
    const views = ['monthView', 'weekGrid', 'todayView', 'routineView', 'analyticsView', 'settingsView'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });

    // Update navigation buttons
    document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
    const btnMap = {
        'month': 'btnMonth',
        'week': 'btnWeek',
        'today': 'btnToday',
        'routine': 'btnRoutine',
        'analytics': 'btnAnalytics',
        'settings': 'btnSettings'
    };
    const activeBtn = document.getElementById(btnMap[view]);
    if (activeBtn) activeBtn.classList.add('active');

    // Show week navigation only for week view
    const weekNav = document.getElementById('weekNav');
    if (weekNav) {
        weekNav.style.display = view === 'week' ? 'flex' : 'none';
    }

    renderView();
}

function renderView() {
    if (!currentView) currentView = 'week';

    // Show the appropriate view
    const viewMap = {
        'week': 'weekGrid',
        'today': 'todayView',
        'routine': 'routineView',
        'analytics': 'analyticsView',
        'settings': 'settingsView',
        'month': 'monthView'
    };

    const viewId = viewMap[currentView];
    if (viewId) {
        const el = document.getElementById(viewId);
        if (el) el.classList.remove('hidden');
    }

    // Call specific render functions if they exist
    if (currentView === 'week' && typeof renderWeek === 'function') {
        renderWeek();
    } else if (currentView === 'routine' && typeof renderRoutineView === 'function') {
        renderRoutineView();
    } else if (currentView === 'analytics' && typeof renderAnalyticsView === 'function') {
        renderAnalyticsView();
    } else if (currentView === 'settings' && typeof renderSettingsView === 'function') {
        renderSettingsView();
    } else if (currentView === 'today' && typeof renderTodayView === 'function') {
        renderTodayView();
    } else if (currentView === 'month' && typeof renderMonthView === 'function') {
        renderMonthView();
    }
}

// Helper para JSON seguro
function safeJSONParse(str, fallback) {
    try {
        return str ? JSON.parse(str) : fallback;
    } catch (e) {
        console.error('Erro ao fazer parse do JSON:', e);
        return fallback;
    }
}

// Data Structures
// NOVO: Tarefas recorrentes unificadas (substituem dailyRoutine e weeklyRecurringTasks)
// Formato: { text, daysOfWeek: [0-6], priority, createdAt }
let allRecurringTasks = safeJSONParse(localStorage.getItem('allRecurringTasks'), []);

// Compatibilidade: manter dailyRoutine para migração (será removido após migrar)
let dailyRoutine = safeJSONParse(localStorage.getItem('dailyRoutine'), []);
let weeklyRecurringTasks = safeJSONParse(localStorage.getItem('weeklyRecurringTasks'), []);

// Estrutura expandida: armazena tarefas por data ISO (YYYY-MM-DD) e período
let allTasksData = safeJSONParse(localStorage.getItem('allTasksData'), {});

// Compatibilidade: estrutura antiga para a semana atual
const weekData = { "Segunda": {}, "Terça": {}, "Quarta": {}, "Quinta": {}, "Sexta": {}, "Sábado": {}, "Domingo": {} };
let habitsHistory = safeJSONParse(localStorage.getItem('habitsHistory'), {});

// Estado de conclusão de tarefas recorrentes por data
let routineCompletions = safeJSONParse(localStorage.getItem('routineCompletions'), {});
// Formato: { "taskText": { "2026-02-17": true, "2026-02-18": false } }


// FunÇÕES auxiliares de data
function localDateStr(date = new Date()) {
    return date.toLocaleDateString('pt-BR').split('/').reverse().join('-');
}

// --- FunÇÕES Globais do Analytics e Rotina ---

// --- FunÇÕES Globais do Analytics e Rotina (NOVO SISTEMA) ---

// Variáveis para edição
let currentEditingTaskRef = null;

// Função para abrir o modal de edição
window.openTaskEditModal = function (task, element) {
    const modal = document.getElementById('taskEditModal');
    const taskText = task.text || '';

    // Guardar referência
    currentEditingTaskRef = {
        dateStr: element.dataset.date,
        period: element.dataset.period,
        index: parseInt(element.dataset.index),
        isRecurring: element.dataset.index === '-1',
        originalTask: task
    };

    // UI - Input
    document.getElementById('taskEditInput').value = taskText;

    // Resetar botões
    document.querySelectorAll('.priority-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.weekly-day-btn').forEach(btn => btn.classList.remove('active'));

    // --- RE-BIND LISTENERS (Critical Fix) ---
    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.onclick = () => {
            const wasActive = btn.classList.contains('active');
            document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
            if (!wasActive) btn.classList.add('active');
        };
    });
    document.querySelectorAll('.weekly-day-btn').forEach(btn => {
        btn.onclick = () => {
            btn.classList.toggle('active');
        };
    });
    const btnSave = document.getElementById('btnSaveTaskEdit');
    if (btnSave) btnSave.onclick = window.saveTaskEdit;

    // Deletar também
    const btnDel = document.getElementById('btnDeleteTaskEdit');
    if (btnDel) btnDel.onclick = window.deleteTaskEdit;
    const btnCancel = document.getElementById('btnCancelTaskEdit');
    if (btnCancel) btnCancel.onclick = () => document.getElementById('taskEditModal').classList.remove('show');
    // ----------------------------------------

    // Setar Prioridade (se existir na tarefa ou na definição de recorrência)
    let priority = task.priority || 'none';

    // Se for recorrente visual, tenta pegar a prioridade "real" da definição
    if (currentEditingTaskRef.isRecurring) {
        const recDefinition = allRecurringTasks.find(t => t.text === task.text);
        if (recDefinition && recDefinition.priority) priority = recDefinition.priority;
    }

    const pBtn = document.querySelector(`.priority-btn[data-priority="${priority}"]`);
    if (pBtn) pBtn.classList.add('active');

    // Setar Recorrência
    // Procura na lista unificada de recorrentes
    const recTask = allRecurringTasks.find(t => t.text === task.text);
    if (recTask && recTask.daysOfWeek) {
        recTask.daysOfWeek.forEach(day => {
            const btn = document.querySelector(`.weekly-day-btn[data-day="${day}"]`);
            if (btn) btn.classList.add('active');
        });
    }

    modal.classList.add('show');

    // Re-render icons if needed (lucide)
    if (window.lucide) lucide.createIcons();
}

// Salvar Edição
window.saveTaskEdit = function () {
    if (!currentEditingTaskRef) return;
    const { dateStr, period, index, isRecurring, originalTask } = currentEditingTaskRef;

    const activePBtn = document.querySelector('.priority-btn.active');
    const newPriority = activePBtn ? activePBtn.dataset.priority : 'none';

    const activeDays = Array.from(document.querySelectorAll('.weekly-day-btn.active'))
        .map(btn => parseInt(btn.dataset.day));

    const newTaskText = document.getElementById('taskEditInput').value.trim();
    if (!newTaskText) { alert("Nome da tarefa obrigatório!"); return; }

    const oldText = originalTask.text;

    // 1. Atualizar Tarefa Local (se não for visualização recorrente)
    if (!isRecurring) {
        if (allTasksData[dateStr] && allTasksData[dateStr][period]) {
            const t = allTasksData[dateStr][period][index];
            if (t) {
                t.priority = newPriority;
                t.text = newTaskText; // Renomear
            }
        }
    }

    // 2. Gerenciar Recorrência Unificada
    let recIndex = allRecurringTasks.findIndex(t => t.text === oldText);

    // Se não achou pelo antigo, tenta pelo novo.
    if (recIndex === -1) recIndex = allRecurringTasks.findIndex(t => t.text === newTaskText);

    if (activeDays.length > 0) {
        // Criar ou Atualizar
        const newRecTask = {
            text: newTaskText,
            daysOfWeek: activeDays,
            priority: newPriority,
            color: getPriorityColorName(newPriority), // fallback helper
            createdAt: new Date().toISOString()
        };

        if (recIndex >= 0) {
            allRecurringTasks[recIndex] = { ...allRecurringTasks[recIndex], ...newRecTask };
        } else {
            allRecurringTasks.push(newRecTask);
        }
        // Se virou recorrente, remove a original avulsa para evitar duplicação visual e lógica
        if (!isRecurring && allTasksData[dateStr] && allTasksData[dateStr][period]) {
            allTasksData[dateStr][period].splice(index, 1);
        }

    } else {
        // Se desmarcou todos os dias, remove da recorrência
        if (recIndex >= 0) {
            if (confirm('Remover a recorrência automática desta tarefa?')) {
                allRecurringTasks.splice(recIndex, 1);
            }
        }
    }

    saveToLocalStorage();
    if (typeof activeDays !== 'undefined' && (activeDays.length > 0 || isRecurring)) syncRecurringTasksToSupabase();
    document.getElementById('taskEditModal').classList.remove('show');
    renderView();
}

// Deletar via Modal
window.deleteTaskEdit = function () {
    if (!currentEditingTaskRef) return;
    const { dateStr, period, index, isRecurring, originalTask } = currentEditingTaskRef;

    if (confirm('Excluir esta tarefa?')) {
        let deleted = false;

        // Se for recorrente, deletar da lista global?
        if (isRecurring || allRecurringTasks.some(t => t.text === originalTask.text)) {
            if (confirm('Esta tarefa é recorrente. Deseja parar de repeti-la para sempre?')) {
                const recIndex = allRecurringTasks.findIndex(t => t.text === originalTask.text);
                if (recIndex >= 0) allRecurringTasks.splice(recIndex, 1);
                // Limpar instâncias persistidas indevidamente em allTasksData
                const textToRemove = originalTask.text;
                Object.keys(allTasksData).forEach(dStr => {
                    Object.keys(allTasksData[dStr] || {}).forEach(per => {
                        if (Array.isArray(allTasksData[dStr][per])) {
                            allTasksData[dStr][per] = allTasksData[dStr][per].filter(t => t.text !== textToRemove);
                            if (allTasksData[dStr][per].length === 0) delete allTasksData[dStr][per];
                        }
                    });
                    if (Object.keys(allTasksData[dStr] || {}).length === 0) delete allTasksData[dStr];
                });
                syncRecurringTasksToSupabase();
                deleted = true;
            }
        }

        // Se for tarefa local avulsa, deletar
        if (!isRecurring && allTasksData[dateStr]?.[period]) {
            allTasksData[dateStr][period].splice(index, 1);
            if (allTasksData[dateStr][period].length === 0) delete allTasksData[dateStr][period];
            deleted = true;
        }

        if (deleted) {
            saveToLocalStorage();
            document.getElementById('taskEditModal').classList.remove('show');
            renderView();
        }
    }
}

function getPriorityColorName(priority) {
    switch (priority) {
        case 'urgent': return 'red';
        case 'important': return 'orange';
        case 'simple': return 'yellow';
        case 'money': return 'green';
        default: return 'default';
    }
}

// ===== FUNÇÕES DE SALVAMENTO =====
function saveToLocalStorage() {
    localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
    localStorage.setItem('allRecurringTasks', JSON.stringify(allRecurringTasks));
    localStorage.setItem('routineCompletions', JSON.stringify(routineCompletions));
    localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory));

    // Manter dados antigos zerados/compatíveis para evitar erros em funcoes legadas até limparmos tudo
    localStorage.setItem('dailyRoutine', JSON.stringify([]));
    localStorage.setItem('weeklyRecurringTasks', JSON.stringify([]));

    // Integrar lógica de sync legada (se existir)
    if (typeof _isSyncingDate !== 'undefined' && currentUser && !_isSyncingDate) {
        Object.entries(allTasksData).forEach(([dateStr, periods]) => {
            Object.entries(periods).forEach(([period, tasks]) => {
                if (Array.isArray(tasks)) {
                    tasks.forEach(task => {
                        // Garantir que syncTaskToSupabase exista
                        if (!task.isRoutine && !task.isWeeklyRecurring && typeof syncTaskToSupabase === 'function') {
                            syncTaskToSupabase(dateStr, period, task);
                        }
                    });
                }
            });
        });
    }
}

// ===== DRAG AND DROP =====
let dragState = {
    sourceDate: null,
    sourcePeriod: null,
    sourceIndex: null,
    taskData: null
};

function handleDragStart(e) {
    const el = e.target;
    const dateStr = el.dataset.date;
    const period = el.dataset.period;
    const index = parseInt(el.dataset.index);

    if (index === -1) return; // Tarefas recorrentes não podem ser arrastadas

    const tasksArray = allTasksData[dateStr]?.[period] || [];
    const task = tasksArray[index];

    dragState.sourceDate = dateStr;
    dragState.sourcePeriod = period;
    dragState.sourceIndex = index;
    dragState.taskData = { ...task };

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(dragState));
    el.style.opacity = '0.4';
}

function handleDragEnd(e) {
    e.target.style.opacity = '1';
    document.querySelectorAll('.drop-zone').forEach(dz => dz.classList.remove('active'));
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

// Retorna tarefas de rotina para exibição (NÃO persiste em allTasksData)
function getRoutineTasksForDate(dateStr) {
    const tasks = [];
    const dateParts = dateStr.split('-');
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const dayOfWeek = dateObj.getDay();

    allRecurringTasks.forEach(habit => {
        let isForToday = false;
        if (habit.daysOfWeek && Array.isArray(habit.daysOfWeek)) {
            if (habit.daysOfWeek.includes(dayOfWeek)) isForToday = true;
        } else if (habit.isHabit) {
            isForToday = true;
        }

        if (isForToday) {
            const isCompleted = habitsHistory[habit.text] && habitsHistory[habit.text][dateStr];
            tasks.push({
                text: habit.text,
                completed: !!isCompleted,
                color: habit.color || 'default',
                priority: habit.priority || 'none',
                isRecurring: true,
                isHabit: true,
                recurrence: habit.daysOfWeek
            });
        }
    });
    return tasks;
}

// Compatibilidade: manter hydrateRoutineForDate como no-op para não quebrar chamadas existentes
function hydrateRoutineForDate(dateStr) {
    // Não faz mais nada - rotinas são geradas dinamicamente
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!dragState.taskData) return;

    // Determinar período de destino
    // Se dropped na coluna (currentTarget), usa dataset da coluna.
    // Se dropped em dropZone específica, usa dataset dela.
    let targetDate, targetPeriod, insertAt;

    const dropZone = e.target.closest('.drop-zone');
    const col = e.target.closest('.day-column');

    if (dropZone) {
        targetDate = dropZone.dataset.date;
        targetPeriod = dropZone.dataset.period;
        insertAt = parseInt(dropZone.dataset.insertAt);
    } else if (col) {
        targetDate = col.dataset.date;
        targetPeriod = 'Tarefas';
        insertAt = 999999;
    } else {
        return; // Drop inválido
    }

    // Remover da posição antiga
    const sourceArray = allTasksData[dragState.sourceDate]?.[dragState.sourcePeriod];
    if (sourceArray) {
        sourceArray.splice(dragState.sourceIndex, 1);

        // Ajustar index se for a mesma lista e moveu pra cima
        if (dragState.sourceDate === targetDate && dragState.sourcePeriod === targetPeriod && dragState.sourceIndex < insertAt) {
            insertAt--;
        }

        // Limpar período vazio
        if (sourceArray.length === 0) {
            delete allTasksData[dragState.sourceDate][dragState.sourcePeriod];
        }
    }

    // Adicionar na nova posição
    if (!allTasksData[targetDate]) allTasksData[targetDate] = {};
    if (!allTasksData[targetDate][targetPeriod]) allTasksData[targetDate][targetPeriod] = [];

    // Inserir na posição correta (insertAt)
    // Se insertAt for muito grande, splice coloca no final, que é o comportamento desejado para colunas
    // Se insertAt for indefinido?
    if (isNaN(insertAt)) insertAt = allTasksData[targetDate][targetPeriod].length;

    allTasksData[targetDate][targetPeriod].splice(insertAt, 0, dragState.taskData);

    // SALVAR!
    saveToLocalStorage();

    // Sincronizar com Supabase
    if (typeof syncDateToSupabase === 'function') {
        syncDateToSupabase(dragState.sourceDate);
        if (targetDate !== dragState.sourceDate) {
            syncDateToSupabase(targetDate);
        }
    }

    // Limpar estado
    dragState = {
        sourceDate: null,
        sourcePeriod: null,
        sourceIndex: null,
        taskData: null
    };

    document.querySelectorAll('.day-column, .drop-zone').forEach(el => el.classList.remove('active', 'drag-over'));

    // Re-renderizar
    renderView();
}

function createDropZone(day, dateStr, period, index) {
    const dz = document.createElement('div');
    dz.className = 'drop-zone';
    dz.dataset.date = dateStr;
    dz.dataset.period = period;
    dz.dataset.insertAt = index.toString();

    dz.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add('active');
    });

    dz.addEventListener('dragleave', () => {
        dz.classList.remove('active');
    });

    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove('active');

        if (!dragState.taskData) return;

        const targetDateStr = dateStr;
        const targetPeriod = period;
        let insertAt = parseInt(dz.dataset.insertAt);

        const sourceDateStr = dragState.sourceDate;
        const sourcePeriod = dragState.sourcePeriod;
        const sourceIndex = dragState.sourceIndex;

        // Remover da posição antiga
        const sourceArray = allTasksData[sourceDateStr]?.[sourcePeriod];
        if (sourceArray) {
            sourceArray.splice(sourceIndex, 1);

            // Ajustar index se for a mesma lista
            if (sourceDateStr === targetDateStr && sourcePeriod === targetPeriod && sourceIndex < insertAt) {
                insertAt--;
            }

            // Limpar período vazio
            if (sourceArray.length === 0) {
                delete allTasksData[sourceDateStr][sourcePeriod];
            }
        }

        // Garantir estruturas
        if (!allTasksData[targetDateStr]) allTasksData[targetDateStr] = {};
        if (!allTasksData[targetDateStr][targetPeriod]) allTasksData[targetDateStr][targetPeriod] = [];

        // Inserir na nova posição
        allTasksData[targetDateStr][targetPeriod].splice(insertAt, 0, dragState.taskData);

        // SALVAR!
        saveToLocalStorage();

        // Sincronizar com Supabase
        syncDateToSupabase(sourceDateStr);
        if (targetDateStr !== sourceDateStr) {
            syncDateToSupabase(targetDateStr);
        }

        // Limpar estado
        dragState = {
            sourceDate: null,
            sourcePeriod: null,
            sourceIndex: null,
            taskData: null
        };

        // Re-renderizar
        renderView();
    });

    return dz;
}


// Retorna a data local no formato YYYY-MM-DD (sem bug de fuso horário UTC)
function localDateStr(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekDates(weekOffset = 0) {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Domingo
    const diff = currentDay === 0 ? -6 : 1 - currentDay; // Ajustar para segunda-feira

    const monday = new Date(today);
    monday.setDate(today.getDate() + diff + (weekOffset * 7));
    monday.setHours(0, 0, 0, 0);

    const dates = [];
    const dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

    for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        dates.push({
            name: dayNames[i],
            date: date,
            dateStr: localDateStr(date)
        });
    }

    return dates;
}

function getMonthDates(monthOffset = 0) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + monthOffset;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    return { firstDay, lastDay, month: firstDay.getMonth(), year: firstDay.getFullYear() };
}

function getWeekLabel(weekOffset) {
    const dates = getWeekDates(weekOffset);
    const firstDate = dates[0].date;
    const lastDate = dates[6].date;

    if (weekOffset === 0) return 'Semana Atual';

    const format = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${format(firstDate)} - ${format(lastDate)}`;
}

function changeWeek(direction) {
    currentWeekOffset += direction;
    renderView();
}

function goToCurrentWeek() {
    currentWeekOffset = 0;
    renderView();
}

// --- Core Functions ---

async function checkAuth() {
    console.log('[Auth] Checking auth...');
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    console.log('[Auth] Session:', session ? 'found' : 'not found', error);

    if (session) {
        console.log('[Auth] User logged in:', session.user.email);
        currentUser = session.user;
        document.getElementById('authModal').classList.remove('show');
        document.getElementById('userEmail').textContent = session.user.email;
        await loadDataFromSupabase();
        renderView();
    } else {
        console.log('[Auth] No session, showing login');
        document.getElementById('authModal').classList.add('show');
    }
}

async function signUp(email, password) {
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) { showAuthMessage(error.message); return false; }
    showAuthMessage('Conta criada! Fazendo login...', 'success');
    await signIn(email, password);
    return true;
}

async function signIn(email, password) {
    // Salvar preferência de "manter conectado" ANTES do login
    const keepEl = document.getElementById('keepLoggedIn');
    const keepLoggedIn = keepEl ? keepEl.checked : true;
    localStorage.setItem('flowly_persist_session', keepLoggedIn.toString());

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { showAuthMessage(error.message); return false; }

    currentUser = data.user;
    document.getElementById('authModal').classList.remove('show');
    document.getElementById('userEmail').textContent = data.user.email;
    await migrateLocalDataToSupabase();
    await loadDataFromSupabase();
    renderView(); // Renderizar a view após login
    return true;
}

async function signOut() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    document.getElementById('authModal').classList.add('show');
    location.reload();
}

function showAuthMessage(msg, type = 'error') {
    const el = document.getElementById('authMessage');
    el.textContent = msg;
    el.style.color = type === 'error' ? '#ff453a' : '#30d158';
}

// --- Sync Logic ---

async function migrateLocalDataToSupabase() {
    if (!currentUser) return;

    // Verificar se já existem dados no Supabase para este usuário
    const { data: existingTasks } = await supabaseClient.from('tasks').select('id').eq('user_id', currentUser.id).limit(1);
    const hasSupabaseData = existingTasks && existingTasks.length > 0;

    // Se já tem dados no Supabase, não sobrescreve (dados da nuvem têm prioridade)
    if (hasSupabaseData) {
        localStorage.removeItem('weekData');
        return;
    }

    // Se não tem dados no Supabase, sobe os dados locais (allTasksData)
    const localTasksData = JSON.parse(localStorage.getItem('allTasksData') || '{}');
    const inserts = [];

    Object.entries(localTasksData).forEach(([dateStr, periods]) => {
        // Só migra datas no formato YYYY-MM-DD (ignora nomes de dias antigos)
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
        // Atualizar supabaseId nas tarefas locais
        if (inserted) {
            inserted.forEach(row => {
                const tasks = allTasksData[row.day]?.[row.period];
                if (tasks) {
                    const match = tasks.find(t => t.text === row.text && !t.supabaseId);
                    if (match) match.supabaseId = row.id;
                }
            });
            localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
        }
    }

    localStorage.removeItem('weekData');
}

async function loadDataFromSupabase() {
    if (!currentUser) return;
    const { data: tasks, error } = await supabaseClient.from('tasks').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: true });

    const idsToDelete = [];
    allTasksData = {};
    const remoteDailyRoutine = [];
    const remoteRecurringTasks = [];

    if (tasks && tasks.length > 0) {
        tasks.forEach(task => {
            // Handle Routine Definitions (legacy)
            if (task.day === 'ROUTINE') {
                remoteDailyRoutine.push({
                    text: task.text,
                    completed: false,
                    color: task.color || 'default',
                    isHabit: true
                });
                return;
            }
            // Handle Recurring Task Definitions
            if (task.day === 'RECURRING') {
                remoteRecurringTasks.push({
                    text: task.text,
                    daysOfWeek: (() => { try { return JSON.parse(task.period); } catch(e) { return [0,1,2,3,4,5,6]; } })(),
                    priority: 'none',
                    color: task.color || 'default',
                    isHabit: task.is_habit || false,
                    createdAt: task.created_at || new Date().toISOString()
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
    }

    // Sync allRecurringTasks - Supabase é fonte de verdade
    if (remoteRecurringTasks.length > 0) {
        allRecurringTasks = remoteRecurringTasks;
        localStorage.setItem('allRecurringTasks', JSON.stringify(allRecurringTasks));
    } else if (allRecurringTasks.length > 0) {
        // Não tem no Supabase mas tem local -> enviar
        await syncRecurringTasksToSupabase();
    }

    if (typeof normalizeAllTasks === 'function') normalizeAllTasks();
    localStorage.setItem('allTasksData', JSON.stringify(allTasksData));

    const { data: habits } = await supabaseClient.from('habits_history').select('*').eq('user_id', currentUser.id);
    if (habits) {
        habitsHistory = {};
        habits.forEach(h => {
            if (!habitsHistory[h.habit_name]) habitsHistory[h.habit_name] = {};
            habitsHistory[h.habit_name][h.date] = h.completed;
        });
    }

    // Realtime Setup
    if (!window._flowlySubscription) {
        console.log('[Realtime] Iniciando subscrição...');
        window._flowlySubscription = supabaseClient
            .channel('flowly_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
                const uid = payload.new?.user_id || payload.old?.user_id;
                if (uid === currentUser.id) {
                    console.log('[Realtime] Tasks atualizadas.');
                    if (window._rtTimeout) clearTimeout(window._rtTimeout);
                    window._rtTimeout = setTimeout(async () => {
                        await loadDataFromSupabase();
                        renderView();
                        if (typeof renderRoutineView === 'function') renderRoutineView();
                    }, 500);
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'habits_history' }, (payload) => {
                const uid = payload.new?.user_id || payload.old?.user_id;
                if (uid === currentUser.id) {
                    console.log('[Realtime] Habits atualizados.');
                    if (window._rtTimeout) clearTimeout(window._rtTimeout);
                    window._rtTimeout = setTimeout(async () => {
                        await loadDataFromSupabase();
                        renderRoutineView();
                    }, 500);
                }
            })
            .subscribe();
    }
}

async function syncDailyRoutineToSupabase() {
    if (!currentUser) return;
    // Remove antigas definiÇÕES
    await supabaseClient.from('tasks').delete().eq('user_id', currentUser.id).eq('day', 'ROUTINE');

    // Insere novas
    if (dailyRoutine.length > 0) {
        const inserts = dailyRoutine.map(t => ({
            user_id: currentUser.id,
            day: 'ROUTINE',
            period: 'daily',
            text: t.text,
            completed: false,
            is_habit: true,
            color: t.color || 'default'
        }));
        await supabaseClient.from('tasks').insert(inserts);
    }
}

// Sincroniza allRecurringTasks com Supabase (usando day='RECURRING')
async function syncRecurringTasksToSupabase() {
    if (!currentUser) return;
    try {
        await supabaseClient.from('tasks').delete()
            .eq('user_id', currentUser.id)
            .eq('day', 'RECURRING');
        if (allRecurringTasks.length > 0) {
            const inserts = allRecurringTasks.map(t => ({
                user_id: currentUser.id,
                day: 'RECURRING',
                period: JSON.stringify(t.daysOfWeek || []),
                text: t.text,
                completed: false,
                is_habit: t.isHabit || false,
                color: t.color || 'default'
            }));
            await supabaseClient.from('tasks').insert(inserts);
        }
    } catch (e) { /* silencioso */ }
}

async function syncTaskToSupabase(dateStr, period, task) {
    if (!currentUser) return;
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
            user_id: currentUser.id,
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

async function deleteTaskFromSupabase(task) {
    if (!currentUser || !task.supabaseId) return;
    await supabaseClient.from('tasks').delete().eq('id', task.supabaseId);
}

async function syncHabitToSupabase(habitText, date, completed) {
    if (!currentUser) return;
    await supabaseClient.from('habits_history').upsert({
        user_id: currentUser.id, habit_name: habitText, date, completed
    }, { onConflict: 'user_id,habit_name,date' });
}

let _isSyncingDate = false;



function loadFromLocalStorage() {
    const saved = localStorage.getItem('weekData');
    if (saved) {
        const savedData = JSON.parse(saved);
        Object.keys(weekData).forEach(day => { if (savedData[day]) weekData[day] = savedData[day]; });
    }
}

// --- Render Functions ---

// --- Habits & Analytics Logic ---

function getAllHabits() {
    const habits = [], habitMap = new Map();
    const today = localDateStr();

    // Adicionar todas recorrentes (inclui dailyRoutine e weeklyRecurring unificados)
    allRecurringTasks.forEach(task => {
        if ((task.isHabit || (task.daysOfWeek && task.daysOfWeek.length > 0)) && !habitMap.has(task.text)) {
            const isCompleted = habitsHistory[task.text] && habitsHistory[task.text][today];
            habitMap.set(task.text, {
                text: task.text,
                color: task.color,
                completedToday: !!isCompleted,
                isHabit: true
            });
        }
    });

    // Fallback dailyRoutine legacy
    dailyRoutine.forEach(task => {
        if (!habitMap.has(task.text)) {
            const isCompleted = habitsHistory[task.text] && habitsHistory[task.text][today];
            habitMap.set(task.text, { text: task.text, color: task.color, completedToday: !!isCompleted, isHabit: true });
        }
    });

    return Array.from(habitMap.values());
}

function getHabitStreak(habitText) { if (!habitsHistory[habitText]) return 0; const today = new Date(); let streak = 0, currentDate = new Date(today); while (true) { const dateKey = localDateStr(currentDate); if (habitsHistory[habitText][dateKey]) { streak++; currentDate.setDate(currentDate.getDate() - 1); } else { break; } } return streak; }

function getHabitCompletionRate(habitText, days = 30) { if (!habitsHistory[habitText]) return 0; const today = new Date(); let completed = 0; for (let i = 0; i < days; i++) { const date = new Date(today); date.setDate(date.getDate() - i); const dateKey = localDateStr(date); if (habitsHistory[habitText][dateKey]) { completed++; } } return Math.round((completed / days) * 100); }

function markHabitCompleted(habitText, completed) { const today = localDateStr(); if (!habitsHistory[habitText]) { habitsHistory[habitText] = {}; } if (completed) { habitsHistory[habitText][today] = true; } else { delete habitsHistory[habitText][today]; } localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory)); syncHabitToSupabase(habitText, today, completed); }

window.toggleHabitToday = function (habitText, completed) {
    markHabitCompleted(habitText, completed);
    renderView();
    if (currentView === 'routine' && typeof renderRoutineView === 'function') renderRoutineView();
}

function removeHabit(habitText) {
    if (!confirm(`Tem certeza que deseja remover "${habitText}" dos hábitos?\n\nIsso irá desmarcar esta tarefa como hábito em todas as ocorrências.`)) return;

    // Remover de allRecurringTasks
    const recurringIdx = allRecurringTasks.findIndex(t => t.text === habitText);
    if (recurringIdx !== -1) {
        allRecurringTasks.splice(recurringIdx, 1);
        saveToLocalStorage();
        syncRecurringTasksToSupabase();
    }

    // Desmarcar como hábito em todas as tarefas existentes
    Object.entries(allTasksData).forEach(([dateStr, periods]) => {
        Object.entries(periods).forEach(([period, tasks]) => {
            tasks.forEach(task => {
                if (task.text === habitText && task.isHabit) {
                    task.isHabit = false;
                }
            });
        });
    });

    // Limpar histórico do hábito
    if (habitsHistory[habitText]) {
        delete habitsHistory[habitText];
        localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory));
    }

    saveToLocalStorage();
    if (currentView === 'routine') renderRoutineView();
    setTimeout(() => lucide.createIcons(), 0);
}

function renderHabitsView() {
    const view = document.getElementById('habitsView'), habits = getAllHabits();
    if (habits.length === 0) { view.innerHTML = '<div class="text-center py-20"><p class="text-gray-400 text-lg">Nenhum hábito rastreado ainda.</p><p class="text-gray-600 text-sm mt-2">Marque tasks como hábitos no menu de contexto (botão direito).</p></div>'; return; }

    let html = `<div class="max-w-5xl mx-auto"><h2 class="text-3xl font-bold mb-8 text-white flex items-center gap-3"><i data-lucide="repeat" style="width: 28px; height: 28px;"></i> Meus Hábitos</h2><div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6"><div class="text-gray-400 text-sm mb-1 uppercase tracking-wider font-semibold">Total de Hábitos</div><div class="text-3xl font-bold text-white">${habits.length}</div></div>
            <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6"><div class="text-gray-400 text-sm mb-1 uppercase tracking-wider font-semibold">Concluídos Hoje</div><div class="text-3xl font-bold text-[#30d158]">${habits.filter(h => h.completedToday).length}</div></div>
            <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6"><div class="text-gray-400 text-sm mb-1 uppercase tracking-wider font-semibold">Taxa Hoje</div><div class="text-3xl font-bold text-[#0A84FF]">${habits.length > 0 ? Math.round((habits.filter(h => h.completedToday).length / habits.length) * 100) : 0}%</div></div></div><div class="space-y-3">`;

    habits.forEach((habit, index) => {
        const streak = getHabitStreak(habit.text), completionRate = getHabitCompletionRate(habit.text, 30);
        html += `<div class="bg-[#1c1c1e] bg-opacity-40 backdrop-blur-md border border-white/5 rounded-xl p-5 hover:bg-opacity-60 transition-all flex items-center justify-between gap-4 group">
                <div class="flex items-center gap-4 flex-1">
                    <input type="checkbox" class="checkbox-custom mt-1" ${habit.completedToday ? 'checked' : ''} onchange="toggleHabitToday('${habit.text.replace(/'/g, "\\'")}', this.checked)">
                    <div class="flex-1">
                        <div class="color-${habit.color} font-medium text-lg mb-1 group-hover:text-white transition-colors">${habit.text}</div>
                        <div class="flex items-center gap-3 text-xs text-gray-400">
                            ${streak > 0 ? `<span class="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium flex items-center gap-1"><i data-lucide="flame" style="width: 14px; height: 14px;"></i> ${streak} dias</span>` : ''}
                            <span>${completionRate}% consistency (30d)</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="w-32 h-1.5 bg-gray-700/30 rounded-full overflow-hidden flex-shrink-0"><div class="h-full bg-blue-500 rounded-full transition-all duration-500" style="width: ${completionRate}%"></div></div>
                    <button onclick="removeHabit('${habit.text.replace(/'/g, "\\'")}');" class="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-lg" title="Remover hábito">
                        <i data-lucide="x" class="text-red-400" style="width: 18px; height: 18px;"></i>
                    </button>
                </div>
                </div>`;
    });
    html += `</div></div>`;
    view.innerHTML = html;
}

function renderAnalyticsView() {
    const view = document.getElementById('analyticsView');

    // Calcular dados da semana atual
    const weekDates = getWeekDates(0);
    let totalTasksWeek = 0, completedTasksWeek = 0;
    let totalTasksToday = 0, completedTasksToday = 0;
    const today = localDateStr();

    // Estatísticas por dia da semana
    const dayStats = {};

    // Contar tarefas de toda a semana
    weekDates.forEach(({ name, dateStr }) => {
        const dayTasks = allTasksData[dateStr] || {};
        let dayTotal = 0, dayCompleted = 0;

        // Contar apenas tarefas normais persistidas (excluir período 'Rotina')
        Object.entries(dayTasks).forEach(([period, tasks]) => {
            if (period === 'Rotina') return;
            if (Array.isArray(tasks)) {
                tasks.forEach(task => {
                    dayTotal++;
                    totalTasksWeek++;
                    if (task.completed) {
                        dayCompleted++;
                        completedTasksWeek++;
                    }

                    if (dateStr === today) {
                        totalTasksToday++;
                        if (task.completed) completedTasksToday++;
                    }
                });
            }
        });

        // Adicionar rotina + recorrentes semanais (geradas dinamicamente)
        const routineForDay = getRoutineTasksForDate(dateStr);
        dayTotal += routineForDay.length;
        totalTasksWeek += routineForDay.length;
        dayCompleted += routineForDay.filter(t => t.completed).length;
        completedTasksWeek += routineForDay.filter(t => t.completed).length;

        if (dateStr === today) {
            totalTasksToday += routineForDay.length;
            completedTasksToday += routineForDay.filter(t => t.completed).length;
        }

        dayStats[name] = { total: dayTotal, completed: dayCompleted };
    });

    // Dados de hábitos (para o card de hábitos)
    const totalHabits = getAllHabits().length;
    const completedHabitsToday = getAllHabits().filter(h => h.completedToday).length;

    const todayRate = totalTasksToday > 0 ? Math.round((completedTasksToday / totalTasksToday) * 100) : 0;
    const weekRate = totalTasksWeek > 0 ? Math.round((completedTasksWeek / totalTasksWeek) * 100) : 0;
    const habitRate = totalHabits > 0 ? Math.round((completedHabitsToday / totalHabits) * 100) : 0;

    // Calcular streak (dias consecutivos com todas as tarefas completas)
    let currentStreak = 0;
    const checkDate = new Date();
    for (let i = 0; i < 30; i++) {
        const cDateStr = localDateStr(checkDate);
        const cDayTasks = allTasksData[cDateStr] || {};
        let dayTotal = 0;
        let dayCompleted = 0;

        // Contar tarefas normais (excluir período 'Rotina')
        Object.entries(cDayTasks).forEach(([period, tasks]) => {
            if (period === 'Rotina') return;
            if (Array.isArray(tasks)) {
                dayTotal += tasks.length;
                dayCompleted += tasks.filter(t => t.completed).length;
            }
        });

        // Contar rotina + recorrentes
        const routineForCheck = getRoutineTasksForDate(cDateStr);
        dayTotal += routineForCheck.length;
        dayCompleted += routineForCheck.filter(t => t.completed).length;

        if (dayTotal > 0 && dayCompleted === dayTotal) {
            currentStreak++;
        } else if (i > 0 || (i === 0 && dayTotal > 0)) {
            break;
        }
        checkDate.setDate(checkDate.getDate() - 1);
    }

    let html = `<div class="max-w-6xl mx-auto">
                <h2 class="text-3xl font-bold mb-2 text-white flex items-center gap-3">
                    <i data-lucide="bar-chart-3" style="width: 28px; height: 28px;"></i> Analytics
                </h2>
                <p class="text-gray-400 text-sm mb-8">Acompanhe sua produtividade e evolução</p>

                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">`;

    // Card customizado com cores dinÃ¢micas
    const card = (label, val, sub, gradient = 'from-blue-400 to-indigo-400', icon = '') => {
        return `<div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                    <div class="text-gray-400 text-sm mb-2 uppercase tracking-wider font-semibold">${label}</div>
                    <div class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${gradient}">${icon}${val}</div>
                    <div class="text-xs text-gray-500 mt-2">${sub}</div>
                </div>`;
    };

    // Cards com cores dinÃ¢micas
    const todayGradient = todayRate >= 70 ? 'from-green-400 to-emerald-400' : todayRate >= 40 ? 'from-orange-400 to-yellow-400' : 'from-red-400 to-pink-400';
    const todayIcon = todayRate >= 70 ? '&#128293; ' : todayRate >= 40 ? '&#9889; ' : '&#128164; ';

    // Calcular semana passada para comparação
    const lastWeekDates = getWeekDates(-1);
    let lastWeekTotal = 0, lastWeekCompleted = 0;
    lastWeekDates.forEach(({ dateStr }) => {
        const dayTasks = allTasksData[dateStr] || {};
        Object.entries(dayTasks).forEach(([period, tasks]) => {
            if (period === 'Rotina') return;
            if (Array.isArray(tasks)) {
                lastWeekTotal += tasks.length;
                lastWeekCompleted += tasks.filter(t => t.completed).length;
            }
        });
        // Rotina + recorrentes
        const routineForLW = getRoutineTasksForDate(dateStr);
        lastWeekTotal += routineForLW.length;
        lastWeekCompleted += routineForLW.filter(t => t.completed).length;
    });
    const lastWeekRate = lastWeekTotal > 0 ? Math.round((lastWeekCompleted / lastWeekTotal) * 100) : 0;
    const weekDiff = weekRate - lastWeekRate;
    const weekTrend = weekDiff > 0 ? '&#128200;' : weekDiff < 0 ? '&#128201;' : '&#10145;';
    const weekCompare = weekDiff !== 0 ? `${weekTrend} ${Math.abs(weekDiff)}% vs semana anterior` : 'Mesmo que semana anterior';

    // Melhor e pior dia
    const dayRates = Object.entries(dayStats).map(([name, stats]) => ({
        name,
        rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
        total: stats.total
    })).filter(d => d.total > 0);

    const bestDay = dayRates.reduce((best, day) => day.rate > best.rate ? day : best, { name: '-', rate: 0 });
    const worstDay = dayRates.reduce((worst, day) => day.rate < worst.rate ? day : worst, { name: '-', rate: 100 });

    html += card('Hoje', `${todayIcon}${todayRate}%`, `${completedTasksToday}/${totalTasksToday} tarefas`, todayGradient);
    html += card('Semana', `${weekRate}%`, weekCompare, weekDiff > 0 ? 'from-green-400 to-emerald-400' : weekDiff < 0 ? 'from-red-400 to-pink-400' : 'from-blue-400 to-indigo-400');
    html += card('Hábitos', `${habitRate}%`, `${completedHabitsToday}/${totalHabits} concluídos`, habitRate === 100 && totalHabits > 0 ? 'from-green-400 to-emerald-400' : 'from-purple-400 to-pink-400');
    html += card('Streak', currentStreak > 0 ? `${currentStreak} ${currentStreak === 1 ? 'dia' : 'dias'}` : '0', currentStreak > 0 ? '🔥 Dias perfeitos' : 'Complete 100% hoje!', currentStreak >= 7 ? 'from-orange-400 to-red-400' : 'from-gray-400 to-gray-500');

    html += `</div>

            <!-- Gráficos -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                    <h3 class="text-lg font-semibold mb-6 text-gray-200 flex items-center gap-2">
                        <i data-lucide="calendar-days" style="width: 20px; height: 20px;"></i>
                        Progresso da Semana
                    </h3>
                    <canvas id="weekChart"></canvas>
                </div>
                <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                    <h3 class="text-lg font-semibold mb-6 text-gray-200 flex items-center gap-2">
                        <i data-lucide="target" style="width: 20px; height: 20px;"></i>
                        Status de Hábitos
                    </h3>
                    <div class="h-64 flex items-center justify-center"><canvas id="habitsChart"></canvas></div>
                </div>
            </div>

            <!-- Gráfico de Progresso Mensal -->
            <div class="mt-6 bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2">
                        <i data-lucide="trending-up" style="width: 20px; height: 20px;"></i>
                        Progresso do Mês
                    </h3>
                    <span id="monthChartLabel" class="text-sm text-gray-400"></span>
                </div>
                <canvas id="monthChart"></canvas>
            </div>

            <!-- Melhor e Pior Dia da Semana -->
            <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                    <h3 class="text-sm font-semibold mb-3 text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <i data-lucide="trophy" style="width: 16px; height: 16px;"></i>
                        Melhor Dia da Semana
                    </h3>
                    ${bestDay.name !== '-' ? `
                        <div class="flex items-center justify-between">
                            <div class="text-2xl font-bold text-green-400">${bestDay.name}</div>
                            <div class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                                ${bestDay.rate}%
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 mt-2">Maior taxa de conclusão esta semana</p>
                    ` : '<p class="text-gray-500 text-sm">Aguardando dados...</p>'}
                </div>
                <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                    <h3 class="text-sm font-semibold mb-3 text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <i data-lucide="alert-circle" style="width: 16px; height: 16px;"></i>
                        Dia que Precisa de Atenção
                    </h3>
                    ${worstDay.name !== '-' && dayRates.length > 1 ? `
                        <div class="flex items-center justify-between">
                            <div class="text-2xl font-bold text-orange-400">${worstDay.name}</div>
                            <div class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
                                ${worstDay.rate}%
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 mt-2">Menor taxa de conclusão esta semana</p>
                    ` : '<p class="text-gray-500 text-sm">Aguardando dados...</p>'}
                </div>
            </div>

            <!-- Ranking de Hábitos -->
            <div class="mt-6 bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h3 class="text-lg font-semibold mb-4 text-gray-200 flex items-center gap-2">
                    <i data-lucide="award" style="width: 20px; height: 20px;"></i>
                    Ranking de Hábitos (30 dias)
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${(() => {
            const habits = getAllHabits();
            const habitRanking = habits.map(h => ({
                text: h.text,
                rate: getHabitCompletionRate(h.text, 30),
                streak: getHabitStreak(h.text)
            })).sort((a, b) => b.rate - a.rate);

            if (habitRanking.length === 0) {
                return '<p class="text-gray-500 text-sm col-span-2">Nenhum hábito rastreado ainda.</p>';
            }

            return habitRanking.slice(0, 6).map((habit, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}Âº`;
                const color = habit.rate >= 80 ? 'text-green-400' : habit.rate >= 60 ? 'text-blue-400' : 'text-gray-400';
                return `
                                <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                                    <div class="flex items-center gap-3 flex-1 min-w-0">
                                        <span class="text-xl">${medal}</span>
                                        <div class="flex-1 min-w-0">
                                            <div class="font-medium truncate">${habit.text}</div>
                                            <div class="text-xs text-gray-500">
                                                ${habit.streak > 0 ? `🔥 ${habit.streak} dias` : 'Sem streak'}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="text-xl font-bold ${color}">${habit.rate}%</div>
                                </div>
                            `;
            }).join('');
        })()}
                </div>
            </div>

            <!-- Heatmap Mensal -->
            <div class="mt-6 bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h3 class="text-lg font-semibold mb-4 text-gray-200 flex items-center gap-2">
                    <i data-lucide="calendar-heart" style="width: 20px; height: 20px;"></i>
                    Heatmap de Produtividade (Últimos 30 Dias)
                </h3>
                <div id="heatmapContainer" class="grid grid-cols-7 gap-2">
                    ${(() => {
            let heatmapHtml = '';
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 29);

            const currentDate = new Date(startDate);
            for (let i = 0; i < 30; i++) {
                const dateStr = localDateStr(currentDate);
                const dayTasks = allTasksData[dateStr] || {};
                let total = 0, completed = 0;

                // Tarefas normais (excluir período 'Rotina')
                Object.entries(dayTasks).forEach(([period, tasks]) => {
                    if (period === 'Rotina') return;
                    if (Array.isArray(tasks)) {
                        total += tasks.length;
                        completed += tasks.filter(t => t.completed).length;
                    }
                });
                // Rotina + recorrentes
                const routineHM = getRoutineTasksForDate(dateStr);
                total += routineHM.length;
                completed += routineHM.filter(t => t.completed).length;

                const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
                const intensity = rate >= 80 ? 'bg-green-500' : rate >= 60 ? 'bg-blue-500' : rate >= 40 ? 'bg-orange-500' : rate > 0 ? 'bg-red-500' : 'bg-gray-700';
                const dayNum = currentDate.getDate();
                const isToday = dateStr === localDateStr();

                heatmapHtml += `
                                <div class="relative group">
                                    <div class="${intensity} ${isToday ? 'ring-2 ring-blue-400' : ''} aspect-square rounded-lg flex items-center justify-center text-xs font-bold hover:scale-110 transition-all cursor-pointer"
                                         title="${dateStr}: ${rate}% (${completed}/${total})">
                                        ${dayNum}
                                    </div>
                                    <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                        ${dateStr}<br>${rate}% (${completed}/${total})
                                    </div>
                                </div>
                            `;

                currentDate.setDate(currentDate.getDate() + 1);
            }
            return heatmapHtml;
        })()}
                </div>
                <div class="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 bg-gray-700 rounded"></div>
                        <span>Sem dados</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 bg-red-500 rounded"></div>
                        <span>&lt;40%</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 bg-orange-500 rounded"></div>
                        <span>40-60%</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 bg-blue-500 rounded"></div>
                        <span>60-80%</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 bg-green-500 rounded"></div>
                        <span>â‰¥80%</span>
                    </div>
                </div>
            </div>

            <!-- Insights -->
            <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                ${totalTasksToday > 0 && completedTasksToday === totalTasksToday ? `
                    <div class="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                        <div class="flex items-center gap-2 text-green-400 font-semibold mb-1">
                            <i data-lucide="check-circle" style="width: 18px; height: 18px;"></i>
                            Dia Perfeito!
                        </div>
                        <p class="text-sm text-green-300/80">Você completou todas as tarefas de hoje! ðŸŽ‰</p>
                    </div>
                ` : ''}
                ${currentStreak >= 3 ? `
                    <div class="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                        <div class="flex items-center gap-2 text-orange-400 font-semibold mb-1">
                            <i data-lucide="flame" style="width: 18px; height: 18px;"></i>
                            Streak Ativo!
                        </div>
                        <p class="text-sm text-orange-300/80">${currentStreak} dias consecutivos! Continue assim!</p>
                    </div>
                ` : ''}
                ${habitRate === 100 && totalHabits > 0 ? `
                    <div class="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                        <div class="flex items-center gap-2 text-purple-400 font-semibold mb-1">
                            <i data-lucide="sparkles" style="width: 18px; height: 18px;"></i>
                            Hábitos 100%
                        </div>
                        <p class="text-sm text-purple-300/80">Todos os hábitos completados hoje!</p>
                    </div>
                ` : ''}
            </div>
            </div>`;

    view.innerHTML = html;

    setTimeout(() => {
        // Gráfico de progresso semanal
        const weekCtx = document.getElementById('weekChart');
        if (weekCtx) {
            const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
            const dayData = weekDates.map(({ name }) => {
                const stats = dayStats[name] || { total: 0, completed: 0 };
                return stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
            });

            new Chart(weekCtx, {
                type: 'line',
                data: {
                    labels: dayNames,
                    datasets: [{
                        label: 'Taxa de Conclusão (%)',
                        data: dayData,
                        borderColor: '#0A84FF',
                        backgroundColor: 'rgba(10, 132, 255, 0.1)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#0A84FF'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#888', callback: (value) => value + '%' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#888' }
                        }
                    }
                }
            });
        }

        // Gráfico de hábitos
        const hCtx = document.getElementById('habitsChart');
        if (hCtx) {
            new Chart(hCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Concluídos', 'Pendentes'],
                    datasets: [{
                        data: [completedHabitsToday, totalHabits - completedHabitsToday],
                        backgroundColor: ['#30d158', '#2c2c2e'],
                        borderWidth: 0
                    }]
                },
                options: {
                    cutout: '75%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#9ca3af',
                                usePointStyle: true,
                                pointStyle: 'circle',
                                padding: 15
                            }
                        }
                    }
                }
            });
        }

        // Gráfico de progresso mensal
        const monthCtx = document.getElementById('monthChart');
        if (monthCtx) {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const todayDay = now.getDate();

            const monthLabels = [];
            const monthData = [];
            const pointColors = [];

            for (let d = 1; d <= daysInMonth; d++) {
                monthLabels.push(d);
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dayTasks = allTasksData[dateStr] || {};
                let total = 0, completed = 0;
                // Tarefas normais (excluir período 'Rotina')
                Object.entries(dayTasks).forEach(([period, tasks]) => {
                    if (period === 'Rotina') return;
                    if (Array.isArray(tasks)) {
                        total += tasks.length;
                        completed += tasks.filter(t => t.completed).length;
                    }
                });
                // Rotina + recorrentes
                const routineMC = getRoutineTasksForDate(dateStr);
                total += routineMC.length;
                completed += routineMC.filter(t => t.completed).length;
                const rate = d <= todayDay ? (total > 0 ? Math.round((completed / total) * 100) : null) : null;
                monthData.push(rate);
                if (d === todayDay) pointColors.push('#30D158');
                else if (rate === null) pointColors.push('transparent');
                else if (rate >= 80) pointColors.push('#30D158');
                else if (rate >= 50) pointColors.push('#0A84FF');
                else pointColors.push('#FF453A');
            }

            // Atualiza label do mês
            const labelEl = document.getElementById('monthChartLabel');
            if (labelEl) labelEl.textContent = `${monthNames[month]} ${year}`;

            new Chart(monthCtx, {
                type: 'line',
                data: {
                    labels: monthLabels,
                    datasets: [{
                        label: 'Conclusão diária (%)',
                        data: monthData,
                        borderColor: '#0A84FF',
                        backgroundColor: 'rgba(10, 132, 255, 0.08)',
                        tension: 0.35,
                        fill: true,
                        borderWidth: 2.5,
                        pointRadius: monthData.map((v, i) => {
                            if (v === null) return 0;
                            return i + 1 === todayDay ? 7 : 4;
                        }),
                        pointHoverRadius: 7,
                        pointBackgroundColor: pointColors,
                        pointBorderColor: pointColors,
                        spanGaps: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.85)',
                            titleColor: '#ccc',
                            bodyColor: '#fff',
                            callbacks: {
                                title: (items) => `Dia ${items[0].label}`,
                                label: (item) => item.raw !== null ? ` ${item.raw}% concluído` : ' Sem dados'
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            grid: { color: 'rgba(255,255,255,0.07)' },
                            ticks: {
                                color: '#888',
                                callback: (value) => value + '%',
                                stepSize: 25
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: '#888',
                                maxTicksLimit: 15,
                                callback: function (val, index) {
                                    const day = index + 1;
                                    return day === 1 || day % 5 === 0 || day === daysInMonth ? day : '';
                                }
                            }
                        }
                    }
                }
            });
        }

        lucide.createIcons();
    }, 100);
}

function renderMonth() {
    const view = document.getElementById('monthView');
    const { firstDay, lastDay, month, year } = getMonthDates(currentMonthOffset);

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    let html = `
                <div class="max-w-[1400px] mx-auto">
                    <div class="flex items-center justify-center gap-4 mb-6">
                        <button onclick="currentMonthOffset--; renderView();" class="utility-btn">
                            <i data-lucide="chevron-left" style="width: 18px; height: 18px;"></i>
                        </button>
                        <h2 class="text-2xl font-bold text-white min-w-[200px] text-center">
                            ${monthNames[month]} ${year}
                        </h2>
                        <button onclick="currentMonthOffset++; renderView();" class="utility-btn">
                            <i data-lucide="chevron-right" style="width: 18px; height: 18px;"></i>
                        </button>
                        <button onclick="currentMonthOffset = 0; renderView();" class="btn-secondary text-xs px-3 py-1 ml-4" style="width: auto; padding: 6px 12px;">
                            Mês Atual
                        </button>
                    </div>

                    <!-- Cabeçalho dos dias da semana -->
                    <div class="grid grid-cols-7 gap-2 mb-2">
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Seg</div>
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Ter</div>
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Qua</div>
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Qui</div>
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Sex</div>
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Sáb</div>
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Dom</div>
                    </div>

                    <!-- Grid do calendário -->
                    <div class="grid grid-cols-7 gap-2">
            `;

    // Calcular o primeiro dia da semana (segunda = 0)
    const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    // Preencher dias vazios antes do primeiro dia
    for (let i = 0; i < firstDayOfWeek; i++) {
        html += `<div class="min-h-[120px] bg-[#1c1c1e] bg-opacity-30 rounded-lg"></div>`;
    }

    // Preencher os dias do mês
    const today = localDateStr();
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(year, month, day);
        const dateStr = localDateStr(date);
        const isToday = dateStr === today;

        const dayTasks = allTasksData[dateStr] || {};
        let totalTasks = 0;
        let completedTasks = 0;

        // Conjunto de textos ignorados (recorrentes e rotinas)
        const ignoredTexts = new Set([
            ...weeklyRecurringTasks.map(t => t.text),
            ...dailyRoutine.map(t => t.text)
        ]);

        // Contar apenas tarefas normais persistidas (excluir período 'Rotina' e tarefas que são cópias de recorrentes)
        Object.entries(dayTasks).forEach(([period, tasks]) => {
            if (period === 'Rotina') return;
            if (Array.isArray(tasks)) {
                // Filtra tarefas que não são recorrentes
                const validTasks = tasks.filter(t => !ignoredTexts.has(t.text));
                totalTasks += validTasks.length;
                completedTasks += validTasks.filter(t => t.completed).length;
            }
        });

        const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        html += `
                    <div class="min-h-[120px] bg-[#1c1c1e] bg-opacity-40 rounded-lg p-3 hover:bg-opacity-60 transition-all cursor-pointer border ${isToday ? 'border-blue-500' : 'border-white/5'}"
                         onclick="goToDate('${dateStr}')">
                        <div class="flex items-center justify-between mb-2">
                            <div class="text-sm font-semibold ${isToday ? 'text-blue-400' : 'text-white'}">${day}</div>
                            ${totalTasks > 0 ? `
                                <div class="text-xs text-gray-500">
                                    ${completedTasks}/${totalTasks}
                                </div>
                            ` : ''}
                        </div>

                        ${totalTasks > 0 ? `
                            <div class="w-full h-1 bg-gray-700/30 rounded-full overflow-hidden mb-2">
                                <div class="h-full bg-blue-500 rounded-full transition-all" style="width: ${completionPercent}%"></div>
                            </div>
                        ` : ''}

                        <div class="text-xs text-gray-600 space-y-1">
                            ${totalTasks === 0 ? '<div class="text-center py-4 text-gray-700">Sem tarefas</div>' : ''}
                        </div>
                    </div>
                `;
    }

    html += `
                    </div>
                </div>
            `;

    view.innerHTML = html;
}

function goToDate(dateStr) {
    // Calcular qual semana essa data está
    const targetDate = new Date(dateStr);
    const today = new Date();
    const diffTime = targetDate - today;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    currentWeekOffset = Math.floor(diffDays / 7);

    // Mudar para view semanal
    setView('week');
}

function renderRoutineView() {
    const view = document.getElementById('routineView');
    if (!view) return;
    view.innerHTML = '';

    // --- DATA CALCS ---
    const routineCompletions = JSON.parse(localStorage.getItem('routineCompletions') || '{}');
    const today = new Date();
    const todayStr = localDateStr(today);
    const dayName = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][today.getDay()];

    // 1. Today Stats
    const todayTasks = getRoutineTasksForDate(todayStr);
    const totalToday = todayTasks.length;
    let completedToday = 0;
    todayTasks.forEach(t => { if (t.completed) completedToday++; });
    const todayPercent = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

    // 2. Weekly & Graph
    let totalWeekScheduled = 0;
    let totalWeekCompleted = 0;
    const consistencyData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(today.getDate() - i); const dStr = localDateStr(d);
        const tasksForDay = getRoutineTasksForDate(dStr);
        const count = tasksForDay.length;
        let completed = 0;
        if (count > 0) completed = tasksForDay.filter(t => t.completed).length;
        if (count > 0) { totalWeekScheduled += count; totalWeekCompleted += completed; consistencyData.push({ day: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()], val: Math.round((completed / count) * 100) }); }
        else { consistencyData.push({ day: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()], val: 0 }); }
    }
    const weeklyRate = totalWeekScheduled > 0 ? Math.round((totalWeekCompleted / totalWeekScheduled) * 100) : 0;

    // 3. Streak
    let currentStreak = 0;
    let bestDayCounts = [0, 0, 0, 0, 0, 0, 0];
    let tempStreak = 0;
    for (let i = 0; i < 365; i++) {
        const d = new Date(); d.setDate(today.getDate() - i); const dStr = localDateStr(d);
        const tasks = getRoutineTasksForDate(dStr);
        if (tasks.length > 0) {
            const completed = tasks.filter(t => t.completed).length;
            if (i < 30 && completed === tasks.length) bestDayCounts[d.getDay()]++;
            if (completed === tasks.length) { if (d <= today) tempStreak++; } else { if (d < today) break; }
        }
    }
    currentStreak = tempStreak;
    let maxPerfect = -1; let bestDayIdx = 0;
    bestDayCounts.forEach((count, idx) => { if (count > maxPerfect) { maxPerfect = count; bestDayIdx = idx; } });
    const bestDayLabel = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][bestDayIdx];

    // Heatmap HTML (Standard Clean)
    let htmlHeatmap = '';
    for (let i = 27; i >= 0; i--) {
        const d = new Date(); d.setDate(today.getDate() - i); const dStr = localDateStr(d);
        const tasks = getRoutineTasksForDate(dStr);
        let colorClass = 'bg-[#333]';
        if (tasks.length > 0) {
            const completed = tasks.filter(t => t.completed).length;
            const rate = completed / tasks.length;
            if (rate === 1) colorClass = 'bg-emerald-500';
            else if (rate >= 0.5) colorClass = 'bg-emerald-500/50';
            else if (rate > 0) colorClass = 'bg-red-500/50';
            else if (d < today) colorClass = 'bg-red-900/30';
        }
        htmlHeatmap += `<div class="w-8 h-8 rounded-md ${colorClass} transition-all hover:opacity-80" title="${dStr}"></div>`;
    }

    // Chart SVG
    let points = ''; const mapY = (val) => 90 - (val * 0.8); const stepX = 90 / 6;
    consistencyData.forEach((d, i) => { const x = 5 + (i * stepX); const y = mapY(d.val); points += `${x},${y} `; });
    const areaPath = `5,100 ${points} 95,100`;


    // --- LIST (Clean) ---
    const activeRoutines = allRecurringTasks.filter(t => t.daysOfWeek && t.daysOfWeek.length > 0);
    let habitsHTML = '';

    activeRoutines.forEach((task, idx) => {
        let itemTotal = 0; let itemCompleted = 0; let runningStreak = 0; let streakBroken = false;
        for (let i = 0; i < 30; i++) {
            const d = new Date(); d.setDate(today.getDate() - i); const dStr = localDateStr(d);
            const isScheduled = task.daysOfWeek.includes(d.getDay());
            if (isScheduled) {
                itemTotal++;
                const isDone = habitsHistory[task.text] && habitsHistory[task.text][dStr];
                if (isDone) { itemCompleted++; if (!streakBroken) runningStreak++; } else { if (d < today) streakBroken = true; }
            }
        }
        const itemRate = itemTotal > 0 ? Math.round((itemCompleted / itemTotal) * 100) : 0;
        const isTodayDone = habitsHistory[task.text] && habitsHistory[task.text][todayStr];
        const checkClass = isTodayDone ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-500 text-transparent';

        habitsHTML += `
        <div class="p-4 rounded-xl bg-[#18181b] border border-[#27272a] flex items-center gap-4 cursor-pointer hover:bg-[#27272a]/50 transition-colors" onclick="window.toggleHabitToday('${task.text.replace(/'/g, "\\'")}', ${!isTodayDone})">
            <div class="w-6 h-6 rounded-lg border-2 ${checkClass} flex items-center justify-center transition-colors">
                 <i data-lucide="check" class="w-4 h-4 stroke-[3]"></i>
            </div>
            
            <div class="flex-1">
                <h4 class="text-sm font-semibold text-gray-200 ${isTodayDone ? 'line-through text-gray-500' : ''}">${task.text}</h4>
                <div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span class="flex items-center gap-1"><i data-lucide="flame" class="w-3 h-3 text-orange-500"></i> ${runningStreak} dias</span>
                    <span class="w-1 h-1 bg-gray-600 rounded-full"></span>
                    <span>${itemRate}% mês</span>
                </div>
            </div>
        </div>
        `;
    });


    // --- RENDER HTML (Standard "Bonitinho") ---
    view.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-6 pb-28 px-4 md:px-0 font-sans">
        
        <!-- Header -->
        <div class="flex items-center justify-between pt-2">
            <div>
                <h2 class="text-2xl font-bold text-white">Analytics</h2>
                <p class="text-sm text-gray-400">Resumo da sua consistência</p>
            </div>
            <div class="bg-[#27272a] px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 uppercase tracking-wide">
                ${dayName}
            </div>
        </div>

        <!-- Main Progress Card -->
        <div class="bg-[#18181b] border border-[#27272a] p-6 rounded-2xl shadow-lg relative overflow-hidden">
            <div class="relative z-10 flex flex-col gap-4">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="text-gray-400 text-xs font-bold uppercase tracking-wider">Progresso Hoje</span>
                        <div class="text-4xl font-bold text-white mt-1">${todayPercent}%</div>
                    </div>
                    <div class="bg-[#27272a] w-12 h-12 rounded-full flex items-center justify-center">
                         <span class="text-sm font-bold text-white">${completedToday}<span class="text-gray-500">/${totalToday}</span></span>
                    </div>
                </div>
                
                <div class="w-full bg-[#27272a] h-3 rounded-full overflow-hidden">
                    <div class="bg-blue-500 h-full rounded-full transition-all duration-500" style="width: ${todayPercent}%"></div>
                </div>
            </div>
            <!-- BG Decor -->
            <div class="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
        </div>

        <!-- 3 Stats Cards -->
        <div class="grid grid-cols-3 gap-3">
             <div class="bg-[#18181b] border border-[#27272a] p-4 rounded-xl flex flex-col items-center justify-center gap-2">
                <i data-lucide="flame" class="text-orange-500 w-5 h-5"></i>
                <div class="text-lg font-bold text-white">${currentStreak}</div>
                <div class="text-[10px] text-gray-500 font-bold uppercase">Sequência</div>
             </div>
             <div class="bg-[#18181b] border border-[#27272a] p-4 rounded-xl flex flex-col items-center justify-center gap-2">
                <i data-lucide="bar-chart-2" class="text-blue-500 w-5 h-5"></i>
                <div class="text-lg font-bold text-white">${weeklyRate}%</div>
                <div class="text-[10px] text-gray-500 font-bold uppercase">Semana</div>
             </div>
             <div class="bg-[#18181b] border border-[#27272a] p-4 rounded-xl flex flex-col items-center justify-center gap-2">
                <i data-lucide="trophy" class="text-emerald-500 w-5 h-5"></i>
                <div class="text-lg font-bold text-white truncate max-w-full">${bestDayLabel.substring(0, 3)}</div>
                <div class="text-[10px] text-gray-500 font-bold uppercase">Melhor Dia</div>
             </div>
        </div>

        <!-- Charts Grid -->
        <div class="grid grid-cols-1 gap-4">
            <!-- Heatmap Row -->
             <div class="bg-[#18181b] border border-[#27272a] p-5 rounded-xl">
                 <div class="flex items-center gap-2 mb-4">
                    <i data-lucide="layout-grid" class="w-4 h-4 text-gray-400"></i>
                    <h3 class="text-sm font-bold text-gray-300">Histórico de 30 Dias</h3>
                 </div>
                 <div class="flex justify-center">
                    <div class="grid grid-cols-7 gap-3">
                        ${htmlHeatmap}
                    </div>
                </div>
             </div>
             
             <!-- Line Chart Row -->
             <div class="bg-[#18181b] border border-[#27272a] p-5 rounded-xl">
                <div class="flex items-center gap-2 mb-4">
                    <i data-lucide="trending-up" class="w-4 h-4 text-gray-400"></i>
                    <h3 class="text-sm font-bold text-gray-300">Consistência Semanal</h3>
                 </div>
                <div class="h-32 w-full">
                     <svg class="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <defs>
                            <linearGradient id="chartStandard" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.2"/>
                                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
                            </linearGradient>
                        </defs>
                        <line x1="0" y1="100" x2="100" y2="100" stroke="#333" stroke-width="1"/>
                        <polygon points="${areaPath}" fill="url(#chartStandard)" />
                        <polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
                         ${consistencyData.map((d, i) => {
        const x = 5 + (i * stepX); const y = mapY(d.val);
        return `<circle cx="${x}" cy="${y}" r="3" fill="#18181b" stroke="#3b82f6" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    }).join('')}
                    </svg>
                </div>
                <div class="flex justify-between mt-2 px-2">
                    ${consistencyData.map(d => `<span class="text-[10px] text-gray-500 font-bold">${d.day}</span>`).join('')}
                </div>
             </div>
        </div>

        <!-- Habits List Standard -->
        <div class="py-2">
            <h3 class="text-sm font-bold text-gray-400 mb-4 px-1">Detalhamento</h3>
            <div class="space-y-3">
                ${habitsHTML}
            </div>
            
            <button onclick="setView('week')" class="w-full py-3 mt-4 text-sm font-medium text-gray-400 hover:text-white bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] rounded-xl transition-colors flex items-center justify-center gap-2">
                 Gerenciar Hábitos <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
        </div>
    </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function renderSettingsView() {
    const view = document.getElementById('settingsView');

    // Carregar preferências
    const notifSettings = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
    const notifEnabled = notifSettings.enabled !== false;
    const morningTime = notifSettings.morningTime || '12:00';
    const eveningTime = notifSettings.eveningTime || '22:00';
    const notifPerm = ('Notification' in window) ? Notification.permission : 'unsupported';

    const viewSettings = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
    const weekStart = viewSettings.weekStart || 'mon';
    const showWeekends = viewSettings.showWeekends !== false;
    const hapticsEnabled = viewSettings.haptics !== false;

    // Perfil
    const displayName = localStorage.getItem('flowly_display_name') || (currentUser ? currentUser.email.split('@')[0] : 'Usuário');

    // Badge Notification
    const permBadge = notifPerm === 'granted'
        ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-medium" > Ativo</span> `
        : `<span class="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-medium" > Inativo</span> `;

    // Components
    const settingRow = (icon, title, desc, control) => `
    <div class="flex items-center justify-between gap-4 py-4 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 -mx-2 rounded-lg transition-colors" >
            <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-gray-800/50 flex items-center justify-center flex-shrink-0 text-gray-400">
                    <i data-lucide="${icon}" style="width:16px;height:16px;"></i>
                </div>
                <div class="min-w-0">
                    <div class="text-sm font-medium text-gray-200">${title}</div>
                    <div class="text-xs text-gray-500 mt-0.5 truncate">${desc}</div>
                </div>
            </div>
            <div class="flex-shrink-0">${control}</div>
        </div> `;

    const toggle = (id, checked) => `
    <button id = "${id}" role = "switch" aria - checked="${checked}"
class="relative w-10 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-blue-600' : 'bg-gray-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-[#050505]" >
    <span class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}"></span>
        </button> `;

    view.innerHTML = `
    <div class="max-w-2xl mx-auto py-8 px-4 pb-24" >
            <h2 class="text-2xl font-bold mb-6 text-white flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
                    <i data-lucide="settings-2" class="text-white" style="width:20px;height:20px;"></i>
                </div>
                ConfiguraÇÕES
            </h2>

            <!--PERFIL -->
            <section class="mb-8">
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">Perfil</h3>
                <div class="bg-[#1c1c1e] border border-white/10 rounded-2xl overflow-hidden p-4">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white shadow-inner">
                            ${displayName.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1">
                            <label class="text-xs text-gray-500 mb-1 block">Nome de exibição</label>
                            <input type="text" id="inputDisplayName" value="${displayName}" 
                                class="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                                placeholder="Seu nome">
                        </div>
                    </div>
                    ${currentUser ? `
                    <div class="flex items-center justify-between bg-black/20 rounded-lg p-3">
                        <div class="flex items-center gap-3">
                            <i data-lucide="mail" class="text-gray-500 w-4 h-4"></i>
                            <span class="text-sm text-gray-400">${currentUser.email}</span>
                        </div>
                        <button onclick="signOut()" class="text-xs text-red-400 hover:text-red-300 transition-colors font-medium">Sair</button>
                    </div>` : `
                    <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                        <p class="text-sm text-blue-300 mb-2">Faça login para sincronizar seus dados</p>
                        <button onclick="document.getElementById('authModal').classList.add('show')" class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors">Entrar / Criar Conta</button>
                    </div>`}
                </div>
            </section>

            <!--NOTIFICAÇÕES -->
            <section class="mb-8">
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">NotificaÇÕES</h3>
                <div class="bg-[#1c1c1e] border border-white/10 rounded-2xl overflow-hidden px-5 py-2">
                    <div class="flex items-center justify-between py-4 border-b border-white/5">
                        <div class="flex items-center gap-3">
                            <i data-lucide="bell" class="text-gray-400 w-5 h-5"></i>
                            <div>
                                <div class="text-sm font-medium text-white flex items-center gap-2">Permissão do Sistema ${permBadge}</div>
                                <div class="text-xs text-gray-500"> Necessário para receber lembretes</div>
                            </div>
                        </div>
                        ${toggle('toggleNotif', notifEnabled && notifPerm === 'granted')}
                    </div>
                    
                    ${settingRow('sun', 'Check-in Matinal', 'Horário para planejar o dia',
        `<input type="time" id="inputMorningTime" value="${morningTime}" class="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500">`)}
                    
                    ${settingRow('moon', 'Resumo Noturno', 'Horário para revisar o progresso',
            `<input type="time" id="inputEveningTime" value="${eveningTime}" class="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500">`)}
                </div>
                ${notifPerm === 'denied' ? `<p class="text-xs text-red-400 mt-2 px-2 flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3 h-3"></i> NotificaÇÕES bloqueadas pelo navegador.</p>` : ''}
            </section>

            <!--PREFERÊNCIAS -->
            <section class="mb-8">
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">Preferências</h3>
                <div class="bg-[#1c1c1e] border border-white/10 rounded-2xl overflow-hidden px-5 py-2">
                    ${settingRow('calendar', 'Início da Semana', 'Definir primeiro dia do calendário',
                `<select id="selectWeekStart" class="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500">
                            <option value="mon" ${weekStart === 'mon' ? 'selected' : ''}>Segunda-feira</option>
                            <option value="sun" ${weekStart === 'sun' ? 'selected' : ''}>Domingo</option>
                        </select>`)}
                    
                    ${settingRow('calendar-days', 'Fins de Semana', 'Mostrar Sábado e Domingo', toggle('toggleWeekends', showWeekends))}
                    
                    ${settingRow('smartphone', 'Vibração', 'Feedback tátil ao completar tarefas', toggle('toggleHaptics', hapticsEnabled))}
                </div>
            </section>

            <!--DADOS -->
            <section class="mb-8">
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">Gerenciamento de Dados</h3>
                <div class="grid grid-cols-2 gap-3">
                    <button id="btnExportSettings" class="bg-[#1c1c1e] hover:bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 transition-all hover:border-white/20 group">
                        <i data-lucide="download" class="text-blue-400 mb-1 group-hover:scale-110 transition-transform"></i>
                        <span class="text-sm font-medium text-gray-200">Exportar Backup</span>
                    </button>
                    
                    <label for="fileImportSettings" class="bg-[#1c1c1e] hover:bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 transition-all hover:border-white/20 cursor-pointer group">
                        <i data-lucide="upload" class="text-green-400 mb-1 group-hover:scale-110 transition-transform"></i>
                        <span class="text-sm font-medium text-gray-200">Importar Dados</span>
                        <input type="file" id="fileImportSettings" accept=".json" class="hidden">
                    </label>

                    <button id="btnFixDuplicates" class="bg-[#1c1c1e] hover:bg-orange-900/10 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 transition-all hover:border-orange-500/30 group">
                        <i data-lucide="wrench" class="text-orange-400 mb-1 group-hover:scale-110 transition-transform"></i>
                        <span class="text-sm font-medium text-gray-200">Corrigir Banco</span>
                    </button>

                    <button id="btnClearAllSettings" class="bg-[#1c1c1e] hover:bg-red-900/10 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 transition-all hover:border-red-500/30 group">
                        <i data-lucide="trash-2" class="text-red-400 mb-1 group-hover:scale-110 transition-transform"></i>
                        <span class="text-sm font-medium text-gray-200">Apagar Tudo</span>
                    </button>
                </div>
            </section>

            <div class="text-center mt-12 mb-8">
                <div class="text-xs text-gray-600 font-medium">FLOWLY v1.2</div>
                <div class="text-[10px] text-gray-700 mt-1">Sincronizado via Supabase</div>
            </div>
        </div> `;

    setTimeout(() => {
        lucide.createIcons();

        // --- handlers ---

        // Name Change
        const nameInput = document.getElementById('inputDisplayName');
        if (nameInput) {
            nameInput.onchange = function () {
                localStorage.setItem('flowly_display_name', this.value);
            };
        }

        // Toggle NotificaÇÕES
        const toggleNotif = document.getElementById('toggleNotif');
        if (toggleNotif) {
            toggleNotif.onclick = async function () {
                if (notifPerm === 'denied') return;
                if (notifPerm !== 'granted') {
                    const perm = await Notification.requestPermission();
                    if (perm !== 'granted') { renderSettingsView(); return; }
                    scheduleNotifications();
                }
                const cur = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
                cur.enabled = !(cur.enabled !== false);
                localStorage.setItem('flowly_notif_settings', JSON.stringify(cur));
                renderSettingsView();
            };
        }

        // Inputs Hora
        ['inputMorningTime', 'inputEveningTime'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.onchange = function () {
                    const cur = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
                    if (id === 'inputMorningTime') cur.morningTime = this.value;
                    else cur.eveningTime = this.value;
                    localStorage.setItem('flowly_notif_settings', JSON.stringify(cur));
                    if (Notification.permission === 'granted') scheduleNotifications();
                };
            }
        });

        // Week Start
        const weekSelect = document.getElementById('selectWeekStart');
        if (weekSelect) {
            weekSelect.onchange = function () {
                const cur = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
                cur.weekStart = this.value;
                localStorage.setItem('flowly_view_settings', JSON.stringify(cur));
            };
        }

        // Weekends Toggle
        const toggleW = document.getElementById('toggleWeekends');
        if (toggleW) {
            toggleW.onclick = function () {
                const cur = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
                cur.showWeekends = !(cur.showWeekends !== false);
                localStorage.setItem('flowly_view_settings', JSON.stringify(cur));
                renderSettingsView();
            }
        }

        // Haptics Toggle
        const toggleH = document.getElementById('toggleHaptics');
        if (toggleH) {
            toggleH.onclick = function () {
                const cur = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
                cur.haptics = !(cur.haptics !== false);
                localStorage.setItem('flowly_view_settings', JSON.stringify(cur));
                renderSettingsView();
            }
        }

        // Handlers de dados (Export/Import/Fix/Clear) - Reutilizar lógica existente mas rebindar
        // Export
        document.getElementById('btnExportSettings').onclick = () => {
            const backup = { allTasksData, allRecurringTasks, weeklyRecurringTasks, dailyRoutine, habitsHistory, exportedAt: new Date().toISOString() };
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `flowly - backup - ${localDateStr()}.json`; a.click();
            URL.revokeObjectURL(url);
        };

        // Import
        document.getElementById('fileImportSettings').onchange = function (e) {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (data.allTasksData) { allTasksData = data.allTasksData; localStorage.setItem('allTasksData', JSON.stringify(allTasksData)); }
                    if (data.allRecurringTasks) { allRecurringTasks = data.allRecurringTasks; localStorage.setItem('allRecurringTasks', JSON.stringify(allRecurringTasks)); }
                    if (data.habitsHistory) { habitsHistory = data.habitsHistory; localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory)); }
                    renderView();
                    alert('Backup importado com sucesso!');
                } catch (error) { alert('Erro ao importar backup: ' + error.message); }
            };
            reader.readAsText(file);
        };

        // Fix
        document.getElementById('btnFixDuplicates').onclick = async () => {
            if (!currentUser) { alert('Faça login primeiro!'); return; }
            if (!confirm('Remove duplicatas e tarefas corrompidas do banco. Continuar?')) return;
            const btn = document.getElementById('btnFixDuplicates');
            const originalText = '<i data-lucide="wrench" class="text-orange-400 mb-1 group-hover:scale-110 transition-transform"></i><span class="text-sm font-medium text-gray-200">Corrigir Banco</span>';
            btn.innerHTML = '<span class="text-sm font-medium text-orange-400">Limpando...</span>';
            btn.disabled = true;
            try {
                const { data: allT } = await supabaseClient.from('tasks').select('*').eq('user_id', currentUser.id);
                if (!allT) { alert('Erro ao buscar dados.'); return; }
                const recurringTexts = new Set(allRecurringTasks.map(rt => rt.text));
                const seen = new Map(); const del = [];
                allT.forEach(t => {
                    const d = t.day || '';
                    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !t.period || !t.text || recurringTexts.has(t.text)) { del.push(t.id); return; }
                    const k = `${d}| ${t.period}| ${t.text} `;
                    seen.has(k) ? del.push(t.id) : seen.set(k, t.id);
                });
                for (let i = 0; i < del.length; i += 100) await supabaseClient.from('tasks').delete().in('id', del.slice(i, i + 100));
                allTasksData = {}; localStorage.removeItem('allTasksData');
                await loadDataFromSupabase(); renderView();
                alert(`${del.length} registros removidos.`);
            } catch (e) { alert('Erro: ' + e.message); }
            finally { btn.innerHTML = originalText; btn.disabled = false; lucide.createIcons(); }
        };

        // Clear
        document.getElementById('btnClearAllSettings').onclick = async () => {
            if (!confirm('Apagar TODOS os dados? Isso não pode ser desfeito!')) return;
            const authKeys = Object.keys(localStorage).filter(k => k.startsWith('sb-') || k === 'flowly_persist_session');
            const authData = {}; authKeys.forEach(k => authData[k] = localStorage.getItem(k));
            if (currentUser) {
                await supabaseClient.from('tasks').delete().eq('user_id', currentUser.id);
                await supabaseClient.from('habits_history').delete().eq('user_id', currentUser.id);
            }
            Object.keys(weekData).forEach(d => weekData[d] = {}); // Reset weekData if exists
            allTasksData = {}; habitsHistory = {};
            localStorage.clear();
            Object.entries(authData).forEach(([k, v]) => localStorage.setItem(k, v));
            saveToLocalStorage();
            location.reload();
        };

    }, 50);
}

function deleteWeeklyRecurringTask(index) {
    if (!confirm('Remover esta tarefa semanal recorrente?')) return;
    weeklyRecurringTasks.splice(index, 1);
    localStorage.setItem('weeklyRecurringTasks', JSON.stringify(weeklyRecurringTasks));
    renderSettingsView();
}

async function deleteEmptyTasks() {
    if (!confirm('Tem certeza que deseja excluir todas as tarefas vazias (sem texto)?\n\nEsta ação não pode ser desfeita!')) return;

    let deletedCount = 0;

    // Percorrer todas as datas
    Object.entries(allTasksData).forEach(([dateStr, periods]) => {
        Object.entries(periods).forEach(([period, tasks]) => {
            if (Array.isArray(tasks)) {
                // Filtrar tarefas vazias
                const beforeLength = tasks.length;
                const filteredTasks = tasks.filter(task => task.text && task.text.trim() !== '');
                const afterLength = filteredTasks.length;

                deletedCount += (beforeLength - afterLength);

                // Atualizar array
                allTasksData[dateStr][period] = filteredTasks;

                // Remover período se ficou vazio
                if (filteredTasks.length === 0) {
                    delete allTasksData[dateStr][period];
                }
            }
        });

        // Remover data se não tem mais períodos
        if (Object.keys(allTasksData[dateStr]).length === 0) {
            delete allTasksData[dateStr];
        }
    });

    // Deletar tarefas vazias do Supabase
    if (currentUser) {
        try {
            await supabaseClient
                .from('tasks')
                .delete()
                .eq('user_id', currentUser.id)
                .or('text.is.null,text.eq.');
        } catch (error) {
            console.error('Erro ao deletar tarefas vazias do Supabase:', error);
        }
    }

    saveToLocalStorage();
    renderView();

    alert(`${deletedCount} tarefa(s) vazia(s) foram excluídas!`);
}

function setView(view) {
    currentView = view;
    document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
    if (view === 'month') document.getElementById('btnMonth').classList.add('active');
    if (view === 'week') document.getElementById('btnWeek').classList.add('active');
    if (view === 'today') document.getElementById('btnToday').classList.add('active');
    if (view === 'routine') document.getElementById('btnRoutine').classList.add('active');
    if (view === 'analytics') document.getElementById('btnAnalytics').classList.add('active');
    if (view === 'settings') document.getElementById('btnSettings').classList.add('active');
    renderView();
}

// Função para mostrar modal de criação de tarefa semanal recorrente
function showWeeklyRecurrenceDialog() {
    const modal = document.getElementById('weeklyModal');
    document.getElementById('weeklyTaskText').value = '';
    // Limpar seleção de dias
    document.querySelectorAll('.weekly-day-btn').forEach(b => b.classList.remove('selected'));
    modal.classList.add('show');
    setTimeout(() => {
        document.getElementById('weeklyTaskText').focus();
        lucide.createIcons();
    }, 100);
}

// Retorna as tarefas recorrentes semanais de um dia (apenas para exibição, sem persistir)
function getWeeklyRecurringForDay(dateStr, dayOfWeek) {
    // Usa allRecurringTasks como fonte única
    const existingTexts = new Set();
    Object.values(allTasksData[dateStr] || {}).forEach(tasks => {
        if (Array.isArray(tasks)) tasks.forEach(t => { if (t.text) existingTexts.add(t.text); });
    });
    return allRecurringTasks
        .filter(rt => rt.daysOfWeek && rt.daysOfWeek.includes(dayOfWeek) && !existingTexts.has(rt.text))
        .map(rt => ({
            text: rt.text,
            completed: false,
            color: rt.color,
            isHabit: rt.isHabit,
            isRecurring: true
        }));
}

function renderView() {
    // Ocultar todas as views
    document.getElementById('monthView').classList.add('hidden');
    document.getElementById('weekGrid').classList.add('hidden');

    // Limpar classes extras do weekGrid (como today-container) para não vazar layout
    document.getElementById('weekGrid').classList.remove('today-container');

    document.getElementById('routineView').classList.add('hidden');
    document.getElementById('analyticsView').classList.add('hidden');
    document.getElementById('settingsView').classList.add('hidden');
    document.getElementById('weekNav').classList.add('hidden');

    // Mostrar navegação de semana apenas na view semanal
    if (currentView === 'week') {
        document.getElementById('weekNav').classList.remove('hidden');
    }

    if (currentView === 'month') {
        document.getElementById('monthView').classList.remove('hidden');
        renderMonth();
    } else if (currentView === 'routine') {
        document.getElementById('routineView').classList.remove('hidden');
        renderRoutineView();
    } else if (currentView === 'analytics') {
        document.getElementById('analyticsView').classList.remove('hidden');
        renderAnalyticsView();
    } else if (currentView === 'settings') {
        document.getElementById('settingsView').classList.remove('hidden');
        renderSettingsView();
    } else {
        document.getElementById('weekGrid').classList.remove('hidden');
        if (currentView === 'week') renderWeek();
        else renderToday();
    }

    // Renderizar ícones após atualizar a view
    setTimeout(() => lucide.createIcons(), 0);
}

function renderWeek() {
    const grid = document.getElementById('weekGrid');
    grid.className = '';
    grid.style.cssText = '';
    grid.innerHTML = '';

    // Atualizar label da semana
    document.getElementById('weekLabel').textContent = getWeekLabel(currentWeekOffset);

    const weekDates = getWeekDates(currentWeekOffset);

    // HIDRATAR A SEMANA: Garantir que as rotinas existam no banco para todos os dias visíveis
    weekDates.forEach(({ dateStr }) => hydrateRoutineForDate(dateStr));

    weekDates.forEach(({ name: day, dateStr }) => {
        // Ler tarefas persistidas (sem rotina/recorrentes)
        const dayTasks = allTasksData[dateStr] || {};

        const col = document.createElement('div');
        col.className = 'day-column';
        col.dataset.day = day;
        col.dataset.date = dateStr;

        // Drag Events
        col.addEventListener('dragover', handleDragOver);
        col.addEventListener('drop', handleDrop);

        const todayStr = localDateStr();
        const isToday = dateStr === todayStr;
        const isPast = dateStr < todayStr;

        if (isToday) col.classList.add('today-active');
        if (isPast) col.classList.add('past-day');
        if (dateStr > todayStr) col.classList.add('future-day');

        const header = document.createElement('h2');
        const dayNum = dateStr.split('-')[2].replace(/^0/, '');

        header.className = `flex items-center justify-between mb-3 ${isToday ? 'text-blue-500 font-bold' : 'text-gray-400'} `;
        header.innerHTML = `
    <span> ${day}</span>
        <span class="${isToday ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-gray-500'} text-xs px-2 py-0.5 rounded-full font-mono">${dayNum}</span>
`;
        col.appendChild(header);

        // Flatten all tasks
        const allTasks = [];

        // 1. Adicionar tarefas de rotina e recorrentes semanais (geradas dinamicamente, index = -1)
        const routineTasks = getRoutineTasksForDate(dateStr);
        routineTasks.forEach((task) => {
            allTasks.push({
                task,
                day,
                dateStr,
                period: 'Rotina',
                originalIndex: -1
            });
        });

        // 2. Adicionar tarefas normais persistidas (excluindo período 'Rotina' se foi salvo indevidamente)
        Object.entries(dayTasks).forEach(([period, tasks]) => {
            if (period === 'Rotina') return; // Pular - rotinas são geradas dinamicamente acima
            if (Array.isArray(tasks)) {
                tasks.forEach((task, index) => {
                    if (task && typeof task === 'object') {
                        allTasks.push({
                            task,
                            day,
                            dateStr,
                            period,
                            originalIndex: index
                        });
                    }
                });
            }
        });

        // ===== ORDENAR TAREFAS POR PRIORIDADE =====
        allTasks.sort((a, b) => {
            const taskA = a.task;
            const taskB = b.task;

            // 1. Completadas vão para o FINAL
            if (taskA.completed !== taskB.completed) {
                return taskA.completed ? 1 : -1;
            }

            // 2. Rotinas primeiro
            const isRoutineA = taskA.isRoutine;
            const isRoutineB = taskB.isRoutine;

            if (isRoutineA !== isRoutineB) return isRoutineA ? -1 : 1;

            // 3. Cores
            const colors = { 'red': 1, 'orange': 2, 'yellow': 3, 'green': 4, 'blue': 5, 'purple': 6, 'default': 99 };
            const colorA = colors[taskA.color] || 99;
            const colorB = colors[taskB.color] || 99;

            return colorA - colorB;
        });

        // Renderizar
        allTasks.forEach(({ task, day, dateStr, period, originalIndex }) => {
            col.appendChild(createTaskElement(day, dateStr, period, task, originalIndex));
        });

        // ===== DROP ZONE NO FINAL =====
        const finalDropZone = document.createElement('div');
        finalDropZone.className = 'drop-zone';
        finalDropZone.dataset.date = dateStr;
        finalDropZone.dataset.period = 'Tarefas'; // Default drop target
        finalDropZone.dataset.insertAt = '999999';
        finalDropZone.innerText = '+';
        finalDropZone.onclick = () => addQuickTaskInput(col, day); // Atalho rápido

        finalDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            finalDropZone.classList.add('active');
        });
        finalDropZone.addEventListener('dragleave', () => {
            finalDropZone.classList.remove('active');
        });
        // Drop handler já está no evento global ou específico (mas createDropZone cuida disso?)
        // createDropZone é para ENTRE tarefas. Esta é a final.
        // Precisa de drop handler próprio se não for coberto pelo col
        finalDropZone.addEventListener('drop', (e) => {

            const targetDateStr = dateStr;
            const targetPeriod = 'Tarefas';

            const sourceDateStr = dragState.sourceDate;
            const sourcePeriod = dragState.sourcePeriod;
            const sourceIndex = dragState.sourceIndex;

            // Remover da posição antiga
            const sourceArray = allTasksData[sourceDateStr]?.[sourcePeriod];
            if (sourceArray) {
                sourceArray.splice(sourceIndex, 1);

                // Limpar período vazio
                if (sourceArray.length === 0) {
                    delete allTasksData[sourceDateStr][sourcePeriod];
                }
            }

            // Garantir estruturas
            if (!allTasksData[targetDateStr]) allTasksData[targetDateStr] = {};
            if (!allTasksData[targetDateStr][targetPeriod]) allTasksData[targetDateStr][targetPeriod] = [];

            // Inserir no FINAL
            allTasksData[targetDateStr][targetPeriod].push(dragState.taskData);

            // SALVAR!
            saveToLocalStorage();

            // Sincronizar com Supabase
            syncDateToSupabase(sourceDateStr);
            if (targetDateStr !== sourceDateStr) {
                syncDateToSupabase(targetDateStr);
            }

            // Limpar estado
            dragState = {
                sourceDate: null,
                sourcePeriod: null,
                sourceIndex: null,
                taskData: null
            };

            // Re-renderizar
            renderView();
        });

        col.appendChild(finalDropZone);

        // Adicionar área clicável para nova tarefa (estilo Notion)
        col.addEventListener('click', (e) => {
            // Só adicionar se clicar na área vazia (não em tasks ou inputs existentes)
            if (e.target === col || e.target.tagName === 'H2' || e.target.tagName === 'H3') {
                addQuickTaskInput(col, day);
            }
        });

        grid.appendChild(col);
    });
}

function renderToday() {
    const grid = document.getElementById('weekGrid');
    grid.className = 'today-container';
    grid.style.cssText = '';
    grid.innerHTML = '';

    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const today = days[new Date().getDay()];
    const dateStr = localDateStr();

    // ===== LEFT: Main area =====
    const main = document.createElement('div');
    main.className = 'today-main';

    // Header
    const header = document.createElement('div');
    header.className = 'today-header';
    header.innerHTML = `<h1> ${today}</h1> <p>${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>`;
    main.appendChild(header);

    // Task list container
    const taskList = document.createElement('div');
    taskList.className = 'today-task-list';

    // Buscar tarefas de hoje
    const dayTasks = allTasksData[dateStr] || {};
    const allTasks = [];

    // 1. Rotina diária + recorrentes semanais
    const routineTasks = getRoutineTasksForDate(dateStr);
    routineTasks.forEach((task) => {
        allTasks.push({ task, day: today, dateStr, period: 'Rotina', originalIndex: -1 });
    });

    // 2. Tarefas normais persistidas
    Object.entries(dayTasks).forEach(([period, tasks]) => {
        if (period === 'Rotina') return;
        if (Array.isArray(tasks)) {
            tasks.forEach((task, index) => {
                if (task && typeof task === 'object') {
                    allTasks.push({ task, day: today, dateStr, period, originalIndex: index });
                }
            });
        }
    });

    // Render all tasks
    allTasks.forEach(({ task, day, dateStr, period, originalIndex }) => {
        taskList.appendChild(createTaskElement(day, dateStr, period, task, originalIndex));
    });

    main.appendChild(taskList);

    // Empty state
    if (allTasks.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'today-empty';
        empty.innerHTML = `<p> Nenhuma tarefa para hoje</p> <p>Clique para adicionar uma tarefa</p>`;
        main.appendChild(empty);
    }

    // Clickable area for quick add
    main.style.cursor = 'text';
    main.style.minHeight = '50vh';
    main.addEventListener('click', (e) => {
        if (e.target === main || e.target.closest('.today-header') || e.target.closest('.today-empty')) {
            addQuickTaskInputToday(taskList, today);
        }
    });

    grid.appendChild(main);

    // ===== RIGHT: Sidebar stats =====
    const sidebar = document.createElement('div');
    sidebar.className = 'today-sidebar';

    // Calcular stats
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.task.completed).length;
    const pendingTasks = totalTasks - completedTasks;
    const todayRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Rotina stats
    const routineTotal = routineTasks.length;
    const routineCompleted = routineTasks.filter(t => t.completed).length;
    const routineRate = routineTotal > 0 ? Math.round((routineCompleted / routineTotal) * 100) : 0;

    // Streak
    let streak = 0;
    const checkD = new Date();
    for (let i = 0; i < 60; i++) {
        const cds = localDateStr(checkD);
        const { total: sTotal, completed: sCompleted } = countDayTasks(cds);
        if (sTotal > 0 && sCompleted === sTotal) {
            streak++;
        } else if (i > 0 || (i === 0 && sTotal > 0)) {
            break;
        }
        checkD.setDate(checkD.getDate() - 1);
    }

    // Semana
    const weekDates = getWeekDates(0);
    let weekTotal = 0, weekCompleted = 0;
    weekDates.forEach(({ dateStr: wds }) => {
        const { total: wt, completed: wc } = countDayTasks(wds);
        weekTotal += wt;
        weekCompleted += wc;
    });
    const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

    // Ring color
    const ringColor = todayRate >= 70 ? 'var(--accent-green)' : todayRate >= 40 ? 'var(--accent-orange)' : todayRate > 0 ? 'var(--accent-red)' : 'rgba(255,255,255,0.1)';
    const ringPct = todayRate;
    const circumference = 2 * Math.PI * 19;
    const dashOffset = circumference - (circumference * ringPct / 100);

    // Build sidebar HTML
    sidebar.innerHTML = `
    <!--Progresso do dia-->
                <div class="stat-section">
                    <div class="stat-section-title">Progresso</div>
                    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
                        <div class="stat-ring">
                            <svg width="48" height="48" viewBox="0 0 48 48">
                                <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
                                <circle cx="24" cy="24" r="19" fill="none" stroke="${ringColor}" stroke-width="3"
                                    stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
                                    stroke-linecap="round"/>
                            </svg>
                            <div class="stat-ring-text">${todayRate}%</div>
                        </div>
                        <div>
                            <div style="font-size: 13px; color: var(--text-secondary);">${completedTasks} de ${totalTasks}</div>
                            <div style="font-size: 11px; color: var(--text-tertiary);">tarefas concluídas</div>
                        </div>
                    </div>
                    <div class="progress-bar-mini">
                        <div class="progress-bar-mini-fill" style="width: ${todayRate}%; background: ${ringColor};"></div>
                    </div>
                </div>

                <!--Resumo -->
                <div class="stat-section">
                    <div class="stat-section-title">Resumo</div>
                    <div class="stat-card">
                        <span class="stat-label">Pendentes</span>
                        <span class="stat-value ${pendingTasks > 0 ? 'orange' : 'green'}">${pendingTasks}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Rotina</span>
                        <span class="stat-value ${routineRate >= 80 ? 'green' : routineRate >= 50 ? 'blue' : ''}">${routineCompleted}/${routineTotal}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Streak</span>
                        <span class="stat-value ${streak >= 3 ? 'green' : ''}">${streak > 0 ? streak + ' dia' + (streak > 1 ? 's' : '') : '—'}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Semana</span>
                        <span class="stat-value ${weekRate >= 70 ? 'green' : weekRate >= 40 ? 'blue' : ''}">${weekRate}%</span>
                    </div>
                </div>

                <!--Mini semana-->
    <div class="stat-section">
        <div class="stat-section-title">Esta semana</div>
        <div style="display: flex; gap: 6px; align-items: flex-end;">
            ${weekDates.map(({ name, dateStr: wds }) => {
        const { total: wt, completed: wc } = countDayTasks(wds);
        const pct = wt > 0 ? Math.round((wc / wt) * 100) : 0;
        const isToday = wds === dateStr;
        const barColor = pct >= 80 ? 'var(--accent-green)' : pct >= 50 ? 'var(--accent-blue)' : pct > 0 ? 'var(--accent-orange)' : 'rgba(255,255,255,0.06)';
        const barH = wt > 0 ? Math.max(6, pct * 0.4) : 4;
        return `<div style="flex: 1; text-align: center;">
                                <div style="height: 40px; display: flex; align-items: flex-end; justify-content: center;">
                                    <div style="width: 100%; max-width: 20px; height: ${barH}px; background: ${barColor}; border-radius: 2px; ${isToday ? 'box-shadow: 0 0 6px ' + barColor + ';' : ''}"></div>
                                </div>
                                <div style="font-size: 10px; color: ${isToday ? 'var(--accent-blue)' : 'var(--text-tertiary)'}; margin-top: 4px; font-weight: ${isToday ? '600' : '400'};">${name.slice(0, 3)}</div>
                            </div>`;
    }).join('')}
        </div>
    </div>
`;

    grid.appendChild(sidebar);
}

function addQuickTaskInputToday(container, day) {
    // Verificar se já existe um input ativo
    const existingInput = container.querySelector('.quick-task-input');
    if (existingInput) {
        existingInput.focus();
        return;
    }

    const inputContainer = document.createElement('div');
    inputContainer.className = 'quick-task-container';
    inputContainer.style.padding = '5px 6px';

    // Checkbox placeholder
    const checkboxPlaceholder = document.createElement('div');
    checkboxPlaceholder.style.width = '16px';
    checkboxPlaceholder.style.height = '16px';
    checkboxPlaceholder.style.borderRadius = '4px';
    checkboxPlaceholder.style.border = '1.5px solid rgba(255,255,255,0.15)';
    checkboxPlaceholder.style.flexShrink = '0';
    checkboxPlaceholder.style.marginTop = '2px';
    inputContainer.appendChild(checkboxPlaceholder);

    // Input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'quick-task-input';
    input.placeholder = 'Escreva aqui...';
    input.autocomplete = 'off';
    input.setAttribute('data-form-type', 'other');
    inputContainer.appendChild(input);

    container.appendChild(inputContainer);
    input.focus();

    // Salvar ao pressionar Enter
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            e.preventDefault();

            const dateStr = localDateStr();
            const period = 'Tarefas';

            if (!allTasksData[dateStr]) allTasksData[dateStr] = {};
            if (!allTasksData[dateStr][period]) allTasksData[dateStr][period] = [];

            const newTask = {
                text: input.value.trim(),
                completed: false,
                color: 'default',
                isHabit: false
            };

            allTasksData[dateStr][period].push(newTask);

            await syncTaskToSupabase(dateStr, period, newTask);
            saveToLocalStorage();

            renderView();
        }

        // Deletar linha vazia ao pressionar Backspace/Delete
        if ((e.key === 'Backspace' || e.key === 'Delete') && input.value.trim() === '') {
            e.preventDefault();
            inputContainer.remove();
        }

        if (e.key === 'Escape') {
            inputContainer.remove();
        }
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (!input.value.trim()) {
                inputContainer.remove();
            }
        }, 100);
    });
}

function addQuickTaskInput(column, day) {
    // Verificar se já existe um input ativo
    const existingInput = column.querySelector('.quick-task-input');
    if (existingInput) {
        existingInput.focus();
        return;
    }

    const container = document.createElement('div');
    container.className = 'quick-task-container';
    container.style.padding = '5px 6px';

    // Checkbox placeholder
    const checkboxPlaceholder = document.createElement('div');
    checkboxPlaceholder.style.width = '16px';
    checkboxPlaceholder.style.height = '16px';
    checkboxPlaceholder.style.borderRadius = '4px';
    checkboxPlaceholder.style.border = '1.5px solid rgba(255,255,255,0.15)';
    checkboxPlaceholder.style.flexShrink = '0';
    checkboxPlaceholder.style.marginTop = '2px';
    container.appendChild(checkboxPlaceholder);

    // Input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'quick-task-input';
    input.placeholder = 'Escreva aqui...';
    input.autocomplete = 'off';
    input.setAttribute('data-form-type', 'other');
    container.appendChild(input);

    // Adicionar ao final da coluna
    column.appendChild(container);
    input.focus();

    // Salvar ao pressionar Enter
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            e.preventDefault();

            // Encontrar a data correspondente ao dia da coluna
            const weekDates = getWeekDates(currentWeekOffset);
            const dayInfo = weekDates.find(d => d.name === day);
            if (!dayInfo) return;

            const dateStr = dayInfo.dateStr;
            const period = 'Tarefas';

            if (!allTasksData[dateStr]) allTasksData[dateStr] = {};
            if (!allTasksData[dateStr][period]) allTasksData[dateStr][period] = [];

            const newTask = {
                text: input.value.trim(),
                completed: false,
                color: 'default',
                isHabit: false
            };

            allTasksData[dateStr][period].push(newTask);

            // Salvar e sincronizar
            await syncTaskToSupabase(dateStr, period, newTask);
            saveToLocalStorage();

            // Re-renderizar a view
            renderView();
        }

        // Deletar linha vazia ao pressionar Backspace/Delete
        if ((e.key === 'Backspace' || e.key === 'Delete') && input.value.trim() === '') {
            e.preventDefault();
            container.remove();
        }

        // Cancelar ao pressionar Escape
        if (e.key === 'Escape') {
            container.remove();
        }
    });

    // Remover se perder o foco e estiver vazio
    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (!input.value.trim()) {
                container.remove();
            }
        }, 100);
    });
}

function createTaskElement(day, dateStr, period, task, index) {
    const container = document.createElement('div');

    // Top Drop Zone (não mostrar para recorrentes)
    if (index !== -1) container.appendChild(createDropZone(day, dateStr, period, index));

    const isRecurring = index === -1; // tarefas recorrentes não persistidas

    const el = document.createElement('div');
    el.className = `task-item ${task.isHabit ? 'is-habit' : ''} `;
    el.draggable = !isRecurring;
    el.dataset.day = day;
    el.dataset.date = dateStr;
    el.dataset.period = period;
    el.dataset.index = index;

    // Aplicar indent se existir
    if (task.indent && task.indent > 0) {
        el.style.paddingLeft = `${task.indent * 24}px`;
    }

    // Label (criado primeiro para ser referenciado pelos callbacks)
    const label = document.createElement('span');
    label.className = `task-label color-${task.color || 'default'} ${task.completed ? 'task-completed' : ''}`;
    // Aplicar cor azul se for tarefa de rotina ou recorrente
    if (task.isRoutine || task.isRecurring || period === 'Rotina') {
        label.style.color = 'var(--accent-blue)';
    }

    // Cor da DIFICULDADE (Prioridade) - sobrepõe rotina se existir
    if (task.priority && task.priority !== 'none') {
        const pColors = {
            'urgent': '#FF453A',   // Vermelho
            'important': '#FF9F0A', // Laranja
            'simple': '#FFD60A',   // Amarelo
            'money': '#30D158'     // Verde
        };
        if (pColors[task.priority]) {
            label.style.color = pColors[task.priority];
        }
    }

    // Normalizar texto da tarefa (garantir que não seja undefined)
    if (task.text === undefined || task.text === null) {
        task.text = '';
    }

    // Se a tarefa está vazia, mostrar placeholder
    if (task.text.trim() === '') {
        label.textContent = '';
        label.style.color = '#666';
        label.setAttribute('data-placeholder', 'Clique para editar...');
        label.style.position = 'relative';
    } else {
        label.textContent = task.text;
    }

    // Single Click Edit - New Modal
    label.onclick = (e) => {
        e.preventDefault();
        if (window.openTaskEditModal) window.openTaskEditModal(task, el);
    };

    // Context Menu
    label.oncontextmenu = (e) => {
        e.preventDefault();
        showEditToolbar(e, task, label);
    }

    // Drag Handle (oculto para tarefas recorrentes)
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.innerHTML = '⋮⋮';
    handle.style.cursor = isRecurring ? 'default' : 'pointer';
    if (isRecurring) handle.style.display = 'none';
    handle.addEventListener('click', (e) => {
        if (isRecurring) return;
        e.stopPropagation();
        e.preventDefault();
        showEditToolbar(e, task, label);
    });
    el.appendChild(handle);

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'checkbox-custom';
    checkbox.checked = task.completed;
    checkbox.onchange = (e) => {
        task.completed = e.target.checked;
        if (task.completed && navigator.vibrate) {
            const vs = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
            if (vs.haptics !== false) navigator.vibrate(15);
        }
        label.classList.toggle('task-completed', task.completed);

        // Se for rotina, usar a lógica unificada routineCompletions
        if (task.isRoutine || period === 'Rotina') {
            const completions = JSON.parse(localStorage.getItem('routineCompletions') || '{}');
            if (!completions[task.text]) completions[task.text] = {};

            if (task.completed) completions[task.text][dateStr] = true;
            else delete completions[task.text][dateStr];

            localStorage.setItem('routineCompletions', JSON.stringify(completions));
        }

        // Sempre salvar estado geral
        saveToLocalStorage();

        // Sincronizar com Supabase
        if (typeof syncDateToSupabase === 'function') {
            syncDateToSupabase(dateStr);
        }
    }
    el.appendChild(checkbox);

    el.appendChild(label);

    // Drag Events
    el.ondragstart = handleDragStart;
    el.ondragend = handleDragEnd;

    container.appendChild(el);
    return container;
}

function createDropZone(day, dateStr, period, index) {
    const dz = document.createElement('div');
    dz.className = 'task-drop-zone';
    dz.dataset.day = day;
    dz.dataset.date = dateStr;
    dz.dataset.period = period;
    dz.dataset.insertAt = index;

    dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('show'); };
    dz.ondragleave = () => dz.classList.remove('show');
    dz.ondrop = (e) => handleDropZoneDrop(e, dz);
    return dz;
}

// --- Editing Logic ---

function startEditing(label, task, taskDiv) {
    if (currentEditingTask) finishEditing();
    currentEditingTask = { label, task, original: task.text };

    label.contentEditable = true;
    label.focus();
    taskDiv.draggable = false;

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(label);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    label.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finishEditing();
        }
        if (e.key === 'Escape') {
            label.textContent = currentEditingTask.original;
            finishEditing();
        }
        // Delete ou Backspace em tarefa vazia = deletar a tarefa
        if ((e.key === 'Backspace' || e.key === 'Delete') && label.textContent.trim() === '') {
            e.preventDefault();
            label.textContent = ''; // Garantir que está vazio
            finishEditing(); // Vai deletar a tarefa automaticamente
        }
        // TAB para indent (estilo Notion)
        if (e.key === 'Tab') {
            e.preventDefault();
            const taskItem = label.closest('.task-item');
            const currentIndent = parseInt(task.indent || 0);

            if (e.shiftKey) {
                // Shift+Tab = desindentar
                if (currentIndent > 0) {
                    task.indent = currentIndent - 1;
                    taskItem.style.paddingLeft = `${task.indent * 24} px`;
                }
            } else {
                // Tab = indentar
                if (currentIndent < 3) { // Máximo 3 níveis
                    task.indent = currentIndent + 1;
                    taskItem.style.paddingLeft = `${task.indent * 24} px`;
                }
            }

            saveToLocalStorage();
        }
    };
    label.onblur = finishEditing;
}

async function finishEditing() {
    if (!currentEditingTask) return;
    const { label, task } = currentEditingTask;
    const newText = label.textContent.trim();

    // Se a tarefa ficou vazia, deletar
    if (!newText || newText === '') {
        const taskElement = label.closest('.task-item');
        const dateStr = taskElement.dataset.date;
        const period = taskElement.dataset.period;
        const index = parseInt(taskElement.dataset.index);

        if (allTasksData[dateStr] && allTasksData[dateStr][period]) {
            const taskToDelete = allTasksData[dateStr][period][index];

            // Deletar do Supabase
            await deleteTaskFromSupabase(taskToDelete);

            // Deletar localmente
            allTasksData[dateStr][period].splice(index, 1);

            // Limpar período vazio
            if (allTasksData[dateStr][period].length === 0) {
                delete allTasksData[dateStr][period];
            }

            // Limpar data vazia
            if (Object.keys(allTasksData[dateStr]).length === 0) {
                delete allTasksData[dateStr];
            }
        }

        localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
        currentEditingTask = null;
        renderView();
        return;
    }

    // Tarefa tem texto, salvar normalmente
    task.text = newText;
    label.contentEditable = false;
    label.closest('.task-item').draggable = true;

    // Remover placeholder se tinha
    if (label.hasAttribute('data-placeholder')) {
        label.removeAttribute('data-placeholder');
        label.style.color = '';
    }

    saveToLocalStorage();
    currentEditingTask = null;
}

function showTaskInput(btn, day, period) {
    const input = document.createElement('input');
    input.className = 'task-input';
    input.placeholder = 'Nova tarefa...';
    btn.replaceWith(input);
    input.focus();

    const save = () => {
        if (input.value.trim()) {
            if (!weekData[day][period]) weekData[day][period] = [];
            weekData[day][period].push({ text: input.value.trim(), completed: false, color: 'default', isHabit: false });
            saveToLocalStorage();
        }
        renderView();
    };

    input.onkeydown = (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') renderView(); };
    input.onblur = () => setTimeout(save, 100);
}

// --- Drag & Drop Handlers ---

function handleDragStart(e) {
    const period = this.dataset.period;
    const dateStr = this.dataset.date;
    const index = parseInt(this.dataset.index);

    // Tarefas recorrentes (index = -1) não são arrastáveis
    if (index === -1) { e.preventDefault(); return; }

    // Usar allTasksData para buscar a tarefa
    const dayData = allTasksData[dateStr] || {};
    const task = (dayData[period] || [])[index];
    if (!task) { e.preventDefault(); return; }

    draggedTask = {
        day: this.dataset.day,
        dateStr: dateStr,
        period: period,
        index: index,
        task: task
    };

    document.body.classList.add('dragging-active');
    setTimeout(() => this.classList.add('opacity-50'), 0);
}

function handleDragEnd(e) {
    document.body.classList.remove('dragging-active');
    this.classList.remove('opacity-50');
    document.querySelectorAll('.day-column').forEach(c => c.classList.remove('drag-over'));
}

function handleDragOver(e) { e.preventDefault(); }

function handleDropZoneDrop(e, dz) {
    e.stopPropagation();
    dz.classList.remove('show');
    if (!draggedTask) return;

    const targetDateStr = dz.dataset.date;
    const targetPeriod = dz.dataset.period;
    let insertAt = parseInt(dz.dataset.insertAt);

    const sourceDateStr = draggedTask.dateStr;
    const sourcePeriod = draggedTask.period;
    const sourceIndex = draggedTask.index;

    // Garantir que as estruturas existem
    if (!allTasksData[sourceDateStr]) allTasksData[sourceDateStr] = {};
    if (!allTasksData[targetDateStr]) allTasksData[targetDateStr] = {};
    if (!allTasksData[sourceDateStr][sourcePeriod]) allTasksData[sourceDateStr][sourcePeriod] = [];
    if (!allTasksData[targetDateStr][targetPeriod]) allTasksData[targetDateStr][targetPeriod] = [];

    // Remover da posição antiga
    allTasksData[sourceDateStr][sourcePeriod].splice(sourceIndex, 1);

    // Ajustar index se for a mesma lista
    if (sourceDateStr === targetDateStr && sourcePeriod === targetPeriod && sourceIndex < insertAt) {
        insertAt--;
    }

    // Ajustar a flag isRoutine baseado no período de destino
    const taskToMove = { ...draggedTask.task };
    if (targetPeriod === 'Rotina') {
        taskToMove.isRoutine = true;
    } else {
        taskToMove.isRoutine = false;
    }

    // Inserir na nova posição
    allTasksData[targetDateStr][targetPeriod].splice(insertAt, 0, taskToMove);

    // Limpar períodos vazios
    if (allTasksData[sourceDateStr][sourcePeriod].length === 0) {
        delete allTasksData[sourceDateStr][sourcePeriod];
    }

    // Salvar localmente
    localStorage.setItem('allTasksData', JSON.stringify(allTasksData));

    // Sincronizar dias afetados com Supabase (mantém a ordem)
    const datesToSync = [...new Set([sourceDateStr, targetDateStr])];
    (async () => { for (const d of datesToSync) await syncDateToSupabase(d); })();

    renderView();
    draggedTask = null;
}

// Sincroniza todas as tarefas de uma data com o Supabase, preservando a ordem
async function syncDateToSupabase(dateStr) {
    if (!currentUser) return;
    _isSyncingDate = true;
    try {

        // Deletar todos os registros desta data no Supabase
        await supabaseClient.from('tasks').delete()
            .eq('user_id', currentUser.id)
            .eq('day', dateStr);

        // Reinserir na ordem atual do allTasksData
        // Nunca salvar tarefas recorrentes ou de rotina no banco
        const recurringTextsSet = new Set(allRecurringTasks.map(rt => rt.text));
        const periods = allTasksData[dateStr] || {};
        const inserts = [];
        Object.entries(periods).forEach(([period, tasks]) => {
            if (Array.isArray(tasks)) {
                tasks.forEach(task => {
                    if (!task.text || task.text.trim() === '') return;
                    if (task.isWeeklyRecurring || task.isRoutine || task.isRecurring) return;
                    if (recurringTextsSet.has(task.text)) return;
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

        if (inserts.length > 0) {
            const { data } = await supabaseClient.from('tasks').insert(inserts).select();
            // Atualizar supabaseIds locais
            if (data) {
                data.forEach((row) => {
                    const tasks = allTasksData[row.day]?.[row.period];
                    if (tasks) {
                        const match = tasks.find(t => t.text === row.text && !t.supabaseId);
                        if (match) match.supabaseId = row.id;
                    }
                });
                localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
            }
        }
    } finally {
        _isSyncingDate = false;
    }
}

function handleDrop(e) {
    // Fallback drop on column
    e.preventDefault();
    // Logic to drop at end of list if dropped on column
}

// --- Menus ---
function showEditToolbar(e, task, label) {
    const toolbar = document.getElementById('editToolbar');
    toolbar.style.left = e.pageX + 'px';
    toolbar.style.top = e.pageY + 'px';
    toolbar.classList.add('show');

    // Setup buttons (simplified)
    toolbar.querySelector('[data-action="color"]').onclick = (ev) => {
        ev.stopPropagation();
        showColorMenu(ev, task, label);
    }
    toolbar.querySelector('[data-action="habit"]').onclick = () => {
        task.isHabit = !task.isHabit;

        if (task.isHabit) {
            const alreadyInRecurring = allRecurringTasks.some(t => t.text === task.text);
            if (!alreadyInRecurring) {
                allRecurringTasks.push({
                    text: task.text,
                    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                    priority: task.priority || 'none',
                    color: task.color || 'default',
                    isHabit: true,
                    createdAt: new Date().toISOString()
                });
            }
            alert(`"${task.text}" marcado como hábito e adicionado à Rotina!`);
        } else {
            const recurringIndex = allRecurringTasks.findIndex(t => t.text === task.text);
            if (recurringIndex !== -1) {
                allRecurringTasks.splice(recurringIndex, 1);
            }
            alert(`"${task.text}" removido dos hábitos e da Rotina.`);
        }

        saveToLocalStorage();
        syncRecurringTasksToSupabase();
        renderView();
        toolbar.classList.remove('show');
    }const SUPABASE_URL = window._FLOWLY_SUPABASE_URL || '';
const SUPABASE_KEY = window._FLOWLY_SUPABASE_KEY || '';
const { createClient } = window.supabase;

// Inicializar flowly_persist_session como true por padrão (checkbox vem marcado)
if (localStorage.getItem('flowly_persist_session') === null) {
    localStorage.setItem('flowly_persist_session', 'true');
}

const customStorage = {
    getItem: (key) => {
        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
        console.log('[Storage] getItem:', key, value ? 'found' : 'not found');
        return value;
    },
    setItem: (key, value) => {
        const shouldPersist = localStorage.getItem('flowly_persist_session') !== 'false';
        console.log('[Storage] setItem:', key, 'persist:', shouldPersist);
        if (shouldPersist) {
            localStorage.setItem(key, value);
        } else {
            sessionStorage.setItem(key, value);
        }
    },
    removeItem: (key) => {
        console.log('[Storage] removeItem:', key);
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    }
};

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storage: customStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'flowly-auth'
    }
});

// Listener para mudanças de autenticação
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event, session ? 'user active' : 'no session');

    if (event === 'INITIAL_SESSION') {
        if (session) {
            currentUser = session.user;
            document.getElementById('authModal').classList.remove('show');
            document.getElementById('userEmail').textContent = session.user.email;
            await loadDataFromSupabase();
            renderView();
        } else {
            // Sem sessão inicial -> Mostrar Login
            document.getElementById('authModal').classList.add('show');
        }
    } else if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        document.getElementById('authModal').classList.remove('show');
        document.getElementById('userEmail').textContent = session.user.email;
        // Garantir carregamento se vier de redirecionamento ou OAuth
        if (!allTasksData || Object.keys(allTasksData).length === 0) {
            await loadDataFromSupabase();
            renderView();
        }
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        document.getElementById('authModal').classList.add('show');
        location.reload();
    }
});


let currentUser = null;
let currentView = 'week';
let draggedTask = null;
let currentEditingTask = null;
const width = 600;
let currentWeekOffset = 0; // 0 = semana atual, -1 = semana passada, +1 = próxima semana
let currentMonthOffset = 0; // 0 = mês atual

// View Management Functions
function setView(view) {
    currentView = view;

    // Hide all views
    const views = ['monthView', 'weekGrid', 'todayView', 'routineView', 'analyticsView', 'settingsView'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });

    // Update navigation buttons
    document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
    const btnMap = {
        'month': 'btnMonth',
        'week': 'btnWeek',
        'today': 'btnToday',
        'routine': 'btnRoutine',
        'analytics': 'btnAnalytics',
        'settings': 'btnSettings'
    };
    const activeBtn = document.getElementById(btnMap[view]);
    if (activeBtn) activeBtn.classList.add('active');

    // Show week navigation only for week view
    const weekNav = document.getElementById('weekNav');
    if (weekNav) {
        weekNav.style.display = view === 'week' ? 'flex' : 'none';
    }

    renderView();
}

function renderView() {
    if (!currentView) currentView = 'week';

    // Show the appropriate view
    const viewMap = {
        'week': 'weekGrid',
        'today': 'todayView',
        'routine': 'routineView',
        'analytics': 'analyticsView',
        'settings': 'settingsView',
        'month': 'monthView'
    };

    const viewId = viewMap[currentView];
    if (viewId) {
        const el = document.getElementById(viewId);
        if (el) el.classList.remove('hidden');
    }

    // Call specific render functions if they exist
    if (currentView === 'week' && typeof renderWeek === 'function') {
        renderWeek();
    } else if (currentView === 'routine' && typeof renderRoutineView === 'function') {
        renderRoutineView();
    } else if (currentView === 'analytics' && typeof renderAnalyticsView === 'function') {
        renderAnalyticsView();
    } else if (currentView === 'settings' && typeof renderSettingsView === 'function') {
        renderSettingsView();
    } else if (currentView === 'today' && typeof renderTodayView === 'function') {
        renderTodayView();
    } else if (currentView === 'month' && typeof renderMonthView === 'function') {
        renderMonthView();
    }
}

// Helper para JSON seguro
function safeJSONParse(str, fallback) {
    try {
        return str ? JSON.parse(str) : fallback;
    } catch (e) {
        console.error('Erro ao fazer parse do JSON:', e);
        return fallback;
    }
}

// Data Structures
// NOVO: Tarefas recorrentes unificadas (substituem dailyRoutine e weeklyRecurringTasks)
// Formato: { text, daysOfWeek: [0-6], priority, createdAt }
let allRecurringTasks = safeJSONParse(localStorage.getItem('allRecurringTasks'), []);

// Compatibilidade: manter dailyRoutine para migração (será removido após migrar)
let dailyRoutine = safeJSONParse(localStorage.getItem('dailyRoutine'), []);
let weeklyRecurringTasks = safeJSONParse(localStorage.getItem('weeklyRecurringTasks'), []);

// Estrutura expandida: armazena tarefas por data ISO (YYYY-MM-DD) e período
let allTasksData = safeJSONParse(localStorage.getItem('allTasksData'), {});

// Compatibilidade: estrutura antiga para a semana atual
const weekData = { "Segunda": {}, "Terça": {}, "Quarta": {}, "Quinta": {}, "Sexta": {}, "Sábado": {}, "Domingo": {} };
let habitsHistory = safeJSONParse(localStorage.getItem('habitsHistory'), {});

// Estado de conclusão de tarefas recorrentes por data
let routineCompletions = safeJSONParse(localStorage.getItem('routineCompletions'), {});
// Formato: { "taskText": { "2026-02-17": true, "2026-02-18": false } }


// FunÇÕES auxiliares de data
function localDateStr(date = new Date()) {
    return date.toLocaleDateString('pt-BR').split('/').reverse().join('-');
}

// --- FunÇÕES Globais do Analytics e Rotina ---

// --- FunÇÕES Globais do Analytics e Rotina (NOVO SISTEMA) ---

// Variáveis para edição
let currentEditingTaskRef = null;

// Função para abrir o modal de edição
window.openTaskEditModal = function (task, element) {
    const modal = document.getElementById('taskEditModal');
    const taskText = task.text || '';

    // Guardar referência
    currentEditingTaskRef = {
        dateStr: element.dataset.date,
        period: element.dataset.period,
        index: parseInt(element.dataset.index),
        isRecurring: element.dataset.index === '-1',
        originalTask: task
    };

    // UI - Input
    document.getElementById('taskEditInput').value = taskText;

    // Resetar botões
    document.querySelectorAll('.priority-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.weekly-day-btn').forEach(btn => btn.classList.remove('active'));

    // --- RE-BIND LISTENERS (Critical Fix) ---
    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.onclick = () => {
            const wasActive = btn.classList.contains('active');
            document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
            if (!wasActive) btn.classList.add('active');
        };
    });
    document.querySelectorAll('.weekly-day-btn').forEach(btn => {
        btn.onclick = () => {
            btn.classList.toggle('active');
        };
    });
    const btnSave = document.getElementById('btnSaveTaskEdit');
    if (btnSave) btnSave.onclick = window.saveTaskEdit;

    // Deletar também
    const btnDel = document.getElementById('btnDeleteTaskEdit');
    if (btnDel) btnDel.onclick = window.deleteTaskEdit;
    const btnCancel = document.getElementById('btnCancelTaskEdit');
    if (btnCancel) btnCancel.onclick = () => document.getElementById('taskEditModal').classList.remove('show');
    // ----------------------------------------

    // Setar Prioridade (se existir na tarefa ou na definição de recorrência)
    let priority = task.priority || 'none';

    // Se for recorrente visual, tenta pegar a prioridade "real" da definição
    if (currentEditingTaskRef.isRecurring) {
        const recDefinition = allRecurringTasks.find(t => t.text === task.text);
        if (recDefinition && recDefinition.priority) priority = recDefinition.priority;
    }

    const pBtn = document.querySelector(`.priority-btn[data-priority="${priority}"]`);
    if (pBtn) pBtn.classList.add('active');

    // Setar Recorrência
    // Procura na lista unificada de recorrentes
    const recTask = allRecurringTasks.find(t => t.text === task.text);
    if (recTask && recTask.daysOfWeek) {
        recTask.daysOfWeek.forEach(day => {
            const btn = document.querySelector(`.weekly-day-btn[data-day="${day}"]`);
            if (btn) btn.classList.add('active');
        });
    }

    modal.classList.add('show');

    // Re-render icons if needed (lucide)
    if (window.lucide) lucide.createIcons();
}

// Salvar Edição
window.saveTaskEdit = function () {
    if (!currentEditingTaskRef) return;
    const { dateStr, period, index, isRecurring, originalTask } = currentEditingTaskRef;

    const activePBtn = document.querySelector('.priority-btn.active');
    const newPriority = activePBtn ? activePBtn.dataset.priority : 'none';

    const activeDays = Array.from(document.querySelectorAll('.weekly-day-btn.active'))
        .map(btn => parseInt(btn.dataset.day));

    const newTaskText = document.getElementById('taskEditInput').value.trim();
    if (!newTaskText) { alert("Nome da tarefa obrigatório!"); return; }

    const oldText = originalTask.text;

    // 1. Atualizar Tarefa Local (se não for visualização recorrente)
    if (!isRecurring) {
        if (allTasksData[dateStr] && allTasksData[dateStr][period]) {
            const t = allTasksData[dateStr][period][index];
            if (t) {
                t.priority = newPriority;
                t.text = newTaskText; // Renomear
            }
        }
    }

    // 2. Gerenciar Recorrência Unificada
    let recIndex = allRecurringTasks.findIndex(t => t.text === oldText);

    // Se não achou pelo antigo, tenta pelo novo.
    if (recIndex === -1) recIndex = allRecurringTasks.findIndex(t => t.text === newTaskText);

    if (activeDays.length > 0) {
        // Criar ou Atualizar
        const newRecTask = {
            text: newTaskText,
            daysOfWeek: activeDays,
            priority: newPriority,
            color: getPriorityColorName(newPriority), // fallback helper
            createdAt: new Date().toISOString()
        };

        if (recIndex >= 0) {
            allRecurringTasks[recIndex] = { ...allRecurringTasks[recIndex], ...newRecTask };
        } else {
            allRecurringTasks.push(newRecTask);
        }
        // Se virou recorrente, remove a original avulsa para evitar duplicação visual e lógica
        if (!isRecurring && allTasksData[dateStr] && allTasksData[dateStr][period]) {
            allTasksData[dateStr][period].splice(index, 1);
        }

    } else {
        // Se desmarcou todos os dias, remove da recorrência
        if (recIndex >= 0) {
            if (confirm('Remover a recorrência automática desta tarefa?')) {
                allRecurringTasks.splice(recIndex, 1);
            }
        }
    }

    saveToLocalStorage();
    if (typeof activeDays !== 'undefined' && (activeDays.length > 0 || isRecurring)) syncRecurringTasksToSupabase();
    document.getElementById('taskEditModal').classList.remove('show');
    renderView();
}

// Deletar via Modal
window.deleteTaskEdit = function () {
    if (!currentEditingTaskRef) return;
    const { dateStr, period, index, isRecurring, originalTask } = currentEditingTaskRef;

    if (confirm('Excluir esta tarefa?')) {
        let deleted = false;

        // Se for recorrente, deletar da lista global?
        if (isRecurring || allRecurringTasks.some(t => t.text === originalTask.text)) {
            if (confirm('Esta tarefa é recorrente. Deseja parar de repeti-la para sempre?')) {
                const recIndex = allRecurringTasks.findIndex(t => t.text === originalTask.text);
                if (recIndex >= 0) allRecurringTasks.splice(recIndex, 1);
                // Limpar instâncias persistidas indevidamente em allTasksData
                const textToRemove = originalTask.text;
                Object.keys(allTasksData).forEach(dStr => {
                    Object.keys(allTasksData[dStr] || {}).forEach(per => {
                        if (Array.isArray(allTasksData[dStr][per])) {
                            allTasksData[dStr][per] = allTasksData[dStr][per].filter(t => t.text !== textToRemove);
                            if (allTasksData[dStr][per].length === 0) delete allTasksData[dStr][per];
                        }
                    });
                    if (Object.keys(allTasksData[dStr] || {}).length === 0) delete allTasksData[dStr];
                });
                syncRecurringTasksToSupabase();
                deleted = true;
            }
        }

        // Se for tarefa local avulsa, deletar
        if (!isRecurring && allTasksData[dateStr]?.[period]) {
            allTasksData[dateStr][period].splice(index, 1);
            if (allTasksData[dateStr][period].length === 0) delete allTasksData[dateStr][period];
            deleted = true;
        }

        if (deleted) {
            saveToLocalStorage();
            document.getElementById('taskEditModal').classList.remove('show');
            renderView();
        }
    }
}

function getPriorityColorName(priority) {
    switch (priority) {
        case 'urgent': return 'red';
        case 'important': return 'orange';
        case 'simple': return 'yellow';
        case 'money': return 'green';
        default: return 'default';
    }
}

// ===== FUNÇÕES DE SALVAMENTO =====
function saveToLocalStorage() {
    localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
    localStorage.setItem('allRecurringTasks', JSON.stringify(allRecurringTasks));
    localStorage.setItem('routineCompletions', JSON.stringify(routineCompletions));
    localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory));

    // Manter dados antigos zerados/compatíveis para evitar erros em funcoes legadas até limparmos tudo
    localStorage.setItem('dailyRoutine', JSON.stringify([]));
    localStorage.setItem('weeklyRecurringTasks', JSON.stringify([]));

    // Integrar lógica de sync legada (se existir)
    if (typeof _isSyncingDate !== 'undefined' && currentUser && !_isSyncingDate) {
        Object.entries(allTasksData).forEach(([dateStr, periods]) => {
            Object.entries(periods).forEach(([period, tasks]) => {
                if (Array.isArray(tasks)) {
                    tasks.forEach(task => {
                        // Garantir que syncTaskToSupabase exista
                        if (!task.isRoutine && !task.isWeeklyRecurring && typeof syncTaskToSupabase === 'function') {
                            syncTaskToSupabase(dateStr, period, task);
                        }
                    });
                }
            });
        });
    }
}

// ===== DRAG AND DROP =====
let dragState = {
    sourceDate: null,
    sourcePeriod: null,
    sourceIndex: null,
    taskData: null
};

function handleDragStart(e) {
    const el = e.target;
    const dateStr = el.dataset.date;
    const period = el.dataset.period;
    const index = parseInt(el.dataset.index);

    if (index === -1) return; // Tarefas recorrentes não podem ser arrastadas

    const tasksArray = allTasksData[dateStr]?.[period] || [];
    const task = tasksArray[index];

    dragState.sourceDate = dateStr;
    dragState.sourcePeriod = period;
    dragState.sourceIndex = index;
    dragState.taskData = { ...task };

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(dragState));
    el.style.opacity = '0.4';
}

function handleDragEnd(e) {
    e.target.style.opacity = '1';
    document.querySelectorAll('.drop-zone').forEach(dz => dz.classList.remove('active'));
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

// Retorna tarefas de rotina para exibição (NÃO persiste em allTasksData)
function getRoutineTasksForDate(dateStr) {
    const tasks = [];
    const dateParts = dateStr.split('-');
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const dayOfWeek = dateObj.getDay();

    allRecurringTasks.forEach(habit => {
        let isForToday = false;
        if (habit.daysOfWeek && Array.isArray(habit.daysOfWeek)) {
            if (habit.daysOfWeek.includes(dayOfWeek)) isForToday = true;
        } else if (habit.isHabit) {
            isForToday = true;
        }

        if (isForToday) {
            const isCompleted = habitsHistory[habit.text] && habitsHistory[habit.text][dateStr];
            tasks.push({
                text: habit.text,
                completed: !!isCompleted,
                color: habit.color || 'default',
                priority: habit.priority || 'none',
                isRecurring: true,
                isHabit: true,
                recurrence: habit.daysOfWeek
            });
        }
    });
    return tasks;
}

// Compatibilidade: manter hydrateRoutineForDate como no-op para não quebrar chamadas existentes
function hydrateRoutineForDate(dateStr) {
    // Não faz mais nada - rotinas são geradas dinamicamente
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!dragState.taskData) return;

    // Determinar período de destino
    // Se dropped na coluna (currentTarget), usa dataset da coluna.
    // Se dropped em dropZone específica, usa dataset dela.
    let targetDate, targetPeriod, insertAt;

    const dropZone = e.target.closest('.drop-zone');
    const col = e.target.closest('.day-column');

    if (dropZone) {
        targetDate = dropZone.dataset.date;
        targetPeriod = dropZone.dataset.period;
        insertAt = parseInt(dropZone.dataset.insertAt);
    } else if (col) {
        targetDate = col.dataset.date;
        targetPeriod = 'Tarefas';
        insertAt = 999999;
    } else {
        return; // Drop inválido
    }

    // Remover da posição antiga
    const sourceArray = allTasksData[dragState.sourceDate]?.[dragState.sourcePeriod];
    if (sourceArray) {
        sourceArray.splice(dragState.sourceIndex, 1);

        // Ajustar index se for a mesma lista e moveu pra cima
        if (dragState.sourceDate === targetDate && dragState.sourcePeriod === targetPeriod && dragState.sourceIndex < insertAt) {
            insertAt--;
        }

        // Limpar período vazio
        if (sourceArray.length === 0) {
            delete allTasksData[dragState.sourceDate][dragState.sourcePeriod];
        }
    }

    // Adicionar na nova posição
    if (!allTasksData[targetDate]) allTasksData[targetDate] = {};
    if (!allTasksData[targetDate][targetPeriod]) allTasksData[targetDate][targetPeriod] = [];

    // Inserir na posição correta (insertAt)
    // Se insertAt for muito grande, splice coloca no final, que é o comportamento desejado para colunas
    // Se insertAt for indefinido?
    if (isNaN(insertAt)) insertAt = allTasksData[targetDate][targetPeriod].length;

    allTasksData[targetDate][targetPeriod].splice(insertAt, 0, dragState.taskData);

    // SALVAR!
    saveToLocalStorage();

    // Sincronizar com Supabase
    if (typeof syncDateToSupabase === 'function') {
        syncDateToSupabase(dragState.sourceDate);
        if (targetDate !== dragState.sourceDate) {
            syncDateToSupabase(targetDate);
        }
    }

    // Limpar estado
    dragState = {
        sourceDate: null,
        sourcePeriod: null,
        sourceIndex: null,
        taskData: null
    };

    document.querySelectorAll('.day-column, .drop-zone').forEach(el => el.classList.remove('active', 'drag-over'));

    // Re-renderizar
    renderView();
}

function createDropZone(day, dateStr, period, index) {
    const dz = document.createElement('div');
    dz.className = 'drop-zone';
    dz.dataset.date = dateStr;
    dz.dataset.period = period;
    dz.dataset.insertAt = index.toString();

    dz.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add('active');
    });

    dz.addEventListener('dragleave', () => {
        dz.classList.remove('active');
    });

    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove('active');

        if (!dragState.taskData) return;

        const targetDateStr = dateStr;
        const targetPeriod = period;
        let insertAt = parseInt(dz.dataset.insertAt);

        const sourceDateStr = dragState.sourceDate;
        const sourcePeriod = dragState.sourcePeriod;
        const sourceIndex = dragState.sourceIndex;

        // Remover da posição antiga
        const sourceArray = allTasksData[sourceDateStr]?.[sourcePeriod];
        if (sourceArray) {
            sourceArray.splice(sourceIndex, 1);

            // Ajustar index se for a mesma lista
            if (sourceDateStr === targetDateStr && sourcePeriod === targetPeriod && sourceIndex < insertAt) {
                insertAt--;
            }

            // Limpar período vazio
            if (sourceArray.length === 0) {
                delete allTasksData[sourceDateStr][sourcePeriod];
            }
        }

        // Garantir estruturas
        if (!allTasksData[targetDateStr]) allTasksData[targetDateStr] = {};
        if (!allTasksData[targetDateStr][targetPeriod]) allTasksData[targetDateStr][targetPeriod] = [];

        // Inserir na nova posição
        allTasksData[targetDateStr][targetPeriod].splice(insertAt, 0, dragState.taskData);

        // SALVAR!
        saveToLocalStorage();

        // Sincronizar com Supabase
        syncDateToSupabase(sourceDateStr);
        if (targetDateStr !== sourceDateStr) {
            syncDateToSupabase(targetDateStr);
        }

        // Limpar estado
        dragState = {
            sourceDate: null,
            sourcePeriod: null,
            sourceIndex: null,
            taskData: null
        };

        // Re-renderizar
        renderView();
    });

    return dz;
}


// Retorna a data local no formato YYYY-MM-DD (sem bug de fuso horário UTC)
function localDateStr(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekDates(weekOffset = 0) {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Domingo
    const diff = currentDay === 0 ? -6 : 1 - currentDay; // Ajustar para segunda-feira

    const monday = new Date(today);
    monday.setDate(today.getDate() + diff + (weekOffset * 7));
    monday.setHours(0, 0, 0, 0);

    const dates = [];
    const dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

    for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        dates.push({
            name: dayNames[i],
            date: date,
            dateStr: localDateStr(date)
        });
    }

    return dates;
}

function getMonthDates(monthOffset = 0) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + monthOffset;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    return { firstDay, lastDay, month: firstDay.getMonth(), year: firstDay.getFullYear() };
}

function getWeekLabel(weekOffset) {
    const dates = getWeekDates(weekOffset);
    const firstDate = dates[0].date;
    const lastDate = dates[6].date;

    if (weekOffset === 0) return 'Semana Atual';

    const format = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${format(firstDate)} - ${format(lastDate)}`;
}

function changeWeek(direction) {
    currentWeekOffset += direction;
    renderView();
}

function goToCurrentWeek() {
    currentWeekOffset = 0;
    renderView();
}

// --- Core Functions ---

async function checkAuth() {
    console.log('[Auth] Checking auth...');
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    console.log('[Auth] Session:', session ? 'found' : 'not found', error);

    if (session) {
        console.log('[Auth] User logged in:', session.user.email);
        currentUser = session.user;
        document.getElementById('authModal').classList.remove('show');
        document.getElementById('userEmail').textContent = session.user.email;
        await loadDataFromSupabase();
        renderView();
    } else {
        console.log('[Auth] No session, showing login');
        document.getElementById('authModal').classList.add('show');
    }
}

async function signUp(email, password) {
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) { showAuthMessage(error.message); return false; }
    showAuthMessage('Conta criada! Fazendo login...', 'success');
    await signIn(email, password);
    return true;
}

async function signIn(email, password) {
    // Salvar preferência de "manter conectado" ANTES do login
    const keepEl = document.getElementById('keepLoggedIn');
    const keepLoggedIn = keepEl ? keepEl.checked : true;
    localStorage.setItem('flowly_persist_session', keepLoggedIn.toString());

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { showAuthMessage(error.message); return false; }

    currentUser = data.user;
    document.getElementById('authModal').classList.remove('show');
    document.getElementById('userEmail').textContent = data.user.email;
    await migrateLocalDataToSupabase();
    await loadDataFromSupabase();
    renderView(); // Renderizar a view após login
    return true;
}

async function signOut() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    document.getElementById('authModal').classList.add('show');
    location.reload();
}

function showAuthMessage(msg, type = 'error') {
    const el = document.getElementById('authMessage');
    el.textContent = msg;
    el.style.color = type === 'error' ? '#ff453a' : '#30d158';
}

// --- Sync Logic ---

async function migrateLocalDataToSupabase() {
    if (!currentUser) return;

    // Verificar se já existem dados no Supabase para este usuário
    const { data: existingTasks } = await supabaseClient.from('tasks').select('id').eq('user_id', currentUser.id).limit(1);
    const hasSupabaseData = existingTasks && existingTasks.length > 0;

    // Se já tem dados no Supabase, não sobrescreve (dados da nuvem têm prioridade)
    if (hasSupabaseData) {
        localStorage.removeItem('weekData');
        return;
    }

    // Se não tem dados no Supabase, sobe os dados locais (allTasksData)
    const localTasksData = JSON.parse(localStorage.getItem('allTasksData') || '{}');
    const inserts = [];

    Object.entries(localTasksData).forEach(([dateStr, periods]) => {
        // Só migra datas no formato YYYY-MM-DD (ignora nomes de dias antigos)
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
        // Atualizar supabaseId nas tarefas locais
        if (inserted) {
            inserted.forEach(row => {
                const tasks = allTasksData[row.day]?.[row.period];
                if (tasks) {
                    const match = tasks.find(t => t.text === row.text && !t.supabaseId);
                    if (match) match.supabaseId = row.id;
                }
            });
            localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
        }
    }

    localStorage.removeItem('weekData');
}

async function loadDataFromSupabase() {
    if (!currentUser) return;
    const { data: tasks, error } = await supabaseClient.from('tasks').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: true });

    const idsToDelete = [];
    allTasksData = {};
    const remoteDailyRoutine = [];
    const remoteRecurringTasks = [];

    if (tasks && tasks.length > 0) {
        tasks.forEach(task => {
            // Handle Routine Definitions (legacy)
            if (task.day === 'ROUTINE') {
                remoteDailyRoutine.push({
                    text: task.text,
                    completed: false,
                    color: task.color || 'default',
                    isHabit: true
                });
                return;
            }
            // Handle Recurring Task Definitions
            if (task.day === 'RECURRING') {
                remoteRecurringTasks.push({
                    text: task.text,
                    daysOfWeek: (() => { try { return JSON.parse(task.period); } catch(e) { return [0,1,2,3,4,5,6]; } })(),
                    priority: 'none',
                    color: task.color || 'default',
                    isHabit: task.is_habit || false,
                    createdAt: task.created_at || new Date().toISOString()
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
    }

    // Sync allRecurringTasks - Supabase é fonte de verdade
    if (remoteRecurringTasks.length > 0) {
        allRecurringTasks = remoteRecurringTasks;
        localStorage.setItem('allRecurringTasks', JSON.stringify(allRecurringTasks));
    } else if (allRecurringTasks.length > 0) {
        // Não tem no Supabase mas tem local -> enviar
        await syncRecurringTasksToSupabase();
    }

    if (typeof normalizeAllTasks === 'function') normalizeAllTasks();
    localStorage.setItem('allTasksData', JSON.stringify(allTasksData));

    const { data: habits } = await supabaseClient.from('habits_history').select('*').eq('user_id', currentUser.id);
    if (habits) {
        habitsHistory = {};
        habits.forEach(h => {
            if (!habitsHistory[h.habit_name]) habitsHistory[h.habit_name] = {};
            habitsHistory[h.habit_name][h.date] = h.completed;
        });
    }

    // Realtime Setup
    if (!window._flowlySubscription) {
        console.log('[Realtime] Iniciando subscrição...');
        window._flowlySubscription = supabaseClient
            .channel('flowly_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
                const uid = payload.new?.user_id || payload.old?.user_id;
                if (uid === currentUser.id) {
                    console.log('[Realtime] Tasks atualizadas.');
                    if (window._rtTimeout) clearTimeout(window._rtTimeout);
                    window._rtTimeout = setTimeout(async () => {
                        await loadDataFromSupabase();
                        renderView();
                        if (typeof renderRoutineView === 'function') renderRoutineView();
                    }, 500);
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'habits_history' }, (payload) => {
                const uid = payload.new?.user_id || payload.old?.user_id;
                if (uid === currentUser.id) {
                    console.log('[Realtime] Habits atualizados.');
                    if (window._rtTimeout) clearTimeout(window._rtTimeout);
                    window._rtTimeout = setTimeout(async () => {
                        await loadDataFromSupabase();
                        renderRoutineView();
                    }, 500);
                }
            })
            .subscribe();
    }
}

async function syncDailyRoutineToSupabase() {
    if (!currentUser) return;
    // Remove antigas definiÇÕES
    await supabaseClient.from('tasks').delete().eq('user_id', currentUser.id).eq('day', 'ROUTINE');

    // Insere novas
    if (dailyRoutine.length > 0) {
        const inserts = dailyRoutine.map(t => ({
            user_id: currentUser.id,
            day: 'ROUTINE',
            period: 'daily',
            text: t.text,
            completed: false,
            is_habit: true,
            color: t.color || 'default'
        }));
        await supabaseClient.from('tasks').insert(inserts);
    }
}

// Sincroniza allRecurringTasks com Supabase (usando day='RECURRING')
async function syncRecurringTasksToSupabase() {
    if (!currentUser) return;
    try {
        await supabaseClient.from('tasks').delete()
            .eq('user_id', currentUser.id)
            .eq('day', 'RECURRING');
        if (allRecurringTasks.length > 0) {
            const inserts = allRecurringTasks.map(t => ({
                user_id: currentUser.id,
                day: 'RECURRING',
                period: JSON.stringify(t.daysOfWeek || []),
                text: t.text,
                completed: false,
                is_habit: t.isHabit || false,
                color: t.color || 'default'
            }));
            await supabaseClient.from('tasks').insert(inserts);
        }
    } catch (e) { /* silencioso */ }
}

async function syncTaskToSupabase(dateStr, period, task) {
    if (!currentUser) return;
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
            user_id: currentUser.id,
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

async function deleteTaskFromSupabase(task) {
    if (!currentUser || !task.supabaseId) return;
    await supabaseClient.from('tasks').delete().eq('id', task.supabaseId);
}

async function syncHabitToSupabase(habitText, date, completed) {
    if (!currentUser) return;
    await supabaseClient.from('habits_history').upsert({
        user_id: currentUser.id, habit_name: habitText, date, completed
    }, { onConflict: 'user_id,habit_name,date' });
}

let _isSyncingDate = false;



function loadFromLocalStorage() {
    const saved = localStorage.getItem('weekData');
    if (saved) {
        const savedData = JSON.parse(saved);
        Object.keys(weekData).forEach(day => { if (savedData[day]) weekData[day] = savedData[day]; });
    }
}

// --- Render Functions ---

// --- Habits & Analytics Logic ---

function getAllHabits() {
    const habits = [], habitMap = new Map();
    const today = localDateStr();

    // Adicionar todas recorrentes (inclui dailyRoutine e weeklyRecurring unificados)
    allRecurringTasks.forEach(task => {
        if ((task.isHabit || (task.daysOfWeek && task.daysOfWeek.length > 0)) && !habitMap.has(task.text)) {
            const isCompleted = habitsHistory[task.text] && habitsHistory[task.text][today];
            habitMap.set(task.text, {
                text: task.text,
                color: task.color,
                completedToday: !!isCompleted,
                isHabit: true
            });
        }
    });

    // Fallback dailyRoutine legacy
    dailyRoutine.forEach(task => {
        if (!habitMap.has(task.text)) {
            const isCompleted = habitsHistory[task.text] && habitsHistory[task.text][today];
            habitMap.set(task.text, { text: task.text, color: task.color, completedToday: !!isCompleted, isHabit: true });
        }
    });

    return Array.from(habitMap.values());
}

function getHabitStreak(habitText) { if (!habitsHistory[habitText]) return 0; const today = new Date(); let streak = 0, currentDate = new Date(today); while (true) { const dateKey = localDateStr(currentDate); if (habitsHistory[habitText][dateKey]) { streak++; currentDate.setDate(currentDate.getDate() - 1); } else { break; } } return streak; }

function getHabitCompletionRate(habitText, days = 30) { if (!habitsHistory[habitText]) return 0; const today = new Date(); let completed = 0; for (let i = 0; i < days; i++) { const date = new Date(today); date.setDate(date.getDate() - i); const dateKey = localDateStr(date); if (habitsHistory[habitText][dateKey]) { completed++; } } return Math.round((completed / days) * 100); }

function markHabitCompleted(habitText, completed) { const today = localDateStr(); if (!habitsHistory[habitText]) { habitsHistory[habitText] = {}; } if (completed) { habitsHistory[habitText][today] = true; } else { delete habitsHistory[habitText][today]; } localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory)); syncHabitToSupabase(habitText, today, completed); }

window.toggleHabitToday = function (habitText, completed) {
    markHabitCompleted(habitText, completed);
    renderView();
    if (currentView === 'routine' && typeof renderRoutineView === 'function') renderRoutineView();
}

function removeHabit(habitText) {
    if (!confirm(`Tem certeza que deseja remover "${habitText}" dos hábitos?\n\nIsso irá desmarcar esta tarefa como hábito em todas as ocorrências.`)) return;

    // Remover de allRecurringTasks
    const recurringIdx = allRecurringTasks.findIndex(t => t.text === habitText);
    if (recurringIdx !== -1) {
        allRecurringTasks.splice(recurringIdx, 1);
        saveToLocalStorage();
        syncRecurringTasksToSupabase();
    }

    // Desmarcar como hábito em todas as tarefas existentes
    Object.entries(allTasksData).forEach(([dateStr, periods]) => {
        Object.entries(periods).forEach(([period, tasks]) => {
            tasks.forEach(task => {
                if (task.text === habitText && task.isHabit) {
                    task.isHabit = false;
                }
            });
        });
    });

    // Limpar histórico do hábito
    if (habitsHistory[habitText]) {
        delete habitsHistory[habitText];
        localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory));
    }

    saveToLocalStorage();
    if (currentView === 'routine') renderRoutineView();
    setTimeout(() => lucide.createIcons(), 0);
}

function renderHabitsView() {
    const view = document.getElementById('habitsView'), habits = getAllHabits();
    if (habits.length === 0) { view.innerHTML = '<div class="text-center py-20"><p class="text-gray-400 text-lg">Nenhum hábito rastreado ainda.</p><p class="text-gray-600 text-sm mt-2">Marque tasks como hábitos no menu de contexto (botão direito).</p></div>'; return; }

    let html = `<div class="max-w-5xl mx-auto"><h2 class="text-3xl font-bold mb-8 text-white flex items-center gap-3"><i data-lucide="repeat" style="width: 28px; height: 28px;"></i> Meus Hábitos</h2><div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6"><div class="text-gray-400 text-sm mb-1 uppercase tracking-wider font-semibold">Total de Hábitos</div><div class="text-3xl font-bold text-white">${habits.length}</div></div>
            <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6"><div class="text-gray-400 text-sm mb-1 uppercase tracking-wider font-semibold">Concluídos Hoje</div><div class="text-3xl font-bold text-[#30d158]">${habits.filter(h => h.completedToday).length}</div></div>
            <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6"><div class="text-gray-400 text-sm mb-1 uppercase tracking-wider font-semibold">Taxa Hoje</div><div class="text-3xl font-bold text-[#0A84FF]">${habits.length > 0 ? Math.round((habits.filter(h => h.completedToday).length / habits.length) * 100) : 0}%</div></div></div><div class="space-y-3">`;

    habits.forEach((habit, index) => {
        const streak = getHabitStreak(habit.text), completionRate = getHabitCompletionRate(habit.text, 30);
        html += `<div class="bg-[#1c1c1e] bg-opacity-40 backdrop-blur-md border border-white/5 rounded-xl p-5 hover:bg-opacity-60 transition-all flex items-center justify-between gap-4 group">
                <div class="flex items-center gap-4 flex-1">
                    <input type="checkbox" class="checkbox-custom mt-1" ${habit.completedToday ? 'checked' : ''} onchange="toggleHabitToday('${habit.text.replace(/'/g, "\\'")}', this.checked)">
                    <div class="flex-1">
                        <div class="color-${habit.color} font-medium text-lg mb-1 group-hover:text-white transition-colors">${habit.text}</div>
                        <div class="flex items-center gap-3 text-xs text-gray-400">
                            ${streak > 0 ? `<span class="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium flex items-center gap-1"><i data-lucide="flame" style="width: 14px; height: 14px;"></i> ${streak} dias</span>` : ''}
                            <span>${completionRate}% consistency (30d)</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="w-32 h-1.5 bg-gray-700/30 rounded-full overflow-hidden flex-shrink-0"><div class="h-full bg-blue-500 rounded-full transition-all duration-500" style="width: ${completionRate}%"></div></div>
                    <button onclick="removeHabit('${habit.text.replace(/'/g, "\\'")}');" class="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-lg" title="Remover hábito">
                        <i data-lucide="x" class="text-red-400" style="width: 18px; height: 18px;"></i>
                    </button>
                </div>
                </div>`;
    });
    html += `</div></div>`;
    view.innerHTML = html;
}

function renderAnalyticsView() {
    const view = document.getElementById('analyticsView');

    // Calcular dados da semana atual
    const weekDates = getWeekDates(0);
    let totalTasksWeek = 0, completedTasksWeek = 0;
    let totalTasksToday = 0, completedTasksToday = 0;
    const today = localDateStr();

    // Estatísticas por dia da semana
    const dayStats = {};

    // Contar tarefas de toda a semana
    weekDates.forEach(({ name, dateStr }) => {
        const dayTasks = allTasksData[dateStr] || {};
        let dayTotal = 0, dayCompleted = 0;

        // Contar apenas tarefas normais persistidas (excluir período 'Rotina')
        Object.entries(dayTasks).forEach(([period, tasks]) => {
            if (period === 'Rotina') return;
            if (Array.isArray(tasks)) {
                tasks.forEach(task => {
                    dayTotal++;
                    totalTasksWeek++;
                    if (task.completed) {
                        dayCompleted++;
                        completedTasksWeek++;
                    }

                    if (dateStr === today) {
                        totalTasksToday++;
                        if (task.completed) completedTasksToday++;
                    }
                });
            }
        });

        // Adicionar rotina + recorrentes semanais (geradas dinamicamente)
        const routineForDay = getRoutineTasksForDate(dateStr);
        dayTotal += routineForDay.length;
        totalTasksWeek += routineForDay.length;
        dayCompleted += routineForDay.filter(t => t.completed).length;
        completedTasksWeek += routineForDay.filter(t => t.completed).length;

        if (dateStr === today) {
            totalTasksToday += routineForDay.length;
            completedTasksToday += routineForDay.filter(t => t.completed).length;
        }

        dayStats[name] = { total: dayTotal, completed: dayCompleted };
    });

    // Dados de hábitos (para o card de hábitos)
    const totalHabits = getAllHabits().length;
    const completedHabitsToday = getAllHabits().filter(h => h.completedToday).length;

    const todayRate = totalTasksToday > 0 ? Math.round((completedTasksToday / totalTasksToday) * 100) : 0;
    const weekRate = totalTasksWeek > 0 ? Math.round((completedTasksWeek / totalTasksWeek) * 100) : 0;
    const habitRate = totalHabits > 0 ? Math.round((completedHabitsToday / totalHabits) * 100) : 0;

    // Calcular streak (dias consecutivos com todas as tarefas completas)
    let currentStreak = 0;
    const checkDate = new Date();
    for (let i = 0; i < 30; i++) {
        const cDateStr = localDateStr(checkDate);
        const cDayTasks = allTasksData[cDateStr] || {};
        let dayTotal = 0;
        let dayCompleted = 0;

        // Contar tarefas normais (excluir período 'Rotina')
        Object.entries(cDayTasks).forEach(([period, tasks]) => {
            if (period === 'Rotina') return;
            if (Array.isArray(tasks)) {
                dayTotal += tasks.length;
                dayCompleted += tasks.filter(t => t.completed).length;
            }
        });

        // Contar rotina + recorrentes
        const routineForCheck = getRoutineTasksForDate(cDateStr);
        dayTotal += routineForCheck.length;
        dayCompleted += routineForCheck.filter(t => t.completed).length;

        if (dayTotal > 0 && dayCompleted === dayTotal) {
            currentStreak++;
        } else if (i > 0 || (i === 0 && dayTotal > 0)) {
            break;
        }
        checkDate.setDate(checkDate.getDate() - 1);
    }

    let html = `<div class="max-w-6xl mx-auto">
                <h2 class="text-3xl font-bold mb-2 text-white flex items-center gap-3">
                    <i data-lucide="bar-chart-3" style="width: 28px; height: 28px;"></i> Analytics
                </h2>
                <p class="text-gray-400 text-sm mb-8">Acompanhe sua produtividade e evolução</p>

                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">`;

    // Card customizado com cores dinÃ¢micas
    const card = (label, val, sub, gradient = 'from-blue-400 to-indigo-400', icon = '') => {
        return `<div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                    <div class="text-gray-400 text-sm mb-2 uppercase tracking-wider font-semibold">${label}</div>
                    <div class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${gradient}">${icon}${val}</div>
                    <div class="text-xs text-gray-500 mt-2">${sub}</div>
                </div>`;
    };

    // Cards com cores dinÃ¢micas
    const todayGradient = todayRate >= 70 ? 'from-green-400 to-emerald-400' : todayRate >= 40 ? 'from-orange-400 to-yellow-400' : 'from-red-400 to-pink-400';
    const todayIcon = todayRate >= 70 ? '&#128293; ' : todayRate >= 40 ? '&#9889; ' : '&#128164; ';

    // Calcular semana passada para comparação
    const lastWeekDates = getWeekDates(-1);
    let lastWeekTotal = 0, lastWeekCompleted = 0;
    lastWeekDates.forEach(({ dateStr }) => {
        const dayTasks = allTasksData[dateStr] || {};
        Object.entries(dayTasks).forEach(([period, tasks]) => {
            if (period === 'Rotina') return;
            if (Array.isArray(tasks)) {
                lastWeekTotal += tasks.length;
                lastWeekCompleted += tasks.filter(t => t.completed).length;
            }
        });
        // Rotina + recorrentes
        const routineForLW = getRoutineTasksForDate(dateStr);
        lastWeekTotal += routineForLW.length;
        lastWeekCompleted += routineForLW.filter(t => t.completed).length;
    });
    const lastWeekRate = lastWeekTotal > 0 ? Math.round((lastWeekCompleted / lastWeekTotal) * 100) : 0;
    const weekDiff = weekRate - lastWeekRate;
    const weekTrend = weekDiff > 0 ? '&#128200;' : weekDiff < 0 ? '&#128201;' : '&#10145;';
    const weekCompare = weekDiff !== 0 ? `${weekTrend} ${Math.abs(weekDiff)}% vs semana anterior` : 'Mesmo que semana anterior';

    // Melhor e pior dia
    const dayRates = Object.entries(dayStats).map(([name, stats]) => ({
        name,
        rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
        total: stats.total
    })).filter(d => d.total > 0);

    const bestDay = dayRates.reduce((best, day) => day.rate > best.rate ? day : best, { name: '-', rate: 0 });
    const worstDay = dayRates.reduce((worst, day) => day.rate < worst.rate ? day : worst, { name: '-', rate: 100 });

    html += card('Hoje', `${todayIcon}${todayRate}%`, `${completedTasksToday}/${totalTasksToday} tarefas`, todayGradient);
    html += card('Semana', `${weekRate}%`, weekCompare, weekDiff > 0 ? 'from-green-400 to-emerald-400' : weekDiff < 0 ? 'from-red-400 to-pink-400' : 'from-blue-400 to-indigo-400');
    html += card('Hábitos', `${habitRate}%`, `${completedHabitsToday}/${totalHabits} concluídos`, habitRate === 100 && totalHabits > 0 ? 'from-green-400 to-emerald-400' : 'from-purple-400 to-pink-400');
    html += card('Streak', currentStreak > 0 ? `${currentStreak} ${currentStreak === 1 ? 'dia' : 'dias'}` : '0', currentStreak > 0 ? '🔥 Dias perfeitos' : 'Complete 100% hoje!', currentStreak >= 7 ? 'from-orange-400 to-red-400' : 'from-gray-400 to-gray-500');

    html += `</div>

            <!-- Gráficos -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                    <h3 class="text-lg font-semibold mb-6 text-gray-200 flex items-center gap-2">
                        <i data-lucide="calendar-days" style="width: 20px; height: 20px;"></i>
                        Progresso da Semana
                    </h3>
                    <canvas id="weekChart"></canvas>
                </div>
                <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                    <h3 class="text-lg font-semibold mb-6 text-gray-200 flex items-center gap-2">
                        <i data-lucide="target" style="width: 20px; height: 20px;"></i>
                        Status de Hábitos
                    </h3>
                    <div class="h-64 flex items-center justify-center"><canvas id="habitsChart"></canvas></div>
                </div>
            </div>

            <!-- Gráfico de Progresso Mensal -->
            <div class="mt-6 bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2">
                        <i data-lucide="trending-up" style="width: 20px; height: 20px;"></i>
                        Progresso do Mês
                    </h3>
                    <span id="monthChartLabel" class="text-sm text-gray-400"></span>
                </div>
                <canvas id="monthChart"></canvas>
            </div>

            <!-- Melhor e Pior Dia da Semana -->
            <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                    <h3 class="text-sm font-semibold mb-3 text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <i data-lucide="trophy" style="width: 16px; height: 16px;"></i>
                        Melhor Dia da Semana
                    </h3>
                    ${bestDay.name !== '-' ? `
                        <div class="flex items-center justify-between">
                            <div class="text-2xl font-bold text-green-400">${bestDay.name}</div>
                            <div class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                                ${bestDay.rate}%
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 mt-2">Maior taxa de conclusão esta semana</p>
                    ` : '<p class="text-gray-500 text-sm">Aguardando dados...</p>'}
                </div>
                <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                    <h3 class="text-sm font-semibold mb-3 text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <i data-lucide="alert-circle" style="width: 16px; height: 16px;"></i>
                        Dia que Precisa de Atenção
                    </h3>
                    ${worstDay.name !== '-' && dayRates.length > 1 ? `
                        <div class="flex items-center justify-between">
                            <div class="text-2xl font-bold text-orange-400">${worstDay.name}</div>
                            <div class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
                                ${worstDay.rate}%
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 mt-2">Menor taxa de conclusão esta semana</p>
                    ` : '<p class="text-gray-500 text-sm">Aguardando dados...</p>'}
                </div>
            </div>

            <!-- Ranking de Hábitos -->
            <div class="mt-6 bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h3 class="text-lg font-semibold mb-4 text-gray-200 flex items-center gap-2">
                    <i data-lucide="award" style="width: 20px; height: 20px;"></i>
                    Ranking de Hábitos (30 dias)
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${(() => {
            const habits = getAllHabits();
            const habitRanking = habits.map(h => ({
                text: h.text,
                rate: getHabitCompletionRate(h.text, 30),
                streak: getHabitStreak(h.text)
            })).sort((a, b) => b.rate - a.rate);

            if (habitRanking.length === 0) {
                return '<p class="text-gray-500 text-sm col-span-2">Nenhum hábito rastreado ainda.</p>';
            }

            return habitRanking.slice(0, 6).map((habit, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}Âº`;
                const color = habit.rate >= 80 ? 'text-green-400' : habit.rate >= 60 ? 'text-blue-400' : 'text-gray-400';
                return `
                                <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                                    <div class="flex items-center gap-3 flex-1 min-w-0">
                                        <span class="text-xl">${medal}</span>
                                        <div class="flex-1 min-w-0">
                                            <div class="font-medium truncate">${habit.text}</div>
                                            <div class="text-xs text-gray-500">
                                                ${habit.streak > 0 ? `🔥 ${habit.streak} dias` : 'Sem streak'}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="text-xl font-bold ${color}">${habit.rate}%</div>
                                </div>
                            `;
            }).join('');
        })()}
                </div>
            </div>

            <!-- Heatmap Mensal -->
            <div class="mt-6 bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h3 class="text-lg font-semibold mb-4 text-gray-200 flex items-center gap-2">
                    <i data-lucide="calendar-heart" style="width: 20px; height: 20px;"></i>
                    Heatmap de Produtividade (Últimos 30 Dias)
                </h3>
                <div id="heatmapContainer" class="grid grid-cols-7 gap-2">
                    ${(() => {
            let heatmapHtml = '';
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 29);

            const currentDate = new Date(startDate);
            for (let i = 0; i < 30; i++) {
                const dateStr = localDateStr(currentDate);
                const dayTasks = allTasksData[dateStr] || {};
                let total = 0, completed = 0;

                // Tarefas normais (excluir período 'Rotina')
                Object.entries(dayTasks).forEach(([period, tasks]) => {
                    if (period === 'Rotina') return;
                    if (Array.isArray(tasks)) {
                        total += tasks.length;
                        completed += tasks.filter(t => t.completed).length;
                    }
                });
                // Rotina + recorrentes
                const routineHM = getRoutineTasksForDate(dateStr);
                total += routineHM.length;
                completed += routineHM.filter(t => t.completed).length;

                const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
                const intensity = rate >= 80 ? 'bg-green-500' : rate >= 60 ? 'bg-blue-500' : rate >= 40 ? 'bg-orange-500' : rate > 0 ? 'bg-red-500' : 'bg-gray-700';
                const dayNum = currentDate.getDate();
                const isToday = dateStr === localDateStr();

                heatmapHtml += `
                                <div class="relative group">
                                    <div class="${intensity} ${isToday ? 'ring-2 ring-blue-400' : ''} aspect-square rounded-lg flex items-center justify-center text-xs font-bold hover:scale-110 transition-all cursor-pointer"
                                         title="${dateStr}: ${rate}% (${completed}/${total})">
                                        ${dayNum}
                                    </div>
                                    <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                        ${dateStr}<br>${rate}% (${completed}/${total})
                                    </div>
                                </div>
                            `;

                currentDate.setDate(currentDate.getDate() + 1);
            }
            return heatmapHtml;
        })()}
                </div>
                <div class="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 bg-gray-700 rounded"></div>
                        <span>Sem dados</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 bg-red-500 rounded"></div>
                        <span>&lt;40%</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 bg-orange-500 rounded"></div>
                        <span>40-60%</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 bg-blue-500 rounded"></div>
                        <span>60-80%</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 bg-green-500 rounded"></div>
                        <span>â‰¥80%</span>
                    </div>
                </div>
            </div>

            <!-- Insights -->
            <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                ${totalTasksToday > 0 && completedTasksToday === totalTasksToday ? `
                    <div class="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                        <div class="flex items-center gap-2 text-green-400 font-semibold mb-1">
                            <i data-lucide="check-circle" style="width: 18px; height: 18px;"></i>
                            Dia Perfeito!
                        </div>
                        <p class="text-sm text-green-300/80">Você completou todas as tarefas de hoje! ðŸŽ‰</p>
                    </div>
                ` : ''}
                ${currentStreak >= 3 ? `
                    <div class="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                        <div class="flex items-center gap-2 text-orange-400 font-semibold mb-1">
                            <i data-lucide="flame" style="width: 18px; height: 18px;"></i>
                            Streak Ativo!
                        </div>
                        <p class="text-sm text-orange-300/80">${currentStreak} dias consecutivos! Continue assim!</p>
                    </div>
                ` : ''}
                ${habitRate === 100 && totalHabits > 0 ? `
                    <div class="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                        <div class="flex items-center gap-2 text-purple-400 font-semibold mb-1">
                            <i data-lucide="sparkles" style="width: 18px; height: 18px;"></i>
                            Hábitos 100%
                        </div>
                        <p class="text-sm text-purple-300/80">Todos os hábitos completados hoje!</p>
                    </div>
                ` : ''}
            </div>
            </div>`;

    view.innerHTML = html;

    setTimeout(() => {
        // Gráfico de progresso semanal
        const weekCtx = document.getElementById('weekChart');
        if (weekCtx) {
            const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
            const dayData = weekDates.map(({ name }) => {
                const stats = dayStats[name] || { total: 0, completed: 0 };
                return stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
            });

            new Chart(weekCtx, {
                type: 'line',
                data: {
                    labels: dayNames,
                    datasets: [{
                        label: 'Taxa de Conclusão (%)',
                        data: dayData,
                        borderColor: '#0A84FF',
                        backgroundColor: 'rgba(10, 132, 255, 0.1)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#0A84FF'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#888', callback: (value) => value + '%' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#888' }
                        }
                    }
                }
            });
        }

        // Gráfico de hábitos
        const hCtx = document.getElementById('habitsChart');
        if (hCtx) {
            new Chart(hCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Concluídos', 'Pendentes'],
                    datasets: [{
                        data: [completedHabitsToday, totalHabits - completedHabitsToday],
                        backgroundColor: ['#30d158', '#2c2c2e'],
                        borderWidth: 0
                    }]
                },
                options: {
                    cutout: '75%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#9ca3af',
                                usePointStyle: true,
                                pointStyle: 'circle',
                                padding: 15
                            }
                        }
                    }
                }
            });
        }

        // Gráfico de progresso mensal
        const monthCtx = document.getElementById('monthChart');
        if (monthCtx) {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const todayDay = now.getDate();

            const monthLabels = [];
            const monthData = [];
            const pointColors = [];

            for (let d = 1; d <= daysInMonth; d++) {
                monthLabels.push(d);
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dayTasks = allTasksData[dateStr] || {};
                let total = 0, completed = 0;
                // Tarefas normais (excluir período 'Rotina')
                Object.entries(dayTasks).forEach(([period, tasks]) => {
                    if (period === 'Rotina') return;
                    if (Array.isArray(tasks)) {
                        total += tasks.length;
                        completed += tasks.filter(t => t.completed).length;
                    }
                });
                // Rotina + recorrentes
                const routineMC = getRoutineTasksForDate(dateStr);
                total += routineMC.length;
                completed += routineMC.filter(t => t.completed).length;
                const rate = d <= todayDay ? (total > 0 ? Math.round((completed / total) * 100) : null) : null;
                monthData.push(rate);
                if (d === todayDay) pointColors.push('#30D158');
                else if (rate === null) pointColors.push('transparent');
                else if (rate >= 80) pointColors.push('#30D158');
                else if (rate >= 50) pointColors.push('#0A84FF');
                else pointColors.push('#FF453A');
            }

            // Atualiza label do mês
            const labelEl = document.getElementById('monthChartLabel');
            if (labelEl) labelEl.textContent = `${monthNames[month]} ${year}`;

            new Chart(monthCtx, {
                type: 'line',
                data: {
                    labels: monthLabels,
                    datasets: [{
                        label: 'Conclusão diária (%)',
                        data: monthData,
                        borderColor: '#0A84FF',
                        backgroundColor: 'rgba(10, 132, 255, 0.08)',
                        tension: 0.35,
                        fill: true,
                        borderWidth: 2.5,
                        pointRadius: monthData.map((v, i) => {
                            if (v === null) return 0;
                            return i + 1 === todayDay ? 7 : 4;
                        }),
                        pointHoverRadius: 7,
                        pointBackgroundColor: pointColors,
                        pointBorderColor: pointColors,
                        spanGaps: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.85)',
                            titleColor: '#ccc',
                            bodyColor: '#fff',
                            callbacks: {
                                title: (items) => `Dia ${items[0].label}`,
                                label: (item) => item.raw !== null ? ` ${item.raw}% concluído` : ' Sem dados'
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            grid: { color: 'rgba(255,255,255,0.07)' },
                            ticks: {
                                color: '#888',
                                callback: (value) => value + '%',
                                stepSize: 25
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: '#888',
                                maxTicksLimit: 15,
                                callback: function (val, index) {
                                    const day = index + 1;
                                    return day === 1 || day % 5 === 0 || day === daysInMonth ? day : '';
                                }
                            }
                        }
                    }
                }
            });
        }

        lucide.createIcons();
    }, 100);
}

function renderMonth() {
    const view = document.getElementById('monthView');
    const { firstDay, lastDay, month, year } = getMonthDates(currentMonthOffset);

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    let html = `
                <div class="max-w-[1400px] mx-auto">
                    <div class="flex items-center justify-center gap-4 mb-6">
                        <button onclick="currentMonthOffset--; renderView();" class="utility-btn">
                            <i data-lucide="chevron-left" style="width: 18px; height: 18px;"></i>
                        </button>
                        <h2 class="text-2xl font-bold text-white min-w-[200px] text-center">
                            ${monthNames[month]} ${year}
                        </h2>
                        <button onclick="currentMonthOffset++; renderView();" class="utility-btn">
                            <i data-lucide="chevron-right" style="width: 18px; height: 18px;"></i>
                        </button>
                        <button onclick="currentMonthOffset = 0; renderView();" class="btn-secondary text-xs px-3 py-1 ml-4" style="width: auto; padding: 6px 12px;">
                            Mês Atual
                        </button>
                    </div>

                    <!-- Cabeçalho dos dias da semana -->
                    <div class="grid grid-cols-7 gap-2 mb-2">
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Seg</div>
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Ter</div>
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Qua</div>
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Qui</div>
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Sex</div>
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Sáb</div>
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Dom</div>
                    </div>

                    <!-- Grid do calendário -->
                    <div class="grid grid-cols-7 gap-2">
            `;

    // Calcular o primeiro dia da semana (segunda = 0)
    const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    // Preencher dias vazios antes do primeiro dia
    for (let i = 0; i < firstDayOfWeek; i++) {
        html += `<div class="min-h-[120px] bg-[#1c1c1e] bg-opacity-30 rounded-lg"></div>`;
    }

    // Preencher os dias do mês
    const today = localDateStr();
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(year, month, day);
        const dateStr = localDateStr(date);
        const isToday = dateStr === today;

        const dayTasks = allTasksData[dateStr] || {};
        let totalTasks = 0;
        let completedTasks = 0;

        // Conjunto de textos ignorados (recorrentes e rotinas)
        const ignoredTexts = new Set([
            ...weeklyRecurringTasks.map(t => t.text),
            ...dailyRoutine.map(t => t.text)
        ]);

        // Contar apenas tarefas normais persistidas (excluir período 'Rotina' e tarefas que são cópias de recorrentes)
        Object.entries(dayTasks).forEach(([period, tasks]) => {
            if (period === 'Rotina') return;
            if (Array.isArray(tasks)) {
                // Filtra tarefas que não são recorrentes
                const validTasks = tasks.filter(t => !ignoredTexts.has(t.text));
                totalTasks += validTasks.length;
                completedTasks += validTasks.filter(t => t.completed).length;
            }
        });

        const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        html += `
                    <div class="min-h-[120px] bg-[#1c1c1e] bg-opacity-40 rounded-lg p-3 hover:bg-opacity-60 transition-all cursor-pointer border ${isToday ? 'border-blue-500' : 'border-white/5'}"
                         onclick="goToDate('${dateStr}')">
                        <div class="flex items-center justify-between mb-2">
                            <div class="text-sm font-semibold ${isToday ? 'text-blue-400' : 'text-white'}">${day}</div>
                            ${totalTasks > 0 ? `
                                <div class="text-xs text-gray-500">
                                    ${completedTasks}/${totalTasks}
                                </div>
                            ` : ''}
                        </div>

                        ${totalTasks > 0 ? `
                            <div class="w-full h-1 bg-gray-700/30 rounded-full overflow-hidden mb-2">
                                <div class="h-full bg-blue-500 rounded-full transition-all" style="width: ${completionPercent}%"></div>
                            </div>
                        ` : ''}

                        <div class="text-xs text-gray-600 space-y-1">
                            ${totalTasks === 0 ? '<div class="text-center py-4 text-gray-700">Sem tarefas</div>' : ''}
                        </div>
                    </div>
                `;
    }

    html += `
                    </div>
                </div>
            `;

    view.innerHTML = html;
}

function goToDate(dateStr) {
    // Calcular qual semana essa data está
    const targetDate = new Date(dateStr);
    const today = new Date();
    const diffTime = targetDate - today;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    currentWeekOffset = Math.floor(diffDays / 7);

    // Mudar para view semanal
    setView('week');
}

function renderRoutineView() {
    const view = document.getElementById('routineView');
    if (!view) return;
    view.innerHTML = '';

    // --- DATA CALCS ---
    const routineCompletions = JSON.parse(localStorage.getItem('routineCompletions') || '{}');
    const today = new Date();
    const todayStr = localDateStr(today);
    const dayName = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][today.getDay()];

    // 1. Today Stats
    const todayTasks = getRoutineTasksForDate(todayStr);
    const totalToday = todayTasks.length;
    let completedToday = 0;
    todayTasks.forEach(t => { if (t.completed) completedToday++; });
    const todayPercent = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

    // 2. Weekly & Graph
    let totalWeekScheduled = 0;
    let totalWeekCompleted = 0;
    const consistencyData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(today.getDate() - i); const dStr = localDateStr(d);
        const tasksForDay = getRoutineTasksForDate(dStr);
        const count = tasksForDay.length;
        let completed = 0;
        if (count > 0) completed = tasksForDay.filter(t => t.completed).length;
        if (count > 0) { totalWeekScheduled += count; totalWeekCompleted += completed; consistencyData.push({ day: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()], val: Math.round((completed / count) * 100) }); }
        else { consistencyData.push({ day: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()], val: 0 }); }
    }
    const weeklyRate = totalWeekScheduled > 0 ? Math.round((totalWeekCompleted / totalWeekScheduled) * 100) : 0;

    // 3. Streak
    let currentStreak = 0;
    let bestDayCounts = [0, 0, 0, 0, 0, 0, 0];
    let tempStreak = 0;
    for (let i = 0; i < 365; i++) {
        const d = new Date(); d.setDate(today.getDate() - i); const dStr = localDateStr(d);
        const tasks = getRoutineTasksForDate(dStr);
        if (tasks.length > 0) {
            const completed = tasks.filter(t => t.completed).length;
            if (i < 30 && completed === tasks.length) bestDayCounts[d.getDay()]++;
            if (completed === tasks.length) { if (d <= today) tempStreak++; } else { if (d < today) break; }
        }
    }
    currentStreak = tempStreak;
    let maxPerfect = -1; let bestDayIdx = 0;
    bestDayCounts.forEach((count, idx) => { if (count > maxPerfect) { maxPerfect = count; bestDayIdx = idx; } });
    const bestDayLabel = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][bestDayIdx];

    // Heatmap HTML (Standard Clean)
    let htmlHeatmap = '';
    for (let i = 27; i >= 0; i--) {
        const d = new Date(); d.setDate(today.getDate() - i); const dStr = localDateStr(d);
        const tasks = getRoutineTasksForDate(dStr);
        let colorClass = 'bg-[#333]';
        if (tasks.length > 0) {
            const completed = tasks.filter(t => t.completed).length;
            const rate = completed / tasks.length;
            if (rate === 1) colorClass = 'bg-emerald-500';
            else if (rate >= 0.5) colorClass = 'bg-emerald-500/50';
            else if (rate > 0) colorClass = 'bg-red-500/50';
            else if (d < today) colorClass = 'bg-red-900/30';
        }
        htmlHeatmap += `<div class="w-8 h-8 rounded-md ${colorClass} transition-all hover:opacity-80" title="${dStr}"></div>`;
    }

    // Chart SVG
    let points = ''; const mapY = (val) => 90 - (val * 0.8); const stepX = 90 / 6;
    consistencyData.forEach((d, i) => { const x = 5 + (i * stepX); const y = mapY(d.val); points += `${x},${y} `; });
    const areaPath = `5,100 ${points} 95,100`;


    // --- LIST (Clean) ---
    const activeRoutines = allRecurringTasks.filter(t => t.daysOfWeek && t.daysOfWeek.length > 0);
    let habitsHTML = '';

    activeRoutines.forEach((task, idx) => {
        let itemTotal = 0; let itemCompleted = 0; let runningStreak = 0; let streakBroken = false;
        for (let i = 0; i < 30; i++) {
            const d = new Date(); d.setDate(today.getDate() - i); const dStr = localDateStr(d);
            const isScheduled = task.daysOfWeek.includes(d.getDay());
            if (isScheduled) {
                itemTotal++;
                const isDone = habitsHistory[task.text] && habitsHistory[task.text][dStr];
                if (isDone) { itemCompleted++; if (!streakBroken) runningStreak++; } else { if (d < today) streakBroken = true; }
            }
        }
        const itemRate = itemTotal > 0 ? Math.round((itemCompleted / itemTotal) * 100) : 0;
        const isTodayDone = habitsHistory[task.text] && habitsHistory[task.text][todayStr];
        const checkClass = isTodayDone ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-500 text-transparent';

        habitsHTML += `
        <div class="p-4 rounded-xl bg-[#18181b] border border-[#27272a] flex items-center gap-4 cursor-pointer hover:bg-[#27272a]/50 transition-colors" onclick="window.toggleHabitToday('${task.text.replace(/'/g, "\\'")}', ${!isTodayDone})">
            <div class="w-6 h-6 rounded-lg border-2 ${checkClass} flex items-center justify-center transition-colors">
                 <i data-lucide="check" class="w-4 h-4 stroke-[3]"></i>
            </div>
            
            <div class="flex-1">
                <h4 class="text-sm font-semibold text-gray-200 ${isTodayDone ? 'line-through text-gray-500' : ''}">${task.text}</h4>
                <div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span class="flex items-center gap-1"><i data-lucide="flame" class="w-3 h-3 text-orange-500"></i> ${runningStreak} dias</span>
                    <span class="w-1 h-1 bg-gray-600 rounded-full"></span>
                    <span>${itemRate}% mês</span>
                </div>
            </div>
        </div>
        `;
    });


    // --- RENDER HTML (Standard "Bonitinho") ---
    view.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-6 pb-28 px-4 md:px-0 font-sans">
        
        <!-- Header -->
        <div class="flex items-center justify-between pt-2">
            <div>
                <h2 class="text-2xl font-bold text-white">Analytics</h2>
                <p class="text-sm text-gray-400">Resumo da sua consistência</p>
            </div>
            <div class="bg-[#27272a] px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 uppercase tracking-wide">
                ${dayName}
            </div>
        </div>

        <!-- Main Progress Card -->
        <div class="bg-[#18181b] border border-[#27272a] p-6 rounded-2xl shadow-lg relative overflow-hidden">
            <div class="relative z-10 flex flex-col gap-4">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="text-gray-400 text-xs font-bold uppercase tracking-wider">Progresso Hoje</span>
                        <div class="text-4xl font-bold text-white mt-1">${todayPercent}%</div>
                    </div>
                    <div class="bg-[#27272a] w-12 h-12 rounded-full flex items-center justify-center">
                         <span class="text-sm font-bold text-white">${completedToday}<span class="text-gray-500">/${totalToday}</span></span>
                    </div>
                </div>
                
                <div class="w-full bg-[#27272a] h-3 rounded-full overflow-hidden">
                    <div class="bg-blue-500 h-full rounded-full transition-all duration-500" style="width: ${todayPercent}%"></div>
                </div>
            </div>
            <!-- BG Decor -->
            <div class="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
        </div>

        <!-- 3 Stats Cards -->
        <div class="grid grid-cols-3 gap-3">
             <div class="bg-[#18181b] border border-[#27272a] p-4 rounded-xl flex flex-col items-center justify-center gap-2">
                <i data-lucide="flame" class="text-orange-500 w-5 h-5"></i>
                <div class="text-lg font-bold text-white">${currentStreak}</div>
                <div class="text-[10px] text-gray-500 font-bold uppercase">Sequência</div>
             </div>
             <div class="bg-[#18181b] border border-[#27272a] p-4 rounded-xl flex flex-col items-center justify-center gap-2">
                <i data-lucide="bar-chart-2" class="text-blue-500 w-5 h-5"></i>
                <div class="text-lg font-bold text-white">${weeklyRate}%</div>
                <div class="text-[10px] text-gray-500 font-bold uppercase">Semana</div>
             </div>
             <div class="bg-[#18181b] border border-[#27272a] p-4 rounded-xl flex flex-col items-center justify-center gap-2">
                <i data-lucide="trophy" class="text-emerald-500 w-5 h-5"></i>
                <div class="text-lg font-bold text-white truncate max-w-full">${bestDayLabel.substring(0, 3)}</div>
                <div class="text-[10px] text-gray-500 font-bold uppercase">Melhor Dia</div>
             </div>
        </div>

        <!-- Charts Grid -->
        <div class="grid grid-cols-1 gap-4">
            <!-- Heatmap Row -->
             <div class="bg-[#18181b] border border-[#27272a] p-5 rounded-xl">
                 <div class="flex items-center gap-2 mb-4">
                    <i data-lucide="layout-grid" class="w-4 h-4 text-gray-400"></i>
                    <h3 class="text-sm font-bold text-gray-300">Histórico de 30 Dias</h3>
                 </div>
                 <div class="flex justify-center">
                    <div class="grid grid-cols-7 gap-3">
                        ${htmlHeatmap}
                    </div>
                </div>
             </div>
             
             <!-- Line Chart Row -->
             <div class="bg-[#18181b] border border-[#27272a] p-5 rounded-xl">
                <div class="flex items-center gap-2 mb-4">
                    <i data-lucide="trending-up" class="w-4 h-4 text-gray-400"></i>
                    <h3 class="text-sm font-bold text-gray-300">Consistência Semanal</h3>
                 </div>
                <div class="h-32 w-full">
                     <svg class="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <defs>
                            <linearGradient id="chartStandard" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.2"/>
                                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
                            </linearGradient>
                        </defs>
                        <line x1="0" y1="100" x2="100" y2="100" stroke="#333" stroke-width="1"/>
                        <polygon points="${areaPath}" fill="url(#chartStandard)" />
                        <polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
                         ${consistencyData.map((d, i) => {
        const x = 5 + (i * stepX); const y = mapY(d.val);
        return `<circle cx="${x}" cy="${y}" r="3" fill="#18181b" stroke="#3b82f6" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    }).join('')}
                    </svg>
                </div>
                <div class="flex justify-between mt-2 px-2">
                    ${consistencyData.map(d => `<span class="text-[10px] text-gray-500 font-bold">${d.day}</span>`).join('')}
                </div>
             </div>
        </div>

        <!-- Habits List Standard -->
        <div class="py-2">
            <h3 class="text-sm font-bold text-gray-400 mb-4 px-1">Detalhamento</h3>
            <div class="space-y-3">
                ${habitsHTML}
            </div>
            
            <button onclick="setView('week')" class="w-full py-3 mt-4 text-sm font-medium text-gray-400 hover:text-white bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] rounded-xl transition-colors flex items-center justify-center gap-2">
                 Gerenciar Hábitos <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
        </div>
    </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function renderSettingsView() {
    const view = document.getElementById('settingsView');

    // Carregar preferências
    const notifSettings = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
    const notifEnabled = notifSettings.enabled !== false;
    const morningTime = notifSettings.morningTime || '12:00';
    const eveningTime = notifSettings.eveningTime || '22:00';
    const notifPerm = ('Notification' in window) ? Notification.permission : 'unsupported';

    const viewSettings = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
    const weekStart = viewSettings.weekStart || 'mon';
    const showWeekends = viewSettings.showWeekends !== false;
    const hapticsEnabled = viewSettings.haptics !== false;

    // Perfil
    const displayName = localStorage.getItem('flowly_display_name') || (currentUser ? currentUser.email.split('@')[0] : 'Usuário');

    // Badge Notification
    const permBadge = notifPerm === 'granted'
        ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-medium" > Ativo</span> `
        : `<span class="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-medium" > Inativo</span> `;

    // Components
    const settingRow = (icon, title, desc, control) => `
    <div class="flex items-center justify-between gap-4 py-4 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 -mx-2 rounded-lg transition-colors" >
            <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-gray-800/50 flex items-center justify-center flex-shrink-0 text-gray-400">
                    <i data-lucide="${icon}" style="width:16px;height:16px;"></i>
                </div>
                <div class="min-w-0">
                    <div class="text-sm font-medium text-gray-200">${title}</div>
                    <div class="text-xs text-gray-500 mt-0.5 truncate">${desc}</div>
                </div>
            </div>
            <div class="flex-shrink-0">${control}</div>
        </div> `;

    const toggle = (id, checked) => `
    <button id = "${id}" role = "switch" aria - checked="${checked}"
class="relative w-10 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-blue-600' : 'bg-gray-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-[#050505]" >
    <span class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}"></span>
        </button> `;

    view.innerHTML = `
    <div class="max-w-2xl mx-auto py-8 px-4 pb-24" >
            <h2 class="text-2xl font-bold mb-6 text-white flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
                    <i data-lucide="settings-2" class="text-white" style="width:20px;height:20px;"></i>
                </div>
                ConfiguraÇÕES
            </h2>

            <!--PERFIL -->
            <section class="mb-8">
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">Perfil</h3>
                <div class="bg-[#1c1c1e] border border-white/10 rounded-2xl overflow-hidden p-4">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white shadow-inner">
                            ${displayName.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1">
                            <label class="text-xs text-gray-500 mb-1 block">Nome de exibição</label>
                            <input type="text" id="inputDisplayName" value="${displayName}" 
                                class="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                                placeholder="Seu nome">
                        </div>
                    </div>
                    ${currentUser ? `
                    <div class="flex items-center justify-between bg-black/20 rounded-lg p-3">
                        <div class="flex items-center gap-3">
                            <i data-lucide="mail" class="text-gray-500 w-4 h-4"></i>
                            <span class="text-sm text-gray-400">${currentUser.email}</span>
                        </div>
                        <button onclick="signOut()" class="text-xs text-red-400 hover:text-red-300 transition-colors font-medium">Sair</button>
                    </div>` : `
                    <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                        <p class="text-sm text-blue-300 mb-2">Faça login para sincronizar seus dados</p>
                        <button onclick="document.getElementById('authModal').classList.add('show')" class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors">Entrar / Criar Conta</button>
                    </div>`}
                </div>
            </section>

            <!--NOTIFICAÇÕES -->
            <section class="mb-8">
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">NotificaÇÕES</h3>
                <div class="bg-[#1c1c1e] border border-white/10 rounded-2xl overflow-hidden px-5 py-2">
                    <div class="flex items-center justify-between py-4 border-b border-white/5">
                        <div class="flex items-center gap-3">
                            <i data-lucide="bell" class="text-gray-400 w-5 h-5"></i>
                            <div>
                                <div class="text-sm font-medium text-white flex items-center gap-2">Permissão do Sistema ${permBadge}</div>
                                <div class="text-xs text-gray-500"> Necessário para receber lembretes</div>
                            </div>
                        </div>
                        ${toggle('toggleNotif', notifEnabled && notifPerm === 'granted')}
                    </div>
                    
                    ${settingRow('sun', 'Check-in Matinal', 'Horário para planejar o dia',
        `<input type="time" id="inputMorningTime" value="${morningTime}" class="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500">`)}
                    
                    ${settingRow('moon', 'Resumo Noturno', 'Horário para revisar o progresso',
            `<input type="time" id="inputEveningTime" value="${eveningTime}" class="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500">`)}
                </div>
                ${notifPerm === 'denied' ? `<p class="text-xs text-red-400 mt-2 px-2 flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3 h-3"></i> NotificaÇÕES bloqueadas pelo navegador.</p>` : ''}
            </section>

            <!--PREFERÊNCIAS -->
            <section class="mb-8">
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">Preferências</h3>
                <div class="bg-[#1c1c1e] border border-white/10 rounded-2xl overflow-hidden px-5 py-2">
                    ${settingRow('calendar', 'Início da Semana', 'Definir primeiro dia do calendário',
                `<select id="selectWeekStart" class="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500">
                            <option value="mon" ${weekStart === 'mon' ? 'selected' : ''}>Segunda-feira</option>
                            <option value="sun" ${weekStart === 'sun' ? 'selected' : ''}>Domingo</option>
                        </select>`)}
                    
                    ${settingRow('calendar-days', 'Fins de Semana', 'Mostrar Sábado e Domingo', toggle('toggleWeekends', showWeekends))}
                    
                    ${settingRow('smartphone', 'Vibração', 'Feedback tátil ao completar tarefas', toggle('toggleHaptics', hapticsEnabled))}
                </div>
            </section>

            <!--DADOS -->
            <section class="mb-8">
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">Gerenciamento de Dados</h3>
                <div class="grid grid-cols-2 gap-3">
                    <button id="btnExportSettings" class="bg-[#1c1c1e] hover:bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 transition-all hover:border-white/20 group">
                        <i data-lucide="download" class="text-blue-400 mb-1 group-hover:scale-110 transition-transform"></i>
                        <span class="text-sm font-medium text-gray-200">Exportar Backup</span>
                    </button>
                    
                    <label for="fileImportSettings" class="bg-[#1c1c1e] hover:bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 transition-all hover:border-white/20 cursor-pointer group">
                        <i data-lucide="upload" class="text-green-400 mb-1 group-hover:scale-110 transition-transform"></i>
                        <span class="text-sm font-medium text-gray-200">Importar Dados</span>
                        <input type="file" id="fileImportSettings" accept=".json" class="hidden">
                    </label>

                    <button id="btnFixDuplicates" class="bg-[#1c1c1e] hover:bg-orange-900/10 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 transition-all hover:border-orange-500/30 group">
                        <i data-lucide="wrench" class="text-orange-400 mb-1 group-hover:scale-110 transition-transform"></i>
                        <span class="text-sm font-medium text-gray-200">Corrigir Banco</span>
                    </button>

                    <button id="btnClearAllSettings" class="bg-[#1c1c1e] hover:bg-red-900/10 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 transition-all hover:border-red-500/30 group">
                        <i data-lucide="trash-2" class="text-red-400 mb-1 group-hover:scale-110 transition-transform"></i>
                        <span class="text-sm font-medium text-gray-200">Apagar Tudo</span>
                    </button>
                </div>
            </section>

            <div class="text-center mt-12 mb-8">
                <div class="text-xs text-gray-600 font-medium">FLOWLY v1.2</div>
                <div class="text-[10px] text-gray-700 mt-1">Sincronizado via Supabase</div>
            </div>
        </div> `;

    setTimeout(() => {
        lucide.createIcons();

        // --- handlers ---

        // Name Change
        const nameInput = document.getElementById('inputDisplayName');
        if (nameInput) {
            nameInput.onchange = function () {
                localStorage.setItem('flowly_display_name', this.value);
            };
        }

        // Toggle NotificaÇÕES
        const toggleNotif = document.getElementById('toggleNotif');
        if (toggleNotif) {
            toggleNotif.onclick = async function () {
                if (notifPerm === 'denied') return;
                if (notifPerm !== 'granted') {
                    const perm = await Notification.requestPermission();
                    if (perm !== 'granted') { renderSettingsView(); return; }
                    scheduleNotifications();
                }
                const cur = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
                cur.enabled = !(cur.enabled !== false);
                localStorage.setItem('flowly_notif_settings', JSON.stringify(cur));
                renderSettingsView();
            };
        }

        // Inputs Hora
        ['inputMorningTime', 'inputEveningTime'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.onchange = function () {
                    const cur = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
                    if (id === 'inputMorningTime') cur.morningTime = this.value;
                    else cur.eveningTime = this.value;
                    localStorage.setItem('flowly_notif_settings', JSON.stringify(cur));
                    if (Notification.permission === 'granted') scheduleNotifications();
                };
            }
        });

        // Week Start
        const weekSelect = document.getElementById('selectWeekStart');
        if (weekSelect) {
            weekSelect.onchange = function () {
                const cur = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
                cur.weekStart = this.value;
                localStorage.setItem('flowly_view_settings', JSON.stringify(cur));
            };
        }

        // Weekends Toggle
        const toggleW = document.getElementById('toggleWeekends');
        if (toggleW) {
            toggleW.onclick = function () {
                const cur = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
                cur.showWeekends = !(cur.showWeekends !== false);
                localStorage.setItem('flowly_view_settings', JSON.stringify(cur));
                renderSettingsView();
            }
        }

        // Haptics Toggle
        const toggleH = document.getElementById('toggleHaptics');
        if (toggleH) {
            toggleH.onclick = function () {
                const cur = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
                cur.haptics = !(cur.haptics !== false);
                localStorage.setItem('flowly_view_settings', JSON.stringify(cur));
                renderSettingsView();
            }
        }

        // Handlers de dados (Export/Import/Fix/Clear) - Reutilizar lógica existente mas rebindar
        // Export
        document.getElementById('btnExportSettings').onclick = () => {
            const backup = { allTasksData, weeklyRecurringTasks, dailyRoutine, habitsHistory, exportedAt: new Date().toISOString() };
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `flowly - backup - ${localDateStr()}.json`; a.click();
            URL.revokeObjectURL(url);
        };

        // Import
        document.getElementById('fileImportSettings').onchange = function (e) {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (data.allTasksData) { allTasksData = data.allTasksData; localStorage.setItem('allTasksData', JSON.stringify(allTasksData)); }
                    if (data.allRecurringTasks) { allRecurringTasks = data.allRecurringTasks; localStorage.setItem('allRecurringTasks', JSON.stringify(allRecurringTasks)); }
                    if (data.habitsHistory) { habitsHistory = data.habitsHistory; localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory)); }
                    renderView();
                    alert('Backup importado com sucesso!');
                } catch (error) { alert('Erro ao importar backup: ' + error.message); }
            };
            reader.readAsText(file);
        };

        // Fix
        document.getElementById('btnFixDuplicates').onclick = async () => {
            if (!currentUser) { alert('Faça login primeiro!'); return; }
            if (!confirm('Remove duplicatas e tarefas corrompidas do banco. Continuar?')) return;
            const btn = document.getElementById('btnFixDuplicates');
            const originalText = '<i data-lucide="wrench" class="text-orange-400 mb-1 group-hover:scale-110 transition-transform"></i><span class="text-sm font-medium text-gray-200">Corrigir Banco</span>';
            btn.innerHTML = '<span class="text-sm font-medium text-orange-400">Limpando...</span>';
            btn.disabled = true;
            try {
                const { data: allT } = await supabaseClient.from('tasks').select('*').eq('user_id', currentUser.id);
                if (!allT) { alert('Erro ao buscar dados.'); return; }
                const recurringTexts = new Set(allRecurringTasks.map(rt => rt.text));
                const seen = new Map(); const del = [];
                allT.forEach(t => {
                    const d = t.day || '';
                    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !t.period || !t.text || recurringTexts.has(t.text)) { del.push(t.id); return; }
                    const k = `${d}| ${t.period}| ${t.text} `;
                    seen.has(k) ? del.push(t.id) : seen.set(k, t.id);
                });
                for (let i = 0; i < del.length; i += 100) await supabaseClient.from('tasks').delete().in('id', del.slice(i, i + 100));
                allTasksData = {}; localStorage.removeItem('allTasksData');
                await loadDataFromSupabase(); renderView();
                alert(`${del.length} registros removidos.`);
            } catch (e) { alert('Erro: ' + e.message); }
            finally { btn.innerHTML = originalText; btn.disabled = false; lucide.createIcons(); }
        };

        // Clear
        document.getElementById('btnClearAllSettings').onclick = async () => {
            if (!confirm('Apagar TODOS os dados? Isso não pode ser desfeito!')) return;
            const authKeys = Object.keys(localStorage).filter(k => k.startsWith('sb-') || k === 'flowly_persist_session');
            const authData = {}; authKeys.forEach(k => authData[k] = localStorage.getItem(k));
            if (currentUser) {
                await supabaseClient.from('tasks').delete().eq('user_id', currentUser.id);
                await supabaseClient.from('habits_history').delete().eq('user_id', currentUser.id);
            }
            Object.keys(weekData).forEach(d => weekData[d] = {}); // Reset weekData if exists
            allTasksData = {}; habitsHistory = {};
            localStorage.clear();
            Object.entries(authData).forEach(([k, v]) => localStorage.setItem(k, v));
            saveToLocalStorage();
            location.reload();
        };

    }, 50);
}

function deleteWeeklyRecurringTask(index) {
    if (!confirm('Remover esta tarefa semanal recorrente?')) return;
    weeklyRecurringTasks.splice(index, 1);
    localStorage.setItem('weeklyRecurringTasks', JSON.stringify(weeklyRecurringTasks));
    renderSettingsView();
}

async function deleteEmptyTasks() {
    if (!confirm('Tem certeza que deseja excluir todas as tarefas vazias (sem texto)?\n\nEsta ação não pode ser desfeita!')) return;

    let deletedCount = 0;

    // Percorrer todas as datas
    Object.entries(allTasksData).forEach(([dateStr, periods]) => {
        Object.entries(periods).forEach(([period, tasks]) => {
            if (Array.isArray(tasks)) {
                // Filtrar tarefas vazias
                const beforeLength = tasks.length;
                const filteredTasks = tasks.filter(task => task.text && task.text.trim() !== '');
                const afterLength = filteredTasks.length;

                deletedCount += (beforeLength - afterLength);

                // Atualizar array
                allTasksData[dateStr][period] = filteredTasks;

                // Remover período se ficou vazio
                if (filteredTasks.length === 0) {
                    delete allTasksData[dateStr][period];
                }
            }
        });

        // Remover data se não tem mais períodos
        if (Object.keys(allTasksData[dateStr]).length === 0) {
            delete allTasksData[dateStr];
        }
    });

    // Deletar tarefas vazias do Supabase
    if (currentUser) {
        try {
            await supabaseClient
                .from('tasks')
                .delete()
                .eq('user_id', currentUser.id)
                .or('text.is.null,text.eq.');
        } catch (error) {
            console.error('Erro ao deletar tarefas vazias do Supabase:', error);
        }
    }

    saveToLocalStorage();
    renderView();

    alert(`${deletedCount} tarefa(s) vazia(s) foram excluídas!`);
}

function setView(view) {
    currentView = view;
    document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
    if (view === 'month') document.getElementById('btnMonth').classList.add('active');
    if (view === 'week') document.getElementById('btnWeek').classList.add('active');
    if (view === 'today') document.getElementById('btnToday').classList.add('active');
    if (view === 'routine') document.getElementById('btnRoutine').classList.add('active');
    if (view === 'analytics') document.getElementById('btnAnalytics').classList.add('active');
    if (view === 'settings') document.getElementById('btnSettings').classList.add('active');
    renderView();
}

// Função para mostrar modal de criação de tarefa semanal recorrente
function showWeeklyRecurrenceDialog() {
    const modal = document.getElementById('weeklyModal');
    document.getElementById('weeklyTaskText').value = '';
    // Limpar seleção de dias
    document.querySelectorAll('.weekly-day-btn').forEach(b => b.classList.remove('selected'));
    modal.classList.add('show');
    setTimeout(() => {
        document.getElementById('weeklyTaskText').focus();
        lucide.createIcons();
    }, 100);
}

// Retorna as tarefas recorrentes semanais de um dia (apenas para exibição, sem persistir)
function getWeeklyRecurringForDay(dateStr, dayOfWeek) {
    // Usa allRecurringTasks como fonte única
    const existingTexts = new Set();
    Object.values(allTasksData[dateStr] || {}).forEach(tasks => {
        if (Array.isArray(tasks)) tasks.forEach(t => { if (t.text) existingTexts.add(t.text); });
    });
    return allRecurringTasks
        .filter(rt => rt.daysOfWeek && rt.daysOfWeek.includes(dayOfWeek) && !existingTexts.has(rt.text))
        .map(rt => ({
            text: rt.text,
            completed: false,
            color: rt.color,
            isHabit: rt.isHabit,
            isRecurring: true
        }));
}

function renderView() {
    // Ocultar todas as views
    document.getElementById('monthView').classList.add('hidden');
    document.getElementById('weekGrid').classList.add('hidden');

    // Limpar classes extras do weekGrid (como today-container) para não vazar layout
    document.getElementById('weekGrid').classList.remove('today-container');

    document.getElementById('routineView').classList.add('hidden');
    document.getElementById('analyticsView').classList.add('hidden');
    document.getElementById('settingsView').classList.add('hidden');
    document.getElementById('weekNav').classList.add('hidden');

    // Mostrar navegação de semana apenas na view semanal
    if (currentView === 'week') {
        document.getElementById('weekNav').classList.remove('hidden');
    }

    if (currentView === 'month') {
        document.getElementById('monthView').classList.remove('hidden');
        renderMonth();
    } else if (currentView === 'routine') {
        document.getElementById('routineView').classList.remove('hidden');
        renderRoutineView();
    } else if (currentView === 'analytics') {
        document.getElementById('analyticsView').classList.remove('hidden');
        renderAnalyticsView();
    } else if (currentView === 'settings') {
        document.getElementById('settingsView').classList.remove('hidden');
        renderSettingsView();
    } else {
        document.getElementById('weekGrid').classList.remove('hidden');
        if (currentView === 'week') renderWeek();
        else renderToday();
    }

    // Renderizar ícones após atualizar a view
    setTimeout(() => lucide.createIcons(), 0);
}

function renderWeek() {
    const grid = document.getElementById('weekGrid');
    grid.className = '';
    grid.style.cssText = '';
    grid.innerHTML = '';

    // Atualizar label da semana
    document.getElementById('weekLabel').textContent = getWeekLabel(currentWeekOffset);

    const weekDates = getWeekDates(currentWeekOffset);

    // HIDRATAR A SEMANA: Garantir que as rotinas existam no banco para todos os dias visíveis
    weekDates.forEach(({ dateStr }) => hydrateRoutineForDate(dateStr));

    weekDates.forEach(({ name: day, dateStr }) => {
        // Ler tarefas persistidas (sem rotina/recorrentes)
        const dayTasks = allTasksData[dateStr] || {};

        const col = document.createElement('div');
        col.className = 'day-column';
        col.dataset.day = day;
        col.dataset.date = dateStr;

        // Drag Events
        col.addEventListener('dragover', handleDragOver);
        col.addEventListener('drop', handleDrop);

        const todayStr = localDateStr();
        const isToday = dateStr === todayStr;
        const isPast = dateStr < todayStr;

        if (isToday) col.classList.add('today-active');
        if (isPast) col.classList.add('past-day');
        if (dateStr > todayStr) col.classList.add('future-day');

        const header = document.createElement('h2');
        const dayNum = dateStr.split('-')[2].replace(/^0/, '');

        header.className = `flex items-center justify-between mb-3 ${isToday ? 'text-blue-500 font-bold' : 'text-gray-400'} `;
        header.innerHTML = `
    <span> ${day}</span>
        <span class="${isToday ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-gray-500'} text-xs px-2 py-0.5 rounded-full font-mono">${dayNum}</span>
`;
        col.appendChild(header);

        // Flatten all tasks
        const allTasks = [];

        // 1. Adicionar tarefas de rotina e recorrentes semanais (geradas dinamicamente, index = -1)
        const routineTasks = getRoutineTasksForDate(dateStr);
        routineTasks.forEach((task) => {
            allTasks.push({
                task,
                day,
                dateStr,
                period: 'Rotina',
                originalIndex: -1
            });
        });

        // 2. Adicionar tarefas normais persistidas (excluindo período 'Rotina' se foi salvo indevidamente)
        Object.entries(dayTasks).forEach(([period, tasks]) => {
            if (period === 'Rotina') return; // Pular - rotinas são geradas dinamicamente acima
            if (Array.isArray(tasks)) {
                tasks.forEach((task, index) => {
                    if (task && typeof task === 'object') {
                        allTasks.push({
                            task,
                            day,
                            dateStr,
                            period,
                            originalIndex: index
                        });
                    }
                });
            }
        });

        // ===== ORDENAR TAREFAS POR PRIORIDADE =====
        allTasks.sort((a, b) => {
            const taskA = a.task;
            const taskB = b.task;

            // 1. Completadas vão para o FINAL
            if (taskA.completed !== taskB.completed) {
                return taskA.completed ? 1 : -1;
            }

            // 2. Rotinas primeiro
            const isRoutineA = taskA.isRoutine;
            const isRoutineB = taskB.isRoutine;

            if (isRoutineA !== isRoutineB) return isRoutineA ? -1 : 1;

            // 3. Cores
            const colors = { 'red': 1, 'orange': 2, 'yellow': 3, 'green': 4, 'blue': 5, 'purple': 6, 'default': 99 };
            const colorA = colors[taskA.color] || 99;
            const colorB = colors[taskB.color] || 99;

            return colorA - colorB;
        });

        // Renderizar
        allTasks.forEach(({ task, day, dateStr, period, originalIndex }) => {
            col.appendChild(createTaskElement(day, dateStr, period, task, originalIndex));
        });

        // ===== DROP ZONE NO FINAL =====
        const finalDropZone = document.createElement('div');
        finalDropZone.className = 'drop-zone';
        finalDropZone.dataset.date = dateStr;
        finalDropZone.dataset.period = 'Tarefas'; // Default drop target
        finalDropZone.dataset.insertAt = '999999';
        finalDropZone.innerText = '+';
        finalDropZone.onclick = () => addQuickTaskInput(col, day); // Atalho rápido

        finalDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            finalDropZone.classList.add('active');
        });
        finalDropZone.addEventListener('dragleave', () => {
            finalDropZone.classList.remove('active');
        });
        // Drop handler já está no evento global ou específico (mas createDropZone cuida disso?)
        // createDropZone é para ENTRE tarefas. Esta é a final.
        // Precisa de drop handler próprio se não for coberto pelo col
        finalDropZone.addEventListener('drop', (e) => {

            const targetDateStr = dateStr;
            const targetPeriod = 'Tarefas';

            const sourceDateStr = dragState.sourceDate;
            const sourcePeriod = dragState.sourcePeriod;
            const sourceIndex = dragState.sourceIndex;

            // Remover da posição antiga
            const sourceArray = allTasksData[sourceDateStr]?.[sourcePeriod];
            if (sourceArray) {
                sourceArray.splice(sourceIndex, 1);

                // Limpar período vazio
                if (sourceArray.length === 0) {
                    delete allTasksData[sourceDateStr][sourcePeriod];
                }
            }

            // Garantir estruturas
            if (!allTasksData[targetDateStr]) allTasksData[targetDateStr] = {};
            if (!allTasksData[targetDateStr][targetPeriod]) allTasksData[targetDateStr][targetPeriod] = [];

            // Inserir no FINAL
            allTasksData[targetDateStr][targetPeriod].push(dragState.taskData);

            // SALVAR!
            saveToLocalStorage();

            // Sincronizar com Supabase
            syncDateToSupabase(sourceDateStr);
            if (targetDateStr !== sourceDateStr) {
                syncDateToSupabase(targetDateStr);
            }

            // Limpar estado
            dragState = {
                sourceDate: null,
                sourcePeriod: null,
                sourceIndex: null,
                taskData: null
            };

            // Re-renderizar
            renderView();
        });

        col.appendChild(finalDropZone);

        // Adicionar área clicável para nova tarefa (estilo Notion)
        col.addEventListener('click', (e) => {
            // Só adicionar se clicar na área vazia (não em tasks ou inputs existentes)
            if (e.target === col || e.target.tagName === 'H2' || e.target.tagName === 'H3') {
                addQuickTaskInput(col, day);
            }
        });

        grid.appendChild(col);
    });
}

function renderToday() {
    const grid = document.getElementById('weekGrid');
    grid.className = 'today-container';
    grid.style.cssText = '';
    grid.innerHTML = '';

    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const today = days[new Date().getDay()];
    const dateStr = localDateStr();

    // ===== LEFT: Main area =====
    const main = document.createElement('div');
    main.className = 'today-main';

    // Header
    const header = document.createElement('div');
    header.className = 'today-header';
    header.innerHTML = `<h1> ${today}</h1> <p>${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>`;
    main.appendChild(header);

    // Task list container
    const taskList = document.createElement('div');
    taskList.className = 'today-task-list';

    // Buscar tarefas de hoje
    const dayTasks = allTasksData[dateStr] || {};
    const allTasks = [];

    // 1. Rotina diária + recorrentes semanais
    const routineTasks = getRoutineTasksForDate(dateStr);
    routineTasks.forEach((task) => {
        allTasks.push({ task, day: today, dateStr, period: 'Rotina', originalIndex: -1 });
    });

    // 2. Tarefas normais persistidas
    Object.entries(dayTasks).forEach(([period, tasks]) => {
        if (period === 'Rotina') return;
        if (Array.isArray(tasks)) {
            tasks.forEach((task, index) => {
                if (task && typeof task === 'object') {
                    allTasks.push({ task, day: today, dateStr, period, originalIndex: index });
                }
            });
        }
    });

    // Render all tasks
    allTasks.forEach(({ task, day, dateStr, period, originalIndex }) => {
        taskList.appendChild(createTaskElement(day, dateStr, period, task, originalIndex));
    });

    main.appendChild(taskList);

    // Empty state
    if (allTasks.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'today-empty';
        empty.innerHTML = `<p> Nenhuma tarefa para hoje</p> <p>Clique para adicionar uma tarefa</p>`;
        main.appendChild(empty);
    }

    // Clickable area for quick add
    main.style.cursor = 'text';
    main.style.minHeight = '50vh';
    main.addEventListener('click', (e) => {
        if (e.target === main || e.target.closest('.today-header') || e.target.closest('.today-empty')) {
            addQuickTaskInputToday(taskList, today);
        }
    });

    grid.appendChild(main);

    // ===== RIGHT: Sidebar stats =====
    const sidebar = document.createElement('div');
    sidebar.className = 'today-sidebar';

    // Calcular stats
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.task.completed).length;
    const pendingTasks = totalTasks - completedTasks;
    const todayRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Rotina stats
    const routineTotal = routineTasks.length;
    const routineCompleted = routineTasks.filter(t => t.completed).length;
    const routineRate = routineTotal > 0 ? Math.round((routineCompleted / routineTotal) * 100) : 0;

    // Streak
    let streak = 0;
    const checkD = new Date();
    for (let i = 0; i < 60; i++) {
        const cds = localDateStr(checkD);
        const { total: sTotal, completed: sCompleted } = countDayTasks(cds);
        if (sTotal > 0 && sCompleted === sTotal) {
            streak++;
        } else if (i > 0 || (i === 0 && sTotal > 0)) {
            break;
        }
        checkD.setDate(checkD.getDate() - 1);
    }

    // Semana
    const weekDates = getWeekDates(0);
    let weekTotal = 0, weekCompleted = 0;
    weekDates.forEach(({ dateStr: wds }) => {
        const { total: wt, completed: wc } = countDayTasks(wds);
        weekTotal += wt;
        weekCompleted += wc;
    });
    const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

    // Ring color
    const ringColor = todayRate >= 70 ? 'var(--accent-green)' : todayRate >= 40 ? 'var(--accent-orange)' : todayRate > 0 ? 'var(--accent-red)' : 'rgba(255,255,255,0.1)';
    const ringPct = todayRate;
    const circumference = 2 * Math.PI * 19;
    const dashOffset = circumference - (circumference * ringPct / 100);

    // Build sidebar HTML
    sidebar.innerHTML = `
    <!--Progresso do dia-->
                <div class="stat-section">
                    <div class="stat-section-title">Progresso</div>
                    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
                        <div class="stat-ring">
                            <svg width="48" height="48" viewBox="0 0 48 48">
                                <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
                                <circle cx="24" cy="24" r="19" fill="none" stroke="${ringColor}" stroke-width="3"
                                    stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
                                    stroke-linecap="round"/>
                            </svg>
                            <div class="stat-ring-text">${todayRate}%</div>
                        </div>
                        <div>
                            <div style="font-size: 13px; color: var(--text-secondary);">${completedTasks} de ${totalTasks}</div>
                            <div style="font-size: 11px; color: var(--text-tertiary);">tarefas concluídas</div>
                        </div>
                    </div>
                    <div class="progress-bar-mini">
                        <div class="progress-bar-mini-fill" style="width: ${todayRate}%; background: ${ringColor};"></div>
                    </div>
                </div>

                <!--Resumo -->
                <div class="stat-section">
                    <div class="stat-section-title">Resumo</div>
                    <div class="stat-card">
                        <span class="stat-label">Pendentes</span>
                        <span class="stat-value ${pendingTasks > 0 ? 'orange' : 'green'}">${pendingTasks}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Rotina</span>
                        <span class="stat-value ${routineRate >= 80 ? 'green' : routineRate >= 50 ? 'blue' : ''}">${routineCompleted}/${routineTotal}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Streak</span>
                        <span class="stat-value ${streak >= 3 ? 'green' : ''}">${streak > 0 ? streak + ' dia' + (streak > 1 ? 's' : '') : '—'}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Semana</span>
                        <span class="stat-value ${weekRate >= 70 ? 'green' : weekRate >= 40 ? 'blue' : ''}">${weekRate}%</span>
                    </div>
                </div>

                <!--Mini semana-->
    <div class="stat-section">
        <div class="stat-section-title">Esta semana</div>
        <div style="display: flex; gap: 6px; align-items: flex-end;">
            ${weekDates.map(({ name, dateStr: wds }) => {
        const { total: wt, completed: wc } = countDayTasks(wds);
        const pct = wt > 0 ? Math.round((wc / wt) * 100) : 0;
        const isToday = wds === dateStr;
        const barColor = pct >= 80 ? 'var(--accent-green)' : pct >= 50 ? 'var(--accent-blue)' : pct > 0 ? 'var(--accent-orange)' : 'rgba(255,255,255,0.06)';
        const barH = wt > 0 ? Math.max(6, pct * 0.4) : 4;
        return `<div style="flex: 1; text-align: center;">
                                <div style="height: 40px; display: flex; align-items: flex-end; justify-content: center;">
                                    <div style="width: 100%; max-width: 20px; height: ${barH}px; background: ${barColor}; border-radius: 2px; ${isToday ? 'box-shadow: 0 0 6px ' + barColor + ';' : ''}"></div>
                                </div>
                                <div style="font-size: 10px; color: ${isToday ? 'var(--accent-blue)' : 'var(--text-tertiary)'}; margin-top: 4px; font-weight: ${isToday ? '600' : '400'};">${name.slice(0, 3)}</div>
                            </div>`;
    }).join('')}
        </div>
    </div>
`;

    grid.appendChild(sidebar);
}

function addQuickTaskInputToday(container, day) {
    // Verificar se já existe um input ativo
    const existingInput = container.querySelector('.quick-task-input');
    if (existingInput) {
        existingInput.focus();
        return;
    }

    const inputContainer = document.createElement('div');
    inputContainer.className = 'quick-task-container';
    inputContainer.style.padding = '5px 6px';

    // Checkbox placeholder
    const checkboxPlaceholder = document.createElement('div');
    checkboxPlaceholder.style.width = '16px';
    checkboxPlaceholder.style.height = '16px';
    checkboxPlaceholder.style.borderRadius = '4px';
    checkboxPlaceholder.style.border = '1.5px solid rgba(255,255,255,0.15)';
    checkboxPlaceholder.style.flexShrink = '0';
    checkboxPlaceholder.style.marginTop = '2px';
    inputContainer.appendChild(checkboxPlaceholder);

    // Input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'quick-task-input';
    input.placeholder = 'Escreva aqui...';
    input.autocomplete = 'off';
    input.setAttribute('data-form-type', 'other');
    inputContainer.appendChild(input);

    container.appendChild(inputContainer);
    input.focus();

    // Salvar ao pressionar Enter
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            e.preventDefault();

            const dateStr = localDateStr();
            const period = 'Tarefas';

            if (!allTasksData[dateStr]) allTasksData[dateStr] = {};
            if (!allTasksData[dateStr][period]) allTasksData[dateStr][period] = [];

            const newTask = {
                text: input.value.trim(),
                completed: false,
                color: 'default',
                isHabit: false
            };

            allTasksData[dateStr][period].push(newTask);

            await syncTaskToSupabase(dateStr, period, newTask);
            saveToLocalStorage();

            renderView();
        }

        // Deletar linha vazia ao pressionar Backspace/Delete
        if ((e.key === 'Backspace' || e.key === 'Delete') && input.value.trim() === '') {
            e.preventDefault();
            inputContainer.remove();
        }

        if (e.key === 'Escape') {
            inputContainer.remove();
        }
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (!input.value.trim()) {
                inputContainer.remove();
            }
        }, 100);
    });
}

function addQuickTaskInput(column, day) {
    // Verificar se já existe um input ativo
    const existingInput = column.querySelector('.quick-task-input');
    if (existingInput) {
        existingInput.focus();
        return;
    }

    const container = document.createElement('div');
    container.className = 'quick-task-container';
    container.style.padding = '5px 6px';

    // Checkbox placeholder
    const checkboxPlaceholder = document.createElement('div');
    checkboxPlaceholder.style.width = '16px';
    checkboxPlaceholder.style.height = '16px';
    checkboxPlaceholder.style.borderRadius = '4px';
    checkboxPlaceholder.style.border = '1.5px solid rgba(255,255,255,0.15)';
    checkboxPlaceholder.style.flexShrink = '0';
    checkboxPlaceholder.style.marginTop = '2px';
    container.appendChild(checkboxPlaceholder);

    // Input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'quick-task-input';
    input.placeholder = 'Escreva aqui...';
    input.autocomplete = 'off';
    input.setAttribute('data-form-type', 'other');
    container.appendChild(input);

    // Adicionar ao final da coluna
    column.appendChild(container);
    input.focus();

    // Salvar ao pressionar Enter
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            e.preventDefault();

            // Encontrar a data correspondente ao dia da coluna
            const weekDates = getWeekDates(currentWeekOffset);
            const dayInfo = weekDates.find(d => d.name === day);
            if (!dayInfo) return;

            const dateStr = dayInfo.dateStr;
            const period = 'Tarefas';

            if (!allTasksData[dateStr]) allTasksData[dateStr] = {};
            if (!allTasksData[dateStr][period]) allTasksData[dateStr][period] = [];

            const newTask = {
                text: input.value.trim(),
                completed: false,
                color: 'default',
                isHabit: false
            };

            allTasksData[dateStr][period].push(newTask);

            // Salvar e sincronizar
            await syncTaskToSupabase(dateStr, period, newTask);
            saveToLocalStorage();

            // Re-renderizar a view
            renderView();
        }

        // Deletar linha vazia ao pressionar Backspace/Delete
        if ((e.key === 'Backspace' || e.key === 'Delete') && input.value.trim() === '') {
            e.preventDefault();
            container.remove();
        }

        // Cancelar ao pressionar Escape
        if (e.key === 'Escape') {
            container.remove();
        }
    });

    // Remover se perder o foco e estiver vazio
    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (!input.value.trim()) {
                container.remove();
            }
        }, 100);
    });
}

function createTaskElement(day, dateStr, period, task, index) {
    const container = document.createElement('div');

    // Top Drop Zone (não mostrar para recorrentes)
    if (index !== -1) container.appendChild(createDropZone(day, dateStr, period, index));

    const isRecurring = index === -1; // tarefas recorrentes não persistidas

    const el = document.createElement('div');
    el.className = `task-item ${task.isHabit ? 'is-habit' : ''} `;
    el.draggable = !isRecurring;
    el.dataset.day = day;
    el.dataset.date = dateStr;
    el.dataset.period = period;
    el.dataset.index = index;

    // Aplicar indent se existir
    if (task.indent && task.indent > 0) {
        el.style.paddingLeft = `${task.indent * 24} px`;
    }

    // Label (criado primeiro para ser referenciado pelos callbacks)
    const label = document.createElement('span');
    label.className = `task-label color-${task.color || 'default'} ${task.completed ? 'task-completed' : ''}`;
    // Aplicar cor azul se for tarefa de rotina ou recorrente
    if (task.isRoutine || task.isRecurring || period === 'Rotina') {
        label.style.color = 'var(--accent-blue)';
    }

    // Cor da DIFICULDADE (Prioridade) - sobrepõe rotina se existir
    if (task.priority && task.priority !== 'none') {
        const pColors = {
            'urgent': '#FF453A',   // Vermelho
            'important': '#FF9F0A', // Laranja
            'simple': '#FFD60A',   // Amarelo
            'money': '#30D158'     // Verde
        };
        if (pColors[task.priority]) {
            label.style.color = pColors[task.priority];
        }
    }

    // Normalizar texto da tarefa (garantir que não seja undefined)
    if (task.text === undefined || task.text === null) {
        task.text = '';
    }

    // Se a tarefa está vazia, mostrar placeholder
    if (task.text.trim() === '') {
        label.textContent = '';
        label.style.color = '#666';
        label.setAttribute('data-placeholder', 'Clique para editar...');
        label.style.position = 'relative';
    } else {
        label.textContent = task.text;
    }

    // Single Click Edit - New Modal
    label.onclick = (e) => {
        e.preventDefault();
        if (window.openTaskEditModal) window.openTaskEditModal(task, el);
    };

    // Context Menu
    label.oncontextmenu = (e) => {
        e.preventDefault();
        showEditToolbar(e, task, label);
    }

    // Drag Handle (oculto para tarefas recorrentes)
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.innerHTML = '⋮⋮';
    handle.style.cursor = isRecurring ? 'default' : 'pointer';
    if (isRecurring) handle.style.display = 'none';
    handle.addEventListener('click', (e) => {
        if (isRecurring) return;
        e.stopPropagation();
        e.preventDefault();
        showEditToolbar(e, task, label);
    });
    el.appendChild(handle);

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'checkbox-custom';
    checkbox.checked = task.completed;
    checkbox.onchange = (e) => {
        task.completed = e.target.checked;
        if (task.completed && navigator.vibrate) {
            const vs = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
            if (vs.haptics !== false) navigator.vibrate(15);
        }
        label.classList.toggle('task-completed', task.completed);

        // Se for rotina, usar a lógica unificada routineCompletions
        if (task.isRoutine || period === 'Rotina') {
            const completions = JSON.parse(localStorage.getItem('routineCompletions') || '{}');
            if (!completions[task.text]) completions[task.text] = {};

            if (task.completed) completions[task.text][dateStr] = true;
            else delete completions[task.text][dateStr];

            localStorage.setItem('routineCompletions', JSON.stringify(completions));
        }

        // Sempre salvar estado geral
        saveToLocalStorage();

        // Sincronizar com Supabase
        if (typeof syncDateToSupabase === 'function') {
            syncDateToSupabase(dateStr);
        }
    }
    el.appendChild(checkbox);

    el.appendChild(label);

    // Drag Events
    el.ondragstart = handleDragStart;
    el.ondragend = handleDragEnd;

    container.appendChild(el);
    return container;
}

function createDropZone(day, dateStr, period, index) {
    const dz = document.createElement('div');
    dz.className = 'task-drop-zone';
    dz.dataset.day = day;
    dz.dataset.date = dateStr;
    dz.dataset.period = period;
    dz.dataset.insertAt = index;

    dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('show'); };
    dz.ondragleave = () => dz.classList.remove('show');
    dz.ondrop = (e) => handleDropZoneDrop(e, dz);
    return dz;
}

// --- Editing Logic ---

function startEditing(label, task, taskDiv) {
    if (currentEditingTask) finishEditing();
    currentEditingTask = { label, task, original: task.text };

    label.contentEditable = true;
    label.focus();
    taskDiv.draggable = false;

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(label);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    label.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finishEditing();
        }
        if (e.key === 'Escape') {
            label.textContent = currentEditingTask.original;
            finishEditing();
        }
        // Delete ou Backspace em tarefa vazia = deletar a tarefa
        if ((e.key === 'Backspace' || e.key === 'Delete') && label.textContent.trim() === '') {
            e.preventDefault();
            label.textContent = ''; // Garantir que está vazio
            finishEditing(); // Vai deletar a tarefa automaticamente
        }
        // TAB para indent (estilo Notion)
        if (e.key === 'Tab') {
            e.preventDefault();
            const taskItem = label.closest('.task-item');
            const currentIndent = parseInt(task.indent || 0);

            if (e.shiftKey) {
                // Shift+Tab = desindentar
                if (currentIndent > 0) {
                    task.indent = currentIndent - 1;
                    taskItem.style.paddingLeft = `${task.indent * 24} px`;
                }
            } else {
                // Tab = indentar
                if (currentIndent < 3) { // Máximo 3 níveis
                    task.indent = currentIndent + 1;
                    taskItem.style.paddingLeft = `${task.indent * 24} px`;
                }
            }

            saveToLocalStorage();
        }
    };
    label.onblur = finishEditing;
}

async function finishEditing() {
    if (!currentEditingTask) return;
    const { label, task } = currentEditingTask;
    const newText = label.textContent.trim();

    // Se a tarefa ficou vazia, deletar
    if (!newText || newText === '') {
        const taskElement = label.closest('.task-item');
        const dateStr = taskElement.dataset.date;
        const period = taskElement.dataset.period;
        const index = parseInt(taskElement.dataset.index);

        if (allTasksData[dateStr] && allTasksData[dateStr][period]) {
            const taskToDelete = allTasksData[dateStr][period][index];

            // Deletar do Supabase
            await deleteTaskFromSupabase(taskToDelete);

            // Deletar localmente
            allTasksData[dateStr][period].splice(index, 1);

            // Limpar período vazio
            if (allTasksData[dateStr][period].length === 0) {
                delete allTasksData[dateStr][period];
            }

            // Limpar data vazia
            if (Object.keys(allTasksData[dateStr]).length === 0) {
                delete allTasksData[dateStr];
            }
        }

        localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
        currentEditingTask = null;
        renderView();
        return;
    }

    // Tarefa tem texto, salvar normalmente
    task.text = newText;
    label.contentEditable = false;
    label.closest('.task-item').draggable = true;

    // Remover placeholder se tinha
    if (label.hasAttribute('data-placeholder')) {
        label.removeAttribute('data-placeholder');
        label.style.color = '';
    }

    saveToLocalStorage();
    currentEditingTask = null;
}

function showTaskInput(btn, day, period) {
    const input = document.createElement('input');
    input.className = 'task-input';
    input.placeholder = 'Nova tarefa...';
    btn.replaceWith(input);
    input.focus();

    const save = () => {
        if (input.value.trim()) {
            if (!weekData[day][period]) weekData[day][period] = [];
            weekData[day][period].push({ text: input.value.trim(), completed: false, color: 'default', isHabit: false });
            saveToLocalStorage();
        }
        renderView();
    };

    input.onkeydown = (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') renderView(); };
    input.onblur = () => setTimeout(save, 100);
}

// --- Drag & Drop Handlers ---

function handleDragStart(e) {
    const period = this.dataset.period;
    const dateStr = this.dataset.date;
    const index = parseInt(this.dataset.index);

    // Tarefas recorrentes (index = -1) não são arrastáveis
    if (index === -1) { e.preventDefault(); return; }

    // Usar allTasksData para buscar a tarefa
    const dayData = allTasksData[dateStr] || {};
    const task = (dayData[period] || [])[index];
    if (!task) { e.preventDefault(); return; }

    draggedTask = {
        day: this.dataset.day,
        dateStr: dateStr,
        period: period,
        index: index,
        task: task
    };

    document.body.classList.add('dragging-active');
    setTimeout(() => this.classList.add('opacity-50'), 0);
}

function handleDragEnd(e) {
    document.body.classList.remove('dragging-active');
    this.classList.remove('opacity-50');
    document.querySelectorAll('.day-column').forEach(c => c.classList.remove('drag-over'));
}

function handleDragOver(e) { e.preventDefault(); }

function handleDropZoneDrop(e, dz) {
    e.stopPropagation();
    dz.classList.remove('show');
    if (!draggedTask) return;

    const targetDateStr = dz.dataset.date;
    const targetPeriod = dz.dataset.period;
    let insertAt = parseInt(dz.dataset.insertAt);

    const sourceDateStr = draggedTask.dateStr;
    const sourcePeriod = draggedTask.period;
    const sourceIndex = draggedTask.index;

    // Garantir que as estruturas existem
    if (!allTasksData[sourceDateStr]) allTasksData[sourceDateStr] = {};
    if (!allTasksData[targetDateStr]) allTasksData[targetDateStr] = {};
    if (!allTasksData[sourceDateStr][sourcePeriod]) allTasksData[sourceDateStr][sourcePeriod] = [];
    if (!allTasksData[targetDateStr][targetPeriod]) allTasksData[targetDateStr][targetPeriod] = [];

    // Remover da posição antiga
    allTasksData[sourceDateStr][sourcePeriod].splice(sourceIndex, 1);

    // Ajustar index se for a mesma lista
    if (sourceDateStr === targetDateStr && sourcePeriod === targetPeriod && sourceIndex < insertAt) {
        insertAt--;
    }

    // Ajustar a flag isRoutine baseado no período de destino
    const taskToMove = { ...draggedTask.task };
    if (targetPeriod === 'Rotina') {
        taskToMove.isRoutine = true;
    } else {
        taskToMove.isRoutine = false;
    }

    // Inserir na nova posição
    allTasksData[targetDateStr][targetPeriod].splice(insertAt, 0, taskToMove);

    // Limpar períodos vazios
    if (allTasksData[sourceDateStr][sourcePeriod].length === 0) {
        delete allTasksData[sourceDateStr][sourcePeriod];
    }

    // Salvar localmente
    localStorage.setItem('allTasksData', JSON.stringify(allTasksData));

    // Sincronizar dias afetados com Supabase (mantém a ordem)
    const datesToSync = [...new Set([sourceDateStr, targetDateStr])];
    (async () => { for (const d of datesToSync) await syncDateToSupabase(d); })();

    renderView();
    draggedTask = null;
}

// Sincroniza todas as tarefas de uma data com o Supabase, preservando a ordem
async function syncDateToSupabase(dateStr) {
    if (!currentUser) return;
    _isSyncingDate = true;
    try {

        // Deletar todos os registros desta data no Supabase
        await supabaseClient.from('tasks').delete()
            .eq('user_id', currentUser.id)
            .eq('day', dateStr);

        // Reinserir na ordem atual do allTasksData
        // Nunca salvar tarefas recorrentes ou de rotina no banco
        const recurringTextsSet = new Set(allRecurringTasks.map(rt => rt.text));
        const periods = allTasksData[dateStr] || {};
        const inserts = [];
        Object.entries(periods).forEach(([period, tasks]) => {
            if (Array.isArray(tasks)) {
                tasks.forEach(task => {
                    if (!task.text || task.text.trim() === '') return;
                    if (task.isWeeklyRecurring || task.isRoutine || task.isRecurring) return;
                    if (recurringTextsSet.has(task.text)) return;
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

        if (inserts.length > 0) {
            const { data } = await supabaseClient.from('tasks').insert(inserts).select();
            // Atualizar supabaseIds locais
            if (data) {
                data.forEach((row) => {
                    const tasks = allTasksData[row.day]?.[row.period];
                    if (tasks) {
                        const match = tasks.find(t => t.text === row.text && !t.supabaseId);
                        if (match) match.supabaseId = row.id;
                    }
                });
                localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
            }
        }
    } finally {
        _isSyncingDate = false;
    }
}

function handleDrop(e) {
    // Fallback drop on column
    e.preventDefault();
    // Logic to drop at end of list if dropped on column
}

// --- Menus ---
function showEditToolbar(e, task, label) {
    const toolbar = document.getElementById('editToolbar');
    toolbar.style.left = e.pageX + 'px';
    toolbar.style.top = e.pageY + 'px';
    toolbar.classList.add('show');

    // Setup buttons (simplified)
    toolbar.querySelector('[data-action="color"]').onclick = (ev) => {
        ev.stopPropagation();
        showColorMenu(ev, task, label);
    }
    toolbar.querySelector('[data-action="habit"]').onclick = () => {
        task.isHabit = !task.isHabit;

        if (task.isHabit) {
            const alreadyInRecurring = allRecurringTasks.some(t => t.text === task.text);
            if (!alreadyInRecurring) {
                allRecurringTasks.push({
                    text: task.text,
                    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                    priority: task.priority || 'none',
                    color: task.color || 'default',
                    isHabit: true,
                    createdAt: new Date().toISOString()
                });
            }
            alert(`"${task.text}" marcado como hábito e adicionado à Rotina!`);
        } else {
            const recurringIndex = allRecurringTasks.findIndex(t => t.text === task.text);
            if (recurringIndex !== -1) {
                allRecurringTasks.splice(recurringIndex, 1);
            }
            alert(`"${task.text}" removido dos hábitos e da Rotina.`);
        }

        saveToLocalStorage();
        syncRecurringTasksToSupabase();
        renderView();
        toolbar.classList.remove('show');
    }
    toolbar.querySelector('[data-action="delete"]').onclick = async () => {
        // Delete logic
        const taskElement = label.closest('.task-item');
        const dateStr = taskElement.dataset.date;
        const period = taskElement.dataset.period;
        const index = parseInt(taskElement.dataset.index);

        // Buscar a tarefa
        if (!allTasksData[dateStr] || !allTasksData[dateStr][period]) return;
        const taskToDelete = allTasksData[dateStr][period][index];

        // Deletar do Supabase primeiro
        await deleteTaskFromSupabase(taskToDelete);

        // Depois deletar localmente
        allTasksData[dateStr][period].splice(index, 1);

        // Limpar período vazio
        if (allTasksData[dateStr][period].length === 0) {
            delete allTasksData[dateStr][period];
        }

        localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
        renderView();
    }
}

function showColorMenu(e, task, label) {
    const menu = document.getElementById('colorMenu');
    const rect = document.getElementById('editToolbar').getBoundingClientRect();
    // Fix positioning (scroll aware)
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;

    menu.style.left = (rect.left + scrollLeft) + 'px';
    menu.style.top = (rect.bottom + scrollTop + 8) + 'px';
    menu.classList.add('show');

    menu.querySelectorAll('.color-swatch').forEach(s => {
        s.onclick = () => {
            const color = s.dataset.color;
            task.color = color;
            saveToLocalStorage();
            renderView();
        }
    });
}

// --- Init ---
document.addEventListener('click', (e) => {
    if (!e.target.closest('#editToolbar') && !e.target.closest('#colorMenu')) {
        document.getElementById('editToolbar').classList.remove('show');
        document.getElementById('colorMenu').classList.remove('show');
    }
    if (!e.target.closest('#userDropdown') && !e.target.closest('#btnUser')) {
        document.getElementById('userDropdown').classList.remove('show');
    }
});

document.getElementById('btnUser').onclick = () => {
    const drop = document.getElementById('userDropdown');
    drop.style.display = drop.style.display === 'flex' ? 'none' : 'flex';
};

document.getElementById('btnLogout').onclick = signOut;

// Event listeners para opÇÕES do quick add menu
document.querySelectorAll('.quick-add-option').forEach(option => {
    option.onclick = () => {
        const type = option.dataset.type;
        document.getElementById('quickAddMenu').style.display = 'none';

        if (type === 'routine') {
            const text = prompt('Digite a tarefa de rotina diária:');
            if (text && text.trim()) {
                allRecurringTasks.push({
                    text: text.trim(),
                    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                    priority: 'none',
                    color: 'default',
                    isHabit: true,
                    createdAt: new Date().toISOString()
                });
                saveToLocalStorage();
                syncRecurringTasksToSupabase();
                renderView();
            }
        } else if (type === 'weekly') {
            showWeeklyRecurrenceDialog();
        } else if (type === 'custom') {
            // Abre um prompt para tarefa customizada (ex: adicionar em data específica)
            const text = prompt('Digite a tarefa:');
            if (text && text.trim()) {
                const dateStr = localDateStr();
                const period = 'Tarefas';

                if (!allTasksData[dateStr]) allTasksData[dateStr] = {};
                if (!allTasksData[dateStr][period]) allTasksData[dateStr][period] = [];

                const newTask = {
                    text: text.trim(),
                    completed: false,
                    color: 'default',
                    isHabit: false
                };

                allTasksData[dateStr][period].push(newTask);
                syncTaskToSupabase(dateStr, period, newTask);
                saveToLocalStorage();
                renderView();
            }
        }
    };
});

// Event listeners para autenticação
document.getElementById('btnLogin').onclick = async () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    await signIn(email, password);
};

document.getElementById('btnSignup').onclick = async () => {
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    await signUp(email, password);
};

document.getElementById('btnShowSignup').onclick = () => {
    document.getElementById('authLogin').style.display = 'none';
    document.getElementById('authSignup').style.display = 'block';
};

document.getElementById('btnShowLogin').onclick = () => {
    document.getElementById('authSignup').style.display = 'none';
    document.getElementById('authLogin').style.display = 'block';
};

// Event listeners do modal de tarefa semanal
document.querySelectorAll('.weekly-day-btn').forEach(btn => {
    btn.onclick = () => btn.classList.toggle('selected');
});

document.getElementById('weeklyTaskText').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnSaveWeekly').click();
    if (e.key === 'Escape') document.getElementById('btnCancelWeekly').click();
});

document.getElementById('btnSaveWeekly').onclick = () => {
    const text = document.getElementById('weeklyTaskText').value.trim();
    if (!text) {
        document.getElementById('weeklyTaskText').focus();
        return;
    }

    const selectedDays = [...document.querySelectorAll('.weekly-day-btn.selected')]
        .map(b => parseInt(b.dataset.day));

    if (selectedDays.length === 0) {
        // Destacar os botÃµes visualmente para indicar que precisa selecionar
        document.querySelectorAll('.weekly-day-btn').forEach(b => {
            b.style.borderColor = '#ff453a';
            setTimeout(() => b.style.borderColor = '', 1000);
        });
        return;
    }

    allRecurringTasks.push({
        text,
        daysOfWeek: selectedDays,
        priority: 'none',
        color: 'default',
        isHabit: false,
        createdAt: new Date().toISOString()
    });

    saveToLocalStorage();
    syncRecurringTasksToSupabase();
    document.getElementById('weeklyModal').classList.remove('show');

    if (currentView === 'settings') renderSettingsView();
    if (currentView === 'routine') renderRoutineView();
    else renderView();
};

document.getElementById('btnCancelWeekly').onclick = () => {
    document.getElementById('weeklyModal').classList.remove('show');
};

// Handlers de export/import/clear estão dentro de renderSettingsView()

// Normalizar tarefas (corrigir text: undefined e remover recorrentes/rotina persistidas)
function normalizeAllTasks() {
    let hasChanges = false;
    const recurringTextsSet = new Set(allRecurringTasks.map(rt => rt.text));

    Object.entries(allTasksData).forEach(([dateStr, periods]) => {
        // Remover completamente o período 'Rotina' se existir (nunca deve ser persistido)
        if (periods['Rotina']) {
            delete periods['Rotina'];
            hasChanges = true;
        }
        // Remover flag de hidratação antiga (não mais utilizado)
        if (periods._routineHydrated) {
            delete periods._routineHydrated;
            hasChanges = true;
        }

        Object.entries(periods).forEach(([period, tasks]) => {
            if (Array.isArray(tasks)) {
                // Remover tarefas recorrentes/rotina salvas indevidamente (por flag ou por texto)
                const filtered = tasks.filter(task => {
                    if (task.isWeeklyRecurring || task.isRoutine || task.isRecurring) return false;
                    if (task.text && recurringTextsSet.has(task.text)) return false;
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
                // Limpar período vazio
                if (allTasksData[dateStr][period].length === 0) {
                    delete allTasksData[dateStr][period];
                    hasChanges = true;
                }
            }
        });
        // Limpar data vazia
        if (Object.keys(allTasksData[dateStr] || {}).length === 0) {
            delete allTasksData[dateStr];
            hasChanges = true;
        }
    });

    if (hasChanges) {
        localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
    }
}

loadFromLocalStorage();
normalizeAllTasks(); // Normalizar tarefas antigas
// checkAuth agora é chamado via onAuthStateChange (INITIAL_SESSION)
// setTimeout(checkAuth, 100);

// Inicializar ícones Lucide
if (window.lucide) {
    lucide.createIcons();
}

// ========================================
// PWA - Service Worker & NotificaÇÕES
// ========================================

let serviceWorkerRegistration = null;

// Registrar Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
            console.log('âœ… Service Worker registrado:', registration);
            serviceWorkerRegistration = registration;

            // Pedir permissão para notificaÇÕES após 3 segundos
            setTimeout(() => {
                requestNotificationPermission();
            }, 3000);
        })
        .catch((error) => {
            console.error('âŒ Erro ao registrar Service Worker:', error);
        });

    // Listener para mensagens do Service Worker
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'GET_DAILY_STATS') {
            sendDailyStats();
        }
    });
}

// Função para pedir permissão de notificaÇÕES
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Este navegador não suporta notificaÇÕES');
        return;
    }

    if (Notification.permission === 'granted') {
        console.log('âœ… Permissão de notificaÇÕES já concedida');
        scheduleNotifications();
        return;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('âœ… Permissão de notificaÇÕES concedida!');
            scheduleNotifications();
            showWelcomeNotification();
        }
    }
}

// Agendar notificaÇÕES através do Service Worker
function scheduleNotifications() {
    if (serviceWorkerRegistration) {
        const notifSettings = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
        serviceWorkerRegistration.active.postMessage({
            type: 'SCHEDULE_NOTIFICATIONS',
            morningTime: notifSettings.morningTime || '12:00',
            eveningTime: notifSettings.eveningTime || '22:00'
        });
    }
}

// Notificação de boas-vindas
function showWelcomeNotification() {
    if (serviceWorkerRegistration) {
        serviceWorkerRegistration.showNotification('ðŸŽ‰ NotificaÇÕES ativadas!', {
            body: 'Você receberá lembretes e atualizaÇÕES de progresso',
            icon: '/logo_flowly.png',
            badge: '/logo_flowly.png',
            vibrate: [200, 100, 200],
            tag: 'flowly-welcome'
        });
    }
}

// Enviar notificação de progresso
// Função helper para contar tarefas do dia (exclui rotinas persistidas)
function countDayTasks(dateStr) {
    const dayData = allTasksData[dateStr] || {};
    let total = 0, completed = 0;

    Object.entries(dayData).forEach(([period, tasks]) => {
        if (period === 'Rotina') return;
        if (Array.isArray(tasks)) {
            total += tasks.length;
            completed += tasks.filter(t => t.completed).length;
        }
    });

    // Rotina + recorrentes
    const routine = getRoutineTasksForDate(dateStr);
    total += routine.length;
    completed += routine.filter(t => t.completed).length;

    return { total, completed };
}

function sendProgressNotification() {
    const { total, completed } = countDayTasks(localDateStr());
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    if (serviceWorkerRegistration && total > 0) {
        serviceWorkerRegistration.active.postMessage({
            type: 'SEND_PROGRESS_NOTIFICATION',
            completed,
            total,
            percentage
        });
    }
}

// Enviar estatísticas diárias para o resumo da noite
function sendDailyStats() {
    const { total, completed } = countDayTasks(localDateStr());
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    if (serviceWorkerRegistration) {
        serviceWorkerRegistration.active.postMessage({
            type: 'DAILY_STATS',
            completed,
            total,
            percentage
        });
    }
}

// Enviar notificação de progresso quando tarefa é marcada
const originalSaveToLocalStorage = saveToLocalStorage;
saveToLocalStorage = function () {
    originalSaveToLocalStorage();

    // Enviar notificação a cada 3 tarefas completadas
    const { completed } = countDayTasks(localDateStr());

    // Notificar a cada 3, 5, 8 e 10 tarefas completadas
    if ([3, 5, 8, 10].includes(completed)) {
        setTimeout(sendProgressNotification, 1000);
    }
};

// ========================================
// Fim PWA
// ========================================

// Expose functions to window for HTML onclick compatibility
window.setView = setView;
window.renderView = renderView;
window.showWeeklyRecurrenceDialog = showWeeklyRecurrenceDialog;
window.showAddRoutineTask = showAddRoutineTask;

// Helper function to show auth messages
function showAuthMessage(message, type = 'error') {
    const msgEl = document.getElementById('authMessage');
    if (!msgEl) return;

    msgEl.textContent = message;
    msgEl.style.display = 'block';
    msgEl.style.background = type === 'error' ? 'rgba(255, 69, 58, 0.15)' : 'rgba(48, 209, 88, 0.15)';
    msgEl.style.color = type === 'error' ? '#FF453A' : '#30D158';
    msgEl.style.border = type === 'error' ? '1px solid rgba(255, 69, 58, 0.3)' : '1px solid rgba(48, 209, 88, 0.3)';

    setTimeout(() => {
        msgEl.style.display = 'none';
        msgEl.textContent = '';
    }, 5000);
}

// Inicialização da Interface e Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Auth - Login
    const btnLogin = document.getElementById('btnLogin');
    if (btnLogin) {
        btnLogin.onclick = async () => {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            if (!email || !password) {
                showAuthMessage('Preencha email e senha!', 'error');
                return;
            }
            const btn = document.getElementById('btnLogin');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Entrando...';
            btn.disabled = true;
            try {
                await signIn(email, password);
            } catch (e) {
                console.error(e);
                showAuthMessage(e.message, 'error');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        };
    }

    // Auth - Signup
    const btnSignup = document.getElementById('btnSignup');
    if (btnSignup) {
        btnSignup.onclick = async () => {
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            if (!email || !password) {
                showAuthMessage('Preencha email e senha!', 'error');
                return;
            }
            const btn = document.getElementById('btnSignup');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Criando...';
            btn.disabled = true;
            try {
                await signUp(email, password);
            } catch (e) {
                console.error(e);
                showAuthMessage(e.message, 'error');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        };
    }

    // Auth - Toggles
    const btnShowSignup = document.getElementById('btnShowSignup');
    if (btnShowSignup) {
        btnShowSignup.onclick = () => {
            document.getElementById('authLogin').style.display = 'none';
            document.getElementById('authSignup').style.display = 'block';
        };
    }

    const btnShowLogin = document.getElementById('btnShowLogin');
    if (btnShowLogin) {
        btnShowLogin.onclick = () => {
            document.getElementById('authSignup').style.display = 'none';
            document.getElementById('authLogin').style.display = 'block';
        };
    }

    // Logout Button
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.onclick = async () => {
            if (confirm('Deseja realmente sair?')) {
                await signOut();
            }
        };
    }

    // Header - User Dropdown
    const btnUser = document.getElementById('btnUser');
    if (btnUser) {
        btnUser.onclick = (e) => {
            e.stopPropagation();
            const dd = document.getElementById('userDropdown');
            if (dd) dd.style.display = dd.style.display === 'flex' ? 'none' : 'flex';
        };
    }

    document.addEventListener('click', (e) => {
        const dd = document.getElementById('userDropdown');
        if (dd && dd.style.display === 'flex' && !dd.contains(e.target) && e.target !== btnUser) {
            dd.style.display = 'none';
        }
        // Hide Quick Add Menu
        const qm = document.getElementById('quickAddMenu');
        const fab = document.getElementById('floatingAddBtn');
        if (qm && qm.style.display === 'flex' && !qm.contains(e.target) && !fab.contains(e.target)) {
            qm.style.display = 'none';
            const fabIcon = fab.querySelector('i');
            if (fabIcon) fabIcon.setAttribute('data-lucide', 'zap');
            if (window.lucide) lucide.createIcons();
        }
    });

    // FAB Logic
    const fab = document.getElementById('floatingAddBtn');
    if (fab) {
        fab.onclick = (e) => {
            e.stopPropagation();
            const menu = document.getElementById('quickAddMenu');
            if (menu) {
                const isHidden = menu.style.display === 'none' || menu.style.display === '';
                menu.style.display = isHidden ? 'flex' : 'none';

                // Toggle Icon
                const icon = fab.querySelector('i');
                if (icon) {
                    icon.setAttribute('data-lucide', isHidden ? 'x' : 'zap');
                    if (window.lucide) lucide.createIcons();
                }
            }
        };
    }

    // Quick Menu Actions (Add Task, Add Routine, Add Weekly)
    const btnQuickTask = document.querySelector('[data-action="quick-task"]');
    if (btnQuickTask) {
        btnQuickTask.onclick = () => {
            document.getElementById('quickAddMenu').style.display = 'none';
            // Scroll to Today and Focus?
            // Simple: Just focus first empty input of Today if exists?
            // Or Add new input to Today.
            const todayStr = localDateStr();
            const container = document.querySelector(`.day-column[data-date="${todayStr}"]`);
            if (container) addQuickTaskInput(container, 'Hoje');
        };
    }

    // Refresh Icons
    if (window.lucide) lucide.createIcons();
});
window.addRoutineTask = addRoutineTask;
window.deleteRoutineTask = deleteRoutineTask;
window.toggleRoutineToday = toggleRoutineToday;
window.goToDate = goToDate;
window.changeWeek = changeWeek;
window.goToCurrentWeek = goToCurrentWeek;
window.signOut = signOut;

// --- Event Listeners do Novo Modal de Tarefas ---
document.addEventListener('DOMContentLoaded', () => {
    // Priority Buttons
    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });

    // Week Day Buttons (Toggle)
    document.querySelectorAll('.weekly-day-btn').forEach(btn => {
        btn.onclick = () => {
            btn.classList.toggle('active');
        };
    });

    // Action Buttons
    const btnSave = document.getElementById('btnSaveTaskEdit');
    if (btnSave) btnSave.onclick = window.saveTaskEdit;

    const btnDelete = document.getElementById('btnDeleteTaskEdit');
    if (btnDelete) btnDelete.onclick = window.deleteTaskEdit;

    const btnCancel = document.getElementById('btnCancelTaskEdit');
    if (btnCancel) btnCancel.onclick = () => document.getElementById('taskEditModal').classList.remove('show');

    // Refresh Icons
    if (window.lucide) lucide.createIcons();
});

