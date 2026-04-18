const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || process.env.FLOWLY_PREVIEW_PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';

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
  '.woff2': 'font/woff2',
};

function safeResolve(urlPath) {
  const cleanPath = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  const relativePath = cleanPath === '/' ? '/index.html' : cleanPath;
  const resolved = path.resolve(ROOT, `.${relativePath}`);

  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

const server = http.createServer((req, res) => {
  const resolved = safeResolve(req.url || '/');

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
    res.writeHead(200, {
      'content-type': MIME_TYPES[ext] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch (error) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Flowly preview running at http://${HOST}:${PORT}/index.html`);
});

server.on('error', (error) => {
  console.error('preview-server: failed to start');
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
