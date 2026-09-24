// weeklyTopRecalls.ts — pure helpers for the "This week's top recalls"
// preview shown under Recall Radar on the home screen.
//
// Why this exists: Recall Radar is industry-wide (every baby/kids recall,
// not just products the user added), but it's one tap away. Parents who
// forgot to add a product would never see a recall that matters to them.
// Surfacing the freshest few recalls inline means the live feed is visible
// on the home screen without the user having to go looking for it.
//
// The list is deliberately short (3) and always carries a fetched-at
// timestamp so a stale cache is visible rather than silently implied to be
// current.
import type { RadarRecall } from "@/lib/recallRadarMerge";

export const WEEKLY_TOP_RECALLS_CACHE_KEY = "safesound.weeklyTopRecalls.v1";
/** Short TTL: the pipeline runs every 30 minutes, so match its cadence. */
export const WEEKLY_TOP_RECALLS_TTL_MS = 30 * 60_000;
export const WEEKLY_TOP_RECALLS_LIMIT = 3;
export const WEEKLY_TOP_RECALLS_DAYS = 7;

export type WeeklyTopRecallsCache = {
  fetchedAt: string;
  recalls: RadarRecall[];
};

/**
 * Picks the recalls to show: the most recent official recalls (curated critical alerts are
 * excluded — they carry a synthetic sortDate and may be months old) published inside the window. Recalls with no usable date
 * are excluded — an undated row can't honestly be called "this week".
 */
export function pickWeeklyTopRecalls(
  all: RadarRecall[],
  now: Date = new Date(),
  { days = WEEKLY_TOP_RECALLS_DAYS, limit = WEEKLY_TOP_RECALLS_LIMIT } = {},
): RadarRecall[] {
  const cutoff = now.getTime() - days * 86_400_000;
  return all
    .filter((r) => {
      if (!r || typeof r.id !== "string") return false;
      // Curated critical alerts are pinned in Recall Radar itself; they are not
      // necessarily from this week, so they never appear in this list.
      if (r.source === "critical") return false;
      return Number.isFinite(r.sortDate) && r.sortDate > 0 && r.sortDate >= cutoff;
    })
    .sort((a, b) => b.sortDate - a.sortDate)
    .slice(0, limit);
}

/** Reads the cached preview, or null when absent, unparseable, or expired. */
export function readWeeklyTopRecallsCache(
  now: Date = new Date(),
  ttlMs = WEEKLY_TOP_RECALLS_TTL_MS,
): WeeklyTopRecallsCache | null {
  try {
    const raw = localStorage.getItem(WEEKLY_TOP_RECALLS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeeklyTopRecallsCache;
    if (!parsed || typeof parsed.fetchedAt !== "string" || !Array.isArray(parsed.recalls)) {
      return null;
    }
    const age = now.getTime() - new Date(parsed.fetchedAt).getTime();
    if (!Number.isFinite(age) || age < 0 || age > ttlMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeWeeklyTopRecallsCache(cache: WeeklyTopRecallsCache): void {
  try {
    localStorage.setItem(WEEKLY_TOP_RECALLS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Private browsing / quota — the preview simply re-fetches next time.
  }
}

/** "Updated just now" / "Updated 2 hours ago" — what the user actually sees. */
export function formatLastUpdated(
  fetchedAt: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  if (!fetchedAt) return "Update time unavailable";
  const d = fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt);
  if (isNaN(d.getTime())) return "Update time unavailable";
  const diffMin = (now.getTime() - d.getTime()) / 60_000;
  if (diffMin < 2) return "Updated just now";
  if (diffMin < 60) return `Updated ${Math.floor(diffMin)} minutes ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Updated ${diffH} hour${diffH === 1 ? "" : "s"} ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Updated yesterday";
  return `Updated ${diffD} days ago`;
}
