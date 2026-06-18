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
  { ageMonths: 0, stage: "Before baby arrives", title: "Safe sleep setup", items: ["Back to sleep every time", "Firm flat surface only", "No loose bedding, bumpers, or toys", "Room-share without bed-sharing for first 6 months", "Avoid overheating — one more layer than you'd wear"] },
  { ageMonths: 2, stage: "Newborn", title: "Tummy time safety", items: ["Always supervised during tummy time", "On a firm surface only", "Stop if baby falls asleep — move to back"] },
  { ageMonths: 4, stage: "Newborn", title: "Starting to move", items: ["Lower crib mattress before they can push up", "Remove mobiles and toys within reach", "Never leave unattended on elevated surfaces"] },
  { ageMonths: 6, stage: "Starting to move", title: "First foods safety", items: ["No honey until after first birthday", "Avoid choking hazards — whole grapes, nuts, raw hard veggies", "Introduce one new food at a time and watch for reactions", "No cow's milk as a main drink yet"] },
  { ageMonths: 9, stage: "On the go", title: "Crawling & exploring", items: ["Install baby gates at top and bottom of stairs", "Cover electrical outlets", "Lock lower cabinets with cleaning products", "Pad sharp furniture corners", "Scan the floor daily for small objects"] },
  { ageMonths: 12, stage: "On the go", title: "Pulling up & walking", items: ["Anchor all tall furniture and TVs to walls", "Move cleaning products to high shelves", "Install toilet locks", "Check window guards and stops", "Remove large stuffed animals from crib"] },
  { ageMonths: 18, stage: "Exploring everything", title: "Toddler proofing", items: ["Keep stair gates up — they still fall", "Hot drinks are a real burn risk now — keep far out of reach", "Parking lot hand-holding starts now", "Discourage climbing on furniture"] },
  { ageMonths: 24, stage: "Exploring everything", title: "Car seat transition", items: ["Keep rear-facing as long as possible — check your seat's weight limit", "Only move forward-facing when they've outgrown the rear-facing limits", "Harness straps must be at or above shoulders", "No puffy coats in the car seat — use a blanket over the harness instead"] },
  { ageMonths: 36, stage: "Big kid basics", title: "Preschool safety", items: ["Teach body safety and the difference between safe and unsafe touch", "Practice their full name, your phone number, and how to call 911", "Helmet for every ride — bikes, scooters, balance bikes", "Floaties and water wings are NOT life jackets", "Stranger safety basics in age-appropriate language"] },
  { ageMonths: 48, stage: "Big kid basics", title: "Outdoor & bike safety", items: ["Properly fitted helmet — replace after any impact", "Teach road rules — stop at every driveway", "Sunscreen SPF 30+ when outdoors", "Know your child's friends and where they live"] },
  { ageMonths: 60, stage: "Big kid basics", title: "School age safety", items: ["Walk or bus route safety — practice it together", "Backpack should be under 10–15% of body weight", "Screen time and basic internet safety", "What to do if lost or approached by a stranger", "Life jacket for all open water activities"] },
  { ageMonths: 84, stage: "Big kid basics", title: "Booster seat transition", items: ["Move from harness to booster only when they've outgrown the harness limits", "Stay in a booster until the seat belt fits correctly across chest and hips (usually around 4'9\")", "Back seat until 13 years old", "Teach cycling lane rules and pedestrian safety"] },
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
          <p className="mt-2 font-body text-sm text-muted-foreground">
            Guides organized by developmental stage — every child grows at their own pace.
          </p>
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
                    {m.stage}
                    {isUpcoming && (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        Up next
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
