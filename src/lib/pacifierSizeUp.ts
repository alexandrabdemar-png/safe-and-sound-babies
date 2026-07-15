// Pacifiers are sized by age band, not by weight or height like most other
// tracked gear — manufacturers commonly split sizing into three stages
// (0–6 months, 6–18 months, 18+ months). The existing size-up prediction
// system (src/lib/predictions.ts) is entirely weight/height-driven and
// returns null when neither is set, so it can't produce a sensible
// pacifier size-up date on its own. This gives pacifiers their own,
// much simpler, age-only calculation instead.
export type PacifierSizeStage = { maxAgeMonths: number; label: string };

export const PACIFIER_SIZE_STAGES: PacifierSizeStage[] = [
  { maxAgeMonths: 6, label: "Stage 1 (0–6 months)" },
  { maxAgeMonths: 18, label: "Stage 2 (6–18 months)" },
  { maxAgeMonths: Infinity, label: "Stage 3 (18+ months)" },
];

/**
 * The date a child will age out of their CURRENT pacifier stage — i.e.
 * when it's time to size up — based on date of birth alone. Returns null
 * when there's nothing to compute: no DOB known, or the child is already
 * in the last (uncapped) stage with no further size-up ahead.
 */
export function nextPacifierSizeUpDate(
  dateOfBirth: string | null | undefined,
  from: Date = new Date(),
): string | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth + "T00:00:00");
  if (Number.isNaN(dob.getTime())) return null;

  const ageMonths =
    (from.getFullYear() - dob.getFullYear()) * 12 + (from.getMonth() - dob.getMonth());
  const currentStage = PACIFIER_SIZE_STAGES.find((s) => ageMonths < s.maxAgeMonths);
  if (!currentStage || !Number.isFinite(currentStage.maxAgeMonths)) return null;

  const sizeUpDate = new Date(dob);
  sizeUpDate.setMonth(sizeUpDate.getMonth() + currentStage.maxAgeMonths);
  return sizeUpDate.toISOString().slice(0, 10);
}

/** Human-readable current stage label, for display alongside the date. */
export function currentPacifierStage(
  dateOfBirth: string | null | undefined,
  from: Date = new Date(),
): PacifierSizeStage | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth + "T00:00:00");
  if (Number.isNaN(dob.getTime())) return null;
  const ageMonths =
    (from.getFullYear() - dob.getFullYear()) * 12 + (from.getMonth() - dob.getMonth());
  return PACIFIER_SIZE_STAGES.find((s) => ageMonths < s.maxAgeMonths) ?? null;
}
