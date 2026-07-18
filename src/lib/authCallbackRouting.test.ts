import { describe, it, expect } from "vitest";
import { decidePostCallbackRoute } from "./authCallbackRouting";

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
