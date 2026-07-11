// barcodeValidation.ts — reject malformed/partial barcodes before they hit
// the lookup pipeline. Fixed length UPC/EAN/GTIN-14 with optional check-digit
// verification for the most common retail formats.

const VALID_LENGTHS = new Set([8, 12, 13, 14]); // EAN-8, UPC-A, EAN-13, GTIN-14

export type BarcodeValidation =
  | { ok: true; barcode: string; format: "EAN-8" | "UPC-A" | "EAN-13" | "GTIN-14" }
  | { ok: false; reason: string };

/**
 * Validate a scanned/typed barcode string. Numeric only, one of four canonical
 * lengths, and (when length ≥ 12) the trailing check digit must verify with
 * the standard mod-10 algorithm. Non-strict on lengths outside the four
 * canonical ones: we surface a specific reason so the UI can show it rather
 * than send garbage to paid lookup APIs.
 */
export function validateBarcode(raw: string): BarcodeValidation {
  const cleaned = (raw ?? "").replace(/\s+/g, "");
  if (!cleaned) return { ok: false, reason: "No barcode detected." };
  if (!/^\d+$/.test(cleaned)) {
    return { ok: false, reason: "Barcode must contain digits only." };
  }
  if (!VALID_LENGTHS.has(cleaned.length)) {
    return {
      ok: false,
      reason: `Barcode length ${cleaned.length} is not a recognized product code (expected 8, 12, 13, or 14 digits).`,
    };
  }
  if (cleaned.length >= 12 && !verifyCheckDigit(cleaned)) {
    return {
      ok: false,
      reason: "Barcode check digit does not verify — try rescanning; it may have been read partially.",
    };
  }
  const format =
    cleaned.length === 8 ? "EAN-8"
    : cleaned.length === 12 ? "UPC-A"
    : cleaned.length === 13 ? "EAN-13"
    : "GTIN-14";
  return { ok: true, barcode: cleaned, format };
}

function verifyCheckDigit(digits: string): boolean {
  // Standard EAN/UPC mod-10: from right, alternating weights 3,1.
  const nums = digits.split("").map((c) => Number(c));
  const provided = nums.pop()!;
  let sum = 0;
  for (let i = nums.length - 1, weightIsThree = true; i >= 0; i--, weightIsThree = !weightIsThree) {
    sum += nums[i] * (weightIsThree ? 3 : 1);
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === provided;
}
