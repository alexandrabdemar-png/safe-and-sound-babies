import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft, ArrowUpRight, ExternalLink, Gift, Loader2, Search,
  ShieldAlert, ShieldCheck, ShieldQuestion, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { searchCpsc, type CpscRecall } from "@/lib/cpscSearch";

export const Route = createFileRoute("/_authenticated/registry-check")({
  ssr: false,
  component: RegistryCheckPage,
  head: () => ({ meta: [{ title: "Registry Safety Check — Safe & Sound" }] }),
});

// Extract a usable product name from a URL by taking the last meaningful path segment
function extractNameFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    // Try common product URL patterns: /dp/ASIN, /product/slug, /p/slug
    const parts = url.pathname.split("/").filter(Boolean);
    // Skip common platform prefixes
    const skip = new Set(["dp", "product", "products", "p", "ip", "item", "i", "buy", "shop", "store", "catalog"]);
    const meaningful = parts.filter(
      (p) => !skip.has(p.toLowerCase()) && isNaN(Number(p)) && p.length > 3 && !/^[A-Z0-9]{8,}$/.test(p)
    );
    if (meaningful.length === 0) return null;
    // Decode and clean the last meaningful segment
    return decodeURIComponent(meaningful[meaningful.length - 1])
      .replace(/[-_+]/g, " ")
      .replace(/\.(html|htm|php|aspx)$/i, "")
      .trim();
  } catch {
    return null;
  }
}

function looksLikeUrl(value: string): boolean {
  return /^(https?:\/\/|www\.)/i.test(value.trim()) || /\.(com|co|org|net|gov|io)(\/?|\/[^\s]+)/i.test(value.trim());
}

function RegistryCheckPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recalls, setRecalls] = useState<CpscRecall[]>([]);
  const [resolvedQuery, setResolvedQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runCheck() {
    const raw = input.trim();
    if (!raw) return;

    let query = raw;
    let resolved: string | null = null;

    if (looksLikeUrl(raw)) {
      const extracted = extractNameFromUrl(raw);
      if (extracted) {
        query = extracted;
        resolved = extracted;
      }
    }

    setLoading(true);
    setSearched(false);
    setError(null);
    setRecalls([]);
    setResolvedQuery(resolved);

    try {
      const found = await searchCpsc(query);
      setRecalls(found);
      setSearched(true);
    } catch {
      setError("Couldn't reach the CPSC database right now. Try again or check cpsc.gov/Recalls manually.");
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setInput(""); setRecalls([]); setSearched(false);
    setError(null); setResolvedQuery(null);
  }

  const verdict: "safe" | "unsafe" | null = searched && !error
    ? recalls.length > 0 ? "unsafe" : "safe"
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 animate-fade-in">
      <header className="px-5 pt-8 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full font-body text-xs">
            <Link to="/home"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Home</Link>
          </Button>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Gift className="h-4.5 w-4.5" />
            </span>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">Registry Safety Check</h1>
              <p className="font-body text-xs text-muted-foreground">Check a product before adding it to your registry</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-4">
          <p className="font-body text-sm text-muted-foreground">
            Paste a product name or URL from any baby registry — Amazon, Buy Buy Baby, Target, Babylist — and we'll check the CPSC database for active recalls before you add it.
          </p>

          {/* Input */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {looksLikeUrl(input) ? <ExternalLink className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </div>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runCheck(); } }}
              placeholder="Product name or paste a URL…"
              className="w-full h-12 rounded-2xl border border-input bg-card pl-9 pr-9 font-body text-base focus:outline-none focus:ring-2 focus:ring-ring"
              maxLength={500}
            />
            {input && (
              <button type="button" onClick={clear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button
            type="button"
            onClick={runCheck}
            disabled={loading || !input.trim()}
            className="w-full h-12 rounded-2xl bg-primary font-body text-sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check for recalls"}
          </Button>

          {resolvedQuery && (
            <p className="font-body text-xs text-muted-foreground">
              URL resolved to: <span className="font-semibold text-foreground">"{resolvedQuery}"</span>
            </p>
          )}

          {loading && (
            <div className="flex items-center gap-2 py-4 font-body text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking CPSC recall database…
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 font-body text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Verdict */}
          {verdict === "unsafe" && (
            <div className="rounded-3xl border-2 border-destructive/40 px-5 py-5 animate-scale-in" style={{ backgroundColor: "rgba(185,28,28,0.05)" }}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                  <ShieldAlert className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-display text-xl font-semibold text-destructive">Don't add this to your registry</p>
                  <p className="font-body text-xs text-destructive/80">
                    {recalls.length} active recall{recalls.length !== 1 ? "s" : ""} found in the CPSC database
                  </p>
                </div>
              </div>
            </div>
          )}

          {verdict === "safe" && (
            <div className="rounded-3xl border-2 border-primary/30 bg-primary/5 px-5 py-5 animate-scale-in">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <ShieldCheck className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-display text-xl font-semibold text-primary">Looks good to add</p>
                  <p className="font-body text-xs text-primary/70">No recalls found in the CPSC database for this search</p>
                </div>
              </div>
              <p className="mt-3 font-body text-xs text-muted-foreground">
                Always verify at{" "}
                <a href="https://cpsc.gov/Recalls" target="_blank" rel="noopener noreferrer"
                  className="font-semibold underline underline-offset-2">cpsc.gov/Recalls</a>
                {" "}and register your product after purchase so you'll be notified of future recalls.
              </p>
            </div>
          )}

          {/* Safety note shown before searching */}
          {!searched && !loading && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4">
              <div className="flex items-start gap-2">
                <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-body text-sm font-semibold">Pro tip: register every product you receive</p>
                  <p className="mt-0.5 font-body text-xs text-muted-foreground">
                    Product registration ensures manufacturers can reach you directly if a recall is issued. Always register at the brand's website or at cpsc.gov after receiving a gift.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recall cards */}
          {searched && recalls.length > 0 && (
            <div className="space-y-3">
              {recalls.map((r) => (
                <RecallCard key={r.RecallID} recall={r} />
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-border/40 bg-muted/30 px-4 py-3 font-body text-xs text-muted-foreground">
            Data from the U.S. Consumer Product Safety Commission. A clean result doesn't guarantee the product has never been recalled — always verify at{" "}
            <a href="https://cpsc.gov/Recalls" target="_blank" rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2">cpsc.gov/Recalls</a>.
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
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4 space-y-2">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-semibold leading-snug">{recall.RecallHeading}</p>
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
    </div>
  );
}
