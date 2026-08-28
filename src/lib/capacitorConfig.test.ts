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

  it("still allows Stripe and Supabase, so this change didn't drop any existing trusted origin", () => {
    expect(isAllowed("checkout.stripe.com")).toBe(true);
    expect(isAllowed("xyzcompany.supabase.co")).toBe(true);
  });
});
