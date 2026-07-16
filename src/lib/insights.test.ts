import { describe, it, expect } from "vitest";
import { evaluateInsights, ageInMonths, type ChildInput, type ProductInput } from "./insights";

function childAtMonths(months: number, overrides: Partial<ChildInput> = {}): ChildInput {
  const dob = new Date();
  dob.setMonth(dob.getMonth() - months);
  return {
    id: "c1",
    name: "Peyton",
    date_of_birth: dob.toISOString().slice(0, 10),
    measurements_updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function bassinet(): ProductInput {
  return { id: "p1", category: "Bassinet" };
}

function findInsight(insights: ReturnType<typeof evaluateInsights>, id: string) {
  return insights.find((i) => i.id === id);
}

describe("bassinet_transition age gate (live bug report: fired for a 10mo whose relevant window is 4-6mo)", () => {
  it("does NOT fire for a 10-month-old — this is the exact reported bug", () => {
    const insights = evaluateInsights(childAtMonths(10), [bassinet()]);
    expect(findInsight(insights, "bassinet_transition")).toBeUndefined();
  });

  it("does NOT fire for a 3-month-old (too early)", () => {
    const insights = evaluateInsights(childAtMonths(3), [bassinet()]);
    expect(findInsight(insights, "bassinet_transition")).toBeUndefined();
  });

  it("DOES fire for a 4-month-old (start of the relevant window)", () => {
    const insights = evaluateInsights(childAtMonths(4), [bassinet()]);
    expect(findInsight(insights, "bassinet_transition")).toBeDefined();
  });

  it("DOES fire for a 6-month-old (end of the relevant window)", () => {
    const insights = evaluateInsights(childAtMonths(6), [bassinet()]);
    expect(findInsight(insights, "bassinet_transition")).toBeDefined();
  });

  it("does NOT fire for a 7-month-old or older", () => {
    expect(findInsight(evaluateInsights(childAtMonths(7), [bassinet()]), "bassinet_transition")).toBeUndefined();
    expect(findInsight(evaluateInsights(childAtMonths(24), [bassinet()]), "bassinet_transition")).toBeUndefined();
  });

  it("never fires at all if the family has no bassinet logged, regardless of age", () => {
    expect(findInsight(evaluateInsights(childAtMonths(5), []), "bassinet_transition")).toBeUndefined();
  });
});

describe("infant car seat rules — bounded to the realistic infant-seat window", () => {
  const carSeat: ProductInput = { id: "p2", category: "Car Seat" };

  it("infant_carseat_outgrow does not fire for a 2-year-old still listing an infant seat", () => {
    const insights = evaluateInsights(childAtMonths(24), [carSeat]);
    expect(findInsight(insights, "infant_carseat_outgrow")).toBeUndefined();
  });

  it("infant_carseat_outgrow fires in the realistic 9-17 month window", () => {
    expect(findInsight(evaluateInsights(childAtMonths(10), [carSeat]), "infant_carseat_outgrow")).toBeDefined();
  });

  it("infant_carseat_weight does not fire for a 2-year-old", () => {
    const insights = evaluateInsights(childAtMonths(24), [carSeat]);
    expect(findInsight(insights, "infant_carseat_weight")).toBeUndefined();
  });

  it("infant_carseat_weight fires in the realistic 12-17 month window", () => {
    expect(findInsight(evaluateInsights(childAtMonths(13), [carSeat]), "infant_carseat_weight")).toBeDefined();
  });
});

describe("swing/bouncer rules — bounded to the sitting-stage window", () => {
  it("swing_outgrow does not fire for a 2-year-old", () => {
    const insights = evaluateInsights(childAtMonths(24), [{ id: "p3", category: "Swing" }]);
    expect(findInsight(insights, "swing_outgrow")).toBeUndefined();
  });

  it("swing_outgrow fires for a realistic 6-14 month old", () => {
    const insights = evaluateInsights(childAtMonths(8), [{ id: "p3", category: "Swing" }]);
    expect(findInsight(insights, "swing_outgrow")).toBeDefined();
  });

  it("bouncer_outgrow does not fire for a 2-year-old even if weight is high", () => {
    const insights = evaluateInsights(childAtMonths(24, {}), [{ id: "p4", category: "Bouncer" }]);
    expect(findInsight(insights, "bouncer_outgrow")).toBeUndefined();
  });

  it("bouncer_outgrow fires for a realistic 6-14 month old", () => {
    const insights = evaluateInsights(childAtMonths(8), [{ id: "p4", category: "Bouncer" }]);
    expect(findInsight(insights, "bouncer_outgrow")).toBeDefined();
  });
});

describe("ageInMonths", () => {
  it("returns null for a null/undefined date of birth", () => {
    expect(ageInMonths(null)).toBeNull();
    expect(ageInMonths(undefined)).toBeNull();
  });

  it("returns null for a malformed date instead of throwing", () => {
    expect(() => ageInMonths("garbage")).not.toThrow();
    expect(ageInMonths("garbage")).toBeNull();
  });
});

describe("evaluateInsights — general regression guards", () => {
  it("returns an empty list for a null child instead of throwing", () => {
    expect(evaluateInsights(null, [])).toEqual([]);
  });

  it("still sorts by urgency (now, then soon, then heads_up)", () => {
    const insights = evaluateInsights(childAtMonths(10), [bassinet(), { id: "p5", category: "Car Seat" }]);
    const order: Record<string, number> = { now: 0, soon: 1, heads_up: 2 };
    for (let i = 1; i < insights.length; i++) {
      expect(order[insights[i - 1].urgency]).toBeLessThanOrEqual(order[insights[i].urgency]);
    }
  });
});

// ── Stair-gate insights are filtered by home_profile.has_stairs (regression:
//    a user with has_stairs=false was still shown "install safety gates").
describe("stair-gate insights respect home_profile.has_stairs", () => {
  const babyGate: ProductInput = { id: "p1", category: "baby_gate" };

  it("shows install_baby_gates + gate_suggest for a 9mo when has_stairs is TRUE", () => {
    const insights = evaluateInsights(childAtMonths(9), [], { has_stairs: true });
    expect(findInsight(insights, "install_baby_gates")).toBeDefined();
    expect(findInsight(insights, "gate_suggest")).toBeDefined();
  });

  it("HIDES install_baby_gates when has_stairs is FALSE (the reported bug)", () => {
    const insights = evaluateInsights(childAtMonths(9), [], { has_stairs: false });
    expect(findInsight(insights, "install_baby_gates")).toBeUndefined();
  });

  it("HIDES gate_suggest when has_stairs is FALSE", () => {
    const insights = evaluateInsights(childAtMonths(9), [], { has_stairs: false });
    expect(findInsight(insights, "gate_suggest")).toBeUndefined();
  });

  it("still shows install_baby_gates when the profile hasn't been filled in yet (undefined)", () => {
    // Default to showing — better to nudge than to silently hide safety guidance
    // for a user who hasn't taken the quiz.
    const insights = evaluateInsights(childAtMonths(9), []);
    expect(findInsight(insights, "install_baby_gates")).toBeDefined();
  });

  it("does NOT show install_baby_gates for a 3mo regardless of has_stairs", () => {
    const insights = evaluateInsights(childAtMonths(3), [], { has_stairs: true });
    expect(findInsight(insights, "install_baby_gates")).toBeUndefined();
  });

  it("hides gate_suggest when the user already owns a baby gate (independent of stairs)", () => {
    const insights = evaluateInsights(childAtMonths(9), [babyGate], { has_stairs: true });
    expect(findInsight(insights, "gate_suggest")).toBeUndefined();
  });

  it("adversarial: has_stairs=null (never answered) is treated as unknown → still shows guidance", () => {
    const insights = evaluateInsights(childAtMonths(9), [], { has_stairs: null });
    expect(findInsight(insights, "install_baby_gates")).toBeDefined();
  });
});

// ── Live bug report: an 11-year-old (132mo) test profile still showed
//    "Begin thinking about babyproofing" / "Consider installing safety
//    gates near stairs" / "Consider securing lower cabinets" in the "Up
//    next" card. Root cause: babyproof_start, install_baby_gates,
//    babyproof_low_cabinets, crib_mattress_lowest, and gate_suggest were
//    all bare `months >= X` checks with no upper bound, so they matched
//    any older age too, not just their intended mobility-onset window.
describe("mobility/babyproofing insights are capped to their relevant age window (live bug: fired for an 11-year-old)", () => {
  const elevenYearsOld = 11 * 12; // 132 months

  it("regression: NONE of the mobility/babyproofing insights fire for an 11-year-old", () => {
    const insights = evaluateInsights(childAtMonths(elevenYearsOld), [], { has_stairs: true });
    expect(findInsight(insights, "babyproof_start")).toBeUndefined();
    expect(findInsight(insights, "install_baby_gates")).toBeUndefined();
    expect(findInsight(insights, "babyproof_low_cabinets")).toBeUndefined();
    expect(findInsight(insights, "crib_mattress_lowest")).toBeUndefined();
    expect(findInsight(insights, "crib_mattress_middle")).toBeUndefined();
    expect(findInsight(insights, "gate_suggest")).toBeUndefined();
    expect(findInsight(insights, "rear_facing_reminder")).toBeUndefined();
  });

  it("regression: an 11-year-old gets NO insights at all (nothing in this engine is relevant past early childhood)", () => {
    const insights = evaluateInsights(childAtMonths(elevenYearsOld), [], { has_stairs: true });
    expect(insights).toEqual([]);
  });

  it("babyproof_start still fires within its intended 4-23mo window, but not at 24mo+", () => {
    expect(findInsight(evaluateInsights(childAtMonths(4), []), "babyproof_start")).toBeDefined();
    expect(findInsight(evaluateInsights(childAtMonths(23), []), "babyproof_start")).toBeDefined();
    expect(findInsight(evaluateInsights(childAtMonths(24), []), "babyproof_start")).toBeUndefined();
    expect(findInsight(evaluateInsights(childAtMonths(36), []), "babyproof_start")).toBeUndefined();
  });

  it("babyproof_low_cabinets still fires within its intended 9-23mo window, but not at 24mo+", () => {
    expect(findInsight(evaluateInsights(childAtMonths(9), []), "babyproof_low_cabinets")).toBeDefined();
    expect(findInsight(evaluateInsights(childAtMonths(23), []), "babyproof_low_cabinets")).toBeDefined();
    expect(findInsight(evaluateInsights(childAtMonths(24), []), "babyproof_low_cabinets")).toBeUndefined();
    expect(findInsight(evaluateInsights(childAtMonths(48), []), "babyproof_low_cabinets")).toBeUndefined();
  });

  it("install_baby_gates still fires within its intended 7-35mo window, but not at 36mo+", () => {
    expect(
      findInsight(evaluateInsights(childAtMonths(7), [], { has_stairs: true }), "install_baby_gates"),
    ).toBeDefined();
    expect(
      findInsight(evaluateInsights(childAtMonths(35), [], { has_stairs: true }), "install_baby_gates"),
    ).toBeDefined();
    expect(
      findInsight(evaluateInsights(childAtMonths(36), [], { has_stairs: true }), "install_baby_gates"),
    ).toBeUndefined();
    expect(
      findInsight(evaluateInsights(childAtMonths(60), [], { has_stairs: true }), "install_baby_gates"),
    ).toBeUndefined();
  });

  it("gate_suggest still fires within its intended 7-35mo window, but not at 36mo+", () => {
    expect(findInsight(evaluateInsights(childAtMonths(7), [], { has_stairs: true }), "gate_suggest")).toBeDefined();
    expect(findInsight(evaluateInsights(childAtMonths(35), [], { has_stairs: true }), "gate_suggest")).toBeDefined();
    expect(findInsight(evaluateInsights(childAtMonths(36), [], { has_stairs: true }), "gate_suggest")).toBeUndefined();
  });

  it("crib_mattress_lowest still fires within its intended 12-35mo window, but not at 36mo+", () => {
    expect(findInsight(evaluateInsights(childAtMonths(12), []), "crib_mattress_lowest")).toBeDefined();
    expect(findInsight(evaluateInsights(childAtMonths(35), []), "crib_mattress_lowest")).toBeDefined();
    expect(findInsight(evaluateInsights(childAtMonths(36), []), "crib_mattress_lowest")).toBeUndefined();
    expect(findInsight(evaluateInsights(childAtMonths(elevenYearsOld), []), "crib_mattress_lowest")).toBeUndefined();
  });
});
