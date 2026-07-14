import { describe, it, expect } from "vitest";
import { WHATS_NEW, LATEST_VERSION, whatsNewDismissalKey } from "./whatsNew";

describe("LATEST_VERSION", () => {
  it("tracks WHATS_NEW's first (most recent) entry", () => {
    expect(LATEST_VERSION).toBe(WHATS_NEW[0].version);
  });
});

describe("whatsNewDismissalKey", () => {
  it("produces a different key for a different version", () => {
    expect(whatsNewDismissalKey("v1.3")).not.toBe(whatsNewDismissalKey("v1.4"));
  });

  it("is stable for the same version", () => {
    expect(whatsNewDismissalKey("v1.4")).toBe(whatsNewDismissalKey("v1.4"));
  });
});

// ── Regression: "What's New" stays hidden until genuinely new content ─────
//
// home.tsx's dismissWhatsNew() writes localStorage.setItem(
// whatsNewDismissalKey(LATEST_VERSION), "true"), and the initial
// whatsNewDismissed state reads the same key for the CURRENT
// LATEST_VERSION. Since the key is version-scoped, dismissing v1.4 has no
// effect once a new entry ships and LATEST_VERSION becomes v1.5 — this
// test proves that using the exact same key convention, with a minimal
// in-memory stand-in for localStorage (this project's vitest config runs
// in plain Node, no DOM/localStorage global).
function makeFakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

function isWhatsNewDismissed(storage: ReturnType<typeof makeFakeLocalStorage>, version: string): boolean {
  return storage.getItem(whatsNewDismissalKey(version)) === "true";
}

function dismissWhatsNewFor(storage: ReturnType<typeof makeFakeLocalStorage>, version: string): void {
  storage.setItem(whatsNewDismissalKey(version), "true");
}

describe("What's New dismissal (via the version-scoped storage key)", () => {
  it("regression: dismissing version A hides the banner for A, then a new version B reappears", () => {
    const storage = makeFakeLocalStorage();

    // Not dismissed yet for the current version.
    expect(isWhatsNewDismissed(storage, "v1.4")).toBe(false);

    // Tap the X to dismiss v1.4.
    dismissWhatsNewFor(storage, "v1.4");

    // "Reload" — still on v1.4, still hidden.
    expect(isWhatsNewDismissed(storage, "v1.4")).toBe(true);

    // New content ships — LATEST_VERSION becomes v1.5. The banner should
    // show again, since v1.5's key was never written.
    expect(isWhatsNewDismissed(storage, "v1.5")).toBe(false);
  });

  it("does not confuse similarly-prefixed versions (v1.4 vs v1.40)", () => {
    const storage = makeFakeLocalStorage();
    dismissWhatsNewFor(storage, "v1.4");
    expect(isWhatsNewDismissed(storage, "v1.40")).toBe(false);
  });
});
