import { describe, it, expect, vi } from "vitest";
import { hasProSubscription } from "./serverProGate";
import { PAYWALL_DISABLED } from "./paywallConfig";

// hasProSubscription now selects every subscription row for the user (no
// .limit/.maybeSingle) and delegates the Pro decision to src/lib/isPro.ts,
// so the mock chain resolves as an awaited array-returning builder.
function makeChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

it("grants Pro to every user while PAYWALL_DISABLED is true, without even querying subscriptions", async () => {
  if (!PAYWALL_DISABLED) return;
  const from = vi.fn();
  expect(await hasProSubscription({ from }, "user-1")).toBe(true);
  expect(from).not.toHaveBeenCalled();
});

// The real gate logic below is only meaningful while PAYWALL_DISABLED is
// false — see src/lib/paywallConfig.ts. Skipped (not deleted) so this
// regression coverage resumes automatically once the flag is flipped back.
(PAYWALL_DISABLED ? describe.skip : describe)("hasProSubscription", () => {
  it("returns false when the user has no subscription rows", async () => {
    const supabase = { from: vi.fn(() => makeChain({ data: [], error: null })) };
    expect(await hasProSubscription(supabase, "user-1")).toBe(false);
  });

  it("returns false on a query error", async () => {
    const supabase = {
      from: vi.fn(() => makeChain({ data: null, error: new Error("boom") })),
    };
    expect(await hasProSubscription(supabase, "user-1")).toBe(false);
  });

  it("returns true for an active pro subscription with no period end", async () => {
    const supabase = {
      from: vi.fn(() =>
        makeChain({
          data: [{ plan: "pro", status: "active", current_period_end: null }],
          error: null,
        }),
      ),
    };
    expect(await hasProSubscription(supabase, "user-1")).toBe(true);
  });

  it("returns true for a trialing pro subscription still within its period", async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const supabase = {
      from: vi.fn(() =>
        makeChain({
          data: [{ plan: "pro", status: "trialing", current_period_end: future }],
          error: null,
        }),
      ),
    };
    expect(await hasProSubscription(supabase, "user-1")).toBe(true);
  });

  it("returns false once the period has ended, even for an otherwise-qualifying status", async () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const supabase = {
      from: vi.fn(() =>
        makeChain({
          data: [{ plan: "pro", status: "active", current_period_end: past }],
          error: null,
        }),
      ),
    };
    expect(await hasProSubscription(supabase, "user-1")).toBe(false);
  });

  // Regression: the old gate ignored `plan` entirely, so a free-plan row with
  // an active status unlocked every paid server function.
  it("returns false for an active row on a non-pro plan", async () => {
    const supabase = {
      from: vi.fn(() =>
        makeChain({
          data: [{ plan: "free", status: "active", current_period_end: null }],
          error: null,
        }),
      ),
    };
    expect(await hasProSubscription(supabase, "user-1")).toBe(false);
  });

  // Regression: the old gate rejected canceled-but-still-paid users the UI
  // (correctly) still treated as Pro.
  it("returns true for a canceled pro subscription still inside its paid period", async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const supabase = {
      from: vi.fn(() =>
        makeChain({
          data: [{ plan: "pro", status: "canceled", current_period_end: future }],
          error: null,
        }),
      ),
    };
    expect(await hasProSubscription(supabase, "user-1")).toBe(true);
  });

  it("grants Pro if any row qualifies (sandbox + live rows both present)", async () => {
    const supabase = {
      from: vi.fn(() =>
        makeChain({
          data: [
            { plan: "pro", status: "canceled", current_period_end: "2020-01-01T00:00:00Z" },
            { plan: "pro", status: "active", current_period_end: null },
          ],
          error: null,
        }),
      ),
    };
    expect(await hasProSubscription(supabase, "user-1")).toBe(true);
  });
});
