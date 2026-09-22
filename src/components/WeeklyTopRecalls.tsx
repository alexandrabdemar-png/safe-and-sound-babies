// WeeklyTopRecalls — the inline "This week's top recalls" preview that sits
// directly under the Recall Radar entry on the home screen. Industry-wide on
// purpose: these are recalls every parent should know about, whether or not
// they added the matching product to their profile.
//
// Failure behaviour: every source is isolated and the whole component
// renders nothing when there's nothing trustworthy to show, rather than
// displaying an empty "no recalls" claim we can't stand behind.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchRecentBabyRecalls } from "@/lib/cpscSearch";
import {
  mapCpscResults,
  mapCriticalRecalls,
  mapExtraResults,
  mergeRecallSources,
  type ExtraRecallRow,
  type RadarRecall,
} from "@/lib/recallRadarMerge";
import {
  formatLastUpdated,
  pickWeeklyTopRecalls,
  readWeeklyTopRecallsCache,
  writeWeeklyTopRecallsCache,
  WEEKLY_TOP_RECALLS_DAYS,
} from "@/lib/weeklyTopRecalls";
import { logError } from "@/lib/sanitize-error";

const SOURCE_LABEL: Record<string, string> = {
  cpsc: "CPSC",
  fda: "FDA",
  critical: "Critical alert",
  usda_fsis: "USDA FSIS",
  nhtsa: "NHTSA",
  health_canada: "Health Canada",
  eu_safety_gate: "EU Safety Gate",
};

export function WeeklyTopRecalls() {
  const [recalls, setRecalls] = useState<RadarRecall[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const cached = readWeeklyTopRecallsCache();
    if (cached) {
      setRecalls(pickWeeklyTopRecalls(cached.recalls));
      setFetchedAt(cached.fetchedAt);
      setLoading(false);
      return;
    }

    (async () => {
      const cutoff = new Date(Date.now() - WEEKLY_TOP_RECALLS_DAYS * 86_400_000)
        .toISOString()
        .slice(0, 10);

      const [cpscSettled, extraSettled] = await Promise.allSettled([
        // Already merges CPSC + FDA internally and never rejects.
        fetchRecentBabyRecalls(WEEKLY_TOP_RECALLS_DAYS),
        supabase
          .from("recalls")
          .select("id, source, title, description, hazard, url, recall_date, official, lot_pattern")
          .in("source", ["usda_fsis", "nhtsa", "health_canada", "eu_safety_gate"])
          .gte("recall_date", cutoff)
          .order("recall_date", { ascending: false })
          .limit(20),
      ]);

      if (cancelled) return;

      let cpscItems: RadarRecall[] = [];
      if (cpscSettled.status === "fulfilled") {
        cpscItems = mapCpscResults(cpscSettled.value);
      } else {
        logError("Weekly top recalls: CPSC/FDA fetch failed", cpscSettled.reason);
      }

      let extraItems: RadarRecall[] = [];
      if (extraSettled.status === "fulfilled" && !extraSettled.value.error) {
        extraItems = mapExtraResults((extraSettled.value.data ?? []) as unknown as ExtraRecallRow[]);
      } else if (extraSettled.status === "fulfilled") {
        logError("Weekly top recalls: extra-sources query failed", extraSettled.value.error);
      } else {
        logError("Weekly top recalls: extra-sources query rejected", extraSettled.reason);
      }

      const merged = mergeRecallSources(mapCriticalRecalls(), cpscItems, extraItems);
      const now = new Date().toISOString();
      writeWeeklyTopRecallsCache({ fetchedAt: now, recalls: merged });
      setRecalls(pickWeeklyTopRecalls(merged));
      setFetchedAt(now);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 pb-1 font-body text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking this week's recalls…
      </div>
    );
  }

  if (!recalls || recalls.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          This week's top recalls
        </p>
        <Link
          to="/recall-radar"
          className="font-body text-[11px] font-semibold text-primary hover:underline"
        >
          See all
        </Link>
      </div>

      <ul className="mt-2 space-y-2">
        {recalls.map((r) => {
          const label = SOURCE_LABEL[r.source] ?? r.source;
          const body = (
            <>
              <p className="font-body text-xs font-semibold leading-snug line-clamp-2">{r.title}</p>
              <p className="mt-0.5 font-body text-[11px] text-muted-foreground">
                {label}
                {r.dateLabel ? ` · ${r.dateLabel}` : ""}
              </p>
            </>
          );
          return (
            <li key={r.id}>
              {r.url ? (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-xl px-1 py-0.5 transition-colors hover:bg-muted/60"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">{body}</span>
                    <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  </span>
                </a>
              ) : (
                <div className="px-1 py-0.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-2 inline-flex items-center gap-1.5 font-body text-[10px] text-muted-foreground">
        <Clock className="h-2.5 w-2.5" aria-hidden />
        {formatLastUpdated(fetchedAt)} · Official government recall feeds
      </p>
    </div>
  );
}
