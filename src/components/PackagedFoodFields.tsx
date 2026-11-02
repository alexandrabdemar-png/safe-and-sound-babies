import { useEffect, useRef, useState, type RefObject } from "react";
import { Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { searchPackagedFoods, type FoodSearchHit } from "@/lib/foodSearch.functions";
import { COMMON_BABY_FOOD_BRANDS, tokens } from "@/lib/foodSearchMatch";

/** Brands whose words start with what's typed ("hap ba" → Happy Baby), best match first. */
export function matchBrands(typed: string, brands: string[], limit = 5): string[] {
  const q = tokens(typed);
  if (q.length === 0) return [];
  const scored: { b: string; s: number }[] = [];
  for (const b of brands) {
    const words = tokens(b);
    if (!q.every((t) => words.some((w) => w.startsWith(t)))) continue;
    // Prefer brands that start with the typed text, then shorter names.
    const s = (tokens(b).join(" ").startsWith(q.join(" ")) ? 0 : 100) + b.length;
    scored.push({ b, s });
  }
  return scored
    .sort((a, b) => a.s - b.s)
    .slice(0, limit)
    .map((x) => x.b);
}

/** Debounced packaged-food search; empty for queries under 2 characters. */
function useProductSearch(query: string, enabled: boolean) {
  const search = useServerFn(searchPackagedFoods);
  const [hits, setHits] = useState<FoodSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const q = query.trim();
  useEffect(() => {
    if (!enabled || q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      search({ data: { query: q } })
        .then((r) => !cancelled && setHits(r.slice(0, 6)))
        .catch(() => !cancelled && setHits([]))
        .finally(() => !cancelled && setLoading(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, enabled, search]);
  return { hits, loading };
}

const inputCls =
  "w-full rounded-xl border border-border/60 bg-background px-3 py-2 font-body text-sm outline-none focus:border-primary";
const listCls =
  "absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-background shadow-lg divide-y divide-border/40";
const rowCls = "block w-full px-3 py-2 text-left font-body text-sm hover:bg-muted";

/**
 * Brand (first) and Product name for a store-bought food, each with live
 * suggestions as the parent types: brands from their log + common baby-food
 * brands, and real products from the food databases for that brand. Picking
 * a product fills brand, name and barcode together. Free text always works —
 * suggestions never block typing the name exactly as printed.
 */
export function PackagedFoodFields({
  brand,
  onBrandChange,
  name,
  onNameChange,
  onPickProduct,
  knownBrands,
  brandInputRef,
}: {
  brand: string;
  onBrandChange: (v: string) => void;
  name: string;
  onNameChange: (v: string) => void;
  onPickProduct: (hit: FoodSearchHit) => void;
  knownBrands: (string | null)[];
  brandInputRef?: RefObject<HTMLInputElement | null>;
}) {
  const [focus, setFocus] = useState<"brand" | "name" | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const allBrands = [
    ...new Set(
      [...knownBrands, ...COMMON_BABY_FOOD_BRANDS].filter((b): b is string => !!b?.trim()),
    ),
  ];
  const brandMatches =
    focus === "brand"
      ? matchBrands(brand, allBrands).filter((b) => b.toLowerCase() !== brand.trim().toLowerCase())
      : [];

  // In the Brand box: products for what's typed so far. In the Product box:
  // products for "brand + product" so results stay within that brand.
  const query = focus === "name" ? `${brand} ${name}` : brand;
  const { hits, loading } = useProductSearch(query, focus !== null);

  function onFocus(f: "brand" | "name") {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setFocus(f);
  }
  // Delay so a tap on a suggestion lands before the list disappears.
  function onBlur() {
    blurTimer.current = setTimeout(() => setFocus(null), 200);
  }

  function pickBrand(b: string) {
    onBrandChange(b);
    setFocus("name");
    nameRef.current?.focus();
  }
  function pickProduct(h: FoodSearchHit) {
    onPickProduct(h);
    setFocus(null);
    (document.activeElement as HTMLElement | null)?.blur?.();
  }

  const showBrandList = focus === "brand" && (brandMatches.length > 0 || hits.length > 0);
  const showNameList = focus === "name" && hits.length > 0;

  return (
    <>
      <div className="relative">
        <label
          htmlFor="food-brand"
          className="mb-1 block font-body text-xs font-semibold text-foreground"
        >
          Brand <span className="font-normal text-destructive">*</span>
        </label>
        <input
          id="food-brand"
          ref={brandInputRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          enterKeyHint="next"
          placeholder="Start typing, e.g. Happy Baby"
          value={brand}
          onChange={(e) => onBrandChange(e.target.value)}
          onFocus={() => onFocus("brand")}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              nameRef.current?.focus();
            }
          }}
          className={inputCls}
        />
        {loading && focus === "brand" && (
          <Loader2 className="absolute right-3 top-[34px] h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {showBrandList && (
          <div className={listCls}>
            {brandMatches.map((b) => (
              <button
                key={`b-${b}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickBrand(b)}
                className={rowCls}
              >
                {b}
                <span className="ml-2 text-[11px] text-muted-foreground">Brand</span>
              </button>
            ))}
            {hits.map((h, i) => (
              <button
                key={`p-${h.barcode ?? i}-${h.name}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickProduct(h)}
                className={rowCls}
              >
                {h.name}
                <span className="ml-2 text-[11px] text-muted-foreground">
                  {h.brand ? `${h.brand} · ` : ""}Product
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <label
          htmlFor="food-product"
          className="mb-1 block font-body text-xs font-semibold text-foreground"
        >
          Product name <span className="font-normal text-destructive">*</span>
        </label>
        <input
          id="food-product"
          ref={nameRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          enterKeyHint="done"
          placeholder="Full name on the package, incl. flavor"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onFocus={() => onFocus("name")}
          onBlur={onBlur}
          className={inputCls}
        />
        {loading && focus === "name" && (
          <Loader2 className="absolute right-3 top-[34px] h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {showNameList && (
          <div className={listCls}>
            {hits.map((h, i) => (
              <button
                key={`n-${h.barcode ?? i}-${h.name}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickProduct(h)}
                className={rowCls}
              >
                {h.name}
                <span className="ml-2 text-[11px] text-muted-foreground">
                  {h.brand ?? "Product"}
                </span>
              </button>
            ))}
            <p className="px-3 py-2 font-body text-[11px] text-muted-foreground">
              Not listed? Just keep typing the name exactly as printed.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
