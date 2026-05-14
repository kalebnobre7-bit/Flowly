#!/usr/bin/env node
/**
 * Flowly Data MCP — StreamableHTTP stateless server (JSON mode)
 * Recommended by MCP guide for remote servers (no session state, JSON responses).
 *
 * Required env vars:
 *   FLOWLY_EMAIL      Flowly login email
 *   FLOWLY_PASSWORD   Flowly password
 *   FLOWLY_SECRET     random secret (openssl rand -hex 32)
 * Optional:
 *   PORT              default 3000 (Railway sets this automatically)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { registerTools, signIn } from './tools.js';

const PORT   = process.env.PORT   || 3000;
const SECRET = process.env.FLOWLY_SECRET || '';

const app = express();
app.use(express.json());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }

  // Normalize Accept: */* — Hono reads rawHeaders, SDK needs explicit types
  const accept = req.headers['accept'] || '';
  if (accept.includes('*/*') && !accept.includes('text/event-stream')) {
    const fixed = 'application/json, text/event-stream';
    req.headers['accept'] = fixed;
    if (Array.isArray(req.rawHeaders)) {
      for (let i = 0; i < req.rawHeaders.length - 1; i += 2) {
        if (req.rawHeaders[i].toLowerCase() === 'accept') {
          req.rawHeaders[i + 1] = fixed;
        }
      }
    }
  }
  next();
});

// ── Auth ──────────────────────────────────────────────────────────────────────
function requireSecret(req, res, next) {
  if (!SECRET) return next();
  const auth  = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.secret;
  if (token !== SECRET) { res.status(401).json({ error: 'Unauthorized' }); return; }
  next();
}

// ── StreamableHTTP — stateless JSON mode (one transport per request) ──────────
app.all('/mcp', requireSecret, async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,      // plain JSON, no SSE streaming
  });

  const server = new McpServer({ name: 'flowly-data', version: '1.0.0' });
  registerTools(server);

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } finally {
    await server.close().catch(() => {});
  }
});

// ── Health ────────────────────────────────────────────────────────────────────
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
    process.stdout.write(`[flowly-data] Ready on port ${PORT}\n`);
    process.stdout.write(`[flowly-data] Connect URL: https://YOUR-APP.up.railway.app/mcp?secret=TOKEN\n`);
  });
}

main().catch(err => {
  process.stderr.write(`[flowly-data] Fatal: ${err.message}\n`);
  process.exit(1);
});
