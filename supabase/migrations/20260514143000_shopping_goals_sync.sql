create table if not exists public.shopping_goals (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null default 'Novo item',
  price numeric not null default 0,
  priority text not null default 'media',
  category text,
  status text not null default 'pendente',
  deadline date,
  notes text,
  created_at timestamp with time zone not null default timezone('utc', now()),
  bought_at timestamp with time zone,
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint shopping_goals_priority_check check (priority in ('alta', 'media', 'baixa')),
  constraint shopping_goals_status_check check (status in ('pendente', 'economizando', 'comprado'))
);

create index if not exists shopping_goals_user_status_idx
  on public.shopping_goals (user_id, status);

create index if not exists shopping_goals_user_created_idx
  on public.shopping_goals (user_id, created_at desc);

alter table public.shopping_goals enable row level security;

do $$
begin
  create policy "Users can manage their own shopping goals"
    on public.shopping_goals for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
