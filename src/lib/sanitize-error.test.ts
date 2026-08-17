import { describe, it, expect } from "vitest";
import { sanitizeError } from "./sanitize-error";

// This function is the concrete mechanism behind a specific Privacy Policy
// claim ("Error logs are sanitised before storage; email addresses and
// tokens are stripped from log entries" — src/lib/privacy-policy.ts,
// Section 6). It had no test coverage at all before this — these tests
// verify the redaction actually does what the policy says, and pin down
// exactly what it does and doesn't catch.

describe("sanitizeError", () => {
  it("redacts an email address embedded in the error message", () => {
    const err = new Error("Failed to send alert to parent@example.com");
    expect(sanitizeError(err).message).not.toContain("parent@example.com");
    expect(sanitizeError(err).message).toContain("[redacted]");
  });

  it("redacts a US-format phone number embedded in the error message", () => {
    const err = new Error("Could not reach emergency contact at 555-867-5309");
    expect(sanitizeError(err).message).not.toContain("555-867-5309");
  });

  it("redacts a token/key/secret assignment embedded in the error message", () => {
    const err = new Error('Upstream call failed: {"api_key": "sk_live_abc123XYZ"}');
    const message = sanitizeError(err).message;
    expect(message).not.toContain("sk_live_abc123XYZ");
  });

  it("redacts a key/value-style token (the shape the pattern is built for)", () => {
    const err = new Error('Request failed: {"token": "eyJhbGciOiJIUzI1NiJ9.abc.def"}');
    expect(sanitizeError(err).message).not.toContain("eyJhbGciOiJIUzI1NiJ9.abc.def");
  });

  it("gap: does NOT redact the common HTTP 'Authorization: Bearer <token>' header format", () => {
    // PII_PATTERNS' token rule requires a `:`/`=` directly after the
    // keyword (password|token|secret|key|auth|bearer|api_?key), e.g.
    // `token: "xyz"` or `token=xyz`. "authorization: Bearer <token>" has a
    // colon after "authorization" but the actual secret is one word later,
    // after "Bearer " — so neither the "auth" nor the "bearer" alternative
    // has a `:`/`=` immediately following it, and the token passes through
    // unredacted. This is a real gap, not an intentional exclusion: any
    // error message that echoes back a request's Authorization header
    // (a common shape for upstream HTTP failures) would leak the bearer
    // token into logs despite the "tokens are stripped" policy claim.
    // Documented here rather than silently worked around.
    const err = new Error("Request failed with authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def");
    expect(sanitizeError(err).message).toContain("eyJhbGciOiJIUzI1NiJ9.abc.def");
  });

  it("preserves the error name and code, which carry no PII", () => {
    const err = new Error("plain message with no PII") as Error & { code?: string };
    err.code = "23505";
    const result = sanitizeError(err);
    expect(result.name).toBe("Error");
    expect(result.code).toBe("23505");
    expect(result.message).toBe("plain message with no PII");
  });

  it("discards stack frames and arbitrary object properties entirely", () => {
    const err = new Error("boom") as Error & { userEmail?: string; extra?: unknown };
    err.userEmail = "leaked@example.com";
    err.extra = { deeply: { nested: "leaked@example.com" } };
    const result = sanitizeError(err);
    // Only name/message/code are ever on the returned shape — no
    // userEmail/extra/stack property can leak through even if a caller
    // attached one, since sanitizeError only reads err.name/.message/.code.
    expect(Object.keys(result).sort()).toEqual(["code", "message", "name"]);
  });

  it("redacts PII inside a plain string error (not an Error instance)", () => {
    const result = sanitizeError("contact me at parent@example.com about this");
    expect(result.name).toBe("Error");
    expect(result.message).not.toContain("parent@example.com");
  });

  it("falls back to a generic message for a completely unknown thrown value", () => {
    expect(sanitizeError(42)).toEqual({
      name: "UnknownError",
      message: "An unexpected error occurred",
    });
    expect(sanitizeError(null)).toEqual({
      name: "UnknownError",
      message: "An unexpected error occurred",
    });
    expect(sanitizeError(undefined)).toEqual({
      name: "UnknownError",
      message: "An unexpected error occurred",
    });
  });

  it("does not redact ordinary numbers that aren't phone-shaped (false-positive check)", () => {
    const err = new Error("Expected 1234 items, found 42");
    expect(sanitizeError(err).message).toBe("Expected 1234 items, found 42");
  });
});
