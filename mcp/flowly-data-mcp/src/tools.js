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

let accessToken  = process.env.FLOWLY_USER_TOKEN || '';
let refreshToken = '';
let refreshTimer  = null;

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
  const data = await res.json();
  accessToken  = data.access_token;
  refreshToken = data.refresh_token || '';
  scheduleRefresh(data.expires_in || 3600);
}

async function refreshSession() {
  if (!refreshToken) { await signIn(); return; }
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }
  );
  if (!res.ok) { await signIn(); return; } // refresh falhou, faz login completo
  const data = await res.json();
  accessToken  = data.access_token;
  refreshToken = data.refresh_token || refreshToken;
  scheduleRefresh(data.expires_in || 3600);
  process.stdout.write('[flowly-data] Token renovado.\n');
}

function scheduleRefresh(expiresInSeconds) {
  if (refreshTimer) clearTimeout(refreshTimer);
  // Renova 60s antes de expirar (nunca mais de 50min)
  const delay = Math.min(expiresInSeconds - 60, 3000) * 1000;
  refreshTimer = setTimeout(() => refreshSession().catch(() => {}), delay);
  refreshTimer.unref?.(); // não bloqueia shutdown do processo
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

export async function db(method, table, params = {}, body = null, extraHeaders = {}) {
  await ensureAuth();
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const opts = { method, headers: { ...authHeaders(), ...extraHeaders } };
  if (body != null) opts.body = JSON.stringify(body);
  let res  = await fetch(url.toString(), opts);
  // Token expirado — renova e tenta uma vez mais
  if (res.status === 401 && (EMAIL || refreshToken)) {
    await refreshSession();
    opts.headers = { ...authHeaders(), ...extraHeaders };
    res = await fetch(url.toString(), opts);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// Extract user UUID from JWT access token (needed for habits_history inserts)
function getUserId() {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).sub || null;
  } catch { return null; }
}

// Helper: fetch habits (RECURRING tasks with is_habit=true) active on a given date + completion status
async function fetchHabitsForDate(dateStr) {
  const dow = new Date(dateStr + 'T12:00:00').getDay(); // 0=Sun … 6=Sat
  const recurring = await db('GET', 'tasks', {
    day: 'eq.RECURRING',
    is_habit: 'eq.true',
    select: 'id,text,type,color,period',
  }).catch(() => []);

  const active = recurring.filter(h => {
    try {
      const meta = JSON.parse(h.period || '{}');
      const days = meta.daysOfWeek || [];
      return days.length === 0 || days.includes(dow);
    } catch { return true; }
  });

  const completions = active.length > 0
    ? await db('GET', 'habits_history', { date: `eq.${dateStr}`, select: 'habit_name,completed,completed_at' }).catch(() => [])
    : [];

  const doneSet = new Set(completions.filter(c => c.completed).map(c => c.habit_name));
  const doneMap = Object.fromEntries(completions.filter(c => c.completed).map(c => [c.habit_name, c.completed_at || null]));

  return active.map(h => ({
    id: h.id,
    text: h.text,
    period: 'Rotina',
    is_habit: true,
    completed: doneSet.has(h.text),
    completed_at: doneMap[h.text] || null,
    type: h.type,
    color: h.color,
  }));
}

// ── Date utils ────────────────────────────────────────────────────────────────
export function localDate(offset = 0) {
  const tz = process.env.FLOWLY_TIMEZONE || 'America/Sao_Paulo';
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('sv-SE', { timeZone: tz });
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
      const [tasks, habitRows] = await Promise.all([
        db('GET', 'tasks', {
          day: `eq.${today}`,
          select: 'id,text,period,completed,priority,type,color,parent_id,completed_at,timer_total_ms,timer_sessions_count,created_at',
          order: 'position.asc',
        }),
        fetchHabitsForDate(today),
      ]);

      const byPeriod = {};
      for (const t of tasks) (byPeriod[t.period] ??= []).push(t);
      if (habitRows.length > 0) byPeriod['Rotina'] = habitRows;

      const tasksDone  = tasks.filter(t => t.completed).length;
      const habitsDone = habitRows.filter(h => h.completed).length;
      const total = tasks.length + habitRows.length;

      return text(JSON.stringify({
        date: today,
        summary: `${tasksDone + habitsDone}/${total} completed`,
        tasks: `${tasksDone}/${tasks.length}`,
        habits: `${habitsDone}/${habitRows.length}`,
        byPeriod,
      }, null, 2));
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
          select: 'id,text,period,completed,priority,type,completed_at,timer_total_ms',
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
      priority: z.enum(['money', 'cliente', 'vida', 'manut', 'urgent', 'important', 'simple']).optional().describe('Priority ID — use money/cliente/vida/manut for new tasks'),
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
    'Mark a task as complete or reopen it by UUID. Prefer flowly_complete_by_text when you only know the name.',
    {
      id:        z.string().describe('Task UUID'),
      completed: z.boolean().default(true),
    },
    async ({ id, completed }) => {
      const result = await db('PATCH', `tasks?id=eq.${id}`, {}, {
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      });
      const rows = Array.isArray(result) ? result : (result ? [result] : []);
      if (rows.length === 0) return text(`No task found with id=${id}. Use flowly_search_tasks to find the correct UUID.`);
      return text(`✓ "${rows[0].text}" → ${completed ? 'completed' : 'reopened'}`);
    }
  );

  server.tool(
    'flowly_complete_by_text',
    'Complete (or reopen) a task by name — no UUID needed. Finds best text match for today or a given date.',
    {
      text:      z.string().describe('Task name or partial name (case-insensitive)'),
      day:       z.string().optional().describe('Date YYYY-MM-DD — defaults to today'),
      completed: z.boolean().default(true),
    },
    async ({ text: query, day, completed }) => {
      const target = day || localDate();
      const tasks = await db('GET', 'tasks', {
        day:    `eq.${target}`,
        text:   `ilike.*${query}*`,
        select: 'id,text,period,completed',
        limit:  '5',
      });
      if (!tasks || tasks.length === 0) {
        return text(`No task matching "${query}" found on ${target}. Try flowly_search_tasks for other dates.`);
      }
      // Prefer exact or closest match
      const best = tasks.find(t => t.text.toLowerCase() === query.toLowerCase()) || tasks[0];
      if (best.completed === completed) {
        return text(`"${best.text}" already ${completed ? 'completed' : 'pending'} — no change.`);
      }
      await db('PATCH', `tasks?id=eq.${best.id}`, {}, {
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      });
      if (tasks.length > 1) {
        const others = tasks.slice(1).map(t => `"${t.text}"`).join(', ');
        return text(`✓ "${best.text}" → ${completed ? 'completed' : 'reopened'}.\nOther matches ignored: ${others}`);
      }
      return text(`✓ "${best.text}" → ${completed ? 'completed' : 'reopened'}`);
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
        select: 'id,text,day,period,completed,priority,type,completed_at,timer_total_ms,created_at',
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

  // ── History — last N days ──────────────────────────────────────────────────
  server.tool(
    'flowly_history',
    'Completion rate for each of the last N days (default 30). Shows daily trends and patterns.',
    { days: z.number().optional().default(30).describe('Number of past days to show') },
    async ({ days }) => {
      const n = Math.min(days ?? 30, 90);
      const result = [];
      for (let i = n - 1; i >= 0; i--) {
        const d = localDate(-i);
        const tasks = await db('GET', 'tasks', { day: `eq.${d}`, select: 'completed,type,priority' });
        const done = tasks.filter(t => t.completed).length;
        result.push({
          date: d,
          total: tasks.length,
          completed: done,
          rate: tasks.length > 0 ? Math.round(done / tasks.length * 100) : null,
        });
      }
      const active = result.filter(d => d.total > 0);
      const avgRate = active.length > 0
        ? Math.round(active.reduce((s, d) => s + d.rate, 0) / active.length)
        : 0;
      const perfectDays = active.filter(d => d.rate === 100).length;
      return text(JSON.stringify({ summary: { activeDays: active.length, avgRate: `${avgRate}%`, perfectDays }, days: result }, null, 2));
    }
  );

  // ── Breakdown by type ──────────────────────────────────────────────────────
  server.tool(
    'flowly_by_type',
    'Task completion breakdown by type (MONEY/BODY/MIND/SPIRIT/OPERATIONAL) for the last 30 days',
    {},
    async () => {
      const dates = Array.from({ length: 30 }, (_, i) => localDate(-i));
      const allTasks = [];
      for (const d of dates) {
        const t = await db('GET', 'tasks', { day: `eq.${d}`, select: 'completed,type,priority,text' });
        allTasks.push(...t);
      }
      const byType = {};
      for (const t of allTasks) {
        const key = t.type || 'SEM_TIPO';
        if (!byType[key]) byType[key] = { total: 0, completed: 0 };
        byType[key].total++;
        if (t.completed) byType[key].completed++;
      }
      const result = Object.entries(byType)
        .map(([type, s]) => ({ type, ...s, rate: s.total > 0 ? `${Math.round(s.completed / s.total * 100)}%` : '—' }))
        .sort((a, b) => b.total - a.total);
      return text(JSON.stringify(result, null, 2));
    }
  );

  // ── Breakdown by priority ──────────────────────────────────────────────────
  server.tool(
    'flowly_by_priority',
    'Task completion breakdown by priority (money/urgent/important/simple) for the last 30 days',
    {},
    async () => {
      const dates = Array.from({ length: 30 }, (_, i) => localDate(-i));
      const allTasks = [];
      for (const d of dates) {
        const t = await db('GET', 'tasks', { day: `eq.${d}`, select: 'completed,priority,text' });
        allTasks.push(...t);
      }
      const byPrio = {};
      for (const t of allTasks) {
        const key = t.priority || 'SEM_PRIORIDADE';
        if (!byPrio[key]) byPrio[key] = { total: 0, completed: 0 };
        byPrio[key].total++;
        if (t.completed) byPrio[key].completed++;
      }
      const order = ['money', 'urgent', 'important', 'simple', 'SEM_PRIORIDADE'];
      const result = Object.entries(byPrio)
        .map(([priority, s]) => ({ priority, ...s, rate: s.total > 0 ? `${Math.round(s.completed / s.total * 100)}%` : '—' }))
        .sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
      return text(JSON.stringify(result, null, 2));
    }
  );

  // ── Timer / time tracking ──────────────────────────────────────────────────
  server.tool(
    'flowly_timers',
    'Time tracking data — tasks with tracked time, total hours, top time-consuming tasks',
    { days: z.number().optional().default(30).describe('Number of past days') },
    async ({ days }) => {
      const n = Math.min(days ?? 30, 90);
      const dates = Array.from({ length: n }, (_, i) => localDate(-i));
      const allTasks = [];
      for (const d of dates) {
        const t = await db('GET', 'tasks', {
          day: `eq.${d}`,
          select: 'text,day,timer_total_ms,timer_sessions_count,completed,type',
          timer_total_ms: 'gt.0',
        });
        allTasks.push(...t);
      }
      const totalMs = allTasks.reduce((s, t) => s + (t.timer_total_ms || 0), 0);
      const fmtHrs = ms => `${(ms / 3600000).toFixed(1)}h`;
      const top = allTasks
        .sort((a, b) => (b.timer_total_ms || 0) - (a.timer_total_ms || 0))
        .slice(0, 10)
        .map(t => ({ text: t.text, day: t.day, time: fmtHrs(t.timer_total_ms), sessions: t.timer_sessions_count, type: t.type }));
      return text(JSON.stringify({
        totalTracked: fmtHrs(totalMs),
        tasksWithTimer: allTasks.length,
        avgPerTask: allTasks.length > 0 ? fmtHrs(totalMs / allTasks.length) : '0h',
        top10: top,
      }, null, 2));
    }
  );

  // ── Overdue ────────────────────────────────────────────────────────────────
  server.tool(
    'flowly_overdue',
    'Incomplete tasks from past days (not just this week) — tasks left behind',
    { days: z.number().optional().default(14).describe('How many past days to look back') },
    async ({ days }) => {
      const n = Math.min(days ?? 14, 60);
      const today = localDate();
      const overdue = [];
      for (let i = 1; i <= n; i++) {
        const d = localDate(-i);
        const tasks = await db('GET', 'tasks', {
          day: `eq.${d}`,
          completed: 'eq.false',
          is_habit: 'eq.false',
          select: 'id,text,day,period,priority,type',
        });
        overdue.push(...tasks);
      }
      const byPriority = { money: [], urgent: [], important: [], simple: [], other: [] };
      for (const t of overdue) {
        const k = byPriority[t.priority] ? t.priority : 'other';
        byPriority[k].push(t);
      }
      return text(JSON.stringify({ total: overdue.length, byPriority }, null, 2));
    }
  );

  // ── Finance ────────────────────────────────────────────────────────────────
  server.tool(
    'flowly_finance',
    'Finance summary — income, expenses, balance and top categories for a given month',
    { month: z.string().optional().describe('YYYY-MM format, defaults to current month') },
    async ({ month }) => {
      const now = new Date();
      const m = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const [y, mo] = m.split('-');
      const start = `${y}-${mo}-01`;
      const endDate = new Date(Number(y), Number(mo), 0);
      const end = `${y}-${mo}-${String(endDate.getDate()).padStart(2, '0')}`;

      const transactions = await db('GET', 'finance_transactions', {
        occurred_on: `gte.${start}`,
        select: 'entry_type,amount,description,category,occurred_on',
        order: 'occurred_on.desc',
        limit: '200',
      }).catch(() => []);

      const filtered = (transactions || []).filter(t => t.occurred_on <= end);
      const income   = filtered.filter(t => t.entry_type === 'income');
      const expenses = filtered.filter(t => t.entry_type === 'expense');
      const totalIn  = income.reduce((s, t) => s + Number(t.amount), 0);
      const totalOut = expenses.reduce((s, t) => s + Number(t.amount), 0);

      const byCat = {};
      for (const t of filtered) {
        if (!byCat[t.category]) byCat[t.category] = { income: 0, expense: 0 };
        if (t.entry_type === 'income') byCat[t.category].income += Number(t.amount);
        else byCat[t.category].expense += Number(t.amount);
      }
      const categories = Object.entries(byCat)
        .map(([cat, v]) => ({ category: cat, ...v }))
        .sort((a, b) => (b.income + b.expense) - (a.income + a.expense));

      const fmt = n => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      return text(JSON.stringify({
        month: m,
        income: fmt(totalIn),
        expenses: fmt(totalOut),
        balance: fmt(totalIn - totalOut),
        transactions: filtered.length,
        categories,
      }, null, 2));
    }
  );

  // ── Productivity patterns ──────────────────────────────────────────────────
  server.tool(
    'flowly_patterns',
    'Productivity patterns — best day of week, best time period, completion streaks, 30-day trend',
    {},
    async () => {
      const days30 = Array.from({ length: 30 }, (_, i) => localDate(-i));
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const byDow = Array.from({ length: 7 }, () => ({ total: 0, completed: 0, days: 0 }));
      const byPeriod = {};
      let streak = 0;
      let maxStreak = 0;
      let curStreak = 0;

      for (const d of days30) {
        const tasks = await db('GET', 'tasks', { day: `eq.${d}`, select: 'completed,period' });
        if (tasks.length === 0) continue;
        const dow = new Date(d + 'T12:00:00').getDay();
        byDow[dow].total += tasks.length;
        byDow[dow].completed += tasks.filter(t => t.completed).length;
        byDow[dow].days++;
        for (const t of tasks) {
          const p = t.period || 'Sem período';
          if (!byPeriod[p]) byPeriod[p] = { total: 0, completed: 0 };
          byPeriod[p].total++;
          if (t.completed) byPeriod[p].completed++;
        }
        const rate = Math.round(tasks.filter(t => t.completed).length / tasks.length * 100);
        if (rate >= 50) { curStreak++; maxStreak = Math.max(maxStreak, curStreak); }
        else curStreak = 0;
      }
      streak = curStreak;

      const dowStats = byDow.map((s, i) => ({
        day: dayNames[i],
        avgRate: s.days > 0 ? `${Math.round(s.completed / s.total * 100)}%` : '—',
        activeDays: s.days,
      }));
      const periodStats = Object.entries(byPeriod).map(([period, s]) => ({
        period,
        total: s.total,
        rate: `${Math.round(s.completed / s.total * 100)}%`,
      })).sort((a, b) => b.total - a.total);

      return text(JSON.stringify({
        currentStreak: `${streak} dias`,
        maxStreak30d: `${maxStreak} dias`,
        byDayOfWeek: dowStats,
        byPeriod: periodStats,
      }, null, 2));
    }
  );

  // ── Timeline ──────────────────────────────────────────────────────────────
  server.tool(
    'flowly_timeline',
    'Show chronological task activity for a day — when each task was created, completed, and how long it took. Reveals your actual work rhythm.',
    {
      day: z.string().optional().describe('Date YYYY-MM-DD — defaults to today'),
    },
    async ({ day }) => {
      const target = day || localDate();
      const tasks = await db('GET', 'tasks', {
        day: `eq.${target}`,
        select: 'id,text,period,completed,priority,type,completed_at,timer_total_ms,timer_sessions_count,timer_started_at,timer_last_stopped_at,created_at',
        order: 'completed_at.asc.nullslast',
      });

      const fmtTime = (iso) => {
        if (!iso) return null;
        const tz = process.env.FLOWLY_TIMEZONE || 'America/Sao_Paulo';
        return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
      };
      const fmtDuration = (ms) => {
        if (!ms || ms < 1000) return null;
        const m = Math.round(ms / 60000);
        return m < 60 ? `${m}min` : `${Math.floor(m/60)}h${m%60 > 0 ? `${m%60}min` : ''}`;
      };

      const timeline = tasks.map(t => ({
        text: t.text,
        period: t.period,
        priority: t.priority || null,
        completed: t.completed,
        completed_at: fmtTime(t.completed_at),
        timer: fmtDuration(t.timer_total_ms),
        timer_sessions: t.timer_sessions_count || 0,
        created_at: fmtTime(t.created_at),
      }));

      const completedTasks = timeline.filter(t => t.completed && t.completed_at);
      const withTimer = timeline.filter(t => t.timer);
      const totalTrackedMs = tasks.reduce((s, t) => s + (t.timer_total_ms || 0), 0);

      return text(JSON.stringify({
        date: target,
        summary: {
          total: tasks.length,
          completed: tasks.filter(t => t.completed).length,
          total_tracked_time: fmtDuration(totalTrackedMs),
          tasks_with_timer: withTimer.length,
        },
        timeline,
      }, null, 2));
    }
  );

  // ── Update task ────────────────────────────────────────────────────────────
  server.tool(
    'flowly_update_task',
    'Edit an existing task — change text, priority, type, period or date. Pass only the fields to change.',
    {
      id:       z.string().describe('Task UUID (from search or today/week results)'),
      text:     z.string().optional().describe('New task description'),
      priority: z.enum(['money', 'cliente', 'vida', 'manut', 'urgent', 'important', 'simple']).nullable().optional().describe('New priority ID, or null to clear'),
      type:     z.enum(['MONEY', 'BODY', 'MIND', 'SPIRIT', 'OPERATIONAL']).nullable().optional(),
      period:   z.enum(['Manhã', 'Tarde', 'Noite', 'Rotina']).optional().describe('Move to different time period on same day'),
      day:      z.string().optional().describe('Move to different date YYYY-MM-DD'),
    },
    async ({ id, text: newText, priority, type, period, day }) => {
      const patch = {};
      if (newText   !== undefined) patch.text     = newText;
      if (priority  !== undefined) patch.priority = priority;
      if (type      !== undefined) patch.type     = type;
      if (period    !== undefined) patch.period   = period;
      if (day       !== undefined) patch.day      = day;
      if (Object.keys(patch).length === 0) return text('Nothing to update — pass at least one field.');
      patch.updated_at = new Date().toISOString();
      await db('PATCH', `tasks?id=eq.${id}`, {}, patch);
      return text(`Task ${id} updated: ${JSON.stringify(patch)}`);
    }
  );

  // ── Move task ─────────────────────────────────────────────────────────────
  server.tool(
    'flowly_move_task',
    'Move a task to a different date and/or period. Shorthand for the most common rescheduling action.',
    {
      id:     z.string().describe('Task UUID'),
      day:    z.string().optional().describe('Target date YYYY-MM-DD. Omit to keep same day.'),
      period: z.enum(['Manhã', 'Tarde', 'Noite', 'Rotina']).optional().describe('Target period. Omit to keep same period.'),
    },
    async ({ id, day, period }) => {
      if (!day && !period) return text('Provide day and/or period to move the task.');
      const patch = { updated_at: new Date().toISOString() };
      if (day)    patch.day    = day;
      if (period) patch.period = period;
      await db('PATCH', `tasks?id=eq.${id}`, {}, patch);
      const where = [day && `day → ${day}`, period && `period → ${period}`].filter(Boolean).join(', ');
      return text(`Task ${id} moved: ${where}`);
    }
  );

  // ── Delete task ───────────────────────────────────────────────────────────
  server.tool(
    'flowly_delete_task',
    'Permanently delete a task. Use with care — cannot be undone.',
    {
      id: z.string().describe('Task UUID'),
    },
    async ({ id }) => {
      await db('DELETE', `tasks?id=eq.${id}`, {});
      return text(`Task ${id} deleted.`);
    }
  );

  // ── Habits ────────────────────────────────────────────────────────────────
  server.tool(
    'flowly_habits',
    'List all habit tasks with their completion status for a given date. Habits are recurring routines stored separately from regular tasks — use this tool to see them.',
    {
      date: z.string().optional().describe('Date YYYY-MM-DD — defaults to today'),
    },
    async ({ date }) => {
      const target = date || localDate();
      const habits = await fetchHabitsForDate(target);
      const done = habits.filter(h => h.completed).length;
      return text(JSON.stringify({
        date: target,
        summary: `${done}/${habits.length} habits completed`,
        habits,
      }, null, 2));
    }
  );

  // ── Complete / uncomplete a habit ─────────────────────────────────────────
  server.tool(
    'flowly_complete_habit',
    'Mark a habit as completed or uncompleted for a given date. Use flowly_habits to see available habits.',
    {
      habit_name: z.string().describe('Habit text — exact or partial match (case-insensitive)'),
      date:       z.string().optional().describe('Date YYYY-MM-DD — defaults to today'),
      completed:  z.boolean().default(true).describe('true = mark done, false = undo'),
    },
    async ({ habit_name, date, completed }) => {
      const target = date || localDate();

      // Find the habit
      const matching = await db('GET', 'tasks', {
        day:      'eq.RECURRING',
        is_habit: 'eq.true',
        text:     `ilike.*${habit_name}*`,
        select:   'id,text',
        limit:    '5',
      });
      if (!matching || matching.length === 0) {
        return text(`No habit matching "${habit_name}". Use flowly_habits to list all habits.`);
      }
      const best = matching.find(h => h.text.toLowerCase() === habit_name.toLowerCase()) || matching[0];

      if (completed) {
        const userId = getUserId();
        const body = {
          habit_name:   best.text,
          date:         target,
          completed:    true,
          completed_at: new Date().toISOString(),
        };
        if (userId) body.user_id = userId;

        await db(
          'POST', 'habits_history',
          { on_conflict: 'user_id,habit_name,date' },
          body,
          { 'Prefer': 'resolution=merge-duplicates,return=representation' }
        );
      } else {
        await db('DELETE', 'habits_history', {
          habit_name: `eq.${best.text}`,
          date:       `eq.${target}`,
        });
      }

      const others = matching.length > 1
        ? ` (ignored similar: ${matching.slice(1).map(h => `"${h.text}"`).join(', ')})`
        : '';
      return text(`✓ "${best.text}" → ${completed ? 'completed' : 'uncompleted'} for ${target}${others}`);
    }
  );
}
