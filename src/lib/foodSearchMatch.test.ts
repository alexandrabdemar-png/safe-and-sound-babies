import { describe, expect, it } from "vitest";
import {
  COMMON_BABY_FOOD_BRANDS,
  fallbackQueries,
  matchScore,
  rankFoodHits,
  splitBrandFromQuery,
} from "./foodSearchMatch";

const tractor = { barcode: "1", name: "Tractor Wheels Oat Bites", brand: "Once Upon a Farm" };
const pouch = { barcode: "2", name: "Wild Rumpus Avocado", brand: "Once Upon a Farm" };

describe("rankFoodHits", () => {
  it("puts the product matching the full typed name first, not just the brand", () => {
    const ranked = rankFoodHits("once upon a farm tractor wheel", [pouch, tractor]);
    expect(ranked[0]).toBe(tractor);
  });

  it("tolerates a one-letter typo (trator → tractor)", () => {
    expect(matchScore("once upon a farm trator wheel", tractor)).toBe(1);
    expect(rankFoodHits("once upon a farm trator wheel", [pouch, tractor])[0]).toBe(tractor);
  });

  it("drops duplicates from the two databases", () => {
    expect(rankFoodHits("tractor", [tractor, { ...tractor }])).toHaveLength(1);
  });
});

describe("fallbackQueries", () => {
  it("shortens a long query from the end, keeping at least two words", () => {
    expect(fallbackQueries("once upon a farm tractor wheel")).toEqual([
      "once upon a farm tractor",
      "once upon a farm",
    ]);
    expect(fallbackQueries("happy baby")).toEqual([]);
  });
});

describe("splitBrandFromQuery", () => {
  it("splits a known brand off the front of the full typed name", () => {
    expect(splitBrandFromQuery("Once Upon a Farm Tractor Wheels", ["Once Upon a Farm"])).toEqual({
      brand: "Once Upon a Farm",
      name: "Tractor Wheels",
    });
  });

  it("is case/punctuation-insensitive and keeps the parent's wording", () => {
    expect(splitBrandFromQuery("earths best Sweet Potato", ["Earth's Best"])).toEqual({
      brand: "Earth's Best",
      name: "Sweet Potato",
    });
    expect(splitBrandFromQuery("Earth's Best Sweet Potato", ["Earth's Best"])).toEqual({
      brand: "Earth's Best",
      name: "Sweet Potato",
    });
  });

  it("keeps the whole text as the name when no brand matches", () => {
    expect(splitBrandFromQuery("homemade banana muffin", ["Gerber"])).toEqual({
      brand: null,
      name: "homemade banana muffin",
    });
  });

  it("doesn't split when the text is only the brand", () => {
    expect(splitBrandFromQuery("Gerber", ["Gerber"])).toEqual({ brand: null, name: "Gerber" });
  });
});

describe("COMMON_BABY_FOOD_BRANDS", () => {
  it("splits a typed brand + product even with no search results or prior log", () => {
    expect(
      splitBrandFromQuery("once upon a farm tractor wheel", [...COMMON_BABY_FOOD_BRANDS]),
    ).toEqual({ brand: "Once Upon a Farm", name: "tractor wheel" });
    expect(
      splitBrandFromQuery("Gerber Organic Banana Puffs", [...COMMON_BABY_FOOD_BRANDS]),
    ).toEqual({ brand: "Gerber Organic", name: "Banana Puffs" });
    expect(splitBrandFromQuery("Beech Nut oatmeal", [...COMMON_BABY_FOOD_BRANDS])).toEqual({
      brand: "Beech-Nut",
      name: "oatmeal",
    });
  });
});
