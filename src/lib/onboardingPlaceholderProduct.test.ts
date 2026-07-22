import { describe, it, expect } from "vitest";
import {
  isOnboardingPlaceholderProduct,
  type PlaceholderCheckFields,
} from "./onboardingPlaceholderProduct";

// Mirrors the exact 9 (name, category) pairs the real cleanup migration
// targets — see supabase/migrations/20260717000000_
// category_watchlist_fix_onboarding_products.sql.
const BUG_PAIRS: [string, string][] = [
  ["Car seats", "car_seat"],
  ["Cribs", "crib"],
  ["Bassinets", "bassinet"],
  ["Strollers", "stroller"],
  ["High chairs", "high_chair"],
  ["Bouncers", "bouncer"],
  ["Activity centers", "activity_center"],
  ["Sleep sacks", "sleep_sack"],
  ["Baby gates", "baby_gate"],
];

function bare(name: string, category: string): PlaceholderCheckFields {
  return {
    name,
    category,
    brand: null,
    model: null,
    size: null,
    barcode: null,
    notes: null,
    purchased_at: null,
  };
}

describe("isOnboardingPlaceholderProduct", () => {
  it("flags every one of the 9 real bug (name, category) pairs when every descriptive field is empty", () => {
    for (const [name, category] of BUG_PAIRS) {
      expect(isOnboardingPlaceholderProduct(bare(name, category))).toBe(true);
    }
  });

  it("does NOT flag a real product that coincidentally shares the name and category, once a brand is filled in", () => {
    const decoy = { ...bare("Car seats", "car_seat"), brand: "Nuna" };
    expect(isOnboardingPlaceholderProduct(decoy)).toBe(false);
  });

  it("does NOT flag a real product once a model is filled in", () => {
    expect(isOnboardingPlaceholderProduct({ ...bare("Cribs", "crib"), model: "4-in-1" })).toBe(
      false,
    );
  });

  it("does NOT flag a real product once a size is filled in", () => {
    expect(
      isOnboardingPlaceholderProduct({ ...bare("Strollers", "stroller"), size: "Standard" }),
    ).toBe(false);
  });

  it("does NOT flag a real product once a barcode is filled in", () => {
    expect(
      isOnboardingPlaceholderProduct({ ...bare("Bouncers", "bouncer"), barcode: "012345678905" }),
    ).toBe(false);
  });

  it("does NOT flag a real product once notes are filled in", () => {
    expect(
      isOnboardingPlaceholderProduct({
        ...bare("Baby gates", "baby_gate"),
        notes: "Hand-me-down from Grandma",
      }),
    ).toBe(false);
  });

  it("does NOT flag a real product once a purchase date is filled in", () => {
    expect(
      isOnboardingPlaceholderProduct({
        ...bare("Sleep sacks", "sleep_sack"),
        purchased_at: "2026-01-01",
      }),
    ).toBe(false);
  });

  it("does NOT flag a row with the bug name but a different category (matches on the exact pair, not name alone)", () => {
    expect(isOnboardingPlaceholderProduct(bare("High chairs", "other"))).toBe(false);
  });

  it("does NOT flag a genuinely different product name/category combo", () => {
    expect(isOnboardingPlaceholderProduct(bare("Nuna Pipa Lite", "car_seat"))).toBe(false);
  });

  it("does NOT flag a bare row with a category not in the bug list (e.g. formula, pacifier)", () => {
    expect(isOnboardingPlaceholderProduct(bare("Formula", "formula"))).toBe(false);
  });

  it("handles a null category without throwing", () => {
    expect(isOnboardingPlaceholderProduct(bare("Car seats", null as unknown as string))).toBe(
      false,
    );
  });
});
