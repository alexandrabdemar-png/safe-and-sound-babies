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
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => void): Promise<T> {
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
