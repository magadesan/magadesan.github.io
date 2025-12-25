// Simple logger module to replace terminal usage.
// Exposes a global `logger` with a minimal API: write, onData, open, dispose.
(function () {
  if (typeof window === 'undefined') return;

  const listeners = [];

  const logger = {
    write(text) {
      try {
        const out = String(text).replace(/\r/g, '');
        console.log(out);
      } catch (e) {
        console.log(text);
      }
    },
    onData(cb) {
      if (typeof cb === 'function') listeners.push(cb);
      // No interactive input source by default.
    },
    open() {},
    dispose() { listeners.length = 0; }
  };

  window.logger = logger;
  // also expose global name for non-module code
  if (typeof logger !== 'undefined') window.logger = logger;
})();
