import { describe, it, expect } from "vitest";
import { computeAdjustedAge, weeksEarly, reminderAgeWeeks, adjustedAgeDisclaimer } from "./adjustedAge";

const dob = "2026-05-01"; // reference DOB
const now = new Date("2026-11-01T00:00:00Z"); // ~6 months chronological

describe("adjustedAge", () => {
  it("returns null when DOB is missing", () => {
    expect(computeAdjustedAge({ dateOfBirth: null, now })).toBeNull();
    expect(weeksEarly({ dateOfBirth: null })).toBeNull();
  });

  it("no correction for a term baby (no dueDate/birthWeek)", () => {
    const r = computeAdjustedAge({ dateOfBirth: dob, now })!;
    expect(r.correctionActive).toBe(false);
    expect(r.adjustedDays).toBe(r.chronologicalDays);
  });

  it("no correction when due date == DOB (term)", () => {
    const r = computeAdjustedAge({ dateOfBirth: dob, dueDate: dob, now })!;
    expect(r.weeksEarly).toBe(0);
    expect(r.correctionActive).toBe(false);
  });

  it("subtracts weeks early when dueDate is later than DOB (preemie)", () => {
    // Baby born 2026-05-01, was due 2026-06-26 → 8 weeks early
    const r = computeAdjustedAge({ dateOfBirth: dob, dueDate: "2026-06-26", now })!;
    expect(r.weeksEarly).toBe(8);
    expect(r.isPreemie).toBe(true);
    expect(r.correctionActive).toBe(true);
    expect(r.correctionDays).toBe(56);
    expect(r.adjustedDays).toBe(r.chronologicalDays - 56);
  });

  it("falls back to birthWeek when no dueDate is provided", () => {
    const r = computeAdjustedAge({ dateOfBirth: dob, birthWeek: 32, now })!;
    expect(r.weeksEarly).toBe(8);
    expect(r.correctionActive).toBe(true);
  });

  it("prefers dueDate over birthWeek if both provided", () => {
    const r = computeAdjustedAge({
      dateOfBirth: dob,
      dueDate: "2026-06-05", // 5 weeks early
      birthWeek: 30, // would say 10 weeks early
      now,
    })!;
    expect(r.weeksEarly).toBe(5);
  });

  it("stops correcting after 24 months chronological", () => {
    const r = computeAdjustedAge({
      dateOfBirth: "2024-01-01",
      dueDate: "2024-03-01",
      now: new Date("2026-06-01T00:00:00Z"),
    })!;
    expect(r.isPreemie).toBe(true);
    expect(r.correctionActive).toBe(false);
    expect(r.adjustedDays).toBe(r.chronologicalDays);
  });

  it("under 3 weeks early is not considered preemie", () => {
    const r = computeAdjustedAge({ dateOfBirth: dob, birthWeek: 38, now })!;
    expect(r.isPreemie).toBe(false);
    expect(r.correctionActive).toBe(false);
  });

  it("reminderAgeWeeks uses adjusted weeks for a preemie", () => {
    const chrono = reminderAgeWeeks({ dateOfBirth: dob, now })!;
    const adj = reminderAgeWeeks({ dateOfBirth: dob, dueDate: "2026-06-26", now })!;
    expect(adj).toBeLessThan(chrono);
    expect(chrono - adj).toBe(8);
  });

  it("adjustedAgeDisclaimer returns copy for a preemie, null otherwise", () => {
    expect(adjustedAgeDisclaimer({ dateOfBirth: dob, dueDate: "2026-06-26", now })).toMatch(
      /adjusted age \(8 weeks early\)/,
    );
    expect(adjustedAgeDisclaimer({ dateOfBirth: dob, now })).toBeNull();
  });
});
