// Predictive guidance engine.
// Given a child (age + measurements) and the products they own, return a
// prioritized list of in-app insights. Dismissals are layered on top in the UI.

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
  date_of_birth: string | null;
  height_inches?: number | null;
  weight_lbs?: number | null;
  measurements_updated_at?: string | null;
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
  baby_gate: /baby ?gate|^gate$/i,
};

function hasCategory(products: ProductInput[], key: keyof typeof CAT_MATCH): ProductInput | undefined {
  const re = CAT_MATCH[key];
  return products.find((p) => p.category && re.test(p.category));
}

// Parse a YYYY-MM-DD string as a local-time date to avoid UTC-midnight shift.
function parseDateLocal(dateStr: string): Date | null {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

export function ageInMonths(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = parseDateLocal(dob);
  if (!birth) return null;
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  // sub-month adjust by day-of-month
  const dayDiff = now.getDate() - birth.getDate();
  return months + (dayDiff < 0 ? -1 : 0);
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export function evaluateInsights(child: ChildInput | null, products: ProductInput[]): Insight[] {
  if (!child) return [];
  const out: Insight[] = [];
  const months = ageInMonths(child.date_of_birth);
  const height = child.height_inches ?? null;
  const weight = child.weight_lbs ?? null;
  const name = child.name || "Your baby";

  // ── Stale measurement nudge ──────────────────────────────────────────────
  const measAge = daysSince(child.measurements_updated_at ?? null);
  if (months !== null && months < 24 && (measAge === null || measAge > 60)) {
    out.push({
      id: "measurements_stale",
      title: `Update ${name}'s height & weight`,
      body: "Fresh measurements help us nudge you on size-ups and outgrown gear at the right time.",
      urgency: "heads_up",
      category: "profile",
    });
  }

  // ── Age-only rules ───────────────────────────────────────────────────────
  if (months !== null) {
    if (months >= 4) {
      out.push({
        id: "babyproof_start",
        title: "Begin thinking about babyproofing",
        body: `Many babies start becoming mobile around this age. Some families find it helpful to begin looking into outlet covers, cabinet locks, and anchoring tall furniture.`,
        urgency: months >= 6 ? "now" : "soon",
        category: "safety",
      });
    }
    if (months >= 6 && months < 12) {
      out.push({
        id: "crib_mattress_middle",
        title: "Consider lowering the crib mattress",
        body: "Once a baby begins pushing up or shows signs of increased mobility, many families lower the mattress to the middle setting before they can pull to sit.",
        urgency: "now",
        category: "crib",
      });
    }
    if (months >= 7) {
      out.push({
        id: "install_baby_gates",
        title: "Consider installing safety gates near stairs",
        body: "If your home has stairs, now can be a good time to think about gates once a baby becomes more mobile. Hardware-mounted gates tend to offer the most secure hold.",
        urgency: "now",
        category: "baby_gate",
      });
    }
    if (months >= 9) {
      out.push({
        id: "babyproof_low_cabinets",
        title: "Consider securing lower cabinets",
        body: `Many families begin securing accessible cabinets around this stage, as ${name} becomes more active — especially any that store cleaning supplies.`,
        urgency: "now",
        category: "safety",
      });
    }
    if (months >= 12) {
      out.push({
        id: "crib_mattress_lowest",
        title: "Consider lowering the crib mattress to its lowest setting",
        body: "Many families lower the mattress to its lowest setting once a baby can pull to stand, so the rail height stays adequate.",
        urgency: "now",
        category: "crib",
      });
    }
    if (months >= 15 && months < 24) {
      out.push({
        id: "rear_facing_reminder",
        title: "Keep the car seat rear-facing",
        body: "Experts recommend keeping your baby rear-facing as long as possible and within the seat's height and weight limits. Don't flip it yet.",
        urgency: "heads_up",
        category: "car_seat",
      });
    }
  }

  // ── Product + age rules ──────────────────────────────────────────────────
  const carSeat = hasCategory(products, "car_seat");
  if (carSeat && (months !== null && months >= 9 || (height !== null && height >= 29.5))) {
    out.push({
      id: "infant_carseat_outgrow",
      title: "Approaching infant car seat limit",
      body: "Infant seats are usually outgrown by height before weight (around 29–30\"). Start researching convertible seats now so you're not rushed.",
      urgency: "soon",
      category: "car_seat",
    });
  }
  if (carSeat && months !== null && months >= 12) {
    out.push({
      id: "infant_carseat_weight",
      title: "Check infant car seat weight limit",
      body: "Most infant carriers top out at 30–35 lb. Compare against the sticker on the seat shell.",
      urgency: "heads_up",
      category: "car_seat",
    });
  }

  if (hasCategory(products, "bassinet") && months !== null && months >= 4) {
    out.push({
      id: "bassinet_transition",
      title: "Plan the crib transition",
      body: "Bassinets are typically outgrown by weight, length, or when your baby begins pushing up. Have the crib ready before that moment arrives.",
      urgency: months >= 5 ? "now" : "soon",
      category: "bassinet",
    });
  }

  const sleepSack = hasCategory(products, "sleep_sack");
  if (sleepSack) {
    const purchased = daysSince(sleepSack.purchased_at ?? null);
    if ((purchased !== null && purchased >= 90) || (weight !== null && weight >= 17.6)) {
      out.push({
        id: "sleep_sack_size_up",
        title: "Sleep sack likely needs sizing up",
        body: "Sleep sacks usually fit for ~3 months. Check the weight band on the tag — if you're near the top, order the next size.",
        urgency: "soon",
        category: "sleep_sack",
      });
    }
  }

  if (hasCategory(products, "swing") && months !== null && months >= 6) {
    out.push({
      id: "swing_outgrow",
      title: "Swings are typically not recommended once a baby can sit up",
      body: "Once a baby can sit up independently, many manufacturers no longer recommend swing use — this may be a good time to check the manufacturer's guidance and consider retiring it.",
      urgency: "now",
      category: "swing",
    });
  }
  if (hasCategory(products, "bouncer") && (months !== null && months >= 6 || (weight !== null && weight >= 20))) {
    out.push({
      id: "bouncer_outgrow",
      title: "Approaching bouncer weight limit",
      body: "Most bouncers max out around 20 lb or when baby can sit unassisted. Double-check the tag.",
      urgency: "soon",
      category: "bouncer",
    });
  }

  // Missing-gear suggestions
  if (months !== null && months >= 5 && months < 8 && !hasCategory(products, "high_chair")) {
    out.push({
      id: "highchair_suggest",
      title: "Time to think about a high chair",
      body: "When your baby begins showing readiness for solids, it's a good time to add your high chair and track it for recalls and replacement.",
      urgency: "soon",
      category: "high_chair",
    });
  }
  if (months !== null && months >= 7 && !hasCategory(products, "baby_gate")) {
    out.push({
      id: "gate_suggest",
      title: "Add baby gates to your list",
      body: "When your baby begins showing signs of increased mobility, baby gates become important. Hardware-mount at the top of stairs, pressure-mount is fine elsewhere.",
      urgency: "soon",
      category: "baby_gate",
    });
  }
  if (months !== null && months >= 4 && months <= 10 && !hasCategory(products, "activity_center")) {
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
