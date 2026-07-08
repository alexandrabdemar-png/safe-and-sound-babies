import { describe, it, expect, vi } from "vitest";
import { sendResendEmail } from "./sendEmail";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("sendResendEmail", () => {
  it("skips (fails open) when no API key is configured", async () => {
    const fetchImpl = vi.fn();
    const result = await sendResendEmail(
      fetchImpl,
      undefined,
      "alerts@test.app",
      "parent@example.com",
      "Subject",
      "Body",
    );
    expect(result).toEqual({ ok: false, reason: "email_not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends via Resend when configured", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "abc" }));
    const result = await sendResendEmail(
      fetchImpl,
      "re_test_key",
      "alerts@test.app",
      "invitee@example.com",
      "You've been invited",
      "Details here",
    );
    expect(result.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      from: "alerts@test.app",
      to: ["invitee@example.com"],
      subject: "You've been invited",
      text: "Details here",
    });
  });

  it("reports failure (without throwing) on a non-ok HTTP response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "bad" }, false, 422));
    const result = await sendResendEmail(fetchImpl, "re_test_key", "a@b.com", "c@d.com", "s", "b");
    expect(result).toEqual({ ok: false, reason: "http_422" });
  });

  it("reports failure (without throwing) when fetch itself rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await sendResendEmail(fetchImpl, "re_test_key", "a@b.com", "c@d.com", "s", "b");
    expect(result).toEqual({ ok: false, reason: "network down" });
  });
});
