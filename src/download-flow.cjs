// Bounds discovery independently of network speed; cancellation wakes producers.
function createDownloadFlow({ signal, shouldYield = () => false, limit = 256 }) {
  let pending = 0;
  const waiters = new Set();
  const wake = () => { for (const resolve of waiters) resolve(); waiters.clear(); };
  signal.addEventListener('abort', wake);
  return {
    async reserve() {
      while (pending >= limit && !signal.aborted) await new Promise(resolve => waiters.add(resolve));
      if (signal.aborted) return false;
      pending++;
      return true;
    },
    release() { pending = Math.max(0, pending - 1); wake(); },
    async yieldForInteraction() {
      if (!shouldYield() || signal.aborted) return;
      await new Promise(resolve => {
        const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
        const timer = setTimeout(done, 24);
        signal.addEventListener('abort', done, { once: true });
      });
    },
    get pending() { return pending; },
    dispose() { signal.removeEventListener('abort', wake); wake(); }
  };
}
module.exports = { createDownloadFlow };
