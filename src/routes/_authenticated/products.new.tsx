import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Baby, Bed, Milk, ShieldCheck, Sparkles, Wind, Brush, ScanLine, Tent, Armchair, Music, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { PhotoUpload } from "@/components/PhotoUpload";
import { useProGate } from "@/hooks/useProGate";
import { useActiveChild } from "@/hooks/useActiveChild";


export const Route = createFileRoute("/_authenticated/products/new")({
  component: NewProductPage,
  head: () => ({ meta: [{ title: "Add product — Safe & Sound" }] }),
});

type CategoryKey =
  | "car_seat"
  | "pacifier"
  | "crib"
  | "formula"
  | "breast_milk"
  | "swaddle"
  | "toothbrush"
  | "pack_n_play"
  | "carrier"
  | "bouncer"
  | "swing";

const CATEGORIES: { key: CategoryKey; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { key: "car_seat", label: "Car seat", icon: ShieldCheck, hint: "We'll use the manufacturer expiry date" },
  { key: "pacifier", label: "Pacifier", icon: Baby, hint: "Replace every 6 weeks" },
  { key: "crib", label: "Crib", icon: Bed, hint: "No automatic reminder" },
  { key: "formula", label: "Formula (opened)", icon: Milk, hint: "Use within 1 month of opening" },
  { key: "breast_milk", label: "Breast milk (fridge)", icon: Milk, hint: "Use within 4 days" },
  { key: "swaddle", label: "Swaddle", icon: Wind, hint: "Size up at the next weight milestone" },
  { key: "toothbrush", label: "Toothbrush", icon: Brush, hint: "Replace every 3 months" },
  { key: "pack_n_play", label: "Pack 'n Play", icon: Tent, hint: "No automatic reminder" },
  { key: "carrier", label: "Carrier", icon: Baby, hint: "No automatic reminder" },
  { key: "bouncer", label: "Bouncer", icon: Armchair, hint: "No automatic reminder" },
  { key: "swing", label: "Baby swing", icon: Music, hint: "No automatic reminder" },
];

function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
function addMonths(d: Date, n: number) {
  const out = new Date(d);
  out.setMonth(out.getMonth() + n);
  return out;
}
function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function computeReplaceAt(category: CategoryKey | "", purchasedAt: string, carSeatExpiry: string): string {
  if (!purchasedAt && category !== "car_seat") return "";
  const base = purchasedAt ? new Date(purchasedAt) : new Date();
  switch (category) {
    case "pacifier":
      return toISODate(addDays(base, 7 * 6));
    case "toothbrush":
      return toISODate(addMonths(base, 3));
    case "breast_milk":
      return toISODate(addDays(base, 4));
    case "formula":
      return toISODate(addMonths(base, 1));
    case "car_seat":
      return carSeatExpiry || "";
    default:
      return "";
  }
}

function NewProductPage() {
  const navigate = useNavigate();
  const { requirePro } = useProGate();
  const { activeChildId } = useActiveChild();
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<CategoryKey | "">("");
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [purchasedAt, setPurchasedAt] = useState(toISODate(new Date()));
  const [carSeatExpiry, setCarSeatExpiry] = useState("");
  const [swaddleSize, setSwaddleSize] = useState("");

  const computedReplaceAt = useMemo(
    () => computeReplaceAt(category, purchasedAt, carSeatExpiry),
    [category, purchasedAt, carSeatExpiry],
  );

  const activeCategory = CATEGORIES.find((c) => c.key === category);

  function openScanner() {
    setScannerOpen(true);
  }


  function openPhoto(): boolean {
    return requirePro('Photo attachments', 'Attach a photo so you can recognize the exact product later.');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) { toast.error("Pick a category"); return; }
    if (!name.trim()) { toast.error("Give your product a name"); return; }
    if (category === "car_seat" && !carSeatExpiry) { toast.error("Add the car seat's manufacturer expiry date"); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("products").insert({
        user_id: u.user.id,
        child_id: activeChildId,
        name: name.trim(),
        category: activeCategory?.label ?? category,
        barcode: barcode.trim() || null,
        photo_url: photoPath,
        purchased_at: purchasedAt ? new Date(purchasedAt).toISOString() : null,
        replace_at: computedReplaceAt || null,
        size: category === "swaddle" ? swaddleSize.trim() || null : null,
      } as never);
      if (error) throw error;
      toast.success("Saved — we'll remind you 🌙");
      navigate({ to: "/products" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally { setSaving(false); }
  }


  return (
    <div className="flex min-h-screen flex-col bg-background pb-16">
      <header className="px-5 pt-8 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full font-body text-xs">
            <Link to="/products">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Products
            </Link>
          </Button>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Add a product</h1>
          <p className="mt-1.5 font-body text-sm text-muted-foreground">
            Pick a category and we'll calculate when to replace it.
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-6">
          <ProductSearch
            onPick={(r) => {
              if (r.name) setName(r.name);
              if (r.barcode) setBarcode(r.barcode);
              if (r.category) setCategory(r.category);
            }}
          />

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
                className="h-12 rounded-2xl bg-card px-4 font-body text-base flex-1"
              />
              <Button type="button" variant="outline" className="h-12 rounded-2xl px-4" onClick={openScanner}>
                <ScanLine className="h-4 w-4 mr-1" /> Scan
              </Button>
            </div>
          </Field>

          <Field label="Photo">
            <div onClickCapture={(e) => { if (!photoPath && !openPhoto()) { e.stopPropagation(); e.preventDefault(); } }}>
              <PhotoUpload value={photoPath} onChange={setPhotoPath} prefix="product" />
            </div>
          </Field>


          <Field label={category === "breast_milk" || category === "formula" ? "Opened / pumped on" : "Purchase date"} required>
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
              <p className="mt-1.5 font-body text-xs text-muted-foreground">
                Usually printed on a sticker on the seat shell.
              </p>
            </Field>
          )}

          {category === "swaddle" && (
            <Field label="Current size / weight">
              <Input
                value={swaddleSize}
                onChange={(e) => setSwaddleSize(e.target.value)}
                placeholder="e.g. 0–3 mo, up to 14 lb"
                maxLength={40}
                className="h-12 rounded-2xl bg-card px-4 font-body text-base"
              />
              <p className="mt-1.5 font-body text-xs text-muted-foreground">
                We'll prompt you to size up at the next weight milestone.
              </p>
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

          <Button
            type="submit"
            disabled={saving}
            className="mt-2 h-12 w-full rounded-full bg-primary font-body text-sm font-semibold"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save product"}
          </Button>
        </form>
      </main>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => { setBarcode(code); toast.success(`Scanned ${code}`); }}
      />
    </div>
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

type SearchResult = {
  name: string;
  brand: string | null;
  barcode: string | null;
  image: string | null;
  category: CategoryKey | "";
};

function guessCategoryFromText(text: string): CategoryKey | "" {
  const hay = text.toLowerCase();
  if (/pacifier|soother|dummy/.test(hay)) return "pacifier";
  if (/toothbrush|tooth-brush/.test(hay)) return "toothbrush";
  if (/infant formula|baby formula|follow-on milk|formula milk|formula/.test(hay)) return "formula";
  if (/swaddle|sleep sack/.test(hay)) return "swaddle";
  if (/car seat|car-seat|carseat/.test(hay)) return "car_seat";
  if (/crib|cot\b/.test(hay)) return "crib";
  if (/pack ?n ?play|playard|play yard/.test(hay)) return "pack_n_play";
  if (/baby carrier|infant carrier|sling|wrap carrier|\bcarrier\b/.test(hay)) return "carrier";
  if (/bouncer/.test(hay)) return "bouncer";
  if (/baby swing|infant swing|\bswing\b/.test(hay)) return "swing";
  return "";
}

function ProductSearch({ onPick }: { onPick: (r: SearchResult) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      const url =
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
        `&search_simple=1&action=process&json=1&page_size=12` +
        `&fields=product_name,brands,code,image_front_small_url,categories,categories_tags,generic_name`;
      const res = await fetch(url);
      const json = await res.json();
      const items: SearchResult[] = (json.products ?? [])
        .map((p: any) => {
          const name = (p.product_name || p.generic_name || "").trim();
          if (!name) return null;
          const hay = [name, p.brands ?? "", p.categories ?? "", (p.categories_tags ?? []).join(" ")].join(" ");
          return {
            name,
            brand: p.brands?.split(",")[0]?.trim() || null,
            barcode: p.code || null,
            image: p.image_front_small_url || null,
            category: guessCategoryFromText(hay),
          } as SearchResult;
        })
        .filter(Boolean)
        .slice(0, 10);
      setResults(items);
    } catch {
      toast.error("Search failed — try again");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setQuery("");
    setResults([]);
    setSearched(false);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div>
        <p className="font-body text-sm font-semibold">Search baby products</p>
        <p className="font-body text-xs text-muted-foreground mt-0.5">
          Find a product by name and we'll fill in the details.
        </p>
      </div>
      <form onSubmit={runSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Avent Soothie, Enfamil, Nuna Pipa"
            className="h-11 rounded-2xl bg-background pl-9 pr-9 font-body text-base"
            maxLength={80}
          />
          {query && (
            <button
              type="button"
              onClick={clear}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button type="submit" disabled={loading || !query.trim()} className="h-11 rounded-2xl px-4">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {searched && !loading && results.length === 0 && (
        <p className="font-body text-xs text-muted-foreground">
          No matches. Try the barcode scanner or fill the form manually below.
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {results.map((r, i) => (
            <li key={`${r.barcode ?? "x"}-${i}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(r);
                  toast.success(`Loaded ${r.name}`);
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-2.5 text-left hover:border-primary/40 transition-colors"
              >
                {r.image ? (
                  <img src={r.image} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0 border border-border" />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Search className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-sm font-semibold">{r.name}</p>
                  <p className="truncate font-body text-xs text-muted-foreground">
                    {[r.brand, r.barcode].filter(Boolean).join(" · ") || "Tap to use"}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

