import { logError } from "@/lib/sanitize-error";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Utensils, ClipboardList, Sparkles } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { AddSheet } from "@/components/AddSheet";
import { BottleIcon } from "@/components/BottleIcon";
import { CategoryBadge } from "@/components/CategoryBadge";
import { supabase } from "@/integrations/supabase/client";
import { useActiveChild } from "@/hooks/useActiveChild";
import {
  bottlesSummary,
  checklistsSummary,
  firstFoodsSummary,
  momentsSummary,
} from "@/lib/trackingSummaries";
// Same illustrated artwork used on the marketing home page and the product
// category picker — reused here so these cards feel consistent with
// the rest of the app instead of using plain outline icons.
import illoBreastmilk from "@/assets/hd-breastmilk.png";
import illoBabyFood from "@/assets/hd-babyfood.png";
import illoMoment from "@/assets/hd-moment.png";
import illoChecklist from "@/assets/hd-checklist.png";

export const Route = createFileRoute("/_authenticated/tracking")({
  ssr: false,
  component: TrackingPage,
  head: () => ({
    meta: [
      { title: "Track — Peace of Mine" },
      {
        name: "description",
        content:
          "Everything you've logged for your baby: moments, first foods, bottles, and safety checklists.",
      },
      { property: "og:title", content: "Track — Peace of Mine" },
      {
        property: "og:description",
        content: "Your baby's logged moments, foods, bottles, and checklists in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Summaries = {
  moments: string | null;
  foods: string | null;
  bottles: string | null;
  checklists: string | null;
};

const EMPTY: Summaries = {
  moments: null,
  foods: null,
  bottles: null,
  checklists: null,
};

function TrackingPage() {
  const { activeChild, loading: childLoading } = useActiveChild();
  const [summaries, setSummaries] = useState<Summaries>(EMPTY);
  const [addOpen, setAddOpen] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (childLoading) return;
    const childId = activeChild?.id;
    const nowIso = new Date().toISOString();

    // Each summary is independent: one failing read (e.g. a table a
    // migration hasn't reached yet) must not blank the other cards, so
    // every query is settled separately and falls back to its static blurb.
    (async () => {
      const [foods, bottlesActive, bottlesLast, moments, checklists] = await Promise.all([
        childId
          ? supabase
              .from("first_foods")
              .select("is_allergen")
              .eq("child_id", childId)
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("bottles")
          .select("id", { count: "exact", head: true })
          .is("finished_at", null)
          .gt("expires_at", nowIso),
        supabase
          .from("bottles")
          .select("started_at")
          .order("started_at", { ascending: false })
          .limit(1),
        childId
          ? supabase
              .from("milestones")
              .select("logged_at")
              .eq("child_id", childId)
              .order("logged_at", { ascending: false })
          : Promise.resolve({ data: null, error: null }),
        supabase.from("checklist_completions").select("id", { count: "exact", head: true }),
      ]);

      if (!mountedRef.current) return;

      const foodRows = (foods.data ?? []) as { is_allergen: boolean }[];
      const momentRows = (moments.data ?? []) as { logged_at: string | null }[];
      const lastBottle = ((bottlesLast.data ?? []) as { started_at: string }[])[0]?.started_at ?? null;

      setSummaries({
        foods: foods.error
          ? null
          : firstFoodsSummary(foodRows.length, foodRows.filter((f) => f.is_allergen).length),
        bottles: bottlesActive.error
          ? null
          : bottlesSummary(bottlesActive.count ?? 0, lastBottle),
        moments: moments.error
          ? null
          : momentsSummary(momentRows.length, momentRows[0]?.logged_at ?? null),
        checklists: checklists.error ? null : checklistsSummary(checklists.count ?? 0),
      });
    })().catch((err) => logError("[tracking] failed to load summaries", err));
  }, [childLoading, activeChild?.id]);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 animate-fade-in">
      <header className="px-5 pt-10 pb-6 sm:px-6">
        <div className="mx-auto max-w-md">
          <p className="font-body text-sm font-medium uppercase tracking-[0.2em] text-accent">
            Your history
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight text-foreground">
            Track
          </h1>
          <p className="mt-2 font-body text-base text-muted-foreground">
            Everything you've logged{activeChild ? ` for ${activeChild.name}` : ""} — tap any card to
            see the full log.
          </p>
        </div>
      </header>

      <main className="px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-3">
          <TrackCard
            to="/moments"
            icon={Sparkles}
            illustration={illoMoment}
            title="Moments"
            blurb="Milestones and firsts, on a timeline"
            summary={summaries.moments}
            stagger="stagger-1"
          />
          <TrackCard
            to="/first-foods"
            icon={Utensils}
            illustration={illoBabyFood}
            title="First Foods"
            blurb="Foods introduced and any allergen reactions"
            summary={summaries.foods}
            stagger="stagger-2"
          />
          <TrackCard
            to="/bottles"
            icon={BottleIcon}
            illustration={illoBreastmilk}
            title="Bottles"
            blurb="Prepared bottles and safe-use windows"
            summary={summaries.bottles}
            stagger="stagger-3"
          />
          <TrackCard
            to="/checklists"
            icon={ClipboardList}
            illustration={illoChecklist}
            title="Safety Checklists"
            blurb="Room-by-room babyproofing and travel guides"
            summary={summaries.checklists}
            stagger="stagger-4"
          />
        </div>

        <div className="mx-auto mt-4 max-w-md">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            aria-haspopup="dialog"
            className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-border/70 p-4 font-body text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Need to log something?
            <ArrowRight className="h-4 w-4" />
          </button>
          <AddSheet open={addOpen} onOpenChange={setAddOpen} />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function TrackCard({
  to,
  icon: Icon,
  illustration,
  title,
  blurb,
  summary,
  stagger,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  illustration?: string;
  title: string;
  blurb: string;
  summary: string | null;
  stagger: string;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center justify-between rounded-3xl border border-border/60 bg-card p-5 transition-all hover:border-primary/40 animate-fade-up ${stagger}`}
    >
      <div className="flex items-center gap-4">
        {illustration ? (
          <CategoryBadge icon={Icon} illustration={illustration} className="h-12 w-12" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <p className="font-display text-base font-semibold tracking-tight">{title}</p>
          <p className="mt-0.5 font-body text-sm text-muted-foreground">{summary ?? blurb}</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
