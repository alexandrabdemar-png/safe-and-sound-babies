import { logError } from "@/lib/sanitize-error";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Loader2,
  Radio,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { DataAsOf } from "@/components/DataAsOf";
import { supabase } from "@/integrations/supabase/client";
import { fetchRecentBabyRecalls } from "@/lib/cpscSearch";
import { recallFallbackUrl } from "@/lib/recallCheck";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import {
  mapCpscResults,
  mapCriticalRecalls,
  mapExtraResults,
  mergeRecallSources,
  classifyRecallFetchStatus,
  filterDismissedRecalls,
  type ExtraRecallRow,
  type RadarRecall,
} from "@/lib/recallRadarMerge";

export const Route = createFileRoute("/_authenticated/recall-radar")({
  ssr: false,
  component: RecallRadarPage,
  head: () => ({ meta: [{ title: "Recall Radar — Peace of Mine" }] }),
});

const SOURCE_LABEL: Record<string, string> = {
  cpsc: "CPSC",
  fda: "FDA",
  critical: "Critical alert",
  usda_fsis: "USDA FSIS",
  nhtsa: "NHTSA",
  health_canada: "Health Canada",
  eu_safety_gate: "EU Safety Gate",
};

function RecallRadarPage() {
  const [loading, setLoading] = useState(true);
  const [recalls, setRecalls] = useState<RadarRecall[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [degradedSources, setDegradedSources] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const retry = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  // Manual select-then-insert instead of a plain upsert on (user_id,
  // recall_id) — matches the established pattern in alerts.tsx/home.tsx for
  // insight_dismissals, kept here too for consistency even though this
  // table's constraint is unambiguous (only one migration ever created it).
  async function markRecallDone(recallId: string) {
    setDismissedIds((prev) => new Set([...prev, recallId]));
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    try {
      const { data: existing, error: selectError } = await supabase
        .from("recall_radar_dismissals")
        .select("id")
        .eq("user_id", userId)
        .eq("recall_id", recallId)
        .maybeSingle();
      if (selectError) throw selectError;
      if (!existing) {
        const { error: insertError } = await supabase
          .from("recall_radar_dismissals")
          .insert({ user_id: userId, recall_id: recallId });
        if (insertError) throw insertError;
      }
    } catch (err) {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(recallId);
        return next;
      });
      toast.error(friendlyError((err as { message?: string })?.message ?? err));
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setDegradedSources([]);

      // Critical recalls are manually curated, synchronous, and can never
      // fail — always available regardless of what happens below.
      const criticalItems = mapCriticalRecalls();

      // Each remote source is isolated so one failing source degrades
      // gracefully instead of blanking the whole page. Both promises always
      // resolve (never reject) — failures are caught here and logged.
      const [cpscSettled, extraSettled, dismissedSettled] = await Promise.allSettled([
        // fetchRecentBabyRecalls already merges CPSC + FDA internally
        // (FDA results are mapped into the same shape, RecallID prefixed
        // "fda-") — this is where Nara-class food/formula recalls live,
        // since FDA and CPSC are separate agencies with separate data.
        // It's already internally error-safe (returns [] on failure), but
        // Promise.allSettled gives us a second layer of protection.
        fetchRecentBabyRecalls(30),
        // USDA FSIS, NHTSA, Health Canada, and EU Safety Gate are synced
        // daily into our own recalls table by check-extra-recalls.ts
        // rather than fetched live here — Health Canada is a multi-MB
        // bulk dump unsuitable for a page load, and USDA/NHTSA/EU CORS
        // support couldn't be confirmed from this build environment.
        supabase
          .from("recalls")
          .select("id, source, title, description, hazard, url, recall_date, official, lot_pattern")
          .in("source", ["usda_fsis", "nhtsa", "health_canada", "eu_safety_gate"])
          .order("recall_date", { ascending: false })
          .limit(50),
        // A failure here shouldn't block the radar list itself — fail open
        // (nothing hidden) the same way the other two sources degrade
        // gracefully rather than blank the page.
        supabase.from("recall_radar_dismissals").select("recall_id"),
      ]);

      if (cancelled) return;

      if (dismissedSettled.status === "fulfilled" && !dismissedSettled.value.error) {
        setDismissedIds(new Set((dismissedSettled.value.data ?? []).map((d) => d.recall_id)));
      } else if (dismissedSettled.status === "rejected") {
        logError("Recall Radar: dismissals fetch rejected", dismissedSettled.reason);
      } else if (dismissedSettled.status === "fulfilled" && dismissedSettled.value.error) {
        logError("Recall Radar: dismissals fetch failed", dismissedSettled.value.error);
      }

      let cpscFailed = false;
      let cpscItems: RadarRecall[] = [];
      if (cpscSettled.status === "fulfilled") {
        cpscItems = mapCpscResults(cpscSettled.value);
      } else {
        logError("Recall Radar: CPSC/FDA fetch failed", cpscSettled.reason);
        cpscFailed = true;
      }

      let extraFailed = false;
      let extraItems: RadarRecall[] = [];
      if (extraSettled.status === "fulfilled") {
        if (extraSettled.value.error) {
          logError("Recall Radar: extra-sources query failed", extraSettled.value.error);
          extraFailed = true;
        } else {
          extraItems = mapExtraResults(
            (extraSettled.value.data ?? []) as unknown as ExtraRecallRow[],
          );
        }
      } else {
        logError("Recall Radar: extra-sources query rejected", extraSettled.reason);
        extraFailed = true;
      }

      const merged = mergeRecallSources(criticalItems, cpscItems, extraItems);
      const status = classifyRecallFetchStatus(cpscFailed, extraFailed, merged.length);

      setRecalls(merged);
      setError(status.error);
      setDegradedSources(status.degradedSources);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const visibleRecalls = useMemo(
    () => filterDismissedRecalls(recalls, dismissedIds),
    [recalls, dismissedIds],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 animate-fade-in">
      <header className="px-5 pt-8 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 rounded-full font-body text-xs"
          >
            <Link to="/home">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Home
            </Link>
          </Button>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <Radio className="h-4.5 w-4.5" />
            </span>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">Recall Radar</h1>
              <p className="font-body text-xs text-muted-foreground">
                Baby &amp; kids product recalls
              </p>
            </div>
          </div>
          <DataAsOf
            sources={["cpsc", "fda", "usda_fsis", "nhtsa", "health_canada", "eu_safety_gate"]}
            className="mt-2"
            showSources={false}
          />
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 py-10 font-body text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning recall databases…
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 font-body text-sm text-destructive space-y-3">
              <p>{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={retry}
                className="rounded-full border-destructive/40 font-body text-xs text-destructive hover:bg-destructive/10"
              >
                <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Try again
              </Button>
            </div>
          ) : visibleRecalls.length === 0 ? (
            <div className="rounded-3xl border border-border/60 bg-card px-5 py-10 text-center animate-scale-in">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="font-display text-lg font-semibold tracking-tight">
                {recalls.length > 0 ? "You're all caught up" : "No recalls found this month"}
              </p>
              <p className="mt-1 mx-auto max-w-xs font-body text-sm text-muted-foreground">
                {recalls.length > 0
                  ? "You've marked every recall from the last 30 days as done."
                  : "No baby or kids product recalls were issued in the last 30 days, based on the sources we check roughly every 30 minutes."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="font-body text-sm font-semibold text-destructive">
                  {visibleRecalls.length} recall{visibleRecalls.length !== 1 ? "s" : ""}
                </p>
                <span className="font-body text-xs text-muted-foreground">
                  6 agencies + brand watch
                </span>
              </div>
              {degradedSources.length > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 font-body text-xs text-amber-800 dark:text-amber-400">
                  <span>
                    Couldn't load the latest from {degradedSources.join(" and ")} — this list may be
                    incomplete.
                  </span>
                  <button
                    type="button"
                    onClick={retry}
                    className="shrink-0 font-semibold underline underline-offset-2"
                  >
                    Retry
                  </button>
                </div>
              )}
              <ul className="space-y-3">
                {visibleRecalls.map((r) => (
                  <RecallCard key={r.id} recall={r} onDone={() => markRecallDone(r.id)} />
                ))}
              </ul>
            </>
          )}

          <div className="rounded-2xl border border-border/40 bg-muted/30 px-4 py-3 font-body text-xs text-muted-foreground space-y-1">
            <p>
              Data sourced from CPSC, the FDA, USDA FSIS, NHTSA, and Health Canada. For the complete
              CPSC list visit{" "}
              <a
                href="https://cpsc.gov/Recalls"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground underline underline-offset-2"
              >
                cpsc.gov/Recalls
              </a>
            </p>
            <p>
              EU Safety Gate alerts are compiled from public listings, since the European Commission
              doesn't offer a direct data feed. For the official, up-to-date record, visit{" "}
              <a
                href="https://ec.europa.eu/safety-gate-alerts/screen/webReport"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground underline underline-offset-2"
              >
                Safety Gate
              </a>
              .
            </p>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function RecallCard({ recall, onDone }: { recall: RadarRecall; onDone?: () => void }) {
  return (
    <li className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-4 space-y-2">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-semibold leading-snug text-foreground">
            {recall.title}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
            {recall.dateLabel && (
              <span className="font-body text-xs text-muted-foreground">{recall.dateLabel}</span>
            )}
            <span className="rounded-full bg-muted px-1.5 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {SOURCE_LABEL[recall.source] ?? recall.source}
            </span>
            {!recall.official && (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Unofficial source
              </span>
            )}
          </div>
        </div>
      </div>
      {recall.description && (
        <p className="font-body text-xs text-muted-foreground leading-relaxed pl-10 line-clamp-3">
          {recall.description}
        </p>
      )}
      {recall.lotPattern && (
        <p className="font-body text-xs text-muted-foreground pl-10">
          Affected batch/lot:{" "}
          <span className="font-semibold text-foreground">{recall.lotPattern}</span>
        </p>
      )}
      <div className="pl-10 flex items-center gap-3">
        <a
          href={recall.url || recallFallbackUrl(recall.title, recall.source)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-body text-xs font-semibold text-destructive underline underline-offset-2"
        >
          Full recall details <ArrowUpRight className="h-3 w-3" />
        </a>
        {onDone && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDone}
            className="rounded-full font-body text-xs text-muted-foreground"
          >
            <Check className="mr-1 h-3.5 w-3.5" /> Mark as done
          </Button>
        )}
      </div>
    </li>
  );
}
