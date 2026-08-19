// Shared, framework-agnostic logic for submit-feedback/index.ts — split out
// so it's independently unit-testable without spinning up the Deno.serve
// handler, matching the pattern already used by caregiverInvite.ts.

export const FEEDBACK_TYPES = ["Bug report", "Feature request", "General feedback"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export function isValidFeedbackType(type: unknown): type is FeedbackType {
  return typeof type === "string" && (FEEDBACK_TYPES as readonly string[]).includes(type);
}

export function buildFeedbackEmail(
  type: FeedbackType,
  message: string,
  appVersion: string | null,
  userEmail: string | null,
): { subject: string; text: string } {
  const subject = type === "Bug report" ? `[Peace of Mine] Bug report` : `[Peace of Mine] ${type}`;
  const text = [
    `Type: ${type}`,
    `From: ${userEmail ?? "unknown / not signed in"}`,
    `App version: ${appVersion ?? "unknown"}`,
    "",
    message,
  ].join("\n");
  return { subject, text };
}
