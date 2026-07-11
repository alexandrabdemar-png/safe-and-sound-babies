// recallSeverity.ts — classify a recall into three tiers so the UI can
// visually distinguish a life-threatening hazard from a cosmetic one.
//
// Deliberately keyword-driven rather than ML-driven: recall hazard/remedy
// text is short, terminology is standardized ("laceration", "suffocation",
// "entrapment", "burn"), and false-negatives here quietly downgrade a real
// hazard's visibility — so the rule set is explicit and reviewable.

export type SeverityTier = "life_threatening" | "injury" | "non_injury";

// Order matters: the first tier whose keywords hit wins. Life-threatening
// terms are checked first so an ambiguous "fall / choking hazard" recall
// lands in the top tier.
const LIFE_THREATENING = [
  "death", "died", "fatal", "fatality", "fatalities",
  "strangulation", "strangle",
  "suffocation", "suffocate", "asphyxiat",
  "drowning", "drown",
  "entrapment", "entrap",
  "choking", "choke",
  "carbon monoxide",
  "lead poisoning", "lead exposure",
  "infant botulism", "botulism",
  "sids",
  "electrocution", "electric shock",
  "fire hazard", "flame",
  "explosion",
];

const INJURY = [
  "laceration", "cut", "amputation",
  "burn", "scald",
  "fracture", "broken bone",
  "concussion", "head injury",
  "fall hazard", "fall risk",
  "pinch", "crush",
  "puncture",
  "eye injury",
  "toxic", "chemical exposure",
  "allergen", "allergic reaction", "undeclared",
  "impact injury", "tip-over", "tipover",
];

function firstMatch(haystack: string, needles: string[]): boolean {
  for (const n of needles) if (haystack.includes(n)) return true;
  return false;
}

/**
 * Classify a recall from its hazard/title/remedy text. Never throws; unknown
 * text defaults to `non_injury` (which the UI still shows, just without the
 * loudest styling — this is the same failure mode as the pre-existing
 * "everything looks the same" behavior, so downgrading unknowns cannot
 * regress it).
 */
export function classifyRecallSeverity(fields: {
  title?: string | null;
  hazard?: string | null;
  remedy?: string | null;
  description?: string | null;
}): SeverityTier {
  const blob = [fields.title, fields.hazard, fields.remedy, fields.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!blob) return "non_injury";
  if (firstMatch(blob, LIFE_THREATENING)) return "life_threatening";
  if (firstMatch(blob, INJURY)) return "injury";
  return "non_injury";
}

export const SEVERITY_LABEL: Record<SeverityTier, string> = {
  life_threatening: "Life-threatening hazard",
  injury: "Injury hazard",
  non_injury: "Non-injury recall",
};

export const SEVERITY_DESCRIPTION: Record<SeverityTier, string> = {
  life_threatening: "Stop using this product immediately and follow the manufacturer's remedy instructions.",
  injury: "This recall involves a risk of physical injury. Stop use and follow the manufacturer's remedy.",
  non_injury: "This recall does not describe an injury risk, but the manufacturer has issued a remedy.",
};
