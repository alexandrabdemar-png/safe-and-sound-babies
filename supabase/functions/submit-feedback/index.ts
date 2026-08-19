// Supabase Edge Function: submit-feedback
//
// POST { type: "Bug report" | "Feature request" | "General feedback", message: string, appVersion?: string } →
//   { ok: true }
//
// The real implementation of the profile page's "Share feedback" form
// (FeedbackSection). Saves to public.feedback (migration 20260819000000)
// and emails a copy to SUPPORT_EMAIL (src/lib/constants.ts —
// peaceofminebaby@gmail.com) so bug reports/feature requests/general
// feedback actually reach someone instead of sitting in a table nobody's
// watching.
//
// Runs as an edge function (rather than a TanStack server function) for the
// same reason as send-caregiver-invite: RESEND_API_KEY / NOTIFY_FROM_EMAIL
// are already configured here, not in the main app's hosting environment.
//
// verify_jwt is enabled for this function (see supabase/config.toml).
import { createClient } from "npm:@supabase/supabase-js@2";
import { isValidFeedbackType, buildFeedbackEmail } from "../_shared/feedback.ts";
import { sendFallbackEmail } from "../_shared/notify.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Keep in sync with SUPPORT_EMAIL in src/lib/constants.ts.
const FEEDBACK_RECIPIENT = "peaceofminebaby@gmail.com";
const MAX_MESSAGE_LENGTH = 5000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let type: string | undefined;
  let message: string | undefined;
  let appVersion: string | null = null;
  try {
    const body = await req.json();
    type = typeof body?.type === "string" ? body.type : undefined;
    message = typeof body?.message === "string" ? body.message.trim() : undefined;
    appVersion = typeof body?.appVersion === "string" ? body.appVersion : null;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!isValidFeedbackType(type)) return json({ error: "Invalid feedback type" }, 400);
  if (!message) return json({ error: "Message is required" }, 400);
  if (message.length > MAX_MESSAGE_LENGTH) return json({ error: "Message is too long" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData } = await supabase.auth.getUser(jwt);
  const userId = userData.user?.id ?? null;
  const userEmail = userData.user?.email ?? null;

  const { error: insertErr } = await supabase.from("feedback").insert({
    user_id: userId,
    type,
    message,
    app_version: appVersion,
  });
  if (insertErr) return json({ error: insertErr.message }, 500);

  // Best-effort: the feedback is already saved above regardless of whether
  // this email goes through, so a Resend hiccup shouldn't turn an
  // already-successful submission into an error response for the user.
  const { subject, text } = buildFeedbackEmail(type, message, appVersion, userEmail);
  const emailResult = await sendFallbackEmail(
    fetch,
    Deno.env.get("RESEND_API_KEY"),
    Deno.env.get("NOTIFY_FROM_EMAIL") ?? "noreply@peace-of-mine.app",
    FEEDBACK_RECIPIENT,
    subject,
    text,
  );
  if (!emailResult.ok) {
    console.warn("[submit-feedback] email delivery failed:", emailResult.reason);
  }

  return json({ ok: true });
});
