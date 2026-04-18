-- Finance layer for Flowly
create table if not exists public.finance_settings (
  user_id uuid primary key references auth.users on delete cascade,
  monthly_goal numeric(12,2) not null default 10000,
  default_income_category text default 'Receita',
  default_expense_category text default 'Operacional',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.finance_settings enable row level security;
do $$ begin
  create policy "Users can manage their own finance settings"
    on public.finance_settings
    for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create table if not exists public.finance_transactions (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  entry_type text not null check (entry_type in ('income', 'expense')),
  amount numeric(12,2) not null default 0,
  description text not null default '',
  category text not null default 'Geral',
  occurred_on date not null,
  source text not null default 'manual',
  task_supabase_id text,
  task_text text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create index if not exists finance_transactions_user_date_idx on public.finance_transactions(user_id, occurred_on desc);
alter table public.finance_transactions enable row level security;
do $$ begin
  create policy "Users can manage their own finance transactions"
    on public.finance_transactions
    for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create table if not exists public.finance_imports (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  source text not null default 'sexta',
  status text not null default 'processed',
  summary text not null default '',
  transaction_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  imported_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create index if not exists finance_imports_user_imported_idx on public.finance_imports(user_id, imported_at desc);
alter table public.finance_imports enable row level security;
do $$ begin
  create policy "Users can manage their own finance imports"
    on public.finance_imports
    for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
