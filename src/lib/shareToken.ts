// SHA-256 hashing for token-based share/invite links (currently: caregiver
// invites). Uses the standard Web Crypto API, available in both browsers
// and the Node/edge server runtime. Only a token's hash is ever persisted
// to the database — see caregiver_invites.token_hash — so a leaked database
// dump can't be used to derive working invite links.
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
