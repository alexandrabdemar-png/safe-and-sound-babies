import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Sparkles, Loader2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useActiveChild } from "@/hooks/useActiveChild";

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

function InsightsPage() {
  const { isPro, loading: subLoading } = useSubscription();
  const { activeChildId } = useActiveChild();
  const [milestones, setMilestones] = useState<{ logged_at: string | null; category: string | null }[]>([]);
  const [products, setProducts] = useState<{ created_at: string; replace_at: string | null; category: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPro || !activeChildId) { setLoading(false); return; }
    (async () => {
      const [mRes, pRes] = await Promise.all([
        supabase.from('milestones').select('logged_at, category').eq('child_id', activeChildId),
        supabase.from('products').select('created_at, replace_at, category'),
      ]);
      setMilestones((mRes.data ?? []) as any);
      setProducts((pRes.data ?? []) as any);
      setLoading(false);
    })();
  }, [isPro, activeChildId]);

  const momentBuckets = useMemo(() => bucketByMonth(milestones.map((m) => m.logged_at)), [milestones]);
  const productBuckets = useMemo(() => bucketByMonth(products.map((p) => p.created_at)), [products]);
  const categoryBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) { const k = p.category || 'other'; m.set(k, (m.get(k) ?? 0) + 1); }
    return Array.from(m.entries()).sort((a,b) => b[1] - a[1]).slice(0, 6);
  }, [products]);
  const upcoming = useMemo(() => {
    const today = new Date(); const horizon = new Date(); horizon.setDate(horizon.getDate() + 60);
    return products
      .filter((p) => p.replace_at && new Date(p.replace_at) >= today && new Date(p.replace_at) <= horizon)
      .sort((a,b) => (a.replace_at! < b.replace_at! ? -1 : 1))
      .slice(0, 5);
  }, [products]);

  if (subLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!isPro) {
    return (
      <div className="flex min-h-screen flex-col bg-background pb-28">
        <header className="px-5 pt-8">
          <div className="mx-auto max-w-md">
            <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/home"><ArrowLeft className="h-4 w-4 mr-1" /> Home</Link></Button>
          </div>
        </header>
        <div className="mx-auto max-w-md p-5 mt-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-semibold">Insights is a Pro feature</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            See growth-tracking charts, product category breakdown, and replacement timelines.
          </p>
          <Button asChild className="mt-5 rounded-full"><Link to="/pricing"><Sparkles className="h-4 w-4 mr-2" /> Upgrade to Pro</Link></Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-5 pt-10 pb-4">
        <div className="mx-auto max-w-md">
          <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/home"><ArrowLeft className="h-4 w-4 mr-1" /> Home</Link></Button>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Insights</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-5 space-y-4">
        {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : (
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
            <Card title="Upcoming replacements (next 60 days)">
              {upcoming.length === 0 ? <Empty>Nothing due soon 🌿</Empty> : (
                <ul className="space-y-2">
                  {upcoming.map((p, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span className="text-foreground/80">{p.category?.replace('_',' ') || 'Product'}</span>
                      <span className="text-muted-foreground">{new Date(p.replace_at!).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
      <BottomNav />
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
