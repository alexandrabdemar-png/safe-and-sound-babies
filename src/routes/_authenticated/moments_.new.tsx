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
import {
  type SafetyTip,
  MOMENT_SAFETY_MAP,
  getSafetyTip,
  getMilestoneKey,
} from "@/lib/momentSafetyTips";
export { type SafetyTip, MOMENT_SAFETY_MAP, getSafetyTip, getMilestoneKey };

export const Route = createFileRoute("/_authenticated/moments_/new")({
  ssr: false,
  component: NewMomentPage,
  head: () => ({ meta: [{ title: "Log a moment — Peace of Mine" }] }),
});

export const PROMPTS = [
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
  // Which tips on the safety-heads-up screen the parent has checked off.
  // Previously this screen was a static, unchangeable bulleted list with a
  // single "Got it" button that dismissed the whole thing at once — a UX
  // walkthrough flagged that as effectively non-interactive. Session-only
  // (not persisted): there's no "revisit a past moment's safety tips"
  // screen anywhere in the app yet, so writing this to the database would
  // be state nothing ever reads back — an actually-revisitable checklist
  // is a bigger feature (its own detail route) than this fix.
  const [completedTips, setCompletedTips] = useState<Set<number>>(new Set());
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
      const tip = getSafetyTip(title.trim());
      if (tip) {
        toast.success("Saved that moment 💛");
        setSafetyTip(tip);
      } else {
        // No matching entry in MOMENT_SAFETY_MAP — either a milestone with
        // no physical-safety concern of its own (e.g. "First smile") or a
        // custom/free-text title. Previously this branch navigated away
        // with no acknowledgment at all beyond the generic save toast,
        // which reads the same whether a tip screen is coming or not —
        // say so explicitly instead of leaving it unexplained.
        toast.success("Saved that moment 💛", {
          description: "No extra safety tips for this one.",
        });
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
              Everything in free, plus AI-assisted product guidance, tips and tricks, and safety
              insights. Try free for 7 days.
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
              General reference guidance for this milestone, not personalized medical advice —
              talk to your pediatrician about anything specific to your child.
            </p>
          </div>
        </header>
        <main className="flex-1 px-5 sm:px-6">
          <div className="mx-auto max-w-md">
            <ul className="space-y-3">
              {safetyTip.tips.map((tip, i) => {
                const done = completedTips.has(i);
                return (
                  <li key={i}>
                    <label
                      className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors ${done ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card"}`}
                    >
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() =>
                          setCompletedTips((prev) => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i);
                            else next.add(i);
                            return next;
                          })
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                        aria-label={`Mark done: ${tip}`}
                      />
                      <span
                        className={`font-body text-sm ${done ? "text-muted-foreground line-through" : "text-foreground"}`}
                      >
                        {tip}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {completedTips.size > 0 && (
              <p className="mt-3 font-body text-xs text-muted-foreground">
                {completedTips.size} of {safetyTip.tips.length} done
              </p>
            )}
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
            Helpful safety reminders based on what you log.
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

