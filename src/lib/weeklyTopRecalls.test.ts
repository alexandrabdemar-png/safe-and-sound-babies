import { describe, expect, it, beforeEach } from "vitest";
import {
  formatLastUpdated,
  pickWeeklyTopRecalls,
  readWeeklyTopRecallsCache,
  writeWeeklyTopRecallsCache,
  WEEKLY_TOP_RECALLS_CACHE_KEY,
} from "./weeklyTopRecalls";
import type { RadarRecall } from "./recallRadarMerge";

const NOW = new Date("2026-09-22T12:00:00.000Z");

function recall(over: Partial<RadarRecall> & { id: string }): RadarRecall {
  return {
    source: "cpsc",
    title: "Recall",
    description: "",
    dateLabel: null,
    sortDate: NOW.getTime(),
    url: "https://example.com",
    official: true,
    lotPattern: null,
    ...over,
  };
}

describe("pickWeeklyTopRecalls", () => {
  it("keeps only recalls inside the 7-day window", () => {
    const fresh = recall({ id: "a", sortDate: NOW.getTime() - 2 * 86_400_000 });
    const old = recall({ id: "b", sortDate: NOW.getTime() - 40 * 86_400_000 });
    expect(pickWeeklyTopRecalls([fresh, old], NOW).map((r) => r.id)).toEqual(["a"]);
  });

  it("excludes curated critical alerts, which may be months old", () => {
    const critical = recall({
      id: "critical-x",
      source: "critical",
      sortDate: Number.MAX_SAFE_INTEGER,
    });
    const fresh = recall({ id: "a", sortDate: NOW.getTime() - 86_400_000 });
    expect(pickWeeklyTopRecalls([fresh, critical], NOW).map((r) => r.id)).toEqual([
      "critical-x",
      "a",
    ]);
  });

  it("drops undated rows and caps the list at three", () => {
    const undated = recall({ id: "undated", sortDate: 0 });
    const items = [1, 2, 3, 4].map((n) =>
      recall({ id: `r${n}`, sortDate: NOW.getTime() - n * 3_600_000 }),
    );
    const picked = pickWeeklyTopRecalls([undated, ...items], NOW);
    expect(picked).toHaveLength(3);
    expect(picked.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
  });
});

describe("weekly top recalls cache", () => {
  // Node test env has no localStorage; a tiny in-memory stand-in is enough.
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    };
  });

  it("round-trips a fresh cache", () => {
    writeWeeklyTopRecallsCache({ fetchedAt: NOW.toISOString(), recalls: [recall({ id: "a" })] });
    const read = readWeeklyTopRecallsCache(new Date(NOW.getTime() + 60_000));
    expect(read?.recalls.map((r) => r.id)).toEqual(["a"]);
  });

  it("treats an expired cache as missing", () => {
    writeWeeklyTopRecallsCache({ fetchedAt: NOW.toISOString(), recalls: [] });
    expect(readWeeklyTopRecallsCache(new Date(NOW.getTime() + 60 * 60_000))).toBeNull();
  });

  it("returns null for unparseable data", () => {
    localStorage.setItem(WEEKLY_TOP_RECALLS_CACHE_KEY, "not json");
    expect(readWeeklyTopRecallsCache(NOW)).toBeNull();
  });
});

describe("formatLastUpdated", () => {
  it("labels recent and older timestamps", () => {
    expect(formatLastUpdated(NOW.toISOString(), NOW)).toBe("Updated just now");
    expect(formatLastUpdated(new Date(NOW.getTime() - 25 * 60_000), NOW)).toBe(
      "Updated 25 minutes ago",
    );
    expect(formatLastUpdated(new Date(NOW.getTime() - 3 * 3_600_000), NOW)).toBe(
      "Updated 3 hours ago",
    );
    expect(formatLastUpdated(null, NOW)).toBe("Update time unavailable");
  });
});
