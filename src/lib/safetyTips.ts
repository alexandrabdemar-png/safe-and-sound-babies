export type SafetyTip = {
  id: string;
  text: string;
  minMonths: number;
  maxMonths: number;
};

// 52 weekly safety tips — gentle, non-prescriptive language throughout.
// minMonths/maxMonths define the age range where the tip is most relevant.
export const SAFETY_TIPS: SafetyTip[] = [
  // ── 0–3 months ──
  {
    id: "t001",
    minMonths: 0,
    maxMonths: 3,
    text: "It may be worth checking that your baby monitor cord is positioned well out of reach — cords can pose a risk even when they seem far from the crib.",
  },
  {
    id: "t002",
    minMonths: 0,
    maxMonths: 3,
    text: "Some families find it helpful to press the center of the crib mattress to confirm it springs back quickly — a mattress that holds an indent may be too soft for safe sleep.",
  },
  {
    id: "t003",
    minMonths: 0,
    maxMonths: 4,
    text: "You might want to take a moment to check that your car seat installation hasn't shifted — a gentle rock at the base should show less than an inch of movement.",
  },
  {
    id: "t004",
    minMonths: 0,
    maxMonths: 4,
    text: "It may be a good time to look over any bottle nipples and pacifiers for signs of cracking or tearing, which can create a hazard over time.",
  },
  {
    id: "t005",
    minMonths: 0,
    maxMonths: 3,
    text: "Some families find it reassuring to double-check that the sleep space has no loose items near where their baby rests — blankets, bumpers, and soft objects are worth moving to a separate area.",
  },
  {
    id: "t006",
    minMonths: 0,
    maxMonths: 3,
    text: "You might consider taking a few minutes to register your baby's products with the manufacturer — this can make it easier to be notified if a recall is ever issued.",
  },
  {
    id: "t007",
    minMonths: 0,
    maxMonths: 3,
    text: "It may be a good time to check that you have a working smoke alarm on every level of your home and that the batteries were tested recently.",
  },
  {
    id: "t008",
    minMonths: 0,
    maxMonths: 4,
    text: "Some families find it helpful to look over the collars, zips, and snaps on their baby's clothing for any parts that seem loose or could detach.",
  },
  {
    id: "t009",
    minMonths: 0,
    maxMonths: 3,
    text: "You might want to check the safety strap on your changing table is working and that essentials are within arm's reach before you lay your baby down.",
  },
  {
    id: "t010",
    minMonths: 0,
    maxMonths: 6,
    text: "It may be worth doing a quick search to confirm any houseplants in your home are non-toxic — many common varieties can be harmful if mouthed or swallowed.",
  },

  // ── 3–6 months ──
  {
    id: "t011",
    minMonths: 2,
    maxMonths: 6,
    text: "Some families find it helpful to lower the crib mattress a setting once their baby has started pushing up on their arms — a small adjustment that can prevent a big surprise.",
  },
  {
    id: "t012",
    minMonths: 3,
    maxMonths: 7,
    text: "You might want to confirm that your bouncer, swing, or rocker has a harness and that it's being used every time — even young babies can wriggle more than expected.",
  },
  {
    id: "t013",
    minMonths: 3,
    maxMonths: 8,
    text: "It may be a good time to check that your stroller's harness is still adjusted correctly — a rough guide is a thumb-width of space at the shoulder.",
  },
  {
    id: "t014",
    minMonths: 3,
    maxMonths: 12,
    text: "Some families find it useful to look up the expiry date on their baby carrier or sling — most manufacturers set a lifespan, and sun and wear can affect the material over time.",
  },
  {
    id: "t015",
    minMonths: 2,
    maxMonths: 12,
    text: "You might want to do a quick look over your baby's crib or bassinet for any visible cracks, loose hardware, or screws that may have worked themselves loose.",
  },
  {
    id: "t016",
    minMonths: 3,
    maxMonths: 9,
    text: "It may be a good time to do a floor-level walk-through of your home to spot any cords, cables, or sharp objects from your baby's point of view.",
  },
  {
    id: "t017",
    minMonths: 3,
    maxMonths: 9,
    text: "Some families find it helpful to take a photo of their car seat label and save it somewhere easy to find — having the expiry date and model number on hand can be useful.",
  },
  {
    id: "t018",
    minMonths: 3,
    maxMonths: 8,
    text: "You might consider checking any play mat or activity centre for strings, loops, or fabric pieces that hang within reach of curious hands.",
  },
  {
    id: "t019",
    minMonths: 1,
    maxMonths: 6,
    text: "It may be worth looking at the carbon monoxide detector in your home to confirm it has power and hasn't exceeded its recommended lifespan, which is often five to seven years.",
  },
  {
    id: "t020",
    minMonths: 4,
    maxMonths: 8,
    text: "Some families find it helpful to move any unsecured floor lamps or tall, light furniture away from areas where their baby spends time — they can topple more easily than expected.",
  },

  // ── 6–12 months ──
  {
    id: "t021",
    minMonths: 5,
    maxMonths: 12,
    text: "It may be a good time to give your stair gates a firm push test to confirm they're still securely fastened — hardware-mounted gates at the top of stairs are generally considered more reliable.",
  },
  {
    id: "t022",
    minMonths: 6,
    maxMonths: 12,
    text: "You might want to check that all lower kitchen and bathroom cabinets have working locks — some styles of lock become easier to open as babies grow and discover how they work.",
  },
  {
    id: "t023",
    minMonths: 6,
    maxMonths: 12,
    text: "Some families find it helpful to anchor heavy furniture like bookshelves and dressers to the wall before their baby starts pulling to stand — furniture tip-overs are a leading cause of injury at this stage.",
  },
  {
    id: "t024",
    minMonths: 6,
    maxMonths: 14,
    text: "It may be worth checking that your baby's car seat hasn't reached its weight or height limit — the label on the side of the seat usually shows the current maximums.",
  },
  {
    id: "t025",
    minMonths: 6,
    maxMonths: 18,
    text: "You might want to do a quick floor-level sweep for small objects — coins, button batteries, jewellery clasps, and small toy parts become especially worth checking for once babies start picking things up.",
  },
  {
    id: "t026",
    minMonths: 7,
    maxMonths: 18,
    text: "Some families find it reassuring to confirm that all electrical outlets in rooms where their baby plays are covered with protectors that require two steps to remove.",
  },
  {
    id: "t027",
    minMonths: 6,
    maxMonths: 12,
    text: "It may be a good time to check that hot drinks are never left within reach of a crawling baby — scalds from hot liquids remain one of the most common household injuries for this age group.",
  },
  {
    id: "t028",
    minMonths: 7,
    maxMonths: 14,
    text: "You might consider placing a non-slip mat or gripper pad under any rugs in areas where your baby crawls — rugs on hard floors can shift very quickly.",
  },
  {
    id: "t029",
    minMonths: 6,
    maxMonths: 12,
    text: "Some families find it helpful to check that the kitchen garbage can has a secure lid or is stored inside a locked cabinet — trash can hold sharp edges, packaging, and other hazards that catch a curious baby's eye.",
  },
  {
    id: "t030",
    minMonths: 8,
    maxMonths: 14,
    text: "It may be worth confirming that any baby walker has been removed from your home — they've been linked to a significant number of injuries and are no longer available in some countries.",
  },

  // ── 12–18 months ──
  {
    id: "t031",
    minMonths: 11,
    maxMonths: 18,
    text: "It may be a good time to add door knob covers to doors that lead to unsafe areas — some toddlers can figure out round knobs earlier than expected.",
  },
  {
    id: "t032",
    minMonths: 12,
    maxMonths: 20,
    text: "Some families find it helpful to move cleaning products and laundry pods to a locked cabinet — these are particularly hazardous and should never be left in a lower-level cupboard.",
  },
  {
    id: "t033",
    minMonths: 12,
    maxMonths: 18,
    text: "You might want to check that any toilet in your home has a lid lock — toddlers are often curious about toilets and can get into difficulty very quickly.",
  },
  {
    id: "t034",
    minMonths: 11,
    maxMonths: 24,
    text: "It may be worth securing all cords from blinds and curtains well out of reach — looped or long cords can pose a strangulation risk for young toddlers.",
  },
  {
    id: "t035",
    minMonths: 12,
    maxMonths: 20,
    text: "Some families find it useful to give their stair gates a test to confirm their toddler hasn't worked out how to open or climb the one they're relying on most.",
  },
  {
    id: "t036",
    minMonths: 12,
    maxMonths: 24,
    text: "You might consider checking that any furniture your toddler could use to climb — chairs, stools, toy boxes — is not positioned near windows.",
  },
  {
    id: "t037",
    minMonths: 12,
    maxMonths: 20,
    text: "It may be a good time to confirm that all medications, vitamins, and supplements in your home are in child-resistant packaging and stored well out of reach.",
  },
  {
    id: "t038",
    minMonths: 14,
    maxMonths: 24,
    text: "Some families find it helpful to place a fireguard or hearth guard in front of any fireplace or woodburner — toddlers can move quickly toward warmth and interesting light.",
  },

  // ── 18–24 months ──
  {
    id: "t039",
    minMonths: 16,
    maxMonths: 30,
    text: "It may be a good time to check any outdoor play equipment for rust, loose hardware, or surfaces that could become very hot in the sun — a quick look takes only a few minutes.",
  },
  {
    id: "t040",
    minMonths: 18,
    maxMonths: 30,
    text: "Some families find it helpful to put a secure lock on the gate that leads to the driveway or road — toddlers can move quickly and unpredictably in new directions.",
  },
  {
    id: "t041",
    minMonths: 18,
    maxMonths: 36,
    text: "You might want to confirm that your toddler's bike helmet fits correctly — it should sit level on the head with two fingers of space above the eyebrows and no rocking.",
  },
  {
    id: "t042",
    minMonths: 16,
    maxMonths: 30,
    text: "It may be worth checking that any balloons in your home are kept under close supervision — pieces from burst or deflated balloons can be a significant choking hazard for toddlers.",
  },
  {
    id: "t043",
    minMonths: 18,
    maxMonths: 30,
    text: "Some families find it useful to store scissors and other sharp kitchen tools in a drawer with a lock — toddlers can pull on handles that are at counter-edge height.",
  },
  {
    id: "t044",
    minMonths: 18,
    maxMonths: 30,
    text: "You might consider checking that your child's car seat is still installed correctly — fit should be re-checked periodically and whenever there's a change in the child's clothing layers.",
  },
  {
    id: "t045",
    minMonths: 18,
    maxMonths: 30,
    text: "It may be a good time to talk with any regular caregivers — grandparents, family friends, babysitters — about the safety rules that apply in your home, particularly around water.",
  },
  {
    id: "t046",
    minMonths: 20,
    maxMonths: 30,
    text: "Some families find it helpful to review the weight and height limits on any stroller or carrier still in use — many are outgrown around this age and using one beyond its limit can affect safety.",
  },

  // ── 24+ months ──
  // ── Pool safety ──
  {
    id: "t053",
    minMonths: 0,
    maxMonths: 999,
    text: "It may be worth checking that any home pool or spa has a four-sided fence that meets local code — a barrier that completely surrounds the water and latches at the top is considered the most effective layer of protection.",
  },
  {
    id: "t054",
    minMonths: 0,
    maxMonths: 999,
    text: "Some families find it helpful to confirm that the gate on their pool fence is self-closing and self-latching, with the latch on the pool side — this way it can't accidentally be left open.",
  },
  {
    id: "t055",
    minMonths: 0,
    maxMonths: 48,
    text: "You might want to keep a US Coast Guard–approved life jacket sized for your child near any body of water — floaties and swim rings are fun but are not safety devices.",
  },
  {
    id: "t056",
    minMonths: 0,
    maxMonths: 48,
    text: "It may be a good time to make sure that an adult who knows how to swim is within arm's reach whenever your child is in or near the water — designated water watching, with no phone distractions.",
  },
  {
    id: "t057",
    minMonths: 12,
    maxMonths: 999,
    text: "Some families find it helpful to enroll their child in age-appropriate swim lessons — the AAP notes that lessons can significantly reduce drowning risk for children one year and older.",
  },
  {
    id: "t058",
    minMonths: 0,
    maxMonths: 999,
    text: "You might consider learning CPR — pool-related emergencies happen very quickly, and hands-only CPR before emergency services arrive can make a meaningful difference.",
  },
  {
    id: "t059",
    minMonths: 0,
    maxMonths: 36,
    text: "It may be worth emptying any portable or inflatable pools completely after each use and storing them upside down — even a few inches of water left standing is a drowning risk for young children.",
  },
  {
    id: "t060",
    minMonths: 0,
    maxMonths: 999,
    text: "Some families find it helpful to keep a reaching pole and a ring buoy at the pool's edge during any swim session — having rescue equipment immediately at hand can save critical seconds.",
  },

  {
    id: "t047",
    minMonths: 22,
    maxMonths: 999,
    text: "It may be a good time to confirm that any outdoor water features like paddling pools are emptied and put away when not in use — even shallow water requires close supervision.",
  },
  {
    id: "t048",
    minMonths: 24,
    maxMonths: 999,
    text: "Some families find it helpful to check that window guards are properly fitted in rooms where their child plays — guards withstand more force than window stops and are worth distinguishing.",
  },
  {
    id: "t049",
    minMonths: 22,
    maxMonths: 999,
    text: "You might want to confirm that any ride-on toys, balance bikes, or scooters come with a helmet every single time — habits formed early tend to stick.",
  },
  {
    id: "t050",
    minMonths: 24,
    maxMonths: 999,
    text: "It may be worth doing a general medicine cabinet check — expiry dates on first aid supplies can pass without notice, and some products degrade before they're needed.",
  },
  {
    id: "t051",
    minMonths: 24,
    maxMonths: 999,
    text: "Some families find it helpful to revisit their home's smoke alarm placement and test the alarms — doing it together with their child can help small ones feel calm and prepared if they ever hear the sound.",
  },
  {
    id: "t052",
    minMonths: 22,
    maxMonths: 999,
    text: "You might consider giving the locks and latches on your outdoor gates a check — exposure to weather can cause these to degrade faster than interior hardware.",
  },
  {
    id: "t061",
    minMonths: 0,
    maxMonths: 24,
    text: "If your baby uses a pacifier, it's worth double-checking you're using the size made for their current age — most brands mark stages like 0–6 months and 6–18 months, and a pacifier sized for a younger baby can be a choking or fit hazard as they grow.",
  },
];

// Select the best tip for a given age and ISO week number.
// Prefers age-appropriate tips; falls back to any tip if none match.
//
// hasStairs === false excludes stair-gate tips (a home_profile answer of
// "no stairs" — see home.tsx's AgeJumpCard and dailyContent.ts's
// ageSafetyTip, which do the equivalent filtering elsewhere on Home).
// Unset/unknown (undefined or true) leaves every tip in play, same as
// before this parameter existed. Never lets the filter empty the pool.
export function selectWeeklyTip(
  ageMonths: number,
  weekNumber: number,
  hasStairs?: boolean | null,
): SafetyTip {
  const ageTips = SAFETY_TIPS.filter(
    (t) => ageMonths >= t.minMonths && ageMonths <= t.maxMonths,
  );
  const basePool = ageTips.length > 0 ? ageTips : SAFETY_TIPS;
  if (hasStairs === false) {
    const withoutStairs = basePool.filter((t) => !/stair/i.test(t.text));
    if (withoutStairs.length > 0) return withoutStairs[weekNumber % withoutStairs.length];
  }
  return basePool[weekNumber % basePool.length];
}

// ISO week number (1–53)
export function getIsoWeekNumber(date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Week key for localStorage / Supabase dedup
export function weekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const week = getIsoWeekNumber(date);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
