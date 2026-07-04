import { describe, it, expect, vi } from "vitest";
import {
  fetchUsdaFsisRecalls,
  fetchNhtsaRecalls,
  fetchHealthCanadaRecalls,
  fetchEuSafetyGateRecalls,
  fetchAllExtraRecallSources,
} from "./allRecallSources";

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

describe("fetchUsdaFsisRecalls", () => {
  it("keeps a baby-relevant recall and normalizes its fields", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          field_title: "Company Recalls Baby Food Pouches",
          field_summary: "Possible botulism contamination",
          field_company: "Acme Foods",
          field_recall_number: "025-2024",
          field_recall_date: "2024-05-01",
        },
      ]),
    );
    const results = await fetchUsdaFsisRecalls(fetchImpl);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      source: "usda_fsis",
      source_id: "025-2024",
      brand: "Acme Foods",
    });
  });

  it("filters out a recall with no baby-relevant keywords", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          field_title: "Company Recalls Ground Beef",
          field_summary: "E. coli risk",
          field_company: "Acme Meats",
        },
      ]),
    );
    expect(await fetchUsdaFsisRecalls(fetchImpl)).toEqual([]);
  });

  it("fails closed (returns []) on network error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("down"));
    await expect(fetchUsdaFsisRecalls(fetchImpl)).resolves.toEqual([]);
  });

  it("fails closed on non-ok response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([], false));
    await expect(fetchUsdaFsisRecalls(fetchImpl)).resolves.toEqual([]);
  });
});

describe("fetchNhtsaRecalls", () => {
  it("keeps a car-seat recall even without a generic baby keyword, via the car-seat regex fallback", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          nhtsa_campaign_number: "24V123000",
          component: "CHILD RESTRAINT",
          manufacturer: "Chicco USA",
          defect_summary: "Buckle may fail to latch",
          report_received_date: "2024-03-01",
        },
      ]),
    );
    const results = await fetchNhtsaRecalls(fetchImpl);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      source: "nhtsa",
      category: "car_seat",
      brand: "Chicco USA",
    });
  });

  it("drops a row with no component and no usable title", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ manufacturer: "Some Co" }]));
    expect(await fetchNhtsaRecalls(fetchImpl)).toEqual([]);
  });

  it("fails closed on network error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("down"));
    await expect(fetchNhtsaRecalls(fetchImpl)).resolves.toEqual([]);
  });
});

describe("fetchHealthCanadaRecalls", () => {
  it("keeps a recall flagged by category hint even without a keyword match in the title", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          Title_En: "XYZ Corp Product Recall",
          Category_En: "Children's Products",
          Summary_En: "Choking hazard",
        },
      ]),
    );
    const results = await fetchHealthCanadaRecalls(fetchImpl);
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("health_canada");
  });

  it("filters out an irrelevant recall", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse([
          { Title_En: "Car Battery Recall", Category_En: "Automotive", Summary_En: "Fire risk" },
        ]),
      );
    expect(await fetchHealthCanadaRecalls(fetchImpl)).toEqual([]);
  });

  it("handles a records-wrapped response shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        records: [{ Title_En: "Baby Crib Recall", Summary_En: "Slat spacing hazard" }],
      }),
    );
    expect(await fetchHealthCanadaRecalls(fetchImpl)).toHaveLength(1);
  });
});

describe("fetchEuSafetyGateRecalls", () => {
  it("is always marked official: false", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        results: [
          {
            product_brand: "SomeBrand",
            product_type: "baby carrier",
            technical_defect: "strap failure",
          },
        ],
      }),
    );
    const results = await fetchEuSafetyGateRecalls(fetchImpl);
    expect(results).toHaveLength(1);
    expect(results[0].official).toBe(false);
  });

  it("filters out an irrelevant alert", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        results: [
          {
            product_brand: "SomeBrand",
            product_type: "power drill",
            technical_defect: "overheating",
          },
        ],
      }),
    );
    expect(await fetchEuSafetyGateRecalls(fetchImpl)).toEqual([]);
  });
});

describe("fetchAllExtraRecallSources", () => {
  it("merges all four sources and one source's failure doesn't affect the others", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("fsis.usda.gov")) throw new Error("USDA down");
      if (url.includes("transportation.gov")) {
        return jsonResponse([
          { nhtsa_campaign_number: "1", component: "CHILD SEAT", manufacturer: "Acme" },
        ]);
      }
      if (url.includes("canada.ca")) return jsonResponse([{ Title_En: "Baby Item Recall" }]);
      if (url.includes("opendatasoft.com")) {
        return jsonResponse({ results: [{ product_brand: "X", product_type: "stroller" }] });
      }
      throw new Error(`unexpected url ${url}`);
    });
    const results = await fetchAllExtraRecallSources(fetchImpl as unknown as typeof fetch);
    const sources = results.map((r) => r.source).sort();
    expect(sources).toEqual(["eu_safety_gate", "health_canada", "nhtsa"]);
  });
});
