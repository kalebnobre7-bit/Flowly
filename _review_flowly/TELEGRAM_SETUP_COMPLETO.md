# 🤖 SETUP COMPLETO: Telegram Bot + IA Gemini

## ✅ Informações Configuradas:

- **Bot Token:** `8359178148:AAGMuyNm9iwPhd0K9Eu6yXXRmIPbCsFuoo0`
- **Gemini API:** `AIzaSyB6bdmWJv-_g-whBsPjXBiUWRfayw941Ok`
- **Seu Chat ID:** `5524418615`

---

## 🚀 PASSO 1: Instalar Supabase CLI

```bash
# Windows (PowerShell como Admin):
npm install -g supabase

# OU usando Scoop:
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

---

## 🔗 PASSO 2: Conectar ao Supabase

1. Acesse: https://supabase.com/dashboard
2. Abra seu projeto Flowly
3. Vá em **Settings → General**
4. Copie o **Project Reference ID** (aparece na URL, tipo: `abcdefghijk`)

```bash
# Login no Supabase
supabase login

# Link com seu projeto (substitua o ID)
cd C:\Users\cupin\OneDrive\Desktop\Flowly-main\Flowly-main
supabase link --project-ref SEU_PROJECT_ID
```

---

## 📤 PASSO 3: Deploy das Edge Functions

```bash
# Deploy do bot principal
supabase functions deploy telegram-bot --no-verify-jwt

# Deploy do sistema de notificações
supabase functions deploy send-telegram-notifications --no-verify-jwt
```

Anote as URLs que aparecerem! Serão algo como:

- `https://SEU_PROJECT.supabase.co/functions/v1/telegram-bot`
- `https://SEU_PROJECT.supabase.co/functions/v1/send-telegram-notifications`

---

## 🔔 PASSO 4: Configurar Webhook do Telegram

Substitua `SUA_URL` pela URL do passo anterior:

```bash
curl -X POST "https://api.telegram.org/bot8359178148:AAGMuyNm9iwPhd0K9Eu6yXXRmIPbCsFuoo0/setWebhook?url=https://SEU_PROJECT.supabase.co/functions/v1/telegram-bot"
```

**Verificar se funcionou:**

```bash
curl "https://api.telegram.org/bot8359178148:AAGMuyNm9iwPhd0K9Eu6yXXRmIPbCsFuoo0/getWebhookInfo"
```

Deve retornar: `"url": "sua-url-aqui"`

---

## ⏰ PASSO 5: Configurar Notificações Agendadas (CRON)

No Supabase Dashboard:

1. Vá em **Database → Extensions**
2. Habilite **pg_cron** (se não estiver habilitado)
3. Vá em **SQL Editor**
4. Cole e execute este código:

```sql
-- Notificação da manhã (9h - UTC-3 = 12h UTC)
SELECT cron.schedule(
  'telegram-morning-notification',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT.supabase.co/functions/v1/send-telegram-notifications',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"type": "morning", "userId": "5524418615"}'::jsonb
  );
  $$
);

-- Notificação da tarde (15h - UTC-3 = 18h UTC)
SELECT cron.schedule(
  'telegram-afternoon-notification',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT.supabase.co/functions/v1/send-telegram-notifications',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"type": "afternoon", "userId": "5524418615"}'::jsonb
  );
  $$
);

-- Notificação da noite (20h - UTC-3 = 23h UTC)
SELECT cron.schedule(
  'telegram-evening-notification',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT.supabase.co/functions/v1/send-telegram-notifications',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"type": "evening", "userId": "5524418615"}'::jsonb
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
    body := '{"type": "summary", "userId": "5524418615"}'::jsonb
  );
  $$
);
```

**IMPORTANTE:** Substitua `SEU_PROJECT` pela sua URL real!

---

## ✅ PASSO 6: Testar!

No Telegram, procure seu bot e envie:

```
/start
```

Deve receber a mensagem de boas-vindas!

**Comandos para testar:**

- `/tarefas` - Ver suas tarefas
- `/adicionar Testar bot` - Criar tarefa
- `/progresso` - Ver progresso
- `/completar 1` - Marcar como concluída

**Testar IA:**
Envie qualquer mensagem:

- "Me ajuda a organizar minha semana"
- "Como está meu desempenho?"
- "Sugira tarefas para estudar"

---

## 🔧 Verificar Jobs CRON

```sql
-- Ver jobs agendados
SELECT * FROM cron.job;

-- Ver histórico de execuções
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Remover job (se precisar)
SELECT cron.unschedule('nome-do-job');
```

---

## 🎯 Recursos Implementados:

### Bot Commands:

- ✅ `/start` - Início e ajuda
- ✅ `/tarefas` - Lista completa de tarefas
- ✅ `/adicionar [texto]` - Criar tarefa
- ✅ `/completar [número]` - Marcar como concluída
- ✅ `/progresso` - Ver estatísticas do dia

### IA Natural:

- ✅ Processamento com Gemini Pro
- ✅ Respostas contextuais baseadas nas suas tarefas
- ✅ Sugestões inteligentes
- ✅ Análise de produtividade

### Notificações Automáticas:

- ✅ 09:00 - Bom dia + lista de tarefas
- ✅ 15:00 - Check de progresso
- ✅ 20:00 - Última chance
- ✅ 23:00 - Resumo completo do dia

---

## 🐛 Troubleshooting:

**Bot não responde:**

```bash
# Verificar webhook
curl "https://api.telegram.org/bot8359178148:AAGMuyNm9iwPhd0K9Eu6yXXRmIPbCsFuoo0/getWebhookInfo"

# Ver logs da função
supabase functions logs telegram-bot
```

**Notificações não chegam:**

```sql
-- Ver se os jobs estão rodando
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

**IA não funciona:**

- Verifique a Gemini API Key em: https://aistudio.google.com/app/apikey
- Veja os logs: `supabase functions logs telegram-bot`

---

## 📊 Próximos Passos (Opcional):

1. **Adicionar mais comandos:**
   - `/semana` - Visão semanal
   - `/habitos` - Acompanhar hábitos
   - `/analytics` - Análise completa

2. **Notificações customizáveis:**
   - Escolher horários
   - Ativar/desativar tipos

3. **IA mais avançada:**
   - Análise de padrões
   - Sugestões personalizadas
   - Coaching de produtividade

Me avisa quando terminar o setup para continuar evoluindo! 🚀
