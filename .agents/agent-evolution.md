# Agent Evolution Log

Este arquivo existe para evitar que os agentes virem um documento estático.

## Como atualizar

Depois de qualquer bug relevante ou refactor grande, registrar:

1. o que quebrou
2. qual agente deveria ter percebido isso antes
3. o que precisa mudar no briefing
4. se houve conflito de ownership

## Template

```md
## YYYY-MM-DD - Título curto

- Sintoma:
- Causa real:
- Agente responsável:
- Ajuste de briefing:
- Ajuste de ownership:
- Teste de regressão criado:
```

## Entradas iniciais

## 2026-03-31 - Persistência de exclusão vs. runtime visual

- Sintoma: tarefa apagada voltava após reload ou em outro dispositivo
- Causa real: sync local/remoto e limpeza de fila pendente não estavam blindados o suficiente
- Agente responsável: `Sync, Data & Platform`
- Ajuste de briefing: toda exclusão crítica deve ser validada com reload e verificação remota
- Ajuste de ownership: manter fila pendente, merge local e service worker claramente com o agente de plataforma
- Teste de regressão criado: smoke de criar, apagar e recarregar

## 2026-03-31 - Regressão visual da Home

- Sintoma: `Modo foco` e cabeçalho de `Hoje` fugiram do padrão esperado
- Causa real: redesign feito sem contrato visual fechado e sem auditoria suficiente de layout
- Agente responsável: `Experience & Design System`
- Ajuste de briefing: `Modo foco` deve ser tratado como variante do mesmo sistema, não como layout paralelo
- Ajuste de ownership: qualquer mudança de shell em `today.js` precisa de revalidação desktop e mobile
- Teste de regressão criado: auditoria visual com Playwright MCP
