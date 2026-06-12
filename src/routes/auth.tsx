import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Mail, Lock, Sparkles, Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Safe & Sound" },
      { name: "description", content: "Sign in or create your Safe & Sound account to start tracking your little one's milestones." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { error?: string } => ({
    error: typeof s.error === "string" ? s.error : undefined,
  }),
});

type Mode = "signin" | "signup" | "magic";

function AuthPage() {
  const navigate = useNavigate();
  const { error: authError } = Route.useSearch();
  const [mode, setMode] = useState<Mode>("signin");

  // Show auth callback errors (e.g. expired magic link)
  useEffect(() => {
    if (authError) toast.error(authError);
  }, [authError]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<null | "email" | "google" | "apple" | "magic">(null);

  // Redirect if already signed in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/home" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading("email");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Welcome to Safe & Sound ✨");
          navigate({ to: "/onboarding" });
        } else {
          toast.success("Check your inbox to confirm your email ✨");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading("magic");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      toast.success("Magic link sent — check your inbox ✉️");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send link");
    } finally {
      setLoading(null);
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    setLoading(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || `${provider} sign-in failed`);
        setLoading(null);
      }
      // redirected: browser leaves; tokens: onAuthStateChange will redirect
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
      setLoading(null);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <Link
        to="/"
        className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-4 py-2 font-body text-xs font-medium text-muted-foreground backdrop-blur transition-colors hover:text-foreground sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back home
      </Link>

      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-[0_20px_60px_-30px_rgba(180,120,90,0.35)] backdrop-blur-sm sm:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              {mode === "signup" ? "Create your account" : mode === "magic" ? "Magic link sign-in" : "Welcome back"}
            </h1>
            <p className="mt-2 font-body text-sm text-muted-foreground">
              {mode === "signup"
                ? "Start tracking your little one's journey."
                : mode === "magic"
                ? "We'll email you a one-tap sign-in link."
                : "Sign in to continue your journey."}
            </p>
          </div>

          {/* OAuth */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={loading !== null}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-4 py-3 font-body text-sm font-medium text-foreground transition-all hover:bg-background hover:shadow-sm disabled:opacity-50"
            >
              {loading === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              disabled={loading !== null}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-4 py-3 font-body text-sm font-medium text-foreground transition-all hover:bg-background hover:shadow-sm disabled:opacity-50"
            >
              {loading === "apple" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AppleIcon />}
              Continue with Apple
            </button>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/60" />
            <span className="font-body text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          {/* Email form */}
          <form onSubmit={mode === "magic" ? handleMagicLink : handleEmailSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-2xl border border-border/70 bg-background/60 py-3 pl-11 pr-4 font-body text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {mode !== "magic" && (
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="w-full rounded-2xl border border-border/70 bg-background/60 py-3 pl-11 pr-4 font-body text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading !== null}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-body text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50"
            >
              {(loading === "email" || loading === "magic") && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create account" : mode === "magic" ? "Send magic link" : "Sign in"}
            </button>
          </form>

          {/* Mode toggles */}
          <div className="mt-6 space-y-2 text-center font-body text-sm">
            {mode !== "magic" && (
              <button
                type="button"
                onClick={() => setMode("magic")}
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                Email me a magic link instead
              </button>
            )}
            {mode === "magic" && (
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                Use password instead
              </button>
            )}
            <div className="text-muted-foreground">
              {mode === "signup" ? "Already have an account?" : "New to Safe & Sound?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                className="font-semibold text-primary transition-colors hover:text-primary/80"
              >
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </div>
          </div>
        </div>

        <p className="mt-6 px-4 text-center font-body text-xs leading-relaxed text-muted-foreground">
          By continuing, you agree to our{" "}
          <Link to="/terms" className="underline hover:text-foreground">
            Terms & Conditions
          </Link>{" "}
          and Privacy Policy.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.04c-.03-2.86 2.34-4.23 2.44-4.3-1.33-1.95-3.4-2.22-4.14-2.25-1.76-.18-3.43 1.04-4.32 1.04-.9 0-2.27-1.02-3.74-.99-1.92.03-3.7 1.12-4.69 2.83-2 3.46-.51 8.59 1.44 11.4.95 1.38 2.08 2.93 3.55 2.87 1.43-.06 1.97-.93 3.7-.93s2.22.93 3.74.9c1.55-.03 2.52-1.4 3.47-2.79 1.09-1.6 1.54-3.15 1.57-3.23-.03-.02-3.01-1.16-3.04-4.55zM14.39 3.73c.79-.96 1.32-2.29 1.17-3.61-1.13.05-2.5.75-3.32 1.7-.73.84-1.37 2.2-1.2 3.5 1.26.1 2.55-.64 3.35-1.59z"/>
    </svg>
  );
}
