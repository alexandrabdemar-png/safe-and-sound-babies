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
import { recordRecallInDb } from "@/lib/recallCheck";
import { validateBarcode } from "@/lib/barcodeValidation";
import { DataAsOf } from "@/components/DataAsOf";
import { SeverityBadge } from "@/components/SeverityBadge";
import { ProductInfoFooter } from "@/components/ProductInfoFooter";
import { resolveCarSeatReplaceAt } from "@/lib/carSeatExpiration";
import { evaluateAgeAppropriateness } from "@/lib/ageAppropriateness";
import { isPreviewHost } from "@/lib/previewHost";
import { nextPacifierSizeUpDate } from "@/lib/pacifierSizeUp";

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
  carSeatManufactureDate: string,
): string {
  if (category === "car_seat") return resolveCarSeatReplaceAt(carSeatExpiry, carSeatManufactureDate) ?? "";
  return "";
}

function guessCategory(p: LookupProduct): CategoryKey {
  const hay = [p.category ?? "", p.name ?? ""].join(" ");
  return (guessCategoryFromText(hay) || "other") as CategoryKey;
}

type Step = "scanning" | "looking-up" | "form" | "success";

function ScanPage() {
  const navigate = useNavigate();
  // Paywall re-enabled — the previous TEMP override is removed. Free tier
  // gets the CPSC/NHTSA scan; Pro gets the extended lookup pipeline.
  const { isPro, loading: subLoading } = useSubscription();
  const { activeChildId, activeChild } = useActiveChild();

  const [step, setStep] = useState<Step>("scanning");
  const [barcode, setBarcode] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [foundProduct, setFoundProduct] = useState<LookupProduct | null>(null);
  const [upgradeAvailable, setUpgradeAvailable] = useState(false);
  const [recallInfo, setRecallInfo] = useState<RecallCheckResult | null>(null);
  const [checkingRecalls, setCheckingRecalls] = useState(false);
  // Distinct "couldn't check" state — separate from `recallInfo === null`
  // which is the pre-check idle state. Rendered as an amber banner so the
  // user is never left staring at a green/red-less form when a source down.
  const [recallCheckError, setRecallCheckError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<CategoryKey>("other");
  const [purchasedAt, setPurchasedAt] = useState(toISODate(new Date()));
  const [carSeatExpiry, setCarSeatExpiry] = useState("");
  const [carSeatManufactureDate, setCarSeatManufactureDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedReplaceAt, setSavedReplaceAt] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  const computedReplaceAt = useMemo(
    () => computeReplaceAt(category, purchasedAt, carSeatExpiry, carSeatManufactureDate),
    [category, purchasedAt, carSeatExpiry, carSeatManufactureDate],
  );

  // Age-appropriateness check: warn a parent when a scanned product isn't
  // recommended yet for the active child's *adjusted* age (preemies use
  // corrected age until ~24 months per AAP). We compute the earliest safe
  // start date and, if it's in the future, surface a "Wait until X" banner
  // with the suggested start age — but still let them save it (they may be
  // buying ahead of the recommended start age).
  const ageAppropriateness = useMemo(
    () =>
      evaluateAgeAppropriateness({
        category: CATEGORY_BY_KEY[category],
        dateOfBirth: activeChild?.date_of_birth ?? null,
        dueDate: activeChild?.due_date ?? null,
      }),
    [category, activeChild?.date_of_birth, activeChild?.due_date],
  );

  // Pacifiers size up by age, not weight/height — computed straight from
  // the active child's date of birth (see src/lib/pacifierSizeUp.ts).
  const computedPacifierSizeUp = useMemo(() => {
    if (category !== "pacifier") return "";
    return nextPacifierSizeUpDate(activeChild?.date_of_birth ?? null) ?? "";
  }, [category, activeChild?.date_of_birth]);

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
    setRecallCheckError(null);
    setUpgradeAvailable(false);

    // Reject malformed barcodes before spending an API call on them.
    const validation = validateBarcode(code);
    if (!validation.ok) {
      setFoundProduct(null);
      setLookupError(validation.reason);
      setStep("form");
      return;
    }
    const normalized = validation.barcode;

    try {
      const { data, error } = await supabase.functions.invoke("lookup-product", {
        body: { barcode: normalized },
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
    setRecallCheckError(null);
    try {
      const { data, error } = await supabase.functions.invoke("check-recalls", {
        body: { name: productName, brand: brandName ?? undefined, category: categoryKey },
      });
      if (generation !== scanGenerationRef.current) return;
      if (error) throw error;
      setRecallInfo(data as RecallCheckResult);
    } catch (err) {
      // Do NOT fail silently — the previous version showed no banner at all
      // when the sources were unreachable, which is indistinguishable from
      // "no recall found". Surface an amber "couldn't check" banner so the
      // user makes an informed decision (retry, or verify at cpsc.gov).
      if (generation === scanGenerationRef.current) {
        setRecallInfo(null);
        setRecallCheckError(
          err instanceof Error && err.message
            ? `We couldn't reach the recall databases (${err.message}). Please retry or verify at cpsc.gov/Recalls before continuing.`
            : "We couldn't reach the recall databases. Please retry or verify at cpsc.gov/Recalls before continuing.",
        );
      }
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
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw userErr ?? new Error("Not authenticated");
      const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userData.user.id}/${scannedBarcode}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
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
    if (category === "car_seat" && !carSeatExpiry && !carSeatManufactureDate) {
      toast.error("Add the car seat's expiry date or manufacture date");
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
          product_type: category === "car_seat" ? "car_seat" : "other",
          manufacture_date: category === "car_seat" ? carSeatManufactureDate || null : null,
          // The DB trigger only auto-fills expiration_date from
          // manufacture_date when expiration_date is null — an explicit
          // sticker date needs to be stored directly or the daily
          // expiration-alert cron never engages for it.
          expiration_date: category === "car_seat" ? carSeatExpiry || null : null,
          predicted_sizeup_date: computedPacifierSizeUp || null,
          // Only stamp this if a recall check actually completed — a user
          // can save before/without one finishing, and recallInfo staying
          // null there shouldn't be reported as a synced check.
          recall_checked_at: recallInfo ? nowIso : null,
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
        // check-recalls only returns an ephemeral answer for this screen's
        // banner — it never writes to the shared recalls catalog. Without
        // this, `recalled` would be true but no product_recalls row would
        // ever exist until tomorrow's daily sync, so the product detail
        // page would show "flagged for a recall, but details aren't
        // available yet" in the meantime (the same bug already fixed for
        // the manual/AI-search add flow in recallRecord.functions.ts).
        for (const hit of recallInfo?.recalls ?? []) {
          recordRecallInDb(productId, hit).catch((err) =>
            console.error(
              "[recall-db] failed to persist recall for scanned product",
              productId,
              err,
            ),
          );
        }
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
  // Preview-only paywall bypass so the scanner can be tested end-to-end
  // without a Pro subscription. Matches Lovable's preview host
  // (id-preview--*.lovable.app / *.lovable.dev / localhost) — the published
  // production domain (peace-of-mine.lovable.app + any custom domain) still
  // gets the real paywall.
  const inPreview =
    typeof window !== "undefined" && isPreviewHost(window.location.hostname);
  if (!isPro && !inPreview) {
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
              Everything in free, plus AI-assisted product guidance, tips and tricks, and safety
              insights. Try free for 7 days.
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
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-body text-sm font-semibold text-foreground">{r.title}</p>
                        <SeverityBadge fields={{ title: r.title, hazard: r.reason }} />
                      </div>
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
                  <DataAsOf sources={["cpsc", "nhtsa"]} className="pt-1" />
                </div>
              )}

              {recallCheckError && !checkingRecalls && (
                <div className="space-y-1 rounded-2xl border border-amber-500/40 bg-amber-50 px-4 py-3 font-body text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>{recallCheckError}</span>
                  </div>
                </div>
              )}

              {recallInfo && !recallInfo.recalled && !checkingRecalls && !recallCheckError && (
                <div className="space-y-1 rounded-2xl border border-emerald-600/20 bg-emerald-50 px-4 py-3 font-body text-xs text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      No matching recall found in CPSC or NHTSA at scan time. This is not a
                      guarantee of safety — verify with the manufacturer and cpsc.gov/Recalls
                      before relying on it.
                    </span>
                  </div>
                  <DataAsOf sources={["cpsc", "nhtsa"]} />
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

              {ageAppropriateness?.kind === "too-early" && (
                <div className="space-y-1 rounded-2xl border border-amber-500/40 bg-amber-50 px-4 py-3 font-body text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="font-semibold">
                        Not age-appropriate yet for {activeChild?.name ?? "your baby"}
                      </p>
                      <p>
                        {ageAppropriateness.label} isn't generally recommended until around{" "}
                        <span className="font-semibold">
                          {ageAppropriateness.minAgeMonths} month
                          {ageAppropriateness.minAgeMonths === 1 ? "" : "s"}
                        </span>
                        . Your baby is {ageAppropriateness.currentAgeMonths} month
                        {ageAppropriateness.currentAgeMonths === 1 ? "" : "s"}
                        {ageAppropriateness.adjusted ? " (adjusted)" : ""} — wait until about{" "}
                        <span className="font-semibold">
                          {ageAppropriateness.startDate.toLocaleDateString(undefined, {
                            month: "short",
                            year: "numeric",
                          })}
                        </span>{" "}
                        before use.
                      </p>
                      <p className="text-amber-800/80 dark:text-amber-300/80">
                        You can still save it now — we'll remind you when it's time. General
                        guidance, not a substitute for your pediatrician.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {ageAppropriateness?.kind === "outgrown" && (
                <div className="space-y-1 rounded-2xl border border-amber-500/40 bg-amber-50 px-4 py-3 font-body text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <p>
                      {ageAppropriateness.label} is typically outgrown by{" "}
                      <span className="font-semibold">
                        {ageAppropriateness.maxAgeMonths} months
                      </span>
                      . Check the manufacturer's weight and developmental limits before continuing to use.
                    </p>
                  </div>
                </div>
              )}


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
                <>
                  <Field label="Manufacturer expiry date">
                    <Input
                      type="date"
                      value={carSeatExpiry}
                      onChange={(e) => setCarSeatExpiry(e.target.value)}
                      className="h-12 rounded-2xl bg-card px-4 font-body text-base"
                    />
                  </Field>
                  <Field label="Manufacture date (for hand-me-downs without a legible sticker)">
                    <Input
                      type="date"
                      value={carSeatManufactureDate}
                      onChange={(e) => setCarSeatManufactureDate(e.target.value)}
                      className="h-12 rounded-2xl bg-card px-4 font-body text-base"
                    />
                    <p className="mt-1.5 font-body text-xs text-muted-foreground">
                      {carSeatExpiry
                        ? "Not needed — you already gave the expiry date above."
                        : "Many manufacturers recommend against using a car seat starting around 6 years after manufacture, though exact timelines vary by brand and model. If you don't have the exact expiry date, we'll estimate one from this manufacture date — always confirm against your seat's manual or shell sticker."}
                    </p>
                  </Field>

                  <div className="rounded-2xl bg-accent/10 px-4 py-3 font-body text-xs leading-relaxed text-foreground/80">
                    <span className="font-semibold">Label it:</span> write your name and phone number
                    on the underside or back of the shell. It helps the seat get back to you if it's
                    ever lost, borrowed, or separated from your child — at daycare, a rideshare, or in
                    an accident.
                  </div>
                </>
              )}

              {computedReplaceAt && (
                <div className="rounded-2xl bg-sand/60 px-4 py-3 font-body text-sm text-foreground/80">
                  Estimated replace-by{" "}
                  <span className="font-semibold">
                    {new Date(computedReplaceAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {category === "car_seat" && !carSeatExpiry && carSeatManufactureDate && (
                    <span className="block mt-1 font-body text-xs text-muted-foreground">
                      Estimated from the manufacture date — check the shell sticker for the exact date when you can.
                    </span>
                  )}
                </div>
              )}

              {category === "pacifier" && (
                <div className="rounded-2xl bg-sand/60 px-4 py-3 font-body text-sm text-foreground/80">
                  {computedPacifierSizeUp ? (
                    <>
                      Estimated size-up{" "}
                      <span className="font-semibold">
                        {new Date(computedPacifierSizeUp).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="block mt-1 font-body text-xs text-muted-foreground">
                        Estimated from {activeChild?.name ?? "your child"}'s birth date, based on common
                        0–6mo / 6–18mo / 18mo+ stage sizing — check your specific brand's packaging for
                        its exact age ranges.
                      </span>
                    </>
                  ) : (
                    <span className="font-body text-xs text-muted-foreground">
                      Add your child's date of birth in Profile to get a pacifier size-up reminder.
                    </span>
                  )}
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
