// Supabase Edge Function: send-caregiver-invite
//
// POST { childIds: string[], email: string, role?: "editor" | "viewer" } →
//   { ok: true }
//
// The real implementation of the profile page's "Share access with a
// co-parent or caregiver" form. Creates a public.caregiver_invites row
// (migration 20260711000000) and emails the invitee a link to
// /caregiver-invite/:token — accepting it (src/lib/caregiverInvite.functions.ts)
// writes the actual public.caregiver_access grant (Feature 4).
//
// Runs as an edge function (rather than a TanStack server function) so it
// can use the RESEND_API_KEY / NOTIFY_FROM_EMAIL secrets already configured
// for this project's other notification code (supabase/functions/_shared/notify.ts)
// without needing a second, separate env var setup in the main app's own
// hosting environment.
//
// verify_jwt is enabled for this function (see supabase/config.toml).
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  generateInviteToken,
  hashInviteToken,
  computeInviteExpiry,
  isValidEmail,
  allChildrenOwned,
  sendInviteEmail,
} from "../_shared/caregiverInvite.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://peace-of-mine.lovable.app";
const MAX_CHILDREN_PER_INVITE = 20;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let childIds: string[] | undefined;
  let email: string | undefined;
  let role: "editor" | "viewer" = "editor";
  try {
    const body = await req.json();
    childIds = Array.isArray(body?.childIds)
      ? body.childIds.filter((x: unknown) => typeof x === "string")
      : undefined;
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : undefined;
    role = body?.role === "viewer" ? "viewer" : "editor";
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!childIds || childIds.length === 0) return json({ error: "childIds is required" }, 400);
  if (childIds.length > MAX_CHILDREN_PER_INVITE) return json({ error: "Too many children" }, 400);
  if (!email || !isValidEmail(email)) return json({ error: "Enter a valid email address" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;
  const callerEmail = (userData.user.email ?? "").toLowerCase();

  if (callerEmail && email === callerEmail) {
    return json({ error: "You can't invite yourself" }, 400);
  }

  // Ownership check via explicit user_id filter (service-role client, so
  // this can't be satisfied by RLS alone) — every requested child must
  // actually belong to the caller before any invite is created.
  const { data: ownedRows, error: ownedErr } = await supabase
    .from("children")
    .select("id, name")
    .in("id", childIds)
    .eq("user_id", userId);
  if (ownedErr) return json({ error: ownedErr.message }, 500);
  if (!allChildrenOwned({ requestedIds: childIds, ownedRows: ownedRows ?? [] })) {
    return json({ error: "One or more children were not found" }, 404);
  }
  const childNames = (ownedRows ?? []).map((r: { name: string }) => r.name);

  const token = generateInviteToken();
  const tokenHash = await hashInviteToken(token);
  const expiresAt = computeInviteExpiry();

  const { error: insertErr } = await supabase.from("caregiver_invites").insert({
    inviter_user_id: userId,
    child_ids: childIds,
    invitee_email: email,
    role,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });
  if (insertErr) return json({ error: insertErr.message }, 500);

  const emailResult = await sendInviteEmail(
    fetch,
    Deno.env.get("RESEND_API_KEY"),
    Deno.env.get("NOTIFY_FROM_EMAIL") ?? "noreply@peace-of-mine.app",
    email,
    APP_URL,
    token,
    childNames,
    role,
  );

  if (!emailResult.ok) {
    // Compensate: the raw token only ever exists in memory here — if the
    // email never reached the invitee, the row we just created is a dead
    // invite no one can ever accept. Remove it and report a real failure
    // rather than a false "sent" success.
    await supabase.from("caregiver_invites").delete().eq("token_hash", tokenHash);
    return json({ error: "Couldn't send the invite email — please try again." }, 502);
  }

  return json({ ok: true });
});
