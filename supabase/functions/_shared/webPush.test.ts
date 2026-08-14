import { describe, it, expect } from "vitest";
import {
  createECDH,
  createHmac,
  createDecipheriv,
  generateKeyPairSync,
  verify as nodeVerify,
} from "node:crypto";
import {
  encryptWebPushPayload,
  getVapidAuthHeader,
  sendWebPush,
  type VapidConfig,
  type VapidJwtCache,
  type WebPushSubscription,
} from "./webPush";

// ── An independent reference decryptor (RFC 8291 aes128gcm), written from
// scratch against the RFC rather than reusing any code from webPush.ts, so
// these tests actually catch a broken production implementation instead of
// just echoing it back. Verified by hand against the `http_ece` package
// (the library the real `web-push` npm package delegates encryption to)
// during development — see the hardcoded golden vector below, captured
// from that library's actual output.
function b64u(buf: Buffer): string {
  return buf.toString("base64url");
}

function hkdfExtract(salt: Buffer, ikm: Buffer): Buffer {
  return createHmac("sha256", salt).update(ikm).digest();
}

function hkdfExpand(prk: Buffer, info: Buffer, len: number): Buffer {
  return createHmac("sha256", prk)
    .update(Buffer.concat([info, Buffer.from([1])]))
    .digest()
    .subarray(0, len);
}

function referenceDecrypt(
  cipher: Buffer,
  receiverEcdh: ReturnType<typeof createECDH>,
  authSecret: Buffer,
): Buffer {
  const salt = cipher.subarray(0, 16);
  const idlen = cipher.readUInt8(20);
  const senderPub = cipher.subarray(21, 21 + idlen);
  const ciphertext = cipher.subarray(21 + idlen);

  const receiverPub = receiverEcdh.getPublicKey();
  const sharedSecret = receiverEcdh.computeSecret(senderPub);
  const authInfo = Buffer.concat([Buffer.from("WebPush: info\0"), receiverPub, senderPub]);
  const ikmPrk = hkdfExtract(authSecret, sharedSecret);
  const ikm = hkdfExpand(ikmPrk, authInfo, 32);
  const prk = hkdfExtract(salt, ikm);
  const cek = hkdfExpand(prk, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdfExpand(prk, Buffer.from("Content-Encoding: nonce\0"), 12);

  const tag = ciphertext.subarray(ciphertext.length - 16);
  const data = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  if (plain[plain.length - 1] !== 2) throw new Error("bad record delimiter");
  return plain.subarray(0, plain.length - 1);
}

describe("encryptWebPushPayload", () => {
  it("decrypts a real http_ece-produced ciphertext correctly (golden vector)", () => {
    // Captured from the actual `http_ece` package (used internally by the
    // `web-push` npm library) encrypting {"title":"Test Recall","body":"hello world"}
    // with these exact keys/salt. Confirms referenceDecrypt below is a
    // faithful RFC 8291 implementation before trusting it to validate our
    // production encryptor.
    const receiverPriv = Buffer.from("tDNElRoRexi9AweUzFvKUPQZnms3fonjXBUwHsqsA-c", "base64url");
    const authSecret = Buffer.from("0-CWJpA2SXuCMlaPh9CLSA", "base64url");
    const cipherHex =
      "32645b0a89decb9631dffac534b87c5f0000100041041ec32f17a60ebd87ac11a72b193ba82bd715d779d38622e99624579cb75a707dc38167d66b513a55f8fd48f07cc4991468464a676adb3380db97ae4fb6f789498499297cf2d3fa27cf70c504f5aee2ab223c0db8d86a383e6832dfcb487c936e79288a8a8c00c66e870ef65c6031794000307762a93d651f24a76f86f0";
    const cipher = Buffer.from(cipherHex, "hex");

    const receiverEcdh = createECDH("prime256v1");
    receiverEcdh.setPrivateKey(receiverPriv);

    const plain = referenceDecrypt(cipher, receiverEcdh, authSecret);
    expect(JSON.parse(plain.toString())).toEqual({ title: "Test Recall", body: "hello world" });
  });

  it("round-trips through the independent reference decryptor for a fresh keypair", async () => {
    const receiverEcdh = createECDH("prime256v1");
    receiverEcdh.generateKeys();
    const authSecret = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));

    const subscription: WebPushSubscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      p256dh: b64u(receiverEcdh.getPublicKey()),
      auth: b64u(authSecret),
    };
    const plaintext = new TextEncoder().encode(
      JSON.stringify({
        title: "⚠️ Safety Recall — Test Crib",
        body: "Tap to review.",
        data: { type: "recall" },
      }),
    );

    const encrypted = await encryptWebPushPayload(subscription, plaintext);
    const decrypted = referenceDecrypt(Buffer.from(encrypted), receiverEcdh, authSecret);

    expect(new TextDecoder().decode(decrypted)).toBe(new TextDecoder().decode(plaintext));
  });

  it("rejects a payload too large for a single record", async () => {
    const receiverEcdh = createECDH("prime256v1");
    receiverEcdh.generateKeys();
    const subscription: WebPushSubscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      p256dh: b64u(receiverEcdh.getPublicKey()),
      auth: b64u(Buffer.from(crypto.getRandomValues(new Uint8Array(16)))),
    };
    await expect(encryptWebPushPayload(subscription, new Uint8Array(5000))).rejects.toThrow(
      /too large/,
    );
  });
});

function makeVapidConfig(): VapidConfig {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pubJwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const privJwk = privateKey.export({ format: "jwk" }) as { d: string };
  const pubBytes = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(pubJwk.x, "base64url"),
    Buffer.from(pubJwk.y, "base64url"),
  ]);
  return {
    publicKey: b64u(pubBytes),
    privateKey: privJwk.d,
    subject: "mailto:alerts@example.com",
  };
}

describe("getVapidAuthHeader", () => {
  it("produces a genuinely valid ES256 JWT with the right aud/sub claims", async () => {
    const config = makeVapidConfig();
    const cache: VapidJwtCache = new Map();
    const header = await getVapidAuthHeader(config, "https://fcm.googleapis.com", cache);

    const match = header.match(/^vapid t=([^,]+), k=(.+)$/);
    expect(match).toBeTruthy();
    const [, jwt, k] = match!;
    expect(k).toBe(config.publicKey);

    const [headerB64, payloadB64, sigB64] = jwt.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    expect(payload.aud).toBe("https://fcm.googleapis.com");
    expect(payload.sub).toBe("mailto:alerts@example.com");
    expect(typeof payload.exp).toBe("number");

    // Verify the signature against a real public key derived from the same
    // config, using Node's crypto.verify (dsaEncoding "ieee-p1363" expects
    // the raw R||S format Web Crypto's ECDSA output uses, same as the APNs
    // JWT test in notify.test.ts).
    const pubDer = {
      kty: "EC",
      crv: "P-256",
      x: config.publicKey
        ? Buffer.from(config.publicKey, "base64url").subarray(1, 33).toString("base64url")
        : "",
      y: Buffer.from(config.publicKey, "base64url").subarray(33, 65).toString("base64url"),
    };
    const { createPublicKey } = await import("node:crypto");
    const publicKeyObject = createPublicKey({ key: { ...pubDer, ext: true }, format: "jwk" });
    const signingInput = `${headerB64}.${payloadB64}`;
    const valid = nodeVerify(
      "sha256",
      Buffer.from(signingInput),
      { key: publicKeyObject, dsaEncoding: "ieee-p1363" },
      Buffer.from(sigB64, "base64url"),
    );
    expect(valid).toBe(true);
  });

  it("caches per-origin and reuses the cached header on the next call", async () => {
    const config = makeVapidConfig();
    const cache: VapidJwtCache = new Map();
    const first = await getVapidAuthHeader(config, "https://fcm.googleapis.com", cache);
    const second = await getVapidAuthHeader(config, "https://fcm.googleapis.com", cache);
    expect(second).toBe(first);

    const different = await getVapidAuthHeader(
      config,
      "https://updates.push.services.mozilla.com",
      cache,
    );
    expect(different).not.toBe(first);
  });
});

describe("sendWebPush", () => {
  it("returns ok on a successful push", async () => {
    const config = makeVapidConfig();
    const receiverEcdh = createECDH("prime256v1");
    receiverEcdh.generateKeys();
    const subscription: WebPushSubscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      p256dh: b64u(receiverEcdh.getPublicKey()),
      auth: b64u(Buffer.from(crypto.getRandomValues(new Uint8Array(16)))),
    };
    const fetchImpl = (async () => ({ ok: true, status: 201 })) as unknown as typeof fetch;
    const result = await sendWebPush(
      fetchImpl,
      subscription,
      config,
      { title: "t", body: "b" },
      new Map(),
    );
    expect(result).toEqual({ ok: true, status: 201, invalidSubscription: false });
  });

  it("flags a 410 Gone response as an invalid subscription to delete", async () => {
    const config = makeVapidConfig();
    const receiverEcdh = createECDH("prime256v1");
    receiverEcdh.generateKeys();
    const subscription: WebPushSubscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/gone",
      p256dh: b64u(receiverEcdh.getPublicKey()),
      auth: b64u(Buffer.from(crypto.getRandomValues(new Uint8Array(16)))),
    };
    const fetchImpl = (async () => ({ ok: false, status: 410 })) as unknown as typeof fetch;
    const result = await sendWebPush(
      fetchImpl,
      subscription,
      config,
      { title: "t", body: "b" },
      new Map(),
    );
    expect(result.ok).toBe(false);
    expect(result.invalidSubscription).toBe(true);
  });
});
