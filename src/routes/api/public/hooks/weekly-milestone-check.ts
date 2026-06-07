import { createFileRoute } from "@tanstack/react-router";

/**
 * Weekly milestone push notification job.
 *
 * Called by pg_cron once per week. Finds milestones due in the next 7 days
 * for users who have registered an Expo push token, and sends a single
 * digest notification per parent via the Expo Push API.
 *
 * Auth: requires the Supabase anon key in the `apikey` header (canonical
 * pg_cron pattern). Lives under /api/public/* so it bypasses edge auth.
 */
export const Route = createFileRoute("/api/public/hooks/weekly-milestone-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Lightweight auth: require the project's publishable key
        const apiKey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

        const expectedKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

        if (!apiKey || !expectedKey || apiKey !== expectedKey) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // Find milestones due within the next 7 days, not completed,
        // joined to their child + the parent's profile (for the push token).
        const today = new Date();
        const horizon = new Date();
        horizon.setDate(today.getDate() + 7);
        const todayStr = today.toISOString().slice(0, 10);
        const horizonStr = horizon.toISOString().slice(0, 10);

        const { data: upcoming, error } = await supabaseAdmin
          .from("milestones")
          .select(
            "id, title, due_date, child_id, children!inner(name, user_id)",
          )
          .eq("completed", false)
          .gte("due_date", todayStr)
          .lte("due_date", horizonStr);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        if (!upcoming || upcoming.length === 0) {
          return new Response(
            JSON.stringify({ ok: true, sent: 0, note: "no upcoming milestones" }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        // Group by user_id
        type Row = {
          title: string;
          due_date: string | null;
          children: { name: string; user_id: string };
        };
        const byUser = new Map<
          string,
          { childName: string; items: { title: string; due_date: string | null }[] }
        >();
        for (const r of upcoming as unknown as Row[]) {
          const uid = r.children.user_id;
          const entry = byUser.get(uid) ?? {
            childName: r.children.name,
            items: [],
          };
          entry.items.push({ title: r.title, due_date: r.due_date });
          byUser.set(uid, entry);
        }

        // Look up push tokens for those users
        const userIds = Array.from(byUser.keys());
        const { data: profiles, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("user_id, expo_push_token")
          .in("user_id", userIds)
          .not("expo_push_token", "is", null);

        if (pErr) {
          return new Response(
            JSON.stringify({ error: pErr.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        // Build Expo push messages
        const messages = (profiles ?? [])
          .map((p) => {
            const bucket = byUser.get(p.user_id);
            if (!bucket || !p.expo_push_token) return null;
            const count = bucket.items.length;
            const first = bucket.items[0]?.title ?? "a check-in";
            const body =
              count === 1
                ? first
                : `${first} and ${count - 1} other ${count - 1 === 1 ? "thing" : "things"}`;
            return {
              to: p.expo_push_token,
              sound: "default",
              title: `Quiet reminder for ${bucket.childName} 🌙`,
              body,
              data: { type: "weekly-milestone-digest" },
            };
          })
          .filter((m): m is NonNullable<typeof m> => m !== null);

        if (messages.length === 0) {
          return new Response(
            JSON.stringify({
              ok: true,
              sent: 0,
              note: "no registered push tokens",
              found: upcoming.length,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        // Send via Expo Push API (batch send, optional access token)
        const expoHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        };
        if (process.env.EXPO_ACCESS_TOKEN) {
          expoHeaders.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
        }

        const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: expoHeaders,
          body: JSON.stringify(messages),
        });

        const expoBody = await expoRes.json().catch(() => ({}));

        return new Response(
          JSON.stringify({
            ok: expoRes.ok,
            sent: messages.length,
            upcoming: upcoming.length,
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
