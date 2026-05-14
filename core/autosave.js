export function createAutosave({ delayMs, onSave }) {
  let timer = 0;
  let idleTask = 0;

  async function flush() {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
    if (idleTask) {
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleTask);
      } else {
        window.clearTimeout(idleTask);
      }
      idleTask = 0;
    }
    await onSave();
  }

  function queue() {
    if (timer) {
      window.clearTimeout(timer);
    }

    timer = window.setTimeout(() => {
      timer = 0;
      if (typeof window.requestIdleCallback === "function") {
        idleTask = window.requestIdleCallback(async () => {
          idleTask = 0;
          await onSave();
        }, { timeout: 500 });
      } else {
        idleTask = window.setTimeout(async () => {
          idleTask = 0;
          await onSave();
        }, 120);
      }
    }, delayMs);
  }

  return { queue, flush };
}
