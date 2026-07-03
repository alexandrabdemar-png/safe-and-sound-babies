import { createFileRoute, Link } from "@tanstack/react-router";
import React, { Suspense, useState } from "react";
import { ArrowLeft, Loader2, ScanLine, Search, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { searchCpsc, type CpscRecall } from "@/lib/cpscSearch";

export const Route = createFileRoute("/_authenticated/recall-check")({
  ssr: false,
  component: RecallCheckPage,
  head: () => ({ meta: [{ title: "Recall Check — Peace of Mine" }] }),
});

const BarcodeScanner = React.lazy(() =>
  import("@/components/BarcodeScanner").then((m) => ({ default: m.BarcodeScanner }))
);

async function lookupBarcode(barcode: string): Promise<string | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.product?.product_name || data?.product?.brands || null;
  } catch {
    return null;
  }
}

function RecallCheckPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<CpscRecall[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);

  async function runSearch(searchQuery: string) {
    const q = searchQuery.trim();
    if (!q) return;
    setLoading(true);
    setSearched(false);
    setError(null);
    setResults([]);
    try {
      const recalls = await searchCpsc(q);
      setResults(recalls);
      setSearched(true);
    } catch {
      setError("Could not reach the CPSC database. Please try again or visit cpsc.gov/Recalls.");
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleBarcodeScan(barcode: string) {
    setScannerOpen(false);
    setLoading(true);
    setSearched(false);
    setError(null);
    setResolvedName(null);
    try {
      const name = await lookupBarcode(barcode);
      if (name) {
        setQuery(name);
        setResolvedName(name);
        await runSearch(name);
      } else {
        // Fall back to searching with the raw barcode
        setQuery(barcode);
        await runSearch(barcode);
      }
    } catch {
      setError("Could not look up that barcode. Please type the product name instead.");
      setSearched(true);
      setLoading(false);
    }
  }

  function clear() {
    setQuery("");
    setResults([]);
    setSearched(false);
    setError(null);
    setResolvedName(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-5 pt-8 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full font-body text-xs">
            <Link to="/home">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Home
            </Link>
          </Button>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Recall Check</h1>
          <p className="mt-1.5 font-body text-sm text-muted-foreground">
            Search the CPSC database by product name or scan a barcode.
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-5">
          {/* Search row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(query); } }}
                placeholder="e.g. Chicco KeyFit, Fisher-Price Rock 'n Play…"
                className="h-12 rounded-2xl bg-card pl-9 pr-9 font-body text-base"
                maxLength={100}
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
              onClick={() => runSearch(query)}
              disabled={loading || !query.trim()}
              className="h-12 rounded-2xl px-4 bg-primary font-body text-sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>

          {/* Barcode scan button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setScannerOpen(true)}
            className="w-full h-11 rounded-2xl font-body text-sm gap-2"
          >
            <ScanLine className="h-4 w-4" />
            Scan barcode instead
          </Button>

          {resolvedName && (
            <p className="font-body text-xs text-muted-foreground">
              Barcode resolved to: <span className="font-semibold text-foreground">{resolvedName}</span>
            </p>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 py-4 font-body text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking CPSC database…
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 font-body text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Results */}
          {searched && !loading && !error && (
            <>
              {results.length === 0 ? (
                <div className="rounded-3xl border border-border/60 bg-card px-5 py-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <p className="font-display text-lg font-semibold tracking-tight">No recalls found</p>
                  <p className="mt-1.5 mx-auto max-w-xs font-body text-sm text-muted-foreground">
                    No baby or kids product recalls found for that search. Always verify at cpsc.gov/Recalls.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="font-body text-sm font-semibold text-destructive">
                    {results.length} recall{results.length !== 1 ? "s" : ""} found
                  </p>
                  {results.map((r) => (
                    <RecallCard key={r.RecallID} recall={r} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Disclaimer — always visible */}
          <div className="rounded-2xl border border-border/40 bg-muted/30 px-4 py-3 font-body text-xs text-muted-foreground">
            This searches the CPSC database. For the most up-to-date information, visit{" "}
            <a
              href="https://cpsc.gov/Recalls"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground underline underline-offset-2"
            >
              cpsc.gov/Recalls
            </a>
          </div>
        </div>
      </main>

      <Suspense fallback={null}>
        <BarcodeScanner
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onDetected={handleBarcodeScan}
        />
      </Suspense>

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
    <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-4 space-y-2">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-semibold leading-snug text-foreground">{recall.RecallHeading}</p>
          {dateLabel && (
            <p className="mt-0.5 font-body text-xs text-muted-foreground">{dateLabel}</p>
          )}
        </div>
      </div>
      {description && (
        <p className="font-body text-xs text-muted-foreground leading-relaxed pl-10 line-clamp-3">
          {description}
        </p>
      )}
      {recall.URL && (
        <div className="pl-10">
          <a
            href={recall.URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-body text-xs font-semibold text-destructive underline underline-offset-2"
          >
            View full recall details →
          </a>
        </div>
      )}
    </div>
  );
}
