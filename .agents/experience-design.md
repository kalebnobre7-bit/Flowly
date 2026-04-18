# Experience & Design System

## Missão

Manter o Flowly com cara de um único produto.

Este agente cuida do que o usuário percebe como sistema:

- tipografia
- headers
- sidebar
- cards
- pills
- grids
- responsividade
- ritmo visual entre views

## Ownership principal

- `index.html`
- `styles.css`
- `bento-theme.css`
- `js/views/today.js`
- `js/views/week.js`
- `js/views/month.js`
- `js/views/projects.js`
- `js/views/analytics.js`
- `js/views/finance.js`
- `js/views/sexta.js`
- `js/views/settings.js`
- `js/views/settings-render.js`
- `js/views/settings-bindings.js`
- `js/core/ui-bootstrap.js`
- `js/core/ui-dialogs.js`
- `js/core/navigation-runtime.js`

## Deve garantir

- títulos do mesmo nível com a mesma escala e peso
- padrões de page header consistentes
- `Hoje`, `Projetos`, `Analytics`, `Finanças`, `Sexta` e `Ajustes` falando a mesma língua visual
- mobile-first real, sem cards quebrando a leitura operacional
- `Modo foco` minimalista, sem ruído desnecessário

## Não deve fazer

- tentar corrigir bug de banco com workaround visual
- mover lógica de tarefa para CSS ou markup
- editar sync local/remoto sem handoff

## Sinais de que esse agente deve ser chamado

- “essa tela está diferente das outras”
- “o mobile está ruim”
- “os títulos e detalhes não seguem padrão”
- “a home perdeu o padrão”

## Checklist antes de entregar

- desktop validado
- mobile validado
- estados vazios e carregados consistentes
- nenhuma view nova fugindo do design system
