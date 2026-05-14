#!/usr/bin/env node
/**
 * Flowly Data MCP — HTTP server (StreamableHTTP + SSE fallback)
 * Deploy on Railway and connect via Claude.ai → custom connector.
 *
 * Required env vars:
 *   FLOWLY_EMAIL      your Flowly login email
 *   FLOWLY_PASSWORD   your Flowly password
 *   FLOWLY_SECRET     random secret token (openssl rand -hex 32)
 * Optional:
 *   PORT              default 3000 (Railway sets this automatically)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { registerTools, signIn } from './tools.js';

const PORT   = process.env.PORT   || 3000;
const SECRET = process.env.FLOWLY_SECRET || '';

const app = express();
app.use(express.json());

// ── CORS — allow Claude.ai and all origins ────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireSecret(req, res, next) {
  if (!SECRET) return next();
  const auth  = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.secret;
  if (token !== SECRET) { res.status(401).json({ error: 'Unauthorized' }); return; }
  next();
}

// ── StreamableHTTP transport (primary — what Claude.ai uses) ─────────────────
const streamTransport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
const streamServer    = new McpServer({ name: 'flowly-data', version: '1.0.0' });
registerTools(streamServer);

app.all('/mcp', requireSecret, async (req, res) => {
  await streamTransport.handleRequest(req, res, req.body);
});

// ── SSE transport (legacy fallback) ──────────────────────────────────────────
const sseTransports = new Map();

app.get('/sse', requireSecret, async (req, res) => {
  const server    = new McpServer({ name: 'flowly-data', version: '1.0.0' });
  registerTools(server);
  const transport = new SSEServerTransport('/messages', res);
  sseTransports.set(transport.sessionId, transport);
  res.on('close', () => sseTransports.delete(transport.sessionId));
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  const transport = sseTransports.get(req.query.sessionId);
  if (!transport) { res.status(404).json({ error: 'Session not found' }); return; }
  await transport.handlePostMessage(req, res);
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ status: 'ok', name: 'flowly-data-mcp', version: '1.0.0', transports: ['streamableHttp:/mcp', 'sse:/sse'] });
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function main() {
  if (process.env.FLOWLY_EMAIL && process.env.FLOWLY_PASSWORD) {
    process.stdout.write('[flowly-data] Signing in…\n');
    await signIn();
    process.stdout.write('[flowly-data] Auth OK\n');
  } else {
    process.stdout.write('[flowly-data] WARNING: No credentials set.\n');
  }

  await streamServer.connect(streamTransport);

  app.listen(PORT, () => {
    process.stdout.write(`[flowly-data] HTTP server ready on port ${PORT}\n`);
    process.stdout.write(`[flowly-data] StreamableHTTP: /mcp?secret=TOKEN\n`);
    process.stdout.write(`[flowly-data] SSE:            /sse?secret=TOKEN\n`);
  });
}

main().catch(err => {
  process.stderr.write(`[flowly-data] Fatal: ${err.message}\n`);
  process.exit(1);
});
