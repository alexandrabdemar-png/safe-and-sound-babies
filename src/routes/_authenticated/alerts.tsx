import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { AlertTriangle, ArrowLeft, ArrowUpRight, Bell, Check, ChevronDown, ChevronUp, Loader2, RefreshCw, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/alerts")({
  ssr: false,
  component: AlertsPage,
  head: () => ({ meta: [{ title: "Alerts — Safe & Sound" }] }),
});

type Product = {
  id: string;
  name: string;
  brand: string | null;
  size: string | null;
  replace_at: string | null;
  next_size_at: string | null;
  predicted_sizeup_date: string | null;
  predicted_replacement_date: string | null;
};

type RecallMatch = {
  id: string;
  acknowledged: boolean;
  product_id: string;
  products: { name: string; brand: string | null } | null;
  recalls: {
    id: string;
    title: string;
    hazard: string | null;
    remedy: string | null;
    url: string | null;
    recall_date: string | null;
  } | null;
};

type InsightAlert = {
  id: string;
  rule_id: string;
  child_id: string;
  title: string;
  body: string;
};

function daysFromNow(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00").getTime();
  const now = Date.now();
  return Math.round((d - now) / (1000 * 60 * 60 * 24));
}

function relative(dateStr: string): string {
  const days = daysFromNow(dateStr);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  if (days < 14) return "next week";
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function AlertsPage() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [recalls, setRecalls] = useState<RecallMatch[]>([]);
  const [activeChildId, setActiveChildIdState] = useState<string | null>(null);
  // Insight alerts dismissed optimistically
  const [dismissedRuleIds, setDismissedRuleIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    // Get active child id
    let childId: string | null = null;
    try { childId = localStorage.getItem("safesound.activeChildId"); } catch {}
    if (!childId) {
      const { data: kids } = await supabase.from("children").select("id").order("created_at", { ascending: true }).limit(1);
      childId = kids?.[0]?.id ?? null;
    }
    setActiveChildIdState(childId);

    const [pRes, rRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, brand, size, replace_at, next_size_at, predicted_sizeup_date, predicted_replacement_date")
        .or("replace_at.not.is.null,next_size_at.not.is.null,predicted_sizeup_date.not.is.null,predicted_replacement_date.not.is.null"),
      supabase
        .from("product_recalls")
        .select(
          "id, acknowledged, product_id, products(name, brand), recalls(id, title, hazard, remedy, url, recall_date)",
        )
        .eq("acknowledged", false),
    ]);

    if (pRes.error) toast.error(pRes.error.message);
    else setProducts((pRes.data ?? []) as Product[]);
    if (rRes.error) toast.error(rRes.error.message);
    else setRecalls((rRes.data ?? []) as unknown as RecallMatch[]);
    setLoading(false);
  }

  async function markInsightDone(ruleId: string) {
    if (!activeChildId) return;
    // Optimistic removal
    setDismissedRuleIds((prev) => new Set([...prev, ruleId]));
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { error } = await supabase.from("insight_dismissals").upsert(
      { user_id: userId, child_id: activeChildId, rule_id: ruleId, action: "done", until: null },
      { onConflict: "child_id,rule_id" }
    );
    if (error) {
      console.error("insight_dismissals upsert error:", error);
      // Rollback
      setDismissedRuleIds((prev) => { const next = new Set(prev); next.delete(ruleId); return next; });
      toast.error(error.message);
    }
  }

  const replaceDue = useMemo(
    () =>
      products
        .map((p) => ({ ...p, when: p.predicted_replacement_date ?? p.replace_at }))
        .filter((p): p is Product & { when: string } => !!p.when)
        .sort((a, b) => a.when.localeCompare(b.when)),
    [products],
  );
  const sizeUpDue = useMemo(
    () =>
      products
        .map((p) => ({ ...p, when: p.predicted_sizeup_date ?? p.next_size_at }))
        .filter((p): p is Product & { when: string } => !!p.when)
        .sort((a, b) => a.when.localeCompare(b.when)),
    [products],
  );

  async function dismissRecall(id: string) {
    const prev = recalls;
    setRecalls((r) => r.filter((x) => x.id !== id));
    const { error } = await supabase
      .from("product_recalls")
      .update({ acknowledged: true })
      .eq("id", id);
    if (error) {
      setRecalls(prev);
      toast.error(error.message);
    }
  }

  const visibleReplace = useMemo(() => replaceDue.filter((p) => !dismissedRuleIds.has(`replace:${p.id}`)), [replaceDue, dismissedRuleIds]);
  const visibleSizeUp = useMemo(() => sizeUpDue.filter((p) => !dismissedRuleIds.has(`sizeup:${p.id}`)), [sizeUpDue, dismissedRuleIds]);

  const empty = !loading && recalls.length === 0 && visibleReplace.length === 0 && visibleSizeUp.length === 0;

  // Recalls for products you own (already in `recalls` state — these are product_recalls with acknowledged=false)
  const ownedRecalls = recalls;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-5 pt-10 pb-6 sm:px-6">
        <div className="mx-auto max-w-md">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 rounded-full font-body text-xs">
            <Link to="/home"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Home</Link>
          </Button>
          <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Your reminders
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Alerts</h1>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            Only the things that matter — recalls, replacements, and size-ups for the gear you've logged.
          </p>
        </div>
      </header>

      {/* Prominent banner: products you own with active recalls */}
      {!loading && ownedRecalls.length > 0 && (
        <div className="px-5 pb-4 sm:px-6">
          <div className="mx-auto max-w-md">
            <div className="rounded-3xl border-2 border-destructive/40 bg-destructive/8 p-5" style={{ backgroundColor: "rgba(185, 28, 28, 0.06)" }}>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-semibold text-destructive">
                    Products You Own With Active Recalls
                  </h2>
                  <p className="font-body text-xs text-destructive/80">
                    {ownedRecalls.length} product{ownedRecalls.length !== 1 ? "s" : ""} need{ownedRecalls.length === 1 ? "s" : ""} your attention
                  </p>
                </div>
              </div>
              <ul className="space-y-2.5">
                {ownedRecalls.map((r) => (
                  <BannerRecallItem key={r.id} item={r} />
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-8">
          {loading ? (
            <div className="flex justify-center pt-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : empty ? (
            <EmptyState />
          ) : (
            <>
              {recalls.length > 0 && (
                <Section title="Safety recalls" tone="danger" icon={AlertTriangle}>
                  <ul className="space-y-3">
                    {recalls.map((r) => (
                      <RecallCard key={r.id} item={r} onDismiss={() => dismissRecall(r.id)} />
                    ))}
                  </ul>
                </Section>
              )}

              {visibleReplace.length > 0 && (
                <Section title="Time to replace" icon={RefreshCw}>
                  <ul className="space-y-2.5">
                    {visibleReplace.map((p) => (
                      <ProductRow
                        key={p.id}
                        name={p.name}
                        meta={[p.brand, p.size].filter(Boolean).join(" · ")}
                        when={relative(p.when)}
                        overdue={daysFromNow(p.when) < 0}
                        onDone={() => markInsightDone(`replace:${p.id}`)}
                      />
                    ))}
                  </ul>
                </Section>
              )}

              {visibleSizeUp.length > 0 && (
                <Section title="Ready for the next size" icon={Ruler}>
                  <ul className="space-y-2.5">
                    {visibleSizeUp.map((p) => (
                      <ProductRow
                        key={p.id}
                        name={p.name}
                        meta={[p.brand, p.size].filter(Boolean).join(" · ")}
                        when={relative(p.when)}
                        overdue={daysFromNow(p.when) < 0}
                        onDone={() => markInsightDone(`sizeup:${p.id}`)}
                      />
                    ))}
                  </ul>
                </Section>
              )}
            </>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span
          className={
            tone === "danger"
              ? "flex h-7 w-7 items-center justify-center rounded-full bg-destructive/15 text-destructive"
              : "flex h-7 w-7 items-center justify-center rounded-full bg-sand/60 text-accent"
          }
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function RecallCard({ item, onDismiss }: { item: RecallMatch; onDismiss: () => void }) {
  const recall = item.recalls;
  const product = item.products;
  if (!recall) return null;
  return (
    <li className="rounded-3xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="font-display text-base font-semibold tracking-tight text-foreground">
        {product?.name ?? recall.title}
      </p>
      <p className="mt-1 font-body text-xs uppercase tracking-[0.15em] text-destructive">
        {recall.title}
      </p>
      {recall.hazard && (
        <p className="mt-3 font-body text-sm text-foreground/80">
          <span className="font-semibold">Hazard:</span> {recall.hazard}
        </p>
      )}
      {recall.remedy && (
        <p className="mt-1.5 font-body text-sm text-foreground/80">
          <span className="font-semibold">What to do:</span> {recall.remedy}
        </p>
      )}
      <div className="mt-4 flex items-center gap-2">
        {recall.url && (
          <a
            href={recall.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-destructive px-3.5 py-1.5 font-body text-xs font-semibold text-destructive-foreground"
          >
            Read details <ArrowUpRight className="h-3 w-3" />
          </a>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="rounded-full font-body text-xs"
        >
          <Check className="mr-1 h-3.5 w-3.5" /> I've handled it
        </Button>
      </div>
    </li>
  );
}

function ProductRow({
  name,
  meta,
  when,
  overdue,
  onDone,
}: {
  name: string;
  meta: string;
  when: string;
  overdue: boolean;
  onDone?: () => void;
}) {
  return (
    <li className="rounded-2xl border border-border/60 bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold tracking-tight">{name}</p>
          {meta && <p className="truncate font-body text-xs text-muted-foreground">{meta}</p>}
        </div>
        <span
          className={
            overdue
              ? "shrink-0 rounded-full bg-destructive/15 px-2.5 py-1 font-body text-[11px] font-semibold text-destructive"
              : "shrink-0 rounded-full bg-sand/60 px-2.5 py-1 font-body text-[11px] font-semibold text-foreground/70"
          }
        >
          {when}
        </span>
      </div>
      {onDone && (
        <Button size="sm" variant="ghost" onClick={onDone} className="mt-2 rounded-full font-body text-xs">
          <Check className="mr-1 h-3.5 w-3.5" /> Mark as done
        </Button>
      )}
    </li>
  );
}

function BannerRecallItem({ item }: { item: RecallMatch }) {
  const [expanded, setExpanded] = useState(false);
  const recall = item.recalls;
  const product = item.products;
  if (!recall) return null;
  const snippet = recall.hazard ?? recall.title;
  const isLong = snippet.length > 80;
  return (
    <li className="rounded-2xl border border-destructive/25 bg-white/70 px-4 py-3 dark:bg-destructive/10">
      <p className="font-display text-sm font-semibold tracking-tight text-foreground">
        {product?.name ?? recall.title}
      </p>
      <p className={`mt-0.5 font-body text-xs text-foreground/70 ${!expanded && isLong ? "line-clamp-2" : ""}`}>{snippet}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 inline-flex items-center gap-0.5 font-body text-xs font-semibold text-destructive/80 hover:underline"
        >
          {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show more</>}
        </button>
      )}
      {recall.url && (
        <a
          href={recall.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 font-body text-xs font-semibold text-destructive hover:underline"
        >
          Verify on CPSC.gov <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest/15 text-forest">
        <Bell className="h-5 w-5" />
      </div>
      <p className="font-display text-lg font-semibold tracking-tight">You're all caught up</p>
      <p className="mx-auto mt-1 max-w-xs font-body text-sm text-muted-foreground">
        We'll nudge you when something needs your attention — recalls, replacements, or a size-up coming up.
      </p>
    </div>
  );
}
