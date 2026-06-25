const FRIENDLY_MAP: [RegExp, string][] = [
  [/duplicate key|already exists/i, "Looks like that's already saved — no need to add it again."],
  [/foreign key|violates.*constraint/i, "Something doesn't line up on our end — please try again in a moment."],
  [/network|fetch|connection|offline/i, "Can't reach the internet right now. Check your connection and try again."],
  [/not authenticated|jwt expired|invalid.*token/i, "Your session expired — just sign in again and you'll be right back."],
  [/permission denied|row-level security/i, "You don't have permission for that action. If this seems wrong, try signing out and back in."],
  [/too many requests|rate limit/i, "You're moving fast — give it a second and try again."],
  [/timeout/i, "That's taking longer than expected. Check your connection and try again."],
  [/storage.*quota|quota exceeded/i, "Your device is almost out of space. Free up some storage and try again."],
];

/**
 * Convert a raw error message into something a parent would actually understand.
 * Falls back to a warm generic message rather than showing the raw error.
 */
export function friendlyError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : typeof raw === "string" ? raw : String(raw ?? "");
  for (const [pattern, friendly] of FRIENDLY_MAP) {
    if (pattern.test(msg)) return friendly;
  }
  // Never expose raw technical errors — return a warm fallback
  return "Something went wrong on our end. Give it a moment and try again — your data is safe.";
}

/** Use when saving data fails */
export function saveError(): string {
  return "We couldn't save that right now. Tap to try again.";
}

/** Use when loading data fails */
export function loadError(): string {
  return "Having trouble loading your data. Pull to refresh or try again in a moment.";
}
