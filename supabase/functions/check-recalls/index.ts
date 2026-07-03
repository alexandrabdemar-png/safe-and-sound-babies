// Supabase Edge Function: check-recalls
//
// POST { name: string, brand?: string, category?: string } →
//   { recalled: boolean, recalls: [{ source, id, title, reason, url, recallDate }] }
//
// On-demand, per-product recall check — this is what the scan flow (Feature
// 4) calls right after a product is identified, so it's deliberately scoped
// to exactly what the spec asks for: CPSC always, NHTSA additionally when
// the product looks like a car seat. The existing daily batch sync
// (src/routes/api/public/hooks/check-recalls.ts) and its broader source set
// (FDA, USDA, Health Canada, EU Safety Gate, the hardcoded CRITICAL_RECALLS
// fast-path) are a separate, already-shipped system for populating the
// `recalls` table / Recall Radar page — this endpoint doesn't duplicate
// that, it answers "does *this one scanned product* have an active CPSC or
// NHTSA recall right now" as fast as possible.
//
// verify_jwt is enabled for this function (see supabase/config.toml).
import { checkRecalls } from "../_shared/recallMatch.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_FIELD_LENGTH = 200;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // verify_jwt already rejected unauthenticated requests before this point;
  // this endpoint queries only free, no-cost government APIs, so unlike
  // lookup-product there's no additional Pro-gating needed here.

  let name: string | undefined;
  let brand: string | null = null;
  let category: string | null = null;
  try {
    const body = await req.json();
    name = typeof body?.name === "string" ? body.name.trim() : undefined;
    brand = typeof body?.brand === "string" ? body.brand.trim() || null : null;
    category = typeof body?.category === "string" ? body.category.trim() || null : null;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!name) return json({ error: "name is required" }, 400);
  if (name.length > MAX_FIELD_LENGTH || (brand?.length ?? 0) > MAX_FIELD_LENGTH) {
    return json({ error: "name/brand too long" }, 400);
  }

  const result = await checkRecalls(name, brand, category, fetch);
  return json(result);
});
