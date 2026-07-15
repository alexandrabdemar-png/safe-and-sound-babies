import { describe, expect, it } from "vitest";
import {
  buildLifecycleNotification,
  classifyUrgency,
  computeDefaultCarSeatExpiration,
  findLifecycleMatches,
  type LifecycleProduct,
} from "./lifecycleCheck.ts";

describe("computeDefaultCarSeatExpiration", () => {
  it("defaults a car seat to manufacture_date + 6 years when no explicit expiration is set", () => {
    expect(computeDefaultCarSeatExpiration("2020-01-15", "car_seat", null)).toBe("2026-01-15");
  });

  it("prefers an explicit expiration date over the computed default", () => {
    expect(computeDefaultCarSeatExpiration("2020-01-15", "car_seat", "2027-06-01")).toBe(
      "2027-06-01",
    );
  });

  it("does not default non-car-seat product types", () => {
    expect(computeDefaultCarSeatExpiration("2020-01-15", "formula", null)).toBeNull();
    expect(computeDefaultCarSeatExpiration("2020-01-15", "medicine", null)).toBeNull();
    expect(computeDefaultCarSeatExpiration("2020-01-15", "other", null)).toBeNull();
  });

  it("returns null for a car seat with no manufacture_date and no explicit expiration", () => {
    expect(computeDefaultCarSeatExpiration(null, "car_seat", null)).toBeNull();
  });
});

describe("classifyUrgency", () => {
  const today = new Date("2026-07-04T12:00:00Z");

  it("returns null when there is no expiration date", () => {
    expect(classifyUrgency(null, today)).toBeNull();
  });

  it("classifies an already-expired product as 'expired'", () => {
    expect(classifyUrgency("2026-07-03", today)).toBe("expired");
    expect(classifyUrgency("2020-01-01", today)).toBe("expired");
  });

  it("classifies today itself as within the 7-day bucket", () => {
    expect(classifyUrgency("2026-07-04", today)).toBe("7");
  });

  it("classifies exactly 5 days out as within the 7-day bucket", () => {
    expect(classifyUrgency("2026-07-09", today)).toBe("7");
  });

  it("classifies the boundary at exactly 7 days as the 7-day bucket", () => {
    expect(classifyUrgency("2026-07-11", today)).toBe("7");
  });

  it("classifies 8 days out as the 30-day bucket, not 7", () => {
    expect(classifyUrgency("2026-07-12", today)).toBe("30");
  });

  it("classifies the boundary at exactly 30 days as the 30-day bucket", () => {
    expect(classifyUrgency("2026-08-03", today)).toBe("30");
  });

  it("classifies 31 days out as the 90-day bucket, not 30", () => {
    expect(classifyUrgency("2026-08-04", today)).toBe("90");
  });

  it("classifies the boundary at exactly 90 days as the 90-day bucket", () => {
    expect(classifyUrgency("2026-10-02", today)).toBe("90");
  });

  it("returns null for anything more than 90 days out", () => {
    expect(classifyUrgency("2026-10-03", today)).toBeNull();
    expect(classifyUrgency("2030-01-01", today)).toBeNull();
  });
});

describe("findLifecycleMatches", () => {
  const today = new Date("2026-07-04T12:00:00Z");

  it("returns one match per product within an actionable window, and skips the rest", () => {
    const products: LifecycleProduct[] = [
      {
        id: "p1",
        user_id: "u1",
        name: "Graco Car Seat",
        child_id: "c1",
        product_type: "car_seat",
        expiration_date: "2026-07-09",
      },
      {
        id: "p2",
        user_id: "u1",
        name: "Infant Tylenol",
        child_id: "c1",
        product_type: "medicine",
        expiration_date: "2030-01-01",
      },
      {
        id: "p3",
        user_id: "u2",
        name: "Formula",
        child_id: null,
        product_type: "formula",
        expiration_date: null,
      },
      {
        id: "p4",
        user_id: "u2",
        name: "Old Car Seat",
        child_id: null,
        product_type: "car_seat",
        expiration_date: "2020-01-01",
      },
    ];

    const matches = findLifecycleMatches(products, today);

    expect(matches).toEqual([
      { user_id: "u1", product_id: "p1", urgency: "7" },
      { user_id: "u2", product_id: "p4", urgency: "expired" },
    ]);
  });

  it("returns an empty array when nothing is actionable", () => {
    const products: LifecycleProduct[] = [
      {
        id: "p1",
        user_id: "u1",
        name: "Formula",
        child_id: null,
        product_type: "formula",
        expiration_date: null,
      },
    ];
    expect(findLifecycleMatches(products, today)).toEqual([]);
  });
});

describe("buildLifecycleNotification", () => {
  it("builds an urgency-appropriate title and body for each bucket", () => {
    expect(buildLifecycleNotification("Graco Car Seat", "expired").body).toContain(
      "past its estimated safe-use window",
    );
    expect(buildLifecycleNotification("Graco Car Seat", "7").body).toContain("within the next week");
    expect(buildLifecycleNotification("Graco Car Seat", "30").body).toContain("within the next month");
    expect(buildLifecycleNotification("Graco Car Seat", "90").body).toContain(
      "within the next 90 days",
    );
  });

  it("includes the product name in the title", () => {
    expect(buildLifecycleNotification("Graco Car Seat", "7").title).toContain("Graco Car Seat");
  });
});
