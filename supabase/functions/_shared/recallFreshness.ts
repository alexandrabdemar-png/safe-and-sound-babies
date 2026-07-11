// Deno mirror of src/lib/recallFreshness.ts. Keep in sync.

const FIELDS_TO_HASH = ["title", "hazard", "remedy", "description"] as const;

function normalizeForHash(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export async function computeContentHash(fields: {
  title?: string | null;
  hazard?: string | null;
  remedy?: string | null;
  description?: string | null;
}): Promise<string> {
  try {
    const joined = FIELDS_TO_HASH.map((k) => normalizeForHash(fields[k])).join("|");
    const bytes = new TextEncoder().encode(joined);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .slice(0, 16)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

export function hazardFingerprint(fields: {
  brand?: string | null;
  product_name?: string | null;
  model?: string | null;
  title?: string | null;
}): string {
  const raw = [fields.brand, fields.product_name, fields.model, fields.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (raw.replace(/\s+/g, "").length < 6) return "";
  return raw.split(/\s+/).sort().join("-").slice(0, 120);
}
