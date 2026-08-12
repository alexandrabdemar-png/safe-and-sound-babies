import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, LineChart, Loader2 } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/errors";
import { useActiveChild } from "@/hooks/useActiveChild";

export const Route = createFileRoute("/_authenticated/growth")({
  ssr: false,
  component: GrowthPage,
  head: () => ({
    meta: [
      { title: "Growth — Peace of Mine" },
      {
        name: "description",
        content:
          "Log your baby's height and weight over time and keep gear size recommendations accurate.",
      },
      { property: "og:title", content: "Growth — Peace of Mine" },
      {
        property: "og:description",
        content: "Log your baby's height and weight over time in Peace of Mine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Measurement = {
  id: string;
  weight_lbs: number | null;
  height_inches: number | null;
  recorded_at: string;
};

function GrowthPage() {
  const { activeChild, loading: childLoading, refresh: refreshChildren } = useActiveChild();
  const [rows, setRows] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [heightStr, setHeightStr] = useState("");
  const [weightStr, setWeightStr] = useState("");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function load(childId: string) {
    const { data, error } = await supabase
      .from("child_measurements")
      .select("id, weight_lbs, height_inches, recorded_at")
      .eq("child_id", childId)
      .order("recorded_at", { ascending: false })
      .limit(50);
    if (!mountedRef.current) return;
    if (error) {
      console.error("[growth] failed to load measurements:", error.message);
      toast.error(friendlyError(error.message));
    } else {
      setRows((data ?? []) as Measurement[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (childLoading) return;
    if (!activeChild) {
      setLoading(false);
      return;
    }
    load(activeChild.id);
  }, [childLoading, activeChild?.id]);

  async function save() {
    if (!activeChild) return;
    const h = parseFloat(heightStr);
    const w = parseFloat(weightStr);
    const height_inches = Number.isFinite(h) && h > 0 ? h : null;
    const weight_lbs = Number.isFinite(w) && w > 0 ? w : null;
    if (height_inches === null && weight_lbs === null) {
      toast.error("Enter a height or a weight.");
      return;
    }

    setSaving(true);
    const nowIso = new Date().toISOString();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSaving(false);
      toast.error("Sign in to log measurements");
      return;
    }

    const { error } = await supabase.from("child_measurements").insert({
      user_id: u.user.id,
      child_id: activeChild.id,
      height_inches,
      weight_lbs,
      recorded_at: nowIso,
    } as never);

    if (error) {
      setSaving(false);
      console.error("[growth] failed to save measurement:", error.message);
      toast.error(friendlyError(error.message));
      return;
    }

    // Keep the child record's "current" numbers in sync so size-up and
    // replacement predictions use the latest measurement.
    await supabase
      .from("children")
      .update({
        ...(height_inches !== null ? { height_inches } : {}),
        ...(weight_lbs !== null ? { weight_lbs } : {}),
        measurements_updated_at: nowIso,
      } as never)
      .eq("id", activeChild.id);

    setSaving(false);
    setHeightStr("");
    setWeightStr("");
    toast.success("Measurement logged");
    await refreshChildren();
    load(activeChild.id).catch((err) =>
      console.error("[growth] background refresh failed:", err),
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 animate-fade-in">
      <header className="px-5 pt-10 pb-6 sm:px-6">
        <div className="mx-auto max-w-md">
          <Link
            to="/tracking"
            className="inline-flex items-center gap-1.5 font-body text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Track
          </Link>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight">
            Growth
          </h1>
          <p className="mt-2 font-body text-base text-muted-foreground">
            {activeChild
              ? `Log ${activeChild.name}'s height and weight to keep size recommendations accurate.`
              : "Add a child first to start logging measurements."}
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-4">
          {activeChild && (
            <section className="rounded-3xl border border-border/60 bg-card p-5">
              <p className="font-display text-base font-semibold tracking-tight">
                New measurement
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  inputMode="decimal"
                  placeholder="Height (in)"
                  aria-label="Height in inches"
                  value={heightStr}
                  onChange={(e) => setHeightStr(e.target.value)}
                  className="h-11 rounded-xl"
                />
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  inputMode="decimal"
                  placeholder="Weight (lb)"
                  aria-label="Weight in pounds"
                  value={weightStr}
                  onChange={(e) => setWeightStr(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <Button
                onClick={save}
                disabled={saving}
                className="mt-3 w-full rounded-full"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log measurement"}
              </Button>
            </section>
          )}

          <section className="space-y-2">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              History
            </p>
            {loading || childLoading ? (
              <p className="font-body text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <div className="flex items-center gap-3 rounded-3xl border border-dashed border-border/70 p-5">
                <LineChart className="h-5 w-5 text-muted-foreground" />
                <p className="font-body text-sm text-muted-foreground">
                  No measurements yet. Your first entry starts the chart.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {rows.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3"
                  >
                    <span className="font-body text-sm">
                      {[
                        r.weight_lbs != null ? `${r.weight_lbs.toFixed(1)} lb` : null,
                        r.height_inches != null ? `${r.height_inches.toFixed(1)}"` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="font-body text-xs text-muted-foreground">
                      {new Date(r.recorded_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
