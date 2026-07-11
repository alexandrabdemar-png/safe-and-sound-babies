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
//   5. Notify only the users affected by a genuinely NEW match (push, or
//      email if push isn't set up) via supabase/functions/_shared/notify.ts,
//      and stamp notified_at/notification_channel on success.
//   6. Flag every matched product's `recalled` column true (unchanged from
//      the old hooks' behavior — other parts of the app already read it).
//
// Requires (as Supabase secrets): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (both provided automatically by the platform), plus optionally
// APNS_KEY_ID / APNS_TEAM_ID / APNS_KEY_P8 / APNS_BUNDLE_ID /
// APNS_ENVIRONMENT for push, and RESEND_API_KEY / NOTIFY_FROM_EMAIL for the
// email fallback. Missing push/email config degrades gracefully — matches
// are still detected and recorded, just not delivered until configured.
import { createClient } from "npm:@supabase/supabase-js@2";
import { runRecallBatch, type BatchProduct } from "../_shared/recallBatch.ts";
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
        ...new Set(
          catalogRows.map((r) => r.hazard_fingerprint).filter((s): s is string => !!s),
        ),
      ];
      if (fps.length) {
        const { data: fpRows } = await supabase
          .from("recalls")
          .select("id, source, hazard_fingerprint, recall_date")
          .in("hazard_fingerprint", fps);
        // Preference order: cpsc > nhtsa > fda > health_canada > usda_fsis > eu_safety_gate > critical
        const priority: Record<string, number> = {
          cpsc: 0, nhtsa: 1, fda: 2, health_canada: 3, usda_fsis: 4, eu_safety_gate: 5, critical: 6,
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
    const productIds = [...new Set(dedupedMatches.map((m) => m.product_id))];
    const { data: existingRows } = productIds.length
      ? await supabase
          .from("product_recalls")
          .select("product_id, recall_id, notified_content_hash")
          .in("product_id", productIds)
      : { data: [] as Array<{ product_id: string; recall_id: string; notified_content_hash: string | null }> };
    const existingByKey = new Map(
      (existingRows ?? []).map((r) => [`${r.product_id}:${r.recall_id}`, r.notified_content_hash ?? null]),
    );
    const newMatches: Array<{ user_id: string; product_id: string; recall_id: string; reason: "new" | "updated" }> = [];
    for (const m of dedupedMatches) {
      const key = `${m.product_id}:${m.recall_id}`;
      const currentHash = contentHashByRecallId.get(m.recall_id) ?? "";
      if (!existingByKey.has(key)) {
        newMatches.push({ ...m, reason: "new" });
      } else if (currentHash && currentHash !== existingByKey.get(key)) {
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
    } catch { /* swallow — we're already in the error path */ }
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
    const records = source === "cpsc" ? (fetchCounts.cpsc ?? 0)
      : source === "fda" ? 0 // FDA is per-name; count is not exposed
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

async function notifyAffectedUsers(
  supabase: ReturnType<typeof createClient>,
  newMatches: Array<{ user_id: string; product_id: string; recall_id: string }>,
  products: ProductRow[],
): Promise<{ notified: number; notify_skipped_unconfigured: boolean }> {
  if (newMatches.length === 0) return { notified: 0, notify_skipped_unconfigured: false };

  const productNameById = new Map(products.map((p) => [p.id, p.name]));
  const byUser = new Map<string, Array<{ product_id: string; recall_id: string; name: string }>>();
  for (const m of newMatches) {
    const arr = byUser.get(m.user_id) ?? [];
    arr.push({
      product_id: m.product_id,
      recall_id: m.recall_id,
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
    recall_id: string;
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

    const title =
      items.length === 1
        ? `⚠️ Safety Recall — ${items[0].name}`
        : `⚠️ ${items.length} safety recalls need your attention`;
    const body =
      items.length === 1
        ? `${items[0].name} has been recalled. Tap to see what to do.`
        : `${items.map((i) => i.name).join(", ")} have active recalls. Tap to review.`;

    const result = await notifyUser(
      fetch,
      { userId, email, apnsDeviceToken: tokenByUser.get(userId) ?? null },
      { title, body, data: { type: "recall" } },
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
          recall_id: item.recall_id,
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
      .from("product_recalls")
      .update({ notified_at: row.notified_at, notification_channel: row.notification_channel })
      .eq("product_id", row.product_id)
      .eq("recall_id", row.recall_id);
  }

  if (invalidTokens.size) {
    await supabase
      .from("profiles")
      .update({ apns_device_token: null })
      .in("apns_device_token", [...invalidTokens]);
  }

  return { notified: notifiedRows.length, notify_skipped_unconfigured: notifySkippedUnconfigured };
}
