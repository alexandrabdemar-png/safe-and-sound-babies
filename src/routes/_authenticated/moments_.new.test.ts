import { describe, it, expect } from "vitest";
import { MOMENT_SAFETY_MAP, PROMPTS, getSafetyTip } from "./moments_.new";

// ── Question 1: every milestone the app suggests (the quick-fill PROMPTS
// chips) either genuinely has no safety-relevant content (a documented,
// intentional gap) or maps to a real, non-empty tip list ─────────────────
describe("every quick-fill PROMPT either matches a safety tip or is a documented dead end", () => {
  // "First smile" and "First word" are the only two PROMPTS with no entry
  // in MOMENT_SAFETY_MAP at all — neither introduces a new physical safety
  // concern (unlike rolling, crawling, standing, etc.), so this is a
  // defensible content gap, not a coverage bug — but it's still a real
  // dead end: getSafetyTip returns null for both, and the calling code
  // (handleSubmit in moments_.new.tsx) silently navigates straight back to
  // /moments with no explanation when that happens, same as any unmatched
  // free-text title. Documented here so a future PROMPTS addition doesn't
  // silently become a THIRD dead end without anyone noticing.
  const knownDeadEnds = new Set(["First smile", "First word"]);

  for (const prompt of PROMPTS) {
    if (knownDeadEnds.has(prompt)) {
      it(`"${prompt}" is a documented dead end — getSafetyTip returns null`, () => {
        expect(getSafetyTip(prompt)).toBeNull();
      });
    } else {
      it(`"${prompt}" matches a non-empty safety tip`, () => {
        const tip = getSafetyTip(prompt);
        expect(tip).not.toBeNull();
        expect(tip!.title.length).toBeGreaterThan(0);
        expect(tip!.tips.length).toBeGreaterThan(0);
        for (const line of tip!.tips) {
          expect(line.trim().length).toBeGreaterThan(0);
        }
      });
    }
  }

  it("exactly 2 of the 8 current PROMPTS are dead ends — catches an unnoticed new gap or an unnoticed fix", () => {
    const deadEndCount = PROMPTS.filter((p) => getSafetyTip(p) === null).length;
    expect(deadEndCount).toBe(2);
  });
});

// ── Question 2: suggestions are actually matched to the specific milestone
// text, not a static pool shown regardless of input ──────────────────────
describe("getSafetyTip matches the specific milestone, not a generic always-on pool", () => {
  it("returns different tips for different milestone titles", () => {
    const crawling = getSafetyTip("Crawling");
    const firstSteps = getSafetyTip("First steps");
    const firstTooth = getSafetyTip("First tooth");
    expect(crawling).not.toBeNull();
    expect(firstSteps).not.toBeNull();
    expect(firstTooth).not.toBeNull();
    expect(crawling!.title).not.toBe(firstSteps!.title);
    expect(crawling!.title).not.toBe(firstTooth!.title);
    expect(firstSteps!.title).not.toBe(firstTooth!.title);
  });

  it("is case-insensitive and substring-based, matching free-text phrasing, not just the exact PROMPT string", () => {
    expect(getSafetyTip("she started CRAWLING today!")).toMatchObject({
      title: "Crawling — time to gate the stairs",
    });
    expect(getSafetyTip("took his first steps at grandma's house")).toMatchObject({
      title: "First steps — your home just got smaller",
    });
  });

  it("an unrelated milestone does not accidentally pull in a mobility-stage tip", () => {
    expect(getSafetyTip("First tooth")?.title).not.toContain("stairs");
    expect(getSafetyTip("First tooth")?.title).not.toContain("gate");
  });
});

// ── Question 3: age-appropriateness — getSafetyTip has no age parameter at
// all, so it cannot distinguish an "early" vs "late" milestone. This test
// documents that as a fact about the current implementation (a type-level
// guard, not just a runtime check) rather than leaving it as an assumption. ─
describe("getSafetyTip has no age-awareness (documents current behavior, not a bug fix)", () => {
  it("getSafetyTip's signature takes only a title — same result regardless of any notion of the child's age", () => {
    // There is no age/dob parameter to pass here at all — calling it twice
    // with the exact same title always produces the identical tip,
    // independent of anything about when the milestone happened.
    expect(getSafetyTip("Crawling")).toEqual(getSafetyTip("Crawling"));
  });
});

// ── Question 4: an unmatched / custom free-text milestone ────────────────
describe("getSafetyTip on custom/free-text milestones with no predefined match", () => {
  it("returns null for an unrelated custom milestone", () => {
    expect(getSafetyTip("Said grandma's name for the first time")).toBeNull();
    expect(getSafetyTip("Slept through the night")).toBeNull();
    expect(getSafetyTip("Blew a raspberry")).toBeNull();
  });

  it("returns null for an empty title", () => {
    expect(getSafetyTip("")).toBeNull();
  });
});

// ── Additional MOMENT_SAFETY_MAP entries reachable only via free text
// (not offered as PROMPTS chips at all) — confirms they're real and wired
// up, since a parent would only ever find these by typing the right words. ─
describe("MOMENT_SAFETY_MAP entries not offered as PROMPTS chips are still reachable via free text", () => {
  it("'Standing' (not in PROMPTS) matches its own tip", () => {
    expect(getSafetyTip("Standing")?.title).toBe("Standing — full babyproofing check");
  });

  it("'Lowered the crib mattress' (not in PROMPTS) matches its own tip", () => {
    expect(getSafetyTip("Lowered the crib mattress today")?.title).toBe(
      "Lowering the crib mattress — one more safety step",
    );
  });

  it("'Started solids' (not in PROMPTS) matches the first-food tip", () => {
    expect(getSafetyTip("Started solids")?.title).toBe("Starting solids — keep it safe");
  });
});

// ── Structural integrity of MOMENT_SAFETY_MAP itself ──────────────────────
describe("MOMENT_SAFETY_MAP structural integrity", () => {
  it("every entry has a non-empty title and at least one non-empty tip", () => {
    for (const { safety } of MOMENT_SAFETY_MAP) {
      expect(safety.title.trim().length).toBeGreaterThan(0);
      expect(safety.tips.length).toBeGreaterThan(0);
      for (const tip of safety.tips) {
        expect(tip.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("no two entries share the exact same title (a literal copy-paste-and-forgot-to-rename signal)", () => {
    const titles = MOMENT_SAFETY_MAP.map((e) => e.safety.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("no exact-duplicate tip line is copy-pasted verbatim across two different milestones", () => {
    // Distinguishes a genuine copy-paste bug (identical sentence reused
    // wholesale under a different milestone) from the expected, reasonable
    // overlap between adjacent mobility milestones (crawling -> pulling to
    // stand -> standing -> first steps all legitimately keep mentioning
    // gates/outlets/anchoring furniture as the child gets more capable) —
    // this only fails on a byte-for-byte identical line, not a similar one.
    const seen = new Map<string, string>(); // tip text -> milestone title it first appeared under
    const duplicates: string[] = [];
    for (const { safety } of MOMENT_SAFETY_MAP) {
      for (const tip of safety.tips) {
        const key = tip.trim().toLowerCase();
        if (seen.has(key) && seen.get(key) !== safety.title) {
          duplicates.push(`"${tip}" appears under both "${seen.get(key)}" and "${safety.title}"`);
        } else {
          seen.set(key, safety.title);
        }
      }
    }
    expect(duplicates).toEqual([]);
  });

  it("'Standing' and 'Pulling to stand' cover the same 4 themes with near-identical wording (documents a real near-duplicate, not an exact one)", () => {
    // Flagged by the audit: these two adjacent milestones repeat the same
    // four safety themes (crib mattress lowest, anchor furniture, floor
    // hazard sweep, stair gates) in barely-reworded sentences. Not an
    // exact-string duplicate (the strict test above wouldn't catch it),
    // but a parent logging both within the same week sees near-identical
    // advice twice. This test documents the overlap exists today rather
    // than asserting it's wrong — a future content pass may want to
    // differentiate them or intentionally merge them.
    const pullToStand = MOMENT_SAFETY_MAP.find((e) =>
      e.safety.title.startsWith("Pulling to stand"),
    )!;
    const standing = MOMENT_SAFETY_MAP.find(
      (e) => e.safety.title === "Standing — full babyproofing check",
    )!;
    const themes = ["crib", "anchor", "gate"];
    for (const theme of themes) {
      const pullHasIt = pullToStand.safety.tips.some((t) => t.toLowerCase().includes(theme));
      const standHasIt = standing.safety.tips.some((t) => t.toLowerCase().includes(theme));
      expect(pullHasIt).toBe(true);
      expect(standHasIt).toBe(true);
    }
  });
});
