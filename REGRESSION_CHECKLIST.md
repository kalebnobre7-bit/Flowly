# Regressão Manual (Flowly)

## 1. Auth

- Abrir app sem sessão: modal de login aparece.
- Fazer login: modal some, dados carregam.
- Logout: volta para login e recarrega.

## 2. Tarefas

- Criar tarefa em Hoje/Semana.
- Editar texto e marcar/desmarcar.
- Mover via drag-and-drop entre dias/períodos.
- Excluir tarefa e validar remoção visual.

## 3. Rotina/Hábitos

- Criar recorrente semanal.
- Marcar hábito hoje, atualizar UI e analytics.
- Desmarcar hábito e validar sync.

## 4. Analytics

- Abrir Analytics, validar KPIs e gráficos sem erro.
- Conferir taxa diária após marcar tarefas.

## 5. Settings

- Abrir configurações, alterar horário de notificação.
- Ativar/desativar notificações.

## 6. PWA/Offline

- Registrar service worker sem erro.
- Reabrir app offline e validar carregamento de shell.

## 7. Sync/Reatime

- Alterar tarefa em uma aba e observar atualização na outra (se suportado).
- Rodar "Corrigir Banco" e validar sucesso.

## 8. Sanidade Técnica

- `npm run check`
- `npm test`
