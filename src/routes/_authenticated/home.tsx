import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Calendar, ChevronDown, ChevronUp, Gift, Loader2, Package, Plus, Radio, RefreshCw, Ruler, Sparkles, Sun, Zap, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { MomentTimeline } from "@/components/MomentTimeline";
import { SparkleIllustration } from "@/components/EmptyIllustration";
import { BottomNav } from "@/components/BottomNav";
import { ChildSwitcher } from "@/components/ChildSwitcher";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { evaluateInsights, type Insight, type ProductInput } from "@/lib/insights";
import { friendlyError } from "@/lib/errors";
import { isBabyRelated, fetchFdaBabyRecallCount, type CpscRecall } from "@/lib/cpscSearch";
import { checkCriticalRecalls } from "@/lib/recallCheck";
import { selectWeeklyTip, getIsoWeekNumber, weekKey as getTipWeekKey } from "@/lib/safetyTips";
import { getDevelopmentBand } from "@/lib/developmentContent";
import { CheckCircle2, ShieldCheck } from "lucide-react";


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
  type: "replace" | "sizeup";
};

// ── Weekly digest helpers ───────────────────────────────────────────────────
function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function isSunday() { return new Date().getDay() === 0; }

function ageSafetyTip(dobStr: string | null): string {
  if (!dobStr) return "Always place your baby on their back for every sleep — it's the single most important safe sleep rule.";
  const birth = new Date(dobStr + "T00:00:00");
  const months = Math.max(0, (new Date().getFullYear() - birth.getFullYear()) * 12 + (new Date().getMonth() - birth.getMonth()));
  if (months < 4) return "Firm, flat, empty crib — no pillows, bumpers, or loose blankets. Back to sleep, every time.";
  if (months < 8) return "Before your baby can push up on all fours, lower the crib mattress to the next setting.";
  if (months < 13) return "Install hardware-mounted gates at the top of every staircase before they start crawling.";
  if (months < 24) return "Anchor every bookshelf, dresser, and TV stand to the wall — toddlers pull on everything.";
  if (months < 36) return "Keep cleaning products and laundry pods in a locked cabinet or on the highest shelf.";
  return "Put a properly fitted helmet on your child for every bike, scooter, or balance bike ride — no exceptions.";
}

function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function calcAge(dob: string | null): { label: string; subtitle: string } {
  if (!dob) return { label: "Little one", subtitle: "Add birth date in profile" };
  const birth = parseDateLocal(dob);
  const days = Math.max(0, Math.floor((Date.now() - birth.getTime()) / 86400000));
  const weeks = Math.floor(days / 7);
  if (weeks < 12) return { label: `${weeks} ${weeks === 1 ? "week" : "weeks"} old`, subtitle: `${days} days of wonder` };
  const months = Math.floor(days / 30.44);
  if (months < 24) return { label: `${months} ${months === 1 ? "month" : "months"} old`, subtitle: `${weeks} weeks together` };
  const years = Math.floor(months / 12);
  return { label: `${years}y ${months % 12}m old`, subtitle: `${months} months together` };
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

// ── What's New ──────────────────────────────────────────────────────────────
const WHATS_NEW = [
  {
    version: "v1.4",
    date: "June 2025",
    updates: [
      "Recall Radar: live CPSC baby recall count right on your home screen",
      "Hand-Me-Down Checker catches expired and recalled second-hand gear before you use it",
      "Travel Safety Mode — a full 30-item checklist for traveling with baby",
    ],
  },
  {
    version: "v1.3",
    date: "May 2025",
    updates: [
      "Age jump alerts when your baby crosses a milestone — with relevant safety actions",
      "Gift Registry Safety Check: paste any URL to check for recalls before adding to your list",
      "Haptic feedback and smoother entrance animations throughout",
    ],
  },
];

const LATEST_VERSION = WHATS_NEW[0].version;

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
    try { return localStorage.getItem(`safesound.whatsNew.${LATEST_VERSION}`) === "true"; } catch { return false; }
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
  const [tipCompleted, setTipCompleted] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);

  // Age jump alert
  const [ageJumpDismissed, setAgeJumpDismissed] = useState(false);

  // Weekly digest: show on Sundays, dismiss per-week
  const currentWeekKey = isoWeekKey();
  const [digestDismissed, setDigestDismissed] = useState(() => {
    try { return localStorage.getItem(`safesound.weeklyDigest.${currentWeekKey}`) === "true"; } catch { return false; }
  });

  // Recall banner dismiss (resets daily)
  const [recallBannerDismissed, setRecallBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem(`safesound.recallBannerDismissed.${todayKey()}`) === "true";
    } catch { return false; }
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
    in_daycare: boolean;
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
  const [hpStep, setHpStep] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0);

  // Track app open once per session
  useEffect(() => { trackEvent("app_opened"); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let activeId: string | null = null;
      try { activeId = localStorage.getItem('safesound.activeChildId'); } catch {}
      const { data: kids, error } = await supabase
        .from("children")
        .select("id, name, date_of_birth, height_inches, weight_lbs, measurements_updated_at")
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) { toast.error(friendlyError(error.message)); setLoading(false); return; }
      if (!kids || kids.length === 0) { navigate({ to: "/onboarding" }); return; }
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

      const [mRes, recallRes, replaceRes, sizeRes, productRes, dismRes, comingUpRes] = await Promise.all([
        supabase.from("milestones").select("id, title, logged_at, notes").eq("child_id", c.id).order("logged_at", { ascending: false }).limit(5),
        supabase.from("product_recalls").select("id", { count: "exact", head: true }).eq("acknowledged", false),
        supabase.from("products").select("id", { count: "exact", head: true }).gte("replace_at", todayStr).lte("replace_at", horizon30Str),
        supabase.from("products").select("id", { count: "exact", head: true }).gte("next_size_at", todayStr).lte("next_size_at", horizon30Str),
        supabase.from("products").select("id, category, purchased_at, size").or(`child_id.eq.${c.id},child_id.is.null`),
        supabase.from("insight_dismissals").select("rule_id, action, until").eq("child_id", c.id),
        supabase.from("products").select("id, name, brand, replace_at, next_size_at, predicted_replacement_date, predicted_sizeup_date")
          .or(`replace_at.gte.${todayStr},next_size_at.gte.${todayStr},predicted_replacement_date.gte.${todayStr},predicted_sizeup_date.gte.${todayStr}`)
          .lte("replace_at", horizon90Str),
      ]);

      if (cancelled) return;
      if (mRes.data) setMoments(mRes.data as Moment[]);
      setAlerts({
        recalls: recallRes.count ?? 0,
        replace: replaceRes.count ?? 0,
        sizeUp: sizeRes.count ?? 0,
      });
      setProducts((productRes.data ?? []) as ProductInput[]);

      // Build coming-up list: pick the earliest date per product, sort, take top 3
      if (comingUpRes.data) {
        type Raw = { id: string; name: string; brand: string | null; replace_at: string | null; next_size_at: string | null; predicted_replacement_date: string | null; predicted_sizeup_date: string | null };
        const items: ComingUpProduct[] = [];
        for (const p of comingUpRes.data as Raw[]) {
          const replaceDate = p.predicted_replacement_date ?? p.replace_at;
          const sizeDate = p.predicted_sizeup_date ?? p.next_size_at;
          if (replaceDate && replaceDate >= todayStr && replaceDate <= horizon90Str) {
            items.push({ id: `replace:${p.id}`, name: p.name, brand: p.brand, when: replaceDate, type: "replace" });
          }
          if (sizeDate && sizeDate >= todayStr && sizeDate <= horizon90Str) {
            items.push({ id: `sizeup:${p.id}`, name: p.name, brand: p.brand, when: sizeDate, type: "sizeup" });
          }
        }
        items.sort((a, b) => a.when.localeCompare(b.when));
        setComingUp(items.slice(0, 3));
      }
      const blocked = new Set<string>();
      for (const d of (dismRes.data ?? []) as { rule_id: string; action: string; until: string | null }[]) {
        if (d.action === 'done' || d.action === 'dismissed') blocked.add(d.rule_id);
        else if (d.action === 'snoozed' && d.until && d.until > nowIso) blocked.add(d.rule_id);
      }
      setDismissedIds(blocked);

      // Load home profile
      try {
        const { data: { session: sess2 } } = await supabase.auth.getSession();
        if (sess2?.user) {
          const { data: hp } = await (supabase as any)
            .from("home_profile")
            .select("has_stairs, home_type, has_pet, has_car, in_daycare, has_pool")
            .eq("user_id", sess2.user.id)
            .maybeSingle();
          if (hp) {
            setHomeProfile(hp as HomeProfile);
            // If we have a profile, mark setup done
            try { localStorage.setItem("safesound.homeProfileSetup", "done"); } catch {}
            setHomeProfileSetup("done");
          }
        }
      } catch {}

      // Load notification preferences
      try {
        const { data: { session: sess } } = await supabase.auth.getSession();
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
    return () => { cancelled = true; };
  }, [navigate]);

  // Re-fetch moments when tab regains visibility (e.g. returning from /moments/new)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      supabase.from("milestones")
        .select("id, title, logged_at, notes")
        .eq("child_id", (child as any)?.id)
        .order("logged_at", { ascending: false })
        .limit(5)
        .then(({ data }) => { if (data) setMoments(data as Moment[]); });
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
        const { data } = await (supabase as any)
          .from("products")
          .select("id, name, recalled");
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
              { onConflict: "source,source_id" }
            )
            .select("id")
            .single();
          const recallId = (catalogEntry as { id: string } | null)?.id;
          if (recallId) {
            await (supabase as any)
              .from("product_recalls")
              .upsert({ product_id: p.id, recall_id: recallId, acknowledged: false }, { onConflict: "product_id,recall_id" });
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
  const upNext: Insight[] = useMemo(() => {
    const all = evaluateInsights(child, products);
    return all.filter((i) => !dismissedIds.has(i.id)).slice(0, 3);
  }, [child, products, dismissedIds]);

  // Show measurements reminder if measurements_updated_at is null or > 28 days ago
  const showMeasReminder = useMemo(() => {
    if (!child || measReminderDismissed) return false;
    if (!child.measurements_updated_at) return true;
    const updatedAt = new Date(child.measurements_updated_at).getTime();
    const twentyEightDaysAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;
    return updatedAt < twentyEightDaysAgo;
  }, [child, measReminderDismissed]);

  async function dismissInsight(insightId: string) {
    if (!child) return;
    setDismissedIds((prev) => new Set([...prev, insightId]));
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      if (!sess?.user) return;
      await (supabase as any).from("insight_dismissals").upsert({
        user_id: sess.user.id,
        child_id: child.id,
        rule_id: insightId,
        action: "dismissed",
        until: null,
      }, { onConflict: "child_id,rule_id" });
    } catch {}
  }

  async function snoozeInsight(insightId: string) {
    if (!child) return;
    setDismissedIds((prev) => new Set([...prev, insightId]));
    const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      if (!sess?.user) return;
      await (supabase as any).from("insight_dismissals").upsert({
        user_id: sess.user.id,
        child_id: child.id,
        rule_id: insightId,
        action: "snoozed",
        until,
      }, { onConflict: "child_id,rule_id" });
    } catch {}
  }

  function dismissRecallBanner() {
    try { localStorage.setItem(`safesound.recallBannerDismissed.${todayKey()}`, "true"); } catch {}
    setRecallBannerDismissed(true);
  }

  function dismissDigest() {
    try { localStorage.setItem(`safesound.weeklyDigest.${currentWeekKey}`, "true"); } catch {}
    setDigestDismissed(true);
  }

  function dismissWhatsNew() {
    try { localStorage.setItem(`safesound.whatsNew.${LATEST_VERSION}`, "true"); } catch {}
    setWhatsNewDismissed(true);
  }

  function dismissAgeJump() {
    if (!child || !recentMilestone) return;
    try { localStorage.setItem(`safesound.ageJump.${child.id}.${recentMilestone.months}`, "1"); } catch {}
    setAgeJumpDismissed(true);
  }

  async function markTipDone() {
    setTipCompleted(true);
    setTipSuccess(true);
    setTimeout(() => setTipSuccess(false), 3000);
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      if (!sess?.user) return;
      const wk = getTipWeekKey();
      const tip = child ? selectWeeklyTip(
        Math.floor((Date.now() - new Date(child.date_of_birth ?? new Date().toISOString()).getTime()) / (30.44 * 86400000)),
        getIsoWeekNumber(),
      ) : null;
      await (supabase as any).from("completed_tips").upsert({
        user_id: sess.user.id,
        child_id: child?.id ?? null,
        tip_id: tip?.id ?? "unknown",
        week_key: wk,
      }, { onConflict: "user_id,week_key" });
    } catch {}
  }

  function dismissMeasReminder() {
    if (!child) return;
    try {
      localStorage.setItem(`safesound.measReminderDismissed.${child.id}`, JSON.stringify({ ts: Date.now() }));
    } catch {}
    setMeasReminderDismissed(true);
  }

  // Recall Radar: fetch 30-day CPSC baby recall count, cached daily
  useEffect(() => {
    const key = `safesound.recallRadar.${todayKey()}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached !== null) { setRecallRadarCount(parseInt(cached, 10)); return; }
    } catch {}
    const start30 = new Date();
    start30.setDate(start30.getDate() - 30);
    const startStr = start30.toISOString().slice(0, 10);
    fetch(`https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=${startStr}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: CpscRecall[]) => {
        const count = (Array.isArray(data) ? data : []).filter(isBabyRelated).length;
        try { localStorage.setItem(key, String(count)); } catch {}
        setRecallRadarCount(count);
      })
      .catch(() => setRecallRadarCount(-1));
  }, []);

  // FDA recall count — fetched daily, cached per day
  useEffect(() => {
    const key = `safesound.fdaRecalls.${todayKey()}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached !== null) { setFdaRecallCount(parseInt(cached, 10)); return; }
    } catch {}
    fetchFdaBabyRecallCount(30)
      .then((count) => {
        try { localStorage.setItem(key, String(count)); } catch {}
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
  const showBottleWeaning = !bottleWeaningDismissed && ageMonthsForBottle >= 12 && ageMonthsForBottle <= 15;

  function dismissBottleWeaning() {
    if (!child) return;
    try { localStorage.setItem(`safesound.bottleWeaning.${child.id}`, "true"); } catch {}
    setBottleWeaningDismissed(true);
  }

  async function saveHomeProfile(answers: HomeProfile) {
    setHomeProfile(answers);
    setHomeProfileSetup("done");
    try { localStorage.setItem("safesound.homeProfileSetup", "done"); } catch {}
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      if (!sess?.user) return;
      await (supabase as any).from("home_profile").upsert({
        user_id: sess.user.id,
        ...answers,
      }, { onConflict: "user_id" });
    } catch {}
  }

  function skipHomeProfile() {
    setHomeProfileSetup("skipped");
    try { localStorage.setItem("safesound.homeProfileSetup", "skipped"); } catch {}
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
      <header className="px-5 pt-10 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo /></div>
            <div className="flex items-center gap-2">
              <ChildSwitcher />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-body text-[11px] font-medium text-muted-foreground shadow-sm">
                <Sparkles className="h-3 w-3 text-accent" />
                {totalAlerts === 0 ? "All quiet" : `${totalAlerts} to look at`}
              </span>
            </div>
          </div>

          <p className="font-body text-sm font-medium uppercase tracking-[0.2em] text-accent">
            {greeting()}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
            {child?.name}
          </h1>
          <p className="mt-2 font-body text-base text-muted-foreground">
            {age.label} · <span className="text-foreground/70">{age.subtitle}</span>
          </p>
          <p
            className="mt-4 text-[10px] font-medium tracking-[0.12em] text-muted-foreground/50"
            style={{ fontFamily: '"DM Sans", system-ui, sans-serif', textTransform: "uppercase" }}
          >
            Safety guidelines based on AAP and CPSC recommendations
          </p>
        </div>
      </header>

      <BetaBanner />

      {/* Home Personalization Setup — one-time, shown after onboarding */}
      {homeProfileSetup === "pending" && child && (
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

      {/* Today Section — day-of-week rotating card */}
      <div className="px-5 pt-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <TodayCard
            child={child}
            comingUp={comingUp}
            cpscCount={recallRadarCount}
            fdaCount={fdaRecallCount}
            showMeasReminder={showMeasReminder}
            recalls={alerts.recalls}
            safetyTip={ageSafetyTip(child?.date_of_birth ?? null)}
            onNavigate={navigate}
          />
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
                <p className="font-body text-xs font-semibold uppercase tracking-wider text-[#4A7A47] mb-1">A gentle heads-up</p>
                <p className="font-body text-sm leading-snug text-foreground/80">
                  Many pediatric dentists suggest beginning to transition away from bottle use around 12 to 15 months to support healthy tooth development — every child is different so check with your own dentist or pediatrician about what feels right for your family.
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
                ⚠️ {alerts.recalls} recall{alerts.recalls > 1 ? "s" : ""} affecting your products — tap to review
              </span>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); dismissRecallBanner(); }}
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
                  Time to update {child.name}'s measurements — keeping them current helps predict the right size-ups.
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
                homeProfile?.has_stairs === false
                  ? !/stair|gate/i.test(a)
                  : true
              )}
              onDismiss={dismissAgeJump}
            />
          </div>
        </div>
      )}

      {/* Recall Radar — live 30-day CPSC count */}
      {recallRadarCount !== null && recallRadarCount !== -1 && (
        <div className="px-5 pt-3 sm:px-6">
          <div className="mx-auto max-w-md">
            <RecallRadarCard count={recallRadarCount} />
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
                <p className="font-body text-sm font-semibold text-foreground">Pool alarm recommended</p>
                <p className="mt-0.5 font-body text-xs leading-relaxed text-muted-foreground">
                  Since you have a pool, the AAP recommends a pool alarm as a secondary layer of protection alongside a four-sided fence. Alarms can alert you if a child enters the water unexpectedly.
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
                <p className="font-display text-base font-semibold tracking-tight">Nothing to do today 🌙</p>
                <p className="mt-0.5 font-body text-xs text-muted-foreground">
                  We'll only ping you about recalls, replacements, and size-ups.
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
              <SummaryTile icon={RefreshCw} count={alerts.replace} label="Replace" />
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
                <p className="font-display text-sm font-semibold tracking-tight">Up next for {child?.name}</p>
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
            <MomentTimeline moments={moments} childName={child?.name} childDob={child?.date_of_birth} />
          )}
        </div>
      </section>

      <BottomNav />
    </div>
  );
}

function InsightCard({ insight, onDismiss, onSnooze }: { insight: Insight; onDismiss: () => void; onSnooze: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = insight.body.length > 100;
  return (
    <li className="rounded-2xl bg-muted/40 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-body text-sm font-medium leading-snug">{insight.title}</p>
        <span className={
          insight.urgency === 'now'
            ? "shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 font-body text-[10px] font-semibold uppercase text-destructive"
            : insight.urgency === 'soon'
              ? "shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 font-body text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400"
              : "shrink-0 rounded-full bg-sand/60 px-2 py-0.5 font-body text-[10px] font-semibold uppercase text-accent"
        }>
          {insight.urgency === 'heads_up' ? 'FYI' : insight.urgency}
        </span>
      </div>
      <p className={`mt-1 font-body text-xs text-muted-foreground ${!expanded && isLong ? "line-clamp-2" : ""}`}>{insight.body}</p>
      <div className="mt-2 flex items-center gap-2">
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex items-center gap-0.5 font-body text-[11px] font-semibold text-accent/80 hover:underline"
          >
            {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show more</>}
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
      <p className="font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
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
            <p className="font-display text-sm font-semibold tracking-tight">This week for {childName}</p>
            <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">Weekly digest</p>
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
              <span className="font-semibold text-destructive">{recalls} active recall{recalls > 1 ? "s" : ""}</span> — check the Alerts tab.
            </p>
          </li>
        ) : (
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-sm">✅</span>
            <p className="font-body text-sm text-foreground">No new recalls this week — all clear.</p>
          </li>
        )}
        {comingUp.length > 0 ? (
          <li className="flex items-start gap-2">
            <p className="font-body text-sm text-foreground">
              It may be time to take a look at {comingUp[0].name}{comingUp.length > 1 ? ` and ${comingUp.length - 1} other product${comingUp.length - 1 > 1 ? "s" : ""}` : ""} — {comingUp.length > 1 ? "they" : "it"} could be due for a refresh soon.
            </p>
          </li>
        ) : (
          <li className="flex items-start gap-2">
            <p className="font-body text-sm text-foreground">No replacements or size-ups due in the next 90 days.</p>
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
            <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">{latest.version} · {latest.date}</p>
          </div>
        </div>
        <button type="button" onClick={onDismiss}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Dismiss">
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
          <button type="button" onClick={() => setExpanded((e) => !e)}
            className="mt-2 inline-flex items-center gap-1 font-body text-xs font-semibold text-primary/70 hover:underline">
            {expanded ? <><ChevronUp className="h-3 w-3" /> Hide older updates</> : <><ChevronDown className="h-3 w-3" /> See older updates</>}
          </button>
          {expanded && updates.slice(1).map((rel) => (
            <div key={rel.version} className="mt-3 border-t border-border/30 pt-3">
              <p className="mb-1.5 font-body text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{rel.version} · {rel.date}</p>
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
  const label = months < 12
    ? `${months} months`
    : months === 12 ? "1 year" : `${months} months`;
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
            <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">Here's what to check now</p>
          </div>
        </div>
        <button type="button" onClick={onDismiss}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Dismiss">
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

function RecallRadarCard({ count }: { count: number }) {
  return (
    <Link
      to="/recall-radar"
      className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3.5 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${count > 0 ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
          <Radio className="h-4 w-4" />
        </span>
        <div>
          <p className="font-body text-sm font-semibold">
            {count > 0
              ? `${count} baby product recall${count > 1 ? "s" : ""} this month`
              : "No new baby recalls this month"}
          </p>
          <p className="font-body text-[11px] text-muted-foreground">
            Recall Radar · last 30 days · tap to browse
          </p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

// ── Today card ──────────────────────────────────────────────────────────────

function weekendReminder(dobStr: string | null): string {
  if (!dobStr) return "Weekends are a great time for a quick home safety walk-through — five minutes, room by room.";
  const birth = parseDateLocal(dobStr);
  const months = Math.max(0, Math.floor((Date.now() - birth.getTime()) / (30.44 * 86400000)));
  if (months < 6) return "If you're heading out this weekend, double-check that the car seat is rear-facing and installed at the correct angle.";
  if (months < 12) return "Planning an outing? Babies over 6 months need SPF 30+ sunscreen on exposed skin — and it's always worth packing more wipes than you think you'll need.";
  if (months < 18) return "Visiting family or friends this weekend? A quick baby-proofing scan of the space — stairs, cabinets, small objects at floor level — takes about two minutes.";
  if (months < 30) return "Any outdoor time this weekend means helmet time for balance bikes or ride-ons — the habit is much easier to build before they're old enough to argue about it.";
  return "If you're planning outdoor play this weekend, sunscreen, water, and shade are the essentials — toddlers dehydrate faster than adults.";
}

type TodayCardProps = {
  child: Child | null;
  comingUp: ComingUpProduct[];
  cpscCount: number | null;
  fdaCount: number | null;
  showMeasReminder: boolean;
  recalls: number;
  safetyTip: string;
  onNavigate: ReturnType<typeof useNavigate>;
};

function TodayCard({ child, comingUp, cpscCount, fdaCount, showMeasReminder, recalls, safetyTip, onNavigate }: TodayCardProps) {
  const day = new Date().getDay(); // 0=Sun … 6=Sat
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = DAY_NAMES[day];

  const cardBase: React.CSSProperties = {
    borderRadius: 20,
    backgroundColor: "#5C6355",
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "24px",
  };
  const label = (
    <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      Today · {dayName}
    </p>
  );

  // No child
  if (!child) {
    return (
      <div style={cardBase}>
        {label}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>👶</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.95)", margin: 0 }}>Add your first child to get started</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>Peace of Mine personalises every tip, alert, and insight to your baby's age.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate({ to: "/onboarding" })}
          style={{ marginTop: 12, padding: "8px 18px", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.9)", color: "#5C6355", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
        >
          Add a child →
        </button>
      </div>
    );
  }

  const ageWeeks = Math.floor(Math.max(0, Date.now() - parseDateLocal(child.date_of_birth ?? "").getTime()) / (7 * 86400000));
  const devBand = getDevelopmentBand(ageWeeks);

  // Sunday: week-in-review snapshot (no separate "this week" section)
  if (day === 0) {
    return (
      <div style={cardBase}>
        {label}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 22, marginTop: 2 }}>✨</span>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.55)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.10em", fontFamily: '"DM Sans", system-ui, sans-serif' }}>Week in review</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
              <li style={{ fontSize: 13, color: "rgba(255,255,255,0.88)" }}>{recalls > 0 ? `⚠️ ${recalls} active recall${recalls > 1 ? "s" : ""} — check the Alerts tab` : "✅ No recalls affecting your products this week"}</li>
              {comingUp.length > 0 && (
                <li style={{ fontSize: 13, color: "rgba(255,255,255,0.88)" }}>It may be time to take a look at {comingUp[0].name} soon</li>
              )}
              <li style={{ fontSize: 13, color: "rgba(255,255,255,0.88)" }}>🛡️ {safetyTip}</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Monday: development observation
  if (day === 1) {
    return (
      <div style={cardBase}>
        {label}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 22, marginTop: 2 }}>🌱</span>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.55)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.10em", fontFamily: '"DM Sans", system-ui, sans-serif' }}>Development this week</p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.92)", lineHeight: 1.6, margin: 0 }}>{devBand.physical}</p>
          </div>
        </div>
        {comingUp.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.14)" }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
              Coming up for {child?.name ?? "your little one"}
            </p>
            {comingUp.slice(0, 3).map((p) => {
              const days = Math.round((new Date(p.when + "T00:00:00").getTime() - Date.now()) / 86400000);
              const timeLabel = days <= 0 ? "today" : days === 1 ? "tomorrow" : days < 14 ? `in ${days} days` : `in about ${Math.round(days / 7)} weeks`;
              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.90)", margin: 0 }}>
                    {p.type === "replace"
                      ? `It may be time to replace ${p.name} soon`
                      : `${p.name} might be ready for a size-up`}
                  </p>
                  <span style={{ fontSize: 11, color: days <= 7 ? "#FF9D8C" : days <= 21 ? "#FFD095" : "rgba(255,255,255,0.8)", fontWeight: 600, marginLeft: 8, whiteSpace: "nowrap" }}>{timeLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Tuesday: age-relevant safety tip
  if (day === 2) {
    return (
      <div style={cardBase}>
        {label}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 22, marginTop: 2 }}>🛡️</span>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.55)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.10em", fontFamily: '"DM Sans", system-ui, sans-serif' }}>Quick safety tip</p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.92)", lineHeight: 1.6, margin: 0 }}>{safetyTip}</p>
          </div>
        </div>
        {comingUp.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.14)" }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
              Coming up for {child?.name ?? "your little one"}
            </p>
            {comingUp.slice(0, 3).map((p) => {
              const days = Math.round((new Date(p.when + "T00:00:00").getTime() - Date.now()) / 86400000);
              const timeLabel = days <= 0 ? "today" : days === 1 ? "tomorrow" : days < 14 ? `in ${days} days` : `in about ${Math.round(days / 7)} weeks`;
              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.90)", margin: 0 }}>
                    {p.type === "replace"
                      ? `It may be time to replace ${p.name} soon`
                      : `${p.name} might be ready for a size-up`}
                  </p>
                  <span style={{ fontSize: 11, color: days <= 7 ? "#FF9D8C" : days <= 21 ? "#FFD095" : "rgba(255,255,255,0.8)", fontWeight: 600, marginLeft: 8, whiteSpace: "nowrap" }}>{timeLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Wednesday: combined CPSC + FDA recall count
  if (day === 3) {
    const cpsc = cpscCount ?? 0;
    const fda = fdaCount ?? 0;
    const total = cpsc + fda;
    const loading = cpscCount === null || fdaCount === null;
    return (
      <button
        type="button"
        onClick={() => onNavigate({ to: "/recall-radar" })}
        style={{ ...cardBase, backgroundColor: total > 0 ? "#C8523A" : "#5C6355", width: "100%", textAlign: "left", cursor: "pointer" }}
      >
        {label}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 22, marginTop: 2 }}>📡</span>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.55)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.10em", fontFamily: '"DM Sans", system-ui, sans-serif' }}>Recall Radar · last 30 days</p>
            {loading ? (
              <p style={{ fontSize: 14, color: "#8A8078", margin: 0 }}>Checking CPSC and FDA databases…</p>
            ) : (
              <>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.95)", fontWeight: 600, margin: "0 0 2px" }}>
                  {total === 0 ? "No baby or infant product recalls this month" : `${total} baby & infant recall${total > 1 ? "s" : ""} this month`}
                </p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0 }}>{cpsc} consumer products (CPSC) · {fda} food & formula (FDA) · tap to browse</p>
              </>
            )}
          </div>
        </div>
        {comingUp.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.14)" }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
              Coming up for {child?.name ?? "your little one"}
            </p>
            {comingUp.slice(0, 3).map((p) => {
              const days = Math.round((new Date(p.when + "T00:00:00").getTime() - Date.now()) / 86400000);
              const timeLabel = days <= 0 ? "today" : days === 1 ? "tomorrow" : days < 14 ? `in ${days} days` : `in about ${Math.round(days / 7)} weeks`;
              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.90)", margin: 0 }}>
                    {p.type === "replace"
                      ? `It may be time to replace ${p.name} soon`
                      : `${p.name} might be ready for a size-up`}
                  </p>
                  <span style={{ fontSize: 11, color: days <= 7 ? "#FF9D8C" : days <= 21 ? "#FFD095" : "rgba(255,255,255,0.8)", fontWeight: 600, marginLeft: 8, whiteSpace: "nowrap" }}>{timeLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </button>
    );
  }

  // Thursday: next product closest to size-up or replacement
  if (day === 4) {
    const next = comingUp[0] ?? null;
    return (
      <div style={cardBase}>
        {label}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 22, marginTop: 2 }}>📅</span>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.55)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.10em", fontFamily: '"DM Sans", system-ui, sans-serif' }}>Coming up</p>
            {next ? (
              <>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.95)", fontWeight: 600, margin: "0 0 2px" }}>{next.name}</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0 }}>
                  {next.type === "replace" ? "Replacement" : "Size-up"} · {
                    (() => {
                      const d = Math.round((new Date(next.when + "T00:00:00").getTime() - Date.now()) / 86400000);
                      return d <= 0 ? "today" : d === 1 ? "tomorrow" : d < 14 ? `in ${d} days` : `in about ${Math.round(d / 7)} weeks`;
                    })()
                  }
                </p>
              </>
            ) : (
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.92)", margin: 0 }}>No size-ups or replacements coming up in the next 90 days.</p>
            )}
          </div>
        </div>
        {comingUp.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.14)" }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
              Coming up for {child?.name ?? "your little one"}
            </p>
            {comingUp.slice(0, 3).map((p) => {
              const days = Math.round((new Date(p.when + "T00:00:00").getTime() - Date.now()) / 86400000);
              const timeLabel = days <= 0 ? "today" : days === 1 ? "tomorrow" : days < 14 ? `in ${days} days` : `in about ${Math.round(days / 7)} weeks`;
              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.90)", margin: 0 }}>
                    {p.type === "replace"
                      ? `It may be time to replace ${p.name} soon`
                      : `${p.name} might be ready for a size-up`}
                  </p>
                  <span style={{ fontSize: 11, color: days <= 7 ? "#FF9D8C" : days <= 21 ? "#FFD095" : "rgba(255,255,255,0.8)", fontWeight: 600, marginLeft: 8, whiteSpace: "nowrap" }}>{timeLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Friday: weekend safety reminder
  if (day === 5) {
    return (
      <div style={cardBase}>
        {label}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 22, marginTop: 2 }}>🌤️</span>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.55)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.10em", fontFamily: '"DM Sans", system-ui, sans-serif' }}>Weekend heads-up</p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.92)", lineHeight: 1.6, margin: 0 }}>{weekendReminder(child.date_of_birth ?? null)}</p>
          </div>
        </div>
        {comingUp.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.14)" }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
              Coming up for {child?.name ?? "your little one"}
            </p>
            {comingUp.slice(0, 3).map((p) => {
              const days = Math.round((new Date(p.when + "T00:00:00").getTime() - Date.now()) / 86400000);
              const timeLabel = days <= 0 ? "today" : days === 1 ? "tomorrow" : days < 14 ? `in ${days} days` : `in about ${Math.round(days / 7)} weeks`;
              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.90)", margin: 0 }}>
                    {p.type === "replace"
                      ? `It may be time to replace ${p.name} soon`
                      : `${p.name} might be ready for a size-up`}
                  </p>
                  <span style={{ fontSize: 11, color: days <= 7 ? "#FF9D8C" : days <= 21 ? "#FFD095" : "rgba(255,255,255,0.8)", fontWeight: 600, marginLeft: 8, whiteSpace: "nowrap" }}>{timeLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Saturday: measurements update prompt
  return (
    <div style={cardBase}>
      {label}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 22, marginTop: 2 }}>📏</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.55)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.10em", fontFamily: '"DM Sans", system-ui, sans-serif' }}>Measurements check-in</p>
          {showMeasReminder ? (
            <>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.92)", lineHeight: 1.6, margin: "0 0 10px" }}>
                It's been a while since you updated {child.name}'s height and weight. Fresh measurements help predict size-ups more accurately.
              </p>
              <button
                type="button"
                onClick={() => onNavigate({ to: "/growth" })}
                style={{ padding: "7px 16px", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.9)", color: "#5C6355", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
              >
                Log measurements →
              </button>
            </>
          ) : (
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.92)", lineHeight: 1.6, margin: 0 }}>
              {child.name}'s measurements are up to date — nice work. We'll remind you again in about a month.
            </p>
          )}
        </div>
      </div>
      {comingUp.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.14)" }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
            Coming up for {child?.name ?? "your little one"}
          </p>
          {comingUp.slice(0, 3).map((p) => {
            const days = Math.round((new Date(p.when + "T00:00:00").getTime() - Date.now()) / 86400000);
            const timeLabel = days <= 0 ? "today" : days === 1 ? "tomorrow" : days < 14 ? `in ${days} days` : `in about ${Math.round(days / 7)} weeks`;
            return (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.90)", margin: 0 }}>
                  {p.type === "replace"
                    ? `It may be time to replace ${p.name} soon`
                    : `${p.name} might be ready for a size-up`}
                </p>
                <span style={{ fontSize: 11, color: days <= 7 ? "#FF9D8C" : days <= 21 ? "#FFD095" : "rgba(255,255,255,0.8)", fontWeight: 600, marginLeft: 8, whiteSpace: "nowrap" }}>{timeLabel}</span>
              </div>
            );
          })}
        </div>
      )}
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
      <p className="font-display text-lg font-semibold tracking-tight">Every first is worth remembering</p>
      <p className="mx-auto mt-1.5 max-w-xs font-body text-sm text-muted-foreground">
        Log a milestone and we'll surface safety tips that are actually relevant to where your child is right now.
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
type HomeProfileAnswers = {
  has_stairs: boolean;
  home_type: string;
  has_pet: boolean;
  has_car: boolean;
  in_daycare: boolean;
  has_pool: boolean;
};

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
    if (step === 5) {
      // Last question — save
      onSave({
        has_stairs: updated.has_stairs ?? false,
        home_type: updated.home_type ?? "Other",
        has_pet: updated.has_pet ?? false,
        has_car: updated.has_car ?? true,
        in_daycare: updated.in_daycare ?? false,
        has_pool: updated.has_pool ?? false,
      });
    }
  }

  const questions: { key: keyof HomeProfileAnswers; text: string; options: { label: string; value: boolean | string }[] }[] = [
    {
      key: "has_stairs",
      text: "Do you have stairs at home?",
      options: [{ label: "Yes", value: true }, { label: "No", value: false }],
    },
    {
      key: "home_type",
      text: "What type of home do you live in?",
      options: [{ label: "House", value: "house" }, { label: "Apartment", value: "apartment" }, { label: "Other", value: "other" }],
    },
    {
      key: "has_pet",
      text: "Do you have a pet?",
      options: [{ label: "Yes", value: true }, { label: "No", value: false }],
    },
    {
      key: "has_car",
      text: "Do you have a car?",
      options: [{ label: "Yes", value: true }, { label: "No", value: false }],
    },
    {
      key: "in_daycare",
      text: "Is your baby in daycare or cared for at home?",
      options: [{ label: "Daycare", value: true }, { label: "At home", value: false }],
    },
    {
      key: "has_pool",
      text: "Do you have a pool or spa at home?",
      options: [{ label: "Yes", value: true }, { label: "No", value: false }],
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
            <p className="font-display text-sm font-semibold tracking-tight">Help us personalise your reminders</p>
          </div>
          <button type="button" onClick={onSkip} className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Skip">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
          A few quick questions so we only show you the reminders that actually apply to your home and family — no forms, just taps.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="rounded-full font-body text-xs"
            onClick={() => onStep(1)}
          >
            Get started →
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full font-body text-xs text-muted-foreground" onClick={onSkip}>
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
        <button type="button" onClick={onSkip} className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Skip">
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
    try { return localStorage.getItem("pomBetaBannerDismissed") === "1"; } catch { return false; }
  });

  if (dismissed) return null;

  function dismiss() {
    try { localStorage.setItem("pomBetaBannerDismissed", "1"); } catch {}
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
