create table if not exists public.sexta_episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  channel text not null default 'app',
  user_message text not null default '',
  assistant_reply text not null default '',
  summary text not null default '',
  decision_log text not null default '',
  tool_results jsonb not null default '[]'::jsonb,
  memories_applied jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_sexta_episodes_user_created
  on public.sexta_episodes (user_id, created_at desc);

alter table public.sexta_episodes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sexta_episodes'
      and policyname = 'Users can manage own sexta episodes'
  ) then
    create policy "Users can manage own sexta episodes"
      on public.sexta_episodes
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

create table if not exists public.sexta_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  scope text not null default 'operational',
  status text not null default 'active',
  why text not null default '',
  source text not null default 'reflection',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_reviewed_at timestamptz
);

create index if not exists idx_sexta_goals_user_updated
  on public.sexta_goals (user_id, updated_at desc);

create unique index if not exists idx_sexta_goals_user_title
  on public.sexta_goals (user_id, lower(title));

alter table public.sexta_goals enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sexta_goals'
      and policyname = 'Users can manage own sexta goals'
  ) then
    create policy "Users can manage own sexta goals"
      on public.sexta_goals
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

create table if not exists public.sexta_capability_backlog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'proposed',
  source text not null default 'reflection',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_sexta_capability_backlog_user_updated
  on public.sexta_capability_backlog (user_id, updated_at desc);

create unique index if not exists idx_sexta_capability_backlog_user_title
  on public.sexta_capability_backlog (user_id, lower(title));

alter table public.sexta_capability_backlog enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sexta_capability_backlog'
      and policyname = 'Users can manage own sexta capability backlog'
  ) then
    create policy "Users can manage own sexta capability backlog"
      on public.sexta_capability_backlog
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
