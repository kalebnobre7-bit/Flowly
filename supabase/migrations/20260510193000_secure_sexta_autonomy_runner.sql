-- Recreate the Sexta autonomy runner with the required cron secret header.

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
    where jobname = 'flowly-sexta-autonomy-runner'
  ) then
    perform cron.unschedule('flowly-sexta-autonomy-runner');
  end if;

  perform cron.schedule(
    'flowly-sexta-autonomy-runner',
    '*/20 * * * *',
    $job$
    select
      net.http_post(
        url := 'https://cgrosyjtujakkbjjnmml.supabase.co/functions/v1/sexta-autonomy-run',
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

