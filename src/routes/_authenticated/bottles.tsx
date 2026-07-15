import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Loader2, Milk, Plus, Trash2 } from "lucide-react";
import { BottleIllustration } from "@/components/EmptyIllustration";
import { hapticSuccess, hapticDismiss } from "@/lib/haptic";
import { friendlyError } from "@/lib/errors";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  bottleTypeLabel,
  storageLabel,
  formatCountdown,
  type BottleType,
  type Storage,
} from "@/lib/bottleRules";

export const Route = createFileRoute("/_authenticated/bottles")({
  ssr: false,
  component: BottlesPage,
  head: () => ({ meta: [{ title: "Bottles — Peace of Mine" }] }),
});

type Bottle = {
  id: string;
  bottle_type: BottleType;
  storage: Storage;
  started_at: string;
  expires_at: string;
  alert_minutes_before: number;
  ounces: number | null;
  notes: string | null;
  finished_at: string | null;
  notified_at: string | null;
};

function BottlesPage() {
  const [loading, setLoading] = useState(true);
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const notifiedRef = useRef<Set<string>>(new Set());

  // Live ticking
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("bottles")
        .select("id, bottle_type, storage, started_at, expires_at, alert_minutes_before, ounces, notes, finished_at, notified_at")
        .is("finished_at", null)
        .order("expires_at", { ascending: true });
      if (cancelled) return;
      if (error) toast.error(error.message);
      else setBottles((data ?? []) as Bottle[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Request notification permission once
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {/* ignore */});
    }
  }, []);

  // Fire reminders when threshold crossed
  useEffect(() => {
    bottles.forEach((b) => {
      if (b.finished_at) return;
      const exp = new Date(b.expires_at).getTime();
      const threshold = exp - b.alert_minutes_before * 60_000;
      if (now >= threshold && now < exp + 60_000 && !notifiedRef.current.has(b.id)) {
        notifiedRef.current.add(b.id);
        const label = bottleTypeLabel(b.bottle_type);
        const remaining = Math.max(0, Math.round((exp - now) / 60_000));
        const msg =
          remaining > 0
            ? `${label} reaches its estimated window in ${remaining}m`
            : `${label} is past its estimated window — worth a check before use`;
        toast(msg);
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try { new Notification("Peace of Mine", { body: msg }); } catch {/* ignore */}
        }
      }
    });
  }, [now, bottles]);

  async function markFinished(id: string) {
    const { error } = await supabase
      .from("bottles")
      .update({ finished_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(friendlyError(error.message)); return; }
    hapticSuccess();
    setBottles((prev) => prev.filter((b) => b.id !== id));
    toast.success("All done — nice work staying on top of it.");
  }

  async function discard(id: string) {
    const { error } = await supabase.from("bottles").delete().eq("id", id);
    if (error) { toast.error(friendlyError(error.message)); return; }
    hapticDismiss();
    setBottles((prev) => prev.filter((b) => b.id !== id));
  }

  const sorted = useMemo(() => [...bottles].sort((a, b) =>
    new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()), [bottles]);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 animate-fade-in">
      <header className="px-5 pt-10 pb-4 sm:px-6">
        <div className="mx-auto flex max-w-md items-end justify-between">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-accent">Feeding</p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Bottles</h1>
          </div>
          <Button asChild size="sm" className="rounded-2xl">
            <Link to="/bottles/new"><Plus className="mr-1 h-4 w-4" /> Log</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : sorted.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-3">
              {sorted.map((b) => (
                <BottleCard key={b.id} bottle={b} now={now} onFinish={() => markFinished(b.id)} onDiscard={() => discard(b.id)} />
              ))}
            </ul>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function BottleCard({ bottle, now, onFinish, onDiscard }: {
  bottle: Bottle;
  now: number;
  onFinish: () => void;
  onDiscard: () => void;
}) {
  const expMs = new Date(bottle.expires_at).getTime();
  const remaining = expMs - now;
  const expired = remaining <= 0;
  const warning = !expired && remaining <= bottle.alert_minutes_before * 60_000;

  return (
    <li className={cn(
      "rounded-3xl border bg-card p-4 transition-colors",
      expired ? "border-destructive/40 bg-destructive/5"
        : warning ? "border-accent/50 bg-accent/5"
        : "border-border/60",
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
          expired ? "bg-destructive/15 text-destructive"
            : warning ? "bg-accent/20 text-accent"
            : "bg-sand/60 text-accent",
        )}>
          <Milk className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold truncate">
            {bottleTypeLabel(bottle.bottle_type)}
            {bottle.ounces ? <span className="ml-1 text-muted-foreground font-normal">· {bottle.ounces} oz</span> : null}
          </p>
          <p className="font-body text-xs text-muted-foreground">
            {storageLabel(bottle.storage)} · made {new Date(bottle.started_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
          <p className={cn(
            "mt-1 font-display text-base font-semibold",
            expired ? "text-destructive" : warning ? "text-accent" : "text-foreground",
          )}>
            {formatCountdown(remaining)}
          </p>
          {bottle.notes && <p className="mt-1 font-body text-xs text-muted-foreground line-clamp-2">{bottle.notes}</p>}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={onFinish} size="sm" variant="secondary" className="flex-1 rounded-2xl">
          <Check className="mr-1 h-3.5 w-3.5" /> Used
        </Button>
        <Button onClick={onDiscard} size="sm" variant="ghost" className="rounded-2xl text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-sand/30 p-8 text-center animate-scale-in">
      <BottleIllustration className="mx-auto mb-1 h-24 w-24" />
      <p className="font-display text-base font-semibold">No bottles on the clock</p>
      <p className="mt-1 font-body text-xs text-muted-foreground">
        Log a bottle and we'll count down when it needs to be used.
      </p>
      <Button asChild className="mt-4 rounded-2xl" size="sm">
        <Link to="/bottles/new"><Plus className="mr-1 h-4 w-4" /> Log a bottle</Link>
      </Button>
    </div>
  );
}
