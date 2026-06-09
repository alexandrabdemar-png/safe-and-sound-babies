// Size-up prediction engine using WHO average growth rates.
// Given child age + (optionally) current measurements, project the date when
// the child will hit a product's max weight/height limits.

export type ProductLimits = {
  max_weight_lbs?: number | null;
  max_height_inches?: number | null;
  replacement_interval_months?: number | null;
};

export type ChildSnapshot = {
  date_of_birth: string | null;
  weight_lbs?: number | null;
  height_inches?: number | null;
  measurements_recorded_at?: string | null;
};

// WHO-derived average growth bands (per month)
function growthRate(ageMonths: number): { lbs: number; inches: number } {
  if (ageMonths < 6) return { lbs: 1.5, inches: 1.0 };
  if (ageMonths < 12) return { lbs: 1.0, inches: 0.5 };
  if (ageMonths < 24) return { lbs: 0.5, inches: 0.4 };
  return { lbs: 0.4, inches: 0.2 };
}

// Population averages for fall-back when no measurement is logged
// Approximated from WHO 50th-percentile boy/girl mix
function averageWeightAtMonths(months: number): number {
  if (months <= 0) return 7.5;
  if (months <= 6) return 7.5 + 1.5 * months;
  if (months <= 12) return 16.5 + 1.0 * (months - 6);
  if (months <= 24) return 22.5 + 0.5 * (months - 12);
  return 28.5 + 0.4 * (months - 24);
}
function averageHeightAtMonths(months: number): number {
  if (months <= 0) return 19.5;
  if (months <= 6) return 19.5 + 1.0 * months;
  if (months <= 12) return 25.5 + 0.5 * (months - 6);
  if (months <= 24) return 28.5 + 0.4 * (months - 12);
  return 33.3 + 0.2 * (months - 24);
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() - a.getDate()) / 30.44;
}

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

// Project months until child reaches `target` given current value and starting age.
// Walks through growth bands so the answer respects the slowdown after 6mo, 12mo, 24mo.
function monthsUntil(current: number, target: number, fromMonths: number, dim: "lbs" | "inches"): number | null {
  if (current >= target) return 0;
  let monthsCursor = Math.max(0, fromMonths);
  let value = current;
  let elapsed = 0;
  for (let i = 0; i < 1200; i++) {
    const rate = growthRate(monthsCursor)[dim];
    if (rate <= 0) return null;
    const needed = target - value;
    const stepMonths = needed / rate;
    // honor band boundaries (6/12/24)
    const nextBoundary =
      monthsCursor < 6 ? 6 :
      monthsCursor < 12 ? 12 :
      monthsCursor < 24 ? 24 : Infinity;
    const stepCapped = Math.min(stepMonths, nextBoundary - monthsCursor);
    if (stepCapped >= stepMonths) {
      elapsed += stepMonths;
      return elapsed;
    }
    value += rate * stepCapped;
    elapsed += stepCapped;
    monthsCursor += stepCapped;
  }
  return null;
}

export function predictSizeUpDate(
  child: ChildSnapshot,
  limits: ProductLimits,
  now: Date = new Date(),
): string | null {
  if (!child.date_of_birth) return null;
  if (!limits.max_weight_lbs && !limits.max_height_inches) return null;
  const birth = new Date(child.date_of_birth);
  if (Number.isNaN(birth.getTime())) return null;

  // Base time + values from the last measurement (or now using averages)
  const measRef = child.measurements_recorded_at ? new Date(child.measurements_recorded_at) : now;
  const ageAtMeasMonths = Math.max(0, monthsBetween(birth, measRef));

  const startWeight = child.weight_lbs ?? averageWeightAtMonths(ageAtMeasMonths);
  const startHeight = child.height_inches ?? averageHeightAtMonths(ageAtMeasMonths);

  const dates: Date[] = [];

  if (limits.max_weight_lbs) {
    const m = monthsUntil(startWeight, limits.max_weight_lbs, ageAtMeasMonths, "lbs");
    if (m !== null) dates.push(addMonthsToDate(measRef, m));
  }
  if (limits.max_height_inches) {
    const m = monthsUntil(startHeight, limits.max_height_inches, ageAtMeasMonths, "inches");
    if (m !== null) dates.push(addMonthsToDate(measRef, m));
  }

  if (dates.length === 0) return null;
  const earliest = dates.reduce((a, b) => (a < b ? a : b));
  return toDateOnly(earliest);
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
