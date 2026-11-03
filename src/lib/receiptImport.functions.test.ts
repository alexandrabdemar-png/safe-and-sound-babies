import { describe, expect, it, vi } from "vitest";
import { assertReceiptImportPro } from "./receiptImport.functions";
import { PAYWALL_DISABLED } from "./paywallConfig";

// Mirrors the mock chain in serverProGate.test.ts: hasProSubscription reads
// every subscription row for the user and delegates the Pro decision to
// src/lib/isPro.ts, so the builder resolves as an awaited array.
function makeChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

function supabaseWith(result: { data: unknown; error: unknown }) {
  return { from: vi.fn(() => makeChain(result)) };
}

// The real gate only bites while the whole-app paywall is on; the flag is
// false today (src/lib/paywallConfig.ts). Skipped, not deleted, so this
// coverage resumes automatically if the flag is ever flipped back.
(PAYWALL_DISABLED ? describe.skip : describe)("assertReceiptImportPro", () => {
  it("blocks a free user with no subscription rows", async () => {
    await expect(
      assertReceiptImportPro(supabaseWith({ data: [], error: null }), "user-1"),
    ).rejects.toThrow("Receipt import is a Pro feature");
  });

  it("blocks a user whose pro period has already ended", async () => {
    const data = [
      {
        plan: "pro",
        status: "active",
        current_period_end: new Date(Date.now() - 86_400_000).toISOString(),
      },
    ];
    await expect(
      assertReceiptImportPro(supabaseWith({ data, error: null }), "user-1"),
    ).rejects.toThrow("Receipt import is a Pro feature");
  });

  it("fails closed when the subscription lookup errors", async () => {
    await expect(
      assertReceiptImportPro(supabaseWith({ data: null, error: new Error("boom") }), "user-1"),
    ).rejects.toThrow("Receipt import is a Pro feature");
  });

  it("lets an active pro subscriber through", async () => {
    const data = [
      {
        plan: "pro",
        status: "active",
        current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ];
    await expect(
      assertReceiptImportPro(supabaseWith({ data, error: null }), "user-1"),
    ).resolves.toBeUndefined();
  });

  it("lets a trialing pro subscriber through", async () => {
    const data = [
      {
        plan: "pro",
        status: "trialing",
        current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ];
    await expect(
      assertReceiptImportPro(supabaseWith({ data, error: null }), "user-1"),
    ).resolves.toBeUndefined();
  });
});
