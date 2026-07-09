import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Lock, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile_/privacy-promise")({
  ssr: false,
  component: PrivacyPromisePage,
  head: () => ({ meta: [{ title: "Privacy Promise — Peace of Mine" }] }),
});

const PROMISES = [
  {
    icon: "🚫",
    title: "We never sell your data",
    body: "Your family's information is never sold, rented, or shared with advertisers. Ever.",
  },
  {
    icon: "🔔",
    title: "We only contact you for safety",
    body: "The only emails and push notifications we send are safety alerts — recalls, replacement reminders, and urgent product notices. No marketing without your explicit opt-in.",
  },
  {
    icon: "🗑️",
    title: "You can delete everything, anytime",
    body: "One tap removes all your children's profiles, products, milestones, and any other data we hold. Your account is yours to close whenever you choose.",
  },
  {
    icon: "🔒",
    title: "Your data stays private by default",
    body: "All data is encrypted in transit and at rest. Row-level security means only you can read your family's records — not other users, not our support staff without your permission.",
  },
];

function PrivacyPromisePage() {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    try {
      const { deleteMyAccount } = await import("@/utils/deleteAccount.functions");
      const result = await deleteMyAccount();
      await supabase.auth.signOut();
      if (result.stripeErrors && result.stripeErrors.length > 0) {
        toast.warning("Account deleted, but we couldn't cancel your subscription automatically. Please contact support.");
      } else {
        toast.success("All your data has been removed.");
      }
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setDeleting(false);
      setConfirming(false);
    }
  }


  return (
    <div className="flex min-h-screen flex-col bg-background">
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
          <span className="font-display text-base font-semibold">Privacy Promise</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-6">
        <p className="mb-2 font-body text-sm text-muted-foreground">
          Plain language. No legalese.
        </p>

        <div className="space-y-3">
          {PROMISES.map((p) => (
            <div key={p.title} className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none">{p.icon}</span>
                <div>
                  <p className="font-display text-sm font-semibold">{p.title}</p>
                  <p className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Delete section */}
        <div className="mt-8 rounded-2xl border border-destructive/25 bg-destructive/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-destructive" />
            <p className="font-display text-sm font-semibold text-destructive">Delete my account</p>
          </div>
          <p className="font-body text-xs text-muted-foreground mb-4">
            This permanently removes all your children's profiles, products, milestones, checklist progress, and alerts. This cannot be undone.
          </p>
          {confirming ? (
            <div className="space-y-2">
              <p className="font-body text-xs font-semibold text-destructive text-center">
                Are you sure? This is permanent.
              </p>
              <Button
                variant="destructive"
                className="w-full rounded-full"
                disabled={deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? "Deleting…" : <><Trash2 className="mr-2 h-4 w-4" /> Yes, delete everything</>}
              </Button>
              <Button
                variant="ghost"
                className="w-full rounded-full"
                onClick={() => setConfirming(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDeleteAccount}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete my account &amp; data
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
