import { describe, it, expect } from "vitest";
import { computeIsPro, hasAnyProSubscription } from "./subscription";

describe("computeIsPro", () => {
  it("is false for no subscription", () => {
    expect(computeIsPro(null)).toBe(false);
  });

  it("is false for a non-pro plan", () => {
    expect(computeIsPro({ plan: "free", status: "active", current_period_end: null })).toBe(false);
  });

  it("is true for an active pro subscription with no period end set", () => {
    expect(computeIsPro({ plan: "pro", status: "active", current_period_end: null })).toBe(true);
  });

  it("is true while trialing", () => {
    expect(computeIsPro({ plan: "pro", status: "trialing", current_period_end: null })).toBe(true);
  });

  it("is true while past_due (grace period during a failed payment retry)", () => {
    expect(computeIsPro({ plan: "pro", status: "past_due", current_period_end: null })).toBe(true);
  });

  it("is true for a canceled sub whose paid period hasn't ended yet", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(computeIsPro({ plan: "pro", status: "canceled", current_period_end: future })).toBe(
      true,
    );
  });

  it("is false for a canceled sub once the paid period has ended", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(computeIsPro({ plan: "pro", status: "canceled", current_period_end: past })).toBe(false);
  });

  it("is false for an active pro sub whose current_period_end has already passed (stale row)", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(computeIsPro({ plan: "pro", status: "active", current_period_end: past })).toBe(false);
  });

  it("is false for a pro plan with an unrecognized status", () => {
    expect(computeIsPro({ plan: "pro", status: "incomplete", current_period_end: null })).toBe(
      false,
    );
  });

  it("adversarial: a spoofed-looking plan string with extra whitespace/case is not treated as pro", () => {
    expect(computeIsPro({ plan: "Pro", status: "active", current_period_end: null })).toBe(false);
    expect(computeIsPro({ plan: " pro", status: "active", current_period_end: null })).toBe(false);
  });
});

// ── Regression: lookup-product/index.ts previously took only the most
// recent subscription row (no environment filter, unlike the client-side
// check in useSubscription.ts) — a user with a valid Pro row in one Stripe
// environment and a stale/non-pro row in another could have the *wrong*
// one win depending on which was more recently created, unlocking the
// scanner client-side while the edge function silently treated them as
// non-Pro server-side and skipped every paid barcode source.
describe("hasAnyProSubscription", () => {
  it("is false for no rows", () => {
    expect(hasAnyProSubscription([])).toBe(false);
  });

  it("is true when the only row is a valid pro subscription", () => {
    expect(
      hasAnyProSubscription([{ plan: "pro", status: "active", current_period_end: null }]),
    ).toBe(true);
  });

  it("is false when the only row is a free/non-pro subscription", () => {
    expect(
      hasAnyProSubscription([{ plan: "free", status: "active", current_period_end: null }]),
    ).toBe(false);
  });

  it("is true when a valid pro row exists alongside a stale/non-pro row, regardless of order", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const staleRow = { plan: "pro", status: "canceled", current_period_end: past };
    const validRow = { plan: "pro", status: "active", current_period_end: null };
    expect(hasAnyProSubscription([staleRow, validRow])).toBe(true);
    expect(hasAnyProSubscription([validRow, staleRow])).toBe(true);
  });

  it("is false when every row is stale or non-pro (multiple environments, none currently valid)", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(
      hasAnyProSubscription([
        { plan: "pro", status: "canceled", current_period_end: past },
        { plan: "free", status: "active", current_period_end: null },
      ]),
    ).toBe(false);
  });
});
