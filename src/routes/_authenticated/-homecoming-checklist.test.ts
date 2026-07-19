import { describe, expect, it } from "vitest";
import { HOMECOMING_SECTIONS } from "./homecoming-checklist";

describe("HOMECOMING_SECTIONS", () => {
  const allItems = HOMECOMING_SECTIONS.flatMap((s) => s.items);
  const allKeys = allItems.map((i) => i.key);

  it("has at least one section, each with at least one item", () => {
    expect(HOMECOMING_SECTIONS.length).toBeGreaterThan(0);
    for (const section of HOMECOMING_SECTIONS) {
      expect(section.items.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate item keys across sections", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const key of allKeys) {
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it("has no duplicate section ids", () => {
    const ids = HOMECOMING_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every item key is prefixed with home_ to avoid colliding with other checklists' completion keys", () => {
    for (const key of allKeys) {
      expect(key.startsWith("home_")).toBe(true);
    }
  });

  it("every item and section has non-empty label text", () => {
    for (const section of HOMECOMING_SECTIONS) {
      expect(section.label.trim().length).toBeGreaterThan(0);
      for (const item of section.items) {
        expect(item.label.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
