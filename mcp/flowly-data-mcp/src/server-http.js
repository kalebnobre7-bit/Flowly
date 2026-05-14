#!/usr/bin/env node
/**
 * Flowly Data MCP — HTTP/SSE server
 * Deploy on Railway, Render, etc. and connect via Claude.ai → custom connector.
 *
 * Required env vars:
 *   FLOWLY_EMAIL      your Flowly login email
 *   FLOWLY_PASSWORD   your Flowly password
 *   FLOWLY_SECRET     random secret token — protects the public endpoint
 *                     (generate one: openssl rand -hex 32)
 * Optional:
 *   PORT              default 3000 (Railway sets this automatically)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { registerTools, signIn } from './tools.js';

const PORT   = process.env.PORT   || 3000;
const SECRET = process.env.FLOWLY_SECRET || '';

const app = express();
app.use(express.json());

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireSecret(req, res, next) {
  if (!SECRET) return next(); // no secret configured → open (dev only)
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.secret;
  if (token !== SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// ── Active transports (one per connected client) ──────────────────────────────
const transports = new Map();

// ── SSE endpoint — client connects here ──────────────────────────────────────
app.get('/sse', requireSecret, async (req, res) => {
  const server = new McpServer({ name: 'flowly-data', version: '1.0.0' });
  registerTools(server);

  const transport = new SSEServerTransport('/messages', res);
  transports.set(transport.sessionId, transport);

  res.on('close', () => {
    transports.delete(transport.sessionId);
  });

  await server.connect(transport);
});

// ── Messages endpoint — client sends tool calls here ─────────────────────────
app.post('/messages', requireSecret, async (req, res) => {
  const id        = req.query.sessionId;
  const transport = transports.get(id);
  if (!transport) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  await transport.handlePostMessage(req, res);
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ status: 'ok', name: 'flowly-data-mcp', version: '1.0.0' });
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

  app.listen(PORT, () => {
    process.stdout.write(`[flowly-data] HTTP server ready on port ${PORT}\n`);
    if (SECRET) {
      process.stdout.write(`[flowly-data] Connect URL: https://YOUR-APP.railway.app/sse?secret=${SECRET}\n`);
    } else {
      process.stdout.write(`[flowly-data] WARNING: FLOWLY_SECRET not set — endpoint is public!\n`);
    }
  });
}

main().catch(err => {
  process.stderr.write(`[flowly-data] Fatal: ${err.message}\n`);
  process.exit(1);
});
