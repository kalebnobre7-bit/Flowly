const { spawnSync } = require('node:child_process');

const files = [
  'js/app.js',
  'js/core/config.js',
  'js/core/events.js',
  'js/core/errors.js',
  'js/core/local-store.js',
  'js/core/tasks-sync.js',
  'js/core/tasks-repo.js',
  'js/core/auth-session.js',
  'js/core/pwa.js',
  'js/core/routine-service.js',
  'js/core/analytics-service.js',
  'js/views/dispatcher.js',
  'js/components/task-actions.js',
  'service-worker.js'
];

let failed = false;
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (r.status !== 0) {
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('check-syntax: ok');
