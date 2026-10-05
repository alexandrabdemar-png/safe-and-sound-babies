import { describe, it, expect } from "vitest";
import { fdaRelevanceScore, pickTopFdaRecalls } from "./fdaTopRecalls";
import type { RadarRecall } from "./recallRadarMerge";

function fda(overrides: Partial<RadarRecall> = {}): RadarRecall {
  return {
    id: "fda-1",
    source: "fda",
    title: "Recall",
    description: "",
    dateLabel: null,
    sortDate: 0,
    url: "",
    official: true,
    lotPattern: null,
    ...overrides,
  };
}

describe("fdaRelevanceScore", () => {
  it("ranks infant formula above an ambiguous 'formula' match", () => {
    const infant = fda({ title: "Acme — Infant Formula powder" });
    const supplement = fda({ title: "Acme — Joint formula supplement" });
    expect(fdaRelevanceScore(infant)).toBeGreaterThan(fdaRelevanceScore(supplement));
  });

  it("boosts serious infant hazards", () => {
    const plain = fda({ title: "Baby food pouch", description: "mislabeled" });
    const cronobacter = fda({ title: "Baby food pouch", description: "Cronobacter contamination" });
    expect(fdaRelevanceScore(cronobacter)).toBeGreaterThan(fdaRelevanceScore(plain));
  });

  it("uses word boundaries so 'leading' and 'narrative' don't match", () => {
    expect(fdaRelevanceScore(fda({ title: "Leading narrative snacks" }))).toBe(0);
  });
});

describe("pickTopFdaRecalls", () => {
  it("keeps only FDA rows, most relevant first, newest first on ties, capped at limit", () => {
    const rows = [
      fda({ id: "fda-old-formula", title: "Infant formula", sortDate: 1 }),
      fda({ id: "fda-new-formula", title: "Infant formula", sortDate: 5 }),
      fda({ id: "fda-weak", title: "Protein formula", sortDate: 9 }),
      fda({ id: "fda-none", title: "Frozen shrimp", sortDate: 10 }),
      fda({ id: "cpsc-1", source: "cpsc", title: "Infant formula", sortDate: 10 }),
    ];
    expect(pickTopFdaRecalls(rows).map((r) => r.id)).toEqual([
      "fda-new-formula",
      "fda-old-formula",
      "fda-weak",
    ]);
    expect(pickTopFdaRecalls(rows, 1).map((r) => r.id)).toEqual(["fda-new-formula"]);
  });
});
