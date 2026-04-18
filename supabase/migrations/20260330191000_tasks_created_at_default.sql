alter table public.tasks
  alter column created_at set default timezone('utc'::text, now());

update public.tasks
set created_at = coalesce(created_at, updated_at, timezone('utc'::text, now()))
where created_at is null;

alter table public.tasks
  alter column created_at set not null;
