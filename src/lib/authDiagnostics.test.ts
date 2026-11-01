import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthDiagnostics,
  readAuthDiagnostics,
  recordAuthDiagnostic,
  redact,
} from "./authDiagnostics";

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  vi.spyOn(console, "info").mockImplementation(() => {});
  clearAuthDiagnostics();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("auth diagnostics", () => {
  it("never stores email addresses or tokens", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    recordAuthDiagnostic("error", `signin: parent@example.com failed with token ${jwt}`);
    const detail = readAuthDiagnostics()[0].detail;
    expect(detail).toBe("signin: [email] failed with token [redacted]");
  });

  it("keeps ordinary diagnostic text readable", () => {
    expect(redact("POST /auth/v1/token?grant_type=password → 400 (231ms)")).toBe(
      "POST /auth/v1/token?grant_type=password → 400 (231ms)",
    );
  });

  it("keeps only the most recent 100 entries", () => {
    for (let i = 0; i < 130; i++) recordAuthDiagnostic("info", `entry ${i}`);
    const entries = readAuthDiagnostics();
    expect(entries).toHaveLength(100);
    expect(entries[0].detail).toBe("entry 30");
    expect(entries.at(-1)!.detail).toBe("entry 129");
  });

  it("never throws when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => recordAuthDiagnostic("info", "x")).not.toThrow();
    expect(readAuthDiagnostics()).toEqual([]);
  });
});
