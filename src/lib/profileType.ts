export const PROFILE_TYPES = [
  { value: "parent", label: "Parent" },
  { value: "parent_to_be", label: "Parent-to-be" },
  { value: "pediatrician", label: "Pediatrician" },
  { value: "daycare", label: "Daycare" },
  { value: "babysitter_nanny", label: "Babysitter/Nanny" },
  { value: "caregiver", label: "Caregiver" },
] as const;

export type ProfileType = (typeof PROFILE_TYPES)[number]["value"];

// Roles that look after multiple children of varying ages rather than one
// specific child — these get an age-range field during onboarding instead
// of creating a single child profile. Parent and Parent-to-be both use the
// existing single-child flow (a parent-to-be just fills in a due date and
// leaves date of birth blank).
const AGE_RANGE_PROFILE_TYPES: ReadonlySet<ProfileType> = new Set([
  "pediatrician",
  "daycare",
  "babysitter_nanny",
  "caregiver",
]);

export function usesAgeRangeFlow(profileType: ProfileType): boolean {
  return AGE_RANGE_PROFILE_TYPES.has(profileType);
}

export const MAX_CARE_AGE_MONTHS = 216; // 18 years — generous upper bound

export function validateAgeRange(
  minMonths: number | null,
  maxMonths: number | null,
): { valid: boolean; error?: string } {
  if (minMonths === null || maxMonths === null) {
    return { valid: false, error: "Enter both a youngest and oldest age." };
  }
  if (!Number.isInteger(minMonths) || !Number.isInteger(maxMonths)) {
    return { valid: false, error: "Ages must be whole numbers of months." };
  }
  if (minMonths < 0 || maxMonths < 0) {
    return { valid: false, error: "Ages can't be negative." };
  }
  if (minMonths > MAX_CARE_AGE_MONTHS || maxMonths > MAX_CARE_AGE_MONTHS) {
    return { valid: false, error: `Ages must be ${MAX_CARE_AGE_MONTHS} months (18 years) or less.` };
  }
  if (maxMonths < minMonths) {
    return { valid: false, error: "Oldest age must be greater than or equal to youngest age." };
  }
  return { valid: true };
}

export function formatAgeMonths(months: number): string {
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${years} yr${years === 1 ? "" : "s"}` : `${years}y ${rem}mo`;
}

export function formatAgeRange(minMonths: number, maxMonths: number): string {
  return `${formatAgeMonths(minMonths)} – ${formatAgeMonths(maxMonths)}`;
}
