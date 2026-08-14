// Web Push delivery — the browser-native equivalent of the APNs channel in
// notify.ts, for users on the web app (src/routes) where there's no native
// push service. Two protocols implemented here, both from their RFCs, using
// only the Web Crypto API (`crypto.subtle` / `crypto.getRandomValues`) so
// this file stays portable to both Deno (the edge function runtime) and
// Node (Vitest) with zero imports — same rule the rest of this directory
// follows, and the same reason: APNs' ES256 JWT signing in notify.ts uses
// the identical approach instead of an npm dependency.
//
//   - RFC 8292 (VAPID): an ES256 JWT identifies the sender to the push
//     service, so it can rate-limit/attribute traffic without the message
//     itself being readable to it.
//   - RFC 8291 (Web Push encryption) + RFC 8188 (aes128gcm content coding):
//     the actual notification payload is end-to-end encrypted to the
//     browser's subscription keys (p256dh + auth) — the push service in the
//     middle (FCM, Mozilla, etc.) only ever sees ciphertext.
//
// The encryption implementation here was cross-verified byte-for-byte
// against `http_ece` (the library the official `web-push` npm package
// delegates encryption to) using a fixed keypair/salt/payload — see
// webPush.test.ts for that golden vector. This is intentionally NOT a
// generic ECE implementation: it only supports the one mode WebPush
// actually uses (aes128gcm, single record, no padding), matching exactly
// what real subscriptions need.

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of buf) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array {
  const padded = s
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(s.length / 4) * 4, "=");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export type VapidConfig = {
  /** base64url, decodes to the 65-byte uncompressed P-256 public key. */
  publicKey: string;
  /** base64url, decodes to the 32-byte P-256 private scalar. */
  privateKey: string;
  /** "mailto:someone@example.com" or an "https://" contact URL, per RFC 8292. */
  subject: string;
};

export type WebPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// ── VAPID JWT (RFC 8292) ────────────────────────────────────────────────

async function importVapidSigningKey(config: VapidConfig): Promise<CryptoKey> {
  const pub = base64UrlDecode(config.publicKey);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error("VAPID public key must decode to a 65-byte uncompressed P-256 point");
  }
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(pub.subarray(1, 33)),
    y: base64UrlEncode(pub.subarray(33, 65)),
    d: config.privateKey,
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
  ]);
}

const VAPID_JWT_MAX_AGE_MS = 50 * 60 * 1000; // refresh well within the 12h/24h window, mirrors the APNs cache convention

export type VapidJwtCache = Map<string, { header: string; issuedAt: number }>;

/**
 * Builds (or reuses a cached) `Authorization: vapid t=<jwt>, k=<publicKey>`
 * header for the given push-service origin. Cached per-origin because the
 * JWT's `aud` claim must be that exact origin (RFC 8292) — a batch of
 * subscriptions spans only a handful of push services (FCM, Mozilla, etc.)
 * in practice, so this keeps sends cheap without re-signing per user.
 */
export async function getVapidAuthHeader(
  config: VapidConfig,
  endpointOrigin: string,
  cache: VapidJwtCache,
  now = Date.now(),
): Promise<string> {
  const cached = cache.get(endpointOrigin);
  if (cached && now - cached.issuedAt < VAPID_JWT_MAX_AGE_MS) return cached.header;

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: endpointOrigin,
    exp: Math.floor(now / 1000) + 12 * 60 * 60,
    sub: config.subject,
  };
  const encoder = new TextEncoder();
  const signingInput = `${base64UrlEncode(encoder.encode(JSON.stringify(header)))}.${base64UrlEncode(encoder.encode(JSON.stringify(payload)))}`;

  const key = await importVapidSigningKey(config);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(signingInput),
  );

  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;
  const result = `vapid t=${jwt}, k=${config.publicKey}`;
  cache.set(endpointOrigin, { header: result, issuedAt: now });
  return result;
}

// ── Payload encryption (RFC 8291 / RFC 8188 aes128gcm, single record) ───

async function hmacSha256(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return new Uint8Array(sig);
}

async function hkdfExpandOneBlock(
  prk: Uint8Array,
  info: Uint8Array,
  len: number,
): Promise<Uint8Array> {
  // Every derivation this protocol needs is <=32 bytes, i.e. fits in the
  // first HKDF-Expand block (RFC 5869), so the general multi-block loop
  // isn't needed.
  const input = concatBytes(info, new Uint8Array([1]));
  const t = await hmacSha256(prk, input);
  return t.slice(0, len);
}

const RECORD_SIZE = 4096;

/**
 * Encrypts `plaintext` for one subscriber per RFC 8291, returning the full
 * aes128gcm body (header + ciphertext) ready to POST as-is.
 */
export async function encryptWebPushPayload(
  subscription: WebPushSubscription,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const receiverPubBytes = base64UrlDecode(subscription.p256dh);
  const authSecretBytes = base64UrlDecode(subscription.auth);
  if (receiverPubBytes.length !== 65) {
    throw new Error("Subscription p256dh must decode to 65 bytes");
  }
  if (authSecretBytes.length < 16) {
    throw new Error("Subscription auth secret must decode to at least 16 bytes");
  }
  if (plaintext.length > RECORD_SIZE - 16 - 1) {
    // 16 = AES-GCM tag, 1 = the single-record delimiter byte. Recall alert
    // payloads (title/body/type) are always well under this.
    throw new Error("Payload too large for a single aes128gcm record");
  }

  const receiverPubKey = await crypto.subtle.importKey(
    "raw",
    receiverPubBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const senderKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const senderPubBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", senderKeyPair.publicKey),
  );

  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: receiverPubKey },
    senderKeyPair.privateKey,
    256,
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  const authInfo = concatBytes(
    new TextEncoder().encode("WebPush: info\0"),
    receiverPubBytes,
    senderPubBytes,
  );
  const ikmPrk = await hmacSha256(authSecretBytes, sharedSecret);
  const ikm = await hkdfExpandOneBlock(ikmPrk, authInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmacSha256(salt, ikm);
  const cek = await hkdfExpandOneBlock(
    prk,
    new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdfExpandOneBlock(
    prk,
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    12,
  );

  const header = new Uint8Array(16 + 4 + 1 + senderPubBytes.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE, false);
  header[20] = senderPubBytes.length;
  header.set(senderPubBytes, 21);

  // Single-record aes128gcm: plaintext followed by the delimiter byte 0x02
  // (RFC 8188 §2 — "2" marks the last, unpadded record), then AES-128-GCM
  // encrypted as one block; Web Crypto appends the auth tag to the
  // ciphertext automatically, which is exactly the wire format this needs.
  const withDelimiter = concatBytes(plaintext, new Uint8Array([2]));
  const cekKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, tagLength: 128 },
    cekKey,
    withDelimiter,
  );

  return concatBytes(header, new Uint8Array(ciphertext));
}

// ── Sending ───────────────────────────────────────────────────────────

export type WebPushSendResult = {
  ok: boolean;
  status: number;
  reason?: string;
  /** true when the push service says this subscription is gone and the row should be deleted. */
  invalidSubscription: boolean;
};

export type WebPushNotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export async function sendWebPush(
  fetchImpl: typeof fetch,
  subscription: WebPushSubscription,
  vapidConfig: VapidConfig,
  notification: WebPushNotificationPayload,
  jwtCache: VapidJwtCache,
): Promise<WebPushSendResult> {
  try {
    const origin = new URL(subscription.endpoint).origin;
    const authHeader = await getVapidAuthHeader(vapidConfig, origin, jwtCache);
    const plaintext = new TextEncoder().encode(JSON.stringify(notification));
    const body = await encryptWebPushPayload(subscription, plaintext);

    const res = await fetchImpl(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400",
      },
      body,
    });

    if (res.ok) return { ok: true, status: res.status, invalidSubscription: false };

    const invalidSubscription = res.status === 404 || res.status === 410;
    return {
      ok: false,
      status: res.status,
      reason: `http_${res.status}`,
      invalidSubscription,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      reason: err instanceof Error ? err.message : "network_error",
      invalidSubscription: false,
    };
  }
}
