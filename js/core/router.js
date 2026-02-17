
import { renderWeek } from './views/week.js';
// import { renderMonth } from './views/month.js';
// import { renderToday } from './views/today.js';
// import { renderSettings } from './views/settings.js';

let currentView = 'week';

export function setView(view) {
    currentView = view;
    // Update active button state
    document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btnSet${view.charAt(0).toUpperCase() + view.slice(1)}`)?.classList.add('active'); // e.g. btnSetWeek

    renderView();
}

export function renderView() {
    const mainContainer = document.querySelector('main');

    // Hide all views first
    document.querySelectorAll('.view-container').forEach(el => el.classList.add('hidden'));

    switch (currentView) {
        case 'week':
            document.getElementById('weekGrid')?.classList.remove('hidden');
            renderWeek();
            break;
        case 'month':
            // Logic for month view
            break;
        case 'settings':
            // Logic for settings view
            break;
        default:
            renderWeek();
    }
}
