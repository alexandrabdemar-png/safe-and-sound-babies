import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAllowedRecallUrl } from "@/lib/recallCheck";

const ALLOWED_SOURCES = new Set(["cpsc", "fda", "critical", "nhtsa"]);

export type RecordRecallInput = {
  productId: string;
  source: string;
  sourceId: string;
  title: string;
  url: string;
  recallDate?: string | null;
};

/**
 * Persists a recall hit (found client-side via checkRecallsForProduct) into
 * the shared `recalls` catalog and links it to the caller's product.
 *
 * This must run server-side with the service-role client: `recalls` is a
 * cross-user catalog table that's SELECT-only for authenticated clients by
 * design (see migration 20260607215835) — any authenticated browser client
 * that could write to it directly could inject an arbitrary "official
 * recall" row visible to every user. Previously the browser tried to write
 * to `recalls`/`product_recalls` directly; both writes were silently
 * rejected by RLS (Supabase's `.single()` resolves `{data: null, error}`
 * rather than throwing, and the calling code never checked `error`), so
 * `products.recalled` ended up `true` with no linked recall row — the
 * "flagged for a recall, but details aren't available yet" bug.
 */
export const recordProductRecall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RecordRecallInput) => {
    if (!input?.productId || typeof input.productId !== "string") {
      throw new Error("productId required");
    }
    if (!input.source || !ALLOWED_SOURCES.has(input.source)) {
      throw new Error("Invalid recall source");
    }
    if (!input.sourceId || typeof input.sourceId !== "string") {
      throw new Error("sourceId required");
    }
    if (!input.title || typeof input.title !== "string" || input.title.length > 300) {
      throw new Error("Invalid recall title");
    }
    if (!input.url || !isAllowedRecallUrl(input.url)) {
      throw new Error("Recall URL is not from a recognized official source");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the product actually belongs to the caller before tagging it
    // recalled. Queried through the user-scoped (RLS-enforced) client, not
    // supabaseAdmin, so this can never return another user's product.
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id")
      .eq("id", data.productId)
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!product) throw new Error("Product not found");

    const { data: recall, error: recallErr } = await supabaseAdmin
      .from("recalls")
      .upsert(
        {
          source: data.source,
          source_id: data.sourceId,
          title: data.title,
          url: data.url,
          recall_date: data.recallDate ?? null,
        } as never,
        { onConflict: "source,source_id" },
      )
      .select("id")
      .single();
    if (recallErr) throw recallErr;
    const recallId = (recall as { id: string }).id;

    const { error: linkErr } = await supabaseAdmin
      .from("product_recalls")
      .upsert(
        { user_id: userId, product_id: data.productId, recall_id: recallId, acknowledged: false } as never,
        { onConflict: "product_id,recall_id" },
      );
    if (linkErr) throw linkErr;

    const { error: prodErr } = await supabaseAdmin
      .from("products")
      .update({ recalled: true } as never)
      .eq("id", data.productId)
      .eq("user_id", userId);
    if (prodErr) throw prodErr;

    return { recallId };
  });
