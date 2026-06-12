import { createServerFn } from "@tanstack/react-start";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

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

export const searchProducts = createServerFn({ method: "POST" })
  .validator((data: { query: string }) => data)
  .handler(async ({ data }: { data: { query: string } }): Promise<ProductSearchResult[]> => {
    const { query } = data;
    if (!query || query.trim().length < 2) return [];
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const anthropic = createAnthropic({ apiKey });
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Baby product search: "${query.trim()}"` },
      ],
    });

    const raw = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ProductSearchResult[]) : [];
    } catch {
      return [];
    }
  });
