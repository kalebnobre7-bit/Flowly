(function () {
  function createErrorHandler(deps) {
    const debugLog = (deps && deps.debugLog) || function () {};

    function notify(message, level) {
      const tone = level || 'error';
      const toast = document.createElement('div');
      toast.className = 'flowly-toast';
      toast.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:99999;padding:10px 12px;border-radius:10px;background:rgba(20,20,24,.96);border:1px solid rgba(255,255,255,.12);font-size:12px;max-width:300px;color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.35);';
      toast.textContent = message;

      if (tone === 'warn') toast.style.borderColor = 'rgba(255,159,10,.5)';
      if (tone === 'success') toast.style.borderColor = 'rgba(48,209,88,.5)';

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
