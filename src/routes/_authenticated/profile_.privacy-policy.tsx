import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRIVACY_POLICY, PRIVACY_POLICY_UPDATED } from "@/lib/privacy-policy";

export const Route = createFileRoute("/_authenticated/profile_/privacy-policy")({
  ssr: false,
  component: PrivacyPolicyPage,
  head: () => ({ meta: [{ title: "Privacy Policy — Peace of Mine" }] }),
});

function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => navigate({ to: "/profile" })}
          aria-label="Back to profile"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-display text-base font-semibold">Privacy Policy</span>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-6">
        <p className="mb-5 font-body text-xs text-muted-foreground">
          Last updated: {PRIVACY_POLICY_UPDATED}
        </p>

        <div className="rounded-3xl border border-border/60 bg-card p-5">
          <pre className="whitespace-pre-wrap font-body text-sm leading-relaxed text-foreground">
            {PRIVACY_POLICY}
          </pre>
        </div>

        <p className="mt-6 text-center font-body text-xs text-muted-foreground">
          Questions?{" "}
          <a
            href="mailto:privacy@safeandsoundbabies.com"
            className="text-primary underline underline-offset-2"
          >
            privacy@safeandsoundbabies.com
          </a>
        </p>
      </main>
    </div>
  );
}
