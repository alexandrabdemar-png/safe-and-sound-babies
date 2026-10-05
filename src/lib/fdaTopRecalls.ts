// fdaTopRecalls.ts — picks the "FDA alerts" shown in their own tap-to-expand
// section on Recall Radar.
//
// Why rank instead of just date-sort: the FDA enforcement feed is matched on
// broad keywords ("formula" also hits supplements and cosmetics), so the
// newest FDA row isn't necessarily the one a parent needs to see first. We
// score each recall by how clearly it is an infant/baby product and how
// serious the hazard is, then break ties by recency.
import type { RadarRecall } from "@/lib/recallRadarMerge";

export const FDA_TOP_RECALLS_LIMIT = 5;

/** Clearly-baby terms, weighted by how unambiguous they are. */
const BABY_TERMS: Array<[string, number]> = [
  ["infant formula", 6],
  ["baby food", 6],
  ["breast milk", 5],
  ["infant", 4],
  ["newborn", 4],
  ["toddler", 3],
  ["baby", 3],
  ["teething", 3],
  ["puree", 2],
  ["enfamil", 3],
  ["similac", 3],
  ["gerber", 3],
  ["kendamil", 3],
  ["bobbie", 3],
  ["hipp", 3],
  ["holle", 3],
  ["nara", 3],
  ["earth's best", 3],
  ["happy baby", 3],
  ["serenity kids", 3],
  ["little spoon", 3],
  ["once upon a farm", 3],
  // Ambiguous on their own — only a small nudge.
  ["formula", 1],
  ["child", 1],
];

/** Hazards that are especially dangerous for infants. */
const SERIOUS_HAZARDS = [
  "cronobacter",
  "botulism",
  "clostridium",
  "salmonella",
  "listeria",
  "lead",
  "e. coli",
  "choking",
  "undeclared milk",
];

function matchesTerm(text: string, term: string): boolean {
  // Word-boundary match so "lead" doesn't hit "leading" and "nara" doesn't
  // hit "narrative".
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

/** Higher = more relevant to a parent of a baby/young child. 0 = not baby-related. */
export function fdaRelevanceScore(recall: RadarRecall): number {
  const text = `${recall.title} ${recall.description}`.toLowerCase();
  let babyScore = 0;
  for (const [term, weight] of BABY_TERMS) {
    if (matchesTerm(text, term)) babyScore = Math.max(babyScore, weight);
  }
  if (babyScore === 0) return 0;
  const hazardBoost = SERIOUS_HAZARDS.some((h) => matchesTerm(text, h)) ? 2 : 0;
  return babyScore + hazardBoost;
}

/** FDA recalls only, most relevant first, newest first within the same score. */
export function pickTopFdaRecalls(
  all: RadarRecall[],
  limit = FDA_TOP_RECALLS_LIMIT,
): RadarRecall[] {
  return all
    .filter((r) => r && r.source === "fda")
    .map((r) => ({ r, score: fdaRelevanceScore(r) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.r.sortDate - a.r.sortDate)
    .slice(0, limit)
    .map(({ r }) => r);
}
