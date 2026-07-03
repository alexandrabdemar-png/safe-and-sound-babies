import { createFileRoute } from "@tanstack/react-router";
import { sanitizeError } from "@/lib/sanitize-error";
import { fuzzyMatchProduct } from "@/lib/recallCheck";
import { fetchAllExtraRecallSources } from "@/lib/recallSources";

/**
 * Daily sync for USDA FSIS, NHTSA, Health Canada, and EU Safety Gate recalls
 * (in addition to check-recalls.ts's CPSC/FDA/critical sync). Upserts into
 * the shared `recalls` catalog, then matches against every user's products
 * the same way check-recalls.ts does — against structured identifier fields
 * only (title/product_name/brand/model), never free-text description, since
 * recall notices routinely name sibling products only to say they're NOT
 * affected and naive substring matching can't tell the difference.
 */
export const Route = createFileRoute("/api/public/hooks/check-extra-recalls")({
  server: {
    handlers: {
      POST: async ({ request }) => guard(request) ?? runCheck(),
      GET: async ({ request }) => guard(request) ?? runCheck(),
    },
  },
});

function guard(request: Request): Response | null {
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
  return null;
}

type UserProduct = {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  model: string | null;
};

async function runCheck(): Promise<Response> {
  const startedAt = Date.now();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const recalls = await fetchAllExtraRecallSources();
    const bySource: Record<string, number> = {};
    for (const r of recalls) bySource[r.source] = (bySource[r.source] ?? 0) + 1;

    if (recalls.length === 0) {
      return Response.json({ ok: true, fetched: 0, bySource, matched: 0, duration_ms: Date.now() - startedAt });
    }

    const recallRows = recalls.map((r) => ({
      source: r.source,
      source_id: r.source_id.slice(0, 300),
      title: r.title.slice(0, 500),
      brand: r.brand?.slice(0, 200) ?? null,
      product_name: r.product_name?.slice(0, 300) ?? null,
      category: r.category?.slice(0, 100) ?? null,
      description: r.description?.slice(0, 2000) ?? null,
      hazard: r.hazard?.slice(0, 1000) ?? null,
      remedy: r.remedy?.slice(0, 1000) ?? null,
      url: r.url,
      image_url: r.image_url,
      recall_date: r.recall_date,
      model: r.model?.slice(0, 200) ?? null,
      affected_date_start: r.affected_date_start,
      affected_date_end: r.affected_date_end,
      official: r.official,
    }));

    const { data: upserted, error: upErr } = await supabaseAdmin
      .from("recalls")
      .upsert(recallRows as never[], { onConflict: "source,source_id" })
      .select("id, source, source_id, title, brand, product_name, model");
    if (upErr) throw upErr;

    const { data: products, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id, user_id, name, brand, model");
    if (pErr) throw pErr;

    let matched = 0;
    const matchRows: { user_id: string; product_id: string; recall_id: string; acknowledged: boolean }[] = [];
    const productIdsToFlag = new Set<string>();

    for (const product of (products ?? []) as UserProduct[]) {
      const productName = [product.name, product.brand ?? "", product.model ?? ""].filter(Boolean).join(" ");
      for (const recall of (upserted ?? []) as { id: string; title: string; brand: string | null; product_name: string | null; model: string | null }[]) {
        const recallText = [recall.title, recall.brand, recall.product_name, recall.model].filter(Boolean).join(" ");
        if (!fuzzyMatchProduct(productName, recallText)) continue;
        matchRows.push({ user_id: product.user_id, product_id: product.id, recall_id: recall.id, acknowledged: false });
        productIdsToFlag.add(product.id);
        matched++;
      }
    }

    if (matchRows.length) {
      const { error: mErr } = await supabaseAdmin
        .from("product_recalls")
        .upsert(matchRows as never[], { onConflict: "product_id,recall_id", ignoreDuplicates: true });
      if (mErr) throw mErr;
    }
    if (productIdsToFlag.size) {
      const { error: flagErr } = await supabaseAdmin
        .from("products")
        .update({ recalled: true } as never)
        .in("id", [...productIdsToFlag]);
      if (flagErr) throw flagErr;
    }

    return Response.json({
      ok: true,
      fetched: recalls.length,
      bySource,
      matched,
      flagged_products: productIdsToFlag.size,
      duration_ms: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("[check-extra-recalls] failed:", sanitizeError(e));
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
