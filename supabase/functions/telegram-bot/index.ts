import {
  buildSextaContextSummary,
  callTelegramApi,
  createSupabaseAdminClient,
  handleCors,
  jsonResponse,
  loadSextaAgentState,
  runSextaAgentLoop
} from '../_shared/sexta.ts';

type TelegramMessage = {
  message?: {
    text?: string;
    chat?: { id?: number };
    from?: {
      id?: number;
      username?: string;
      first_name?: string;
    };
  };
};

type LinkedConnection = {
  user_id: string;
  telegram_chat_id: string | null;
};

const DEFAULT_SYSTEM_PROMPT =
  'Voce e a Sexta, assistente operacional do Flowly. Responda curto, pratico, com foco em prioridade, risco e proximo passo.';

async function sendTelegramMessage(chatId: number, text: string) {
  const safeText = String(text || '').trim().slice(0, 3900);
  if (!safeText) return;
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: safeText
  });
}

async function fetchConnectionByCode(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  code: string
) {
  const result = await supabaseAdmin
    .from('telegram_connections')
    .select('user_id, link_code_expires_at')
    .eq('link_code', code)
    .maybeSingle();

  if (result.error) {
    throw new Error(`Telegram code lookup failed: ${result.error.message}`);
  }

  return result.data || null;
}

async function fetchConnectionByChat(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  chatId: number
) {
  const result = await supabaseAdmin
    .from('telegram_connections')
    .select('user_id, telegram_chat_id')
    .eq('telegram_chat_id', String(chatId))
    .eq('is_active', true)
    .maybeSingle();

  if (result.error) {
    throw new Error(`Telegram chat lookup failed: ${result.error.message}`);
  }

  return (result.data || null) as LinkedConnection | null;
}

function isFutureIso(value: string | null | undefined) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function buildTelegramFallback(contextSummary: Record<string, unknown>) {
  const moneyCount = Number(contextSummary.moneyCount || 0);
  const pendingCount = Number(contextSummary.pendingCount || 0);
  const followupCount = Number(contextSummary.followupCount || 0);
  if (moneyCount > 0) {
    return 'Minha leitura: ataca primeiro a tarefa que puxa caixa. Fecha esse ciclo antes de abrir outra frente.';
  }
  if (followupCount > 0) {
    return 'Tem follow-up aberto pedindo resposta. Eu resolveria isso antes de reorganizar o resto da fila.';
  }
  if (pendingCount > 0) {
    return `Voce ainda tem ${pendingCount} pendencia(s) hoje. Escolhe uma frente e fecha inteira antes de trocar.`;
  }
  return 'Hoje esta mais limpo. Mantem foco curto e evita abrir frente nova sem necessidade.';
}

function normalizeTelegramHistory(text: string) {
  const normalized = String(text || '').trim();
  return normalized ? [{ role: 'user', content: normalized }] : [];
}

async function handleLinkCommand(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  chatId: number,
  rawText: string,
  from: { id?: number; username?: string; first_name?: string } | undefined
) {
  const match = rawText.match(/^\/(?:start|link)(?:@\w+)?\s+([A-Z0-9]+)/i);
  if (!match) return false;

  const code = String(match[1] || '').trim().toUpperCase();
  const connection = await fetchConnectionByCode(supabaseAdmin, code);
  if (!connection || !isFutureIso(connection.link_code_expires_at)) {
    await sendTelegramMessage(
      chatId,
      'Codigo invalido ou expirado. Gere um novo em Ajustes > IA dentro do Flowly.'
    );
    return true;
  }

  const result = await supabaseAdmin
    .from('telegram_connections')
    .update({
      telegram_chat_id: String(chatId),
      telegram_user_id: from?.id ? String(from.id) : null,
      telegram_username: from?.username || null,
      telegram_first_name: from?.first_name || null,
      linked_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      link_code: null,
      link_code_expires_at: null,
      is_active: true,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', connection.user_id);

  if (result.error) {
    throw new Error(`Telegram link update failed: ${result.error.message}`);
  }

  await sendTelegramMessage(
    chatId,
    'Flowly conectado. A partir de agora voce pode falar com a Sexta por aqui. Tente: o que eu ataco agora?'
  );
  return true;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
  }

  try {
    const expectedSecret = Deno.env.get('FLOWLY_TELEGRAM_WEBHOOK_SECRET') || '';
    const receivedSecret = req.headers.get('x-telegram-bot-api-secret-token') || '';
    if (expectedSecret && expectedSecret !== receivedSecret) {
      return jsonResponse({ ok: false, error: 'Invalid webhook secret.' }, 401);
    }

    const update = (await req.json().catch(() => ({}))) as TelegramMessage;
    const text = String(update.message?.text || '').trim();
    const chatId = Number(update.message?.chat?.id || 0);
    if (!chatId || !text) {
      return jsonResponse({ ok: true, ignored: true });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const from = update.message?.from;
    const handledLink = await handleLinkCommand(supabaseAdmin, chatId, text, from);
    if (handledLink) {
      return jsonResponse({ ok: true, linked: true });
    }

    const linkedConnection = await fetchConnectionByChat(supabaseAdmin, chatId);
    if (!linkedConnection) {
      await sendTelegramMessage(
        chatId,
        'Esse bot ainda nao esta vinculado ao seu Flowly. Abra Ajustes > IA, gere um codigo e envie /start CODIGO aqui.'
      );
      return jsonResponse({ ok: true, unlinked: true });
    }

    if (/^\/help(?:@\w+)?$/i.test(text)) {
      await sendTelegramMessage(
        chatId,
        'Comandos: /status para resumo rapido, /disconnect para desligar o bot, ou me envie uma pergunta normal como "o que eu ataco agora?"'
      );
      return jsonResponse({ ok: true, command: 'help' });
    }

    if (/^\/disconnect(?:@\w+)?$/i.test(text)) {
      const result = await supabaseAdmin
        .from('telegram_connections')
        .update({
          telegram_chat_id: null,
          telegram_user_id: null,
          telegram_username: null,
          telegram_first_name: null,
          linked_at: null,
          last_message_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', linkedConnection.user_id);

      if (result.error) {
        throw new Error(`Telegram disconnect command failed: ${result.error.message}`);
      }

      await sendTelegramMessage(chatId, 'Bot desconectado do seu Flowly.');
      return jsonResponse({ ok: true, command: 'disconnect' });
    }

    const contextSummary = await buildSextaContextSummary(supabaseAdmin, linkedConnection.user_id);

    if (/^\/status(?:@\w+)?$/i.test(text)) {
      const summaryText = [
        `Hoje: ${contextSummary.completedCount}/${contextSummary.pendingCount + contextSummary.completedCount} concluidas.`,
        `Pendentes: ${contextSummary.pendingCount}.`,
        `Dinheiro: ${contextSummary.moneyCount}.`,
        `Projetos ativos: ${Array.isArray(contextSummary.activeProjects) ? contextSummary.activeProjects.length : 0}.`
      ].join(' ');
      await sendTelegramMessage(chatId, summaryText);
      return jsonResponse({ ok: true, command: 'status' });
    }

    let replyText = '';
    try {
      const agentState = await loadSextaAgentState(supabaseAdmin, linkedConnection.user_id);
      const agentResult = await runSextaAgentLoop({
        supabaseAdmin,
        userId: linkedConnection.user_id,
        prompt: text,
        channel: 'telegram',
        history: normalizeTelegramHistory(text),
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        model: 'manifest/auto',
        profile: agentState.profile,
        memories: agentState.memories,
        contextSummary
      });
      replyText = agentResult.reply;
    } catch (_) {
      replyText = buildTelegramFallback(contextSummary);
    }

    await sendTelegramMessage(chatId, replyText);
    await supabaseAdmin
      .from('telegram_connections')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', linkedConnection.user_id);

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});
