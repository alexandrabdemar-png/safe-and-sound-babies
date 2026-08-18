// Safety-tip content shown after logging a moment, keyed by title match.
// Lives here (not in the moments_.new.tsx route file) so it can be imported
// as a plain data/logic module — e.g. by insights.ts's "Up next" engine via
// getMilestoneKey — without pulling in a whole route module (createFileRoute
// + its UI imports). moments_.new.tsx re-exports these for its own use and
// for its existing test suite.
import { type MilestoneKey } from "./milestoneKeys";

export type SafetyTip = { title: string; tips: string[] };

export const MOMENT_SAFETY_MAP: {
  pattern: RegExp;
  safety: SafetyTip;
  // Links this entry to the shared MilestoneKey taxonomy (milestoneKeys.ts)
  // — null for entries that aren't a developmental milestone with a
  // typical age of their own (lowering the crib mattress is a parent
  // action, not something a baby "reaches").
  milestoneKey: MilestoneKey | null;
}[] = [
  {
    pattern: /roll(ed|ing)|tummy time/i,
    milestoneKey: "rolling",
    safety: {
      title: "Rolling over — time to think ahead",
      tips: [
        "Never leave them unattended on a raised surface (changing table, sofa, bed).",
        "Start thinking about outlet covers and cabinet locks — mobility picks up fast from here.",
        "If you haven't already, lower the crib mattress to the middle setting soon.",
      ],
    },
  },
  {
    pattern: /sat up|sitting/i,
    milestoneKey: "sitting",
    safety: {
      title: "Sitting up — babyproofing starts now",
      tips: [
        "Lower the crib mattress to the middle setting now — pulling to stand often follows sitting up within weeks.",
        "Begin babyproofing: outlet covers, cabinet locks, and anchor tall furniture to the wall.",
        "Swings and bouncers become unsafe once a baby can sit independently — check weight limits.",
      ],
    },
  },
  {
    pattern: /crawl(ing|ed)|crawls/i,
    milestoneKey: "crawling",
    safety: {
      title: "Crawling — time to gate the stairs",
      tips: [
        "Install hardware-mounted baby gates at the top of all stairs immediately.",
        "Latch every cabinet at hip-height or below — especially anything with cleaning supplies.",
        "Cover all accessible electrical outlets.",
        "Secure cords (blinds, lamps) out of reach.",
      ],
    },
  },
  {
    pattern: /pull(ing|ed|s)? to stand|pulling up|pulls up/i,
    milestoneKey: "pulling_to_stand",
    safety: {
      title: "Pulling to stand — lower the crib now",
      tips: [
        "Drop the crib mattress to its lowest setting today — a standing baby can topple over the rail from a higher one.",
        "Clear whatever they're pulling up on most (coffee table, ottoman, low shelf) of tablecloths, cords, and anything grabbable.",
        "Anchor furniture they use to pull themselves up (dressers, bookshelves, TV stands) — it now has to bear real weight, not just resist a curious push.",
        "Recheck cabinet and drawer locks near their favorite pull-up spots — standing gives them more leverage to pry doors open.",
      ],
    },
  },
  {
    pattern: /stand(ing|s)\b|first stand/i,
    milestoneKey: "standing",
    safety: {
      title: "Standing — full babyproofing check",
      tips: [
        "Confirm the crib mattress is still at its lowest setting.",
        "Walk every room at your baby's new eye level — check counters, table edges, and shelves for anything now within reach.",
        "Install gates at both the top and bottom of stairs — a standing baby can pitch forward onto steps even before walking.",
        "Shorten or tie up blind and curtain cords — they can now reach higher than before.",
        "Double-check that tall furniture and TVs are anchored — standing gives more leverage to pull them over than crawling did.",
      ],
    },
  },
  {
    pattern: /first step|walking|took.*step|steps/i,
    milestoneKey: "first_steps",
    safety: {
      title: "First steps — your home just got smaller",
      tips: [
        "Gate all stairs — hardware-mount at the top, pressure-mount is fine at the bottom.",
        "Cover outlet covers throughout the house.",
        "Anchor furniture, TVs, and appliances so nothing can topple when grabbed.",
        "Move cleaning supplies, medicines, and small objects to high shelves or locked cabinets.",
        "Check door stoppers and pinch guards on all doors.",
      ],
    },
  },
  {
    pattern: /lower(ed|ing)? (the )?crib|crib.*lower|mattress.*lower|lower.*mattress/i,
    milestoneKey: null,
    safety: {
      title: "Lowering the crib mattress — one more safety step",
      tips: [
        "When repositioning your crib mattress, make sure to move the crib away from electrical outlets and any camera or monitor cords to keep your baby safe.",
      ],
    },
  },
  {
    pattern: /first tooth|teeth|teething/i,
    milestoneKey: "first_tooth",
    safety: {
      title: "First tooth — a few things to know",
      tips: [
        "Avoid teething gels or tablets with benzocaine or belladonna — not safe for infants.",
        "Skip amber teething necklaces — they're a strangulation and choking hazard.",
        "Chilled (not frozen) teething rings are a safe option.",
        "First dentist visit is recommended by age 1 or when the first tooth appears.",
      ],
    },
  },
  {
    pattern: /first food|solid|puree|eating/i,
    milestoneKey: "first_food",
    safety: {
      title: "Starting solids — keep it safe",
      tips: [
        "Always supervise during meals — never leave them unattended while eating.",
        "Avoid honey before age 1 (risk of botulism).",
        "Cut soft foods into pieces no larger than ½ inch.",
        "Skip whole grapes, raw carrots, nuts, and popcorn until age 4.",
        "Make sure your high chair has a working harness — use it every time.",
      ],
    },
  },
];

function findMatchingEntry(momentTitle: string) {
  return MOMENT_SAFETY_MAP.find(({ pattern }) => pattern.test(momentTitle)) ?? null;
}

export function getSafetyTip(momentTitle: string): SafetyTip | null {
  return findMatchingEntry(momentTitle)?.safety ?? null;
}

export function getMilestoneKey(momentTitle: string): MilestoneKey | null {
  return findMatchingEntry(momentTitle)?.milestoneKey ?? null;
}
