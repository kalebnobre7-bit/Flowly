create table if not exists public.projects (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  client_name text,
  status text not null default 'active',
  service_type text,
  expected_value numeric(12,2) not null default 0,
  closed_value numeric(12,2) not null default 0,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.projects enable row level security;
do $$ begin
  create policy "Users can manage their own projects"
    on public.projects
    for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

alter table public.tasks add column if not exists project_id text;
alter table public.tasks add column if not exists project_name text;
alter table public.finance_transactions add column if not exists project_id text;
alter table public.finance_transactions add column if not exists project_name text;
