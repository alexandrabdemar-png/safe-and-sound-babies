import { createFileRoute } from "@tanstack/react-router";
import { hookUnauthorizedResponse } from "@/lib/hookAuth";


/**
 * Daily product alerts job.
 *
 * Finds products with a predicted_replacement_date within the next 7 days
 * and sends a push digest to each parent directly via Apple Push
 * Notification service (see src/lib/apns.server.ts).
 * Respects per-user notification settings stored in user_notification_settings.
 *
 * Recall notifications are no longer sent from here — the
 * scheduled-recall-check Supabase Edge Function now owns recall detection
 * *and* delivery end to end (see
 * supabase/migrations/20260705000000_recall_alerts_pipeline.sql), so this
 * job would otherwise double-notify the same recall via two different code
 * paths.
 */
export const Route = createFileRoute("/api/public/hooks/product-alerts-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = hookUnauthorizedResponse(request);
        if (unauthorized) return unauthorized;



        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const today = new Date();
        const horizon = new Date();
        horizon.setDate(today.getDate() + 7);
        const todayStr = today.toISOString().slice(0, 10);
        const horizonStr = horizon.toISOString().slice(0, 10);

        // Products due for replacement in the next 7 days
        type ProductRow = {
          id: string;
          user_id: string;
          name: string;
          child_id: string | null;
          predicted_replacement_date: string | null;
        };
        const { data: products, error } = await supabaseAdmin
          .from("products")
          .select("id, user_id, name, child_id, predicted_replacement_date")
          .gte("predicted_replacement_date", todayStr)
          .lte("predicted_replacement_date", horizonStr);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const allUserIds = new Set<string>();
        for (const p of (products ?? []) as ProductRow[]) allUserIds.add(p.user_id);

        if (allUserIds.size === 0) {
          return new Response(JSON.stringify({ ok: true, sent: 0, note: "nothing due" }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        // Load notification settings for all involved users
        const userIds = Array.from(allUserIds);
        const { data: settingsRows } = await (supabaseAdmin as any)
          .from("user_notification_settings")
          .select("user_id, replacement_enabled")
          .in("user_id", userIds);

        type UserSettings = { replacement_enabled: boolean };
        const settingsMap = new Map<string, UserSettings>();
        for (const s of (settingsRows ?? []) as unknown as Array<
          { user_id: string } & UserSettings
        >) {
          settingsMap.set(s.user_id, s);
        }
        const getSetting = (uid: string): UserSettings =>
          settingsMap.get(uid) ?? { replacement_enabled: true };

        // Load already-sent alerts to avoid duplicates (last 7 days)
        const since = new Date();
        since.setDate(since.getDate() - 7);
        const productIds = (products ?? []).map((p) => (p as ProductRow).id);
        const { data: sentAlerts } = productIds.length
          ? await supabaseAdmin
              .from("product_alerts")
              .select("product_id, alert_type")
              .in("product_id", productIds)
              .gte("created_at", since.toISOString())
          : { data: [] };

        const sentSet = new Set((sentAlerts ?? []).map((a) => `${a.product_id}:${a.alert_type}`));

        // Group per-user messages
        type Bucket = {
          replace: Array<{ name: string; productId: string }>;
        };
        const byUser = new Map<string, Bucket>();
        const ensure = (uid: string): Bucket => {
          const b = byUser.get(uid) ?? { replace: [] };
          byUser.set(uid, b);
          return b;
        };

        for (const p of (products ?? []) as ProductRow[]) {
          const s = getSetting(p.user_id);
          const b = ensure(p.user_id);
          if (
            s.replacement_enabled &&
            p.predicted_replacement_date &&
            p.predicted_replacement_date >= todayStr &&
            p.predicted_replacement_date <= horizonStr &&
            !sentSet.has(`${p.id}:replacement`)
          ) {
            b.replace.push({ name: p.name, productId: p.id });
          }
        }

        // Remove empty buckets
        for (const [uid, b] of byUser) {
          if (!b.replace.length) byUser.delete(uid);
        }

        if (byUser.size === 0) {
          return new Response(JSON.stringify({ ok: true, sent: 0, note: "nothing to send" }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        // Look up push tokens
        const recipientIds = Array.from(byUser.keys());
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id, apns_device_token")
          .in("user_id", recipientIds)
          .not("apns_device_token", "is", null);

        type Pending = {
          userId: string;
          deviceToken: string;
          title: string;
          body: string;
          data: Record<string, string>;
          productId: string;
          alertType: string;
        };
        const pending: Pending[] = [];

        for (const profile of profiles ?? []) {
          if (!profile.apns_device_token) continue;
          const b = byUser.get(profile.user_id);
          if (!b) continue;

          for (const item of b.replace) {
            pending.push({
              userId: profile.user_id,
              deviceToken: profile.apns_device_token,
              title: `🔄 Safety reminder — ${item.name}`,
              body: `It may be time to replace your ${item.name}. Replacing on schedule keeps your baby safe.`,
              data: { type: "replacement", productId: item.productId },
              productId: item.productId,
              alertType: "replacement",
            });
          }
        }

        if (pending.length === 0) {
          return new Response(JSON.stringify({ ok: true, sent: 0, note: "no push tokens" }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const { sendApnsPush } = await import("@/lib/apns.server");
        const results = await Promise.all(
          pending.map((p) =>
            sendApnsPush(p.deviceToken, { title: p.title, body: p.body, data: p.data }),
          ),
        );

        const alertsToLog: Array<{ product_id: string; user_id: string; alert_type: string }> = [];
        const invalidTokens = new Set<string>();
        let sentCount = 0;
        results.forEach((r, i) => {
          if (r.ok) {
            sentCount++;
            alertsToLog.push({
              product_id: pending[i].productId,
              user_id: pending[i].userId,
              alert_type: pending[i].alertType,
            });
          } else if (r.invalidToken) {
            invalidTokens.add(pending[i].deviceToken);
          }
        });

        if (alertsToLog.length) {
          await supabaseAdmin.from("product_alerts").insert(alertsToLog as never[]);
        }

        // Clear device tokens Apple says are no longer valid so we stop retrying them.
        if (invalidTokens.size) {
          await supabaseAdmin
            .from("profiles")
            .update({ apns_device_token: null })
            .in("apns_device_token", [...invalidTokens]);
        }

        return new Response(
          JSON.stringify({
            ok: true,
            sent: sentCount,
            failed: results.length - sentCount,
            users: recipientIds.length,
            cleared_invalid_tokens: invalidTokens.size,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
