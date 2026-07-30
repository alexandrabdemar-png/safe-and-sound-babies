// Pure helpers for bottle-expiration notification matching, shared by the
// scheduled-bottle-check edge function and its unit tests. Kept free of
// any Supabase/Deno imports so it's testable directly with vitest, same
// pattern as lifecycleCheck.ts / recallBatch.ts.
//
// Unlike products (multi-tier urgency: expired/7/30/90 days), a bottle
// only ever needs exactly one notification — when it crosses its own
// per-bottle alert_minutes_before threshold — so this reuses the bottle's
// own notified_at column as the idempotency marker instead of a separate
// join table (see the migration for why that's safe: notified_at already
// existed on `bottles`, just never actually written to before this).

export type BottleRow = {
  id: string;
  user_id: string;
  child_id: string | null;
  bottle_type: string;
  expires_at: string;
  alert_minutes_before: number;
  finished_at: string | null;
  notified_at: string | null;
};

/**
 * True when a bottle has crossed its own alert threshold and hasn't been
 * notified about yet. Mirrors the client-side check already used in
 * bottles.tsx's live-ticking effect (`now >= threshold`), so the
 * server-side and in-app-while-open behavior agree on the same instant.
 */
export function needsBottleNotification(bottle: BottleRow, now: Date): boolean {
  if (bottle.finished_at) return false;
  if (bottle.notified_at) return false;
  const exp = new Date(bottle.expires_at).getTime();
  const threshold = exp - bottle.alert_minutes_before * 60_000;
  return now.getTime() >= threshold;
}

export function findBottleMatches(bottles: BottleRow[], now: Date): BottleRow[] {
  return bottles.filter((b) => needsBottleNotification(b, now));
}

const BOTTLE_TYPE_LABEL: Record<string, string> = {
  breastmilk_fresh: "Freshly pumped breastmilk",
  breastmilk_thawed: "Thawed breastmilk",
  formula_prepared: "Prepared formula",
  formula_opened: "Opened ready-to-feed formula",
};

export function bottleTypeLabel(bottleType: string): string {
  return BOTTLE_TYPE_LABEL[bottleType] ?? "A bottle";
}

export function buildBottleNotification(
  bottle: BottleRow,
  now: Date,
): { title: string; body: string } {
  const label = bottleTypeLabel(bottle.bottle_type);
  const isPast = now.getTime() >= new Date(bottle.expires_at).getTime();
  return isPast
    ? {
        title: `⏰ ${label} is past its window`,
        body: `${label} has reached its estimated use-by window — worth a check before using.`,
      }
    : {
        title: `⏰ ${label} — window closing soon`,
        body: `${label} is approaching its estimated use-by window soon.`,
      };
}
