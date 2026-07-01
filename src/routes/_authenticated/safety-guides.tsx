import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { CheckCircle2, ChevronDown, ChevronUp, Clock, Download, Share2, Shield, ShieldCheck, Star, Stethoscope, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/safety-guides")({
  ssr: false,
  component: SafetyGuidesPage,
  head: () => ({ meta: [{ title: "Safety Guides — Peace of Mine" }] }),
});

const SAFETY_MILESTONES = [
  { ageMonths: 0, stage: "Before baby arrives", title: "Safe sleep setup", source: "AAP", lastUpdated: "May 2025", items: [
    "Place your baby on their back for every single sleep — naps and nighttime.",
    "Use only a firm, flat crib mattress with a fitted sheet and nothing else in the sleep space.",
    "Remove all loose bedding, bumpers, pillows, and stuffed animals from the crib.",
    "Room-share with your baby in a separate sleep surface for at least the first 6 months.",
    "Dress baby in one more layer than you would wear and keep the room between 68–72°F.",
  ]},
  { ageMonths: 2, stage: "Newborn", title: "Tummy time safety", source: "AAP", lastUpdated: "May 2025", items: [
    "Do supervised tummy time on a firm surface for short sessions several times each day.",
    "Stay within arm's reach whenever your baby is on their tummy.",
    "If your baby falls asleep during tummy time, immediately move them to their back in the crib.",
  ]},
  { ageMonths: 4, stage: "Newborn", title: "Starting to move", source: "AAP", lastUpdated: "May 2025", items: [
    "Lower the crib mattress to the lowest setting before your baby can push up on hands and knees.",
    "Remove hanging mobiles and any toys clipped to the crib rail before baby can grab them.",
    "Never leave your baby unattended on a changing table, sofa, or any elevated surface — even for a second.",
  ]},
  { ageMonths: 6, stage: "Starting to move", title: "First foods safety", source: "AAP", lastUpdated: "May 2025", items: [
    "Do not give honey in any form until after your baby's first birthday — it can cause infant botulism.",
    "Cut grapes, cherry tomatoes, and hot dogs lengthwise into quarters to eliminate choking hazards.",
    "Introduce one new food at a time and wait 3–5 days before adding another to identify any allergic reactions.",
    "Do not give cow's milk as a main drink until 12 months — breast milk or formula should remain the primary liquid.",
  ]},
  { ageMonths: 9, stage: "On the go", title: "Crawling & exploring", source: "AAP · CPSC", lastUpdated: "May 2025", items: [
    "Install a hardware-mounted (not pressure-mounted) baby gate at the top and bottom of every staircase.",
    "Cover all electrical outlets with sliding safety covers or outlet plates throughout your home.",
    "Install cabinet locks on every lower cabinet that contains cleaning products, medications, or sharp items.",
    "Apply corner and edge guards to sharp coffee table corners and other low furniture edges.",
    "Do a floor-level scan of each room daily to pick up small objects, batteries, and coins that could be swallowed.",
  ]},
  { ageMonths: 12, stage: "On the go", title: "Pulling up & walking", source: "AAP · CPSC", lastUpdated: "May 2025", items: [
    "Anchor every bookshelf, dresser, and TV stand to wall studs using anti-tip straps.",
    "Move all cleaning products, laundry pods, and medications to high shelves or locked cabinets.",
    "Install a toilet lid lock on every toilet your toddler can access.",
    "Install window stops or guards on all windows above the first floor so they open no more than 4 inches.",
    "Remove large stuffed animals and crib bumpers from the crib — they are now a climbing hazard.",
  ]},
  { ageMonths: 18, stage: "Exploring everything", title: "Toddler proofing", source: "AAP", lastUpdated: "May 2025", items: [
    "Keep stair gates in place — toddlers who can climb stairs can still fall down them.",
    "Keep all hot drinks at least 3 feet away from the table edge and never hold a hot drink while holding your toddler.",
    "Hold your toddler's hand in every parking lot — make this a non-negotiable rule from day one.",
    "Actively discourage climbing on furniture and redirect to safe climbing alternatives like foam play sets.",
  ]},
  { ageMonths: 24, stage: "Exploring everything", title: "Car seat transition", source: "AAP · NHTSA", lastUpdated: "May 2025", items: [
    "Keep your child rear-facing until they reach the maximum height or weight limit printed on their car seat.",
    "Only move your child to a forward-facing seat after they have outgrown the rear-facing limits — not by age.",
    "Position harness straps at or just above your child's shoulders when forward-facing.",
    "Remove puffy coats before buckling the car seat harness and place a blanket over the buckled harness instead.",
  ]},
  { ageMonths: 36, stage: "Big kid basics", title: "Preschool safety", source: "AAP", lastUpdated: "May 2025", items: [
    "Teach your child the difference between safe and unsafe touch, using correct anatomical names for body parts.",
    "Practice your child saying their full name, your phone number, and how to dial 911 until they can do it confidently.",
    "Put a properly fitted helmet on your child for every bike, scooter, or balance bike ride — no exceptions.",
    "Clearly explain that floaties and water wings are toys, not life jackets, and must never be used as flotation devices.",
    "Teach age-appropriate stranger safety rules, including how to identify a safe adult to ask for help.",
  ]},
  { ageMonths: 48, stage: "Big kid basics", title: "Outdoor & bike safety", source: "AAP · CPSC", lastUpdated: "May 2025", items: [
    "Replace your child's bike helmet after any impact, even if it looks undamaged — the foam may be compromised.",
    "Walk your child's bike route with them and practice stopping and looking at every driveway and intersection.",
    "Apply SPF 30 or higher broad-spectrum sunscreen to all exposed skin whenever your child is outdoors.",
    "Know the names and addresses of your child's closest friends and their parents' phone numbers.",
  ]},
  { ageMonths: 60, stage: "Big kid basics", title: "School age safety", source: "AAP", lastUpdated: "May 2025", items: [
    "Walk or ride the bus route with your child before the first day of school so they know exactly where to go.",
    "Keep your child's backpack weight under 10–15% of their body weight to protect their back and posture.",
    "Set clear screen time rules and review the content your child is watching or playing regularly.",
    "Role-play what to do if they get lost or are approached by a stranger, including running to a store or trusted adult.",
    "Ensure your child wears a properly fitted life jacket for all open water activities, every time without exception.",
  ]},
  { ageMonths: 84, stage: "Big kid basics", title: "Booster seat transition", source: "AAP · NHTSA", lastUpdated: "May 2025", items: [
    "Keep your child in a harnessed car seat until they have outgrown its height or weight limit — not by age.",
    "Transition to a booster only when the vehicle seat belt sits flat across the chest and low on the hips, typically around 4'9\" tall.",
    "Keep your child in the back seat until they are 13 years old — airbags pose a serious risk to younger children.",
    "Teach your child to make eye contact with drivers before crossing in front of any vehicle, including in parking lots.",
  ]},
];

const VISIT_PREP = [
  { ageRange: [0, 2] as [number, number], title: "1–2 month visit", questions: [
    "I'd like to confirm that my baby's weight gain and growth curve look healthy for their age.",
    "I want to make sure I'm doing tummy time correctly and know how much is enough each day.",
    "I want to understand what sleep patterns are normal for a newborn and what would be a concern.",
    "I want to make sure we're up to date on all recommended vaccines for this visit.",
    "I'd like to talk through what symptoms of postpartum depression look like and when to get help.",
  ]},
  { ageRange: [2, 6] as [number, number], title: "2–6 month visit", questions: [
    "I want to confirm that my baby's physical and developmental milestones look on track for their age.",
    "I'd like to know the right time to start solid foods and how to do it safely.",
    "I want to understand the signs that tell me whether my baby is eating enough.",
    "I'd like guidance on which sleep training approaches are safe and appropriate at this age.",
    "My baby has started teething and I want to confirm what symptoms are normal versus what should concern me.",
  ]},
  { ageRange: [6, 12] as [number, number], title: "6–12 month visit", questions: [
    "I'd like guidance on which foods to introduce first and which ones to avoid in the first year.",
    "My baby is showing signs of separation anxiety and I want to know how to handle it in a healthy way.",
    "I want to know when I should expect to hear my baby's first words and what would be a red flag.",
    "I want to confirm that my baby's crawling development is on track and ask about any delays.",
    "I'd like to know if my baby needs fluoride drops and when to schedule their first dental visit.",
  ]},
  { ageRange: [12, 24] as [number, number], title: "12–24 month visit", questions: [
    "I'd like to confirm that my toddler's speech development is on track and ask about any concerns I've noticed.",
    "I want guidance on the right time and method to transition from a bottle to a sippy cup.",
    "I'd like to know how much cow's milk is appropriate at this age and what type is best.",
    "I want to understand what tantrums are developmentally normal versus what should prompt a closer look.",
    "I'd like guidance on appropriate screen time limits and content for my child's current age.",
  ]},
  { ageRange: [24, 48] as [number, number], title: "2–4 year visit", questions: [
    "I want to confirm that my child's social and emotional development looks on track for their age.",
    "I'd like to know the best approach to potty training and whether my child is showing signs of readiness.",
    "I want to confirm how much sleep my child needs at this age and whether their current schedule is healthy.",
    "I have some speech concerns I'd like to go over and find out if a speech evaluation is warranted.",
    "I'd like to know what preschool readiness looks like and whether my child is on track.",
  ]},
  { ageRange: [48, 72] as [number, number], title: "4–6 year visit", questions: [
    "I want to talk through what school readiness looks like and whether my child is ready for kindergarten.",
    "I'd like guidance on how to talk to my child about body safety and personal boundaries in an age-appropriate way.",
    "I want to understand the early signs of ADHD and whether any of my child's behaviors warrant screening.",
    "I'd like to make sure my child's vision and hearing are checked and whether any testing is recommended.",
    "I want to know how much physical activity my child should be getting and what forms are best at this age.",
  ]},
  { ageRange: [72, 999] as [number, number], title: "School age visit", questions: [
    "I'd like to review my child's growth chart and confirm their BMI and weight trajectory look healthy.",
    "I want guidance on healthy screen time limits and how to handle social media at this age.",
    "I'd like to do a mental health check-in and learn what warning signs of anxiety or depression to watch for.",
    "I want to make sure we have everything needed for school and sports physicals this year.",
    "I'd like to know the right time and approach for talking to my child about puberty.",
  ]},
];

// ── Canvas share image generator ────────────────────────────────────────────
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, x, cy); cy += lineHeight; }
  return cy;
}

async function generateShareImage(title: string, items: string[], source: string): Promise<Blob | null> {
  try {
    const SIZE = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Background
    ctx.fillStyle = "#FAF7F2";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Top accent bar
    ctx.fillStyle = "#A3B899";
    ctx.fillRect(0, 0, SIZE, 18);

    // Border
    ctx.strokeStyle = "#E8E2DA";
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, SIZE - 80, SIZE - 80);

    // Title
    ctx.fillStyle = "#3D2B1F";
    ctx.font = "bold 56px 'Georgia', serif";
    ctx.fillText(title, 80, 148);

    // Divider
    ctx.fillStyle = "#E8E2DA";
    ctx.fillRect(80, 175, 920, 3);

    // Items
    const BULLET = "•";
    let y = 230;
    ctx.font = "38px 'Arial', sans-serif";
    ctx.fillStyle = "#4A3728";
    for (const item of items) {
      ctx.fillStyle = "#A3B899";
      ctx.fillText(BULLET, 80, y);
      ctx.fillStyle = "#4A3728";
      y = wrapText(ctx, item, 124, y, 830, 52);
      y += 16;
      if (y > 880) break;
    }

    // Bottom divider
    ctx.fillStyle = "#E8E2DA";
    ctx.fillRect(80, SIZE - 140, 920, 2);

    // Branding
    ctx.fillStyle = "#A3B899";
    ctx.font = "bold 34px 'Georgia', serif";
    ctx.fillText("Peace of Mine", 80, SIZE - 88);

    ctx.fillStyle = "#8A8078";
    ctx.font = "28px 'Arial', sans-serif";
    ctx.fillText(`Source: ${source}  ·  safeandsound.app`, 80, SIZE - 44);

    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  } catch {
    return null;
  }
}

async function shareTip(title: string, items: string[], source: string) {
  const blob = await generateShareImage(title, items, source);
  if (!blob) return;
  const file = new File([blob], "safety-tip.png", { type: "image/png" });
  if (typeof navigator !== "undefined" && "share" in navigator && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: `${title} — Peace of Mine`, text: "A safety tip from Peace of Mine" }).catch(() => {});
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "safety-tip.png"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
}

// ── Review prompt logic ──────────────────────────────────────────────────────
const REVIEW_MILESTONES_NEEDED = 3;
const REVIEW_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function shouldShowReview(): boolean {
  try {
    const last = localStorage.getItem("safesound.reviewPrompt.lastShown");
    if (last && Date.now() - parseInt(last, 10) < REVIEW_COOLDOWN_MS) return false;
    const seen = JSON.parse(localStorage.getItem("safesound.milestonesRead") ?? "[]") as number[];
    return new Set(seen).size >= REVIEW_MILESTONES_NEEDED;
  } catch { return false; }
}

function recordMilestoneRead(idx: number) {
  try {
    const seen: number[] = JSON.parse(localStorage.getItem("safesound.milestonesRead") ?? "[]");
    if (!seen.includes(idx)) { seen.push(idx); localStorage.setItem("safesound.milestonesRead", JSON.stringify(seen)); }
  } catch {}
}

function dismissReview() {
  try { localStorage.setItem("safesound.reviewPrompt.lastShown", String(Date.now())); } catch {}
}

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
  const [showReview, setShowReview] = useState(false);
  const [reviewHelpful, setReviewHelpful] = useState<boolean | null>(null);

  function handleMilestoneExpand(idx: number | null) {
    setExpandedIdx(expandedIdx === idx ? null : idx);
    recordMilestoneRead(idx);
    if (shouldShowReview()) setShowReview(true);
  }

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
            <MilestonesTab ageMonths={ageMonths} expandedIdx={expandedIdx} setExpandedIdx={handleMilestoneExpand} />
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

      {/* Review prompt overlay */}
      {showReview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-card p-6 animate-scale-in mx-4 mb-0 sm:mb-0">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Star className="h-5 w-5" />
              </div>
              <button type="button" onClick={() => { setShowReview(false); dismissReview(); }}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            {reviewHelpful === null ? (
              <>
                <p className="font-display text-lg font-semibold tracking-tight">Are you finding Peace of Mine helpful?</p>
                <p className="mt-1 font-body text-sm text-muted-foreground">We only ask this once. Your honest answer helps us improve.</p>
                <div className="mt-5 flex gap-3">
                  <Button className="flex-1 rounded-full" onClick={() => setReviewHelpful(true)}>Yes, it's great</Button>
                  <Button variant="outline" className="flex-1 rounded-full" onClick={() => { setReviewHelpful(false); dismissReview(); setTimeout(() => setShowReview(false), 2500); }}>Not really</Button>
                </div>
              </>
            ) : reviewHelpful ? (
              <>
                <p className="font-display text-lg font-semibold tracking-tight">That means the world to us 🙏</p>
                <p className="mt-1 font-body text-sm text-muted-foreground">Would you mind leaving a quick review? It takes 30 seconds and helps other parents find us.</p>
                <div className="mt-5 flex flex-col gap-2">
                  <Button className="w-full rounded-full" asChild onClick={() => { dismissReview(); setShowReview(false); }}>
                    <a href="https://apps.apple.com/app/safe-and-sound" target="_blank" rel="noopener noreferrer">
                      Review on the App Store
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full rounded-full" asChild onClick={() => { dismissReview(); setShowReview(false); }}>
                    <a href="https://play.google.com/store/apps/safe-and-sound" target="_blank" rel="noopener noreferrer">
                      Review on Google Play
                    </a>
                  </Button>
                  <button type="button" className="font-body text-xs text-muted-foreground hover:underline mt-1"
                    onClick={() => { dismissReview(); setShowReview(false); }}>
                    Maybe later
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="font-display text-lg font-semibold tracking-tight">Thanks for being honest</p>
                <p className="mt-1 font-body text-sm text-muted-foreground">We're always improving. If there's something we can do better, email us at hello@safeandsound.app.</p>
              </>
            )}
          </div>
        </div>
      )}

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
              <div className="mt-3 border-t border-border/40 pt-3">
                <ul className="space-y-1.5">
                  {m.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 font-body text-sm text-foreground/80">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-border/30 pt-2">
                  <span className="font-body text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Source: {m.source} · Updated {m.lastUpdated}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); shareTip(m.title, m.items, m.source); }}
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1 font-body text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    title="Share this safety tip"
                  >
                    <Share2 className="h-3 w-3" /> Share tip
                  </button>
                </div>
              </div>
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
