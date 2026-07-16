import { describe, it, expect } from "vitest";
import { friendlyAuthError, friendlyError, isSchemaMissingTableError } from "./errors";

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

describe("friendlyAuthError", () => {
  it("maps the real GoTrue 'already registered' message to a signin suggestion", () => {
    expect(friendlyAuthError("User already registered")).toMatch(/already have an account/i);
  });

  it("maps the real GoTrue 'invalid login credentials' message", () => {
    expect(friendlyAuthError("Invalid login credentials")).toMatch(
      /doesn't match our records/i,
    );
  });

  it("maps a weak-password rejection", () => {
    expect(friendlyAuthError("Password should be at least 6 characters")).toMatch(
      /at least 6 characters/i,
    );
  });

  it("maps a rate-limit response", () => {
    expect(friendlyAuthError("email rate limit exceeded")).toMatch(/wait a bit/i);
    expect(friendlyAuthError("Too many requests")).toMatch(/wait a minute/i);
  });

  it("maps an expired/invalid link (magic link, password reset, email confirmation)", () => {
    expect(friendlyAuthError("Token has expired or is invalid")).toMatch(
      /expired or already been used/i,
    );
  });

  it("regression: a raw trigger/DB failure during signup never leaks to the user", () => {
    const msg = friendlyAuthError(
      "Database error saving new user: duplicate key value violates unique constraint \"profiles_user_id_key\"",
    );
    expect(msg).not.toMatch(/duplicate key|constraint|profiles_user_id_key/i);
    expect(msg).toMatch(/hit a snag/i);
  });

  it("falls back to a warm generic message for a totally unrecognized error, never the raw string", () => {
    const msg = friendlyAuthError("some_never_seen_gotrue_error_code_xyz");
    expect(msg).not.toContain("some_never_seen_gotrue_error_code_xyz");
    expect(msg).toMatch(/try again/i);
  });

  it("accepts a raw Error object as well as a string", () => {
    expect(friendlyAuthError(new Error("User already registered"))).toMatch(
      /already have an account/i,
    );
  });
});
