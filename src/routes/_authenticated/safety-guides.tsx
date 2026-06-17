import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { CheckCircle2, ChevronDown, ChevronUp, Clock, Shield, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/_authenticated/safety-guides")({
  ssr: false,
  component: SafetyGuidesPage,
  head: () => ({ meta: [{ title: "Safety Guides — Safe & Sound" }] }),
});

const SAFETY_MILESTONES = [
  { ageMonths: 0, title: "Newborn safe sleep", items: ["Back to sleep every time", "Firm flat surface only", "No loose bedding, bumpers, or toys", "Room-share without bed-sharing for 6 months", "Avoid overheating"] },
  { ageMonths: 2, title: "Tummy time safety", items: ["Always supervised", "On firm surface", "Stop if baby falls asleep"] },
  { ageMonths: 4, title: "Rolling & positioning", items: ["Lower crib mattress now", "Remove mobiles within reach", "Never leave unattended on elevated surfaces"] },
  { ageMonths: 6, title: "Starting solids safety", items: ["No honey under 12 months", "Avoid choking hazards — grapes, nuts, raw veggies", "Watch for allergic reactions with new foods", "No cow's milk as main drink under 12 months"] },
  { ageMonths: 9, title: "Crawling & exploring", items: ["Install baby gates at stairs", "Cover electrical outlets", "Lock lower cabinets with chemicals", "Pad sharp furniture corners", "Check floor for small objects daily"] },
  { ageMonths: 12, title: "Walking & climbing", items: ["Anchor all tall furniture to walls", "Move cleaning products to high shelves", "Install toilet locks", "Check window stops and screens", "Remove crib bumpers and large stuffed animals"] },
  { ageMonths: 18, title: "Toddler proofing", items: ["Stair gates still needed", "Discourage climbing on furniture", "Hot beverage awareness — keep out of reach", "Parking lot hand-holding rule starts now"] },
  { ageMonths: 24, title: "Transition to forward-facing car seat", items: ["Keep rear-facing as long as possible (check seat weight limit)", "Forward-facing minimum: 2 years old AND at weight limit", "Harness must be at or above shoulders", "No puffy coats in car seat"] },
  { ageMonths: 36, title: "Preschool age safety", items: ["Teach body safety and consent", "Practice name, address, and 911", "Helmet for all wheeled activities", "Pool: arm floaties are NOT life jackets", "Stranger safety basics"] },
  { ageMonths: 48, title: "Bike & outdoor safety", items: ["Properly fitted bike helmet every ride", "Teach road safety — stop at driveways", "Sunscreen SPF 30+ daily outdoors", "Know your child's friends and parents"] },
  { ageMonths: 60, title: "School age safety", items: ["Bus and walking route safety", "Backpack under 10-15% of body weight", "Internet and screen safety basics", "What to do if lost or approached by stranger", "Life jacket for all water activities"] },
  { ageMonths: 84, title: "Booster seat transition", items: ["Move from harness to booster when at weight/height limit", "Booster until seat belt fits correctly (usually 4'9\")", "Back seat until 13 years old", "Teach bike lane and pedestrian rules"] },
];

const VISIT_PREP = [
  { ageRange: [0, 2] as [number, number], title: "1–2 month visit", questions: ["Is my baby's weight gain on track?", "When should I start tummy time?", "What are normal newborn sleep patterns?", "Which vaccines are due today?", "Signs of postpartum depression to watch for?"] },
  { ageRange: [2, 6] as [number, number], title: "2–6 month visit", questions: ["Is development on track?", "When to introduce solid foods?", "How do I know if my baby is eating enough?", "Sleep training — what's safe at this age?", "Teething — what's normal?"] },
  { ageRange: [6, 12] as [number, number], title: "6–12 month visit", questions: ["Which foods to introduce first?", "How to handle separation anxiety?", "When should first words appear?", "Is crawling on track?", "Fluoride — do we need drops?"] },
  { ageRange: [12, 24] as [number, number], title: "12–24 month visit", questions: ["Is speech development on track?", "When to transition from bottle to cup?", "How much milk is appropriate?", "Tantrums — what's normal vs. concerning?", "Screentime guidelines for this age?"] },
  { ageRange: [24, 48] as [number, number], title: "2–4 year visit", questions: ["Is social development on track?", "Potty training — when and how?", "Sleep — how much is enough?", "Any speech concerns to flag?", "Preschool readiness signs?"] },
  { ageRange: [48, 72] as [number, number], title: "4–6 year visit", questions: ["School readiness — what to look for?", "How to talk about body safety?", "ADHD screening — what are signs?", "Vision and hearing checks?", "How much physical activity is recommended?"] },
  { ageRange: [72, 999] as [number, number], title: "School age visit", questions: ["BMI and growth — are we on track?", "Screen time and social media guidance?", "Mental health check-in — signs to watch?", "Sports physicals — what's needed?", "When to talk about puberty?"] },
];

function getAgeMonths(dob: string): number {
  const birth = new Date(dob + "T00:00:00");
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  return Math.max(0, months);
}

function SafetyGuidesPage() {
  const [loading, setLoading] = useState(true);
  const [childDob, setChildDob] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"milestones" | "visit-prep">("milestones");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [checkedQuestions, setCheckedQuestions] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function init() {
      const { data: childData } = await supabase
        .from("children")
        .select("id, date_of_birth")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      if (childData) {
        setChildDob(childData.date_of_birth);
        setChildId(childData.id);
        try {
          const stored = localStorage.getItem(`safesound.visitPrep.${childData.id}`);
          if (stored) setCheckedQuestions(new Set(JSON.parse(stored)));
        } catch {}
      }
      setLoading(false);
    }
    init();
  }, []);

  const ageMonths = useMemo(() => {
    if (!childDob) return null;
    return getAgeMonths(childDob);
  }, [childDob]);

  function toggleQuestion(key: string) {
    setCheckedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        if (childId) localStorage.setItem(`safesound.visitPrep.${childId}`, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  const relevantVisit = useMemo(() => {
    if (ageMonths === null) return null;
    return VISIT_PREP.find(({ ageRange }) => ageMonths >= ageRange[0] && ageMonths < ageRange[1]) ?? null;
  }, [ageMonths]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!childDob) {
    return (
      <div className="flex min-h-screen flex-col bg-background pb-28">
        <div className="mx-auto max-w-md px-5 pt-10">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-7 w-7 text-accent" />
            <h1 className="font-display text-3xl font-semibold tracking-tight">Safety Guides</h1>
          </div>
          <p className="font-body text-sm text-muted-foreground">
            Add your child's birthday in Profile to see age-appropriate safety milestones.
          </p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-5 pt-10 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7 text-accent" />
            <h1 className="font-display text-3xl font-semibold tracking-tight">Safety Guides</h1>
          </div>
          {ageMonths !== null && (
            <p className="mt-2 font-body text-sm text-muted-foreground">
              Your baby is <span className="font-semibold text-foreground">{ageMonths} months old</span>
            </p>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="px-5 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="flex rounded-2xl bg-muted p-1">
            <button
              onClick={() => setActiveTab("milestones")}
              className={`flex-1 rounded-xl py-2 font-body text-sm font-semibold transition-all ${
                activeTab === "milestones"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Milestones
            </button>
            <button
              onClick={() => setActiveTab("visit-prep")}
              className={`flex-1 rounded-xl py-2 font-body text-sm font-semibold transition-all ${
                activeTab === "visit-prep"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Visit Prep
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 px-5 pt-4 sm:px-6">
        <div className="mx-auto max-w-md space-y-3">
          {activeTab === "milestones" && ageMonths !== null && (
            <MilestonesTab ageMonths={ageMonths} expandedIdx={expandedIdx} setExpandedIdx={setExpandedIdx} />
          )}
          {activeTab === "visit-prep" && (
            <VisitPrepTab
              relevantVisit={relevantVisit}
              checkedQuestions={checkedQuestions}
              toggleQuestion={toggleQuestion}
            />
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function MilestonesTab({
  ageMonths,
  expandedIdx,
  setExpandedIdx,
}: {
  ageMonths: number;
  expandedIdx: number | null;
  setExpandedIdx: (idx: number | null) => void;
}) {
  // Determine status for each milestone
  // "done" = current or past age; "upcoming" = next 2 after current; "future" = rest
  const currentIdx = [...SAFETY_MILESTONES]
    .reverse()
    .findIndex((m) => m.ageMonths <= ageMonths);
  const currentMilestoneIdx =
    currentIdx === -1 ? -1 : SAFETY_MILESTONES.length - 1 - currentIdx;

  return (
    <>
      {SAFETY_MILESTONES.map((m, idx) => {
        const isDone = idx <= currentMilestoneIdx;
        const isUpcoming = idx === currentMilestoneIdx + 1 || idx === currentMilestoneIdx + 2;
        const isFuture = !isDone && !isUpcoming;
        const isExpanded = expandedIdx === idx;

        return (
          <button
            key={m.ageMonths}
            onClick={() => setExpandedIdx(isExpanded ? null : idx)}
            className={`w-full rounded-2xl border p-4 text-left transition-all ${
              isDone
                ? "border-primary/30 bg-card"
                : isUpcoming
                  ? "border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20"
                  : "border-border/40 bg-muted/30 opacity-50"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    isDone
                      ? "bg-primary/15 text-primary"
                      : isUpcoming
                        ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold tracking-tight truncate">
                    {m.title}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">
                    {m.ageMonths === 0 ? "Birth" : `${m.ageMonths} months`}
                    {isUpcoming && (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        Coming up
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </div>
            {isExpanded && (
              <ul className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
                {m.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 font-body text-sm text-foreground/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </button>
        );
      })}
    </>
  );
}

function VisitPrepTab({
  relevantVisit,
  checkedQuestions,
  toggleQuestion,
}: {
  relevantVisit: { title: string; questions: string[] } | null;
  checkedQuestions: Set<string>;
  toggleQuestion: (key: string) => void;
}) {
  if (!relevantVisit) {
    return (
      <p className="font-body text-sm text-muted-foreground">
        No visit prep available for this age range.
      </p>
    );
  }

  const checked = relevantVisit.questions.filter((q) =>
    checkedQuestions.has(`${relevantVisit.title}::${q}`)
  ).length;

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Stethoscope className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">{relevantVisit.title}</h2>
          <p className="font-body text-xs text-muted-foreground">
            {checked}/{relevantVisit.questions.length} questions ready
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {relevantVisit.questions.map((q) => {
          const key = `${relevantVisit.title}::${q}`;
          const done = checkedQuestions.has(key);
          return (
            <li key={q}>
              <button
                onClick={() => toggleQuestion(key)}
                className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 bg-background"
                  }`}
                >
                  {done && <CheckCircle2 className="h-3.5 w-3.5" />}
                </span>
                <span
                  className={`font-body text-sm leading-relaxed ${
                    done ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {q}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
