import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  ScanLine,
  X,
} from "lucide-react";
import { checkRecallsForProduct, type RecallHit } from "@/lib/recallCheck";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useActiveChild } from "@/hooks/useActiveChild";
import { CATEGORIES, type CategoryKey } from "@/lib/productCategories";
import { trackEvent } from "@/lib/analytics";

// Server functions are imported dynamically to prevent module-level evaluation
// crashing the page if the server environment or API keys aren't available.
type ProductSearchResult = {
  name: string; brand: string; category: string; model: string;
  safe_use_duration_days: number; safe_use_notes: string;
  age_range: string; cpsc_product_type: string;
};

async function runSearchProducts(query: string): Promise<ProductSearchResult[]> {
  const { searchProducts } = await import("@/lib/searchProducts.functions");
  return searchProducts({ data: { query } });
}

async function runLookupGuidelines(productId: string): Promise<void> {
  const { lookupAndSaveGuidelines } = await import("@/lib/guidelines.functions");
  await lookupAndSaveGuidelines({ data: { productId } });
}

async function recordRecallInDb(productId: string, hit: RecallHit): Promise<void> {
  try {
    const { data: catalogEntry } = await (supabase as any)
      .from("recalls")
      .upsert(
        { source: hit.source, source_id: hit.id, title: hit.title, url: hit.url },
        { onConflict: "source,source_id" }
      )
      .select("id")
      .single();

    const recallId = (catalogEntry as { id: string } | null)?.id;
    if (recallId) {
      await (supabase as any)
        .from("product_recalls")
        .upsert({ product_id: productId, recall_id: recallId, acknowledged: false }, { onConflict: "product_id,recall_id" });
    }

    await (supabase as any).from("products").update({ recalled: true }).eq("id", productId);
  } catch (err) {
    console.warn("[recall-db] failed:", err instanceof Error ? err.message : "unknown");
  }
}

const BarcodeScanner = lazy(() =>
  import("@/components/BarcodeScanner").then((m) => ({ default: m.BarcodeScanner }))
);

// ─── Error boundary for AI search ────────────────────────────────────────────

class SearchErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) {
    console.error("[ProductSearchAI] render error:", err);
  }
  render() {
    if (this.state.failed) return null; // silently hide — manual form still works
    return this.props.children;
  }
}

export const Route = createFileRoute("/_authenticated/products_/new")({
  ssr: false,
  component: NewProductPage,
  head: () => ({ meta: [{ title: "Add product — Peace of Mine" }] }),
});

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Main page ────────────────────────────────────────────────────────────────

function NewProductPage() {
  const navigate = useNavigate();
  const { activeChildId } = useActiveChild();
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<CategoryKey | "">("");
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [purchasedAt, setPurchasedAt] = useState(toISODate(new Date()));
  const [carSeatExpiry, setCarSeatExpiry] = useState("");
  const [swaddleSize, setSwaddleSize] = useState("");

  // Sheet state for AI-picked product
  const [sheetProduct, setSheetProduct] = useState<ProductSearchResult | null>(null);

  // Recall modal state
  const [recallModal, setRecallModal] = useState<{ hit: RecallHit; productName: string; productId: string } | null>(null);

  const computedReplaceAt = useMemo(() => {
    if (category === "car_seat") return carSeatExpiry || "";
    return "";
  }, [category, carSeatExpiry]);

  const activeCategory = CATEGORIES.find((c) => c.key === category);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) { toast.error("Pick a category"); return; }
    if (!name.trim()) { toast.error("Give your product a name"); return; }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not signed in");
      const { data: inserted, error } = await supabase.from("products").insert({
        user_id: session.user.id,
        child_id: activeChildId,
        name: name.trim(),
        category: activeCategory?.label ?? category,
        barcode: barcode.trim() || null,
        purchased_at: purchasedAt ? new Date(purchasedAt).toISOString() : null,
        added_at: new Date().toISOString(),
        replace_at: computedReplaceAt || null,
        size: category === "sleep_sack" ? swaddleSize.trim() || null : null,
      } as never).select("id").single();
      if (error) throw error;
      const productId = (inserted as { id: string } | null)?.id;
      if (productId) {
        runLookupGuidelines(productId).catch((err) => {
          console.warn("[guidelines] lookup failed:", err instanceof Error ? err.message : "unknown");
        });

        // Inline recall check — must complete before navigating
        const hit = await checkRecallsForProduct(name.trim());
        if (hit) {
          await recordRecallInDb(productId, hit);
          setRecallModal({ hit, productName: name.trim(), productId });
          trackEvent("recall_alert_shown", { category: category || "unknown" });
          return; // wait for user to dismiss modal before navigating
        }
      }
      trackEvent("product_added", { category: category || "unknown" });
      toast.success("Saved — fetching estimated safety guidelines");
      navigate({ to: "/products" });
    } catch (err) {
      console.error("[products/new] handleSubmit error:", err);
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally { setSaving(false); }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      <header className="px-5 pt-8 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full font-body text-xs">
            <Link to="/products">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Products
            </Link>
          </Button>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Add a product</h1>
          <p className="mt-1.5 font-body text-sm text-muted-foreground">
            Search by name for instant safety info, or fill in manually below.
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-6">
          {/* AI Product Search — primary flow */}
          <SearchErrorBoundary>
            <ProductSearchAI onPick={(r) => setSheetProduct(r)} />
          </SearchErrorBoundary>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="font-body text-xs text-muted-foreground">or add manually</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Manual form — fallback */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <Field label="Category" required>
              <div className="grid grid-cols-2 gap-2.5">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const active = category === c.key;
                  return (
                    <button
                      type="button"
                      key={c.key}
                      onClick={() => setCategory(c.key)}
                      className={
                        active
                          ? "flex items-center gap-2 rounded-2xl border border-primary bg-primary px-3 py-3 text-left font-body text-sm font-semibold text-primary-foreground"
                          : "flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-3 text-left font-body text-sm text-foreground/80"
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{c.label}</span>
                    </button>
                  );
                })}
              </div>
              {activeCategory && (
                <p className="mt-2 flex items-center gap-1.5 font-body text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-accent" />
                  {activeCategory.hint}
                </p>
              )}
            </Field>

            <Field label="Name" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nuna Pipa Lite"
                maxLength={120}
                className="h-12 rounded-2xl bg-card px-4 font-body text-base"
              />
            </Field>

            <Field label="Barcode">
              <div className="flex gap-2">
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan or type"
                  className="h-12 flex-1 rounded-2xl bg-card px-4 font-body text-base"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl px-4"
                  onClick={() => setScannerOpen(true)}
                >
                  <ScanLine className="mr-1 h-4 w-4" /> Scan
                </Button>
              </div>
            </Field>

            <Field label="Purchase date" required>
              <Input
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                className="h-12 rounded-2xl bg-card px-4 font-body text-base"
              />
            </Field>

            {category === "car_seat" && (
              <Field label="Manufacturer expiry date">
                <Input
                  type="date"
                  value={carSeatExpiry}
                  onChange={(e) => setCarSeatExpiry(e.target.value)}
                  className="h-12 rounded-2xl bg-card px-4 font-body text-base"
                />
                <p className="mt-1.5 font-body text-xs text-muted-foreground">
                  Usually printed on a sticker on the seat shell.
                </p>
              </Field>
            )}

            {category === "sleep_sack" && (
              <Field label="Current size / weight">
                <Input
                  value={swaddleSize}
                  onChange={(e) => setSwaddleSize(e.target.value)}
                  placeholder="e.g. 0–3 mo, up to 14 lb"
                  maxLength={40}
                  className="h-12 rounded-2xl bg-card px-4 font-body text-base"
                />
              </Field>
            )}

            {computedReplaceAt && (
              <div className="rounded-2xl bg-primary/8 px-4 py-3 font-body text-sm text-foreground/80">
                Replace by{" "}
                <span className="font-semibold">{formatDate(computedReplaceAt)}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={saving}
              className="mt-2 h-12 w-full rounded-full bg-primary font-body text-sm font-semibold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save product"}
            </Button>
          </form>
        </div>
      </main>

      <Suspense fallback={null}>
        <BarcodeScanner
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onDetected={(code) => { setBarcode(code); toast.success(`Scanned ${code}`); }}
        />
      </Suspense>

      {/* Save sheet — opened when user picks an AI result */}
      <SaveProductSheet
        product={sheetProduct}
        onClose={() => setSheetProduct(null)}
        onSaved={() => navigate({ to: "/products" })}
        onRecallFound={(hit, productName, productId) => {
          setSheetProduct(null);
          setRecallModal({ hit, productName, productId });
        }}
      />

      {/* Recall alert modal */}
      {recallModal && (
        <RecallAlertModal
          hit={recallModal.hit}
          productName={recallModal.productName}
          onDismiss={() => {
            setRecallModal(null);
            navigate({ to: "/products" });
          }}
        />
      )}
    </div>
  );
}

// ─── Recall Alert Modal ───────────────────────────────────────────────────────

function RecallAlertModal({
  hit,
  productName,
  onDismiss,
}: {
  hit: RecallHit;
  productName: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white">
        {/* Red header */}
        <div className="px-6 py-5" style={{ backgroundColor: "#C8523A" }}>
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-white" />
            <span className="font-display text-lg font-semibold text-white">Recall Alert Found</span>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="font-display text-xl font-semibold text-foreground">{productName}</p>
            <p className="mt-0.5 font-body text-sm text-muted-foreground">{hit.title}</p>
          </div>

          <div
            className="rounded-2xl px-4 py-3"
            style={{ backgroundColor: "rgba(200,82,58,0.08)" }}
          >
            <p className="font-body text-sm leading-relaxed text-foreground">{hit.reason}</p>
          </div>

          {hit.recallDate && (
            <p className="font-body text-xs text-muted-foreground">Recall date: {hit.recallDate}</p>
          )}

          <a
            href={hit.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 h-12 w-full rounded-full font-body text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: "#C8523A" }}
          >
            View official recall notice
            <ExternalLink className="h-4 w-4" />
          </a>

          <button
            type="button"
            onClick={onDismiss}
            className="flex items-center justify-center h-12 w-full rounded-full border border-border font-body text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Got it — save product anyway
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AI Product Search ────────────────────────────────────────────────────────

function ProductSearchAI({ onPick }: { onPick: (r: ProductSearchResult) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await runSearchProducts(q);
      setResults(data);
    } catch {
      toast.error("Search failed — please try again");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setQuery("");
    setResults([]);
    setSearched(false);
    inputRef.current?.focus();
  }

  function daysToLabel(days: number): string {
    if (days <= 7) return `${days} day${days === 1 ? "" : "s"}`;
    if (days < 60) return `${Math.round(days / 7)} week${Math.round(days / 7) === 1 ? "" : "s"}`;
    if (days < 730) return `${Math.round(days / 30)} month${Math.round(days / 30) === 1 ? "" : "s"}`;
    return `${Math.round(days / 365)} year${Math.round(days / 365) === 1 ? "" : "s"}`;
  }

  return (
    <div className="rounded-3xl border border-primary/20 bg-card shadow-warm-sm space-y-4 p-4">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="font-body text-sm font-semibold text-foreground">Search by product name</p>
          <p className="font-body text-xs text-muted-foreground">
            AI looks up estimated safety info — always verify with the manufacturer or your pediatrician.
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(); } }}
            placeholder="e.g. Philips Avent Soothie, Nuna Pipa…"
            className="h-11 rounded-2xl bg-background pl-9 pr-9 font-body text-base"
            maxLength={80}
          />
          {query && (
            <button
              type="button"
              onClick={clear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button
          type="button"
          onClick={runSearch}
          disabled={loading || !query.trim()}
          className="h-11 rounded-2xl px-4 font-body text-sm"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center gap-2 py-2 font-body text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Looking up safety data…
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <p className="font-body text-xs text-muted-foreground">
          No matches found. Try a different name, or fill in the manual form below.
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onPick(r)}
                className="group w-full rounded-2xl border border-border bg-background p-3.5 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-sm font-semibold text-foreground">{r.name}</p>
                    <p className="mt-0.5 font-body text-xs text-muted-foreground">
                      {[r.brand, r.category.replace(/_/g, " ")].filter(Boolean).join(" · ")}
                      {r.age_range ? ` · ${r.age_range}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-body text-[10px] font-medium text-primary">
                    {daysToLabel(r.safe_use_duration_days)}
                  </span>
                </div>
                <p className="mt-2 font-body text-xs text-muted-foreground line-clamp-2">
                  {r.safe_use_notes}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Save Product Sheet ───────────────────────────────────────────────────────

type Child = { id: string; name: string };

function SaveProductSheet({
  product,
  onClose,
  onSaved,
  onRecallFound,
}: {
  product: ProductSearchResult | null;
  onClose: () => void;
  onSaved: () => void;
  onRecallFound: (hit: RecallHit, productName: string, productId: string) => void;
}) {
  const [purchasedAt, setPurchasedAt] = useState(toISODate(new Date()));
  const [childId, setChildId] = useState<string>("");
  const [children, setChildren] = useState<Child[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset date when sheet opens
  useEffect(() => {
    if (product) {
      setPurchasedAt(toISODate(new Date()));
    }
  }, [product]);

  // Fetch children once
  useEffect(() => {
    supabase.from("children").select("id, name").then(({ data }) => {
      if (data && data.length > 0) {
        setChildren(data as Child[]);
        setChildId(data[0].id);
      }
    });
  }, []);

  const replaceAt = product
    ? addDays(purchasedAt, product.safe_use_duration_days)
    : "";

  async function handleSave() {
    if (!product) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not signed in");

      const replaceDate = addDays(purchasedAt, product.safe_use_duration_days);

      const { data: inserted, error } = await supabase
        .from("products")
        .insert({
          user_id: session.user.id,
          child_id: childId || null,
          name: product.name,
          brand: product.brand || null,
          category: product.category,
          model: product.model || null,
          purchased_at: new Date(purchasedAt).toISOString(),
          added_at: new Date().toISOString(),
          replace_at: replaceDate,
          predicted_replacement_date: replaceDate,
        } as never)
        .select("id")
        .single();

      if (error) throw error;

      const productId = (inserted as { id: string } | null)?.id;
      if (productId) {
        runLookupGuidelines(productId).catch((err) => {
          console.warn("[guidelines] lookup failed:", err instanceof Error ? err.message : "unknown");
        });

        // Inline recall check — must complete before navigating
        const hit = await checkRecallsForProduct(product.name);
        if (hit) {
          await recordRecallInDb(productId, hit);
          onRecallFound(hit, product.name, productId);
          return;
        }
      }

      toast.success(`${product.name} saved`);
      onClose();
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  function daysToLabel(days: number): string {
    if (days <= 7) return `${days} day${days === 1 ? "" : "s"}`;
    if (days < 60) return `${Math.round(days / 7)} week${Math.round(days / 7) === 1 ? "" : "s"}`;
    if (days < 730) return `${Math.round(days / 30)} month${Math.round(days / 30) === 1 ? "" : "s"}`;
    return `${Math.round(days / 365)} year${Math.round(days / 365) === 1 ? "" : "s"}`;
  }

  return (
    <Sheet open={!!product} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-10 pt-6">
        <SheetHeader className="mb-5 text-left">
          <SheetTitle className="font-display text-xl font-semibold">
            {product?.name ?? ""}
          </SheetTitle>
          <SheetDescription className="font-body text-sm text-muted-foreground">
            {product ? `${product.brand} · ${product.category.replace(/_/g, " ")}` : ""}
          </SheetDescription>
        </SheetHeader>

        {product && (
          <div className="space-y-5">
            {/* Safety summary */}
            <div className="flex items-start gap-3 rounded-2xl bg-primary/8 px-4 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="font-body text-sm font-semibold text-foreground">
                  Safe for {daysToLabel(product.safe_use_duration_days)}
                </p>
                <p className="mt-0.5 font-body text-xs text-muted-foreground">{product.safe_use_notes}</p>
              </div>
            </div>

            {/* Purchase date */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 font-body text-sm">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                Purchase date
              </Label>
              <Input
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                className="h-12 rounded-2xl bg-card px-4 font-body text-base"
              />
            </div>

            {/* Replace by preview */}
            {replaceAt && (
              <p className="font-body text-xs text-muted-foreground">
                Replacement reminder set for{" "}
                <span className="font-semibold text-foreground">{formatDate(replaceAt)}</span>
              </p>
            )}

            {/* Child selector */}
            {children.length > 0 && (
              <div className="space-y-1.5">
                <Label className="font-body text-sm">Assign to</Label>
                <div className="relative">
                  <select
                    value={childId}
                    onChange={(e) => setChildId(e.target.value)}
                    className="h-12 w-full appearance-none rounded-2xl border border-border bg-card px-4 pr-9 font-body text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">No child (general)</option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-12 w-full rounded-full bg-primary font-body text-sm font-semibold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & set reminder"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="font-body text-sm">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
