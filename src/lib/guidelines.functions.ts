import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { predictSizeUpDate, predictReplacementDate } from "@/lib/predictions";

/**
 * Server-side Pro subscription gate. Reads from the subscriptions table via
 * the authenticated user's client (RLS scopes to their own rows). Throws if
 * the user has no active/trialing/past_due subscription.
 */
async function requireProSubscription(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Subscription check failed");
  if (!data) throw new Error("Pro subscription required");
  if (data.current_period_end && new Date(data.current_period_end) < new Date()) {
    throw new Error("Pro subscription required");
  }
}

export type GuidelineFields = {
  category: string;
  minWeightLbs: number | null;
  maxWeightLbs: number | null;
  minHeightInches: number | null;
  maxHeightInches: number | null;
  averageUseMonths: number | null;
  replacementIntervalMonths: number | null;
  sizeUpTrigger: string;
  replacementTrigger: string;
  recallCheckNeeded: boolean;
  source: string;
};

const SYSTEM_PROMPT = `You are a baby product safety expert. Given a product name and category, return ONLY a valid JSON object with no extra text, no markdown, no backticks. Fields: category (string), minWeightLbs (number or null), maxWeightLbs (number or null), minHeightInches (number or null), maxHeightInches (number or null), averageUseMonths (number), replacementIntervalMonths (number or null), sizeUpTrigger (string, one sentence), replacementTrigger (string, one sentence), recallCheckNeeded (boolean), source (string citing AAP or manufacturer guidelines).`;

function stripCodeFence(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\n?/, "");
    if (t.endsWith("```")) t = t.slice(0, -3);
  }
  return t.trim();
}

function asNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function normalize(raw: Record<string, unknown>): GuidelineFields {
  return {
    category: String(raw.category ?? ""),
    minWeightLbs: asNum(raw.minWeightLbs),
    maxWeightLbs: asNum(raw.maxWeightLbs),
    minHeightInches: asNum(raw.minHeightInches),
    maxHeightInches: asNum(raw.maxHeightInches),
    averageUseMonths: asNum(raw.averageUseMonths),
    replacementIntervalMonths: asNum(raw.replacementIntervalMonths),
    sizeUpTrigger: String(raw.sizeUpTrigger ?? ""),
    replacementTrigger: String(raw.replacementTrigger ?? ""),
    recallCheckNeeded: Boolean(raw.recallCheckNeeded ?? true),
    source: String(raw.source ?? ""),
  };
}

/**
 * Look up safety guidelines for a product from Lovable AI and persist them.
 * Also recomputes predicted size-up + replacement dates based on the child's
 * latest measurement and writes them back to the products row.
 */
export const lookupAndSaveGuidelines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string }) => {
    if (!input?.productId || typeof input.productId !== "string") {
      throw new Error("productId required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireProSubscription(supabase, userId);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    // Load product
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, name, category, added_at, child_id")
      .eq("id", data.productId)
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!product) throw new Error("Product not found");

    // Call Anthropic for guidelines
    const anthropic = createAnthropic({ apiKey });
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Product name: ${product.name}\nCategory: ${product.category ?? "unknown"}`,
        },
      ],
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(stripCodeFence(text));
    } catch {
      return { needsManualEntry: true } as unknown as { guideline: GuidelineFields; predicted_sizeup_date: string | null; predicted_replacement_date: string | null };
    }
    const g = normalize(parsed);

    // Upsert into product_guidelines
    const { error: gErr } = await supabase
      .from("product_guidelines")
      .upsert(
        {
          product_id: product.id,
          user_id: userId,
          category: g.category || product.category,
          min_weight_lbs: g.minWeightLbs,
          max_weight_lbs: g.maxWeightLbs,
          min_height_inches: g.minHeightInches,
          max_height_inches: g.maxHeightInches,
          average_use_months: g.averageUseMonths,
          replacement_interval_months: g.replacementIntervalMonths,
          size_up_trigger: g.sizeUpTrigger,
          replacement_trigger: g.replacementTrigger,
          recall_check_needed: g.recallCheckNeeded,
          source: g.source,
        } as never,
        { onConflict: "product_id" },
      );
    if (gErr) throw gErr;

    // Compute prediction dates against the linked child
    let predicted_sizeup_date: string | null = null;
    let predicted_replacement_date = predictReplacementDate(
      product.added_at ?? new Date(),
      g.replacementIntervalMonths,
    );
    if (product.child_id) {
      const { data: child } = await supabase
        .from("children")
        .select("date_of_birth, height_inches, weight_lbs, measurements_updated_at")
        .eq("id", product.child_id)
        .maybeSingle();
      if (child) {
        predicted_sizeup_date = predictSizeUpDate(
          {
            date_of_birth: child.date_of_birth,
            height_inches: child.height_inches,
            weight_lbs: child.weight_lbs,
            measurements_recorded_at: child.measurements_updated_at,
          },
          { max_weight_lbs: g.maxWeightLbs, max_height_inches: g.maxHeightInches },
        );
      }
    }

    await supabase
      .from("products")
      .update({
        predicted_sizeup_date,
        predicted_replacement_date,
      } as never)
      .eq("id", product.id);

    return {
      guideline: g,
      predicted_sizeup_date,
      predicted_replacement_date,
    };
  });

/**
 * Recompute predictions for a product when the child's measurements change.
 */
export const recomputePredictions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { childId: string }) => {
    if (!input?.childId) throw new Error("childId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireProSubscription(supabase, userId);
    const { data: child } = await supabase
      .from("children")
      .select("date_of_birth, height_inches, weight_lbs, measurements_updated_at")
      .eq("id", data.childId)
      .maybeSingle();
    if (!child) return { updated: 0 };

    const { data: products } = await supabase
      .from("products")
      .select("id, added_at, product_guidelines(max_weight_lbs, max_height_inches, replacement_interval_months)")
      .eq("user_id", userId)
      .eq("child_id", data.childId);

    let updated = 0;
    for (const p of products ?? []) {
      const g = Array.isArray(p.product_guidelines)
        ? p.product_guidelines[0]
        : (p.product_guidelines as { max_weight_lbs: number | null; max_height_inches: number | null; replacement_interval_months: number | null } | null);
      if (!g) continue;
      const predicted_sizeup_date = predictSizeUpDate(
        {
          date_of_birth: child.date_of_birth,
          height_inches: child.height_inches,
          weight_lbs: child.weight_lbs,
          measurements_recorded_at: child.measurements_updated_at,
        },
        { max_weight_lbs: g.max_weight_lbs, max_height_inches: g.max_height_inches },
      );
      const predicted_replacement_date = predictReplacementDate(p.added_at ?? new Date(), g.replacement_interval_months);
      await supabase
        .from("products")
        .update({ predicted_sizeup_date, predicted_replacement_date } as never)
        .eq("id", p.id);
      updated++;
    }
    return { updated };
  });

/**
 * Save manually-entered guidelines when the AI lookup fails or returns invalid JSON.
 */
export const saveManualGuidelines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    productId: string;
    maxWeightLbs: number | null;
    maxHeightInches: number | null;
    replacementIntervalMonths: number | null;
  }) => {
    if (!input?.productId) throw new Error("productId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, name, category, added_at, child_id")
      .eq("id", data.productId)
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!product) throw new Error("Product not found");

    const { error: gErr } = await supabase
      .from("product_guidelines")
      .upsert(
        {
          product_id: product.id,
          user_id: userId,
          category: product.category ?? "",
          max_weight_lbs: data.maxWeightLbs,
          max_height_inches: data.maxHeightInches,
          replacement_interval_months: data.replacementIntervalMonths,
          source: "Manual entry",
        } as never,
        { onConflict: "product_id" },
      );
    if (gErr) throw gErr;

    let predicted_sizeup_date: string | null = null;
    const predicted_replacement_date = predictReplacementDate(
      product.added_at ?? new Date(),
      data.replacementIntervalMonths,
    );

    if (product.child_id) {
      const { data: child } = await supabase
        .from("children")
        .select("date_of_birth, height_inches, weight_lbs, measurements_updated_at")
        .eq("id", product.child_id)
        .maybeSingle();
      if (child) {
        predicted_sizeup_date = predictSizeUpDate(
          {
            date_of_birth: child.date_of_birth,
            height_inches: child.height_inches,
            weight_lbs: child.weight_lbs,
            measurements_recorded_at: child.measurements_updated_at,
          },
          { max_weight_lbs: data.maxWeightLbs, max_height_inches: data.maxHeightInches },
        );
      }
    }

    await supabase
      .from("products")
      .update({ predicted_sizeup_date, predicted_replacement_date } as never)
      .eq("id", product.id);

    return { predicted_sizeup_date, predicted_replacement_date };
  });
