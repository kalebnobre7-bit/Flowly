# Flowly — Plano Consolidado (pós-auditoria)

Baseado em `AUDIT_NOTES.md`. Organizado por **fases de execução**, cada uma com escopo, motivação e checkpoints. A ideia é atacar **primeiro o que bloqueia** (bugs críticos) e depois subir o padrão visual em ondas, deixando por último a reestruturação de Projetos (Trello).

---

## Fase 0 — Saneamento crítico (bugs bloqueantes)

**Por quê primeiro:** o resto fica difícil de validar enquanto houver overflow, mojibake e ícones faltando.

### 0.1 Corrigir encoding (mojibake) no código-fonte — **P0**
- 23 ocorrências em `js/flowly-state.js`, `js/flowly-utils.js`, `js/views/analytics.js`, `js/views/routine.js` (e mais encontradas em `js/views/finance.js`, projetos, settings IA prompt).
- Estratégia: script de substituição determinística (e.g. `Ã¡→á`, `Ã£→ã`, `Ã©→é`, `Ã§→ç`, `Ã­→í`, `Ã³→ó`, `Ã´→ô`, `Ãµ→õ`, `Ãº→ú`, `Ã¢→â`, `Ã€→À`, `Ã‡→Ç`) aplicado só em arquivos JS/HTML que já têm mojibake detectado.
- Adicionar **BOM/UTF-8 guard**: garantir que `index.html` declara `<meta charset="utf-8">` e que o servidor (vite/preview) serve com `Content-Type: text/html; charset=utf-8`.
- Após conversão, revisar strings corrigidas (não fazer replace cego em textos legítimos).

### 0.2 Corrigir overflow horizontal em Finanças — **P0**
- `views-redesign.css:78-83` — trocar `grid-template-columns: 1fr 340px` por `grid-template-columns: minmax(0, 1fr) 340px`.
- Adicionar `min-width: 0` e `overflow: hidden` na coluna principal (`.finance-main-content` ou equivalente).
- Truncar/quebrar descrições longas em `Movimentações recentes` — `word-break: break-word` ou `text-overflow: ellipsis` com `white-space: nowrap` + `title` attribute com o valor completo.
- Verificar também `.finance-dual-grid`, `.finance-kpi-row` para casos similares.
- Teste em 1024 / 1280 / 1449 / 1920 — botão "Salvar" do form deve estar visível em todos.

### 0.3 Corrigir ícones ausentes em Rotina/Analytics — **P0**
- Investigar: `lucide.createIcons()` provavelmente não está sendo chamado após re-render da aba Rotina; ou nomes de ícone inválidos.
- Rotinas afetadas: streak badge "? 4 dias", stat cards (STREAK/SEMANA/30 DIAS/MELHOR DIA), TAREFAS POR PERÍODO, HÁBITOS DE HOJE streak counters.
- Após fix: rodar visual check em cada aba que usa ícones dinâmicos.

**Checkpoint Fase 0:** abrir cada view, conferir que nenhum caractere mojibake aparece, que Finanças não tem overflow em 1280/1449, e que ícones renderizam em Rotina.

---

## Fase 1 — Padrão de header e navegação unificado

**Por quê:** cada aba ainda tem header próprio. Unificar dá a base visual que o usuário quer ("padrão do começo ao fim").

### 1.1 Migrar Analytics + Rotina para `.flowly-page-header`
- Hoje Analytics usa `<h2>` gigante com tabs acima dele — reestruturar:
  - Título "Analytics" / "Rotina" em `h1` dentro de `.flowly-page-header__title`.
  - Subtítulo (data / escopo) em `.flowly-page-header__subtitle`.
  - Tab strip (Rotina/Analytics) vai para `.flowly-page-header__actions` OU vira uma faixa secundária logo abaixo (segmented control consistente).
- Rotina: consolidar o segmentado "Hoje/Semana/Mensal" dentro do header também.

### 1.2 Ajustar header de Sexta
- Hoje já usa `.flowly-page-header`, mas tem muitas camadas de eyebrow internas (SEXTA → MODO DA ASSISTENTE → Sala de operação → OPERAÇÃO). Reduzir para no máximo 2 níveis: page header + section header.
- Move "MODO LOCAL FLOWLY" chip + "Conectar IA" button para `__actions`.

### 1.3 Ajustar header de Finanças
- Eyebrow "PAINEL FINANCEIRO" + título + subtítulo + pill contadora + chip "Importado em …" — unificar no padrão: eyebrow pode ir para um `.flowly-page-header__eyebrow` novo, pills e chips para `__actions`.
- Ocultar/renomear "Importado em …" — se é metadata de import, move para Ajustes > Dados, não para o header.

### 1.4 Ajustar header de Ajustes
- "CENTRO DE AJUSTES" eyebrow + "Configurações" — simplificar.
- "FLOWLY v1.2 / Sincronizado via Supabase" vai para `__actions`.
- Remover sidebar "Leitura rápida" (redundante com tab nav principal).

**Checkpoint Fase 1:** abrir cada view e comparar headers lado-a-lado — mesma hierarquia, mesmo spacing, mesmos tipos de token em `__actions`.

---

## Fase 2 — Cards e componentes secundários consistentes

### 2.1 Unificar KPI cards de Analytics com `.flowly-stat-card`
- Hoje/Finanças já usam `.flowly-stat-card` (border-top colorido). Analytics usa um treatment custom (gradient glow).
- Migrar os 4 cards PERFORMANCE HOJE / RITMO SEMANAL / CONSISTÊNCIA / CAPACIDADE para `.flowly-stat-card` com modifiers semânticos.
- Rotina KPIs (STREAK/SEMANA/30 DIAS/MELHOR DIA) idem.
- Sexta Contexto KPIs (HOJE/CAIXA/PROJETOS/SEMANA) idem.

### 2.2 Unificar pills / chips / botões ghost
- Hoje: "Modo foco" é botão ghost mas parece texto solto — adicionar modificador `.flowly-btn--ghost--subtle` com bg `rgba(255,255,255,0.04)` e border `1px solid var(--ds-border-subtle)` para dar peso visual sem virar primary.
- Smart Week button (icon-only zap) — adicionar tooltip + label visível em telas largas.
- Projetos "Rapido" / filtros — revisar se todos usam `.flowly-btn` tokens.

### 2.3 Revisar modals
- Mês "Adicionar evento" e Projetos "Detalhes do projeto" usam visual language levemente diferente. Criar `.flowly-modal` + `.flowly-modal__header/__body/__footer` + `.flowly-modal__close` unificados.
- Aumentar contraste do botão close `×` (atualmente quase invisível).

### 2.4 Task color affordance
- Hoje/Semana: tarefas com `color: var(--accent-blue)` inline parecem links. Substituir por **pill colorida à esquerda** (border-left ou dot indicator) em vez de colorir o texto inteiro. Preserva cor da categoria sem quebrar leitura.
- Adicionar legenda em Semana: "Cores = categoria" ou similar.

### 2.5 "Today" highlight real em Semana
- `.day-column.today-active` não tem distinção visual. Adicionar:
  - `border-top: 2px solid var(--accent-primary)` no header do column
  - bg ligeiramente mais claro no column body
  - o número do dia em cor primária

### 2.6 Quick-task input em Semana mais descobrível
- Hoje é praticamente invisível. Adicionar `background: rgba(255,255,255,0.02)` + `border: 1px dashed var(--ds-border)` no `.quick-task-container` em estado idle. Focus dá border sólida + bg mais denso.

**Checkpoint Fase 2:** audit visual de Hoje, Semana, Analytics, Finanças, Sexta lado-a-lado — mesmo surface treatment para cards, mesmo peso de botões, mesma linguagem de pills.

---

## Fase 3 — Refactor Finanças e Ajustes (escopo do que funciona)

### 3.1 Finanças — empty states com CTA
- "De onde vem" / "Pra onde vai" / "Fluxo do mês" — adicionar botão primário "Adicionar primeira transação" em cada empty state.
- Form "Lançar" no sidebar pode virar o primary action se o usuário ainda não tem dados.

### 3.2 Finanças — simplificar lista de Movimentações
- Raw bank data (PIX details, CNPJ, agência, conta) polui a linha. Mostrar só: descrição curta + categoria + valor, com um ícone "detalhes" que expande o restante.

### 3.3 Ajustes — remover features inúteis
- Tab **App** → remover toggle "Feedback háptico" (mobile-only, escopo desktop). Mover "Animação hover semanal" para uma seção `Movimento` junto com futuras animações (ou um toggle geral "Motion").
- Tab **Conta** → consolidar com perfil em geral; tab dedicada é desperdício para 1 input.
- Tab **Notificações** → gate tudo atrás do estado de permissão do browser. Se permission="denied", mostrar card "Notificações bloqueadas — abra ajustes do navegador para liberar" e esconder templates/times. Se permission="default", mostrar apenas CTA "Pedir permissão". Se permission="granted", mostrar controles completos.
- Tab **IA** → se "Ativar conector externo" off, colapsar form e mostrar apenas o CTA toggle. Telegram card idem — esconder quando desligado.
- Tab **Dados** → log de sync reduz para agrupar eventos idênticos com contador (e.g. "12× Sincronização pendente · último 19:05").

### 3.4 Ajustes — remover sidebar "Leitura rápida"
- Duplica a tab nav superior. Ganhar espaço para conteúdo principal.

**Checkpoint Fase 3:** cada tab do Ajustes mostra só o que é acionável no momento; finanças tem CTA óbvio em cada empty state.

---

## Fase 4 — Projetos Kanban / Trello (maior esforço)

**Por quê por último:** é o único refactor estrutural grande. Depende de que o resto do app já esteja com padrão estável, senão fica isolado.

### 4.1 Escopo
- Substituir lista filtrada por **board kanban horizontal** com colunas: `A fazer` / `Em andamento` / `Em atraso` / `Aguardando pagamento` / `Concluído` / `Arquivado`.
- Cada projeto vira um **card arrastável** entre colunas.
- Card compacto: nome, cliente, progress bar `3/4 tarefas`, status pill, valor previsto, avatar.
- Drag-and-drop via HTML5 DnD API (consistente com drag já existente em tarefas).

### 4.2 Sub-componentes novos
- `.kanban-board` (container horizontal scroll)
- `.kanban-column` (título + contador + lista de cards + "+ Adicionar" footer)
- `.kanban-card` (draggable, compacto)
- Reaproveitar `.flowly-page-header` no topo + quick-create no header (botão "+ Novo projeto").

### 4.3 Sidebar "Leitura rápida"
- Mover stats (Ativos / Atrasados / Não pagos / Receita) para uma faixa de stats acima do board (usando `.flowly-stat-strip` + `.flowly-stat-card--inline`).
- Remover sidebar fixa — dá mais largura para o board.

### 4.4 Modal "Detalhes do projeto"
- Manter estrutura, mas adotar `.flowly-modal` unificado (Fase 2.3).
- Corrigir mojibake nos placeholders.

### 4.5 Migration
- Mapear status atuais (Ativo/Atrasado/Não pago/Concluído/Template/Arquivado) para colunas — decidir se Template vira coluna separada ou aba secundária.
- Manter compatibilidade com dados existentes (1 projeto "Léo do Cavaco" Atrasado).

**Checkpoint Fase 4:** criar, arrastar, editar e arquivar projeto funcionam. Board aguenta ~50 projetos sem degradar.

---

## Fase 5 — Sistema de personalização (alavanca para o futuro)

**Por quê:** o usuário já mencionou que quer "opções de personalização depois que alterem o visual completo". A aba Ajustes > Personalização já tem a UI — falta garantir que os tokens realmente trocam tudo.

### 5.1 Token audit
- Listar todos os tokens `--flowly-*` / `--ds-*` usados em cada view.
- Garantir que cada superfície, border, radius, padding usa tokens (sem valores fixos `px` ou `hex` hardcoded).
- Reescrever `styles.css`, `bento-theme.css`, `flowly-design-system.css`, `views-redesign.css` para consolidar num único arquivo `flowly-tokens.css` + `flowly-components.css`.

### 5.2 Presets
- Personalização já tem presets de tipografia, arredondamento, etc. Expandir para: `Preset clássico`, `Preset compacto`, `Preset editorial` — cada um muda combinação de tokens.
- Salvar preset ativo em localStorage.

### 5.3 Remover CSS duplicado / morto
- Dead CSS detection no final (runtime coverage com Chrome DevTools).
- Consolidar `!important` overrides.

**Checkpoint Fase 5:** user pode alternar entre 3 presets e **o app inteiro muda** — cores, fontes, radii, spacing. Nenhuma view tem tratamento custom que escape dos tokens.

---

## Resumo — ordem sugerida de execução

1. **Fase 0** (1-2 sessões): mojibake + overflow + ícones. Tira o app do estado "tem bug visível".
2. **Fase 1** (1 sessão): headers unificados em todas as views.
3. **Fase 2** (2 sessões): cards + pills + modals + task colors + today highlight + quick-task.
4. **Fase 3** (1-2 sessões): finanças empty states + Ajustes limpeza.
5. **Fase 4** (3-4 sessões): Projetos Kanban. Maior esforço.
6. **Fase 5** (2-3 sessões): Token audit e presets.

Total aproximado: 10-14 sessões de trabalho, com checkpoints visuais a cada fase.

---

## O que NÃO fazer agora

- **Não** migrar para framework (React/Vue) — fora de escopo.
- **Não** remover o service worker ou mudar arquitetura de sync.
- **Não** redesenhar icones — usar lucide existente, só garantir render.
- **Não** remover a `max-width: 1400px` global sem validar com o usuário (é uma decisão de design).
- **Não** mexer em `sexta-ai` backend, bot Telegram, ou Supabase schema.

---

## Pendências para confirmar com o usuário antes de executar

1. **Ordem de prioridade**: começar pela Fase 0 faz sentido ou prefere outra ordem?
2. **Projetos Kanban**: as 6 colunas sugeridas cobrem os estados atuais? Alguma faltando?
3. **Ajustes — Telegram / IA externo**: manter e esconder quando off, ou remover completamente se não usa?
4. **max-width 1400**: soltar para ultrawide ou manter o cap?
5. **Mobile bottom nav**: remover de vez do HTML já que scope é desktop?
