import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Caregiver access management: list who currently has access to the
 * caller's children (plus still-open invites), and revoke either. The RLS
 * policies for caregiver_access / caregiver_invites already allow the
 * owning parent to do this — until now nothing in the app called them, so
 * shared access could be granted but never taken back.
 *
 * Runs as the caller (no admin client): caregiver_access DELETE is scoped
 * by RLS to rows for children the caller owns, and caregiver_invites has
 * no UPDATE policy, so revoking an unaccepted invite deletes the row.
 * Emails come from the invite record, not from auth.users, so this never
 * needs privileged access to look up another account.
 */
export type CaregiverGrant = {
  id: string;
  childId: string;
  childName: string;
  role: string;
  createdAt: string;
  caregiverUserId: string;
};

export type PendingInvite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  childIds: string[];
};

export const listCaregiverAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: kids, error: kidsErr } = await supabase
      .from("children")
      .select("id, name")
      .eq("user_id", userId);
    if (kidsErr) throw new Error(kidsErr.message);
    const childNames = new Map((kids ?? []).map((k) => [k.id, k.name]));

    const { data: grants, error: grantsErr } = await (supabase as any)
      .from("caregiver_access")
      .select("id, child_id, caregiver_user_id, role, created_at")
      .in("child_id", Array.from(childNames.keys()).length ? Array.from(childNames.keys()) : [""]);
    if (grantsErr) throw new Error(grantsErr.message);

    const { data: invites, error: invitesErr } = await (supabase as any)
      .from("caregiver_invites")
      .select("id, invitee_email, role, expires_at, child_ids, accepted_at, revoked_at")
      .eq("inviter_user_id", userId)
      .is("accepted_at", null)
      .is("revoked_at", null);
    if (invitesErr) throw new Error(invitesErr.message);

    const now = Date.now();
    return {
      grants: ((grants ?? []) as any[]).map((g) => ({
        id: g.id,
        childId: g.child_id,
        childName: childNames.get(g.child_id) ?? "Your child",
        role: g.role,
        createdAt: g.created_at,
        caregiverUserId: g.caregiver_user_id,
      })) as CaregiverGrant[],
      invites: ((invites ?? []) as any[])
        .filter((i) => new Date(i.expires_at).getTime() > now)
        .map((i) => ({
          id: i.id,
          email: i.invitee_email,
          role: i.role,
          expiresAt: i.expires_at,
          childIds: i.child_ids ?? [],
        })) as PendingInvite[],
    };
  });

export const revokeCaregiverAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { grantId: string }) => {
    if (!input?.grantId) throw new Error("grantId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("caregiver_access")
      .delete()
      .eq("id", data.grantId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const revokeCaregiverInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { inviteId: string }) => {
    if (!input?.inviteId) throw new Error("inviteId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("caregiver_invites")
      .delete()
      .eq("id", data.inviteId)
      .eq("inviter_user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
