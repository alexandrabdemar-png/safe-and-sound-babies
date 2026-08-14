import { describe, expect, it } from "vitest";
import { parseFoodName } from "./first-foods";

// Regression: editing an existing first_foods entry re-runs the same
// "{name} ({Allergen})" suffix logic handleSave() uses when adding — this
// covers the reverse direction, which openEdit() relies on so re-saving an
// edited entry doesn't double up the suffix (e.g. "Peanut butter (Peanuts)
// (Peanuts)").
describe("parseFoodName", () => {
  it("splits a recognized allergen suffix off the base name", () => {
    expect(parseFoodName("Peanut butter (Peanuts)")).toEqual({
      base: "Peanut butter",
      allergen: "Peanuts",
    });
  });

  it("leaves a plain name (no allergen tagged) untouched", () => {
    expect(parseFoodName("Sweet potato purée")).toEqual({
      base: "Sweet potato purée",
      allergen: "",
    });
  });

  it("doesn't false-positive on parenthetical text that isn't one of the top 9 allergens", () => {
    expect(parseFoodName("Sweet potato (mashed)")).toEqual({
      base: "Sweet potato (mashed)",
      allergen: "",
    });
  });

  it("recognizes every top-9 allergen suffix", () => {
    const allergens = [
      "Milk",
      "Eggs",
      "Fish",
      "Shellfish",
      "Tree nuts",
      "Peanuts",
      "Wheat",
      "Soy",
      "Sesame",
    ] as const;
    for (const a of allergens) {
      expect(parseFoodName(`Test food (${a})`)).toEqual({ base: "Test food", allergen: a });
    }
  });

  it("round-trips: base + ' (' + allergen + ')' reconstructs the original", () => {
    const cases = ["Peanut butter (Peanuts)", "Scrambled egg (Eggs)", "Yogurt (Milk)"];
    for (const original of cases) {
      const { base, allergen } = parseFoodName(original);
      expect(`${base} (${allergen})`).toBe(original);
    }
  });
});
