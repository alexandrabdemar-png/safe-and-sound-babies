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
