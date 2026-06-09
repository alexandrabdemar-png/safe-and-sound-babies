import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { AlertTriangle, ArrowUpRight, Bell, Check, Loader2, RefreshCw, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/alerts")({
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

function daysFromNow(dateStr: string): number {
  const d = new Date(dateStr).getTime();
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
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function AlertsPage() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [recalls, setRecalls] = useState<RecallMatch[]>([]);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
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

  const empty = !loading && recalls.length === 0 && replaceDue.length === 0 && sizeUpDue.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-5 pt-10 pb-6 sm:px-6">
        <div className="mx-auto max-w-md">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Quiet reminders
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Alerts</h1>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            Only the things that matter — recalls, replacements, and size-ups for the gear you've logged.
          </p>
        </div>
      </header>

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

              {replaceDue.length > 0 && (
                <Section title="Time to replace" icon={RefreshCw}>
                  <ul className="space-y-2.5">
                    {replaceDue.map((p) => (
                      <ProductRow
                        key={p.id}
                        name={p.name}
                        meta={[p.brand, p.size].filter(Boolean).join(" · ")}
                        when={relative(p.when)}
                        overdue={daysFromNow(p.when) < 0}
                      />
                    ))}
                  </ul>
                </Section>
              )}

              {sizeUpDue.length > 0 && (
                <Section title="Ready for the next size" icon={Ruler}>
                  <ul className="space-y-2.5">
                    {sizeUpDue.map((p) => (
                      <ProductRow
                        key={p.id}
                        name={p.name}
                        meta={[p.brand, p.size].filter(Boolean).join(" · ")}
                        when={relative(p.when)}
                        overdue={daysFromNow(p.when) < 0}
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
}: {
  name: string;
  meta: string;
  when: string;
  overdue: boolean;
}) {
  return (
    <li className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3">
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
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest/15 text-forest">
        <Bell className="h-5 w-5" />
      </div>
      <p className="font-display text-lg font-semibold tracking-tight">All quiet 🌙</p>
      <p className="mx-auto mt-1 max-w-xs font-body text-sm text-muted-foreground">
        No recalls, replacements, or size-ups due. We'll only ping you when something actually needs a look.
      </p>
    </div>
  );
}
