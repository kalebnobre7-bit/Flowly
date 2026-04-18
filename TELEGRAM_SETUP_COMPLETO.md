# ðŸ¤– SETUP COMPLETO: Telegram Bot + IA Gemini

## âœ… InformaÃ§Ãµes Configuradas:

- **Bot Token:** `<TELEGRAM_BOT_TOKEN>`
- **Gemini API:** `<GEMINI_API_KEY>`
- **Seu Chat ID:** `<TELEGRAM_CHAT_ID>`

---

## ðŸš€ PASSO 1: Instalar Supabase CLI

```bash
# Windows (PowerShell como Admin):
npm install -g supabase

# OU usando Scoop:
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

---

## ðŸ”— PASSO 2: Conectar ao Supabase

1. Acesse: https://supabase.com/dashboard
2. Abra seu projeto Flowly
3. VÃ¡ em **Settings â†’ General**
4. Copie o **Project Reference ID** (aparece na URL, tipo: `abcdefghijk`)

```bash
# Login no Supabase
supabase login

# Link com seu projeto (substitua o ID)
cd C:\Users\cupin\OneDrive\Desktop\Flowly-main\Flowly-main
supabase link --project-ref SEU_PROJECT_ID
```

---

## ðŸ“¤ PASSO 3: Deploy das Edge Functions

```bash
# Deploy do bot principal
supabase functions deploy telegram-bot --no-verify-jwt

# Deploy do sistema de notificaÃ§Ãµes
supabase functions deploy send-telegram-notifications --no-verify-jwt
```

Anote as URLs que aparecerem! SerÃ£o algo como:

- `https://SEU_PROJECT.supabase.co/functions/v1/telegram-bot`
- `https://SEU_PROJECT.supabase.co/functions/v1/send-telegram-notifications`

---

## ðŸ”” PASSO 4: Configurar Webhook do Telegram

Substitua `SUA_URL` pela URL do passo anterior:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://SEU_PROJECT.supabase.co/functions/v1/telegram-bot"
```

**Verificar se funcionou:**

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Deve retornar: `"url": "sua-url-aqui"`

---

## â° PASSO 5: Configurar NotificaÃ§Ãµes Agendadas (CRON)

No Supabase Dashboard:

1. VÃ¡ em **Database â†’ Extensions**
2. Habilite **pg_cron** (se nÃ£o estiver habilitado)
3. VÃ¡ em **SQL Editor**
4. Cole e execute este cÃ³digo:

```sql
-- NotificaÃ§Ã£o da manhÃ£ (9h - UTC-3 = 12h UTC)
SELECT cron.schedule(
  'telegram-morning-notification',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT.supabase.co/functions/v1/send-telegram-notifications',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"type": "morning", "userId": "<TELEGRAM_CHAT_ID>"}'::jsonb
  );
  $$
);

-- NotificaÃ§Ã£o da tarde (15h - UTC-3 = 18h UTC)
SELECT cron.schedule(
  'telegram-afternoon-notification',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT.supabase.co/functions/v1/send-telegram-notifications',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"type": "afternoon", "userId": "<TELEGRAM_CHAT_ID>"}'::jsonb
  );
  $$
);

-- NotificaÃ§Ã£o da noite (20h - UTC-3 = 23h UTC)
SELECT cron.schedule(
  'telegram-evening-notification',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT.supabase.co/functions/v1/send-telegram-notifications',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"type": "evening", "userId": "<TELEGRAM_CHAT_ID>"}'::jsonb
  );
  $$
);

-- Resumo do dia (23h - UTC-3 = 02h UTC do dia seguinte)
SELECT cron.schedule(
  'telegram-summary-notification',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT.supabase.co/functions/v1/send-telegram-notifications',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"type": "summary", "userId": "<TELEGRAM_CHAT_ID>"}'::jsonb
  );
  $$
);
```

**IMPORTANTE:** Substitua `SEU_PROJECT` pela sua URL real!

---

## âœ… PASSO 6: Testar!

No Telegram, procure seu bot e envie:

```
/start
```

Deve receber a mensagem de boas-vindas!

**Comandos para testar:**

- `/tarefas` - Ver suas tarefas
- `/adicionar Testar bot` - Criar tarefa
- `/progresso` - Ver progresso
- `/completar 1` - Marcar como concluÃ­da

**Testar IA:**
Envie qualquer mensagem:

- "Me ajuda a organizar minha semana"
- "Como estÃ¡ meu desempenho?"
- "Sugira tarefas para estudar"

---

## ðŸ”§ Verificar Jobs CRON

```sql
-- Ver jobs agendados
SELECT * FROM cron.job;

-- Ver histÃ³rico de execuÃ§Ãµes
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Remover job (se precisar)
SELECT cron.unschedule('nome-do-job');
```

---

## ðŸŽ¯ Recursos Implementados:

### Bot Commands:

- âœ… `/start` - InÃ­cio e ajuda
- âœ… `/tarefas` - Lista completa de tarefas
- âœ… `/adicionar [texto]` - Criar tarefa
- âœ… `/completar [nÃºmero]` - Marcar como concluÃ­da
- âœ… `/progresso` - Ver estatÃ­sticas do dia

### IA Natural:

- âœ… Processamento com Gemini Pro
- âœ… Respostas contextuais baseadas nas suas tarefas
- âœ… SugestÃµes inteligentes
- âœ… AnÃ¡lise de produtividade

### NotificaÃ§Ãµes AutomÃ¡ticas:

- âœ… 09:00 - Bom dia + lista de tarefas
- âœ… 15:00 - Check de progresso
- âœ… 20:00 - Ãšltima chance
- âœ… 23:00 - Resumo completo do dia

---

## ðŸ› Troubleshooting:

**Bot nÃ£o responde:**

```bash
# Verificar webhook
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"

# Ver logs da funÃ§Ã£o
supabase functions logs telegram-bot
```

**NotificaÃ§Ãµes nÃ£o chegam:**

```sql
-- Ver se os jobs estÃ£o rodando
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

**IA nÃ£o funciona:**

- Verifique a Gemini API Key em: https://aistudio.google.com/app/apikey
- Veja os logs: `supabase functions logs telegram-bot`

---

## ðŸ“Š PrÃ³ximos Passos (Opcional):

1. **Adicionar mais comandos:**
   - `/semana` - VisÃ£o semanal
   - `/habitos` - Acompanhar hÃ¡bitos
   - `/analytics` - AnÃ¡lise completa

2. **NotificaÃ§Ãµes customizÃ¡veis:**
   - Escolher horÃ¡rios
   - Ativar/desativar tipos

3. **IA mais avanÃ§ada:**
   - AnÃ¡lise de padrÃµes
   - SugestÃµes personalizadas
   - Coaching de produtividade

Me avisa quando terminar o setup para continuar evoluindo! ðŸš€

