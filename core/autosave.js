function createWindowScheduler() {
  return {
    setTimeout(callback, delay) {
      return window.setTimeout(callback, delay);
    },
    clearTimeout(task) {
      window.clearTimeout(task);
    },
    requestIdle(callback, timeout) {
      if (typeof window.requestIdleCallback === "function") {
        return window.requestIdleCallback(callback, { timeout });
      }
      return window.setTimeout(callback, 120);
    },
    cancelIdle(task) {
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(task);
      } else {
        window.clearTimeout(task);
      }
    },
  };
}

export function createAutosave({ delayMs, onSave, scheduler = createWindowScheduler() }) {
  let timer = 0;
  let idleTask = 0;
  let inFlight = null;
  let pending = false;
  let flushFlight = null;

  function cancelScheduled() {
    if (timer) {
      scheduler.clearTimeout(timer);
      timer = 0;
    }
    if (idleTask) {
      scheduler.cancelIdle(idleTask);
      idleTask = 0;
    }
  }

  function schedulePending() {
    if (!pending || inFlight) {
      return;
    }

    cancelScheduled();
    timer = scheduler.setTimeout(() => {
      timer = 0;
      idleTask = scheduler.requestIdle(() => {
        idleTask = 0;
        startSave();
      }, 500);
    }, delayMs);
  }

  function startSave() {
    if (inFlight) {
      return inFlight;
    }

    pending = false;
    const execution = (async () => {
      try {
        await onSave();
      } finally {
        inFlight = null;
        if (pending) {
          schedulePending();
        }
      }
    })();

    inFlight = execution;
    execution.catch(() => {});
    return execution;
  }

  async function flushInternal() {
    cancelScheduled();
    const active = inFlight;
    let activeError = null;

    if (active) {
      try {
        await active;
      } catch (error) {
        activeError = error;
      }
      cancelScheduled();
    }

    if (pending || !active) {
      try {
        await startSave();
        activeError = null;
      } catch (error) {
        activeError = error;
      }
    }

    if (activeError) {
      throw activeError;
    }
  }

  function flush() {
    if (flushFlight) {
      return flushFlight;
    }

    const result = flushInternal();
    flushFlight = result;
    result.catch(() => {}).finally(() => {
      if (flushFlight === result) {
        flushFlight = null;
      }
    });
    return result;
  }

  function queue() {
    pending = true;
    schedulePending();
  }

  return { queue, flush };
}
