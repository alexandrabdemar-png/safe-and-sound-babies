import { describe, it, expect } from "vitest";
import { decidePostCallbackRoute, parseNextParam } from "./authCallbackRouting";

describe("decidePostCallbackRoute", () => {
  it("routes a recovery link to the reset-password screen (live bug: was racing getSession vs onAuthStateChange)", () => {
    expect(decidePostCallbackRoute({ isRecovery: true, next: null, hasDisplayName: true })).toEqual({
      to: "/auth",
      search: { mode: "reset" },
    });
  });

  it("recovery wins even when a next param and a display name are also present", () => {
    expect(
      decidePostCallbackRoute({ isRecovery: true, next: "/caregiver-invite/abc", hasDisplayName: true }),
    ).toEqual({ to: "/auth", search: { mode: "reset" } });
  });

  it("adversarial: recovery still wins even if next looks like it's trying to escape (defense in depth — proves the routing decision itself can't be used to dodge the reset screen even if the guard upstream were ever weakened)", () => {
    expect(
      decidePostCallbackRoute({ isRecovery: true, next: "//evil.com", hasDisplayName: true }),
    ).toEqual({ to: "/auth", search: { mode: "reset" } });
  });

  it("routes to the next param when present and not a recovery flow", () => {
    expect(
      decidePostCallbackRoute({ isRecovery: false, next: "/caregiver-invite/abc", hasDisplayName: true }),
    ).toEqual({ to: "/caregiver-invite/abc" });
  });

  it("routes an existing user (has a display name) with no next param to /home", () => {
    expect(decidePostCallbackRoute({ isRecovery: false, next: null, hasDisplayName: true })).toEqual({
      to: "/home",
    });
  });

  it("routes a brand-new user (no display name yet) with no next param to /onboarding", () => {
    expect(decidePostCallbackRoute({ isRecovery: false, next: null, hasDisplayName: false })).toEqual({
      to: "/onboarding",
    });
  });
});

describe("parseNextParam — adversarial: open-redirect attempts via the auth callback", () => {
  it("blocks a bare absolute URL", () => {
    expect(parseNextParam("https://evil.com")).toBeNull();
    expect(parseNextParam("http://evil.com/phish")).toBeNull();
  });

  it("blocks protocol-relative URLs (//host)", () => {
    expect(parseNextParam("//evil.com")).toBeNull();
    expect(parseNextParam("///evil.com")).toBeNull();
  });

  it("blocks the backslash bypass — browsers normalize \\ to / when resolving a URL, so /\\evil.com behaves like //evil.com", () => {
    expect(parseNextParam("/\\evil.com")).toBeNull();
    expect(parseNextParam("/\\/evil.com")).toBeNull();
    expect(parseNextParam("\\\\evil.com")).toBeNull();
    expect(parseNextParam("/\\\\evil.com")).toBeNull();
  });

  it("blocks a javascript: URL", () => {
    expect(parseNextParam("javascript:alert(document.cookie)")).toBeNull();
  });

  it("blocks data: and vbscript: URLs", () => {
    expect(parseNextParam("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(parseNextParam("vbscript:alert(1)")).toBeNull();
  });

  it("blocks embedded control characters (tab/newline bypass of naive startsWith checks)", () => {
    expect(parseNextParam("/\t/evil.com")).toBeNull();
    expect(parseNextParam("/\n/evil.com")).toBeNull();
    expect(parseNextParam("/\r/evil.com")).toBeNull();
  });

  it("blocks a path with no leading slash at all", () => {
    expect(parseNextParam("evil.com")).toBeNull();
    expect(parseNextParam("relative/path")).toBeNull();
  });

  it("blocks empty string and null the same way", () => {
    expect(parseNextParam("")).toBeNull();
    expect(parseNextParam(null)).toBeNull();
  });

  it("allows a genuine same-origin path (the actual caregiver-invite use case)", () => {
    expect(parseNextParam("/caregiver-invite/abc123")).toBe("/caregiver-invite/abc123");
  });

  it("allows a same-origin path with a query string", () => {
    expect(parseNextParam("/products?category=car-seats")).toBe("/products?category=car-seats");
  });

  it("allows the root path", () => {
    expect(parseNextParam("/")).toBe("/");
  });
});
