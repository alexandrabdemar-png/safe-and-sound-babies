import { describe, it, expect, vi } from "vitest";
import { createECDH, generateKeyPairSync, verify as nodeVerify } from "node:crypto";
import {
  getProviderJwt,
  sendApnsPush,
  sendFallbackEmail,
  notifyUser,
  buildRecallNotificationCopy,
  type ApnsConfig,
  type RecallCopyItem,
} from "./notify";
import type { VapidConfig, VapidJwtCache, WebPushSubscription } from "./webPush";

function makeTestVapidConfig(): VapidConfig {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pubJwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const privJwk = privateKey.export({ format: "jwk" }) as { d: string };
  const pubBytes = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(pubJwk.x, "base64url"),
    Buffer.from(pubJwk.y, "base64url"),
  ]);
  return {
    publicKey: pubBytes.toString("base64url"),
    privateKey: privJwk.d,
    subject: "mailto:alerts@test.app",
  };
}

function makeTestWebPushSubscription(
  endpoint = "https://fcm.googleapis.com/fcm/send/abc",
): WebPushSubscription {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint,
    p256dh: ecdh.getPublicKey().toString("base64url"),
    auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url"),
  };
}

function makeTestKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return {
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }) as string,
    publicKeyObject: publicKey,
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("getProviderJwt", () => {
  const { privatePem, publicKeyObject } = makeTestKeyPair();
  const config: ApnsConfig = {
    keyId: "TESTKEY123",
    teamId: "TESTTEAM456",
    keyP8: privatePem,
    bundleId: "com.test.app",
    environment: "sandbox",
  };

  it("produces a genuinely valid ES256 JWT — signature verifies against the real public key", async () => {
    const { token } = await getProviderJwt(config, null);
    const [headerB64, payloadB64, sigB64] = token.split(".");
    expect(headerB64).toBeTruthy();
    expect(payloadB64).toBeTruthy();
    expect(sigB64).toBeTruthy();

    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    expect(header).toEqual({ alg: "ES256", kid: "TESTKEY123" });
    expect(payload.iss).toBe("TESTTEAM456");
    expect(typeof payload.iat).toBe("number");

    // Real cryptographic verification, not just structural shape — proves
    // this is actually signed with the private key, in the format Apple's
    // APNs servers expect (raw R||S signature, not DER, hence dsaEncoding).
    const signingInput = `${headerB64}.${payloadB64}`;
    const sig = Buffer.from(sigB64, "base64url");
    const isValid = nodeVerify(
      "sha256",
      Buffer.from(signingInput),
      { key: publicKeyObject, dsaEncoding: "ieee-p1363" },
      sig,
    );
    expect(isValid).toBe(true);
  });

  it("reuses the cached token within the reuse window", async () => {
    const first = await getProviderJwt(config, null, 1_000_000);
    const second = await getProviderJwt(config, first.cache, 1_000_000 + 60_000); // 1 min later
    expect(second.token).toBe(first.token);
  });

  it("issues a new token once the cache is stale", async () => {
    const first = await getProviderJwt(config, null, 1_000_000);
    const second = await getProviderJwt(config, first.cache, 1_000_000 + 51 * 60 * 1000); // 51 min later
    expect(second.token).not.toBe(first.token);
  });
});

describe("sendApnsPush", () => {
  const config: ApnsConfig = {
    keyId: "k",
    teamId: "t",
    keyP8: "unused-in-this-test",
    bundleId: "com.test.app",
    environment: "sandbox",
  };

  it("sends to the sandbox host with the expected headers/body when environment is sandbox", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, true, 200));
    await sendApnsPush(
      fetchImpl,
      config,
      "device-token-abc",
      { title: "Recall", body: "Check your product" },
      "jwt-token",
    );
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.sandbox.push.apple.com/3/device/device-token-abc");
    expect((init.headers as Record<string, string>).authorization).toBe("bearer jwt-token");
    expect((init.headers as Record<string, string>)["apns-topic"]).toBe("com.test.app");
    const body = JSON.parse(init.body as string);
    expect(body.aps.alert).toEqual({ title: "Recall", body: "Check your product" });
  });

  it("classifies HTTP 410 as an invalid token", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ reason: "Unregistered" }, false, 410));
    const result = await sendApnsPush(
      fetchImpl,
      config,
      "dead-token",
      { title: "x", body: "y" },
      "jwt",
    );
    expect(result).toMatchObject({ ok: false, invalidToken: true });
  });

  it("does not classify a generic server error as an invalid token", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ reason: "InternalServerError" }, false, 500));
    const result = await sendApnsPush(fetchImpl, config, "token", { title: "x", body: "y" }, "jwt");
    expect(result).toMatchObject({ ok: false, invalidToken: false });
  });

  it("handles a network failure without throwing", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await sendApnsPush(fetchImpl, config, "token", { title: "x", body: "y" }, "jwt");
    expect(result.ok).toBe(false);
    expect(result.invalidToken).toBe(false);
  });
});

describe("sendFallbackEmail", () => {
  it("skips (fails open) when no API key is configured", async () => {
    const fetchImpl = vi.fn();
    const result = await sendFallbackEmail(
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
    const result = await sendFallbackEmail(
      fetchImpl,
      "re_test_key",
      "alerts@test.app",
      "parent@example.com",
      "Recall alert",
      "Details here",
    );
    expect(result.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      from: "alerts@test.app",
      to: ["parent@example.com"],
      subject: "Recall alert",
    });
  });

  it("fails open on a non-ok response instead of throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 401));
    const result = await sendFallbackEmail(fetchImpl, "bad_key", "a@b.com", "c@d.com", "s", "b");
    expect(result.ok).toBe(false);
  });
});

describe("notifyUser", () => {
  const apnsConfig: ApnsConfig = {
    keyId: "k",
    teamId: "t",
    keyP8: "x",
    bundleId: "com.test.app",
    environment: "sandbox",
  };

  it("uses push when a device token is present and it succeeds", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, true, 200));
    const result = await notifyUser(
      fetchImpl,
      { userId: "u1", email: "u1@example.com", apnsDeviceToken: "tok" },
      { title: "x", body: "y" },
      apnsConfig,
      "jwt",
      null,
      new Map(),
      "resend-key",
      "alerts@test.app",
    );
    expect(result).toEqual({ userId: "u1", channel: "push", ok: true });
  });

  it("falls back to email when push reports an invalid token and email is available", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ reason: "Unregistered" }, false, 410)) // apns
      .mockResolvedValueOnce(jsonResponse({ id: "abc" }, true, 200)); // resend
    const result = await notifyUser(
      fetchImpl,
      { userId: "u1", email: "u1@example.com", apnsDeviceToken: "dead-tok" },
      { title: "x", body: "y" },
      apnsConfig,
      "jwt",
      null,
      new Map(),
      "resend-key",
      "alerts@test.app",
    );
    expect(result.channel).toBe("email");
    expect(result.invalidApnsToken).toBe(true);
  });

  it("does NOT fall back to email on a transient (non-invalid-token) push failure", async () => {
    // A network hiccup should be retried as push next run, not silently
    // switched to a second channel — avoids double-notifying once the
    // device token starts working again.
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network blip"));
    const result = await notifyUser(
      fetchImpl,
      { userId: "u1", email: "u1@example.com", apnsDeviceToken: "tok" },
      { title: "x", body: "y" },
      apnsConfig,
      "jwt",
      null,
      new Map(),
      "resend-key",
      "alerts@test.app",
    );
    expect(result).toEqual({ userId: "u1", channel: null, ok: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1); // email must not have been attempted too
  });

  it("uses email when there is no device token at all", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "abc" }));
    const result = await notifyUser(
      fetchImpl,
      { userId: "u1", email: "u1@example.com", apnsDeviceToken: null },
      { title: "x", body: "y" },
      null,
      null,
      null,
      new Map(),
      "resend-key",
      "alerts@test.app",
    );
    expect(result.channel).toBe("email");
  });

  it("gives up cleanly when there's neither a device token, web push subscription, nor an email", async () => {
    const fetchImpl = vi.fn();
    const result = await notifyUser(
      fetchImpl,
      { userId: "u1", email: null, apnsDeviceToken: null },
      { title: "x", body: "y" },
      null,
      null,
      null,
      new Map(),
      "resend-key",
      "alerts@test.app",
    );
    expect(result).toEqual({ userId: "u1", channel: null, ok: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("delivers via web push when a browser subscription is present", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, true, 201));
    const vapidConfig = makeTestVapidConfig();
    const result = await notifyUser(
      fetchImpl,
      {
        userId: "u1",
        email: "u1@example.com",
        apnsDeviceToken: null,
        webPushSubscriptions: [makeTestWebPushSubscription()],
      },
      { title: "x", body: "y" },
      null,
      null,
      vapidConfig,
      new Map(),
      "resend-key",
      "alerts@test.app",
    );
    expect(result).toEqual({ userId: "u1", channel: "web_push", ok: true });
  });

  it("delivers on both push and web push simultaneously when both are registered", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, true, 200));
    const vapidConfig = makeTestVapidConfig();
    const result = await notifyUser(
      fetchImpl,
      {
        userId: "u1",
        email: "u1@example.com",
        apnsDeviceToken: "tok",
        webPushSubscriptions: [makeTestWebPushSubscription()],
      },
      { title: "x", body: "y" },
      apnsConfig,
      "jwt",
      vapidConfig,
      new Map(),
      "resend-key",
      "alerts@test.app",
    );
    expect(result).toEqual({ userId: "u1", channel: "push+web_push", ok: true });
  });

  it("reports a gone (410) web push subscription for cleanup without blocking other subscriptions", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, false, 410))
      .mockResolvedValueOnce(jsonResponse({}, true, 201));
    const vapidConfig = makeTestVapidConfig();
    const dead = makeTestWebPushSubscription("https://fcm.googleapis.com/fcm/send/dead");
    const alive = makeTestWebPushSubscription("https://fcm.googleapis.com/fcm/send/alive");
    const result = await notifyUser(
      fetchImpl,
      { userId: "u1", email: null, apnsDeviceToken: null, webPushSubscriptions: [dead, alive] },
      { title: "x", body: "y" },
      null,
      null,
      vapidConfig,
      new Map(),
      "resend-key",
      "alerts@test.app",
    );
    expect(result.ok).toBe(true);
    expect(result.channel).toBe("web_push");
    expect(result.invalidWebPushEndpoints).toEqual(["https://fcm.googleapis.com/fcm/send/dead"]);
  });
});

describe("buildRecallNotificationCopy", () => {
  it("builds a clean single-item title/body for one new recall", () => {
    const items: RecallCopyItem[] = [
      { product_id: "p1", recall_id: "r1", name: "Fisher-Price Rock 'n Play", reason: "new" },
    ];
    const { title, body } = buildRecallNotificationCopy(items);
    expect(title).toBe("⚠️ Safety Recall — Fisher-Price Rock 'n Play");
    expect(body).toBe("Fisher-Price Rock 'n Play has an active recall. Tap to review.");
  });

  it("builds a combined title/body when a user has distinct new AND updated recalls", () => {
    const items: RecallCopyItem[] = [
      { product_id: "p1", recall_id: "r1", name: "Crib A", reason: "new" },
      { product_id: "p2", recall_id: "r2", name: "Stroller B", reason: "updated" },
    ];
    const { title, body } = buildRecallNotificationCopy(items);
    expect(title).toBe("⚠️ Safety Recall — Crib A · 🔄 Updated recall — Stroller B");
    expect(body).toBe(
      "Crib A has an active recall. Recall info for Stroller B was updated — please review the changes. Tap to review.",
    );
  });

  it("summarizes with a count when 2+ genuinely distinct products are newly recalled", () => {
    const items: RecallCopyItem[] = [
      { product_id: "p1", recall_id: "r1", name: "Crib A", reason: "new" },
      { product_id: "p2", recall_id: "r2", name: "Swing B", reason: "new" },
    ];
    const { title } = buildRecallNotificationCopy(items);
    expect(title).toBe("⚠️ 2 new safety recalls");
  });

  // ── Duplicate product entries (audit finding — documents a real bug,
  // not desired behavior): two separate `products` rows for what a parent
  // considers the same physical item (added twice by mistake) both
  // independently match the same recall. buildRecallNotificationCopy has
  // no way to know they're "the same product" — it only sees two items
  // with different product_id/recall_id keys — so it treats them exactly
  // like two different products with two different recalls. ─────────────
  it("BUG: two duplicate product rows matching the SAME recall are miscounted as '2 new safety recalls'", () => {
    const items: RecallCopyItem[] = [
      {
        product_id: "duplicate-row-1",
        recall_id: "r1",
        name: "Fisher-Price Rock 'n Play",
        reason: "new",
      },
      {
        product_id: "duplicate-row-2",
        recall_id: "r1",
        name: "Fisher-Price Rock 'n Play",
        reason: "new",
      },
    ];
    const { title } = buildRecallNotificationCopy(items);
    // This is factually wrong: there is exactly ONE recall here (r1),
    // affecting one duplicated product entry — not "2 new safety recalls".
    expect(title).toBe("⚠️ 2 new safety recalls");
  });

  it("BUG: the same duplicate-row case repeats the product name twice in the body instead of saying it once", () => {
    const items: RecallCopyItem[] = [
      {
        product_id: "duplicate-row-1",
        recall_id: "r1",
        name: "Fisher-Price Rock 'n Play",
        reason: "new",
      },
      {
        product_id: "duplicate-row-2",
        recall_id: "r1",
        name: "Fisher-Price Rock 'n Play",
        reason: "new",
      },
    ];
    const { body } = buildRecallNotificationCopy(items);
    expect(body).toBe(
      "Fisher-Price Rock 'n Play, Fisher-Price Rock 'n Play has an active recall. Tap to review.",
    );
  });

  it("falls back to the generic title when there are no items at all", () => {
    expect(buildRecallNotificationCopy([]).title).toBe("⚠️ Safety Recall");
  });
});
