import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Loader2, Sparkles } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
  head: () => ({
    meta: [{ title: "Home — Safe & Sound" }],
  }),
});

type Child = {
  id: string;
  name: string;
  date_of_birth: string | null;
};

type Milestone = {
  id: string;
  child_id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  completed: boolean;
};

const CATEGORY_IMAGES: Record<string, string> = {
  carseat: catCarseat,
  pacifier: catPacifier,
  crib: catCrib,
  breastmilk: catBreastmilk,
  formula: catFormula,
  babyfood: catBabyfood,
  swaddle: catSwaddle,
  toothbrush: catToothbrush,
  gate: catGate,
};

function calcAge(dob: string | null): { label: string; subtitle: string } {
  if (!dob) return { label: "Little one", subtitle: "Add birth date in profile" };
  const birth = new Date(dob);
  const now = new Date();
  const ms = now.getTime() - birth.getTime();
  const days = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  const weeks = Math.floor(days / 7);

  if (weeks < 12) {
    return { label: `${weeks} ${weeks === 1 ? "week" : "weeks"} old`, subtitle: `${days} days of wonder` };
  }
  // months: approx 30.44 days
  const months = Math.floor(days / 30.44);
  if (months < 24) {
    return { label: `${months} ${months === 1 ? "month" : "months"} old`, subtitle: `${weeks} weeks together` };
  }
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return {
    label: `${years}y ${remMonths}m old`,
    subtitle: `${months} months together`,
  };
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Hello, night owl";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function HomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [child, setChild] = useState<Child | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [completing, setCompleting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: kids, error: kErr } = await supabase
        .from("children")
        .select("id, name, date_of_birth")
        .order("created_at", { ascending: true })
        .limit(1);

      if (cancelled) return;
      if (kErr) {
        toast.error(kErr.message);
        setLoading(false);
        return;
      }

      if (!kids || kids.length === 0) {
        navigate({ to: "/onboarding" });
        return;
      }

      const c = kids[0] as Child;
      setChild(c);

      const { data: ms, error: mErr } = await supabase
        .from("milestones")
        .select("id, child_id, title, category, due_date, completed")
        .eq("child_id", c.id)
        .order("completed", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(20);

      if (cancelled) return;
      if (mErr) toast.error(mErr.message);
      else setMilestones((ms ?? []) as Milestone[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const age = useMemo(() => calcAge(child?.date_of_birth ?? null), [child]);

  const thisWeek = milestones.filter((m) => !m.completed);
  const done = milestones.filter((m) => m.completed);

  async function completeMilestone(id: string) {
    setCompleting(id);
    const prev = milestones;
    setMilestones((m) => m.map((x) => (x.id === id ? { ...x, completed: true } : x)));
    const { error } = await supabase
      .from("milestones")
      .update({ completed: true })
      .eq("id", id);
    if (error) {
      setMilestones(prev);
      toast.error(error.message);
    } else {
      toast.success("Nice — marked as done ✓");
    }
    setCompleting(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      {/* Greeting header */}
      <header className="px-5 pt-10 pb-6 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Logo className="h-4 w-4" />
              </div>
              <span className="font-display text-base font-semibold tracking-tight">
                Safe & Sound
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-body text-[11px] font-medium text-muted-foreground shadow-sm">
              <Sparkles className="h-3 w-3 text-accent" />
              All caught up
            </span>
          </div>

          <p className="font-body text-sm font-medium uppercase tracking-[0.2em] text-accent">
            {greeting()}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
            {child?.name}
          </h1>
          <p className="mt-2 font-body text-base text-muted-foreground">
            {age.label} · <span className="text-foreground/70">{age.subtitle}</span>
          </p>
        </div>
      </header>

      {/* This week */}
      <section className="px-5 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              This week
            </h2>
            <span className="font-body text-xs font-medium text-muted-foreground">
              {thisWeek.length} {thisWeek.length === 1 ? "thing" : "things"} to check
            </span>
          </div>

          {thisWeek.length === 0 ? (
            <EmptyCard />
          ) : (
            <ul className="space-y-3">
              {thisWeek.map((m) => (
                <MilestoneCard
                  key={m.id}
                  milestone={m}
                  busy={completing === m.id}
                  onComplete={() => completeMilestone(m.id)}
                />
              ))}
            </ul>
          )}

          {done.length > 0 && (
            <div className="mt-10">
              <h3 className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Recently done
              </h3>
              <ul className="space-y-2">
                {done.slice(0, 5).map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/50 px-4 py-3"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest/15 text-forest">
                      <Check className="h-4 w-4" />
                    </span>
                    <span className="font-body text-sm text-muted-foreground line-through">
                      {m.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <BottomNav />
    </div>
  );
}

function MilestoneCard({
  milestone,
  busy,
  onComplete,
}: {
  milestone: Milestone;
  busy: boolean;
  onComplete: () => void;
}) {
  const image = milestone.category ? CATEGORY_IMAGES[milestone.category] : undefined;
  const due = milestone.due_date
    ? new Date(milestone.due_date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "Anytime this week";

  return (
    <li
      className={cn(
        "group flex items-center gap-4 rounded-3xl border border-border/60 bg-card p-4 shadow-sm shadow-black/[0.02] transition-all",
        "hover:border-primary/30 hover:shadow-md",
      )}
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sand/40">
        {image ? (
          <img src={image} alt="" className="h-10 w-10 object-contain" />
        ) : (
          <Sparkles className="h-5 w-5 text-accent" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base font-semibold tracking-tight text-foreground">
          {milestone.title}
        </p>
        <p className="mt-0.5 font-body text-xs text-muted-foreground">{due}</p>
      </div>
      <Button
        size="sm"
        onClick={onComplete}
        disabled={busy}
        className="shrink-0 rounded-full bg-forest px-4 font-body text-xs font-semibold text-primary-foreground hover:bg-forest/90"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            <Check className="h-3.5 w-3.5" /> Done
          </>
        )}
      </Button>
    </li>
  );
}

function EmptyCard() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest/15 text-forest">
        <Check className="h-5 w-5" />
      </div>
      <p className="font-display text-lg font-semibold tracking-tight">
        Nothing this week
      </p>
      <p className="mx-auto mt-1 max-w-xs font-body text-sm text-muted-foreground">
        You're all caught up. We'll nudge you when something needs a gentle
        check-in.
      </p>
    </div>
  );
}
