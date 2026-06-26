export type DevBand = {
  weekStart: number;
  weekEnd: number;
  physical: string;
  cognitive: string;
  safety: string;
};

export const DEVELOPMENT_BANDS: DevBand[] = [
  {
    weekStart: 0,
    weekEnd: 4,
    physical: "You might notice your newborn lifting their head briefly during tummy time — even a second or two is meaningful, and every baby builds this strength on their own schedule.",
    cognitive: "Some newborns show early signs of preferring familiar voices — you might notice your baby turning toward the sound of your voice more than other sounds in the room.",
    safety: "Newborns can't regulate their own temperature well. A gentle heads-up: check that their sleep environment stays between 68–72°F and that they aren't overdressed for sleep.",
  },
  {
    weekStart: 4,
    weekEnd: 8,
    physical: "If your baby is showing signs of stronger neck control during tummy time, that's a wonderful development — and so is needing more time to build that strength. Every baby is different.",
    cognitive: "You might notice your baby beginning to track a slowly moving object with their eyes, following it briefly before losing interest. Visual tracking develops gradually over the coming weeks.",
    safety: "A gentle heads-up on swaddling: make sure the swaddle leaves room for the hips to move freely. Hip dysplasia has been associated with overly tight swaddling that keeps legs straight.",
  },
  {
    weekStart: 8,
    weekEnd: 12,
    physical: "Some babies around this age begin to bat at objects within reach, or may bring their hands toward their face and mouth — you might notice these early exploratory movements starting to emerge.",
    cognitive: "You might notice your baby beginning to smile responsively — a social smile that appears in response to your face or voice, rather than reflexively during sleep.",
    safety: "A gentle heads-up: if your baby spends time in a bouncer or swing, aim to limit waking time in any curved-back device to around 30 minutes, as prolonged positioning can affect spine and airway alignment.",
  },
  {
    weekStart: 12,
    weekEnd: 16,
    physical: "If your baby is showing signs of pushing up on their forearms during tummy time, that's great upper-body development — though every baby builds this strength at their own pace.",
    cognitive: "Some babies around this age begin to follow objects across their full visual field more smoothly. You might see slightly longer stretches of focused attention than a few weeks ago.",
    safety: "A gentle heads-up: as babies gain strength, it's worth checking that crib slats are no wider than 2⅜ inches and the mattress fits snugly with no gaps around the edges.",
  },
  {
    weekStart: 16,
    weekEnd: 20,
    physical: "You might notice your baby beginning to reach intentionally for objects and occasionally managing to grab something within range — coordination at this stage is still very much developing.",
    cognitive: "Some babies around 4 months begin responding to familiar faces differently than unfamiliar ones — you might notice a moment of caution or quieting when someone new gets close.",
    safety: "A gentle heads-up: check your baby's reclined seat or carrier angle. Their chin should never drop toward their chest, which can restrict airways — a two-finger gap between chin and chest is a useful check.",
  },
  {
    weekStart: 20,
    weekEnd: 24,
    physical: "If your baby is showing signs of rolling from tummy to back, or in the other direction, that's a common development around this time — though the order and timing varies widely from baby to baby.",
    cognitive: "You might notice your baby reaching for and exploring objects with both hands, and beginning to pass things from one hand to the other as coordination improves.",
    safety: "A gentle heads-up: rolling babies can surprise caregivers. If your baby has started rolling, this is a good time to stop leaving them unattended on elevated surfaces like changing tables or sofas.",
  },
  {
    weekStart: 24,
    weekEnd: 28,
    physical: "Some babies around 6 months begin showing early signs of sitting with support — though sitting independently is still ahead for many babies, and every baby is different and develops at their own pace.",
    cognitive: "You might notice your baby beginning to babble in ways that sound more conversational — longer chains of sounds appearing, and more back-and-forth vocal exchanges with caregivers.",
    safety: "A gentle heads-up: if your baby is starting to sit up, this is a good time to lower the crib mattress one setting if you haven't already, and to check that there are no loose objects within reach.",
  },
  {
    weekStart: 28,
    weekEnd: 32,
    physical: "If your baby is showing signs of pushing up on hands and knees or rocking back and forth, they may be working toward crawling — though some babies skip crawling entirely and go straight to pulling up.",
    cognitive: "Some babies this age begin to show clearer preferences — certain toys, songs, or people may get noticeably bigger reactions. You might also notice early signs of object permanence beginning to emerge.",
    safety: "A gentle heads-up: as mobility increases, this is a great time to install safety gates at the top and bottom of stairs before they're needed — installing them proactively is much easier than rushing after a scare.",
  },
  {
    weekStart: 32,
    weekEnd: 36,
    physical: "You might notice your baby beginning to pull themselves to a standing position using furniture or your hands — their legs may shake or buckle at first, which is completely normal and expected.",
    cognitive: "Some babies around this age begin to respond to their own name with recognizable consistency — you might notice them pause, look up, or turn toward you when they hear it.",
    safety: "A gentle heads-up: as babies begin pulling to stand, check that all heavy furniture — bookshelves, dressers, TV stands — is securely anchored to the wall. Furniture tip-overs are a leading cause of injury at this stage.",
  },
  {
    weekStart: 36,
    weekEnd: 40,
    physical: "If your baby is showing signs of cruising — moving sideways along furniture while holding on — that's a common development around 9 months, though every baby is different and develops at their own pace.",
    cognitive: "You might notice your baby using early gestures like waving, clapping, or pointing — these are signs of growing intentional communication, not just reflex.",
    safety: "A gentle heads-up: babies cruising along furniture often pick up whatever they find at floor level. A floor-level sweep for small objects, coins, and anything under 1.75 inches is worth doing at this stage.",
  },
  {
    weekStart: 40,
    weekEnd: 44,
    physical: "Some babies around 10 months can stand briefly without holding on for a moment or two — others are still working on pull-to-stand strength and are entirely on their own track.",
    cognitive: "You might notice your baby beginning to respond to simple words or requests like 'no' or 'come here' — early word comprehension often develops before spoken words appear.",
    safety: "A gentle heads-up: check your infant car seat limits. Many seats have weight and height maximums that babies reach around this age — if your child is approaching the limit, a convertible seat may be worth looking into.",
  },
  {
    weekStart: 44,
    weekEnd: 48,
    physical: "You might notice your baby practicing a pincer grip — picking up small objects between thumb and forefinger. This fine motor skill develops gradually and improves noticeably over the coming weeks.",
    cognitive: "Some babies around 11 months begin stringing consonant-vowel sounds together in ways that sound like early words — 'mama,' 'dada,' 'baba' — though the timeline for first words varies widely.",
    safety: "A gentle heads-up: the pincer grip means small objects are especially interesting right now. Button batteries, coins, small toy parts, and loose pieces are worth checking for at floor level and in bags.",
  },
  {
    weekStart: 48,
    weekEnd: 52,
    physical: "If your baby is showing signs of taking first steps — with or without support — that's a common development around 12 months, though some babies walk several months earlier or later and are entirely on track.",
    cognitive: "You might notice your baby starting to point to things they want or find interesting — pointing is an important communication milestone and varies widely in when it first appears.",
    safety: "A gentle heads-up: first steps bring new reach. Cabinet locks on lower cabinets, toilet locks, and securely latched stairway gates all become more important as walking begins.",
  },
  {
    weekStart: 52,
    weekEnd: 56,
    physical: "Some babies around this age are walking steadily, while others are still happily cruising — both are well within typical ranges. Walking confidence usually builds quickly once it starts.",
    cognitive: "You might notice your toddler beginning to follow simple two-step directions, or pointing to familiar objects when they're named — early signs of growing language comprehension.",
    safety: "A gentle heads-up: walking toddlers move faster than expected. If your home has doors to unsafe areas — garages, basements, outside — door knob covers or higher latches are a practical addition now.",
  },
  {
    weekStart: 56,
    weekEnd: 60,
    physical: "If your toddler is showing signs of carrying objects while walking or attempting to climb onto low furniture, that kind of physical exploration is common at this age — with close supervision recommended.",
    cognitive: "Some toddlers around this age begin showing early symbolic play — pretending a block is a phone, or putting a stuffed animal 'to bed.' You might notice this imaginative play starting to emerge.",
    safety: "A gentle heads-up: toddlers who are climbing may attempt to scale cribs. If your child has started climbing out, a toddler bed or lowering the crib to its lowest setting may be worth considering.",
  },
  {
    weekStart: 60,
    weekEnd: 64,
    physical: "You might notice your toddler walking with a more upright posture and fewer stumbles — though tripping and falling is still completely normal and expected at this stage.",
    cognitive: "Some toddlers around 15 months use a handful of consistent words — others are still communicating mainly through gestures and sounds, which is also within the typical range for this age.",
    safety: "A gentle heads-up: cleaning products, laundry pods, and medications should be stored out of reach and ideally in a locked cabinet — toddlers are increasingly capable of opening lower-level doors and drawers.",
  },
  {
    weekStart: 64,
    weekEnd: 68,
    physical: "If your toddler is showing signs of running — even if it looks more like a fast, unsteady walk — that's common motor development around this age, along with plenty of cheerful tumbles.",
    cognitive: "You might notice your toddler starting to sort objects by shape or color, or showing interest in simple shape-sorter puzzles — early problem-solving that develops on its own schedule.",
    safety: "A gentle heads-up: running toddlers discover new areas quickly. Check that outdoor gates and any pool fencing are self-closing and self-latching, if applicable to your home.",
  },
  {
    weekStart: 68,
    weekEnd: 72,
    physical: "Some toddlers around this age may begin to kick a ball, walk up stairs with support, or show interest in jumping — each of these develops on its own timeline, with no single 'right' age.",
    cognitive: "You might notice your toddler pointing to body parts when named, or showing increased interest in books by turning pages and 'naming' pictures — all signs of growing language engagement.",
    safety: "A gentle heads-up: stair climbing is exciting for toddlers and a common fall risk. If your gates are pressure-mounted at the top of stairs, hardware-mounted gates are the safer option.",
  },
  {
    weekStart: 72,
    weekEnd: 76,
    physical: "If your toddler is showing signs of walking up stairs while holding a railing, or climbing on play structures, that physical exploration is typical at 18 months — and benefits from close supervision.",
    cognitive: "Some toddlers around 18 months may use 10–25 words and begin combining two words together. Others are still building their spoken vocabulary and are well within the typical range.",
    safety: "A gentle heads-up: 18-month-olds are increasingly curious about kitchen and bathroom spaces. Cabinet locks, toilet locks, and stove knob covers all become especially relevant at this stage.",
  },
  {
    weekStart: 76,
    weekEnd: 80,
    physical: "You might notice your toddler running more confidently — though changes in terrain like grass, sand, or uneven surfaces may still cause stumbles. This is completely expected at this age.",
    cognitive: "Some toddlers around this age begin engaging in more extended pretend play sequences — feeding a stuffed animal, then putting it to sleep. Every toddler develops imaginative play in their own time.",
    safety: "A gentle heads-up: outdoor play equipment is worth a seasonal inspection — check swings, slides, and climbing structures for rust, splinters, loose hardware, or surfaces that get very hot in the sun.",
  },
  {
    weekStart: 80,
    weekEnd: 84,
    physical: "If your toddler is showing signs of jumping in place with both feet, walking on tiptoe, or throwing a ball overhand, these skills often emerge around 20 months — though timing varies widely.",
    cognitive: "You might notice your toddler beginning to name several body parts, follow two-step instructions more consistently, or show early interest in playing alongside other children.",
    safety: "A gentle heads-up: toddlers at this age are often tall enough to reach countertops. Dangling cords, tablecloths, and accessible hot surfaces are all worth a quick safety check.",
  },
  {
    weekStart: 84,
    weekEnd: 88,
    physical: "Some toddlers around 21 months may begin walking backward, kicking a stationary ball, or climbing with increasing confidence — each skill arrives on its own schedule.",
    cognitive: "You might notice your toddler's vocabulary growing noticeably, with new words appearing more frequently. If language is quieter right now, that's also within the typical range for this age.",
    safety: "A gentle heads-up: toddlers at this age may begin to open round door knobs they couldn't before. Door knob covers or high slide-bolt latches on exterior doors can help prevent unsupervised exits.",
  },
  {
    weekStart: 88,
    weekEnd: 92,
    physical: "If your toddler is showing signs of pedaling a tricycle, catching a large ball, or briefly balancing on one foot, those skills often begin appearing around 22 months — every toddler is different.",
    cognitive: "Some toddlers around this age start asking 'what's that?' repeatedly — a sign of growing curiosity about naming the world. You might notice this phase of language acquisition picking up noticeably.",
    safety: "A gentle heads-up: as toddlers become more physically capable, a properly fitted helmet becomes relevant for any balance bike, tricycle, or ride-on toy — the habit is easier to build early.",
  },
  {
    weekStart: 92,
    weekEnd: 96,
    physical: "You might notice your toddler's movements becoming more coordinated — running, throwing, and climbing may look noticeably smoother and more intentional than even a few months ago.",
    cognitive: "Some toddlers around 23 months begin engaging in more complex pretend play, using objects symbolically, or involving other children and adults in imaginary scenarios.",
    safety: "A gentle heads-up: at this stage, toddlers are often strong enough to move light furniture. A quick check that heavy bookshelves and dressers are still securely anchored to the wall is worthwhile.",
  },
  {
    weekStart: 96,
    weekEnd: 100,
    physical: "If your toddler is showing signs of jumping with both feet, walking stairs more independently, or running and stopping more smoothly, those motor developments are common around 24 months.",
    cognitive: "You might notice your toddler using two- to three-word phrases regularly, asking for things by name, and showing early signs of turn-taking in back-and-forth conversation.",
    safety: "A gentle heads-up: two-year-olds are mobile, fast, and curious in new ways. A walk-through at their eye level can reveal new hazards — cords, climbing routes, accessible drawers — that weren't concerns before.",
  },
  {
    weekStart: 100,
    weekEnd: 104,
    physical: "Some children around this age begin showing signs of tricycle pedaling, kicking a ball with aim, or attempting to balance on one foot — though every child develops at their own pace.",
    cognitive: "You might notice your child using language to express more complex ideas — describing something that happened earlier, asking 'why,' or beginning to understand concepts like 'mine' and 'yours.'",
    safety: "A gentle heads-up: as children approach 2 years old, it's a good time to check car seat fit. Most convertible seats don't need to be switched to forward-facing until 40+ lbs, but checking the manual is always worthwhile.",
  },
];

export function getDevelopmentBand(ageWeeks: number): DevBand {
  for (const band of DEVELOPMENT_BANDS) {
    if (ageWeeks >= band.weekStart && ageWeeks < band.weekEnd) return band;
  }
  return DEVELOPMENT_BANDS[DEVELOPMENT_BANDS.length - 1];
}
