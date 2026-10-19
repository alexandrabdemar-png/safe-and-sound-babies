export type SafetyTip = {
  id: string;
  text: string;
  minMonths: number;
  maxMonths: number;
  /**
   * Only set when this specific tip traces to a real, citable AAP/CPSC
   * guideline — not a blanket label on the whole list. Most tips are
   * general in-house phrasing and intentionally have no source; verified
   * against the live page's content (via search, since this environment's
   * network egress can't fetch these domains directly) before being added,
   * not guessed from a plausible-looking URL.
   */
  source?: { label: string; url: string };
};

// Safety tips shown one per day (see selectDailyTip below) — direct,
// confident phrasing throughout (a clear "do this," not a hedged "some
// families find it helpful to..."). minMonths/maxMonths define the age
// range where the tip is most relevant.
export const SAFETY_TIPS: SafetyTip[] = [
  // ── 0–3 months ──
  {
    id: "t001",
    minMonths: 0,
    maxMonths: 3,
    text: "Make sure the baby monitor cord is well out of reach of the crib. Cords can be a risk even when they seem far enough away.",
  },
  {
    id: "t002",
    minMonths: 0,
    maxMonths: 3,
    text: "Press down on the middle of the crib mattress. It should spring right back. If it holds a dent, it's probably too soft for safe sleep.",
    source: {
      label: "AAP — A Parent's Guide to Safe Sleep",
      url: "https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/a-parents-guide-to-safe-sleep.aspx",
    },
  },
  {
    id: "t003",
    minMonths: 0,
    maxMonths: 4,
    text: "Give the car seat a firm wiggle at the base. If it moves more than an inch side to side, it's time to tighten it up.",
  },
  {
    id: "t004",
    minMonths: 0,
    maxMonths: 4,
    text: "Take a quick look at bottle nipples and pacifiers. If you spot cracks or tears, toss them and grab a new one.",
  },
  {
    id: "t005",
    minMonths: 0,
    maxMonths: 3,
    text: "Keep the crib bare: no blankets, bumpers, pillows or stuffed animals. A firm mattress and a fitted sheet is all your baby needs.",
    source: {
      label: "AAP — A Parent's Guide to Safe Sleep",
      url: "https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/a-parents-guide-to-safe-sleep.aspx",
    },
  },
  {
    id: "t006",
    minMonths: 0,
    maxMonths: 3,
    text: "Register your baby gear with the manufacturer (it only takes a minute). That way they can reach you if there's ever a recall.",
  },
  {
    id: "t007",
    minMonths: 0,
    maxMonths: 3,
    text: "Make sure there's a working smoke alarm on every floor of your home, and press the test button to check the batteries.",
  },
  {
    id: "t008",
    minMonths: 0,
    maxMonths: 4,
    text: "Give your baby's clothes a once-over. Look for loose buttons, snaps or zipper pulls that could come off.",
  },
  {
    id: "t009",
    minMonths: 0,
    maxMonths: 3,
    text: "Before you lay your baby on the changing table, have everything you need within arm's reach so you never have to step away. Use the strap too.",
  },
  {
    id: "t010",
    minMonths: 0,
    maxMonths: 6,
    text: "Look up your houseplants to make sure they're safe for babies. Lots of popular ones can make little ones sick if they chew on a leaf.",
  },

  // ── 3–6 months ──
  {
    id: "t011",
    minMonths: 2,
    maxMonths: 6,
    text: "Once your baby starts pushing up on their arms, lower the crib mattress a notch. It's a quick change that keeps them from tumbling out later.",
  },
  {
    id: "t012",
    minMonths: 3,
    maxMonths: 7,
    text: "Buckle the harness on the bouncer, swing or rocker every time, even for a few minutes. Babies can wriggle more than you'd think.",
  },
  {
    id: "t013",
    minMonths: 3,
    maxMonths: 8,
    text: "Check the stroller straps still fit. You should be able to slide about one finger under the shoulder strap, and no more.",
  },
  {
    id: "t014",
    minMonths: 3,
    maxMonths: 12,
    text: "Check whether your baby carrier or sling has an expiration date. Sun and everyday wear break down the fabric over time.",
  },
  {
    id: "t015",
    minMonths: 2,
    maxMonths: 12,
    text: "Give the crib or bassinet a quick look for cracks, loose screws or wobbly parts, and tighten anything that's worked loose.",
  },
  {
    id: "t016",
    minMonths: 3,
    maxMonths: 9,
    text: "Get down on the floor and look around from your baby's point of view. You'll spot cords, cables and sharp corners you'd never notice standing up.",
  },
  {
    id: "t017",
    minMonths: 3,
    maxMonths: 9,
    text: "Snap a photo of the label on your car seat. You'll have the model number and expiration date handy whenever you need them.",
  },
  {
    id: "t018",
    minMonths: 3,
    maxMonths: 8,
    text: "Check play mats and activity centers for strings, loops or loose fabric that little hands could grab.",
  },
  {
    id: "t019",
    minMonths: 1,
    maxMonths: 6,
    text: "Test your carbon monoxide detector and check its date. Most need replacing every 5 to 7 years.",
  },
  {
    id: "t020",
    minMonths: 4,
    maxMonths: 8,
    text: "Move floor lamps and tall, light furniture away from where your baby plays. They tip over more easily than you'd expect.",
  },

  // ── 6–12 months ──
  {
    id: "t021",
    minMonths: 5,
    maxMonths: 12,
    text: "Give your stair gates a good push to make sure they're still secure. At the top of the stairs, use a gate that screws into the wall.",
  },
  {
    id: "t022",
    minMonths: 6,
    maxMonths: 12,
    text: "Check that the locks on low kitchen and bathroom cabinets still work. Babies figure out some latches faster than you'd think.",
  },
  {
    id: "t023",
    minMonths: 6,
    maxMonths: 12,
    text: "Anchor bookshelves and dressers to the wall before your baby starts pulling up to stand. Furniture tip-overs are a big cause of injuries at this age.",
  },
  {
    id: "t024",
    minMonths: 6,
    maxMonths: 14,
    text: "Check the sticker on the side of your baby's car seat for its height and weight limits, and make sure your baby is still under them.",
  },
  {
    id: "t025",
    minMonths: 6,
    maxMonths: 18,
    text: "Do a quick sweep of the floor for small things like coins, button batteries, earrings and tiny toy pieces. Everything goes in their mouth at this age.",
  },
  {
    id: "t026",
    minMonths: 7,
    maxMonths: 18,
    text: "Cover the outlets in any room your baby plays in. Choose covers that take two steps to remove so little fingers can't pop them out.",
  },
  {
    id: "t027",
    minMonths: 6,
    maxMonths: 12,
    text: "Keep hot coffee and tea out of reach once your baby is crawling. Spills from hot drinks are one of the most common burns at this age.",
  },
  {
    id: "t028",
    minMonths: 7,
    maxMonths: 14,
    text: "Put a non-slip pad under rugs where your baby crawls. Rugs on hard floors can slide out from under them fast.",
  },
  {
    id: "t029",
    minMonths: 6,
    maxMonths: 12,
    text: "Put a lid on the kitchen trash or keep it behind a locked cabinet. It's full of sharp bits and packaging that curious babies love.",
  },
  {
    id: "t030",
    minMonths: 8,
    maxMonths: 14,
    text: "Skip the baby walker. They cause a lot of injuries, and some countries have banned them.",
  },

  // ── 12–18 months ──
  {
    id: "t031",
    minMonths: 11,
    maxMonths: 18,
    text: "Put knob covers on doors to rooms you don't want your toddler in. Some kids figure out round doorknobs sooner than you'd think.",
  },
  {
    id: "t032",
    minMonths: 12,
    maxMonths: 20,
    text: "Move cleaning products and laundry pods to a high or locked cabinet, never under the sink where little hands can reach them.",
  },
  {
    id: "t033",
    minMonths: 12,
    maxMonths: 18,
    text: "Put a lock on the toilet lid. Toddlers love to explore toilets, and they can get into trouble in seconds.",
  },
  {
    id: "t034",
    minMonths: 11,
    maxMonths: 24,
    text: "Tie up or cut short any blind and curtain cords. Long or looped cords are a strangling risk for toddlers.",
  },
  {
    id: "t035",
    minMonths: 12,
    maxMonths: 20,
    text: "Test your stair gates again. Make sure your toddler hasn't figured out how to open or climb the one you count on most.",
  },
  {
    id: "t036",
    minMonths: 12,
    maxMonths: 24,
    text: "Keep chairs, stools and toy boxes away from windows. Toddlers will climb anything they can.",
  },
  {
    id: "t037",
    minMonths: 12,
    maxMonths: 20,
    text: "Keep all medicines, vitamins and supplements in child-resistant bottles, up high and out of sight.",
  },
  {
    id: "t038",
    minMonths: 14,
    maxMonths: 24,
    text: "Put a guard around any fireplace or woodburner. Toddlers are drawn to the warmth and the glow.",
  },

  // ── 18–24 months ──
  {
    id: "t039",
    minMonths: 16,
    maxMonths: 30,
    text: "Check outdoor play equipment for rust, loose bolts and surfaces that get hot in the sun. It only takes a few minutes.",
  },
  {
    id: "t040",
    minMonths: 18,
    maxMonths: 30,
    text: "Make sure the gate to the driveway or street latches securely. Toddlers can be out the door before you know it.",
  },
  {
    id: "t041",
    minMonths: 18,
    maxMonths: 36,
    text: "Check your toddler's bike helmet fit. It should sit level, about two fingers above the eyebrows, and not rock around.",
  },
  {
    id: "t042",
    minMonths: 16,
    maxMonths: 30,
    text: "Keep an eye on balloons. Popped or deflated balloon pieces are a serious choking hazard for toddlers.",
  },
  {
    id: "t043",
    minMonths: 18,
    maxMonths: 30,
    text: "Keep scissors and sharp kitchen tools in a locked drawer. Toddlers can reach and pull on drawer handles more easily than you'd think.",
  },
  {
    id: "t044",
    minMonths: 18,
    maxMonths: 30,
    text: "Re-check your child's car seat fit every so often, and skip bulky coats in the car. Puffy layers make the straps too loose.",
  },
  {
    id: "t045",
    minMonths: 18,
    maxMonths: 30,
    text: "Go over your home's safety rules with grandparents, sitters and anyone else who helps out, especially around water.",
  },
  {
    id: "t046",
    minMonths: 20,
    maxMonths: 30,
    text: "Check the height and weight limits on your stroller and carrier. Lots of kids outgrow them around this age.",
  },

  // ── 24+ months ──
  // ── Pool safety ──
  {
    id: "t053",
    minMonths: 0,
    maxMonths: 999,
    text: "If you have a home pool or spa, make sure it has a fence on all four sides that completely separates it from the house and yard. It's the best protection there is.",
    source: { label: "CPSC — Pool Safely", url: "https://www.poolsafely.gov/" },
  },
  {
    id: "t054",
    minMonths: 0,
    maxMonths: 999,
    text: "Make sure the gate on your pool fence closes and latches by itself, with the latch up high and out of a child's reach, so it can never be left open by accident.",
    source: { label: "CPSC — Pool Safely", url: "https://www.poolsafely.gov/" },
  },
  {
    id: "t055",
    minMonths: 0,
    maxMonths: 48,
    text: "Keep a properly fitted life jacket around for any time you're near water. Floaties and swim rings are fun, but they won't keep your child safe.",
    source: { label: "CPSC — Pool Safely", url: "https://www.poolsafely.gov/" },
  },
  {
    id: "t056",
    minMonths: 0,
    maxMonths: 48,
    text: "Whenever your child is in or near water, have an adult who can swim within arm's reach. Phone down, eyes on the water.",
    source: {
      label: "AAP — Drowning Prevention and Water Safety",
      url: "https://www.aap.org/en/patient-care/drowning-prevention-and-water-safety/",
    },
  },
  {
    id: "t057",
    minMonths: 12,
    maxMonths: 999,
    text: "Sign your child up for swim lessons. The AAP says lessons can lower drowning risk for kids 1 and older.",
    source: {
      label: "AAP — Swim Lessons for Children",
      url: "https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Swim-Lessons.aspx",
    },
  },
  {
    id: "t058",
    minMonths: 0,
    maxMonths: 999,
    text: "Learn CPR. Water emergencies happen fast, and starting CPR before help arrives can make a real difference.",
    source: { label: "CPSC — Pool Safely", url: "https://www.poolsafely.gov/" },
  },
  {
    id: "t059",
    minMonths: 0,
    maxMonths: 36,
    text: "Empty kiddie and inflatable pools right after using them and flip them upside down. Even a few inches of water is a drowning risk.",
    source: { label: "CPSC — Pool Safely FAQ", url: "https://www.poolsafely.gov/faq/" },
  },
  {
    id: "t060",
    minMonths: 0,
    maxMonths: 999,
    text: "Keep a reaching pole and a life ring by the pool whenever anyone's swimming. Having them right there can save precious seconds.",
  },

  {
    id: "t047",
    minMonths: 22,
    maxMonths: 999,
    text: "Empty and put away paddling pools when you're done. Even shallow water needs an adult right there.",
  },
  {
    id: "t048",
    minMonths: 24,
    maxMonths: 999,
    text: "Use window guards in rooms where your child plays. Window stops just keep a window from opening wide; guards are made to hold up if a child pushes on them.",
  },
  {
    id: "t049",
    minMonths: 22,
    maxMonths: 999,
    text: "Make helmets a must for scooters, balance bikes and ride-on toys. If you start the habit early, it sticks.",
  },
  {
    id: "t050",
    minMonths: 24,
    maxMonths: 999,
    text: "Go through your medicine cabinet and first aid kit. Toss anything that's expired so it works when you need it.",
  },
  {
    id: "t051",
    minMonths: 24,
    maxMonths: 999,
    text: "Test your smoke alarms, and do it with your child. Hearing the sound ahead of time helps them stay calm if it ever goes off.",
  },
  {
    id: "t052",
    minMonths: 22,
    maxMonths: 999,
    text: "Check the locks and latches on your outdoor gates. Weather wears them out faster than the ones inside.",
  },
  {
    id: "t061",
    minMonths: 0,
    maxMonths: 24,
    text: "If your baby uses a pacifier, make sure it's the right size for their age. Most brands label stages like 0–6 or 6–18 months, and one that's too small can become a choking risk as they grow.",
  },
];

// Tips that assume a feature of a single-family house — a private outdoor
// gate/driveway, or a fireplace/woodburner — rather than something every
// home has. Reported bug: an apartment-dwelling parent got "check the
// locks and latches on your outdoor gates" right after answering "Apartment"
// to the home_profile "What type of home do you live in?" question.
// Deliberately narrow (not just any mention of "gate") so it doesn't also
// catch the stair-gate tips (handled separately by hasStairs below) or the
// pool-fence-gate tips (handled separately by hasPool below).
const HOUSE_ONLY_PATTERN = /outdoor gate|driveway|fireplace|woodburner|hearth/i;

// Tips that specifically assume owning a home pool/spa — as opposed to the
// more general water-safety tips (life jackets, supervision, swim lessons,
// CPR) that still apply to a family who visits a lake, beach, or someone
// else's pool regardless of what they have at home. Same has_pool answer
// that gates the "Pool alarm recommended" nudge (shouldShowPoolAlarmNudge).
const HOME_POOL_ONLY_PATTERN = /home pool|pool fence/i;

// Never lets an exclusion filter empty the pool out from under the
// rotation — falls back to the pre-exclusion pool rather than throwing or
// silently returning an irrelevant tip because the pool went empty.
function excluding(pool: SafetyTip[], matches: (t: SafetyTip) => boolean): SafetyTip[] {
  const filtered = pool.filter((t) => !matches(t));
  return filtered.length > 0 ? filtered : pool;
}

// Select the best tip for a given age and day index (see dayIndexFromDate).
// Prefers age-appropriate tips; falls back to any tip if none match.
//
// hasStairs === false excludes stair-gate tips, homeType === "apartment"
// excludes house-only tips (HOUSE_ONLY_PATTERN), and hasPool === false
// excludes home-pool-only tips (HOME_POOL_ONLY_PATTERN) — all three are
// home_profile answers (see home.tsx's AgeJumpCard and dailyContent.ts's
// ageSafetyTip, which do the equivalent hasStairs filtering elsewhere on
// Home). Unset/unknown values leave every tip in play, same as before
// these parameters existed. Filters compose (e.g. an apartment-dwelling,
// no-pool, no-stairs household excludes all three categories at once),
// and never let the pool go empty.
//
// Note on cadence: the smallest age-filtered pool across the whole 0–240mo
// range is 11 tips (see safetyTips.test.ts), so a daily cadence completes a
// full lap of an age's pool in as little as ~11 days before repeating —
// noticeably faster than the old weekly cadence's ~11-week lap. Acceptable
// here since every tip is evergreen advisory content, not something that
// goes stale, but worth knowing if the pool ever needs to grow.
export function selectDailyTip(
  ageMonths: number | null,
  dayIndex: number,
  hasStairs?: boolean | null,
  homeType?: string | null,
  hasPool?: boolean | null,
): SafetyTip {
  // ageMonths is null when the child's age isn't known (the app no longer
  // collects date of birth) — skip age filtering entirely rather than
  // guessing, same graceful-degradation path already used when age
  // filtering happens to produce zero matches.
  const ageTips =
    ageMonths === null
      ? []
      : SAFETY_TIPS.filter((t) => ageMonths >= t.minMonths && ageMonths <= t.maxMonths);
  let pool = ageTips.length > 0 ? ageTips : SAFETY_TIPS;
  if (hasStairs === false) pool = excluding(pool, (t) => /stair/i.test(t.text));
  if (homeType === "apartment") pool = excluding(pool, (t) => HOUSE_ONLY_PATTERN.test(t.text));
  if (hasPool === false) pool = excluding(pool, (t) => HOME_POOL_ONLY_PATTERN.test(t.text));
  return pool[dayIndex % pool.length];
}

// A day index that increments by exactly 1 every calendar day, forever —
// no year-boundary or leap-year edge cases to handle (unlike an ISO week
// number), since it's just a whole-day count from the Unix epoch in UTC.
export function dayIndexFromDate(date = new Date()): number {
  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(utcMidnight / 86400000);
}

// Day key (UTC, YYYY-MM-DD) for localStorage / Supabase dedup — one
// completed-tip row per user per calendar day.
export function dayKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  return d.toISOString().slice(0, 10);
}
