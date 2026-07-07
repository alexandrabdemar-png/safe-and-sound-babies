import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, Search, Loader2, AlertTriangle, ShieldCheck, ExternalLink, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { checkRecallsForProduct, recallFallbackUrl, recallSourceLabel, type RecallHit } from "@/lib/recallCheck";
import { ProductInfoFooter } from "@/components/ProductInfoFooter";

export const Route = createFileRoute("/_authenticated/registry-check")({
  ssr: false,
  component: RegistryCheckPage,
  head: () => ({ meta: [{ title: "Registry Check — Peace of Mine" }] }),
});

function RegistryCheckPage() {
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
    <div className="flex min-h-screen flex-col bg-background pb-16">
      <header className="px-5 pt-8 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full font-body text-xs">
            <Link to="/checklists"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Checklists</Link>
          </Button>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Registry Check</h1>
          <p className="mt-1.5 font-body text-sm text-muted-foreground">
            Search a product name to check for official recalls before you add it to your registry.
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-4">
          <div className="flex gap-2">
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
            <div className="flex items-center gap-2 py-2 font-body text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking official recall databases…
            </div>
          )}

          {searched && !loading && !hit && (
            <div className="flex items-start gap-3 rounded-3xl border border-primary/20 bg-primary/5 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-body text-sm font-semibold text-foreground">No official recalls found</p>
                <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
                  No matching recalls for "{query}" in the databases we check. This isn't a guarantee the exact
                  model is unaffected — always verify with the manufacturer before purchasing.
                </p>
              </div>
            </div>
          )}

          {searched && !loading && hit && (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-4">
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

          <ProductInfoFooter className="pt-2 text-center" />
        </div>
      </main>
    </div>
  );
}
