// DataAsOf — "Data as of {timestamp} · Sources: CPSC, FDA…" line rendered
// under every recall answer so a stale cache is visible, not silent. Reads
// public.recall_source_status (no PII, RLS-open) from the browser client.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDataAsOf, isPipelineStale } from "@/lib/recallFreshness";
import { AlertTriangle, Clock } from "lucide-react";

const SOURCE_LABEL: Record<string, string> = {
  cpsc: "CPSC",
  fda: "FDA",
  nhtsa: "NHTSA",
  usda_fsis: "USDA FSIS",
  health_canada: "Health Canada",
  eu_safety_gate: "EU Safety Gate (unofficial mirror)",
  critical: "Curated critical list",
  __pipeline__: "Pipeline health",
};

type SourceRow = {
  source: string;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
};

export function DataAsOf({
  sources,
  className = "",
}: {
  /** Restrict to specific sources; omit for all. */
  sources?: string[];
  className?: string;
}) {
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("recall_source_status")
        .select("source, last_attempt_at, last_success_at, last_error, consecutive_failures");
      if (cancelled) return;
      setRows((data as SourceRow[] | null) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;

  const filtered = sources
    ? rows.filter((r) => sources.includes(r.source))
    : rows.filter((r) => r.source !== "__pipeline__");

  const mostRecent = filtered
    .map((r) => r.last_success_at)
    .filter((s): s is string => Boolean(s))
    .sort()
    .at(-1) ?? null;

  const pipeline = rows.find((r) => r.source === "__pipeline__");
  // Only surface a "stale" warning when we actually have evidence of staleness:
  // either the pipeline health row exists (and is stale) or we have prior
  // success timestamps that are now old. When neither exists (fresh deploy
  // before the first cron run), stay silent rather than undermining a live
  // check the user just performed.
  const stale = pipeline
    ? isPipelineStale(pipeline.last_success_at)
    : mostRecent
      ? isPipelineStale(mostRecent)
      : false;

  const sourceNames = filtered.map((r) => SOURCE_LABEL[r.source] ?? r.source).filter(Boolean);

  if (stale) {
    return (
      <p className={`inline-flex items-center gap-1.5 font-body text-[11px] text-amber-700 dark:text-amber-400 ${className}`}>
        <AlertTriangle className="h-3 w-3" />
        Recall data may be stale — background checks haven't completed in the last 26 hours.
      </p>
    );
  }

  // No historical freshness signal yet — the on-demand check the user just
  // ran is the source of truth; don't render a misleading "unavailable" line.
  if (!mostRecent) return null;


  return (
    <p className={`inline-flex flex-wrap items-center gap-1.5 font-body text-[11px] text-muted-foreground ${className}`}>
      <Clock className="h-3 w-3" aria-hidden />
      <span>{formatDataAsOf(mostRecent)}</span>
      {sourceNames.length > 0 && (
        <span>
          · Sources: {sourceNames.join(", ")}
        </span>
      )}
    </p>
  );
}
