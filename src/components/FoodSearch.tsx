import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { searchPackagedFoods, type FoodSearchHit } from "@/lib/foodSearch.functions";
import { rankFoodHits, splitBrandFromQuery } from "@/lib/foodSearchMatch";

/** Common fresh / homemade foods — never recall-matched. */
const COMMON_FOODS = [
  "Avocado",
  "Banana",
  "Sweet potato",
  "Carrot",
  "Peas",
  "Butternut squash",
  "Apple",
  "Pear",
  "Oatmeal",
  "Rice cereal",
  "Yogurt",
  "Egg",
  "Peanut butter",
  "Broccoli",
  "Spinach",
  "Blueberries",
  "Mango",
  "Chicken",
  "Salmon",
  "Lentils",
  "Green beans",
  "Pumpkin",
  "Zucchini",
  "Tofu",
  "Cheese",
  "Strawberries",
  "Beef",
  "Quinoa",
];

export type FoodPick =
  | { kind: "fresh"; name: string }
  | { kind: "packaged"; name: string; brand: string | null; barcode: string | null }
  /** Exactly what the parent typed — split into brand + name when it starts with a known brand. */
  | { kind: "typed"; name: string; brand: string | null };

/**
 * Search box for the Food Log. The food databases don't have every product
 * (or every spelling), so the parent's full typed text is always offered as
 * the first option — they're never stuck with a brand-only match.
 */
export function FoodSearch({
  onPick,
  knownBrands = [],
}: {
  onPick: (p: FoodPick) => void;
  /** Brands already in this child's log, used to split "Brand Product" typed text. */
  knownBrands?: (string | null)[];
}) {
  const search = useServerFn(searchPackagedFoods);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoodSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const trimmed = q.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      search({ data: { query: trimmed } })
        .then((r) => {
          if (cancelled) return;
          setResults(rankFoodHits(trimmed, r, 8));
        })
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed, search]);

  const fresh =
    trimmed.length >= 1
      ? COMMON_FOODS.filter((f) => f.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 5)
      : [];

  const typed =
    trimmed.length >= 2
      ? splitBrandFromQuery(trimmed, [...knownBrands, ...results.map((r) => r.brand)])
      : null;
  const typedMatchesFresh = fresh.some((f) => f.toLowerCase() === trimmed.toLowerCase());

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
          onKeyDown={(e) => {
            if (e.key === "Enter" && typed) {
              e.preventDefault();
              pick({ kind: "typed", ...typed });
            }
          }}
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          placeholder="Brand + full product name, e.g. Once Upon a Farm Tractor Wheels"
          className="w-full rounded-xl border border-border/60 bg-background py-2 pl-8 pr-8 font-body text-sm outline-none focus:border-primary"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {(typed || fresh.length > 0 || results.length > 0) && (
        <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-border/60 bg-background divide-y divide-border/40">
          {typed && !typedMatchesFresh && (
            <button
              type="button"
              onClick={() => pick({ kind: "typed", ...typed })}
              className="block w-full px-3 py-2 text-left font-body text-sm hover:bg-muted"
            >
              Use “<span className="font-semibold">{trimmed}</span>”
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {typed.brand
                  ? `Brand: ${typed.brand} · Product: ${typed.name}`
                  : "Fills in the food name — add the brand below if it's packaged"}
              </span>
            </button>
          )}
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
              onClick={() => pick({ kind: "packaged", ...r })}
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
          No database match — tap “Use” above to keep exactly what you typed, or scan the package
          for the most accurate recall checks.
        </p>
      )}
    </div>
  );
}
