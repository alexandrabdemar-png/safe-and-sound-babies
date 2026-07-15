import { describe, it, expect } from "vitest";
import { getIsoWeekNumber, weekKey, SAFETY_TIPS, selectWeeklyTip } from "./safetyTips";

describe("getIsoWeekNumber", () => {
  it("returns the same week number for every day in the same ISO week (Mon–Sun)", () => {
    // 2026-07-13 is a Monday; the ISO week runs through Sunday 2026-07-19.
    const monday = new Date("2026-07-13T00:00:00Z");
    const wednesday = new Date("2026-07-15T00:00:00Z");
    const sunday = new Date("2026-07-19T00:00:00Z");
    const weekNum = getIsoWeekNumber(monday);
    expect(getIsoWeekNumber(wednesday)).toBe(weekNum);
    expect(getIsoWeekNumber(sunday)).toBe(weekNum);
  });

  it("returns a different week number once the ISO week rolls over on Monday", () => {
    const sunday = new Date("2026-07-19T00:00:00Z");
    const nextMonday = new Date("2026-07-20T00:00:00Z");
    expect(getIsoWeekNumber(nextMonday)).toBe(getIsoWeekNumber(sunday) + 1);
  });

  it("handles the year-boundary edge case correctly (ISO week can belong to the prior/next year)", () => {
    // 2026-01-01 is a Thursday, which ISO 8601 places in week 1 of 2026 —
    // a naive day-of-year calculation would get this wrong.
    expect(getIsoWeekNumber(new Date("2026-01-01T00:00:00Z"))).toBe(1);
  });
});

describe("weekKey", () => {
  it("is stable across every day within the same ISO week", () => {
    const monday = new Date("2026-07-13T00:00:00Z");
    const friday = new Date("2026-07-17T00:00:00Z");
    expect(weekKey(friday)).toBe(weekKey(monday));
  });

  it("changes once the ISO week rolls over", () => {
    const sunday = new Date("2026-07-19T00:00:00Z");
    const nextMonday = new Date("2026-07-20T00:00:00Z");
    expect(weekKey(nextMonday)).not.toBe(weekKey(sunday));
  });

  it("produces a YYYY-Www formatted key", () => {
    expect(weekKey(new Date("2026-07-13T00:00:00Z"))).toMatch(/^\d{4}-W\d{2}$/);
  });
});

// ── Regression: "safety tip of the week" dismissal persistence ────────────
//
// home.tsx's markTipDone() writes localStorage.setItem(`safesound.tipDone.
// ${weekKey}`, "1"), and the initial tipCompleted state reads
// localStorage.getItem(`safesound.tipDone.${weekKey}`) for the CURRENT
// week's key. Since the key itself is week-scoped, dismissing this week
// naturally has no effect on next week's key — this test proves that
// design is actually correct using the exact same key convention and a
// minimal in-memory stand-in for localStorage (this project's vitest
// config runs in a plain Node environment, no DOM/localStorage global).
function makeFakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

function isTipDismissedForWeek(storage: ReturnType<typeof makeFakeLocalStorage>, date: Date): boolean {
  return !!storage.getItem(`safesound.tipDone.${weekKey(date)}`);
}

function markTipDismissed(storage: ReturnType<typeof makeFakeLocalStorage>, date: Date): void {
  storage.setItem(`safesound.tipDone.${weekKey(date)}`, "1");
}

describe("weekly safety tip dismissal (via the weekKey-scoped storage key)", () => {
  it("regression: dismissing the tip hides it for the rest of the same week, then it reappears the following week", () => {
    const storage = makeFakeLocalStorage();
    const mondayThisWeek = new Date("2026-07-13T00:00:00Z");
    const fridaySameWeek = new Date("2026-07-17T00:00:00Z");
    const mondayNextWeek = new Date("2026-07-20T00:00:00Z");

    // Not dismissed yet — the card would show.
    expect(isTipDismissedForWeek(storage, mondayThisWeek)).toBe(false);

    // Tap "Done" on Monday.
    markTipDismissed(storage, mondayThisWeek);

    // "Reload" later in the same week — still hidden.
    expect(isTipDismissedForWeek(storage, fridaySameWeek)).toBe(true);

    // "Reload" the following week — visible again, since that week's key
    // was never written.
    expect(isTipDismissedForWeek(storage, mondayNextWeek)).toBe(false);
  });
});

describe("pacifier size-appropriateness tip", () => {
  it("exists in the tip pool and covers the common pacifier-use age range", () => {
    const tip = SAFETY_TIPS.find((t) => t.id === "t061");
    expect(tip).toBeDefined();
    expect(tip!.text).toMatch(/pacifier/i);
    expect(tip!.text).toMatch(/size/i);
    expect(tip!.minMonths).toBe(0);
    expect(tip!.maxMonths).toBeGreaterThanOrEqual(18);
  });

  it("can actually be selected by selectWeeklyTip for an age within its range", () => {
    // Cycle through enough weeks to prove it's reachable — selectWeeklyTip
    // is deterministic (age-filtered pool, indexed by week number), so if
    // the tip is in range it must show up within one lap of the pool.
    const seen = new Set<string>();
    for (let week = 1; week <= 60; week++) {
      seen.add(selectWeeklyTip(3, week).id);
    }
    expect(seen.has("t061")).toBe(true);
  });
});
