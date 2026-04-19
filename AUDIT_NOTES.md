# Flowly — Deep Audit Notes (2026-04-18)

Viewport: 1280×800 desktop. Dark theme. No mobile scope.

Severity: **P0** blocker · **P1** visible bug/UX · **P2** polish · **P3** nice-to-have

---

## 1. Hoje (Today)

### Observations
- Header (flowly-page-header) rendering clean: "Hoje" + date subtitle + "Modo foco" on the right.
- "Modo foco" button has **no visible button chrome** — renders as plain text against the dark bg. Almost invisible, no hover/active affordance visible.
- Stat strip (4 cols: HOJE / PROGRESSO / FOCO / PRÓXIMA AÇÃO) renders correctly.
- Task list section starts immediately after stat strip with **no heading or grouping label** ("Pendentes", "Hoje", "Rotina"…). Three tasks listed flat.
- **Large empty vertical band** between task list and bottom of viewport; lateral "Visão Geral" + "Esta Semana" cards are anchored to the right rail and leave huge dead space between them and the main column.
- "Oração e Salmo" task text is **blue/link-colored** (looks clickable as a link), but sibling tasks "Carta sobre esposa" / "Oferecer Site pro Jonhhy" are neutral. Inconsistent emphasis.
- Right-rail card "Média por tarefa: Sem base" — label wraps awkwardly.
- "Esta Semana" card shows a bar chart SEG-DOM. SÁB (today) shown as gray/inactive. Expected: today should be highlighted as active.

### Issues
- **P1** Modo foco button has no button chrome — looks like plain text (`[Hoje:Header]`)
- **P1** First task is blue (link style) — looks like an anchor, breaks consistency
- **P2** No group headers ("Pendentes" / "Rotina") in the task list — unclear why these are grouped together
- **P2** Today bar not highlighted in "Esta Semana" chart
- **P2** Large empty mid-column region (layout feels unbalanced)
- **P2** Lateral card "Média por tarefa: Sem base" — awkward wrap of label+value
- **P3** "streak zerado" hint could use more visual weight (user-facing metric)

### Interactions tested
- "Modo foco" toggle: **works** (flips `focusOnlyMode` in localStorage, re-renders, hides strip + sidebar cards, button label becomes green "Mostrar dados"). But layout reflows dramatically — content column goes from full-width to narrow centered, jarring visual jump.
- Task checkbox: works (applies `.task-completed` strikethrough, shows completion time on the right).
- Task label click: no edit/detail modal opens (only `.task-expansion` exists in DOM but doesn't become visible). No click-to-edit affordance.
- Tasks are `draggable="true"` with `tabindex=0` — drag-and-drop expected but not tested deeply in isolation.
- No visible quick-add / "new task" button in Hoje view. Only sidebar toggle + brand in top-left. Creating a task from Hoje requires context menu or external flow.
- Mobile bottom nav (`#btnMobileWeek` et al.) is in DOM but `md:hidden` — dead markup on desktop.

### Global Hoje issues
- **P1** No obvious "add task" affordance from Hoje — user can't create tasks here directly
- **P1** Click task label does nothing (expansion element exists but doesn't open) — expected edit/detail modal
- **P2** Focus-mode toggle reflows the whole column width (jarring)
- **P3** Tailwind CDN loaded in prod — warning in console (already known)

---

## 2. Semana (Week)

### Observations
- Header: "Semana" + subtitle ("Semana Atual" when current week, "20 de abr. - 26 de abr." for other weeks). Good.
- 7 day columns (Segunda-Domingo) in default mode.
- Smart week (5-day focus) works — subtitle becomes "Foco de 5 Dias", shows today+4. Zap icon turns green.
- Today column has class `.today-active` but **no visual highlight** — same background, no border, same header color as past/future. Indistinguishable.
- Task colors: blue (habit/routine), green-filled (completed), red/amber/orange (user color-coded). Meaning of colors unclear to user.
- Subtask pattern works: parent task (e.g. "PAI", "Pesquisa do LEO + finalizar") has `.task-collapse-btn` showing "▼ N" count with nested children that can collapse. Good feature.
- Quick-task add input exists at bottom of each column (placeholder "Escreva a tarefa..."). **Visually very subtle** — hard to spot. Uses a faux-checkbox placeholder square.
- Columns have lots of empty vertical space on lighter days (Sáb/Dom).

### Issues
- **P1** `today-active` column has zero visual distinction — today indicator is invisible
- **P1** Quick-task input at column bottom is nearly invisible — users may not discover it
- **P2** Task colors (blue/red/amber) have no legend, no explanation — users can't tell if these are habits, priorities, categories
- **P2** Smart week button (zap icon) is icon-only with no label — discoverability poor
- **P3** Nav buttons (prev/current/next) ghost-styled, low contrast — OK but could use more weight
- **P3** Empty columns look barren — no empty state text

---

## 3. Mês (Month)

### Observations
- Header: "Abril 2026" + "Visão mensal" + legend (Aniversário/Feriado/Importante/Lembrete colored dots) + "Hoje" button + prev/next arrows. Good.
- Finance strip: "Sem movimentações em Abril" — minimal empty state, no CTA.
- 6-row grid, day cells show number + percent completion bar (green).
- **Today highlight works** here (white border box on day 18). Good.
- Weekend headers (SÁB/DOM) are purple — good distinction.
- Holiday dot + label ("Tiradentes") on day 21 shows up correctly.
- Day click → navigates to Semana view.
- Hover affordance: each day has a `.mc-add-btn` (+) that's invisible until hover. Clicking opens "Adicionar evento" modal (TÍTULO / TIPO / Repetir todo ano / Cancelar-Salvar).
- Modal design uses darker gray panel with bright green Salvar button. Modal's style differs slightly from the main app surface treatment (separate visual language).

### Issues
- **P2** Finance strip is a bare text line — no KPI, no CTA to add transaction
- **P2** `mc-add-btn` invisible until hover — very hard to discover
- **P2** Modal "×" close in top-right is low-contrast and nearly invisible
- **P2** Modal styling (panel bg, button treatment) is inconsistent with app panels — feels like a separate design system
- **P3** "0%" shown on days with zero activity is visual noise (most of the month) — consider hiding or subduing
- **P3** No quick visual of which days have events/tasks at a glance — only percent bar (no dot density or preview)

---

## 4. Analytics (incl. Rotina tab)

### Analytics tab — Observations
- Tab strip "Rotina / Analytics" at top-left, but **above** the page title. Visually disconnected from the flowly-page-header pattern used elsewhere.
- Title "Analytics" uses a large bold typography (not the flowly-page-header `<h1>` style).
- 4 KPI cards (PERFORMANCE HOJE / RITMO SEMANAL / CONSISTÊNCIA / CAPACIDADE) with colored corner glow gradients. These do NOT use `.flowly-stat-card` — it's a separate custom pattern (different bg treatment, different label size, gradient accent).
- DESEMPENHO POR DIA: 7-day pill grid with today (SÁB) bordered correctly.
- PROGRESSO SEMANAL bar chart: fine.
- HÁBITOS HOJE donut: fine.
- VOLUME DIÁRIO - ABRIL line chart, RANKING DE HÁBITOS bar list, POR CATEGORIA, HEATMAP DE PRODUTIVIDADE — all present and rendering.
- ANÁLISE ESTRATÉGICA insight card at bottom.

### Rotina tab — Observations
- Same "Rotina / Analytics" tab strip.
- Title "Rotina" + subtitle ~"SÁbado, 18 de Abril" (**mojibake: 'SÃ¡bado'**).
- Segmented control top-right: "Hoje / Semana / Mensal" (scope selector).
- "PROGRESSO DO DIA" 0% donut with "4 dias consecutivos" streak badge — badge has **"?" instead of icon** (lucide not rendered or emoji fallback).
- 4 stat cards (STREAK 4 / SEMANA 82% / 30 DIAS 77% / MELHOR DIA Ter) — icons show as "?" placeholders above each stat.
- TAREFAS POR PERÍODO (Manhã/Tarde/Noite) — all show "??" icon placeholders, mojibake "ManhÃ£".
- HÁBITOS DE HOJE (mojibake "HÃ¡bitos"): long flat list of every habit occurrence repeated many times, with "?? 1d / 2d / 3d..." streak counter (missing icon).
- DISTRIBUIÇÃO POR CATEGORIA (mojibake "DISTRIBUIÃ§ÃEO") with single "Operational" category bar.
- "Gerenciar Hábitos →" CTA is plain text with arrow — no button chrome.

### Issues

**Critical — global encoding bug**
- **P0** Source code contains mojibake: 23 occurrences across `js/flowly-state.js`, `js/flowly-utils.js`, `js/views/analytics.js`, `js/views/routine.js`. Strings like `Hábitos`, `Manhã`, `Sábado`, `Período`, `Distribuição`, `concluídos` render as `HÃ¡bitos`, `ManhÃ£`, etc. Some files have mixed (correct + corrupt) strings — the source was saved under wrong encoding at some point.

**Critical — missing icons**
- **P0** Lucide icons not rendering in Rotina tab — shown as "?" placeholders (likely `lucide.createIcons()` not called after re-render, or icon names invalid). Affects streak badge, stat card icons, period icons, habit streak counters.

**Analytics design**
- **P1** Analytics title is not using `.flowly-page-header` — inconsistent with Hoje/Semana/Mês.
- **P1** Tab strip positioned above title disconnected from page header
- **P1** KPI cards do not use `.flowly-stat-card` — independent design with gradient glow. Inconsistent with unified stat pattern from Hoje/Finanças.
- **P2** Big raw number display ("0%", "110%", "48%", "11") with minimal supporting context — hard to tell what is good/bad.

**Rotina tab**
- **P1** "HÁBITOS DE HOJE" list shows every habit occurrence repeated (20+ rows of Oração e Salmo / Venvanse) — no grouping, high redundancy.
- **P1** "Gerenciar Hábitos →" is plain text (no button chrome) — should be a proper button.
- **P2** "PROGRESSO DO DIA" panel's huge right empty space — whitespace excessive.
- **P2** Scope segmented control "Hoje/Semana/Mensal" visually disconnected from title (floats top-right of a later section).

---

## 5. Finanças (Finance) — user-flagged OVERFLOW BUG

### Observations
- Header: "PAINEL FINANCEIRO" eyebrow (small uppercase) + "Finanças" title + subtitle "Entradas segurando o mês. Agora é identificar os motores que mais repetem." Below: "0 movimentações" pill + "Importado em 01/04/2026, 00:14:43" chip. Rich header, different from flowly-page-header pattern.
- 3 KPI cards (Entradas green, Saídas red, Saldo primary) use `.flowly-stat-card` with semantic border-top accents. **Matches unified pattern** (Phase 2 landing worked).
- "Fluxo do mês" chart empty state is centered. OK.
- Two-column body: transaction dual-grid ("De onde vem" / "Pra onde vai") + "Movimentações recentes" table.
- Right sidebar (`.finance-side-stack`, 340px wide): "Meta mensal" goal card, "Por categoria" chart card, "Projetos" shortcut card, "Lançar" entry form with Entrada/Valor/Categoria/Descrição/Vincular a tarefa/Vincular a projeto + Salvar button.

### Root cause of overflow (confirmed)
- **CSS grid template columns in `views-redesign.css:80`: `.finance-main-grid { grid-template-columns: 1fr 340px }`** — the `1fr` column doesn't use `minmax(0, 1fr)`, so when content (transaction table rows with long descriptions) has large `min-content`, the column grows beyond its share and pushes `.finance-side-stack` past the viewport right edge.
- Measured: grid container 1228px wide, but computed columns "1135.67px + 340px" = 1491px → 263px overflow. Side stack renders at x=1304 extending to x=1644 while viewport ends at 1449.
- Result: `.finance-side-stack` children (goal card, quick cards, form, Salvar button) are **cut off by ~195px on the right**.

### Issues
- **P0** Horizontal overflow — `.finance-main-grid` grid column sizing allows 1fr column to exceed its track. Fix: `grid-template-columns: minmax(0, 1fr) 340px`. Impacts: Meta mensal, Por categoria, Projetos shortcut, Lançar form with Salvar button — all partially hidden.
- **P0** Transaction entry "Salvar" button is cut off off-screen (right=1603, viewport=1449) — user cannot reliably click it.
- **P1** Transaction table rows have very long descriptions (bank transfer details, account numbers, etc.) — these long strings are what forces the 1fr column to blow out. Need `min-width: 0`, `word-break` or truncation on description cell.
- **P1** "Importado em 01/04/2026, 00:14:43" chip — what is this? Looks like CSV/bank import metadata but unclear to user; exposes internal state.
- **P1** Finance header has 3 layers (eyebrow + title + subtitle + pill + chip) — does NOT match `.flowly-page-header` pattern used in Hoje/Semana/Mês. Inconsistent visual hierarchy.
- **P2** Right sidebar ("Projetos" shortcut) is a feature cross-over from Projetos view — unclear why it lives in Finanças.
- **P2** "Sem entradas registradas ainda" / "Sem saídas registradas ainda" empty states are good, but no CTA button to add first transaction.
- **P2** Categoria dropdown (in Lançar form) — need to test if options exist.
- **P3** Movimentações list shows raw imported bank data verbatim — lots of visual noise (PIX details, CNPJ, agency numbers). Consider cleaner summarized display.

---

## 6. Projetos (user-flagged TRELLO GAP)

### Observations
- Header: "Projetos" + subtitle "1 projeto(s) em atraso. Precisam de resposta." + green "+ Novo projeto" button. Uses `.flowly-page-header` pattern — consistent.
- Filter segmented tabs (good pattern, `.flowly-segmented__item`): Todos 1, Ativos 1, Atrasados 1, **Nao pagos 1** (mojibake), **Concluidos 0** (mojibake), Templates 0, Arquivados 0.
- **Current layout: vertical list of project cards** with left-column cards + right-sidebar "Leitura rápida" stats + "Novo projeto" inline quick form. 
- Project card shows: name, client, type, status pill (Atrasado/Em aberto), progress bar with "9d atraso · 3/4 tarefas", R$ value, Detalhes link.
- "Detalhes" opens modal with form fields (Nome, Cliente, Tipo, Valor previsto, Prazo, Início), Pago/Template/Recolher subtarefas checkboxes, Notas operacionais, Checklist padrão textarea, Tarefas vinculadas list with Desvincular buttons.

### Issues

**Kanban gap (user's explicit requirement)**
- **P0** Not Trello/kanban style. User stated: "Aba de projetos era pra ser estilo trello." Current UX is filter-tab list. Need full structural rework: horizontal kanban columns by status (Ativo / Atrasado / Concluído / etc.), drag-and-drop between columns, card-per-project.

**Encoding**
- **P0** Mojibake across projects view: "Nao pagos" (→ Não pagos), "Concluidos" (→ Concluídos), "Rapido" button (→ Rápido), modal placeholders "Proximo passo" (→ Próximo passo), "observacoes" (→ observações), "Checklist padrao" (→ padrão).

**Design**
- **P1** "323 Tarefas sem contexto" in Leitura rápida — unclear label; users don't know what "contexto" means.
- **P1** Sidebar mixes read stats + quick create form — once kanban is in place, these need redesign.
- **P2** Project card action area uses "Detalhes" ghost button and status pill — when moving to kanban, card needs simpler footprint (drag handle, compact status).
- **P2** Project detail modal uses separate design language — align with unified panel surface.

---

## 7. Sexta (AI assistant)

### Observations
- Header: "SEXTA" eyebrow + "Sexta" title + subtitle + "MODO LOCAL FLOWLY" pill + "Conectar IA" pill button on right.
- "MODO DA ASSISTENTE" sub-panel with description + tab strip (Chat / Contexto / **Memoria** — mojibake).
- Tabs work: Chat shows chat area + ações rápidas + comando input; Contexto adds 4 KPI cards (HOJE / CAIXA / PROJETOS / SEMANA) + right panel "Contexto / Leitura do dia"; Memória shows "Memória operacional" right panel with PERFIL FIXO / MEMÓRIAS FIXAS / REGRAS DA SEXTA / COMANDOS E FORMATO textareas + Salvar briefing button + Limpar memória link.
- Chat message bubble from Sexta assistant renders clean with "modo local" subtext.
- Ações rápidas: Criar / Concluir / Mover / Apagar / Foco pill buttons.
- Comando input + Enviar green button + placeholder example.

### Issues
- **P1** Tab label "Memoria" (stripped accent, should be "Memória"). Also "3 memoria(s)" in status line (should be "memórias").
- **P1** 4 KPI cards only visible in Contexto tab — hidden in Chat/Memória. Inconsistent; these might be more valuable always-on.
- **P1** KPI cards in Sexta don't use `.flowly-stat-card` pattern — custom label/value/hint layout. Inconsistent.
- **P2** Multiple eyebrow levels (SEXTA → MODO DA ASSISTENTE → Sala de operação → OPERAÇÃO) — noisy visual hierarchy.
- **P2** "MODO LOCAL FLOWLY" and "Conectar IA" both look like pill buttons, but only one is interactive. Unclear state.
- **P2** Right-panel headings ("Contexto", "Memória operacional") use regular weight — visually outranked by card labels.
- **P3** "Limpar memória" is a plain text link (no confirm affordance shown) — destructive action needs guardrail.

---

## 8. Ajustes (user-flagged: UNNECESSARY + BROKEN features)

### Overall structure
- Header: "CENTRO DE AJUSTES" eyebrow + "Configurações" title + subtitle + "FLOWLY v1.2 / Sincronizado via Supabase" pill on right. Consistent pattern.
- Horizontal tab nav: ÁREA · Conta · Notificações · App · Personalização · IA · Operação · Dados (8 tabs).
- Right sidebar "Leitura rápida" with one-click jumps to each tab.

### Tab-by-tab

**Operação** (default)
- "Prioridades" panel: custom priority list with color dots (Dinheiro/Urgente/Importante/Simples) + Adicionar button. Fine.

**Conta**
- Very minimal: display name input, connected email readout, "Conta ativa" green pill, circle avatar.
- Takes a whole tab for 1 input. Could be collapsed with Notificações or simplified.

**Notificações**
- Toggle "Ativar notificações" (off).
- 3 time inputs: MANHÃ 08:30, MEIO-DIA 12:30, NOITE 23:00.
- Inatividade toggle + LIMITE (MIN) 150 input.
- Notificação de progresso toggle.
- 5 message templates (MANHÃ/MEIO-DIA/NOITE/INATIVIDADE/PROGRESSO) with {variable} tokens.
- "Variáveis: {completed}, {total}, {pending}, {percentage}, {avgDuration}, {totalDuration}, {bestPeriod}" reference.
- Right panel "Status": Permissão INATIVO (red pill) + "Permissão bloqueada no navegador" + "Ambiente seguro detectado (HTTPS/localhost)" + "Enviar notificação de teste" button.

**App**
- INÍCIO DA SEMANA: Segunda dropdown.
- Fins de semana toggle.
- **Feedback háptico toggle** — mobile-only feature, useless on desktop-only scope.
- Animação hover semanal toggle.

**Personalização** (most substantive tab)
- COR PRIMÁRIA / COR SECUNDÁRIA color pickers.
- FONTE BASE: 10 options (SISTEMA, HUMANISTA, GEOMÉTRICA, MODERNA, GROTESCA, EDITORIAL, MONO, INDUSTRIAL, …).
- ARREDONDAMENTO: SECO/COMPACTO/SUAVE/ARREDONDADO/ORGÂNICO (5 options, 10-32px).
- LARGURA DA APP: FOCADA (1100px).
- ESTILO DOS PAINÉIS: PLANO / SUAVE.
- FUNDO E AMBIENTE: SUAVE / VÍVIDO / FLUTUANTE.
- BORDAS: INVISÍVEL / SUTIL / DEFINIDA / MARCADA.
- PREVIEW ATIVO "Flowly do seu jeito" with Primária/Secundária buttons.
- "Restaurar visual padrão" link.

**IA**
- "Ativar conector externo" toggle (off).
- "Usar preset Manifest" link.
- PROVEDOR: Local Flowly dropdown; MODELO: flowly-local-ops; ENDPOINT/EDGE FUNCTION textbox; PROMPT BASE DA SEXTA textarea.
- Mojibake in prompt: "Voce e a Sexta", "execucao".
- Right sidebar: Status da Sexta (MODO ATUAL Local Flowly, 3 numbered CTAs) + Telegram bot card showing "Bot vinculado com @b333961 · chat *****8615".

**Dados**
- 4 action tiles: Exportar Backup (green), Importar Backup (blue), Corrigir Banco (orange), Limpar Tudo (red).
- Right: "Histórico de sync" log (EVENTOS RECENTES QUEUE "Sincronizacao pendente agendada" — **mojibake** "Sincronização").

### Issues

**Broken / dead features (user flagged)**
- **P1** Feedback háptico toggle (App tab) — mobile-only, useless on desktop-only app. Remove or gate behind mobile detection.
- **P1** Notifications permission state "bloqueada" blocks everything in Notificações tab — but the 5 template editors, 3 time inputs, 2 toggles all remain editable. Confusing: user can configure but nothing fires. Needs clearer blocked-state UX or permission-request CTA.
- **P1** "Enviar notificação de teste" button — depends on permission; with permission blocked, button should either request permission or be disabled with explanation.
- **P1** IA tab "Ativar conector externo" is off — full form below still editable with placeholder endpoint / prompt. If connector isn't active, most of the form is inert. Feels like dead state.
- **P1** Telegram bot card (IA sidebar) — status says "Bot vinculado" but no obvious way to manage (disconnect, refresh token, etc.). If user doesn't use Telegram, this is clutter.
- **P1** Mojibake in IA prompt textarea ("Voce e a Sexta", "execucao") and sync log ("Sincronizacao") — shows up in user-facing strings.
- **P2** Sync log (Dados sidebar) shows many identical "Sincronizacao pendente agendada · delay 0ms" rows — not informative, just noise. Consider de-duplication or minimum-interest filter.
- **P2** Conta tab is almost empty (1 input) — merge with Notificações as "Perfil" or collapse it.

**Unnecessary / too granular (user flagged)**
- **P2** Notifications templates for 5 events with variable tokens — very granular for an unproven feature (permission blocked). Scope creep.
- **P2** Animação hover semanal (App tab) is hyper-specific to one view — should be bundled with other "motion / interaction" knobs rather than its own toggle.
- **P3** Right-sidebar "Leitura rápida" tab-jump mirrors the top tab nav — redundant navigation.

**Design**
- **P2** Tab nav uses `.flowly-segmented__item` pattern — good, consistent.
- **P2** Multiple eyebrow + title patterns per panel (e.g. "PROVEDOR" + dropdown, "ENDPOINT / EDGE FUNCTION" + textbox) — dense but readable.
- **P3** Dados tab 4-tile action grid is clear; "Limpar Tudo" correctly red. Good.

---

## 9. Desktop responsiveness (tested 1024 / 1280 / 1920)

### Findings

**`.app-main` is capped at `max-width: 1400px`** — content area never expands beyond 1400 regardless of viewport. At 1920 that means ~520px of empty space on the right. Design choice, but limits ultrawide usability.

**Finanças overflow is width-dependent**:
- At **1024** — media query collapses `.finance-main-grid` to single column, sidebar falls below. Fine.
- At **1280** — grid is two-column (since media breakpoint is 1200) but `1fr 340px` blows out. Side stack renders x=1304 → right=1644, viewport ends at 1280 → **364px cut off**. Meta / Por categoria / Projetos / Lançar form all off-screen. **Severe**.
- At **1449** (default) — 195px cut off. **Still broken**.
- At **1920** — fits (overflow disappears). But lots of whitespace right of side stack (~276px).
- Root cause: `grid-template-columns: 1fr 340px` — the `1fr` track expands to content min-size when transaction table rows have long untruncated descriptions.

**Semana at 1024** — 7-column grid squeezes tight; task titles wrap heavily (3 lines for short titles like "Oração e Salmo"), timestamps wrap. Usable but cramped. Smart Week 5-day mode should be default or suggested at narrow widths.

**Projetos at 1024** — sidebar wraps below main. Fine.

**Analytics at 1024** — not tested in detail but the 4-col KPI row likely wraps.

### Issues
- **P0** Finanças overflow broken at 1024-1599 viewport range (most user widths). Primary fix: `grid-template-columns: minmax(0, 1fr) 340px` on `.finance-main-grid` plus `min-width: 0` / `overflow: hidden` on the main column, plus `word-break: break-word` or text truncation on transaction description cells.
- **P1** `.app-main` `max-width: 1400px` wastes ultrawide screen real estate. Consider widening cap or allowing side-panels to scale.
- **P2** Semana at <1200 viewport is cramped — consider auto-switching to Smart Week or allowing horizontal scroll with column snapping.

