import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashShareToken } from "@/lib/emergencyShare";

export type AcceptCaregiverInviteResult = { ok: true; childNames: string[] };

// caregiver_invites/caregiver_access aren't in the generated Database types
// (added in migrations 20260711000000 / 20260708000000, after the last
// `supabase gen types` run) — cast through `any` for these tables only,
// same convention used elsewhere in this codebase for the same reason.
type InviteRow = {
  id: string;
  child_ids: string[];
  invitee_email: string;
  role: "editor" | "viewer";
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

/**
 * Accepts a caregiver invite: verifies the token (via its hash — same
 * mechanism as the public read in api/public/caregiver-invite.ts) and that
 * the *authenticated* caller's own verified email matches the invite's
 * invitee_email, then writes the actual public.caregiver_access grant for
 * every child_id on the invite (Feature 4's already-built sharing model).
 *
 * Must run server-side with supabaseAdmin: inserting a caregiver_access row
 * naming someone else's child is exactly what that table's own RLS INSERT
 * policy blocks for a plain authenticated client (only the child's owner
 * can grant access) — the authorization here comes from the invite record
 * itself, checked in code, not from RLS.
 */
export const acceptCaregiverInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) => {
    if (!input?.token || typeof input.token !== "string") {
      throw new Error("token required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const callerEmail = typeof claims.email === "string" ? claims.email.toLowerCase() : null;
    if (!callerEmail) {
      throw new Error("Your account has no verified email — cannot accept this invite.");
    }

    const tokenHash = await hashShareToken(data.token);

    const { data: invite, error: inviteErr } = await (supabaseAdmin as any)
      .from("caregiver_invites")
      .select("id, child_ids, invitee_email, role, expires_at, accepted_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle() as { data: InviteRow | null; error: { message: string } | null };

    if (inviteErr) throw inviteErr;
    if (
      !invite ||
      invite.revoked_at ||
      invite.accepted_at ||
      new Date(invite.expires_at) <= new Date()
    ) {
      throw new Error("This invite is invalid or has expired.");
    }
    if (invite.invitee_email.toLowerCase() !== callerEmail) {
      throw new Error(
        `This invite was sent to ${invite.invitee_email} — sign in with that email address to accept it.`,
      );
    }

    const grants = invite.child_ids.map((childId: string) => ({
      child_id: childId,
      caregiver_user_id: userId,
      role: invite.role,
    }));
    const { error: grantErr } = await (supabaseAdmin as any)
      .from("caregiver_access")
      .upsert(grants, { onConflict: "child_id,caregiver_user_id" });
    if (grantErr) throw grantErr;

    const { error: acceptErr } = await (supabaseAdmin as any)
      .from("caregiver_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    if (acceptErr) throw acceptErr;

    const { data: children } = await supabaseAdmin
      .from("children")
      .select("name")
      .in("id", invite.child_ids);

    return { ok: true, childNames: (children ?? []).map((c: { name: string }) => c.name) } as AcceptCaregiverInviteResult;
  });
