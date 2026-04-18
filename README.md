# Flowly

Sistema operacional pessoal de produtividade. PWA escrito em vanilla JavaScript, com persistência offline, sync em nuvem e IA conversacional integrada.

Criado e mantido por Kaleb.

---

## Status

Em desenvolvimento ativo. Versão pública: [kalebnobre7-bit.github.io/Flowly](https://kalebnobre7-bit.github.io/Flowly/).

---

## Stack

- **Frontend** — HTML5, CSS (tokens próprios) e JavaScript vanilla sem framework.
- **Utility CSS** — Tailwind CDN (uso restrito a utilitários padrão; classes arbitrárias proibidas).
- **Charts** — Chart.js 4.
- **Ícones** — Lucide.
- **Backend** — Supabase (auth, banco Postgres, realtime).
- **PWA** — service worker próprio + Web App Manifest.
- **Notificações** — Web Push API + integração com Telegram bot.

---

## O que o Flowly faz hoje

**Views principais**

- **Hoje** — foco do dia, stats operacionais, task list.
- **Semana** — grid de 7 dias com drag-and-drop entre dias e períodos.
- **Mês** — calendário com eventos, tarefas e resumo financeiro.
- **Analytics** — KPIs de produtividade, taxa diária, gráficos de hábitos.
- **Finanças** — transações, categorização, breakdown por mês.
- **Projetos** — kanban de projetos com lanes e tarefas espelhadas.
- **Sexta** — assistente de IA para revisão semanal e planejamento.
- **Ajustes** — tema, notificações, integrações, conta.

**Capacidades transversais**

- Sincronização em tempo real entre dispositivos via Supabase.
- Persistência local (funciona offline, sincroniza ao reconectar).
- Rotinas/hábitos com recorrência semanal.
- Templates de rotina diária.
- Edição inline de tarefas com toolbar contextual.
- Cores Notion-style para categorizar (10 cores).
- Quick add por período.
- Instalável como PWA em desktop, Android e iOS.
- Notificações programadas (diárias e eventos) via SW e Telegram.

---

## Como rodar local

Não há build step. É HTML + CSS + JS estáticos.

```bash
git clone https://github.com/kalebnobre7-bit/Flowly.git
cd Flowly
# Servir estático em qualquer porta, ex:
python3 -m http.server 8000
# Abrir http://localhost:8000
```

Scripts de conveniência:

```bash
npm run check    # syntax check dos core JS
npm test         # testes leves (vm-based)
npm run lint     # ESLint flat config
npm run format   # Prettier
npm run smoke    # smoke test das views principais
```

---

## Arquitetura

Visão geral rápida (detalhes em `ARCHITECTURE.md`):

- `index.html` — app shell e ordem de carregamento dos scripts.
- `js/app.js` — bootstrap do Supabase client e helpers compartilhados.
- `js/core/*` — runtimes transversais: auth, sync, PWA, tasks repo, serviços de domínio.
- `js/views/*` — uma view por arquivo (`today.js`, `week.js`, `month.js`, `analytics.js`, `finance.js`, `projects.js`, `sexta.js`, `settings.js`).
- `js/tasks/*` — núcleo de tarefas: core, UI, expansion runtime.
- `js/components/*` — componentes reutilizáveis (drag-drop, task actions).

**Camada visual** — ver `DESIGN-SYSTEM.md` para tokens oficiais, regras de uso e componentes permitidos.

**Regras de agente** — ver `AGENTS.md` para o sistema de 4 agentes (Experience, Task Runtime, Sync, QA).

---

## Documentação do projeto

| Arquivo | Para quê |
|---------|----------|
| `README.md` | Este arquivo — visão geral. |
| `ARCHITECTURE.md` | Fluxo de runtime e entrypoints. |
| `DESIGN-SYSTEM.md` | Tokens visuais, componentes, regras. |
| `AGENTS.md` + `.agents/` | Ownership por agente (experience, task runtime, sync, QA). |
| `REGRESSION_CHECKLIST.md` | Checklist manual pré-release. |
| `ORGANIZAR-A-CASA.md` | Diagnóstico de débito técnico e plano de refactor em andamento. |
| `INSTALL.md` | Instalação da PWA. |
| `FINANCE_IMPORT.md` | Importação de dados financeiros. |
| `MANIFEST_TELEGRAM_SETUP.md` | Configuração do bot Telegram. |
| `TELEGRAM_SETUP_COMPLETO.md` | Setup completo do Telegram. |
| `PUSH_NOTIFICATIONS_CLOSED_APP_SETUP.md` | Setup de push notifications. |
| `setup_supabase.sql` | Schema do Supabase. |

---

## Roadmap

**Curto prazo**

- [ ] Unificação do design system (em execução — ver `ORGANIZAR-A-CASA.md`).
- [ ] Eliminar `!important` e Tailwind arbitrário das views.
- [ ] Corrigir versionamento do service worker.
- [ ] Cleanup de event listeners globais.

**Médio prazo**

- [ ] Compilar Tailwind localmente (remover CDN runtime).
- [ ] Testes de integração cross-tab sync.
- [ ] Internacionalização (en-US ao lado do pt-BR).
- [ ] App wrap mobile (Capacitor ou PWA builder).

**Longo prazo**

- [ ] Integrações (Google Calendar, Notion).
- [ ] IA local / on-device para sugestões.
- [ ] Marketplace de templates de rotina.

---

## Licença

Uso privado de Kaleb Nobre. Sem licença pública definida.

---

**Construído com cuidado por Kaleb.**
