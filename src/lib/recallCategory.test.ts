import { describe, it, expect } from "vitest";
import {
  categoriesInText,
  normalizeRecallCategory,
  recallFitsCategory,
  type RecallCategoryKey,
} from "./recallCategory";
import * as edgeCopy from "../../supabase/functions/_shared/recallCategory";
import { CATEGORIES } from "./productCategories";

const ALL_KEYS = CATEGORIES.map((c) => c.key).filter((k): k is RecallCategoryKey => k !== "other");
const SOURCES = [
  "cpsc",
  "fda",
  "usda_fsis",
  "nhtsa",
  "health_canada",
  "eu_safety_gate",
  "critical",
];

describe("recallFitsCategory — reported bug: MAM pacifier matched a MAM'S muffin recall", () => {
  const muffin = "MAM'S Strawberry Creme Cake Muffin, 4 oz";

  it("an FDA food recall never applies to a pacifier, by key or by saved label", () => {
    for (const category of ["pacifier", "Pacifier"]) {
      expect(recallFitsCategory({ category, source: "fda", recallText: muffin })).toBe(false);
    }
  });

  it("food-only feeds (FDA, USDA) never apply to any gear category", () => {
    for (const category of ALL_KEYS) {
      if (["formula", "breast_milk", "baby_food", "vitamins"].includes(category)) continue;
      for (const source of ["fda", "usda_fsis"]) {
        expect({
          category,
          source,
          fits: recallFitsCategory({ category, source, recallText: muffin }),
        }).toEqual({ category, source, fits: false });
      }
    }
  });

  it("food-only feeds still apply to food, First Foods rows, and supplements", () => {
    for (const category of ["formula", "Breast Milk", "Baby food", "baby_food", "vitamins"]) {
      expect(recallFitsCategory({ category, source: "fda", recallText: muffin })).toBe(true);
    }
  });

  it("a CPSC recall for gear doesn't apply to a food product, but a CPSC baby food recall does", () => {
    expect(
      recallFitsCategory({ category: "formula", source: "cpsc", recallText: "Acme Recalls Toys" }),
    ).toBe(false);
    expect(
      recallFitsCategory({
        category: "baby_food",
        source: "cpsc",
        recallText: "Beech-Nut Recalls Oatmeal Baby Food Pouches",
      }),
    ).toBe(true);
  });
});

describe("recallFitsCategory — same agency, different kind of product", () => {
  it("a MAM bottle recall doesn't apply to a MAM pacifier", () => {
    expect(
      recallFitsCategory({
        category: "Pacifier",
        source: "cpsc",
        recallText: "MAM Recalls Baby Bottles Due to Choking Hazard",
      }),
    ).toBe(false);
  });

  it("a MAM pacifier recall applies to a MAM pacifier", () => {
    expect(
      recallFitsCategory({
        category: "Pacifier",
        source: "cpsc",
        recallText: "MAM Recalls Pacifiers Due to Choking Hazard",
      }),
    ).toBe(true);
  });

  it("every category accepts a recall that names its own category", () => {
    const sample: Record<RecallCategoryKey, string> = {
      car_seat: "Car Seats",
      crib: "Cribs",
      bassinet: "Bassinets",
      stroller: "Strollers",
      carrier: "Baby Carriers",
      high_chair: "High Chairs",
      swing: "Infant Swings",
      bouncer: "Bouncers",
      activity_center: "Activity Centers",
      sleep_sack: "Sleep Sacks",
      baby_gate: "Baby Gates",
      pacifier: "Pacifiers",
      formula: "Formula Pitchers",
      breast_milk: "Breast Milk Storage Bags",
      baby_food: "Baby Food Pouches",
      toothbrush: "Toothbrushes",
      baby_monitor: "Baby Monitors",
      play_yard: "Play Yards",
      toys: "Toys",
      bottle: "Baby Bottles",
      bath: "Bath Seats",
      diaper: "Diapers",
      teether: "Teethers",
      vitamins: "Vitamins",
    };
    for (const category of ALL_KEYS) {
      expect({
        category,
        fits: recallFitsCategory({
          category,
          source: "health_canada",
          recallText: `Acme Recalls ${sample[category]}`,
        }),
      }).toEqual({ category, fits: true });
    }
  });

  it("a recall covering several kinds of product still reaches each of them", () => {
    const text = "Acme Recalls Bassinets and Play Yards";
    expect(recallFitsCategory({ category: "bassinet", source: "cpsc", recallText: text })).toBe(
      true,
    );
    expect(recallFitsCategory({ category: "play_yard", source: "cpsc", recallText: text })).toBe(
      true,
    );
    expect(recallFitsCategory({ category: "crib", source: "cpsc", recallText: text })).toBe(true);
    expect(recallFitsCategory({ category: "stroller", source: "cpsc", recallText: text })).toBe(
      false,
    );
  });

  it("a recall that names no category isn't dropped (brand-only notices)", () => {
    expect(
      recallFitsCategory({ category: "pacifier", source: "cpsc", recallText: "MAM Recall" }),
    ).toBe(true);
  });

  it("no category or 'Other' filters nothing", () => {
    for (const category of [null, undefined, "", "other", "Other"]) {
      for (const source of SOURCES) {
        expect(recallFitsCategory({ category, source, recallText: "MAM'S Muffin" })).toBe(true);
      }
    }
  });
});

describe("normalizeRecallCategory", () => {
  it("accepts every category key and every display label the app saves", () => {
    for (const c of CATEGORIES) {
      const expected = c.key === "other" ? null : c.key;
      expect(normalizeRecallCategory(c.key)).toBe(expected);
      expect(normalizeRecallCategory(c.label)).toBe(expected);
    }
  });

  it("maps First Foods' 'Baby food' rows and older free text", () => {
    expect(normalizeRecallCategory("Baby food")).toBe("baby_food");
    expect(normalizeRecallCategory("Pacifiers & soothers")).toBe("pacifier");
    expect(normalizeRecallCategory("something else")).toBeNull();
  });

  it("'cot' is a whole word, not part of 'apricot'", () => {
    expect(categoriesInText("Apricot Puree").has("crib")).toBe(false);
    expect(categoriesInText("Travel Cot").has("crib")).toBe(true);
  });
});

describe("edge-function copy stays in sync", () => {
  const texts = [
    "MAM'S Strawberry Creme Cake Muffin",
    "MAM Recalls Baby Bottles",
    "Acme Recalls Bassinets and Play Yards",
    "Teething Pacifier",
    "CHILD SEAT car_seat",
    "Apricot Puree",
    "",
  ];

  it("gives the same answer for every category × source × text", () => {
    for (const category of [...CATEGORIES.map((c) => c.label), ...ALL_KEYS, null]) {
      for (const source of SOURCES) {
        for (const recallText of texts) {
          const input = { category, source, recallText };
          expect(edgeCopy.recallFitsCategory(input)).toBe(recallFitsCategory(input));
        }
      }
    }
  });
});
