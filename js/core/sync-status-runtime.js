function renderSyncStatus() {
  const bar = document.getElementById('syncStatusBar');
  const textEl = document.getElementById('syncStatusText');
  if (!bar || !textEl) return;

  bar.dataset.state = syncStatus.state;
  textEl.textContent = syncStatus.text;
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
  setSyncStatus(navigator.onLine ? 'syncing' : 'offline', navigator.onLine ? text : 'Sem conexao');
}

function finishSyncActivity(success = true, errorText = '') {
  syncStatus.busyCount = Math.max(0, syncStatus.busyCount - 1);
  if (!navigator.onLine) {
    setSyncStatus('offline', 'Sem conexao');
    return;
  }
  if (!success) {
    setSyncStatus('error', errorText || 'Falha ao sincronizar');
    return;
  }
  if (syncStatus.busyCount > 0) {
    setSyncStatus('syncing', 'Sincronizando...');
    return;
  }
  setSyncStatus('saved', 'Tudo salvo na nuvem', { autoSaved: 2200 });
}

window.renderSyncStatus = renderSyncStatus;
window.setSyncStatus = setSyncStatus;
window.startSyncActivity = startSyncActivity;
window.finishSyncActivity = finishSyncActivity;
