const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.FLOWLY_SMOKE_PORT || 4173);
const HOST = '127.0.0.1';
const DEBUG_PORT = Number(process.env.FLOWLY_SMOKE_DEBUG_PORT || 9223);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function findBrowser() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function safeResolve(urlPath) {
  const cleanPath = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  const relativePath = cleanPath === '/' ? '/index.html' : cleanPath;
  const resolved = path.resolve(ROOT, `.${relativePath}`);
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

function createServer() {
  return http.createServer((req, res) => {
    const reqUrl = req.url || '/';
    const resolved = safeResolve(reqUrl);
    if (!resolved) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('forbidden');
      return;
    }

    let filePath = resolved;
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      const ext = path.extname(filePath).toLowerCase();
      const body = fs.readFileSync(filePath);
      res.writeHead(200, { 'content-type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(body);
    } catch (error) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    }
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function poll(fn, tries = 60, wait = 250) {
  let lastError = null;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await delay(wait);
    }
  }
  throw lastError || new Error('poll failed');
}

function launchBrowser(browserPath) {
  const userDataDir = path.join(ROOT, '.tmp', 'browser-smoke-profile');
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  const child = spawn(
    browserPath,
    [
      '--headless',
      '--disable-gpu',
      '--no-first-run',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${userDataDir}`,
      'about:blank'
    ],
    {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true
    }
  );

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk || '');
  });

  return { child, getStderr: () => stderr };
}

function createCdpClient(webSocketUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(webSocketUrl);
    const pending = new Map();
    const errors = [];
    let nextId = 1;

    function send(method, params = {}) {
      return new Promise((innerResolve, innerReject) => {
        const id = nextId++;
        pending.set(id, { innerResolve, innerReject, method });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.onopen = () => {
      resolve({
        ws,
        errors,
        send,
        close() {
          try {
            ws.close();
          } catch (error) {
            // noop
          }
        }
      });
    };

    ws.onerror = reject;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.id) {
        const item = pending.get(msg.id);
        if (!item) return;
        pending.delete(msg.id);
        if (msg.error) {
          item.innerReject(new Error(`${item.method}: ${JSON.stringify(msg.error)}`));
        } else {
          item.innerResolve(msg.result);
        }
        return;
      }

      if (msg.method === 'Runtime.exceptionThrown') {
        const details = msg.params.exceptionDetails || {};
        errors.push({
          type: 'exception',
          message: details.text || 'exception',
          description:
            (details.exception && (details.exception.description || details.exception.value)) || '',
          url: details.url || '',
          line: details.lineNumber,
          column: details.columnNumber
        });
      }

      if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type;
        const text = (msg.params.args || [])
          .map((arg) => arg.value ?? arg.description ?? '')
          .join(' ');
        if (type === 'error') {
          errors.push({ type: 'console', message: text });
        }
      }
    };
  });
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  return result.result ? result.result.value : undefined;
}

async function main() {
  const browser = findBrowser();
  if (!browser) {
    throw new Error('Nenhum browser compatível encontrado para o smoke test.');
  }

  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, resolve);
  });

  const { child, getStderr } = launchBrowser(browser);

  try {
    const target = await poll(async () => {
      const response = await fetch(`http://${HOST}:${DEBUG_PORT}/json/list`);
      if (!response.ok) throw new Error('debug endpoint not ready');
      const targets = await response.json();
      const pageTarget = (targets || []).find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
      if (!pageTarget) throw new Error('page target not ready');
      return pageTarget;
    });

    const cdp = await createCdpClient(target.webSocketDebuggerUrl);
    const { send, errors, close } = cdp;

    try {
      await send('Page.enable');
      await send('Runtime.enable');
      await send('Console.enable');
      await send('Log.enable');

      await send('Page.navigate', { url: `http://${HOST}:${PORT}/index.html` });
      await delay(3500);

      const snapshotExpr = `(requested) => ({
        requested,
        currentView: typeof currentView !== 'undefined' ? currentView : null,
        visible: {
          week: !document.getElementById('weekGrid')?.classList.contains('hidden'),
          month: !document.getElementById('monthView')?.classList.contains('hidden'),
          analytics: !document.getElementById('analyticsView')?.classList.contains('hidden'),
          finance: !document.getElementById('financeView')?.classList.contains('hidden'),
          projects: !document.getElementById('projectsView')?.classList.contains('hidden'),
          sexta: !document.getElementById('sextaView')?.classList.contains('hidden'),
          settings: !document.getElementById('settingsView')?.classList.contains('hidden')
        },
        text: (document.querySelector('#main-content, main, body')?.innerText || document.body?.innerText || '').slice(0, 180)
      })`;

      const initial = await evaluate(
        send,
        `(${snapshotExpr})('initial')`
      );

      const persistenceProbe = await evaluate(
        send,
        `(() => {
          const probeText = '[smoke] task persist';
          const dateStr = typeof localDateStr === 'function' ? localDateStr() : new Date().toISOString().slice(0, 10);
          if (typeof createTaskViaSexta !== 'function') {
            return { ok: false, reason: 'createTaskViaSexta indisponivel' };
          }
          createTaskViaSexta(dateStr, probeText, 'Tarefas');
          const raw = localStorage.getItem('allTasksData');
          const parsed = raw ? JSON.parse(raw) : {};
          const currentTasks = ((parsed || {})[dateStr] || {}).Tarefas || [];
          return {
            ok: true,
            dateStr,
            savedInStorage: currentTasks.some((task) => task && task.text === probeText),
            taskCount: currentTasks.length
          };
        })()`
      );
      await delay(900);

      const postCreate = await evaluate(
        send,
        `(() => ({
          currentView: typeof currentView !== 'undefined' ? currentView : null,
          bodyText: (document.querySelector('#main-content, main, body')?.innerText || document.body?.innerText || '').slice(0, 220)
        }))()`
      );

      await send('Page.reload', { ignoreCache: true });
      await delay(2500);

      const afterReloadPersistence = await evaluate(
        send,
        `(() => {
          const probeText = '[smoke] task persist';
          const dateStr = typeof localDateStr === 'function' ? localDateStr() : new Date().toISOString().slice(0, 10);
          const raw = localStorage.getItem('allTasksData');
          const parsed = raw ? JSON.parse(raw) : {};
          const currentTasks = ((parsed || {})[dateStr] || {}).Tarefas || [];
          const text = (document.querySelector('#main-content, main, body')?.innerText || document.body?.innerText || '').slice(0, 220);
          return {
            dateStr,
            savedInStorage: currentTasks.some((task) => task && task.text === probeText),
            bodyText: text
          };
        })()`
      );

      const deleteProbe = await evaluate(
        send,
        `(() => {
          const probeText = '[smoke] task persist';
          const dateStr = typeof localDateStr === 'function' ? localDateStr() : new Date().toISOString().slice(0, 10);
          const pendingBefore = JSON.parse(localStorage.getItem('flowlyPendingTaskDeletes') || '[]').length;
          const deletedEntry =
            typeof deleteTaskViaSexta === 'function'
              ? deleteTaskViaSexta(probeText, dateStr)
              : null;
          const raw = localStorage.getItem('allTasksData');
          const parsed = raw ? JSON.parse(raw) : {};
          const currentTasks = ((parsed || {})[dateStr] || {}).Tarefas || [];
          const pendingAfter = JSON.parse(localStorage.getItem('flowlyPendingTaskDeletes') || '[]').length;
          return {
            ok: !!deletedEntry,
            dateStr,
            pendingBefore,
            pendingAfter,
            stillInStorage: currentTasks.some((task) => task && task.text === probeText)
          };
        })()`
      );

      await delay(1200);
      await send('Page.reload', { ignoreCache: true });
      await delay(2500);

      const afterDeleteReload = await evaluate(
        send,
        `(() => {
          const probeText = '[smoke] task persist';
          const dateStr = typeof localDateStr === 'function' ? localDateStr() : new Date().toISOString().slice(0, 10);
          const raw = localStorage.getItem('allTasksData');
          const parsed = raw ? JSON.parse(raw) : {};
          const currentTasks = ((parsed || {})[dateStr] || {}).Tarefas || [];
          const bodyText = (document.querySelector('#main-content, main, body')?.innerText || document.body?.innerText || '').slice(0, 260);
          const pendingDeletes = JSON.parse(localStorage.getItem('flowlyPendingTaskDeletes') || '[]');
          return {
            dateStr,
            stillInStorage: currentTasks.some((task) => task && task.text === probeText),
            visibleInBody: bodyText.includes(probeText),
            pendingDeleteCount: pendingDeletes.length,
            pendingDeleteTexts: pendingDeletes.map((item) => item && item.text).filter(Boolean)
          };
        })()`
      );

      const targets = ['week', 'month', 'analytics', 'finance', 'projects', 'sexta', 'settings'];
      const navResults = [];
      for (const view of targets) {
        await evaluate(send, `typeof setView === 'function' ? setView('${view}') : null`);
        await delay(800);
        const snapshot = await evaluate(send, `(${snapshotExpr})('${view}')`);
        navResults.push(snapshot);
      }

      const mismatches = navResults.filter((item) => {
        const visible = item.visible && item.visible[item.requested];
        return item.currentView !== item.requested || !visible;
      });

      const payload = {
        ok: mismatches.length === 0,
        initial,
        persistenceProbe,
        postCreate,
        afterReloadPersistence,
        deleteProbe,
        afterDeleteReload,
        navResults,
        mismatchCount: mismatches.length,
        mismatches,
        errorCount: errors.length,
        errors
      };

      if (!persistenceProbe.ok || !persistenceProbe.savedInStorage) payload.ok = false;
      if (!afterReloadPersistence.savedInStorage) payload.ok = false;
      if (!deleteProbe.ok || deleteProbe.stillInStorage) payload.ok = false;
      if (afterDeleteReload.stillInStorage || afterDeleteReload.visibleInBody) payload.ok = false;

      console.log(JSON.stringify(payload, null, 2));
      if (!payload.ok) process.exitCode = 1;
    } finally {
      close();
    }
  } catch (error) {
    console.error('browser-smoke: failed', error);
    const stderr = getStderr().trim();
    if (stderr) console.error(stderr);
    process.exitCode = 1;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (!child.killed) {
      child.kill('SIGTERM');
      await delay(500);
      if (!child.killed) child.kill('SIGKILL');
    }
  }
}

main().catch((error) => {
  console.error('browser-smoke: failed', error);
  process.exit(1);
});
