import { describe, it, expect } from "vitest";
import config from "../../capacitor.config";

// Regression coverage for a real bug: Google Sign-In silently stalled in
// the TestFlight build because Capacitor's allowNavigation allowlist
// didn't include Google's OAuth domain. On the web, browsers have no such
// restriction, so the bug only ever showed up inside the native app —
// this test guards the native config directly rather than relying on
// someone noticing it worked on web and assuming that meant it worked
// everywhere.
describe("capacitor.config allowNavigation", () => {
  const allowNavigation = config.server?.allowNavigation ?? [];

  function matches(host: string, pattern: string): boolean {
    if (pattern.startsWith("*.")) return host.endsWith(pattern.slice(1));
    return host === pattern;
  }

  function isAllowed(host: string): boolean {
    return allowNavigation.some((pattern) => matches(host, pattern));
  }

  it("allows the app's own hosted domain", () => {
    expect(isAllowed("peace-of-mine.lovable.app")).toBe(true);
  });

  it("allows Google's OAuth consent domain, so Google Sign-In doesn't silently stall in the native app", () => {
    expect(isAllowed("accounts.google.com")).toBe(true);
  });

  it("allows Google subdomains generally, since the OAuth handshake can bounce through account-chooser and verification pages beyond just accounts.google.com", () => {
    expect(isAllowed("myaccount.google.com")).toBe(true);
  });

  it("does not accidentally allow an unrelated lookalike domain via the Google wildcard", () => {
    expect(isAllowed("google.com.attacker.example")).toBe(false);
    expect(isAllowed("notgoogle.com")).toBe(false);
  });

  it("allows Apple's Sign in with Apple consent domain, for the same reason as Google", () => {
    expect(isAllowed("appleid.apple.com")).toBe(true);
  });

  it("does not accidentally allow an unrelated lookalike domain via the Apple wildcard", () => {
    expect(isAllowed("apple.com.attacker.example")).toBe(false);
    expect(isAllowed("notapple.com")).toBe(false);
  });

  it("still allows Supabase, so this change didn't drop an existing trusted origin", () => {
    expect(isAllowed("xyzcompany.supabase.co")).toBe(true);
  });

  // Apple 3.1.1: the App Store app must not be able to reach web checkout.
  it("does not allow Stripe checkout or billing portal inside the app", () => {
    expect(isAllowed("checkout.stripe.com")).toBe(false);
    expect(isAllowed("billing.stripe.com")).toBe(false);
  });
});

describe("capacitor.config user agent marker", () => {
  it("appends the marker the hosted site uses to detect the App Store app", async () => {
    const { APP_USER_AGENT_MARKER } = await import("./isNativeApp");
    expect(config.ios?.appendUserAgent).toBe(APP_USER_AGENT_MARKER);
  });
});
