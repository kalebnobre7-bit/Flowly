-- Replace legacy public role policies with authenticated-only policies.

drop policy if exists "Users can view own tasks" on public.tasks;
drop policy if exists "Users can insert own tasks" on public.tasks;
drop policy if exists "Users can update own tasks" on public.tasks;
drop policy if exists "Users can delete own tasks" on public.tasks;

drop policy if exists "Users can view own habits" on public.habits_history;
drop policy if exists "Users can insert own habits" on public.habits_history;
drop policy if exists "Users can update own habits" on public.habits_history;
drop policy if exists "Users can delete own habits" on public.habits_history;

drop policy if exists "Users can manage own sexta autonomy signals" on public.sexta_autonomy_signals;

create policy "Users can manage own sexta autonomy signals"
  on public.sexta_autonomy_signals
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

