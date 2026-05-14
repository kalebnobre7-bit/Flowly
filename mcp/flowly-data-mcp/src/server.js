#!/usr/bin/env node
/**
 * Flowly Data MCP — stdio server (Claude Code / local)
 * For remote access (Claude.ai web) use server-http.js instead.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools, signIn } from './tools.js';

async function main() {
  if (process.env.FLOWLY_USER_TOKEN) {
    // token provided directly — skip sign-in
  } else if (process.env.FLOWLY_EMAIL && process.env.FLOWLY_PASSWORD) {
    process.stderr.write('[flowly-data] Signing in…\n');
    await signIn();
    process.stderr.write('[flowly-data] Auth OK\n');
  } else {
    process.stderr.write('[flowly-data] WARNING: No credentials. Set FLOWLY_EMAIL + FLOWLY_PASSWORD.\n');
  }

  const server = new McpServer({ name: 'flowly-data', version: '1.0.0' });
  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  process.stderr.write(`[flowly-data] Fatal: ${err.message}\n`);
  process.exit(1);
});
