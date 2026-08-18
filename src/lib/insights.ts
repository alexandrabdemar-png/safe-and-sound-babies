// Predictive guidance engine.
// Given the developmental milestones a family has logged and the products
// they own, return a prioritized list of in-app insights. Dismissals are
// layered on top in the UI.
//
// This used to be driven by the child's date of birth (computed age in
// months). Per a deliberate product/privacy decision, the app no longer
// collects or stores a child's birthdate — every rule below is triggered by
// a milestone the parent has actually logged (MOMENT_SAFETY_MAP in
// moments_.new.tsx / getMilestoneKey) instead of a computed age window.
// Rules with no natural milestone equivalent (e.g. "keep the car seat
// rear-facing," which was a pure age-window reminder) were re-anchored to
// the closest related milestone rather than dropped outright.

import {
  reachedMobilityStage,
  type MilestoneKey,
} from "./milestoneKeys";

export type InsightUrgency = "now" | "soon" | "heads_up";

export type Insight = {
  id: string; // stable rule id, used for dismissal lookup
  title: string;
  body: string;
  urgency: InsightUrgency;
  category?: string; // optional product/topic category for grouping/icons
};

export type ChildInput = {
  id: string;
  name: string;
};

export type ProductInput = {
  id: string;
  category: string | null; // free text label OR our category keys
  purchased_at?: string | null;
  size?: string | null;
};

// Categories we evaluate against. We accept both the new product keys and
// the human labels saved on existing rows.
const CAT_MATCH: Record<string, RegExp> = {
  car_seat: /car ?seat/i,
  crib: /\bcrib\b/i,
  bassinet: /bassinet/i,
  stroller: /stroller/i,
  high_chair: /high ?chair/i,
  swing: /swing/i,
  bouncer: /bouncer/i,
  activity_center: /activity ?center/i,
  sleep_sack: /sleep ?sack|swaddle/i,
  baby_gate: /baby[ _]?gate|^gate$/i,
};

function hasCategory(products: ProductInput[], key: keyof typeof CAT_MATCH): ProductInput | undefined {
  const re = CAT_MATCH[key];
  return products.find((p) => p.category && re.test(p.category));
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export type HomeProfileInput = {
  has_stairs?: boolean | null;
  has_pool?: boolean | null;
  has_pet?: boolean | null;
  has_car?: boolean | null;
} | null | undefined;

export function evaluateInsights(
  child: ChildInput | null,
  products: ProductInput[],
  loggedMilestones: ReadonlySet<MilestoneKey>,
  homeProfile?: HomeProfileInput,
): Insight[] {
  if (!child) return [];
  const out: Insight[] = [];
  const name = child.name || "Your baby";
  // A profile is only considered "answered" once the row exists — otherwise
  // we default to showing stairs/gate guidance rather than silently hiding
  // it for someone who hasn't taken the personalization quiz yet.
  const hasStairs = homeProfile ? homeProfile.has_stairs !== false : true;

  const reached = (k: MilestoneKey) => reachedMobilityStage(loggedMilestones, k);
  const logged = (k: MilestoneKey) => loggedMilestones.has(k);

  // ── Mobility-stage rules ─────────────────────────────────────────────────
  // Anchored to logged milestones instead of an age window. Later stages
  // supersede earlier ones in the same family (e.g. once "pulling to stand"
  // is logged, the crib-mattress-to-middle nudge stops firing in favor of
  // the crib-mattress-to-lowest one) rather than both firing forever.
  const crib = hasCategory(products, "crib");

  if (reached("rolling") && !reached("crawling")) {
    out.push({
      id: "babyproof_start",
      title: "Begin thinking about babyproofing",
      body: "Now that mobility is picking up, some families find it helpful to begin looking into outlet covers, cabinet locks, and anchoring tall furniture.",
      urgency: "now",
      category: "safety",
    });
  }

  if (crib && reached("pulling_to_stand")) {
    out.push({
      id: "crib_mattress_lowest",
      title: "Consider lowering the crib mattress to its lowest setting",
      body: "Many families lower the mattress to its lowest setting once a baby can pull to stand, so the rail height stays adequate.",
      urgency: "now",
      category: "crib",
    });
  } else if (crib && reached("rolling")) {
    out.push({
      id: "crib_mattress_middle",
      title: "Consider lowering the crib mattress",
      body: "Once a baby begins pushing up or shows signs of increased mobility, many families lower the mattress to the middle setting before they can pull to sit.",
      urgency: "now",
      category: "crib",
    });
  }

  if (reached("crawling") && hasStairs) {
    out.push({
      id: "install_baby_gates",
      title: "Consider installing safety gates near stairs",
      body: "Now that mobility has picked up, this can be a good time to think about gates. Hardware-mounted gates tend to offer the most secure hold.",
      urgency: "now",
      category: "baby_gate",
    });
  }

  if (reached("crawling")) {
    out.push({
      id: "babyproof_low_cabinets",
      title: "Consider securing lower cabinets",
      body: `Many families begin securing accessible cabinets around this stage, as ${name} becomes more active — especially any that store cleaning supplies.`,
      urgency: "now",
      category: "safety",
    });
  }

  // ── Car seat ─────────────────────────────────────────────────────────────
  // Previously two separate age-window rules ("approaching infant car seat
  // limit" and "check infant car seat weight limit") both predicted, from
  // the child's age, that the seat was probably close to its limit. Without
  // a stored age, we can't make that prediction — so this states the fact a
  // parent can check themselves instead: increasing mobility is a good
  // prompt to actually go look at the seat's sticker.
  const carSeat = hasCategory(products, "car_seat");
  if (carSeat && reached("pulling_to_stand") && !logged("first_steps")) {
    out.push({
      id: "infant_carseat_check",
      title: "Check your infant car seat's height & weight limit",
      body: "Infant seats are usually outgrown by height before weight. Compare against the sticker on the seat shell and start researching a convertible seat if you're close.",
      urgency: "soon",
      category: "car_seat",
    });
  }
  if (carSeat && logged("first_steps")) {
    out.push({
      id: "rear_facing_reminder",
      title: "Keep the car seat rear-facing",
      body: "Experts recommend keeping your baby rear-facing as long as possible and within the seat's height and weight limits — check the sticker on the seat shell before flipping it.",
      urgency: "heads_up",
      category: "car_seat",
    });
  }

  // Bassinets are typically outgrown by weight, length, or once a baby
  // begins pushing up — "rolling" is the closest logged signal for that.
  if (hasCategory(products, "bassinet") && reached("rolling") && !reached("crawling")) {
    out.push({
      id: "bassinet_transition",
      title: "Plan the crib transition",
      body: "Bassinets are typically outgrown by weight, length, or when your baby begins pushing up. Have the crib ready before that moment arrives.",
      urgency: "now",
      category: "bassinet",
    });
  }

  const sleepSack = hasCategory(products, "sleep_sack");
  if (sleepSack) {
    const purchased = daysSince(sleepSack.purchased_at ?? null);
    if (purchased !== null && purchased >= 90) {
      out.push({
        id: "sleep_sack_size_up",
        title: "Sleep sack likely needs sizing up",
        body: "Sleep sacks usually fit for ~3 months. Check the weight band on the tag — if you're near the top, order the next size.",
        urgency: "soon",
        category: "sleep_sack",
      });
    }
  }

  // Swings/bouncers are sitting-stage gear — manufacturers stop
  // recommending them once a baby sits up independently.
  if (hasCategory(products, "swing") && reached("sitting")) {
    out.push({
      id: "swing_outgrow",
      title: "Swings are typically not recommended once a baby can sit up",
      body: "Once a baby can sit up independently, many manufacturers no longer recommend swing use — this may be a good time to check the manufacturer's guidance and consider retiring it.",
      urgency: "now",
      category: "swing",
    });
  }
  if (hasCategory(products, "bouncer") && reached("sitting")) {
    out.push({
      id: "bouncer_outgrow",
      title: "Bouncers are typically retired once a baby can sit up",
      body: "Most bouncers are meant to be retired once a baby can sit unassisted — double-check the weight limit on the tag too.",
      urgency: "soon",
      category: "bouncer",
    });
  }

  // Missing-gear suggestions. Sitting/first-food is the earliest trigger,
  // but if the child has since moved well past that (crawling or later)
  // and still has no high chair tracked, "coming up" reads as stale/wrong
  // — bump it to "now" and phrase it as a present fact rather than a
  // forward-looking prediction.
  if ((logged("sitting") || logged("first_food")) && !hasCategory(products, "high_chair")) {
    const wellPastSitting = reached("crawling");
    out.push({
      id: "highchair_suggest",
      title: wellPastSitting ? "Add a high chair to your list" : "Time to think about a high chair",
      body: wellPastSitting
        ? `${name} is past the sitting-up stage, so a high chair is worth adding now if you don't already have one — we'll track it for recalls and replacement.`
        : "Once your baby can sit up and shows readiness for solids, it's a good time to add your high chair and track it for recalls and replacement.",
      urgency: wellPastSitting ? "now" : "soon",
      category: "high_chair",
    });
  }
  if (reached("crawling") && hasStairs && !hasCategory(products, "baby_gate")) {
    out.push({
      id: "gate_suggest",
      title: "Add baby gates to your list",
      body: "Now that mobility has picked up, baby gates become important. Hardware-mount at the top of stairs, pressure-mount is fine elsewhere.",
      urgency: "soon",
      category: "baby_gate",
    });
  }
  if (reached("rolling") && !reached("crawling") && !hasCategory(products, "activity_center")) {
    out.push({
      id: "activity_center_suggest",
      title: "Activity centers are great when your baby can hold their head up but isn't yet walking",
      body: "Optional, but a good way to give your arms a break while they practice standing.",
      urgency: "heads_up",
      category: "activity_center",
    });
  }

  // Sort by urgency
  const order: Record<InsightUrgency, number> = { now: 0, soon: 1, heads_up: 2 };
  out.sort((a, b) => order[a.urgency] - order[b.urgency]);
  return out;
}

// Deliberately non-urgent, informational badge copy — see home.tsx InsightCard.
// Avoid words like "Now" that read as a directive/urgent command.
export const URGENCY_LABEL: Record<InsightUrgency, string> = {
  now: "Recommended",
  soon: "Coming up",
  heads_up: "FYI",
};
