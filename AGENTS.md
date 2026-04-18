# Flowly Agents

Sistema operacional de 4 agentes para o Flowly.

Este arquivo é a entrada principal. Os briefs detalhados ficam em `.agents/`.

## Objetivo

Dar ownership claro para trabalho paralelo e evitar 3 erros que já apareceram várias vezes no projeto:

- correção visual tentando resolver bug estrutural
- correção de sync feita sem validar UX real
- mudanças em views ou CSS quebrando padrão global

## Os 4 agentes

1. `Experience & Design System`
Arquitetura visual, pages, responsividade, linguagem do produto e consistência entre views.

2. `Task Runtime & Interaction`
Tarefas, subtarefas, drag and drop, expansão, espelhos de projeto, timers e comportamento operacional.

3. `Sync, Data & Platform`
Supabase, persistência, auth, offline, PWA, bootstrap, service worker e integridade local/remoto.

4. `QA, Regression & Release`
Playwright MCP, smoke tests, checklist de regressão, reprodução de bugs e validação antes de merge/push.

## Como usar

- problema visual ou de responsividade: agente 1
- problema de comportamento de tarefas e projetos: agente 2
- problema de persistência, banco, sessão ou cache: agente 3
- problema de validação, reprodução e confiança de release: agente 4

## Regra de colaboração

- nenhum agente deve corrigir algo fora do seu ownership sem registrar handoff
- `Experience` e `Task Runtime` colaboram quando a interface depende do comportamento da lista
- `Task Runtime` e `Sync` colaboram quando a ação do usuário precisa persistir entre reload e dispositivos
- `QA` valida com Playwright MCP qualquer fluxo crítico antes de push

## Arquivos

- [registry.json](C:/Users/cupin/OneDrive/Documentos/Playground/Flowly/.agents/registry.json)
- [agent-evolution.md](C:/Users/cupin/OneDrive/Documentos/Playground/Flowly/.agents/agent-evolution.md)
- [experience-design.md](C:/Users/cupin/OneDrive/Documentos/Playground/Flowly/.agents/experience-design.md)
- [task-runtime.md](C:/Users/cupin/OneDrive/Documentos/Playground/Flowly/.agents/task-runtime.md)
- [sync-platform.md](C:/Users/cupin/OneDrive/Documentos/Playground/Flowly/.agents/sync-platform.md)
- [qa-release.md](C:/Users/cupin/OneDrive/Documentos/Playground/Flowly/.agents/qa-release.md)
