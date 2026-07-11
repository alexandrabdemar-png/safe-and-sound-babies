// recallFreshness.ts — content-addressable hashing for recall records so we
// can distinguish "this recall was updated" from "same record, just re-synced".
//
// Runtime constraints:
//   • Runs both in the browser (product-detail view, alerts UI) and in Deno
//     (scheduled-recall-check). Uses only Web Crypto (globalThis.crypto),
//     which both provide natively — no Node crypto import.
//
// Also normalizes a "hazard fingerprint" used to dedup the same physical
// recall showing up in multiple upstream feeds (e.g. a CPSC recall that
// also appears in Health Canada). Stable across sources for the same
// underlying incident.

const FIELDS_TO_HASH = ["title", "hazard", "remedy", "description"] as const;

function normalizeForHash(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * SHA-256 (hex-truncated to 32 chars) of the notice-material fields. When
 * this changes between syncs, the batch job re-notifies affected users with
 * an "Updated recall" push. Deterministic across CPU, byte order, and
 * whitespace variations. Never throws; returns "" on any hashing error so
 * the caller can safely skip the equality check (fail-open — worse case:
 * an update is not re-notified, same as pre-change behavior).
 */
export async function computeContentHash(fields: {
  title?: string | null;
  hazard?: string | null;
  remedy?: string | null;
  description?: string | null;
}): Promise<string> {
  try {
    const joined = FIELDS_TO_HASH.map((k) => normalizeForHash(fields[k])).join("|");
    const bytes = new TextEncoder().encode(joined);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .slice(0, 16)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

/**
 * Cross-source dedup key. Normalizes brand + product + model to a short
 * fingerprint; when two catalog rows share the same fingerprint but come
 * from different sources they represent the same physical recall.
 */
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
  // Drop very short "fingerprints" (< 6 non-space chars); those would over-dedup.
  if (raw.replace(/\s+/g, "").length < 6) return "";
  return raw.split(/\s+/).sort().join("-").slice(0, 120);
}

/**
 * Format a "Data as of X" clause used everywhere a recall answer is shown.
 * Absorbs null/invalid dates without throwing.
 */
export function formatDataAsOf(iso: string | Date | null | undefined, now: Date = new Date()): string {
  if (!iso) return "Data freshness unavailable";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return "Data freshness unavailable";
  const diffH = (now.getTime() - d.getTime()) / 3_600_000;
  if (diffH < 1) return "Data as of just now";
  if (diffH < 24) return `Data as of ${Math.floor(diffH)} hour${diffH < 2 ? "" : "s"} ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Data as of yesterday";
  if (diffD < 30) return `Data as of ${diffD} days ago`;
  return `Data as of ${d.toISOString().slice(0, 10)}`;
}

/**
 * Staleness label for the pipeline itself — shown in the alerts inbox when
 * the daily batch hasn't completed successfully in >26h.
 */
export function isPipelineStale(lastSuccessAt: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastSuccessAt) return true;
  const d = lastSuccessAt instanceof Date ? lastSuccessAt : new Date(lastSuccessAt);
  if (isNaN(d.getTime())) return true;
  return now.getTime() - d.getTime() > 26 * 3_600_000;
}
