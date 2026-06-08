import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, Loader2,
  ShieldCheck, Bed, Moon, Footprints, Utensils, Music, Armchair, Grid3x3, Wind, DoorClosed,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
  head: () => ({
    meta: [
      { title: "Welcome — Safe & Sound" },
      {
        name: "description",
        content:
          "Set up your little one's profile so Safe & Sound can send the right reminders at the right time.",
      },
    ],
  }),
});

const CATEGORIES: { key: string; name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "car_seat",        name: "Car seats",        icon: ShieldCheck },
  { key: "crib",            name: "Cribs",            icon: Bed },
  { key: "bassinet",        name: "Bassinets",        icon: Moon },
  { key: "stroller",        name: "Strollers",        icon: Footprints },
  { key: "high_chair",      name: "High chairs",      icon: Utensils },
  { key: "swing",           name: "Swings",           icon: Music },
  { key: "bouncer",         name: "Bouncers",         icon: Armchair },
  { key: "activity_center", name: "Activity centers", icon: Grid3x3 },
  { key: "sleep_sack",      name: "Sleep sacks",      icon: Wind },
  { key: "baby_gate",       name: "Baby gates",       icon: DoorClosed },
];

const LB_PER_KG = 2.20462;
const IN_PER_CM = 0.393701;

function OnboardingPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [units, setUnits] = useState<"imperial" | "metric">("imperial");
  const [heightStr, setHeightStr] = useState("");
  const [weightStr, setWeightStr] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(["car_seat", "crib", "stroller"]),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      setUserId(data.session.user.id);
      setChecking(false);
    });
  }, [navigate]);

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function canAdvance() {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return dob.length > 0;
    if (step === 2) return true; // measurements optional
    if (step === 3) return selected.size > 0;
    return false;
  }

  function parseMeasurements(): { height_cm: number | null; weight_kg: number | null } {
    const h = parseFloat(heightStr);
    const w = parseFloat(weightStr);
    const height_cm = Number.isFinite(h) && h > 0
      ? (units === "imperial" ? h / IN_PER_CM : h)
      : null;
    const weight_kg = Number.isFinite(w) && w > 0
      ? (units === "imperial" ? w / LB_PER_KG : w)
      : null;
    return { height_cm, weight_kg };
  }

  async function handleFinish() {
    if (!userId) return;
    setSaving(true);
    try {
      const { height_cm, weight_kg } = parseMeasurements();
      const hasMeas = height_cm !== null || weight_kg !== null;
      const { error: childError } = await supabase
        .from("children")
        .insert({
          user_id: userId,
          name: name.trim(),
          date_of_birth: dob,
          height_cm,
          weight_kg,
          measurements_updated_at: hasMeas ? new Date().toISOString() : null,
        } as never);

      if (childError) throw childError;

      toast.success(`All set — welcome, ${name.trim()}! 🌙`);
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Logo className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">
              Safe & Sound
            </span>
          </Link>
          <span className="font-body text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Step {step + 1} of {totalSteps}
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="w-full max-w-2xl">
          <Progress value={progress} className="mb-10 h-1.5" />

          {step === 0 && (
            <StepShell
              eyebrow="Let's start with your little one"
              title="What's their name?"
              subtitle="Just a first name — we use it so reminders feel personal, not clinical."
            >
              <div className="space-y-2">
                <Label htmlFor="child-name" className="font-body text-sm">Baby's name</Label>
                <Input
                  id="child-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Peyton"
                  maxLength={60}
                  className="h-14 rounded-2xl bg-card px-5 font-body text-base"
                />
              </div>
            </StepShell>
          )}

          {step === 1 && (
            <StepShell
              eyebrow={`Lovely to meet you, ${name.trim() || "little one"}`}
              title="When were they born?"
              subtitle="We'll use this to time reminders — babyproofing, mattress lowering, car seat checks — to the right week."
            >
              <div className="space-y-2">
                <Label htmlFor="dob" className="font-body text-sm">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dob}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDob(e.target.value)}
                  className="h-14 rounded-2xl bg-card px-5 font-body text-base"
                />
              </div>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell
              eyebrow="Optional, but helpful"
              title="Height & weight"
              subtitle="If you know them, these help us flag size-ups (sleep sacks, car seats, bouncers) before you outgrow them. You can skip and add later."
            >
              <div className="space-y-4">
                <div className="inline-flex rounded-full border border-border bg-card p-1">
                  <UnitToggle active={units === "imperial"} onClick={() => setUnits("imperial")} label="lb / in" />
                  <UnitToggle active={units === "metric"} onClick={() => setUnits("metric")} label="kg / cm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Height ({units === "imperial" ? "in" : "cm"})</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      value={heightStr}
                      onChange={(e) => setHeightStr(e.target.value)}
                      placeholder={units === "imperial" ? "e.g. 24" : "e.g. 61"}
                      className="h-14 rounded-2xl bg-card px-5 font-body text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Weight ({units === "imperial" ? "lb" : "kg"})</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      value={weightStr}
                      onChange={(e) => setWeightStr(e.target.value)}
                      placeholder={units === "imperial" ? "e.g. 14" : "e.g. 6.4"}
                      className="h-14 rounded-2xl bg-card px-5 font-body text-base"
                    />
                  </div>
                </div>
                <p className="font-body text-xs text-muted-foreground">
                  Tip: update these after each pediatrician visit for the best size-up alerts.
                </p>
              </div>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell
              eyebrow="Almost there"
              title="What gear are you using?"
              subtitle="Pick the categories that apply. We'll watch these for recalls, replacements, and outgrown alerts. Add specific products later."
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const active = selected.has(cat.key);
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => toggle(cat.key)}
                      className={cn(
                        "group relative flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center transition-all",
                        active
                          ? "border-primary/60 shadow-sm shadow-primary/10 ring-2 ring-primary/30"
                          : "border-border/60 hover:border-primary/30 hover:bg-card/80",
                      )}
                    >
                      {active && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sand/60 text-accent">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="font-body text-xs font-medium text-foreground">
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </StepShell>
          )}

          <div className="mt-10 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || saving}
              className="rounded-full font-body"
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>

            {step < totalSteps - 1 ? (
              <Button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance()}
                className="rounded-full bg-primary px-7 py-6 font-body text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {step === 2 && !heightStr && !weightStr ? "Skip for now" : "Continue"}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleFinish}
                disabled={!canAdvance() || saving}
                className="rounded-full bg-primary px-7 py-6 font-body text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {saving ? (
                  <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Setting up</>
                ) : (
                  <>Finish setup <Check className="ml-1 h-4 w-4" /></>
                )}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function UnitToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 font-body text-xs font-semibold transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function StepShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-3 text-center sm:text-left">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {eyebrow}
        </p>
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mx-auto max-w-md font-body text-base text-muted-foreground sm:mx-0">
          {subtitle}
        </p>
      </div>
      <div>{children}</div>
    </div>
  );
}
