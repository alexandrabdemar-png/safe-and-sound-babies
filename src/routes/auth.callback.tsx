import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Handles the redirect back from Supabase after a magic link click
 * or an email-confirmation link.
 *
 * Supabase v2 (PKCE flow) appends ?code=<verifier> to the redirect URL.
 * We call supabase.auth.getSession() here which internally detects the code
 * in the URL via detectSessionInUrl and exchanges it for a real session.
 * Once onAuthStateChange fires with a valid session we send the user to
 * /home (or wherever the optional ?next= param points, e.g. a caregiver
 * invite waiting to be accepted at /caregiver-invite/:token — bypasses
 * onboarding, since that flow expects the invitee is already a real user).
 * On error we bounce back to /auth with a toast-friendly error param.
 */
export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallbackPage,
});

function getNextParam(): string | null {
  if (typeof window === "undefined") return null;
  const next = new URLSearchParams(window.location.search).get("next");
  // Only ever allow an in-app relative path — never an absolute/external
  // URL, which would make this an open redirect.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let done = false;
    const next = getNextParam();

    function routeAfterSignIn(userId: string) {
      if (next) {
        navigate({ to: next } as never);
        return;
      }
      supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (!profile?.display_name) {
            navigate({ to: "/onboarding" });
          } else {
            navigate({ to: "/home" });
          }
        });
    }

    // getSession() triggers the PKCE code exchange when detectSessionInUrl is
    // true and a ?code= param is present in the current URL.
    supabase.auth.getSession().then(({ data, error }) => {
      if (done) return;
      if (error || !data.session) {
        // Exchange failed — send back to auth with an error flag
        navigate({
          to: "/auth",
          search: { error: error?.message ?? "Magic link sign-in failed. Please try again." },
        } as never);
        return;
      }
      done = true;
      routeAfterSignIn(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (done) return;
      if (event === "PASSWORD_RECOVERY") {
        done = true;
        navigate({ to: "/auth", search: { mode: "reset" } } as never);
        return;
      }
      if (event === "SIGNED_IN" && session) {
        done = true;
        routeAfterSignIn(session.user.id);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <p className="font-body text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
