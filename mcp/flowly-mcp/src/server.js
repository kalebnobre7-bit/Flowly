#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = resolve(serverDir, '../../..');
const projectRoot = resolve(process.env.FLOWLY_PROJECT_ROOT || defaultProjectRoot);
const agentsDir = join(projectRoot, '.agents');
const registryPath = join(agentsDir, 'registry.json');

const VALID_CHECKS = new Set(['check', 'test', 'lint', 'smoke']);

function readText(path) {
  return readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function textResult(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return {
    content: [{ type: 'text', text }],
  };
}

function ensureFlowlyRoot() {
  const required = ['AGENTS.md', 'package.json', '.agents/registry.json'];
  const missing = required.filter((entry) => !existsSync(join(projectRoot, entry)));
  if (missing.length > 0) {
    throw new Error(`FLOWLY_PROJECT_ROOT invalido: ${projectRoot}. Faltando: ${missing.join(', ')}`);
  }
}

function normalizeProjectPath(input) {
  if (!input || typeof input !== 'string') return '';
  const raw = input.trim();
  if (!raw) return '';
  const absolute = isAbsolute(raw) ? normalize(raw) : normalize(join(projectRoot, raw));
  const rel = relative(projectRoot, absolute);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return raw.replaceAll('\\', '/');
  }
  return rel.replaceAll('\\', '/');
}

function loadAgents() {
  ensureFlowlyRoot();
  const registry = readJson(registryPath);
  return registry.agents.map((agent) => {
    const briefPath = join(agentsDir, `${agent.id}.md`);
    return {
      ...agent,
      brief: existsSync(briefPath) ? readText(briefPath) : '',
    };
  });
}

function pathMatchesOwnership(filePath, ownedPath) {
  const file = normalizeProjectPath(filePath);
  const owner = normalizeProjectPath(ownedPath);
  if (!file || !owner) return false;
  const cleanOwner = owner.replace(/\/$/, '');
  return file === cleanOwner || file.startsWith(`${cleanOwner}/`);
}

function scoreAgent(agent, files, description) {
  const lowerDescription = (description || '').toLowerCase();
  let score = 0;
  const reasons = [];

  for (const file of files) {
    if (agent.owns?.some((owned) => pathMatchesOwnership(file, owned))) {
      score += 10;
      reasons.push(`owns ${normalizeProjectPath(file)}`);
    }
    if (agent.must_not_own?.some((blocked) => pathMatchesOwnership(file, blocked))) {
      score -= 8;
      reasons.push(`must_not_own ${normalizeProjectPath(file)}`);
    }
  }

  for (const term of agent.focus || []) {
    if (lowerDescription.includes(String(term).toLowerCase())) {
      score += 3;
      reasons.push(`focus "${term}"`);
    }
  }

  const keywordHints = {
    'experience-design': ['visual', 'layout', 'responsiv', 'css', 'mobile', 'view', 'design', 'sidebar', 'header'],
    'task-runtime': ['tarefa', 'subtarefa', 'drag', 'drop', 'timer', 'expans', 'projeto', 'reparent'],
    'sync-platform': ['supabase', 'sync', 'persist', 'auth', 'offline', 'cache', 'service worker', 'reload', 'banco'],
    'qa-release': ['teste', 'smoke', 'playwright', 'regress', 'valid', 'release', 'push'],
  };

  for (const hint of keywordHints[agent.id] || []) {
    if (lowerDescription.includes(hint)) {
      score += 2;
      reasons.push(`hint "${hint}"`);
    }
  }

  return { score, reasons: [...new Set(reasons)] };
}

function routeChange({ files = [], description = '' }) {
  const agents = loadAgents();
  const normalizedFiles = files.map(normalizeProjectPath).filter(Boolean);
  const scored = agents
    .map((agent) => ({ agent, ...scoreAgent(agent, normalizedFiles, description) }))
    .sort((a, b) => b.score - a.score);

  const primary = scored.find((entry) => entry.score > 0) || scored[0];
  const collaborators = scored
    .filter((entry) => entry.agent.id !== primary.agent.id && entry.score > 0)
    .map((entry) => ({
      id: entry.agent.id,
      name: entry.agent.name,
      score: entry.score,
      reasons: entry.reasons,
    }));

  const handoffs = scored
    .filter((entry) => entry.reasons.some((reason) => reason.startsWith('must_not_own')))
    .map((entry) => ({
      from: entry.agent.id,
      reason: entry.reasons.filter((reason) => reason.startsWith('must_not_own')),
    }));

  return {
    projectRoot,
    files: normalizedFiles,
    primary: {
      id: primary.agent.id,
      name: primary.agent.name,
      score: primary.score,
      reasons: primary.reasons,
    },
    collaborators,
    handoffs,
    note:
      primary.score > 0
        ? 'Use o agente primario como owner e envolva colaboradores quando o fluxo cruzar ownership.'
        : 'Nenhum owner forte identificado; use a descricao para fazer triagem manual antes de editar.',
  };
}

function validationPlan({ changeType = 'general', agents = [] }) {
  const involved = new Set(agents);
  const type = changeType.toLowerCase();
  const commands = ['npm run check', 'npm test', 'npm run lint'];
  const steps = [
    'Revisar ownership em .agents/registry.json antes de editar.',
    'Conferir git diff por arquivo e separar mudancas fora de escopo.',
  ];

  if (type.includes('visual') || involved.has('experience-design')) {
    steps.push('Validar desktop e mobile nas views alteradas.');
    steps.push('Conferir estados vazio/carregado e consistencia com DESIGN-SYSTEM.md.');
  }

  if (type.includes('task') || involved.has('task-runtime')) {
    steps.push('Testar criar, concluir, mover, expandir e apagar tarefas na UI real.');
    steps.push('Validar Hoje, Semana e Projetos quando a logica for compartilhada.');
  }

  if (type.includes('sync') || involved.has('sync-platform')) {
    steps.push('Validar reload, hard reload e persistencia local/remota.');
    steps.push('Checar Supabase/auth/cache quando arquivos de plataforma mudarem.');
  }

  if (type.includes('release') || involved.has('qa-release')) {
    commands.push('npm run smoke');
    steps.push('Rodar smoke de browser quando houver browser compativel disponivel.');
    steps.push('Registrar riscos residuais antes de push.');
  }

  return {
    changeType,
    agents: [...involved],
    commands: [...new Set(commands)],
    steps: [...new Set(steps)],
  };
}

function runCommand(command, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      shell: false,
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      resolvePromise({ code, stdout, stderr });
    });
  });
}

async function runChecks(checks) {
  ensureFlowlyRoot();
  const selected = checks.length > 0 ? checks : ['check', 'test', 'lint'];
  for (const check of selected) {
    if (!VALID_CHECKS.has(check)) {
      throw new Error(`Check nao permitido: ${check}. Use: ${[...VALID_CHECKS].join(', ')}`);
    }
  }

  const results = [];
  for (const check of selected) {
    const args = check === 'test' ? ['test'] : ['run', check];
    const result = await runCommand('npm', args);
    results.push({
      check,
      command: `npm ${args.join(' ')}`,
      code: result.code,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    });
    if (result.code !== 0) break;
  }
  return { projectRoot, results };
}

const server = new McpServer({
  name: 'flowly-mcp',
  version: '0.1.0',
});

server.tool('flowly_agents', 'Lista os 4 agentes do Flowly, ownership e briefs.', {}, async () => {
  const agents = loadAgents().map((agent) => ({
    id: agent.id,
    name: agent.name,
    focus: agent.focus,
    owns: agent.owns,
    must_not_own: agent.must_not_own,
    brief: agent.brief,
  }));
  return textResult({ projectRoot, agents });
});

server.tool(
  'flowly_route_change',
  'Classifica uma mudanca por ownership e sugere agente primario, colaboradores e handoffs.',
  {
    files: z.array(z.string()).optional().describe('Arquivos alterados ou planejados, relativos ou absolutos.'),
    description: z.string().optional().describe('Descricao curta do problema ou mudanca.'),
  },
  async ({ files = [], description = '' }) => textResult(routeChange({ files, description })),
);

server.tool(
  'flowly_validation_plan',
  'Gera plano de validacao para uma mudanca do Flowly.',
  {
    changeType: z.string().optional().describe('Tipo da mudanca: visual, task-runtime, sync-platform, qa-release ou general.'),
    agents: z.array(z.string()).optional().describe('Ids dos agentes envolvidos.'),
  },
  async ({ changeType = 'general', agents = [] }) => textResult(validationPlan({ changeType, agents })),
);

server.tool(
  'flowly_run_checks',
  'Roda checks locais permitidos do Flowly: check, test, lint e smoke.',
  {
    checks: z.array(z.enum(['check', 'test', 'lint', 'smoke'])).optional(),
  },
  async ({ checks = [] }) => textResult(await runChecks(checks)),
);

server.tool('flowly_project_context', 'Retorna um contexto curto e operacional do projeto Flowly.', {}, async () => {
  const packageJson = readJson(join(projectRoot, 'package.json'));
  const agents = loadAgents().map((agent) => ({
    id: agent.id,
    name: agent.name,
    focus: agent.focus,
  }));
  return textResult({
    projectRoot,
    app: 'Static PWA with vanilla JS, CSS modules by view, Supabase backend and service worker.',
    scripts: packageJson.scripts,
    agents,
    importantDocs: ['AGENTS.md', '.agents/registry.json', 'DESIGN-SYSTEM.md', 'ARCHITECTURE.md', 'REGRESSION_CHECKLIST.md'],
  });
});

const transport = new StdioServerTransport();
await server.connect(transport);
