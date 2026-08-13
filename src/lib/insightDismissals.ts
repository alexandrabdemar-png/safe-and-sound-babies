export type InsightDismissalRow = {
  rule_id: string;
  action: string;
  until: string | null;
};

/**
 * Which rule_ids should currently be hidden, given the raw insight_dismissals
 * rows for a child. "done"/"dismissed" block forever; "snoozed" blocks only
 * until the stored `until` timestamp passes. Shared by home.tsx's "Up next"
 * insights and alerts.tsx's replacement/size-up "Mark as done" so the two
 * screens can never silently drift out of sync on what counts as dismissed.
 */
export function computeBlockedRuleIds(
  rows: InsightDismissalRow[],
  nowIso: string = new Date().toISOString(),
): Set<string> {
  const blocked = new Set<string>();
  for (const d of rows) {
    if (d.action === "done" || d.action === "dismissed") blocked.add(d.rule_id);
    else if (d.action === "snoozed" && d.until && d.until > nowIso) blocked.add(d.rule_id);
  }
  return blocked;
}
