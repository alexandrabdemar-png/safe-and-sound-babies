import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regression coverage for a real bug: password-reset (and magic-link /
// email-confirmation) links always opened in Safari instead of the native
// app, because there was no Universal Links configuration at all. iOS only
// hands an https:// link to the app if this file is present, valid JSON,
// and lists the app's Team ID + bundle ID.
describe("apple-app-site-association", () => {
  const path = join(__dirname, "../../public/.well-known/apple-app-site-association");
  const raw = readFileSync(path, "utf8");

  it("is valid JSON (iOS refuses to use a malformed AASA file)", () => {
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("declares this app's Team ID and bundle ID", () => {
    const parsed = JSON.parse(raw);
    const appID = parsed.applinks.details[0].appID;
    expect(appID).toBe("SKYQ27736J.com.peaceofmine.baby");
  });

  it("allows deep-linking on all paths, so password reset / magic link / email confirmation are all covered", () => {
    const parsed = JSON.parse(raw);
    expect(parsed.applinks.details[0].paths).toContain("*");
  });
});
