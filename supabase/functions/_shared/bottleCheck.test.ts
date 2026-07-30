import { describe, expect, it } from "vitest";
import {
  bottleTypeLabel,
  buildBottleNotification,
  findBottleMatches,
  needsBottleNotification,
  type BottleRow,
} from "./bottleCheck.ts";

function bottle(overrides: Partial<BottleRow> = {}): BottleRow {
  return {
    id: "b1",
    user_id: "u1",
    child_id: "c1",
    bottle_type: "formula_prepared",
    expires_at: "2026-07-04T14:00:00.000Z",
    alert_minutes_before: 60,
    finished_at: null,
    notified_at: null,
    ...overrides,
  };
}

describe("needsBottleNotification", () => {
  const expiresAt = "2026-07-04T14:00:00.000Z"; // 2:00 PM UTC
  const alertMinutes = 60; // alert window opens at 1:00 PM UTC

  it("is false before the alert window opens", () => {
    const b = bottle({ expires_at: expiresAt, alert_minutes_before: alertMinutes });
    expect(needsBottleNotification(b, new Date("2026-07-04T12:59:59.000Z"))).toBe(false);
  });

  it("is true exactly at the alert threshold (inclusive)", () => {
    const b = bottle({ expires_at: expiresAt, alert_minutes_before: alertMinutes });
    expect(needsBottleNotification(b, new Date("2026-07-04T13:00:00.000Z"))).toBe(true);
  });

  it("is true after the bottle has fully expired", () => {
    const b = bottle({ expires_at: expiresAt, alert_minutes_before: alertMinutes });
    expect(needsBottleNotification(b, new Date("2026-07-05T00:00:00.000Z"))).toBe(true);
  });

  it("is false once the bottle has been marked finished (used), even past the threshold", () => {
    const b = bottle({
      expires_at: expiresAt,
      alert_minutes_before: alertMinutes,
      finished_at: "2026-07-04T13:30:00.000Z",
    });
    expect(needsBottleNotification(b, new Date("2026-07-04T15:00:00.000Z"))).toBe(false);
  });

  it("is false once already notified, even if still past the threshold (no duplicate alerts)", () => {
    const b = bottle({
      expires_at: expiresAt,
      alert_minutes_before: alertMinutes,
      notified_at: "2026-07-04T13:05:00.000Z",
    });
    expect(needsBottleNotification(b, new Date("2026-07-04T15:00:00.000Z"))).toBe(false);
  });

  it("respects a short 15-minute lead time (shortest option offered in the UI)", () => {
    const b = bottle({ expires_at: expiresAt, alert_minutes_before: 15 });
    expect(needsBottleNotification(b, new Date("2026-07-04T13:44:00.000Z"))).toBe(false);
    expect(needsBottleNotification(b, new Date("2026-07-04T13:45:00.000Z"))).toBe(true);
  });

  it("respects a long 120-minute lead time (longest option offered in the UI)", () => {
    const b = bottle({ expires_at: expiresAt, alert_minutes_before: 120 });
    expect(needsBottleNotification(b, new Date("2026-07-04T11:59:00.000Z"))).toBe(false);
    expect(needsBottleNotification(b, new Date("2026-07-04T12:00:00.000Z"))).toBe(true);
  });
});

describe("findBottleMatches", () => {
  const now = new Date("2026-07-04T13:00:00.000Z");

  it("returns only bottles that are past their alert threshold, unfinished, and not yet notified", () => {
    const bottles: BottleRow[] = [
      bottle({ id: "due", expires_at: "2026-07-04T13:30:00.000Z", alert_minutes_before: 60 }), // threshold 12:30, past
      bottle({ id: "not-yet", expires_at: "2026-07-05T13:30:00.000Z", alert_minutes_before: 60 }), // threshold tomorrow
      bottle({
        id: "finished",
        expires_at: "2026-07-04T13:30:00.000Z",
        alert_minutes_before: 60,
        finished_at: "2026-07-04T12:00:00.000Z",
      }),
      bottle({
        id: "already-notified",
        expires_at: "2026-07-04T13:30:00.000Z",
        alert_minutes_before: 60,
        notified_at: "2026-07-04T12:35:00.000Z",
      }),
    ];

    const matches = findBottleMatches(bottles, now);

    expect(matches.map((m) => m.id)).toEqual(["due"]);
  });

  it("returns an empty array when nothing is due", () => {
    const bottles: BottleRow[] = [bottle({ id: "b1", expires_at: "2026-07-05T13:30:00.000Z" })];
    expect(findBottleMatches(bottles, now)).toEqual([]);
  });

  it("returns multiple matches across different users in one pass", () => {
    const bottles: BottleRow[] = [
      bottle({ id: "b1", user_id: "u1", expires_at: "2026-07-04T13:30:00.000Z" }),
      bottle({ id: "b2", user_id: "u2", expires_at: "2026-07-04T13:45:00.000Z" }),
    ];
    const matches = findBottleMatches(bottles, now);
    expect(matches.map((m) => m.id).sort()).toEqual(["b1", "b2"]);
  });
});

describe("bottleTypeLabel", () => {
  it("labels every known bottle type", () => {
    expect(bottleTypeLabel("breastmilk_fresh")).toBe("Freshly pumped breastmilk");
    expect(bottleTypeLabel("breastmilk_thawed")).toBe("Thawed breastmilk");
    expect(bottleTypeLabel("formula_prepared")).toBe("Prepared formula");
    expect(bottleTypeLabel("formula_opened")).toBe("Opened ready-to-feed formula");
  });

  it("falls back to a generic label for an unrecognized type rather than showing something broken", () => {
    expect(bottleTypeLabel("mystery_type")).toBe("A bottle");
  });
});

describe("buildBottleNotification", () => {
  it("uses 'past its window' phrasing once the bottle has actually expired", () => {
    const b = bottle({ expires_at: "2026-07-04T13:00:00.000Z" });
    const { title, body } = buildBottleNotification(b, new Date("2026-07-04T13:30:00.000Z"));
    expect(title).toContain("past its window");
    expect(body).toContain("reached its estimated use-by window");
  });

  it("uses 'closing soon' phrasing when notifying ahead of the actual expiration", () => {
    const b = bottle({ expires_at: "2026-07-04T14:00:00.000Z", alert_minutes_before: 60 });
    const { title, body } = buildBottleNotification(b, new Date("2026-07-04T13:00:00.000Z"));
    expect(title).toContain("closing soon");
    expect(body).toContain("approaching its estimated use-by window");
  });

  it("includes the bottle type label in the title", () => {
    const b = bottle({ bottle_type: "breastmilk_thawed", expires_at: "2026-07-04T14:00:00.000Z" });
    const { title } = buildBottleNotification(b, new Date("2026-07-04T13:00:00.000Z"));
    expect(title).toContain("Thawed breastmilk");
  });
});
