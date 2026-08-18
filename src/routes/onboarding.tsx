import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WelcomeIntroModal } from "@/components/WelcomeIntroModal";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
import { checkNeedsLegalConsent } from "@/lib/legalConsent";
import { CATEGORY_BY_KEY, type CategoryKey } from "@/lib/productCategories";
import catCarseat from "@/assets/hd-carseat.png";
import catCrib from "@/assets/hd-crib.png";
import catStroller from "@/assets/hd-stroller.png";
import catBouncer from "@/assets/hd-bouncer.png";
import catSwaddle from "@/assets/hd-swaddle.png";
import catBlocks from "@/assets/hd-blocks.png";
import {
  PROFILE_TYPES,
  usesAgeRangeFlow,
  validateAgeRange,
  formatAgeRange,
  MAX_CARE_AGE_MONTHS,
  type ProfileType,
} from "@/lib/profileType";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  // Consent-flow audit finding: /onboarding used to only check "is there a
  // session," so a brand-new user could reach the child's-name-and-DOB
  // step and have it written to the database before ever seeing the
  // Terms/Privacy consent screen — /legal-consent was only reached later,
  // the first time an _authenticated route's own beforeLoad caught them.
  // Mirrors _authenticated/route.tsx's gate exactly, so onboarding can no
  // longer be reached (and therefore can't write a child record) ahead of
  // consent. checkNeedsLegalConsent fails open (lets the user through) if
  // user_agreements itself is unreachable — same tradeoff already made
  // for every other authenticated route, not a new one introduced here.
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    if (await checkNeedsLegalConsent(supabase, session.user.id)) {
      throw redirect({ to: "/legal-consent", search: { next: "/onboarding" } });
    }
  },
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

// Matches the illustrated category art used on the marketing homepage
// (src/routes/index.tsx's "Track what matters" section) — reused here so
// this step visually matches it. Only 6 of the 9 categories above have a
// matching illustration; the rest (bassinet, high_chair, baby_gate) fall
// back to their plain lucide icon from productCategories.ts.
const CATEGORY_IMAGE: Partial<Record<CategoryKey, string>> = {
  car_seat: catCarseat,
  crib: catCrib,
  stroller: catStroller,
  bouncer: catBouncer,
  sleep_sack: catSwaddle,
  activity_center: catBlocks,
};

const STORAGE_KEY = "safesound.onboarding.v1";

function saveProgress(data: object) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function loadProgress(): {
  step?: number;
  name?: string;
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
  const [careAgeMin, setCareAgeMin] = useState(saved.careAgeMin ?? "");
  const [careAgeMax, setCareAgeMax] = useState(saved.careAgeMax ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(saved.selected ?? ["car_seat", "crib", "stroller"]),
  );
  const [saving, setSaving] = useState(false);
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
      saveProgress({ step, name, selected: [...selected], profileType, careAgeMin, careAgeMax });
    }
  }, [step, name, selected, profileType, careAgeMin, careAgeMax, checking]);

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
        const { data: childRow, error: childError } = await supabase
          .from("children")
          .insert({
            user_id: userId,
            name: childName,
          } as never)
          .select("id")
          .single();

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

      // Previously landed on a static "safety first look" screen with 3
      // fixed tips (always the same regardless of the child) before
      // reaching the dashboard — redundant with, and inconsistent with,
      // /home's own "Up next" section, which already shows a proper
      // "Personalized recommendations will start showing up here once you
      // add a product or log a milestone" empty state for a brand-new
      // child with nothing logged yet. Go straight there instead.
      toast.success("You're all set!");
      navigate({ to: "/home" });
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
              subtitle="Just a name — we'll time safety reminders to the milestones you log, not a stored birthdate."
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {CATEGORIES.map((cat) => {
                  const Icon = CATEGORY_BY_KEY[cat.key].icon;
                  const image = CATEGORY_IMAGE[cat.key];
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
                      {image ? (
                        <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#F5F1E8] p-2">
                          <img src={image} alt="" width={128} height={128} className="h-full w-full object-contain" />
                        </span>
                      ) : (
                        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-sand/50">
                          <Icon className="h-5 w-5 text-accent" />
                        </span>
                      )}
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
