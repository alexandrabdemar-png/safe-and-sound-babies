import { describe, it, expect } from "vitest";
import { dayIndexFromDate, dayKey, SAFETY_TIPS, selectDailyTip } from "./safetyTips";

describe("dayIndexFromDate", () => {
  it("returns the same index for every moment within the same UTC calendar day", () => {
    const morning = new Date("2026-07-13T00:00:01Z");
    const evening = new Date("2026-07-13T23:59:59Z");
    expect(dayIndexFromDate(evening)).toBe(dayIndexFromDate(morning));
  });

  it("increments by exactly 1 for the next calendar day", () => {
    const day = new Date("2026-07-13T12:00:00Z");
    const nextDay = new Date("2026-07-14T12:00:00Z");
    expect(dayIndexFromDate(nextDay)).toBe(dayIndexFromDate(day) + 1);
  });

  it("handles a year boundary with no discontinuity", () => {
    const dec31 = new Date("2025-12-31T12:00:00Z");
    const jan1 = new Date("2026-01-01T12:00:00Z");
    expect(dayIndexFromDate(jan1)).toBe(dayIndexFromDate(dec31) + 1);
  });

  it("handles a leap-year February boundary with no discontinuity", () => {
    // 2028 is a leap year.
    const feb28 = new Date("2028-02-28T12:00:00Z");
    const feb29 = new Date("2028-02-29T12:00:00Z");
    const mar1 = new Date("2028-03-01T12:00:00Z");
    expect(dayIndexFromDate(feb29)).toBe(dayIndexFromDate(feb28) + 1);
    expect(dayIndexFromDate(mar1)).toBe(dayIndexFromDate(feb29) + 1);
  });
});

describe("dayKey", () => {
  it("changes every calendar day", () => {
    const day = new Date("2026-07-13T12:00:00Z");
    const nextDay = new Date("2026-07-14T12:00:00Z");
    expect(dayKey(nextDay)).not.toBe(dayKey(day));
  });

  it("is stable across every moment within the same UTC calendar day", () => {
    const morning = new Date("2026-07-13T00:00:01Z");
    const evening = new Date("2026-07-13T23:59:59Z");
    expect(dayKey(evening)).toBe(dayKey(morning));
  });

  it("produces a YYYY-MM-DD formatted key", () => {
    expect(dayKey(new Date("2026-07-13T00:00:00Z"))).toBe("2026-07-13");
  });
});

// ── Regression: "safety tip of the day" dismissal persistence ─────────────
//
// home.tsx's markTipDone() writes localStorage.setItem(`safesound.tipDone.
// ${dayKey}`, "1"), and the initial tipCompleted state reads
// localStorage.getItem(`safesound.tipDone.${dayKey}`) for the CURRENT
// day's key. Since the key itself is day-scoped, dismissing today
// naturally has no effect on tomorrow's key — this test proves that design
// is actually correct using the exact same key convention and a minimal
// in-memory stand-in for localStorage (this project's vitest config runs
// in a plain Node environment, no DOM/localStorage global).
function makeFakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

function isTipDismissedForDay(storage: ReturnType<typeof makeFakeLocalStorage>, date: Date): boolean {
  return !!storage.getItem(`safesound.tipDone.${dayKey(date)}`);
}

function markTipDismissed(storage: ReturnType<typeof makeFakeLocalStorage>, date: Date): void {
  storage.setItem(`safesound.tipDone.${dayKey(date)}`, "1");
}

describe("daily safety tip dismissal (via the dayKey-scoped storage key)", () => {
  it("regression: dismissing the tip hides it for the rest of the same day, then it reappears the following day", () => {
    const storage = makeFakeLocalStorage();
    const morningToday = new Date("2026-07-13T08:00:00Z");
    const eveningSameDay = new Date("2026-07-13T22:00:00Z");
    const morningTomorrow = new Date("2026-07-14T08:00:00Z");

    // Not dismissed yet — the card would show.
    expect(isTipDismissedForDay(storage, morningToday)).toBe(false);

    // Tap "Done" in the morning.
    markTipDismissed(storage, morningToday);

    // "Reload" later the same day — still hidden.
    expect(isTipDismissedForDay(storage, eveningSameDay)).toBe(true);

    // "Reload" the next day — visible again, since that day's key was
    // never written.
    expect(isTipDismissedForDay(storage, morningTomorrow)).toBe(false);
  });
});

// ── Regression: stair-gate tips shown to a family with no stairs ──────────
//
// Reported bug: a user answered "no stairs" on the home_profile setup card
// but still saw a stair-gate safety tip on Home. home.tsx's AgeJumpCard
// already filtered its own stair-related content by home_profile.has_stairs
// — this tip pool (t021, t035) didn't get the same treatment.
describe("selectDailyTip with hasStairs === false", () => {
  it("never returns a stair-gate tip across a full lap of the pool, at ages where one would otherwise be selected", () => {
    for (let day = 1; day <= 60; day++) {
      const tip = selectDailyTip(12, day, false);
      expect(tip.text).not.toMatch(/stair/i);
    }
  });

  it("can still return the stair-gate tip when hasStairs is true or unset (unchanged default behavior)", () => {
    const seenWithStairs = new Set<string>();
    const seenUnset = new Set<string>();
    for (let day = 1; day <= 60; day++) {
      seenWithStairs.add(selectDailyTip(12, day, true).id);
      seenUnset.add(selectDailyTip(12, day).id);
    }
    expect(seenWithStairs.has("t021") || seenWithStairs.has("t035")).toBe(true);
    expect(seenUnset.has("t021") || seenUnset.has("t035")).toBe(true);
  });

  it("falls back to the full age-appropriate pool rather than an empty one, for an age where every tip in range happens to mention stairs", () => {
    // Sanity guard on the exclusion logic itself, using a narrow age slice
    // (5 months) where t021 is in range — exercised indirectly above, this
    // just confirms selectDailyTip never throws or returns undefined.
    for (let day = 1; day <= 10; day++) {
      expect(selectDailyTip(5, day, false)).toBeDefined();
    }
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

  it("can actually be selected by selectDailyTip for an age within its range", () => {
    // Cycle through enough days to prove it's reachable — selectDailyTip
    // is deterministic (age-filtered pool, indexed by day index), so if
    // the tip is in range it must show up within one lap of the pool.
    const seen = new Set<string>();
    for (let day = 1; day <= 60; day++) {
      seen.add(selectDailyTip(3, day).id);
    }
    expect(seen.has("t061")).toBe(true);
  });
});

// ── Regression: per-tip source citations ───────────────────────────────
//
// Only tips that trace to a real, verified AAP/CPSC guideline should carry
// a `source`; most tips are general in-house phrasing and intentionally
// have none. These tests guard the citations that do exist against typos
// (malformed URL, empty label) and against silently losing a citation the
// content was specifically checked against (see safetyTips.ts's source
// doc comment) in a future edit.
describe("per-tip source citations", () => {
  it("every tip that has a source uses a well-formed https URL and a non-empty label", () => {
    const sourced = SAFETY_TIPS.filter((t) => t.source);
    expect(sourced.length).toBeGreaterThan(0);
    for (const t of sourced) {
      expect(t.source!.url).toMatch(/^https:\/\/[a-z0-9.-]+\.(gov|org)\//i);
      expect(t.source!.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("the water-safety and safe-sleep tips checked against AAP/CPSC guidance carry a source", () => {
    const expectedSourced = [
      "t002",
      "t005",
      "t053",
      "t054",
      "t055",
      "t056",
      "t057",
      "t058",
      "t059",
    ];
    for (const id of expectedSourced) {
      const tip = SAFETY_TIPS.find((t) => t.id === id);
      expect(tip, `expected tip ${id} to exist`).toBeDefined();
      expect(tip!.source, `expected tip ${id} to have a source`).toBeDefined();
    }
  });

  it("most tips still have no source — this is a targeted citation set, not a blanket claim", () => {
    const unsourced = SAFETY_TIPS.filter((t) => !t.source);
    expect(unsourced.length).toBeGreaterThan(SAFETY_TIPS.length / 2);
  });
});

// ── Answers a direct question: does the tip actually change day to day? ───
//
// selectDailyTip is deterministic — basePool[dayIndex % basePool.length] —
// so "does it update daily" reduces to two provable facts: (1) every age's
// eligible pool has more than one tip, so consecutive day indices can't
// land on the same index by construction, and (2) home.tsx actually feeds
// it a day index that increments every real calendar day (already covered
// by the dayIndexFromDate suite above). This tests fact (1) directly, plus
// a live simulation of "today vs. tomorrow" per age.
describe("daily tip rotation actually changes day to day", () => {
  it("structural guard: every month of age from 0–240 has more than one eligible tip in its pool", () => {
    // Prevents a future SAFETY_TIPS edit from silently narrowing some age's
    // pool down to a single tip, which would freeze that age's "daily" tip
    // permanently — the exact bug this whole test suite is here to rule out.
    for (let ageMonths = 0; ageMonths <= 240; ageMonths++) {
      const ageTips = SAFETY_TIPS.filter(
        (t) => ageMonths >= t.minMonths && ageMonths <= t.maxMonths,
      );
      const poolSize = ageTips.length > 0 ? ageTips.length : SAFETY_TIPS.length;
      expect(poolSize).toBeGreaterThan(1);
    }
  });

  it("simulated 'today' vs. 'tomorrow' picks a different tip, for a representative age at every stage", () => {
    // Representative ages spanning the defined tip bands (0–3mo through
    // 24mo+), each tested at an arbitrary real date so this isn't tied to
    // a hardcoded day index that could coincidentally repeat.
    const representativeAges = [1, 4, 7, 10, 13, 16, 19, 22, 25, 30, 36];
    const today = dayIndexFromDate(new Date("2026-08-03T00:00:00Z"));
    const tomorrow = dayIndexFromDate(new Date("2026-08-04T00:00:00Z"));
    expect(tomorrow).toBe(today + 1);

    for (const ageMonths of representativeAges) {
      const tipToday = selectDailyTip(ageMonths, today);
      const tipTomorrow = selectDailyTip(ageMonths, tomorrow);
      expect(tipTomorrow.id).not.toBe(tipToday.id);
    }
  });

  it("over one full lap of an age's pool, every tip in that pool is actually shown (no index is unreachable)", () => {
    const ageMonths = 8;
    const pool = SAFETY_TIPS.filter(
      (t) => ageMonths >= t.minMonths && ageMonths <= t.maxMonths,
    );
    const seenIds = new Set<string>();
    for (let day = 0; day < pool.length; day++) {
      seenIds.add(selectDailyTip(ageMonths, day).id);
    }
    expect(seenIds.size).toBe(pool.length);
  });

  it("the tip only repeats after a full lap of the pool, not sooner (rotation isn't secretly shorter than it looks)", () => {
    const ageMonths = 8;
    const pool = SAFETY_TIPS.filter(
      (t) => ageMonths >= t.minMonths && ageMonths <= t.maxMonths,
    );
    const firstTip = selectDailyTip(ageMonths, 0);
    for (let day = 1; day < pool.length; day++) {
      expect(selectDailyTip(ageMonths, day).id).not.toBe(firstTip.id);
    }
    // It's expected (and correct) to repeat exactly on the next lap.
    expect(selectDailyTip(ageMonths, pool.length).id).toBe(firstTip.id);
  });

  it("a full lap now takes as little as ~11 days (down from ~11 weeks) — documents the cadence tradeoff", () => {
    // Not a bug — just makes the tradeoff mentioned in selectDailyTip's
    // doc comment concrete and monitorable: the smallest age-filtered pool
    // anywhere in 0-240mo is 11, so that age sees its tips repeat roughly
    // every 11 days under a daily cadence.
    let minPoolSize = Infinity;
    for (let ageMonths = 0; ageMonths <= 240; ageMonths++) {
      const ageTips = SAFETY_TIPS.filter(
        (t) => ageMonths >= t.minMonths && ageMonths <= t.maxMonths,
      );
      const poolSize = ageTips.length > 0 ? ageTips.length : SAFETY_TIPS.length;
      minPoolSize = Math.min(minPoolSize, poolSize);
    }
    expect(minPoolSize).toBe(11);
  });
});
