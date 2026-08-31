import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { CURRENT_TERMS_VERSION, markLegalConsentCleared } from "@/lib/legalConsent";
import { friendlyError, isColumnUnavailableError, isSchemaMissingTableError } from "@/lib/errors";
import { parseNextParam } from "@/lib/authCallbackRouting";
import { logError } from "@/lib/sanitize-error";

export const Route = createFileRoute("/legal-consent")({
  ssr: false,
  component: LegalConsentPage,
  head: () => ({
    meta: [{ title: "Please review — Peace of Mine" }],
  }),
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
});

function getNextParam(): string {
  if (typeof window === "undefined") return "/home";
  return parseNextParam(new URLSearchParams(window.location.search).get("next")) ?? "/home";
}

const ACKNOWLEDGMENTS = [
  "Peace of Mine is intended for use by adults 18 years of age or older only.",
  "Peace of Mine is an informational tracking tool only — not a substitute for manufacturer instructions, product manuals, safety warnings, healthcare providers, or your own judgment.",
  "You are solely responsible for the safety of your child and every product you purchase, use, install, inspect, maintain, store, and replace.",
  "You assume all risks associated with baby products and equipment you use. Peace of Mine does not manufacture, inspect, test, certify, or monitor any physical product.",
  "Recall and safety information is only as current as the last sync — a recall can happen in the gap before it reaches the app. The absence of an alert does not mean a product is safe.",
  "You will independently verify important safety information directly with the manufacturer and official government sources before relying on it.",
  "To the extent allowed by law, Peace of Mine's total liability to you is capped at $50, claims must be brought individually (no class actions), and you release Peace of Mine from claims arising from your use of the app.",
];

// Consent-flow audit finding: previously the only mention of data
// collection on this screen was a link to the full Privacy Policy — the
// on-screen summary (ACKNOWLEDGMENTS, above) covered only liability/safety
// disclaimer content. A parent had to click away and read a separate page
// to learn what's actually collected or shared. This says it here,
// directly, in the same plain language as the rest of the screen —
// condensed from privacy-policy.ts's fuller version, which stays the
// source of truth for the complete list.
const DATA_PRACTICES = [
  "We never sell your data or share it with advertisers.",
  "Your child's name and any milestones you log — used to time safety reminders to the milestones your child has reached, not a stored birthdate.",
  "Baby products you add (name, brand, barcode) — matched against official recall databases (CPSC, FDA, and others).",
  "Your email — to run your account and send you safety alerts.",
  "If you search for a product or use AI-powered safety guidance, that search text (never your child's name or info) is sent to Google's or Anthropic's AI models.",
  "Payment details, only if you subscribe to Pro — handled entirely by Stripe; we never see your card number.",
];

function LegalConsentPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  // Split from a single "agreed" checkbox (consent-flow audit finding):
  // Terms acceptance (liability waiver, safety disclaimer, class-action
  // waiver) and Privacy/data-practices acceptance are legally distinct
  // things that shouldn't require one tick to cover both. Both are still
  // required to continue — the app can't function without processing the
  // data described — but each is now its own explicit, independently
  // toggleable choice, not one bundled checkbox.
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      setUserId(data.session.user.id);
      setChecking(false);
    });
  }, [navigate]);

  async function handleContinue() {
    if (!userId || !agreedTerms || !agreedPrivacy || !ageConfirmed) return;
    setSubmitting(true);
    try {
      let { error } = await supabase.from("user_agreements").insert({
        user_id: userId,
        terms_version: CURRENT_TERMS_VERSION,
        is_18_or_older: ageConfirmed,
      } as never);

      // is_18_or_older is a recent addition (20260813000000) — every
      // existing user gets re-prompted here the moment CURRENT_TERMS_
      // VERSION bumps, so if that migration hasn't reached this database's
      // PostgREST schema cache yet, EVERY "Agree and continue" click would
      // otherwise fail with a raw "column does not exist" error that
      // friendlyError() doesn't recognize as retryable, showing the
      // generic "Something went wrong" toast and trapping the user on this
      // screen. Retry without the column (it defaults to false at the DB
      // level) rather than blocking the whole consent flow on it — same
      // resilient pattern used elsewhere for optional/recently-added columns.
      if (error && isColumnUnavailableError("is_18_or_older", error)) {
        logError("[legal-consent] is_18_or_older unavailable — retrying without it",
          error.message,
        );
        ({ error } = await supabase.from("user_agreements").insert({
          user_id: userId,
          terms_version: CURRENT_TERMS_VERSION,
        } as never));
      }

      // A duplicate-key error here just means this version was already
      // recorded (e.g. a double-click, or a retry after a network blip) —
      // treat it as success rather than blocking the user. Likewise, if
      // the table itself isn't reachable (e.g. this environment's
      // database hasn't picked up the migration yet), don't trap the user
      // on this screen forever — log it loudly and let them continue; the
      // _authenticated gate fails open the same way for the same reason.
      if (error && !/duplicate key/i.test(error.message) && !isSchemaMissingTableError(error)) {
        throw error;
      }
      if (error) logError("[legal-consent] couldn't record acceptance, continuing anyway:", error.message);
      // So the very next navigation's beforeLoad (see _authenticated/
      // route.tsx) doesn't have to round-trip user_agreements again just to
      // learn what this request already just wrote.
      markLegalConsentCleared(userId);
      navigate({ to: getNextParam() } as never);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSubmitting(false);
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
      <header className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Logo />
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-2 sm:px-6 lg:px-8">
        <div className="w-full max-w-2xl">
          <div className="mb-2 flex items-center gap-2 font-body text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <ShieldCheck className="h-4 w-4" /> Before you continue
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Please review a few things
          </h1>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            We've updated our Terms of Service and Privacy Policy. Here's the short version of each
            — the full text of both is linked below.
          </p>

          <p className="mt-6 font-body text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Terms of Service
          </p>
          <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-border/60 bg-card p-4">
            <ul className="space-y-3">
              {ACKNOWLEDGMENTS.map((text, i) => (
                <li
                  key={i}
                  className="flex gap-3 font-body text-sm leading-relaxed text-foreground"
                >
                  <span className="mt-0.5 flex-shrink-0 text-primary">•</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-5 font-body text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            What we collect and share
          </p>
          <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-border/60 bg-card p-4">
            <ul className="space-y-3">
              {DATA_PRACTICES.map((text, i) => (
                <li
                  key={i}
                  className="flex gap-3 font-body text-sm leading-relaxed text-foreground"
                >
                  <span className="mt-0.5 flex-shrink-0 text-primary">•</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-6 font-body text-xs text-muted-foreground">
            Read the full{" "}
            <Link to="/terms" className="underline hover:text-foreground">
              Terms of Service
            </Link>
            , including the complete Safety Disclaimer, Assumption of Risk, and Limitation of
            Liability sections, or the{" "}
            <Link to="/privacy-policy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-card p-4">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-primary"
            />
            <span className="font-body text-sm text-foreground">
              I confirm that I am 18 years of age or older.
            </span>
          </label>

          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-card p-4">
            <input
              type="checkbox"
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-primary"
            />
            <span className="font-body text-sm text-foreground">
              I have read and agree to the Terms of Service, including the Safety Disclaimer,
              Assumption of Risk, and Limitation of Liability.
            </span>
          </label>

          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-card p-4">
            <input
              type="checkbox"
              checked={agreedPrivacy}
              onChange={(e) => setAgreedPrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-primary"
            />
            <span className="font-body text-sm text-foreground">
              I have read and agree to the Privacy Policy — what's collected about me and my child,
              and who it's shared with.
            </span>
          </label>

          <Button
            className="mt-6 h-12 w-full rounded-full bg-primary font-body text-sm font-semibold"
            disabled={!agreedTerms || !agreedPrivacy || !ageConfirmed || submitting}
            onClick={handleContinue}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agree and continue"}
          </Button>
        </div>
      </main>
    </div>
  );
}
