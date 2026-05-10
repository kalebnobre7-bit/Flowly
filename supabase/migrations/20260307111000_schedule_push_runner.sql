-- Schedule runner for send-scheduled-push edge function

create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'flowly-scheduled-push-runner'
  ) then
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
  end if;
end
$$;
