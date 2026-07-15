import { describe, it, expect, vi } from "vitest";
import {
  fuzzyMatchProduct,
  checkCpscRecalls,
  checkNhtsaRecalls,
  checkRecalls,
} from "./recallMatch";

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

describe("fuzzyMatchProduct", () => {
  it("matches a clear single-token product name", () => {
    expect(fuzzyMatchProduct("Nara Formula", "Nara Organics Recalls Infant Formula")).toBe(true);
  });

  it("does not match an unrelated product", () => {
    expect(fuzzyMatchProduct("Bobbie Gentle Formula", "Graco Stroller Recall")).toBe(false);
  });

  it("requires 2+ meaningful token hits for multi-token names", () => {
    // Only "gentle" appears, "bobbie" does not — should not match.
    expect(
      fuzzyMatchProduct("Bobbie Gentle Formula", "Gentle giant recall of something else entirely"),
    ).toBe(false);
  });

  // ── Regression: "Beech-Nut" false-flagged against an unrelated Grizzlies
  // granola recall — reported bug. Root cause: token matching used raw
  // substring containment (`text.includes(token)`), so short tokens like
  // "beech" and "nut" matched as fragments of completely unrelated words
  // ("Beechwood", "Peanuts") instead of requiring a real whole-word match. ──
  it("regression: does NOT match on tokens that only appear as substrings of unrelated words", () => {
    // Real-shape recall title: neither "Beech" nor "Nut" is actually
    // present as a word — "beech" is only a fragment of "Beechwood" and
    // "nut" only a fragment of "Peanuts".
    expect(
      fuzzyMatchProduct(
        "Beech-Nut",
        "Grizzlies Granola Recalls Beechwood Trail Mix Bars Due to Undeclared Peanuts",
      ),
    ).toBe(false);
  });

  it("regression: the same false-positive pattern, product name reversed (Nut-Beech) and different substring carriers", () => {
    expect(
      fuzzyMatchProduct("Nut Beech", "Coconut Grove Recalls Beechcraft-Branded Snack Trays"),
    ).toBe(false);
  });

  it("still matches a genuine recall that names the exact brand as a whole word", () => {
    expect(
      fuzzyMatchProduct(
        "Beech-Nut Naturals Oatmeal Pouch",
        "Beech-Nut Nutrition Recalls Naturals Oatmeal Baby Food Pouches",
      ),
    ).toBe(true);
  });

  it("a single short meaningful token still requires a whole-word match, not a substring one", () => {
    // "cat" must not match inside "category"/"educate"/"delicate" etc.
    expect(fuzzyMatchProduct("Cat", "This product is in a different category entirely")).toBe(
      false,
    );
    expect(fuzzyMatchProduct("Cat", "Recall affects the Cat brand of toy trucks")).toBe(true);
  });
});

describe("checkCpscRecalls — structured-field-only matching (regression: Pipa RX false positive)", () => {
  it("does NOT flag a product whose name is only mentioned in free text to say it's unaffected", async () => {
    // This is the exact bug class from earlier this session: a recall for
    // the Nuna Pipa (not Pipa RX) whose Description explicitly lists Pipa RX
    // as NOT included. Matching against Description would false-positive.
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          RecallID: 111,
          Title: "Nuna Recalls Pipa Infant Car Seats",
          URL: "https://www.cpsc.gov/example",
          RecallDate: "2024-01-01",
          Products: [{ Name: "Nuna Pipa", Model: "PIPA-001", Type: "Infant Car Seat" }],
          Manufacturers: [{ Name: "Nuna" }],
          Hazards: [{ Name: "Fall hazard" }],
          Description:
            "This recall does not include the Pipa Lite, Pipa Lite R, or Pipa RX, which are not affected.",
        },
      ]),
    );
    const hits = await checkCpscRecalls("Nuna Pipa RX", fetchImpl);
    expect(hits).toEqual([]);
  });

  it("DOES flag a product genuinely named in the structured Products field", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          RecallID: 222,
          Title: "Nuna Recalls Pipa RX Infant Car Seats",
          URL: "https://www.cpsc.gov/example2",
          RecallDate: "2024-02-01",
          Products: [{ Name: "Nuna Pipa RX", Model: "PIPARX-001", Type: "Infant Car Seat" }],
          Manufacturers: [{ Name: "Nuna" }],
          Hazards: [{ Name: "Buckle failure" }],
        },
      ]),
    );
    const hits = await checkCpscRecalls("Nuna Pipa RX", fetchImpl);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      source: "cpsc",
      title: "Nuna Recalls Pipa RX Infant Car Seats",
    });
  });

  it("returns [] on network failure without throwing", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("down"));
    await expect(checkCpscRecalls("Anything", fetchImpl)).resolves.toEqual([]);
  });

  it("returns [] when the API responds non-ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([], false));
    await expect(checkCpscRecalls("Anything", fetchImpl)).resolves.toEqual([]);
  });

  it("returns [] when the API responds with a non-array body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "not an array" }));
    await expect(checkCpscRecalls("Anything", fetchImpl)).resolves.toEqual([]);
  });
});

describe("checkNhtsaRecalls", () => {
  // NHTSA's structured fields for child-restraint recalls only give us
  // component ("CHILD SEAT") + manufacturer, never a model name — so
  // matching is deliberately brand-level, not model-level. See the doc
  // comment on checkNhtsaRecalls for the full reasoning.

  it("matches when the manufacturer name appears in the structured manufacturer field", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          nhtsa_campaign_number: "24V123000",
          component: "CHILD SEAT",
          manufacturer: "Chicco USA Inc",
          consequence_summary: "This does not affect the KeyFit 35, only the KeyFit 30.",
          report_received_date: "2024-03-01",
        },
      ]),
    );
    const hits = await checkNhtsaRecalls("KeyFit 30", "Chicco", fetchImpl);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ source: "nhtsa", id: "24V123000" });
    // The reason text must not overclaim model-level precision.
    expect(hits[0].reason).toMatch(/confirm your exact model/i);
  });

  it("does not match a different manufacturer", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          nhtsa_campaign_number: "24V999000",
          component: "CHILD SEAT",
          manufacturer: "Britax Child Safety Inc",
        },
      ]),
    );
    const hits = await checkNhtsaRecalls("KeyFit 30", "Chicco", fetchImpl);
    expect(hits).toEqual([]);
  });

  it("returns [] when no brand is known (nothing reliable to match on)", async () => {
    const fetchImpl = vi.fn();
    const hits = await checkNhtsaRecalls("Some Car Seat", null, fetchImpl);
    expect(hits).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns [] on network failure without throwing", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("down"));
    await expect(checkNhtsaRecalls("Anything", "Brand", fetchImpl)).resolves.toEqual([]);
  });
});

describe("checkRecalls orchestration", () => {
  it("only queries NHTSA when category is car_seat", async () => {
    const calledHosts: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calledHosts.push(new URL(url).hostname);
      return jsonResponse([]);
    });
    await checkRecalls("Bobbie Formula", "Bobbie", "formula", fetchImpl as unknown as typeof fetch);
    expect(calledHosts).toContain("www.saferproducts.gov");
    expect(calledHosts).not.toContain("data.transportation.gov");
  });

  it("queries NHTSA when category is car_seat", async () => {
    const calledHosts: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calledHosts.push(new URL(url).hostname);
      return jsonResponse([]);
    });
    await checkRecalls("KeyFit 30", "Chicco", "car_seat", fetchImpl as unknown as typeof fetch);
    expect(calledHosts).toContain("www.saferproducts.gov");
    expect(calledHosts).toContain("data.transportation.gov");
  });

  it("also queries NHTSA when the product name itself says 'car seat', regardless of category field", async () => {
    const calledHosts: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calledHosts.push(new URL(url).hostname);
      return jsonResponse([]);
    });
    await checkRecalls(
      "Generic Infant Car Seat",
      "SomeBrand",
      null,
      fetchImpl as unknown as typeof fetch,
    );
    expect(calledHosts).toContain("data.transportation.gov");
  });

  it("does not query NHTSA for a car_seat category product with no known brand (nothing to match on)", async () => {
    const calledHosts: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calledHosts.push(new URL(url).hostname);
      return jsonResponse([]);
    });
    await checkRecalls("Some Car Seat", null, "car_seat", fetchImpl as unknown as typeof fetch);
    expect(calledHosts).toContain("www.saferproducts.gov");
    expect(calledHosts).not.toContain("data.transportation.gov");
  });

  it("recalled is true when either source has a hit", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse([
          { RecallID: 1, Title: "Bobbie Formula Recall", Products: [{ Name: "Bobbie Formula" }] },
        ]),
      );
    const result = await checkRecalls(
      "Bobbie Formula",
      "Bobbie",
      "formula",
      fetchImpl as unknown as typeof fetch,
    );
    expect(result.recalled).toBe(true);
    expect(result.recalls).toHaveLength(1);
  });

  it("recalled is false and recalls is empty when nothing matches", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));
    const result = await checkRecalls(
      "Totally Unrelated Item",
      "Nobody",
      "other",
      fetchImpl as unknown as typeof fetch,
    );
    expect(result.recalled).toBe(false);
    expect(result.recalls).toEqual([]);
  });
});
