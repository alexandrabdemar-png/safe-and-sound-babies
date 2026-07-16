import { describe, expect, it } from "vitest";
import { generateShareToken, hashShareToken } from "./emergencyShare";

describe("generateShareToken", () => {
  it("generates a 64-character hex string (256 bits)", () => {
    const token = generateShareToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates a different token on every call", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateShareToken()));
    expect(tokens.size).toBe(50);
  });
});

describe("hashShareToken", () => {
  it("produces a deterministic 64-character hex SHA-256 hash", async () => {
    const hash = await hashShareToken("hello world");
    expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
  });

  it("produces different hashes for different tokens", async () => {
    const a = await hashShareToken(generateShareToken());
    const b = await hashShareToken(generateShareToken());
    expect(a).not.toBe(b);
  });

  it("is deterministic — the same token always hashes the same way", async () => {
    const token = generateShareToken();
    const h1 = await hashShareToken(token);
    const h2 = await hashShareToken(token);
    expect(h1).toBe(h2);
  });
});
