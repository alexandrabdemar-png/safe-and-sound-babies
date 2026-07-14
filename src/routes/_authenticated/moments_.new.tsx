import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Sparkles, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useActiveChild } from "@/hooks/useActiveChild";
import { useProGate } from "@/hooks/useProGate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MOMENT_ICON_KEYS,
  MOMENT_ICON_LABELS,
  MOMENT_ICONS,
  DEFAULT_MOMENT_ICON,
  SketchDefs,
  saveMomentResilient,
  type MomentIconKey,
} from "@/lib/momentIcons";

type SafetyTip = { title: string; tips: string[] };

const MOMENT_SAFETY_MAP: { pattern: RegExp; safety: SafetyTip }[] = [
  {
    pattern: /roll(ed|ing)|tummy time/i,
    safety: {
      title: "Rolling over — time to think ahead",
      tips: [
        "Never leave them unattended on a raised surface (changing table, sofa, bed).",
        "Start thinking about outlet covers and cabinet locks — mobility picks up fast from here.",
        "If you haven't already, lower the crib mattress to the middle setting soon.",
      ],
    },
  },
  {
    pattern: /sat up|sitting/i,
    safety: {
      title: "Sitting up — babyproofing starts now",
      tips: [
        "Lower the crib mattress to the middle setting now — pulling to stand often follows sitting up within weeks.",
        "Begin babyproofing: outlet covers, cabinet locks, and anchor tall furniture to the wall.",
        "Swings and bouncers become unsafe once a baby can sit independently — check weight limits.",
      ],
    },
  },
  {
    pattern: /crawl(ing|ed)|crawls/i,
    safety: {
      title: "Crawling — time to gate the stairs",
      tips: [
        "Install hardware-mounted baby gates at the top of all stairs immediately.",
        "Latch every cabinet at hip-height or below — especially anything with cleaning supplies.",
        "Cover all accessible electrical outlets.",
        "Secure cords (blinds, lamps) out of reach.",
      ],
    },
  },
  {
    pattern: /pull(ing|ed|s)? to stand|pulling up|pulls up/i,
    safety: {
      title: "Pulling to stand — lower the crib now",
      tips: [
        "Drop the crib mattress to its lowest setting today — a standing baby can topple over the rail.",
        "Anchor all furniture that could tip (bookshelves, dressers, TVs) to the wall.",
        "Babyproof lower cabinets and cover all outlets if you haven't already.",
        "Check that baby gates are hardware-mounted at the top of stairs.",
      ],
    },
  },
  {
    pattern: /stand(ing|s)\b|first stand/i,
    safety: {
      title: "Standing — full babyproofing check",
      tips: [
        "Crib mattress should be at the lowest setting now.",
        "Walk every room at floor level — look for cords, sharp corners, and tip hazards.",
        "Anchor all tall furniture and TVs to the wall.",
        "Make sure gates are installed at both top and bottom of stairs.",
      ],
    },
  },
  {
    pattern: /first step|walking|took.*step|steps/i,
    safety: {
      title: "First steps — your home just got smaller",
      tips: [
        "Gate all stairs — hardware-mount at the top, pressure-mount is fine at the bottom.",
        "Cover outlet covers throughout the house.",
        "Anchor furniture, TVs, and appliances so nothing can topple when grabbed.",
        "Move cleaning supplies, medicines, and small objects to high shelves or locked cabinets.",
        "Check door stoppers and pinch guards on all doors.",
      ],
    },
  },
  {
    pattern: /lower(ed|ing)? (the )?crib|crib.*lower|mattress.*lower|lower.*mattress/i,
    safety: {
      title: "Lowering the crib mattress — one more safety step",
      tips: [
        "When repositioning your crib mattress, make sure to move the crib away from electrical outlets and any camera or monitor cords to keep your baby safe.",
      ],
    },
  },
  {
    pattern: /first tooth|teeth|teething/i,
    safety: {
      title: "First tooth — a few things to know",
      tips: [
        "Avoid teething gels or tablets with benzocaine or belladonna — not safe for infants.",
        "Skip amber teething necklaces — they're a strangulation and choking hazard.",
        "Chilled (not frozen) teething rings are a safe option.",
        "First dentist visit is recommended by age 1 or when the first tooth appears.",
      ],
    },
  },
  {
    pattern: /first food|solid|puree|eating/i,
    safety: {
      title: "Starting solids — keep it safe",
      tips: [
        "Always supervise during meals — never leave them unattended while eating.",
        "Avoid honey before age 1 (risk of botulism).",
        "Cut soft foods into pieces no larger than ½ inch.",
        "Skip whole grapes, raw carrots, nuts, and popcorn until age 4.",
        "Make sure your high chair has a working harness — use it every time.",
      ],
    },
  },
];

function getSafetyTip(momentTitle: string): SafetyTip | null {
  for (const { pattern, safety } of MOMENT_SAFETY_MAP) {
    if (pattern.test(momentTitle)) return safety;
  }
  return null;
}

export const Route = createFileRoute("/_authenticated/moments_/new")({
  ssr: false,
  component: NewMomentPage,
  head: () => ({ meta: [{ title: "Log a moment — Peace of Mine" }] }),
});

const PROMPTS = [
  "First smile",
  "Rolled over",
  "First tooth",
  "Sat up",
  "Crawling",
  "Pulling to stand",
  "First word",
  "First steps",
];

function NewMomentPage() {
  const navigate = useNavigate();
  const { activeChildId, children, loading: childrenLoading } = useActiveChild();
  // TEMP: paywall disabled for testing on 2026-07-04 at user's request — REMOVE
  // this override (restore `const { isPro, loading: proLoading } = useProGate();`)
  // before launch.
  const { loading: proLoading } = useProGate();
  const isPro = true;
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [loggedAt, setLoggedAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [momentIcon, setMomentIcon] = useState<MomentIconKey>(DEFAULT_MOMENT_ICON);
  const [safetyTip, setSafetyTip] = useState<SafetyTip | null>(null);
  const activeChild = children.find((c) => c.id === activeChildId);
  const hasNoChildren = !childrenLoading && children.length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Give the moment a title");
      return;
    }
    if (childrenLoading) {
      toast.message("Loading your profile — one sec…");
      return;
    }
    if (!activeChildId) {
      if (children.length > 0) {
        toast.error("Pick a child to log this moment for");
      } else {
        toast.error("Add a child first");
      }
      return;
    }
    setSaving(true);
    try {
      const rawNotes = notes.trim() || null;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Sign in to log moments");
        return;
      }
      // saveMomentResilient handles both known failure classes: the
      // `icon` column being unusable on the live database (retries
      // without it — see 20260713000000_milestones_icon_column.sql), and
      // a genuine network failure (caught internally, returned as an
      // error rather than thrown) — see momentIcons.tsx for why both
      // matter here specifically.
      const { error } = await saveMomentResilient({
        child_id: activeChildId,
        title: title.trim(),
        logged_at: loggedAt,
        notes: rawNotes,
        completed: true,
        icon: momentIcon,
      });
      if (error) {
        console.error("[moments.new] insert failed", error);
        toast.error(error.message || "Couldn't save that moment");
        return;
      }
      toast.success("Saved that moment 💛");
      const tip = getSafetyTip(title.trim());
      if (tip) {
        setSafetyTip(tip);
      } else {
        navigate({ to: "/moments" });
      }
    } finally {
      // Always clears — even if something above threw unexpectedly —
      // so the button can never get stuck disabled/spinning forever with
      // no feedback (the "silently lost save" failure mode).
      setSaving(false);
    }
  }

  if (!proLoading && !isPro) {
    return (
      <div className="flex min-h-screen flex-col bg-background pb-16">
        <header className="px-5 pt-8 pb-4 sm:px-6">
          <div className="mx-auto max-w-md">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="-ml-2 rounded-full font-body text-xs"
            >
              <Link to="/home">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Home
              </Link>
            </Button>
          </div>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center px-5 text-center">
          <div className="mx-auto max-w-sm space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-semibold">
              Milestone logging is a Pro feature
            </h2>
            <p className="font-body text-sm text-muted-foreground">
              Everything in free, plus expert features, tips and tricks, safety insights, and
              pediatrician-reviewed guidance. Try free for 7 days.
            </p>
            <Button className="w-full rounded-full" onClick={() => navigate({ to: "/pricing" })}>
              <Sparkles className="mr-2 h-4 w-4" /> Start free trial
            </Button>
            <Button
              variant="ghost"
              className="w-full rounded-full"
              onClick={() => navigate({ to: "/home" })}
            >
              Not now
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (safetyTip) {
    return (
      <div className="flex min-h-screen flex-col bg-background pb-16">
        <header className="px-5 pt-8 pb-4 sm:px-6">
          <div className="mx-auto max-w-md">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span className="font-body text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                Safety heads-up
              </span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
              {safetyTip.title}
            </h1>
            <p className="mt-1 font-body text-sm text-muted-foreground">
              This milestone comes with a few things worth knowing.
            </p>
          </div>
        </header>
        <main className="flex-1 px-5 sm:px-6">
          <div className="mx-auto max-w-md">
            <ul className="space-y-3">
              {safetyTip.tips.map((tip, i) => (
                <li key={i} className="flex gap-3 rounded-2xl border border-border/60 bg-card p-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="font-body text-sm text-foreground">{tip}</span>
                </li>
              ))}
            </ul>
            <Button
              className="mt-6 h-12 w-full rounded-full bg-primary font-body text-sm font-semibold"
              onClick={() => navigate({ to: "/home" })}
            >
              Got it — go home
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-16">
      <header className="px-5 pt-8 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 rounded-full font-body text-xs"
          >
            <Link to="/home">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Home
            </Link>
          </Button>
          <p className="mt-4 font-body text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            <Sparkles className="mr-1 inline h-3 w-3" /> A new moment
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            What did they do?
          </h1>
          <p className="mt-1.5 font-body text-sm text-muted-foreground">
            Personalized reminders, powered by your baby's milestones.
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-5">
          <div className="space-y-2">
            <Label className="font-body text-sm">Moment</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. First belly laugh"
              maxLength={120}
              className="h-12 rounded-2xl bg-card px-4 font-body text-base"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PROMPTS.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setTitle(p)}
                  className="rounded-full border border-border bg-card px-2.5 py-1 font-body text-[11px] text-foreground/70 hover:border-primary/40"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Moment icon */}
          <div className="space-y-2">
            <SketchDefs />
            <Label className="font-body text-sm">Icon</Label>
            <Select value={momentIcon} onValueChange={(v) => setMomentIcon(v as MomentIconKey)}>
              <SelectTrigger className="h-12 rounded-2xl bg-card px-4 font-body text-base">
                <SelectValue>
                  <span className="flex items-center gap-2">
                    {(() => {
                      const SelectedIcon = MOMENT_ICONS[momentIcon];
                      return <SelectedIcon px={20} />;
                    })()}
                    {MOMENT_ICON_LABELS[momentIcon]}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MOMENT_ICON_KEYS.map((key) => {
                  const Icon = MOMENT_ICONS[key];
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Icon px={20} />
                        {MOMENT_ICON_LABELS[key]}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-body text-sm">When</Label>
            <Input
              type="date"
              value={loggedAt}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setLoggedAt(e.target.value)}
              className="h-12 rounded-2xl bg-card px-4 font-body text-base"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-body text-sm">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="A little detail you'll want to remember…"
              maxLength={1000}
              rows={4}
              className="rounded-2xl bg-card px-4 py-3 font-body text-base"
            />
          </div>

          {hasNoChildren && (
            <p className="rounded-2xl border border-border/60 bg-card p-3 font-body text-xs text-muted-foreground">
              Add a child profile first so we can save this moment.{" "}
              <Link to="/onboarding" className="font-semibold text-primary underline">
                Add a child
              </Link>
            </p>
          )}

          <Button
            type="submit"
            disabled={saving || proLoading || childrenLoading || hasNoChildren}
            className="mt-3 h-12 w-full rounded-full bg-primary font-body text-sm font-semibold"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : childrenLoading ? "Loading…" : "Save this moment"}
          </Button>
        </form>
      </main>
    </div>
  );
}

