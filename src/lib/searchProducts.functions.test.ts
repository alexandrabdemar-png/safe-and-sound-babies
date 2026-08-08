import { describe, expect, it } from "vitest";
import { extractJsonArrayText, parseSearchResults, sanitizeSearchResult } from "./searchProducts.functions";

describe("extractJsonArrayText", () => {
  it("extracts a clean, unwrapped JSON array", () => {
    expect(extractJsonArrayText('[{"name":"Foo"}]')).toBe('[{"name":"Foo"}]');
  });

  it("extracts from a ```json fenced block", () => {
    const raw = '```json\n[{"name":"Foo"}]\n```';
    expect(extractJsonArrayText(raw)).toBe('[{"name":"Foo"}]');
  });

  it("extracts from a plain ``` fence with no language tag", () => {
    const raw = '```\n[{"name":"Foo"}]\n```';
    expect(extractJsonArrayText(raw)).toBe('[{"name":"Foo"}]');
  });

  it("regression: extracts the array even with a leading preamble sentence outside any fence", () => {
    // The reported bug: the model ignores "no explanation" and prefaces the
    // array with prose. The old anchored-regex implementation failed on
    // this exact shape, silently returning zero results for a real search
    // like "Tommee Tippee pacifier".
    const raw = 'Sure, here are the matches:\n[{"name":"Tommee Tippee Ultra-Light Silicone Soother","brand":"Tommee Tippee"}]';
    expect(extractJsonArrayText(raw)).toBe(
      '[{"name":"Tommee Tippee Ultra-Light Silicone Soother","brand":"Tommee Tippee"}]',
    );
  });

  it("regression: extracts the array when a preamble sentence precedes a fenced block", () => {
    const raw = 'Sure, here are the matches:\n```json\n[{"name":"Tommee Tippee Ultra-Light Silicone Soother"}]\n```';
    expect(extractJsonArrayText(raw)).toBe(
      '[{"name":"Tommee Tippee Ultra-Light Silicone Soother"}]',
    );
  });

  it("extracts the array even with trailing prose after it", () => {
    const raw = '[{"name":"Foo"}]\nLet me know if you need more!';
    expect(extractJsonArrayText(raw)).toBe('[{"name":"Foo"}]');
  });

  it("returns null when there is no array at all", () => {
    expect(extractJsonArrayText("Sorry, I don't have information on that product.")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractJsonArrayText("")).toBeNull();
  });

  it("returns null when brackets are present but reversed (] before [)", () => {
    expect(extractJsonArrayText("] some text [")).toBeNull();
  });
});

describe("sanitizeSearchResult", () => {
  it("passes through a fully well-formed item unchanged", () => {
    const item = {
      name: "Tommee Tippee Ultra-Light Silicone Soother",
      brand: "Tommee Tippee",
      category: "pacifier",
      model: "0-6m",
      safe_use_duration_days: 42,
      safe_use_notes: "Replace every 4–6 weeks or at first sign of wear",
      age_range: "0–6 months",
      cpsc_product_type: "Pacifiers",
    };
    expect(sanitizeSearchResult(item)).toEqual(item);
  });

  it("drops an item with no name", () => {
    expect(sanitizeSearchResult({ brand: "Tommee Tippee" })).toBeNull();
  });

  it("drops an item whose name is only whitespace", () => {
    expect(sanitizeSearchResult({ name: "   " })).toBeNull();
  });

  it("drops a non-object item (string, number, null, array)", () => {
    expect(sanitizeSearchResult("Tommee Tippee")).toBeNull();
    expect(sanitizeSearchResult(42)).toBeNull();
    expect(sanitizeSearchResult(null)).toBeNull();
    expect(sanitizeSearchResult(["Tommee Tippee"])).toBeNull();
  });

  it("coerces a numeric string safe_use_duration_days to a number", () => {
    const result = sanitizeSearchResult({ name: "Foo", safe_use_duration_days: "42" });
    expect(result?.safe_use_duration_days).toBe(42);
  });

  it("falls back to 0 for a non-numeric safe_use_duration_days", () => {
    const result = sanitizeSearchResult({ name: "Foo", safe_use_duration_days: "not a number" });
    expect(result?.safe_use_duration_days).toBe(0);
  });

  it("falls back to empty string for wrong-typed string fields instead of throwing", () => {
    const result = sanitizeSearchResult({ name: "Foo", brand: 12345, category: null, model: true });
    expect(result).toEqual({
      name: "Foo",
      brand: "",
      category: "",
      model: "",
      safe_use_duration_days: 0,
      safe_use_notes: "",
      age_range: "",
      cpsc_product_type: "",
    });
  });

  it("trims whitespace from the name", () => {
    expect(sanitizeSearchResult({ name: "  Tommee Tippee Soother  " })?.name).toBe(
      "Tommee Tippee Soother",
    );
  });
});

describe("parseSearchResults", () => {
  it("parses a clean array response", () => {
    const raw = '[{"name":"Tommee Tippee Ultra-Light Silicone Soother","brand":"Tommee Tippee"}]';
    const results = parseSearchResults(raw);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Tommee Tippee Ultra-Light Silicone Soother");
    expect(results[0].brand).toBe("Tommee Tippee");
  });

  it("regression: parses results even when the model adds a preamble sentence (the reported bug)", () => {
    const raw =
      'Sure, here are the matches:\n```json\n[{"name":"Tommee Tippee Ultra-Light Silicone Soother","brand":"Tommee Tippee","category":"pacifier"}]\n```';
    const results = parseSearchResults(raw);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Tommee Tippee Ultra-Light Silicone Soother");
  });

  it("parses multiple results and drops any that have no name", () => {
    const raw = JSON.stringify([
      { name: "Tommee Tippee Closer to Nature Bottle", brand: "Tommee Tippee" },
      { brand: "No Name Co" },
      { name: "Tommee Tippee Soother", brand: "Tommee Tippee" },
    ]);
    const results = parseSearchResults(raw);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.name)).toEqual([
      "Tommee Tippee Closer to Nature Bottle",
      "Tommee Tippee Soother",
    ]);
  });

  it("returns an empty array (never throws) for completely non-JSON text", () => {
    expect(parseSearchResults("I couldn't find any matches for that query.")).toEqual([]);
  });

  it("returns an empty array for a JSON object instead of an array", () => {
    expect(parseSearchResults('{"name":"Foo"}')).toEqual([]);
  });

  it("returns an empty array for malformed JSON inside brackets", () => {
    expect(parseSearchResults("[{name: Foo, unquoted: true}]")).toEqual([]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseSearchResults("")).toEqual([]);
  });

  it("returns an empty array for a valid empty JSON array (genuinely no matches)", () => {
    expect(parseSearchResults("[]")).toEqual([]);
  });
});
