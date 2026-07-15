// Pure helpers for expiration/lifecycle urgency classification, shared by
// the scheduled-expiration-check edge function and its unit tests. Kept
// free of any Supabase/Deno imports so it can be tested directly with
// vitest, same pattern as recallBatch.ts / notify.ts.

export type ProductType = "car_seat" | "formula" | "medicine" | "other";

export type LifecycleProduct = {
  id: string;
  user_id: string;
  name: string;
  child_id: string | null;
  product_type: ProductType;
  expiration_date: string | null;
};

export type Urgency = "expired" | "7" | "30" | "90";

/**
 * Mirrors the trigger in 20260706000000_expiration_lifecycle_tracking.sql
 * (public.set_default_car_seat_expiration) so the same default can be
 * computed in application code / tests without a live database.
 */
export function computeDefaultCarSeatExpiration(
  manufactureDate: string | null,
  productType: ProductType,
  explicitExpiration: string | null,
): string | null {
  if (explicitExpiration) return explicitExpiration;
  if (productType !== "car_seat" || !manufactureDate) return null;
  const d = new Date(manufactureDate + "T00:00:00Z");
  d.setUTCFullYear(d.getUTCFullYear() + 6);
  return d.toISOString().slice(0, 10);
}

/**
 * Classifies how urgent a product's expiration is, relative to `today`.
 * Anything more than 90 days out (or with no expiration date) is not yet
 * actionable and returns null.
 */
export function classifyUrgency(expirationDate: string | null, today: Date): Urgency | null {
  if (!expirationDate) return null;
  const exp = new Date(expirationDate + "T00:00:00Z");
  const todayMidnight = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const days = Math.round((exp.getTime() - todayMidnight.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 7) return "7";
  if (days <= 30) return "30";
  if (days <= 90) return "90";
  return null;
}

export type LifecycleMatch = {
  user_id: string;
  product_id: string;
  urgency: Urgency;
};

export function findLifecycleMatches(products: LifecycleProduct[], today: Date): LifecycleMatch[] {
  const matches: LifecycleMatch[] = [];
  for (const p of products) {
    const urgency = classifyUrgency(p.expiration_date, today);
    if (urgency) matches.push({ user_id: p.user_id, product_id: p.id, urgency });
  }
  return matches;
}

const URGENCY_LABEL: Record<Urgency, string> = {
  expired: "may be past its estimated safe-use window",
  "7": "may be approaching its estimated window within the next week",
  "30": "may be approaching its estimated window within the next month",
  "90": "may be approaching its estimated window within the next 90 days",
};

export function buildLifecycleNotification(
  productName: string,
  urgency: Urgency,
): { title: string; body: string } {
  return {
    title: `⏳ Safety check — ${productName}`,
    body: `Based on the information you've entered, ${productName} ${URGENCY_LABEL[urgency]} — worth checking against the manufacturer's guidance to see if it's still recommended for use.`,
  };
}
