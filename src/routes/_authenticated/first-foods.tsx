import { logError } from "@/lib/sanitize-error";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Pencil,
  Plus,
  ScanLine,
  Search,
  ShieldAlert,
  Utensils,
  Loader2,
  X,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { friendlyError } from "@/lib/errors";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { lookupBarcode } from "@/lib/barcodeLookup";
import { allergensFromTags, collectIngredients, parseIngredients } from "@/lib/foodIngredients";

export const Route = createFileRoute("/_authenticated/first-foods")({
  ssr: false,
  component: FirstFoodsPage,
  head: () => ({ meta: [{ title: "First Foods — Peace of Mine" }] }),
});

import { TOP_ALLERGENS, type Allergen } from "@/lib/topAllergens";
import { useProGate } from "@/hooks/useProGate";

export { TOP_ALLERGENS } from "@/lib/topAllergens";
export type { Allergen } from "@/lib/topAllergens";

// handleSave() below bakes the selected allergen into food_name as a
// " (Peanuts)" style suffix rather than storing it as a separate column —
// this reverses that when opening an existing entry for edit, so re-saving
// doesn't double up the suffix regardless of what was there before.
export function parseFoodName(name: string): { base: string; allergen: Allergen | "" } {
  const match = TOP_ALLERGENS.find((a) => name.endsWith(` (${a})`));
  if (match) return { base: name.slice(0, -(match.length + 3)), allergen: match };
  return { base: name, allergen: "" };
}

/**
 * Which of the top 9 allergens have been logged at least once for this
 * child, derived from the same " (Allergen)" suffix parseFoodName already
 * uses — no new stored field needed. A food only counts if it was actually
 * tagged as an allergen at save time (isAllergen checked + a specific
 * allergen chosen); a food that merely happens to share a name fragment
 * with an allergen doesn't count, since the suffix only exists when the
 * user deliberately tagged it.
 */
export function computeAllergenProgress(foods: { food_name: string }[]): {
  introduced: Allergen[];
  remaining: Allergen[];
} {
  const introducedSet = new Set<Allergen>();
  for (const f of foods) {
    const { allergen } = parseFoodName(f.food_name);
    if (allergen) introducedSet.add(allergen);
  }
  return {
    introduced: TOP_ALLERGENS.filter((a) => introducedSet.has(a)),
    remaining: TOP_ALLERGENS.filter((a) => !introducedSet.has(a)),
  };
}

type Child = {
  id: string;
  name: string;
};

type FoodEntry = {
  id: string;
  child_id: string;
  food_name: string;
  date_introduced: string;
  is_allergen: boolean;
  reaction_notes: string | null;
  created_at: string;
  /** Ingredient list from the scanned package (packaged foods only). */
  ingredients: string | null;
  brand: string | null;
  barcode: string | null;
  is_packaged: boolean | null;
  product_id: string | null;
  products: { recalled: boolean; recall_checked_at: string | null } | null;
};

export function recallStatusFor(
  food: Pick<FoodEntry, "is_packaged" | "brand" | "product_id" | "products">,
): {
  label: string;
  tone: "muted" | "ok" | "warn" | "danger";
} {
  if (food.is_packaged === false) {
    return { label: "Not packaged — not checked for recalls", tone: "muted" };
  }
  if (food.is_packaged === null) {
    return { label: "Not checked — edit to say if it's store-bought", tone: "muted" };
  }
  if (!food.brand?.trim()) {
    return { label: "Can't check for recalls — add brand or scan", tone: "warn" };
  }
  if (!food.product_id || !food.products) {
    return { label: "Not checked — open and save to turn recall checks on", tone: "warn" };
  }
  if (food.products.recalled) {
    return { label: "Possible recall match — check Recall Radar", tone: "danger" };
  }
  if (!food.products.recall_checked_at) {
    return { label: "Recall check pending — runs within 30 minutes", tone: "muted" };
  }
  return { label: "Recall-checked", tone: "ok" };
}

const RECALL_TONE_CLASS = {
  muted: "text-muted-foreground",
  ok: "text-primary",
  warn: "text-destructive",
  danger: "text-destructive font-semibold",
} as const;

function RecallStatusBadge({ food }: { food: FoodEntry }) {
  const { label, tone } = recallStatusFor(food);
  return <p className={`mt-0.5 font-body text-[11px] ${RECALL_TONE_CLASS[tone]}`}>{label}</p>;
}

function FirstFoodsPage() {
  const navigate = useNavigate();
  const [child, setChild] = useState<Child | null>(null);
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [show4DayCard, setShow4DayCard] = useState(false);

  // Form state — editingId is null while adding a new food, or the id of
  // an existing first_foods row while editing one (see openEdit/handleSave).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [foodName, setFoodName] = useState("");
  const [dateIntroduced, setDateIntroduced] = useState(new Date().toISOString().slice(0, 10));
  const [isAllergen, setIsAllergen] = useState(false);
  const [selectedAllergen, setSelectedAllergen] = useState<Allergen | "">("");
  const [reactionNotes, setReactionNotes] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState("");
  const [isPackaged, setIsPackaged] = useState<boolean | null>(null);

  // Packaged-food scanning: the same camera the product scanner uses, but the
  // lookup here is for the ingredient list rather than recall matching.
  const [scanOpen, setScanOpen] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const { requirePro } = useProGate();

  function openAdd() {
    setEditingId(null);
    setFoodName("");
    setDateIntroduced(new Date().toISOString().slice(0, 10));
    setIsAllergen(false);
    setSelectedAllergen("");
    setReactionNotes("");
    setIngredients("");
    setBrand("");
    setBarcode("");
    setIsPackaged(null);
    setShowForm(true);
  }

  function openEdit(f: FoodEntry) {
    const { base, allergen } = parseFoodName(f.food_name);
    setEditingId(f.id);
    setFoodName(base);
    setDateIntroduced(f.date_introduced);
    setIsAllergen(f.is_allergen);
    setSelectedAllergen(f.is_allergen ? allergen : "");
    setReactionNotes(f.reaction_notes ?? "");
    setIngredients(f.ingredients ?? "");
    setBrand(f.brand ?? "");
    setBarcode(f.barcode ?? "");
    setIsPackaged(f.is_packaged ?? null);
    setShowForm(true);
  }

  /**
   * Scanned a pouch/puffs package: pull the product name, brand and printed
   * ingredient list from the free food databases and pre-fill the form. The
   * parent still reviews and saves it, so a wrong or partial match never
   * lands in the log silently. Nothing is saved if the barcode is unknown —
   * they can just type the food name as before.
   */
  async function handleScanned(code: string) {
    setBarcode(code);
    setLookingUp(true);
    try {
      setIsPackaged(true);
      const result = await lookupBarcode(code);
      if (!result) {
        toast.error("We couldn't find that package. You can type the food in instead.");
        openFormIfClosed();
        return;
      }
      const name = result.product_name || result.generic_name || "";
      if (name) setFoodName(name);
      if (result.brands) setBrand(result.brands.split(",")[0]!.trim());
      if (result.ingredients_text) setIngredients(result.ingredients_text);

      const tagged = allergensFromTags(result.allergens_tags);
      if (tagged.length > 0) {
        setIsAllergen(true);
        setSelectedAllergen(tagged[0]!);
        toast.success(
          `${name || "Product"} found — contains ${tagged.join(", ")}. Review before saving.`,
        );
      } else if (result.ingredients_text) {
        toast.success(`${name || "Product"} found with its ingredient list. Review before saving.`);
      } else {
        toast.success(`${name || "Product"} found, but no ingredient list was published.`);
      }
      openFormIfClosed();
    } finally {
      setLookingUp(false);
    }
  }

  function openFormIfClosed() {
    setShowForm(true);
  }

  function startScan() {
    // Scanning a package (and the ingredient capture it fills in) is a Pro
    // feature; typing a food in by hand stays free.
    if (
      !requirePro(
        "Package scanner",
        "Scan a pouch or puffs package and we'll fill in the product, brand and its full ingredient list — and add every ingredient to your baby's profile.",
      )
    )
      return;
    if (!showForm) openAdd();
    setScanOpen(true);
  }

  // Guards every setState/toast in loadData() against firing after the user
  // has already navigated away — e.g. handleSave() below re-calls loadData()
  // as a background refresh after a successful save, unawaited, and if that
  // resolves (with an error) after the user has already tapped "back to
  // Home", an un-guarded toast.error would still fire, appearing on
  // whatever screen they've since navigated to. Reported bug: "Something
  // went wrong on our end" showing up right after adding food and going
  // back to Home, even though the save itself had already succeeded.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function loadData() {
    let activeId: string | null = null;
    try {
      activeId = localStorage.getItem("safesound.activeChildId");
    } catch {}

    const { data: kids } = await supabase
      .from("children")
      .select("id, name")
      .order("created_at", { ascending: true });

    if (!mountedRef.current) return;

    if (!kids?.length) {
      // Age-range caregiver roles never create a child — send them to
      // /profile instead of looping back into onboarding.
      const { data: prof } = await supabase.from("profiles").select("profile_type").maybeSingle();
      const pt = (prof as { profile_type?: string } | null)?.profile_type as
        | import("@/lib/profileType").ProfileType
        | undefined;
      const { usesAgeRangeFlow } = await import("@/lib/profileType");
      if (pt && usesAgeRangeFlow(pt)) {
        navigate({ to: "/profile" });
        return;
      }
      navigate({ to: "/onboarding" });
      return;
    }
    const c = (kids.find((k) => k.id === activeId) ?? kids[0]) as Child;
    setChild(c);

    const { data, error } = await supabase
      .from("first_foods")
      .select(
        "id, child_id, food_name, date_introduced, is_allergen, reaction_notes, created_at, ingredients, brand, barcode, is_packaged, product_id, products(recalled, recall_checked_at)",
      )
      .eq("child_id", c.id)
      .order("date_introduced", { ascending: false })
      .order("created_at", { ascending: false });

    if (!mountedRef.current) return;

    if (error) {
      // Previously silent: a failed read here just left `foods` at its
      // previous value with zero indication anything went wrong — a newly
      // saved food would look like it "didn't save" even though the insert
      // itself (a few lines up in handleSave) had already succeeded.
      logError("[first-foods] failed to load foods:", error.message);
      toast.error(friendlyError(error.message));
    } else if (data) {
      setFoods(data as unknown as FoodEntry[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSave() {
    if (!child) return;
    if (!foodName.trim()) {
      toast.error("Enter a food name.");
      return;
    }

    setSaving(true);
    const finalName =
      isAllergen && selectedAllergen ? `${foodName.trim()} (${selectedAllergen})` : foodName.trim();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error("Sign in to log foods");
      setSaving(false);
      return;
    }

    const isEditing = editingId !== null;
    const shared = {
      food_name: finalName,
      date_introduced: dateIntroduced,
      is_allergen: isAllergen,
      reaction_notes: reactionNotes.trim() || null,
      ingredients: ingredients.trim().slice(0, 4000) || null,
      brand: brand.trim().slice(0, 120) || null,
      barcode: barcode.trim().slice(0, 64) || null,
      is_packaged: isPackaged,
    };
    const { error } = isEditing
      ? await supabase.from("first_foods").update(shared).eq("id", editingId)
      : await supabase.from("first_foods").insert({ child_id: child.id, ...shared });

    if (error) {
      logError("[first-foods] failed to save food:", error.message);
      toast.error(friendlyError(error.message));
      setSaving(false);
      return;
    }

    toast.success(
      isEditing ? `${finalName} updated.` : `${finalName} added to ${child.name}'s food log.`,
    );
    setEditingId(null);
    setFoodName("");
    setDateIntroduced(new Date().toISOString().slice(0, 10));
    setIsAllergen(false);
    setSelectedAllergen("");
    setReactionNotes("");
    setIngredients("");
    setBrand("");
    setBarcode("");
    setIsPackaged(null);
    setShowForm(false);
    if (!isEditing) setShow4DayCard(true);
    setSaving(false);
    // Deliberately not awaited/surfaced as an error toast: the save above
    // already succeeded and the user has already moved on by the time this
    // resolves. Previously this called loadData() (which does toast on
    // failure) unawaited — if the user navigated to Home before this
    // in-flight re-fetch settled, a transient failure here fired a global
    // toast that appeared on whatever screen they'd already navigated to,
    // looking exactly like "hitting back Home broke something" when the
    // save itself was actually fine.
    loadData().catch((err) => {
      logError("[first-foods] background refresh after save failed:", err);
    });
  }

  const filtered = search.trim()
    ? foods.filter((f) => f.food_name.toLowerCase().includes(search.trim().toLowerCase()))
    : foods;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 animate-fade-in">
      {/* Header */}
      <header className="px-5 pt-10 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate({ to: "/tracking" })}
              className="rounded-full p-2 text-muted-foreground hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Utensils className="h-4 w-4" />
              </span>
              <div>
                <h1 className="font-display text-xl font-semibold tracking-tight">First Foods</h1>
                <p className="font-body text-xs text-muted-foreground">{child?.name}</p>
              </div>
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
                onClick={() => (showForm ? setShowForm(false) : openAdd())}
                className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-body text-xs font-semibold text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Add food
              </button>
            </div>
          </div>
          <p className="font-body text-xs leading-relaxed text-muted-foreground">
            A quick log of the first time your baby tries each food, and any reactions. Scan a pouch
            or puffs package and we'll fill in the product and its full ingredient list. Any
            caregiver with access to {child?.name || "this child"} can add to it too.
          </p>
        </div>
      </header>

      <main className="px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-4">
          {/* Allergen progress */}
          {foods.length > 0 && <AllergenProgressCard foods={foods} />}

          {/* Every ingredient the child has tried, rolled up from scans */}
          {foods.some((f) => f.ingredients) && <IngredientsTriedCard foods={foods} />}

          {/* 4-day wait reminder */}
          {show4DayCard && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 animate-scale-in">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-body text-sm font-semibold text-amber-800">
                    4-day wait reminder
                  </p>
                  <p className="mt-1 font-body text-sm text-amber-700 leading-relaxed">
                    Many pediatricians suggest waiting around 4 days before introducing another new
                    food — confirm this approach with your own doctor.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShow4DayCard(false)}
                  className="shrink-0 rounded-full p-1 text-amber-600 hover:bg-amber-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Add food form */}
          {showForm && (
            <div className="rounded-2xl border border-border/60 bg-card p-4 animate-scale-in">
              <p className="mb-3 font-display text-sm font-semibold">
                {editingId ? "Edit food" : "Add a new food"}
              </p>

              <div className="mb-3">
                <label className="mb-1 block font-body text-xs text-muted-foreground">
                  Food name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sweet potato purée"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 font-body text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="mb-3">
                <label className="mb-1 block font-body text-xs text-muted-foreground">
                  Date introduced
                </label>
                <input
                  type="date"
                  value={dateIntroduced}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDateIntroduced(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 font-body text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="mb-3">
                <label className="flex items-center gap-2 font-body text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAllergen}
                    onChange={(e) => setIsAllergen(e.target.checked)}
                    className="rounded"
                  />
                  <span>This is one of the top 9 allergens</span>
                </label>
              </div>

              {isAllergen && (
                <div className="mb-3">
                  <label className="mb-1 block font-body text-xs text-muted-foreground">
                    Which allergen?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TOP_ALLERGENS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setSelectedAllergen(selectedAllergen === a ? "" : a)}
                        className={`rounded-full border px-3 py-1 font-body text-xs transition-colors ${
                          selectedAllergen === a
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border/60 bg-background text-muted-foreground hover:border-primary/60"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-3">
                <label className="mb-1 block font-body text-xs text-muted-foreground">
                  Is this a store-bought packaged food?
                </label>
                <div className="flex gap-2">
                  {([true, false] as const).map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setIsPackaged(v)}
                      className={`flex-1 rounded-xl border px-3 py-2 font-body text-xs transition-colors ${
                        isPackaged === v
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 bg-background text-muted-foreground"
                      }`}
                    >
                      {v ? "Yes, packaged" : "No (fresh / homemade)"}
                    </button>
                  ))}
                </div>
                {isPackaged === true && !barcode && (
                  <p className="mt-1.5 font-body text-[11px] text-muted-foreground">
                    For the most accurate recall checks,{" "}
                    <button
                      type="button"
                      onClick={startScan}
                      className="font-semibold text-primary"
                    >
                      scan the barcode
                    </button>
                    . Otherwise enter the brand and the product name exactly as printed.
                  </p>
                )}
                {isPackaged === false && (
                  <p className="mt-1.5 font-body text-[11px] text-muted-foreground">
                    Fresh and homemade foods aren't checked against recalls.
                  </p>
                )}
              </div>

              <div className="mb-3">
                <label className="mb-1 block font-body text-xs text-muted-foreground">
                  Brand{" "}
                  <span className="text-muted-foreground/60">
                    {isPackaged ? "(needed for recall checks)" : "(optional)"}
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Happy Baby"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 font-body text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block font-body text-xs text-muted-foreground">
                    Ingredients <span className="text-muted-foreground/60">(optional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={startScan}
                    disabled={lookingUp}
                    className="flex items-center gap-1 font-body text-xs font-semibold text-primary disabled:opacity-60"
                  >
                    <ScanLine className="h-3 w-3" /> Scan package
                  </button>
                </div>
                <textarea
                  placeholder="Scan a package to fill this in, or type the ingredients as printed."
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border/60 bg-background px-3 py-2 font-body text-sm outline-none focus:border-primary"
                />
                {parseIngredients(ingredients).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {parseIngredients(ingredients).map((ing) => (
                      <span
                        key={ing}
                        className="rounded-full bg-muted px-2 py-0.5 font-body text-[11px] text-foreground/70"
                      >
                        {ing}
                      </span>
                    ))}
                  </div>
                )}
                {barcode && (
                  <p className="mt-1.5 font-body text-[11px] text-muted-foreground">
                    Scanned code {barcode} — please check the name and ingredients match the package
                    before saving.
                  </p>
                )}
              </div>

              <div className="mb-4">
                <label className="mb-1 block font-body text-xs text-muted-foreground">
                  Reaction notes <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <textarea
                  placeholder="Any reaction to note? e.g. mild rash, no issues, etc."
                  value={reactionNotes}
                  onChange={(e) => setReactionNotes(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-border/60 bg-background px-3 py-2 font-body text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-full bg-primary py-2 font-body text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {saving ? "Saving…" : editingId ? "Save changes" : "Save food"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="rounded-full border border-border/60 px-4 py-2 font-body text-sm text-muted-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Search bar */}
          {foods.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search foods introduced…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-border/60 bg-card py-2.5 pl-9 pr-4 font-body text-sm outline-none focus:border-primary"
              />
            </div>
          )}

          {/* Allergen legend */}
          {foods.some((f) => f.is_allergen) && (
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              <p className="font-body text-xs text-muted-foreground">
                Orange badge = top 9 allergen
              </p>
            </div>
          )}

          {/* Food list */}
          {filtered.length > 0 ? (
            <div className="rounded-3xl border border-border/60 bg-card divide-y divide-border/40">
              {filtered.map((f) => (
                <div key={f.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-body text-sm font-medium text-foreground">{f.food_name}</p>
                      {f.is_allergen && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 font-body text-[10px] font-semibold text-amber-700">
                          <ShieldAlert className="h-2.5 w-2.5" /> Allergen
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-body text-[11px] text-muted-foreground">
                      Introduced{" "}
                      {new Date(f.date_introduced + "T00:00:00").toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    {f.brand && (
                      <p className="mt-0.5 font-body text-[11px] text-muted-foreground">
                        {f.brand}
                      </p>
                    )}
                    <RecallStatusBadge food={f} />

                    {f.reaction_notes && (
                      <p className="mt-1 font-body text-xs text-foreground/70 italic">
                        "{f.reaction_notes}"
                      </p>
                    )}
                    {f.ingredients && (
                      <details className="mt-1.5">
                        <summary className="cursor-pointer font-body text-[11px] font-semibold text-primary">
                          {parseIngredients(f.ingredients).length} ingredients
                        </summary>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {parseIngredients(f.ingredients).map((ing) => (
                            <span
                              key={ing}
                              className="rounded-full bg-muted px-2 py-0.5 font-body text-[10px] text-foreground/70"
                            >
                              {ing}
                            </span>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(f)}
                    aria-label={`Edit ${f.food_name}`}
                    className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : search.trim() ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-8 text-center">
              <p className="font-body text-sm text-muted-foreground">
                No foods found matching "<strong>{search}</strong>"
                {!filtered.find((f) => f.food_name.toLowerCase().includes(search.toLowerCase())) &&
                foods.length > 0
                  ? " — this food hasn't been introduced yet."
                  : "."}
              </p>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-10 text-center animate-scale-in">
              <span style={{ fontSize: 36 }}>🥣</span>
              <p className="mt-3 font-display text-base font-semibold">No foods logged yet</p>
              <p className="mt-1 font-body text-sm text-muted-foreground max-w-xs mx-auto">
                Tap <strong>Add food</strong> to start tracking {child?.name}'s first foods and
                allergen introductions.
              </p>
            </div>
          )}

          {/* Count summary */}
          {foods.length > 0 && (
            <div className="flex gap-3">
              <div className="flex-1 rounded-2xl border border-border/60 bg-card p-3 text-center">
                <p className="font-display text-xl font-semibold">{foods.length}</p>
                <p className="font-body text-[11px] text-muted-foreground">foods tried</p>
              </div>
              <div className="flex-1 rounded-2xl border border-border/60 bg-card p-3 text-center">
                <p className="font-display text-xl font-semibold text-amber-600">
                  {foods.filter((f) => f.is_allergen).length}
                </p>
                <p className="font-body text-[11px] text-muted-foreground">allergens</p>
              </div>
              <div className="flex-1 rounded-2xl border border-border/60 bg-card p-3 text-center">
                <p className="font-display text-xl font-semibold text-destructive">
                  {foods.filter((f) => f.reaction_notes).length}
                </p>
                <p className="font-body text-[11px] text-muted-foreground">with notes</p>
              </div>
            </div>
          )}

          {/* 4-day guidance note */}
          <div className="rounded-2xl bg-muted/40 px-4 py-3">
            <p className="font-body text-xs text-muted-foreground leading-relaxed">
              Many pediatricians suggest introducing one new food at a time and waiting around 4
              days before the next — this helps identify any reactions. Always follow your own
              doctor's guidance.
            </p>
          </div>
        </div>
      </main>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={(code) => {
          void handleScanned(code);
        }}
      />

      <BottomNav />
    </div>
  );
}

/**
 * Rolls every scanned package's ingredient list into one alphabetical list of
 * everything the child has tried, with the foods each ingredient came from.
 * Package data can be incomplete or out of date, so the label is still the
 * source of truth — that caveat is shown to the parent.
 */
function IngredientsTriedCard({
  foods,
}: {
  foods: { ingredients?: string | null; food_name?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const items = collectIngredients(foods);
  if (items.length === 0) return null;
  const shown = open ? items : items.slice(0, 12);

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-4">
      <p className="font-body text-sm font-semibold">{items.length} ingredients tried</p>
      <p className="mt-0.5 font-body text-[11px] text-muted-foreground">
        From the packaged foods you've scanned. Always check the label itself — package data can be
        incomplete or change.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {shown.map((i) => (
          <span
            key={i.name}
            title={i.foods.join(", ")}
            className="rounded-full bg-muted px-2 py-0.5 font-body text-[11px] text-foreground/70"
          >
            {i.name}
          </span>
        ))}
      </div>
      {items.length > 12 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-2.5 font-body text-xs font-semibold text-primary"
        >
          {open ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

/**
 * "N of 9 top allergens introduced" — turns the free-form food log into an
 * at-a-glance checklist against the AAP's top 9 allergens (the same list
 * TOP_ALLERGENS/the add-food form already uses), so a parent can see what's
 * left without scrolling the whole list and manually checking each name.
 */
function AllergenProgressCard({ foods }: { foods: { food_name: string }[] }) {
  const { introduced, remaining } = computeAllergenProgress(foods);
  const total = TOP_ALLERGENS.length;
  const pct = Math.round((introduced.length / total) * 100);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-body text-sm font-semibold text-foreground">Allergen progress</p>
        <p className="font-body text-xs font-semibold text-primary">
          {introduced.length} of {total}
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {introduced.map((a) => (
          <span
            key={a}
            className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-body text-[11px] font-medium text-primary"
          >
            <Check className="h-2.5 w-2.5" /> {a}
          </span>
        ))}
        {remaining.map((a) => (
          <span
            key={a}
            className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 font-body text-[11px] text-muted-foreground"
          >
            {a}
          </span>
        ))}
      </div>
      {remaining.length === 0 ? (
        <p className="mt-3 font-body text-xs text-muted-foreground">
          All top 9 allergens have been introduced at least once. Keep offering them regularly to
          maintain tolerance — check with your pediatrician on how often.
        </p>
      ) : (
        <p className="mt-3 font-body text-xs text-muted-foreground">
          Tag a food as an allergen when you log it to track it here. Always introduce allergens one
          at a time and follow your pediatrician's guidance, especially for a child with a family
          history of allergies.
        </p>
      )}
    </div>
  );
}
