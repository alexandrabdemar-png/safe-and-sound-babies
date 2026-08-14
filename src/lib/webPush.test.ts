import { describe, it, expect } from "vitest";
import { urlBase64ToUint8Array } from "./webPush";

describe("urlBase64ToUint8Array", () => {
  it("decodes a VAPID-style base64url public key to 65 raw bytes starting with 0x04", () => {
    // A real 65-byte uncompressed P-256 point, base64url-encoded (no padding) —
    // exactly the shape `npx web-push generate-vapid-keys` produces.
    const publicKey =
      "BDN7e7ONnGFJnR3Oeqvhqs_27MljJLPftilpEiSJt8ZOoOs53UmIij_tBhqh3yRiJDdrQtLTgpV7FryME_7aAXo";
    const bytes = urlBase64ToUint8Array(publicKey);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(0x04);
  });

  it("round-trips against Buffer's base64url decoding", () => {
    const original = Buffer.from("hello world, this is a test payload");
    const b64url = original.toString("base64url");
    const decoded = urlBase64ToUint8Array(b64url);
    expect(Buffer.from(decoded).toString()).toBe(original.toString());
  });
});
