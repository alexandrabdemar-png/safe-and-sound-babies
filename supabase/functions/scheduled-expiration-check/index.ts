// Supabase Edge Function: scheduled-expiration-check
//
// Runs daily via pg_cron (see
// supabase/migrations/20260706000000_expiration_lifecycle_tracking.sql for
// the schedule + reuse of the private.call_edge_function() helper already
// set up for scheduled-recall-check).
//
//   1. Load every product with an expiration_date set.
//   2. Classify each into an urgency bucket (expired / 7 / 30 / 90 days)
//      via supabase/functions/_shared/lifecycleCheck.ts.
//   3. Find which (product_id, urgency) pairs are genuinely NEW by
//      pre-checking the lifecycle_alerts table (UNIQUE(product_id, urgency)
//      makes storage idempotent regardless, same pattern as product_recalls).
//   4. Upsert the new rows, then notify only the affected users via
//      supabase/functions/_shared/notify.ts — the same push+email module
//      scheduled-recall-check uses, not a second copy of that logic.
//
// Requires (as Supabase secrets): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (both provided automatically by the platform), plus optionally
// APNS_KEY_ID / APNS_TEAM_ID / APNS_KEY_P8 / APNS_BUNDLE_ID /
// APNS_ENVIRONMENT for push, and RESEND_API_KEY / NOTIFY_FROM_EMAIL for the
// email fallback — same secrets scheduled-recall-check already needs.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  findLifecycleMatches,
  buildLifecycleNotification,
  type LifecycleProduct,
} from "../_shared/lifecycleCheck.ts";
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
    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("id, user_id, name, child_id, product_type, expiration_date")
      .not("expiration_date", "is", null);
    if (pErr) throw pErr;

    const lifecycleProducts: LifecycleProduct[] = (products ?? []).map((p) => ({
      id: p.id,
      user_id: p.user_id,
      name: p.name,
      child_id: p.child_id ?? null,
      product_type: (p.product_type ?? "other") as LifecycleProduct["product_type"],
      expiration_date: p.expiration_date,
    }));

    const matches = findLifecycleMatches(lifecycleProducts, new Date());

    // ── Find which matches are genuinely NEW before upserting ───────────
    const productIds = [...new Set(matches.map((m) => m.product_id))];
    const { data: existingRows } = productIds.length
      ? await supabase
          .from("lifecycle_alerts")
          .select("product_id, urgency")
          .in("product_id", productIds)
      : { data: [] as Array<{ product_id: string; urgency: string }> };
    const existingKeys = new Set((existingRows ?? []).map((r) => `${r.product_id}:${r.urgency}`));
    const newMatches = matches.filter((m) => !existingKeys.has(`${m.product_id}:${m.urgency}`));

    if (matches.length) {
      const { error: mErr } = await supabase.from("lifecycle_alerts").upsert(
        matches.map((m) => ({ user_id: m.user_id, product_id: m.product_id, urgency: m.urgency })),
        { onConflict: "product_id,urgency", ignoreDuplicates: true },
      );
      if (mErr) throw mErr;
    }

    const notifyResult = await notifyAffectedUsers(supabase, newMatches, products ?? []);

    return json({
      ok: true,
      products_checked: lifecycleProducts.length,
      total_matches: matches.length,
      new_matches: newMatches.length,
      ...notifyResult,
      duration_ms: Date.now() - startedAt,
    });
  } catch (e) {
    console.error(
      "[scheduled-expiration-check] failed:",
      e instanceof Error ? e.message : String(e),
    );
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

type ProductRow = { id: string; name: string };

async function notifyAffectedUsers(
  supabase: ReturnType<typeof createClient>,
  newMatches: Array<{
    user_id: string;
    product_id: string;
    urgency: "expired" | "7" | "30" | "90";
  }>,
  products: ProductRow[],
): Promise<{ notified: number; notify_skipped_unconfigured: boolean }> {
  if (newMatches.length === 0) return { notified: 0, notify_skipped_unconfigured: false };

  const productNameById = new Map(products.map((p) => [p.id, p.name]));
  const byUser = new Map<
    string,
    Array<{ product_id: string; urgency: "expired" | "7" | "30" | "90"; name: string }>
  >();
  for (const m of newMatches) {
    const arr = byUser.get(m.user_id) ?? [];
    arr.push({
      product_id: m.product_id,
      urgency: m.urgency,
      name: productNameById.get(m.product_id) ?? "one of your products",
    });
    byUser.set(m.user_id, arr);
  }

  const userIds = [...byUser.keys()];
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
  const notifiedRows: Array<{
    product_id: string;
    urgency: string;
    notified_at: string;
    notification_channel: string;
  }> = [];

  for (const [userId, items] of byUser) {
    let email: string | null = null;
    try {
      const { data: userResp } = await supabase.auth.admin.getUserById(userId);
      email = userResp?.user?.email ?? null;
    } catch {
      // admin lookup can fail for a stale/deleted auth user — fall through
      // with email: null, which just means this user can only get push.
    }

    // Most urgent item first (expired < 7 < 30 < 90) drives the headline.
    const rank = { expired: 0, "7": 1, "30": 2, "90": 3 } as const;
    const sorted = [...items].sort((a, b) => rank[a.urgency] - rank[b.urgency]);
    const lead = sorted[0];
    const { title, body: leadBody } = buildLifecycleNotification(lead.name, lead.urgency);
    const body =
      items.length === 1
        ? leadBody
        : `${leadBody} ${items.length - 1} other item${items.length - 1 > 1 ? "s" : ""} also need${items.length - 1 > 1 ? "" : "s"} a look.`;

    const result = await notifyUser(
      fetch,
      { userId, email, apnsDeviceToken: tokenByUser.get(userId) ?? null },
      { title, body, data: { type: "lifecycle" } },
      apnsConfig,
      apnsJwt,
      resendApiKey,
      fromAddress,
    );

    if (result.ok && result.channel) {
      const nowIso = new Date().toISOString();
      for (const item of items) {
        notifiedRows.push({
          product_id: item.product_id,
          urgency: item.urgency,
          notified_at: nowIso,
          notification_channel: result.channel,
        });
      }
    } else if (!result.ok && result.channel === "push") {
      const token = tokenByUser.get(userId);
      if (token) invalidTokens.add(token);
    }
  }

  for (const row of notifiedRows) {
    await supabase
      .from("lifecycle_alerts")
      .update({ notified_at: row.notified_at, notification_channel: row.notification_channel })
      .eq("product_id", row.product_id)
      .eq("urgency", row.urgency);
  }

  if (invalidTokens.size) {
    await supabase
      .from("profiles")
      .update({ apns_device_token: null })
      .in("apns_device_token", [...invalidTokens]);
  }

  return { notified: notifiedRows.length, notify_skipped_unconfigured: notifySkippedUnconfigured };
}
