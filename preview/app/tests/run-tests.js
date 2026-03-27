const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadBrowserScript(file, ctx) {
  const src = fs.readFileSync(file, 'utf8');
  vm.runInContext(src, ctx, { filename: file });
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
  const r = svc.getDailyCompletion('2026-03-07');
  assert.equal(r.total, 3);
  assert.equal(r.completed, 2);
  assert.equal(r.rate, 67);
}

function testLocalStoreParser() {
  const ctx = vm.createContext({ window: {}, console });
  loadBrowserScript('js/core/local-store.js', ctx);

  const ok = ctx.window.FlowlyLocalStore.safeJSONParse('{"a":1}', {});
  const fallback = ctx.window.FlowlyLocalStore.safeJSONParse('{oops', { a: 2 });

  assert.equal(JSON.stringify(ok), JSON.stringify({ a: 1 }));
  assert.equal(JSON.stringify(fallback), JSON.stringify({ a: 2 }));
}

try {
  testEventBus();
  testAnalyticsService();
  testLocalStoreParser();
  console.log('tests: ok');
} catch (err) {
  console.error('tests: failed', err);
  process.exit(1);
}
