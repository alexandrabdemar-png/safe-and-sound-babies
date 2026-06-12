import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useZxing } from "react-zxing";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  Lock,
  PackageSearch,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscription } from "@/hooks/useSubscription";
import { useActiveChild } from "@/hooks/useActiveChild";

export const Route = createFileRoute("/_authenticated/products_/scan")({
  component: ScanPage,
  head: () => ({ meta: [{ title: "Scan a barcode — Safe & Sound" }] }),
});

import { CATEGORIES, CATEGORY_BY_KEY, guessCategoryFromText, type CategoryKey } from "@/lib/productCategories";
import { lookupAndSaveGuidelines } from "@/lib/guidelines.functions";

const CATEGORY_ORDER: CategoryKey[] = CATEGORIES.map((c) => c.key);

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function computeReplaceAt(category: CategoryKey, _purchasedAt: string, carSeatExpiry: string): string {
  if (category === "car_seat") return carSeatExpiry || "";
  return "";
}

function guessCategory(off: OffProduct): CategoryKey {
  const hay = [
    ...(off.categories_tags ?? []),
    off.categories ?? "",
    off.product_name ?? "",
    off.generic_name ?? "",
  ].join(" ");
  return (guessCategoryFromText(hay) || "other") as CategoryKey;
}


type OffProduct = {
  product_name?: string;
  generic_name?: string;
  brands?: string;
  categories?: string;
  categories_tags?: string[];
  image_front_small_url?: string;
};

type Step = "scanning" | "looking-up" | "form" | "success";

function ScanPage() {
  const navigate = useNavigate();
  const { isPro, loading: subLoading } = useSubscription();
  const { activeChildId } = useActiveChild();

  const [step, setStep] = useState<Step>("scanning");
  const [barcode, setBarcode] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [foundProduct, setFoundProduct] = useState<OffProduct | null>(null);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<CategoryKey>("other");
  const [purchasedAt, setPurchasedAt] = useState(toISODate(new Date()));
  const [carSeatExpiry, setCarSeatExpiry] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedReplaceAt, setSavedReplaceAt] = useState<string | null>(null);

  const computedReplaceAt = useMemo(
    () => computeReplaceAt(category, purchasedAt, carSeatExpiry),
    [category, purchasedAt, carSeatExpiry],
  );

  async function handleDetected(code: string) {
    setBarcode(code);
    setStep("looking-up");
    setLookupError(null);
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
      );
      const json = await res.json();
      if (json.status === 1 && json.product) {
        const p = json.product as OffProduct;
        setFoundProduct(p);
        setName(p.product_name?.trim() || p.generic_name?.trim() || "");
        setBrand(p.brands?.split(",")[0]?.trim() || "");
        setCategory(guessCategory(p));
      } else {
        setFoundProduct(null);
        setLookupError("We couldn't find this product. Add the details manually below.");
      }
    } catch (e) {
      setFoundProduct(null);
      setLookupError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setStep("form");
    }
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
      const { data: inserted, error } = await supabase.from("products").insert({
        user_id: u.user.id,
        child_id: activeChildId,
        name: name.trim(),
        brand: brand.trim() || null,
        category: CATEGORY_BY_KEY[category].label,
        barcode: barcode || null,
        purchased_at: purchasedAt ? new Date(purchasedAt).toISOString() : null,
        added_at: nowIso,
        replace_at: computedReplaceAt || null,
      } as never).select("id").single();
      if (error) throw error;
      const productId = (inserted as { id: string } | null)?.id;
      if (productId) {
        lookupAndSaveGuidelines({ data: { productId } }).catch((err) => console.warn("[guidelines] lookup failed:", err instanceof Error ? err.message : "unknown"));
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
    setStep("scanning");
    setBarcode("");
    setFoundProduct(null);
    setLookupError(null);
    setName("");
    setBrand("");
    setCategory("other");
    setPurchasedAt(toISODate(new Date()));
    setCarSeatExpiry("");
    setSavedReplaceAt(null);
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
              Everything in free, plus expert features, tips and tricks, safety insights, and pediatrician-reviewed guidance. Try free for 7 days.
            </p>
            <Button asChild className="mt-6 h-12 w-full rounded-full font-body text-sm font-semibold">
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
                  {foundProduct?.image_front_small_url ? (
                    <img
                      src={foundProduct.image_front_small_url}
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
                        Found in Open Food Facts
                      </p>
                    ) : (
                      <p className="mt-1 font-body text-xs text-amber-700 dark:text-amber-400">
                        {lookupError ?? "Add details manually"}
                      </p>
                    )}
                  </div>
                </div>
              </div>

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
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save product"}
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
                  <>No automatic reminder for this category — we'll keep it in your products list.</>
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
        </div>
      </main>
    </div>
  );

  function Header() {
    return (
      <header className="px-5 pt-8 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full font-body text-xs">
            <Link to="/products">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Products
            </Link>
          </Button>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
            Scan a barcode
          </h1>
          <p className="mt-1.5 font-body text-sm text-muted-foreground">
            Point at any UPC/EAN. We'll fetch the name from Open Food Facts.
          </p>
        </div>
      </header>
    );
  }
}

function ScanView({ onDetected }: { onDetected: (code: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const { ref } = useZxing({
    paused,
    onDecodeResult(result) {
      setPaused(true);
      onDetected(result.rawValue);
    },
    onError(e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    },
    constraints: {
      audio: false,
      video: { facingMode: "environment" },
    },
  });

  // Stop camera tracks on unmount
  useEffect(() => {
    const node = ref.current;
    return () => {
      const stream = node?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [ref]);

  return (
    <div className="space-y-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-black">
        <video ref={ref} className="h-full w-full object-cover" muted playsInline />
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
