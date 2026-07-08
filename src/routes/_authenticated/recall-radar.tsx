import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Loader2, Radio, RotateCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { fetchRecentBabyRecalls } from "@/lib/cpscSearch";
import { recallFallbackUrl } from "@/lib/recallCheck";
import {
  mapCpscResults,
  mapCriticalRecalls,
  mapExtraResults,
  mergeRecallSources,
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
  const [degraded, setDegraded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setDegraded(false);

      // Critical recalls are manually curated, synchronous, and can never
      // fail — always available regardless of what happens below.
      const criticalItems = mapCriticalRecalls();

      // Each remote source is isolated so one failing source degrades
      // gracefully instead of blanking the whole page. Both promises always
      // resolve (never reject) — failures are caught here and logged.
      const [cpscSettled, extraSettled] = await Promise.allSettled([
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
          .select("id, source, title, description, hazard, url, recall_date, official")
          .in("source", ["usda_fsis", "nhtsa", "health_canada", "eu_safety_gate"])
          .order("recall_date", { ascending: false })
          .limit(50),
      ]);

      if (cancelled) return;

      let anySourceFailed = false;

      let cpscItems: RadarRecall[] = [];
      if (cpscSettled.status === "fulfilled") {
        cpscItems = mapCpscResults(cpscSettled.value);
      } else {
        console.error("Recall Radar: CPSC/FDA fetch failed", cpscSettled.reason);
        anySourceFailed = true;
      }

      let extraItems: RadarRecall[] = [];
      if (extraSettled.status === "fulfilled") {
        if (extraSettled.value.error) {
          console.error("Recall Radar: extra-sources query failed", extraSettled.value.error);
          anySourceFailed = true;
        } else {
          extraItems = mapExtraResults((extraSettled.value.data ?? []) as ExtraRecallRow[]);
        }
      } else {
        console.error("Recall Radar: extra-sources query rejected", extraSettled.reason);
        anySourceFailed = true;
      }

      const merged = mergeRecallSources(criticalItems, cpscItems, extraItems);

      setRecalls(merged);
      // Only show a hard error if literally nothing loaded — otherwise
      // degrade gracefully and show what we have, with a small notice.
      if (anySourceFailed && merged.length === 0) {
        setError("Couldn't reach the recall databases right now. Try again in a moment or visit cpsc.gov/Recalls directly.");
      } else if (anySourceFailed) {
        setDegraded(true);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 animate-fade-in">
      <header className="px-5 pt-8 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full font-body text-xs">
            <Link to="/home"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Home</Link>
          </Button>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <Radio className="h-4.5 w-4.5" />
            </span>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">Recall Radar</h1>
              <p className="font-body text-xs text-muted-foreground">Baby &amp; kids product recalls · CPSC, FDA, USDA, NHTSA, Health Canada &amp; EU</p>
            </div>
          </div>
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
          ) : recalls.length === 0 ? (
            <div className="rounded-3xl border border-border/60 bg-card px-5 py-10 text-center animate-scale-in">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="font-display text-lg font-semibold tracking-tight">All clear this month</p>
              <p className="mt-1 mx-auto max-w-xs font-body text-sm text-muted-foreground">
                No baby or kids product recalls were issued in the last 30 days. We check every 24 hours.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="font-body text-sm font-semibold text-destructive">
                  {recalls.length} recall{recalls.length !== 1 ? "s" : ""}
                </p>
                <span className="font-body text-xs text-muted-foreground">6 agencies + brand watch</span>
              </div>
              {degraded && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 font-body text-xs text-amber-800 dark:text-amber-400">
                  <span>One or more recall sources didn't respond — this list may be incomplete.</span>
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
                {recalls.map((r) => <RecallCard key={r.id} recall={r} />)}
              </ul>
            </>
          )}

          <div className="rounded-2xl border border-border/40 bg-muted/30 px-4 py-3 font-body text-xs text-muted-foreground space-y-1">
            <p>
              Data sourced from CPSC, the FDA, USDA FSIS, NHTSA, and Health Canada. For the complete CPSC list visit{" "}
              <a href="https://cpsc.gov/Recalls" target="_blank" rel="noopener noreferrer"
                className="font-semibold text-foreground underline underline-offset-2">
                cpsc.gov/Recalls
              </a>
            </p>
            <p>
              EU Safety Gate alerts come from an unofficial mirror (no official EC API exists) and are marked{" "}
              <span className="font-semibold text-foreground">unofficial</span> — verify directly at{" "}
              <a href="https://ec.europa.eu/safety-gate-alerts/screen/webReport" target="_blank" rel="noopener noreferrer"
                className="font-semibold text-foreground underline underline-offset-2">
                Safety Gate
              </a>{" "}before relying on it.
            </p>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function RecallCard({ recall }: { recall: RadarRecall }) {
  return (
    <li className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-4 space-y-2">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-semibold leading-snug text-foreground">{recall.title}</p>
          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
            {recall.dateLabel && <span className="font-body text-xs text-muted-foreground">{recall.dateLabel}</span>}
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
        <p className="font-body text-xs text-muted-foreground leading-relaxed pl-10 line-clamp-3">{recall.description}</p>
      )}
      <div className="pl-10">
        <a href={recall.url || recallFallbackUrl(recall.title)} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-body text-xs font-semibold text-destructive underline underline-offset-2">
          Full recall details <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>
    </li>
  );
}
