import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, AlertTriangle, Ruler, RefreshCw, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { CATEGORY_BY_KEY, categoryFromLabel } from "@/lib/productCategories";
import { formatMonthYear, daysBetween } from "@/lib/predictions";
import { lookupAndSaveGuidelines, recomputePredictions } from "@/lib/guidelines.functions";

export const Route = createFileRoute("/_authenticated/products_/$id")({
  ssr: false,
  component: ProductDetailPage,
  head: () => ({ meta: [{ title: "Product — Safe & Sound" }] }),
});
type Product = {
  id: string;
  name: string;
  brand: string | null;
  size: string | null;
  category: string | null;
  added_at: string | null;
  purchased_at: string | null;
  predicted_sizeup_date: string | null;
  predicted_replacement_date: string | null;
  recalled: boolean;
  child_id: string | null;
}; type _u = never; // photo_url removed

type Guideline = {
  max_weight_lbs: number | null;
  max_height_inches: number | null;
  average_use_months: number | null;
  replacement_interval_months: number | null;
  size_up_trigger: string | null;
  replacement_trigger: string | null;
  source: string | null;
};

type Child = {
  id: string;
  name: string;
  height_inches: number | null;
  weight_lbs: number | null;
  measurements_updated_at: string | null;
};

function ProductDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [guideline, setGuideline] = useState<Guideline | null>(null);
  const [child, setChild] = useState<Child | null>(null);
  const [recallNames, setRecallNames] = useState<string[]>([]);
  const [refreshingAI, setRefreshingAI] = useState(false);

  async function load() {
    setLoading(true);
    const { data: p, error } = await supabase
      .from("products")
      .select("id, name, brand, size, category, added_at, purchased_at, predicted_sizeup_date, predicted_replacement_date, recalled, child_id")
      .eq("id", id)
      .maybeSingle();
    if (error || !p) {
      toast.error(error?.message ?? "Product not found");
      setLoading(false);
      return;
    }
    setProduct(p as Product);

    const [{ data: g }, { data: r }, kidRes] = await Promise.all([
      supabase.from("product_guidelines").select("max_weight_lbs, max_height_inches, average_use_months, replacement_interval_months, size_up_trigger, replacement_trigger, source").eq("product_id", id).maybeSingle(),
      supabase.from("product_recalls").select("recalls(title)").eq("product_id", id).eq("acknowledged", false),
      p.child_id ? supabase.from("children").select("id, name, height_inches, weight_lbs, measurements_updated_at").eq("id", p.child_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setGuideline((g as Guideline) ?? null);
    setRecallNames(((r ?? []) as Array<{ recalls: { title: string } | null }>).map((x) => x.recalls?.title ?? "Active recall"));
    setChild((kidRes?.data as Child) ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function refreshAI() {
    if (!product) return;
    setRefreshingAI(true);
    try {
      await lookupAndSaveGuidelines({ data: { productId: product.id } });
      toast.success("Guidelines refreshed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't refresh");
    } finally { setRefreshingAI(false); }
  }

  async function deleteProduct() {
    if (!product) return;
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) { toast.error(error.message); return; }
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
  const added = product.added_at ? new Date(product.added_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-16">
      <header className="px-5 pt-8 pb-2 sm:px-6">
        <div className="mx-auto max-w-md">
          <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full font-body text-xs">
            <Link to="/products"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Products</Link>
          </Button>
        </div>
      </header>
      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-5">
          {/* Recall banner */}
          {(product.recalled || recallNames.length > 0) && (
            <div className="rounded-3xl bg-destructive/15 border border-destructive/30 p-4">
              <div className="flex items-center gap-2 font-body text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" /> RECALL
              </div>
              {recallNames.length > 0 && (
                <ul className="mt-2 space-y-1 font-body text-xs text-destructive/90">
                  {recallNames.map((t, i) => <li key={i}>· {t}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="h-20 w-20 rounded-2xl bg-sand/50 flex items-center justify-center">
              <Icon className="h-7 w-7 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{product.name}</h1>
              <p className="font-body text-sm text-muted-foreground">{[product.brand, cat?.label ?? product.category].filter(Boolean).join(" · ")}</p>
              {added && <p className="mt-1 font-body text-xs text-muted-foreground">Added {added}</p>}
            </div>
          </div>

          {/* Timeline */}
          <DetailTimeline addedAt={product.added_at} sizeUpDate={product.predicted_sizeup_date} replacementDate={product.predicted_replacement_date} />

          {/* Measurements */}
          {child && (
            <MeasurementCard child={child} productId={product.id} onUpdated={load} />
          )}

          {/* Guidance */}
          <div className="rounded-3xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Safety guidelines</h2>
              <Button variant="ghost" size="sm" onClick={refreshAI} disabled={refreshingAI} className="rounded-full text-xs">
                {refreshingAI ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh</>}
              </Button>
            </div>
            {guideline ? (
              <div className="space-y-3 font-body text-sm">
                <div className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 border border-green-200">
                  <ShieldCheck className="h-3 w-3" /> Pediatrician reviewed
                </div>
                <KV label="Max weight" value={guideline.max_weight_lbs ? `${guideline.max_weight_lbs} lb` : "—"} />
                <KV label="Max height" value={guideline.max_height_inches ? `${guideline.max_height_inches}"` : "—"} />
                <KV label="Average use" value={guideline.average_use_months ? `${guideline.average_use_months} months` : "—"} />
                <KV label="Replace every" value={guideline.replacement_interval_months ? `${guideline.replacement_interval_months} months` : "—"} />
                {guideline.size_up_trigger && (
                  <div className="rounded-2xl bg-sand/60 px-3 py-2.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Size up when</p>
                    <p>{guideline.size_up_trigger}</p>
                  </div>
                )}
                {guideline.replacement_trigger && (
                  <div className="rounded-2xl bg-sand/60 px-3 py-2.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Replace when</p>
                    <p>{guideline.replacement_trigger}</p>
                  </div>
                )}
                {guideline.source && (
                  <p className="text-xs text-muted-foreground">Source: {guideline.source}</p>
                )}
              </div>
            ) : (
              <p className="font-body text-sm text-muted-foreground">No guidelines yet. Tap Refresh to fetch.</p>
            )}
          </div>

          <Button variant="ghost" onClick={deleteProduct} className="w-full rounded-full text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> Delete product
          </Button>
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

function DetailTimeline({ addedAt, sizeUpDate, replacementDate }: { addedAt: string | null; sizeUpDate: string | null; replacementDate: string | null }) {
  if (!addedAt) return null;
  return (
    <div className="rounded-3xl border border-border bg-card p-5 space-y-3">
      <h2 className="font-display text-base font-semibold">Timeline</h2>
      {sizeUpDate ? (
        <TimelineRow label="Estimated size-up" date={sizeUpDate} addedAt={addedAt} />
      ) : (
        <p className="font-body text-sm text-muted-foreground">Size-up prediction pending.</p>
      )}
      {replacementDate && <TimelineRow label="Replace by" date={replacementDate} addedAt={addedAt} variant="replace" />}
    </div>
  );
}

function TimelineRow({ label, date, addedAt, variant }: { label: string; date: string; addedAt: string; variant?: "replace" }) {
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
        {remaining > 0 ? `${remaining} days from today` : "Past due — review now"}
      </p>
    </div>
  );
}

function MeasurementCard({ child, productId: _productId, onUpdated }: { child: Child; productId: string; onUpdated: () => Promise<void> | void }) {
  const [editing, setEditing] = useState(false);
  const [heightStr, setHeightStr] = useState(child.height_inches != null ? child.height_inches.toFixed(1) : "");
  const [weightStr, setWeightStr] = useState(child.weight_lbs != null ? child.weight_lbs.toFixed(1) : "");
  const [saving, setSaving] = useState(false);
  const [predictedMsg, setPredictedMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    try {
      const h = parseFloat(heightStr);
      const w = parseFloat(weightStr);
      const height_inches = Number.isFinite(h) && h > 0 ? h : null;
      const weight_lbs = Number.isFinite(w) && w > 0 ? w : null;
      const nowIso = new Date().toISOString();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      await supabase.from("children").update({
        height_inches,
        weight_lbs,
        measurements_updated_at: nowIso,
      } as never).eq("id", child.id);
      await supabase.from("child_measurements").insert({
        user_id: u.user.id,
        child_id: child.id,
        height_inches,
        weight_lbs,
        recorded_at: nowIso,
      } as never);
      // Recompute all predictions for this child
      await recomputePredictions({ data: { childId: child.id } });
      await onUpdated();
      // Re-fetch predicted_sizeup_date for confirmation message
      const { data: refreshed } = await supabase.from("products").select("predicted_sizeup_date").eq("id", _productId).maybeSingle();
      const date = (refreshed as { predicted_sizeup_date: string | null } | null)?.predicted_sizeup_date;
      if (date && weight_lbs) {
        setPredictedMsg(`Based on ${child.name}'s current weight of ${weight_lbs} lbs, they will likely outgrow this product around ${formatMonthYear(date)}.`);
      } else {
        setPredictedMsg("Measurements saved.");
      }
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-accent" />
          <h2 className="font-display text-base font-semibold">{child.name}'s measurements</h2>
        </div>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="rounded-full text-xs">Update</Button>
        )}
      </div>
      {!editing ? (
        <div className="grid grid-cols-2 gap-3 font-body text-sm">
          <div className="rounded-2xl bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">Weight</p>
            <p className="font-semibold">{child.weight_lbs != null ? `${child.weight_lbs.toFixed(1)} lb` : "—"}</p>
          </div>
          <div className="rounded-2xl bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">Height</p>
            <p className="font-semibold">{child.height_inches != null ? `${child.height_inches.toFixed(1)}"` : "—"}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="font-body text-xs">Weight (lb)</Label>
              <Input type="number" step="0.1" min="0" value={weightStr} onChange={(e) => setWeightStr(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div>
              <Label className="font-body text-xs">Height (in)</Label>
              <Input type="number" step="0.1" min="0" value={heightStr} onChange={(e) => setHeightStr(e.target.value)} className="h-10 rounded-xl" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="flex-1 rounded-full">Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving} className="flex-1 rounded-full">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      )}
      {predictedMsg && (
        <p className="rounded-2xl bg-sand/60 px-3 py-2.5 font-body text-sm">{predictedMsg}</p>
      )}
    </div>
  );
}
