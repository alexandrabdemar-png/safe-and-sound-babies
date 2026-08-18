import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { predictReplacementDate } from "@/lib/predictions";
import { hasProSubscription } from "@/lib/serverProGate";

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
 * Also computes the predicted replacement date from the product's own
 * added_at date and the manufacturer's replacement interval — no child data
 * involved — and writes it back to the products row.
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
    if (!(await hasProSubscription(supabase, userId))) {
      return { skipped: true as const, reason: "pro_required" };
    }
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
      return { needsManualEntry: true } as unknown as { guideline: GuidelineFields; predicted_replacement_date: string | null };
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

    // Predicted replacement date depends only on the product's own
    // added_at date and the manufacturer's replacement interval — no child
    // data involved.
    const predicted_replacement_date = predictReplacementDate(
      product.added_at ?? new Date(),
      g.replacementIntervalMonths,
    );

    await supabase
      .from("products")
      .update({ predicted_replacement_date } as never)
      .eq("id", product.id);

    return {
      guideline: g,
      predicted_replacement_date,
    };
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

    const predicted_replacement_date = predictReplacementDate(
      product.added_at ?? new Date(),
      data.replacementIntervalMonths,
    );

    await supabase
      .from("products")
      .update({ predicted_replacement_date } as never)
      .eq("id", product.id);

    return { predicted_replacement_date };
  });
