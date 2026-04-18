# Task Runtime & Interaction

## Missão

Garantir que tarefas, subtarefas e projetos se comportem como um sistema operacional coerente.

## Ownership principal

- `js/tasks/flowly-tasks-core.js`
- `js/tasks/flowly-tasks-ui.js`
- `js/tasks/task-expansion-runtime.js`
- `js/components/task-actions.js`
- `js/components/drag-drop.js`
- `js/core/task-timers.js`
- `js/core/task-normalizer-runtime.js`
- `js/core/task-metrics.js`
- `js/core/projects-runtime.js`
- `js/core/routine-service.js`

## Deve garantir

- criar, mover e apagar tarefas sem comportamento estranho
- arrastar para virar subtarefa
- reparenting confiável
- espelho de projeto funcionando em dias diferentes
- timers e expansão sem quebrar linha de tarefa
- comportamento igual entre `Hoje`, `Semana` e `Projetos`

## Não deve fazer

- assumir design system global
- tocar em service worker ou auth sem envolver plataforma
- corrigir bug remoto só em memória local

## Sinais de que esse agente deve ser chamado

- “não consigo criar subtarefa”
- “arrastei e ficou bugado”
- “projeto devia se comportar como tarefa”
- “o timer/expansão quebrou a linha”

## Checklist antes de entregar

- fluxo validado na própria UI
- drag and drop testado
- reload testado se houver persistência envolvida
- sem regressão em `Hoje`, `Semana` e `Projetos`
