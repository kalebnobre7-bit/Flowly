const FLOWLY_SYNC_LOG_KEY = 'flowly_sync_log';

function getRecentSyncEvents() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FLOWLY_SYNC_LOG_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function recordSyncEvent(type, message, meta = {}) {
  const nextEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    message,
    at: new Date().toISOString(),
    meta
  };

  const nextLog = [nextEntry, ...getRecentSyncEvents()].slice(0, 40);
  localStorage.setItem(FLOWLY_SYNC_LOG_KEY, JSON.stringify(nextLog));
  return nextEntry;
}

function clearRecentSyncEvents() {
  localStorage.removeItem(FLOWLY_SYNC_LOG_KEY);
}

function renderSyncStatus() {
  const bar = document.getElementById('syncStatusBar');
  const textEl = document.getElementById('syncStatusText');
  if (!bar || !textEl) return;

  let suffix = '';
  try {
    const pendingDeletes = JSON.parse(localStorage.getItem('flowlyPendingTaskDeletes') || '[]');
    const pendingCount = Array.isArray(pendingDeletes) ? pendingDeletes.length : 0;
    if (pendingCount > 0 && syncStatus.state !== 'syncing') {
      suffix = ` · ${pendingCount} exclus${pendingCount === 1 ? 'ao' : 'oes'} pendente${pendingCount === 1 ? '' : 's'}`;
    }
  } catch (error) {
    suffix = '';
  }

  bar.dataset.state = syncStatus.state;
  textEl.textContent = `${syncStatus.text}${suffix}`;
  bar.classList.toggle('hidden', false);
}

function setSyncStatus(state, text, options = {}) {
  if (syncStatus.hideTimer) {
    clearTimeout(syncStatus.hideTimer);
    syncStatus.hideTimer = null;
  }

  syncStatus.state = state;
  syncStatus.text = text;
  renderSyncStatus();

  if (options.autoSaved) {
    syncStatus.lastSavedAt = Date.now();
    syncStatus.hideTimer = setTimeout(() => {
      if (syncStatus.state === 'saved') {
        syncStatus.text = 'Tudo salvo';
        renderSyncStatus();
      }
    }, options.autoSaved);
  }
}

function startSyncActivity(text = 'Sincronizando...') {
  syncStatus.busyCount += 1;
  recordSyncEvent('start', text, { online: navigator.onLine });
  setSyncStatus(navigator.onLine ? 'syncing' : 'offline', navigator.onLine ? text : 'Sem conexao');
}

function finishSyncActivity(success = true, errorText = '') {
  syncStatus.busyCount = Math.max(0, syncStatus.busyCount - 1);
  if (!navigator.onLine) {
    recordSyncEvent('offline', 'Sem conexao durante sincronizacao');
    setSyncStatus('offline', 'Sem conexao');
    return;
  }
  if (!success) {
    recordSyncEvent('error', errorText || 'Falha ao sincronizar');
    setSyncStatus('error', errorText || 'Falha ao sincronizar');
    return;
  }
  if (syncStatus.busyCount > 0) {
    setSyncStatus('syncing', 'Sincronizando...');
    return;
  }
  recordSyncEvent('success', 'Tudo salvo na nuvem');
  setSyncStatus('saved', 'Tudo salvo na nuvem', { autoSaved: 2200 });
}

window.renderSyncStatus = renderSyncStatus;
window.setSyncStatus = setSyncStatus;
window.startSyncActivity = startSyncActivity;
window.finishSyncActivity = finishSyncActivity;
window.getRecentSyncEvents = getRecentSyncEvents;
window.clearRecentSyncEvents = clearRecentSyncEvents;
window.recordSyncEvent = recordSyncEvent;
