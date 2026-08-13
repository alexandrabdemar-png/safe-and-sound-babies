import { describe, it, expect } from "vitest";
import { computeBlockedRuleIds } from "./insightDismissals";

describe("computeBlockedRuleIds", () => {
  it("returns an empty set for no rows", () => {
    expect(computeBlockedRuleIds([])).toEqual(new Set());
  });

  it("blocks a rule marked done — this is the actual 'Mark as done, reload, stays hidden' behavior", () => {
    const blocked = computeBlockedRuleIds([{ rule_id: "replace:abc", action: "done", until: null }]);
    expect(blocked.has("replace:abc")).toBe(true);
  });

  it("blocks a rule marked dismissed", () => {
    const blocked = computeBlockedRuleIds([{ rule_id: "sizeup:xyz", action: "dismissed", until: null }]);
    expect(blocked.has("sizeup:xyz")).toBe(true);
  });

  it("blocks a snoozed rule whose until date is still in the future", () => {
    const future = new Date(Date.now() + 7 * 86400000).toISOString();
    const blocked = computeBlockedRuleIds([{ rule_id: "replace:abc", action: "snoozed", until: future }], new Date().toISOString());
    expect(blocked.has("replace:abc")).toBe(true);
  });

  it("does NOT block a snoozed rule whose until date has already passed — snooze expiring should let it reappear", () => {
    const past = new Date(Date.now() - 7 * 86400000).toISOString();
    const blocked = computeBlockedRuleIds([{ rule_id: "replace:abc", action: "snoozed", until: past }], new Date().toISOString());
    expect(blocked.has("replace:abc")).toBe(false);
  });

  it("does NOT block a snoozed rule with a null until (malformed row) — fails open rather than hiding forever", () => {
    const blocked = computeBlockedRuleIds([{ rule_id: "replace:abc", action: "snoozed", until: null }]);
    expect(blocked.has("replace:abc")).toBe(false);
  });

  it("only blocks the specific rule_id that was dismissed — a sibling product's alert must stay visible", () => {
    const blocked = computeBlockedRuleIds([{ rule_id: "replace:abc", action: "done", until: null }]);
    expect(blocked.has("replace:def")).toBe(false);
  });

  it("handles multiple rows for different rules independently", () => {
    const blocked = computeBlockedRuleIds([
      { rule_id: "replace:abc", action: "done", until: null },
      { rule_id: "sizeup:def", action: "dismissed", until: null },
      { rule_id: "replace:ghi", action: "snoozed", until: new Date(Date.now() - 1000).toISOString() },
    ]);
    expect(blocked.has("replace:abc")).toBe(true);
    expect(blocked.has("sizeup:def")).toBe(true);
    expect(blocked.has("replace:ghi")).toBe(false);
  });

  it("ignores an unrecognized action string rather than blocking by default", () => {
    const blocked = computeBlockedRuleIds([{ rule_id: "replace:abc", action: "some-future-action-type", until: null }]);
    expect(blocked.has("replace:abc")).toBe(false);
  });
});
