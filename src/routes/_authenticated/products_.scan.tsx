import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Edit2,
  Loader2,
  Lock,
  Package,
  PackageSearch,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscription } from "@/hooks/useSubscription";
import { useActiveChild } from "@/hooks/useActiveChild";
import { CATEGORIES, CATEGORY_BY_KEY, guessCategoryFromText, type CategoryKey } from "@/lib/productCategories";
import { lookupBarcode, type BarcodeResult } from "@/lib/barcodeLookup";
import { checkRecallsForProduct, type RecallHit } from "@/lib/recallCheck";
import { lookupAndSaveGuidelines } from "@/lib/guidelines.functions";

export const Route = createFileRoute("/_authenticated/products_/scan")({
  ssr: false,
  component: ScanPage,
  head: () => ({ meta: [{ title: "Scan a barcode — Peace of Mine" }] }),
});

const SCANNER_ID = "pom-barcode-scanner-page";
const CATEGORY_ORDER: CategoryKey[] = CATEGORIES.map((c) => c.key);

const FORMATS = [
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
];

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

type Step = "scanning" | "looking-up" | "confirm" | "recall-warning" | "form" | "saving" | "success";

function ScanPage() {
  const navigate = useNavigate();
  const { isPro, loading: subLoading } = useSubscription();
  const { activeChildId } = useActiveChild();

  const [step, setStep] = useState<Step>("scanning");
  const [barcode, setBarcode] = useState("");
  const [lookupResult, setLookupResult] = useState<BarcodeResult | null>(null);
  const [recallHit, setRecallHit] = useState<RecallHit | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<CategoryKey>("other");
  const [purchasedAt, setPurchasedAt] = useState(toISODate(new Date()));
  const [carSeatExpiry, setCarSeatExpiry] = useState("");
  const [savedReplaceAt, setSavedReplaceAt] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const detectedRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Start scanner on mount
  useEffect(() => {
    if (step !== "scanning") return;
    detectedRef.current = false;
    setCameraError(null);

    const timer = setTimeout(async () => {
      const el = document.getElementById(SCANNER_ID);
      if (!el) return;
      try {
        const scanner = new Html5Qrcode(SCANNER_ID, { formatsToSupport: FORMATS, verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 260, height: 130 }, aspectRatio: 1.4 },
          (decodedText) => {
            if (detectedRef.current) return;
            detectedRef.current = true;
            scanner.stop().catch(() => {});
            scannerRef.current = null;
            handleDetected(decodedText);
          },
          () => {},
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")) {
          setCameraError("Camera access denied. Allow camera in your browser settings and reload.");
        } else {
          setCameraError("Could not start camera. Check permissions and try again.");
        }
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [step]);

  async function handleDetected(code: string) {
    setBarcode(code);
    setStep("looking-up");
    setNotFound(false);
    setLookupResult(null);
    setRecallHit(null);

    const result = await lookupBarcode(code);

    if (!result) {
      // Not found — open manual form with barcode pre-filled
      setNotFound(true);
      setName("");
      setBrand("");
      setCategory("other");
      setPurchasedAt(toISODate(new Date()));
      setStep("form");
      return;
    }

    setLookupResult(result);

    const detectedCategory = (guessCategoryFromText(result.rawText) || "other") as CategoryKey;
    setName(result.name);
    setBrand(result.brand ?? "");
    setCategory(detectedCategory);

    // Run recall check in parallel before showing confirm
    const recall = await checkRecallsForProduct(`${result.name} ${result.brand ?? ""}`);
    setRecallHit(recall);

    if (recall) {
      setStep("recall-warning");
    } else {
      setStep("confirm");
    }
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("Give your product a name"); return; }
    if (category === "car_seat" && !carSeatExpiry) {
      toast.error("Add the car seat's manufacturer expiry date");
      return;
    }
    setStep("saving");
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const replaceAt = category === "car_seat" ? (carSeatExpiry ? new Date(carSeatExpiry).toISOString() : null) : null;
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
          added_at: new Date().toISOString(),
          replace_at: replaceAt,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      const productId = (inserted as { id: string } | null)?.id;
      if (productId) {
        lookupAndSaveGuidelines({ data: { productId } }).catch((err) =>
          console.warn("[guidelines] lookup failed:", err instanceof Error ? err.message : "unknown"),
        );
      }
      setSavedReplaceAt(replaceAt);
      setStep("success");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
      setStep("form");
    }
  }

  function proceedToForm() {
    setStep("form");
  }

  function resetForAnother() {
    setStep("scanning");
    setBarcode("");
    setLookupResult(null);
    setRecallHit(null);
    setNotFound(false);
    setName("");
    setBrand("");
    setCategory("other");
    setPurchasedAt(toISODate(new Date()));
    setCarSeatExpiry("");
    setSavedReplaceAt(null);
  }

  // ── Pro gate ──────────────────────────────────────────────────────────────
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
        <PageHeader />
        <main className="flex-1 px-5 sm:px-6">
          <div className="mx-auto max-w-md rounded-3xl border border-border bg-card px-6 py-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Barcode scanner is a Pro feature
            </h2>
            <p className="mt-2 font-body text-sm text-muted-foreground">
              Start a free 7-day trial to scan any baby product and get instant safety info.
            </p>
            <Button asChild className="mt-6 h-12 w-full rounded-full font-body text-sm font-semibold">
              <Link to="/pricing">Start free trial</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-background pb-16">
      <PageHeader />
      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-5">

          {/* ── Scanning ── */}
          {step === "scanning" && (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-3xl bg-black">
                <div id={SCANNER_ID} className="w-full" style={{ minHeight: 300 }} />
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 font-body text-xs text-white">
                  <Camera className="h-3 w-3" /> Live
                </div>
              </div>
              {cameraError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 font-body text-sm text-destructive">
                  {cameraError}
                </div>
              ) : (
                <p className="text-center font-body text-xs text-muted-foreground">
                  Hold steady — point at any UPC or EAN barcode.
                </p>
              )}
            </div>
          )}

          {/* ── Looking up ── */}
          {step === "looking-up" && (
            <div className="rounded-3xl border border-border bg-card px-6 py-12 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              <p className="mt-4 font-body text-sm text-muted-foreground">
                Searching product databases…
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground/60">{barcode}</p>
            </div>
          )}

          {/* ── Recall warning (must see before form) ── */}
          {step === "recall-warning" && recallHit && (
            <div className="space-y-4">
              <div className="rounded-3xl border-2 border-destructive/50 bg-destructive/8 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <h2 className="font-display text-base font-semibold text-destructive">
                    Recall Alert
                  </h2>
                </div>
                <p className="font-body text-sm font-semibold text-foreground">{recallHit.title}</p>
                <p className="mt-2 font-body text-sm text-foreground/80">{recallHit.reason}</p>
                {recallHit.url && (
                  <a
                    href={recallHit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 font-body text-xs font-semibold text-destructive underline underline-offset-2"
                  >
                    View full recall notice <ArrowUpRight className="h-3 w-3" />
                  </a>
                )}
              </div>
              <p className="font-body text-xs text-muted-foreground text-center">
                You can still save this product to your list — but please read the recall notice first.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetForAnother} className="h-12 flex-1 rounded-full font-body text-sm">
                  Scan another
                </Button>
                <Button onClick={proceedToForm} className="h-12 flex-[2] rounded-full bg-primary font-body text-sm font-semibold">
                  I've read the recall — continue
                </Button>
              </div>
            </div>
          )}

          {/* ── Confirmation card ── */}
          {step === "confirm" && lookupResult && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-start gap-3">
                  {lookupResult.image ? (
                    <img
                      src={lookupResult.image}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-base font-semibold leading-snug">{lookupResult.name}</p>
                    {lookupResult.brand && (
                      <p className="mt-0.5 font-body text-sm text-muted-foreground">{lookupResult.brand}</p>
                    )}
                    <p className="mt-1 font-body text-[11px] text-muted-foreground/60">
                      Category: {CATEGORY_BY_KEY[category]?.label ?? category}
                    </p>
                    <p className="mt-0.5 font-body text-[11px] text-muted-foreground/50">
                      Data from {lookupResult.source}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={proceedToForm}
                    className="h-10 flex-1 rounded-full font-body text-xs gap-1.5"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit details
                  </Button>
                  <Button
                    onClick={handleSave}
                    className="h-10 flex-[2] rounded-full bg-primary font-body text-sm font-semibold"
                  >
                    Save product
                  </Button>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={resetForAnother}
                className="w-full rounded-full font-body text-xs text-muted-foreground"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Scan a different product
              </Button>
            </div>
          )}

          {/* ── Edit / manual form ── */}
          {step === "form" && (
            <div className="space-y-6">
              {notFound && (
                <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
                  <p className="font-body text-sm text-foreground/80">
                    We couldn't find this product automatically — fill in the details below and we'll track it for you.
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground/60">{barcode}</p>
                </div>
              )}
              {!notFound && lookupResult && (
                <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
                  <div className="flex items-center gap-2">
                    {lookupResult.image ? (
                      <img src={lookupResult.image} alt="" className="h-10 w-10 rounded-lg object-cover border border-border shrink-0" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <PackageSearch className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-body text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        Found — edit any field before saving
                      </p>
                      <p className="font-body text-[11px] text-muted-foreground/60">
                        Data from {lookupResult.source}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Field label="Product name" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Halo SleepSack Micro-Fleece"
                  className="h-12 rounded-2xl bg-card px-4 font-body text-base"
                  maxLength={120}
                  autoFocus={notFound}
                />
              </Field>

              <Field label="Brand">
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. HALO Innovations"
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
                            : "rounded-2xl border border-border bg-card px-3 py-2.5 text-left font-body text-sm text-foreground hover:bg-muted/50"
                        }
                      >
                        {CATEGORY_BY_KEY[k].label}
                      </button>
                    );
                  })}
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
                <Field label="Manufacturer expiry date" required>
                  <Input
                    type="date"
                    value={carSeatExpiry}
                    onChange={(e) => setCarSeatExpiry(e.target.value)}
                    className="h-12 rounded-2xl bg-card px-4 font-body text-base"
                  />
                </Field>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForAnother}
                  className="h-12 flex-1 rounded-full font-body text-sm"
                >
                  Rescan
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  className="h-12 flex-[2] rounded-full bg-primary font-body text-sm font-semibold"
                >
                  Save product
                </Button>
              </div>
            </div>
          )}

          {/* ── Saving ── */}
          {step === "saving" && (
            <div className="rounded-3xl border border-border bg-card px-6 py-12 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              <p className="mt-4 font-body text-sm text-muted-foreground">Saving product…</p>
            </div>
          )}

          {/* ── Success ── */}
          {step === "success" && (
            <div className="rounded-3xl border border-border bg-card px-6 py-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">Saved</h2>
              <p className="mt-2 font-body text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{name}</span>
                {brand ? <> by {brand}</> : null} added to your products.
              </p>
              {savedReplaceAt && (
                <div className="mt-4 rounded-2xl bg-sand/60 px-4 py-3 font-body text-sm text-foreground/80">
                  Replacement reminder set for{" "}
                  <span className="font-semibold">
                    {new Date(savedReplaceAt).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  .
                </div>
              )}
              <div className="mt-6 flex flex-col gap-2">
                <Button
                  onClick={resetForAnother}
                  className="h-12 w-full rounded-full bg-primary font-body text-sm font-semibold"
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Scan another
                </Button>
                <Button asChild variant="outline" className="h-12 w-full rounded-full font-body text-sm">
                  <Link to="/products">Back to products</Link>
                </Button>
              </div>
            </div>
          )}
        {/* Minimized disclaimer */}
        <p className="mt-6 font-body text-[11px] leading-relaxed text-muted-foreground/70 text-center">
          Recall data sourced from CPSC/FDA databases — may not reflect recent changes. Always verify at{" "}
          <a href="https://www.recalls.gov" target="_blank" rel="noopener noreferrer" className="underline">recalls.gov</a>.
          Peace of Mine is for informational purposes only — not a substitute for official recalls or medical advice.
        </p>
        </div>
      </main>
    </div>
  );
}

function PageHeader() {
  return (
    <header className="px-5 pt-8 pb-4 sm:px-6">
      <div className="mx-auto max-w-md">
        <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full font-body text-xs">
          <Link to="/products">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Products
          </Link>
        </Button>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Scan a barcode</h1>
        <p className="mt-1.5 font-body text-sm text-muted-foreground">
          Works with formula, car seats, pacifiers, and most baby gear.
        </p>
      </div>
    </header>
  );
}

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
