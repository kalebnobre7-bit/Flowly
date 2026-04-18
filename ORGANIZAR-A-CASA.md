# Organizar a Casa — Flowly

> Diagnóstico completo do estado atual do Flowly e plano de unificação.
> Escrito antes de editar qualquer linha de código em produção.
> **Abril 2026**

---

## TL;DR — o que o Flowly é hoje

O Flowly é **um bom produto travado numa cama-elástica de três design systems diferentes**. A lógica funciona, as views existem, os serviços rodam — mas a camada visual é um patchwork: três arquivos CSS redefinem os mesmos tokens com valores diferentes, quatro arquivos competem por precedência, e metade das views ignora o design system e usa Tailwind inline.

Opinião forte, sem rodeio: **não dá pra sair adicionando feature nova enquanto a casa estiver assim.** Qualquer mudança tem efeito colateral imprevisível porque o último arquivo de CSS importado vence a disputa. É o tipo de débito técnico que composta juros todo dia.

O que este documento propõe:

1. Diagnóstico honesto do que está quebrado (design + bugs).
2. Decisões de arquitetura que **só o Kaleb pode tomar** — listadas aqui com minha recomendação.
3. Plano de ataque em fases, da arrumação pra baixo.
4. Backlog de bugs priorizado (P0 / P1 / P2).

Tempo estimado pra "organizar a casa": **≈22h de trabalho focado**, distribuído em 4 fases.

---

## Parte 1 — Estado atual em fatos

### 1.1 CSS: o frankenstein confirmado

Quatro arquivos CSS, importados nessa ordem no `index.html`:

| Ordem | Arquivo | Linhas | Papel declarado | Papel real |
|-------|---------|-------:|-----------------|-----------|
| 1 | `styles.css` | 8.152 | Base Apple-like antiga | Ainda dita 70% do visual |
| 2 | `bento-theme.css` | 892 | "Premium dark" | Redefine tokens e fontes |
| 3 | `flowly-design-system.css` | 1.675 | Novo design system | Só usado pela Finance/Projects |
| 4 | `views-redesign.css` | 1.675 | Overlay de redesign | Refactor incompleto de views |

**Conflitos de tokens (amostra):**

| Token | styles.css | bento-theme.css | flowly-design-system.css |
|-------|-----------|-----------------|--------------------------|
| `--bg-body` | `#0a0b0f` | `#08090e` | `#08090e` |
| `--text-primary` | `#F5F5F7` | `#f0eff4` | `#f0eff4` |
| `--accent-green` | `#30D158` | `#22c55e` | `#22c55e` |
| `--accent-red` | `#FF453A` | `#FF5C4D` | `#ef4444` |
| `--accent-orange` | `#FF9F0A` | `#FF9F0A` | `#F27405` |
| Font stack | SF Pro | Plus Jakarta Sans | Inter / Sora |
| Scrollbar | 10px | 5px | 5px |
| Blur painel | 10px | variável | 12px |
| Radius MD | 10px | variável | 12px |

Isso significa que **se você hoje mudar `--accent-green`, não vale nada** — bento-theme.css sobrescreve. E se você mudar nele, `flowly-design-system.css` sobrescreve.

**Classes redefinidas em múltiplos arquivos:**

- `.flowly-panel` — 3 definições (styles L4409, bento L175, ds L482). Cada uma muda blur, radius e background.
- `.modal-content` — 3 definições. Shadow 40px em bento, 10px em styles. Fundo 94% vs 80% de opacidade.
- `.btn-primary` — 3 definições. Shadow cresce de 16px → 22px → 32px por arquivo. Cor vai de azul (`#0A84FF`) a laranja (`#F27405`).
- `.task-item`, `.stat-section`, `.today-hero-card`, `.analytics-kpi-v2` — múltiplas versões.

**Uso de `!important`:**

- `styles.css`: **48 ocorrências** (maior densidade entre linhas 487-527: 17 `!important` em 40 linhas = 42% de densidade)
- `flowly-design-system.css`: 14
- `views-redesign.css`: 1
- `bento-theme.css`: 0 (único arquivo disciplinado)

Cada `!important` é um hotfix que virou permanente. O padrão diz: os estilos base são frágeis demais pra competir sem ele.

**Tailwind CDN inline vs tokens:**

Três views (analytics, settings-render, settings-bindings) usam classes Tailwind arbitrárias tipo `bg-[#1c1c1e]` e `text-[#30d158]` hardcoded. Se você mudar o tema, essas views ficam órfãs.

### 1.2 Documentação interna: referências misturadas

- `DESIGN INSTRUÇÕES.md` — **não tem nada a ver com Flowly.** É um prompt de landing pages cinematográficas. Precisa ser arquivado ou reescrito.
- `README.md` — desatualizado. Diz "Sincronização na nuvem: [ ]" e "PWA: [ ]", mas ambos já existem. Lista stack como só "Vanilla JS + LocalStorage" sem citar Supabase.
- `.agents/experience-design.md` — esse sim é útil. Define a missão do agente de design ("manter o Flowly com cara de um único produto"). É o documento certo pra basear a unificação.
- `ARCHITECTURE.md` — mapa de scripts bom, mas foca em runtime, não em camada visual.

### 1.3 Views: 2 padrões visuais em paralelo

Hoje o Flowly tem duas linguagens de componente convivendo:

| Padrão | Usa tokens | Views que seguem |
|--------|-----------|------------------|
| "Antigo" (bento + styles) | `--bg-body`, `--accent-green`, `--text-primary` | Today, Week, Month, Analytics parcial |
| "Novo" (design-system) | `--ds-bg-base`, `--ds-accent`, `--ds-text-primary` | Finance, Projects, partes de Settings |

Resultado: **mudar uma cor sincroniza metade do app, não o todo.**

---

## Parte 2 — Bugs e riscos (backlog priorizado)

### P0 — quebra o app ou sync

1. **Service Worker com versões descasadas.** `STATIC_CACHE = 'flowly-static-v10'` vs `ACTIVE_STATIC_CACHE = 'flowly-static-v14'`. Cache velho nunca é limpo, usuário pode rodar JS de duas versões misturadas. Arquivo: `service-worker.js:1-3`.
2. **Versionamento por query string (`?v=15`) ignorado pelo SW.** Você sobe JS novo, SW devolve o antigo em cache. `service-worker.js:96-108`.
3. **Supabase anon key exposta em HTML.** Em `index.html:245-246`. É anon (legal, funciona), mas sem rate-limit / RLS bem configurado vira brecha de abuso.
4. **Event listeners acumulando sem cleanup.** Cada re-render de Settings e UI bootstrap duplica handlers (`settings-bindings.js:66-71, 119-129`; `ui-bootstrap.js:190, 317`; `app-runtime.js:13-25, 23`). Consequência direta: memory leak, ações disparadas várias vezes em mobile após algumas horas.
5. **Race condition em cross-tab storage sync.** `app-runtime.js:27-56` recarrega state sem debounce quando outra aba grava no localStorage. Pode corromper `allTasksData`.

### P1 — funciona mas é frágil

1. **Sync Supabase falha em silêncio.** `ensureCurrentUserForSync()` retorna null sem notificar usuário (`sync-runtime.js:72-87`). Usuário acha que salvou, perdeu.
2. **Task expansion runtime limpa com `setTimeout` sem verificar `isConnected`.** `task-expansion-runtime.js:6-12`. Element removido deixa listener fantasma.
3. **`document.click` global sem namespace.** `ui-bootstrap.js:190`. Clique em modal propaga e pode fechar coisa errada.
4. **`allTasksData[dateStr][period]` usado sem validação de schema.** Qualquer rotina malformada trava renderização (`today.js:39-59`, `month.js:40-66`).
5. **Chamadas Supabase sem `try/catch`.** `pwa.js:48, 104`; `tasks-repo.js` merge remoto. Falhas de rede passam despercebidas.
6. **Queries `?v=N` estáticos inconsistentes.** `index.html` mistura `?v=1`, `?v=5`, `?v=15`, `?v=27`. Sem estratégia, bustar cache vira loteria.
7. **Manifest.json sem screenshots (`screenshots: []`).** Degrada o prompt de install em Android.

### P2 — edge cases e cosmética

1. `month.js:40-66` faz try/catch vazio em JSON.parse — erro silencioso.
2. `pwa.js:200-201` — `sendTestNotification()` sem fallback quando permissão está `denied`.
3. `sexta-controller.js:14-20, 68-69` — placeholder "modelo externo" aparece pro usuário sem aviso de que AI não está conectada.
4. `manifest.json` e `index.html` têm paths diferentes pro logo em shortcuts.
5. Sem comentário `TODO/FIXME/HACK` no código — mas tem referências em maiúsculo ("apagar TODOS os dados?") em `settings-bindings.js:656` que parecem hot-fix.

---

## Parte 3 — Decisões que precisam do Kaleb

Antes de mexer em código, preciso que você decida **três coisas**. Vou dar minha opinião em cada uma.

### Decisão 1 — qual design system vira o dono?

**Opção A: Eleger `flowly-design-system.css` como base.**
Pros: namespace limpo (`--ds-*`), mais recente, já é usado em Finance e Projects (as views que você mais tocou recentemente).
Contra: você precisa redesenhar Today/Week/Month/Analytics pra esse padrão. Perde a fonte Plus Jakarta do bento.

**Opção B: Eleger `bento-theme.css` como base.**
Pros: visual "premium dark" é o que o app entrega hoje em Today e Analytics — é o que os usuários já veem.
Contra: tokens sem prefixo (`--bg-body` genérico), menos organizável em escala.

**Opção C: Mesclar os dois em um novo `flowly-core.css`.**
Pros: pega o melhor dos dois, controle total.
Contra: é o trabalho mais lento. Mas resolve definitivamente.

> **Minha recomendação: C — com o `flowly-design-system.css` como chassi e o "sabor" visual do bento.** Você mantém a cara "premium dark" (Plus Jakarta, glow sutil, radius generoso) mas consolida sob um único namespace `--flowly-*` de tokens. Seis meses à frente você vai agradecer.

### Decisão 2 — o que fazer com Tailwind CDN?

Hoje o Flowly carrega `cdn.tailwindcss.com` no browser — isso gera JS runtime de ~300KB que roda no cliente pra compilar classes. Três views usam Tailwind arbitrário (`bg-[#1c1c1e]`) hardcoded.

**Opção A: Manter Tailwind CDN, mas banir classes arbitrárias.** Só usar utilities padrão (`flex`, `grid`, `p-4`, `rounded-2xl`). Cores e cores com hash (`bg-[#...]`) viram variáveis CSS via `@apply` ou classes custom.

**Opção B: Tirar Tailwind CDN por completo.** Migrar tudo pra CSS vanilla com tokens. Ganha performance e coerência total.

**Opção C: Compilar Tailwind localmente.** Adicionar `tailwind.config.js` + `postcss`, servir um `.css` gerado. Mantém a produtividade do Tailwind sem o runtime.

> **Minha recomendação: A agora, C em seis meses.** Tirar tudo (B) é trabalho demais sem payoff imediato. Compilar localmente (C) é o certo pro médio prazo, mas exige um pipeline de build que o Flowly ainda não tem. Banir `bg-[#...]` arbitrário (A) dá 80% do ganho com 10% do esforço.

### Decisão 3 — documentação: o que fica, o que vira lixo?

Proposta:

- **`DESIGN INSTRUÇÕES.md`** → renomear pra `_archive/design-landing-pages-prompt.md` (não é do Flowly, mas é útil como prompt de trabalho separado).
- **`README.md`** → reescrever. Colocar stack real (Supabase, Tailwind CDN, PWA), status real (sync funciona, PWA instalável), e link pro GitHub Pages.
- **`ARCHITECTURE.md`** → manter, mas adicionar seção "Camada Visual" explicando a arquitetura CSS pós-refactor.
- **Criar `DESIGN-SYSTEM.md`** → novo. Documenta tokens oficiais, componentes permitidos, regras de uso (ex: "nunca use cor arbitrária, sempre token"). Este vira a referência única.
- **`REGRESSION_CHECKLIST.md`** → manter, atualizar com as views que hoje faltam (Sexta, Projects).
- **`.agents/experience-design.md`** → manter, encostar no `DESIGN-SYSTEM.md`.

> **Minha recomendação: executar tudo acima na Fase 1 (ver abaixo), antes de qualquer CSS ser tocado.** Documento bom economiza 10x o tempo gasto escrevendo ele.

---

## Parte 4 — Plano de ataque (fases)

### Fase 0 — Preparação (30 min, agora)

- ✅ Clonar repo localmente (feito)
- ✅ Auditar CSS e JS (feito)
- ✅ Escrever este documento (feito)
- ⬜ Kaleb aprovar as 3 decisões acima
- ⬜ Criar branch `refactor/unificar-design-system`

### Fase 1 — Documentação e tokens (2h)

- ⬜ Reescrever `README.md` com estado real
- ⬜ Criar `DESIGN-SYSTEM.md` com tokens oficiais (fonte, cores, radius, shadows, spacing, z-index)
- ⬜ Arquivar `DESIGN INSTRUÇÕES.md`
- ⬜ Criar `css/_tokens.css` com os tokens finais (baseado na Decisão 1)
- ⬜ Nenhum arquivo de produção tocado ainda

### Fase 2 — Consolidação do CSS (8h)

- ⬜ Criar novos arquivos modulares:
  - `css/_tokens.css` — variáveis
  - `css/_reset.css` — reset + scrollbar + body
  - `css/_shell.css` — sidebar, app-main, grid principal
  - `css/_components.css` — `.flowly-panel`, `.btn-primary`, `.modal-content`, `.task-item` (definição **única** de cada)
  - `css/_animations.css` — bento-rise, drag transitions
  - `css/_responsive.css` — media queries consolidadas
- ⬜ Migrar conteúdo de `styles.css` (8.152 linhas → ~1.500)
- ⬜ Eliminar `!important` um por um, testando cada fluxo
- ⬜ Dissolver `bento-theme.css` (distribuir em components e animations)
- ⬜ Dissolver `flowly-design-system.css` (tokens em _tokens, classes `--ds-` renomeadas pra `--flowly-`)
- ⬜ Dissolver `views-redesign.css` (conteúdo vai pra components específicos)

### Fase 3 — Unificação das views (6h)

Objetivo: todas as 7 views usando a mesma abstração de componente.

- ⬜ Extrair componente `<FlowlyPageHeader>` — todos os views têm um header com título + ações. Hoje são 7 markups diferentes. Virar 1 função helper em JS que renderiza HTML padronizado.
- ⬜ Extrair componente `<FlowlyStatCard>` — hoje existe em 4 versões (`.today-hero-card`, `.analytics-kpi-v2`, `.finance-kpi-card`, `.sexta-card`). Colapsar em 1.
- ⬜ Extrair componente `<FlowlyTaskItem>` — unificar marcação de task em todas as views.
- ⬜ Remover Tailwind arbitrário (`bg-[#...]`) de analytics, settings-render, settings-bindings.
- ⬜ Ajustar views pra usar só tokens `--flowly-*`.

### Fase 4 — Bugs P0 + P1 (4h)

- ⬜ Sincronizar versões do service worker, validar cache busting
- ⬜ Adicionar `try/catch` nas chamadas Supabase críticas
- ⬜ Criar função `bindOnce()` utility pra evitar listener duplicado em re-renders
- ⬜ Refatorar `bindSettingsInteractions()` pra usar cleanup
- ⬜ Debounce no storage event cross-tab
- ⬜ Validação de schema em `allTasksData[dateStr][period]` com fallback
- ⬜ Atualizar `manifest.json` com screenshots

### Fase 5 — QA e release (2h)

- ⬜ Rodar regressão manual (REGRESSION_CHECKLIST.md) em desktop
- ⬜ Rodar regressão em mobile (viewport ≤ 420px)
- ⬜ `npm run check && npm test && npm run lint`
- ⬜ Smoke test das 7 views
- ⬜ Verificar PWA instalável + offline
- ⬜ Deploy GitHub Pages + validar

### Fase 6 — Bugs P2 e polish (opcional, 2h)

- ⬜ Corrigir edge cases silenciosos (try/catch vazios)
- ⬜ Melhorar fallback de Sexta (AI desconectado)
- ⬜ Padronizar `?v=N` do index.html num único versionamento

**Total: ~22h de trabalho concentrado.** Dá pra fazer em 3-4 dias se for full-time ou em 2 semanas em paralelo com feature work leve.

---

## Parte 5 — Princípios de ouro pro refactor

1. **Um token, um arquivo.** Se `--flowly-accent-green` existe, ele só é declarado em `_tokens.css`. Ponto final.
2. **Uma classe, uma definição.** `.btn-primary` só existe uma vez no CSS. Zero redefinição.
3. **Zero `!important`.** Se precisar, o estilo base está errado — arruma ele.
4. **Zero Tailwind arbitrário.** `bg-[#1c1c1e]` é proibido. Use `bg-flowly-surface` (classe utilitária própria) ou `style="background: var(--flowly-surface)"`.
5. **Toda view passa pelos mesmos helpers.** Page header, stat card, task item, modal — sempre o mesmo helper.
6. **Mobile-first de verdade.** Testar a cada commit num viewport 375px. Se quebrar, não merge.
7. **Commit atômico.** Um commit por view migrada, um commit por bug P0, um commit por componente extraído. Isso torna rollback trivial.

---

## Parte 6 — Pergunta pra você, Kaleb

Antes de eu tocar em qualquer linha de código de produção:

1. Topa as **3 decisões** da Parte 3?
2. Qual das fases você quer atacar primeiro — ou vamos na ordem Fase 0 → 6?
3. Prefere que eu crie um branch e commite por fase, ou tá numa janela em que dá pra eu ir editando `main` direto?
4. Tem alguma view que você **já sabe** que mais te incomoda visualmente hoje? Se sim, começo por ela na Fase 3.

Me responde e eu já mando a Fase 1 pronta.
