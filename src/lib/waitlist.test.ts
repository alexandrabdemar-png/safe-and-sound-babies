import { describe, expect, it, vi } from "vitest";
import { fetchWaitlistCount, joinWaitlist, parseSource, type WaitlistClient } from "./waitlist";

function fakeClient(
  insertError: { code?: string; message: string } | null = null,
  count: unknown = 42,
) {
  const insert = vi.fn(async () => ({ error: insertError }));
  const client: WaitlistClient = {
    from: () => ({ insert }),
    rpc: async () => ({ data: count, error: null }),
  };
  return { client, insert };
}

const valid = { email: "  Parent@Example.com ", consented: true };

describe("joinWaitlist", () => {
  it("saves a normalized signup", async () => {
    const { client, insert } = fakeClient();
    const result = await joinWaitlist(client, {
      ...valid,
      firstName: " Sam ",
      stage: "expecting",
      source: "TikTok",
    });
    expect(result).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith({
      email: "parent@example.com",
      first_name: "Sam",
      stage: "expecting",
      source: "tiktok",
      consented_to_emails: true,
    });
  });

  it("rejects a bad email or missing consent without calling the database", async () => {
    const { client, insert } = fakeClient();
    expect(await joinWaitlist(client, { email: "nope", consented: true })).toMatchObject({
      reason: "invalid-email",
    });
    expect(await joinWaitlist(client, { ...valid, consented: false })).toMatchObject({
      reason: "no-consent",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("treats an email that's already listed as success, so it can't be probed", async () => {
    const { client } = fakeClient({ code: "23505", message: "duplicate key" });
    expect(await joinWaitlist(client, valid)).toEqual({ ok: true });
  });

  it("silently drops bot submissions that fill the hidden field", async () => {
    const { client, insert } = fakeClient();
    expect(await joinWaitlist(client, { ...valid, honeypot: "http://spam.example" })).toEqual({
      ok: true,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("reports a real failure with its error code", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ code: "PGRST205", message: "Could not find the table" });
    const result = await joinWaitlist(client, valid);
    expect(result).toMatchObject({ ok: false, reason: "failed" });
    expect(result.ok ? "" : result.message).toContain("(error PGRST205)");
  });
});

describe("parseSource", () => {
  it("keeps short simple tags and drops anything else", () => {
    expect(parseSource("TikTok")).toBe("tiktok");
    expect(parseSource("ig_story-2")).toBe("ig_story-2");
    expect(parseSource("<script>")).toBeNull();
    expect(parseSource("")).toBeNull();
    expect(parseSource(null)).toBeNull();
  });
});

describe("fetchWaitlistCount", () => {
  it("returns the count, or null when it can't be read", async () => {
    expect(await fetchWaitlistCount(fakeClient(null, "1200").client)).toBe(1200);
    const broken: WaitlistClient = {
      from: fakeClient().client.from,
      rpc: async () => ({ data: null, error: { message: "x" } }),
    };
    expect(await fetchWaitlistCount(broken)).toBeNull();
  });
});
