import { describe, it, expect } from "vitest";
import { recallSnippet, recallDetailsFallback } from "./alerts";

// A UX walkthrough flagged that FDA-sourced recalls and the hardcoded
// "critical" list never populate hazard/remedy (see recallBatch.ts's
// fdaRecallToCatalogRow / criticalRecallToCatalogRow — both set both
// fields to null), so those recall cards previously showed only a title
// and a "Read details" link, no actionable detail at all — the exact
// "just says recall found" failure mode the walkthrough asked about.
// These fallbacks fix that by using `description`, which every source
// populates.

describe("recallSnippet", () => {
  it("prefers hazard when present", () => {
    expect(
      recallSnippet({
        hazard: "Choking hazard",
        description: "Some description",
        title: "Recall Title",
      }),
    ).toBe("Choking hazard");
  });

  it("falls back to description when hazard is null (the FDA/critical case)", () => {
    expect(
      recallSnippet({ hazard: null, description: "Reason for recall text", title: "Recall Title" }),
    ).toBe("Reason for recall text");
  });

  it("falls back to title only when both hazard and description are null", () => {
    expect(recallSnippet({ hazard: null, description: null, title: "Recall Title" })).toBe(
      "Recall Title",
    );
  });

  it("does not fall back past hazard when hazard is present but description is also present", () => {
    // Regression guard: confirms this doesn't accidentally prefer the
    // longer/more detailed field over the more specific one.
    expect(
      recallSnippet({ hazard: "Fall hazard", description: "Long description", title: "T" }),
    ).toBe("Fall hazard");
  });
});

describe("recallDetailsFallback", () => {
  it("returns null when hazard is present (RecallCard already shows a Hazard line)", () => {
    expect(
      recallDetailsFallback({ hazard: "Choking hazard", remedy: null, description: "desc" }),
    ).toBeNull();
  });

  it("returns null when remedy is present (RecallCard already shows a What to do line)", () => {
    expect(
      recallDetailsFallback({
        hazard: null,
        remedy: "Stop using immediately",
        description: "desc",
      }),
    ).toBeNull();
  });

  it("returns null when both hazard and remedy are present", () => {
    expect(
      recallDetailsFallback({
        hazard: "Choking hazard",
        remedy: "Stop using",
        description: "desc",
      }),
    ).toBeNull();
  });

  it("returns the description when both hazard and remedy are missing (the FDA/critical case)", () => {
    expect(
      recallDetailsFallback({ hazard: null, remedy: null, description: "Reason for recall text" }),
    ).toBe("Reason for recall text");
  });

  it("returns null (not an empty string) when hazard, remedy, AND description are all missing", () => {
    expect(recallDetailsFallback({ hazard: null, remedy: null, description: null })).toBeNull();
  });
});
