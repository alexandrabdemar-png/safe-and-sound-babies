// Minimal Resend email sender for server-side (Node) code — same Resend API
// call as supabase/functions/_shared/notify.ts's sendFallbackEmail, but that
// copy lives in the edge-functions deploy target (Deno) and isn't reachable
// from the main app's TanStack server functions. Duplicated rather than
// imported across that boundary; kept intentionally tiny (one HTTP call) so
// the duplication stays cheap. Fails open (returns ok:false, never throws)
// so a failed invite email doesn't take down the caller.
export type EmailResult = { ok: boolean; reason?: string };

export async function sendResendEmail(
  fetchImpl: typeof fetch,
  apiKey: string | undefined,
  fromAddress: string,
  to: string,
  subject: string,
  bodyText: string,
): Promise<EmailResult> {
  if (!apiKey) {
    console.warn("[sendEmail] RESEND_API_KEY not configured — cannot send to", to);
    return { ok: false, reason: "email_not_configured" };
  }
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress, to: [to], subject, text: bodyText }),
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "network_error" };
  }
}
