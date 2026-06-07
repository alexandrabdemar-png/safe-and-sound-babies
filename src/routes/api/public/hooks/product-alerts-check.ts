import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily product alerts job.
 *
 * Finds products that are due for replacement or a size-up within the next
 * 7 days and sends a single digest push to each parent via Expo Push.
 * Also surfaces any newly-matched recalls (matching is done by the CPSC
 * sync job and stored in product_recalls).
 */
export const Route = createFileRoute("/api/public/hooks/product-alerts-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const today = new Date();
        const horizon = new Date();
        horizon.setDate(today.getDate() + 7);
        const todayStr = today.toISOString().slice(0, 10);
        const horizonStr = horizon.toISOString().slice(0, 10);

        type ProductRow = {
          id: string;
          user_id: string;
          name: string;
          replace_at: string | null;
          next_size_at: string | null;
        };

        // Products with replace_at or next_size_at falling in the next week
        const { data: products, error } = await supabaseAdmin
          .from("products")
          .select("id, user_id, name, replace_at, next_size_at")
          .or(
            `and(replace_at.gte.${todayStr},replace_at.lte.${horizonStr}),and(next_size_at.gte.${todayStr},next_size_at.lte.${horizonStr})`,
          );

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Newly-created unacknowledged recall matches (last 7 days)
        const since = new Date();
        since.setDate(since.getDate() - 7);
        const { data: newRecalls } = await supabaseAdmin
          .from("product_recalls")
          .select("user_id, product_id, products!inner(name)")
          .eq("acknowledged", false)
          .gte("created_at", since.toISOString());

        // Group reminders per user
        type Bucket = {
          replace: string[];
          sizeUp: string[];
          recalls: string[];
        };
        const byUser = new Map<string, Bucket>();
        const ensure = (uid: string): Bucket => {
          const b = byUser.get(uid) ?? { replace: [], sizeUp: [], recalls: [] };
          byUser.set(uid, b);
          return b;
        };

        for (const p of (products ?? []) as ProductRow[]) {
          const b = ensure(p.user_id);
          if (p.replace_at && p.replace_at >= todayStr && p.replace_at <= horizonStr) {
            b.replace.push(p.name);
          }
          if (
            p.next_size_at &&
            p.next_size_at >= todayStr &&
            p.next_size_at <= horizonStr
          ) {
            b.sizeUp.push(p.name);
          }
        }
        for (const r of (newRecalls ?? []) as Array<{
          user_id: string;
          products: { name: string };
        }>) {
          ensure(r.user_id).recalls.push(r.products.name);
        }

        if (byUser.size === 0) {
          return new Response(
            JSON.stringify({ ok: true, sent: 0, note: "nothing due" }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        // Look up push tokens
        const userIds = Array.from(byUser.keys());
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id, expo_push_token")
          .in("user_id", userIds)
          .not("expo_push_token", "is", null);

        const messages = (profiles ?? [])
          .map((p) => {
            const b = byUser.get(p.user_id);
            if (!b || !p.expo_push_token) return null;
            const parts: string[] = [];
            if (b.recalls.length)
              parts.push(
                `⚠️ Recall on ${b.recalls[0]}${b.recalls.length > 1 ? ` +${b.recalls.length - 1}` : ""}`,
              );
            if (b.replace.length)
              parts.push(
                `Time to replace ${b.replace[0]}${b.replace.length > 1 ? ` +${b.replace.length - 1}` : ""}`,
              );
            if (b.sizeUp.length)
              parts.push(
                `Size up ${b.sizeUp[0]}${b.sizeUp.length > 1 ? ` +${b.sizeUp.length - 1}` : ""}`,
              );
            if (parts.length === 0) return null;
            return {
              to: p.expo_push_token,
              sound: "default",
              title:
                b.recalls.length > 0
                  ? "Safety alert from Safe & Sound"
                  : "A gentle reminder 🌙",
              body: parts.join(" · "),
              data: { type: "product-alerts-digest" },
            };
          })
          .filter((m): m is NonNullable<typeof m> => m !== null);

        if (messages.length === 0) {
          return new Response(
            JSON.stringify({ ok: true, sent: 0, note: "no push tokens" }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        };
        if (process.env.EXPO_ACCESS_TOKEN) {
          headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
        }
        const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers,
          body: JSON.stringify(messages),
        });
        const expoBody = await expoRes.json().catch(() => ({}));

        return new Response(
          JSON.stringify({
            ok: expoRes.ok,
            sent: messages.length,
            users: userIds.length,
            expo: expoBody,
          }),
          {
            status: expoRes.ok ? 200 : 502,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    },
  },
});
