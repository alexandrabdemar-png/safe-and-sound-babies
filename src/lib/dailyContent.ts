// Pure content-selection helpers for the home screen's "Today" card
// (Monday/Tuesday "Quick safety tip" and Friday "Weekend heads-up").
//
// Previously these picked a single fixed string per age bracket, so the
// same weekday showed identical text every week until the child aged
// into the next bracket (reported bug: "reminders repeat every Monday,
// Tuesday and so on"). Each bracket now holds a few variants, rotated by
// ISO week number, so the text actually changes week to week while
// staying age-appropriate.

type AgeBracket = { maxMonths: number; variants: string[] };

// Generic "which variant" chooser — cycleIndex is just an integer that
// increments over time; how coarse that increment is (day vs. week) is up
// to the caller. Modulo naturally cycles through every variant exactly
// once before repeating, so it satisfies "no repeats until exhausted" for
// any monotonically-increasing cycleIndex.
function pickVariant(
  months: number | null,
  brackets: AgeBracket[],
  fallback: string[],
  cycleIndex: number,
  exclude?: (variant: string) => boolean,
): string {
  const rawPool =
    months === null
      ? fallback
      : (brackets.find((b) => months < b.maxMonths) ?? brackets[brackets.length - 1]).variants;
  // Never let a filter empty the pool out from under the rotation — fall
  // back to the unfiltered pool rather than throwing or returning "".
  const pool = exclude ? rawPool.filter((v) => !exclude(v)) : rawPool;
  const effectivePool = pool.length > 0 ? pool : rawPool;
  const index = ((cycleIndex % effectivePool.length) + effectivePool.length) % effectivePool.length;
  return effectivePool[index];
}

/**
 * Day-of-year (1-366), UTC-based so it flips at a consistent instant
 * worldwide rather than each user's local midnight. Used to pick the
 * "Quick safety tip" deterministically — same tip all day for every user,
 * changes once at UTC midnight, cycles through the age bracket's variants
 * without repeats until exhausted.
 */
export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((now - start) / 86400000);
}

const QUICK_TIP_FALLBACK = [
  "AAP guidance considers placing your baby on their back for every sleep the single most important safe sleep practice.",
  "A working smoke alarm on every level of the home, tested regularly, is one of the simplest safety wins available.",
  "It's worth keeping emergency numbers, including poison control, saved somewhere easy to find in a hurry.",
];

const QUICK_TIP_BRACKETS: AgeBracket[] = [
  {
    maxMonths: 4,
    variants: [
      "Safe sleep guidance calls for a firm, flat, empty crib — no pillows, bumpers, or loose blankets — and back to sleep, every time.",
      "Room-sharing without bed-sharing is the AAP's recommendation for at least the first six months — a bassinet or crib in your room, not your bed.",
      "Swaddles are for sleep only until baby shows signs of rolling — once they can roll either way, it's time to stop swaddling the arms.",
    ],
  },
  {
    maxMonths: 8,
    variants: [
      "It may be worth lowering the crib mattress to the next setting before your baby can push up on all fours.",
      "Once solids start, keep an eye out for choking hazards — whole grapes, nuts, and popcorn are best avoided or modified for now.",
      "Some families find it helps to bring everything within reach before bath time, so there's no need to step away from the tub even for a few seconds.",
    ],
  },
  {
    maxMonths: 13,
    variants: [
      "It may be worth installing hardware-mounted gates at the top of staircases before they start crawling.",
      "Outlet covers and cabinet locks are worth a room-by-room sweep right around when crawling really takes off.",
      "Setting the water heater to 120°F or below helps prevent scalds during bath time.",
    ],
  },
  {
    maxMonths: 24,
    variants: [
      "Worth a look: anchoring bookshelves, dressers, and TV stands to the wall — toddlers pull on everything.",
      "Button batteries and magnets are worth a special sweep of the house — small, easy to miss, and can cause serious harm if swallowed.",
      "This is a good age to double-check window guards or stops in rooms where your toddler plays.",
    ],
  },
  {
    maxMonths: 36,
    variants: [
      "It's worth keeping cleaning products and laundry pods in a locked cabinet or on the highest shelf.",
      "Toddlers can open child-resistant caps more easily than you'd expect — medications are worth keeping well out of reach, not just out of sight.",
      "This is a good stage to start talking through simple safety rules together, like staying close in parking lots and holding hands near streets.",
    ],
  },
  {
    maxMonths: Infinity,
    variants: [
      "Helmet safety guidance recommends a properly fitted helmet for every bike, scooter, or balance bike ride.",
      "Most kids need a booster seat until they're tall enough for the seatbelt to fit properly across the shoulder, not the neck.",
      "Even strong swimmers benefit from an adult within arm's reach around pools, lakes, and the ocean.",
    ],
  },
];

const WEEKEND_FALLBACK = [
  "Weekends are a great time for a quick home safety walk-through — five minutes, room by room.",
  "A quiet weekend moment is a good time to review your emergency contacts and make sure they're up to date.",
  "Weekends are a good time to check that any recently added products haven't shown up on a recall list.",
];

const WEEKEND_BRACKETS: AgeBracket[] = [
  {
    maxMonths: 6,
    variants: [
      "If you're heading out this weekend, double-check that the car seat is rear-facing and installed at the correct angle.",
      "Weekend outing? A rolled towel on either side of a young baby in the car seat can help with head support on longer drives.",
      "If you're visiting somewhere new this weekend, a quick check for a firm, flat sleep surface is worth it before naptime.",
    ],
  },
  {
    maxMonths: 12,
    variants: [
      "Planning an outing? Babies over 6 months need SPF 30+ sunscreen on exposed skin — and it's usually worth packing more wipes than you think you'll need.",
      "Weekend errands with a baby who's started solids? Bringing a few safe snacks and avoiding choking hazards on the go is worth planning for.",
      "If the weekend involves new faces, a gentle reminder to family and friends about handwashing before holding baby can go a long way.",
    ],
  },
  {
    maxMonths: 18,
    variants: [
      "Visiting family or friends this weekend? A quick baby-proofing scan of the space — stairs, cabinets, small objects at floor level — takes about two minutes.",
      "New walker on the move this weekend? Shoes with good grip and a scan for uneven ground can help prevent tumbles outdoors.",
      "If the weekend plan includes a pool or lake, close, constant supervision — no phones, no distractions — is worth building into the schedule.",
    ],
  },
  {
    maxMonths: 30,
    variants: [
      "Any outdoor time this weekend means helmet time for balance bikes or ride-ons — the habit is much easier to build before they're old enough to argue about it.",
      "Weekend playground trips are a good moment to check equipment for hot surfaces or loose hardware before letting them climb on.",
      "If you're near water this weekend, life jackets beat floaties for anything more than shallow wading.",
    ],
  },
  {
    maxMonths: Infinity,
    variants: [
      "If you're planning outdoor play this weekend, sunscreen, water, and shade are the essentials — toddlers dehydrate faster than adults.",
      "Weekend bike rides or scooter time are a good chance to reinforce the helmet-every-time habit.",
      "If the weekend includes a road trip, a quick check that the car seat or booster is still installed correctly is worth the five minutes.",
    ],
  },
];

/** Age in whole months from a "YYYY-MM-DD" DOB string, or null if none given. */
export function monthsFromDob(dobStr: string | null): number | null {
  if (!dobStr) return null;
  const birth = new Date(dobStr + "T00:00:00");
  return Math.max(
    0,
    (new Date().getFullYear() - birth.getFullYear()) * 12 +
      (new Date().getMonth() - birth.getMonth()),
  );
}

// Rotates daily (by day-of-year), not weekly — reported bug: the "Quick
// safety tip" showed the same text all week since it shared the same
// week-based rotation as the weekend/growth-check tips. Deliberately
// day-of-year rather than random: it's the same tip all day for every
// user (no flicker on re-render/reload), and it cycles through every
// variant in the bracket before any repeat.
// hasStairs === false excludes stair/gate-specific variants from the
// rotation (a home_profile answer of "no stairs" — see home.tsx's
// AgeJumpCard, which already does the equivalent filtering for its
// milestone actions). Unset/unknown (undefined or true) leaves every
// variant in play, same as before this parameter existed.
export function ageSafetyTip(
  months: number | null,
  dayNumber: number,
  hasStairs?: boolean | null,
): string {
  const exclude = hasStairs === false ? (v: string) => /stair/i.test(v) : undefined;
  return pickVariant(months, QUICK_TIP_BRACKETS, QUICK_TIP_FALLBACK, dayNumber, exclude);
}

export function weekendReminder(months: number | null, weekNumber: number): string {
  return pickVariant(months, WEEKEND_BRACKETS, WEEKEND_FALLBACK, weekNumber);
}

const GROWTH_CHECK_FALLBACK = [
  "It's worth a quick check that every product with a weight or height limit still fits comfortably.",
  "Growth spurts can be quick — a fit check on gear with straps or harnesses is worth doing regularly.",
  "A fresh measurement makes size-up and replacement predictions more accurate across the whole app.",
];

// Themed around growth/fit checks specifically, so Saturday's rotating tip
// reads distinctly from Monday/Tuesday's general safety tip and Friday's
// outing-focused reminder rather than repeating the same ground.
const GROWTH_CHECK_BRACKETS: AgeBracket[] = [
  {
    maxMonths: 4,
    variants: [
      "Newborns grow fast — recheck the car seat harness fit every few weeks; straps should sit at or just below the shoulders.",
      "A swaddle that's gotten snug around the hips is a sign it's time to size up or switch to a hip-healthy style.",
      "Bassinet or crib mattress fit is worth a glance now — no more than two fingers of gap along the sides.",
    ],
  },
  {
    maxMonths: 8,
    variants: [
      "Bouncer and swing weight limits are easy to lose track of — a quick label check confirms there's still room to grow.",
      "As they fill out, double-check that high chair or floor seat straps still snug up properly with no slack.",
      "Clothing that's snug at the snaps is often the first sign a size-up is coming before gear limits catch up.",
    ],
  },
  {
    maxMonths: 15,
    variants: [
      "Once crawling turns to cruising, stroller and carrier weight limits are worth a fresh look.",
      "Shoes for new walkers should have a thumb's width of room at the toe — worth checking every few weeks at this age.",
      "Car seat straps need rechecking often around this age — growth here tends to be quick and uneven.",
    ],
  },
  {
    maxMonths: 24,
    variants: [
      "Convertible car seats often need a height or weight adjustment around now — the label shows current limits.",
      "A stroller or carrier that felt roomy a few months ago is worth a fit check as toddlers grow in spurts.",
      "Helmets (bike, scooter) should be rechecked for fit every few months — a snug fit matters more than looking loose and 'roomy'.",
    ],
  },
  {
    maxMonths: Infinity,
    variants: [
      "Booster seat fit is worth rechecking periodically — the belt should sit across the shoulder, not the neck.",
      "Shoes and helmets are easy to outgrow unnoticed — a quick check every couple of months catches it early.",
      "If growth has been quick lately, it's a good time to update height and weight so predictions stay accurate.",
    ],
  },
];

export function growthCheckTip(months: number | null, weekNumber: number): string {
  return pickVariant(months, GROWTH_CHECK_BRACKETS, GROWTH_CHECK_FALLBACK, weekNumber);
}
