import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, TrendingUp, Loader2, Utensils } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { BottomNav } from "@/components/BottomNav";
import { weightPercentile, heightPercentile, ordinal } from "@/lib/whoPercentiles";
import { friendlyError } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/growth")({
  ssr: false,
  component: GrowthPage,
  head: () => ({ meta: [{ title: "Growth Tracker — Safe & Sound" }] }),
});

type Child = {
  id: string;
  name: string;
  date_of_birth: string | null;
  weight_lbs: number | null;
  height_inches: number | null;
};

type GrowthLog = {
  id: string;
  child_id: string;
  weight_lbs: number | null;
  height_inches: number | null;
  recorded_at: string;
};

// WHO median monthly weight gain (lbs) and height gain (in) by age bracket
// Used to predict size-up dates after a new measurement is logged
const MONTHLY_GAINS: { maxMonths: number; weightLbsPerMonth: number; heightInPerMonth: number }[] = [
  { maxMonths: 3, weightLbsPerMonth: 1.8, heightInPerMonth: 1.4 },
  { maxMonths: 6, weightLbsPerMonth: 1.1, heightInPerMonth: 0.9 },
  { maxMonths: 12, weightLbsPerMonth: 0.8, heightInPerMonth: 0.6 },
  { maxMonths: 24, weightLbsPerMonth: 0.5, heightInPerMonth: 0.4 },
  { maxMonths: Infinity, weightLbsPerMonth: 0.3, heightInPerMonth: 0.3 },
];

function monthlyGain(ageMonths: number) {
  return MONTHLY_GAINS.find((g) => ageMonths < g.maxMonths) ?? MONTHLY_GAINS[MONTHLY_GAINS.length - 1];
}

// Clothing size weight thresholds (lbs) — upper bound to trigger size-up
const CLOTHING_SIZE_LIMITS: { size: string; maxWeightLbs: number }[] = [
  { size: "newborn", maxWeightLbs: 8.5 },
  { size: "nb", maxWeightLbs: 8.5 },
  { size: "0-3", maxWeightLbs: 12 },
  { size: "0m", maxWeightLbs: 12 },
  { size: "3m", maxWeightLbs: 12 },
  { size: "3-6", maxWeightLbs: 16 },
  { size: "6m", maxWeightLbs: 16 },
  { size: "6-9", maxWeightLbs: 20 },
  { size: "9m", maxWeightLbs: 20 },
  { size: "9-12", maxWeightLbs: 24 },
  { size: "12m", maxWeightLbs: 24 },
  { size: "12-18", maxWeightLbs: 28 },
  { size: "18m", maxWeightLbs: 28 },
  { size: "18-24", maxWeightLbs: 32 },
  { size: "24m", maxWeightLbs: 32 },
  { size: "2t", maxWeightLbs: 36 },
];

async function recalculateSizeUps(childId: string, weightLbs: number, ageMonths: number) {
  try {
    const { data: prods } = await supabase
      .from("products")
      .select("id, category, size")
      .or(`child_id.eq.${childId},child_id.is.null`);

    if (!prods) return;

    const gain = monthlyGain(ageMonths);
    const updates: Array<{ id: string; predicted_sizeup_date: string }> = [];

    for (const p of prods) {
      const sizeKey = (p.size ?? "").toLowerCase().trim();
      const limit = CLOTHING_SIZE_LIMITS.find((s) => sizeKey.includes(s.size));
      if (!limit) continue;

      const remaining = limit.maxWeightLbs - weightLbs;
      if (remaining <= 0) continue;

      const monthsUntilSizeUp = remaining / gain.weightLbsPerMonth;
      const sizeUpDate = new Date();
      sizeUpDate.setDate(sizeUpDate.getDate() + Math.round(monthsUntilSizeUp * 30.44));
      updates.push({ id: p.id, predicted_sizeup_date: sizeUpDate.toISOString().slice(0, 10) });
    }

    for (const u of updates) {
      await supabase.from("products").update({ predicted_sizeup_date: u.predicted_sizeup_date }).eq("id", u.id);
    }
  } catch {
    // Non-critical — silently skip if products table isn't accessible
  }
}

function parseDateLocal(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function GrowthPage() {
  const navigate = useNavigate();
  const [child, setChild] = useState<Child | null>(null);
  const [logs, setLogs] = useState<GrowthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Log form
  const [showForm, setShowForm] = useState(false);
  const [formWeight, setFormWeight] = useState("");
  const [formHeight, setFormHeight] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));

  async function loadData() {
    let activeId: string | null = null;
    try { activeId = localStorage.getItem("safesound.activeChildId"); } catch {}

    const { data: kids } = await supabase
      .from("children")
      .select("id, name, date_of_birth, weight_lbs, height_inches")
      .order("created_at", { ascending: true });

    if (!kids?.length) { navigate({ to: "/onboarding" }); return; }
    const c = (kids.find((k) => k.id === activeId) ?? kids[0]) as Child;
    setChild(c);

    const { data: logData, error } = await supabase
      .from("growth_logs" as any)
      .select("id, child_id, weight_lbs, height_inches, recorded_at")
      .eq("child_id", c.id)
      .order("recorded_at", { ascending: true });

    if (!error && logData) setLogs(logData as unknown as GrowthLog[]);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleLog() {
    if (!child) return;
    if (!formWeight && !formHeight) { toast.error("Enter at least weight or height."); return; }
    setSaving(true);

    const payload: Record<string, unknown> = {
      child_id: child.id,
      recorded_at: formDate ? `${formDate}T12:00:00Z` : new Date().toISOString(),
    };
    if (formWeight) payload.weight_lbs = parseFloat(formWeight);
    if (formHeight) payload.height_inches = parseFloat(formHeight);

    const { error } = await supabase.from("growth_logs" as any).insert(payload);
    if (error) { toast.error(friendlyError(error.message)); setSaving(false); return; }

    // Update child's current measurements
    const childUpdate: Record<string, unknown> = { measurements_updated_at: new Date().toISOString() };
    if (formWeight) childUpdate.weight_lbs = parseFloat(formWeight);
    if (formHeight) childUpdate.height_inches = parseFloat(formHeight);
    await supabase.from("children").update(childUpdate as any).eq("id", child.id);

    // Recalculate size-up dates
    if (formWeight && child.date_of_birth) {
      const ageMonths = Math.floor((Date.now() - parseDateLocal(child.date_of_birth).getTime()) / (30.44 * 86400000));
      await recalculateSizeUps(child.id, parseFloat(formWeight), ageMonths);
    }

    toast.success("Measurement logged — size-up predictions updated.");
    setFormWeight(""); setFormHeight(""); setFormDate(new Date().toISOString().slice(0, 10));
    setShowForm(false);
    setSaving(false);
    loadData();
  }

  const ageMonths = useMemo(() => {
    if (!child?.date_of_birth) return 0;
    return Math.floor((Date.now() - parseDateLocal(child.date_of_birth).getTime()) / (30.44 * 86400000));
  }, [child]);

  const latestWeight = logs.filter((l) => l.weight_lbs).at(-1)?.weight_lbs ?? child?.weight_lbs ?? null;
  const latestHeight = logs.filter((l) => l.height_inches).at(-1)?.height_inches ?? child?.height_inches ?? null;

  const weightPct = latestWeight !== null && ageMonths <= 24 ? weightPercentile(latestWeight, ageMonths) : null;
  const heightPct = latestHeight !== null && ageMonths <= 24 ? heightPercentile(latestHeight, ageMonths) : null;

  const chartData = logs.map((l) => ({
    date: l.recorded_at.slice(0, 10),
    label: new Date(l.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    weight: l.weight_lbs ?? undefined,
    height: l.height_inches ?? undefined,
  }));

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
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <h1 className="font-display text-xl font-semibold tracking-tight">Growth Tracker</h1>
                <p className="font-body text-xs text-muted-foreground">{child?.name}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="ml-auto flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-body text-xs font-semibold text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Log
            </button>
          </div>

          {/* Log form */}
          {showForm && (
            <div className="mb-4 rounded-2xl border border-border/60 bg-card p-4 animate-scale-in">
              <p className="mb-3 font-display text-sm font-semibold">New measurement</p>
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div>
                  <label className="mb-1 block font-body text-xs text-muted-foreground">Weight (lbs)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 14.5"
                    value={formWeight}
                    onChange={(e) => setFormWeight(e.target.value)}
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 font-body text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-body text-xs text-muted-foreground">Height (inches)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder="e.g. 24.5"
                    value={formHeight}
                    onChange={(e) => setFormHeight(e.target.value)}
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 font-body text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="mb-1 block font-body text-xs text-muted-foreground">Date</label>
                <input
                  type="date"
                  value={formDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 font-body text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleLog}
                  disabled={saving}
                  className="flex-1 rounded-full bg-primary py-2 font-body text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save measurement"}
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
        </div>
      </header>

      <main className="px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-4">

          {/* Percentile cards */}
          {(weightPct !== null || heightPct !== null) && ageMonths <= 24 && (
            <div className="grid grid-cols-2 gap-2.5">
              {weightPct !== null && latestWeight !== null && (
                <div className="rounded-2xl border border-border/60 bg-card p-4">
                  <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Weight</p>
                  <p className="font-display text-2xl font-semibold tracking-tight">{ordinal(weightPct)}</p>
                  <p className="font-body text-xs text-muted-foreground">percentile</p>
                  <p className="mt-1.5 font-body text-[11px] text-foreground/70">{latestWeight} lbs</p>
                </div>
              )}
              {heightPct !== null && latestHeight !== null && (
                <div className="rounded-2xl border border-border/60 bg-card p-4">
                  <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Height</p>
                  <p className="font-display text-2xl font-semibold tracking-tight">{ordinal(heightPct)}</p>
                  <p className="font-body text-xs text-muted-foreground">percentile</p>
                  <p className="mt-1.5 font-body text-[11px] text-foreground/70">{latestHeight} inches</p>
                </div>
              )}
            </div>
          )}

          {/* Friendly percentile statement */}
          {weightPct !== null && ageMonths <= 24 && (
            <div className="rounded-2xl bg-[#EDF4EC] border border-[#C8DEC6] p-4">
              <p className="font-body text-sm text-[#3D3935] leading-relaxed">
                {child?.name} is around the <strong>{ordinal(weightPct)} percentile</strong> for weight for babies around{" "}
                {ageMonths < 12 ? `${ageMonths} months` : ageMonths === 12 ? "1 year" : `${ageMonths} months`} old.{" "}
                {heightPct !== null && `For height, they're near the ${ordinal(heightPct)} percentile. `}
                Percentile ranges are wide — what matters most is that growth is steady over time.
              </p>
            </div>
          )}

          {/* Line chart */}
          {chartData.length >= 2 ? (
            <div className="rounded-3xl border border-border/60 bg-card p-5">
              <p className="mb-4 font-display text-sm font-semibold tracking-tight">Growth over time</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E2DA" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#8A8078", fontFamily: "DM Sans, sans-serif" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="weight"
                    orientation="left"
                    tick={{ fontSize: 10, fill: "#4A7A47", fontFamily: "DM Sans, sans-serif" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="height"
                    orientation="right"
                    tick={{ fontSize: 10, fill: "#A3B899", fontFamily: "DM Sans, sans-serif" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#FAF7F2",
                      border: "1px solid #E8E2DA",
                      borderRadius: 10,
                      fontSize: 12,
                      fontFamily: "DM Sans, sans-serif",
                    }}
                    labelStyle={{ fontWeight: 600 }}
                    formatter={(v, name) =>
                      name === "weight" ? [`${v} lbs`, "Weight"] : [`${v} in`, "Height"]
                    }
                  />
                  <Legend
                    formatter={(v) => (v === "weight" ? "Weight (lbs)" : "Height (in)")}
                    wrapperStyle={{ fontSize: 11, fontFamily: "DM Sans, sans-serif", paddingTop: 8 }}
                  />
                  <Line
                    yAxisId="weight"
                    type="monotone"
                    dataKey="weight"
                    stroke="#4A7A47"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#4A7A47", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                  <Line
                    yAxisId="height"
                    type="monotone"
                    dataKey="height"
                    stroke="#A3B899"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#A3B899", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : chartData.length === 1 ? (
            <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
              <p className="font-body text-sm text-muted-foreground">Log one more measurement to see the growth chart.</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-10 text-center animate-scale-in">
              <span style={{ fontSize: 36 }}>📈</span>
              <p className="mt-3 font-display text-base font-semibold">No measurements yet</p>
              <p className="mt-1 font-body text-sm text-muted-foreground max-w-xs mx-auto">
                Tap <strong>Log</strong> above to add {child?.name}'s first weight and height. The chart appears after two entries.
              </p>
            </div>
          )}

          {/* Log history */}
          {logs.length > 0 && (
            <div className="rounded-3xl border border-border/60 bg-card p-5">
              <p className="mb-3 font-display text-sm font-semibold tracking-tight">History</p>
              <ul className="space-y-2.5">
                {[...logs].reverse().map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3">
                    <p className="font-body text-xs text-muted-foreground">
                      {new Date(l.recorded_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                    <div className="flex gap-3">
                      {l.weight_lbs !== null && (
                        <span className="font-body text-sm font-medium text-foreground">{l.weight_lbs} lbs</span>
                      )}
                      {l.height_inches !== null && (
                        <span className="font-body text-sm font-medium text-muted-foreground">{l.height_inches} in</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Disclaimer */}
          <p className="pb-4 font-body text-[11px] text-muted-foreground text-center leading-relaxed px-2">
            Growth charts are for general reference only — always discuss your baby's growth with your pediatrician.
            Percentiles are based on WHO Child Growth Standards (2006).
          </p>

          {/* Quick link to First Foods */}
          <Link
            to="/first-foods"
            className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3.5 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Utensils className="h-4 w-4" />
              </span>
              <div>
                <p className="font-body text-sm font-semibold">First Foods Tracker</p>
                <p className="font-body text-[11px] text-muted-foreground">Log new foods and allergens</p>
              </div>
            </div>
            <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
