import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, AlertTriangle, Ruler, RefreshCw, Trash2, ShieldAlert, ExternalLink, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { CATEGORY_BY_KEY, categoryFromLabel } from "@/lib/productCategories";
import { lookupAndSaveGuidelines, recomputePredictions } from "@/lib/guidelines.functions";

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
  const [liveChecking, setLiveChecking] = useState(false);
  const [liveResults, setLiveResults] = useState<Array<{ id: string; title: string; url: string; date: string | null }> | null>(null);
  const [liveCheckedAt, setLiveCheckedAt] = useState<Date | null>(null);

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

  async function checkLiveNow() {
    if (!product) return;
    setLiveChecking(true);
    setLiveResults(null);
    try {
      const query = [product.name, product.brand].filter(Boolean).join(" ");
      const res = await fetch(
        `https://www.saferproducts.gov/RestWebServices/Recall?format=json&Keyword=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error(`CPSC API ${res.status}`);
      const data = await res.json();
      type CpscRow = { RecallID: string; RecallHeading: string; URL: string; RecallDate?: string };
      const rows: CpscRow[] = Array.isArray(data) ? data : [];
      const hits = rows.map((r) => ({ id: r.RecallID, title: r.RecallHeading, url: r.URL, date: r.RecallDate ?? null }));
      setLiveResults(hits);
      setLiveCheckedAt(new Date());

      // If live check found recalls not already in our DB, insert them
      if (hits.length > 0 && !product.recalled && recallNames.length === 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("product_recalls" as never).insert({
            product_id: product.id,
            user_id: user.id,
            acknowledged: false,
          } as never);
          await load(); // refresh to show the new recall banner
        }
      }
    } catch {
      toast.error("Could not reach the CPSC database. Try again or visit cpsc.gov/Recalls.");
    } finally {
      setLiveChecking(false);
    }
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
          {/* Recall status card */}
          <div className={`rounded-3xl border p-4 space-y-3 ${product.recalled || recallNames.length > 0 ? "bg-destructive/15 border-destructive/30" : "bg-card border-border/50"}`}>
            {/* Header */}
            {(product.recalled || recallNames.length > 0) ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-body text-sm font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Active recall found in CPSC database
                </div>
                {recallNames.length > 0 && (
                  <ul className="space-y-1 font-body text-xs text-destructive/90">
                    {recallNames.map((t, i) => <li key={i}>· {t}</li>)}
                  </ul>
                )}
                <a href="https://www.cpsc.gov/Recalls" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-body text-xs font-semibold text-destructive underline">
                  View on cpsc.gov <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2 font-body text-xs text-muted-foreground">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                No active CPSC recalls found in our database
              </div>
            )}

            {/* Live check button */}
            <Button
              variant="outline"
              size="sm"
              onClick={checkLiveNow}
              disabled={liveChecking}
              className="w-full rounded-full font-body text-xs gap-1.5 h-9"
            >
              {liveChecking
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Querying CPSC…</>
                : <><Zap className="h-3.5 w-3.5" /> Check CPSC live now</>}
            </Button>

            {/* Live check results */}
            {liveResults !== null && liveCheckedAt && (
              <div className="space-y-2">
                <p className="font-body text-xs text-muted-foreground">
                  Live CPSC query — {liveCheckedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}{" "}
                  at {liveCheckedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </p>
                {liveResults.length === 0 ? (
                  <p className="font-body text-xs text-muted-foreground">
                    No recalls returned by CPSC for this search. The absence of a result does not confirm this product is free of all recalls — CPSC data can be delayed by 1–2 hours from the time of publication.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {liveResults.map((r) => (
                      <li key={r.id} className="rounded-2xl border border-destructive/20 bg-destructive/8 px-3 py-2 font-body text-xs">
                        <p className="font-semibold text-foreground">{r.title}</p>
                        {r.date && <p className="text-muted-foreground">{new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>}
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 font-semibold text-destructive underline">
                            Full details <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Delay disclaimer */}
            <p className="font-body text-[11px] leading-relaxed text-muted-foreground/70">
              We pull recall data as quickly as CPSC publishes it, but CPSC typically takes 1–2 hours to make new recalls available in their database after announcement. For the most current information, always check{" "}
              <a href="https://www.cpsc.gov/Recalls" target="_blank" rel="noopener noreferrer" className="font-semibold underline">cpsc.gov/Recalls</a>{" "}
              and{" "}
              <a href="https://www.recalls.gov" target="_blank" rel="noopener noreferrer" className="font-semibold underline">recalls.gov</a>{" "}
              directly.
            </p>
          </div>

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

          {/* Reactive fit check */}
          {guideline && child && (
            <FitCheck child={child} guideline={guideline} />
          )}

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
                <div className="rounded-2xl border border-amber-200/60 bg-amber-50/60 px-3 py-2.5 dark:border-amber-700/30 dark:bg-amber-950/20">
                  <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                    These are automated reference guidelines based on product documentation. Always verify limits directly from the product's manual and warning labels. This is not a replacement for a pediatrician's evaluation or the manufacturer's official specifications.
                  </p>
                </div>
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

function FitCheck({ child, guideline }: { child: Child; guideline: Guideline }) {
  const weightOk = guideline.max_weight_lbs == null || child.weight_lbs == null || child.weight_lbs < guideline.max_weight_lbs;
  const heightOk = guideline.max_height_inches == null || child.height_inches == null || child.height_inches < guideline.max_height_inches;
  const hasData = child.weight_lbs != null || child.height_inches != null;
  const hasLimits = guideline.max_weight_lbs != null || guideline.max_height_inches != null;
  if (!hasData || !hasLimits) return null;

  const exceeded = !weightOk || !heightOk;
  return (
    <div className={`rounded-3xl border p-4 space-y-2 ${exceeded ? "border-destructive/40 bg-destructive/8" : "border-border/50 bg-card"}`}>
      <h2 className="font-display text-base font-semibold">Current fit check</h2>
      <div className="grid grid-cols-2 gap-2 font-body text-sm">
        {guideline.max_weight_lbs != null && child.weight_lbs != null && (
          <div className={`rounded-2xl px-3 py-2 ${child.weight_lbs >= guideline.max_weight_lbs ? "bg-destructive/15" : "bg-muted/40"}`}>
            <p className="text-xs text-muted-foreground">Weight</p>
            <p className="font-semibold">{child.weight_lbs.toFixed(1)} lb <span className="font-normal text-muted-foreground">/ {guideline.max_weight_lbs} lb limit</span></p>
            {child.weight_lbs >= guideline.max_weight_lbs && <p className="text-xs font-semibold text-destructive mt-0.5">At or over limit</p>}
          </div>
        )}
        {guideline.max_height_inches != null && child.height_inches != null && (
          <div className={`rounded-2xl px-3 py-2 ${child.height_inches >= guideline.max_height_inches ? "bg-destructive/15" : "bg-muted/40"}`}>
            <p className="text-xs text-muted-foreground">Height</p>
            <p className="font-semibold">{child.height_inches.toFixed(1)}" <span className="font-normal text-muted-foreground">/ {guideline.max_height_inches}" limit</span></p>
            {child.height_inches >= guideline.max_height_inches && <p className="text-xs font-semibold text-destructive mt-0.5">At or over limit</p>}
          </div>
        )}
      </div>
      <p className="font-body text-xs text-muted-foreground">
        Based on {child.name}'s last recorded measurements. Update measurements in the card below. Always verify limits against the physical product label.
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
      setPredictedMsg("Measurements saved. Check the limits below to confirm the product is still within the manufacturer's weight and height ranges.");
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
