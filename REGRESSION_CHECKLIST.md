# Regressão Manual (Flowly)

## 1. Auth

- Abrir app sem sessão: modal de login aparece com role="dialog" + aria-modal.
- Tab através do modal: foco navega por email, senha, "manter conectado", "Entrar", "Criar conta".
- Erros aparecem em `#authMessage` (anunciado por screen reader via aria-live).
- Fazer login: modal some, dados carregam.
- Logout: volta para login e recarrega.

## 2. Tarefas

- Criar tarefa em Hoje/Semana.
- Editar texto e marcar/desmarcar.
- Mover via drag-and-drop entre dias/períodos.
- Excluir tarefa e validar remoção visual.
- Toolbar de edição (`#editToolbar`) aparece com aria-label e ícones com aria-hidden.

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
- Trocar tabs várias vezes — handlers NÃO devem acumular (sem clique duplicado).

## 6. PWA/Offline

- Registrar service worker sem erro (cache `flowly-static-v17`).
- Reabrir app offline e validar carregamento de shell.
- Limpar cache antigo: verificar no DevTools > Application que apenas v17 existe.

## 7. Sync/Realtime

- Alterar tarefa em uma aba e observar atualização na outra (se suportado).
- Rodar "Corrigir Banco" e validar sucesso.
- Desconectar internet durante o uso: sync status muda para "offline".
- Forçar erro de Supabase: sync status muda para "Erro ao sincronizar".
- Realtime reload falha: status mostra "Erro ao recarregar dados".

## 8. Mobile (viewport ≤ 768px)

- Sidebar desktop some, bottom nav aparece.
- Cada botão da bottom nav tem aria-label legível (Semana, Analytics, Finanças, Projetos, Hoje, Sexta, Ajustes).
- Safe area inferior respeitada (sem botão escondido pela barra de gestos do iOS).

## 9. Projects

- Modal "Novo projeto" abre com close button acessível (× com aria-label).
- Inputs do modal usam `.finance-input` e tokens (visual consistente com finance view).
- Esc não fecha modal (comportamento atual — futuro: adicionar).

## 10. Sanidade Técnica

- `npm run check` (syntax)
- `npm test` (vm-based)
- `npm run lint` (ESLint flat config)
- `npm run smoke` (browser-based, requer Edge/Chrome em Windows)
