import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FoodSearchHit = { barcode: string | null; name: string; brand: string | null };

async function timed(url: string): Promise<Response | null> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 6000);
  try {
    return await fetch(url, { signal: c.signal, headers: { "User-Agent": "PeaceOfMine/1.0" } });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Packaged-food search by name/brand (Open Food Facts + UPCitemdb), run server-side. */
export const searchPackagedFoods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string }) => ({ query: String(d?.query ?? "").trim().slice(0, 80) }))
  .handler(async ({ data }): Promise<FoodSearchHit[]> => {
    const q = data.query;
    if (q.length < 2) return [];
    const [off, upc] = await Promise.all([
      timed(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=10&fields=code,product_name,brands`),
      timed(`https://api.upcitemdb.com/prod/trial/search?s=${encodeURIComponent(q)}`),
    ]);
    const hits: FoodSearchHit[] = [];
    try {
      if (off?.ok) {
        const j = (await off.json()) as {
          hits?: Array<{ code?: string; product_name?: string; brands?: string[] | string }>;
        };
        for (const p of j.hits ?? []) {
          if (!p.product_name) continue;
          const b = Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(",")[0];
          hits.push({ barcode: p.code ?? null, name: p.product_name, brand: b?.trim() || null });
        }
      }
    } catch { /* ignore */ }
    try {
      if (upc?.ok) {
        const j = (await upc.json()) as { items?: Array<{ upc?: string; title?: string; brand?: string }> };
        for (const i of (j.items ?? []).slice(0, 6)) {
          if (i.title) hits.push({ barcode: i.upc ?? null, name: i.title, brand: i.brand || null });
        }
      }
    } catch { /* ignore */ }
    return hits;
  });
