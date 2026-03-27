# Flowly Architecture

## Runtime entrypoints

- `index.html`: app shell + script loading order.
- `js/app.js`: main UI/controller orchestration.
- `js/core/tasks-repo.js`: read/migrate/realtime orchestration for remote data.
- `js/core/tasks-sync.js`: write/delete sync primitives.
- `js/core/auth-session.js`: auth lifecycle and session bootstrap.
- `js/core/pwa.js`: notifications and service worker bridge.
- `js/core/routine-service.js`: routine/habit domain helpers.
- `js/core/analytics-service.js`: pure daily metrics helpers.
- `js/core/local-store.js`: local persistence + safe JSON parsing.
- `js/views/dispatcher.js`: central view switching dispatcher.
- `js/core/config.js`, `js/core/events.js`, `js/core/errors.js`: config/events/error foundations.

## Current flow

1. `app.js` initializes core services (`localStore`, `tasksSync`, `tasksRepo`, `authSession`, `pwa`, etc).
2. Auth module resolves session and triggers data load callback.
3. Tasks repo hydrates local state from Supabase and starts realtime listeners.
4. UI render dispatch goes through `FlowlyViews` dispatcher.
5. Persist/sync wrappers in `app.js` delegate to service modules.

## Tooling

- `npm run check`: syntax check for core JS files.
- `npm test`: lightweight service tests (vm-based).
- `npm run lint`: ESLint flat config (script + module aware).
- `npm run format`: Prettier formatting for JS/JSON/MD.

## Regression checklist

- See `REGRESSION_CHECKLIST.md`.
