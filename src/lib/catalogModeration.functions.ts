// Admin-only moderation of the shared product_catalog.
//
// Parents' manual entries land in the catalog as `source: "manual"` (labelled
// "Community submission" in the UI). Those are unverified free text, so the
// residual risk is low-grade pollution: typos, wrong brand, a category that
// doesn't match. This module gives an admin a way to correct an entry, promote
// a good one to the verified `seed` tier, or delete junk.
//
// Every function is gated twice: requireSupabaseAuth proves who the caller is,
// then has_role(uid, 'admin') proves they're allowed. Only after BOTH pass do
// we load the service-role client (product_catalog writes are service_role-only
// by RLS, deliberately — see supabase/tests/product_catalog_rls.sql).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ModerationEntry = {
  id: string;
  barcode: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  is_baby_product: boolean;
  image_url: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

/** Tiers a moderator can move an entry between. */
export const VERIFIED_SOURCE = "seed";
export const COMMUNITY_SOURCE = "manual";

const MAX_FIELD = 200;

function clean(value: unknown, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_FIELD) throw new Error(`${field} is too long (${MAX_FIELD} characters max)`);
  return trimmed;
}

type AuthedContext = { supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }; userId: string };

async function assertAdmin(context: AuthedContext) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Not authorized");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** True when the signed-in user may open the moderation screen. */
export const amICatalogAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: data === true };
  });

export const listCatalogEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { filter?: "community" | "all"; search?: string }) => ({
    filter: input?.filter === "all" ? ("all" as const) : ("community" as const),
    search: typeof input?.search === "string" ? input.search.trim().slice(0, 80) : "",
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const db = await admin();
    let query = db
      .from("product_catalog")
      .select("id, barcode, name, brand, category, is_baby_product, image_url, source, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (data.filter === "community") query = query.eq("source", COMMUNITY_SOURCE);
    if (data.search) {
      const escaped = data.search.replace(/[\\%_]/g, (c) => `\\${c}`);
      query = query.or(`name.ilike.%${escaped}%,brand.ilike.%${escaped}%,barcode.ilike.%${escaped}%`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ModerationEntry[];
  });

export const updateCatalogEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      name?: string | null;
      brand?: string | null;
      category?: string | null;
      isBabyProduct?: boolean;
      promote?: boolean;
    }) => {
      if (!input?.id || typeof input.id !== "string") throw new Error("Missing entry id");
      return {
        id: input.id,
        name: clean(input.name, "Name"),
        brand: clean(input.brand, "Brand"),
        category: clean(input.category, "Category"),
        isBabyProduct: input.isBabyProduct === true,
        promote: input.promote === true,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const db = await admin();
    const patch = {
      name: data.name,
      brand: data.brand,
      category: data.category,
      is_baby_product: data.isBabyProduct,
      updated_at: new Date().toISOString(),
      ...(data.promote ? { source: VERIFIED_SOURCE } : {}),
    };

    const { data: row, error } = await db
      .from("product_catalog")
      .update(patch)
      .eq("id", data.id)
      .select("id, barcode, name, brand, category, is_baby_product, image_url, source, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as ModerationEntry;
  });

export const deleteCatalogEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id || typeof input.id !== "string") throw new Error("Missing entry id");
    return { id: input.id };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const db = await admin();
    const { error } = await db.from("product_catalog").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
