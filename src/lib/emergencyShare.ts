// Token generation/hashing for emergency-info shareable links. Uses the
// standard Web Crypto API (available in both browsers and Node), so this
// runs client-side (token is generated in the browser when a parent taps
// "Create link") and is also directly unit-testable.
//
// The raw token is only ever held in memory / shown to the user once; only
// its SHA-256 hash is ever sent to Supabase and stored in
// emergency_share_links.token_hash. See the migration
// (20260707000000_emergency_info.sql) for why: a leaked database dump
// should not hand out usable share links.

const TOKEN_BYTES = 32; // 256 bits — infeasible to brute force

// Links used to auto-expire, then migration 20260719000000 removed expiry
// entirely (expires_at: null forever) — presumably to fix a parent losing
// access to a link they still needed. That traded away too much: a link
// leaked once (a group chat, a synced photo library, a chat app's
// server-side link-preview fetcher hitting the read endpoint) stayed a
// standing credential to a child's allergies/medications/blood
// type/emergency contact phone number forever, with nothing prompting the
// parent to ever revisit it. A generous but bounded default (1 year, easy
// to regenerate) keeps the "still works months later" convenience while
// putting a ceiling on how long a forgotten leaked link stays live.
const LINK_LIFETIME_DAYS = 365;

export function computeShareLinkExpiry(now = new Date()): Date {
  return new Date(now.getTime() + LINK_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
}

export function generateShareToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function hashShareToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
