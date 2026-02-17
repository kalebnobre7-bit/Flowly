
import { initAuth } from './core/auth.js';
import { loadData } from './core/state.js';
import { setView } from './core/router.js';
import { registerServiceWorker } from './services/pwa.js';

// Init
document.addEventListener('DOMContentLoaded', async () => {

    // Auth
    await initAuth();

    // State
    await loadData();

    // Initial View
    const urlParams = new URLSearchParams(window.location.search);
    const initialView = urlParams.get('view') || 'week';
    setView(initialView);

    // PWA
    registerServiceWorker();

    // Global Events
    setupGlobalListeners();
});

function setupGlobalListeners() {
    // Navigation
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.target.closest('[data-view]').dataset.view;
            setView(view);
        });
    });

    // Modals
    // ...
}
