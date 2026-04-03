create table if not exists public.telegram_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users on delete cascade,
  telegram_chat_id text unique,
  telegram_user_id text,
  telegram_username text,
  telegram_first_name text,
  link_code text unique,
  link_code_expires_at timestamptz,
  linked_at timestamptz,
  last_message_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.telegram_connections enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'telegram_connections'
      and policyname = 'Users can manage own telegram connection'
  ) then
    create policy "Users can manage own telegram connection"
      on public.telegram_connections
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

create index if not exists idx_telegram_connections_link_code
  on public.telegram_connections (link_code);

create index if not exists idx_telegram_connections_chat_id
  on public.telegram_connections (telegram_chat_id);
