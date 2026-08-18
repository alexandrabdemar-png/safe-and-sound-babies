import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ShieldCheck,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { CATEGORY_BY_KEY, categoryFromLabel } from "@/lib/productCategories";
import { formatMonthYear, daysBetween } from "@/lib/predictions";
import { lookupAndSaveGuidelines } from "@/lib/guidelines.functions";
import { ProductInfoFooter } from "@/components/ProductInfoFooter";
import {
  recallFallbackUrl,
  recallSourceLabel,
  formatRecallSyncNote,
  lotMatches,
  fetchProductDetailResilient,
} from "@/lib/recallCheck";

export const Route = createFileRoute("/_authenticated/products_/$id")({
  ssr: false,
  component: ProductDetailPage,
  head: () => ({ meta: [{ title: "Product — Peace of Mine" }] }),
});
type Product = {
  id: string;
  name: string;
  brand: string | null;
  size: string | null;
  category: string | null;
  added_at: string | null;
  purchased_at: string | null;
  predicted_replacement_date: string | null;
  recalled: boolean;
  child_id: string | null;
  recall_checked_at: string | null;
  lot_number: string | null;
};
type _u = never; // photo_url removed

type Guideline = {
  max_weight_lbs: number | null;
  max_height_inches: number | null;
  average_use_months: number | null;
  replacement_interval_months: number | null;
  size_up_trigger: string | null;
  replacement_trigger: string | null;
  source: string | null;
};

type RecallInfo = {
  title: string;
  url: string | null;
  description: string | null;
  recallDate: string | null;
  source: string | null;
  lotPattern: string | null;
};

function ProductDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [guideline, setGuideline] = useState<Guideline | null>(null);
  const [recalls, setRecalls] = useState<RecallInfo[]>([]);
  const [refreshingAI, setRefreshingAI] = useState(false);

  async function load() {
    setLoading(true);
    const { data: p, error } = await fetchProductDetailResilient(id);
    if (error || !p) {
      toast.error(error?.message ?? "Product not found");
      setLoading(false);
      return;
    }
    setProduct(p as unknown as Product);

    const [{ data: g }, { data: r }] = await Promise.all([
      supabase
        .from("product_guidelines")
        .select(
          "max_weight_lbs, max_height_inches, average_use_months, replacement_interval_months, size_up_trigger, replacement_trigger, source",
        )
        .eq("product_id", id)
        .maybeSingle(),
      // Not filtered by acknowledged — this page shows recall history for
      // the product regardless of whether the parent already dismissed it
      // from the Alerts feed; "acknowledged" only controls whether it's
      // still an actionable item there, not whether the article is visible.
      supabase
        .from("product_recalls")
        .select("recalls(title, url, description, recall_date, source, lot_pattern)")
        .eq("product_id", id),
    ]);
    setGuideline((g as Guideline) ?? null);
    type RecallRow = {
      recalls: {
        title: string;
        url: string | null;
        description: string | null;
        recall_date: string | null;
        source: string | null;
        lot_pattern: string | null;
      } | null;
    };
    setRecalls(
      ((r ?? []) as unknown as RecallRow[])
        .map((x) => x.recalls)
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .map((x) => ({
          title: x.title,
          url: x.url,
          description: x.description,
          recallDate: x.recall_date,
          source: x.source,
          lotPattern: x.lot_pattern,
        })),
    );
    setLoading(false);
  }

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [id]);

  async function refreshAI() {
    if (!product) return;
    setRefreshingAI(true);
    try {
      await lookupAndSaveGuidelines({ data: { productId: product.id } });
      toast.success("Guidelines refreshed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't refresh");
    } finally {
      setRefreshingAI(false);
    }
  }

  async function deleteProduct() {
    if (!product) return;
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    navigate({ to: "/products" });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!product) return null;

  const cat = categoryFromLabel(product.category);
  const Icon = cat?.icon ?? CATEGORY_BY_KEY.other.icon;
  const added = product.added_at
    ? new Date(product.added_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-16">
      <header className="px-5 pt-8 pb-2 sm:px-6">
        <div className="mx-auto max-w-md">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 rounded-full font-body text-xs"
          >
            <Link to="/products">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Products
            </Link>
          </Button>
        </div>
      </header>
      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-5">
          {/* Recall status */}
          {product.recalled || recalls.length > 0 ? (
            <div className="rounded-3xl bg-destructive/15 border border-destructive/30 p-4">
              <div className="flex items-center gap-2 font-body text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" /> POSSIBLE RECALL MATCH
              </div>
              {recalls.length > 0 ? (
                <ul className="mt-2 space-y-3">
                  {recalls.map((rc, i) => {
                    const hasLotMatch = lotMatches(product.lot_number, rc.lotPattern);
                    return (
                      <li key={i} className="space-y-1">
                        <p className="font-body text-sm font-semibold text-destructive">
                          {rc.title}
                        </p>
                        {rc.description && (
                          <p className="font-body text-xs leading-relaxed text-destructive/90">
                            {rc.description}
                          </p>
                        )}
                        {rc.recallDate && (
                          <p className="font-body text-[11px] text-destructive/70">
                            Recall date: {rc.recallDate}
                          </p>
                        )}
                        {rc.lotPattern && (
                          <p className="font-body text-[11px] text-destructive/70">
                            Affected batch/lot:{" "}
                            <span className="font-semibold">{rc.lotPattern}</span> — check your
                            product's sticker or packaging to compare.
                          </p>
                        )}
                        {product.lot_number && rc.lotPattern && (
                          <p
                            className={`font-body text-[11px] font-semibold ${hasLotMatch ? "text-destructive" : "text-emerald-700"}`}
                          >
                            {hasLotMatch
                              ? "Your recorded batch/lot matches this recall."
                              : "Your recorded batch/lot doesn't match this recall's listed batch/lot — still worth double-checking manually."}
                          </p>
                        )}
                        <a
                          href={rc.url || recallFallbackUrl(rc.title)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-body text-xs font-semibold text-destructive underline underline-offset-2"
                        >
                          View official recall notice <ExternalLink className="h-3 w-3" />
                        </a>
                        <p className="font-body text-[11px] text-destructive/60">
                          Source: {recallSourceLabel(rc)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 font-body text-xs text-destructive/80">
                  This product was flagged for a recall, but details aren't available yet.
                </p>
              )}
              <p className="mt-3 pt-3 border-t border-destructive/20 font-body text-[11px] leading-relaxed text-destructive/70">
                {formatRecallSyncNote(product.recall_checked_at)}
              </p>
            </div>
          ) : (
            <div className="rounded-3xl bg-emerald-50 border border-emerald-200 p-4">
              <div className="flex items-center gap-2 font-body text-sm font-semibold text-emerald-800">
                <ShieldCheck className="h-4 w-4" /> No known recalls
              </div>
              <p className="mt-3 pt-3 border-t border-emerald-200 font-body text-[11px] leading-relaxed text-emerald-800/70">
                {formatRecallSyncNote(product.recall_checked_at)}
              </p>
            </div>
          )}

          <p className="font-body text-[11px] leading-relaxed text-muted-foreground/80 px-1">
            Registration cards and mail-in forms that came with this product still matter — filling
            one out and sending it to the manufacturer is the fastest way to be notified directly if
            it's ever recalled.
          </p>

          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="h-20 w-20 rounded-2xl bg-sand/50 flex items-center justify-center">
              <Icon className="h-7 w-7 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{product.name}</h1>
              <p className="font-body text-sm text-muted-foreground">
                {[product.brand, cat?.label ?? product.category].filter(Boolean).join(" · ")}
              </p>
              {added && (
                <p className="mt-1 font-body text-xs text-muted-foreground">Added {added}</p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <DetailTimeline
            addedAt={product.added_at}
            replacementDate={product.predicted_replacement_date}
          />

          {/* Guidance */}
          <div className="rounded-3xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Safety guidelines</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshAI}
                disabled={refreshingAI}
                className="rounded-full text-xs"
              >
                {refreshingAI ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                  </>
                )}
              </Button>
            </div>
            {guideline ? (
              <div className="space-y-3 font-body text-sm">
                <div className="inline-flex items-center gap-1 rounded-full bg-sand/60 px-2.5 py-1 text-xs font-medium text-foreground/70 border border-border">
                  <Sparkles className="h-3 w-3" /> AI-generated estimate
                </div>
                <KV
                  label="Max weight"
                  value={guideline.max_weight_lbs ? `${guideline.max_weight_lbs} lb` : "—"}
                />
                <KV
                  label="Max height"
                  value={guideline.max_height_inches ? `${guideline.max_height_inches}"` : "—"}
                />
                {(guideline.max_weight_lbs || guideline.max_height_inches) && (
                  <p className="text-xs text-muted-foreground">
                    Generally safe to use until your child reaches{" "}
                    {[
                      guideline.max_weight_lbs ? `${guideline.max_weight_lbs} lb` : null,
                      guideline.max_height_inches ? `${guideline.max_height_inches}"` : null,
                    ]
                      .filter(Boolean)
                      .join(" or ")}
                    , whichever comes first.
                  </p>
                )}
                <KV
                  label="Average use"
                  value={
                    guideline.average_use_months ? `${guideline.average_use_months} months` : "—"
                  }
                />
                <KV
                  label="Replace every"
                  value={
                    guideline.replacement_interval_months
                      ? `${guideline.replacement_interval_months} months`
                      : "—"
                  }
                />
                {guideline.size_up_trigger && (
                  <div className="rounded-2xl bg-sand/60 px-3 py-2.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Size up when
                    </p>
                    <p>{guideline.size_up_trigger}</p>
                  </div>
                )}
                {guideline.replacement_trigger && (
                  <div className="rounded-2xl bg-sand/60 px-3 py-2.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Replace when
                    </p>
                    <p>{guideline.replacement_trigger}</p>
                  </div>
                )}
                {guideline.source && (
                  <p className="text-xs text-muted-foreground">Cited source: {guideline.source}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Generated by AI from the product name and category — not reviewed by a
                  pediatrician or verified against the manufacturer. Always confirm against your
                  product's manual or packaging before relying on these numbers.
                </p>
              </div>
            ) : (
              <p className="font-body text-sm text-muted-foreground">
                No guidelines yet. Tap Refresh to fetch.
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            onClick={deleteProduct}
            className="w-full rounded-full text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete product
          </Button>

          <ProductInfoFooter className="text-center" />
        </div>
      </main>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function DetailTimeline({
  addedAt,
  replacementDate,
}: {
  addedAt: string | null;
  replacementDate: string | null;
}) {
  if (!addedAt || !replacementDate) return null;
  return (
    <div className="rounded-3xl border border-border bg-card p-5 space-y-3">
      <h2 className="font-display text-base font-semibold">Timeline</h2>
      <TimelineRow label="Replace by" date={replacementDate} addedAt={addedAt} variant="replace" />
    </div>
  );
}

function TimelineRow({
  label,
  date,
  addedAt,
  variant,
}: {
  label: string;
  date: string;
  addedAt: string;
  variant?: "replace";
}) {
  const start = new Date(addedAt);
  const end = new Date(date + "T00:00:00");
  const now = new Date();
  const total = Math.max(1, daysBetween(start, end));
  const elapsed = Math.max(0, Math.min(total, daysBetween(start, now)));
  const pct = Math.round((elapsed / total) * 100);
  const remaining = daysBetween(now, end);
  let barClass = variant === "replace" ? "bg-primary" : "bg-emerald-500";
  if (variant !== "replace") {
    if (remaining <= 14) barClass = "bg-destructive";
    else if (remaining <= 30) barClass = "bg-amber-500";
  }
  return (
    <div>
      <div className="flex items-baseline justify-between font-body text-sm">
        <span>{label}</span>
        <span className="font-semibold">{formatMonthYear(date)}</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 font-body text-xs text-muted-foreground">
        {remaining > 0
          ? `${remaining} days from today`
          : "Past this estimated date — worth reviewing against the manufacturer's guidance"}
      </p>
    </div>
  );
}
