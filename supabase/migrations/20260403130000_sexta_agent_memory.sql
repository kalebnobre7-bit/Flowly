create table if not exists public.sexta_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  memory_notes text not null default '',
  operator_rules text not null default '',
  command_style text not null default '',
  autonomy_mode text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.sexta_profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sexta_profiles'
      and policyname = 'Users can manage own sexta profile'
  ) then
    create policy "Users can manage own sexta profile"
      on public.sexta_profiles
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

create table if not exists public.sexta_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  content text not null,
  source text not null default 'manual',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_sexta_memories_user_created
  on public.sexta_memories (user_id, created_at desc);

create unique index if not exists idx_sexta_memories_user_content
  on public.sexta_memories (user_id, lower(content));

alter table public.sexta_memories enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sexta_memories'
      and policyname = 'Users can manage own sexta memories'
  ) then
    create policy "Users can manage own sexta memories"
      on public.sexta_memories
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
