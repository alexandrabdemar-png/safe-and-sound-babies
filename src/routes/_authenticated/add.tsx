import { createFileRoute, Link } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { Package, Sparkles, ArrowRight, Milk } from "lucide-react";

export const Route = createFileRoute("/_authenticated/add")({
  ssr: false,
  component: AddPage,
  head: () => ({ meta: [{ title: "Add — Peace of Mine" }] }),
});

function AddPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-5 pt-10 pb-6 sm:px-6">
        <div className="mx-auto max-w-md">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Quick add
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
            What would you like to add?
          </h1>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-3">
          <AddTile
            to="/moments/new"
            icon={Sparkles}
            title="A new moment"
            blurb="First smile, first tooth, first steps — log it when it happens."
          />
          <AddTile
            to="/bottles/new"
            icon={Milk}
            title="A bottle"
            blurb="Log formula or breastmilk and get reminded before it expires."
          />
          <AddTile
            to="/products/new"
            icon={Package}
            title="A product to watch"
            blurb="Track replacements, size-ups, and recalls on baby gear."
          />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function AddTile({
  to,
  icon: Icon,
  title,
  blurb,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-3xl border border-border/60 bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sand/60 text-accent">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-semibold tracking-tight">{title}</p>
        <p className="mt-0.5 font-body text-xs text-muted-foreground">{blurb}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
