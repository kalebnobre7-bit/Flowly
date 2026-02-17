
let dragHandlers = {};

export function handleDragStart(e) {
    if (!e.target.dataset.index) return;

    // Store drag data in global state/context if needed, 
    // but here we just use dataTransfer for purity
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
        index: e.target.dataset.index,
        period: e.target.dataset.period,
        date: e.target.dataset.date
    }));

    e.target.classList.add('dragging');
}

export function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.drop-zone').forEach(zone => zone.classList.remove('active'));
}

export function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

export function createDropZone(day, dateStr, period, index) {
    const zone = document.createElement('div');
    zone.className = 'drop-zone h-2 transition-all duration-200 opacity-0 bg-blue-500/20 rounded';

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('active', 'h-10', 'opacity-100');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('active', 'h-10', 'opacity-100');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('active', 'h-10', 'opacity-100');

        const data = JSON.parse(e.dataTransfer.getData('text/plain'));

        document.dispatchEvent(new CustomEvent('task-dropped', {
            detail: {
                source: data,
                target: { date: dateStr, period, index }
            }
        }));
    });

    return zone;
}
