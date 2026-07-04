// Notification delivery — push (primary) with an email fallback for users
// with no registered device token. Shared by scheduled-recall-check
// (Feature 1) and scheduled-expiration-check (Feature 2) so there's exactly
// one place that knows how to actually reach a user, per "don't duplicate
// notification delivery logic, reuse it."
//
// The push half is a port of src/lib/apns.server.ts (same Web Crypto
// approach, portable to both Cloudflare Workers and Deno) — copied rather
// than imported since edge functions are a separate deploy target from the
// main app. Config is passed in explicitly (not read from Deno.env directly
// in these functions) so the signing/sending logic is unit-testable with a
// real generated test key instead of requiring real Apple credentials.

export type ApnsConfig = {
  keyId: string;
  teamId: string;
  keyP8: string;
  bundleId: string;
  environment: "production" | "sandbox";
};

export type ApnsPushResult = {
  token: string;
  ok: boolean;
  status: number;
  reason?: string;
  /** true when Apple says this token is no longer valid and should be deleted */
  invalidToken: boolean;
};

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of buf) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const JWT_MAX_AGE_MS = 50 * 60 * 1000; // Apple recommends reusing tokens up to ~1h; refresh every 50min

type JwtCache = { token: string; issuedAt: number } | null;

async function importSigningKey(keyP8: string): Promise<CryptoKey> {
  const der = pemToDer(keyP8);
  return crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
  ]);
}

/**
 * Builds a fresh ES256 provider JWT, or returns the cached one if it's
 * still within Apple's recommended reuse window. `cache` is passed in
 * (rather than a module-level variable) so tests can control cache state
 * and so this survives correctly across edge function cold starts either
 * way (module-level state doesn't persist across Deno isolate restarts
 * anyway — this just makes that explicit instead of implicit).
 */
export async function getProviderJwt(
  config: ApnsConfig,
  cache: JwtCache,
  now = Date.now(),
): Promise<{ token: string; cache: JwtCache }> {
  if (cache && now - cache.issuedAt < JWT_MAX_AGE_MS) {
    return { token: cache.token, cache };
  }
  const header = { alg: "ES256", kid: config.keyId };
  const payload = { iss: config.teamId, iat: Math.floor(now / 1000) };
  const encoder = new TextEncoder();
  const signingInput = `${base64UrlEncode(encoder.encode(JSON.stringify(header)))}.${base64UrlEncode(encoder.encode(JSON.stringify(payload)))}`;

  const key = await importSigningKey(config.keyP8);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(signingInput),
  );

  const token = `${signingInput}.${base64UrlEncode(signature)}`;
  return { token, cache: { token, issuedAt: now } };
}

export type PushNotification = { title: string; body: string; data?: Record<string, string> };

export async function sendApnsPush(
  fetchImpl: typeof fetch,
  config: ApnsConfig,
  deviceToken: string,
  notification: PushNotification,
  jwt: string,
): Promise<ApnsPushResult> {
  const host =
    config.environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const body = JSON.stringify({
    aps: { alert: { title: notification.title, body: notification.body }, sound: "default" },
    ...(notification.data ?? {}),
  });

  try {
    const res = await fetchImpl(`https://${host}/3/device/${deviceToken}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": config.bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
      },
      body,
    });

    if (res.ok) return { token: deviceToken, ok: true, status: res.status, invalidToken: false };

    const errBody = await res.json().catch(() => ({}) as { reason?: string });
    const reason = (errBody as { reason?: string }).reason ?? `http_${res.status}`;
    const invalidToken =
      res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered";
    return { token: deviceToken, ok: false, status: res.status, reason, invalidToken };
  } catch (err) {
    return {
      token: deviceToken,
      ok: false,
      status: 0,
      reason: err instanceof Error ? err.message : "network_error",
      invalidToken: false,
    };
  }
}

// ── Email fallback (for users with no registered push token) ───────────────
//
// There is no existing email infrastructure anywhere in this repo — this is
// a from-scratch, minimal integration using Resend (one HTTP call, one API
// key), gated entirely by whether RESEND_API_KEY is configured. Fails open
// (logs a warning, returns ok:false) rather than throwing, consistent with
// every other external-API call in this codebase, since a parent not
// getting a recall email must never block or crash the rest of the batch.
export type EmailResult = { ok: boolean; reason?: string };

export async function sendFallbackEmail(
  fetchImpl: typeof fetch,
  apiKey: string | undefined,
  fromAddress: string,
  to: string,
  subject: string,
  bodyText: string,
): Promise<EmailResult> {
  if (!apiKey) {
    console.warn("[notify] RESEND_API_KEY not configured — skipping email fallback for", to);
    return { ok: false, reason: "email_not_configured" };
  }
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress, to: [to], subject, text: bodyText }),
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "network_error" };
  }
}

export type NotifyTarget = {
  userId: string;
  email: string | null;
  apnsDeviceToken: string | null;
};

export type NotifyResult = {
  userId: string;
  channel: "push" | "email" | null;
  ok: boolean;
  invalidToken?: boolean;
};

/**
 * Sends one notification to one user: push if they have a device token,
 * otherwise email if configured, otherwise gives up (recorded as
 * channel: null, ok: false) — the caller should leave that alert
 * un-notified so it's retried next run rather than silently lost.
 */
export async function notifyUser(
  fetchImpl: typeof fetch,
  target: NotifyTarget,
  notification: PushNotification,
  apnsConfig: ApnsConfig | null,
  apnsJwt: string | null,
  resendApiKey: string | undefined,
  fromAddress: string,
): Promise<NotifyResult> {
  if (target.apnsDeviceToken && apnsConfig && apnsJwt) {
    const result = await sendApnsPush(
      fetchImpl,
      apnsConfig,
      target.apnsDeviceToken,
      notification,
      apnsJwt,
    );
    if (result.ok) return { userId: target.userId, channel: "push", ok: true };
    if (!result.invalidToken) return { userId: target.userId, channel: "push", ok: false };
    // Invalid token — fall through to email rather than giving up entirely.
  }
  if (target.email) {
    const emailResult = await sendFallbackEmail(
      fetchImpl,
      resendApiKey,
      fromAddress,
      target.email,
      notification.title,
      notification.body,
    );
    return { userId: target.userId, channel: "email", ok: emailResult.ok };
  }
  return { userId: target.userId, channel: null, ok: false };
}
