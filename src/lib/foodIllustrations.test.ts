import { describe, it, expect } from "vitest";
import { foodIllustrationFor } from "./foodIllustrations";

describe("foodIllustrationFor", () => {
  it.each([
    ["Waffles", "waffle"],
    ["Mini Pancakes", "pancakes"],
    ["Banana", "banana"],
    ["Avocado", "avocado"],
    ["Blueberry Puffs", "puffs"],
    ["Apple & Pear Pouch", "pouch"],
    ["Strawberry Yogurt Melts", "yogurt"],
    ["Organic Oatmeal Cereal", "oatmeal"],
    ["Scrambled eggs", "egg"],
    ["Sweet Potato Puree", "sweet_potato"],
    ["Green peas", "peas"],
    ["Broccoli florets", "broccoli"],
  ])("maps %s to %s", (name, key) => {
    expect(foodIllustrationFor(name)?.key).toBe(key);
  });

  it("returns null for foods without a drawing", () => {
    expect(foodIllustrationFor("Chicken & rice")).toBeNull();
    expect(foodIllustrationFor("Pineapple")).toBeNull();
    expect(foodIllustrationFor("")).toBeNull();
    expect(foodIllustrationFor(null)).toBeNull();
  });
});
