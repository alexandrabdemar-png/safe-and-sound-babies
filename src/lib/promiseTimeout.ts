/**
 * Races `promise` against a timeout. If `promise` hasn't settled within
 * `timeoutMs`, calls `onTimeout` once and the returned promise never
 * settles — any later settlement of the original `promise` is silently
 * ignored rather than double-firing a result.
 *
 * Built for OAuth popup/broker flows that can hang indefinitely with no
 * rejection of their own (no postMessage, popup never closed) — without
 * this, a caller `await`-ing such a promise has no way to recover.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void,
): Promise<T> {
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    onTimeout();
  }, timeoutMs);

  return promise.then(
    (value) => {
      clearTimeout(timer);
      if (timedOut) return new Promise<T>(() => {});
      return value;
    },
    (err) => {
      clearTimeout(timer);
      if (timedOut) return new Promise<T>(() => {});
      throw err;
    },
  );
}

/**
 * Like `promise`, but rejects with a timeout error if it hasn't settled
 * within `timeoutMs`. Unlike withTimeout above, the result always settles,
 * so callers' catch/finally blocks still run.
 *
 * Used around native (Capacitor) plugin calls: if a native call never
 * answers, anything awaiting it — including Supabase's auth lock — would
 * otherwise wait forever.
 */
export function settleWithin<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = "Operation",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
