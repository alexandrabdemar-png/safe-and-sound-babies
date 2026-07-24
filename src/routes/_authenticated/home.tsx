import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Gift,
  Loader2,
  Package,
  Plus,
  Radio,
  RefreshCw,
  Ruler,
  Sparkles,
  Sun,
  Zap,
  X,
} from "lucide-react";
import { MomentTimeline } from "@/components/MomentTimeline";
import { SparkleIllustration } from "@/components/EmptyIllustration";
import { BottomNav } from "@/components/BottomNav";
import { DailyDiscoveryCard } from "@/components/DailyDiscoveryCard";
import { ChildSwitcher } from "@/components/ChildSwitcher";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { evaluateInsights, URGENCY_LABEL, type Insight, type ProductInput } from "@/lib/insights";
import { friendlyError, diagnosticDetail } from "@/lib/errors";
import { isBabyRelated, fetchFdaBabyRecallCount, type CpscRecall } from "@/lib/cpscSearch";
import { checkCriticalRecalls, CRITICAL_RECALLS } from "@/lib/recallCheck";
import { selectWeeklyTip, getIsoWeekNumber, weekKey as getTipWeekKey } from "@/lib/safetyTips";
import { WHATS_NEW, LATEST_VERSION, whatsNewDismissalKey } from "@/lib/whatsNew";
import { fetchMilestonesResilient } from "@/lib/momentIcons";
import {
  isLastHomeProfileQuestionStep,
  buildHomeProfileAnswers,
  resolveHomeProfileSetupState,
  shouldShowHomeProfileCard,
  type HomeProfileAnswers,
} from "@/lib/homeProfile";

import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";
import { SoftBlob } from "@/components/SoftBlob";

export const Route = createFileRoute("/_authenticated/home")({
  ssr: false,
  component: HomePage,
  head: () => ({ meta: [{ title: "Home — Peace of Mine" }] }),
});

type Child = {
  id: string;
  name: string;
  date_of_birth: string | null;
  height_inches: number | null;
  weight_lbs: number | null;
  measurements_updated_at: string | null;
};

type Moment = {
  id: string;
  title: string;
  logged_at: string | null;
  notes: string | null;
};

type AlertSummary = {
  recalls: number;
  replace: number;
  sizeUp: number;
};

type ComingUpProduct = {
  id: string;
  name: string;
  brand: string | null;
  when: string;
  type: "replace" | "sizeup" | "expiring";
};

function comingUpLabel(p: ComingUpProduct): string {
  if (p.type === "replace") return `It may be time to replace ${p.name} soon`;
  if (p.type === "expiring") return `${p.name} is approaching its expiration date`;
  return `${p.name} might be ready for a size-up`;
}

// ── Weekly digest helpers ───────────────────────────────────────────────────
function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function isSunday() {
  return new Date().getDay() === 0;
}

function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function nextMeasurementReminderLabel(measurementsUpdatedAt: string | null): string {
  const base = measurementsUpdatedAt ? new Date(measurementsUpdatedAt) : new Date();
  const next = new Date(base.getTime() + 28 * 24 * 60 * 60 * 1000);
  return next.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function calcAge(dob: string | null): { label: string } {
  if (!dob) return { label: "Little one" };
  const birth = parseDateLocal(dob);
  const days = Math.max(0, Math.floor((Date.now() - birth.getTime()) / 86400000));
  const weeks = Math.floor(days / 7);
  if (weeks < 12) return { label: `${weeks} ${weeks === 1 ? "week" : "weeks"} old` };
  const months = Math.floor(days / 30.44);
  if (months < 24) return { label: `${months} ${months === 1 ? "month" : "months"} old` };
  const years = Math.floor(months / 12);
  return { label: `${years}y ${months % 12}m old` };
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up?";
  if (h < 7) return "Early start today";
  if (h < 12) return "Good morning";
  if (h < 14) return "Good afternoon";
  if (h < 18) return "How's the day going";
  if (h < 21) return "Good evening";
  return "Winding down?";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ── Age jump milestones ──────────────────────────────────────────────────────
const AGE_MILESTONES: { months: number; actions: string[] }[] = [
  {
    months: 3,
    actions: [
      "Lower the crib mattress to the middle setting — babies this age can push up on their arms.",
      "Re-check the car seat harness fit: straps should sit at or below the shoulders, snug enough that you can't pinch any webbing.",
      "Remove all mobiles and hanging toys within arm's reach of the crib.",
    ],
  },
  {
    months: 6,
    actions: [
      "Install hardware-mounted stair gates at the top and bottom of every staircase before they start crawling.",
      "Lower the crib mattress to the lowest setting — they'll be pulling to stand soon.",
      "Add cabinet locks to all lower kitchen and bathroom cabinets.",
    ],
  },
  {
    months: 9,
    actions: [
      "Anchor every bookcase, dresser, and TV stand to the wall — babies this age pull on everything to stand up.",
      "Check your car seat weight limit — some infant seats max out around 9–12 months.",
      "Remove any baby walkers — they're linked to thousands of ER visits each year and are banned in Canada.",
    ],
  },
  {
    months: 12,
    actions: [
      "Transition to a rear-facing convertible car seat if your infant seat has reached its weight or height limit.",
      "Lock all lower cabinets and move cleaning products to high shelves or behind a locked door.",
      "Do a floor-level sweep for small objects — at this age everything goes in the mouth.",
    ],
  },
  {
    months: 18,
    actions: [
      "Add door knob covers — 18-month-olds figure out round knobs quickly.",
      "Check your stroller's weight limit if your toddler is on the heavier side.",
      "Assess whether a toddler bed rail is needed, or if it's time to transition to a floor-level toddler bed.",
    ],
  },
];

function getRecentMilestone(dobStr: string | null): { months: number; actions: string[] } | null {
  if (!dobStr) return null;
  const birth = parseDateLocal(dobStr);
  const ageDays = (Date.now() - birth.getTime()) / 86400000;
  for (const m of AGE_MILESTONES) {
    const milestoneDays = m.months * 30.44;
    const daysAfter = ageDays - milestoneDays;
    if (daysAfter >= 0 && daysAfter <= 14) return m;
  }
  return null;
}

function HomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [child, setChild] = useState<Child | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [alerts, setAlerts] = useState<AlertSummary>({ recalls: 0, replace: 0, sizeUp: 0 });
  const [products, setProducts] = useState<ProductInput[]>([]);
  const [comingUp, setComingUp] = useState<ComingUpProduct[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // What's New card
  const [whatsNewDismissed, setWhatsNewDismissed] = useState(() => {
    try {
      return localStorage.getItem(whatsNewDismissalKey(LATEST_VERSION)) === "true";
    } catch {
      return false;
    }
  });

  // Recall radar: live 30-day CPSC count, cached daily
  const [recallRadarCount, setRecallRadarCount] = useState<number | null>(null);

  // FDA baby recall count (Wednesday only), cached daily
  const [fdaRecallCount, setFdaRecallCount] = useState<number | null>(null);

  // Notification preferences (tip_day, paused_until, expiry_advance_days)
  const [notifPrefs, setNotifPrefs] = useState<{
    tip_day: number;
    paused_until: string | null;
    expiry_advance_days: number;
  }>({ tip_day: 1, paused_until: null, expiry_advance_days: 30 });

  // Weekly safety tip
  const [tipCompleted, setTipCompleted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return !!localStorage.getItem(`safesound.tipDone.${getTipWeekKey()}`);
    } catch {
      return false;
    }
  });
  const [tipSuccess, setTipSuccess] = useState(false);

  // Age jump alert
  const [ageJumpDismissed, setAgeJumpDismissed] = useState(false);

  // Weekly digest: show on Sundays, dismiss per-week
  const currentWeekKey = isoWeekKey();
  const [digestDismissed, setDigestDismissed] = useState(() => {
    try {
      return localStorage.getItem(`safesound.weeklyDigest.${currentWeekKey}`) === "true";
    } catch {
      return false;
    }
  });

  // Recall banner dismiss (resets daily)
  const [recallBannerDismissed, setRecallBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem(`safesound.recallBannerDismissed.${todayKey()}`) === "true";
    } catch {
      return false;
    }
  });

  // Measurements reminder dismiss (resets after 7 days)
  const [measReminderDismissed, setMeasReminderDismissed] = useState(false);

  // Bottle weaning reminder dismiss
  const [bottleWeaningDismissed, setBottleWeaningDismissed] = useState(false);

  // Home profile personalization
  type HomeProfile = {
    has_stairs: boolean;
    home_type: string;
    has_pet: boolean;
    has_car: boolean;
    in_daycare: "daycare" | "home" | "both" | null;
    has_pool: boolean;
  };
  const [homeProfile, setHomeProfile] = useState<HomeProfile | null>(null);
  const [homeProfileSetup, setHomeProfileSetup] = useState<"pending" | "done" | "skipped">(() => {
    try {
      const v = localStorage.getItem("safesound.homeProfileSetup");
      if (v === "done" || v === "skipped") return v;
    } catch {}
    return "pending";
  });
  // Prevents a "prompts me every time I log in" flash on devices where
  // localStorage is empty (new browser, incognito, cleared data): we don't
  // actually know the user's status until the DB read below completes, so
  // hold off rendering the card until then. Otherwise the card shows for
  // ~a few hundred ms every login even though the answers are already saved.
  const [homeProfileLoaded, setHomeProfileLoaded] = useState(false);
  const [hpStep, setHpStep] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      let activeId: string | null = null;
      try {
        activeId = localStorage.getItem("safesound.activeChildId");
      } catch {}
      const { data: kids, error } = await supabase
        .from("children")
        .select("id, name, date_of_birth, height_inches, weight_lbs, measurements_updated_at")
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error(friendlyError(error.message));
        setLoading(false);
        return;
      }
      if (!kids || kids.length === 0) {
        // Age-range profile types (Pediatrician/Daycare/Babysitter-Nanny/
        // Caregiver) intentionally never create a `children` row during
        // onboarding — sending them to /onboarding would trap them in a
        // loop. Route them to /profile, which renders fine with zero kids.
        const { data: prof } = await supabase
          .from("profiles")
          .select("profile_type")
          .maybeSingle();
        const pt = (prof as { profile_type?: string } | null)?.profile_type as
          | import("@/lib/profileType").ProfileType
          | undefined;
        if (pt && (await import("@/lib/profileType")).usesAgeRangeFlow(pt)) {
          navigate({ to: "/profile" });
          return;
        }
        navigate({ to: "/onboarding" });
        return;
      }
      const c = (kids.find((k) => k.id === activeId) ?? kids[0]) as Child;
      setChild(c);

      // Check age-jump dismissal
      try {
        const milestone = getRecentMilestone(c.date_of_birth ?? null);
        if (milestone) {
          const dismissed = localStorage.getItem(`safesound.ageJump.${c.id}.${milestone.months}`);
          if (dismissed) setAgeJumpDismissed(true);
        }
      } catch {}

      // Check measurement reminder dismissal
      try {
        const dimKey = `safesound.measReminderDismissed.${c.id}`;
        const stored = localStorage.getItem(dimKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          if (parsed.ts && parsed.ts > sevenDaysAgo) {
            setMeasReminderDismissed(true);
          }
        }
      } catch {}

      // Check bottle weaning dismissal
      if (c.id) {
        try {
          if (localStorage.getItem(`safesound.bottleWeaning.${c.id}`) === "true") {
            setBottleWeaningDismissed(true);
          }
        } catch {}
      }

      const horizon30 = new Date();
      horizon30.setDate(horizon30.getDate() + 30);
      const horizon90 = new Date();
      horizon90.setDate(horizon90.getDate() + 90);
      const todayStr = new Date().toISOString().slice(0, 10);
      const horizon30Str = horizon30.toISOString().slice(0, 10);
      const horizon90Str = horizon90.toISOString().slice(0, 10);
      const nowIso = new Date().toISOString();

      const [mRes, recallRes, replaceRes, sizeRes, productRes, dismRes, comingUpRes] =
        await Promise.all([
          // Only the single most recent moment is ever shown on Home now
          // (a "Latest moment" highlight, not the full list) — fetch just
          // that one instead of 5.
          fetchMilestonesResilient(c.id, { limit: 1 }),
          supabase
            .from("product_recalls")
            .select("id", { count: "exact", head: true })
            .eq("acknowledged", false),
          supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .gte("replace_at", todayStr)
            .lte("replace_at", horizon30Str),
          supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .gte("next_size_at", todayStr)
            .lte("next_size_at", horizon30Str),
          supabase
            .from("products")
            .select("id, category, purchased_at, size")
            .or(`child_id.eq.${c.id},child_id.is.null`),
          supabase.from("insight_dismissals").select("rule_id, action, until").eq("child_id", c.id),
          supabase
            .from("products")
            .select(
              "id, name, brand, replace_at, next_size_at, predicted_replacement_date, predicted_sizeup_date, expiration_date",
            )
            .or(
              `and(replace_at.gte.${todayStr},replace_at.lte.${horizon90Str}),and(next_size_at.gte.${todayStr},next_size_at.lte.${horizon90Str}),and(predicted_replacement_date.gte.${todayStr},predicted_replacement_date.lte.${horizon90Str}),and(predicted_sizeup_date.gte.${todayStr},predicted_sizeup_date.lte.${horizon90Str}),expiration_date.lte.${horizon90Str}`,
            ),
        ]);

      if (cancelled) return;
      if (mRes.error) {
        // Previously silent: mRes.data is null on error, so setMoments simply
        // never ran — a newly-logged moment would just never appear here,
        // with zero indication anything failed.
        console.error("[home] failed to load recent moments:", mRes.error.message);
        toast.error(friendlyError(mRes.error.message));
      } else if (mRes.data) {
        setMoments(mRes.data as Moment[]);
      }
      setAlerts({
        recalls: recallRes.count ?? 0,
        replace: replaceRes.count ?? 0,
        sizeUp: sizeRes.count ?? 0,
      });
      if (productRes.error) {
        // Previously silent: a failed read here left `products` at its
        // previous value (empty on first load) with no indication — every
        // insight/alert derived from products (recalls, size-up, replace)
        // would silently look like nothing had ever been added.
        console.error("[home] failed to load products:", productRes.error.message);
        toast.error(friendlyError(productRes.error.message));
      } else {
        setProducts((productRes.data ?? []) as ProductInput[]);
      }

      // Build coming-up list: pick the earliest date per product, sort, take top 3
      if (comingUpRes.data) {
        type Raw = {
          id: string;
          name: string;
          brand: string | null;
          replace_at: string | null;
          next_size_at: string | null;
          predicted_replacement_date: string | null;
          predicted_sizeup_date: string | null;
          expiration_date: string | null;
        };
        const items: ComingUpProduct[] = [];
        for (const p of comingUpRes.data as Raw[]) {
          const replaceDate = p.predicted_replacement_date ?? p.replace_at;
          const sizeDate = p.predicted_sizeup_date ?? p.next_size_at;
          if (replaceDate && replaceDate >= todayStr && replaceDate <= horizon90Str) {
            items.push({
              id: `replace:${p.id}`,
              name: p.name,
              brand: p.brand,
              when: replaceDate,
              type: "replace",
            });
          }
          if (sizeDate && sizeDate >= todayStr && sizeDate <= horizon90Str) {
            items.push({
              id: `sizeup:${p.id}`,
              name: p.name,
              brand: p.brand,
              when: sizeDate,
              type: "sizeup",
            });
          }
          if (p.expiration_date && p.expiration_date <= horizon90Str) {
            items.push({
              id: `expiring:${p.id}`,
              name: p.name,
              brand: p.brand,
              when: p.expiration_date,
              type: "expiring",
            });
          }
        }
        items.sort((a, b) => a.when.localeCompare(b.when));
        setComingUp(items.slice(0, 3));
      }
      if (dismRes.error) {
        // Previously silent: a failed read here just left `blocked` empty,
        // so every "Done"/"Snooze 1 week" a parent had already saved would
        // silently reappear as if it had never been recorded — exactly the
        // "done and snooze not saving" symptom, even though the write
        // itself (saveInsightResponse above) had actually succeeded.
        console.error("[home] failed to load insight_dismissals:", dismRes.error.message);
        toast.error(friendlyError(dismRes.error.message));
      } else {
        const blocked = new Set<string>();
        for (const d of (dismRes.data ?? []) as {
          rule_id: string;
          action: string;
          until: string | null;
        }[]) {
          if (d.action === "done" || d.action === "dismissed") blocked.add(d.rule_id);
          else if (d.action === "snoozed" && d.until && d.until > nowIso) blocked.add(d.rule_id);
        }
        setDismissedIds(blocked);
      }

      // Load home profile
      try {
        const {
          data: { session: sess2 },
        } = await supabase.auth.getSession();
        if (sess2?.user) {
          const { data: hp, error: hpError } = await (supabase as any)
            .from("home_profile")
            .select("has_stairs, home_type, has_pet, has_car, in_daycare, has_pool, dismissed_at")
            .eq("user_id", sess2.user.id)
            .maybeSingle();
          if (hpError) {
            // Previously silent (error wasn't even destructured): a failed
            // read here is indistinguishable from "no profile saved yet",
            // so the setup card would keep reappearing even for someone
            // who'd already answered every question, looking exactly like
            // "not remembering my answers".
            console.error("[home] failed to load home_profile:", hpError.message);
            toast.error(friendlyError(hpError.message));
            // Don't flip loaded=true here — leaving it false keeps the card
            // hidden so we don't prompt for answers we couldn't verify are
            // missing. On the next successful load it will resolve properly.
          } else {
            if (hp) {
              // Any row (with answers OR just a dismissed_at marker) means the
              // user has already interacted with the card once — never show it
              // again on any device. Previously the "skip" state lived only in
              // localStorage, so skipping on phone → opening on tablet → card
              // reappears; same issue after a browser data clear.
              setHomeProfile(hp as HomeProfile);
            }
            const nextState = resolveHomeProfileSetupState(hp);
            try {
              localStorage.setItem("safesound.homeProfileSetup", nextState);
            } catch {}
            setHomeProfileSetup(nextState);
            // Only now do we actually know whether the user needs the prompt;
            // gate the card render on this so first-login-on-a-new-device
            // doesn't flash the card before we've read the DB.
            setHomeProfileLoaded(true);
          }

        }
      } catch (err) {
        console.error("[home] failed to load home_profile (network):", err);
      }


      // Load notification preferences
      try {
        const {
          data: { session: sess },
        } = await supabase.auth.getSession();
        if (sess?.user) {
          const { data: prefData } = await (supabase as any)
            .from("notification_preferences")
            .select("tip_day, paused_until, expiry_advance_days")
            .eq("user_id", sess.user.id)
            .maybeSingle();
          if (prefData) setNotifPrefs(prefData as typeof notifPrefs);

          // Check if this week's tip is already completed
          const wk = getTipWeekKey();
          const { data: tipData } = await (supabase as any)
            .from("completed_tips")
            .select("id")
            .eq("user_id", sess.user.id)
            .eq("week_key", wk)
            .maybeSingle();
          if (tipData) setTipCompleted(true);
        }
      } catch {}

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Re-fetch moments when tab regains visibility (e.g. returning from /moments/new)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      supabase
        .from("milestones")
        .select("id, title, logged_at, notes")
        .eq("child_id", (child as any)?.id)
        .order("logged_at", { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data) setMoments(data as Moment[]);
        });
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [child]);

  // Background critical recall check — runs once after products load
  useEffect(() => {
    if (products.length === 0) return;
    (async () => {
      try {
        // Fetch id + name for all products to check against critical recalls
        const { data } = await (supabase as any).from("products").select("id, name, recalled");
        if (!Array.isArray(data)) return;

        let newRecalls = 0;
        for (const p of data as Array<{ id: string; name: string; recalled: boolean }>) {
          if (p.recalled) continue; // already flagged
          const hit = checkCriticalRecalls(p.name);
          if (!hit) continue;

          // Upsert into recall catalog
          const { data: catalogEntry } = await (supabase as any)
            .from("recalls")
            .upsert(
              { source: "critical", source_id: hit.id, title: hit.title, url: hit.url },
              { onConflict: "source,source_id" },
            )
            .select("id")
            .single();
          const recallId = (catalogEntry as { id: string } | null)?.id;
          if (recallId) {
            await (supabase as any)
              .from("product_recalls")
              .upsert(
                { product_id: p.id, recall_id: recallId, acknowledged: false },
                { onConflict: "product_id,recall_id" },
              );
          }
          await (supabase as any).from("products").update({ recalled: true }).eq("id", p.id);
          newRecalls++;
        }
        if (newRecalls > 0) {
          // Refresh alert counts
          const { count } = await (supabase as any)
            .from("product_recalls")
            .select("id", { count: "exact", head: true })
            .eq("acknowledged", false);
          setAlerts((prev) => ({ ...prev, recalls: count ?? prev.recalls }));
        }
      } catch {
        // background — silently ignore
      }
    })();
  }, [products.length]);

  const age = useMemo(() => calcAge(child?.date_of_birth ?? null), [child]);
  const totalAlerts = alerts.recalls + alerts.replace + alerts.sizeUp;
  // Matches the icon/priority order the alert tiles below already use —
  // recalls (safety-critical) outrank replacements, which outrank size-ups.
  const HeaderAlertIcon =
    alerts.recalls > 0 ? AlertTriangle : alerts.replace > 0 ? RefreshCw : alerts.sizeUp > 0 ? Ruler : Sparkles;
  const upNext: Insight[] = useMemo(() => {
    const all = evaluateInsights(child, products, homeProfile);
    return all.filter((i) => !dismissedIds.has(i.id)).slice(0, 3);
  }, [child, products, dismissedIds, homeProfile]);

  // Show measurements reminder if measurements_updated_at is null or > 28 days ago
  const showMeasReminder = useMemo(() => {
    if (!child || measReminderDismissed) return false;
    if (!child.measurements_updated_at) return true;
    const updatedAt = new Date(child.measurements_updated_at).getTime();
    const twentyEightDaysAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;
    return updatedAt < twentyEightDaysAgo;
  }, [child, measReminderDismissed]);

  // Manual select-then-update-or-insert instead of `.upsert(..., { onConflict })`.
  // onConflict requires a real unique constraint matching those exact columns —
  // if the live DB's constraint shape doesn't match what we expect (e.g. an
  // undeployed migration), the upsert fails outright. This works regardless of
  // which unique constraint (if any) is currently live.
  async function saveInsightResponse(
    insightId: string,
    action: "dismissed" | "snoozed",
    until: string | null,
  ) {
    if (!child) return;
    setDismissedIds((prev) => new Set([...prev, insightId]));
    try {
      const {
        data: { session: sess },
      } = await supabase.auth.getSession();
      if (!sess?.user) return;
      const { data: existing, error: selectError } = await (supabase as any)
        .from("insight_dismissals")
        .select("id")
        .eq("child_id", child.id)
        .eq("rule_id", insightId)
        .maybeSingle();
      if (selectError) throw selectError;

      if (existing) {
        const { error } = await (supabase as any)
          .from("insight_dismissals")
          .update({ user_id: sess.user.id, action, until })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("insight_dismissals").insert({
          user_id: sess.user.id,
          child_id: child.id,
          rule_id: insightId,
          action,
          until,
        });
        if (error) throw error;
      }
    } catch (err) {
      console.error(`insight_dismissals ${action} failed:`, err);
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(insightId);
        return next;
      });
      toast.error(`Couldn't save: ${diagnosticDetail(err)}`);
    }
  }

  function dismissInsight(insightId: string) {
    return saveInsightResponse(insightId, "dismissed", null);
  }

  function snoozeInsight(insightId: string) {
    const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return saveInsightResponse(insightId, "snoozed", until);
  }

  function dismissRecallBanner() {
    try {
      localStorage.setItem(`safesound.recallBannerDismissed.${todayKey()}`, "true");
    } catch {}
    setRecallBannerDismissed(true);
  }

  function dismissDigest() {
    try {
      localStorage.setItem(`safesound.weeklyDigest.${currentWeekKey}`, "true");
    } catch {}
    setDigestDismissed(true);
  }

  function dismissWhatsNew() {
    try {
      localStorage.setItem(whatsNewDismissalKey(LATEST_VERSION), "true");
    } catch {}
    setWhatsNewDismissed(true);
  }

  function dismissAgeJump() {
    if (!child || !recentMilestone) return;
    try {
      localStorage.setItem(`safesound.ageJump.${child.id}.${recentMilestone.months}`, "1");
    } catch {}
    setAgeJumpDismissed(true);
  }

  async function markTipDone() {
    const wk = getTipWeekKey();
    try {
      localStorage.setItem(`safesound.tipDone.${wk}`, "1");
    } catch {}
    setTipCompleted(true);
    setTipSuccess(true);
    setTimeout(() => setTipSuccess(false), 3000);
    try {
      const {
        data: { session: sess },
      } = await supabase.auth.getSession();
      if (!sess?.user) return;
      const wk = getTipWeekKey();
      const tip = child
        ? selectWeeklyTip(
            Math.floor(
              (Date.now() - new Date(child.date_of_birth ?? new Date().toISOString()).getTime()) /
                (30.44 * 86400000),
            ),
            getIsoWeekNumber(),
            homeProfile?.has_stairs,
          )
        : null;
      await (supabase as any).from("completed_tips").upsert(
        {
          user_id: sess.user.id,
          child_id: child?.id ?? null,
          tip_id: tip?.id ?? "unknown",
          week_key: wk,
        },
        { onConflict: "user_id,week_key" },
      );
    } catch {}
  }

  function dismissMeasReminder() {
    if (!child) return;
    try {
      localStorage.setItem(
        `safesound.measReminderDismissed.${child.id}`,
        JSON.stringify({ ts: Date.now() }),
      );
    } catch {}
    setMeasReminderDismissed(true);
  }

  // Recall Radar: fetch 30-day CPSC baby recall count, cached daily
  useEffect(() => {
    const key = `safesound.recallRadar.${todayKey()}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached !== null) {
        setRecallRadarCount(parseInt(cached, 10));
        return;
      }
    } catch {}
    const start30 = new Date();
    start30.setDate(start30.getDate() - 30);
    const startStr = start30.toISOString().slice(0, 10);
    fetch(
      `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=${startStr}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: CpscRecall[]) => {
        const count = (Array.isArray(data) ? data : []).filter(isBabyRelated).length;
        try {
          localStorage.setItem(key, String(count));
        } catch {}
        setRecallRadarCount(count);
      })
      .catch(() => setRecallRadarCount(-1));
  }, []);

  // FDA recall count — fetched daily, cached per day
  useEffect(() => {
    const key = `safesound.fdaRecalls.${todayKey()}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached !== null) {
        setFdaRecallCount(parseInt(cached, 10));
        return;
      }
    } catch {}
    fetchFdaBabyRecallCount(30)
      .then((count) => {
        try {
          localStorage.setItem(key, String(count));
        } catch {}
        setFdaRecallCount(count);
      })
      .catch(() => setFdaRecallCount(0));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const recentMilestone = getRecentMilestone(child?.date_of_birth ?? null);

  const ageMonthsForBottle = child?.date_of_birth
    ? Math.floor((Date.now() - new Date(child.date_of_birth).getTime()) / (30.44 * 86400000))
    : 0;
  const showBottleWeaning =
    !bottleWeaningDismissed && ageMonthsForBottle >= 12 && ageMonthsForBottle <= 15;

  function dismissBottleWeaning() {
    if (!child) return;
    try {
      localStorage.setItem(`safesound.bottleWeaning.${child.id}`, "true");
    } catch {}
    setBottleWeaningDismissed(true);
  }

  async function saveHomeProfile(answers: HomeProfile) {
    // Optimistic — closes the card immediately rather than blocking on
    // network latency — but rolled back below if the write actually fails,
    // instead of silently pretending it saved (the previous empty catch{}
    // meant a failed write was completely invisible: the card wouldn't
    // reappear this session since localStorage said "done", but the
    // answers were never actually in the database, so a new session/device
    // would prompt again with no memory of them — exactly the reported
    // "keeps prompting and not remembering my answers").
    setHomeProfile(answers);
    setHomeProfileSetup("done");
    try {
      localStorage.setItem("safesound.homeProfileSetup", "done");
    } catch {}
    try {
      const {
        data: { session: sess },
      } = await supabase.auth.getSession();
      if (!sess?.user) throw new Error("Not signed in");
      const { error } = await (supabase as any).from("home_profile").upsert(
        {
          user_id: sess.user.id,
          ...answers,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    } catch (err) {
      console.error("[home] failed to save home_profile:", err);
      toast.error(
        err instanceof Error
          ? friendlyError(err.message)
          : "Couldn't save your answers — please try again.",
      );
      setHomeProfileSetup("pending");
      try {
        localStorage.setItem("safesound.homeProfileSetup", "pending");
      } catch {}
    }
  }

  async function skipHomeProfile() {
    // Optimistic — hides the card immediately. Persisted to the database
    // (dismissed_at column) so the "I already dismissed this" state
    // survives across devices and browser-data clears; previously stored
    // only in localStorage, which is why users saw the card reappear on
    // every new device.
    setHomeProfileSetup("skipped");
    try {
      localStorage.setItem("safesound.homeProfileSetup", "skipped");
    } catch {}
    try {
      const {
        data: { session: sess },
      } = await supabase.auth.getSession();
      if (!sess?.user) return;
      const { error } = await (supabase as any).from("home_profile").upsert(
        {
          user_id: sess.user.id,
          dismissed_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) {
        console.error("[home] failed to persist home_profile skip:", error);
      }
    } catch (err) {
      console.error("[home] failed to persist home_profile skip (network):", err);
    }
  }
  // Weekly safety tip
  const alertsPaused = notifPrefs.paused_until && new Date(notifPrefs.paused_until) > new Date();
  const today = new Date().getDay();
  const showTipCard = !alertsPaused && !tipCompleted && today >= notifPrefs.tip_day;
  const ageMonthsForTip = child?.date_of_birth
    ? Math.floor((Date.now() - new Date(child.date_of_birth).getTime()) / (30.44 * 86400000))
    : 0;
  const weeklyTip = selectWeeklyTip(ageMonthsForTip, getIsoWeekNumber());

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 animate-fade-in">
      <header className="relative overflow-hidden px-5 pt-10 pb-4 sm:px-6">
        <SoftBlob className="-right-24 -top-32" />
        <div className="mx-auto max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo />
            </div>
            <div className="flex items-center gap-2">
              <ChildSwitcher />
              <Link
                to="/alerts"
                className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-body text-[11px] font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground"
              >
                <HeaderAlertIcon
                  className="h-3 w-3"
                  style={{ color: alerts.recalls > 0 ? "var(--destructive)" : "var(--accent)" }}
                />
                {totalAlerts === 0 ? "All quiet" : `${totalAlerts} to look at`}
              </Link>
            </div>
          </div>

          <p className="font-body text-sm font-medium uppercase tracking-[0.2em] text-accent">
            {greeting()}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
            {child?.name}
          </h1>
          <p className="mt-2 font-body text-base text-muted-foreground">{age.label}</p>
          <p
            className="mt-4 text-[10px] font-medium tracking-[0.12em] text-muted-foreground/50"
            style={{ fontFamily: '"Inter", system-ui, sans-serif', textTransform: "uppercase" }}
          >
            Recommendations informed by AAP, CPSC, and other trusted safety guidance
          </p>
        </div>
      </header>

      <BetaBanner />

      {/* Home Personalization Setup — one-time, shown after onboarding */}
      {shouldShowHomeProfileCard(homeProfileSetup, homeProfileLoaded) && child && (
        <div className="px-5 pt-4 sm:px-6">
          <div className="mx-auto max-w-md">
            <HomePersonalizationCard
              step={hpStep}
              onStep={setHpStep}
              onSave={saveHomeProfile}
              onSkip={skipHomeProfile}
            />
          </div>
        </div>
      )}

      {/* Today Section — card-of-the-day (replaces the old day-of-week
          alerts/reminders card; recall counts, replacement alerts, and the
          measurement reminder are still surfaced elsewhere on this page —
          the header alert pill, the recall banner, and Recall Radar). */}
      <div className="px-5 pt-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <DailyDiscoveryCard dob={child?.date_of_birth ?? null} />
        </div>
      </div>

      {/* Weekly Safety Tip */}
      {showTipCard && weeklyTip && (
        <div className="px-5 pt-3 sm:px-6">
          <div className="mx-auto max-w-md">
            <WeeklySafetyTipCard tip={weeklyTip} onDone={markTipDone} showSuccess={tipSuccess} />
          </div>
        </div>
      )}

      {/* Bottle weaning reminder — 12–15 months only */}
      {showBottleWeaning && child && (
        <div className="px-5 pt-3 sm:px-6">
          <div className="mx-auto max-w-md">
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-[#8FAF8C]/40 bg-[#F2F7F1] px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-body text-xs font-semibold uppercase tracking-wider text-[#4A7A47] mb-1">
                  A gentle heads-up
                </p>
                <p className="font-body text-sm leading-snug text-foreground/80">
                  Many pediatric dentists suggest beginning to transition away from bottle use
                  around 12 to 15 months to support healthy tooth development — every child is
                  different so check with your own dentist or pediatrician about what feels right
                  for your family.
                </p>
              </div>
              <button
                type="button"
                onClick={dismissBottleWeaning}
                className="mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground hover:bg-black/10"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recall banner — shown at top if there are active recalls */}
      {alerts.recalls > 0 && !recallBannerDismissed && (
        <div className="px-5 pt-3 sm:px-6">
          <div className="mx-auto max-w-md">
            <Link
              to="/alerts"
              className="flex items-center justify-between rounded-2xl bg-destructive/90 px-4 py-3 text-white"
            >
              <span className="font-body text-sm font-semibold">
                ⚠️ {alerts.recalls} recall{alerts.recalls > 1 ? "s" : ""} affecting your products —
                tap to review
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  dismissRecallBanner();
                }}
                className="ml-3 shrink-0 rounded-full p-1 hover:bg-white/20"
                aria-label="Dismiss recall banner"
              >
                <X className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* Measurements reminder card */}
      {showMeasReminder && child && (
        <div className="px-5 pt-3 sm:px-6">
          <div className="mx-auto max-w-md">
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-[#8FAF8C]/40 bg-[#F2F7F1] px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm leading-snug text-foreground/80">
                  It may be worth updating {child.name}'s measurements — keeping them current helps
                  us estimate size-up timing more accurately.
                </p>
                <Link
                  to="/profile"
                  className="mt-2 inline-block font-body text-xs font-semibold text-[#4A7A47] underline underline-offset-2"
                >
                  Update measurements →
                </Link>
              </div>
              <button
                type="button"
                onClick={dismissMeasReminder}
                className="mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground hover:bg-black/10"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Age jump alert — shown when child recently crossed a milestone */}
      {recentMilestone && !ageJumpDismissed && child && (
        <div className="px-5 pt-3 sm:px-6">
          <div className="mx-auto max-w-md">
            <AgeJumpCard
              childName={child.name}
              months={recentMilestone.months}
              actions={recentMilestone.actions.filter((a) =>
                homeProfile?.has_stairs === false ? !/stair|gate/i.test(a) : true,
              )}
              onDismiss={dismissAgeJump}
            />
          </div>
        </div>
      )}

      {/* Recall Radar — live 30-day CPSC + FDA count, plus always-relevant critical recalls */}
      {recallRadarCount !== null && recallRadarCount !== -1 && (
        <div className="px-5 pt-3 sm:px-6">
          <div className="mx-auto max-w-md">
            <RecallRadarCard
              count={recallRadarCount + (fdaRecallCount ?? 0) + CRITICAL_RECALLS.length}
              matchedCount={alerts.recalls}
              childName={child?.name ?? "your child"}
            />
          </div>
        </div>
      )}

      {/* Pool alarm nudge — shown when home profile says they have a pool */}
      {homeProfile?.has_pool && (
        <div className="px-5 pt-3 sm:px-6">
          <div className="mx-auto max-w-md">
            <div className="flex items-start gap-3 rounded-3xl border border-blue-200 bg-blue-50 px-4 py-4">
              <span className="mt-0.5 text-xl">🏊</span>
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm font-semibold text-foreground">
                  Pool alarm recommended
                </p>
                <p className="mt-0.5 font-body text-xs leading-relaxed text-muted-foreground">
                  Since you have a pool, the AAP recommends a pool alarm as a secondary layer of
                  protection alongside a four-sided fence. Alarms can alert you if a child enters
                  the water unexpectedly.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert summary cards — ABOVE "Up next" */}
      <section className="px-5 pt-4 sm:px-6 animate-fade-up stagger-1">
        <div className="mx-auto max-w-md">
          {totalAlerts === 0 ? (
            <Link
              to="/alerts"
              className="flex items-center justify-between rounded-3xl border border-border/60 bg-card p-4 transition-all hover:border-primary/40"
            >
              <div>
                <p className="font-display text-base font-semibold tracking-tight">
                  ✨ You're all caught up
                </p>
                <p className="mt-0.5 font-body text-xs text-muted-foreground">
                  No recalls, replacements, or size changes found right now — we'll flag it here if
                  that changes based on what we're able to check.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              <SummaryTile
                icon={AlertTriangle}
                count={alerts.recalls}
                label="Recalls"
                tone={alerts.recalls > 0 ? "danger" : "muted"}
              />
              <SummaryTile icon={RefreshCw} count={alerts.replace} label="Replacements" />
              <SummaryTile icon={Ruler} count={alerts.sizeUp} label="Size up" />
            </div>
          )}
        </div>
      </section>

      {/* What's New */}
      {!whatsNewDismissed && (
        <section className="px-5 pt-4 sm:px-6 animate-fade-up stagger-3">
          <div className="mx-auto max-w-md">
            <WhatsNewCard updates={WHATS_NEW.slice(0, 2)} onDismiss={dismissWhatsNew} />
          </div>
        </section>
      )}

      {/* Up next — proactive guidance */}
      {upNext.length > 0 && (
        <section className="px-5 pt-4 sm:px-6 animate-fade-up stagger-4">
          <div className="mx-auto max-w-md">
            <div className="rounded-3xl border border-border/60 bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sand/60 text-accent">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <p className="font-display text-sm font-semibold tracking-tight">
                  Up next for {child?.name}
                </p>
              </div>
              <ul className="space-y-2.5">
                {upNext.map((i) => (
                  <InsightCard
                    key={i.id}
                    insight={i}
                    onDismiss={() => dismissInsight(i.id)}
                    onSnooze={() => snoozeInsight(i.id)}
                  />
                ))}
              </ul>
              <p className="mt-3 font-body text-[10px] leading-relaxed text-muted-foreground/60">
                Recommendations are informational and may not apply to every child or home. Always
                use your judgment and review manufacturer instructions.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Recent moments */}
      <section className="px-5 pt-10 sm:px-6 animate-fade-up stagger-4">
        <div className="mx-auto max-w-md">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold tracking-tight">Moments</h2>
            <div className="flex items-center gap-1">
              <Button asChild size="sm" variant="ghost" className="rounded-full font-body text-xs">
                <Link to="/moments">View all</Link>
              </Button>
              <Button asChild size="sm" variant="ghost" className="rounded-full font-body text-xs">
                <Link to="/moments/new">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Log
                </Link>
              </Button>
            </div>
          </div>

          {moments.length === 0 ? (
            <EmptyMoments />
          ) : (
            <div>
              <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.15em] text-accent">
                Latest moment
              </p>
              <MomentTimeline
                moments={moments.slice(0, 1)}
                childName={child?.name}
                childDob={child?.date_of_birth}
              />
            </div>
          )}
        </div>
      </section>

      <BottomNav />
    </div>
  );
}

function InsightCard({
  insight,
  onDismiss,
  onSnooze,
}: {
  insight: Insight;
  onDismiss: () => void;
  onSnooze: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = insight.body.length > 100;
  return (
    <li className="rounded-2xl bg-muted/40 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-body text-sm font-medium leading-snug">{insight.title}</p>
        <span
          className={
            insight.urgency === "now"
              ? "shrink-0 rounded-full bg-primary/15 px-2 py-0.5 font-body text-[10px] font-semibold uppercase text-primary"
              : insight.urgency === "soon"
                ? "shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 font-body text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400"
                : "shrink-0 rounded-full bg-sand/60 px-2 py-0.5 font-body text-[10px] font-semibold uppercase text-accent"
          }
        >
          {URGENCY_LABEL[insight.urgency]}
        </span>
      </div>
      <p
        className={`mt-1 font-body text-xs text-muted-foreground ${!expanded && isLong ? "line-clamp-2" : ""}`}
      >
        {insight.body}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex items-center gap-0.5 font-body text-[11px] font-semibold text-accent/80 hover:underline"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> Show more
              </>
            )}
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSnooze}
            className="rounded-full border border-border/60 bg-card px-2.5 py-0.5 font-body text-[11px] text-muted-foreground hover:bg-muted"
          >
            Snooze 1 week
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-border/60 bg-card px-2.5 py-0.5 font-body text-[11px] text-muted-foreground hover:bg-muted"
          >
            Done
          </button>
        </div>
      </div>
      <p className="mt-2 font-body text-[10px] text-muted-foreground/60">
        Based on AAP guidance and developmental milestones.
      </p>
    </li>
  );
}

function SummaryTile({
  icon: Icon,
  count,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  label: string;
  tone?: "danger" | "muted";
}) {
  const accent =
    tone === "danger"
      ? "bg-destructive/15 text-destructive"
      : count > 0
        ? "bg-sand/60 text-accent"
        : "bg-muted text-muted-foreground";
  return (
    <Link
      to="/alerts"
      className="flex flex-col items-start gap-2 rounded-2xl border border-border/60 bg-card p-3"
    >
      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${accent}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <p className="font-display text-2xl font-semibold tracking-tight">{count}</p>
      <p className="font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
    </Link>
  );
}

function WeeklyDigestCard({
  childName,
  recalls,
  comingUp,
  safetyTip,
  onDismiss,
}: {
  childName: string;
  recalls: number;
  comingUp: ComingUpProduct[];
  safetyTip: string;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-3xl border border-primary/30 bg-card p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold tracking-tight">
              This week for {childName}
            </p>
            <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">
              Weekly digest
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="space-y-2.5 border-t border-border/40 pt-3">
        {recalls > 0 ? (
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-sm">⚠️</span>
            <p className="font-body text-sm text-foreground">
              <span className="font-semibold text-destructive">
                {recalls} active recall{recalls > 1 ? "s" : ""}
              </span>{" "}
              — check the Alerts tab.
            </p>
          </li>
        ) : (
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-sm">✅</span>
            <p className="font-body text-sm text-foreground">
              No new recalls this week — all clear.
            </p>
          </li>
        )}
        {comingUp.length > 0 ? (
          <li className="flex items-start gap-2">
            <p className="font-body text-sm text-foreground">
              It may be time to take a look at {comingUp[0].name}
              {comingUp.length > 1
                ? ` and ${comingUp.length - 1} other product${comingUp.length - 1 > 1 ? "s" : ""}`
                : ""}{" "}
              — {comingUp.length > 1 ? "they" : "it"} could be due for a refresh soon.
            </p>
          </li>
        ) : (
          <li className="flex items-start gap-2">
            <p className="font-body text-sm text-foreground">
              No replacements or size-ups due in the next 90 days.
            </p>
          </li>
        )}
        <li className="flex items-start gap-2">
          <span className="mt-0.5 text-sm">🛡️</span>
          <p className="font-body text-sm text-foreground">{safetyTip}</p>
        </li>
      </ul>
    </div>
  );
}

function WhatsNewCard({
  updates,
  onDismiss,
}: {
  updates: { version: string; date: string; updates: string[] }[];
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const latest = updates[0];
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Zap className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold tracking-tight">What's new</p>
            <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">
              {latest.version} · {latest.date}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="space-y-1.5">
        {latest.updates.map((u, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <p className="font-body text-sm text-foreground/80">{u}</p>
          </li>
        ))}
      </ul>
      {updates.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 inline-flex items-center gap-1 font-body text-xs font-semibold text-primary/70 hover:underline"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Hide older updates
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> See older updates
              </>
            )}
          </button>
          {expanded &&
            updates.slice(1).map((rel) => (
              <div key={rel.version} className="mt-3 border-t border-border/30 pt-3">
                <p className="mb-1.5 font-body text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {rel.version} · {rel.date}
                </p>
                <ul className="space-y-1.5">
                  {rel.updates.map((u, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                      <p className="font-body text-xs text-muted-foreground">{u}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </>
      )}
    </div>
  );
}

function AgeJumpCard({
  childName,
  months,
  actions,
  onDismiss,
}: {
  childName: string;
  months: number;
  actions: string[];
  onDismiss: () => void;
}) {
  const label = months < 12 ? `${months} months` : months === 12 ? "1 year" : `${months} months`;
  return (
    <div className="rounded-3xl border border-accent/40 bg-card p-5 animate-scale-in">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-accent">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold tracking-tight">
              {childName} just turned {label} 🎉
            </p>
            <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">
              General guidance for this age — not personalized medical advice
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="space-y-2 border-t border-border/40 pt-3">
        {actions.map((action, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <p className="font-body text-sm text-foreground/80">{action}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecallRadarCard({
  count,
  matchedCount,
  childName,
}: {
  count: number;
  matchedCount: number;
  childName: string;
}) {
  return (
    <div className="space-y-2">
      {/* Recall Radar — industry-wide, every baby/kids recall published
          recently, regardless of what this user owns. Links to the full
          public-database list. */}
      <Link
        to="/recall-radar"
        className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3.5 transition-colors hover:border-primary/40"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Radio className="h-4 w-4" />
          </span>
          <div>
            <p className="font-body text-sm font-semibold">Recall Radar</p>
            <p className="font-body text-[11px] text-muted-foreground">
              {count > 0
                ? `${count} new recall${count > 1 ? "s" : ""} published this month, industry-wide`
                : "No new recalls published this month, industry-wide"}
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      {/* Alerts for [Child] — only recalls matched to products this user
          actually added. A separate section on purpose: this is a
          fuzzy-name match, not a certified affected-unit confirmation, and
          it's a fundamentally different (much smaller, personal) list than
          the industry-wide one above. Links to /alerts, where the actual
          matched list lives — not to /recall-radar. */}
      <Link
        to="/alerts"
        className={`flex items-center justify-between rounded-2xl border px-4 py-3.5 transition-colors ${
          matchedCount > 0
            ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50"
            : "border-border/60 bg-card hover:border-primary/40"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${matchedCount > 0 ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}
          >
            <ShieldAlert className="h-4 w-4" />
          </span>
          <div>
            <p className="font-body text-sm font-semibold">Alerts for {childName}</p>
            <p className="font-body text-[11px] text-muted-foreground">
              {matchedCount > 0
                ? `${matchedCount} may match ${childName}'s saved products — tap to review.`
                : `None currently match ${childName}'s saved products.`}
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </div>
  );
}

// ── Weekly Safety Tip Card ──────────────────────────────────────────────────
function WeeklySafetyTipCard({
  tip,
  onDone,
  showSuccess,
}: {
  tip: { id: string; text: string };
  onDone: () => void;
  showSuccess: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm animate-scale-in">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body text-[11px] font-semibold uppercase tracking-widest text-primary mb-1">
            Safety tip this week
          </p>
          <p className="font-body text-sm text-foreground leading-relaxed">{tip.text}</p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              onClick={onDone}
              disabled={showSuccess}
              className="h-8 rounded-full bg-primary px-4 font-body text-xs font-semibold text-primary-foreground"
            >
              {showSuccess ? (
                <>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Done!
                </>
              ) : (
                "Mark done"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyMoments() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-10 text-center animate-scale-in">
      <SparkleIllustration className="mx-auto mb-2 h-24 w-24" />
      <p className="font-display text-lg font-semibold tracking-tight">
        Every first is worth remembering
      </p>
      <p className="mx-auto mt-1.5 max-w-xs font-body text-sm text-muted-foreground">
        Log a milestone and we'll surface safety tips that are relevant to where your child is right
        now.
      </p>
      <Button asChild className="mt-5 rounded-full bg-primary px-5 font-body text-xs font-semibold">
        <Link to="/moments/new">
          <Plus className="mr-1 h-3.5 w-3.5" /> Log your first moment
        </Link>
      </Button>
    </div>
  );
}

// ── Home Personalization Card ────────────────────────────────────────────────
function HomePersonalizationCard({
  step,
  onStep,
  onSave,
  onSkip,
}: {
  step: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  onStep: (s: 0 | 1 | 2 | 3 | 4 | 5 | 6) => void;
  onSave: (answers: HomeProfileAnswers) => void;
  onSkip: () => void;
}) {
  const [answers, setAnswers] = useState<Partial<HomeProfileAnswers>>({});

  function pick(key: keyof HomeProfileAnswers, value: boolean | string) {
    const updated = { ...answers, [key]: value };
    setAnswers(updated);
    const next = (step + 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    if (step < 6) {
      onStep(next);
    }
    if (isLastHomeProfileQuestionStep(step)) {
      onSave(buildHomeProfileAnswers(updated));
    }
  }

  const questions: {
    key: keyof HomeProfileAnswers;
    text: string;
    options: { label: string; value: boolean | string }[];
  }[] = [
    {
      key: "has_stairs",
      text: "Do you have stairs at home?",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    {
      key: "home_type",
      text: "What type of home do you live in?",
      options: [
        { label: "House", value: "house" },
        { label: "Apartment", value: "apartment" },
        { label: "Other", value: "other" },
      ],
    },
    {
      key: "has_pet",
      text: "Do you have a pet?",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    {
      key: "has_car",
      text: "Do you have a car?",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    {
      key: "in_daycare",
      text: "Is your baby in daycare or cared for at home?",
      options: [
        { label: "Daycare", value: "daycare" },
        { label: "At home", value: "home" },
        { label: "Both", value: "both" },
      ],
    },
    {
      key: "has_pool",
      text: "Do you have a pool or spa at home?",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
  ];

  if (step === 0) {
    return (
      <div className="rounded-3xl border border-primary/30 bg-card p-5 animate-scale-in">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <p className="font-display text-sm font-semibold tracking-tight">
              Help us personalize your reminders
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label="Skip"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
          A few quick questions so we only show you the reminders that actually apply to your home
          and family — no forms, just taps.
        </p>
        <div className="flex gap-2">
          <Button size="sm" className="rounded-full font-body text-xs" onClick={() => onStep(1)}>
            Get started →
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full font-body text-xs text-muted-foreground"
            onClick={onSkip}
          >
            Skip
          </Button>
        </div>
      </div>
    );
  }

  const q = questions[step - 1];

  return (
    <div className="rounded-3xl border border-primary/30 bg-card p-5 animate-scale-in">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="font-body text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Question {step} of {questions.length}
        </p>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          aria-label="Skip"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="font-display text-base font-semibold tracking-tight mb-4">{q.text}</p>
      <div className="flex flex-wrap gap-2">
        {q.options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => pick(q.key, opt.value)}
            className="rounded-full border border-border bg-muted/40 px-5 py-2.5 font-body text-sm font-medium text-foreground hover:border-primary/50 hover:bg-primary/10 transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>
      {/* Progress dots */}
      <div className="flex gap-1 mt-4">
        {questions.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${i + 1 < step ? "w-4 bg-primary" : i + 1 === step ? "w-4 bg-primary/60" : "w-1.5 bg-border"}`}
          />
        ))}
      </div>
    </div>
  );
}

function BetaBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("pomBetaBannerDismissed") === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem("pomBetaBannerDismissed", "1");
    } catch {}
    setDismissed(true);
  }

  return (
    <div className="mx-5 mt-2 sm:mx-6">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-2.5">
          <p className="font-body text-xs text-foreground/80 leading-snug">
            This is a beta version of Peace of Mine — your feedback helps us improve.
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
