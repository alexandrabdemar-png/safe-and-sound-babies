import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw, Ruler, Sparkles, ArrowRight, Clock3, X, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/Logo";
import { SoftBlob } from "@/components/SoftBlob";

// TEMP preview route — unauthenticated, static mock data, no Supabase calls.
// Used only to review the mood-board palette/typography on the home screen
// before rolling it out app-wide. Remove after review.

export const Route = createFileRoute("/design-preview")({
  ssr: false,
  component: DesignPreview,
  head: () => ({
    meta: [
      { title: "Design Preview — Peace of Mine (internal)" },
      { name: "description", content: "Internal design preview route for Peace of Mine. Not indexed." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function SummaryTile({ icon: Icon, count, label, tone = "muted" }: { icon: LucideIcon; count: number; label: string; tone?: "muted" | "danger" }) {
  const danger = tone === "danger";
  return (
    <div className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3.5 text-center ${danger ? "border-destructive/30 bg-destructive/5" : "border-border/60 bg-card"}`}>
      <Icon className={`h-4 w-4 ${danger ? "text-destructive" : "text-muted-foreground"}`} />
      <p className={`font-display text-lg font-semibold ${danger ? "text-destructive" : "text-foreground"}`}>{count}</p>
      <p className="font-body text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function InsightRow({ title, detail }: { title: string; detail: string }) {
  return (
    <li className="rounded-2xl border border-border/50 bg-background/60 p-3.5">
      <p className="font-body text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 font-body text-xs text-muted-foreground">{detail}</p>
      <div className="mt-2.5 flex gap-2">
        <button type="button" className="rounded-full border border-border px-3 py-1 font-body text-[11px] font-medium text-muted-foreground">
          Snooze 1 week
        </button>
        <button type="button" className="rounded-full bg-primary px-3 py-1 font-body text-[11px] font-medium text-primary-foreground">
          Done
        </button>
      </div>
    </li>
  );
}

function DesignPreview() {
  return (
    <div className="flex min-h-screen flex-col bg-background pb-16">
      <header className="relative overflow-hidden px-5 pt-10 pb-4 sm:px-6">
        <SoftBlob className="-right-24 -top-32" />
        <div className="mx-auto max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <Logo />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-body text-[11px] font-medium text-muted-foreground shadow-sm">
              <Sparkles className="h-3 w-3 text-accent" />
              2 to look at
            </span>
          </div>

          <p className="font-body text-sm font-medium uppercase tracking-[0.2em] text-accent">
            Good morning
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
            Peyton
          </h1>
          <p className="mt-2 font-body text-base text-muted-foreground">9 months old</p>
          <p
            className="mt-4 text-[10px] font-medium tracking-[0.12em] text-muted-foreground/50"
            style={{ fontFamily: '"Inter", system-ui, sans-serif', textTransform: "uppercase" }}
          >
            Safety guidelines based on AAP and CPSC recommendations
          </p>
        </div>
      </header>

      {/* Today card */}
      <div className="px-5 pt-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <div style={{ borderRadius: 20, backgroundColor: "#586C81", border: "1px solid rgba(255,255,255,0.08)", padding: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12, fontFamily: '"Inter", system-ui, sans-serif' }}>
              Today · Saturday
            </p>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 22, marginTop: 2 }}>💡</span>
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.55)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.10em", fontFamily: '"Inter", system-ui, sans-serif' }}>
                  Safety tip of the day
                </p>
                <p style={{ fontSize: 15, lineHeight: 1.5, color: "rgba(255,255,255,0.95)", margin: 0, fontFamily: '"Inter", system-ui, sans-serif' }}>
                  Before your baby can push up on all fours, lower the crib mattress to the next setting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert summary tiles */}
      <section className="px-5 pt-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="grid grid-cols-3 gap-2.5">
            <SummaryTile icon={AlertTriangle} count={1} label="Recalls" tone="danger" />
            <SummaryTile icon={RefreshCw} count={1} label="Replacements" />
            <SummaryTile icon={Ruler} count={0} label="Size up" />
          </div>
        </div>
      </section>

      {/* Recall banner */}
      <div className="px-5 pt-3 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between rounded-2xl bg-destructive/90 px-4 py-3 text-white">
            <span className="font-body text-sm font-semibold">
              1 recall affecting your products — tap to review
            </span>
            <button type="button" className="ml-3 shrink-0 rounded-full p-1 hover:bg-white/20" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Up next */}
      <section className="px-5 pt-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="rounded-3xl border border-border/60 bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sand/60 text-accent">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <p className="font-display text-sm font-semibold tracking-tight">Up next for Peyton</p>
            </div>
            <ul className="space-y-2.5">
              <InsightRow title="Lower the crib mattress" detail="Peyton can push up on all fours — time to drop to the next setting." />
              <InsightRow title="Consider a high chair" detail="Peyton is showing signs of readiness for solids." />
            </ul>
          </div>
        </div>
      </section>

      {/* Empty-state style card, for reference */}
      <section className="px-5 pt-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest/15 text-forest">
              <Clock3 className="h-5 w-5" />
            </div>
            <p className="font-display text-lg font-semibold tracking-tight">No recalls in the past 90 days</p>
            <p className="mx-auto mt-1 max-w-xs font-body text-sm text-muted-foreground">
              No recalls were issued in your product categories over the last 3 months.
            </p>
          </div>
        </div>
      </section>

      {/* Wordmark / italic accent sample */}
      <section className="px-5 pt-6 sm:px-6">
        <div className="mx-auto max-w-md text-center">
          <p className="font-display-italic text-2xl text-primary">Peace of Mine</p>
        </div>
      </section>
    </div>
  );
}
