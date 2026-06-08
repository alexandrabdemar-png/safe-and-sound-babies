import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Package, Plus, AlertTriangle, ScanLine } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { ChildSwitcher } from "@/components/ChildSwitcher";
import { Button } from "@/components/ui/button";
import { useActiveChild } from "@/hooks/useActiveChild";
import { usePhotoUrl } from "@/components/PhotoUpload";

export const Route = createFileRoute("/_authenticated/products")({
  component: ProductsPage,
  head: () => ({ meta: [{ title: "Products — Safe & Sound" }] }),
});

type Product = {
  id: string;
  name: string;
  brand: string | null;
  size: string | null;
  category: string | null;
  replace_at: string | null;
  next_size_at: string | null;
  recalled: boolean;
  photo_url: string | null;
  child_id: string | null;
};

function fmt(d: string | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function ProductsPage() {
  const { activeChildId } = useActiveChild();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let q: any = supabase
        .from("products")
        .select("id, name, brand, size, category, replace_at, next_size_at, recalled, photo_url, child_id")
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
    <div className="flex min-h-screen flex-col bg-background pb-28">
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
            <Button asChild size="sm" className="rounded-full bg-primary px-4 font-body text-xs font-semibold">
              <Link to="/products/new"><Plus className="mr-1 h-3.5 w-3.5" /> Add</Link>
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
            <EmptyProducts />
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
  const meta = [product.brand, product.size, product.category].filter(Boolean).join(" · ");
  const photoUrl = usePhotoUrl(product.photo_url);
  return (
    <li className="rounded-3xl border border-border/60 bg-card p-4">
      <div className="flex items-start gap-3">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-sand/50 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-accent" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold tracking-tight">{product.name}</p>
              {meta && <p className="mt-0.5 truncate font-body text-xs text-muted-foreground">{meta}</p>}
            </div>
            {product.recalled && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-1 font-body text-[11px] font-semibold text-destructive">
                <AlertTriangle className="h-3 w-3" /> Recalled
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 font-body text-[11px]">
            {product.replace_at && (
              <span className="rounded-full bg-sand/60 px-2.5 py-1 text-foreground/70">
                Replace · {fmt(product.replace_at)}
              </span>
            )}
            {product.next_size_at && (
              <span className="rounded-full bg-sand/60 px-2.5 py-1 text-foreground/70">
                Size up · {fmt(product.next_size_at)}
              </span>
            )}
            {!product.replace_at && !product.next_size_at && (
              <span className="font-body text-[11px] text-muted-foreground/70">No reminders set</span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function EmptyProducts() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sand/50 text-accent">
        <Package className="h-5 w-5" />
      </div>
      <p className="font-display text-lg font-semibold tracking-tight">No products yet</p>
      <p className="mx-auto mt-1 max-w-xs font-body text-sm text-muted-foreground">
        Add the gear you use — car seats, swaddles, pacifiers — and we'll keep an eye out for recalls and replacements.
      </p>
      <Button asChild className="mt-5 rounded-full bg-primary px-5 font-body text-xs font-semibold">
        <Link to="/products/new"><Plus className="mr-1 h-3.5 w-3.5" /> Add your first product</Link>
      </Button>
    </div>
  );
}
