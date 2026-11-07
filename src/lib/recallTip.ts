import type { RadarRecall } from "@/lib/recallRadarMerge";
import type { SafetyTip } from "@/lib/safetyTips";

const WEEK_MS = 7 * 86400000;

/**
 * Wednesday "recall roundup" tip built from a real recall in the last 7
 * days. Calm, informational wording — never alarming. Returns null on
 * other days or when there's no recent recall.
 */
export function buildRecallTip(recalls: RadarRecall[] | undefined, now = new Date()): SafetyTip | null {
  if (now.getDay() !== 3 || !recalls?.length) return null;
  const recent = recalls
    .filter((r) => r.sortDate > 0 && now.getTime() - r.sortDate <= WEEK_MS)
    .sort((a, b) => b.sortDate - a.sortDate)[0];
  if (!recent) return null;
  return {
    id: `recall-${recent.id}`,
    minMonths: 0,
    maxMonths: 999,
    text: `Did you know? This week ${recent.source} shared a recall for "${recent.title}". If you own it, Recall Radar has the details and next steps — most fixes are simple.`,
    source: recent.url ? { label: `${recent.source} recall notice`, url: recent.url } : undefined,
  };
}
