import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Package, Plus, AlertTriangle, ScanLine } from "lucide-react";
import { CribIllustration } from "@/components/EmptyIllustration";
import { BottomNav } from "@/components/BottomNav";
import { ChildSwitcher } from "@/components/ChildSwitcher";
import { Button } from "@/components/ui/button";
import { useActiveChild } from "@/hooks/useActiveChild";
import { ProductInfoFooter } from "@/components/ProductInfoFooter";

import { formatMonthYear, isOverdue } from "@/lib/predictions";
import { CATEGORY_BY_KEY, categoryFromLabel, type CategoryKey } from "@/lib/productCategories";
import { isOnboardingPlaceholderProduct } from "@/lib/onboardingPlaceholderProduct";

export const Route = createFileRoute("/_authenticated/products")({
  ssr: false,
  component: ProductsPage,
  head: () => ({ meta: [{ title: "Products — Peace of Mine" }] }),
});

type Product = {
  id: string;
  name: string;
  brand: string | null;
  size: string | null;
  category: string | null;
  added_at: string | null;
  replace_at: string | null;
  predicted_replacement_date: string | null;
  recalled: boolean;
  child_id: string | null;
  // Fetched only to run isOnboardingPlaceholderProduct() below, not
  // rendered directly.
  model: string | null;
  barcode: string | null;
  notes: string | null;
  purchased_at: string | null;
}; type _PhotoRemoved = never;

function ProductsPage() {
  const navigate = useNavigate();
  const { activeChildId } = useActiveChild();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let q: any = supabase
        .from("products")
        .select(
          "id, name, brand, size, category, added_at, replace_at, predicted_replacement_date, recalled, child_id, model, barcode, notes, purchased_at",
        )
        .order("created_at", { ascending: false });
      if (activeChildId) q = q.or(`child_id.eq.${activeChildId},child_id.is.null`);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) toast.error(error.message);
      else {
        // Client-side safety net for a since-fixed onboarding bug that
        // inserted a placeholder row per selected category directly into
        // `products` (see supabase/migrations/20260717000000_
        // category_watchlist_fix_onboarding_products.sql, which cleans
        // these up server-side) — filtered here too so the list is
        // correct immediately, independent of whether that migration has
        // reached this database yet.
        const rows = (data ?? []) as Product[];
        setProducts(rows.filter((p) => !isOnboardingPlaceholderProduct(p)));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeChildId]);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 animate-fade-in">
      <header className="px-5 pt-10 pb-6 sm:px-6">
        <div className="mx-auto flex max-w-md items-end justify-between">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Your baby gear
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Products</h1>
          </div>
          <div className="flex items-center gap-2">
            <ChildSwitcher />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full px-3 font-body text-xs font-semibold"
              onClick={() => navigate({ to: "/products/scan" })}
            >
              <ScanLine className="mr-1 h-3.5 w-3.5" /> Scan
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-full bg-primary px-4 font-body text-xs font-semibold"
              onClick={() => navigate({ to: "/products/new" })}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md">
          {loading ? (
            <div className="flex justify-center pt-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <EmptyProducts onAdd={() => navigate({ to: "/products/new" })} />
          ) : (
            <>
              <ul className="space-y-3">
                {products.map((p) => <ProductCard key={p.id} product={p} />)}
              </ul>
              <ProductInfoFooter className="mt-5 text-center" />
            </>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const cat = categoryFromLabel(product.category) ?? CATEGORY_BY_KEY.other;
  const meta = [product.brand, product.size, cat?.label ?? product.category].filter(Boolean).join(" · ");

  const replaceDate = product.predicted_replacement_date ?? product.replace_at;

  return (
    <li>
      <Link
        to="/products/$id"
        params={{ id: product.id }}
        className="block rounded-3xl border border-border/60 bg-card p-4 hover:border-primary/40 transition-colors"
      >
        {product.recalled && (
          <div className="mb-3 flex items-center gap-2 rounded-2xl bg-destructive/15 px-3 py-2 font-body text-xs font-semibold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> RECALL — tap to review
          </div>
        )}
        <div className="flex items-start gap-3">
          <CategoryBadge
            icon={cat.icon}
            illustration={cat.illustration}
            className="h-14 w-14"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-semibold tracking-tight">{product.name}</p>
            {meta && <p className="mt-0.5 truncate font-body text-xs text-muted-foreground">{meta}</p>}
            <div className="mt-2 flex flex-wrap gap-2 font-body text-[11px]">
              {replaceDate && (
                <span
                  className={
                    isOverdue(replaceDate)
                      ? "rounded-full bg-destructive/15 px-2.5 py-1 font-semibold text-destructive"
                      : "rounded-full bg-sand/60 px-2.5 py-1 text-foreground/70"
                  }
                >
                  {isOverdue(replaceDate) ? "Replace overdue" : "Replace"} ·{" "}
                  {formatMonthYear(replaceDate)}
                </span>
              )}
              {!replaceDate && (
                <span className="font-body text-[11px] text-muted-foreground/70">Fetching guidelines…</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

function EmptyProducts({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-12 text-center animate-scale-in">
      <CribIllustration className="mx-auto mb-2 h-24 w-24" />
      <p className="font-display text-lg font-semibold tracking-tight">Your gear lives here</p>
      <p className="mx-auto mt-1.5 max-w-xs font-body text-sm text-muted-foreground">
        Add the products you use and we'll quietly watch for recalls and let you know when to replace them.
      </p>
      <Button
        type="button"
        className="mt-5 rounded-full bg-primary px-5 font-body text-xs font-semibold"
        onClick={onAdd}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> Add your first product
      </Button>
    </div>
  );
}

// satisfy unused import warning when type-only used
export type _CK = CategoryKey;
