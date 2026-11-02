// One loader for the Recall Radar feed, used by both the Radar page and the
// Home card's count — so "N new recalls" on Home always matches the list
// the parent sees when they tap it.
import { logError } from "@/lib/sanitize-error";
import { supabase } from "@/integrations/supabase/client";
import { fetchRecentBabyRecalls } from "@/lib/cpscSearch";
import type { FdaRecallNewsItem } from "@/lib/fdaRecallFeed";
import {
  classifyRecallFetchStatus,
  mapCpscResults,
  mapCriticalRecalls,
  mapExtraResults,
  mapFdaNewsResults,
  mergeRecallSources,
  type ExtraRecallRow,
  type RadarRecall,
  type RecallFetchStatus,
} from "@/lib/recallRadarMerge";

export async function loadRecallRadarFeed(
  fetchFdaNews: () => Promise<FdaRecallNewsItem[]>,
): Promise<{ recalls: RadarRecall[]; status: RecallFetchStatus }> {
  const criticalItems = mapCriticalRecalls();

  const [newsSettled, cpscSettled, extraSettled] = await Promise.allSettled([
    // Live FDA recall announcements (with article links) — same-day, unlike
    // openFDA's enforcement data, which lags by weeks.
    fetchFdaNews(),
    // CPSC + openFDA enforcement, merged internally.
    fetchRecentBabyRecalls(30),
    // USDA FSIS, NHTSA, Health Canada, EU Safety Gate — synced daily into
    // our own table by the scheduled job.
    supabase
      .from("recalls")
      .select("id, source, title, description, hazard, url, recall_date, official, lot_pattern")
      .in("source", ["usda_fsis", "nhtsa", "health_canada", "eu_safety_gate"])
      .gte("recall_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
      .order("recall_date", { ascending: false })
      .limit(50),
  ]);

  let newsItems: RadarRecall[] = [];
  let newsFailed = false;
  if (newsSettled.status === "fulfilled") newsItems = mapFdaNewsResults(newsSettled.value);
  else {
    logError("Recall Radar: FDA announcements fetch failed", newsSettled.reason);
    newsFailed = true;
  }

  let cpscItems: RadarRecall[] = [];
  let cpscFailed = false;
  if (cpscSettled.status === "fulfilled") cpscItems = mapCpscResults(cpscSettled.value);
  else {
    logError("Recall Radar: CPSC/FDA fetch failed", cpscSettled.reason);
    cpscFailed = true;
  }

  let extraItems: RadarRecall[] = [];
  let extraFailed = false;
  if (extraSettled.status === "fulfilled" && !extraSettled.value.error) {
    extraItems = mapExtraResults((extraSettled.value.data ?? []) as unknown as ExtraRecallRow[]);
  } else {
    logError(
      "Recall Radar: extra-sources query failed",
      extraSettled.status === "fulfilled" ? extraSettled.value.error : extraSettled.reason,
    );
    extraFailed = true;
  }

  // Announcements go before enforcement rows so the article-linked version
  // wins the title de-dupe.
  const recalls = mergeRecallSources(criticalItems, newsItems, cpscItems, extraItems);
  return {
    recalls,
    status: classifyRecallFetchStatus(cpscFailed, extraFailed, recalls.length, newsFailed),
  };
}
