// Supabase Edge Function: scheduled-recall-check
//
// Runs daily via pg_cron (see supabase/migrations/20260705000000_recall_alerts_pipeline.sql
// for the schedule + private.call_edge_function() invocation helper).
// Consolidates what used to be two separate TanStack Start hooks
// (check-recalls.ts: CPSC/FDA/critical; check-extra-recalls.ts: USDA FSIS/
// NHTSA/Health Canada/EU Safety Gate) into one pipeline:
//
//   1. Load every product across every user.
//   2. Match them against all 6 recall sources (supabase/functions/_shared/recallBatch.ts).
//   3. Upsert the recall catalog (`recalls` table, unique on source+source_id
//      — this is the "known recalls" dedup mechanism: a recall already in
//      the catalog from a previous run just gets its fields refreshed, not
//      re-inserted).
//   4. Upsert matches into `product_recalls` (unique on product_id+recall_id
//      — a match already recorded from a previous run is a no-op here too).
//      Matches that did NOT already exist before this run are the "new"
//      recalls this feature is about detecting.
//   5. Notify only the users affected by a genuinely NEW match, and only if
//      they haven't turned recall alerts off (user_notification_settings.
//      recalls_enabled — defaults to on when the user has no settings row
//      yet). Delivery tries native push (APNs) and every registered browser
//      Web Push subscription independently, falling back to email only if
//      neither push channel is registered/working, via
//      supabase/functions/_shared/notify.ts — stamps notified_at/
//      notification_channel on success either way.
//   6. Flag every matched product's `recalled` column true (unchanged from
//      the old hooks' behavior — other parts of the app already read it).
//
// Requires (as Supabase secrets): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (both provided automatically by the platform), plus optionally
// APNS_KEY_ID / APNS_TEAM_ID / APNS_KEY_P8 / APNS_BUNDLE_ID /
// APNS_ENVIRONMENT for native push, VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY /
// VAPID_SUBJECT for browser Web Push, and RESEND_API_KEY / NOTIFY_FROM_EMAIL
// for the email fallback. Missing config for any one channel degrades
// gracefully — matches are still detected and recorded, just not delivered
// on that channel until it's configured.
import { createClient } from "npm:@supabase/supabase-js@2";
import { runRecallBatch, type BatchProduct } from "../_shared/recallBatch.ts";
import {
  notifyUser,
  getProviderJwt,
  buildRecallNotificationCopy,
  type ApnsConfig,
} from "../_shared/notify.ts";
import type { VapidConfig, VapidJwtCache, WebPushSubscription } from "../_shared/webPush.ts";

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
    {
      auth: { persistSession: false },
    },
  );

  try {
    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("id, user_id, name, brand, category, model");
    if (pErr) throw pErr;

    const batchProducts: BatchProduct[] = (products ?? []).map((p) => ({
      id: p.id,
      user_id: p.user_id,
      name: p.name,
      brand: p.brand ?? null,
      category: p.category ?? null,
      model: p.model ?? null,
    }));

    const { catalogRows, matches, fetchCounts } = await runRecallBatch(fetch, batchProducts);

    // ── Upsert the recall catalog ("known recalls") ──────────────────────
    if (catalogRows.length) {
      const { error: upErr } = await supabase
        .from("recalls")
        .upsert(catalogRows, { onConflict: "source,source_id" });
      if (upErr) throw upErr;
    }

    // Map (source, source_id) -> recall id
    const bySourceSourceId = new Map<string, string>();
    const sourcesInPlay = [...new Set(matches.map((m) => m.source))];
    for (const source of sourcesInPlay) {
      const sourceIds = [
        ...new Set(matches.filter((m) => m.source === source).map((m) => m.source_id)),
      ];
      if (!sourceIds.length) continue;
      const { data: rows, error } = await supabase
        .from("recalls")
        .select("id, source_id")
        .eq("source", source)
        .in("source_id", sourceIds);
      if (error) throw error;
      for (const row of rows ?? []) bySourceSourceId.set(`${source}:${row.source_id}`, row.id);
    }

    const resolvedMatches = matches
      .map((m) => ({ ...m, recall_id: bySourceSourceId.get(`${m.source}:${m.source_id}`) }))
      .filter((m): m is typeof m & { recall_id: string } => Boolean(m.recall_id));

    // ── Cross-source dedup by hazard_fingerprint ─────────────────────────
    // The same physical recall can arrive from CPSC + Health Canada + EU
    // Safety Gate. We keep every catalog row (so provenance is preserved for
    // the "Sources" UI) but collapse the *match set* onto one canonical
    // recall per fingerprint so a single hazard produces one notification,
    // not three.
    const canonicalByFingerprint = new Map<string, string>(); // fp -> canonical recall_id
    if (catalogRows.length) {
      const fps = [
        ...new Set(catalogRows.map((r) => r.hazard_fingerprint).filter((s): s is string => !!s)),
      ];
      if (fps.length) {
        const { data: fpRows } = await supabase
          .from("recalls")
          .select("id, source, hazard_fingerprint, recall_date")
          .in("hazard_fingerprint", fps);
        // Preference order: cpsc > nhtsa > fda > health_canada > usda_fsis > eu_safety_gate > critical
        const priority: Record<string, number> = {
          cpsc: 0,
          nhtsa: 1,
          fda: 2,
          health_canada: 3,
          usda_fsis: 4,
          eu_safety_gate: 5,
          critical: 6,
        };
        const byFp = new Map<string, Array<{ id: string; source: string }>>();
        for (const row of fpRows ?? []) {
          const fp = (row as { hazard_fingerprint: string | null }).hazard_fingerprint;
          if (!fp) continue;
          const arr = byFp.get(fp) ?? [];
          arr.push({ id: row.id as string, source: row.source as string });
          byFp.set(fp, arr);
        }
        for (const [fp, rows] of byFp) {
          rows.sort((a, b) => (priority[a.source] ?? 99) - (priority[b.source] ?? 99));
          canonicalByFingerprint.set(fp, rows[0].id);
        }
      }
    }

    // Rewrite each match's recall_id to its canonical peer (if any). Keeps
    // one product_recalls row per (product, fingerprint) instead of N.
    const fingerprintByRecallId = new Map<string, string>();
    for (const row of catalogRows) {
      const id = bySourceSourceId.get(`${row.source}:${row.source_id}`);
      if (id && row.hazard_fingerprint) fingerprintByRecallId.set(id, row.hazard_fingerprint);
    }
    const dedupedMatches = resolvedMatches.map((m) => {
      const fp = fingerprintByRecallId.get(m.recall_id);
      const canonical = fp ? canonicalByFingerprint.get(fp) : undefined;
      return canonical && canonical !== m.recall_id ? { ...m, recall_id: canonical } : m;
    });

    // ── Content-hash lookup for update-detection ─────────────────────────
    const contentHashByRecallId = new Map<string, string>();
    if (bySourceSourceId.size) {
      const ids = [...bySourceSourceId.values()];
      const { data: hashRows } = await supabase
        .from("recalls")
        .select("id, content_hash")
        .in("id", ids);
      for (const row of hashRows ?? []) {
        const h = (row as { content_hash: string | null }).content_hash;
        if (h) contentHashByRecallId.set(row.id as string, h);
      }
    }

    // ── Find which matches are genuinely NEW or UPDATED ──────────────────
    // Keyed on notified_at, not just row existence — a product_recalls row
    // can already exist with notified_at still NULL for two reasons that
    // both mean "this user has never actually been notified": (1) the
    // add-time recall check (recordProductRecall, called from
    // products_.new.tsx / products_.scan.tsx right when a product is
    // added) records the match immediately but never calls notifyUser —
    // the parent only sees it via the live in-app banner at that moment;
    // (2) a previous run's notifyUser call failed on every channel (dead
    // token, network error, unconfigured email) and notifiedRows below
    // never got a row for it. Previously this was only checked via row
    // existence, so both cases got permanently downgraded to "updated"
    // (different copy, e.g. "Recall info was updated" instead of "New
    // recall") on whatever run finally noticed them, instead of getting a
    // real "new recall" notification and being retried like any other
    // undelivered match.
    const productIds = [...new Set(dedupedMatches.map((m) => m.product_id))];
    const { data: existingRows } = productIds.length
      ? await supabase
          .from("product_recalls")
          .select("product_id, recall_id, notified_at, notified_content_hash")
          .in("product_id", productIds)
      : {
          data: [] as Array<{
            product_id: string;
            recall_id: string;
            notified_at: string | null;
            notified_content_hash: string | null;
          }>,
        };
    const existingByKey = new Map(
      (existingRows ?? []).map((r) => [
        `${r.product_id}:${r.recall_id}`,
        { notifiedAt: r.notified_at ?? null, hash: r.notified_content_hash ?? null },
      ]),
    );
    const newMatches: Array<{
      user_id: string;
      product_id: string;
      recall_id: string;
      reason: "new" | "updated";
    }> = [];
    for (const m of dedupedMatches) {
      const key = `${m.product_id}:${m.recall_id}`;
      const currentHash = contentHashByRecallId.get(m.recall_id) ?? "";
      const existing = existingByKey.get(key);
      if (!existing || existing.notifiedAt === null) {
        newMatches.push({ ...m, reason: "new" });
      } else if (currentHash && currentHash !== existing.hash) {
        newMatches.push({ ...m, reason: "updated" });
      }
    }

    if (dedupedMatches.length) {
      const { error: mErr } = await supabase.from("product_recalls").upsert(
        dedupedMatches.map((m) => ({
          user_id: m.user_id,
          product_id: m.product_id,
          recall_id: m.recall_id,
          acknowledged: false,
        })),
        { onConflict: "product_id,recall_id", ignoreDuplicates: true },
      );
      if (mErr) throw mErr;
    }

    const matchedProductIds = [...new Set(dedupedMatches.map((m) => m.product_id))];
    if (matchedProductIds.length) {
      const { error: flagErr } = await supabase
        .from("products")
        .update({ recalled: true })
        .in("id", matchedProductIds);
      if (flagErr) throw flagErr;
    }

    // Every product in batchProducts was actually checked against every
    // source this run, matched or not — stamp all of them so the detail
    // screen can show a real "data synced on" timestamp rather than one
    // that's only true for products with an active recall.
    const checkedAt = new Date().toISOString();
    const allProductIds = batchProducts.map((p) => p.id);
    if (allProductIds.length) {
      const { error: stampErr } = await supabase
        .from("products")
        .update({ recall_checked_at: checkedAt })
        .in("id", allProductIds);
      if (stampErr) throw stampErr;
    }

    // ── Heal orphaned flags ──────────────────────────────────────────────
    // A product can carry `recalled = true` with no linked product_recalls
    // row (legacy writes that RLS silently rejected, or a recall that was
    // later removed from the source feed). That state renders as the scary
    // "flagged for a recall, but details aren't available yet" banner
    // forever, because nothing ever clears it. Every product in this batch
    // was just re-checked against every source, so the link table is now
    // authoritative: clear the flag where no link exists.
    if (allProductIds.length) {
      const { data: linkedRows } = await supabase
        .from("product_recalls")
        .select("product_id")
        .in("product_id", allProductIds);
      const linked = new Set((linkedRows ?? []).map((r) => r.product_id as string));
      const orphaned = allProductIds.filter((id) => !linked.has(id));
      if (orphaned.length) {
        const { error: clearErr } = await supabase
          .from("products")
          .update({ recalled: false })
          .in("id", orphaned)
          .eq("recalled", true);
        if (clearErr) throw clearErr;
      }
    }

    // ── Notify users with new or updated matches ─────────────────────────
    const notifyResult = await notifyAffectedUsers(
      supabase,
      newMatches,
      products ?? [],
      contentHashByRecallId,
    );

    // ── Record per-source freshness / dead-man's-switch inputs ───────────
    await writeSourceStatus(supabase, fetchCounts, matchedProductIds.length);

    return json({
      ok: true,
      products_checked: batchProducts.length,
      fetch_counts: fetchCounts,
      catalog_rows_upserted: catalogRows.length,
      total_matches: dedupedMatches.length,
      new_matches: newMatches.filter((m) => m.reason === "new").length,
      updated_matches: newMatches.filter((m) => m.reason === "updated").length,
      ...notifyResult,
      duration_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[scheduled-recall-check] failed:", err);
    // Best-effort: record the failure into recall_source_status so the
    // dead-man's-switch / UI staleness banner can see it.
    try {
      const supabase2 = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      await supabase2.from("recall_source_status").upsert(
        {
          source: "__pipeline__",
          last_attempt_at: new Date().toISOString(),
          last_error: err.slice(0, 500),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "source" },
      );
    } catch {
      /* swallow — we're already in the error path */
    }
    return json({ ok: false, error: err }, 500);
  }
});

async function writeSourceStatus(
  supabase: ReturnType<typeof createClient>,
  fetchCounts: Record<string, number>,
  totalMatches: number,
): Promise<void> {
  const nowIso = new Date().toISOString();
  // Approximation: any source that returned > 0 records is treated as a
  // success this run; a 0-return source is recorded as attempted but with
  // consecutive_failures preserved (see the migration's ON CONFLICT logic
  // for the dead-man's-switch source). Individual source-level success
  // signals require deeper plumbing in allRecallSources.ts and are a
  // follow-up.
  const sources = ["cpsc", "fda", "usda_fsis", "nhtsa", "health_canada", "eu_safety_gate"];
  for (const source of sources) {
    const records =
      source === "cpsc"
        ? (fetchCounts.cpsc ?? 0)
        : source === "fda"
          ? 0 // FDA is per-name; count is not exposed
          : (fetchCounts.extra ?? 0); // grouped; refine per-source in a follow-up
    const ok = records > 0 || source === "fda"; // FDA presence-check would need per-source counts
    await supabase.from("recall_source_status").upsert(
      {
        source,
        last_attempt_at: nowIso,
        last_success_at: ok ? nowIso : null,
        records_last_run: records,
        matches_last_run: totalMatches,
        consecutive_failures: 0,
        updated_at: nowIso,
      },
      { onConflict: "source" },
    );
  }
  // Pipeline heartbeat — the liveness cron also writes here; a fresh
  // stamp from a successful batch is what clears the dead-man's-switch.
  await supabase.from("recall_source_status").upsert(
    {
      source: "__pipeline__",
      last_attempt_at: nowIso,
      last_success_at: nowIso,
      last_error: null,
      consecutive_failures: 0,
      updated_at: nowIso,
    },
    { onConflict: "source" },
  );
}

type ProductRow = { id: string; name: string };

type NewMatch = {
  user_id: string;
  product_id: string;
  recall_id: string;
  reason: "new" | "updated";
};

async function notifyAffectedUsers(
  supabase: ReturnType<typeof createClient>,
  newMatches: NewMatch[],
  products: ProductRow[],
  contentHashByRecallId: Map<string, string>,
): Promise<{ notified: number; notify_skipped_unconfigured: boolean }> {
  if (newMatches.length === 0) return { notified: 0, notify_skipped_unconfigured: false };

  const productNameById = new Map(products.map((p) => [p.id, p.name]));
  const byUser = new Map<
    string,
    Array<{ product_id: string; recall_id: string; name: string; reason: "new" | "updated" }>
  >();
  for (const m of newMatches) {
    const arr = byUser.get(m.user_id) ?? [];
    arr.push({
      product_id: m.product_id,
      recall_id: m.recall_id,
      name: productNameById.get(m.product_id) ?? "one of your products",
      reason: m.reason,
    });
    byUser.set(m.user_id, arr);
  }

  // Recall matches are always recorded (products.recalled / product_recalls
  // were already written by the caller before this function runs) — this
  // gate only controls whether we go on to actually ping the user, per
  // their toggle at profile → notification settings. No row for a user
  // means they've never touched the toggle, so it defaults to "notify"
  // (matches the column's own DB default).
  const userIds = [...byUser.keys()];
  const { data: settingsRows } = await supabase
    .from("user_notification_settings")
    .select("user_id, recalls_enabled")
    .in("user_id", userIds);
  const recallsEnabledByUser = new Map(
    (settingsRows ?? []).map((s) => [s.user_id as string, s.recalls_enabled as boolean]),
  );
  const notifiableUserIds = userIds.filter((id) => recallsEnabledByUser.get(id) ?? true);

  const { data: profiles } = notifiableUserIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, apns_device_token")
        .in("user_id", notifiableUserIds)
    : { data: [] as Array<{ user_id: string; apns_device_token: string | null }> };
  const tokenByUser = new Map(
    (profiles ?? []).map((p) => [p.user_id, p.apns_device_token as string | null]),
  );

  const { data: webPushRows } = notifiableUserIds.length
    ? await supabase
        .from("web_push_subscriptions")
        .select("user_id, endpoint, p256dh, auth")
        .in("user_id", notifiableUserIds)
    : { data: [] as Array<{ user_id: string; endpoint: string; p256dh: string; auth: string }> };
  const webPushByUser = new Map<string, WebPushSubscription[]>();
  for (const row of webPushRows ?? []) {
    const arr = webPushByUser.get(row.user_id) ?? [];
    arr.push({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth });
    webPushByUser.set(row.user_id, arr);
  }

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
  const vapidConfig: VapidConfig | null =
    Deno.env.get("VAPID_PUBLIC_KEY") &&
    Deno.env.get("VAPID_PRIVATE_KEY") &&
    Deno.env.get("VAPID_SUBJECT")
      ? {
          publicKey: Deno.env.get("VAPID_PUBLIC_KEY")!,
          privateKey: Deno.env.get("VAPID_PRIVATE_KEY")!,
          subject: Deno.env.get("VAPID_SUBJECT")!,
        }
      : null;
  const vapidJwtCache: VapidJwtCache = new Map();
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress = Deno.env.get("NOTIFY_FROM_EMAIL") || "alerts@peaceofmine.app";
  const notifySkippedUnconfigured = !apnsConfig && !vapidConfig && !resendApiKey;

  // APNs provider JWTs are valid for ~1h. In a large batch, refresh every
  // 50 minutes so we don't 403 mid-run.
  let apnsJwt: string | null = null;
  let apnsJwtMintedAt = 0;
  const JWT_REFRESH_MS = 50 * 60 * 1000;
  async function currentApnsJwt(): Promise<string | null> {
    if (!apnsConfig) return null;
    if (!apnsJwt || Date.now() - apnsJwtMintedAt > JWT_REFRESH_MS) {
      const { token } = await getProviderJwt(apnsConfig, null);
      apnsJwt = token;
      apnsJwtMintedAt = Date.now();
    }
    return apnsJwt;
  }

  const invalidTokens = new Set<string>();
  const invalidWebPushEndpoints = new Set<string>();
  const notifiedRows: Array<{
    product_id: string;
    recall_id: string;
    notified_at: string;
    notification_channel: string;
    notified_content_hash: string | null;
  }> = [];

  for (const [userId, items] of byUser) {
    if (!(recallsEnabledByUser.get(userId) ?? true)) continue; // user opted out — match is still recorded, just not delivered

    let email: string | null = null;
    try {
      const { data: userResp } = await supabase.auth.admin.getUserById(userId);
      email = userResp?.user?.email ?? null;
    } catch {
      /* stale/deleted user; email stays null */
    }

    const { title, body } = buildRecallNotificationCopy(items);

    const jwt = await currentApnsJwt();
    const result = await notifyUser(
      fetch,
      {
        userId,
        email,
        apnsDeviceToken: tokenByUser.get(userId) ?? null,
        webPushSubscriptions: webPushByUser.get(userId) ?? [],
      },
      { title, body, data: { type: "recall" } },
      apnsConfig,
      jwt,
      vapidConfig,
      vapidJwtCache,
      resendApiKey,
      fromAddress,
    );

    if (result.ok && result.channel) {
      const nowIso = new Date().toISOString();
      for (const item of items) {
        notifiedRows.push({
          product_id: item.product_id,
          recall_id: item.recall_id,
          notified_at: nowIso,
          notification_channel: result.channel,
          notified_content_hash: contentHashByRecallId.get(item.recall_id) ?? null,
        });
      }
    } else {
      // Previously silent — a failed delivery here was indistinguishable
      // from "no matches this run" anywhere in the logs. This user's
      // notified_at stays NULL, so (per the classification fix above)
      // they'll be retried as a fresh "new" match on the next run, but
      // until then there was no way to see, from the logs alone, that
      // anyone had actually missed a real safety recall notification.
      console.error(
        "[scheduled-recall-check] notification delivery failed for user",
        userId,
        "— affected recalls:",
        items.map((i) => `${i.product_id}:${i.recall_id}`).join(", "),
        "— had apns token:",
        Boolean(tokenByUser.get(userId)),
        "— web push subscriptions:",
        (webPushByUser.get(userId) ?? []).length,
        "— had email:",
        Boolean(email),
      );
    }
    if (result.invalidApnsToken) {
      const token = tokenByUser.get(userId);
      if (token) invalidTokens.add(token);
    }
    for (const endpoint of result.invalidWebPushEndpoints ?? []) {
      invalidWebPushEndpoints.add(endpoint);
    }
  }

  for (const row of notifiedRows) {
    await supabase
      .from("product_recalls")
      .update({
        notified_at: row.notified_at,
        notification_channel: row.notification_channel,
        notified_content_hash: row.notified_content_hash,
      })
      .eq("product_id", row.product_id)
      .eq("recall_id", row.recall_id);
  }

  if (invalidTokens.size) {
    await supabase
      .from("profiles")
      .update({ apns_device_token: null })
      .in("apns_device_token", [...invalidTokens]);
  }

  if (invalidWebPushEndpoints.size) {
    await supabase
      .from("web_push_subscriptions")
      .delete()
      .in("endpoint", [...invalidWebPushEndpoints]);
  }

  return { notified: notifiedRows.length, notify_skipped_unconfigured: notifySkippedUnconfigured };
}
