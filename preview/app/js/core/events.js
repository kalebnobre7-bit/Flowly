(function () {
  function createEventBus() {
    const listeners = new Map();

    function on(eventName, handler) {
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(handler);
      return function unsubscribe() {
        off(eventName, handler);
      };
    }

    function off(eventName, handler) {
      if (!listeners.has(eventName)) return;
      listeners.get(eventName).delete(handler);
    }

    function emit(eventName, payload) {
      if (!listeners.has(eventName)) return;
      listeners.get(eventName).forEach(function (handler) {
        try {
          handler(payload);
        } catch (err) {
          console.error('[EventBus] handler error:', eventName, err);
        }
      });
    }

    return { on: on, off: off, emit: emit };
  }

  window.FlowlyEvents = {
    createEventBus: createEventBus
  };
})();
