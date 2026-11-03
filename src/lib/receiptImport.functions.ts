import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasProSubscription } from "@/lib/serverProGate";

export type ExtractedReceiptItem = {
  receipt_text: string;
  name: string;
  brand: string;
  kind: "product" | "food";
  category_key: string | null;
  confident: boolean;
};

const CATEGORY_KEYS = [
  "car_seat", "crib", "bassinet", "stroller", "carrier", "high_chair", "swing", "bouncer",
  "activity_center", "sleep_sack", "baby_gate", "play_yard", "baby_monitor", "pacifier",
  "formula", "baby_food", "toothbrush", "toys", "bottle", "bath", "diaper", "teether",
  "vitamins", "other",
];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["receipt_text", "name", "brand", "kind", "category_key", "confident"],
        properties: {
          receipt_text: { type: "string" },
          name: { type: "string" },
          brand: { type: "string" },
          kind: { type: "string", enum: ["product", "food"] },
          category_key: { type: ["string", "null"], enum: [...CATEGORY_KEYS, null] },
          confident: { type: "boolean" },
        },
      },
    },
  },
};

const PROMPT = `You read shopping receipts (grocery stores, Amazon, Target, etc.) for a baby-safety app.
List every purchased line item that is a baby/child product, baby food, formula, vitamin or supplement, or a food a baby or toddler may eat. Skip tax, totals, discounts, bags and clearly adult-only items.
For each item:
- receipt_text: the line exactly as printed.
- name: the full product name, expanding abbreviations only when you are sure. Do not invent flavors, sizes or models.
- brand: the brand if printed or certain from the text, otherwise "".
- kind: "food" for things a child eats (pouches, puffs, snacks, yogurt, produce); "product" for gear, formula, vitamins, bottles, diapers, toys etc.
- category_key: best matching category for products, null for foods.
- confident: true only if both brand and full name are clearly identifiable from the receipt.`;

/**
 * Receipt import is Pro-only (user decision, Nov 2026): the AI read costs a
 * metered model call per receipt, and the extracted items are the least
 * reliable product identities in the app, so it sits behind the same paywall
 * as the barcode scanner. Enforced here (authoritative) and again in the UI
 * via useProGate().
 */
export async function assertReceiptImportPro(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<void> {
  if (!(await hasProSubscription(supabase, userId))) {
    throw new Error("Receipt import is a Pro feature. Start your free trial to use it.");
  }
}

export const extractReceiptItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { image: string }) => {
    const image = typeof input?.image === "string" ? input.image : "";
    const m = /^data:(image\/(png|jpeg|jpg|webp|heic|heif));base64,/.exec(image);
    if (!m) throw new Error("Please upload a photo or screenshot (PNG, JPG or WebP).");
    if (image.length > 8_000_000) throw new Error("That image is too large. Try a smaller screenshot.");
    return { image };
  })
  .handler(async ({ data, context }) => {
    await assertReceiptImportPro(context.supabase, context.userId);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Receipt reading isn't configured yet.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: "receipt_items", strict: true, schema: SCHEMA } },
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: PROMPT },
              { type: "input_image", image_url: data.image },
            ],
          },
        ],
      }),
    });

    if (!res.ok || !res.body) {
      if (res.status === 429) throw new Error("Too many requests right now. Please try again in a minute.");
      if (res.status === 402 || res.status === 403) throw new Error("Receipt reading is temporarily unavailable.");
      throw new Error("We couldn't read that receipt. Please try again.");
    }

    // Consume the SSE stream and collect the output text.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let text = "";
    let done = false;
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") { done = true; break; }
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta") text += evt.delta ?? "";
          if (evt.type === "response.failed" || evt.type === "error") {
            throw new Error("We couldn't read that receipt. Please try again.");
          }
          if (evt.type === "response.completed") done = true;
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("We couldn't")) throw e;
        }
      }
    }

    let items: ExtractedReceiptItem[] = [];
    try {
      items = (JSON.parse(text) as { items: ExtractedReceiptItem[] }).items ?? [];
    } catch {
      throw new Error("We couldn't read that receipt. Try a clearer photo.");
    }
    return { items: items.slice(0, 60) };
  });
