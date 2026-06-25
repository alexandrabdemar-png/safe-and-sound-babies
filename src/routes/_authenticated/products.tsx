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

import { formatMonthYear, daysBetween } from "@/lib/predictions";
import { CATEGORY_BY_KEY, categoryFromLabel, type CategoryKey } from "@/lib/productCategories";

export const Route = createFileRoute("/_authenticated/products")({
  ssr: false,
  component: ProductsPage,
  head: () => ({ meta: [{ title: "Products — Safe & Sound" }] }),
});

type Product = {
  id: string;
  name: string;
  brand: string | null;
  size: string | null;
  category: string | null;
  added_at: string | null;
  replace_at: string | null;
  next_size_at: string | null;
  predicted_sizeup_date: string | null;
  predicted_replacement_date: string | null;
  recalled: boolean;
  child_id: string | null;
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
          "id, name, brand, size, category, added_at, replace_at, next_size_at, predicted_sizeup_date, predicted_replacement_date, recalled, child_id",
        )
        .order("created_at", { ascending: false });
      if (activeChildId) q = q.or(`child_id.eq.${activeChildId},child_id.is.null`);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) toast.error(error.message);
      else setProducts((data ?? []) as Product[]);
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
              onClick={() => navigate({ to: "/handmedown" })}
            >
              Hand-me-down?
            </Button>
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
            <ul className="space-y-3">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </ul>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const cat = categoryFromLabel(product.category);
  const Icon = cat?.icon ?? CATEGORY_BY_KEY.other.icon;
  const meta = [product.brand, product.size, cat?.label ?? product.category].filter(Boolean).join(" · ");

  const sizeUpDate = product.predicted_sizeup_date ?? product.next_size_at;
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
          <div className="h-14 w-14 rounded-xl bg-sand/50 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-semibold tracking-tight">{product.name}</p>
            {meta && <p className="mt-0.5 truncate font-body text-xs text-muted-foreground">{meta}</p>}
            <SizeTimeline addedAt={product.added_at} sizeUpDate={sizeUpDate} />
            <div className="mt-2 flex flex-wrap gap-2 font-body text-[11px]">
              {sizeUpDate && (
                <span className="rounded-full bg-sand/60 px-2.5 py-1 text-foreground/70">
                  Size-up · {formatMonthYear(sizeUpDate)}
                </span>
              )}
              {replaceDate && (
                <span className="rounded-full bg-sand/60 px-2.5 py-1 text-foreground/70">
                  Replace · {formatMonthYear(replaceDate)}
                </span>
              )}
              {!sizeUpDate && !replaceDate && (
                <span className="font-body text-[11px] text-muted-foreground/70">Fetching guidelines…</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

function SizeTimeline({ addedAt, sizeUpDate }: { addedAt: string | null; sizeUpDate: string | null }) {
  if (!addedAt || !sizeUpDate) return null;
  const start = new Date(addedAt);
  const end = new Date(sizeUpDate + "T00:00:00");
  const now = new Date();
  const total = Math.max(1, daysBetween(start, end));
  const elapsed = Math.max(0, Math.min(total, daysBetween(start, now)));
  const pct = Math.round((elapsed / total) * 100);
  const remaining = daysBetween(now, end);
  let barClass = "bg-emerald-500";
  if (remaining <= 14) barClass = "bg-destructive";
  else if (remaining <= 30) barClass = "bg-amber-500";
  return (
    <div className="mt-2.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${barClass} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EmptyProducts({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-12 text-center animate-scale-in">
      <CribIllustration className="mx-auto mb-2 h-24 w-24" />
      <p className="font-display text-lg font-semibold tracking-tight">Your gear lives here</p>
      <p className="mx-auto mt-1.5 max-w-xs font-body text-sm text-muted-foreground">
        Add the products you use and we'll quietly watch for recalls, let you know when to replace them, and flag when your little one is ready to size up.
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
