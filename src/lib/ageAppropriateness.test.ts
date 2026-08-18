import { describe, it, expect } from "vitest";
import { describeAgeRange } from "./ageAppropriateness";

const highChair = { label: "High chair", minAgeMonths: 6 };
const bassinet = { label: "Bassinet", minAgeMonths: 0, maxAgeMonths: 6 };
const noBounds = { label: "Car seat", minAgeMonths: 0 };
const noFields = { label: "Formula" };

describe("describeAgeRange", () => {
  it("returns null for a null/undefined category", () => {
    expect(describeAgeRange(null)).toBeNull();
    expect(describeAgeRange(undefined)).toBeNull();
  });

  it("returns null for a category with no min/max at all", () => {
    expect(describeAgeRange(noFields)).toBeNull();
  });

  it("returns null for a category with only minAgeMonths=0 (no meaningful bounds)", () => {
    expect(describeAgeRange(noBounds)).toBeNull();
  });

  it("returns the range for a category with a meaningful minAgeMonths", () => {
    const r = describeAgeRange(highChair);
    expect(r).toEqual({ label: "High chair", minAgeMonths: 6, maxAgeMonths: undefined });
  });

  it("returns the range for a category with a maxAgeMonths (even with minAgeMonths=0)", () => {
    const r = describeAgeRange(bassinet);
    expect(r).toEqual({ label: "Bassinet", minAgeMonths: 0, maxAgeMonths: 6 });
  });

  it("never compares against a child's age — the function takes no child/date input at all", () => {
    // Structural guard: describeAgeRange only accepts a category. If a
    // future change reintroduces a date_of_birth/dueDate parameter, this
    // test's call site would need updating — a signal to reconsider.
    expect(describeAgeRange.length).toBe(1);
  });
});
