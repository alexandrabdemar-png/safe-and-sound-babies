import { describe, it, expect } from "vitest";
import { isCardEligible, pickDailyCard, seasonForDate, type DailyCard } from "./dailyCards";

function card(overrides: Partial<DailyCard>): DailyCard {
  return {
    id: 1,
    category: "Did You Know",
    ageMinMonths: null,
    ageMaxMonths: null,
    season: "all",
    holiday: null,
    icon: "🧠",
    title: "Test title",
    body: "Test body",
    ...overrides,
  };
}

describe("seasonForDate", () => {
  it("maps calendar months to meteorological Northern-hemisphere seasons", () => {
    expect(seasonForDate(new Date(2026, 0, 15))).toBe("winter"); // Jan
    expect(seasonForDate(new Date(2026, 2, 20))).toBe("spring"); // Mar
    expect(seasonForDate(new Date(2026, 5, 21))).toBe("summer"); // Jun
    expect(seasonForDate(new Date(2026, 8, 22))).toBe("fall"); // Sep
    expect(seasonForDate(new Date(2026, 11, 25))).toBe("winter"); // Dec
  });
});

describe("isCardEligible", () => {
  it("excludes 'Today With Your Child' cards when there is no child profile (ageMonths null)", () => {
    const c = card({ category: "Today With Your Child", ageMinMonths: 4, ageMaxMonths: 6 });
    expect(isCardEligible(c, new Date(2026, 0, 1), null)).toBe(false);
  });

  it("includes a 'Today With Your Child' card only when age falls within its band", () => {
    const c = card({ category: "Today With Your Child", ageMinMonths: 4, ageMaxMonths: 6 });
    expect(isCardEligible(c, new Date(2026, 0, 1), 5)).toBe(true);
    expect(isCardEligible(c, new Date(2026, 0, 1), 3)).toBe(false);
    expect(isCardEligible(c, new Date(2026, 0, 1), 7)).toBe(false);
    // Boundary-inclusive both ends
    expect(isCardEligible(c, new Date(2026, 0, 1), 4)).toBe(true);
    expect(isCardEligible(c, new Date(2026, 0, 1), 6)).toBe(true);
  });

  it("always allows a non-age-gated category regardless of profile state", () => {
    const c = card({ category: "Did You Know" });
    expect(isCardEligible(c, new Date(2026, 0, 1), null)).toBe(true);
    expect(isCardEligible(c, new Date(2026, 0, 1), 14)).toBe(true);
  });

  it("gates a season-specific card to its season", () => {
    const c = card({ category: "Seasonal", season: "summer" });
    expect(isCardEligible(c, new Date(2026, 6, 1), null)).toBe(true); // July
    expect(isCardEligible(c, new Date(2026, 0, 1), null)).toBe(false); // January
  });

  it("gates a holiday card to a window around that date, regardless of season field", () => {
    const c = card({ category: "Seasonal", season: "all", holiday: "Christmas" });
    expect(isCardEligible(c, new Date(2026, 11, 25), null)).toBe(true); // on the day
    expect(isCardEligible(c, new Date(2026, 11, 20), null)).toBe(true); // within window
    expect(isCardEligible(c, new Date(2026, 6, 4), null)).toBe(false); // July, nowhere close
  });

  it("handles a New Year's-style holiday that straddles the Dec/Jan boundary", () => {
    const c = card({ category: "Seasonal", season: "all", holiday: "New Year's" });
    expect(isCardEligible(c, new Date(2026, 11, 31), null)).toBe(true);
    expect(isCardEligible(c, new Date(2027, 0, 2), null)).toBe(true);
    expect(isCardEligible(c, new Date(2026, 5, 15), null)).toBe(false);
  });
});

describe("pickDailyCard", () => {
  const alwaysEligible = (n: number): DailyCard[] =>
    Array.from({ length: n }, (_, i) => card({ id: i + 1, title: `Card ${i + 1}` }));

  it("is deterministic — same library/date/age always returns the same card", () => {
    const lib = alwaysEligible(5);
    const dayOfYearFn = () => 42;
    const a = pickDailyCard(lib, new Date(2026, 0, 1), null, dayOfYearFn);
    const b = pickDailyCard(lib, new Date(2026, 0, 1), null, dayOfYearFn);
    expect(a.id).toBe(b.id);
  });

  it("rotates through the eligible pool as day-of-year advances, without repeating until exhausted", () => {
    const lib = alwaysEligible(5);
    const picks = [1, 2, 3, 4, 5, 6].map(
      (doy) => pickDailyCard(lib, new Date(2026, 0, 1), null, () => doy).id,
    );
    // 5-card pool, 6 consecutive days: day 6 must repeat day 1's card.
    expect(picks[5]).toBe(picks[0]);
    // The first 5 days must cover all 5 distinct cards (a real rotation,
    // not e.g. always picking the same one).
    expect(new Set(picks.slice(0, 5)).size).toBe(5);
  });

  it("regression: excluding 'Today With Your Child' cards for a null-age profile still returns a real card, not a crash", () => {
    const lib = [
      card({ id: 1, category: "Today With Your Child", ageMinMonths: 0, ageMaxMonths: 3 }),
      card({ id: 2, category: "Did You Know" }),
    ];
    const result = pickDailyCard(lib, new Date(2026, 0, 1), null, () => 1);
    expect(result.id).toBe(2);
  });

  it("falls back to something rather than throwing when literally nothing in the library is eligible", () => {
    const lib = [card({ id: 1, category: "Seasonal", season: "winter" })];
    // July, no child profile — a winter-only card should not be eligible,
    // but pickDailyCard must still return *a* card rather than throwing.
    const result = pickDailyCard(lib, new Date(2026, 6, 15), null, () => 1);
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("only surfaces age-appropriate 'Today With Your Child' cards for a given child age", () => {
    const lib = [
      card({ id: 1, category: "Today With Your Child", ageMinMonths: 0, ageMaxMonths: 3 }),
      card({ id: 2, category: "Today With Your Child", ageMinMonths: 24, ageMaxMonths: 30 }),
      card({ id: 3, category: "Did You Know" }),
    ];
    // A 26-month-old should never receive the 0-3mo card.
    for (let doy = 1; doy <= 20; doy++) {
      const result = pickDailyCard(lib, new Date(2026, 0, 1), 26, () => doy);
      expect(result.id).not.toBe(1);
    }
  });
});
