import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Search, Loader2, AlertTriangle, ShieldCheck, ExternalLink, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { checkRecallsForProduct, recallFallbackUrl, recallSourceLabel, type RecallHit } from "@/lib/recallCheck";

export const Route = createFileRoute("/recall-search")({
  ssr: false,
  component: PublicRecallSearchPage,
  head: () => ({
    meta: [
      { title: "Recall Search — Peace of Mine" },
      {
        name: "description",
        content:
          "Free public recall lookup for baby and kids products — no account required. Search a product name to check CPSC, FDA, and other official recall databases.",
      },
      { property: "og:title", content: "Recall Search — Peace of Mine" },
      {
        property: "og:description",
        content: "Free public recall lookup for baby and kids products — no account required.",
      },
      { property: "og:url", content: "https://peace-of-mine.lovable.app/recall-search" },
    ],
    links: [{ rel: "canonical", href: "https://peace-of-mine.lovable.app/recall-search" }],
  }),
});

function PublicRecallSearchPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [hit, setHit] = useState<RecallHit | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runCheck() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      const result = await checkRecallsForProduct(q);
      setHit(result);
    } catch {
      setHit(null);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setQuery("");
    setSearched(false);
    setHit(null);
    inputRef.current?.focus();
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 px-5 py-10 sm:px-6">
        <div className="mx-auto max-w-md">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Free &amp; public — no account needed
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Recall Search
          </h1>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            Search a baby or kids product name to check it against CPSC, FDA, and other official
            recall databases. Built for pediatricians, daycares, and anyone else who needs to look
            up a recall on the spot — no sign-up, no child profile required.
          </p>

          <div className="mt-6 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runCheck();
                  }
                }}
                placeholder="e.g. Fisher-Price Rock 'n Play"
                className="h-12 rounded-2xl bg-card pl-9 pr-9 font-body text-base"
                maxLength={120}
              />
              {query && (
                <button
                  type="button"
                  onClick={clear}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              type="button"
              onClick={runCheck}
              disabled={loading || !query.trim()}
              className="h-12 rounded-2xl px-5 font-body text-sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
            </Button>
          </div>

          {loading && (
            <div className="mt-4 flex items-center gap-2 font-body text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking official recall databases…
            </div>
          )}

          {searched && !loading && !hit && (
            <div className="mt-4 flex items-start gap-3 rounded-3xl border border-primary/20 bg-primary/5 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-body text-sm font-semibold text-foreground">No official recalls found</p>
                <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
                  No matching recalls for "{query}" in the databases we check. This isn't a guarantee the
                  exact model is unaffected — always verify with the manufacturer or search directly at{" "}
                  <a
                    href="https://cpsc.gov/Recalls"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-foreground underline underline-offset-2"
                  >
                    cpsc.gov/Recalls
                  </a>
                  .
                </p>
              </div>
            </div>
          )}

          {searched && !loading && hit && (
            <div className="mt-4 rounded-3xl border border-destructive/30 bg-destructive/10 p-4">
              <div className="flex items-center gap-2 font-body text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" /> Potential Recall Match
              </div>
              <p className="mt-2 font-body text-sm font-semibold text-foreground">{hit.title}</p>
              <p className="mt-1 font-body text-xs leading-relaxed text-destructive/90">{hit.reason}</p>
              {hit.recallDate && (
                <p className="mt-2 font-body text-[11px] text-muted-foreground">Recall date: {hit.recallDate}</p>
              )}
              <a
                href={hit.url || recallFallbackUrl(hit.title)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 font-body text-xs font-semibold text-destructive underline underline-offset-2"
              >
                View official recall notice <ExternalLink className="h-3 w-3" />
              </a>
              <p className="mt-2 font-body text-[11px] text-muted-foreground">Source: {recallSourceLabel(hit)}</p>
            </div>
          )}

          <p className="mt-6 font-body text-[11px] leading-relaxed text-muted-foreground">
            This tool checks product names against official CPSC and FDA recall data plus a small
            manually-curated list — it's a starting point, not a certified affected-unit lookup.
            Results are only as current as the last sync and can miss recalls issued very recently
            or announced only through other channels. Always verify with the manufacturer or the
            official government source before relying on the result.
          </p>

          <div className="mt-8 rounded-2xl border border-border/60 bg-card p-4">
            <p className="font-body text-sm font-semibold text-foreground">
              Tracking products for a specific child?
            </p>
            <p className="mt-1 font-body text-xs text-muted-foreground">
              Peace of Mine can watch your saved products for new recalls automatically and time
              replacement/size-up reminders to your child's age.
            </p>
            <Link
              to="/auth"
              className="mt-3 inline-flex items-center gap-1.5 font-body text-xs font-semibold text-primary underline underline-offset-2"
            >
              Create a free account
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
