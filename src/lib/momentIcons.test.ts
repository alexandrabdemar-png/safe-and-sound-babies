import { describe, it, expect } from "vitest";
import {
  MOMENT_ICON_KEYS,
  MOMENT_ICON_LABELS,
  MOMENT_ICONS,
  DEFAULT_MOMENT_ICON,
  parseLegacyNotes,
  resolveMomentIcon,
} from "./momentIcons";

describe("MOMENT_ICON_KEYS", () => {
  it("has exactly the 7 requested icons", () => {
    expect(MOMENT_ICON_KEYS).toEqual([
      "bear",
      "feet",
      "waving",
      "star",
      "smiley",
      "heart",
      "target",
    ]);
  });

  it("every key has a label and an icon component", () => {
    for (const key of MOMENT_ICON_KEYS) {
      expect(MOMENT_ICON_LABELS[key]).toBeTruthy();
      expect(MOMENT_ICONS[key]).toBeTypeOf("function");
    }
  });
});

describe("parseLegacyNotes", () => {
  it("returns no legacy type and empty notes for null", () => {
    expect(parseLegacyNotes(null)).toEqual({ legacyType: null, displayNotes: "" });
  });

  it("strips a legacy [First] prefix and returns the type", () => {
    expect(parseLegacyNotes("[First] So sweet")).toEqual({
      legacyType: "First",
      displayNotes: "So sweet",
    });
  });

  it("strips a legacy [Funny] prefix", () => {
    expect(parseLegacyNotes("[Funny] lol")).toEqual({ legacyType: "Funny", displayNotes: "lol" });
  });

  it("strips a legacy [Milestone] prefix", () => {
    expect(parseLegacyNotes("[Milestone] big day")).toEqual({
      legacyType: "Milestone",
      displayNotes: "big day",
    });
  });

  it("leaves plain notes (no prefix) untouched with no legacy type", () => {
    expect(parseLegacyNotes("just some notes")).toEqual({
      legacyType: null,
      displayNotes: "just some notes",
    });
  });

  it("does not treat an arbitrary bracketed word as a legacy type", () => {
    expect(parseLegacyNotes("[Whatever] not a real type")).toEqual({
      legacyType: null,
      displayNotes: "[Whatever] not a real type",
    });
  });
});

describe("resolveMomentIcon", () => {
  it("uses the icon column when it's a valid key", () => {
    expect(resolveMomentIcon("bear", null)).toBe("bear");
    expect(resolveMomentIcon("heart", "First")).toBe("heart"); // icon column wins over legacy type
  });

  it("ignores an invalid/garbage icon column value", () => {
    expect(resolveMomentIcon("dinosaur", null)).toBe(DEFAULT_MOMENT_ICON);
  });

  it("falls back to the legacy type mapping when icon is null", () => {
    expect(resolveMomentIcon(null, "First")).toBe("star");
    expect(resolveMomentIcon(null, "Funny")).toBe("smiley");
    expect(resolveMomentIcon(null, "Milestone")).toBe("target");
  });

  it("falls back to the default when neither icon nor legacy type is present", () => {
    expect(resolveMomentIcon(null, null)).toBe(DEFAULT_MOMENT_ICON);
    expect(resolveMomentIcon(undefined, null)).toBe(DEFAULT_MOMENT_ICON);
  });

  it("regression: a pre-migration row with no icon and no notes prefix resolves to a sensible default rather than crashing", () => {
    // The exact shape of an old row saved before the icon column existed.
    const { legacyType } = parseLegacyNotes("just a plain note, no bracket prefix");
    expect(resolveMomentIcon(null, legacyType)).toBe(DEFAULT_MOMENT_ICON);
  });
});
