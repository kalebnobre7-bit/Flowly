-- Configurable notification settings per user

alter table public.user_settings
  add column if not exists midday_notif_time text,
  add column if not exists inactivity_notif_enabled boolean default true,
  add column if not exists inactivity_threshold_minutes integer default 150,
  add column if not exists progress_notif_enabled boolean default true,
  add column if not exists morning_notif_template text,
  add column if not exists midday_notif_template text,
  add column if not exists night_notif_template text,
  add column if not exists inactivity_notif_template text,
  add column if not exists progress_notif_template text;

update public.user_settings
set
  morning_notif_time = coalesce(morning_notif_time, '08:30'),
  midday_notif_time = coalesce(midday_notif_time, '12:30'),
  evening_notif_time = coalesce(evening_notif_time, '23:00'),
  inactivity_notif_enabled = coalesce(inactivity_notif_enabled, true),
  inactivity_threshold_minutes = greatest(30, least(480, coalesce(inactivity_threshold_minutes, 150))),
  progress_notif_enabled = coalesce(progress_notif_enabled, true),
  morning_notif_template = coalesce(morning_notif_template, 'Bom dia. Hoje voce tem {total} tarefas planejadas.'),
  midday_notif_template = coalesce(midday_notif_template, 'Como estamos de produtividade? {completed}/{total} ({percentage}%).'),
  night_notif_template = coalesce(night_notif_template, 'Resumo do dia: {completed}/{total} ({percentage}%). Tempo total {totalDuration}. Hora de descansar.'),
  inactivity_notif_template = coalesce(inactivity_notif_template, 'Bem, o que andou fazendo nas ultimas 3h?'),
  progress_notif_template = coalesce(progress_notif_template, 'Estamos no caminho, {completed}/{total}');

alter table public.user_settings
  alter column inactivity_threshold_minutes set default 150;
