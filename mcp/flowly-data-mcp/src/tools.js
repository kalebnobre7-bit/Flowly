/**
 * Shared Flowly tools — registered on any McpServer instance.
 * Used by both server.js (stdio/Claude Code) and server-http.js (Railway/Claude.ai).
 */
import { z } from 'zod';

const SUPABASE_URL =
  process.env.FLOWLY_SUPABASE_URL ||
  'https://cgrosyjtujakkbjjnmml.supabase.co';

const ANON_KEY =
  process.env.FLOWLY_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNncm9zeWp0dWpha2tiampubW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMTA0NzcsImV4cCI6MjA4NjU4NjQ3N30.MsDw0nSiLF1jHWMuVGRgTT6gNUeK328RvGBo-YcFG1A';

const EMAIL    = process.env.FLOWLY_EMAIL    || '';
const PASSWORD = process.env.FLOWLY_PASSWORD || '';

let accessToken = process.env.FLOWLY_USER_TOKEN || '';

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function signIn() {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    }
  );
  if (!res.ok) throw new Error(`Auth failed: ${await res.text()}`);
  accessToken = (await res.json()).access_token;
}

export async function ensureAuth() {
  if (!accessToken) {
    if (EMAIL && PASSWORD) await signIn();
    else throw new Error('No credentials. Set FLOWLY_EMAIL + FLOWLY_PASSWORD.');
  }
}

// ── DB helpers ────────────────────────────────────────────────────────────────
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${accessToken || ANON_KEY}`,
    'Prefer': 'return=representation',
  };
}

export async function db(method, table, params = {}, body = null) {
  await ensureAuth();
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const opts = { method, headers: authHeaders() };
  if (body != null) opts.body = JSON.stringify(body);
  const res  = await fetch(url.toString(), opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// ── Date utils ────────────────────────────────────────────────────────────────
export function localDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('sv-SE');
}

export function weekDates() {
  const now  = new Date();
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
  return Array.from({ length: 7 }, (_, i) => localDate(diff + i));
}

function text(str) {
  return { content: [{ type: 'text', text: str }] };
}

// ── Register tools on a McpServer instance ────────────────────────────────────
export function registerTools(server) {

  server.tool(
    'flowly_today',
    'Get all tasks for today, grouped by time period (Manhã / Tarde / Noite / Rotina)',
    {},
    async () => {
      const today = localDate();
      const tasks = await db('GET', 'tasks', {
        day: `eq.${today}`,
        select: 'id,text,period,completed,priority,type,color,parent_id',
        order: 'position.asc',
      });
      const byPeriod = {};
      for (const t of tasks) (byPeriod[t.period] ??= []).push(t);
      const done = tasks.filter(t => t.completed).length;
      return text(JSON.stringify(
        { date: today, summary: `${done}/${tasks.length} completed`, byPeriod },
        null, 2
      ));
    }
  );

  server.tool(
    'flowly_week',
    'Get tasks for the current week (Mon–Sun), grouped by day',
    {},
    async () => {
      const result = {};
      for (const day of weekDates()) {
        const tasks = await db('GET', 'tasks', {
          day: `eq.${day}`,
          select: 'id,text,period,completed,priority,type',
          order: 'position.asc',
        });
        result[day] = {
          total: tasks.length,
          completed: tasks.filter(t => t.completed).length,
          tasks,
        };
      }
      return text(JSON.stringify(result, null, 2));
    }
  );

  server.tool(
    'flowly_pending',
    'List all incomplete tasks from the current week',
    {},
    async () => {
      const pending = [];
      for (const day of weekDates()) {
        const tasks = await db('GET', 'tasks', {
          day: `eq.${day}`,
          completed: 'eq.false',
          select: 'id,text,day,period,priority,type',
        });
        pending.push(...tasks);
      }
      return text(JSON.stringify({ count: pending.length, tasks: pending }, null, 2));
    }
  );

  server.tool(
    'flowly_create_task',
    'Create a new task in Flowly',
    {
      text:     z.string().describe('Task description'),
      day:      z.string().optional().describe('Date YYYY-MM-DD — defaults to today'),
      period:   z.enum(['Manhã', 'Tarde', 'Noite', 'Rotina']).optional().default('Manhã'),
      priority: z.enum(['money', 'urgent', 'important', 'simple']).optional(),
      type:     z.enum(['MONEY', 'BODY', 'MIND', 'SPIRIT', 'OPERATIONAL']).optional(),
    },
    async ({ text: taskText, day, period, priority, type }) => {
      const row = {
        text: taskText,
        day: day || localDate(),
        period: period || 'Manhã',
        completed: false,
        color: 'default',
        ...(priority && { priority }),
        ...(type     && { type }),
      };
      const result = await db('POST', 'tasks', {}, row);
      return text(`Created:\n${JSON.stringify(result?.[0] ?? result, null, 2)}`);
    }
  );

  server.tool(
    'flowly_complete_task',
    'Mark a task as complete or reopen it',
    {
      id:        z.string().describe('Task UUID'),
      completed: z.boolean().default(true),
    },
    async ({ id, completed }) => {
      await db('PATCH', `tasks?id=eq.${id}`, {}, {
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      });
      return text(`Task ${id} → ${completed ? '✓ completed' : '↩ reopened'}`);
    }
  );

  server.tool(
    'flowly_search_tasks',
    'Search tasks by text across all dates',
    {
      q:     z.string().describe('Search string (case-insensitive)'),
      limit: z.number().optional().default(25),
    },
    async ({ q, limit }) => {
      const tasks = await db('GET', 'tasks', {
        text:   `ilike.*${q}*`,
        select: 'id,text,day,period,completed,priority,type',
        order:  'day.desc',
        limit:  String(limit),
      });
      return text(JSON.stringify(tasks, null, 2));
    }
  );

  server.tool(
    'flowly_stats',
    'Completion stats — today and this week',
    {},
    async () => {
      const today = localDate();
      const todayTasks = await db('GET', 'tasks', { day: `eq.${today}`, select: 'completed' });
      const weekTasks  = [];
      for (const d of weekDates()) {
        const t = await db('GET', 'tasks', { day: `eq.${d}`, select: 'completed' });
        weekTasks.push(...t);
      }
      const pct = arr =>
        arr.length === 0 ? '—' :
        `${Math.round(arr.filter(t => t.completed).length / arr.length * 100)}%`;

      return text(JSON.stringify({
        today: {
          date: today,
          total: todayTasks.length,
          completed: todayTasks.filter(t => t.completed).length,
          rate: pct(todayTasks),
        },
        week: {
          total: weekTasks.length,
          completed: weekTasks.filter(t => t.completed).length,
          rate: pct(weekTasks),
        },
      }, null, 2));
    }
  );
}
