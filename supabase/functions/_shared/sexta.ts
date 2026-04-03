import { createClient } from 'npm:@supabase/supabase-js@2.48.0';

type AuthUser = {
  id: string;
  email?: string | null;
};

type TaskRow = {
  id: string;
  day: string | null;
  period: string | null;
  text: string | null;
  completed: boolean | null;
  priority: string | null;
  project_id: string | null;
  project_name: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProjectRow = {
  id: string;
  name: string | null;
  client_name: string | null;
  status: string | null;
  deadline: string | null;
  completion_date: string | null;
  is_paid: boolean | null;
  closed_value?: number | null;
  expected_value?: number | null;
};

type FinanceSettingRow = {
  monthly_goal: number | null;
};

type FinanceTransactionRow = {
  entry_type: string | null;
  amount: number | null;
  description: string | null;
  category: string | null;
  occurred_on: string | null;
  project_id: string | null;
  project_name: string | null;
  task_text: string | null;
};

type SextaProfileRow = {
  user_id: string;
  memory_notes: string | null;
  operator_rules: string | null;
  command_style: string | null;
  autonomy_mode: string | null;
};

type SextaMemoryRow = {
  id: string;
  user_id: string;
  content: string | null;
  source: string | null;
  created_at: string | null;
};

export type SextaProfile = {
  memoryNotes?: string;
  operatorRules?: string;
  commandStyle?: string;
  autonomyMode?: string;
};

export type SextaMemory = {
  id?: string;
  text: string;
  source?: string;
  createdAt?: string;
};

type ChatMessage = {
  role: string;
  content: string;
};

type ToolContext = {
  date: string;
  timezone: string;
};

type AgentRunInput = {
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;
  userId: string;
  prompt: string;
  history?: ChatMessage[];
  systemPrompt?: string;
  model?: string;
  profile?: SextaProfile | null;
  memories?: SextaMemory[];
  contextSummary?: Record<string, unknown>;
  maxSteps?: number;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

const DEFAULT_SYSTEM_PROMPT =
  'Voce e a Sexta, assistente operacional do Flowly. Responda em portugues do Brasil, com objetividade, prioridade, risco e proximo passo.';

const TOOL_DEFINITIONS = [
  { name: 'get_today_overview', description: 'Le detalhes do dia atual.', input: { focus: 'tasks|projects|finance|all' } },
  { name: 'list_tasks', description: 'Lista tarefas com filtros.', input: { scope: 'today|week|all', query: 'texto', project: 'nome ou id', completed: true } },
  { name: 'list_projects', description: 'Lista projetos ativos, atrasados, nao pagos ou todos.', input: { scope: 'active|late|unpaid|all', query: 'texto' } },
  { name: 'get_finance_summary', description: 'Resume entradas, saidas, saldo e fontes do mes.', input: { window: 'month' } },
  { name: 'list_memory', description: 'Mostra memorias persistidas.', input: {} },
  { name: 'save_memory', description: 'Salva memoria persistida.', input: { text: 'conteudo', source: 'manual|chat|sync|telegram' } },
  { name: 'forget_memory', description: 'Remove memoria por busca aproximada.', input: { query: 'trecho' } },
  { name: 'create_task', description: 'Cria tarefa no Flowly.', input: { text: 'titulo', day: 'YYYY-MM-DD', period: 'Tarefas|Manha|Tarde|Noite', priority: 'money|urgent|important|simple', project: 'nome ou id' } },
  { name: 'create_project', description: 'Cria um projeto no Flowly.', input: { name: 'nome', client: 'cliente opcional', deadline: 'YYYY-MM-DD opcional', expectedValue: 0 } },
  { name: 'add_finance_transaction', description: 'Registra entrada ou saida financeira.', input: { type: 'income|expense', amount: 0, description: 'descricao', category: 'categoria', date: 'YYYY-MM-DD opcional', project: 'nome ou id opcional' } },
  { name: 'complete_task', description: 'Conclui uma tarefa por busca textual.', input: { query: 'texto', scope: 'today|week|all' } },
  { name: 'move_task', description: 'Move uma tarefa para outra data ou coluna.', input: { query: 'texto', day: 'YYYY-MM-DD', period: 'Tarefas|Manha|Tarde|Noite', scope: 'today|week|all' } }
];

export function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: CORS_HEADERS
  });
}

export function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  return null;
}

export function getEnv(name: string, fallback = ''): string {
  const value = Deno.env.get(name) ?? fallback;
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export function createSupabaseAdminClient() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false }
  });
}

function createSupabaseAuthClient(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
    global: {
      headers: authHeader ? { Authorization: authHeader } : {}
    }
  });
}

export async function getAuthenticatedUser(req: Request): Promise<AuthUser | null> {
  const authClient = createSupabaseAuthClient(req);
  const result = await authClient.auth.getUser();
  if (result.error || !result.data?.user) return null;
  return result.data.user;
}

function safeString(value: unknown) {
  return String(value || '').trim();
}

function safeLower(value: unknown) {
  return safeString(value).toLowerCase();
}

function normalizeTextMatch(value: unknown) {
  return safeLower(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function dedupeMemories(memories: SextaMemory[]) {
  const seen = new Set<string>();
  return memories.filter((item) => {
    const key = safeLower(item.text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeSextaProfile(rawProfile: unknown): SextaProfile {
  if (!rawProfile || typeof rawProfile !== 'object') {
    return { memoryNotes: '', operatorRules: '', commandStyle: '', autonomyMode: '' };
  }
  const profile = rawProfile as Record<string, unknown>;
  return {
    memoryNotes: safeString(profile.memoryNotes),
    operatorRules: safeString(profile.operatorRules),
    commandStyle: safeString(profile.commandStyle),
    autonomyMode: safeString(profile.autonomyMode)
  };
}

function serializeProfileRow(row: SextaProfileRow | null): SextaProfile {
  return normalizeSextaProfile({
    memoryNotes: row?.memory_notes || '',
    operatorRules: row?.operator_rules || '',
    commandStyle: row?.command_style || '',
    autonomyMode: row?.autonomy_mode || ''
  });
}

function serializeMemoryRow(row: SextaMemoryRow): SextaMemory {
  return {
    id: row.id,
    text: safeString(row.content),
    source: safeString(row.source) || 'manual',
    createdAt: safeString(row.created_at) || new Date().toISOString()
  };
}

export function mergeSextaProfiles(
  serverProfile: SextaProfile | null = null,
  clientProfile: SextaProfile | null = null
) {
  const base = normalizeSextaProfile(serverProfile || {});
  const next = normalizeSextaProfile(clientProfile || {});
  return {
    memoryNotes: next.memoryNotes || base.memoryNotes || '',
    operatorRules: next.operatorRules || base.operatorRules || '',
    commandStyle: next.commandStyle || base.commandStyle || '',
    autonomyMode: next.autonomyMode || base.autonomyMode || ''
  };
}

export function mergeSextaMemories(
  serverMemories: SextaMemory[] = [],
  clientMemories: Array<SextaMemory | string> = []
) {
  const normalizedServer = Array.isArray(serverMemories)
    ? serverMemories
        .filter((item) => item && safeString(item.text))
        .map((item) => ({
          id: item.id,
          text: safeString(item.text),
          source: safeString(item.source) || 'manual',
          createdAt: safeString(item.createdAt) || new Date().toISOString()
        }))
    : [];

  const normalizedClient = Array.isArray(clientMemories)
    ? clientMemories
        .map((item) => {
          if (typeof item === 'string') {
            return {
              text: safeString(item),
              source: 'sync',
              createdAt: new Date().toISOString()
            };
          }
          return {
            id: item?.id,
            text: safeString(item?.text),
            source: safeString(item?.source) || 'sync',
            createdAt: safeString(item?.createdAt) || new Date().toISOString()
          };
        })
        .filter((item) => item.text)
    : [];

  return dedupeMemories([...normalizedServer, ...normalizedClient]).slice(-24);
}

function compactJson(value: unknown, maxLength = 3200) {
  const raw = JSON.stringify(value);
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength)}...`;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function createRuntimeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function getNowInTimezone(timezone: string) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(now);

  const pick = (type: string) => parts.find((part) => part.type === type)?.value || '00';

  return {
    dateKey: `${pick('year')}-${pick('month')}-${pick('day')}`
  };
}

async function getUserTimezone(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  const result = await supabaseAdmin
    .from('user_settings')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle();

  if (result.error) return 'America/Sao_Paulo';
  return safeString(result.data?.timezone) || 'America/Sao_Paulo';
}

function isTableMissingError(error: unknown) {
  const code = safeString((error as { code?: unknown })?.code);
  return code === '42P01';
}

export async function loadSextaAgentState(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  const [profileResult, memoriesResult] = await Promise.all([
    supabaseAdmin
      .from('sexta_profiles')
      .select('user_id, memory_notes, operator_rules, command_style, autonomy_mode')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('sexta_memories')
      .select('id, user_id, content, source, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(24)
  ]);

  if (profileResult.error && !isTableMissingError(profileResult.error)) {
    throw new Error(`Sexta profile query failed: ${profileResult.error.message}`);
  }
  if (memoriesResult.error && !isTableMissingError(memoriesResult.error)) {
    throw new Error(`Sexta memories query failed: ${memoriesResult.error.message}`);
  }

  return {
    profile: serializeProfileRow((profileResult.data || null) as SextaProfileRow | null),
    memories: ((memoriesResult.data || []) as SextaMemoryRow[])
      .map(serializeMemoryRow)
      .filter((item) => item.text)
  };
}

export async function saveSextaProfile(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  nextProfile: SextaProfile
) {
  const profile = normalizeSextaProfile(nextProfile);
  const result = await supabaseAdmin.from('sexta_profiles').upsert(
    {
      user_id: userId,
      memory_notes: profile.memoryNotes || '',
      operator_rules: profile.operatorRules || '',
      command_style: profile.commandStyle || '',
      autonomy_mode: profile.autonomyMode || '',
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id' }
  );

  if (result.error && !isTableMissingError(result.error)) {
    throw new Error(`Sexta profile write failed: ${result.error.message}`);
  }

  return profile;
}

export async function saveSextaMemory(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  text: string,
  source = 'manual'
) {
  const normalized = safeString(text);
  if (!normalized) return null;

  const existingResult = await supabaseAdmin
    .from('sexta_memories')
    .select('id, user_id, content, source, created_at')
    .eq('user_id', userId)
    .ilike('content', normalized)
    .maybeSingle();

  if (existingResult.error && !isTableMissingError(existingResult.error)) {
    throw new Error(`Sexta memory lookup failed: ${existingResult.error.message}`);
  }

  if (existingResult.data) {
    return serializeMemoryRow(existingResult.data as SextaMemoryRow);
  }

  const insertResult = await supabaseAdmin
    .from('sexta_memories')
    .insert([
      {
        user_id: userId,
        content: normalized,
        source: safeString(source) || 'manual',
        updated_at: new Date().toISOString()
      }
    ])
    .select('id, user_id, content, source, created_at')
    .single();

  if (insertResult.error && !isTableMissingError(insertResult.error)) {
    throw new Error(`Sexta memory write failed: ${insertResult.error.message}`);
  }

  return insertResult.data ? serializeMemoryRow(insertResult.data as SextaMemoryRow) : null;
}

export async function removeSextaMemory(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  query: string
) {
  const normalized = normalizeTextMatch(query);
  if (!normalized) return null;

  const memories = await loadSextaAgentState(supabaseAdmin, userId);
  const target = memories.memories.find((item) =>
    normalizeTextMatch(item.text).includes(normalized)
  );
  if (!target?.id) return null;

  const result = await supabaseAdmin.from('sexta_memories').delete().eq('id', target.id);
  if (result.error && !isTableMissingError(result.error)) {
    throw new Error(`Sexta memory delete failed: ${result.error.message}`);
  }
  return target;
}

export async function clearSextaMemories(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  const result = await supabaseAdmin.from('sexta_memories').delete().eq('user_id', userId);
  if (result.error && !isTableMissingError(result.error)) {
    throw new Error(`Sexta memories clear failed: ${result.error.message}`);
  }
}

async function syncClientStateToServer(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  clientProfile: SextaProfile | null = null,
  clientMemories: Array<SextaMemory | string> = []
) {
  const currentState = await loadSextaAgentState(supabaseAdmin, userId);
  const mergedProfile = mergeSextaProfiles(currentState.profile, clientProfile);
  const mergedMemories = mergeSextaMemories(currentState.memories, clientMemories);

  if (compactJson(currentState.profile) !== compactJson(mergedProfile)) {
    await saveSextaProfile(supabaseAdmin, userId, mergedProfile);
  }

  const serverKeys = new Set(currentState.memories.map((item) => safeLower(item.text)));
  for (const memory of mergedMemories) {
    const key = safeLower(memory.text);
    if (!key || serverKeys.has(key)) continue;
    await saveSextaMemory(supabaseAdmin, userId, memory.text, memory.source || 'sync');
    serverKeys.add(key);
  }

  return {
    profile: mergedProfile,
    memories: mergedMemories
  };
}

export async function buildSextaContextSummary(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  profile: SextaProfile | null = null,
  memories: Array<SextaMemory | string> = []
) {
  const timezone = await getUserTimezone(supabaseAdmin, userId);
  const todayDate = getNowInTimezone(timezone).dateKey;
  const weekEndDate = addDaysToDateKey(todayDate, 7);
  const monthKey = getMonthKey(todayDate);

  const [tasksRes, projectsRes, financeSettingsRes, financeTransactionsRes] = await Promise.all([
    supabaseAdmin
      .from('tasks')
      .select('id, day, period, text, completed, priority, project_id, project_name, created_at, updated_at')
      .eq('user_id', userId)
      .gte('day', todayDate)
      .lte('day', weekEndDate)
      .order('day', { ascending: true })
      .limit(180),
    supabaseAdmin
      .from('projects')
      .select('id, name, client_name, status, deadline, completion_date, is_paid, closed_value, expected_value')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(120),
    supabaseAdmin
      .from('finance_settings')
      .select('monthly_goal')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('finance_transactions')
      .select('entry_type, amount, description, category, occurred_on, project_id, project_name, task_text')
      .eq('user_id', userId)
      .gte('occurred_on', `${monthKey}-01`)
      .order('occurred_on', { ascending: false })
      .limit(120)
  ]);

  if (tasksRes.error) {
    throw new Error(`Tasks query failed: ${tasksRes.error.message}`);
  }
  if (projectsRes.error) {
    throw new Error(`Projects query failed: ${projectsRes.error.message}`);
  }
  if (financeSettingsRes.error && !isTableMissingError(financeSettingsRes.error)) {
    throw new Error(`Finance settings query failed: ${financeSettingsRes.error.message}`);
  }
  if (financeTransactionsRes.error && !isTableMissingError(financeTransactionsRes.error)) {
    throw new Error(`Finance transactions query failed: ${financeTransactionsRes.error.message}`);
  }

  const tasks = (tasksRes.data || []) as TaskRow[];
  const projects = (projectsRes.data || []) as ProjectRow[];
  const financeSettings = (financeSettingsRes.data || null) as FinanceSettingRow | null;
  const financeTransactions = (financeTransactionsRes.data || []) as FinanceTransactionRow[];
  const todayTasks = tasks.filter((task) => safeString(task.day) === todayDate && safeString(task.text));
  const pendingEntries = todayTasks.filter((task) => task.completed !== true);
  const completedEntries = todayTasks.filter((task) => task.completed === true);
  const activeProjects = projects.filter(
    (project) => !project.completion_date && safeLower(project.status || 'active') !== 'archived'
  );
  const unpaidProjects = projects.filter(
    (project) =>
      project.is_paid !== true &&
      !project.completion_date &&
      safeLower(project.status || 'active') !== 'draft' &&
      safeLower(project.status || 'active') !== 'archived'
  );
  const lateProjects = activeProjects.filter(
    (project) => project.deadline && safeString(project.deadline) < todayDate
  );
  const followupEntries = pendingEntries.filter((task) =>
    /follow|cobrar|cliente|whats|proposta|responder/i.test(safeString(task.text))
  );
  const moneyEntries = pendingEntries.filter(
    (task) =>
      safeLower(task.priority) === 'money' ||
      /cobrar|pagamento|receber|orcamento|pix|proposta/i.test(safeString(task.text))
  );
  const pendingByPeriod = pendingEntries.reduce<Record<string, number>>((acc, task) => {
    const key = safeString(task.period) || 'Tarefas';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const upcomingTasks = tasks
    .filter((task) => safeString(task.day) > todayDate && task.completed !== true && safeString(task.text))
    .slice(0, 8)
    .map((task) => ({
      id: task.id,
      day: safeString(task.day),
      period: safeString(task.period) || 'Tarefas',
      text: safeString(task.text),
      priority: safeString(task.priority) || 'default',
      project: safeString(task.project_name) || null
    }));

  const incomeTotal = financeTransactions
    .filter((item) => safeLower(item.entry_type) === 'income')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenseTotal = financeTransactions
    .filter((item) => safeLower(item.entry_type) === 'expense')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const balance = incomeTotal - expenseTotal;
  const goal = Number(financeSettings?.monthly_goal || 0);
  const topExpenseCategories = Object.entries(
    financeTransactions
      .filter((item) => safeLower(item.entry_type) === 'expense')
      .reduce<Record<string, number>>((acc, item) => {
        const key = safeString(item.category) || 'Operacional';
        acc[key] = (acc[key] || 0) + Number(item.amount || 0);
        return acc;
      }, {})
  )
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5);

  const topPending = pendingEntries.slice(0, 8).map((task) => ({
    id: task.id,
    text: safeString(task.text),
    priority: safeString(task.priority) || 'default',
    project: safeString(task.project_name) || null,
    period: safeString(task.period) || 'Tarefas'
  }));

  return {
    date: todayDate,
    timezone,
    pendingCount: pendingEntries.length,
    completedCount: completedEntries.length,
    moneyCount: moneyEntries.length,
    followupCount: followupEntries.length,
    unpaidProjects: unpaidProjects.length,
    pendingByPeriod,
    topPending,
    upcomingTasks,
    activeProjects: activeProjects.slice(0, 8).map((project) => ({
      id: project.id,
      name: safeString(project.name),
      client: safeString(project.client_name) || null,
      deadline: safeString(project.deadline) || null,
      paid: project.is_paid === true,
      expectedValue: Number(project.expected_value || 0),
      closedValue: Number(project.closed_value || 0)
    })),
    lateProjects: lateProjects.slice(0, 8).map((project) => ({
      id: project.id,
      name: safeString(project.name),
      deadline: safeString(project.deadline) || null
    })),
    finance: {
      monthKey,
      incomeTotal,
      expenseTotal,
      balance,
      goal,
      progressPct: goal > 0 ? Math.max(0, Math.min(100, Math.round((incomeTotal / goal) * 100))) : 0,
      transactionCount: financeTransactions.length,
      topExpenseCategories,
      recentTransactions: financeTransactions.slice(0, 6).map((item) => ({
        type: safeLower(item.entry_type),
        amount: Number(item.amount || 0),
        description: safeString(item.description) || safeString(item.task_text) || 'Sem descricao',
        category: safeString(item.category) || 'Geral',
        date: safeString(item.occurred_on) || todayDate,
        project: safeString(item.project_name) || null
      }))
    },
    memories: mergeSextaMemories([], memories).slice(-10).map((item) => item.text),
    profile: normalizeSextaProfile(profile || {})
  };
}

function buildProfileSummary(profile: SextaProfile | null = null) {
  const safeProfile = normalizeSextaProfile(profile || {});
  return [
    safeProfile.memoryNotes ? `Memorias fixas: ${safeProfile.memoryNotes}` : '',
    safeProfile.operatorRules ? `Regras: ${safeProfile.operatorRules}` : '',
    safeProfile.commandStyle ? `Formato: ${safeProfile.commandStyle}` : '',
    safeProfile.autonomyMode ? `Autonomia: ${safeProfile.autonomyMode}` : ''
  ]
    .filter(Boolean)
    .join(' | ');
}

export function buildManifestMessages(input: {
  prompt: string;
  history?: ChatMessage[];
  systemPrompt?: string;
  contextSummary: Record<string, unknown>;
  profile?: SextaProfile | null;
}) {
  const systemPrompt = safeString(input.systemPrompt) || DEFAULT_SYSTEM_PROMPT;
  const profileSummary = buildProfileSummary(input.profile || null);
  const systemContent = `${systemPrompt}${
    profileSummary ? `\n\nPreferencias operacionais da Sexta:\n${profileSummary}` : ''
  }\n\nContexto atual do Flowly:\n${JSON.stringify(input.contextSummary)}`;

  const history = Array.isArray(input.history)
    ? input.history
        .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
        .slice(-8)
        .map((item) => ({
          role: item.role,
          content: safeString(item.content)
        }))
        .filter((item) => item.content)
    : [];

  return [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: safeString(input.prompt) }
  ];
}

function pickMessageContent(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
          return String((part as { text: string }).text);
        }
        return '';
      })
      .join('\n')
      .trim();
  }
  return '';
}

export async function requestManifestChat(input: {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}) {
  const apiKey = getEnv('FLOWLY_MANIFEST_API_KEY');
  const baseUrl = (Deno.env.get('FLOWLY_MANIFEST_BASE_URL') || 'https://app.manifest.build').replace(
    /\/+$/,
    ''
  );
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: safeString(input.model) || Deno.env.get('FLOWLY_MANIFEST_MODEL') || 'manifest/auto',
      messages: input.messages,
      temperature: Number.isFinite(input.temperature) ? input.temperature : 0.35,
      max_tokens: Number.isFinite(input.maxTokens) ? input.maxTokens : 700
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Manifest ${response.status}: ${text.slice(0, 240)}`);
  }

  const data = await response.json();
  const reply = pickMessageContent(data?.choices?.[0]?.message?.content);
  if (!reply) {
    throw new Error('Manifest returned an empty assistant message.');
  }

  return {
    reply,
    raw: data
  };
}

function extractFirstJsonObject(text: string) {
  const trimmed = safeString(text);
  if (!trimmed) return null;
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function buildAgentSystemPrompt(input: {
  systemPrompt?: string;
  profile?: SextaProfile | null;
  contextSummary: Record<string, unknown>;
}) {
  const profileSummary = buildProfileSummary(input.profile || null);
  return [
    safeString(input.systemPrompt) || DEFAULT_SYSTEM_PROMPT,
    'Voce opera como agente da Sexta com decisao, ferramentas, memoria e loop curto.',
    'Quando precisar de dados ou de executar acao, use ferramenta. Quando ja tiver o suficiente, responda direto.',
    'Responda sempre em JSON puro, sem markdown, obedecendo exatamente um destes formatos:',
    '{"mode":"reply","reply":"texto final para o usuario"}',
    '{"mode":"tool","tool":"nome_da_ferramenta","input":{"campo":"valor"}}',
    'Ferramentas disponiveis:',
    compactJson(TOOL_DEFINITIONS, 4000),
    profileSummary ? `Perfil salvo: ${profileSummary}` : 'Perfil salvo: vazio.',
    `Contexto atual do Flowly: ${compactJson(input.contextSummary, 5000)}`
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildReplyFromToolResult(
  prompt: string,
  toolResults: Array<{ tool: string; result: unknown }>,
  contextSummary: Record<string, unknown>,
  profile: SextaProfile | null,
  systemPrompt?: string
) {
  return buildManifestMessages({
    prompt: [
      `Pedido do usuario: ${safeString(prompt)}`,
      `Resultados das ferramentas: ${compactJson(toolResults, 5000)}`,
      'Agora responda ao usuario em portugues, de forma objetiva, sem mostrar JSON.'
    ].join('\n\n'),
    systemPrompt: safeString(systemPrompt) || DEFAULT_SYSTEM_PROMPT,
    contextSummary,
    profile
  });
}

function scoreTaskMatch(task: TaskRow, query: string) {
  const normalizedQuery = normalizeTextMatch(query);
  const normalizedText = normalizeTextMatch(task.text);
  if (!normalizedQuery || !normalizedText) return -1;
  if (normalizedText === normalizedQuery) return 100;
  if (normalizedText.startsWith(normalizedQuery)) return 80;
  if (normalizedText.includes(normalizedQuery)) return 60;
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  const matchedWords = words.filter((word) => normalizedText.includes(word)).length;
  return matchedWords > 0 ? matchedWords * 10 : -1;
}

async function fetchTasksForScope(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  context: ToolContext,
  scope = 'today'
) {
  let query = supabaseAdmin
    .from('tasks')
    .select('id, day, period, text, completed, priority, project_id, project_name, created_at, updated_at')
    .eq('user_id', userId)
    .order('day', { ascending: true })
    .limit(scope === 'all' ? 200 : 120);

  if (scope === 'today') {
    query = query.eq('day', context.date);
  } else if (scope === 'week') {
    query = query.gte('day', context.date).lte('day', addDaysToDateKey(context.date, 7));
  }

  const result = await query;
  if (result.error) {
    throw new Error(`Tasks tool query failed: ${result.error.message}`);
  }
  return (result.data || []) as TaskRow[];
}

async function resolveProjectReference(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  projectRef: string
) {
  const normalized = normalizeTextMatch(projectRef);
  if (!normalized) return null;
  const result = await supabaseAdmin
    .from('projects')
    .select('id, name, client_name, status, deadline, completion_date, is_paid')
    .eq('user_id', userId)
    .limit(80);
  if (result.error) {
    throw new Error(`Project lookup failed: ${result.error.message}`);
  }
  const projects = (result.data || []) as ProjectRow[];
  return (
    projects.find(
      (project) =>
        project.id === projectRef ||
        normalizeTextMatch(project.name).includes(normalized) ||
        normalizeTextMatch(project.client_name).includes(normalized)
    ) || null
  );
}

async function executeSextaTool(input: {
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;
  userId: string;
  tool: string;
  toolInput?: Record<string, unknown>;
  contextSummary: Record<string, unknown>;
  profile?: SextaProfile | null;
  memories?: SextaMemory[];
}) {
  const supabaseAdmin = input.supabaseAdmin;
  const userId = input.userId;
  const tool = safeString(input.tool);
  const toolInput = input.toolInput || {};
  const context = {
    date: safeString(input.contextSummary.date),
    timezone: safeString(input.contextSummary.timezone) || 'America/Sao_Paulo'
  };

  if (tool === 'get_today_overview') {
    return {
      date: context.date,
      pendingCount: Number(input.contextSummary.pendingCount || 0),
      completedCount: Number(input.contextSummary.completedCount || 0),
      pendingByPeriod: input.contextSummary.pendingByPeriod || {},
      topPending: input.contextSummary.topPending || [],
      lateProjects: input.contextSummary.lateProjects || [],
      finance: input.contextSummary.finance || {}
    };
  }

  if (tool === 'list_tasks') {
    const scope = safeLower(toolInput.scope) || 'today';
    const query = safeString(toolInput.query);
    const projectRef = safeString(toolInput.project);
    const rows = await fetchTasksForScope(supabaseAdmin, userId, context, scope);
    const project = projectRef ? await resolveProjectReference(supabaseAdmin, userId, projectRef) : null;
    const filtered = rows
      .filter((task) => {
        if (safeString(task.text) === '') return false;
        if (typeof toolInput.completed === 'boolean' && task.completed !== toolInput.completed) return false;
        if (project && task.project_id !== project.id) return false;
        if (query && scoreTaskMatch(task, query) < 0) return false;
        return true;
      })
      .sort((a, b) => scoreTaskMatch(b, query) - scoreTaskMatch(a, query))
      .slice(0, 20)
      .map((task) => ({
        id: task.id,
        day: safeString(task.day),
        period: safeString(task.period) || 'Tarefas',
        text: safeString(task.text),
        completed: task.completed === true,
        priority: safeString(task.priority) || 'default',
        project: safeString(task.project_name) || null
      }));
    return {
      scope,
      count: filtered.length,
      tasks: filtered
    };
  }

  if (tool === 'list_projects') {
    const scope = safeLower(toolInput.scope) || 'active';
    const query = safeString(toolInput.query);
    const result = await supabaseAdmin
      .from('projects')
      .select('id, name, client_name, status, deadline, completion_date, is_paid, expected_value, closed_value')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(80);
    if (result.error) {
      throw new Error(`Projects tool query failed: ${result.error.message}`);
    }
    const projects = (result.data || []) as ProjectRow[];
    const filtered = projects
      .filter((project) => {
        const isActive =
          !project.completion_date && safeLower(project.status || 'active') !== 'archived';
        const isLate = Boolean(project.deadline) && safeString(project.deadline) < context.date && isActive;
        const isUnpaid = project.is_paid !== true && isActive;
        if (scope === 'active' && !isActive) return false;
        if (scope === 'late' && !isLate) return false;
        if (scope === 'unpaid' && !isUnpaid) return false;
        if (
          query &&
          !normalizeTextMatch(project.name).includes(normalizeTextMatch(query)) &&
          !normalizeTextMatch(project.client_name).includes(normalizeTextMatch(query))
        ) {
          return false;
        }
        return true;
      })
      .slice(0, 20)
      .map((project) => ({
        id: project.id,
        name: safeString(project.name),
        client: safeString(project.client_name) || null,
        status: safeString(project.status) || 'active',
        deadline: safeString(project.deadline) || null,
        completionDate: safeString(project.completion_date) || null,
        paid: project.is_paid === true,
        expectedValue: Number(project.expected_value || 0),
        closedValue: Number(project.closed_value || 0)
      }));
    return {
      scope,
      count: filtered.length,
      projects: filtered
    };
  }

  if (tool === 'get_finance_summary') {
    return input.contextSummary.finance || {};
  }

  if (tool === 'list_memory') {
    return {
      count: Array.isArray(input.memories) ? input.memories.length : 0,
      memories: (input.memories || []).slice(-12).map((item) => ({
        text: item.text,
        source: item.source || 'manual',
        createdAt: item.createdAt || ''
      }))
    };
  }

  if (tool === 'save_memory') {
    const memory = await saveSextaMemory(
      supabaseAdmin,
      userId,
      safeString(toolInput.text),
      safeString(toolInput.source) || 'manual'
    );
    return {
      saved: Boolean(memory),
      memory
    };
  }

  if (tool === 'forget_memory') {
    const removed = await removeSextaMemory(supabaseAdmin, userId, safeString(toolInput.query));
    return {
      removed: Boolean(removed),
      memory: removed
    };
  }

  if (tool === 'create_task') {
    const text = safeString(toolInput.text);
    if (!text) throw new Error('create_task needs text.');
    const project = safeString(toolInput.project)
      ? await resolveProjectReference(supabaseAdmin, userId, safeString(toolInput.project))
      : null;
    const payload = {
      user_id: userId,
      day: safeString(toolInput.day) || context.date,
      period: safeString(toolInput.period) || 'Tarefas',
      text,
      completed: false,
      priority: safeString(toolInput.priority) || 'default',
      project_id: project?.id || null,
      project_name: safeString(project?.name) || null,
      updated_at: new Date().toISOString()
    };
    const result = await supabaseAdmin
      .from('tasks')
      .insert([payload])
      .select('id, day, period, text, priority, project_id, project_name')
      .single();
    if (result.error) {
      throw new Error(`Task create failed: ${result.error.message}`);
    }
    return {
      created: true,
      task: result.data
    };
  }

  if (tool === 'create_project') {
    const name = safeString(toolInput.name);
    if (!name) throw new Error('create_project needs name.');
    const payload = {
      id: createRuntimeId('proj'),
      user_id: userId,
      name,
      client_name: safeString(toolInput.client) || null,
      status: 'active',
      deadline: safeString(toolInput.deadline) || null,
      expected_value: Number(toolInput.expectedValue || 0) || 0,
      closed_value: 0,
      notes: safeString(toolInput.notes) || null,
      updated_at: new Date().toISOString()
    };
    const result = await supabaseAdmin
      .from('projects')
      .insert([payload])
      .select('id, name, client_name, deadline, status, expected_value')
      .single();
    if (result.error) {
      throw new Error(`Project create failed: ${result.error.message}`);
    }
    return {
      created: true,
      project: result.data
    };
  }

  if (tool === 'add_finance_transaction') {
    const entryType = safeLower(toolInput.type) === 'expense' ? 'expense' : 'income';
    const amount = Number(toolInput.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('add_finance_transaction needs amount > 0.');
    }
    const project = safeString(toolInput.project)
      ? await resolveProjectReference(supabaseAdmin, userId, safeString(toolInput.project))
      : null;
    const payload = {
      id: createRuntimeId('txn'),
      user_id: userId,
      entry_type: entryType,
      amount,
      description: safeString(toolInput.description) || 'Lancamento Sexta',
      category: safeString(toolInput.category) || (entryType === 'expense' ? 'Operacional' : 'Receita'),
      occurred_on: safeString(toolInput.date) || context.date,
      source: 'sexta-agent',
      project_id: project?.id || null,
      project_name: safeString(project?.name) || null,
      notes: safeString(toolInput.notes) || null,
      updated_at: new Date().toISOString()
    };
    const result = await supabaseAdmin
      .from('finance_transactions')
      .insert([payload])
      .select('id, entry_type, amount, description, category, occurred_on, project_name')
      .single();
    if (result.error) {
      throw new Error(`Finance transaction create failed: ${result.error.message}`);
    }
    return {
      created: true,
      transaction: result.data
    };
  }

  if (tool === 'complete_task' || tool === 'move_task') {
    const query = safeString(toolInput.query);
    if (!query) throw new Error(`${tool} needs query.`);
    const scope = safeLower(toolInput.scope) || 'today';
    const rows = await fetchTasksForScope(supabaseAdmin, userId, context, scope);
    const candidates = rows
      .filter((task) => safeString(task.text) && (tool === 'move_task' || task.completed !== true))
      .map((task) => ({ task, score: scoreTaskMatch(task, query) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score);
    const target = candidates[0]?.task || null;
    if (!target) {
      return { updated: false, reason: 'task_not_found' };
    }
    if (tool === 'complete_task') {
      const result = await supabaseAdmin
        .from('tasks')
        .update({ completed: true, updated_at: new Date().toISOString() })
        .eq('id', target.id);
      if (result.error) throw new Error(`Task complete failed: ${result.error.message}`);
      return {
        updated: true,
        task: {
          id: target.id,
          text: safeString(target.text),
          day: safeString(target.day),
          period: safeString(target.period) || 'Tarefas'
        }
      };
    }
    const result = await supabaseAdmin
      .from('tasks')
      .update({
        day: safeString(toolInput.day) || context.date,
        period: safeString(toolInput.period) || safeString(target.period) || 'Tarefas',
        updated_at: new Date().toISOString()
      })
      .eq('id', target.id);
    if (result.error) throw new Error(`Task move failed: ${result.error.message}`);
    return {
      updated: true,
      task: {
        id: target.id,
        text: safeString(target.text),
        day: safeString(toolInput.day) || context.date,
        period: safeString(toolInput.period) || safeString(target.period) || 'Tarefas'
      }
    };
  }

  throw new Error(`Unknown Sexta tool: ${tool}`);
}

export async function runSextaAgentLoop(input: AgentRunInput) {
  const supabaseAdmin = input.supabaseAdmin;
  const userId = input.userId;
  const syncedState = await syncClientStateToServer(
    supabaseAdmin,
    userId,
    normalizeSextaProfile(input.profile || {}),
    input.memories || []
  );
  let contextSummary = await buildSextaContextSummary(
    supabaseAdmin,
    userId,
    syncedState.profile,
    syncedState.memories
  );
  let currentMemories = syncedState.memories;
  const plannerMessages: Array<{ role: string; content: string }> = [
    {
      role: 'system',
      content: buildAgentSystemPrompt({
        systemPrompt: input.systemPrompt,
        profile: syncedState.profile,
        contextSummary
      })
    },
    ...(Array.isArray(input.history)
      ? input.history
          .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
          .slice(-6)
          .map((item) => ({ role: item.role, content: safeString(item.content) }))
      : []),
    { role: 'user', content: safeString(input.prompt) }
  ];
  const toolResults: Array<{ tool: string; result: unknown }> = [];
  const maxSteps = Math.max(1, Math.min(4, Number(input.maxSteps || 3)));

  for (let step = 0; step < maxSteps; step += 1) {
    const planner = await requestManifestChat({
      messages: plannerMessages,
      model: safeString(input.model) || 'manifest/auto',
      temperature: 0.2,
      maxTokens: 500
    });
    const parsed = extractFirstJsonObject(planner.reply);
    if (!parsed || typeof parsed !== 'object') break;
    const mode = safeLower((parsed as { mode?: unknown }).mode);
    if (mode === 'reply') {
      const reply = safeString((parsed as { reply?: unknown }).reply);
      if (reply) {
        return {
          reply,
          state: { profile: syncedState.profile, memories: currentMemories },
          toolResults
        };
      }
      break;
    }
    if (mode !== 'tool') break;
    const tool = safeString((parsed as { tool?: unknown }).tool);
    const toolInput =
      parsed && typeof parsed === 'object' && typeof (parsed as { input?: unknown }).input === 'object'
        ? ((parsed as { input?: Record<string, unknown> }).input || {})
        : {};
    const result = await executeSextaTool({
      supabaseAdmin,
      userId,
      tool,
      toolInput,
      contextSummary,
      profile: syncedState.profile,
      memories: currentMemories
    });
    toolResults.push({ tool, result });
    if (tool === 'save_memory' || tool === 'forget_memory') {
      const state = await loadSextaAgentState(supabaseAdmin, userId);
      currentMemories = state.memories;
    }
    if (
      tool === 'create_task' ||
      tool === 'complete_task' ||
      tool === 'move_task' ||
      tool === 'create_project' ||
      tool === 'add_finance_transaction'
    ) {
      contextSummary = await buildSextaContextSummary(
        supabaseAdmin,
        userId,
        syncedState.profile,
        currentMemories
      );
    }
    plannerMessages.push({ role: 'assistant', content: planner.reply });
    plannerMessages.push({
      role: 'user',
      content: `Resultado da ferramenta ${tool}: ${compactJson(result, 4500)}. Decida o proximo passo e responda em JSON puro.`
    });
  }

  const fallback = await requestManifestChat({
    messages: buildReplyFromToolResult(
      input.prompt,
      toolResults,
      contextSummary,
      syncedState.profile,
      input.systemPrompt
    ),
    model: safeString(input.model) || 'manifest/auto',
    temperature: 0.35,
    maxTokens: 700
  });

  return {
    reply: fallback.reply,
    state: { profile: syncedState.profile, memories: currentMemories },
    toolResults
  };
}

export function createTelegramLinkCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(bytes, (value) => (value % 36).toString(36))
    .join('')
    .toUpperCase();
}

export function getTelegramLinkExpiry(minutes = 15) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export function maskTelegramChatId(chatId: string | number | null | undefined) {
  const digits = safeString(chatId);
  if (!digits) return '';
  if (digits.length <= 4) return digits;
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export async function callTelegramApi(method: string, payload: Record<string, unknown>) {
  const token = getEnv('FLOWLY_TELEGRAM_BOT_TOKEN');
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || data?.ok !== true) {
    throw new Error(`Telegram ${method} failed: ${data?.description || response.status}`);
  }
  return data.result;
}
