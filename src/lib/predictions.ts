// Replacement-date prediction, using only a product's own added_at date and
// the manufacturer's stated replacement interval — no child data at all.
// (A size-up prediction engine used to live here too, projecting when a
// child would outgrow a product's weight/height limit from their DOB and
// logged measurements — removed along with the app's decision to stop
// storing a child's birthdate, height, and weight.)

export type ProductLimits = {
  max_weight_lbs?: number | null;
  max_height_inches?: number | null;
  replacement_interval_months?: number | null;
};

function addMonthsToDate(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  out.setMonth(out.getMonth() + Math.floor(months));
  const fractional = months - Math.floor(months);
  if (fractional > 0) out.setDate(out.getDate() + Math.round(fractional * 30.44));
  return out;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function predictReplacementDate(
  addedAt: string | Date,
  intervalMonths: number | null | undefined,
): string | null {
  if (!intervalMonths || intervalMonths <= 0) return null;
  const base = typeof addedAt === "string" ? new Date(addedAt) : addedAt;
  if (Number.isNaN(base.getTime())) return null;
  return toDateOnly(addMonthsToDate(base, intervalMonths));
}

export function formatMonthYear(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** True when a replacement date has already passed. */
export function isOverdue(
  iso: string | null,
  todayIso: string = new Date().toISOString().slice(0, 10),
): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) < todayIso;
}
