import { createFileRoute, Link } from "@tanstack/react-router";
import React, { Suspense, useState } from "react";
import {
  ArrowLeft, Loader2, ScanLine, Search, ShieldAlert, ShieldCheck,
  ShieldQuestion, X, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { searchCpsc, searchFdaRecalls, isFoodRelated, type CpscRecall, type FdaRecall } from "@/lib/cpscSearch";

export const Route = createFileRoute("/_authenticated/handmedown")({
  ssr: false,
  component: HandmedownPage,
  head: () => ({ meta: [{ title: "Hand-Me-Down Checker — Peace of Mine" }] }),
});

const BarcodeScanner = React.lazy(() =>
  import("@/components/BarcodeScanner").then((m) => ({ default: m.BarcodeScanner }))
);

type ExpiryRule = {
  keywords: string[];
  years: number;
  label: string;
  reason: string;
};

const EXPIRY_RULES: ExpiryRule[] = [
  {
    keywords: ["car seat", "carseat", "infant seat", "convertible seat", "booster"],
    years: 6,
    label: "car seat",
    reason:
      "Car seats expire 6–10 years from manufacture (check the label) due to plastic degradation, evolving crash-test standards, and parts that can no longer be serviced or replaced.",
  },
  {
    keywords: ["crib", "bassinet", "cradle", "co-sleeper", "bedside sleeper"],
    years: 10,
    label: "crib/bassinet",
    reason:
      "Cribs and bassinets should be replaced after 10 years or if any hardware is missing, cracked, or damaged. Older models may not meet current CPSC safety standards.",
  },
  {
    keywords: ["stroller", "pram", "travel system"],
    years: 5,
    label: "stroller",
    reason:
      "Strollers have a recommended lifespan of 5 years — plastic joints, fabric harnesses, and metal frames weaken over time and safety standards evolve.",
  },
  {
    keywords: ["breast pump"],
    years: 1,
    label: "breast pump",
    reason:
      "Breast pumps are designed for a single user only. Internal tubing and membranes can harbor milk residue and bacteria that cannot be fully sterilized.",
  },
  {
    keywords: ["baby bottle", "feeding bottle", "bottle nipple", "sippy cup"],
    years: 0.5,
    label: "bottles/nipples",
    reason:
      "Baby bottles and nipples should be replaced every 4–6 months. Micro-scratches trap bacteria, and nipples weaken over time creating a choking risk.",
  },
  {
    keywords: ["bike helmet", "cycling helmet", "infant helmet"],
    years: 5,
    label: "helmet",
    reason:
      "Helmets should be replaced every 5 years or after any impact — protective foam degrades even without visible damage.",
  },
  {
    keywords: ["formula", "baby food", "puree", "infant cereal"],
    years: 0,
    label: "formula/food",
    reason:
      "Baby formula and food have expiration dates printed on the packaging. Never use expired formula or food — nutrients degrade and harmful bacteria can grow.",
  },
];

function checkExpiry(
  name: string,
  yearMade: number | null
): { expired: boolean; caution: boolean; rule: ExpiryRule; ageYears: number | null } | null {
  const lower = name.toLowerCase();
  for (const rule of EXPIRY_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) {
      if (rule.years === 0) {
        return { expired: true, caution: false, rule, ageYears: null };
      }
      if (yearMade !== null) {
        const ageYears = new Date().getFullYear() - yearMade;
        return {
          expired: ageYears >= rule.years,
          caution: !( ageYears >= rule.years) && ageYears >= rule.years * 0.8,
          rule,
          ageYears,
        };
      }
      return { expired: false, caution: true, rule, ageYears: null };
    }
  }
  return null;
}

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

type Verdict = "safe" | "unsafe" | "caution" | null;

function HandmedownPage() {
  const [query, setQuery] = useState("");
  const [yearStr, setYearStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recalls, setRecalls] = useState<CpscRecall[]>([]);
  const [fdaRecalls, setFdaRecalls] = useState<FdaRecall[]>([]);
  const [expiryResult, setExpiryResult] = useState<ReturnType<typeof checkExpiry>>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);

  async function runCheck(name: string) {
    const q = name.trim();
    if (!q) return;
    setLoading(true);
    setSearched(false);
    setError(null);
    setRecalls([]);
    setFdaRecalls([]);
    setExpiryResult(null);

    const yearNum = yearStr ? parseInt(yearStr, 10) : null;
    const validYear = yearNum && yearNum >= 1980 && yearNum <= new Date().getFullYear() ? yearNum : null;

    try {
      const cpscPromise = searchCpsc(q);
      const fdaPromise = isFoodRelated(q) ? searchFdaRecalls(q) : Promise.resolve([]);
      const [found, foundFda] = await Promise.all([cpscPromise, fdaPromise]);
      setRecalls(found);
      setFdaRecalls(foundFda);
      setExpiryResult(checkExpiry(q, validYear));
      setSearched(true);
    } catch {
      setError("Couldn't reach the CPSC database. Check your connection and try again.");
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
      const searchName = name ?? barcode;
      setQuery(searchName);
      if (name) setResolvedName(name);
      await runCheck(searchName);
    } catch {
      setError("Could not look up that barcode. Type the product name instead.");
      setSearched(true);
      setLoading(false);
    }
  }

  function clear() {
    setQuery(""); setYearStr(""); setRecalls([]); setSearched(false);
    setError(null); setResolvedName(null); setExpiryResult(null);
  }

  // Derive overall verdict
  let verdict: Verdict = null;
  const totalRecalls = recalls.length + fdaRecalls.length;
  if (searched && !error) {
    if (totalRecalls > 0 || expiryResult?.expired) {
      verdict = "unsafe";
    } else if (expiryResult?.caution) {
      verdict = "caution";
    } else if (totalRecalls === 0) {
      verdict = "safe";
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 animate-fade-in">
      <header className="px-5 pt-8 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full font-body text-xs">
            <Link to="/products"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Products</Link>
          </Button>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Hand-Me-Down Checker</h1>
          <p className="mt-1.5 font-body text-sm text-muted-foreground">
            Check a second-hand product for recalls, expiration, or known safety issues before using it.
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-4">
          {/* Product name */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runCheck(query); } }}
              placeholder="e.g. Chicco KeyFit 30, Fisher-Price Rock 'n Play…"
              className="h-12 rounded-2xl bg-card pl-9 pr-9 font-body text-base"
              maxLength={120}
            />
            {query && (
              <button type="button" onClick={clear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Year manufactured (optional) */}
          <div>
            <label className="mb-1.5 block font-body text-xs font-semibold text-muted-foreground">
              Year manufactured <span className="font-normal">(optional — helps check expiry)</span>
            </label>
            <Input
              value={yearStr}
              onChange={(e) => setYearStr(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder={`e.g. ${new Date().getFullYear() - 3}`}
              className="h-11 rounded-2xl bg-card font-body text-base"
              inputMode="numeric"
              maxLength={4}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => runCheck(query)}
              disabled={loading || !query.trim()}
              className="flex-1 h-12 rounded-2xl bg-primary font-body text-sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check this product"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setScannerOpen(true)}
              className="h-12 rounded-2xl font-body text-sm px-4"
            >
              <ScanLine className="h-4 w-4" />
            </Button>
          </div>

          {resolvedName && (
            <p className="font-body text-xs text-muted-foreground">
              Barcode resolved to: <span className="font-semibold text-foreground">{resolvedName}</span>
            </p>
          )}

          {loading && (
            <div className="flex items-center gap-2 py-4 font-body text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking recalls and safety records…
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 font-body text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Verdict banner */}
          {verdict === "unsafe" && (
            <div className="rounded-3xl border-2 border-destructive/40 bg-destructive/8 px-5 py-5 animate-scale-in" style={{ backgroundColor: "rgba(185,28,28,0.05)" }}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                  <ShieldAlert className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-display text-xl font-semibold text-destructive">Not safe to use</p>
                  <p className="font-body text-xs text-destructive/80">
                    {totalRecalls > 0 && expiryResult?.expired
                      ? "Active recall + expired product"
                      : totalRecalls > 0
                      ? `${totalRecalls} active recall${totalRecalls > 1 ? "s" : ""} found`
                      : "Product has expired its safe-use lifespan"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {verdict === "caution" && (
            <div className="rounded-3xl border-2 border-amber-400/40 bg-amber-50 px-5 py-5 animate-scale-in">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-700">
                  <ShieldQuestion className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-display text-xl font-semibold text-amber-800">Use with caution</p>
                  <p className="font-body text-xs text-amber-700">No recalls found — but verify the manufacture year</p>
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
                  <p className="font-display text-xl font-semibold text-primary">No issues found</p>
                  <p className="font-body text-xs text-primary/70">No recalls in the CPSC database for this search</p>
                </div>
              </div>
            </div>
          )}

          {/* Expiry detail */}
          {searched && expiryResult && (
            <div className={`rounded-2xl border px-4 py-4 ${expiryResult.expired ? "border-destructive/30 bg-destructive/5" : expiryResult.caution ? "border-amber-400/30 bg-amber-50" : "border-border/60 bg-card"}`}>
              <div className="flex items-start gap-2">
                <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${expiryResult.expired ? "text-destructive" : "text-amber-600"}`} />
                <div>
                  <p className="font-body text-sm font-semibold capitalize">
                    {expiryResult.rule.label} — {expiryResult.ageYears !== null
                      ? expiryResult.expired
                        ? `${expiryResult.ageYears} years old (expired after ${expiryResult.rule.years}y)`
                        : `${expiryResult.ageYears} years old — within ${expiryResult.rule.years}-year lifespan`
                      : `Expires after ${expiryResult.rule.years} year${expiryResult.rule.years !== 1 ? "s" : ""}`}
                  </p>
                  <p className="mt-1 font-body text-xs text-muted-foreground leading-relaxed">{expiryResult.rule.reason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Recall details */}
          {searched && totalRecalls > 0 && (
            <div className="space-y-3">
              <p className="font-body text-sm font-semibold text-destructive">
                {totalRecalls} active recall{totalRecalls !== 1 ? "s" : ""} found
              </p>
              {recalls.map((r) => (
                <RecallCard key={r.RecallID} recall={r} />
              ))}
              {fdaRecalls.map((r) => (
                <FdaRecallCard key={r.id} recall={r} />
              ))}
            </div>
          )}

          {/* No recalls message */}
          {searched && !error && totalRecalls < 3 && (
            <p className="font-body text-xs text-muted-foreground">
              No recalls found for this product — this is a good sign, but always check the CPSC website directly to be sure.{" "}
              <a href="https://www.cpsc.gov" target="_blank" rel="noopener noreferrer"
                className="font-semibold underline underline-offset-2">cpsc.gov</a>
            </p>
          )}

          <div className="rounded-2xl border border-border/40 bg-muted/30 px-4 py-3 font-body text-xs text-muted-foreground">
            Recall data from the U.S. Consumer Product Safety Commission. Expiration guidelines based on manufacturer and CPSC recommendations.
          </div>
        </div>
      </main>

      <Suspense fallback={null}>
        <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleBarcodeScan} />
      </Suspense>

      <BottomNav />
    </div>
  );
}

function FdaRecallCard({ recall }: { recall: FdaRecall }) {
  const dateLabel = recall.recallDate
    ? new Date(recall.recallDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4 space-y-2">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-semibold leading-snug">{recall.productDescription}</p>
          {dateLabel && <p className="mt-0.5 font-body text-xs text-muted-foreground">FDA · {dateLabel}</p>}
        </div>
      </div>
      {recall.reasonForRecall && (
        <p className="font-body text-xs text-muted-foreground leading-relaxed pl-10 line-clamp-3">{recall.reasonForRecall}</p>
      )}
      <div className="pl-10">
        <a href={recall.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-body text-xs font-semibold text-destructive underline underline-offset-2">
          View FDA recall details →
        </a>
      </div>
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
            View full recall details →
          </a>
        </div>
      )}
    </div>
  );
}
