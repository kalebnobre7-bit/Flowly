-- Recreate the scheduled push runner with the required cron secret header.
-- Before running this migration, store the same value used by the Edge Function
-- secret FLOWLY_CRON_SECRET in Supabase Vault under the name flowly_cron_secret:
-- select vault.create_secret('SUA_CHAVE_FORTE', 'flowly_cron_secret');

create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;

do $$
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'flowly_cron_secret'
  ) then
    raise exception 'Missing Vault secret: flowly_cron_secret';
  end if;

  if exists (
    select 1
    from cron.job
    where jobname = 'flowly-scheduled-push-runner'
  ) then
    perform cron.unschedule('flowly-scheduled-push-runner');
  end if;

  perform cron.schedule(
    'flowly-scheduled-push-runner',
    '*/10 * * * *',
    $job$
    select
      net.http_post(
        url := 'https://cgrosyjtujakkbjjnmml.supabase.co/functions/v1/send-scheduled-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'flowly_cron_secret'
            limit 1
          )
        ),
        body := '{}'::jsonb
      );
    $job$
  );
end
$$;
