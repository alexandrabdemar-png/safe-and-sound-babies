import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, Shield } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WelcomeIntroModal } from "@/components/WelcomeIntroModal";
import { cn } from "@/lib/utils";
import { computeAdjustedAge } from "@/lib/adjustedAge";
import { friendlyError, isColumnUnavailableError } from "@/lib/errors";
import { SketchDefs, MOMENT_ICON_ACCENT } from "@/lib/momentIcons";
import { CATEGORY_SKETCH_ICONS } from "@/lib/categorySketchIcons";
import type { CategoryKey } from "@/lib/productCategories";
import {
  PROFILE_TYPES,
  usesAgeRangeFlow,
  validateAgeRange,
  formatAgeRange,
  MAX_CARE_AGE_MONTHS,
  type ProfileType,
} from "@/lib/profileType";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
  head: () => ({
    meta: [
      { title: "Welcome — Peace of Mine" },
      {
        name: "description",
        content:
          "Set up your little one's profile so Peace of Mine can send the right reminders at the right time.",
      },
      { property: "og:title", content: "Welcome — Peace of Mine" },
      {
        property: "og:description",
        content:
          "Set up your baby's Peace of Mine profile to get personalized safety reminders and recall alerts.",
      },
      { property: "og:url", content: "https://peace-of-mine.lovable.app/onboarding" },
    ],
  }),
});

const CATEGORIES: { key: CategoryKey; name: string }[] = [
  { key: "car_seat",        name: "Car seats" },
  { key: "crib",            name: "Cribs" },
  { key: "bassinet",        name: "Bassinets" },
  { key: "stroller",        name: "Strollers" },
  { key: "high_chair",      name: "High chairs" },
  { key: "bouncer",         name: "Bouncers" },
  { key: "activity_center", name: "Activity centers" },
  { key: "sleep_sack",      name: "Sleep sacks" },
  { key: "baby_gate",       name: "Baby gates" },
];

// Age-appropriate safety first-look content
type SafetyAction = { icon: string; title: string; body: string };

function getSafetyFirstLook(dobStr: string | null, dueDateStr: string | null = null): SafetyAction[] {
  // Use adjusted age for preemies (per AAP guidance until 24 months chrono).
  const age = computeAdjustedAge({ dateOfBirth: dobStr, dueDate: dueDateStr });
  const ageMonths = age?.adjustedMonths ?? 0;

  if (ageMonths < 3) return [
    { icon: "🛏️", title: "Always back to sleep", body: "Place your baby on their back for every nap and every night — even when they look comfortable on their side." },
    { icon: "🚫", title: "Empty the crib", body: "Firm, flat mattress + fitted sheet only. No pillows, bumpers, stuffed animals, or loose blankets in the sleep space." },
    { icon: "🌡️", title: "Room temperature matters", body: "Keep the room between 68–72°F and dress baby in one more layer than you'd wear to prevent overheating." },
  ];
  if (ageMonths < 7) return [
    { icon: "⏰", title: "Time for tummy time", body: "Short supervised sessions on a firm surface several times a day — this builds strength for rolling and crawling." },
    { icon: "📐", title: "Lower the crib mattress", body: "Do this before they can push up on hands and knees. Lowering it now prevents a dangerous fall later." },
    { icon: "🛏️", title: "Still back to sleep", body: "The safe sleep rules don't change until 12 months. Back to sleep, every single time." },
  ];
  if (ageMonths < 13) return [
    { icon: "🚪", title: "Gate every staircase", body: "Install hardware-mounted gates at the top of stairs before your baby starts crawling — it happens fast." },
    { icon: "🔌", title: "Cover all outlets", body: "Sliding outlet covers are safer than plug-in caps. Do a floor-level sweep of every room." },
    { icon: "🪑", title: "Anchor tall furniture", body: "Bookshelves, dressers, and TVs tip easily. Use anti-tip straps on everything your baby might grab." },
  ];
  if (ageMonths < 24) return [
    { icon: "🪑", title: "Anchor tall furniture now", body: "Walking toddlers grab everything. Secure bookshelves, dressers, and TVs to wall studs today." },
    { icon: "🔒", title: "Lock cleaning products away", body: "Move laundry pods, cleaning sprays, and medicines to high shelves or locked cabinets immediately." },
    { icon: "🚿", title: "Toilet lid lock", body: "A toddler can drown in just a few inches of water. Install toilet lid locks on every bathroom." },
  ];
  return [
    { icon: "🚲", title: "Helmet, every ride", body: "Put a properly fitted helmet on your child for every bike, scooter, or balance bike ride — no exceptions." },
    { icon: "🚗", title: "Rear-facing as long as possible", body: "Keep your child rear-facing until they reach the height or weight limit on the seat — not by age." },
    { icon: "🏊", title: "Life jacket, not floaties", body: "Floaties are toys, not safety devices. Use a properly fitted life jacket for all open-water activities." },
  ];
}

const STORAGE_KEY = "safesound.onboarding.v1";

function saveProgress(data: object) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function loadProgress(): {
  step?: number;
  name?: string;
  dob?: string;
  dueDate?: string;
  selected?: string[];
  profileType?: string;
  careAgeMin?: string;
  careAgeMax?: string;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function clearProgress() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

const TOTAL_STEPS = 3;

function OnboardingPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const saved = loadProgress();
  const [step, setStep] = useState(saved.step ?? 0);
  const [profileType, setProfileType] = useState<ProfileType>((saved.profileType as ProfileType) ?? "parent");
  const [name, setName] = useState(saved.name ?? "");
  const [dob, setDob] = useState(saved.dob ?? "");
  const [dueDate, setDueDate] = useState(saved.dueDate ?? "");
  const [careAgeMin, setCareAgeMin] = useState(saved.careAgeMin ?? "");
  const [careAgeMax, setCareAgeMax] = useState(saved.careAgeMax ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(saved.selected ?? ["car_seat", "crib", "stroller"]),
  );
  const [saving, setSaving] = useState(false);
  const [safetyFirstLook, setSafetyFirstLook] = useState<SafetyAction[] | null>(null);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      setUserId(data.session.user.id);
      setChecking(false);

      supabase
        .from("profiles")
        .select("intro_seen_at")
        .eq("user_id", data.session.user.id)
        .maybeSingle()
        .then(({ data: profile, error }) => {
          // Missing column (migration not live yet) or missing row: don't
          // block the welcome modal on either — just don't show it, rather
          // than surfacing an error for something purely informational.
          if (error) return;
          if (!(profile as { intro_seen_at?: string | null } | null)?.intro_seen_at) setShowIntro(true);
        });
    });
  }, [navigate]);

  function dismissIntro() {
    setShowIntro(false);
    if (!userId) return;
    supabase
      .from("profiles")
      .update({ intro_seen_at: new Date().toISOString() } as never)
      .eq("user_id", userId)
      .then(({ error }) => {
        if (error) console.error("[onboarding] couldn't record intro_seen_at:", error.message);
      });
  }

  // Persist progress whenever state changes
  useEffect(() => {
    if (!checking) {
      saveProgress({ step, name, dob, dueDate, selected: [...selected], profileType, careAgeMin, careAgeMax });
    }
  }, [step, name, dob, dueDate, selected, profileType, careAgeMin, careAgeMax, checking]);

  const progress = ((step + 1) / TOTAL_STEPS) * 100;
  const isAgeRangeFlow = usesAgeRangeFlow(profileType);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function canAdvance() {
    if (step === 0) return true; // profile type always has a default selection
    if (step === 1) {
      if (usesAgeRangeFlow(profileType)) {
        const min = careAgeMin === "" ? null : Number(careAgeMin);
        const max = careAgeMax === "" ? null : Number(careAgeMax);
        return validateAgeRange(min, max).valid;
      }
      return name.trim().length > 0;
    }
    return true; // categories step always advanceable
  }

  function advanceOrSkip(skip = false) {
    if (step === 0 && skip) {
      // Skip everything entirely. /home requires at least one child and
      // immediately bounces back to /onboarding if there isn't one — which
      // defeats "Set up later" and looks like the page just reset. /profile
      // is the one authenticated screen that renders fine with zero
      // children, so that's where a fully-skipped user actually lands;
      // they can add a child from there whenever they're ready.
      clearProgress();
      navigate({ to: "/profile" });
      return;
    }
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      handleFinish(skip);
    }
  }

  async function handleFinish(skipCategories = false) {
    if (!userId) return;
    setSaving(true);
    try {
      const isAgeRange = usesAgeRangeFlow(profileType);

      // Persist profile type + (for age-range roles) the care age range onto
      // the user's own profile row, already created by the handle_new_user
      // trigger at signup. Non-blocking: this is metadata, not something
      // that should ever stop a new user from finishing onboarding.
      const minMonths = careAgeMin === "" ? null : Number(careAgeMin);
      const maxMonths = careAgeMax === "" ? null : Number(careAgeMax);
      const { error: profileTypeError } = await supabase
        .from("profiles")
        .update({
          profile_type: profileType,
          care_age_min_months: isAgeRange ? minMonths : null,
          care_age_max_months: isAgeRange ? maxMonths : null,
        } as never)
        .eq("user_id", userId);
      if (profileTypeError) {
        console.error("[onboarding] couldn't save profile type / care age range:", profileTypeError.message);
      }

      const childName = isAgeRange ? "" : name.trim();

      if (childName) {
        let { data: childRow, error: childError } = await supabase
          .from("children")
          .insert({
            user_id: userId,
            name: childName,
            date_of_birth: dob || null,
            due_date: dueDate || null,
          } as never)
          .select("id")
          .single();

        // due_date is a recent addition — if a migration hasn't reached
        // this database yet, retry without it rather than blocking the
        // user's entire onboarding on a field that's optional anyway
        // ("enables adjusted-age reminders for preemies"). Same resilient
        // pattern as fetchMilestonesResilient's icon-column retry.
        if (childError && isColumnUnavailableError("due_date", childError)) {
          console.error("children.due_date unavailable — retrying without it", childError);
          const retry = await supabase
            .from("children")
            .insert({
              user_id: userId,
              name: childName,
              date_of_birth: dob || null,
            } as never)
            .select("id")
            .single();
          childRow = retry.data;
          childError = retry.error;
        }

        if (childError) throw childError;

        if (!skipCategories && selected.size > 0 && childRow) {
          // Category interest is tracked separately from real gear — it
          // must never create a row in `products`, since that table is
          // rendered as "your baby gear" and a placeholder row (no brand,
          // size, or barcode) is indistinguishable from something the
          // user actually added.
          const rows = [...selected].map((cat) => ({
            user_id: userId,
            child_id: (childRow as { id: string }).id,
            category: cat,
          }));
          // Non-fatal: category-interest tracking is a nice-to-have, not
          // something that should ever block a new user from finishing
          // onboarding and reaching their dashboard.
          const { error: watchlistError } = await supabase
            .from("category_watchlist")
            .insert(rows as never);
          if (watchlistError) console.error("category_watchlist insert failed:", watchlistError);
        }
      } else if (isAgeRange && !skipCategories && selected.size > 0) {
        // Age-range profile types (Pediatrician/Daycare/Babysitter-Nanny/
        // Caregiver) don't have one single child to attach category
        // interest to — child_id is nullable for exactly this case and RLS
        // scopes it to the user regardless.
        const rows = [...selected].map((cat) => ({
          user_id: userId,
          child_id: null,
          category: cat,
        }));
        const { error: watchlistError } = await supabase
          .from("category_watchlist")
          .insert(rows as never);
        if (watchlistError) console.error("category_watchlist insert failed:", watchlistError);
      }

      clearProgress();

      if (!childName) {
        // No child was created this run — either an age-range profile type
        // (never creates one) or a Parent/Parent-to-be who skipped past the
        // name step (Skip isn't gated by canAdvance(), so this is reachable
        // even though "Continue" requires a name). The "safety first look"
        // screen assumes one specific child's age, and /home requires at
        // least one child and bounces straight back to /onboarding when
        // there are none — so land on /profile instead, the one
        // authenticated screen that renders fine with zero children (same
        // reasoning as the "Set up later" skip path above).
        toast.success("You're all set!");
        navigate({ to: "/profile" });
        return;
      }

      const actions = getSafetyFirstLook(dob || null, dueDate || null);
      setSafetyFirstLook(actions);
    } catch (err) {
      // Supabase/PostgREST errors are plain objects, not Error instances,
      // so `err instanceof Error` was always false for them here — every
      // real failure (a missing column, a constraint violation, anything)
      // silently collapsed to the same unhelpful "Something went wrong"
      // with no diagnostic detail, for the user or in the console.
      console.error("Onboarding handleFinish failed:", err);
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Post-onboarding: safety first look
  if (safetyFirstLook) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="w-full px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-primary">Safety first look</span>
          </div>
        </header>
        <main className="flex flex-1 flex-col justify-center px-4 pb-16 pt-2 sm:px-6">
          <div className="mx-auto w-full max-w-lg">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {name.trim() ? `Here's what matters most for ${name.trim()} right now.` : "Here's what matters most right now."}
            </h1>
            <p className="mt-2 font-body text-sm text-muted-foreground">
              General safety guidance based on AAP recommendations for your child's age — not a
              substitute for advice from your pediatrician.
            </p>
            <ul className="mt-6 space-y-3">
              {safetyFirstLook.map((action) => (
                <li key={action.title} className="flex gap-4 rounded-2xl border border-border/60 bg-card p-4">
                  <span className="text-2xl leading-none">{action.icon}</span>
                  <div>
                    <p className="font-display text-sm font-semibold">{action.title}</p>
                    <p className="mt-0.5 font-body text-sm text-muted-foreground">{action.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-center font-body text-[11px] text-muted-foreground">
              Based on AAP recommendations — always confirm anything specific to your child with
              your pediatrician.
            </p>
            <Button
              className="mt-6 h-12 w-full rounded-full bg-primary font-body text-sm font-semibold"
              onClick={() => navigate({ to: "/home" })}
            >
              Go to my dashboard <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <WelcomeIntroModal open={showIntro} onDismiss={dismissIntro} />
      <header className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/" className="flex items-center">
            <Logo />
          </Link>
          <span className="font-body text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Step {step + 1} of {TOTAL_STEPS}
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="w-full max-w-2xl">
          <Progress value={progress} className="mb-10 h-1.5" />

          {step === 0 && (
            <StepShell
              eyebrow={`Step 1 of ${TOTAL_STEPS} — Your role`}
              title="What best describes you?"
              subtitle="This helps us tailor onboarding — professionals looking after multiple children get an age range instead of a single child profile."
            >
              <div className="space-y-2">
                <Label htmlFor="profile-type" className="font-body text-sm">I am a…</Label>
                <Select value={profileType} onValueChange={(v) => setProfileType(v as ProfileType)}>
                  <SelectTrigger id="profile-type" className="h-14 rounded-2xl bg-card px-5 font-body text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFILE_TYPES.map((pt) => (
                      <SelectItem key={pt.value} value={pt.value}>
                        {pt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </StepShell>
          )}

          {step === 1 && !isAgeRangeFlow && (
            <StepShell
              eyebrow={`Step 2 of ${TOTAL_STEPS} — Your little one`}
              title="Tell us about your baby"
              subtitle="Just a name and birthday — we'll use these to time safety reminders to the right week."
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="child-name" className="font-body text-sm">Baby's name</Label>
                  <Input
                    id="child-name"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Peyton"
                    maxLength={60}
                    className="h-14 rounded-2xl bg-card px-5 font-body text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob" className="font-body text-sm">
                    Date of birth <span className="text-muted-foreground">(optional — add later in Profile)</span>
                  </Label>
                  <Input
                    id="dob"
                    type="date"
                    value={dob}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDob(e.target.value)}
                    className="h-14 rounded-2xl bg-card px-5 font-body text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due-date" className="font-body text-sm">
                    Original due date{" "}
                    <span className="text-muted-foreground">(optional — enables adjusted-age reminders for preemies)</span>
                  </Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-14 rounded-2xl bg-card px-5 font-body text-base"
                  />
                  <p className="font-body text-[11px] text-muted-foreground">
                    If your baby was born earlier than expected, we'll time developmental and
                    safety reminders to their adjusted (corrected) age, as recommended by AAP
                    guidance until 24 months.
                  </p>
                </div>
              </div>
            </StepShell>
          )}

          {step === 1 && isAgeRangeFlow && (
            <StepShell
              eyebrow={`Step 2 of ${TOTAL_STEPS} — Who you care for`}
              title="What age range are you caring for?"
              subtitle="A rough range is fine — we'll use it to tailor general safety guidance rather than tracking one specific child."
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="care-age-min" className="font-body text-sm">Youngest (months)</Label>
                  <Input
                    id="care-age-min"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_CARE_AGE_MONTHS}
                    value={careAgeMin}
                    onChange={(e) => setCareAgeMin(e.target.value)}
                    placeholder="e.g. 0"
                    className="h-14 rounded-2xl bg-card px-5 font-body text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="care-age-max" className="font-body text-sm">Oldest (months)</Label>
                  <Input
                    id="care-age-max"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_CARE_AGE_MONTHS}
                    value={careAgeMax}
                    onChange={(e) => setCareAgeMax(e.target.value)}
                    placeholder="e.g. 24"
                    className="h-14 rounded-2xl bg-card px-5 font-body text-base"
                  />
                </div>
              </div>
              {careAgeMin !== "" && careAgeMax !== "" && (() => {
                const min = Number(careAgeMin);
                const max = Number(careAgeMax);
                const result = validateAgeRange(min, max);
                return result.valid ? (
                  <p className="font-body text-sm text-muted-foreground">
                    {formatAgeRange(min, max)}
                  </p>
                ) : (
                  <p className="font-body text-sm text-destructive">{result.error}</p>
                );
              })()}
            </StepShell>
          )}

          {step === 2 && (
            <StepShell
              eyebrow={`Step 3 of ${TOTAL_STEPS} — Your gear`}
              title="What are you tracking?"
              subtitle="Pick the categories that apply — we'll watch for recalls and replacements. You can change this anytime."
            >
              <SketchDefs />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {CATEGORIES.map((cat) => {
                  const SketchIcon = CATEGORY_SKETCH_ICONS[cat.key];
                  const active = selected.has(cat.key);
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => toggle(cat.key)}
                      className={cn(
                        "group relative flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center transition-all",
                        active
                          ? "border-primary/60 shadow-sm shadow-primary/10 ring-2 ring-primary/30"
                          : "border-border/60 hover:border-primary/30 hover:bg-card/80",
                      )}
                    >
                      {active && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <span
                        className="flex h-12 w-12 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${MOMENT_ICON_ACCENT}22` }}
                      >
                        {SketchIcon && <SketchIcon px={28} />}
                      </span>
                      <span className="font-body text-xs font-medium text-foreground">
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </StepShell>
          )}

          <p className="mt-8 text-center font-body text-[11px] text-muted-foreground">
            Safety guidelines based on AAP recommendations.
          </p>

          <div className="mt-4 flex items-center justify-between">
            {step > 0 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((s) => s - 1)}
                disabled={saving}
                className="rounded-full font-body"
              >
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {/* Skip button — every step */}
              <Button
                type="button"
                variant="ghost"
                onClick={() => advanceOrSkip(true)}
                disabled={saving}
                className="rounded-full font-body text-muted-foreground"
              >
                {step === 0 ? "Set up later" : "Skip"}
              </Button>

              {step < TOTAL_STEPS - 1 ? (
                <Button
                  type="button"
                  onClick={() => advanceOrSkip(false)}
                  disabled={!canAdvance()}
                  className="rounded-full bg-primary px-7 py-6 font-body text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Continue <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => advanceOrSkip(false)}
                  disabled={saving}
                  className="rounded-full bg-primary px-7 py-6 font-body text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  {saving ? (
                    <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Setting up</>
                  ) : (
                    <>Finish setup <Check className="ml-1 h-4 w-4" /></>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StepShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 font-body text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
