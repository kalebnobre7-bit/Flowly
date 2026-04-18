# Flowly Design System

> Fonte única de verdade visual do Flowly.
> Qualquer mudança na camada visual do app deve respeitar este documento.

---

## Filosofia

O Flowly é **software de luxo, não template genérico**. Três princípios guiam tudo:

1. **Quieto mas presente** — superfícies escuras, vidro sutil, tipografia confiante. O app não grita.
2. **Ritmo consistente** — a mesma cor cinza, o mesmo radius, a mesma altura de header em todas as views. O usuário nunca pensa "que tela estranha".
3. **Mobile-first real** — cada componente é desenhado primeiro para 375px de largura. Desktop é o refinamento.

Derivados: zero `!important`, zero classe Tailwind arbitrária, zero cor hexadecimal no JS.

---

## Namespace

Todos os tokens CSS do Flowly vivem sob o prefixo **`--flowly-*`**. Isso isola o design system de resquícios históricos (`--bg-*`, `--ds-*`, `--accent-*`) e evita colisão com tokens do Tailwind.

> **Regra:** Se você está criando um novo token e ele não tem prefixo `--flowly-`, está errado.

---

## Tokens oficiais

### Cores — Superfícies

| Token | Hex | Uso |
|-------|-----|-----|
| `--flowly-bg-body` | `#08090e` | Fundo do `<body>`. Base escura da aplicação. |
| `--flowly-bg-elevated` | `rgba(14, 15, 20, 0.78)` | Cards, painéis, modais. Aplicar com `backdrop-filter: blur(var(--flowly-blur-panel))`. |
| `--flowly-bg-elevated-hover` | `rgba(18, 19, 26, 0.88)` | Estado hover de superfícies elevadas. |
| `--flowly-bg-glass` | `rgba(255, 255, 255, 0.028)` | Overlay translúcido (toolbars, pills). |
| `--flowly-bg-sidebar` | `linear-gradient(180deg, rgba(10,11,15,0.98), rgba(11,12,18,0.96))` | Fundo da sidebar desktop. |

### Cores — Texto

| Token | Hex | Uso |
|-------|-----|-----|
| `--flowly-text-primary` | `#f0eff4` | Texto principal, títulos. |
| `--flowly-text-secondary` | `#8e8a98` | Texto de apoio, labels, copy secundária. |
| `--flowly-text-tertiary` | `#56535f` | Placeholders, metadata discreta. |

### Cores — Bordas

| Token | Hex | Uso |
|-------|-----|-----|
| `--flowly-border-subtle` | `rgba(255, 255, 255, 0.055)` | Borda padrão de cards e painéis. |
| `--flowly-border-muted` | `rgba(255, 255, 255, 0.07)` | Divisores, linhas de separação. |
| `--flowly-border-active` | `rgba(var(--flowly-accent-primary-rgb), 0.24)` | Borda em estado ativo/selecionado. |

### Cores — Acento

| Token | Hex default | RGB | Uso |
|-------|-------------|-----|-----|
| `--flowly-accent-primary` | `#22c55e` | `34 197 94` | **Cor oficial do Flowly (verde).** CTAs, links, estado ativo, destaques. **Personalizável pelo usuário** via `--flowly-user-accent` em Ajustes. |
| `--flowly-accent-success` | `#22c55e` | `34 197 94` | Estados positivos, tarefas concluídas, delta positivo. |
| `--flowly-accent-info` | `#0A84FF` | `10 132 255` | Informativo, links secundários, categoria "azul". |
| `--flowly-accent-warning` | `#FF9F0A` | `255 159 10` | Avisos, estados em atenção, prioridade moderada. |
| `--flowly-accent-danger` | `#FF5C4D` | `255 92 77` | Erros, destruição, urgente, delta negativo. |
| `--flowly-accent-purple` | `#a855f7` | `168 85 247` | Sexta, IA, categoria "roxo". |
| `--flowly-accent-pink` | `#ec4899` | `236 72 153` | Categoria "rosa". |

> **Exposição RGB** — cada acento expõe também `--flowly-accent-*-rgb` para uso em `rgba()`. Exemplo: `rgba(var(--flowly-accent-primary-rgb), 0.12)`.

### Personalização da cor primária

A cor primária do Flowly é **verde por default**, mas o usuário pode trocar em Ajustes. Para aplicar via JS:

```js
// Trocar a cor primária do app inteiro em runtime
document.documentElement.style.setProperty('--flowly-user-accent', '#0A84FF');
document.documentElement.style.setProperty('--flowly-user-accent-rgb', '10 132 255');
```

Todo o app (botões, links ativos, badges, highlights, pills primárias, glow) se adapta sem recarregar. Salve em `localStorage` para persistência. Nunca altere `--flowly-accent-primary` diretamente — sempre via `--flowly-user-accent`.

### Cores — Categorias de tarefas (Notion-style)

| Token | Hex | Nome |
|-------|-----|------|
| `--flowly-tag-gray` | `#8e8a98` | Cinza (neutro) |
| `--flowly-tag-blue` | `#0A84FF` | Azul |
| `--flowly-tag-green` | `#22c55e` | Verde |
| `--flowly-tag-yellow` | `#FFD60A` | Amarelo |
| `--flowly-tag-orange` | `#FF9F0A` | Laranja |
| `--flowly-tag-red` | `#FF5C4D` | Vermelho |
| `--flowly-tag-pink` | `#ec4899` | Rosa |
| `--flowly-tag-purple` | `#a855f7` | Roxo |
| `--flowly-tag-brown` | `#a77a4c` | Marrom |
| `--flowly-tag-default` | `transparent` | Sem cor |

### Tipografia

A fonte oficial do Flowly é a **SF Pro** (San Francisco) — a mesma do macOS, iOS e iPadOS. Em Apple, é carregada nativamente via `-apple-system` e `BlinkMacSystemFont` (zero download, zero FOIT). Em outras plataformas, o fallback é **Inter** (a fonte open-source mais próxima de SF Pro, carregada via Google Fonts).

| Token | Valor | Uso |
|-------|-------|-----|
| `--flowly-font-main` | `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', 'Segoe UI', Roboto, sans-serif` | Texto geral. |
| `--flowly-font-display` | `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif` | Títulos, números grandes. |
| `--flowly-font-mono` | `ui-monospace, 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace` | Código, valores técnicos, labels `v1.0`. |

**Escala de tamanho** (todas em `rem`, mobile-first):

| Token | Valor | Uso sugerido |
|-------|-------|--------------|
| `--flowly-text-2xs` | `0.6875rem` (11px) | Micro labels, metadata. |
| `--flowly-text-xs` | `0.75rem` (12px) | Metadata, timestamps. |
| `--flowly-text-sm` | `0.8125rem` (13px) | Secundário. |
| `--flowly-text-base` | `0.9375rem` (15px) | Body padrão. |
| `--flowly-text-lg` | `1.0625rem` (17px) | Subtítulos. |
| `--flowly-text-xl` | `1.25rem` (20px) | Títulos de seção. |
| `--flowly-text-2xl` | `1.5rem` (24px) | Títulos de view. |
| `--flowly-text-3xl` | `2rem` (32px) | Números dashboard. |
| `--flowly-text-display` | `clamp(2.25rem, 5vw, 3.5rem)` | Hero, Sexta greeting. |

### Radius

| Token | Valor | Uso |
|-------|-------|-----|
| `--flowly-radius-sm` | `8px` | Tags, pills pequenos. |
| `--flowly-radius-md` | `12px` | Botões, inputs. |
| `--flowly-radius-lg` | `16px` | Cards, painéis. |
| `--flowly-radius-xl` | `22px` | Cards grandes, modais. |
| `--flowly-radius-2xl` | `28px` | Hero cards. |
| `--flowly-radius-full` | `9999px` | Avatares, badges redondas. |

### Sombras

| Token | Valor | Uso |
|-------|-------|-----|
| `--flowly-shadow-sm` | `0 1px 2px rgba(0,0,0,0.25)` | Elevação discreta. |
| `--flowly-shadow-md` | `0 4px 12px rgba(0,0,0,0.32)` | Cards padrão. |
| `--flowly-shadow-lg` | `0 12px 32px rgba(0,0,0,0.4)` | Painéis elevados, popovers. |
| `--flowly-shadow-xl` | `0 32px 64px rgba(0,0,0,0.55)` | Modais. |
| `--flowly-shadow-glow-primary` | `0 8px 22px rgba(var(--flowly-accent-primary-rgb), 0.26)` | CTAs com glow. |

### Blur e vidro

| Token | Valor | Uso |
|-------|-------|-----|
| `--flowly-blur-subtle` | `8px` | Overlays finos. |
| `--flowly-blur-panel` | `12px` | Padrão de cards e painéis. |
| `--flowly-blur-modal` | `24px` | Modal backdrop. |

### Espaçamento

Escala em passos de 4px, aliases em tokens:

| Token | Valor |
|-------|-------|
| `--flowly-space-1` | `4px` |
| `--flowly-space-2` | `8px` |
| `--flowly-space-3` | `12px` |
| `--flowly-space-4` | `16px` |
| `--flowly-space-5` | `20px` |
| `--flowly-space-6` | `24px` |
| `--flowly-space-8` | `32px` |
| `--flowly-space-10` | `40px` |
| `--flowly-space-12` | `48px` |
| `--flowly-space-16` | `64px` |

### Layout / shell

| Token | Valor | Uso |
|-------|-------|-----|
| `--flowly-shell-max` | `1280px` | Largura máxima do container principal. |
| `--flowly-shell-max-narrow` | `1120px` | Views focadas (Sexta, Settings). |
| `--flowly-shell-max-wide` | `1400px` | Analytics, dashboards largos. |
| `--flowly-sidebar-width` | `232px` | Sidebar desktop expandida. |
| `--flowly-sidebar-width-collapsed` | `88px` | Sidebar recolhida. |

### Motion

| Token | Valor | Uso |
|-------|-------|-----|
| `--flowly-duration-fast` | `150ms` | Hovers, estados imediatos. |
| `--flowly-duration-base` | `220ms` | Transições padrão. |
| `--flowly-duration-slow` | `380ms` | Entradas, saídas de painel. |
| `--flowly-ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Saída padrão (expo). |
| `--flowly-ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Transições neutras. |

### Z-index

| Token | Valor | Uso |
|-------|-------|-----|
| `--flowly-z-base` | `1` | Conteúdo. |
| `--flowly-z-sticky` | `10` | Headers sticky. |
| `--flowly-z-dropdown` | `100` | Menus dropdown. |
| `--flowly-z-sidebar` | `200` | Sidebar mobile. |
| `--flowly-z-overlay` | `500` | Overlay backdrop. |
| `--flowly-z-modal` | `1000` | Modais. |
| `--flowly-z-toast` | `2000` | Notificações toast. |
| `--flowly-z-noise` | `9999` | Textura global. |

---

## Componentes oficiais

Todos os componentes vivem em `css/_components.css`. Cada um tem **uma definição única**.

### `.flowly-panel`

Painel padrão do app. Base de qualquer card.

```css
.flowly-panel {
    background: var(--flowly-bg-elevated);
    border: 1px solid var(--flowly-border-subtle);
    border-radius: var(--flowly-radius-lg);
    backdrop-filter: blur(var(--flowly-blur-panel));
    box-shadow: var(--flowly-shadow-md);
    padding: var(--flowly-space-5);
}
```

Variantes: `.flowly-panel--elevated` (sombra maior), `.flowly-panel--flat` (sem blur).

### `.flowly-page-header`

Cabeçalho padrão de toda view. Obrigatório em todas as 7 views.

Estrutura:

```html
<header class="flowly-page-header">
    <div class="flowly-page-header__title">
        <h1>Título da View</h1>
        <p class="flowly-page-header__subtitle">Descrição curta.</p>
    </div>
    <div class="flowly-page-header__actions">
        <!-- botões, toggles, pills -->
    </div>
</header>
```

### `.flowly-stat-card`

Cartão de estatística. Uso em Today (sidebar), Analytics (KPIs), Finance (KPIs).

```html
<div class="flowly-stat-card">
    <span class="flowly-stat-card__label">Label</span>
    <span class="flowly-stat-card__value">42</span>
    <span class="flowly-stat-card__hint">↑ 12% vs ontem</span>
</div>
```

### `.flowly-task-item`

Item de tarefa unificado. Usado em Today, Week, Month.

```html
<div class="flowly-task-item" data-task-id="..." data-color="blue">
    <button class="flowly-task-item__check" aria-label="Concluir"></button>
    <span class="flowly-task-item__text">Texto da tarefa</span>
    <div class="flowly-task-item__meta">
        <!-- tag, timer, handle -->
    </div>
</div>
```

Estados: `.is-done`, `.is-editing`, `.is-dragging`.

### `.flowly-btn`

Botão base com variantes.

| Variante | Classe | Uso |
|----------|--------|-----|
| Primary | `.flowly-btn .flowly-btn--primary` | CTA principal. |
| Secondary | `.flowly-btn .flowly-btn--secondary` | Ações secundárias. |
| Ghost | `.flowly-btn .flowly-btn--ghost` | Ações terciárias em barras. |
| Danger | `.flowly-btn .flowly-btn--danger` | Delete, reset. |

Área mínima de toque: **44px × 44px** (inclui padding invisível se necessário).

### `.flowly-modal`

Modal padrão. Backdrop + content.

```html
<div class="flowly-modal" role="dialog" aria-modal="true">
    <div class="flowly-modal__backdrop"></div>
    <div class="flowly-modal__content">
        <!-- conteúdo -->
    </div>
</div>
```

### `.flowly-pill`

Pill/badge pequeno. Usado em tags, status, contadores.

```html
<span class="flowly-pill flowly-pill--success">Concluído</span>
```

---

## Regras de uso (leia antes de mexer)

1. **Um token, um arquivo.** Todo `--flowly-*` vive em `css/_tokens.css`. Nenhum outro arquivo declara tokens.
2. **Uma classe, uma definição.** `.flowly-btn` aparece uma vez no CSS. Zero redefinição em outros arquivos.
3. **Zero `!important`.** Se você achar que precisa, o estilo base está errado — corrija ele.
4. **Zero cor hexadecimal no JS.** Toda cor vem de token. Escreva `style.color = 'var(--flowly-accent-success)'`, não `style.color = '#22c55e'`.
5. **Zero Tailwind arbitrário.** Proibido `bg-[#1c1c1e]`, `text-[#30d158]`, `p-[17px]`. Use utilitários padrão (`p-4`) ou tokens (`style="background: var(--flowly-bg-elevated)"`).
6. **Mobile-first sempre.** Escreva o CSS para mobile e use `@media (min-width: 768px)` para escalar. Nunca o inverso.
7. **Toque mínimo 44px.** Qualquer elemento interativo tem área clicável ≥ 44×44px.
8. **Uma view, um page header.** Todas usam `.flowly-page-header`. Sem exceção.
9. **Novo componente exige entrada neste doc.** Criou `.flowly-x`? Documenta aqui antes de abrir PR.

---

## Arquitetura CSS

Pós-refactor, o CSS do Flowly vive em arquivos modulares:

```
css/
├── _tokens.css          ← único lugar com variáveis
├── _reset.css           ← reset global, body, scrollbar
├── _shell.css           ← sidebar, app-main, layout principal
├── _components.css      ← flowly-panel, flowly-btn, flowly-modal, etc.
├── _anim