import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BellRing, CalendarClock, Check, Loader2, Share2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import "@fontsource/cormorant/300.css";
import "@fontsource/cormorant/300-italic.css";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { shareLink } from "@/lib/nativeFeatures";
import {
  WAITLIST_COUNT_MIN_TO_SHOW,
  WAITLIST_STAGES,
  fetchWaitlistCount,
  joinWaitlist,
  type WaitlistClient,
  type WaitlistStage,
} from "@/lib/waitlist";
import catCarseat from "@/assets/hd-carseat.png";
import catCrib from "@/assets/hd-crib.png";
import catStroller from "@/assets/hd-stroller.png";
import catPacifier from "@/assets/hd-pacifier.png";

const PAGE_URL = "https://peace-of-mine.lovable.app/waitlist";
const TITLE = "Join the waitlist — Peace of Mine";
const DESCRIPTION =
  "Peace of Mine is coming to the App Store: baby gear and milestone tracking, expiration reminders and recall alerts. Join the waitlist to be first in line.";

export const Route = createFileRoute("/waitlist")({
  component: WaitlistPage,
  validateSearch: (s: Record<string, unknown>): { ref?: string } => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
  }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Peace of Mine is almost here ✨" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: PAGE_URL },
      { name: "twitter:title", content: "Peace of Mine is almost here ✨" },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
});

// The generated database types don't include the waitlist table yet.
const waitlistClient = () => supabase as unknown as WaitlistClient;

const PREVIEW = [
  { name: "Car seats", image: catCarseat },
  { name: "Cribs", image: catCrib },
  { name: "Strollers", image: catStroller },
  { name: "Pacifiers", image: catPacifier, scale: "scale-[0.78]" },
];

const BENEFITS = [
  {
    icon: BellRing,
    title: "Recall alerts",
    text: "Know if something you own turns up in an official recall database.",
  },
  {
    icon: CalendarClock,
    title: "Expiration reminders",
    text: "Car seats expire. We'll remind you before yours does.",
  },
  {
    icon: ShieldCheck,
    title: "Milestone-aware tips",
    text: "Safety suggestions timed to what your little one is actually doing.",
  },
];

const serif = {
  fontFamily: "'Cormorant', Georgia, serif",
  fontWeight: 300,
  color: "#2B2927",
} as const;

function WaitlistPage() {
  const { ref } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [stage, setStage] = useState<WaitlistStage | "">("");
  const [consented, setConsented] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    void fetchWaitlistCount(waitlistClient()).then(setCount);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await joinWaitlist(waitlistClient(), {
        email,
        firstName,
        stage,
        source: ref,
        consented,
        honeypot,
      });
      if (result.ok) {
        setJoined(true);
        setCount((n) => (n === null ? n : n + 1));
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("We couldn't add you just now. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShare() {
    const shared = await shareLink({
      title: "Peace of Mine",
      text: "This baby-safety app is launching soon. Join the waitlist with me!",
      url: PAGE_URL,
    });
    if (shared) return;
    try {
      await navigator.clipboard.writeText(PAGE_URL);
      toast.success("Link copied, ready to paste!");
    } catch {
      toast.message(PAGE_URL);
    }
  }

  const showCount = count !== null && count >= WAITLIST_COUNT_MIN_TO_SHOW;
  const input =
    "w-full rounded-2xl border border-border/70 bg-background/60 px-4 py-3 font-body text-base text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <main className="min-h-screen px-4 pb-16 pt-8 sm:px-6">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <Logo size="sm" />

        <p
          className="mt-10 font-body text-[11px] font-semibold tracking-[0.2em] text-primary"
          style={{ textTransform: "uppercase" }}
        >
          Coming soon to the App Store
        </p>
        <h1 style={serif} className="mt-4 text-5xl leading-[1.05] sm:text-6xl">
          Baby safety, <em style={{ fontStyle: "italic", color: "#586C81" }}>finally</em> simple.
        </h1>
        <p
          style={{ color: "#605C58" }}
          className="mt-6 max-w-md font-body text-base leading-relaxed"
        >
          Track your baby's gear and milestones, get reminded before a car seat expires or it's time
          to size up, and get notified if something you own is recalled.
        </p>

        <div className="mt-8 flex justify-center gap-3" aria-hidden="true">
          {PREVIEW.map((p) => (
            <div
              key={p.name}
              className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#F5F1E8] p-3 sm:h-20 sm:w-20"
            >
              <img
                src={p.image}
                alt=""
                width={512}
                height={512}
                className={`h-full w-full object-contain ${p.scale ?? ""}`}
              />
            </div>
          ))}
        </div>

        <div className="mt-10 w-full rounded-[2rem] border border-border/60 bg-card/90 p-6 text-left shadow-[0_20px_60px_-30px_rgba(180,120,90,0.35)] sm:p-8">
          {joined ? (
            <div className="text-center" role="status">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <h2 style={serif} className="mt-4 text-3xl">
                You're on the list!
              </h2>
              <p className="mt-2 font-body text-sm text-muted-foreground">
                We'll email you the moment Peace of Mine is in the App Store. Know a parent who'd
                love it?
              </p>
              <button
                type="button"
                onClick={handleShare}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-body text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
              >
                <Share2 className="h-4 w-4" />
                Share the waitlist
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <h2 style={serif} className="text-center text-3xl">
                Be first in line
              </h2>
              {showCount && (
                <p className="text-center font-body text-sm text-muted-foreground">
                  Join {count.toLocaleString()} parents already waiting
                </p>
              )}
              <label className="sr-only" htmlFor="wl-email">
                Email
              </label>
              <input
                id="wl-email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${input} mt-2`}
              />
              <label className="sr-only" htmlFor="wl-name">
                First name (optional)
              </label>
              <input
                id="wl-name"
                type="text"
                autoComplete="given-name"
                placeholder="First name (optional)"
                maxLength={80}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={input}
              />
              <label className="sr-only" htmlFor="wl-stage">
                Baby's stage (optional)
              </label>
              <select
                id="wl-stage"
                value={stage}
                onChange={(e) => setStage(e.target.value as WaitlistStage | "")}
                className={`${input} ${stage ? "" : "text-muted-foreground/70"}`}
              >
                <option value="">Baby's stage (optional)</option>
                {WAITLIST_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              {/* Honeypot: hidden from people, tempting to bots. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="wl-website">Website</label>
                <input
                  id="wl-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 pt-1 font-body text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  required
                  checked={consented}
                  onChange={(e) => setConsented(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span>
                  Email me when Peace of Mine launches. No spam, unsubscribe anytime. See our{" "}
                  <a href="/privacy-policy" className="underline hover:text-foreground">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 font-body text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Join the waitlist
              </button>
            </form>
          )}
        </div>

        <ul className="mt-12 grid w-full gap-6 text-left sm:grid-cols-3 sm:gap-4">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3 sm:flex-col sm:gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </span>
              <span>
                <span className="block font-body text-sm font-semibold text-foreground">
                  {title}
                </span>
                <span className="block font-body text-sm leading-relaxed text-muted-foreground">
                  {text}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-12 max-w-md font-body text-[11px] leading-relaxed text-muted-foreground/70">
          Peace of Mine is an informational organization tool, not a medical device. Recall
          monitoring is best-effort and doesn't guarantee a product is safe.
        </p>
      </div>
    </main>
  );
}
