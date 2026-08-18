import { describe, expect, it } from "vitest";
import {
  bottlesSummary,
  checklistsSummary,
  firstFoodsSummary,
  formatRelativeTime,
  momentsSummary,
} from "./trackingSummaries";

const NOW = new Date("2026-08-12T21:00:00Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("formatRelativeTime", () => {
  it("returns null for missing or invalid input", () => {
    expect(formatRelativeTime(null, NOW)).toBeNull();
    expect(formatRelativeTime("not-a-date", NOW)).toBeNull();
  });

  it("formats recent times", () => {
    expect(formatRelativeTime(ago(10_000), NOW)).toBe("just now");
    expect(formatRelativeTime(ago(20 * 60_000), NOW)).toBe("20m ago");
    expect(formatRelativeTime(ago(3 * 3600_000), NOW)).toBe("3h ago");
    expect(formatRelativeTime(ago(26 * 3600_000), NOW)).toBe("yesterday");
    expect(formatRelativeTime(ago(5 * 86400_000), NOW)).toBe("5d ago");
    expect(formatRelativeTime(ago(70 * 86400_000), NOW)).toBe("2mo ago");
  });
});

describe("summaries", () => {
  it("first foods pluralises and mentions allergens", () => {
    expect(firstFoodsSummary(0, 0)).toMatch(/Nothing logged yet/);
    expect(firstFoodsSummary(1, 0)).toBe("1 food introduced");
    expect(firstFoodsSummary(14, 1)).toBe("14 foods introduced · 1 allergen tried");
  });

  it("bottles prefers active count then last bottle", () => {
    expect(bottlesSummary(2, ago(3600_000), NOW)).toBe("2 bottles in the safe-use window");
    expect(bottlesSummary(0, ago(2 * 3600_000), NOW)).toBe("Last bottle 2h ago");
    expect(bottlesSummary(0, null, NOW)).toBe("No bottles logged yet");
  });

  it("moments shows count and latest", () => {
    expect(momentsSummary(0, null, NOW)).toMatch(/No moments yet/);
    expect(momentsSummary(3, ago(86400_000 * 3), NOW)).toBe("3 moments · latest 3d ago");
    expect(momentsSummary(1, null, NOW)).toBe("1 moment");
  });

  it("checklists falls back to its blurb when nothing is checked", () => {
    expect(checklistsSummary(0)).toMatch(/babyproofing/);
    expect(checklistsSummary(1)).toBe("1 item checked off");
    expect(checklistsSummary(7)).toBe("7 items checked off");
  });
});
