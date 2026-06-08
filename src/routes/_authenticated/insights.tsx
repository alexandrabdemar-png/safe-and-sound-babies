import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Sparkles, Loader2, Check, Clock, X, AlertCircle } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useActiveChild } from "@/hooks/useActiveChild";
import { evaluateInsights, type Insight, type InsightUrgency, type ProductInput, URGENCY_LABEL } from "@/lib/insights";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
  head: () => ({ meta: [{ title: "Insights — Safe & Sound" }] }),
});

type Bucket = { label: string; count: number };

function bucketByMonth(dates: (string | null)[]): Bucket[] {
  const map = new Map<string, number>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, 0);
  }
  for (const ds of dates) {
    if (!ds) continue;
    const d = new Date(ds);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([k, v]) => ({
    label: new Date(k + '-01').toLocaleDateString(undefined, { month: 'short' }),
    count: v,
  }));
}

type Dismissal = { rule_id: string; action: 'done' | 'snoozed' | 'dismissed'; until: string | null };

function InsightsPage() {
  const { isPro, loading: subLoading } = useSubscription();
  const { activeChild, activeChildId } = useActiveChild();
  const [milestones, setMilestones] = useState<{ logged_at: string | null; category: string | null }[]>([]);
  const [products, setProducts] = useState<(ProductInput & { created_at: string; replace_at: string | null })[]>([]);
  const [dismissals, setDismissals] = useState<Dismissal[]>([]);
  const [loading, setLoading] = useState(true);

  async function refreshDismissals(childId: string) {
    const { data } = await supabase
      .from('insight_dismissals')
      .select('rule_id, action, until')
      .eq('child_id', childId);
    setDismissals((data ?? []) as Dismissal[]);
  }

  useEffect(() => {
    if (!activeChildId) { setLoading(false); return; }
    (async () => {
      const [mRes, pRes] = await Promise.all([
        supabase.from('milestones').select('logged_at, category').eq('child_id', activeChildId),
        supabase.from('products').select('id, created_at, replace_at, category, purchased_at, size').or(`child_id.eq.${activeChildId},child_id.is.null`),
      ]);
      setMilestones((mRes.data ?? []) as never);
      setProducts((pRes.data ?? []) as never);
      await refreshDismissals(activeChildId);
      setLoading(false);
    })();
  }, [activeChildId]);

  const allInsights = useMemo(
    () => evaluateInsights(activeChild, products),
    [activeChild, products],
  );

  const visibleInsights = useMemo(() => {
    const now = Date.now();
    const blocked = new Set(
      dismissals
        .filter((d) => d.action === 'done' || d.action === 'dismissed' || (d.action === 'snoozed' && d.until && new Date(d.until).getTime() > now))
        .map((d) => d.rule_id),
    );
    return allInsights.filter((i) => !blocked.has(i.id));
  }, [allInsights, dismissals]);

  const grouped = useMemo(() => {
    const g: Record<InsightUrgency, Insight[]> = { now: [], soon: [], heads_up: [] };
    for (const i of visibleInsights) g[i.urgency].push(i);
    return g;
  }, [visibleInsights]);

  async function dismiss(ruleId: string, action: 'done' | 'snoozed' | 'dismissed') {
    if (!activeChildId) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const until = action === 'snoozed' ? new Date(Date.now() + 7 * 86400_000).toISOString() : null;
    const { error } = await supabase.from('insight_dismissals').upsert({
      user_id: u.user.id,
      child_id: activeChildId,
      rule_id: ruleId,
      action,
      until,
    } as never, { onConflict: 'user_id,child_id,rule_id' });
    if (error) { toast.error(error.message); return; }
    await refreshDismissals(activeChildId);
    toast.success(action === 'done' ? 'Marked done' : action === 'snoozed' ? 'Snoozed 1 week' : 'Dismissed');
  }

  const momentBuckets = useMemo(() => bucketByMonth(milestones.map((m) => m.logged_at)), [milestones]);
  const productBuckets = useMemo(() => bucketByMonth(products.map((p) => p.created_at)), [products]);
  const categoryBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) { const k = p.category || 'other'; m.set(k, (m.get(k) ?? 0) + 1); }
    return Array.from(m.entries()).sort((a,b) => b[1] - a[1]).slice(0, 6);
  }, [products]);

  if (subLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-5 pt-10 pb-4">
        <div className="mx-auto max-w-md">
          <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/home"><ArrowLeft className="h-4 w-4 mr-1" /> Home</Link></Button>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Insights</h1>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            Proactive recommendations based on {activeChild?.name ?? 'your baby'}'s age and gear.
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-5 space-y-4">
        {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : (
          <>
            {/* Proactive guidance — always free */}
            <section className="space-y-4">
              {visibleInsights.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
                  <Sparkles className="mx-auto h-5 w-5 text-accent mb-2" />
                  <p className="font-display text-base font-semibold">Nothing to flag right now 🌿</p>
                  <p className="mt-1 font-body text-xs text-muted-foreground">
                    We'll surface new recommendations as {activeChild?.name ?? 'your baby'} grows.
                  </p>
                </div>
              ) : (
                (['now', 'soon', 'heads_up'] as InsightUrgency[]).map((u) =>
                  grouped[u].length > 0 ? (
                    <UrgencyGroup
                      key={u}
                      urgency={u}
                      insights={grouped[u]}
                      onDismiss={dismiss}
                    />
                  ) : null,
                )
              )}
            </section>

            {/* Pro-only charts */}
            {isPro ? (
              <>
                <Card title="Moments logged (last 6 months)">
                  <BarChart data={momentBuckets} />
                </Card>
                <Card title="Products added (last 6 months)">
                  <BarChart data={productBuckets} />
                </Card>
                <Card title="Category breakdown">
                  {categoryBreakdown.length === 0 ? <Empty>No products yet</Empty> : (
                    <ul className="space-y-1.5">
                      {categoryBreakdown.map(([cat, count]) => (
                        <li key={cat} className="flex items-center gap-2 text-sm">
                          <span className="w-24 truncate text-muted-foreground">{cat.replace('_',' ')}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${(count / Math.max(...categoryBreakdown.map(c => c[1]))) * 100}%` }} />
                          </div>
                          <span className="w-6 text-right text-xs">{count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </>
            ) : (
              <div className="rounded-3xl border border-border bg-card p-5 text-center">
                <BarChart3 className="mx-auto h-5 w-5 text-primary mb-2" />
                <p className="font-display text-base font-semibold">Unlock charts with Pro</p>
                <p className="mt-1 font-body text-xs text-muted-foreground">
                  See growth tracking, category breakdowns, and replacement timelines.
                </p>
                <Button asChild className="mt-3 rounded-full"><Link to="/pricing"><Sparkles className="h-3.5 w-3.5 mr-1" /> Upgrade</Link></Button>
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function UrgencyGroup({
  urgency,
  insights,
  onDismiss,
}: {
  urgency: InsightUrgency;
  insights: Insight[];
  onDismiss: (id: string, action: 'done' | 'snoozed' | 'dismissed') => void;
}) {
  const tone =
    urgency === 'now'
      ? { bg: 'bg-destructive/10', text: 'text-destructive', icon: AlertCircle }
      : urgency === 'soon'
        ? { bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', icon: Clock }
        : { bg: 'bg-sand/60', text: 'text-accent', icon: Sparkles };
  const Icon = tone.icon;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${tone.bg} ${tone.text}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className={`font-body text-xs font-semibold uppercase tracking-[0.15em] ${tone.text}`}>
          {URGENCY_LABEL[urgency]}
        </p>
      </div>
      <ul className="space-y-2">
        {insights.map((i) => (
          <li key={i.id} className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="font-display text-base font-semibold tracking-tight">{i.title}</p>
            <p className="mt-1 font-body text-sm text-muted-foreground">{i.body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="rounded-full h-8 text-xs" onClick={() => onDismiss(i.id, 'done')}>
                <Check className="h-3 w-3 mr-1" /> Done
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full h-8 text-xs" onClick={() => onDismiss(i.id, 'snoozed')}>
                <Clock className="h-3 w-3 mr-1" /> Snooze 1 wk
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full h-8 text-xs text-muted-foreground" onClick={() => onDismiss(i.id, 'dismissed')}>
                <X className="h-3 w-3 mr-1" /> Not relevant
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5">
      <h2 className="font-display text-sm font-semibold mb-3 text-foreground/80">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground text-center py-3">{children}</p>;
}

function BarChart({ data }: { data: Bucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((b) => (
        <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex flex-1 items-end w-full">
            <div
              className="w-full rounded-t bg-primary/70 transition-all"
              style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count > 0 ? '4px' : '0' }}
              title={`${b.count}`}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{b.label}</span>
          <span className="text-[10px] font-medium">{b.count}</span>
        </div>
      ))}
    </div>
  );
}
