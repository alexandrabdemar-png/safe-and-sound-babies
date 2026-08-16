// End-to-end simulation of "a product is added, it matches a known recall,
// and a notification is delivered" — chaining the two real building blocks
// scheduled-recall-check/index.ts uses (runRecallBatch for matching,
// notifyUser for delivery) since the Deno entrypoint itself glues them
// together with Deno.serve and can't be imported/run under Vitest directly.
// This is deliberately NOT a mock of the pipeline's own logic — every
// function called here is the actual production code, just fed fixture
// HTTP responses instead of live CPSC/APNs/webpush calls.
import { describe, it, expect, vi } from "vitest";
import { runRecallBatch, type BatchProduct } from "./_shared/recallBatch";
import { notifyUser, type ApnsConfig } from "./_shared/notify";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("end-to-end: newly-added product matches a known recall fixture, notification is delivered", () => {
  it("runRecallBatch detects the match, and feeding it into notifyUser delivers a push notification", async () => {
    // ── Step 1: a product is added, and the CPSC feed has a real recall
    // for it (fixture, shaped exactly like a live CPSC API response) ──────
    const newlyAddedProduct: BatchProduct = {
      id: "product-just-added",
      user_id: "user-1",
      name: "Pipa RX",
      brand: "Nuna",
      category: "car_seat",
      model: "PIPARX-001",
    };

    const cpscFixture = [
      {
        RecallID: 24001,
        Title: "Nuna Recalls Pipa RX Infant Car Seats Due to Fall Hazard",
        Products: [{ Name: "Nuna Pipa RX", Model: "PIPARX-001", Type: "Infant Car Seat" }],
        Manufacturers: [{ Name: "Nuna" }],
        Hazards: [{ Name: "Fall Hazard" }],
        URL: "https://www.saferproducts.gov/RecallDetail/24001",
        RecallDate: "2026-08-01",
      },
    ];

    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("saferproducts.gov")) return jsonResponse(cpscFixture);
      // Every other source (FDA, USDA, NHTSA, Health Canada, EU Safety
      // Gate) returns nothing for this fixture — only CPSC has a hit.
      if (url.includes("api.fda.gov")) return jsonResponse({ results: [] });
      return jsonResponse([]);
    }) as unknown as typeof fetch;

    // ── Step 2: "trigger the scan" — this is the exact function
    // scheduled-recall-check/index.ts calls every run ─────────────────────
    const { matches, catalogRows } = await runRecallBatch(fetchImpl, [newlyAddedProduct]);

    expect(matches).toEqual([
      {
        user_id: "user-1",
        product_id: "product-just-added",
        source: "cpsc",
        source_id: "24001",
      },
    ]);
    expect(catalogRows).toHaveLength(1);
    expect(catalogRows[0].title).toContain("Pipa RX");

    // ── Step 3: "assert a notification was queued/sent" — feed the match
    // into the exact function index.ts calls to deliver it ────────────────
    const apnsConfig: ApnsConfig = {
      keyId: "k",
      teamId: "t",
      keyP8: "x",
      bundleId: "com.peaceofmine.app",
      environment: "production",
    };
    const pushFetch = vi.fn().mockResolvedValue(jsonResponse({}, true, 200));

    const result = await notifyUser(
      pushFetch,
      { userId: "user-1", email: "parent@example.com", apnsDeviceToken: "device-token-abc" },
      {
        title: `⚠️ Safety Recall — ${newlyAddedProduct.name}`,
        body: "Tap to review.",
        data: { type: "recall" },
      },
      apnsConfig,
      "signed-jwt",
      null,
      new Map(),
      "resend-key",
      "alerts@peaceofmine.app",
    );

    expect(result.ok).toBe(true);
    expect(result.channel).toBe("push");
    // The push call actually happened — this is the concrete "was it sent"
    // evidence, not just a truthy return value.
    expect(pushFetch).toHaveBeenCalledTimes(1);
    expect(pushFetch.mock.calls[0][0]).toContain("device-token-abc");
  });

  it("if the user has no push token and email fails too, notifyUser correctly reports ok:false (this is the silent-failure point index.ts has no alerting on)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: "invalid API key" }, false, 401));
    const result = await notifyUser(
      fetchImpl,
      { userId: "user-2", email: "parent2@example.com", apnsDeviceToken: null },
      { title: "⚠️ Safety Recall", body: "Tap to review." },
      null,
      null,
      null,
      new Map(),
      "resend-key",
      "alerts@peaceofmine.app",
    );
    // This is exactly the state scheduled-recall-check/index.ts's caller
    // checks with `if (result.ok && result.channel)` before stamping
    // notified_at — when it's false, the match stays in product_recalls
    // with notified_at still NULL, but the row already "exists" for the
    // next run's new-vs-updated check (see the .sql test in this same
    // commit for what that means for whether a retry actually happens).
    expect(result.ok).toBe(false);
    expect(result.channel).toBeNull();
  });
});
