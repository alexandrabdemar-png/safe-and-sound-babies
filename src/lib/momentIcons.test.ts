import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import {
  MOMENT_ICON_KEYS,
  MOMENT_ICON_LABELS,
  MOMENT_ICONS,
  DEFAULT_MOMENT_ICON,
  parseLegacyNotes,
  resolveMomentIcon,
  isIconColumnUnavailableError,
  fetchMilestonesResilient,
} from "./momentIcons";

// Minimal thenable chain mimicking Supabase's query builder — every
// intermediate call (select/eq/order/limit) returns the same object, and
// `await`-ing it at any point resolves to the given {data, error}.
function makeChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (v: typeof result) => void) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

describe("MOMENT_ICON_KEYS", () => {
  it("has exactly the 4 requested icons (bear/feet/waving removed per user feedback)", () => {
    expect(MOMENT_ICON_KEYS).toEqual(["star", "smiley", "heart", "target"]);
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
    expect(resolveMomentIcon("heart", null)).toBe("heart");
    expect(resolveMomentIcon("heart", "First")).toBe("heart"); // icon column wins over legacy type
  });

  it("ignores an invalid/garbage icon column value", () => {
    expect(resolveMomentIcon("dinosaur", null)).toBe(DEFAULT_MOMENT_ICON);
  });

  it("regression: a value valid under the old 7-icon set (bear/feet/waving, now removed) falls back to the default rather than crashing", () => {
    expect(resolveMomentIcon("bear", null)).toBe(DEFAULT_MOMENT_ICON);
    expect(resolveMomentIcon("feet", null)).toBe(DEFAULT_MOMENT_ICON);
    expect(resolveMomentIcon("waving", null)).toBe(DEFAULT_MOMENT_ICON);
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

describe("isIconColumnUnavailableError", () => {
  it("regression: matches the EXACT error message reported live (1st report) — PostgREST schema-cache wording", () => {
    // A prior version of this check used a regex ordered "column ... icon
    // ... schema cache", which never matches this real PostgREST message
    // (icon comes BEFORE column in the actual wording) — caught by this
    // exact-string test during self-review before it shipped.
    expect(
      isIconColumnUnavailableError({
        message: "Could not find the 'icon' column of 'milestones' in the schema cache",
      }),
    ).toBe(true);
  });

  it("regression: matches the EXACT error message reported live (2nd report) — raw Postgres undefined_column wording", () => {
    // The schema-cache-only check missed this second live report entirely
    // (no "schema cache" substring), so moments kept failing to save.
    expect(isIconColumnUnavailableError({ message: "column milestones.icon does not exist" })).toBe(
      true,
    );
  });

  it("matches by Postgres error code (42703 / undefined_column) even with unrelated message wording", () => {
    expect(isIconColumnUnavailableError({ message: "icon: some odd wording", code: "42703" })).toBe(
      true,
    );
  });

  it("matches regardless of quoting/wording variations, as long as icon + (schema cache | does not exist) both appear", () => {
    expect(
      isIconColumnUnavailableError({ message: "column icon does not exist in schema cache" }),
    ).toBe(true);
    expect(isIconColumnUnavailableError({ message: "ICON column missing from Schema Cache" })).toBe(
      true,
    );
  });

  it("does not match unrelated errors", () => {
    expect(
      isIconColumnUnavailableError({ message: "duplicate key value violates unique constraint" }),
    ).toBe(false);
    expect(
      isIconColumnUnavailableError({ message: "new row violates row-level security policy" }),
    ).toBe(false);
    expect(
      isIconColumnUnavailableError({
        message: "Could not find the 'notes' column in the schema cache",
      }),
    ).toBe(false);
    expect(
      isIconColumnUnavailableError({ message: "column milestones.notes does not exist" }),
    ).toBe(false);
  });
});

describe("fetchMilestonesResilient", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("returns data directly, with a single query, when the icon-inclusive select succeeds", async () => {
    const row = {
      id: "1",
      title: "First smile",
      logged_at: "2026-07-01",
      notes: null,
      icon: "star",
    };
    mockFrom.mockReturnValue(makeChain({ data: [row], error: null }));

    const result = await fetchMilestonesResilient("child-1");

    expect(result).toEqual({ data: [row], error: null });
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("regression: retries without icon when the live icon-column-unavailable error occurs, defaulting icon to null — this is the actual live bug reported twice", async () => {
    const failing = makeChain({
      data: null,
      error: { message: "column milestones.icon does not exist", code: "42703" },
    });
    const retryRow = { id: "2", title: "Rolled over", logged_at: "2026-07-02", notes: "so proud" };
    const succeeding = makeChain({ data: [retryRow], error: null });
    mockFrom.mockReturnValueOnce(failing).mockReturnValueOnce(succeeding);

    const result = await fetchMilestonesResilient("child-1");

    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ ...retryRow, icon: null }]);
  });

  it("does NOT retry and surfaces the error as-is when it's unrelated to the icon column (e.g. RLS denial)", async () => {
    const denied = makeChain({
      data: null,
      error: { message: "permission denied for table milestones" },
    });
    mockFrom.mockReturnValue(denied);

    const result = await fetchMilestonesResilient("child-1");

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(result.data).toBeNull();
    expect(result.error).toEqual({ message: "permission denied for table milestones" });
  });

  it("passes the limit option through to both the primary and the fallback query", async () => {
    const failing = makeChain({
      data: null,
      error: { message: "column milestones.icon does not exist" },
    });
    const succeeding = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(failing).mockReturnValueOnce(succeeding);

    await fetchMilestonesResilient("child-1", { limit: 5 });

    expect(failing.limit).toHaveBeenCalledWith(5);
    expect(succeeding.limit).toHaveBeenCalledWith(5);
  });

  it("does not call limit() at all when no limit option is given", async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));

    await fetchMilestonesResilient("child-1");

    const chain = mockFrom.mock.results[0].value;
    expect(chain.limit).not.toHaveBeenCalled();
  });

  it("still returns an error (not a crash) if the fallback retry ALSO fails", async () => {
    const failing1 = makeChain({
      data: null,
      error: { message: "column milestones.icon does not exist" },
    });
    const failing2 = makeChain({
      data: null,
      error: { message: 'relation "milestones" does not exist' },
    });
    mockFrom.mockReturnValueOnce(failing1).mockReturnValueOnce(failing2);

    const result = await fetchMilestonesResilient("child-1");

    expect(result.data).toBeNull();
    expect(result.error).toEqual({ message: 'relation "milestones" does not exist' });
  });
});
