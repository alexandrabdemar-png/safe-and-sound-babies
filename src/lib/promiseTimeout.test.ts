import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout } from "./promiseTimeout";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the promise's value when it settles before the timeout", async () => {
    const onTimeout = vi.fn();
    const promise = withTimeout(Promise.resolve("ok"), 20000, onTimeout);
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toBe("ok");
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("rejects with the promise's error when it rejects before the timeout", async () => {
    const onTimeout = vi.fn();
    const promise = withTimeout(Promise.reject(new Error("boom")), 20000, onTimeout);
    // Attach a rejection handler immediately so vitest doesn't flag an
    // unhandled rejection while the timers below are still advancing.
    const assertion = expect(promise).rejects.toThrow("boom");
    await vi.advanceTimersByTimeAsync(0);
    await assertion;
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("calls onTimeout exactly once when the promise never settles in time (the live OAuth-hang bug)", async () => {
    const onTimeout = vi.fn();
    const neverSettles = new Promise<string>(() => {});
    withTimeout(neverSettles, 20000, onTimeout);
    await vi.advanceTimersByTimeAsync(19999);
    expect(onTimeout).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("does not call onTimeout again, and the returned promise never settles, if the original promise resolves late", async () => {
    const onTimeout = vi.fn();
    let resolveLate: (v: string) => void;
    const lateResolving = new Promise<string>((resolve) => {
      resolveLate = resolve;
    });
    const result = withTimeout(lateResolving, 20000, onTimeout);

    const thenSpy = vi.fn();
    const catchSpy = vi.fn();
    result.then(thenSpy, catchSpy);

    await vi.advanceTimersByTimeAsync(20000);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    resolveLate!("too late");
    await vi.advanceTimersByTimeAsync(1000);
    expect(thenSpy).not.toHaveBeenCalled();
    expect(catchSpy).not.toHaveBeenCalled();
  });

  it("clears the timer on a normal resolution so onTimeout can't fire afterward", async () => {
    const onTimeout = vi.fn();
    const promise = withTimeout(Promise.resolve("fast"), 20000, onTimeout);
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toBe("fast");
    await vi.advanceTimersByTimeAsync(25000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
