import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckSquare, ClipboardList, Loader2, Package, Plus, RefreshCw, Ruler, Shield, Sparkles } from "lucide-react";
import { MomentTimeline } from "@/components/MomentTimeline";
import { BottomNav } from "@/components/BottomNav";
import { ChildSwitcher } from "@/components/ChildSwitcher";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { evaluateInsights, type Insight, type ProductInput } from "@/lib/insights";


export const Route = createFileRoute("/_authenticated/home")({
  ssr: false,
  component: HomePage,
  head: () => ({ meta: [{ title: "Home — Safe & Sound" }] }),
});

type Child = {
  id: string;
  name: string;
  date_of_birth: string | null;
  height_inches: number | null;
  weight_lbs: number | null;
  measurements_updated_at: string | null;
};


type Moment = {
  id: string;
  title: string;
  logged_at: string | null;
  notes: string | null;
};

type AlertSummary = {
  recalls: number;
  replace: number;
  sizeUp: number;
};

function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function calcAge(dob: string | null): { label: string; subtitle: string } {
  if (!dob) return { label: "Little one", subtitle: "Add birth date in profile" };
  const birth = parseDateLocal(dob);
  const days = Math.max(0, Math.floor((Date.now() - birth.getTime()) / 86400000));
  const weeks = Math.floor(days / 7);
  if (weeks < 12) return { label: `${weeks} ${weeks === 1 ? "week" : "weeks"} old`, subtitle: `${days} days of wonder` };
  const months = Math.floor(days / 30.44);
  if (months < 24) return { label: `${months} ${months === 1 ? "month" : "months"} old`, subtitle: `${weeks} weeks together` };
  const years = Math.floor(months / 12);
  return { label: `${years}y ${months % 12}m old`, subtitle: `${months} months together` };
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
  const [moments, setMoments] = useState<Moment[]>([]);
  const [alerts, setAlerts] = useState<AlertSummary>({ recalls: 0, replace: 0, sizeUp: 0 });
  const [products, setProducts] = useState<ProductInput[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let activeId: string | null = null;
      try { activeId = localStorage.getItem('safesound.activeChildId'); } catch {}
      const { data: kids, error } = await supabase
        .from("children")
        .select("id, name, date_of_birth, height_inches, weight_lbs, measurements_updated_at")
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) { toast.error(error.message); setLoading(false); return; }
      if (!kids || kids.length === 0) { navigate({ to: "/onboarding" }); return; }
      const c = (kids.find((k) => k.id === activeId) ?? kids[0]) as Child;
      setChild(c);

      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 30);
      const todayStr = new Date().toISOString().slice(0, 10);
      const horizonStr = horizon.toISOString().slice(0, 10);
      const nowIso = new Date().toISOString();

      const [mRes, recallRes, replaceRes, sizeRes, productRes, dismRes] = await Promise.all([
        supabase.from("milestones").select("id, title, logged_at, notes").eq("child_id", c.id).order("logged_at", { ascending: false }).limit(5),
        supabase.from("product_recalls").select("id", { count: "exact", head: true }).eq("acknowledged", false),
        supabase.from("products").select("id", { count: "exact", head: true }).gte("replace_at", todayStr).lte("replace_at", horizonStr),
        supabase.from("products").select("id", { count: "exact", head: true }).gte("next_size_at", todayStr).lte("next_size_at", horizonStr),
        supabase.from("products").select("id, category, purchased_at, size").or(`child_id.eq.${c.id},child_id.is.null`),
        supabase.from("insight_dismissals").select("rule_id, action, until").eq("child_id", c.id),
      ]);

      if (cancelled) return;
      if (mRes.data) setMoments(mRes.data as Moment[]);
      setAlerts({
        recalls: recallRes.count ?? 0,
        replace: replaceRes.count ?? 0,
        sizeUp: sizeRes.count ?? 0,
      });
      setProducts((productRes.data ?? []) as ProductInput[]);
      const blocked = new Set<string>();
      for (const d of (dismRes.data ?? []) as { rule_id: string; action: string; until: string | null }[]) {
        if (d.action === 'done' || d.action === 'dismissed') blocked.add(d.rule_id);
        else if (d.action === 'snoozed' && d.until && d.until > nowIso) blocked.add(d.rule_id);
      }
      setDismissedIds(blocked);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const age = useMemo(() => calcAge(child?.date_of_birth ?? null), [child]);
  const totalAlerts = alerts.recalls + alerts.replace + alerts.sizeUp;
  const upNext: Insight[] = useMemo(() => {
    const all = evaluateInsights(child, products);
    return all.filter((i) => !dismissedIds.has(i.id)).slice(0, 3);
  }, [child, products, dismissedIds]);


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-5 pt-10 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Logo className="h-4 w-4" />
              </div>
              <span className="font-display text-base font-semibold tracking-tight">Safe & Sound</span>
            </div>
            <div className="flex items-center gap-2">
              <ChildSwitcher />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-body text-[11px] font-medium text-muted-foreground shadow-sm">
                <Sparkles className="h-3 w-3 text-accent" />
                {totalAlerts === 0 ? "All quiet" : `${totalAlerts} to look at`}
              </span>
            </div>
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

      {/* Up next — proactive guidance */}
      {upNext.length > 0 && (
        <section className="px-5 pt-4 sm:px-6">
          <div className="mx-auto max-w-md">
            <div className="rounded-3xl border border-border/60 bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sand/60 text-accent">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <p className="font-display text-sm font-semibold tracking-tight">Up next for {child?.name}</p>
                </div>
                <Link to="/insights" className="font-body text-[11px] font-semibold text-accent">View all</Link>
              </div>
              <ul className="space-y-2.5">
                {upNext.map((i) => (
                  <li key={i.id} className="rounded-2xl bg-muted/40 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-body text-sm font-medium leading-snug">{i.title}</p>
                      <span className={
                        i.urgency === 'now'
                          ? "shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 font-body text-[10px] font-semibold uppercase text-destructive"
                          : i.urgency === 'soon'
                            ? "shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 font-body text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400"
                            : "shrink-0 rounded-full bg-sand/60 px-2 py-0.5 font-body text-[10px] font-semibold uppercase text-accent"
                      }>
                        {i.urgency === 'heads_up' ? 'FYI' : i.urgency}
                      </span>
                    </div>
                    <p className="mt-1 font-body text-xs text-muted-foreground line-clamp-2">{i.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Alert summary cards */}
      <section className="px-5 pt-4 sm:px-6">
        <div className="mx-auto max-w-md">
          {totalAlerts === 0 ? (
            <Link
              to="/alerts"
              className="flex items-center justify-between rounded-3xl border border-border/60 bg-card p-4 transition-all hover:border-primary/40"
            >
              <div>
                <p className="font-display text-base font-semibold tracking-tight">Nothing to do today 🌙</p>
                <p className="mt-0.5 font-body text-xs text-muted-foreground">
                  We'll only ping you about recalls, replacements, and size-ups.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              <SummaryTile
                icon={AlertTriangle}
                count={alerts.recalls}
                label="Recalls"
                tone={alerts.recalls > 0 ? "danger" : "muted"}
              />
              <SummaryTile icon={RefreshCw} count={alerts.replace} label="Replace" />
              <SummaryTile icon={Ruler} count={alerts.sizeUp} label="Size up" />
            </div>
          )}
        </div>
      </section>


      {/* Tools quick links */}
      <section className="px-5 pt-8 sm:px-6">
        <div className="mx-auto max-w-md">
          <h2 className="mb-3 font-display text-xl font-semibold tracking-tight">Tools</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <ToolCard to="/safety-guides" icon={Shield} label="Safety Milestones" />
            <ToolCard to="/caregiver-card" icon={ClipboardList} label="Caregiver Card" />
            <ToolCard to="/checklists" icon={CheckSquare} label="Room Checklists" />
            <ToolCard to="/emergency" icon={AlertTriangle} label="Emergency Hub" />
          </div>
        </div>
      </section>

      {/* Recent moments */}
      <section className="px-5 pt-10 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold tracking-tight">Moments</h2>
            <Button asChild size="sm" variant="ghost" className="rounded-full font-body text-xs">
              <Link to="/moments/new">
                <Plus className="mr-1 h-3.5 w-3.5" /> Log one
              </Link>
            </Button>
          </div>

          {moments.length === 0 ? (
            <EmptyMoments />
          ) : (
            <MomentTimeline moments={moments} />
          )}
        </div>
      </section>

      <BottomNav />
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  count,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  label: string;
  tone?: "danger" | "muted";
}) {
  const accent =
    tone === "danger"
      ? "bg-destructive/15 text-destructive"
      : count > 0
        ? "bg-sand/60 text-accent"
        : "bg-muted text-muted-foreground";
  return (
    <Link
      to="/alerts"
      className="flex flex-col items-start gap-2 rounded-2xl border border-border/60 bg-card p-3"
    >
      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${accent}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <p className="font-display text-2xl font-semibold tracking-tight">{count}</p>
      <p className="font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
    </Link>
  );
}

function MomentsTimeline({ moments }: { moments: Moment[] }) {
  return (
    <div className="relative">
      {/* Vertical spine */}
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/60" />

      <ul className="space-y-0">
        {moments.map((m, i) => {
          const isLeft = i % 2 === 0;
          const date = m.logged_at
            ? new Date(m.logged_at + "T00:00:00")
            : null;
          const dateLabel = date
            ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
            : null;
          const yearLabel = date ? date.getFullYear() : null;

          return (
            <li key={m.id} className="relative flex items-start pb-10 last:pb-0">
              {/* Dot on spine */}
              <div className="absolute left-1/2 top-3 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-primary bg-background" />

              {/* Left side */}
              <div className={`w-1/2 pr-6 ${isLeft ? "" : "invisible"}`}>
                {isLeft && (
                  <div className="text-right">
                    {yearLabel && (
                      <p className="font-display text-3xl font-semibold leading-none tracking-tight text-primary/70">
                        {yearLabel}
                      </p>
                    )}
                    {dateLabel && (
                      <p className="mt-0.5 font-body text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                        {dateLabel}
                      </p>
                    )}
                    <p className="mt-2 font-display text-sm font-semibold leading-snug tracking-tight text-foreground">
                      {m.title}
                    </p>
                    {m.notes && (
                      <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground line-clamp-3">
                        {m.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Right side */}
              <div className={`w-1/2 pl-6 ${isLeft ? "invisible" : ""}`}>
                {!isLeft && (
                  <div className="text-left">
                    {yearLabel && (
                      <p className="font-display text-3xl font-semibold leading-none tracking-tight text-primary/70">
                        {yearLabel}
                      </p>
                    )}
                    {dateLabel && (
                      <p className="mt-0.5 font-body text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                        {dateLabel}
                      </p>
                    )}
                    <p className="mt-2 font-display text-sm font-semibold leading-snug tracking-tight text-foreground">
                      {m.title}
                    </p>
                    {m.notes && (
                      <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground line-clamp-3">
                        {m.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EmptyMoments() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest/15 text-forest">
        <Package className="h-5 w-5" />
      </div>
      <p className="font-display text-lg font-semibold tracking-tight">No moments yet</p>
      <p className="mx-auto mt-1 max-w-xs font-body text-sm text-muted-foreground">
        Log whatever feels worth remembering — your baby's pace is the only one that matters.
      </p>
      <Button asChild className="mt-5 rounded-full bg-primary px-5 font-body text-xs font-semibold">
        <Link to="/moments/new">
          <Plus className="mr-1 h-3.5 w-3.5" /> Log your first moment
        </Link>
      </Button>
    </div>
  );
}
