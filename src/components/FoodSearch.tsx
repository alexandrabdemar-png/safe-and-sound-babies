import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { searchProductCatalog, type CatalogSearchResult } from "@/lib/searchProductCatalog";

/** Common fresh / homemade first foods — never recall-matched. */
const COMMON_FOODS = [
  "Avocado", "Banana", "Sweet potato", "Carrot", "Peas", "Butternut squash", "Apple",
  "Pear", "Oatmeal", "Rice cereal", "Yogurt", "Egg", "Peanut butter", "Broccoli",
  "Spinach", "Blueberries", "Mango", "Chicken", "Salmon", "Lentils", "Green beans",
  "Pumpkin", "Zucchini", "Tofu", "Cheese", "Strawberries", "Beef", "Quinoa",
];

export type FoodPick =
  | { kind: "fresh"; name: string }
  | { kind: "packaged"; name: string; brand: string | null; barcode: string | null };

export function FoodSearch({ onPick }: { onPick: (p: FoodPick) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const trimmed = q.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      searchProductCatalog(trimmed, { supabase: supabase as never, fetchImpl: fetch })
        .then((r) => !cancelled && setResults(r.slice(0, 8)))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed]);

  const fresh =
    trimmed.length >= 1
      ? COMMON_FOODS.filter((f) => f.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 5)
      : [];

  function pick(p: FoodPick) {
    onPick(p);
    setQ("");
    setResults([]);
  }

  return (
    <div className="mb-3">
      <label className="mb-1 block font-body text-xs text-muted-foreground">Search foods</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. banana, Happy Baby pouch, Gerber puffs"
          className="w-full rounded-xl border border-border/60 bg-background py-2 pl-8 pr-8 font-body text-sm outline-none focus:border-primary"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {(fresh.length > 0 || results.length > 0) && (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-background divide-y divide-border/40">
          {fresh.map((name) => (
            <button
              key={`f-${name}`}
              type="button"
              onClick={() => pick({ kind: "fresh", name })}
              className="block w-full px-3 py-2 text-left font-body text-sm hover:bg-muted"
            >
              {name}
              <span className="ml-2 text-[11px] text-muted-foreground">Fresh / homemade</span>
            </button>
          ))}
          {results.map((r, i) => (
            <button
              key={`p-${r.barcode ?? i}-${r.name}`}
              type="button"
              onClick={() =>
                pick({ kind: "packaged", name: r.name, brand: r.brand, barcode: r.barcode })
              }
              className="block w-full px-3 py-2 text-left font-body text-sm hover:bg-muted"
            >
              {r.name}
              <span className="ml-2 text-[11px] text-muted-foreground">
                {r.brand ? `${r.brand} · ` : ""}Packaged
              </span>
            </button>
          ))}
        </div>
      )}
      {trimmed.length >= 2 && !loading && fresh.length === 0 && results.length === 0 && (
        <p className="mt-1.5 font-body text-[11px] text-muted-foreground">
          No matches — type the name below, or scan the package.
        </p>
      )}
    </div>
  );
}
