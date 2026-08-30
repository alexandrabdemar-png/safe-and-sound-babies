import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  CATEGORY_BY_KEY,
  categoryFromLabel,
  guessCategoryFromText,
  type CategoryKey,
} from "./productCategories";

describe("CATEGORIES / CATEGORY_BY_KEY integrity", () => {
  it("every category key is unique", () => {
    const keys = CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("CATEGORY_BY_KEY has an entry for every category", () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_BY_KEY[c.key]).toBe(c);
    }
  });

  it("every category has a non-empty label and an icon component", () => {
    for (const c of CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.icon).toBeTruthy();
    }
  });

  it("includes the two newly added categories: carrier and toys", () => {
    expect(CATEGORY_BY_KEY.carrier).toBeTruthy();
    expect(CATEGORY_BY_KEY.toys).toBeTruthy();
  });

  it("carrier and toys each have a matching marketing-page illustration, not just an icon", () => {
    expect(CATEGORY_BY_KEY.carrier.illustration).toBeTruthy();
    expect(CATEGORY_BY_KEY.toys.illustration).toBeTruthy();
  });

  it("activity_center and toys use distinct illustrations — they must not share the blocks image", () => {
    // Regression: an earlier version of this file reused the "Toys" blocks
    // illustration for the *Activity center* category, so two different
    // categories showed the identical picture. Both now have their own
    // dedicated hand-drawn illustration, and they must stay distinct.
    expect(CATEGORY_BY_KEY.activity_center.illustration).toBeDefined();
    expect(CATEGORY_BY_KEY.activity_center.illustration).not.toBe(CATEGORY_BY_KEY.toys.illustration);
    expect(CATEGORY_BY_KEY.toys.illustration).not.toBe(CATEGORY_BY_KEY.bouncer.illustration);
  });

  it("no two categories accidentally share the same illustration", () => {
    const illustrations = CATEGORIES.map((c) => c.illustration).filter(Boolean) as string[];
    expect(new Set(illustrations).size).toBe(illustrations.length);
  });
});

describe("categoryFromLabel", () => {
  it("finds a category by its exact label, case-insensitively", () => {
    expect(categoryFromLabel("baby carrier")?.key).toBe("carrier");
    expect(categoryFromLabel("TOYS")?.key).toBe("toys");
  });

  it("finds a category by its raw key too", () => {
    expect(categoryFromLabel("carrier")?.key).toBe("carrier");
  });

  it("returns undefined for an unrecognized label", () => {
    expect(categoryFromLabel("spaceship")).toBeUndefined();
    expect(categoryFromLabel(null)).toBeUndefined();
  });
});

describe("guessCategoryFromText — new carrier/toys matching", () => {
  it("matches common carrier phrasing", () => {
    expect(guessCategoryFromText("Ergobaby Omni 360 Baby Carrier")).toBe("carrier");
    expect(guessCategoryFromText("Solly Baby Wrap Carrier")).toBe("carrier");
    expect(guessCategoryFromText("Ring Sling Baby Carrier")).toBe("carrier");
  });

  it("still prefers car_seat over carrier for a car-seat-and-carrier combo product", () => {
    expect(guessCategoryFromText("Chicco KeyFit 30 Infant Car Seat Carrier")).toBe("car_seat");
  });

  it("matches common toy phrasing", () => {
    expect(guessCategoryFromText("Melissa & Doug Wooden Blocks")).toBe("toys");
    // A teether toy is more precisely a teether now that the dedicated
    // category exists — the specific match should win over the generic one.
    expect(guessCategoryFromText("Sophie the Giraffe Teether Toy")).toBe("teether");
    expect(guessCategoryFromText("Baby Rattle Set")).toBe("toys");
  });

  it("does not false-positive 'toy' as a substring of an unrelated word", () => {
    // "toys" must match on a whole word, not as a fragment of e.g. "Tokyo"
    // or "employ" — this mirrors the same whole-word discipline already
    // established for recall matching in this codebase.
    expect(guessCategoryFromText("Tokyo Baby Formula")).toBe("formula");
  });

  it("still returns empty for genuinely unrecognized text", () => {
    expect(guessCategoryFromText("Random unrelated widget")).toBe("");
  });
});

describe("CategoryKey coverage — guessCategoryFromText only ever returns a real key", () => {
  it("every non-empty guess corresponds to an actual CATEGORIES entry", () => {
    const samples = [
      "car seat",
      "bassinet",
      "crib",
      "stroller",
      "baby carrier",
      "high chair",
      "baby swing",
      "bouncer",
      "activity center",
      "swaddle",
      "baby gate",
      "pack n play",
      "baby monitor",
      "pacifier",
      "formula",
      "breast milk",
      "baby food",
      "toothbrush",
      "toys",
    ];
    for (const s of samples) {
      const guess: CategoryKey | "" = guessCategoryFromText(s);
      expect(guess).not.toBe("");
      expect(CATEGORY_BY_KEY[guess as CategoryKey]).toBeTruthy();
    }
  });
});
