import { describe, it, expect } from "vitest";
import { isValidFeedbackType, buildFeedbackEmail } from "./feedback";

describe("isValidFeedbackType", () => {
  it("accepts the three known feedback types", () => {
    expect(isValidFeedbackType("Bug report")).toBe(true);
    expect(isValidFeedbackType("Feature request")).toBe(true);
    expect(isValidFeedbackType("General feedback")).toBe(true);
  });

  it("rejects anything else, including case variants and non-strings", () => {
    expect(isValidFeedbackType("bug report")).toBe(false);
    expect(isValidFeedbackType("Spam")).toBe(false);
    expect(isValidFeedbackType(undefined)).toBe(false);
    expect(isValidFeedbackType(null)).toBe(false);
    expect(isValidFeedbackType(123)).toBe(false);
  });
});

describe("buildFeedbackEmail", () => {
  it("includes the type, sender, app version, and message body", () => {
    const { subject, text } = buildFeedbackEmail(
      "Bug report",
      "The recall alert badge shows the wrong count.",
      "1.4.2",
      "parent@example.com",
    );
    expect(subject).toContain("Bug report");
    expect(text).toContain("Type: Bug report");
    expect(text).toContain("From: parent@example.com");
    expect(text).toContain("App version: 1.4.2");
    expect(text).toContain("The recall alert badge shows the wrong count.");
  });

  it("falls back gracefully when the user has no email or the app version is unknown", () => {
    const { text } = buildFeedbackEmail("General feedback", "Love the app!", null, null);
    expect(text).toContain("From: unknown / not signed in");
    expect(text).toContain("App version: unknown");
  });
});
