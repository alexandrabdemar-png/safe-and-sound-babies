import { describe, expect, it, beforeEach } from "vitest";
import {
  parseFoodName,
  computeAllergenProgress,
  TOP_ALLERGENS,
  isFourDayReminderDismissed,
  dismissFourDayReminderForever,
} from "./first-foods";

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

describe("computeAllergenProgress", () => {
  it("returns all 9 as remaining and none introduced when no foods are logged", () => {
    const result = computeAllergenProgress([]);
    expect(result.introduced).toEqual([]);
    expect(result.remaining).toEqual([...TOP_ALLERGENS]);
  });

  it("moves an allergen from remaining to introduced once a tagged food is logged", () => {
    const result = computeAllergenProgress([{ food_name: "Peanut butter (Peanuts)" }]);
    expect(result.introduced).toEqual(["Peanuts"]);
    expect(result.remaining).not.toContain("Peanuts");
    expect(result.remaining.length).toBe(TOP_ALLERGENS.length - 1);
  });

  it("does not count a food whose name merely mentions an allergen word without the tagged suffix", () => {
    // "Peanut butter sandwich" was never tagged as an allergen at save
    // time (no " (Peanuts)" suffix) — it must not count as "introduced",
    // the same discipline parseFoodName already enforces for editing.
    const result = computeAllergenProgress([{ food_name: "Peanut butter sandwich" }]);
    expect(result.introduced).toEqual([]);
  });

  it("dedupes multiple logged foods tagged with the same allergen", () => {
    const result = computeAllergenProgress([
      { food_name: "Scrambled egg (Eggs)" },
      { food_name: "Egg noodle (Eggs)" },
    ]);
    expect(result.introduced).toEqual(["Eggs"]);
  });

  it("returns every allergen as introduced, and none remaining, once all 9 are logged", () => {
    const foods = TOP_ALLERGENS.map((a) => ({ food_name: `Test food (${a})` }));
    const result = computeAllergenProgress(foods);
    expect(result.introduced).toEqual([...TOP_ALLERGENS]);
    expect(result.remaining).toEqual([]);
  });

  it("preserves TOP_ALLERGENS order in both lists, not insertion order", () => {
    const result = computeAllergenProgress([
      { food_name: "x (Sesame)" },
      { food_name: "y (Milk)" },
    ]);
    // Milk comes before Sesame in TOP_ALLERGENS, even though Sesame was
    // logged first here — the UI should read in a stable, predictable
    // order rather than shuffling based on when each was logged.
    expect(result.introduced).toEqual(["Milk", "Sesame"]);
  });
});

// "Don't remind me again" on the 4-day wait reminder — reported request: once
// a user picks this, the reminder must never pop up again for them, on this
// device. Persisted in localStorage (client-only preference, no server round
// trip needed) under a dedicated key checked before the reminder is shown.
// This project's vitest config runs in plain Node (no DOM/localStorage
// global — see whatsNew.test.ts), so a minimal in-memory stand-in is
// installed as the global for these tests only.
function makeFakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

describe("4-day reminder dismissal", () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = makeFakeLocalStorage();
  });

  it("is not dismissed by default", () => {
    expect(isFourDayReminderDismissed()).toBe(false);
  });

  it("stays dismissed after dismissFourDayReminderForever() is called", () => {
    dismissFourDayReminderForever();
    expect(isFourDayReminderDismissed()).toBe(true);
  });

  it("does not affect other localStorage keys", () => {
    localStorage.setItem("safesound.activeChildId", "abc123");
    dismissFourDayReminderForever();
    expect(localStorage.getItem("safesound.activeChildId")).toBe("abc123");
  });
});
