// Supabase Edge Function: lookup-product
//
// POST { barcode: string } →
//   { found: true, product: {...} }
//   { found: false, upgradeAvailable?: true }
//
// Order of operations:
//   1. Check the shared product_catalog cache (service-role read) — free.
//   2. Free sources in parallel, first valid match wins — free.
//   3. Paid sources in parallel (only those with a configured secret),
//      first valid match wins — gated behind an active Pro subscription,
//      since every request here has a real dollar cost and the product's
//      barcode-scan feature is already sold as Pro-only.
//   4. Cache any newly-found result so future scans of the same barcode
//      resolve from step 1 instantly.
//
// verify_jwt is enabled for this function (see supabase/config.toml) — the
// platform rejects requests with no/invalid JWT before this code ever runs.
// We still parse the JWT ourselves below because we need the user id (for
// the Pro-subscription check), not just "some valid token exists".
import { createClient } from "npm:@supabase/supabase-js@2";
import { raceFreeSources, racePaidSources, type LookupResult } from "../_shared/lookupProduct.ts";
import { computeIsPro } from "../_shared/subscription.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BARCODE_LENGTH = 128;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function cacheResult(
  supabase: ReturnType<typeof createClient>,
  result: LookupResult,
): Promise<void> {
  const { error } = await supabase.from("product_catalog").upsert(
    {
      barcode: result.barcode,
      name: result.name,
      brand: result.brand,
      category: result.category,
      is_baby_product: result.isBabyProduct,
      image_url: result.imageUrl,
      source: result.source,
      raw: result.raw,
    },
    { onConflict: "barcode" },
  );
  if (error) {
    // Don't fail the request over a cache-write error — the lookup itself
    // succeeded and the caller still gets a usable result. Next scan of the
    // same barcode just re-queries the external sources instead of hitting
    // the cache, which is a performance regression, not a correctness one.
    console.error("[lookup-product] failed to cache result:", error.message);
  }
}

function toResponseProduct(result: LookupResult) {
  return {
    barcode: result.barcode,
    name: result.name,
    brand: result.brand,
    category: result.category,
    isBabyProduct: result.isBabyProduct,
    imageUrl: result.imageUrl,
    source: result.source,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let barcode: string | undefined;
  try {
    const body = await req.json();
    barcode = typeof body?.barcode === "string" ? body.barcode.trim() : undefined;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!barcode) return json({ error: "barcode is required" }, 400);
  if (barcode.length > MAX_BARCODE_LENGTH) return json({ error: "barcode is too long" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: { persistSession: false },
    },
  );

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

  const { data: cached, error: cacheErr } = await supabase
    .from("product_catalog")
    .select("barcode, name, brand, category, is_baby_product, image_url, source")
    .eq("barcode", barcode)
    .maybeSingle();
  if (cacheErr) console.error("[lookup-product] cache read failed:", cacheErr.message);
  if (cached) {
    return json({
      found: true,
      product: {
        barcode: cached.barcode,
        name: cached.name,
        brand: cached.brand,
        category: cached.category,
        isBabyProduct: cached.is_baby_product,
        imageUrl: cached.image_url,
        source: cached.source,
      },
    });
  }

  const freeResult = await raceFreeSources(barcode, fetch);
  if (freeResult) {
    await cacheResult(supabase, freeResult);
    return json({ found: true, product: toResponseProduct(freeResult) });
  }

  const paidConfig = {
    goUpcApiKey: Deno.env.get("GO_UPC_API_KEY") || undefined,
    barcodeLookupApiKey: Deno.env.get("BARCODE_LOOKUP_API_KEY") || undefined,
    barcodeSpiderApiKey: Deno.env.get("BARCODE_SPIDER_API_KEY") || undefined,
  };
  const anyPaidSourceConfigured = Boolean(
    paidConfig.goUpcApiKey || paidConfig.barcodeLookupApiKey || paidConfig.barcodeSpiderApiKey,
  );
  if (!anyPaidSourceConfigured) return json({ found: false });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan,status,current_period_end")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!computeIsPro(sub)) return json({ found: false, upgradeAvailable: true });

  const paidResult = await racePaidSources(barcode, fetch, paidConfig);
  if (!paidResult) return json({ found: false });

  await cacheResult(supabase, paidResult);
  return json({ found: true, product: toResponseProduct(paidResult) });
});
