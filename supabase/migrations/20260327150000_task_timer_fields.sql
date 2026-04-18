alter table public.tasks
  add column if not exists timer_total_ms bigint not null default 0,
  add column if not exists timer_started_at timestamp with time zone,
  add column if not exists timer_last_stopped_at timestamp with time zone,
  add column if not exists timer_sessions_count integer not null default 0;
