import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Loader2, Radio, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { fetchRecentBabyRecalls, type CpscRecall } from "@/lib/cpscSearch";

export const Route = createFileRoute("/_authenticated/recall-radar")({
  ssr: false,
  component: RecallRadarPage,
  head: () => ({ meta: [{ title: "Recall Radar — Safe & Sound" }] }),
});

function RecallRadarPage() {
  const [loading, setLoading] = useState(true);
  const [recalls, setRecalls] = useState<CpscRecall[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const results = await fetchRecentBabyRecalls(30);
        // Sort newest first
        results.sort((a, b) => {
          const da = a.RecallDate ? new Date(a.RecallDate).getTime() : 0;
          const db = b.RecallDate ? new Date(b.RecallDate).getTime() : 0;
          return db - da;
        });
        setRecalls(results);
      } catch {
        setError("Couldn't reach the CPSC database right now. Try again in a moment or visit cpsc.gov/Recalls directly.");
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
              <p className="font-body text-xs text-muted-foreground">Baby &amp; kids product recalls · last 30 days</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 py-10 font-body text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning CPSC database for recent recalls…
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
                  {recalls.length} recall{recalls.length !== 1 ? "s" : ""} in the last 30 days
                </p>
                <span className="font-body text-xs text-muted-foreground">CPSC data</span>
              </div>
              <ul className="space-y-3">
                {recalls.map((r) => <RecallCard key={r.RecallID} recall={r} />)}
              </ul>
            </>
          )}

          <div className="rounded-2xl border border-border/40 bg-muted/30 px-4 py-3 font-body text-xs text-muted-foreground">
            Data sourced from the U.S. Consumer Product Safety Commission. For the complete list visit{" "}
            <a href="https://cpsc.gov/Recalls" target="_blank" rel="noopener noreferrer"
              className="font-semibold text-foreground underline underline-offset-2">
              cpsc.gov/Recalls
            </a>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function RecallCard({ recall }: { recall: CpscRecall }) {
  const description = recall.Products?.map((p) => p.Description || p.Name).filter(Boolean).join("; ");
  const dateLabel = recall.RecallDate
    ? new Date(recall.RecallDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;

  return (
    <li className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-4 space-y-2">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-semibold leading-snug text-foreground">{recall.RecallHeading}</p>
          {dateLabel && <p className="mt-0.5 font-body text-xs text-muted-foreground">{dateLabel}</p>}
        </div>
      </div>
      {description && (
        <p className="font-body text-xs text-muted-foreground leading-relaxed pl-10 line-clamp-3">{description}</p>
      )}
      {recall.URL && (
        <div className="pl-10">
          <a href={recall.URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-body text-xs font-semibold text-destructive underline underline-offset-2">
            Full recall details <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      )}
    </li>
  );
}
