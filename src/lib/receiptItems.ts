/**
 * Shared rules for items read off a receipt photo. A receipt line is only a
 * starting point: recall matching needs the full brand AND product name, so
 * an item missing either is saved but flagged as not fully recall-checked.
 */
export type ReceiptItemKind = "product" | "food";

export type ReceiptItem = {
  id: string;
  receiptText: string;
  name: string;
  brand: string;
  kind: ReceiptItemKind;
  categoryKey: string | null;
  confident: boolean;
};

export const RECEIPT_ACCURACY_WARNING =
  "Receipts often shorten names. We can only check recalls accurately when the full brand and product name are entered. Scanning the barcode is still the most accurate way to add an item. Use receipt import at your own risk.";

/** True when the item has enough identity for recall matching. */
export function isRecallReady(item: Pick<ReceiptItem, "name" | "brand">): boolean {
  const name = item.name.trim();
  const brand = item.brand.trim();
  if (brand.length < 2 || name.length < 4) return false;
  // A name with no vowels ("GRB PCH APL") is almost always a receipt abbreviation.
  if (!/[aeiou]/i.test(name)) return false;
  return true;
}
