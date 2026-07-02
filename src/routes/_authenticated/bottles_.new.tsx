import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Lock, Sparkles } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useProGate } from "@/hooks/useProGate";
import {
  BOTTLE_TYPES,
  STORAGE_OPTIONS,
  type BottleType,
  type Storage,
  computeExpiresAt,
  shelfLifeMinutes,
  formatCountdown,
} from "@/lib/bottleRules";

export const Route = createFileRoute("/_authenticated/bottles_/new")({
  ssr: false,
  component: NewBottlePage,
  head: () => ({ meta: [{ title: "Log a bottle — Peace of Mine" }] }),
});

function NewBottlePage() {
  const navigate = useNavigate();
  const { isPro, requirePro } = useProGate();

  const [type, setType] = useState<BottleType>("breastmilk_fresh");
  const [storage, setStorage] = useState<Storage>("fridge");
  const [startedNow, setStartedNow] = useState(true);
  const [startedAtLocal, setStartedAtLocal] = useState(() => toLocalInput(new Date()));
  const [ounces, setOunces] = useState("");
  const [alertMinutes, setAlertMinutes] = useState(60);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const startedAt = useMemo(
    () => (startedNow ? new Date() : fromLocalInput(startedAtLocal)),
    [startedNow, startedAtLocal],
  );
  const expiresAt = useMemo(() => computeExpiresAt(type, storage, startedAt), [type, storage, startedAt]);
  const shelfMins = shelfLifeMinutes(type, storage);
  const notAllowed = shelfMins == null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!expiresAt) {
      toast.error("This bottle type can't be stored that way. Pick another storage option.");
      return;
    }
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) { toast.error("Please sign in again."); setSaving(false); return; }

    let activeChildId: string | null = null;
    try { activeChildId = localStorage.getItem("safesound.activeChildId"); } catch {/* ignore */}

    const { error } = await supabase.from("bottles").insert({
      user_id: uid,
      child_id: activeChildId,
      bottle_type: type,
      storage,
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      alert_minutes_before: isPro ? alertMinutes : 60,
      ounces: ounces ? Number(ounces) : null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Bottle logged");
    navigate({ to: "/bottles" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-5 pt-10 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <Link to="/bottles" className="inline-flex items-center gap-1 font-body text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Bottles
          </Link>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Log a bottle</h1>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            We'll calculate when it expires and remind you before it does.
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <form onSubmit={handleSave} className="mx-auto max-w-md space-y-6">
          {/* Bottle type */}
          <section className="space-y-2">
            <Label className="font-display text-sm">What's in the bottle?</Label>
            <div className="grid gap-2">
              {BOTTLE_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition-all",
                    type === opt.value ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40",
                  )}
                >
                  <p className="font-display text-sm font-semibold">{opt.label}</p>
                  <p className="mt-0.5 font-body text-xs text-muted-foreground">{opt.hint}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Storage */}
          <section className="space-y-2">
            <Label className="font-display text-sm">Where is it stored?</Label>
            <div className="grid grid-cols-3 gap-2">
              {STORAGE_OPTIONS.map((opt) => {
                const mins = shelfLifeMinutes(type, opt.value);
                const disabled = mins == null;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setStorage(opt.value)}
                    className={cn(
                      "rounded-2xl border p-3 text-center transition-all",
                      storage === opt.value && !disabled
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-primary/40",
                      disabled && "opacity-40 cursor-not-allowed",
                    )}
                  >
                    <p className="font-display text-xs font-semibold">{opt.label}</p>
                    <p className="mt-1 font-body text-[10px] text-muted-foreground">
                      {disabled ? "Not safe" : formatCountdown(mins! * 60_000)}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Started at */}
          <section className="space-y-2">
            <Label className="font-display text-sm">When was it made?</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStartedNow(true)}
                className={cn(
                  "flex-1 rounded-2xl border p-2.5 font-body text-sm transition-all",
                  startedNow ? "border-primary bg-primary/5" : "border-border/60",
                )}
              >
                Just now
              </button>
              <button
                type="button"
                onClick={() => setStartedNow(false)}
                className={cn(
                  "flex-1 rounded-2xl border p-2.5 font-body text-sm transition-all",
                  !startedNow ? "border-primary bg-primary/5" : "border-border/60",
                )}
              >
                Pick time
              </button>
            </div>
            {!startedNow && (
              <Input
                type="datetime-local"
                value={startedAtLocal}
                onChange={(e) => setStartedAtLocal(e.target.value)}
                className="rounded-2xl"
              />
            )}
          </section>

          {/* Ounces */}
          <section className="space-y-2">
            <Label htmlFor="oz" className="font-display text-sm">Ounces <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="oz"
              type="number"
              step="0.5"
              min="0"
              max="20"
              placeholder="e.g. 4"
              value={ounces}
              onChange={(e) => setOunces(e.target.value)}
              className="rounded-2xl"
            />
          </section>

          {/* Alert window (paid) */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-display text-sm">Remind me before it expires</Label>
              {!isPro && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider text-accent">
                  <Sparkles className="h-3 w-3" /> Pro
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 60, 120].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    if (m !== 60 && !requirePro("Custom bottle alerts", "Pick exactly when you want to be reminded.")) return;
                    setAlertMinutes(m);
                  }}
                  className={cn(
                    "rounded-2xl border p-2.5 font-body text-xs transition-all",
                    alertMinutes === m ? "border-primary bg-primary/5 font-semibold" : "border-border/60",
                    m !== 60 && !isPro && "relative",
                  )}
                >
                  {m < 60 ? `${m}m` : `${m / 60}h`}
                  {m !== 60 && !isPro && <Lock className="absolute right-1.5 top-1.5 h-2.5 w-2.5 text-muted-foreground" />}
                </button>
              ))}
            </div>
            <p className="font-body text-xs text-muted-foreground">
              {isPro ? "We'll notify you this far in advance." : "Free plan reminds you 1 hour before. Upgrade for custom timing."}
            </p>
          </section>

          {/* Notes */}
          <section className="space-y-2">
            <Label htmlFor="notes" className="font-display text-sm">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bottle from left side, 6am pump..."
              className="rounded-2xl"
            />
          </section>

          {/* Summary */}
          <div className="rounded-3xl border border-border/60 bg-sand/30 p-4">
            <p className="font-body text-xs uppercase tracking-wider text-muted-foreground">Expires</p>
            {notAllowed ? (
              <p className="mt-1 font-display text-sm text-destructive">Not safe to store this way.</p>
            ) : (
              <>
                <p className="mt-1 font-display text-lg font-semibold">
                  {expiresAt?.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
                <p className="mt-0.5 font-body text-xs text-muted-foreground">
                  About {formatCountdown(shelfMins! * 60_000)} from when it was made.
                </p>
              </>
            )}
          </div>

          <Button type="submit" disabled={saving || notAllowed} className="w-full rounded-2xl" size="lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save bottle"}
          </Button>
        </form>
      </main>

      <BottomNav />
    </div>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(s: string): Date {
  return s ? new Date(s) : new Date();
}
