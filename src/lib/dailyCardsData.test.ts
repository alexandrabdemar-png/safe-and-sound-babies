import { describe, it, expect } from "vitest";
import { DAILY_CARDS } from "./dailyCardsData";
import {
  ALLOWED_ICONS,
  TITLE_MAX_LEN,
  BODY_MAX_LEN,
  type DailyCardCategory,
  type Season,
  type Holiday,
} from "./dailyCards";

const CATEGORIES: DailyCardCategory[] = [
  "Did You Know",
  "Today With Your Child",
  "Seasonal",
  "Nature & Animals",
  "Tiny Discoveries",
  "Everyday Moments",
];
const SEASONS: Season[] = ["spring", "summer", "fall", "winter", "all"];
const HOLIDAYS: Holiday[] = [
  "Valentine's Day",
  "Easter",
  "Mother's Day",
  "Father's Day",
  "Fourth of July",
  "Halloween",
  "Thanksgiving",
  "Christmas",
  "New Year's",
  "Back to School",
];

// Never/should/must/need to/experts recommend/always — case-insensitive,
// whole-word-ish so "already" doesn't false-positive on "always" etc.
const BANNED_PATTERNS: RegExp[] = [
  /\bshould\b/i,
  /\bmust\b/i,
  /\bneed(?:s)? to\b/i,
  /experts? recommend/i,
  /\balways\b/i,
  /\bnever\b/i,
];

describe("DAILY_CARDS — data integrity", () => {
  it("contains exactly 365 cards", () => {
    expect(DAILY_CARDS.length).toBe(365);
  });

  it("every id is unique and sequential starting at 1", () => {
    const ids = DAILY_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...Array(365)].map((_, i) => i + 1));
  });

  it("every card has a valid category", () => {
    for (const c of DAILY_CARDS) {
      expect(CATEGORIES).toContain(c.category);
    }
  });

  it("every card has a valid season", () => {
    for (const c of DAILY_CARDS) {
      expect(SEASONS).toContain(c.season);
    }
  });

  it("every card's holiday is either null or a valid holiday", () => {
    for (const c of DAILY_CARDS) {
      if (c.holiday !== null) expect(HOLIDAYS).toContain(c.holiday);
    }
  });

  it("every card uses an icon from the approved list", () => {
    for (const c of DAILY_CARDS) {
      expect(ALLOWED_ICONS as readonly string[]).toContain(c.icon);
    }
  });

  it("every title is non-empty and under the character limit", () => {
    for (const c of DAILY_CARDS) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.title.length).toBeLessThan(TITLE_MAX_LEN);
    }
  });

  it("every body is non-empty and under the character limit", () => {
    for (const c of DAILY_CARDS) {
      expect(c.body.length).toBeGreaterThan(0);
      expect(c.body.length).toBeLessThan(BODY_MAX_LEN);
    }
  });

  it("no title or body contains a banned directive word/phrase", () => {
    const offenders: string[] = [];
    for (const c of DAILY_CARDS) {
      for (const pattern of BANNED_PATTERNS) {
        if (pattern.test(c.title) || pattern.test(c.body)) {
          offenders.push(`#${c.id} (${pattern}): "${c.title}" / "${c.body}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no title or body contains a raw statistic/percentage (unless universally accepted count)", () => {
    // A blunt heuristic per spec ("statistics unless universally accepted")
    // — flags any standalone percentage. Universally-accepted counts (e.g.
    // "206 bones", "10,000 taste buds") are allowed since they're not
    // claiming a study/statistic, just a fixed anatomical fact.
    const offenders = DAILY_CARDS.filter((c) => /\d+(\.\d+)?%/.test(c.title + " " + c.body));
    expect(offenders).toEqual([]);
  });

  it("no two 'Today With Your Child' cards in the same age band have overlapping ageMin/ageMax as null (must be scoped)", () => {
    const kidCards = DAILY_CARDS.filter((c) => c.category === "Today With Your Child");
    expect(kidCards.length).toBeGreaterThan(0);
    for (const c of kidCards) {
      expect(c.ageMinMonths).not.toBeNull();
      expect(c.ageMaxMonths).not.toBeNull();
      expect(c.ageMinMonths as number).toBeLessThanOrEqual(c.ageMaxMonths as number);
    }
  });

  it("only 'Today With Your Child' and 'Everyday Moments' cards may carry an age range; every other category stays fully evergreen", () => {
    for (const c of DAILY_CARDS) {
      if (c.category !== "Today With Your Child" && c.category !== "Everyday Moments") {
        expect(c.ageMinMonths).toBeNull();
        expect(c.ageMaxMonths).toBeNull();
      }
    }
  });

  it("any age range set on an 'Everyday Moments' card is internally consistent (min <= max when both set)", () => {
    const moments = DAILY_CARDS.filter((c) => c.category === "Everyday Moments");
    for (const c of moments) {
      if (c.ageMinMonths !== null && c.ageMaxMonths !== null) {
        expect(c.ageMinMonths).toBeLessThanOrEqual(c.ageMaxMonths);
      }
    }
  });

  it("at least some 'Everyday Moments' cards are age-scoped and at least some remain fully evergreen", () => {
    // Regression: reported bug — a pre-verbal 10-month-old was shown "One
    // more bedtime story" (assumes the child requests a book by name).
    // Everyday Moments cards that assume a specific developmental skill
    // now carry an age range; ones that genuinely fit any age stay null.
    const moments = DAILY_CARDS.filter((c) => c.category === "Everyday Moments");
    const ageScoped = moments.filter((c) => c.ageMinMonths !== null || c.ageMaxMonths !== null);
    const evergreen = moments.filter((c) => c.ageMinMonths === null && c.ageMaxMonths === null);
    expect(ageScoped.length).toBeGreaterThan(0);
    expect(evergreen.length).toBeGreaterThan(0);
  });

  it("every holiday-tagged card's season is 'all' (holiday window already scopes it in time)", () => {
    for (const c of DAILY_CARDS) {
      if (c.holiday !== null) expect(c.season).toBe("all");
    }
  });

  it("category distribution matches the requested library shape", () => {
    const counts: Record<string, number> = {};
    for (const c of DAILY_CARDS) counts[c.category] = (counts[c.category] ?? 0) + 1;
    expect(counts).toEqual({
      "Did You Know": 70,
      "Today With Your Child": 88,
      Seasonal: 44,
      "Nature & Animals": 60,
      "Tiny Discoveries": 55,
      "Everyday Moments": 48,
    });
  });

  it("every one of the 4 seasons and 10 holidays has at least one card", () => {
    const seasonal = DAILY_CARDS.filter((c) => c.category === "Seasonal");
    for (const s of ["spring", "summer", "fall", "winter"] as const) {
      expect(seasonal.filter((c) => c.season === s && c.holiday === null).length).toBeGreaterThan(
        0,
      );
    }
    for (const h of HOLIDAYS) {
      expect(seasonal.filter((c) => c.holiday === h).length).toBeGreaterThan(0);
    }
  });

  it("every age band (0-3 through 30-36 months) has at least one 'Today With Your Child' card", () => {
    const bands: [number, number][] = [
      [0, 3],
      [4, 6],
      [7, 9],
      [10, 12],
      [12, 18],
      [18, 24],
      [24, 30],
      [30, 36],
    ];
    const kidCards = DAILY_CARDS.filter((c) => c.category === "Today With Your Child");
    for (const [min, max] of bands) {
      const mid = Math.round((min + max) / 2);
      const covering = kidCards.filter(
        (c) => (c.ageMinMonths as number) <= mid && (c.ageMaxMonths as number) >= mid,
      );
      expect(covering.length).toBeGreaterThan(0);
    }
  });

  it("no exact duplicate titles", () => {
    const titles = DAILY_CARDS.map((c) => c.title.trim().toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("no exact duplicate bodies", () => {
    const bodies = DAILY_CARDS.map((c) => c.body.trim().toLowerCase());
    expect(new Set(bodies).size).toBe(bodies.length);
  });

  it("no card compares one child to another (no 'than other'/'ahead of'/'behind other' phrasing)", () => {
    const offenders = DAILY_CARDS.filter((c) =>
      /than other (babies|toddlers|children|kids)|ahead of (schedule|other)|behind (other|schedule)/i.test(
        c.title + " " + c.body,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
