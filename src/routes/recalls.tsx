import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Loader2, Radio, ShieldAlert, ShieldCheck } from "lucide-react";
import { fetchRecentBabyRecalls, type CpscRecall } from "@/lib/cpscSearch";

export const Route = createFileRoute("/recalls")({
  ssr: false,
  component: PublicRecallsPage,
  head: () => ({
    meta: [
      { title: "Latest Baby Product Recalls — Peace of Mine" },
      { name: "description", content: "Free list of CPSC baby and kids product recalls from the last 30 days. Updated daily. No login required." },
      { property: "og:title", content: "Latest Baby Product Recalls — Peace of Mine" },
      { property: "og:description", content: "Free list of CPSC baby product recalls from the last 30 days. Powered by Peace of Mine." },
      { property: "og:url", content: "https://peace-of-mine.lovable.app/recalls" },
    ],
    links: [{ rel: "canonical", href: "https://peace-of-mine.lovable.app/recalls" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Latest Baby Product Recalls",
        url: "https://peace-of-mine.lovable.app/recalls",
        description: "CPSC baby and kids product recalls from the last 30 days, updated daily by Peace of Mine.",
        isPartOf: {
          "@type": "WebSite",
          name: "Peace of Mine",
          url: "https://peace-of-mine.lovable.app/",
        },
      }),
    }],
  }),
});

function PublicRecallsPage() {
  const [loading, setLoading] = useState(true);
  const [recalls, setRecalls] = useState<CpscRecall[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const results = await fetchRecentBabyRecalls(30);
        results.sort((a, b) => {
          const da = a.RecallDate ? new Date(a.RecallDate).getTime() : 0;
          const db = b.RecallDate ? new Date(b.RecallDate).getTime() : 0;
          return db - da;
        });
        setRecalls(results);
      } catch {
        setError("Couldn't reach the CPSC database right now. Try again or visit cpsc.gov/Recalls.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Radio size={18} />
            </span>
            <div>
              <p className="font-display text-lg font-semibold text-foreground">Peace of Mine</p>
              <p className="font-caption text-muted-foreground">Recall Radar</p>
            </div>
          </div>
          <Link
            to="/auth"
            className="rounded-full bg-primary px-[18px] py-2 font-body text-[13px] font-semibold text-primary-foreground no-underline transition-colors hover:bg-primary/90"
          >
            Get the free app →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10">
        {/* Page intro */}
        <div className="mb-8">
          <h1 className="text-display mb-2 text-foreground">Baby &amp; Kids Product Recalls</h1>
          <p className="max-w-[520px] text-[15px] leading-relaxed text-muted-foreground">
            All CPSC recalls involving baby and children's products in the last 30 days. Updated daily. No account needed.
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">Last checked: {dateStr}</p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Loading recall data from CPSC…
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && recalls.length === 0 && (
          <div className="rounded-3xl border border-border bg-card px-8 py-12 text-center">
            <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ShieldCheck size={22} />
            </span>
            <p className="font-display mb-1.5 text-lg text-foreground">No recalls found this month</p>
            <p className="text-sm text-muted-foreground">
              No baby or kids product recalls were issued by CPSC in the last 30 days, based on
              the databases we check.
            </p>
          </div>
        )}

        {!loading && recalls.length > 0 && (
          <>
            <p className="mb-4 text-[13px] font-semibold text-destructive">
              {recalls.length} recall{recalls.length !== 1 ? "s" : ""} in the last 30 days
            </p>
            <div className="flex flex-col gap-3">
              {recalls.map((r) => <RecallCard key={r.RecallID} recall={r} />)}
            </div>
          </>
        )}

        {/* Footer CTA */}
        <div className="mt-12 rounded-3xl bg-sand/50 px-5 py-6 text-center">
          <p className="font-display mb-1.5 text-lg text-foreground">
            Get alerts for products <em>you own</em>
          </p>
          <p className="mb-4 text-[13px] text-muted-foreground">
            Peace of Mine tracks your specific products and checks them against official recall databases regularly, so you can hear about a recall sooner than you might otherwise — even for things you bought second-hand. Because official sources update on their own schedule, there's always some gap between a recall being issued and it reaching you here.
          </p>
          <Link
            to="/auth"
            className="inline-block rounded-full bg-primary px-6 py-2.5 font-body text-[13px] font-semibold text-primary-foreground no-underline transition-colors hover:bg-primary/90"
          >
            Try it free — no credit card needed
          </Link>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
          Data sourced from the U.S. Consumer Product Safety Commission ·{" "}
          <a href="https://cpsc.gov/Recalls" target="_blank" rel="noopener noreferrer" className="text-muted-foreground">
            cpsc.gov/Recalls
          </a>
        </p>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
          <Link to="/terms" className="text-muted-foreground">
            Terms &amp; disclaimers
          </Link>
        </p>
      </main>
    </div>
  );
}

function RecallCard({ recall }: { recall: CpscRecall }) {
  const description = recall.Products?.map((p) => p.Description || p.Name).filter(Boolean).join("; ");
  const dateLabel = recall.RecallDate
    ? new Date(recall.RecallDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;
  return (
    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-sm font-semibold leading-snug text-foreground">{recall.RecallHeading}</p>
          {dateLabel && <p className="mb-1.5 text-xs text-muted-foreground">{dateLabel}</p>}
          {description && (
            <p className="mb-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{description}</p>
          )}
          {recall.URL && (
            <a
              href={recall.URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-destructive underline"
            >
              Full recall details <ArrowUpRight size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
