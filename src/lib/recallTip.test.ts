import { describe, it, expect } from "vitest";
import { buildRecallTip } from "./recallTip";
import { selectDailyTip, SAFETY_TIPS } from "./safetyTips";

const wed = new Date(2026, 10, 11, 12);
const r = (daysAgo: number) => ({ id: "x", source: "CPSC", title: "Crib", description: "", dateLabel: null, sortDate: wed.getTime() - daysAgo * 86400000, url: "https://cpsc.gov/x", official: true, lotPattern: null });

describe("recall roundup tip", () => {
  it("shows a recall from the last 7 days on Wednesday", () => {
    expect(buildRecallTip([r(2)], wed)?.id).toBe("recall-x");
  });
  it("ignores recalls older than 7 days", () => {
    expect(buildRecallTip([r(10)], wed)).toBeNull();
  });
  it("only appears on Wednesdays", () => {
    expect(buildRecallTip([r(1)], new Date(2026, 10, 12, 12))).toBeNull();
  });
});

describe("seasonal tips", () => {
  it("never shows a seasonal tip outside its months", () => {
    for (let d = 0; d < 400; d++) {
      const t = selectDailyTip(null, d, null, null, null, 7);
      if (t.months) expect(t.months).toContain(7);
    }
  });
  it("has at least 150 tips so a year rarely repeats", () => {
    expect(SAFETY_TIPS.length).toBeGreaterThanOrEqual(150);
  });
});
