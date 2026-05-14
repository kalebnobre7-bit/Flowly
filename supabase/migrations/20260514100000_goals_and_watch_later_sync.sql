-- Goals table
create table if not exists public.goals (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  icon text not null default '🎯',
  color text not null default 'green',
  title text not null default 'Nova meta',
  description text not null default '',
  target numeric not null default 1,
  current_value numeric not null default 0,
  unit text not null default '',
  deadline date,
  category text not null default '',
  "order" integer not null default 0,
  created_at timestamp with time zone not null default timezone('utc', now()),
  completed_at timestamp with time zone,
  updated_at timestamp with time zone not null default timezone('utc', now())
);
create index if not exists goals_user_id_idx on public.goals (user_id);
alter table public.goals enable row level security;
do $$ begin
  create policy "Users can manage their own goals"
    on public.goals for all to authenticated
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Watch Later table
create table if not exists public.watch_later (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null default 'youtube',
  url text not null default '',
  title text not null default '',
  author text not null default '',
  thumbnail text not null default '',
  host text not null default '',
  favicon text not null default '',
  added_at timestamp with time zone not null default timezone('utc', now()),
  watched boolean not null default false,
  updated_at timestamp with time zone not null default timezone('utc', now())
);
create index if not exists watch_later_user_id_idx on public.watch_later (user_id);
alter table public.watch_later enable row level security;
do $$ begin
  create policy "Users can manage their own watch later"
    on public.watch_later for all to authenticated
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
