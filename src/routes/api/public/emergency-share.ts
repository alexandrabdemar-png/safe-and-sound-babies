import { createFileRoute } from "@tanstack/react-router";

/**
 * Public, unauthenticated read for a shared emergency-info card.
 *
 * Takes a `token` query param, hashes it with the same SHA-256 the client
 * used to generate the share link (see src/lib/emergencyShare.ts), and
 * looks up emergency_share_links by that hash — never by the raw token,
 * which is never stored. A match must also be unexpired and unrevoked.
 *
 * Deliberately returns the same generic error for "no such token",
 * "expired", and "revoked" so a caller can't distinguish a mistyped URL
 * from a link that used to work — this is the "confirm an expired token
 * is rejected" requirement, satisfied without leaking which case applied.
 */
export const Route = createFileRoute("/api/public/emergency-share")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token) {
          return json({ error: "This link is invalid or has expired." }, 404);
        }

        const { hashShareToken } = await import("@/lib/emergencyShare");
        const tokenHash = await hashShareToken(token);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: link, error: linkErr } = await supabaseAdmin
          .from("emergency_share_links")
          .select("child_id, expires_at, revoked_at")
          .eq("token_hash", tokenHash)
          .maybeSingle();

        // expires_at is NULL for links created after they stopped
        // auto-expiring — only enforce it when actually set (a link
        // created before that change).
        const isExpired = link?.expires_at ? new Date(link.expires_at) <= new Date() : false;
        if (linkErr || !link || link.revoked_at || isExpired) {
          return json({ error: "This link is invalid or has expired." }, 404);
        }

        const [{ data: child }, { data: info }] = await Promise.all([
          supabaseAdmin.from("children").select("name").eq("id", link.child_id).maybeSingle(),
          supabaseAdmin
            .from("emergency_info")
            .select(
              "allergies, medications, blood_type, pediatrician_name, pediatrician_phone, emergency_contact_name, emergency_contact_phone, notes",
            )
            .eq("child_id", link.child_id)
            .maybeSingle(),
        ]);

        if (!info) {
          return json({ error: "This link is invalid or has expired." }, 404);
        }

        return json({
          ok: true,
          child_name: child?.name ?? "your child",
          expires_at: link.expires_at,
          ...info,
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
