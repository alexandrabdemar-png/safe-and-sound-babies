import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Plus,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { lookupBarcode } from "@/lib/barcodeLookup";
import { friendlyError } from "@/lib/errors";
import { logError } from "@/lib/sanitize-error";
import { useProGate } from "@/hooks/useProGate";
import {
  GROCERY_CATEGORY,
  findExisting,
  groceryStatus,
  groupByWeek,
  type GroceryItem,
} from "@/lib/groceries";

export const Route = createFileRoute("/_authenticated/groceries")({
  ssr: false,
  component: GroceriesPage,
  head: () => ({ meta: [{ title: "Grocery Recall Watch — Peace of Mine" }] }),
});

const TONE: Record<ReturnType<typeof groceryStatus>["tone"], string> = {
  alert: "text-destructive font-semibold",
  ok: "text-primary",
  pending: "text-muted-foreground",
  warn: "text-amber-700",
};

function GroceriesPage() {
  const navigate = useNavigate();
  const { requirePro } = useProGate();
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState("");
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    try {
      if (sessionStorage.getItem("groceries.openAdd")) {
        sessionStorage.removeItem("groceries.openAdd");
        setShowForm(true);
      }
    } catch {
      /* storage unavailable */
    }
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, brand, barcode, purchased_at, created_at, recalled, recall_checked_at")
      .eq("category", GROCERY_CATEGORY)
      .eq("product_type", "food")
      .order("purchased_at", { ascending: false, nullsFirst: false });
    if (!mountedRef.current) return;
    if (error) {
      logError("groceries.load", error);
      toast.error(friendlyError(error));
    } else {
      setItems((data ?? []) as GroceryItem[]);
    }
    setLoading(false);
  }

  function resetForm() {
    setName("");
    setBrand("");
    setBarcode("");
  }

  async function markBought(ids: string[]) {
    if (!ids.length) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("products").update({ purchased_at: now }).in("id", ids);
    if (error) {
      toast.error(friendlyError(error));
      return false;
    }
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, purchased_at: now } : i)));
    return true;
  }

  async function handleSave() {
    const food = {
      name: name.trim().slice(0, 200),
      brand: brand.trim().slice(0, 120) || null,
      barcode: barcode.trim().slice(0, 64) || null,
    };
    if (!food.name) {
      toast.error("Add the product name as it's printed on the package.");
      return;
    }
    if (!food.brand) {
      toast.error("Add the brand — recall notices list foods by brand.");
      return;
    }
    setSaving(true);
    try {
      const existing = findExisting(items, food);
      if (existing) {
        if (await markBought([existing.id])) toast.success(`${existing.name} moved to this week.`);
      } else {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const { data, error } = await supabase
          .from("products")
          .insert({
            user_id: auth.user.id,
            child_id: null,
            name: food.name,
            brand: food.brand,
            barcode: food.barcode,
            category: GROCERY_CATEGORY,
            product_type: "food",
            purchased_at: new Date().toISOString(),
          })
          .select("id, name, brand, barcode, purchased_at, created_at, recalled, recall_checked_at")
          .single();
        if (error) throw error;
        setItems((prev) => [data as GroceryItem, ...prev]);
        toast.success(`${food.name} added — we'll check it for recalls.`);
      }
      resetForm();
    } catch (err) {
      logError("groceries.save", err);
      toast.error(friendlyError(err));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  async function handleRemove(item: GroceryItem) {
    setBusyId(item.id);
    const { error } = await supabase.from("products").delete().eq("id", item.id);
    setBusyId(null);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  async function handleClearOlder(older: GroceryItem[]) {
    const ids = older.map((i) => i.id);
    const { error } = await supabase.from("products").delete().in("id", ids);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    toast.success(`Removed ${ids.length} older item${ids.length === 1 ? "" : "s"}.`);
  }

  function startScan() {
    // Same rule as First Foods: scanning is Pro, typing an item in stays free.
    if (
      !requirePro(
        "Package scanner",
        "Scan a grocery item's barcode and we'll fill in the product and brand for you.",
      )
    )
      return;
    setShowForm(true);
    setScanOpen(true);
  }

  async function handleScanned(code: string) {
    setBarcode(code);
    setLookingUp(true);
    try {
      const result = await lookupBarcode(code);
      if (!result) {
        toast.error("We couldn't find that package. You can type it in instead.");
        return;
      }
      const found = result.product_name || result.generic_name || "";
      if (found) setName(found);
      if (result.brands) setBrand(result.brands.split(",")[0]!.trim());
      toast.success("Found it — check the name and brand match the package, then add it.");
    } finally {
      if (mountedRef.current) setLookingUp(false);
    }
  }

  const weeks = groupByWeek(items);
  const recalledCount = items.filter((i) => i.recalled).length;
  const lastWeek = weeks.find((w) => w.key === "w1");
  const older = weeks.find((w) => w.key === "older");

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 animate-fade-in">
      <header className="px-5 pt-10 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate({ to: "/tracking" })}
              aria-label="Back"
              className="rounded-full p-2 text-muted-foreground hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                <ShoppingBasket className="h-4 w-4" />
              </span>
              <h1 className="font-display text-xl font-semibold tracking-tight">Groceries</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={startScan}
                disabled={lookingUp}
                className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 font-body text-xs font-semibold text-primary disabled:opacity-60"
              >
                {lookingUp ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ScanLine className="h-3.5 w-3.5" />
                )}{" "}
                Scan
              </button>
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-body text-xs font-semibold text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Add item
              </button>
            </div>
          </div>
          <p className="font-body text-xs leading-relaxed text-muted-foreground">
            Add the packaged foods your family buys — snacks, pouches, puffs, formula, pantry
            staples. We check them against FDA food recalls and alert you if one matches. Fresh
            produce and meat aren't covered yet.
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-4">
          {recalledCount > 0 && (
            <Link
              to="/alerts"
              className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4"
            >
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-display text-sm font-semibold text-destructive">
                  {recalledCount === 1
                    ? "1 grocery item may be recalled"
                    : `${recalledCount} grocery items may be recalled`}
                </p>
                <p className="font-body text-xs text-destructive/90">
                  Tap to see the recall and what to do.
                </p>
              </div>
            </Link>
          )}

          {showForm && (
            <div className="rounded-2xl border border-border/60 bg-card p-4 animate-scale-in">
              <p className="mb-3 font-display text-sm font-semibold">Add a grocery item</p>
              <div className="mb-3">
                <label
                  htmlFor="grocery-name"
                  className="mb-1 block font-body text-xs text-muted-foreground"
                >
                  Product name
                </label>
                <input
                  id="grocery-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Organic Oat Puffs, Apple Pouch"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 font-body text-sm"
                />
              </div>
              <div className="mb-3">
                <label
                  htmlFor="grocery-brand"
                  className="mb-1 block font-body text-xs text-muted-foreground"
                >
                  Brand
                </label>
                <input
                  id="grocery-brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="As printed on the package"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 font-body text-sm"
                />
              </div>
              {barcode && (
                <p className="mb-3 font-body text-[11px] text-muted-foreground">
                  Scanned code {barcode} — a recall that lists this code will match even if the name
                  is worded differently.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 font-body text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="rounded-full border border-border px-4 py-2 font-body text-sm text-muted-foreground"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {lastWeek && lastWeek.items.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                const ids = lastWeek.items.map((i) => i.id);
                if (await markBought(ids)) {
                  toast.success(
                    `Moved ${ids.length} item${ids.length === 1 ? "" : "s"} to this week.`,
                  );
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 p-3 font-body text-sm font-medium text-primary"
            >
              <RotateCcw className="h-4 w-4" /> Bought last week's items again
            </button>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card p-6 text-center">
              <ShoppingBasket className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-display text-sm font-semibold">Nothing on your list yet</p>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                After your next shop, add the packaged foods you bought. Next week, one tap moves
                the ones you buy again.
              </p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-4 rounded-full bg-primary px-4 py-2 font-body text-xs font-semibold text-primary-foreground"
              >
                Add your first item
              </button>
            </div>
          ) : (
            weeks.map((week) => (
              <section key={week.key}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="font-display text-sm font-semibold">{week.label}</h2>
                  {week.key === "older" && older ? (
                    <button
                      type="button"
                      onClick={() => void handleClearOlder(older.items)}
                      className="font-body text-xs text-muted-foreground underline"
                    >
                      Remove all
                    </button>
                  ) : (
                    <span className="font-body text-xs text-muted-foreground">
                      {week.items.length} item{week.items.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card">
                  {week.items.map((item) => {
                    const status = groceryStatus(item);
                    return (
                      <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                        <Link
                          to="/products/$id"
                          params={{ id: item.id }}
                          className="min-w-0 flex-1"
                        >
                          <p className="truncate font-body text-sm font-medium">{item.name}</p>
                          {item.brand && (
                            <p className="truncate font-body text-xs text-muted-foreground">
                              {item.brand}
                            </p>
                          )}
                          <p className={`mt-0.5 font-body text-[11px] ${TONE[status.tone]}`}>
                            {status.label}
                          </p>
                        </Link>
                        {week.key !== "w0" && (
                          <button
                            type="button"
                            onClick={() => void markBought([item.id])}
                            aria-label={`Bought ${item.name} again`}
                            className="rounded-full p-2 text-primary hover:bg-primary/10"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleRemove(item)}
                          disabled={busyId === item.id}
                          aria-label={`Remove ${item.name}`}
                          className="rounded-full p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}

          {items.length > 0 && (
            <p className="pb-4 text-center font-body text-[11px] leading-relaxed text-muted-foreground">
              Remove items once they're used up. Anything still on this list keeps being checked.
              Recall checks are a helpful extra, not a guarantee — always follow official recall
              notices.
            </p>
          )}
        </div>
      </main>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={(code) => void handleScanned(code)}
      />
      <BottomNav />
    </div>
  );
}
