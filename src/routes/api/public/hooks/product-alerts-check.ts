import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily product alerts job.
 *
 * Finds products with predicted_sizeup_date or predicted_replacement_date
 * within the next 7 days and sends a push digest to each parent via Expo Push.
 * Also surfaces any newly-matched recalls (set by the CPSC sync job).
 * Respects per-user notification settings stored in user_notification_settings.
 */
export const Route = createFileRoute("/api/public/hooks/product-alerts-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.HOOK_SECRET;
        if (!expected || !apiKey || apiKey !== expected) {
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

        // Products due for size-up or replacement in the next 7 days
        type ProductRow = {
          id: string;
          user_id: string;
          name: string;
          child_id: string | null;
          predicted_sizeup_date: string | null;
          predicted_replacement_date: string | null;
        };
        const { data: products, error } = await supabaseAdmin
          .from("products")
          .select("id, user_id, name, child_id, predicted_sizeup_date, predicted_replacement_date")
          .or(
            `and(predicted_sizeup_date.gte.${todayStr},predicted_sizeup_date.lte.${horizonStr}),and(predicted_replacement_date.gte.${todayStr},predicted_replacement_date.lte.${horizonStr})`,
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

        // Collect all user IDs involved
        const allUserIds = new Set<string>();
        for (const p of (products ?? []) as ProductRow[]) allUserIds.add(p.user_id);
        for (const r of (newRecalls ?? []) as Array<{ user_id: string }>) allUserIds.add(r.user_id);

        if (allUserIds.size === 0) {
          return new Response(
            JSON.stringify({ ok: true, sent: 0, note: "nothing due" }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        // Load notification settings for all involved users
        const userIds = Array.from(allUserIds);
        const { data: settingsRows } = await (supabaseAdmin as any)
          .from("user_notification_settings")
          .select("user_id, recalls_enabled, size_up_enabled, replacement_enabled")
          .in("user_id", userIds);

        type UserSettings = { recalls_enabled: boolean; size_up_enabled: boolean; replacement_enabled: boolean };
        const settingsMap = new Map<string, UserSettings>();
        for (const s of ((settingsRows ?? []) as unknown) as Array<{ user_id: string } & UserSettings>) {
          settingsMap.set(s.user_id, s);
        }
        const getSetting = (uid: string): UserSettings =>
          settingsMap.get(uid) ?? { recalls_enabled: true, size_up_enabled: true, replacement_enabled: true };

        // Load child names for size-up messages
        const childIds = [...new Set(
          (products ?? [])
            .map((p) => (p as ProductRow).child_id)
            .filter((id): id is string => !!id),
        )];
        const { data: children } = childIds.length
          ? await supabaseAdmin.from("children").select("id, name").in("id", childIds)
          : { data: [] };
        const childNameMap = new Map((children ?? []).map((c) => [c.id, c.name]));

        // Load already-sent alerts to avoid duplicates (last 7 days)
        const productIds = (products ?? []).map((p) => (p as ProductRow).id);
        const { data: sentAlerts } = productIds.length
          ? await supabaseAdmin
              .from("product_alerts")
              .select("product_id, alert_type")
              .in("product_id", productIds)
              .gte("created_at", since.toISOString())
          : { data: [] };

        const sentSet = new Set(
          (sentAlerts ?? []).map((a) => `${a.product_id}:${a.alert_type}`),
        );

        // Group per-user messages
        type Bucket = {
          recalls: Array<{ name: string; productId: string }>;
          sizeUp: Array<{ name: string; child: string; productId: string }>;
          replace: Array<{ name: string; productId: string }>;
        };
        const byUser = new Map<string, Bucket>();
        const ensure = (uid: string): Bucket => {
          const b = byUser.get(uid) ?? { recalls: [], sizeUp: [], replace: [] };
          byUser.set(uid, b);
          return b;
        };

        for (const p of (products ?? []) as ProductRow[]) {
          const s = getSetting(p.user_id);
          const b = ensure(p.user_id);
          if (
            s.size_up_enabled &&
            p.predicted_sizeup_date &&
            p.predicted_sizeup_date >= todayStr &&
            p.predicted_sizeup_date <= horizonStr &&
            !sentSet.has(`${p.id}:size_up`)
          ) {
            b.sizeUp.push({
              name: p.name,
              child: p.child_id ? (childNameMap.get(p.child_id) ?? "your baby") : "your baby",
              productId: p.id,
            });
          }
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

        for (const r of (newRecalls ?? []) as Array<{
          user_id: string;
          product_id: string;
          products: { name: string };
        }>) {
          const s = getSetting(r.user_id);
          if (!s.recalls_enabled) continue;
          if (sentSet.has(`${r.product_id}:recall`)) continue;
          ensure(r.user_id).recalls.push({ name: r.products.name, productId: r.product_id });
        }

        // Remove empty buckets
        for (const [uid, b] of byUser) {
          if (!b.recalls.length && !b.sizeUp.length && !b.replace.length) byUser.delete(uid);
        }

        if (byUser.size === 0) {
          return new Response(
            JSON.stringify({ ok: true, sent: 0, note: "nothing to send" }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        // Look up push tokens
        const recipientIds = Array.from(byUser.keys());
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id, expo_push_token")
          .in("user_id", recipientIds)
          .not("expo_push_token", "is", null);

        type PushMessage = {
          to: string;
          sound: string;
          title: string;
          body: string;
          data: Record<string, string>;
        };
        const messages: PushMessage[] = [];
        const alertsToLog: Array<{ product_id: string; user_id: string; alert_type: string }> = [];

        for (const profile of (profiles ?? [])) {
          if (!profile.expo_push_token) continue;
          const b = byUser.get(profile.user_id);
          if (!b) continue;

          for (const recall of b.recalls) {
            messages.push({
              to: profile.expo_push_token,
              sound: "default",
              title: `⚠️ Safety Recall — ${recall.name}`,
              body: `${recall.name} has been recalled. Tap to see what to do.`,
              data: { type: "recall", productId: recall.productId },
            });
            alertsToLog.push({ product_id: recall.productId, user_id: profile.user_id, alert_type: "recall" });
          }
          for (const item of b.sizeUp) {
            messages.push({
              to: profile.expo_push_token,
              sound: "default",
              title: `📏 Safety check — ${item.name}`,
              body: `${item.child} may be approaching the size limit for their ${item.name}. A proper fit matters for safety.`,
              data: { type: "size_up", productId: item.productId },
            });
            alertsToLog.push({ product_id: item.productId, user_id: profile.user_id, alert_type: "size_up" });
          }
          for (const item of b.replace) {
            messages.push({
              to: profile.expo_push_token,
              sound: "default",
              title: `🔄 Safety reminder — ${item.name}`,
              body: `It may be time to replace your ${item.name}. Replacing on schedule keeps your baby safe.`,
              data: { type: "replacement", productId: item.productId },
            });
            alertsToLog.push({ product_id: item.productId, user_id: profile.user_id, alert_type: "replacement" });
          }
        }

        // ── Send push notifications ───────────────────────────────────────────
        let pushSent = 0;
        if (messages.length > 0) {
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
          if (expoRes.ok && alertsToLog.length) {
            await supabaseAdmin.from("product_alerts").insert(alertsToLog as never[]);
            pushSent = messages.length;
          }
        }

        // ── Email fallback for recall alerts ──────────────────────────────────
        // Send to: users with no push token, OR users with recalls_enabled=false
        // (recall emails always send regardless of push preference — safety critical)
        const resendKey = process.env.RESEND_API_KEY;
        let emailSent = 0;

        if (resendKey) {
          // Find all users who have a pending recall but no push token or no token at all
          const pushTokenOwners = new Set(
            (profiles ?? []).map((p) => p.user_id).filter(Boolean)
          );

          // Gather users who have recall items but no push token
          const usersNeedingEmail: string[] = [];
          for (const [uid, b] of byUser) {
            if (b.recalls.length === 0) continue; // only email for recalls
            if (!pushTokenOwners.has(uid)) usersNeedingEmail.push(uid);
          }

          if (usersNeedingEmail.length > 0) {
            // Look up emails from auth.users via admin API
            type AuthUser = { id: string; email?: string };
            const emailsByUid = new Map<string, string>();
            for (const uid of usersNeedingEmail) {
              try {
                const { data } = await (supabaseAdmin.auth.admin.getUserById(uid)) as { data: { user: AuthUser | null } };
                if (data?.user?.email) emailsByUid.set(uid, data.user.email);
              } catch { /* skip */ }
            }

            for (const [uid, email] of emailsByUid) {
              const b = byUser.get(uid);
              if (!b?.recalls.length) continue;

              const recallList = b.recalls
                .map((r) => `<li style="margin-bottom:8px"><strong>${r.name}</strong> — an active safety recall has been issued for this product.</li>`)
                .join("");

              const html = `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <div style="background:#C8523A;padding:20px 24px;border-radius:12px 12px 0 0">
    <p style="margin:0;color:white;font-size:18px;font-weight:700">⚠️ Safety Recall Alert — Peace of Mine</p>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px">
    <p style="margin:0 0 16px">A safety recall has been issued for one or more products you're tracking:</p>
    <ul style="padding-left:20px;margin:0 0 20px">${recallList}</ul>
    <p style="margin:0 0 20px;color:#555;font-size:14px">
      Stop using the recalled product immediately. Check the official recall notice for return, repair, or refund instructions.
    </p>
    <a href="https://peaceofmineapp.com/alerts" style="display:inline-block;background:#C8523A;color:white;text-decoration:none;padding:12px 24px;border-radius:50px;font-weight:600;font-size:14px">
      View recall details →
    </a>
    <p style="margin:20px 0 0;font-size:12px;color:#888">
      Always verify at <a href="https://www.recalls.gov" style="color:#888">recalls.gov</a>.
      You received this because you have products tracked in Peace of Mine.
    </p>
  </div>
</div>`;

              try {
                await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${resendKey}`,
                  },
                  body: JSON.stringify({
                    from: "Peace of Mine Alerts <alerts@peaceofmineapp.com>",
                    to: [email],
                    subject: `⚠️ Safety recall on ${b.recalls[0].name}${b.recalls.length > 1 ? ` and ${b.recalls.length - 1} other product${b.recalls.length - 1 > 1 ? "s" : ""}` : ""}`,
                    html,
                  }),
                });
                emailSent++;
                // Log email-sent alerts for deduplication
                await supabaseAdmin.from("product_alerts").insert(
                  b.recalls.map((r) => ({ product_id: r.productId, user_id: uid, alert_type: "recall" })) as never[]
                ).on("conflict", "do nothing" as never);
              } catch { /* email send errors are non-fatal */ }
            }
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            push_sent: pushSent,
            email_sent: emailSent,
            users: recipientIds.length,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
