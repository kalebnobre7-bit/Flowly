# Manifest + Telegram no Flowly

Esta integraÃ§Ã£o coloca a IA do Sexta no servidor e liga o bot do Telegram sem expor chaves no navegador.

## O que foi adicionado

- `supabase/functions/sexta-ai`
- `supabase/functions/telegram-link`
- `supabase/functions/telegram-bot`
- `public.telegram_connections`

## Secrets necessÃ¡rios

Configure no Supabase:

- `FLOWLY_MANIFEST_API_KEY`
- `FLOWLY_MANIFEST_BASE_URL`
- `FLOWLY_MANIFEST_MODEL`
- `FLOWLY_TELEGRAM_BOT_TOKEN`
- `FLOWLY_TELEGRAM_WEBHOOK_SECRET`

## Deploy

1. Aplicar migrations do diretÃ³rio `supabase/migrations`.
2. Publicar as funÃ§Ãµes `sexta-ai`, `telegram-link` e `telegram-bot`.
3. No Flowly, abrir `Ajustes > IA`.
4. Clicar em `Usar preset Manifest`.
5. Clicar em `Registrar webhook`.
6. Clicar em `Gerar codigo`.
7. No Telegram, enviar:

```text
/start CODIGO
```

## ObservaÃ§Ãµes

- A chave do Manifest nÃ£o fica mais no `localStorage`.
- O bot do Telegram sÃ³ responde com contexto real depois do vÃ­nculo com cÃ³digo temporÃ¡rio.
- Se a IA remota falhar no navegador, o Sexta continua caindo para a resposta local do Flowly.
