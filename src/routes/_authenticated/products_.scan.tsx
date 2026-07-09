import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { BarcodeScannerView } from "@/components/BarcodeScannerView";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ExternalLink,
  ImagePlus,
  Loader2,
  Lock,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscription } from "@/hooks/useSubscription";
import { useActiveChild } from "@/hooks/useActiveChild";

export const Route = createFileRoute("/_authenticated/products_/scan")({
  ssr: false,
  component: ScanPage,
  head: () => ({ meta: [{ title: "Scan a barcode — Peace of Mine" }] }),
});

import {
  CATEGORIES,
  CATEGORY_BY_KEY,
  guessCategoryFromText,
  type CategoryKey,
} from "@/lib/productCategories";
import { lookupAndSaveGuidelines } from "@/lib/guidelines.functions";
import { ProductInfoFooter } from "@/components/ProductInfoFooter";

const CATEGORY_ORDER: CategoryKey[] = CATEGORIES.map((c) => c.key);

const SOURCE_LABEL: Record<string, string> = {
  openfoodfacts: "Open Food Facts",
  openbeautyfacts: "Open Beauty Facts",
  upcitemdb: "UPCitemdb",
  "go-upc": "Go-UPC",
  "barcode-lookup": "Barcode Lookup",
  "barcode-spider": "Barcode Spider",
  manual: "Community submission",
};

type LookupProduct = {
  barcode: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  isBabyProduct: boolean;
  imageUrl: string | null;
  source: string;
};

type RecallHit = {
  source: "cpsc" | "nhtsa";
  id: string;
  title: string;
  reason: string;
  url: string;
  recallDate: string | null;
};

type RecallCheckResult = { recalled: boolean; recalls: RecallHit[] };

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function computeReplaceAt(
  category: CategoryKey,
  _purchasedAt: string,
  carSeatExpiry: string,
): string {
  if (category === "car_seat") return carSeatExpiry || "";
  return "";
}

function guessCategory(p: LookupProduct): CategoryKey {
  const hay = [p.category ?? "", p.name ?? ""].join(" ");
  return (guessCategoryFromText(hay) || "other") as CategoryKey;
}

type Step = "scanning" | "looking-up" | "form" | "success";

function ScanPage() {
  const navigate = useNavigate();
  // TEMP: paywall disabled for testing at user's request — REMOVE this
  // override (restore `const { isPro, loading: subLoading } = useSubscription();`)
  // before launch.
  const { loading: subLoading } = useSubscription();
  const isPro = true;
  const { activeChildId } = useActiveChild();

  const [step, setStep] = useState<Step>("scanning");
  const [barcode, setBarcode] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [foundProduct, setFoundProduct] = useState<LookupProduct | null>(null);
  const [upgradeAvailable, setUpgradeAvailable] = useState(false);
  const [recallInfo, setRecallInfo] = useState<RecallCheckResult | null>(null);
  const [checkingRecalls, setCheckingRecalls] = useState(false);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<CategoryKey>("other");
  const [purchasedAt, setPurchasedAt] = useState(toISODate(new Date()));
  const [carSeatExpiry, setCarSeatExpiry] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedReplaceAt, setSavedReplaceAt] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  const computedReplaceAt = useMemo(
    () => computeReplaceAt(category, purchasedAt, carSeatExpiry),
    [category, purchasedAt, carSeatExpiry],
  );

  // Single source of truth for releasing blob URLs: runs whenever the
  // preview changes (picking a new photo, clearing it, rescanning) *and* on
  // unmount if the parent navigates away mid-form — otherwise each replaced
  // preview leaks for the rest of the SPA session.
  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  // Bumped on every new scan/reset so an in-flight recall check from a
  // *previous* scan can't land late and overwrite the banner for whatever
  // the user has since rescanned to (e.g. rescan quickly while the first
  // check-recalls call is still in flight).
  const scanGenerationRef = useRef(0);

  async function handleDetected(code: string) {
    const generation = ++scanGenerationRef.current;
    setBarcode(code);
    setStep("looking-up");
    setLookupError(null);
    setRecallInfo(null);
    setUpgradeAvailable(false);
    try {
      const { data, error } = await supabase.functions.invoke("lookup-product", {
        body: { barcode: code },
      });
      if (generation !== scanGenerationRef.current) return;
      if (error) throw error;
      if (data?.found) {
        const p = data.product as LookupProduct;
        setFoundProduct(p);
        setName(p.name?.trim() || "");
        setBrand(p.brand?.trim() || "");
        const guessedCategory = guessCategory(p);
        setCategory(guessedCategory);
        // Fire the recall check now, while the parent reviews the form —
        // it's shown as a banner below, not blocking the save button.
        void checkRecallsFor(
          p.name?.trim() || "",
          p.brand?.trim() || null,
          guessedCategory,
          generation,
        );
      } else {
        setFoundProduct(null);
        setUpgradeAvailable(Boolean(data?.upgradeAvailable));
        setLookupError(
          data?.upgradeAvailable
            ? "We checked our free databases and couldn't find this product. Upgrade searches additional paid databases too."
            : "We couldn't find this product in any database. Add the details manually below.",
        );
      }
    } catch {
      if (generation !== scanGenerationRef.current) return;
      setFoundProduct(null);
      setLookupError("Lookup failed — check your connection.");
    } finally {
      if (generation === scanGenerationRef.current) setStep("form");
    }
  }

  async function checkRecallsFor(
    productName: string,
    brandName: string | null,
    categoryKey: CategoryKey,
    generation: number,
  ) {
    if (!productName.trim()) return;
    setCheckingRecalls(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-recalls", {
        body: { name: productName, brand: brandName ?? undefined, category: categoryKey },
      });
      if (generation !== scanGenerationRef.current) return;
      if (error) throw error;
      setRecallInfo(data as RecallCheckResult);
    } catch {
      // Fail silently — a recall-check hiccup shouldn't block the scan flow.
      // The parent can still check Recall Radar / the daily sync catches it.
      if (generation === scanGenerationRef.current) setRecallInfo(null);
    } finally {
      if (generation === scanGenerationRef.current) setCheckingRecalls(false);
    }
  }

  async function submitManualCatalogEntry(
    scannedBarcode: string,
    productName: string,
    brandName: string,
    categoryLabel: string,
    photo: File | null,
  ) {
    let imageUrl: string | undefined;
    if (photo) {
      const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${scannedBarcode}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("product-photos")
        .upload(path, photo, { contentType: photo.type });
      if (uploadErr) throw uploadErr;
      imageUrl = supabase.storage.from("product-photos").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.functions.invoke("lookup-product", {
      body: {
        barcode: scannedBarcode,
        manualEntry: {
          name: productName,
          brand: brandName || undefined,
          category: categoryLabel,
          imageUrl,
        },
      },
    });
    if (error) throw error;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give your product a name");
      return;
    }
    if (category === "car_seat" && !carSeatExpiry) {
      toast.error("Add the car seat's manufacturer expiry date");
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const nowIso = new Date().toISOString();
      const { data: inserted, error } = await supabase
        .from("products")
        .insert({
          user_id: u.user.id,
          child_id: activeChildId,
          name: name.trim(),
          brand: brand.trim() || null,
          category: CATEGORY_BY_KEY[category].label,
          barcode: barcode || null,
          purchased_at: purchasedAt ? new Date(purchasedAt).toISOString() : null,
          added_at: nowIso,
          replace_at: computedReplaceAt || null,
          // We already have a fresh answer from check-recalls — no need to
          // wait for tomorrow's daily sync to flag it.
          recalled: recallInfo?.recalled ?? false,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      const productId = (inserted as { id: string } | null)?.id;
      if (productId) {
        lookupAndSaveGuidelines({ data: { productId } }).catch((err) =>
          console.warn(
            "[guidelines] lookup failed:",
            err instanceof Error ? err.message : "unknown",
          ),
        );
      }
      // Manual entry (we scanned a barcode nothing recognized): submit it to
      // the shared catalog so the *next* scan of this barcode — by anyone —
      // resolves instantly instead of hitting every database again. Fails
      // open: a catalog-submission hiccup shouldn't block the parent's own
      // save, which already succeeded above.
      if (!foundProduct && barcode) {
        submitManualCatalogEntry(
          barcode,
          name.trim(),
          brand.trim(),
          CATEGORY_BY_KEY[category].label,
          photoFile,
        ).catch((err) =>
          console.warn(
            "[scan] manual catalog submission failed:",
            err instanceof Error ? err.message : "unknown",
          ),
        );
      }
      setSavedReplaceAt(computedReplaceAt || null);
      setStep("success");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  function resetForAnother() {
    scanGenerationRef.current++;
    setStep("scanning");
    setBarcode("");
    setFoundProduct(null);
    setUpgradeAvailable(false);
    setRecallInfo(null);
    setCheckingRecalls(false);
    setLookupError(null);
    setName("");
    setBrand("");
    setCategory("other");
    setPurchasedAt(toISODate(new Date()));
    setCarSeatExpiry("");
    setSavedReplaceAt(null);
    setPhotoFile(null);
    setPhotoPreviewUrl(null); // the useEffect above revokes the outgoing blob URL
  }

  function handlePhotoSelect(file: File | null) {
    setPhotoFile(file);
    setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null); // the useEffect above revokes the outgoing blob URL
  }

  // Gate
  if (subLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isPro) {
    return (
      <div className="flex min-h-screen flex-col bg-background pb-16">
        <Header />
        <main className="flex-1 px-5 sm:px-6">
          <div className="mx-auto max-w-md rounded-3xl border border-border bg-card px-6 py-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Barcode scanner is a Pro feature
            </h2>
            <p className="mt-2 font-body text-sm text-muted-foreground">
              Everything in free, plus expert features, tips and tricks, safety insights, and
              pediatrician-reviewed guidance. Try free for 7 days.
            </p>
            <Button
              asChild
              className="mt-6 h-12 w-full rounded-full font-body text-sm font-semibold"
            >
              <Link to="/pricing">Start free trial</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-16">
      <Header />
      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md">
          {step === "scanning" && <ScanView onDetected={handleDetected} />}
          {step === "looking-up" && (
            <div className="rounded-3xl bg-card border border-border px-6 py-12 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              <p className="mt-4 font-body text-sm text-muted-foreground">
                Looking up barcode <span className="font-mono">{barcode}</span>…
              </p>
            </div>
          )}
          {step === "form" && (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="rounded-3xl bg-card border border-border p-5">
                <div className="flex items-start gap-3">
                  {foundProduct?.imageUrl ? (
                    <img
                      src={foundProduct.imageUrl}
                      alt=""
                      className="h-16 w-16 rounded-xl object-cover border border-border"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
                      <PackageSearch className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-xs uppercase tracking-wide text-muted-foreground">
                      Barcode
                    </p>
                    <p className="font-mono text-sm">{barcode}</p>
                    {foundProduct ? (
                      <p className="mt-1 font-body text-xs text-emerald-700 dark:text-emerald-400">
                        Found — {SOURCE_LABEL[foundProduct.source] ?? foundProduct.source}
                      </p>
                    ) : (
                      <p className="mt-1 font-body text-xs text-amber-700 dark:text-amber-400">
                        {lookupError ?? "Add details manually"}
                      </p>
                    )}
                  </div>
                </div>
                {!foundProduct && (
                  <div className="mt-3 space-y-2">
                    <p className="font-body text-xs text-muted-foreground">
                      Not every product is in the barcode database yet.{" "}
                      <Link
                        to="/products/new"
                        className="font-semibold text-primary underline underline-offset-2"
                      >
                        Try searching by name instead
                      </Link>
                      , or fill in the details below.
                    </p>
                    {upgradeAvailable && (
                      <Link
                        to="/pricing"
                        className="flex items-center gap-1.5 rounded-xl bg-accent/10 px-3 py-2 font-body text-xs font-semibold text-accent"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Pro searches additional paid product
                        databases
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {checkingRecalls && (
                <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-sand/30 px-4 py-3 font-body text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking for active recalls…
                </div>
              )}

              {recallInfo?.recalled && (
                <div className="space-y-2 rounded-3xl border border-destructive/40 bg-destructive/5 p-4">
                  <div className="flex items-center gap-2 font-display text-sm font-semibold text-destructive">
                    <AlertTriangle className="h-4 w-4" /> Active recall found
                  </div>
                  {recallInfo.recalls.map((r) => (
                    <div key={`${r.source}-${r.id}`} className="rounded-2xl bg-card/60 p-3">
                      <p className="font-body text-sm font-semibold text-foreground">{r.title}</p>
                      <p className="mt-1 font-body text-xs text-muted-foreground">{r.reason}</p>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 font-body text-xs font-semibold text-primary underline underline-offset-2"
                      >
                        View official recall notice <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {recallInfo && !recallInfo.recalled && !checkingRecalls && (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-600/20 bg-emerald-50 px-4 py-3 font-body text-xs text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" /> No active CPSC or NHTSA recalls found for
                  this product.
                </div>
              )}

              <Field label="Product name" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Avent Soothie pacifier"
                  className="h-12 rounded-2xl bg-card px-4 font-body text-base"
                  maxLength={120}
                />
              </Field>

              <Field label="Brand">
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="h-12 rounded-2xl bg-card px-4 font-body text-base"
                  maxLength={80}
                />
              </Field>

              <Field label="Category" required>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_ORDER.map((k) => {
                    const active = category === k;
                    return (
                      <button
                        type="button"
                        key={k}
                        onClick={() => setCategory(k)}
                        className={
                          active
                            ? "rounded-2xl border border-primary bg-primary px-3 py-2.5 text-left font-body text-sm font-semibold text-primary-foreground"
                            : "rounded-2xl border border-border bg-card px-3 py-2.5 text-left font-body text-sm text-foreground"
                        }
                      >
                        {CATEGORY_BY_KEY[k].label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {!foundProduct && (
                <Field label="Photo (optional)">
                  <div className="flex items-center gap-3">
                    <input
                      id="product-photo-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handlePhotoSelect(e.target.files?.[0] ?? null)}
                    />
                    {photoPreviewUrl ? (
                      <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-border">
                        <img src={photoPreviewUrl} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handlePhotoSelect(null)}
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById("product-photo-input")?.click()}
                        className="rounded-2xl font-body text-sm"
                      >
                        <ImagePlus className="mr-2 h-4 w-4" /> Add photo
                      </Button>
                    )}
                  </div>
                  <p className="font-body text-xs text-muted-foreground">
                    Helps other parents recognize this product next time it's scanned.
                  </p>
                </Field>
              )}

              <Field label="Purchase date" required>
                <Input
                  type="date"
                  value={purchasedAt}
                  onChange={(e) => setPurchasedAt(e.target.value)}
                  className="h-12 rounded-2xl bg-card px-4 font-body text-base"
                />
              </Field>

              {category === "car_seat" && (
                <Field label="Manufacturer expiry date" required>
                  <Input
                    type="date"
                    value={carSeatExpiry}
                    onChange={(e) => setCarSeatExpiry(e.target.value)}
                    className="h-12 rounded-2xl bg-card px-4 font-body text-base"
                  />
                </Field>
              )}

              {computedReplaceAt && (
                <div className="rounded-2xl bg-sand/60 px-4 py-3 font-body text-sm text-foreground/80">
                  Replace by{" "}
                  <span className="font-semibold">
                    {new Date(computedReplaceAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={resetForAnother}
                  className="h-12 flex-1 rounded-full font-body text-sm"
                >
                  Rescan
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-12 flex-[2] rounded-full bg-primary font-body text-sm font-semibold"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add to my baby's profile"
                  )}
                </Button>
              </div>
            </form>
          )}
          {step === "success" && (
            <div className="rounded-3xl bg-card border border-border px-6 py-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">Logged 🌙</h2>
              <p className="mt-2 font-body text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{name}</span>
                {brand ? <> by {brand}</> : null} saved to your products.
              </p>
              <div className="mt-5 rounded-2xl bg-sand/60 px-4 py-3 font-body text-sm text-foreground/80">
                {savedReplaceAt ? (
                  <>
                    Replacement reminder set for{" "}
                    <span className="font-semibold">
                      {new Date(savedReplaceAt).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    .
                  </>
                ) : (
                  <>
                    No automatic reminder for this category — we'll keep it in your products list.
                  </>
                )}
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <Button
                  onClick={resetForAnother}
                  className="h-12 w-full rounded-full bg-primary font-body text-sm font-semibold"
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Scan another
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-12 w-full rounded-full font-body text-sm"
                >
                  <Link to="/products">Back to products</Link>
                </Button>
              </div>
            </div>
          )}
          <ProductInfoFooter className="text-center" />
        </div>
      </main>
    </div>
  );

  function Header() {
    return (
      <header className="px-5 pt-8 pb-4 sm:px-6">
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
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
            Scan a barcode
          </h1>
          <p className="mt-1.5 font-body text-sm text-muted-foreground">
            Point at any UPC/EAN — we search food, baby-gear, and general product databases.
          </p>
        </div>
      </header>
    );
  }
}

function ScanView({ onDetected }: { onDetected: (code: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState(false);

  function handleDetected(code: string) {
    if (detected) return;
    setDetected(true);
    onDetected(code);
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-black">
        <BarcodeScannerView
          active={!detected}
          onDetected={handleDetected}
          onError={setError}
          className="relative h-full w-full"
        />
        <div className="pointer-events-none absolute inset-x-10 top-1/2 h-px -translate-y-1/2 bg-primary/80" />
        <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/40" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">
          <Camera className="h-3 w-3" /> Live
        </div>
      </div>
      {error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 font-body text-sm text-destructive">
          {error}. Check camera permissions and try again.
        </div>
      ) : (
        <p className="text-center font-body text-xs text-muted-foreground">
          Hold steady — we'll capture it automatically.
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
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
