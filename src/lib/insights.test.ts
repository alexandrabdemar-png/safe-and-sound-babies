import { describe, it, expect } from "vitest";
import { evaluateInsights, type ChildInput, type ProductInput } from "./insights";
import type { MilestoneKey } from "./milestoneKeys";

function child(overrides: Partial<ChildInput> = {}): ChildInput {
  return { id: "c1", name: "Peyton", ...overrides };
}

function milestones(...keys: MilestoneKey[]): Set<MilestoneKey> {
  return new Set(keys);
}

function bassinet(): ProductInput {
  return { id: "p1", category: "Bassinet" };
}

function crib(): ProductInput {
  return { id: "p3", category: "Crib" };
}

function findInsight(insights: ReturnType<typeof evaluateInsights>, id: string) {
  return insights.find((i) => i.id === id);
}

describe("evaluateInsights — general regression guards", () => {
  it("returns an empty list for a null child instead of throwing", () => {
    expect(evaluateInsights(null, [], milestones())).toEqual([]);
  });

  it("returns no insights when nothing has been logged", () => {
    expect(evaluateInsights(child(), [], milestones())).toEqual([]);
  });

  it("still sorts by urgency (now, then soon, then heads_up)", () => {
    const insights = evaluateInsights(
      child(),
      [bassinet(), { id: "p5", category: "Car Seat" }],
      milestones("rolling", "pulling_to_stand"),
    );
    const order: Record<string, number> = { now: 0, soon: 1, heads_up: 2 };
    for (let i = 1; i < insights.length; i++) {
      expect(order[insights[i - 1].urgency]).toBeLessThanOrEqual(order[insights[i].urgency]);
    }
  });
});

describe("bassinet_transition is triggered by the 'rolling' milestone, not age", () => {
  it("does NOT fire with no milestones logged, even with a bassinet", () => {
    expect(
      findInsight(evaluateInsights(child(), [bassinet()], milestones()), "bassinet_transition"),
    ).toBeUndefined();
  });

  it("fires once 'rolling' is logged and a bassinet is owned", () => {
    expect(
      findInsight(
        evaluateInsights(child(), [bassinet()], milestones("rolling")),
        "bassinet_transition",
      ),
    ).toBeDefined();
  });

  it("never fires without a bassinet logged, regardless of milestones", () => {
    expect(
      findInsight(evaluateInsights(child(), [], milestones("rolling")), "bassinet_transition"),
    ).toBeUndefined();
  });

  it("stops firing once 'crawling' is logged (superseded — the transition should already have happened)", () => {
    expect(
      findInsight(
        evaluateInsights(child(), [bassinet()], milestones("rolling", "crawling")),
        "bassinet_transition",
      ),
    ).toBeUndefined();
  });
});

describe("car seat rules are triggered by mobility milestones, not age, and state facts rather than predict", () => {
  const carSeat: ProductInput = { id: "p2", category: "Car Seat" };

  it("infant_carseat_check does not fire before 'pulling_to_stand' is logged", () => {
    expect(
      findInsight(
        evaluateInsights(child(), [carSeat], milestones("rolling")),
        "infant_carseat_check",
      ),
    ).toBeUndefined();
  });

  it("infant_carseat_check fires once 'pulling_to_stand' is logged", () => {
    expect(
      findInsight(
        evaluateInsights(child(), [carSeat], milestones("pulling_to_stand")),
        "infant_carseat_check",
      ),
    ).toBeDefined();
  });

  it("infant_carseat_check never fires without a car seat logged", () => {
    expect(
      findInsight(
        evaluateInsights(child(), [], milestones("pulling_to_stand")),
        "infant_carseat_check",
      ),
    ).toBeUndefined();
  });

  it("rear_facing_reminder fires once 'first_steps' is logged, replacing infant_carseat_check", () => {
    const insights = evaluateInsights(
      child(),
      [carSeat],
      milestones("pulling_to_stand", "first_steps"),
    );
    expect(findInsight(insights, "rear_facing_reminder")).toBeDefined();
    expect(findInsight(insights, "infant_carseat_check")).toBeUndefined();
  });
});

describe("swing/bouncer rules are triggered by the 'sitting' milestone", () => {
  it("swing_outgrow does not fire with no milestones logged", () => {
    expect(
      findInsight(
        evaluateInsights(child(), [{ id: "p3", category: "Swing" }], milestones()),
        "swing_outgrow",
      ),
    ).toBeUndefined();
  });

  it("swing_outgrow fires once 'sitting' is logged", () => {
    expect(
      findInsight(
        evaluateInsights(child(), [{ id: "p3", category: "Swing" }], milestones("sitting")),
        "swing_outgrow",
      ),
    ).toBeDefined();
  });

  it("bouncer_outgrow fires once 'sitting' is logged", () => {
    expect(
      findInsight(
        evaluateInsights(child(), [{ id: "p4", category: "Bouncer" }], milestones("sitting")),
        "bouncer_outgrow",
      ),
    ).toBeDefined();
  });

  it("bouncer_outgrow does not fire with no milestones logged even if a bouncer is owned", () => {
    expect(
      findInsight(
        evaluateInsights(child(), [{ id: "p4", category: "Bouncer" }], milestones()),
        "bouncer_outgrow",
      ),
    ).toBeUndefined();
  });
});

describe("sleep_sack_size_up is purely product-purchase-date driven (no child data)", () => {
  it("does not fire for a recently purchased sleep sack", () => {
    const sleepSack: ProductInput = {
      id: "p6",
      category: "Sleep Sack",
      purchased_at: new Date().toISOString(),
    };
    expect(
      findInsight(evaluateInsights(child(), [sleepSack], milestones()), "sleep_sack_size_up"),
    ).toBeUndefined();
  });

  it("fires once the sleep sack was purchased 90+ days ago", () => {
    const old = new Date(Date.now() - 100 * 86_400_000).toISOString();
    const sleepSack: ProductInput = { id: "p6", category: "Sleep Sack", purchased_at: old };
    expect(
      findInsight(evaluateInsights(child(), [sleepSack], milestones()), "sleep_sack_size_up"),
    ).toBeDefined();
  });
});

describe("stair-gate insights respect home_profile.has_stairs", () => {
  const babyGate: ProductInput = { id: "p1", category: "baby_gate" };

  it("shows install_baby_gates + gate_suggest once 'crawling' is logged when has_stairs is TRUE", () => {
    const insights = evaluateInsights(child(), [], milestones("crawling"), { has_stairs: true });
    expect(findInsight(insights, "install_baby_gates")).toBeDefined();
    expect(findInsight(insights, "gate_suggest")).toBeDefined();
  });

  it("HIDES install_baby_gates when has_stairs is FALSE", () => {
    const insights = evaluateInsights(child(), [], milestones("crawling"), { has_stairs: false });
    expect(findInsight(insights, "install_baby_gates")).toBeUndefined();
  });

  it("HIDES gate_suggest when has_stairs is FALSE", () => {
    const insights = evaluateInsights(child(), [], milestones("crawling"), { has_stairs: false });
    expect(findInsight(insights, "gate_suggest")).toBeUndefined();
  });

  it("still shows install_baby_gates when the profile hasn't been filled in yet (undefined)", () => {
    const insights = evaluateInsights(child(), [], milestones("crawling"));
    expect(findInsight(insights, "install_baby_gates")).toBeDefined();
  });

  it("does NOT show install_baby_gates before 'crawling' is logged, regardless of has_stairs", () => {
    const insights = evaluateInsights(child(), [], milestones("rolling"), { has_stairs: true });
    expect(findInsight(insights, "install_baby_gates")).toBeUndefined();
  });

  it("hides gate_suggest when the user already owns a baby gate (independent of stairs)", () => {
    const insights = evaluateInsights(child(), [babyGate], milestones("crawling"), {
      has_stairs: true,
    });
    expect(findInsight(insights, "gate_suggest")).toBeUndefined();
  });

  it("adversarial: has_stairs=null (never answered) is treated as unknown → still shows guidance", () => {
    const insights = evaluateInsights(child(), [], milestones("crawling"), { has_stairs: null });
    expect(findInsight(insights, "install_baby_gates")).toBeDefined();
  });
});

describe("crib mattress rules require an actual crib to be logged", () => {
  it("crib_mattress_middle never fires without a crib logged, even once 'rolling' is logged", () => {
    expect(
      findInsight(evaluateInsights(child(), [], milestones("rolling")), "crib_mattress_middle"),
    ).toBeUndefined();
  });

  it("crib_mattress_middle fires once 'rolling' is logged and a crib is owned", () => {
    expect(
      findInsight(
        evaluateInsights(child(), [crib()], milestones("rolling")),
        "crib_mattress_middle",
      ),
    ).toBeDefined();
  });

  it("crib_mattress_lowest never fires without a crib logged", () => {
    expect(
      findInsight(
        evaluateInsights(child(), [], milestones("pulling_to_stand")),
        "crib_mattress_lowest",
      ),
    ).toBeUndefined();
  });

  it("crib_mattress_lowest fires once 'pulling_to_stand' is logged and a crib is owned", () => {
    expect(
      findInsight(
        evaluateInsights(child(), [crib()], milestones("pulling_to_stand")),
        "crib_mattress_lowest",
      ),
    ).toBeDefined();
  });

  it("crib_mattress_lowest supersedes crib_mattress_middle once the later milestone is reached", () => {
    const insights = evaluateInsights(child(), [crib()], milestones("rolling", "pulling_to_stand"));
    expect(findInsight(insights, "crib_mattress_lowest")).toBeDefined();
    expect(findInsight(insights, "crib_mattress_middle")).toBeUndefined();
  });

  it("logging an unrelated product (e.g. a stroller) does not satisfy the crib gate", () => {
    const stroller: ProductInput = { id: "p4", category: "Stroller" };
    expect(
      findInsight(
        evaluateInsights(child(), [stroller], milestones("pulling_to_stand")),
        "crib_mattress_lowest",
      ),
    ).toBeUndefined();
  });
});

describe("babyproofing insights are gated on logged milestones, not age", () => {
  it("babyproof_start fires once 'rolling' is logged and stops once 'crawling' is logged", () => {
    expect(
      findInsight(evaluateInsights(child(), [], milestones("rolling")), "babyproof_start"),
    ).toBeDefined();
    expect(
      findInsight(
        evaluateInsights(child(), [], milestones("rolling", "crawling")),
        "babyproof_start",
      ),
    ).toBeUndefined();
  });

  it("babyproof_low_cabinets fires once 'crawling' is logged", () => {
    expect(
      findInsight(evaluateInsights(child(), [], milestones("crawling")), "babyproof_low_cabinets"),
    ).toBeDefined();
    expect(
      findInsight(evaluateInsights(child(), [], milestones("rolling")), "babyproof_low_cabinets"),
    ).toBeUndefined();
  });

  it("activity_center_suggest fires between 'rolling' and 'crawling' when no activity center is owned", () => {
    expect(
      findInsight(evaluateInsights(child(), [], milestones("rolling")), "activity_center_suggest"),
    ).toBeDefined();
    expect(
      findInsight(
        evaluateInsights(child(), [], milestones("rolling", "crawling")),
        "activity_center_suggest",
      ),
    ).toBeUndefined();
  });

  it("highchair_suggest fires once 'sitting' or 'first_food' is logged when no high chair is owned", () => {
    expect(
      findInsight(evaluateInsights(child(), [], milestones("sitting")), "highchair_suggest"),
    ).toBeDefined();
    expect(
      findInsight(evaluateInsights(child(), [], milestones("first_food")), "highchair_suggest"),
    ).toBeDefined();
    expect(
      findInsight(evaluateInsights(child(), [], milestones()), "highchair_suggest"),
    ).toBeUndefined();
  });
});
