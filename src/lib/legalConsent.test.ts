import { describe, it, expect } from "vitest";
import { needsLegalConsent, CURRENT_TERMS_VERSION } from "./legalConsent";

describe("needsLegalConsent", () => {
  it("returns true when the user has never accepted anything", () => {
    expect(needsLegalConsent([])).toBe(true);
  });

  it("returns true when the user only accepted an older version", () => {
    expect(needsLegalConsent(["2026-01-01"])).toBe(true);
  });

  it("returns false when the current version is among the accepted ones", () => {
    expect(needsLegalConsent([CURRENT_TERMS_VERSION])).toBe(false);
  });

  it("returns false when the current version is accepted alongside older ones", () => {
    expect(needsLegalConsent(["2026-01-01", CURRENT_TERMS_VERSION])).toBe(false);
  });
});
