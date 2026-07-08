import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Mail, ShieldAlert, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/caregiver-invite/$token")({
  ssr: false,
  component: CaregiverInvitePage,
  head: () => ({ meta: [{ title: "Caregiver Invite — Peace of Mine" }] }),
});

type InvitePreview = { inviteeEmail: string; childNames: string[]; role: "editor" | "viewer" };
type Step = "loading" | "invalid" | "needs-signin" | "sent" | "accepting" | "success" | "accept-error";

function CaregiverInvitePage() {
  const { token } = Route.useParams();
  const [step, setStep] = useState<Step>("loading");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [acceptedNames, setAcceptedNames] = useState<string[]>([]);

  // Load the invite preview (public, unauthenticated) on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/caregiver-invite?token=${encodeURIComponent(token)}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok || !body.ok) {
          setErrorMsg(body.error ?? "This invite is invalid or has expired.");
          setStep("invalid");
          return;
        }
        setPreview(body as InvitePreview);
        setStep("needs-signin");
      } catch {
        if (cancelled) return;
        setErrorMsg("Something went wrong loading this invite. Please try again.");
        setStep("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Once the preview has loaded, check whether the browser already has a
  // signed-in session matching the invite's email (e.g. returning from the
  // magic-link redirect, or already signed in as the right account) — if
  // so, skip straight to accepting instead of asking them to sign in again.
  useEffect(() => {
    if (!preview) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sessionEmail = data.session?.user.email?.toLowerCase();
      if (cancelled || !sessionEmail) return;
      if (sessionEmail === preview.inviteeEmail.toLowerCase()) {
        void accept();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  async function sendSignInLink() {
    if (!preview) return;
    setStep("loading");
    try {
      const next = `/caregiver-invite/${token}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: preview.inviteeEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) throw error;
      setStep("sent");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Couldn't send the sign-in link.");
      setStep("needs-signin");
    }
  }

  async function accept() {
    setStep("accepting");
    try {
      const { acceptCaregiverInvite } = await import("@/lib/caregiverInvite.functions");
      const result = await acceptCaregiverInvite({ data: { token } });
      setAcceptedNames(result.childNames);
      setStep("success");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Couldn't accept this invite.");
      setStep("accept-error");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      {step === "loading" && <Loader2 className="h-7 w-7 animate-spin text-primary" />}

      {step === "invalid" && (
        <>
          <ShieldAlert className="h-8 w-8 text-destructive" />
          <p className="font-display text-lg font-semibold">{errorMsg}</p>
          <Button asChild variant="outline" className="rounded-full mt-2">
            <Link to="/auth">Go to sign in</Link>
          </Button>
        </>
      )}

      {step === "needs-signin" && preview && (
        <div className="w-full max-w-sm space-y-4">
          <UserPlus className="mx-auto h-8 w-8 text-primary" />
          <div>
            <p className="font-display text-xl font-semibold tracking-tight">
              You've been invited to help care for {preview.childNames.join(" & ") || "a child"}
            </p>
            <p className="mt-2 font-body text-sm text-muted-foreground">
              You'll be able to {preview.role === "editor" ? "view and edit" : "view"} their profile, products,
              milestones, and recall alerts.
            </p>
          </div>
          {errorMsg && <p className="font-body text-xs text-destructive">{errorMsg}</p>}
          <Button onClick={sendSignInLink} className="w-full rounded-full">
            <Mail className="mr-2 h-4 w-4" /> Sign in as {preview.inviteeEmail}
          </Button>
          <p className="font-body text-xs text-muted-foreground/70">
            We'll email a sign-in link to {preview.inviteeEmail} — this invite only works for that address.
          </p>
        </div>
      )}

      {step === "sent" && preview && (
        <>
          <Mail className="h-8 w-8 text-primary" />
          <p className="font-display text-lg font-semibold">Check your email</p>
          <p className="max-w-xs font-body text-sm text-muted-foreground">
            We sent a sign-in link to {preview.inviteeEmail}. Open it on this device to finish accepting the invite.
          </p>
        </>
      )}

      {step === "accepting" && (
        <>
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="font-body text-sm text-muted-foreground">Setting up access…</p>
        </>
      )}

      {step === "success" && (
        <>
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          <p className="font-display text-lg font-semibold">You're in</p>
          <p className="max-w-xs font-body text-sm text-muted-foreground">
            You now have access to {acceptedNames.join(" & ") || "the shared"} profile.
          </p>
          <Button asChild className="rounded-full mt-2">
            <Link to="/home">Go to Peace of Mine</Link>
          </Button>
        </>
      )}

      {step === "accept-error" && (
        <>
          <ShieldAlert className="h-8 w-8 text-destructive" />
          <p className="font-display text-lg font-semibold">Couldn't accept this invite</p>
          <p className="max-w-xs font-body text-sm text-muted-foreground">{errorMsg}</p>
          <Button asChild variant="outline" className="rounded-full mt-2">
            <Link to="/home">Go to Peace of Mine</Link>
          </Button>
        </>
      )}
    </div>
  );
}
