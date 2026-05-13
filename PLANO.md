# Flowly — Plano de Execução

> Estado: **em andamento**. Atualizar conforme cada tarefa for concluída.
> Baseado em `ORGANIZAR-A-CASA.md` (diagnóstico de abril/2026).

---

## Status das Fases

| Fase | Título | Status |
|------|--------|--------|
| 0 | Preparação | ✅ Concluída |
| 1 | Documentação + tokens | ✅ Concluída |
| 2 | Consolidação CSS | ✅ Concluída — 4 legacy files removidos |
| 3 | Unificação das views | 🔄 Em andamento — Tailwind removido; helpers pendentes |
| 4 | Bugs P0 / P1 | 🔄 Em andamento — todos P0 resolvidos |
| 5 | QA + release | ⬜ Pendente |
| 6 | Bugs P2 + polish | ⬜ Pendente |

---

## Fase 2 — Consolidação CSS

**Meta:** remover os 4 legacy files do `index.html`. Cada view tem seu próprio `css/views/[view].css`.

### Arquivos legados a eliminar

| Arquivo | Linhas | `!important` | Status |
|---------|-------:|-------------|--------|
| `styles.css` | 8 316 | 67 | 🔄 migrando |
| `bento-theme.css` | 901 | 2 | 🔄 migrando |
| `flowly-design-system.css` | 1 591 | 16 | 🔄 migrando |
| `views-redesign.css` | 1 722 | 1 | 🔄 migrando |

### Arquivos modulares já criados

| Arquivo | Linhas | `!important` | Status |
|---------|-------:|-------------|--------|
| `css/_tokens.css` | 273 | 0 | ✅ Pronto |
| `css/_reset.css` | 139 | 0 | ✅ Pronto |
| `css/_shell.css` | 272 | 0 | ✅ Pronto |
| `css/_components.css` | 1 295 | 6* | ✅ Pronto |
| `css/_animations.css` | 142 | 0 | ✅ Pronto |
| `css/_responsive.css` | 155 | 0 | ✅ Pronto |
| `css/views/projects.css` | 484 | 0 | ✅ Pronto |
| `css/views/watch-later.css` | 442 | 0 | ✅ Pronto |
| `css/views/goals.css` | 949 | 0 | ✅ Pronto |
| `css/views/today.css` | ✅ | 0 | ✅ Criado |
| `css/views/week.css` | ✅ | 0 | ✅ Criado |
| `css/views/month.css` | ✅ | 0 | ✅ Criado |
| `css/views/analytics.css` | ✅ | 0 | ✅ Criado |
| `css/views/finance.css` | ✅ | 0 | ✅ Criado |
| `css/views/sexta.css` | ✅ | 0 | ✅ Criado |
| `css/views/settings.css` | ✅ | 0 | ✅ Criado |
| `css/views/routine.css` | ✅ | 0 | ✅ Criado |

> *os 6 `!important` em `_components.css` são justificados: sobrescrevem checkbox azul do Tailwind CDN.

### ✅ Fase 2 concluída

Todos os `css/views/` existem e carregam no `index.html`. Todos os 4 legacy files removidos após smoke test visual completo (10 views testadas).

**Legacy files removidos:**
- `views-redesign.css` — Finance, Settings, Month migrados para `css/views/`
- `flowly-design-system.css` — tokens já em `_tokens.css` (aliases `--ds-*`)
- `bento-theme.css` — tokens e overrides cobertos pelos módulos
- `styles.css` — task system + today BEM + modal migrados para `_components.css` + `css/views/today.css`

**Arquivos legacy ainda existem no disco** (não deletados ainda — podem ser deletados quando QA completo).

### Regra de migração (para cada legacy file restante)

1. Identifica CSS da view no legacy file (grep por seletor)
2. Confirma que `css/views/[view].css` já cobre (ou adiciona o que falta)
3. Remove do legacy file
4. Testa visualmente
5. Se ok, próxima view

---

## Fase 3 — Unificação das Views

- [x] Remover `text-[10px]`, `text-[11px]` e `bg-[#...]` de `js/views/settings-render.js`
- [ ] Extrair helper `FlowlyPageHeader` (7 markups diferentes → 1 função)
- [ ] Extrair helper `FlowlyStatCard` (4 versões → 1)
- [ ] Extrair helper `FlowlyTaskItem` (unificar marcação de task)

---

## Fase 4 — Bugs

### P0 — já resolvidos

- [x] SW versões descasadas (`ACTIVE_STATIC_CACHE` agora único)
- [x] Race condition cross-tab (`crossTabRefreshTimer` com debounce 80ms)
- [x] `allTasksData[dateStr][period]` — já protegido: `|| {}` no today.js:54, guards duplos em month.js:209-210

### P1 — pendentes

- [ ] `sync-runtime.js`: `ensureCurrentUserForSync()` falha silenciosamente (não notifica usuário)
- [ ] `manifest.json` sem screenshots (`screenshots: []`)
- [ ] Queries `?v=N` inconsistentes em `index.html` (mix de v1, v5, v15, v27)

---

## Fase 5 — QA

```bash
npm run check
npm test
npm run lint
npm run smoke
```

Checklist manual: ver `REGRESSION_CHECKLIST.md`.

---

## Notas de decisão

- **Design system eleito**: `_tokens.css` com prefixo `--flowly-*` (baseado em `flowly-design-system.css`)
- **Tailwind**: banir classes arbitrárias (`bg-[#...]`, `text-[10px]`); utilities padrão OK
- **`!important`**: zero no CSS novo; os 6 existentes em `_components.css` são justificados (Tailwind CDN override)
