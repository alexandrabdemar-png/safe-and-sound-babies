import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";

// Caps the text we forward to the AI gateway: long inputs burn credits and are
// never legitimate product names.
const MAX_QUERY_LENGTH = 100;


export interface ProductSearchResult {
  name: string;
  brand: string;
  category: string;
  model: string;
  safe_use_duration_days: number;
  safe_use_notes: string;
  age_range: string;
  cpsc_product_type: string;
}

const SYSTEM_PROMPT = `You are a baby product safety expert. When given a baby product search query, return structured JSON for matching baby products.

Return a JSON array of up to 5 matches. Each object must have exactly:
- name: string (full product name with model if known)
- brand: string (manufacturer/brand)
- category: string (one of: pacifier, car_seat, crib, stroller, carrier, swaddle, bottle, breast_milk, formula, baby_food, bouncer, swing, high_chair, bath, monitor)
- model: string (model name/number, or "" if generic)
- safe_use_duration_days: number (days from purchase until replacement needed for safety)
- safe_use_notes: string (plain-English replacement guidance, e.g. "Replace every 4–6 weeks or at first sign of wear")
- age_range: string (e.g. "0–6 months", "birth to 30 lb", or "")
- cpsc_product_type: string (CPSC product category for recall matching)

Safe use duration reference:
- Pacifiers: 42 (4–6 weeks)
- Infant car seats: 2555 (7 years from manufacture)
- Convertible car seats: 3285 (9 years)
- Cribs / crib mattresses: 3650 (10 years)
- Bottles: 180 (sooner if scratched or cloudy)
- Breast milk refrigerated: 4 days
- Breast milk frozen: 182 days
- Formula opened: 30 days
- Baby food opened: 2 days
- Swaddles: 365 or until baby rolls
- Strollers: 3650
- Baby carriers: 1825
- Bouncers / swings: 1825 or at weight limit
- Baby monitors: 3650

Return ONLY a valid JSON array. No markdown fences, no explanation.`;

/**
 * Extracts the JSON array substring from a raw LLM response. Despite the
 * system prompt saying "no markdown fences, no explanation", models
 * routinely ignore that instruction — a leading sentence like "Sure, here
 * are the matches:" or a trailing markdown fence is common. The previous
 * implementation only stripped a fence anchored to the very start/end of
 * the trimmed string, so ANY surrounding text made JSON.parse fail on the
 * whole response and silently return zero results — indistinguishable in
 * the UI from "no matches found" for a real product like Tommee Tippee.
 * This instead finds a fenced block anywhere in the text, or failing that,
 * slices from the first `[` to the last `]` — robust to prose on either
 * side, which is the actual failure mode this fixes.
 */
export function extractJsonArrayText(raw: string): string | null {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  return candidate.slice(start, end + 1);
}

function coerceString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function coerceNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Validates and sanitizes one parsed item into a well-typed
 * ProductSearchResult, defending against the LLM omitting a field or using
 * the wrong type (e.g. safe_use_duration_days as a numeric string) —
 * neither of which is guaranteed by a prompt alone. Items with no usable
 * name are dropped entirely rather than shown as a blank result card.
 */
export function sanitizeSearchResult(item: unknown): ProductSearchResult | null {
  if (!item || typeof item !== "object") return null;
  const r = item as Record<string, unknown>;
  const name = coerceString(r.name).trim();
  if (!name) return null;
  return {
    name,
    brand: coerceString(r.brand),
    category: coerceString(r.category),
    model: coerceString(r.model),
    safe_use_duration_days: coerceNumber(r.safe_use_duration_days),
    safe_use_notes: coerceString(r.safe_use_notes),
    age_range: coerceString(r.age_range),
    cpsc_product_type: coerceString(r.cpsc_product_type),
  };
}

/** Parses a raw LLM response into validated search results. Never throws —
 * any malformed or unexpected shape resolves to an empty array. */
export function parseSearchResults(raw: string): ProductSearchResult[] {
  const jsonText = extractJsonArrayText(raw);
  if (!jsonText) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(sanitizeSearchResult)
    .filter((r): r is ProductSearchResult => r !== null);
}

export const searchProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { query: string }) => {
    const query = typeof data?.query === "string" ? data.query.trim() : "";
    if (query.length > MAX_QUERY_LENGTH) {
      throw new Error("Search is too long — try a shorter product name.");
    }
    return { query };
  })
  .handler(async ({ data }: { data: { query: string } }): Promise<ProductSearchResult[]> => {
    const { query } = data;
    if (query.length < 2) return [];

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Baby product search: "${query.trim()}"` },
      ],
    });

    return parseSearchResults(text);
  });
