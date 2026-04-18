# Flowly Architecture

## Runtime entrypoints

- `index.html`: app shell + script loading order.
- `js/app.js`: Supabase client bootstrap + remaining shared helpers.
- `js/core/navigation-runtime.js`: navigation state, week/month date helpers, `setView`.
- `js/core/view-runtime.js`: `renderView` orchestration and dispatcher fallback.
- `js/core/sync-status-runtime.js`: sync status bar state + UI helpers.
- `js/core/auth-runtime.js`: auth wrappers + session/runtime wiring.
- `js/core/app-runtime.js`: final app bootstrap, online/offline listeners, PWA init.
- `js/core/task-normalizer-runtime.js`: legacy task cleanup and duplicate-fix handler.
- `js/core/tasks-repo.js`: read/migrate/realtime orchestration for remote data.
- `js/core/tasks-sync.js`: write/delete sync primitives.
- `js/core/auth-session.js`: auth lifecycle and session bootstrap.
- `js/core/pwa.js`: notifications and service worker bridge.
- `js/core/routine-service.js`: routine/habit domain helpers.
- `js/core/analytics-service.js`: pure daily metrics helpers.
- `js/core/local-store.js`: local persistence helpers.
- `js/core/app-storage.js`: local storage persistence runtime.
- `js/views/dispatcher.js`: central view switching dispatcher.
- `js/views/routine.js`: routine view + recurring weekly helpers.
- `js/tasks/task-expansion-runtime.js`: inline task editor / expansion panel runtime.
- `js/core/config.js`, `js/core/events.js`, `js/core/errors.js`: config/events/error foundations.

## Current flow

1. `app.js` creates the Supabase client and shared helper functions still used across runtimes.
2. `service-bootstrap` wires domain services like `tasksRepo`, `tasksSync`, `routineService` and `analyticsService`.
3. `app-runtime` hydrates local state, normalizes legacy task data, initializes auth runtime and connectivity listeners.
4. `auth-runtime` delegates lifecycle to `auth-session`, which triggers remote hydration callbacks.
5. `view-runtime` dispatches rendering through `FlowlyViews` and view-specific modules.
6. `task-expansion-runtime`, task UI/runtime modules and view modules handle interaction-heavy UI concerns outside `app.js`.

## Removed legacy modules

The following files were removed because they were no longer loaded by `index.html` and only referenced one another in a dead ESM path:

- `js/core/auth.js`
- `js/core/router.js`
- `js/core/state.js`
- `js/services/supabase.js`
- `js/components/task.js`

## Tooling

- `npm run check`: syntax check for core JS files.
- `npm test`: lightweight service tests (vm-based).
- `npm run lint`: ESLint flat config (script + module aware).
- `npm run format`: Prettier formatting for JS/JSON/MD.
- `npm run smoke`: browser smoke test over the main views and local task persistence.

## Regression checklist

- See `REGRESSION_CHECKLIST.md`.
