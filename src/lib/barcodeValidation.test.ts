import { describe, it, expect } from "vitest";
import { validateBarcode } from "./barcodeValidation";

describe("validateBarcode", () => {
  it("rejects empty", () => {
    expect(validateBarcode("").ok).toBe(false);
  });
  it("rejects non-numeric", () => {
    expect(validateBarcode("abc123").ok).toBe(false);
  });
  it("rejects wrong length", () => {
    expect(validateBarcode("12345").ok).toBe(false);
    expect(validateBarcode("123456789012345").ok).toBe(false);
  });
  it("accepts a valid UPC-A (0123456789012 → check digit valid: '036000291452')", () => {
    // Wikipedia UPC-A example
    const r = validateBarcode("036000291452");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.format).toBe("UPC-A");
  });
  it("rejects a UPC-A with a wrong check digit", () => {
    expect(validateBarcode("036000291453").ok).toBe(false);
  });
  it("accepts a valid EAN-13", () => {
    // 4006381333931 is a canonical EAN-13 example (Staedtler pencil)
    const r = validateBarcode("4006381333931");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.format).toBe("EAN-13");
  });
  it("accepts EAN-8 without check-digit gate (short-form, treated permissively)", () => {
    // We don't check EAN-8 checksum; anything with 8 digits passes for now,
    // matching the loose retail scanner behavior of the free lookup APIs.
    expect(validateBarcode("12345678").ok).toBe(true);
  });
  it("strips whitespace", () => {
    expect(validateBarcode(" 036000291452 ").ok).toBe(true);
  });
});
