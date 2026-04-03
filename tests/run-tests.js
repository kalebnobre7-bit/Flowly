const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadBrowserScript(file, ctx) {
  const src = fs.readFileSync(file, 'utf8');
  vm.runInContext(src, ctx, { filename: file });
}

function createBrowserLikeContext(overrides = {}) {
  const storage = new Map();
  const localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    }
  };

  const ctx = {
    console,
    localStorage,
    navigator: { onLine: true },
    currentView: 'today',
    collapsedTaskGroups: {},
    allTasksData: {},
    pendingTaskDeletes: [],
    allRecurringTasks: [],
    habitsHistory: {},
    routineCompletions: {},
    financeState: { transactions: [] },
    customTaskPriorities: [],
    customTaskTypes: [],
    syncStatus: { state: 'saved', text: 'Tudo salvo', busyCount: 0, hideTimer: null },
    __savedCount: 0,
    __renderCount: 0,
    __syncedDates: [],
    __syncedTasks: [],
    localDateStr(date = null) {
      const value = date ? new Date(date) : new Date('2026-03-31T12:00:00Z');
      const year = value.getUTCFullYear();
      const month = String(value.getUTCMonth() + 1).padStart(2, '0');
      const day = String(value.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
    safeJSONParse(raw, fallback) {
      try {
        return raw ? JSON.parse(raw) : fallback;
      } catch (error) {
        return fallback;
      }
    },
    renderView() {
      ctx.__renderCount += 1;
    },
    saveToLocalStorage() {
      ctx.__savedCount += 1;
      localStorage.setItem('allTasksData', JSON.stringify(ctx.allTasksData));
    },
    syncDateToSupabase(dateStr) {
      ctx.__syncedDates.push(dateStr);
      return Promise.resolve({ success: true });
    },
    syncTaskToSupabase(dateStr, period, task) {
      ctx.__syncedTasks.push({ dateStr, period, text: task && task.text });
      return Promise.resolve({ success: true, data: { id: task && task.supabaseId } });
    },
    getTaskPriorities() {
      return [
        { id: 'money', name: 'Dinheiro', color: '#30D158' },
        { id: 'urgent', name: 'Urgente', color: '#FF453A' },
        { id: 'important', name: 'Importante', color: '#FF9F0A' },
        { id: 'simple', name: 'Simples', color: '#FFD60A' }
      ];
    },
    ensureMoneyPriorityOption() {},
    findProjectById(projectId) {
      const state = ctx.safeJSONParse(localStorage.getItem('flowlyProjectsState'), { projects: [] });
      return (state.projects || []).find((project) => project.id === projectId) || null;
    }
  };

  Object.assign(ctx, overrides);
  ctx.window = ctx;
  return vm.createContext(ctx);
}

function testEventBus() {
  const ctx = vm.createContext({ window: {}, console });
  loadBrowserScript('js/core/events.js', ctx);
  const bus = ctx.window.FlowlyEvents.createEventBus();
  let hit = 0;
  const off = bus.on('x', (v) => {
    hit += v;
  });
  bus.emit('x', 2);
  off();
  bus.emit('x', 2);
  assert.equal(hit, 2);
}

function testAnalyticsService() {
  const ctx = vm.createContext({ window: {}, console });
  loadBrowserScript('js/core/analytics-service.js', ctx);
  const svc = ctx.window.FlowlyAnalyticsService.create({
    getAllTasksData: () => ({
      '2026-03-07': {
        Tarefas: [{ completed: true }, { completed: false }]
      }
    }),
    getRoutineTasksForDate: () => [{ completed: true }]
  });
  const result = svc.getDailyCompletion('2026-03-07');
  assert.equal(result.total, 3);
  assert.equal(result.completed, 2);
  assert.equal(result.rate, 67);
}

function testLocalStoreParser() {
  const ctx = vm.createContext({ window: {}, console });
  loadBrowserScript('js/core/local-store.js', ctx);

  const ok = ctx.window.FlowlyLocalStore.safeJSONParse('{"a":1}', {});
  const fallback = ctx.window.FlowlyLocalStore.safeJSONParse('{oops', { a: 2 });

  assert.equal(JSON.stringify(ok), JSON.stringify({ a: 1 }));
  assert.equal(JSON.stringify(fallback), JSON.stringify({ a: 2 }));
}

async function testTasksSyncSkipsCompletedAtAfterSchemaDetection() {
  const calls = [];
  const ctx = createBrowserLikeContext();
  loadBrowserScript('js/core/tasks-sync.js', ctx);

  const fakeSupabase = {
    from() {
      return {
        insert(payload) {
          calls.push({ kind: 'insert', payload });
          if (Object.prototype.hasOwnProperty.call(payload[0], 'completed_at')) {
            return {
              select() {
                return Promise.resolve({
                  data: null,
                  error: { message: 'Could not find the completed_at column' }
                });
              }
            };
          }
          return {
            select() {
              return Promise.resolve({
                data: [{ id: 'task-1', updated_at: '2026-03-31T12:00:00.000Z' }],
                error: null
              });
            }
          };
        },
        update(payload) {
          calls.push({ kind: 'update', payload });
          return {
            eq() {
              return {
                select() {
                  return Promise.resolve({
                    data: [{ id: 'task-1', updated_at: '2026-03-31T12:00:00.000Z' }],
                    error: null
                  });
                }
              };
            }
          };
        }
      };
    }
  };

  const service = ctx.window.FlowlyTasksSync.create({
    supabaseClient: fakeSupabase,
    getCurrentUser: () => ({ id: 'user-1' }),
    getAllRecurringTasks: () => [],
    setAllRecurringTasks() {}
  });

  const firstTask = { text: 'Primeira', completed: true };
  const firstResult = await service.syncTaskToSupabase('2026-03-31', 'Tarefas', firstTask);
  assert.equal(firstResult.success, true);
  assert.equal(ctx.localStorage.getItem('flowly_tasks_completed_at_supported'), 'false');
  assert.equal(calls.length, 2);
  assert.ok(Object.prototype.hasOwnProperty.call(calls[0].payload[0], 'completed_at'));
  assert.ok(!Object.prototype.hasOwnProperty.call(calls[1].payload[0], 'completed_at'));

  calls.length = 0;
  const secondTask = { text: 'Segunda', completed: true };
  const secondResult = await service.syncTaskToSupabase('2026-03-31', 'Tarefas', secondTask);
  assert.equal(secondResult.success, true);
  assert.equal(calls.length, 1);
  assert.ok(!Object.prototype.hasOwnProperty.call(calls[0].payload[0], 'completed_at'));
}

async function testCreateSubtaskForTask() {
  const ctx = createBrowserLikeContext({
    allTasksData: {
      '2026-03-31': {
        Tarefas: [
          {
            text: 'Projeto raiz',
            supabaseId: 'proj-root-1',
            projectId: 'proj_1',
            projectName: 'Projeto X',
            parent_id: null,
            position: 0
          }
        ]
      }
    }
  });

  loadBrowserScript('js/tasks/flowly-tasks-core.js', ctx);

  const parentTask = ctx.allTasksData['2026-03-31'].Tarefas[0];
  const created = ctx.window.createSubtaskForTask(parentTask, {
    text: 'Subtarefa criada',
    targetDateStr: '2026-03-31',
    targetPeriod: 'Tarefas'
  });

  assert.ok(created);
  assert.equal(created.parent_id, 'proj-root-1');
  assert.equal(created.projectId, 'proj_1');
  assert.equal(created.projectName, 'Projeto X');
  assert.equal(ctx.allTasksData['2026-03-31'].Tarefas.length, 2);
  assert.equal(ctx.__syncedTasks.length, 1);
  assert.equal(ctx.__syncedTasks[0].text, 'Subtarefa criada');
}

async function testMoveTaskUnderParent() {
  const ctx = createBrowserLikeContext({
    allTasksData: {
      '2026-03-31': {
        Tarefas: [
          {
            text: 'Projeto raiz',
            supabaseId: 'proj-root-1',
            projectId: 'proj_1',
            projectName: 'Projeto X',
            parent_id: null,
            position: 0
          },
          {
            text: 'Arrastar para dentro',
            supabaseId: 'task-1',
            parent_id: null,
            position: 1
          }
        ]
      }
    }
  });

  loadBrowserScript('js/tasks/flowly-tasks-core.js', ctx);

  const moved = ctx.window.moveTaskUnderParent({
    sourceDateStr: '2026-03-31',
    sourcePeriod: 'Tarefas',
    sourceIndex: 1,
    parentDateStr: '2026-03-31',
    parentPeriod: 'Tarefas',
    parentIndex: 0
  });

  assert.ok(moved && moved.moved);
  const movedTask = ctx.allTasksData['2026-03-31'].Tarefas.find((task) => task.text === 'Arrastar para dentro');
  assert.ok(movedTask);
  assert.equal(movedTask.parent_id, 'proj-root-1');
  assert.equal(movedTask.projectId, 'proj_1');
  assert.equal(movedTask.projectName, 'Projeto X');
  assert.deepEqual(ctx.__syncedDates, ['2026-03-31']);
}

function testProjectMirrorsSkipCompletedCrossDateSubtasks() {
  const projectState = {
    projects: [
      {
        id: 'proj_1',
        name: 'Projeto X',
        clientName: 'Cliente X',
        status: 'active',
        startDate: '2026-03-29',
        completionDate: '',
        deadline: '',
        collapseSubtasks: true,
        createdAt: '2026-03-29T10:00:00.000Z',
        updatedAt: '2026-03-29T10:00:00.000Z'
      }
    ]
  };

  const ctx = createBrowserLikeContext({
    allTasksData: {
      '2026-03-29': {
        Tarefas: [
          {
            text: 'Projeto raiz',
            supabaseId: 'proj-root-1',
            projectId: 'proj_1',
            projectName: 'Projeto X',
            parent_id: null,
            position: 0,
            completed: false
          }
        ]
      },
      '2026-03-31': {
        Tarefas: [
          {
            text: 'Sub concluida',
            supabaseId: 'child-1',
            projectId: 'proj_1',
            projectName: 'Projeto X',
            parent_id: 'proj-root-1',
            position: 0,
            completed: true
          }
        ]
      }
    }
  });

  ctx.localStorage.setItem('flowlyProjectsState', JSON.stringify(projectState));

  loadBrowserScript('js/tasks/flowly-tasks-core.js', ctx);
  loadBrowserScript('js/core/projects-runtime.js', ctx);

  const mirrors = ctx.window.getProjectMirrorEntriesForDate('2026-04-01', 'Hoje');
  const texts = mirrors.map((entry) => entry.task.text);

  assert.ok(texts.includes('Projeto raiz'));
  assert.ok(!texts.includes('Sub concluida'));
}

function testProjectMirrorsCarryForwardPendingSubtasks() {
  const projectState = {
    projects: [
      {
        id: 'proj_1',
        name: 'Projeto X',
        clientName: 'Cliente X',
        status: 'active',
        startDate: '2026-03-29',
        completionDate: '',
        deadline: '',
        collapseSubtasks: true,
        createdAt: '2026-03-29T10:00:00.000Z',
        updatedAt: '2026-03-29T10:00:00.000Z'
      }
    ]
  };

  const ctx = createBrowserLikeContext({
    allTasksData: {
      '2026-03-29': {
        Tarefas: [
          {
            text: 'Projeto raiz',
            supabaseId: 'proj-root-1',
            projectId: 'proj_1',
            projectName: 'Projeto X',
            parent_id: null,
            position: 0,
            completed: false
          }
        ]
      },
      '2026-03-31': {
        Tarefas: [
          {
            text: 'Sub pendente',
            supabaseId: 'child-1',
            projectId: 'proj_1',
            projectName: 'Projeto X',
            parent_id: 'proj-root-1',
            position: 0,
            completed: false
          }
        ]
      }
    }
  });

  ctx.localStorage.setItem('flowlyProjectsState', JSON.stringify(projectState));

  loadBrowserScript('js/tasks/flowly-tasks-core.js', ctx);
  loadBrowserScript('js/core/projects-runtime.js', ctx);

  const mirrors = ctx.window.getProjectMirrorEntriesForDate('2026-04-01', 'Hoje');
  const texts = mirrors.map((entry) => entry.task.text);

  assert.ok(texts.includes('Projeto raiz'));
  assert.ok(texts.includes('Sub pendente'));
}

function testProjectMirrorCollapseIsScopedPerDay() {
  const ctx = createBrowserLikeContext({
    collapsedTaskGroups: {
      '2026-04-01:proj-root-1': true
    }
  });

  loadBrowserScript('js/tasks/flowly-tasks-core.js', ctx);

  const flattened = ctx.unifiedTaskSort([
    {
      task: {
        text: 'Projeto raiz',
        supabaseId: 'proj-root-1',
        isProjectMirror: true,
        mirrorSourceTaskId: 'proj-root-1',
        renderChildrenCount: 1
      },
      dateStr: '2026-04-01',
      period: 'Projetos',
      originalIndex: 0
    },
    {
      task: {
        text: 'Sub 1',
        supabaseId: 'child-1',
        parent_id: 'proj-root-1',
        isProjectMirror: true,
        mirrorSourceTaskId: 'child-1'
      },
      dateStr: '2026-04-01',
      period: 'Projetos',
      originalIndex: 1
    },
    {
      task: {
        text: 'Projeto raiz',
        supabaseId: 'proj-root-1',
        isProjectMirror: true,
        mirrorSourceTaskId: 'proj-root-1',
        renderChildrenCount: 1
      },
      dateStr: '2026-04-02',
      period: 'Projetos',
      originalIndex: 2
    },
    {
      task: {
        text: 'Sub 1',
        supabaseId: 'child-1',
        parent_id: 'proj-root-1',
        isProjectMirror: true,
        mirrorSourceTaskId: 'child-1'
      },
      dateStr: '2026-04-02',
      period: 'Projetos',
      originalIndex: 3
    }
  ]);

  assert.equal(
    JSON.stringify(flattened.map((entry) => `${entry.dateStr}:${entry.task.text}`)),
    JSON.stringify(['2026-04-01:Projeto raiz', '2026-04-02:Projeto raiz', '2026-04-02:Sub 1'])
  );
}

async function main() {
  testEventBus();
  testAnalyticsService();
  testLocalStoreParser();
  await testTasksSyncSkipsCompletedAtAfterSchemaDetection();
  await testCreateSubtaskForTask();
  await testMoveTaskUnderParent();
  testProjectMirrorsSkipCompletedCrossDateSubtasks();
  testProjectMirrorsCarryForwardPendingSubtasks();
  testProjectMirrorCollapseIsScopedPerDay();
  console.log('tests: ok');
}

main().catch((err) => {
  console.error('tests: failed', err);
  process.exit(1);
});
