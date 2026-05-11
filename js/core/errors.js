(function () {
  function createErrorHandler(deps) {
    const debugLog = (deps && deps.debugLog) || function () {};

    function notify(message, level) {
      const tone = level || 'error';
      const toast = document.createElement('div');
      toast.className = `flowly-toast flowly-toast--${tone}`;
      toast.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:var(--flowly-z-toast, 99999);padding:10px 12px;border-radius:var(--flowly-radius-md, 10px);background:var(--flowly-bg-elevated, rgba(20,20,24,.96));border:1px solid var(--flowly-border-muted, rgba(255,255,255,.12));font-size:12px;max-width:300px;color:var(--flowly-text-primary, #fff);box-shadow:var(--flowly-shadow-floating, 0 12px 30px rgba(0,0,0,.35));';
      toast.textContent = message;

      if (tone === 'warn') {
        toast.style.borderColor = 'rgba(var(--flowly-accent-warning-rgb, 255 159 10), 0.5)';
      } else if (tone === 'success') {
        toast.style.borderColor = 'rgba(var(--flowly-accent-success-rgb, 34 197 94), 0.5)';
      } else if (tone === 'error') {
        toast.style.borderColor = 'rgba(var(--flowly-accent-danger-rgb, 255 92 77), 0.5)';
      }

      document.body.appendChild(toast);
      setTimeout(function () {
        toast.remove();
      }, 2800);
    }

    function handle(error, context) {
      const msg = error && error.message ? error.message : String(error || 'Erro desconhecido');
      console.error('[FlowlyError]', context || 'unknown', error);
      debugLog('[FlowlyErrorContext]', context, msg);
      notify(msg, 'error');
    }

    return {
      notify: notify,
      handle: handle
    };
  }

  window.FlowlyErrors = {
    create: createErrorHandler
  };
})();
