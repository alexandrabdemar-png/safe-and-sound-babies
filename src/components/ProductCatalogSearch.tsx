import { useEffect, useRef, useState } from "react";
import { Loader2, PackageSearch, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { searchProductCatalog, type CatalogSearchResult } from "@/lib/searchProductCatalog";

const DEBOUNCE_MS = 350;

type Props = {
  onPick: (result: CatalogSearchResult) => void;
};

/**
 * Search bar — separate from barcode scanning. Searches the shared
 * product_catalog cache (name/brand) plus a live UPCitemdb keyword search,
 * merged into one list. Picking a result hands it to the caller, which
 * (on this app's /products/new page) prefills the manual-add form so the
 * parent still confirms/edits details before saving — this reuses the
 * existing, already-tested save path instead of a second one.
 */
export function ProductCatalogSearch({ onPick }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a slower earlier search overwriting a faster later one.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      searchProductCatalog(trimmed, { supabase, fetchImpl: fetch })
        .then((r) => {
          if (requestId !== requestIdRef.current) return;
          setResults(r);
          setSearched(true);
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setResults([]);
          setSearched(true);
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search product name or brand…"
          className="h-12 rounded-2xl bg-card pl-11 pr-4 font-body text-base"
          maxLength={120}
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <button
              key={r.barcode ?? `${r.name}-${r.brand ?? ""}-${i}`}
              type="button"
              onClick={() => onPick(r)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40"
            >
              {r.imageUrl ? (
                <img
                  src={r.imageUrl}
                  alt=""
                  className="h-12 w-12 rounded-xl object-cover border border-border"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <PackageSearch className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-semibold text-foreground">{r.name}</p>
                <p className="truncate font-body text-xs text-muted-foreground">
                  {[r.brand, r.category].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <p className="font-body text-xs text-muted-foreground">
          No matches yet — try a different search, or fill in the details manually below.
        </p>
      )}
    </div>
  );
}
