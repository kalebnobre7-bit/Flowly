import { createClient } from 'npm:@supabase/supabase-js@2.48.0';
import webpush from 'npm:web-push@3.6.7';
import {
  buildAutonomyDispatchText,
  buildSextaContextSummary,
  callTelegramApi,
  createSupabaseAdminClient,
  evaluateSextaAutonomy,
  handleCors,
  jsonResponse,
  loadSextaAgentState,
  markSextaAutonomySignalSent,
  shouldDispatchAutonomySignal
} from '../_shared/sexta.ts';

type TelegramConnectionRow = {
  user_id: string;
  telegram_chat_id: string | null;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type UserSettingRow = {
  user_id: string;
  push_enabled: boolean | null;
};
type SupabaseAdminClient = ReturnType<typeof createClient<any, 'public', any>>;

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function getBearerToken(req: Request): string {
  const header = req.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : '';
}

function isAuthorizedCronRequest(req: Request): boolean {
  return getBearerToken(req) === getEnv('FLOWLY_CRON_SECRET');
}

function getOptionalEnv(name: string) {
  return Deno.env.get(name) || '';
}

function truncate(value: string, max = 220) {
  return String(value || '').trim().slice(0, max);
}

async function sendTelegramAutonomy(chatId: string, text: string) {
  if (!chatId) return false;
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: truncate(text, 3900)
  });
  return true;
}

async function sendPushAutonomy(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  title: string,
  body: string
) {
  const { data, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Push subscriptions query failed: ${error.message}`);
  }

  const subscriptions = (data || []) as PushSubscriptionRow[];
  let sent = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        },
        JSON.stringify({
          title,
          body: truncate(body, 180),
          type: 'sexta-autonomy',
          tag: 'flowly-sexta-autonomy',
          url: '/'
        })
      );
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }

  return sent;
}

function configureWebPush() {
  const vapidSubject = getOptionalEnv('FLOWLY_VAPID_SUBJECT') || getOptionalEnv('VAPID_SUBJECT');
  const vapidPublicKey =
    getOptionalEnv('FLOWLY_VAPID_PUBLIC_KEY') || getOptionalEnv('VAPID_PUBLIC_KEY');
  const vapidPrivateKey =
    getOptionalEnv('FLOWLY_VAPID_PRIVATE_KEY') || getOptionalEnv('VAPID_PRIVATE_KEY');

  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
    return false;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  return true;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
  }

  if (!isAuthorizedCronRequest(req)) {
    return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;
    const supabaseAdmin = createSupabaseAdminClient();
    const pushReady = configureWebPush();

    const [profileRes, telegramRes, settingsRes] = await Promise.all([
      supabaseAdmin.from('sexta_profiles').select('user_id, autonomy_mode'),
      supabaseAdmin
        .from('telegram_connections')
        .select('user_id, telegram_chat_id')
        .eq('is_active', true)
        .not('telegram_chat_id', 'is', null),
      supabaseAdmin.from('user_settings').select('user_id, push_enabled')
    ]);

    if (profileRes.error) {
      throw new Error(`Sexta profiles query failed: ${profileRes.error.message}`);
    }
    if (telegramRes.error) {
      throw new Error(`Telegram connections query failed: ${telegramRes.error.message}`);
    }
    if (settingsRes.error) {
      throw new Error(`User settings query failed: ${settingsRes.error.message}`);
    }

    const telegramByUser = new Map<string, string>();
    ((telegramRes.data || []) as TelegramConnectionRow[]).forEach((item) => {
      const userId = String(item.user_id || '').trim();
      const chatId = String(item.telegram_chat_id || '').trim();
      if (userId && chatId) telegramByUser.set(userId, chatId);
    });

    const pushByUser = new Map<string, boolean>();
    ((settingsRes.data || []) as UserSettingRow[]).forEach((item) => {
      const userId = String(item.user_id || '').trim();
      if (!userId) return;
      pushByUser.set(userId, item.push_enabled === true);
    });

    const candidateUserIds = new Set<string>();
    ((profileRes.data || []) as Array<{ user_id: string; autonomy_mode: string | null }>).forEach((item) => {
      if (String(item.autonomy_mode || '').trim()) {
        candidateUserIds.add(String(item.user_id || '').trim());
      }
    });
    telegramByUser.forEach((_, userId) => candidateUserIds.add(userId));
    pushByUser.forEach((enabled, userId) => {
      if (enabled) candidateUserIds.add(userId);
    });

    let usersReviewed = 0;
    let telegramSent = 0;
    let pushSent = 0;
    const previews: Array<Record<string, unknown>> = [];

    for (const userId of candidateUserIds) {
      if (!userId) continue;

      const currentState = await loadSextaAgentState(supabaseAdmin, userId);
      if (!String(currentState.profile?.autonomyMode || '').trim()) continue;

      const contextSummary = await buildSextaContextSummary(
        supabaseAdmin,
        userId,
        currentState.profile,
        currentState.memories
      );
      const review = await evaluateSextaAutonomy({
        supabaseAdmin,
        userId,
        profile: currentState.profile,
        memories: currentState.memories,
        contextSummary
      });

      usersReviewed += 1;

      const pendingSignals = (review.signals || [])
        .filter((item) => String(item.status || '').toLowerCase() !== 'resolved')
        .filter((item) => shouldDispatchAutonomySignal(item));

      const topSignal = pendingSignals[0] || null;
      if (!topSignal) continue;

      const dispatchText = buildAutonomyDispatchText(topSignal);
      let channel = '';

      if (!dryRun && telegramByUser.has(userId)) {
        await sendTelegramAutonomy(telegramByUser.get(userId) || '', dispatchText);
        telegramSent += 1;
        channel = 'telegram';
      } else if (!dryRun && pushReady && pushByUser.get(userId) === true) {
        const sent = await sendPushAutonomy(
          supabaseAdmin,
          userId,
          'Flowly | Sexta',
          `${topSignal.title}. ${topSignal.recommendation || topSignal.body || ''}`
        );
        if (sent > 0) {
          pushSent += sent;
          channel = 'push';
        }
      }

      if (!dryRun && channel && topSignal.id) {
        await markSextaAutonomySignalSent(supabaseAdmin, topSignal.id, channel);
      }

      if (previews.length < 12) {
        previews.push({
          userId,
          channel: channel || (telegramByUser.has(userId) ? 'telegram-ready' : pushByUser.get(userId) === true ? 'push-ready' : 'none'),
          title: topSignal.title,
          recommendation: topSignal.recommendation || '',
          urgency: topSignal.urgency || 'medium'
        });
      }
    }

    return jsonResponse({
      ok: true,
      dryRun,
      usersReviewed,
      telegramSent,
      pushSent,
      previews
    });
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
