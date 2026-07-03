// apns.server.ts — direct Apple Push Notification service (APNs) sender.
//
// This app registers native APNs device tokens via @capacitor/push-notifications
// (see src/hooks/usePushRegistration.ts). There is no Expo SDK in this project,
// so pushes are sent straight to Apple rather than relayed through Expo's push
// service. Uses the Web Crypto API (not node:crypto) so this also works if the
// app is deployed to a Cloudflare Workers-style runtime (this project's Nitro
// preset defaults to "cloudflare").
//
// Required environment variables:
//   APNS_KEY_ID     — Key ID for the .p8 Apple Push Notification key
//   APNS_TEAM_ID    — Apple Developer Team ID
//   APNS_KEY_P8     — contents of the .p8 key file (PEM text, including
//                     "-----BEGIN PRIVATE KEY-----" / "-----END PRIVATE KEY-----")
//   APNS_BUNDLE_ID  — defaults to "com.peaceofmine.app" (see capacitor.config.ts)
//   APNS_ENVIRONMENT — "production" (default) or "sandbox" (TestFlight/dev builds)

type ApnsPushResult = {
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

let cachedKey: CryptoKey | null = null;
let cachedJwt: { token: string; issuedAt: number } | null = null;
const JWT_MAX_AGE_MS = 50 * 60 * 1000; // Apple recommends reusing tokens up to ~1h; refresh every 50min

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const p8 = process.env.APNS_KEY_P8;
  if (!p8) throw new Error("Missing APNS_KEY_P8 environment variable");
  const der = pemToDer(p8);
  cachedKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  return cachedKey;
}

async function getProviderJwt(): Promise<string> {
  if (cachedJwt && Date.now() - cachedJwt.issuedAt < JWT_MAX_AGE_MS) {
    return cachedJwt.token;
  }
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  if (!keyId || !teamId) {
    throw new Error("Missing APNS_KEY_ID or APNS_TEAM_ID environment variable");
  }

  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat: Math.floor(Date.now() / 1000) };
  const encoder = new TextEncoder();
  const signingInput = `${base64UrlEncode(encoder.encode(JSON.stringify(header)))}.${base64UrlEncode(encoder.encode(JSON.stringify(payload)))}`;

  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(signingInput),
  );

  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;
  cachedJwt = { token: jwt, issuedAt: Date.now() };
  return jwt;
}

/** Send a single push via APNs. */
export async function sendApnsPush(
  deviceToken: string,
  notification: { title: string; body: string; data?: Record<string, string> },
): Promise<ApnsPushResult> {
  const bundleId = process.env.APNS_BUNDLE_ID || "com.peaceofmine.app";
  const environment = process.env.APNS_ENVIRONMENT === "sandbox" ? "sandbox" : "production";
  const host = environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";

  let jwt: string;
  try {
    jwt = await getProviderJwt();
  } catch (err) {
    return {
      token: deviceToken,
      ok: false,
      status: 0,
      reason: err instanceof Error ? err.message : "jwt_error",
      invalidToken: false,
    };
  }

  const body = JSON.stringify({
    aps: { alert: { title: notification.title, body: notification.body }, sound: "default" },
    ...(notification.data ?? {}),
  });

  try {
    const res = await fetch(`https://${host}/3/device/${deviceToken}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
      },
      body,
    });

    if (res.ok) {
      return { token: deviceToken, ok: true, status: res.status, invalidToken: false };
    }

    const errBody = await res.json().catch(() => ({}) as { reason?: string });
    const reason = (errBody as { reason?: string }).reason ?? `http_${res.status}`;
    const invalidToken = res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered";
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

/** Send the same notification to many device tokens in parallel. */
export async function sendApnsPushBatch(
  deviceTokens: string[],
  notification: { title: string; body: string; data?: Record<string, string> },
): Promise<ApnsPushResult[]> {
  return Promise.all(deviceTokens.map((token) => sendApnsPush(token, notification)));
}
