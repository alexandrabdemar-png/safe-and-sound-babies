// "Card of the day" — a 365-entry library of short, warm, non-medical
// content shown on the Home page's "Today" card, distinct from the
// existing age-bracket safety/weekend/growth-check tips in dailyContent.ts
// (those stay as-is; this is an additive, separate pool). Content lives in
// dailyCardsData.ts; this file is the pure, dependency-free selection
// engine so it's unit-testable without pulling in Supabase or React.

export type DailyCardCategory =
  | "Did You Know"
  | "Today With Your Child"
  | "Seasonal"
  | "Nature & Animals"
  | "Tiny Discoveries"
  | "Everyday Moments";

export type Season = "spring" | "summer" | "fall" | "winter" | "all";

export type Holiday =
  | "Valentine's Day"
  | "Easter"
  | "Mother's Day"
  | "Father's Day"
  | "Fourth of July"
  | "Halloween"
  | "Thanksgiving"
  | "Christmas"
  | "New Year's"
  | "Back to School";

export const ALLOWED_ICONS = [
  "🧠",
  "📚",
  "🌱",
  "🌸",
  "☀️",
  "🍂",
  "❄️",
  "🌎",
  "🐝",
  "🐢",
  "🦉",
  "🐧",
  "🦒",
  "🐬",
  "🌈",
  "🌙",
  "⭐",
  "🍓",
  "🚶",
  "🎵",
  "📖",
  "👣",
  "🧸",
] as const;

export type DailyCard = {
  id: number;
  category: DailyCardCategory;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  season: Season;
  holiday: Holiday | null;
  icon: string;
  title: string;
  body: string;
};

export const TITLE_MAX_LEN = 140;
export const BODY_MAX_LEN = 180;

/** Approximate US calendar date (month/day, year-agnostic) each holiday
 * card should be eligible around — a window, not an exact single day, so
 * a card still shows up for users who don't open the app on the exact
 * date. Independent of `season` (a holiday card's `season` field is
 * usually "all" so it isn't additionally season-gated). */
const HOLIDAY_WINDOWS: Record<Holiday, { month: number; day: number; windowDays: number }> = {
  "New Year's": { month: 1, day: 1, windowDays: 3 },
  "Valentine's Day": { month: 2, day: 14, windowDays: 3 },
  Easter: { month: 4, day: 9, windowDays: 10 }, // floats — generous window rather than computing the real date
  "Mother's Day": { month: 5, day: 11, windowDays: 7 },
  "Father's Day": { month: 6, day: 15, windowDays: 7 },
  "Fourth of July": { month: 7, day: 4, windowDays: 3 },
  "Back to School": { month: 8, day: 25, windowDays: 14 },
  Halloween: { month: 10, day: 31, windowDays: 7 },
  Thanksgiving: { month: 11, day: 27, windowDays: 5 },
  Christmas: { month: 12, day: 25, windowDays: 7 },
};

const NORTHERN_HEMISPHERE_SEASON_BY_MONTH: Season[] = [
  "winter",
  "winter",
  "spring",
  "spring",
  "spring",
  "summer",
  "summer",
  "summer",
  "fall",
  "fall",
  "fall",
  "winter",
]; // index 0 = January

/** Astronomical-ish, Northern-hemisphere calendar season for a given date
 * (meteorological seasons — Dec/Jan/Feb = winter, etc. — chosen over exact
 * equinox/solstice dates since the content itself is calendar-flavored,
 * not astronomy-precise). */
export function seasonForDate(date: Date): Season {
  return NORTHERN_HEMISPHERE_SEASON_BY_MONTH[date.getMonth()];
}

function dayDistance(a: { month: number; day: number }, date: Date): number {
  // Compares month/day against `date` within a single year, wrapping
  // across the Dec→Jan boundary (relevant for New Year's/Christmas).
  const year = date.getFullYear();
  const target = new Date(year, a.month - 1, a.day);
  const oneDay = 86400000;
  const candidates = [
    Math.abs((date.getTime() - target.getTime()) / oneDay),
    Math.abs((date.getTime() - new Date(year - 1, a.month - 1, a.day).getTime()) / oneDay),
    Math.abs((date.getTime() - new Date(year + 1, a.month - 1, a.day).getTime()) / oneDay),
  ];
  return Math.min(...candidates);
}

function isHolidayActive(holiday: Holiday, date: Date): boolean {
  const w = HOLIDAY_WINDOWS[holiday];
  return dayDistance(w, date) <= w.windowDays;
}

/**
 * True when `card` is eligible to show on `date` for a child whose age in
 * months is `ageMonths` (null = no child profile / evergreen browsing).
 *
 *  - Any card with an ageMinMonths/ageMaxMonths set is age-scoped — not
 *    just "Today With Your Child" (which always has one), but also any
 *    other category's card where the content assumes a skill the child
 *    may not have yet (e.g. an "Everyday Moments" card about requesting a
 *    bedtime book by name doesn't fit a pre-verbal 10-month-old). With no
 *    profile (ageMonths === null), every age-scoped card is excluded —
 *    evergreen browsing falls back to cards with no age range at all, per
 *    spec ("if it's a general profile these can be more evergreen").
 *  - A card with a holiday only shows within that holiday's window.
 *  - A card with a specific season (not "all") only shows during that
 *    calendar season.
 *  - None of these restrict a card with no age range, season "all", and
 *    no holiday.
 */
export function isCardEligible(card: DailyCard, date: Date, ageMonths: number | null): boolean {
  const isAgeScoped = card.ageMinMonths !== null || card.ageMaxMonths !== null;
  if (isAgeScoped) {
    if (ageMonths === null) return false;
    if (card.ageMinMonths !== null && ageMonths < card.ageMinMonths) return false;
    if (card.ageMaxMonths !== null && ageMonths > card.ageMaxMonths) return false;
  }
  if (card.holiday !== null && !isHolidayActive(card.holiday, date)) return false;
  if (card.season !== "all" && card.holiday === null && card.season !== seasonForDate(date)) {
    return false;
  }
  return true;
}

/**
 * Picks today's card deterministically: same card for every user with the
 * same (date, age-eligibility) all day, rotating through the eligible
 * pool by day-of-year so it doesn't repeat until the pool is exhausted —
 * same proven pattern as dailyContent.ts's pickVariant, applied to a
 * richer card object instead of a bare string.
 *
 * Falls back from the full library to the always-eligible subset (no
 * holiday, season "all", not age-gated) if literally nothing else
 * qualifies — this should not normally happen with 365 real cards, but a
 * hard guarantee that some card is always returned matters more than
 * proving it can't.
 */
export function pickDailyCard(
  library: DailyCard[],
  date: Date,
  ageMonths: number | null,
  dayOfYearFn: (d: Date) => number,
): DailyCard {
  const eligible = library.filter((c) => isCardEligible(c, date, ageMonths));
  const pool =
    eligible.length > 0
      ? eligible
      : library.filter(
          (c) =>
            c.season === "all" &&
            c.holiday === null &&
            c.ageMinMonths === null &&
            c.ageMaxMonths === null,
        );
  const safePool = pool.length > 0 ? pool : library;
  const doy = dayOfYearFn(date);
  const index = ((doy % safePool.length) + safePool.length) % safePool.length;
  return safePool[index];
}
