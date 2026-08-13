// Pure helpers extracted from recall-radar.tsx so the merge/dedupe/mapping
// logic is unit-testable independent of network calls and React.
import type { CpscRecall } from "@/lib/cpscSearch";
import { CRITICAL_RECALLS } from "@/lib/recallCheck";

export type RadarRecall = {
  id: string;
  source: string;
  title: string;
  description: string;
  dateLabel: string | null;
  sortDate: number;
  url: string;
  official: boolean;
  /**
   * Affected batch/lot code(s), when the source data specifies them.
   * Only ever populated from our own `recalls` table (mapExtraResults) —
   * the live CPSC/FDA APIs (mapCpscResults) don't return a structured lot
   * field, so this is always null for those.
   */
  lotPattern: string | null;
};

export type ExtraRecallRow = {
  id: string;
  source: string;
  title: string;
  description: string | null;
  hazard: string | null;
  url: string | null;
  recall_date: string | null;
  official: boolean;
  lot_pattern: string | null;
};

/** Maps CPSC/FDA API results into RadarRecall. Guards against malformed
 * entries (missing RecallID, etc.) from the third-party API instead of
 * letting one bad row throw and blank the whole page. */
export function mapCpscResults(cpscResults: CpscRecall[]): RadarRecall[] {
  return cpscResults
    .filter((r) => typeof r?.RecallID === "string" && r.RecallID.length > 0)
    .map((r) => ({
      id: r.RecallID.startsWith("fda-") ? r.RecallID : `cpsc-${r.RecallID}`,
      source: r.RecallID.startsWith("fda-") ? "fda" : "cpsc",
      title: r.RecallHeading ?? "Recall notice",
      description:
        r.Products?.map((p) => p.Description || p.Name)
          .filter(Boolean)
          .join("; ") ?? "",
      dateLabel: r.RecallDate
        ? new Date(r.RecallDate).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : null,
      sortDate: r.RecallDate ? new Date(r.RecallDate).getTime() : 0,
      url: r.URL ?? "",
      official: true,
      lotPattern: null,
    }));
}

export function mapCriticalRecalls(): RadarRecall[] {
  return CRITICAL_RECALLS.map((c) => ({
    id: `critical-${c.id}`,
    source: "critical",
    title: c.title,
    description: c.reason,
    dateLabel: c.date || null,
    sortDate: Number.MAX_SAFE_INTEGER,
    url: c.url,
    official: true,
    lotPattern: null,
  }));
}

export function mapExtraResults(rows: ExtraRecallRow[]): RadarRecall[] {
  return rows
    .filter((r) => r && typeof r.id === "string" && typeof r.source === "string")
    .map((r) => ({
      id: `${r.source}-${r.id}`,
      source: r.source,
      title: r.title ?? "Recall notice",
      description: r.hazard ?? r.description ?? "",
      dateLabel: r.recall_date
        ? new Date(r.recall_date).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : null,
      sortDate: r.recall_date ? new Date(r.recall_date).getTime() : 0,
      url: r.url ?? "",
      official: r.official,
      lotPattern: r.lot_pattern ?? null,
    }));
}

export type RecallFetchStatus = {
  /** Set only when nothing loaded at all — recall-radar.tsx shows a
   * blocking error state instead of the list in this case. */
  error: string | null;
  /** Human-readable source labels that failed to load, shown as a
   * dismissible degraded-data banner above an otherwise-usable list. */
  degradedSources: string[];
};

/**
 * Decides what recall-radar.tsx should show given which of its two
 * sources failed and how many recalls ended up merged — extracted so this
 * decision (blocking error vs. degraded banner vs. nothing) is unit
 * testable independent of React/network calls.
 *
 * Note on wording: "CPSC & FDA" genuinely is a live API fetch, so a
 * failure there really did go unanswered. "USDA FSIS, NHTSA, Health
 * Canada & EU Safety Gate" is different — those aren't fetched live at
 * all; they're read from our own `recalls` table, pre-synced daily by a
 * scheduled job. A failure there means *our database read* failed, not
 * that those agencies "didn't respond" — the caller's copy should reflect
 * that rather than implying a live external timeout for a source that was
 * never contacted live in the first place.
 */
export function classifyRecallFetchStatus(
  cpscFailed: boolean,
  extraFailed: boolean,
  mergedCount: number,
): RecallFetchStatus {
  const failedSources: string[] = [];
  if (cpscFailed) failedSources.push("CPSC & FDA");
  if (extraFailed) failedSources.push("USDA FSIS, NHTSA, Health Canada & EU Safety Gate");

  if (failedSources.length === 0) {
    return { error: null, degradedSources: [] };
  }
  if (mergedCount === 0) {
    return {
      error:
        "Couldn't reach the recall databases right now. Try again in a moment or visit cpsc.gov/Recalls directly.",
      degradedSources: [],
    };
  }
  return { error: null, degradedSources: failedSources };
}

/**
 * Filters out recalls the user has already marked as done. Extracted as a
 * pure function so "a dismissed recall stays hidden" is unit-testable
 * without a live Supabase round-trip.
 */
export function filterDismissedRecalls(
  recalls: RadarRecall[],
  dismissedIds: Set<string>,
): RadarRecall[] {
  return recalls.filter((r) => !dismissedIds.has(r.id));
}

/** Dedupe by lowercased title (across sources) and sort newest-first. */
export function mergeRecallSources(...groups: RadarRecall[][]): RadarRecall[] {
  const seen = new Set<string>();
  const merged = groups.flat().filter((item) => {
    const key = item.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  merged.sort((a, b) => b.sortDate - a.sortDate);
  return merged;
}
