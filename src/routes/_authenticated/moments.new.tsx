import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useActiveChild } from "@/hooks/useActiveChild";
import { useProGate } from "@/hooks/useProGate";

export const Route = createFileRoute("/_authenticated/moments/new")({
  component: NewMomentPage,
  head: () => ({ meta: [{ title: "Log a moment — Safe & Sound" }] }),
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
  const { activeChildId } = useActiveChild();
  const { isPro, loading: proLoading, requirePro } = useProGate();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [loggedAt, setLoggedAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requirePro("Milestone logging", "Everything in free, plus expert features, tips and tricks, safety insights, and pediatrician-reviewed guidance. Try free for 7 days.")) return;
    if (!title.trim()) { toast.error("Give the moment a title"); return; }
    if (!activeChildId) { toast.error("Add a child first"); return; }
    setSaving(true);
    const { error } = await supabase.from("milestones").insert({
      child_id: activeChildId,
      title: title.trim(),
      logged_at: loggedAt,
      notes: notes.trim() || null,
      completed: true,
    } as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved that moment 💛");
    navigate({ to: "/home" });
  }

  if (!proLoading && !isPro) {
    return (
      <div className="flex min-h-screen flex-col bg-background pb-16">
        <header className="px-5 pt-8 pb-4 sm:px-6">
          <div className="mx-auto max-w-md">
            <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full font-body text-xs">
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
            <h2 className="font-display text-2xl font-semibold">Milestone logging is a Pro feature</h2>
            <p className="font-body text-sm text-muted-foreground">
              Everything in free, plus expert features, tips and tricks, safety insights, and pediatrician-reviewed guidance. Try free for 7 days.
            </p>
            <Button className="w-full rounded-full" onClick={() => navigate({ to: "/pricing" })}>
              <Sparkles className="mr-2 h-4 w-4" /> Start free trial
            </Button>
            <Button variant="ghost" className="w-full rounded-full" onClick={() => navigate({ to: "/home" })}>
              Not now
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
          <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full font-body text-xs">
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
            Every baby is on their own timeline. Log it when it happens — no schedule, no pressure.
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

          <Button
            type="submit"
            disabled={saving || proLoading}
            className="mt-3 h-12 w-full rounded-full bg-primary font-body text-sm font-semibold"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save this moment"}
          </Button>
        </form>
      </main>
    </div>
  );
}
