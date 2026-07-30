// Supabase Edge Function: scheduled-bottle-check
//
// Runs every 10 minutes via pg_cron (see
// supabase/migrations/20260730020000_bottle_notifications.sql for the
// schedule + reuse of the private.call_edge_function() helper already set
// up for scheduled-recall-check / scheduled-expiration-check).
//
// Bottles are far more time-sensitive than products (shortest shelf life
// is 2 hours, shortest alert lead time offered is 15 minutes — see
// src/lib/bottleRules.ts / bottles_.new.tsx), so unlike the daily product
// jobs this runs on a tight interval. The in-app countdown on
// bottles.tsx already notifies while that page happens to be open; this
// is what makes it fire even if the app is closed or backgrounded —
// reported gap: "does logging a bottle notify vs just show in-app?"
// Previously: no, only in-app. This closes that gap.
//
//   1. Load every unfinished, not-yet-notified bottle across every user.
//   2. Find which ones have crossed their own alert_minutes_before
//      threshold (supabase/functions/_shared/bottleCheck.ts) — unlike
//      products' multi-tier urgency, a bottle only ever needs exactly one
//      notification, so notified_at itself (already existed on the
//      table, just never actually written to before this) is the
//      idempotency marker — no separate alerts table needed.
//   3. Notify the affected users via supabase/functions/_shared/notify.ts
//      — the same push+email module the other two scheduled jobs use.
//   4. Stamp notified_at/notification_channel on delivered bottles so
//      they're never re-notified; anything that failed to deliver (e.g.
//      no device token yet) is left un-notified and retried next run.
//
// Requires (as Supabase secrets): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (both provided automatically by the platform), plus optionally
// APNS_KEY_ID / APNS_TEAM_ID / APNS_KEY_P8 / APNS_BUNDLE_ID /
// APNS_ENVIRONMENT for push, and RESEND_API_KEY / NOTIFY_FROM_EMAIL for
// the email fallback — same secrets the other two scheduled jobs need.
// Missing push/email config degrades gracefully — matches are still
// detected and recorded, just not delivered until configured.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  findBottleMatches,
  buildBottleNotification,
  type BottleRow,
} from "../_shared/bottleCheck.ts";
import { notifyUser, getProviderJwt, type ApnsConfig } from "../_shared/notify.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET")
    return json({ error: "Method not allowed" }, 405);

  const startedAt = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const { data: bottles, error: bErr } = await supabase
      .from("bottles")
      .select(
        "id, user_id, child_id, bottle_type, expires_at, alert_minutes_before, finished_at, notified_at",
      )
      .is("finished_at", null)
      .is("notified_at", null);
    if (bErr) throw bErr;

    const rows: BottleRow[] = (bottles ?? []) as BottleRow[];
    const now = new Date();
    const matches = findBottleMatches(rows, now);

    const notifyResult = await notifyAffectedUsers(supabase, matches, now);

    return json({
      ok: true,
      bottles_checked: rows.length,
      matches: matches.length,
      ...notifyResult,
      duration_ms: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("[scheduled-bottle-check] failed:", e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

async function notifyAffectedUsers(
  supabase: ReturnType<typeof createClient>,
  matches: BottleRow[],
  now: Date,
): Promise<{ notified: number; notify_skipped_unconfigured: boolean }> {
  if (matches.length === 0) return { notified: 0, notify_skipped_unconfigured: false };

  const userIds = [...new Set(matches.map((m) => m.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, apns_device_token")
    .in("user_id", userIds);
  const tokenByUser = new Map(
    (profiles ?? []).map((p) => [p.user_id, p.apns_device_token as string | null]),
  );

  const apnsConfig: ApnsConfig | null =
    Deno.env.get("APNS_KEY_ID") && Deno.env.get("APNS_TEAM_ID") && Deno.env.get("APNS_KEY_P8")
      ? {
          keyId: Deno.env.get("APNS_KEY_ID")!,
          teamId: Deno.env.get("APNS_TEAM_ID")!,
          keyP8: Deno.env.get("APNS_KEY_P8")!,
          bundleId: Deno.env.get("APNS_BUNDLE_ID") || "com.peaceofmine.app",
          environment: Deno.env.get("APNS_ENVIRONMENT") === "sandbox" ? "sandbox" : "production",
        }
      : null;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress = Deno.env.get("NOTIFY_FROM_EMAIL") || "alerts@peaceofmine.app";
  const notifySkippedUnconfigured = !apnsConfig && !resendApiKey;

  let apnsJwt: string | null = null;
  if (apnsConfig) {
    const { token } = await getProviderJwt(apnsConfig, null);
    apnsJwt = token;
  }

  const invalidTokens = new Set<string>();
  const notifiedRows: Array<{ id: string; notified_at: string; notification_channel: string }> = [];

  for (const bottleRow of matches) {
    let email: string | null = null;
    try {
      const { data: userResp } = await supabase.auth.admin.getUserById(bottleRow.user_id);
      email = userResp?.user?.email ?? null;
    } catch {
      // admin lookup can fail for a stale/deleted auth user — fall through
      // with email: null, which just means this user can only get push.
    }

    const { title, body } = buildBottleNotification(bottleRow, now);
    const result = await notifyUser(
      fetch,
      {
        userId: bottleRow.user_id,
        email,
        apnsDeviceToken: tokenByUser.get(bottleRow.user_id) ?? null,
      },
      { title, body, data: { type: "bottle" } },
      apnsConfig,
      apnsJwt,
      resendApiKey,
      fromAddress,
    );

    if (result.ok && result.channel) {
      notifiedRows.push({
        id: bottleRow.id,
        notified_at: now.toISOString(),
        notification_channel: result.channel,
      });
    } else if (!result.ok && result.channel === "push") {
      const token = tokenByUser.get(bottleRow.user_id);
      if (token) invalidTokens.add(token);
    }
  }

  for (const row of notifiedRows) {
    await supabase
      .from("bottles")
      .update({ notified_at: row.notified_at, notification_channel: row.notification_channel })
      .eq("id", row.id);
  }

  if (invalidTokens.size) {
    await supabase
      .from("profiles")
      .update({ apns_device_token: null })
      .in("apns_device_token", [...invalidTokens]);
  }

  return { notified: notifiedRows.length, notify_skipped_unconfigured: notifySkippedUnconfigured };
}
