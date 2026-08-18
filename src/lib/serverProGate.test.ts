import { describe, it, expect, vi } from "vitest";
import { hasProSubscription } from "./serverProGate";

// Minimal thenable chain mimicking Supabase's query builder, matching the
// pattern established in recallCheck.test.ts.
function makeChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

describe("hasProSubscription", () => {
  it("returns false when the user has no subscription row", async () => {
    const supabase = { from: vi.fn(() => makeChain({ data: null, error: null })) };
    expect(await hasProSubscription(supabase, "user-1")).toBe(false);
  });

  it("returns false on a query error", async () => {
    const supabase = {
      from: vi.fn(() => makeChain({ data: null, error: new Error("boom") })),
    };
    expect(await hasProSubscription(supabase, "user-1")).toBe(false);
  });

  it("returns true for an active subscription with no period end", async () => {
    const supabase = {
      from: vi.fn(() =>
        makeChain({ data: { status: "active", current_period_end: null }, error: null }),
      ),
    };
    expect(await hasProSubscription(supabase, "user-1")).toBe(true);
  });

  it("returns true for a trialing subscription still within its period", async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const supabase = {
      from: vi.fn(() =>
        makeChain({ data: { status: "trialing", current_period_end: future }, error: null }),
      ),
    };
    expect(await hasProSubscription(supabase, "user-1")).toBe(true);
  });

  it("returns false once the period has ended, even for an otherwise-qualifying status", async () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const supabase = {
      from: vi.fn(() =>
        makeChain({ data: { status: "active", current_period_end: past }, error: null }),
      ),
    };
    expect(await hasProSubscription(supabase, "user-1")).toBe(false);
  });
});
