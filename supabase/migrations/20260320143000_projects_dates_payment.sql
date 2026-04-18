alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists deadline date;
alter table public.projects add column if not exists completion_date date;
alter table public.projects add column if not exists is_paid boolean not null default false;
