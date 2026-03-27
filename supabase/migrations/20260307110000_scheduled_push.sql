-- Flowly scheduled push delivery (server-side, works with app closed)

create table if not exists public.push_delivery_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  local_date text not null,
  slot_name text not null check (slot_name in ('morning', 'midday', 'night')),
  timezone text not null,
  sent_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, local_date, slot_name)
);

alter table public.push_delivery_log enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_delivery_log'
      and policyname = 'Users can read own delivery log'
  ) then
    create policy "Users can read own delivery log"
      on public.push_delivery_log
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

create index if not exists idx_push_delivery_log_slot_date
  on public.push_delivery_log (slot_name, local_date);

create extension if not exists pg_cron;
create extension if not exists pg_net;
