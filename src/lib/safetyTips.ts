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
    text: "Check that your baby monitor cord is positioned well out of reach — cords can pose a risk even when they seem far from the crib.",
  },
  {
    id: "t002",
    minMonths: 0,
    maxMonths: 3,
    text: "Press the center of the crib mattress to confirm it springs back quickly — a mattress that holds an indent may be too soft for safe sleep.",
    source: {
      label: "AAP — A Parent's Guide to Safe Sleep",
      url: "https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/a-parents-guide-to-safe-sleep.aspx",
    },
  },
  {
    id: "t003",
    minMonths: 0,
    maxMonths: 4,
    text: "Check that your car seat installation hasn't shifted — a firm rock at the base should show less than an inch of movement.",
  },
  {
    id: "t004",
    minMonths: 0,
    maxMonths: 4,
    text: "Look over any bottle nipples and pacifiers for signs of cracking or tearing, which can create a hazard over time.",
  },
  {
    id: "t005",
    minMonths: 0,
    maxMonths: 3,
    text: "Double-check that the sleep space has no loose items near where your baby rests — move blankets, bumpers, and soft objects to a separate area.",
    source: {
      label: "AAP — A Parent's Guide to Safe Sleep",
      url: "https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/a-parents-guide-to-safe-sleep.aspx",
    },
  },
  {
    id: "t006",
    minMonths: 0,
    maxMonths: 3,
    text: "Take a few minutes to register your baby's products with the manufacturer — it makes it easier to be notified if a recall is ever issued.",
  },
  {
    id: "t007",
    minMonths: 0,
    maxMonths: 3,
    text: "Check that you have a working smoke alarm on every level of your home and that the batteries were tested recently.",
  },
  {
    id: "t008",
    minMonths: 0,
    maxMonths: 4,
    text: "Look over the collars, zips, and snaps on your baby's clothing for any parts that seem loose or could detach.",
  },
  {
    id: "t009",
    minMonths: 0,
    maxMonths: 3,
    text: "Check that the safety strap on your changing table works and that essentials are within arm's reach before you lay your baby down.",
  },
  {
    id: "t010",
    minMonths: 0,
    maxMonths: 6,
    text: "Do a quick search to confirm any houseplants in your home are non-toxic — many common varieties can be harmful if mouthed or swallowed.",
  },

  // ── 3–6 months ──
  {
    id: "t011",
    minMonths: 2,
    maxMonths: 6,
    text: "Lower the crib mattress a setting once your baby starts pushing up on their arms — a small adjustment that prevents a big surprise.",
  },
  {
    id: "t012",
    minMonths: 3,
    maxMonths: 7,
    text: "Confirm that your bouncer, swing, or rocker has a harness and use it every time — even young babies can wriggle more than expected.",
  },
  {
    id: "t013",
    minMonths: 3,
    maxMonths: 8,
    text: "Check that your stroller's harness is still adjusted correctly — a rough guide is a thumb-width of space at the shoulder.",
  },
  {
    id: "t014",
    minMonths: 3,
    maxMonths: 12,
    text: "Look up the expiration date on your baby carrier or sling — most manufacturers set a lifespan, and sun and wear affect the material over time.",
  },
  {
    id: "t015",
    minMonths: 2,
    maxMonths: 12,
    text: "Do a quick look over your baby's crib or bassinet for any visible cracks, loose hardware, or screws that have worked themselves loose.",
  },
  {
    id: "t016",
    minMonths: 3,
    maxMonths: 9,
    text: "Do a floor-level walk-through of your home to spot any cords, cables, or sharp objects from your baby's point of view.",
  },
  {
    id: "t017",
    minMonths: 3,
    maxMonths: 9,
    text: "Take a photo of your car seat label and save it somewhere easy to find — having the expiration date and model number on hand comes in handy.",
  },
  {
    id: "t018",
    minMonths: 3,
    maxMonths: 8,
    text: "Check any play mat or activity centre for strings, loops, or fabric pieces that hang within reach of curious hands.",
  },
  {
    id: "t019",
    minMonths: 1,
    maxMonths: 6,
    text: "Check the carbon monoxide detector in your home to confirm it has power and hasn't exceeded its recommended lifespan, which is often five to seven years.",
  },
  {
    id: "t020",
    minMonths: 4,
    maxMonths: 8,
    text: "Move any unsecured floor lamps or tall, light furniture away from areas where your baby spends time — they can topple more easily than expected.",
  },

  // ── 6–12 months ──
  {
    id: "t021",
    minMonths: 5,
    maxMonths: 12,
    text: "Give your stair gates a firm push test to confirm they're still securely fastened — hardware-mounted gates at the top of stairs are generally more reliable.",
  },
  {
    id: "t022",
    minMonths: 6,
    maxMonths: 12,
    text: "Check that all lower kitchen and bathroom cabinets have working locks — some styles of lock become easier to open as babies grow and discover how they work.",
  },
  {
    id: "t023",
    minMonths: 6,
    maxMonths: 12,
    text: "Anchor heavy furniture like bookshelves and dressers to the wall before your baby starts pulling to stand — furniture tip-overs are a leading cause of injury at this stage.",
  },
  {
    id: "t024",
    minMonths: 6,
    maxMonths: 14,
    text: "Check that your baby's car seat hasn't reached its weight or height limit — the label on the side of the seat shows the current maximums.",
  },
  {
    id: "t025",
    minMonths: 6,
    maxMonths: 18,
    text: "Do a quick floor-level sweep for small objects — coins, button batteries, jewellery clasps, and small toy parts are worth checking for once babies start picking things up.",
  },
  {
    id: "t026",
    minMonths: 7,
    maxMonths: 18,
    text: "Confirm that all electrical outlets in rooms where your baby plays are covered with protectors that require two steps to remove.",
  },
  {
    id: "t027",
    minMonths: 6,
    maxMonths: 12,
    text: "Keep hot drinks out of reach of a crawling baby — scalds from hot liquids remain one of the most common household injuries for this age group.",
  },
  {
    id: "t028",
    minMonths: 7,
    maxMonths: 14,
    text: "Place a non-slip mat or gripper pad under any rugs in areas where your baby crawls — rugs on hard floors can shift very quickly.",
  },
  {
    id: "t029",
    minMonths: 6,
    maxMonths: 12,
    text: "Check that the kitchen garbage can has a secure lid or is stored inside a locked cabinet — trash can hold sharp edges, packaging, and other hazards that catch a curious baby's eye.",
  },
  {
    id: "t030",
    minMonths: 8,
    maxMonths: 14,
    text: "Confirm that any baby walker has been removed from your home — they've been linked to a significant number of injuries and are no longer sold in some countries.",
  },

  // ── 12–18 months ──
  {
    id: "t031",
    minMonths: 11,
    maxMonths: 18,
    text: "Add door knob covers to doors that lead to unsafe areas — some toddlers figure out round knobs earlier than expected.",
  },
  {
    id: "t032",
    minMonths: 12,
    maxMonths: 20,
    text: "Move cleaning products and laundry pods to a locked cabinet — these are particularly hazardous and should never be left in a lower-level cupboard.",
  },
  {
    id: "t033",
    minMonths: 12,
    maxMonths: 18,
    text: "Check that any toilet in your home has a lid lock — toddlers are often curious about toilets and can get into difficulty very quickly.",
  },
  {
    id: "t034",
    minMonths: 11,
    maxMonths: 24,
    text: "Secure all cords from blinds and curtains well out of reach — looped or long cords can pose a strangulation risk for young toddlers.",
  },
  {
    id: "t035",
    minMonths: 12,
    maxMonths: 20,
    text: "Give your stair gates a test to confirm your toddler hasn't worked out how to open or climb the one you're relying on most.",
  },
  {
    id: "t036",
    minMonths: 12,
    maxMonths: 24,
    text: "Check that any furniture your toddler could use to climb — chairs, stools, toy boxes — isn't positioned near windows.",
  },
  {
    id: "t037",
    minMonths: 12,
    maxMonths: 20,
    text: "Confirm that all medications, vitamins, and supplements in your home are in child-resistant packaging and stored well out of reach.",
  },
  {
    id: "t038",
    minMonths: 14,
    maxMonths: 24,
    text: "Place a fireguard or hearth guard in front of any fireplace or woodburner — toddlers can move quickly toward warmth and interesting light.",
  },

  // ── 18–24 months ──
  {
    id: "t039",
    minMonths: 16,
    maxMonths: 30,
    text: "Check any outdoor play equipment for rust, loose hardware, or surfaces that could become very hot in the sun — a quick look takes only a few minutes.",
  },
  {
    id: "t040",
    minMonths: 18,
    maxMonths: 30,
    text: "Put a secure lock on the gate that leads to the driveway or road — toddlers can move quickly and unpredictably in new directions.",
  },
  {
    id: "t041",
    minMonths: 18,
    maxMonths: 36,
    text: "Confirm that your toddler's bike helmet fits correctly — it should sit level on the head with two fingers of space above the eyebrows and no rocking.",
  },
  {
    id: "t042",
    minMonths: 16,
    maxMonths: 30,
    text: "Keep balloons under close supervision — pieces from burst or deflated balloons are a significant choking hazard for toddlers.",
  },
  {
    id: "t043",
    minMonths: 18,
    maxMonths: 30,
    text: "Store scissors and other sharp kitchen tools in a drawer with a lock — toddlers can pull on handles that are at counter-edge height.",
  },
  {
    id: "t044",
    minMonths: 18,
    maxMonths: 30,
    text: "Check that your child's car seat is still installed correctly — fit should be re-checked periodically and whenever there's a change in clothing layers.",
  },
  {
    id: "t045",
    minMonths: 18,
    maxMonths: 30,
    text: "Talk with any regular caregivers — grandparents, family friends, babysitters — about the safety rules that apply in your home, particularly around water.",
  },
  {
    id: "t046",
    minMonths: 20,
    maxMonths: 30,
    text: "Review the weight and height limits on any stroller or carrier still in use — many are outgrown around this age, and using one beyond its limit can affect safety.",
  },

  // ── 24+ months ──
  // ── Pool safety ──
  {
    id: "t053",
    minMonths: 0,
    maxMonths: 999,
    text: "Check that any home pool or spa has a four-sided fence that meets local code — a barrier that completely surrounds the water and latches at the top is the most effective layer of protection.",
    source: { label: "CPSC — Pool Safely", url: "https://www.poolsafely.gov/" },
  },
  {
    id: "t054",
    minMonths: 0,
    maxMonths: 999,
    text: "Confirm that the gate on your pool fence is self-closing and self-latching, with the latch on the pool side — this way it can't accidentally be left open.",
    source: { label: "CPSC — Pool Safely", url: "https://www.poolsafely.gov/" },
  },
  {
    id: "t055",
    minMonths: 0,
    maxMonths: 48,
    text: "Keep a properly fitted life jacket for your child near any body of water — floaties and swim rings are fun but they're not safety devices.",
    source: { label: "CPSC — Pool Safely", url: "https://www.poolsafely.gov/" },
  },
  {
    id: "t056",
    minMonths: 0,
    maxMonths: 48,
    text: "Make sure an adult who knows how to swim is within arm's reach whenever your child is in or near the water — designated water watching, with no phone distractions.",
    source: {
      label: "AAP — Drowning Prevention and Water Safety",
      url: "https://www.aap.org/en/patient-care/drowning-prevention-and-water-safety/",
    },
  },
  {
    id: "t057",
    minMonths: 12,
    maxMonths: 999,
    text: "Enroll your child in age-appropriate swim lessons — the AAP notes that lessons can significantly reduce drowning risk for children one year and older.",
    source: {
      label: "AAP — Swim Lessons for Children",
      url: "https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Swim-Lessons.aspx",
    },
  },
  {
    id: "t058",
    minMonths: 0,
    maxMonths: 999,
    text: "Learn CPR — pool-related emergencies happen very quickly, and hands-only CPR before emergency services arrive can make a meaningful difference.",
    source: { label: "CPSC — Pool Safely", url: "https://www.poolsafely.gov/" },
  },
  {
    id: "t059",
    minMonths: 0,
    maxMonths: 36,
    text: "Empty any portable or inflatable pools completely after each use and store them upside down — even a few inches of standing water is a drowning risk for young children.",
    source: { label: "CPSC — Pool Safely FAQ", url: "https://www.poolsafely.gov/faq/" },
  },
  {
    id: "t060",
    minMonths: 0,
    maxMonths: 999,
    text: "Keep a reaching pole and a ring buoy at the pool's edge during any swim session — having rescue equipment immediately at hand can save critical seconds.",
  },

  {
    id: "t047",
    minMonths: 22,
    maxMonths: 999,
    text: "Confirm that any outdoor water features like paddling pools are emptied and put away when not in use — even shallow water requires close supervision.",
  },
  {
    id: "t048",
    minMonths: 24,
    maxMonths: 999,
    text: "Check that window guards are properly fitted in rooms where your child plays — guards withstand more force than window stops, and it's worth knowing the difference.",
  },
  {
    id: "t049",
    minMonths: 22,
    maxMonths: 999,
    text: "Make helmets non-negotiable for ride-on toys, balance bikes, and scooters — habits formed early tend to stick.",
  },
  {
    id: "t050",
    minMonths: 24,
    maxMonths: 999,
    text: "Do a general medicine cabinet check — expiration dates on first aid supplies can pass without notice, and some products degrade before they're needed.",
  },
  {
    id: "t051",
    minMonths: 24,
    maxMonths: 999,
    text: "Revisit your home's smoke alarm placement and test the alarms — doing it together with your child can help them feel calm and prepared if they ever hear the sound.",
  },
  {
    id: "t052",
    minMonths: 22,
    maxMonths: 999,
    text: "Give the locks and latches on your outdoor gates a check — weather exposure causes these to degrade faster than interior hardware.",
  },
  {
    id: "t061",
    minMonths: 0,
    maxMonths: 24,
    text: "If your baby uses a pacifier, double-check you're using the size made for their current age — most brands mark stages like 0–6 months and 6–18 months, and a pacifier sized for a younger baby can be a choking or fit hazard as they grow.",
  },

  // ── Broader ages and topics: sleep, cars, poisons, burns, outdoors, school age, teens ──
  {
    id: "t062",
    minMonths: 0,
    maxMonths: 12,
    text: "Always lay your baby down on their back for every sleep, naps included — it's the single most effective step for reducing the risk of SIDS.",
  },
  {
    id: "t063",
    minMonths: 0,
    maxMonths: 12,
    text: "Avoid letting your baby fall asleep on a couch, armchair, or adult bed with you — these surfaces carry a much higher suffocation risk than a crib or bassinet.",
  },
  {
    id: "t064",
    minMonths: 0,
    maxMonths: 72,
    text: "Never leave your child alone in the car, even for a minute — a car's interior can heat up to a dangerous temperature quickly, even on a mild day.",
  },
  {
    id: "t065",
    minMonths: 0,
    maxMonths: 24,
    text: "Set your hot tap temperature to 120°F (49°C) or lower — at higher settings, tap water can scald a young child's skin in seconds.",
  },
  {
    id: "t066",
    minMonths: 0,
    maxMonths: 999,
    text: "Save the Poison Help number (1-800-222-1222 in the US) in your phone and post it where babysitters and grandparents can see it.",
  },
  {
    id: "t067",
    minMonths: 0,
    maxMonths: 999,
    text: "Keep a stocked first aid kit at home and another in the car, and check both twice a year for anything used up or expired.",
  },
  {
    id: "t068",
    minMonths: 4,
    maxMonths: 18,
    text: "Buckle the waist and crotch straps on the high chair every time — the tray alone won't stop a baby from sliding down or climbing out.",
  },
  {
    id: "t069",
    minMonths: 6,
    maxMonths: 48,
    text: "Cut round foods like grapes, cherry tomatoes, and hot dogs lengthwise into small pieces — their size and shape can block a young child's airway.",
  },
  {
    id: "t070",
    minMonths: 6,
    maxMonths: 72,
    text: "Keep button batteries, and devices with easy-open battery doors (remotes, key fobs, musical cards), out of reach — a swallowed button battery can cause serious internal burns within hours.",
  },
  {
    id: "t071",
    minMonths: 6,
    maxMonths: 36,
    text: "Cook on the back burners when you can and turn pot handles toward the back of the stove — a grabbed handle can tip hot food straight down.",
  },
  {
    id: "t072",
    minMonths: 9,
    maxMonths: 36,
    text: "Keep handbags, diaper bags, and visitors' bags up off the floor — they often hold medications, gum, or other hazards at exactly toddler height.",
  },
  {
    id: "t073",
    minMonths: 6,
    maxMonths: 999,
    text: "Use a broad-spectrum SPF 30+ sunscreen on outdoor days and reapply every two hours — hats, shade, and covered arms help too.",
  },
  {
    id: "t074",
    minMonths: 12,
    maxMonths: 48,
    text: "Keep your child rear-facing in their car seat until they reach the seat's rear-facing height or weight limit — it gives the head, neck, and spine the most protection.",
  },
  {
    id: "t075",
    minMonths: 12,
    maxMonths: 72,
    text: "Hold hands in parking lots and keep your child beside you while you load the car — small children are very hard for reversing drivers to see.",
  },
  {
    id: "t076",
    minMonths: 12,
    maxMonths: 96,
    text: "Store small, high-powered magnets (from desk toys, building sets, or jewelry) well out of reach — swallowing more than one can cause serious internal injuries.",
  },
  {
    id: "t077",
    minMonths: 12,
    maxMonths: 240,
    text: "Lock away vape liquid, nicotine pouches, alcohol, and cannabis edibles — small amounts can poison a child, and edibles can look just like ordinary candy.",
  },
  {
    id: "t078",
    minMonths: 12,
    maxMonths: 240,
    text: "If there are firearms in your home, store them unloaded and locked, with ammunition locked separately — and ask about safe storage at homes your child visits.",
  },
  {
    id: "t079",
    minMonths: 18,
    maxMonths: 36,
    text: "Move your toddler to a low toddler bed once they can climb out of the crib or the rail sits below chest height — a fall from the crib rail is a long drop.",
  },
  {
    id: "t080",
    minMonths: 24,
    maxMonths: 96,
    text: "Re-check that TVs, dressers, and bookshelves are anchored to the wall — climbing preschoolers can tip furniture that never moved when they were smaller.",
  },
  {
    id: "t081",
    minMonths: 24,
    maxMonths: 120,
    text: "Practise stopping at the curb and waiting for an adult's hand before crossing — young children can't yet judge the speed and distance of traffic.",
  },
  {
    id: "t082",
    minMonths: 24,
    maxMonths: 120,
    text: "Teach your child to ask before petting any dog, even one they know, and to leave dogs alone while they're eating or sleeping.",
  },
  {
    id: "t083",
    minMonths: 36,
    maxMonths: 120,
    text: "Teach your child their full name and a parent's phone number — turning it into a song or rhyme helps it stick.",
  },
  {
    id: "t084",
    minMonths: 36,
    maxMonths: 240,
    text: "Make a home fire escape plan with two ways out of each room and a meeting spot outside, and practise it with your child twice a year.",
  },
  {
    id: "t085",
    minMonths: 36,
    maxMonths: 144,
    text: "Choose a family code word that anyone picking your child up unexpectedly has to know — and practise what your child should do if someone doesn't know it.",
  },
  {
    id: "t086",
    minMonths: 36,
    maxMonths: 144,
    text: "Keep children under six off the top bunk, and make sure any top bunk has guardrails on both sides.",
  },
  {
    id: "t087",
    minMonths: 36,
    maxMonths: 240,
    text: "Replace any bike or scooter helmet after a crash, even if it looks fine — the foam inside is designed to protect against one impact.",
  },
  {
    id: "t088",
    minMonths: 36,
    maxMonths: 144,
    text: "If you have a home trampoline, allow one jumper at a time and use a safety net and padding — most trampoline injuries happen when several children jump together.",
  },
  {
    id: "t089",
    minMonths: 48,
    maxMonths: 144,
    text: "Keep your child in a booster seat until the adult seat belt fits properly — lap belt low across the upper thighs and shoulder belt across the chest, usually somewhere between ages 8 and 12.",
  },
  {
    id: "t090",
    minMonths: 48,
    maxMonths: 156,
    text: "Keep children under 13 in the back seat — front airbags are designed for adults and can seriously injure a child.",
  },
  {
    id: "t091",
    minMonths: 48,
    maxMonths: 144,
    text: "Teach your child the difference between a safe secret (a surprise party) and an unsafe one, and that they can always tell you if an adult asks them to keep something from you.",
  },
  {
    id: "t092",
    minMonths: 60,
    maxMonths: 240,
    text: "Keep internet-connected devices in shared spaces, set up parental controls, and make sure your child knows they can tell you about anything online that makes them uncomfortable.",
  },
  {
    id: "t093",
    minMonths: 60,
    maxMonths: 240,
    text: "Make sure your child wears the right protective gear for their sport — mouthguards, shin guards, and properly fitted helmets — and sits out after any suspected head injury.",
  },
  {
    id: "t094",
    minMonths: 120,
    maxMonths: 240,
    text: "Agree on a no-questions-asked pickup rule, so your child always calls you rather than riding with a driver who has been drinking or using drugs.",
  },
  {
    id: "t095",
    minMonths: 180,
    maxMonths: 240,
    text: "Set clear rules for a new teen driver — phone out of reach, seat belts for everyone, and limits on passengers and night driving for the first months.",
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

// Water-safety tips (pools, swimming, drowning) — matched by text so a new
// water tip is picked up without tagging it. Deliberately not a bare
// /water/ or /bath/, which would also catch the tap-temperature and
// bathroom-cabinet tips.
export const WATER_TIP_PATTERN =
  /pool|swim|drown|life jacket|near (?:any body of |the )?water|around water|outdoor water/i;

// The water tips sit together in SAFETY_TIPS, so rotating through the pool
// in array order showed them on several consecutive days. Reorders the pool
// so water tips are spaced evenly between the other topics — same tips, same
// lap length, just never a run of water days while other tips are available.
function spreadWaterTips(pool: SafetyTip[]): SafetyTip[] {
  const water = pool.filter((t) => WATER_TIP_PATTERN.test(t.text));
  const other = pool.filter((t) => !WATER_TIP_PATTERN.test(t.text));
  if (water.length === 0 || other.length === 0) return pool;
  const spread: SafetyTip[] = [];
  let w = 0;
  other.forEach((tip, i) => {
    spread.push(tip);
    if (w < water.length && ((i + 1) * water.length) / other.length >= w + 1) {
      spread.push(water[w++]);
    }
  });
  return spread.concat(water.slice(w));
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
// range is 21 tips (see safetyTips.test.ts), so a daily cadence completes a
// full lap of an age's pool in as little as ~3 weeks before repeating. Acceptable
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
  pool = spreadWaterTips(pool);
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
