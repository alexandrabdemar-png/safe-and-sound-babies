import { describe, it, expect } from "vitest";
import { evaluateMilestoneTiming, milestoneTimingNote } from "./milestoneTiming";

describe("evaluateMilestoneTiming", () => {
  it("returns null when the milestone key is null (no typical-age data for this milestone)", () => {
    expect(evaluateMilestoneTiming(null, "2026-01-01", "2026-07-01")).toBeNull();
  });

  it("returns null when the child's date of birth is unknown", () => {
    expect(evaluateMilestoneTiming("crawling", null, "2026-07-01")).toBeNull();
  });

  it("classifies 'typical' when the age at logging falls inside the typical range", () => {
    // Crawling typical range is 6-10 months; born 2026-01-01, logged
    // exactly 8 months later.
    const result = evaluateMilestoneTiming("crawling", "2026-01-01", "2026-09-01");
    expect(result?.kind).toBe("typical");
  });

  it("classifies 'early' when the age at logging is below the typical minimum", () => {
    // Crawling typical range starts at 6 months; logged at ~3 months.
    const result = evaluateMilestoneTiming("crawling", "2026-01-01", "2026-04-01");
    expect(result?.kind).toBe("early");
    expect(result?.typicalMinMonths).toBe(6);
  });

  it("classifies 'late' when the age at logging is above the typical maximum", () => {
    // Crawling typical range ends at 10 months; logged at ~14 months.
    const result = evaluateMilestoneTiming("crawling", "2026-01-01", "2027-03-01");
    expect(result?.kind).toBe("late");
    expect(result?.typicalMaxMonths).toBe(10);
  });

  it("uses the milestone's own typical range, not a one-size-fits-all range", () => {
    // Same age (7 months) is typical for crawling (6-10) but early for
    // first_steps (9-15).
    const crawling = evaluateMilestoneTiming("crawling", "2026-01-01", "2026-08-01");
    const firstSteps = evaluateMilestoneTiming("first_steps", "2026-01-01", "2026-08-01");
    expect(crawling?.kind).toBe("typical");
    expect(firstSteps?.kind).toBe("early");
  });

  it("adjusts for a preemie's corrected age when a due date is provided", () => {
    // Born 8 weeks early (due 2026-03-01, born 2026-01-01). Chronological
    // age at 2026-04-01 is 3 months, but adjusted (corrected) age is
    // closer to 1 month — well below crawling's typical range either way,
    // but this confirms the adjusted flag and math actually engage.
    const result = evaluateMilestoneTiming("crawling", "2026-01-01", "2026-04-01", "2026-03-01");
    expect(result?.adjusted).toBe(true);
    expect(result?.kind).toBe("early");
  });
});

describe("milestoneTimingNote", () => {
  it("returns null for a typical-timing result (no note shown)", () => {
    const timing = evaluateMilestoneTiming("crawling", "2026-01-01", "2026-09-01");
    expect(milestoneTimingNote(timing)).toBeNull();
  });

  it("returns null when there's no timing data at all", () => {
    expect(milestoneTimingNote(null)).toBeNull();
  });

  it("returns a reassuring, non-alarming note for an early milestone", () => {
    const timing = evaluateMilestoneTiming("crawling", "2026-01-01", "2026-04-01");
    const note = milestoneTimingNote(timing);
    expect(note).not.toBeNull();
    expect(note).toContain("earlier than the typical range");
    expect(note).toContain("not something to worry about");
  });

  it("returns a reassuring note for a late milestone that doesn't imply concern", () => {
    const timing = evaluateMilestoneTiming("crawling", "2026-01-01", "2027-03-01");
    const note = milestoneTimingNote(timing);
    expect(note).not.toBeNull();
    expect(note).toContain("later than the typical range");
    expect(note).toContain("not a cause for concern");
  });

  it("mentions the adjustment when the child's age was corrected for prematurity", () => {
    const timing = evaluateMilestoneTiming("crawling", "2026-01-01", "2026-04-01", "2026-03-01");
    const note = milestoneTimingNote(timing);
    expect(note).toContain("adjusted for your due date");
  });
});
