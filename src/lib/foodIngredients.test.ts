import { describe, expect, it } from "vitest";
import { allergensFromTags, collectIngredients, parseIngredients } from "./foodIngredients";

describe("parseIngredients", () => {
  it("returns nothing for empty/missing text", () => {
    expect(parseIngredients("")).toEqual([]);
    expect(parseIngredients(null)).toEqual([]);
    expect(parseIngredients(undefined)).toEqual([]);
  });

  it("splits on top-level commas only, keeping sub-ingredients attached", () => {
    expect(parseIngredients("Oat flour, vitamin blend (b1, b2), water")).toEqual([
      "Oat flour",
      "Vitamin blend (b1, b2)",
      "Water",
    ]);
  });

  it("splits on semicolons too and drops a trailing period", () => {
    expect(parseIngredients("Apple; pear.")).toEqual(["Apple", "Pear"]);
  });

  it("downcases shouty label text before capitalizing", () => {
    expect(parseIngredients("WHOLE MILK, SUGAR")).toEqual(["Whole milk", "Sugar"]);
  });

  it("dedupes case-insensitively", () => {
    expect(parseIngredients("Water, WATER, water")).toEqual(["Water"]);
  });

  it("strips 'contains 2% or less of' preambles", () => {
    expect(parseIngredients("Rice, contains 2% or less of salt")).toEqual(["Rice", "Salt"]);
  });
});

describe("collectIngredients", () => {
  it("rolls up across foods, alphabetically, tracking which foods each came from", () => {
    const result = collectIngredients([
      { food_name: "Puffs", ingredients: "Rice flour, water" },
      { food_name: "Pouch", ingredients: "Water, apple" },
    ]);
    expect(result.map((r) => r.name)).toEqual(["Apple", "Rice flour", "Water"]);
    expect(result.find((r) => r.name === "Water")!.foods.sort()).toEqual(["Pouch", "Puffs"]);
  });

  it("ignores foods with no ingredient list", () => {
    expect(collectIngredients([{ food_name: "Banana" }])).toEqual([]);
  });
});

describe("allergensFromTags", () => {
  it("maps Open Food Facts language-prefixed tags to the app's top 9 names", () => {
    expect(allergensFromTags(["en:milk", "en:gluten", "en:soybeans"])).toEqual([
      "Milk",
      "Wheat",
      "Soy",
    ]);
  });

  it("collapses crustaceans and molluscs into Shellfish without duplicating", () => {
    expect(allergensFromTags(["en:crustaceans", "en:molluscs"])).toEqual(["Shellfish"]);
  });

  it("ignores unknown tags and empty input", () => {
    expect(allergensFromTags(["en:celery", "en:mustard"])).toEqual([]);
    expect(allergensFromTags(undefined)).toEqual([]);
  });
});
