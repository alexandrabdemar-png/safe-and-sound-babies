import { describe, it, expect } from "vitest";
import { computeContentHash, hazardFingerprint, formatDataAsOf, isPipelineStale } from "./recallFreshness";

describe("computeContentHash", () => {
  it("is deterministic across whitespace/case variations", async () => {
    const a = await computeContentHash({
      title: "Foo Recall", hazard: "Fall hazard", remedy: "Return to store", description: null,
    });
    const b = await computeContentHash({
      title: "  foo   recall ", hazard: "FALL HAZARD", remedy: "return to store", description: "",
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it("changes when material fields change", async () => {
    const a = await computeContentHash({ title: "X", hazard: "cut", remedy: null, description: null });
    const b = await computeContentHash({ title: "X", hazard: "burn", remedy: null, description: null });
    expect(a).not.toBe(b);
  });
});

describe("hazardFingerprint", () => {
  it("produces the same fingerprint regardless of field order/case", () => {
    const a = hazardFingerprint({ brand: "Fisher-Price", product_name: "Rock 'n Play Sleeper", model: "CHM89", title: "Rock n Play sleeper recall" });
    const b = hazardFingerprint({ brand: "fisher price", product_name: "rock n play sleeper", model: "chm89", title: "Rock 'n Play Sleeper Recall" });
    expect(a).toBe(b);
    expect(a).not.toBe("");
  });

  it("returns empty string for too-short input to avoid over-dedup", () => {
    expect(hazardFingerprint({ brand: "X" })).toBe("");
  });
});

describe("formatDataAsOf", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  it("returns 'just now' inside an hour", () => {
    expect(formatDataAsOf("2026-11-01T11:30:00Z", now)).toBe("Data as of just now");
  });
  it("uses hour granularity inside a day", () => {
    expect(formatDataAsOf("2026-11-01T05:00:00Z", now)).toBe("Data as of 7 hours ago");
  });
  it("uses 'yesterday' at 1 day", () => {
    expect(formatDataAsOf("2026-10-31T12:00:00Z", now)).toBe("Data as of yesterday");
  });
  it("falls back gracefully on null", () => {
    expect(formatDataAsOf(null, now)).toBe("Data freshness unavailable");
  });
});

describe("isPipelineStale", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  it("treats missing timestamp as stale", () => {
    expect(isPipelineStale(null, now)).toBe(true);
  });
  it("returns false for a recent success", () => {
    expect(isPipelineStale("2026-11-01T00:00:00Z", now)).toBe(false);
  });
  it("returns true after 26 hours", () => {
    expect(isPipelineStale("2026-10-30T08:00:00Z", now)).toBe(true);
  });
});
