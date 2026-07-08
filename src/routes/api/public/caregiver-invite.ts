import { createFileRoute } from "@tanstack/react-router";

/**
 * Public, unauthenticated read for a caregiver invite — the invitee hasn't
 * signed in yet the first time they land on /caregiver-invite/:token, so
 * this lets the page show "Alex invited you to help care for Emma" and
 * pre-fill the correct email before asking them to sign in.
 *
 * Takes a `token` query param, hashes it with the same SHA-256 the invite
 * email's link used, and looks up caregiver_invites by that hash — never by
 * the raw token, which is never stored (see migration 20260711000000).
 * Deliberately returns the same generic error for "no such token",
 * "expired", "revoked", and "already accepted" so a caller can't distinguish
 * a mistyped URL from a link that used to work.
 */
export const Route = createFileRoute("/api/public/caregiver-invite")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token) {
          return json({ error: "This invite is invalid or has expired." }, 404);
        }

        const { hashShareToken } = await import("@/lib/emergencyShare");
        const tokenHash = await hashShareToken(token);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // caregiver_invites isn't in the generated Database types (added in
        // migration 20260711000000, after the last `supabase gen types`
        // run) — cast through `any` for this table only, same convention
        // used elsewhere in this codebase for the same reason.
        type InviteRow = {
          child_ids: string[];
          invitee_email: string;
          role: "editor" | "viewer";
          expires_at: string;
          accepted_at: string | null;
          revoked_at: string | null;
        };
        const { data: invite, error: inviteErr } = await (supabaseAdmin as any)
          .from("caregiver_invites")
          .select("inviter_user_id, child_ids, invitee_email, role, expires_at, accepted_at, revoked_at")
          .eq("token_hash", tokenHash)
          .maybeSingle() as { data: InviteRow | null; error: { message: string } | null };

        if (
          inviteErr ||
          !invite ||
          invite.revoked_at ||
          invite.accepted_at ||
          new Date(invite.expires_at) <= new Date()
        ) {
          return json({ error: "This invite is invalid or has expired." }, 404);
        }

        const { data: children } = await supabaseAdmin
          .from("children")
          .select("name")
          .in("id", invite.child_ids);

        return json({
          ok: true,
          inviteeEmail: invite.invitee_email,
          childNames: (children ?? []).map((c: { name: string }) => c.name),
          role: invite.role,
        });
      },
    },
  },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
