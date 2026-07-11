// Deno mirror of src/lib/recallSeverity.ts. Keep in sync (this file is
// intentionally a copy rather than an import — the edge function bundle
// cannot cross into src/).

export type SeverityTier = "life_threatening" | "injury" | "non_injury";

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
