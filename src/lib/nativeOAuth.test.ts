import { describe, it, expect } from "vitest";
import {
  NATIVE_SCHEME,
  buildNativeHandoffUrl,
  isNativeHandoffRequest,
  parseNativeHandoff,
} from "./nativeOAuth";

describe("isNativeHandoffRequest", () => {
  it("detects the native flag", () => {
    expect(isNativeHandoffRequest("?native=1")).toBe(true);
    expect(isNativeHandoffRequest("?code=abc&native=1")).toBe(true);
  });

  it("ignores ordinary web callbacks (magic link, password reset)", () => {
    expect(isNativeHandoffRequest("?code=abc")).toBe(false);
    expect(isNativeHandoffRequest("?type=recovery")).toBe(false);
    expect(isNativeHandoffRequest("")).toBe(false);
  });
});

describe("buildNativeHandoffUrl / parseNativeHandoff", () => {
  it("round-trips tokens", () => {
    const url = buildNativeHandoffUrl({ access_token: "a.b.c", refresh_token: "r-1" });
    expect(url.startsWith(`${NATIVE_SCHEME}://oauth-callback?`)).toBe(true);
    expect(parseNativeHandoff(url)).toEqual({ access_token: "a.b.c", refresh_token: "r-1" });
  });

  it("round-trips an error", () => {
    const url = buildNativeHandoffUrl({ error: "access_denied" });
    expect(parseNativeHandoff(url)).toEqual({ error: "access_denied" });
  });

  it("ignores non-handoff deep links so password-reset links still route normally", () => {
    expect(parseNativeHandoff("https://peace-of-mine.lovable.app/auth/callback?code=x")).toBeNull();
    expect(parseNativeHandoff(`${NATIVE_SCHEME}://something-else?access_token=a`)).toBeNull();
    expect(parseNativeHandoff("not a url")).toBeNull();
  });

  it("treats a handoff missing tokens as an error rather than signing nobody in", () => {
    expect(parseNativeHandoff(`${NATIVE_SCHEME}://oauth-callback?access_token=a`)).toEqual({
      error: "Sign-in didn't complete. Please try again.",
    });
  });
});
