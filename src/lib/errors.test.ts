import { describe, it, expect } from "vitest";
import { friendlyError, isSchemaMissingTableError } from "./errors";

describe("isSchemaMissingTableError", () => {
  it("regression: matches the EXACT error message reported live for first_foods", () => {
    expect(
      isSchemaMissingTableError({
        message: "Could not find the table 'public.first_foods' in the schema cache",
      }),
    ).toBe(true);
  });

  it("matches by Postgres error code (42P01 / undefined_table)", () => {
    expect(isSchemaMissingTableError({ message: "anything", code: "42P01" })).toBe(true);
  });

  it("matches a raw relation-does-not-exist message combined with schema cache wording", () => {
    expect(
      isSchemaMissingTableError({
        message: 'relation "public.first_foods" does not exist in the schema cache',
      }),
    ).toBe(true);
  });

  it("does not match a missing-column error (that's a different, already-handled case)", () => {
    expect(
      isSchemaMissingTableError({
        message: "Could not find the 'icon' column of 'milestones' in the schema cache",
      }),
    ).toBe(false);
  });

  it("does not match unrelated errors", () => {
    expect(isSchemaMissingTableError({ message: "permission denied for table milestones" })).toBe(
      false,
    );
    expect(
      isSchemaMissingTableError({ message: "duplicate key value violates unique constraint" }),
    ).toBe(false);
  });
});

describe("friendlyError — schema-missing-table case", () => {
  it("regression: returns a clear, honest message (not the generic fallback) for the exact live first_foods error", () => {
    const msg = friendlyError("Could not find the table 'public.first_foods' in the schema cache");
    expect(msg).not.toBe(
      "Something went wrong on our end. Give it a moment and try again — your data is safe.",
    );
    expect(msg).toMatch(/isn't fully set up/i);
  });

  it("still falls back to the generic message for truly unrecognized errors", () => {
    expect(friendlyError("some totally novel database error xyz123")).toBe(
      "Something went wrong on our end. Give it a moment and try again — your data is safe.",
    );
  });

  it("existing known-error mappings are unaffected (no regression from the new check)", () => {
    expect(friendlyError("duplicate key value violates unique constraint")).toMatch(
      /already saved/i,
    );
    expect(friendlyError("JWT expired")).toMatch(/session expired/i);
  });
});
