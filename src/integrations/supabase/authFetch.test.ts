import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthFetch } from "./authFetch";
import { clearAuthDiagnostics, readAuthDiagnostics } from "@/lib/authDiagnostics";

function memoryLocalStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const AUTH_URL = "https://x.supabase.co/auth/v1/token?grant_type=password";

/** A fetch that never answers on its own but honours abort, like a stalled connection. */
function stalledFetch() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  );
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryLocalStorage());
  vi.spyOn(console, "info").mockImplementation(() => {});
  clearAuthDiagnostics();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createAuthFetch", () => {
  it("gives up on a stalled auth request instead of hanging", async () => {
    vi.useFakeTimers();
    const authFetch = createAuthFetch(stalledFetch() as unknown as typeof fetch, 20000);
    const req = authFetch(AUTH_URL, { method: "POST" });
    const assertion = expect(req).rejects.toThrow(/timed out after 20000ms/);
    await vi.advanceTimersByTimeAsync(20000);
    await assertion;
    expect(readAuthDiagnostics().at(-1)).toMatchObject({
      kind: "timeout",
      detail: "POST /auth/v1/token?grant_type=password gave up after 20000ms",
    });
  });

  it("leaves database, storage and function requests alone", async () => {
    vi.useFakeTimers();
    const base = stalledFetch();
    const authFetch = createAuthFetch(base as unknown as typeof fetch, 20000);
    let settled = false;
    void authFetch("https://x.supabase.co/functions/v1/ai-advice").finally(() => (settled = true));
    await vi.advanceTimersByTimeAsync(60000);
    expect(settled).toBe(false);
    expect(base.mock.calls[0][1]).toBeUndefined(); // passed through untouched
  });

  it("logs the status code and duration, without query values", async () => {
    const authFetch = createAuthFetch(async () => new Response("{}", { status: 400 }));
    const res = await authFetch(
      "https://x.supabase.co/auth/v1/signup?redirect_to=https%3A%2F%2Fa.b%2Fc",
      {
        method: "POST",
      },
    );
    expect(res.status).toBe(400);
    const last = readAuthDiagnostics().at(-1)!;
    expect(last.kind).toBe("request");
    expect(last.detail).toMatch(/^POST \/auth\/v1\/signup → 400 \(\d+ms\)$/);
  });

  it("still honours the caller's own abort signal", async () => {
    const authFetch = createAuthFetch(stalledFetch() as unknown as typeof fetch, 20000);
    const caller = new AbortController();
    const req = authFetch(AUTH_URL, { signal: caller.signal });
    caller.abort();
    await expect(req).rejects.toThrow(/Aborted/);
  });
});
