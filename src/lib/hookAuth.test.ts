import { describe, it, expect } from "vitest";
import {
  acceptedHookCredentials,
  extractHookCredential,
  isAuthorizedHookCredential,
} from "./hookAuth";

const headers = (h: Record<string, string>) => new Headers(h);

describe("extractHookCredential", () => {
  it("reads the apikey header", () => {
    expect(extractHookCredential(headers({ apikey: "abc" }))).toBe("abc");
  });

  it("reads a Bearer authorization header", () => {
    expect(extractHookCredential(headers({ authorization: "Bearer xyz" }))).toBe("xyz");
    expect(extractHookCredential(headers({ authorization: "bearer xyz" }))).toBe("xyz");
  });

  it("prefers apikey when both are present", () => {
    expect(extractHookCredential(headers({ apikey: "a", authorization: "Bearer b" }))).toBe("a");
  });

  it("returns null when absent or blank", () => {
    expect(extractHookCredential(headers({}))).toBeNull();
    expect(extractHookCredential(headers({ apikey: "   " }))).toBeNull();
  });
});

describe("isAuthorizedHookCredential", () => {
  it("accepts the anon key that pg_cron sends", () => {
    expect(isAuthorizedHookCredential("anon-key", [undefined, "anon-key"])).toBe(true);
  });

  it("accepts an explicitly configured HOOK_SECRET", () => {
    expect(isAuthorizedHookCredential("s3cret", ["s3cret", "anon-key"])).toBe(true);
  });

  it("rejects a wrong credential", () => {
    expect(isAuthorizedHookCredential("nope", ["s3cret", "anon-key"])).toBe(false);
  });

  it("rejects a same-length near-miss (constant-time compare still compares content)", () => {
    expect(isAuthorizedHookCredential("anon-kex", ["anon-key"])).toBe(false);
  });

  it("fails closed when nothing is configured", () => {
    expect(isAuthorizedHookCredential("anything", [])).toBe(false);
    expect(isAuthorizedHookCredential("anything", [undefined, "", "   "])).toBe(false);
  });

  it("rejects a missing credential even when secrets are configured", () => {
    expect(isAuthorizedHookCredential(null, ["s3cret"])).toBe(false);
    expect(isAuthorizedHookCredential("", ["s3cret"])).toBe(false);
  });

  it("does not treat a prefix of the secret as valid", () => {
    expect(isAuthorizedHookCredential("s3c", ["s3cret"])).toBe(false);
    expect(isAuthorizedHookCredential("s3cretsuffix", ["s3cret"])).toBe(false);
  });
});

describe("acceptedHookCredentials", () => {
  it("collects HOOK_SECRET and the publishable/anon keys", () => {
    expect(
      acceptedHookCredentials({
        HOOK_SECRET: "s",
        SUPABASE_PUBLISHABLE_KEY: "p",
        SUPABASE_ANON_KEY: "a",
      }),
    ).toEqual(["s", "p", "a"]);
  });

  it("skips blank / missing values", () => {
    expect(acceptedHookCredentials({ HOOK_SECRET: "  ", SUPABASE_PUBLISHABLE_KEY: "p" })).toEqual([
      "p",
    ]);
    expect(acceptedHookCredentials({})).toEqual([]);
  });
});
