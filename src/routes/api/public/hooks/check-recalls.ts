import { createFileRoute } from "@tanstack/react-router";
import { sanitizeError } from "@/lib/sanitize-error";
import { fuzzyMatchProduct, CRITICAL_RECALLS } from "@/lib/recallCheck";

export const Route = createFileRoute("/api/public/hooks/check-recalls")({
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

function isMatch(product: UserProduct, recall: CpscRecall): boolean {
  const productName = [product.name, product.brand ?? ""].filter(Boolean).join(" ");
  const recallText = [
    recall.Title ?? "",
    recall.Description ?? "",
    ...(recall.Products ?? []).flatMap((p) => [p.Name ?? "", p.Model ?? "", p.Type ?? ""]),
    ...(recall.Manufacturers ?? []).map((m) => m.Name ?? ""),
  ].join(" ");
  return fuzzyMatchProduct(productName, recallText);
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
    const matchRows: { user_id: string; product_id: string; recall_id: string; acknowledged?: boolean }[] = [];

    for (const product of (products ?? []) as UserProduct[]) {
      const productName = [product.name, product.brand ?? ""].filter(Boolean).join(" ");

      // 1. Critical recalls (no network, instant)
      for (const critical of CRITICAL_RECALLS) {
        const name = productName.toLowerCase();
        const hit = critical.keywords.some((kw) => name.includes(kw.toLowerCase()));
        if (!hit) continue;

        const { data: catalogEntry } = await supabaseAdmin
          .from("recalls")
          .upsert(
            { source: "critical", source_id: critical.id, title: critical.title, url: critical.url },
            { onConflict: "source,source_id" }
          )
          .select("id")
          .single();
        const recallId = (catalogEntry as { id: string } | null)?.id;
        if (recallId) {
          matchRows.push({ user_id: product.user_id, product_id: product.id, recall_id: recallId, acknowledged: false });
          productIdsToFlag.add(product.id);
          matched++;
        }
        break; // one critical match per product is enough
      }

      // 2. CPSC matches
      for (const recall of recent) {
        if (!recall.RecallID) continue;
        if (!isMatch(product, recall)) continue;
        const recallId = idBySource.get(String(recall.RecallID));
        if (!recallId) continue;
        matchRows.push({ user_id: product.user_id, product_id: product.id, recall_id: recallId, acknowledged: false });
        productIdsToFlag.add(product.id);
        matched++;
      }
    }

    // 3. FDA bulk check — fetch once per unique product name and match
    const uniqueNames = [...new Set((products ?? []).map((p: UserProduct) => p.name))];
    for (const productName of uniqueNames.slice(0, 100)) {
      try {
        const enc = encodeURIComponent(productName);
        const fdaRes = await fetch(
          `https://api.fda.gov/food/enforcement.json?search=product_description:${enc}&limit=5`
        );
        if (!fdaRes.ok) continue;
        const fdaData = await fdaRes.json().catch(() => null);
        if (!fdaData?.results?.length) continue;

        for (const r of fdaData.results as { recall_number?: string; product_description?: string; reason_for_recall?: string; recall_initiation_date?: string }) {
          const text = `${r.product_description ?? ""} ${r.reason_for_recall ?? ""}`;
          if (!fuzzyMatchProduct(productName, text)) continue;

          const { data: catalogEntry } = await supabaseAdmin
            .from("recalls")
            .upsert(
              {
                source: "fda",
                source_id: r.recall_number ?? `fda-${productName.slice(0, 20)}`,
                title: (r.product_description ?? "FDA Food Recall").slice(0, 500),
                url: "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts",
                recall_date: r.recall_initiation_date?.slice(0, 10) ?? null,
              },
              { onConflict: "source,source_id" }
            )
            .select("id")
            .single();

          const recallId = (catalogEntry as { id: string } | null)?.id;
          if (!recallId) continue;

          // Link all products with this name
          for (const product of (products ?? []) as UserProduct[]) {
            if (product.name !== productName) continue;
            matchRows.push({ user_id: product.user_id, product_id: product.id, recall_id: recallId, acknowledged: false });
            productIdsToFlag.add(product.id);
            matched++;
          }
        }
      } catch {
        // ignore per-product FDA errors
      }
    }

    // 4. NHTSA child restraint / equipment recalls (car seats — not in CPSC)
    try {
      const nhtsaRes = await fetch(
        "https://api.nhtsa.gov/recalls/recallsByEquipment?equipmentType=2",
        { headers: { Accept: "application/json" } }
      );
      if (nhtsaRes.ok) {
        const nhtsaData = await nhtsaRes.json().catch(() => null);
        const nhtsaRecalls: Array<{
          NHTSACampaignNumber?: string;
          Subject?: string;
          Summary?: string;
          ReportReceivedDate?: string;
          Consequence?: string;
          Remedy?: string;
          Manufacturer?: string;
        }> = nhtsaData?.results ?? [];

        for (const r of nhtsaRecalls) {
          if (!r.NHTSACampaignNumber) continue;
          const parseDotNetDate = (s?: string): string | null => {
            if (!s) return null;
            const m = s.match(/\/Date\((\d+)\)\//);
            return m ? new Date(parseInt(m[1])).toISOString().slice(0, 10) : s.slice(0, 10);
          };

          const { data: catalogEntry } = await supabaseAdmin
            .from("recalls")
            .upsert(
              {
                source: "nhtsa",
                source_id: r.NHTSACampaignNumber,
                title: (r.Subject ?? "NHTSA Child Restraint Recall").slice(0, 500),
                description: r.Summary?.slice(0, 2000) ?? null,
                brand: r.Manufacturer?.slice(0, 200) ?? null,
                hazard: r.Consequence?.slice(0, 1000) ?? null,
                remedy: r.Remedy?.slice(0, 1000) ?? null,
                url: `https://www.nhtsa.gov/vehicle/recalls#${r.NHTSACampaignNumber}`,
                recall_date: parseDotNetDate(r.ReportReceivedDate),
              },
              { onConflict: "source,source_id" }
            )
            .select("id")
            .single();

          const recallId = (catalogEntry as { id: string } | null)?.id;
          if (!recallId) continue;

          const recallText = `${r.Subject ?? ""} ${r.Summary ?? ""} ${r.Manufacturer ?? ""}`;
          for (const product of (products ?? []) as UserProduct[]) {
            const productName = [product.name, product.brand ?? ""].filter(Boolean).join(" ");
            if (!fuzzyMatchProduct(productName, recallText)) continue;
            matchRows.push({ user_id: product.user_id, product_id: product.id, recall_id: recallId, acknowledged: false });
            productIdsToFlag.add(product.id);
            matched++;
          }
        }
      }
    } catch {
      // ignore NHTSA errors — other sources still processed
    }

    if (matchRows.length) {
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
    console.error("[check-recalls] failed:", sanitizeError(e));
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
