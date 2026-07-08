import { describe, it, expect, vi } from "vitest";
import {
  generateInviteToken,
  hashInviteToken,
  computeInviteExpiry,
  isValidEmail,
  buildInviteEmail,
  allChildrenOwned,
  sendInviteEmail,
  INVITE_LIFETIME_HOURS,
} from "./caregiverInvite";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("generateInviteToken / hashInviteToken", () => {
  it("generates a 256-bit (64 hex char) random token, different every call", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it("hashes deterministically — same token always hashes the same", async () => {
    const token = generateInviteToken();
    const h1 = await hashInviteToken(token);
    const h2 = await hashInviteToken(token);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different tokens hash differently", async () => {
    const h1 = await hashInviteToken(generateInviteToken());
    const h2 = await hashInviteToken(generateInviteToken());
    expect(h1).not.toBe(h2);
  });
});

describe("computeInviteExpiry", () => {
  it("expires exactly INVITE_LIFETIME_HOURS (7 days) from now", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const expiry = computeInviteExpiry(now);
    expect(expiry.getTime() - now.getTime()).toBe(INVITE_LIFETIME_HOURS * 60 * 60 * 1000);
  });
});

describe("isValidEmail", () => {
  it("accepts well-formed emails", () => {
    expect(isValidEmail("parent@example.com")).toBe(true);
    expect(isValidEmail("a.b+tag@sub.example.co.uk")).toBe(true);
  });
  it("rejects malformed input", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing@domain")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("spaces in@email.com")).toBe(false);
  });
});

describe("allChildrenOwned", () => {
  it("true when every requested id is in the owned rows", () => {
    expect(
      allChildrenOwned({
        requestedIds: ["a", "b"],
        ownedRows: [{ id: "a", name: "Kid A" }, { id: "b", name: "Kid B" }],
      }),
    ).toBe(true);
  });

  it("false when a requested id is missing from owned rows (not the caller's child)", () => {
    expect(
      allChildrenOwned({
        requestedIds: ["a", "b", "not-mine"],
        ownedRows: [{ id: "a", name: "Kid A" }, { id: "b", name: "Kid B" }],
      }),
    ).toBe(false);
  });

  it("false when ownedRows has fewer rows than requested (RLS silently dropped one)", () => {
    expect(
      allChildrenOwned({ requestedIds: ["a", "b"], ownedRows: [{ id: "a", name: "Kid A" }] }),
    ).toBe(false);
  });

  it("false for an empty request", () => {
    expect(allChildrenOwned({ requestedIds: [], ownedRows: [] })).toBe(false);
  });
});

describe("buildInviteEmail", () => {
  it("includes the accept link with the raw token and the child names", () => {
    const { subject, text } = buildInviteEmail("https://app.test", "TOKEN123", ["Emma", "Jack"], "editor");
    expect(subject).toContain("Emma & Jack");
    expect(text).toContain("https://app.test/caregiver-invite/TOKEN123");
    expect(text).toContain("view and edit");
  });

  it("uses 'view' phrasing for a viewer-role invite", () => {
    const { text } = buildInviteEmail("https://app.test", "TOKEN123", ["Emma"], "viewer");
    expect(text).toContain("view Emma's profile");
    expect(text).not.toContain("view and edit");
  });

  it("falls back to generic phrasing when no child names are given", () => {
    const { subject } = buildInviteEmail("https://app.test", "TOKEN123", [], "editor");
    expect(subject).toContain("their child");
  });
});

describe("sendInviteEmail", () => {
  it("sends the built subject/text through the injected fetch/Resend call", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "abc" }));
    const result = await sendInviteEmail(
      fetchImpl,
      "re_test_key",
      "invites@test.app",
      "coparent@example.com",
      "https://app.test",
      "TOKEN123",
      ["Emma"],
      "editor",
    );
    expect(result.ok).toBe(true);
    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["coparent@example.com"]);
    expect(body.text).toContain("https://app.test/caregiver-invite/TOKEN123");
  });

  it("fails open (no throw) when RESEND_API_KEY is not configured", async () => {
    const fetchImpl = vi.fn();
    const result = await sendInviteEmail(
      fetchImpl,
      undefined,
      "invites@test.app",
      "coparent@example.com",
      "https://app.test",
      "TOKEN123",
      ["Emma"],
      "editor",
    );
    expect(result).toEqual({ ok: false, reason: "email_not_configured" });
  });
});
