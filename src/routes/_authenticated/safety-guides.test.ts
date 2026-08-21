import { describe, it, expect } from "vitest";
import { SAFETY_MILESTONES } from "./safety-guides";

// Regression: 6 of 12 entries pointed at the exact same URL
// (https://www.aap.org/en/patient-care/safe-sleep/ — a safe-sleep page)
// regardless of their actual topic, a copy-paste leftover from the first
// entry. A parent tapping "Tummy time safety" or "First foods safety" to
// verify the guidance against the source landed on an unrelated safe-sleep
// page instead — the exact same class of bug already fixed once for recall
// "verify" links (see recallCheck.ts's recallFallbackUrl/recallVerifyLinkLabel).
describe("SAFETY_MILESTONES — every entry has its own, real source URL", () => {
  it("every entry has a sourceUrl set", () => {
    for (const m of SAFETY_MILESTONES) {
      expect(m.sourceUrl, `${m.title} is missing a sourceUrl`).toBeTruthy();
    }
  });

  it("every sourceUrl is a well-formed https:// link", () => {
    for (const m of SAFETY_MILESTONES) {
      expect(
        () => new URL(m.sourceUrl),
        `${m.title}'s sourceUrl "${m.sourceUrl}" is not a valid URL`,
      ).not.toThrow();
      expect(new URL(m.sourceUrl).protocol, m.title).toBe("https:");
    }
  });

  it("no two AAP-only entries share the same sourceUrl", () => {
    // CPSC and NHTSA entries legitimately share one hub URL across several
    // related topics (e.g. "Crawling & exploring" and "Pulling up &
    // walking" both point at CPSC's general childproofing hub) — that's a
    // real, correctly-shared landing page, not the bug. The bug was every
    // AAP-only entry (a dedicated HealthyChildren.org topic page per
    // subject) silently reusing one unrelated page regardless of topic.
    const aapOnly = SAFETY_MILESTONES.filter((m) => m.source === "AAP");
    const byUrl = new Map<string, string[]>();
    for (const m of aapOnly) {
      byUrl.set(m.sourceUrl, [...(byUrl.get(m.sourceUrl) ?? []), m.title]);
    }
    const duplicated = [...byUrl.entries()].filter(([, titles]) => titles.length > 1);
    expect(
      duplicated,
      `these entries wrongly share one sourceUrl: ${JSON.stringify(duplicated)}`,
    ).toEqual([]);
  });

  it("every sourceUrl resolves to an AAP-family domain (aap.org or healthychildren.org), never a lookalike", () => {
    for (const m of SAFETY_MILESTONES) {
      const host = new URL(m.sourceUrl).hostname.toLowerCase();
      const isAapFamily =
        host === "aap.org" ||
        host.endsWith(".aap.org") ||
        host === "healthychildren.org" ||
        host.endsWith(".healthychildren.org");
      const isCpscOrNhtsa =
        host === "cpsc.gov" ||
        host.endsWith(".cpsc.gov") ||
        host === "nhtsa.gov" ||
        host.endsWith(".nhtsa.gov");
      expect(
        isAapFamily || isCpscOrNhtsa,
        `${m.title}'s sourceUrl host "${host}" isn't a recognized source domain`,
      ).toBe(true);
    }
  });
});
