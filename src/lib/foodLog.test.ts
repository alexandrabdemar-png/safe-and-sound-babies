import { describe, expect, it } from "vitest";
import {
  allergensTriedCount,
  firstTryIds,
  foodPeriod,
  groupByPeriod,
  isNewFood,
  recentDistinctFoods,
  uniqueFoodCount,
  weekStats,
} from "./foodLog";

const row = (id: string, food_name: string, date: string, brand: string | null = null) => ({
  id,
  food_name,
  brand,
  date_introduced: date,
  created_at: `${date}T12:00:00Z`,
});

const log = [
  row("4", "Tractor Wheels", "2026-11-02", "Once Upon a Farm"),
  row("3", "Banana", "2026-11-01"),
  row("2", "Tractor Wheels", "2026-10-30", "Once Upon a Farm"),
  row("1", "Peanut butter (Peanuts)", "2026-10-01"),
];

describe("food log", () => {
  it("marks only the first time each food was eaten as new", () => {
    expect([...firstTryIds(log)].sort()).toEqual(["1", "2", "3"]);
  });

  it("counts distinct foods, not log entries", () => {
    expect(uniqueFoodCount(log)).toBe(3);
  });

  it("treats the allergen-tagged and plain name as the same food", () => {
    expect(isNewFood(log, { food_name: "peanut butter" })).toBe(false);
    expect(isNewFood(log, { food_name: "Mango" })).toBe(true);
    // Editing the only entry for a food doesn't count itself.
    expect(isNewFood(log, { food_name: "Banana" }, "3")).toBe(true);
  });

  it("groups into Today / This week / Earlier", () => {
    expect(foodPeriod("2026-11-02", "2026-11-02")).toBe("today");
    expect(foodPeriod("2026-10-27", "2026-11-02")).toBe("week");
    expect(foodPeriod("2026-10-26", "2026-11-02")).toBe("earlier");
    expect(
      groupByPeriod(log, "2026-11-02").map((g) => [g.label, g.items.map((i) => i.id)]),
    ).toEqual([
      ["Today", ["4"]],
      ["This week", ["3", "2"]],
      ["Earlier", ["1"]],
    ]);
  });

  it("lists usual foods once each, most recent first", () => {
    expect(recentDistinctFoods(log).map((f) => f.id)).toEqual(["4", "3", "1"]);
  });

  it("week stats separate repeat logs from new foods", () => {
    expect(weekStats(log, "2026-11-02")).toEqual({ loggedThisWeek: 3, newThisWeek: 2 });
  });
});

describe("allergensTriedCount", () => {
  it("counts distinct tagged allergens only", () => {
    expect(
      allergensTriedCount([
        { food_name: "Peanut butter (Peanuts)" },
        { food_name: "Peanut puffs (Peanuts)" },
        { food_name: "Egg (Eggs)" },
        { food_name: "Sweet potato (mashed)" },
      ]),
    ).toBe(2);
  });
});
