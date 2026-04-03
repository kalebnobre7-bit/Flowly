import {
  callTelegramApi,
  createSupabaseAdminClient,
  createTelegramLinkCode,
  getAuthenticatedUser,
  getEnv,
  getTelegramLinkExpiry,
  handleCors,
  jsonResponse,
  maskTelegramChatId
} from '../_shared/sexta.ts';

type TelegramConnectionRow = {
  user_id: string;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  link_code: string | null;
  link_code_expires_at: string | null;
};

function serializeConnection(row: TelegramConnectionRow | null, webhookInfo?: Record<string, unknown>) {
  return {
    linked: Boolean(row?.telegram_chat_id),
    telegramUsername: String(row?.telegram_username || '').trim(),
    chatIdMasked: maskTelegramChatId(row?.telegram_chat_id),
    code: String(row?.link_code || '').trim().toUpperCase(),
    expiresAt: String(row?.link_code_expires_at || '').trim(),
    webhookConfigured: Boolean(webhookInfo?.url),
    webhookUrl: String(webhookInfo?.url || '').trim()
  };
}

async function fetchConnection(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  const result = await supabaseAdmin
    .from('telegram_connections')
    .select('user_id, telegram_chat_id, telegram_username, link_code, link_code_expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (result.error) {
    throw new Error(`Telegram connection query failed: ${result.error.message}`);
  }

  return (result.data || null) as TelegramConnectionRow | null;
}

async function getWebhookInfoSafe() {
  try {
    const info = (await callTelegramApi('getWebhookInfo', {})) as Record<string, unknown>;
    return info;
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return jsonResponse({ ok: false, error: 'Usuario nao autenticado.' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'status').trim().toLowerCase();
    const supabaseAdmin = createSupabaseAdminClient();

    if (action === 'status') {
      const [connection, webhookInfo] = await Promise.all([
        fetchConnection(supabaseAdmin, user.id),
        getWebhookInfoSafe()
      ]);
      return jsonResponse({
        ok: true,
        status: serializeConnection(connection, webhookInfo)
      });
    }

    if (action === 'generate_code') {
      const code = createTelegramLinkCode();
      const expiresAt = getTelegramLinkExpiry(15);
      const result = await supabaseAdmin.from('telegram_connections').upsert(
        {
          user_id: user.id,
          link_code: code,
          link_code_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
          is_active: true
        },
        { onConflict: 'user_id' }
      );

      if (result.error) {
        throw new Error(`Telegram link code write failed: ${result.error.message}`);
      }

      const [connection, webhookInfo] = await Promise.all([
        fetchConnection(supabaseAdmin, user.id),
        getWebhookInfoSafe()
      ]);
      return jsonResponse({
        ok: true,
        code,
        expiresAt,
        status: serializeConnection(connection, webhookInfo)
      });
    }

    if (action === 'disconnect') {
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
        .eq('user_id', user.id);

      if (result.error) {
        throw new Error(`Telegram disconnect failed: ${result.error.message}`);
      }

      const webhookInfo = await getWebhookInfoSafe();
      return jsonResponse({
        ok: true,
        status: serializeConnection(null, webhookInfo)
      });
    }

    if (action === 'register_webhook') {
      const webhookUrl = `${getEnv('SUPABASE_URL').replace(/\/+$/, '')}/functions/v1/telegram-bot`;
      const secretToken = Deno.env.get('FLOWLY_TELEGRAM_WEBHOOK_SECRET') || '';
      await callTelegramApi('setWebhook', {
        url: webhookUrl,
        ...(secretToken ? { secret_token: secretToken } : {}),
        allowed_updates: ['message']
      });
      const [connection, webhookInfo] = await Promise.all([
        fetchConnection(supabaseAdmin, user.id),
        getWebhookInfoSafe()
      ]);
      return jsonResponse({
        ok: true,
        webhookUrl,
        status: serializeConnection(connection, webhookInfo)
      });
    }

    return jsonResponse({ ok: false, error: 'Acao invalida.' }, 400);
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
