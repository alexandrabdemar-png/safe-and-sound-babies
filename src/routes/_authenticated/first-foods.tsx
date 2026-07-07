import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search, ShieldAlert, Utensils, Loader2, X } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { friendlyError } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/first-foods")({
  ssr: false,
  component: FirstFoodsPage,
  head: () => ({ meta: [{ title: "First Foods — Peace of Mine" }] }),
});

const TOP_ALLERGENS = ["Milk", "Eggs", "Fish", "Shellfish", "Tree nuts", "Peanuts", "Wheat", "Soy", "Sesame"] as const;
type Allergen = (typeof TOP_ALLERGENS)[number];

type Child = {
  id: string;
  name: string;
  date_of_birth: string | null;
};

type FoodEntry = {
  id: string;
  child_id: string;
  food_name: string;
  date_introduced: string;
  is_allergen: boolean;
  reaction_notes: string | null;
  created_at: string;
};

function ageMonths(dobStr: string | null) {
  if (!dobStr) return 0;
  const [y, m, d] = dobStr.split("-").map(Number);
  const birth = new Date(y, m - 1, d);
  return Math.floor((Date.now() - birth.getTime()) / (30.44 * 86400000));
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

  // Form state
  const [foodName, setFoodName] = useState("");
  const [dateIntroduced, setDateIntroduced] = useState(new Date().toISOString().slice(0, 10));
  const [isAllergen, setIsAllergen] = useState(false);
  const [selectedAllergen, setSelectedAllergen] = useState<Allergen | "">("");
  const [reactionNotes, setReactionNotes] = useState("");

  async function loadData() {
    let activeId: string | null = null;
    try { activeId = localStorage.getItem("safesound.activeChildId"); } catch {}

    const { data: kids } = await supabase
      .from("children")
      .select("id, name, date_of_birth")
      .order("created_at", { ascending: true });

    if (!kids?.length) { navigate({ to: "/onboarding" }); return; }
    const c = (kids.find((k) => k.id === activeId) ?? kids[0]) as Child;
    setChild(c);

    const { data, error } = await supabase
      .from("first_foods" as any)
      .select("id, child_id, food_name, date_introduced, is_allergen, reaction_notes, created_at")
      .eq("child_id", c.id)
      .order("date_introduced", { ascending: false });

    if (!error && data) setFoods(data as unknown as FoodEntry[]);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleAdd() {
    if (!child) return;
    if (!foodName.trim()) { toast.error("Enter a food name."); return; }

    setSaving(true);
    const finalName = isAllergen && selectedAllergen ? `${foodName.trim()} (${selectedAllergen})` : foodName.trim();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { toast.error("Sign in to log foods"); setSaving(false); return; }

    const { error } = await supabase.from("first_foods" as any).insert({
      child_id: child.id,
      food_name: finalName,
      date_introduced: dateIntroduced,
      is_allergen: isAllergen,
      reaction_notes: reactionNotes.trim() || null,
    });

    if (error) { toast.error(error.message || "Couldn't save — please try again"); setSaving(false); return; }

    toast.success(`${finalName} added to ${child.name}'s food log.`);
    setFoodName(""); setDateIntroduced(new Date().toISOString().slice(0, 10));
    setIsAllergen(false); setSelectedAllergen(""); setReactionNotes("");
    setShowForm(false);
    setShow4DayCard(true);
    setSaving(false);
    loadData();
  }

  const months = ageMonths(child?.date_of_birth ?? null);
  const tooYoung = months < 4;

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
            <button type="button" onClick={() => navigate({ to: "/tracking" })} className="rounded-full p-2 text-muted-foreground hover:bg-muted">
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
            {!tooYoung && (
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="ml-auto flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-body text-xs font-semibold text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Add food
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-4">

          {/* Age gate — under 4 months */}
          {tooYoung ? (
            <div className="rounded-3xl border border-border/60 bg-card p-6 text-center animate-scale-in">
              <span style={{ fontSize: 36 }}>🥑</span>
              <p className="mt-3 font-display text-base font-semibold tracking-tight">First foods are coming</p>
              <p className="mt-2 font-body text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                First foods tracking will be available as {child?.name} grows — many babies begin exploring solids around
                4 to 6 months, though every baby is different. Always follow your pediatrician's guidance.
              </p>
            </div>
          ) : (
            <>
              {/* 4-day wait reminder */}
              {show4DayCard && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 animate-scale-in">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-body text-sm font-semibold text-amber-800">4-day wait reminder</p>
                      <p className="mt-1 font-body text-sm text-amber-700 leading-relaxed">
                        Many pediatricians suggest waiting around 4 days before introducing another new food — confirm
                        this approach with your own doctor.
                      </p>
                    </div>
                    <button type="button" onClick={() => setShow4DayCard(false)} className="shrink-0 rounded-full p-1 text-amber-600 hover:bg-amber-100">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Add food form */}
              {showForm && (
                <div className="rounded-2xl border border-border/60 bg-card p-4 animate-scale-in">
                  <p className="mb-3 font-display text-sm font-semibold">Add a new food</p>

                  <div className="mb-3">
                    <label className="mb-1 block font-body text-xs text-muted-foreground">Food name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sweet potato purée"
                      value={foodName}
                      onChange={(e) => setFoodName(e.target.value)}
                      className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 font-body text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="mb-1 block font-body text-xs text-muted-foreground">Date introduced</label>
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
                      <label className="mb-1 block font-body text-xs text-muted-foreground">Which allergen?</label>
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
                      onClick={handleAdd}
                      disabled={saving}
                      className="flex-1 rounded-full bg-primary py-2 font-body text-sm font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      {saving ? "Saving…" : "Save food"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
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
                  <p className="font-body text-xs text-muted-foreground">Orange badge = top 9 allergen</p>
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
                          Introduced {new Date(f.date_introduced + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                        {f.reaction_notes && (
                          <p className="mt-1 font-body text-xs text-foreground/70 italic">"{f.reaction_notes}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : search.trim() ? (
                <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-8 text-center">
                  <p className="font-body text-sm text-muted-foreground">
                    No foods found matching "<strong>{search}</strong>"
                    {!filtered.find((f) => f.food_name.toLowerCase().includes(search.toLowerCase())) && foods.length > 0
                      ? " — this food hasn't been introduced yet."
                      : "."}
                  </p>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-10 text-center animate-scale-in">
                  <span style={{ fontSize: 36 }}>🥣</span>
                  <p className="mt-3 font-display text-base font-semibold">No foods logged yet</p>
                  <p className="mt-1 font-body text-sm text-muted-foreground max-w-xs mx-auto">
                    Tap <strong>Add food</strong> to start tracking {child?.name}'s first foods and allergen introductions.
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
                    <p className="font-display text-xl font-semibold text-amber-600">{foods.filter((f) => f.is_allergen).length}</p>
                    <p className="font-body text-[11px] text-muted-foreground">allergens</p>
                  </div>
                  <div className="flex-1 rounded-2xl border border-border/60 bg-card p-3 text-center">
                    <p className="font-display text-xl font-semibold text-destructive">{foods.filter((f) => f.reaction_notes).length}</p>
                    <p className="font-body text-[11px] text-muted-foreground">with notes</p>
                  </div>
                </div>
              )}

              {/* 4-day guidance note */}
              <div className="rounded-2xl bg-muted/40 px-4 py-3">
                <p className="font-body text-xs text-muted-foreground leading-relaxed">
                  Many pediatricians suggest introducing one new food at a time and waiting around 4 days before
                  the next — this helps identify any reactions. Always follow your own doctor's guidance.
                </p>
              </div>
            </>
          )}

        </div>
      </main>

      <BottomNav />
    </div>
  );
}
