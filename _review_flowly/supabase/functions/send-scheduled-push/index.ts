import { createClient } from 'npm:@supabase/supabase-js@2.48.0';
import webpush from 'npm:web-push@3.6.7';

type SlotName = 'morning' | 'midday' | 'night' | 'inactivity';
type TimedSlotName = 'morning' | 'midday' | 'night';

type UserSetting = {
  user_id: string;
  timezone: string | null;
  push_enabled: boolean | null;
  morning_notif_time: string | null;
  midday_notif_time: string | null;
  evening_notif_time: string | null;
  inactivity_notif_enabled: boolean | null;
  inactivity_threshold_minutes: number | null;
  morning_notif_template: string | null;
  midday_notif_template: string | null;
  night_notif_template: string | null;
  inactivity_notif_template: string | null;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type TaskRow = {
  period: string | null;
  completed: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type DailyStats = {
  total: number;
  completed: number;
  percentage: number;
  pending: number;
  avgDurationMs: number;
  totalDurationMs: number;
  bestPeriod: string | null;
};

const DEFAULT_TIMES: Record<TimedSlotName, string> = {
  morning: '08:30',
  midday: '12:30',
  night: '23:00'
};

const DEFAULT_TEMPLATES = {
  morning: 'Bom dia. Hoje voce tem {total} tarefas planejadas.',
  midday: 'Como estamos de produtividade? {completed}/{total} ({percentage}%).',
  night:
    'Resumo do dia: {completed}/{total} ({percentage}%). Tempo total {totalDuration}. Hora de descansar.',
  inactivity: 'Bem, o que andou fazendo nas ultimas 3h?'
};

const WINDOW_MINUTES = 8;
const INACTIVITY_START_MINUTES = 7 * 60;
const INACTIVITY_END_MINUTES = 24 * 60;
const DEFAULT_INACTIVITY_THRESHOLD_MINUTES = 150;

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function parseBodySafe(text: string): Record<string, unknown> {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
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

  const pick = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  const year = Number(pick('year'));
  const month = Number(pick('month'));
  const day = Number(pick('day'));
  const hour = Number(pick('hour'));
  const minute = Number(pick('minute'));
  const dateKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return { year, month, day, hour, minute, dateKey };
}

function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function parseTimeToMinutes(value: string | null | undefined, fallback: string): number {
  const source = (value || fallback || '').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(source);
  if (!match) return parseTimeToMinutes(fallback, '08:30');

  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return parseTimeToMinutes(fallback, '08:30');
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return parseTimeToMinutes(fallback, '08:30');
  return hh * 60 + mm;
}

function isSlotDue(targetMinutes: number, localHour: number, localMinute: number): boolean {
  const nowM = minutesOfDay(localHour, localMinute);
  return Math.abs(nowM - targetMinutes) <= WINDOW_MINUTES;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${Math.max(1, minutes)}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function renderTemplate(template: string | null | undefined, stats: DailyStats, fallback: string): string {
  const source = (template || '').trim() || fallback;
  const values: Record<string, string | number> = {
    completed: stats.completed,
    total: stats.total,
    pending: stats.pending,
    percentage: stats.percentage,
    avgDuration: formatDuration(stats.avgDurationMs),
    totalDuration: formatDuration(stats.totalDurationMs),
    bestPeriod: stats.bestPeriod || 'sem destaque'
  };

  return source.replace(/\{([a-zA-Z]+)\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : '';
  });
}

function buildMessage(slot: SlotName, stats: DailyStats, setting: UserSetting) {
  if (slot === 'morning') {
    return {
      title: 'Flowly | Bom dia',
      body: renderTemplate(setting.morning_notif_template, stats, DEFAULT_TEMPLATES.morning),
      tag: 'flowly-scheduled-morning',
      type: 'scheduled-morning'
    };
  }

  if (slot === 'midday') {
    return {
      title: 'Flowly | Produtividade',
      body: renderTemplate(setting.midday_notif_template, stats, DEFAULT_TEMPLATES.midday),
      tag: 'flowly-scheduled-midday',
      type: 'scheduled-midday'
    };
  }

  if (slot === 'inactivity') {
    return {
      title: 'Flowly | Foco',
      body: renderTemplate(setting.inactivity_notif_template, stats, DEFAULT_TEMPLATES.inactivity),
      tag: 'flowly-scheduled-inactivity',
      type: 'scheduled-inactivity'
    };
  }

  return {
    title: 'Flowly | Resumo do dia',
    body: renderTemplate(setting.night_notif_template, stats, DEFAULT_TEMPLATES.night),
    tag: 'flowly-scheduled-night',
    type: 'scheduled-night'
  };
}

function getSlotTargetMinutes(slot: TimedSlotName, setting: UserSetting): number {
  if (slot === 'morning') {
    return parseTimeToMinutes(setting.morning_notif_time, DEFAULT_TIMES.morning);
  }
  if (slot === 'midday') {
    return parseTimeToMinutes(setting.midday_notif_time, DEFAULT_TIMES.midday);
  }
  return parseTimeToMinutes(setting.evening_notif_time, DEFAULT_TIMES.night);
}

function getInactivityThreshold(setting: UserSetting): number {
  const raw = Number(setting.inactivity_threshold_minutes ?? DEFAULT_INACTIVITY_THRESHOLD_MINUTES);
  if (!Number.isFinite(raw)) return DEFAULT_INACTIVITY_THRESHOLD_MINUTES;
  return Math.max(30, Math.min(480, Math.floor(raw)));
}

async function fetchDailyStats(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  dateKey: string
): Promise<DailyStats> {
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select('period, completed, created_at, updated_at')
    .eq('user_id', userId)
    .eq('day', dateKey);

  if (error) {
    throw new Error(`Tasks query failed for ${userId}: ${error.message}`);
  }

  const rows = (data || []) as TaskRow[];
  const total = rows.length;
  const completedRows = rows.filter((row) => row.completed === true);
  const completed = completedRows.length;
  const pending = Math.max(0, total - completed);
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const periodDone = new Map<string, number>();
  const durationSamples: number[] = [];

  completedRows.forEach((row) => {
    const period = (row.period || 'Tarefas').trim();
    periodDone.set(period, (periodDone.get(period) || 0) + 1);

    if (row.created_at && row.updated_at) {
      const diff = new Date(row.updated_at).getTime() - new Date(row.created_at).getTime();
      if (Number.isFinite(diff) && diff >= 0 && diff <= 24 * 60 * 60 * 1000) {
        durationSamples.push(diff);
      }
    }
  });

  const bestPeriod = [...periodDone.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const totalDurationMs = durationSamples.reduce((sum, ms) => sum + ms, 0);
  const avgDurationMs =
    durationSamples.length > 0 ? Math.round(totalDurationMs / durationSamples.length) : 0;

  return {
    total,
    completed,
    percentage,
    pending,
    avgDurationMs,
    totalDurationMs,
    bestPeriod
  };
}

async function fetchLatestActivityTimestamp(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  dateKey: string
): Promise<number | null> {
  const [tasksRes, habitsRes] = await Promise.all([
    supabaseAdmin
      .from('tasks')
      .select('updated_at')
      .eq('user_id', userId)
      .eq('day', dateKey)
      .eq('completed', true)
      .order('updated_at', { ascending: false })
      .limit(1),
    supabaseAdmin
      .from('habits_history')
      .select('created_at')
      .eq('user_id', userId)
      .eq('date', dateKey)
      .eq('completed', true)
      .order('created_at', { ascending: false })
      .limit(1)
  ]);

  if (tasksRes.error) {
    throw new Error(`Latest activity tasks query failed: ${tasksRes.error.message}`);
  }
  if (habitsRes.error) {
    throw new Error(`Latest activity habits query failed: ${habitsRes.error.message}`);
  }

  const taskTs = tasksRes.data?.[0]?.updated_at ? new Date(tasksRes.data[0].updated_at).getTime() : 0;
  const habitTs = habitsRes.data?.[0]?.created_at
    ? new Date(habitsRes.data[0].created_at).getTime()
    : 0;

  const latest = Math.max(taskTs || 0, habitTs || 0);
  return latest > 0 ? latest : null;
}

function shouldSendInactivity(
  localHour: number,
  localMinute: number,
  latestActivityTs: number | null,
  thresholdMinutes: number
): boolean {
  const nowMinutes = minutesOfDay(localHour, localMinute);
  if (nowMinutes < INACTIVITY_START_MINUTES || nowMinutes >= INACTIVITY_END_MINUTES) {
    return false;
  }

  if (!latestActivityTs) {
    return nowMinutes >= INACTIVITY_START_MINUTES + thresholdMinutes;
  }

  const diffMinutes = Math.floor((Date.now() - latestActivityTs) / 60000);
  return Number.isFinite(diffMinutes) && diffMinutes >= thresholdMinutes;
}

async function alreadySent(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  localDate: string,
  slot: SlotName
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('push_delivery_log')
    .select('id')
    .eq('user_id', userId)
    .eq('local_date', localDate)
    .eq('slot_name', slot)
    .limit(1);

  if (error) {
    throw new Error(`Delivery log read failed: ${error.message}`);
  }

  return !!(data && data.length > 0);
}

async function markSent(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  localDate: string,
  slot: SlotName,
  timezone: string
): Promise<void> {
  const { error } = await supabaseAdmin.from('push_delivery_log').insert({
    user_id: userId,
    local_date: localDate,
    slot_name: slot,
    timezone,
    sent_at: new Date().toISOString()
  });

  if (error && !error.message.toLowerCase().includes('duplicate')) {
    throw new Error(`Delivery log write failed: ${error.message}`);
  }
}

async function sendToUserSubscriptions(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  payload: Record<string, unknown>
): Promise<{ sent: number; removed: number }> {
  const { data, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Subscriptions query failed: ${error.message}`);
  }

  const subscriptions = (data || []) as PushSubscriptionRow[];
  let sent = 0;
  let removed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        },
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        removed += 1;
      }
    }
  }

  return { sent, removed };
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text();
    const body = parseBodySafe(bodyText);

    const url = new URL(req.url);
    const slotParam = (url.searchParams.get('slot') || body.slot || '').toString() as SlotName | '';
    const requestedSlots: SlotName[] =
      slotParam === 'morning' ||
      slotParam === 'midday' ||
      slotParam === 'night' ||
      slotParam === 'inactivity'
        ? [slotParam]
        : ['morning', 'midday', 'night', 'inactivity'];

    const supabaseUrl = getEnv('SUPABASE_URL');
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

    const vapidSubject = Deno.env.get('FLOWLY_VAPID_SUBJECT') || Deno.env.get('VAPID_SUBJECT') || '';
    const vapidPublicKey =
      Deno.env.get('FLOWLY_VAPID_PUBLIC_KEY') || Deno.env.get('VAPID_PUBLIC_KEY') || '';
    const vapidPrivateKey =
      Deno.env.get('FLOWLY_VAPID_PRIVATE_KEY') || Deno.env.get('VAPID_PRIVATE_KEY') || '';

    if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
      throw new Error('Missing VAPID config in secrets');
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select(
        'user_id, timezone, push_enabled, morning_notif_time, midday_notif_time, evening_notif_time, inactivity_notif_enabled, inactivity_threshold_minutes, morning_notif_template, midday_notif_template, night_notif_template, inactivity_notif_template'
      )
      .eq('push_enabled', true);

    if (settingsError) {
      throw new Error(`Settings query failed: ${settingsError.message}`);
    }

    const settings = (settingsData || []) as UserSetting[];

    let usersProcessed = 0;
    let notificationsSent = 0;
    let subscriptionsRemoved = 0;

    for (const setting of settings) {
      const timezone = setting.timezone || 'America/Sao_Paulo';
      const localNow = getNowInTimezone(timezone);

      for (const slot of requestedSlots) {
        const sentBefore = await alreadySent(supabaseAdmin, setting.user_id, localNow.dateKey, slot);
        if (sentBefore) continue;

        const stats = await fetchDailyStats(supabaseAdmin, setting.user_id, localNow.dateKey);

        if (slot === 'inactivity') {
          if (setting.inactivity_notif_enabled === false) continue;

          const latestActivityTs = await fetchLatestActivityTimestamp(
            supabaseAdmin,
            setting.user_id,
            localNow.dateKey
          );

          const thresholdMinutes = getInactivityThreshold(setting);
          if (!shouldSendInactivity(localNow.hour, localNow.minute, latestActivityTs, thresholdMinutes)) {
            continue;
          }

          const message = buildMessage('inactivity', stats, setting);
          const payload = {
            title: message.title,
            body: message.body,
            type: message.type,
            tag: message.tag,
            url: '/'
          };

          const result = await sendToUserSubscriptions(supabaseAdmin, setting.user_id, payload);

          if (result.sent > 0) {
            await markSent(supabaseAdmin, setting.user_id, localNow.dateKey, slot, timezone);
            usersProcessed += 1;
            notificationsSent += result.sent;
            subscriptionsRemoved += result.removed;
          }

          continue;
        }

        const targetMinutes = getSlotTargetMinutes(slot as TimedSlotName, setting);
        if (!isSlotDue(targetMinutes, localNow.hour, localNow.minute)) continue;

        const message = buildMessage(slot, stats, setting);
        const payload = {
          title: message.title,
          body: message.body,
          type: message.type,
          tag: message.tag,
          url: '/'
        };

        const result = await sendToUserSubscriptions(supabaseAdmin, setting.user_id, payload);

        if (result.sent > 0) {
          await markSent(supabaseAdmin, setting.user_id, localNow.dateKey, slot, timezone);
          usersProcessed += 1;
          notificationsSent += result.sent;
          subscriptionsRemoved += result.removed;
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        users_scanned: settings.length,
        users_processed: usersProcessed,
        notifications_sent: notificationsSent,
        subscriptions_removed: subscriptionsRemoved,
        slots: requestedSlots,
        window_minutes: WINDOW_MINUTES
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message || 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
