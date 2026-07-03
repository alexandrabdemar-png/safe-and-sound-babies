import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Loader2, Radio, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { fetchRecentBabyRecalls } from "@/lib/cpscSearch";
import { CRITICAL_RECALLS, recallFallbackUrl } from "@/lib/recallCheck";

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

// Unified shape so every source (live CPSC/FDA fetches, manually-curated
// critical recalls, and the extra sources synced daily into our own
// `recalls` table — USDA FSIS, NHTSA, Health Canada, EU Safety Gate) can
// render in the same list.
type RadarRecall = {
  id: string;
  source: string;
  title: string;
  description: string;
  dateLabel: string | null;
  sortDate: number;
  url: string;
  /** false only for the EU Safety Gate feed — no official EC API exists, so
   * that source runs through an unofficial third-party mirror. Surfaced so
   * a miss there is never read as "definitely no EU recall." */
  official: boolean;
};

function RecallRadarPage() {
  const [loading, setLoading] = useState(true);
  const [recalls, setRecalls] = useState<RadarRecall[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cpscResults, extraResult] = await Promise.all([
          // fetchRecentBabyRecalls already merges CPSC + FDA internally
          // (FDA results are mapped into the same shape, RecallID prefixed
          // "fda-") — this is where Nara-class food/formula recalls live,
          // since FDA and CPSC are separate agencies with separate data.
          fetchRecentBabyRecalls(30).catch(() => []),
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

        const cpscItems: RadarRecall[] = cpscResults.map((r) => ({
          id: r.RecallID.startsWith("fda-") ? r.RecallID : `cpsc-${r.RecallID}`,
          source: r.RecallID.startsWith("fda-") ? "fda" : "cpsc",
          title: r.RecallHeading,
          description: r.Products?.map((p) => p.Description || p.Name).filter(Boolean).join("; ") ?? "",
          dateLabel: r.RecallDate
            ? new Date(r.RecallDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
            : null,
          sortDate: r.RecallDate ? new Date(r.RecallDate).getTime() : 0,
          url: r.URL,
          official: true,
        }));

        // Critical recalls are manually curated because they may not reliably
        // appear via CPSC/FDA keyword search, or may fall outside a 30-day
        // window while still being actively relevant (e.g. Nara infant
        // formula — a product could still be sitting in someone's pantry).
        // Always show them regardless of date.
        const criticalItems: RadarRecall[] = CRITICAL_RECALLS.map((c) => ({
          id: `critical-${c.id}`,
          source: "critical",
          title: c.title,
          description: c.reason,
          dateLabel: c.date || null,
          sortDate: Number.MAX_SAFE_INTEGER, // always sort to the top
          url: c.url,
          official: true,
        }));

        const extraItems: RadarRecall[] = ((extraResult.data ?? []) as Array<{
          id: string; source: string; title: string; description: string | null;
          hazard: string | null; url: string | null; recall_date: string | null; official: boolean;
        }>).map((r) => ({
          id: `${r.source}-${r.id}`,
          source: r.source,
          title: r.title,
          description: r.hazard ?? r.description ?? "",
          dateLabel: r.recall_date
            ? new Date(r.recall_date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
            : null,
          sortDate: r.recall_date ? new Date(r.recall_date).getTime() : 0,
          url: r.url ?? "",
          official: r.official,
        }));

        const seen = new Set<string>();
        const merged = [...criticalItems, ...cpscItems, ...extraItems].filter((item) => {
          const key = item.title.toLowerCase().trim();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        merged.sort((a, b) => b.sortDate - a.sortDate);

        setRecalls(merged);
      } catch {
        setError("Couldn't reach the recall databases right now. Try again in a moment or visit cpsc.gov/Recalls directly.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 font-body text-sm text-destructive">
              {error}
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
