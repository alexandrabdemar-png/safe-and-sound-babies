import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily CPSC recall sync.
 *
 * Pulls baby/infant/child recalls from the U.S. Consumer Product Safety
 * Commission's public REST API, upserts them into the `recalls` table,
 * then matches each new recall against the products that users have
 * logged (substring match on brand or product name) and writes rows
 * into `product_recalls` so they surface in Alerts.
 *
 * Auth: requires the publishable API key in the `apikey` header.
 */
export const Route = createFileRoute("/api/public/hooks/cpsc-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // Pull the most recent ~6 months of recalls; keyword-filter for baby gear
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 6);
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        const url = `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=${cutoffStr}`;
        let raw: unknown;
        try {
          const res = await fetch(url, {
            headers: { Accept: "application/json" },
          });
          if (!res.ok) {
            return new Response(
              JSON.stringify({ error: `CPSC ${res.status}` }),
              {
                status: 502,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
          raw = await res.json();
        } catch (err) {
          return new Response(
            JSON.stringify({
              error: "CPSC fetch failed",
              detail: err instanceof Error ? err.message : String(err),
            }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }

        type CpscRecall = {
          RecallID?: number;
          RecallNumber?: string;
          RecallDate?: string;
          Title?: string;
          Description?: string;
          URL?: string;
          Hazards?: { Name?: string }[];
          Remedies?: { Name?: string }[];
          Products?: {
            Name?: string;
            Type?: string;
            CategoryID?: string;
          }[];
          Manufacturers?: { Name?: string }[];
          Images?: { URL?: string }[];
        };

        const all = Array.isArray(raw) ? (raw as CpscRecall[]) : [];

        // Filter for child/baby/infant-related items
        const KEYWORDS =
          /\b(baby|babies|infant|toddler|child|children|crib|stroller|car seat|highchair|high chair|bassinet|pacifier|sleeper|swaddle|formula|bottle nipple)\b/i;
        const relevant = all.filter((r) => {
          const blob = [
            r.Title,
            r.Description,
            ...(r.Products ?? []).map((p) => p.Name),
            ...(r.Products ?? []).map((p) => p.Type),
          ]
            .filter(Boolean)
            .join(" ");
          return KEYWORDS.test(blob);
        });

        // Upsert into recalls
        const rows = relevant.map((r) => {
          const product = r.Products?.[0];
          const brand = r.Manufacturers?.[0]?.Name ?? null;
          const sourceId = (r.RecallNumber ?? r.RecallID ?? "").toString();
          return {
            source: "cpsc",
            source_id: sourceId,
            title: r.Title ?? "Untitled recall",
            brand,
            product_name: product?.Name ?? null,
            category: product?.Type ?? null,
            description: r.Description ?? null,
            hazard: r.Hazards?.map((h) => h.Name).filter(Boolean).join("; ") || null,
            remedy: r.Remedies?.map((h) => h.Name).filter(Boolean).join("; ") || null,
            url: r.URL ?? null,
            image_url: r.Images?.[0]?.URL ?? null,
            recall_date: r.RecallDate ? r.RecallDate.slice(0, 10) : null,
          };
        });

        let inserted = 0;
        if (rows.length > 0) {
          const { data: upserted, error: upErr } = await supabaseAdmin
            .from("recalls")
            .upsert(rows, { onConflict: "source,source_id", ignoreDuplicates: false })
            .select("id, brand, product_name, title");

          if (upErr) {
            return new Response(JSON.stringify({ error: upErr.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          inserted = upserted?.length ?? 0;

          // Match each recall against existing products
          const { data: products } = await supabaseAdmin
            .from("products")
            .select("id, user_id, name, brand");

          const matches: {
            user_id: string;
            product_id: string;
            recall_id: string;
          }[] = [];
          for (const recall of upserted ?? []) {
            const needle = [recall.brand, recall.product_name, recall.title]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            if (needle.length < 4) continue;
            for (const p of products ?? []) {
              const hay = [p.name, p.brand].filter(Boolean).join(" ").toLowerCase();
              if (!hay) continue;
              // Naive but useful: brand-on-brand match or product-name match
              const brandHit =
                p.brand &&
                recall.brand &&
                needle.includes(p.brand.toLowerCase()) &&
                hay.includes(recall.brand.toLowerCase());
              const nameHit =
                recall.product_name &&
                hay.includes(recall.product_name.toLowerCase());
              if (brandHit || nameHit) {
                matches.push({
                  user_id: p.user_id,
                  product_id: p.id,
                  recall_id: recall.id,
                });
              }
            }
          }

          if (matches.length > 0) {
            await supabaseAdmin
              .from("product_recalls")
              .upsert(matches, {
                onConflict: "product_id,recall_id",
                ignoreDuplicates: true,
              });
            // Flag the products as recalled
            await supabaseAdmin
              .from("products")
              .update({ recalled: true })
              .in(
                "id",
                matches.map((m) => m.product_id),
              );
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            fetched: all.length,
            relevant: relevant.length,
            upserted: inserted,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
