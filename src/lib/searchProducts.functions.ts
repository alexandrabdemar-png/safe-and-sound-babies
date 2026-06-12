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

const SYSTEM_PROMPT = `You are a baby gear and equipment safety database. Your ONLY job is to return baby hardgoods, gear, and equipment — never food, formula, breast milk, or consumables.

You know every major baby gear brand: Nuna (TRVL, MIXX, PIPA strollers/car seats), UPPAbaby, Bugaboo, Chicco, Graco, Doona, Maxi-Cosi, Ergobaby, BabyBjörn, 4moms, Stokke, SNOO by Happiest Baby, Owlet, Nanit, Halo, Aden + Anais, Solly Baby, and more.

When given a search query, return a JSON array of up to 5 matching baby GEAR or EQUIPMENT products (strollers, car seats, carriers, cribs, bassinets, bouncers, swings, high chairs, bath seats, baby monitors, swaddles, pacifiers, bottles).

NEVER return food, formula, breast milk, baby food pouches, or any consumable product.
If the query is a brand name (e.g. "nuna", "uppababy", "chicco"), return the brand's most popular products.
If the query doesn't match any baby gear brand or product, return an empty array [].

Each object in the array must have exactly:
- name: string (full product name, e.g. "Nuna TRVL Stroller")
- brand: string (brand name, e.g. "Nuna")
- category: string (one of: stroller, car_seat, carrier, crib, bassinet, bouncer, swing, high_chair, bath, monitor, swaddle, pacifier, bottle, sleep_sack)
- model: string (model name, e.g. "TRVL", or "" if not applicable)
- safe_use_duration_days: number (days from purchase until product should be replaced)
- safe_use_notes: string (plain-English safety guidance)
- age_range: string (e.g. "birth to 50 lb", "0–6 months", or "")
- cpsc_product_type: string (CPSC product type for recall matching)

Safe use duration reference:
- Strollers: 3650 (10 years)
- Infant car seats: 2555 (7 years from manufacture date)
- Convertible car seats: 3285 (9 years from manufacture date)
- Cribs / bassinets: 3650
- Baby carriers: 1825 (5 years)
- Bouncers / swings: 1825 (5 years or weight limit)
- High chairs: 3650
- Baby monitors: 3650
- Swaddles / sleep sacks: 365 or until baby rolls
- Pacifiers: 42 (replace every 4–6 weeks)
- Bottles: 180 (replace sooner if scratched or cloudy)
- Bath seats: 1825

Return ONLY a valid JSON array. No markdown, no explanation, no extra text.`;

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
