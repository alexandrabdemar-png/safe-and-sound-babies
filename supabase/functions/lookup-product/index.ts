// Supabase Edge Function: lookup-product
//
// POST { barcode: string } →
//   { found: true, product: {...} }
//   { found: false, upgradeAvailable?: true }
//
// POST { barcode: string, manualEntry: { name, brand?, category?, imageUrl? } } →
//   registers a parent's manual "we couldn't find it, here's what it is"
//   submission into the shared cache instead of running the lookup
//   pipeline, so the *next* scan of this barcode (by anyone) resolves
//   instantly. Only ever inserts — never overwrites an existing cached
//   entry, so this can't be used to clobber a real source's data with a
//   bogus submission.
//
// Order of operations for a normal (non-manual) lookup:
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
import {
  raceFreeSources,
  racePaidSources,
  buildManualCatalogEntry,
  type LookupResult,
  type ManualEntryInput,
} from "../_shared/lookupProduct.ts";
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
  let manualEntry: ManualEntryInput | undefined;
  try {
    const body = await req.json();
    barcode = typeof body?.barcode === "string" ? body.barcode.trim() : undefined;
    if (body?.manualEntry && typeof body.manualEntry === "object") {
      manualEntry = {
        name: typeof body.manualEntry.name === "string" ? body.manualEntry.name : "",
        brand: typeof body.manualEntry.brand === "string" ? body.manualEntry.brand : undefined,
        category:
          typeof body.manualEntry.category === "string" ? body.manualEntry.category : undefined,
        imageUrl:
          typeof body.manualEntry.imageUrl === "string" ? body.manualEntry.imageUrl : undefined,
      };
    }
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

  if (manualEntry) {
    const entry = buildManualCatalogEntry(barcode, manualEntry);
    if (!entry) return json({ error: "A valid product name is required" }, 400);
    // Insert-only (not upsert) — a manual submission must never overwrite
    // an existing cached entry, whether that entry came from a real source
    // or an earlier manual submission. If the barcode is already cataloged
    // (including a race against another parent submitting the same one),
    // treat it as a harmless no-op rather than an error.
    const { error: insertErr } = await supabase.from("product_catalog").insert({
      barcode: entry.barcode,
      name: entry.name,
      brand: entry.brand,
      category: entry.category,
      is_baby_product: entry.isBabyProduct,
      image_url: entry.imageUrl,
      source: entry.source,
      raw: entry.raw,
    });
    if (insertErr && insertErr.code !== "23505" /* unique_violation */) {
      console.error("[lookup-product] manual entry insert failed:", insertErr.message);
      return json({ error: "Couldn't save this product" }, 500);
    }
    return json({ found: true, product: toResponseProduct(entry) });
  }

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
