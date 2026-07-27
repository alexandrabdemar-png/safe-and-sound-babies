import { describe, it, expect } from "vitest";
import {
  mapCpscResults,
  mapCriticalRecalls,
  mapExtraResults,
  mergeRecallSources,
  classifyRecallFetchStatus,
} from "./recallRadarMerge";
import type { CpscRecall } from "./cpscSearch";
import type { ExtraRecallRow } from "./recallRadarMerge";

describe("mapCpscResults", () => {
  it("maps a well-formed CPSC result", () => {
    const input: CpscRecall[] = [
      {
        RecallID: "12345",
        RecallHeading: "Test Crib Recalled",
        RecallDate: "2026-06-01",
        URL: "https://cpsc.gov/x",
        Products: [{ Name: "Crib", Description: "Fall hazard" }],
      },
    ];
    const out = mapCpscResults(input);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("cpsc-12345");
    expect(out[0].source).toBe("cpsc");
    expect(out[0].description).toBe("Fall hazard");
  });

  it("prefixes fda- ids with source fda instead of cpsc-", () => {
    const input: CpscRecall[] = [
      {
        RecallID: "fda-99",
        RecallHeading: "Formula recall",
        URL: "https://fda.gov/x",
      },
    ];
    const out = mapCpscResults(input);
    expect(out[0].id).toBe("fda-99");
    expect(out[0].source).toBe("fda");
  });

  it("does not throw on a malformed entry with a missing RecallID — drops it instead", () => {
    const input = [
      { RecallHeading: "No id here" } as unknown as CpscRecall,
      { RecallID: "555", RecallHeading: "Valid one", URL: "https://x" } as CpscRecall,
    ];
    expect(() => mapCpscResults(input)).not.toThrow();
    const out = mapCpscResults(input);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("cpsc-555");
  });

  it("does not throw when RecallHeading/URL/Products are missing", () => {
    const input: CpscRecall[] = [{ RecallID: "1" } as CpscRecall];
    expect(() => mapCpscResults(input)).not.toThrow();
    const out = mapCpscResults(input);
    expect(out[0].title).toBe("Recall notice");
    expect(out[0].url).toBe("");
  });
});

describe("mapCriticalRecalls", () => {
  it("always sorts to the top via Number.MAX_SAFE_INTEGER sortDate", () => {
    const out = mapCriticalRecalls();
    for (const r of out) {
      expect(r.sortDate).toBe(Number.MAX_SAFE_INTEGER);
      expect(r.source).toBe("critical");
    }
  });
});

describe("mapExtraResults", () => {
  it("maps a well-formed row, preferring hazard over description", () => {
    const out = mapExtraResults([
      {
        id: "abc",
        source: "nhtsa",
        title: "Car seat issue",
        description: "generic description",
        hazard: "specific hazard text",
        url: "https://nhtsa.gov/x",
        recall_date: "2026-05-01",
        official: true,
        lot_pattern: null,
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("nhtsa-abc");
    expect(out[0].description).toBe("specific hazard text");
    expect(out[0].lotPattern).toBeNull();
  });

  it("carries lot_pattern through when the source data has it", () => {
    const out = mapExtraResults([
      {
        id: "abc",
        source: "nhtsa",
        title: "Car seat issue",
        description: "generic description",
        hazard: null,
        url: "https://nhtsa.gov/x",
        recall_date: "2026-05-01",
        official: true,
        lot_pattern: "Lot codes AB1000-AB2000",
      },
    ]);
    expect(out[0].lotPattern).toBe("Lot codes AB1000-AB2000");
  });

  it("does not throw on a row missing id/source — drops it instead", () => {
    const rows = [
      { title: "broken row" } as unknown as ExtraRecallRow,
      {
        id: "1",
        source: "eu_safety_gate",
        title: "ok",
        description: null,
        hazard: null,
        url: null,
        recall_date: null,
        official: false,
        lot_pattern: null,
      },
    ];
    expect(() => mapExtraResults(rows)).not.toThrow();
    const out = mapExtraResults(rows);
    expect(out).toHaveLength(1);
    expect(out[0].official).toBe(false);
  });
});

describe("mergeRecallSources", () => {
  it("dedupes by lowercased/trimmed title across groups", () => {
    const a = mapCpscResults([{ RecallID: "1", RecallHeading: "Same Title", URL: "https://a" }]);
    const b = mapCpscResults([{ RecallID: "2", RecallHeading: "same title  ", URL: "https://b" }]);
    const out = mergeRecallSources(a, b);
    expect(out).toHaveLength(1);
  });

  it("sorts newest-first by sortDate", () => {
    const older = mapCpscResults([
      { RecallID: "1", RecallHeading: "Older", RecallDate: "2026-01-01", URL: "https://a" },
    ]);
    const newer = mapCpscResults([
      { RecallID: "2", RecallHeading: "Newer", RecallDate: "2026-06-01", URL: "https://b" },
    ]);
    const out = mergeRecallSources(older, newer);
    expect(out.map((r) => r.title)).toEqual(["Newer", "Older"]);
  });

  it("critical recalls always sort first regardless of insertion order", () => {
    const normal = mapCpscResults([
      {
        RecallID: "1",
        RecallHeading: "Regular recall",
        RecallDate: "2026-06-01",
        URL: "https://a",
      },
    ]);
    const critical = mapCriticalRecalls();
    const out = mergeRecallSources(normal, critical);
    expect(out[0].source).toBe("critical");
  });

  it("one empty/failed source group does not affect merging the others", () => {
    const critical = mapCriticalRecalls();
    const empty: ReturnType<typeof mapExtraResults> = [];
    const out = mergeRecallSources(critical, [], empty);
    expect(out.length).toBe(critical.length);
  });
});

// ── Regression: the degraded-data banner on /recall-radar reads "USDA
// FSIS, NHTSA, Health Canada & EU Safety Gate didn't respond" — but those
// four sources are never fetched live from this page (see the code
// comment in recall-radar.tsx); they're read from our own `recalls` table,
// pre-synced daily. A failure there means our own database read failed,
// not that those agencies personally "didn't respond". These tests pin
// down the actual decision logic (blocking error vs. degraded banner vs.
// nothing) so it's verified, not just reasoned about.
describe("classifyRecallFetchStatus", () => {
  it("reports nothing when both sources succeed", () => {
    const result = classifyRecallFetchStatus(false, false, 5);
    expect(result).toEqual({ error: null, degradedSources: [] });
  });

  it("shows a degraded banner (not a blocking error) when only the extra-sources read fails but CPSC still found recalls", () => {
    const result = classifyRecallFetchStatus(false, true, 3);
    expect(result.error).toBeNull();
    expect(result.degradedSources).toEqual(["USDA FSIS, NHTSA, Health Canada & EU Safety Gate"]);
  });

  it("shows a degraded banner when only CPSC/FDA fails but the extra sources still found recalls", () => {
    const result = classifyRecallFetchStatus(true, false, 2);
    expect(result.error).toBeNull();
    expect(result.degradedSources).toEqual(["CPSC & FDA"]);
  });

  it("lists both failed sources when both fail but critical recalls still produced results", () => {
    const result = classifyRecallFetchStatus(true, true, 1);
    expect(result.error).toBeNull();
    expect(result.degradedSources).toEqual([
      "CPSC & FDA",
      "USDA FSIS, NHTSA, Health Canada & EU Safety Gate",
    ]);
  });

  it("regression: shows a blocking error instead of an empty degraded list when everything fails and nothing loaded", () => {
    const result = classifyRecallFetchStatus(true, true, 0);
    expect(result.error).toBe(
      "Couldn't reach the recall databases right now. Try again in a moment or visit cpsc.gov/Recalls directly.",
    );
    expect(result.degradedSources).toEqual([]);
  });

  it("shows a blocking error when the one and only source fails and nothing loaded", () => {
    const result = classifyRecallFetchStatus(false, true, 0);
    expect(result.error).not.toBeNull();
    expect(result.degradedSources).toEqual([]);
  });

  it("never reports a failure for a source that actually succeeded", () => {
    const result = classifyRecallFetchStatus(false, true, 4);
    expect(result.degradedSources).not.toContain("CPSC & FDA");
  });
});
