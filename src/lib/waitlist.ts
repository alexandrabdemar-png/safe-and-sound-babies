// Pre-launch waitlist: validation and the Supabase calls behind /waitlist.
// The table and count function come from
// supabase/migrations/20261102120000_waitlist_signups.sql.

export const WAITLIST_STAGES = [
  { value: "expecting", label: "Expecting" },
  { value: "newborn", label: "Newborn (0–3 months)" },
  { value: "baby", label: "Baby (3–12 months)" },
  { value: "toddler", label: "Toddler (1–3 years)" },
  { value: "other", label: "Something else" },
] as const;

export type WaitlistStage = (typeof WAITLIST_STAGES)[number]["value"];

export interface WaitlistInput {
  email: string;
  firstName?: string;
  stage?: WaitlistStage | "";
  source?: string | null;
  consented: boolean;
  /** Hidden "website" field: real people leave it empty; bots fill it in. */
  honeypot?: string;
}

export type WaitlistResult =
  { ok: true } | { ok: false; reason: "invalid-email" | "no-consent" | "failed"; message: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length >= 3 && email.length <= 254 && EMAIL.test(email);
}

/** "?ref=TikTok" → "tiktok". Anything that isn't a short simple tag is dropped. */
export function parseSource(ref: string | null | undefined): string | null {
  const tag = (ref ?? "").trim().toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(tag) ? tag : null;
}

/** The narrow slice of the Supabase client this module uses. */
export interface WaitlistClient {
  from: (table: "waitlist_signups") => {
    insert: (
      row: Record<string, unknown>,
    ) => PromiseLike<{ error: { code?: string; message: string } | null }>;
  };
  rpc: (fn: "waitlist_count") => PromiseLike<{ data: unknown; error: unknown }>;
}

export async function joinWaitlist(
  client: WaitlistClient,
  input: WaitlistInput,
): Promise<WaitlistResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return { ok: false, reason: "invalid-email", message: "Please enter a valid email address." };
  }
  if (!input.consented) {
    return {
      ok: false,
      reason: "no-consent",
      message: "Please tick the box so we can email you at launch.",
    };
  }
  // Pretend it worked so bots don't learn to skip the trap.
  if (input.honeypot) return { ok: true };

  const firstName = input.firstName?.trim().slice(0, 80) || null;
  const { error } = await client.from("waitlist_signups").insert({
    email,
    first_name: firstName,
    stage: input.stage || null,
    source: parseSource(input.source),
    consented_to_emails: true,
  });
  // 23505 = already on the list. Treat it as success, so the form never
  // reveals whether a particular email has signed up.
  if (!error || error.code === "23505") return { ok: true };
  return {
    ok: false,
    reason: "failed",
    message: "We couldn't add you just now. Please try again in a moment.",
  };
}

/** Total signups, or null if it can't be read (never blocks the page). */
export async function fetchWaitlistCount(client: WaitlistClient): Promise<number | null> {
  try {
    const { data, error } = await client.rpc("waitlist_count");
    if (error) return null;
    const n = Number(data);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Only show the social-proof line once there's a number worth bragging about. */
export const WAITLIST_COUNT_MIN_TO_SHOW = 25;
