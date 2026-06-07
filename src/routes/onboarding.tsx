import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import catCarseat from "@/assets/cat-carseat.png";
import catPacifier from "@/assets/cat-pacifier.png";
import catCrib from "@/assets/cat-crib.png";
import catBreastmilk from "@/assets/cat-breastmilk.png";
import catFormula from "@/assets/cat-formula.png";
import catBabyfood from "@/assets/cat-babyfood.png";
import catSwaddle from "@/assets/cat-swaddle.png";
import catToothbrush from "@/assets/cat-toothbrush.png";
import catGate from "@/assets/cat-gate.png";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
  head: () => ({
    meta: [
      { title: "Welcome — Safe & Sound" },
      {
        name: "description",
        content:
          "Set up your little one's profile and choose what you'd like Safe & Sound to gently track for you.",
      },
    ],
  }),
});

const CATEGORIES = [
  { key: "carseat", name: "Car seats", image: catCarseat },
  { key: "pacifier", name: "Pacifiers", image: catPacifier },
  { key: "crib", name: "Crib heights", image: catCrib },
  { key: "breastmilk", name: "Breast milk", image: catBreastmilk },
  { key: "formula", name: "Formula", image: catFormula },
  { key: "babyfood", name: "Baby food", image: catBabyfood },
  { key: "swaddle", name: "Swaddles", image: catSwaddle },
  { key: "toothbrush", name: "Toothbrush", image: catToothbrush },
  { key: "gate", name: "Baby gates", image: catGate },
];

const STARTER_MILESTONES: Record<string, string> = {
  carseat: "Check car seat fit",
  pacifier: "Replace pacifiers",
  crib: "Lower crib mattress",
  breastmilk: "Restock storage bags",
  formula: "Check formula expiration",
  babyfood: "Introduce new texture",
  swaddle: "Transition out of swaddle",
  toothbrush: "First dental check",
  gate: "Install stair gates",
};

function OnboardingPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(["carseat", "pacifier", "crib"]),
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

  const totalSteps = 3;
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
    if (step === 2) return selected.size > 0;
    return false;
  }

  async function handleFinish() {
    if (!userId) return;
    setSaving(true);
    try {
      const { data: child, error: childError } = await supabase
        .from("children")
        .insert({
          user_id: userId,
          name: name.trim(),
          date_of_birth: dob,
        })
        .select("id")
        .single();

      if (childError) throw childError;

      const milestonesToInsert = Array.from(selected).map((key) => ({
        child_id: child.id,
        title: STARTER_MILESTONES[key] ?? "Check in",
        category: key,
        completed: false,
      }));

      if (milestonesToInsert.length > 0) {
        const { error: msError } = await supabase
          .from("milestones")
          .insert(milestonesToInsert);
        if (msError) throw msError;
      }

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
      {/* Soft top bar */}
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
                <Label htmlFor="child-name" className="font-body text-sm">
                  Baby's name
                </Label>
                <Input
                  id="child-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Olive"
                  className="h-14 rounded-2xl bg-card px-5 font-body text-base"
                />
              </div>
            </StepShell>
          )}

          {step === 1 && (
            <StepShell
              eyebrow={`Lovely to meet you, ${name.trim() || "little one"}`}
              title="When were they born?"
              subtitle="We'll use this to time reminders to the right week — and you can change it later."
            >
              <div className="space-y-2">
                <Label htmlFor="dob" className="font-body text-sm">
                  Date of birth
                </Label>
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
              eyebrow="Almost there"
              title="What should we keep an eye on?"
              subtitle="Pick anything you'd like quiet nudges about. You can add or remove things anytime."
            >
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
                {CATEGORIES.map((cat) => {
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
                      <img
                        src={cat.image}
                        alt=""
                        className="h-12 w-12 object-contain"
                      />
                      <span className="font-body text-xs font-medium text-foreground">
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </StepShell>
          )}

          {/* Footer nav */}
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
                Continue <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleFinish}
                disabled={!canAdvance() || saving}
                className="rounded-full bg-primary px-7 py-6 font-body text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Setting up
                  </>
                ) : (
                  <>
                    Finish setup <Check className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
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
