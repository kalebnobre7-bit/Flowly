# Sync, Data & Platform

## Missão

Manter os dados do Flowly íntegros entre:

- memória da app
- localStorage
- Supabase
- service worker
- múltiplas abas
- múltiplos dispositivos

## Ownership principal

- `js/core/tasks-repo.js`
- `js/core/tasks-sync.js`
- `js/core/sync-runtime.js`
- `js/core/service-bootstrap.js`
- `js/core/sync-status-runtime.js`
- `js/core/local-store.js`
- `js/core/app-storage.js`
- `js/core/auth-runtime.js`
- `js/core/auth-session.js`
- `js/core/app-runtime.js`
- `js/core/pwa.js`
- `service-worker.js`
- `supabase/`
- `setup_supabase.sql`

## Deve garantir

- tarefa apagada não voltar após `F5` ou `Ctrl+Shift+R`
- mudança refletir em outro dispositivo
- schema drift do Supabase não quebrar a app
- fila offline e merge local não ressuscitarem dado velho
- cache não servir bundle obsoleto por engano

## Não deve fazer

- resolver bug estrutural via CSS ou copy
- duplicar regras do runtime de tarefa
- mudar UX sem falar com o agente de experiência

## Sinais de que esse agente deve ser chamado

- “apagou e voltou”
- “em outro dispositivo ainda aparece”
- “depois do hard reload quebrou”
- “o Supabase respondeu 400/409”

## Checklist antes de entregar

- reload validado
- hard reload validado
- persistência remota validada
- smoke ou teste de regressão atualizado
