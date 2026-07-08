// Shared, testable logic for the send-caregiver-invite edge function.
// Token generation mirrors src/lib/emergencyShare.ts's approach (random
// 256-bit token, only its SHA-256 hash ever persisted) — duplicated rather
// than imported since edge functions are a separate Deno deploy target from
// the main app; kept intentionally tiny so the duplication stays cheap.
import { sendFallbackEmail, type EmailResult } from "./notify.ts";

const TOKEN_BYTES = 32;
export const INVITE_LIFETIME_HOURS = 24 * 7; // 7 days

export function generateInviteToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function hashInviteToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function computeInviteExpiry(now = new Date()): Date {
  return new Date(now.getTime() + INVITE_LIFETIME_HOURS * 60 * 60 * 1000);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function buildInviteEmail(
  appUrl: string,
  token: string,
  childNames: string[],
  role: "editor" | "viewer",
): { subject: string; text: string } {
  const names = childNames.length > 0 ? childNames.join(" & ") : "their child";
  const link = `${appUrl}/caregiver-invite/${token}`;
  const roleLabel = role === "editor" ? "view and edit" : "view";
  return {
    subject: `You've been invited to help care for ${names} on Peace of Mine`,
    text:
      `You've been invited to ${roleLabel} ${names}'s profile on Peace of Mine — ` +
      `products, safety milestones, and recall alerts.\n\n` +
      `Accept the invite: ${link}\n\n` +
      `This link expires in 7 days. If you weren't expecting this, you can ignore this email.`,
  };
}

export type ChildOwnershipCheck = {
  requestedIds: string[];
  ownedRows: { id: string; name: string }[];
};

/**
 * True only if every requested child_id is present in the owner's own rows.
 * An empty request is deliberately false, not vacuously true — a caller
 * with zero children to check is never a valid invite, so this fails
 * closed instead of relying solely on a separate non-empty validation step.
 */
export function allChildrenOwned(check: ChildOwnershipCheck): boolean {
  if (check.requestedIds.length === 0) return false;
  if (check.ownedRows.length !== check.requestedIds.length) return false;
  const ownedIds = new Set(check.ownedRows.map((r) => r.id));
  return check.requestedIds.every((id) => ownedIds.has(id));
}

export async function sendInviteEmail(
  fetchImpl: typeof fetch,
  resendApiKey: string | undefined,
  fromAddress: string,
  toEmail: string,
  appUrl: string,
  token: string,
  childNames: string[],
  role: "editor" | "viewer",
): Promise<EmailResult> {
  const { subject, text } = buildInviteEmail(appUrl, token, childNames, role);
  return sendFallbackEmail(fetchImpl, resendApiKey, fromAddress, toEmail, subject, text);
}
