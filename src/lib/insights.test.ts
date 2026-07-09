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
