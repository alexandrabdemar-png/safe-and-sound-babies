import { createFileRoute } from "@tanstack/react-router";
import { fuzzyMatchProduct } from "@/lib/recallCheck";

/**
 * recall-rss-sync — Near-real-time recall detection via RSS feeds.
 *
 * Polls two official RSS feeds (CPSC + FDA) which update within ~2 hours of
 * a new recall announcement — far faster than the REST APIs which may lag by
 * 24-48 hours. Runs hourly via pg_cron.
 *
 * Sources:
 *   CPSC: https://www.cpsc.gov/Recalls/RSS
 *   FDA:  https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml
 *
 * Auth: POST with HOOK_SECRET in Authorization header or apikey header.
 */
export const Route = createFileRoute("/api/public/hooks/recall-rss-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.HOOK_SECRET;
        if (!expected || !apiKey || apiKey !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        return runRssSync();
      },
      GET: async ({ request }) => {
        const apiKey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.HOOK_SECRET;
        if (!expected || !apiKey || apiKey !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        return runRssSync();
      },
    },
  },
});

// ── RSS item type ─────────────────────────────────────────────────────────────

type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
  source: "cpsc" | "fda";
};

// ── Simple RSS XML parser (no external deps) ──────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"))
    ?? xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m?.[1]?.trim() ?? "";
}

function parseRss(xml: string, source: "cpsc" | "fda"): RssItem[] {
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return itemBlocks.map((block) => ({
    title: extractTag(block, "title"),
    link: extractTag(block, "link"),
    description: extractTag(block, "description"),
    pubDate: extractTag(block, "pubDate") || null,
    source,
  })).filter((item) => item.title.length > 0);
}

// ── Baby-related keyword filter ───────────────────────────────────────────────

const BABY_RE =
  /\b(baby|babies|infant|toddler|newborn|child|children|crib|bassinet|stroller|pram|car.?seat|pacifier|soother|swaddle|sleep.?sack|formula|breast.?pump|bottle|highchair|high.?chair|bouncer|swing|play.?yard|pack.?n.?play|jolly.?jumper|monitor)\b/i;

function isBabyRelated(item: RssItem): boolean {
  return BABY_RE.test(item.title + " " + item.description);
}

// ── Fetch with timeout ────────────────────────────────────────────────────────

async function fetchRss(url: string): Promise<string | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ── Main sync ─────────────────────────────────────────────────────────────────

async function runRssSync(): Promise<Response> {
  const startedAt = Date.now();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only look at recalls published in the last 48 hours from either feed
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Fetch both feeds in parallel
    const [cpscXml, fdaXml] = await Promise.all([
      fetchRss("https://www.cpsc.gov/Recalls/RSS"),
      fetchRss("https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml"),
    ]);

    const cpscItems = cpscXml ? parseRss(cpscXml, "cpsc") : [];
    const fdaItems = fdaXml ? parseRss(fdaXml, "fda") : [];
    const allItems = [...cpscItems, ...fdaItems];

    // Filter baby-related + recent
    const relevant = allItems.filter((item) => {
      if (!isBabyRelated(item)) return false;
      if (item.pubDate) {
        const pub = new Date(item.pubDate);
        if (!isNaN(pub.getTime()) && pub < cutoff) return false;
      }
      return true;
    });

    if (relevant.length === 0) {
      return Response.json({
        ok: true,
        cpsc_items: cpscItems.length,
        fda_items: fdaItems.length,
        baby_relevant: 0,
        new_matches: 0,
        duration_ms: Date.now() - startedAt,
      });
    }

    // Upsert into recalls catalog (use link as source_id for RSS items)
    const recallRows = relevant.map((item) => ({
      source: item.source,
      source_id: `rss:${item.link.slice(-80)}`,
      title: item.title.slice(0, 500),
      description: item.description.replace(/<[^>]+>/g, " ").trim().slice(0, 2000) || null,
      url: item.link || null,
      recall_date: item.pubDate ? new Date(item.pubDate).toISOString().slice(0, 10) : null,
      brand: null,
      product_name: null,
      category: null,
      hazard: null,
      remedy: null,
      image_url: null,
    }));

    const { data: upserted, error: upErr } = await supabaseAdmin
      .from("recalls")
      .upsert(recallRows, { onConflict: "source,source_id", ignoreDuplicates: false })
      .select("id, title, description, source_id");

    if (upErr) {
      console.error("[recall-rss-sync] upsert error:", upErr.message);
      return Response.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    if (!upserted?.length) {
      return Response.json({
        ok: true,
        cpsc_items: cpscItems.length,
        fda_items: fdaItems.length,
        baby_relevant: relevant.length,
        new_matches: 0,
        note: "all already known",
        duration_ms: Date.now() - startedAt,
      });
    }

    // Load all user products for matching
    const { data: products, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id, user_id, name, brand, category");
    if (pErr) throw pErr;

    const matchRows: { user_id: string; product_id: string; recall_id: string }[] = [];
    const productIdsToFlag = new Set<string>();

    for (const recall of upserted) {
      const recallText = `${recall.title} ${recall.description ?? ""}`;
      for (const product of products ?? []) {
        const productName = [product.name, product.brand ?? ""].filter(Boolean).join(" ");
        if (fuzzyMatchProduct(productName, recallText)) {
          matchRows.push({
            user_id: product.user_id,
            product_id: product.id,
            recall_id: recall.id,
          });
          productIdsToFlag.add(product.id);
        }
      }
    }

    if (matchRows.length > 0) {
      await supabaseAdmin
        .from("product_recalls")
        .upsert(matchRows, { onConflict: "product_id,recall_id", ignoreDuplicates: true });

      await supabaseAdmin
        .from("products")
        .update({ recalled: true })
        .in("id", [...productIdsToFlag]);
    }

    return Response.json({
      ok: true,
      cpsc_items: cpscItems.length,
      fda_items: fdaItems.length,
      baby_relevant: relevant.length,
      new_recalls_upserted: upserted.length,
      new_matches: matchRows.length,
      products_flagged: productIdsToFlag.size,
      duration_ms: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("[recall-rss-sync] failed:", e);
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
