(function () {
  function getNotifier() {
    if (typeof errorHandler !== 'undefined' && errorHandler && typeof errorHandler.notify === 'function') {
      return errorHandler;
    }
    if (window.flowlyErrors && typeof window.flowlyErrors.notify === 'function') {
      return window.flowlyErrors;
    }
    return null;
  }

  function notify(message, level) {
    const notifier = getNotifier();
    if (notifier) {
      notifier.notify(message, level || 'warn');
      return;
    }
    console[level === 'error' ? 'error' : 'warn'](message);
  }

  function closeDialog() {
    const current = document.getElementById('flowlyUiDialog');
    if (current) current.remove();
  }

  function openDialog(options) {
    closeDialog();

    const {
      title = 'Flowly',
      message = '',
      confirmLabel = 'Confirmar',
      cancelLabel = 'Cancelar',
      tone = 'default',
      kind = 'confirm',
      inputPlaceholder = '',
      inputValue = ''
    } = options || {};

    const overlay = document.createElement('div');
    overlay.id = 'flowlyUiDialog';
    overlay.className = 'modal-overlay show';
    overlay.style.zIndex = '100001';

    const toneStyles =
      tone === 'danger'
        ? {
            confirmClass: 'btn-primary',
            confirmStyle: 'background:#b91c1c;border-color:rgba(239,68,68,0.35);'
          }
        : {
            confirmClass: 'btn-primary',
            confirmStyle: ''
          };

    overlay.innerHTML = `
      <div class="modal-content" style="max-width:420px;display:flex;flex-direction:column;gap:16px;">
        <div style="display:flex;flex-direction:column;gap:8px;">
          <h3 style="margin:0;font-size:20px;font-weight:800;color:#fff;">${String(title)
            .replace(/[&<>"']/g, (char) => {
              if (char === '&') return '&amp;';
              if (char === '<') return '&lt;';
              if (char === '>') return '&gt;';
              if (char === '"') return '&quot;';
              return '&#39;';
            })}</h3>
          ${
            message
              ? `<p style="margin:0;color:rgba(255,255,255,0.66);font-size:13px;line-height:1.5;white-space:pre-line;">${String(message)
                  .replace(/[&<>"']/g, (char) => {
                    if (char === '&') return '&amp;';
                    if (char === '<') return '&lt;';
                    if (char === '>') return '&gt;';
                    if (char === '"') return '&quot;';
                    return '&#39;';
                  })}</p>`
              : ''
          }
        </div>
        ${
          kind === 'prompt'
            ? `<input id="flowlyUiDialogInput" class="finance-input" type="text" placeholder="${String(
                inputPlaceholder || ''
              ).replace(/"/g, '&quot;')}" value="${String(inputValue || '').replace(/"/g, '&quot;')}">`
            : ''
        }
        <div style="display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap;">
          <button type="button" id="flowlyUiDialogCancel" class="btn-secondary projects-btn-inline">${cancelLabel}</button>
          <button type="button" id="flowlyUiDialogConfirm" class="${toneStyles.confirmClass} projects-btn-inline" style="${toneStyles.confirmStyle}">${confirmLabel}</button>
        </div>
      </div>
    `;

    return new Promise((resolve) => {
      const cleanup = (result) => {
        closeDialog();
        resolve(result);
      };

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) cleanup(kind === 'prompt' ? null : false);
      });

      document.body.appendChild(overlay);

      const confirmBtn = document.getElementById('flowlyUiDialogConfirm');
      const cancelBtn = document.getElementById('flowlyUiDialogCancel');
      const input = document.getElementById('flowlyUiDialogInput');

      if (cancelBtn) cancelBtn.onclick = () => cleanup(kind === 'prompt' ? null : false);
      if (confirmBtn) {
        confirmBtn.onclick = () => {
          if (kind === 'prompt') cleanup(input ? input.value.trim() : '');
          else cleanup(true);
        };
      }

      document.addEventListener(
        'keydown',
        function handleEscape(event) {
          if (event.key === 'Escape') {
            cleanup(kind === 'prompt' ? null : false);
          }
        },
        { once: true }
      );

      if (input) {
        setTimeout(() => {
          input.focus();
          input.select();
        }, 30);
        input.onkeydown = (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            confirmBtn?.click();
          }
        };
      } else {
        setTimeout(() => confirmBtn?.focus(), 30);
      }
    });
  }

  function confirmDialog(message, options) {
    return openDialog({
      kind: 'confirm',
      message,
      ...(options || {})
    });
  }

  function promptDialog(message, options) {
    return openDialog({
      kind: 'prompt',
      message,
      ...(options || {})
    });
  }

  window.FlowlyDialogs = {
    notify,
    confirm: confirmDialog,
    prompt: promptDialog,
    close: closeDialog
  };
})();
