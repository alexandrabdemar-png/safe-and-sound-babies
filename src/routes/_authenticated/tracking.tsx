import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Utensils, ClipboardList } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/tracking")({
  ssr: false,
  component: TrackingPage,
  head: () => ({ meta: [{ title: "Tracking — Peace of Mine" }] }),
});

function TrackingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 animate-fade-in">
      <header className="px-5 pt-10 pb-6 sm:px-6">
        <div className="mx-auto max-w-md">
          <p className="font-body text-sm font-medium uppercase tracking-[0.2em] text-accent">Your tools</p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight text-foreground">
            Tracking
          </h1>
          <p className="mt-2 font-body text-base text-muted-foreground">
            Log first foods and checklists in one place.
          </p>
        </div>
      </header>

      <main className="px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-3">
          <Link
            to="/first-foods"
            className="flex items-center justify-between rounded-3xl border border-border/60 bg-card p-5 transition-all hover:border-primary/40 animate-fade-up stagger-1"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Utensils className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-base font-semibold tracking-tight">First Foods</p>
                <p className="mt-0.5 font-body text-sm text-muted-foreground">
                  Track introductions and allergens
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>

          <Link
            to="/checklists"
            className="flex items-center justify-between rounded-3xl border border-border/60 bg-card p-5 transition-all hover:border-primary/40 animate-fade-up stagger-2"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <ClipboardList className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-base font-semibold tracking-tight">Safety Checklists</p>
                <p className="mt-0.5 font-body text-sm text-muted-foreground">
                  Room-by-room babyproofing guides
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
