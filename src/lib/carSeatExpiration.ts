// Car seats are generally unsafe to use past a manufacturer-set age from
// their MANUFACTURE date (not purchase date) — typically 6 years, though it
// varies by brand and is usually printed on a sticker on the shell. This
// matters most for hand-me-downs: a seat "purchased" (received) today could
// already have been manufactured years ago, so purchase date is not a safe
// proxy for the seat's actual age.
//
// Mirrors the DB-side default (supabase/migrations/20260706000000_expiration_lifecycle_tracking.sql's
// set_default_car_seat_expiration() trigger and
// supabase/functions/_shared/lifecycleCheck.ts's computeDefaultCarSeatExpiration())
// so the client can show the same estimate immediately, without waiting for
// the next scheduled-expiration-check cron run.
export const DEFAULT_CAR_SEAT_LIFESPAN_YEARS = 6;

/**
 * Estimates a car seat's expiration date from its manufacture date, using
 * the industry-typical 6-year default. Returns null for an empty/invalid
 * input rather than throwing, so callers can treat "no estimate available"
 * uniformly with "no manufacture date given".
 */
export function estimateCarSeatExpiration(manufactureDate: string | null | undefined): string | null {
  if (!manufactureDate) return null;
  const d = new Date(manufactureDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + DEFAULT_CAR_SEAT_LIFESPAN_YEARS);
  return d.toISOString().slice(0, 10);
}

/**
 * Resolves the best available "replace by" date for a car seat: an
 * explicit manufacturer expiry (from the shell sticker) always wins when
 * given, since it's the authoritative source; otherwise falls back to the
 * manufacture-date estimate — the case a hand-me-down without a legible
 * sticker needs.
 */
export function resolveCarSeatReplaceAt(
  explicitExpiry: string | null | undefined,
  manufactureDate: string | null | undefined,
): string | null {
  if (explicitExpiry) return explicitExpiry;
  return estimateCarSeatExpiration(manufactureDate);
}
