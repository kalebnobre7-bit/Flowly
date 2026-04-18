-- Allow inactivity slot in push delivery log

alter table public.push_delivery_log
  drop constraint if exists push_delivery_log_slot_name_check;

alter table public.push_delivery_log
  add constraint push_delivery_log_slot_name_check
  check (slot_name in ('morning', 'midday', 'night', 'inactivity'));

create index if not exists idx_push_delivery_log_user_slot_date
  on public.push_delivery_log (user_id, slot_name, local_date);
