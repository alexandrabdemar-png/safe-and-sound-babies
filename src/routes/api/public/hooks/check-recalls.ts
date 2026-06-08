import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/check-recalls")({
  server: {
    handlers: {
      POST: async () => runCheck(),
      GET: async () => runCheck(),
    },
  },
});

type CpscProduct = { Name?: string; Model?: string; Type?: string };
type CpscManufacturer = { Name?: string };
type CpscHazard = { Name?: string };
type CpscRemedy = { Name?: string };
type CpscImage = { URL?: string };
type CpscRecall = {
  RecallID?: number;
  RecallNumber?: string;
  RecallDate?: string;
  Title?: string;
  Description?: string;
  URL?: string;
  Products?: CpscProduct[];
  Manufacturers?: CpscManufacturer[];
  Hazards?: CpscHazard[];
  Remedies?: CpscRemedy[];
  Images?: CpscImage[];
};

type UserProduct = {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  category: string | null;
};

const STOPWORDS = new Set([
  "the", "and", "for", "with", "kids", "baby", "infant", "toddler", "child", "children",
  "set", "pack", "size", "model", "new", "old", "from", "your", "their", "this", "that",
  "inc", "llc", "ltd", "company", "co", "brand",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

function isMatch(product: UserProduct, recall: CpscRecall): boolean {
  const productTokens = new Set(tokenize([product.name, product.brand ?? ""].join(" ")));
  if (productTokens.size === 0) return false;

  const recallText = [
    recall.Title ?? "",
    ...(recall.Products ?? []).flatMap((p) => [p.Name ?? "", p.Model ?? "", p.Type ?? ""]),
    ...(recall.Manufacturers ?? []).map((m) => m.Name ?? ""),
  ].join(" ");
  const recallTokens = new Set(tokenize(recallText));
  if (recallTokens.size === 0) return false;

  // Count overlapping significant tokens
  let overlap = 0;
  for (const t of productTokens) if (recallTokens.has(t)) overlap++;

  // Require either: brand token + 1 other token match, OR 2+ token overlap overall
  const brandTokens = new Set(tokenize(product.brand ?? ""));
  const brandHit = [...brandTokens].some((t) => recallTokens.has(t));
  return (brandHit && overlap >= 1) || overlap >= 2;
}

async function runCheck(): Promise<Response> {
  const startedAt = Date.now();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const today = new Date().toISOString().slice(0, 10);
    const url = `https://www.saferproducts.gov/RestWebServices/Recall?format=json&DateRecalledEnd=${today}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return Response.json(
        { ok: false, error: `CPSC feed responded ${res.status}` },
        { status: 502 },
      );
    }
    const recalls = (await res.json()) as CpscRecall[];
    const recent = recalls
      .filter((r) => r.RecallID && r.Title)
      .slice(0, 500); // safety cap

    // Upsert recall catalog rows
    const recallRows = recent.map((r) => ({
      source: "cpsc",
      source_id: String(r.RecallID),
      title: (r.Title ?? "").slice(0, 500),
      brand: r.Manufacturers?.[0]?.Name?.slice(0, 200) ?? null,
      product_name: r.Products?.[0]?.Name?.slice(0, 300) ?? null,
      category: r.Products?.[0]?.Type?.slice(0, 100) ?? null,
      description: r.Description?.slice(0, 2000) ?? null,
      hazard: r.Hazards?.map((h) => h.Name).filter(Boolean).join("; ").slice(0, 1000) || null,
      remedy: r.Remedies?.map((h) => h.Name).filter(Boolean).join("; ").slice(0, 1000) || null,
      url: r.URL ?? null,
      image_url: r.Images?.[0]?.URL ?? null,
      recall_date: r.RecallDate ? r.RecallDate.slice(0, 10) : null,
    }));

    if (recallRows.length) {
      const { error: upErr } = await supabaseAdmin
        .from("recalls")
        .upsert(recallRows, { onConflict: "source,source_id" });
      if (upErr) throw upErr;
    }

    // Map source_id -> uuid
    const { data: storedRecalls, error: srErr } = await supabaseAdmin
      .from("recalls")
      .select("id, source_id")
      .eq("source", "cpsc")
      .in(
        "source_id",
        recallRows.map((r) => r.source_id),
      );
    if (srErr) throw srErr;
    const idBySource = new Map(storedRecalls?.map((r) => [r.source_id, r.id]) ?? []);

    // Load all user products
    const { data: products, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id, user_id, name, brand, category");
    if (pErr) throw pErr;

    let matched = 0;
    const productIdsToFlag = new Set<string>();
    const matchRows: { user_id: string; product_id: string; recall_id: string }[] = [];

    for (const product of (products ?? []) as UserProduct[]) {
      for (const recall of recent) {
        if (!recall.RecallID) continue;
        if (!isMatch(product, recall)) continue;
        const recallId = idBySource.get(String(recall.RecallID));
        if (!recallId) continue;
        matchRows.push({
          user_id: product.user_id,
          product_id: product.id,
          recall_id: recallId,
        });
        productIdsToFlag.add(product.id);
        matched++;
      }
    }

    if (matchRows.length) {
      // Unique constraint (product_id, recall_id) makes this idempotent
      const { error: mErr } = await supabaseAdmin
        .from("product_recalls")
        .upsert(matchRows, { onConflict: "product_id,recall_id", ignoreDuplicates: true });
      if (mErr) throw mErr;
    }

    if (productIdsToFlag.size) {
      const { error: flagErr } = await supabaseAdmin
        .from("products")
        .update({ recalled: true })
        .in("id", [...productIdsToFlag]);
      if (flagErr) throw flagErr;
    }

    return Response.json({
      ok: true,
      fetched: recent.length,
      matched,
      flagged_products: productIdsToFlag.size,
      duration_ms: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("check-recalls failed", e);
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
