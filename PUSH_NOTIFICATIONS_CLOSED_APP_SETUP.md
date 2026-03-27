# Push com App Fechado (Flowly)

Este setup envia notificacoes mesmo com o app fechado, via Supabase Edge Function + Web Push.

## O que foi adicionado

- Edge Function: `supabase/functions/send-scheduled-push/index.ts`
- Migracao SQL: `supabase/migrations/20260307_scheduled_push.sql`
- Log de deduplicacao: `public.push_delivery_log` (evita duplicar no mesmo dia/slot)

## Horarios

- `08:30` bom dia + total de tarefas do dia
- `12:30` status de produtividade
- `23:00` resumo do dia + recomendacao de descanso

Obs: horarios respeitam o `timezone` salvo em `user_settings`.

## 1) Definir secrets da function

No terminal:

```bash
supabase secrets set \
  FLOWLY_CRON_SECRET="SUA_CHAVE_FORTE" \
  FLOWLY_VAPID_SUBJECT="mailto:seu-email@dominio.com" \
  FLOWLY_VAPID_PUBLIC_KEY="SUA_VAPID_PUBLIC" \
  FLOWLY_VAPID_PRIVATE_KEY="SUA_VAPID_PRIVATE"
```

A function tambem usa secrets padrao do Supabase:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 2) Deploy da function

```bash
supabase functions deploy send-scheduled-push --no-verify-jwt
```

## 3) Rodar migracao SQL

Execute no SQL Editor do Supabase:

- `supabase/migrations/20260307_scheduled_push.sql`

## 4) Criar job CRON (a cada 10 min)

No SQL Editor, substitua placeholders e execute:

```sql
select cron.schedule(
  'flowly-scheduled-push-runner',
  '*/10 * * * *',
  $$
  select
    net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-scheduled-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <FLOWLY_CRON_SECRET>'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

## 5) Teste rapido

Chame manualmente:

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/send-scheduled-push" \
  -H "Authorization: Bearer <FLOWLY_CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d "{}"
```

## Observacoes importantes

- O usuario precisa:
  - estar com notificacoes habilitadas no Flowly
  - ter permissao `granted` no navegador
  - ter uma `push_subscription` valida salva
- Subscriptions expiradas (HTTP 404/410) sao removidas automaticamente.
- O fallback local no frontend foi deixado opcional via localStorage:
  - chave: `flowly_notif_local_fallback`
  - padrao: desativado (evita duplicidade com backend)
