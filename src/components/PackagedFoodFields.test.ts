import { describe, expect, it } from "vitest";
import { matchBrands } from "./PackagedFoodFields";

const brands = [
  "Happy Baby",
  "Happy Tot",
  "Once Upon a Farm",
  "Gerber",
  "Gerber Organic",
  "Earth's Best",
];

describe("matchBrands (Brand box suggestions as you type)", () => {
  it("suggests from the first letters typed", () => {
    expect(matchBrands("hap", brands)).toEqual(["Happy Tot", "Happy Baby"]);
    expect(matchBrands("once", brands)).toEqual(["Once Upon a Farm"]);
  });
  it("matches word starts anywhere and ignores apostrophes/case", () => {
    expect(matchBrands("farm", brands)).toEqual(["Once Upon a Farm"]);
    expect(matchBrands("earths", brands)).toEqual(["Earth's Best"]);
  });
  it("puts the shorter exact-start brand first", () => {
    expect(matchBrands("gerb", brands)).toEqual(["Gerber", "Gerber Organic"]);
  });
  it("returns nothing for empty input", () => {
    expect(matchBrands("  ", brands)).toEqual([]);
  });
});
