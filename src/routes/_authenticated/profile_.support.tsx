import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, HelpCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/profile_/support")({
  ssr: false,
  component: SupportPage,
  head: () => ({ meta: [{ title: "Help & Support — Peace of Mine" }] }),
});

const FAQ = [
  {
    q: "How does recall detection work?",
    a: "When you add a product, we check it against the CPSC and FDA recall databases as well as our own curated list of critical safety alerts, and run a daily background check on the products you've saved. If a match is found, you'll see an alert on your home screen and in the Alerts tab.",
  },
  {
    q: "Is my child's data private?",
    a: "Yes. Your data is stored securely using Supabase with row-level security — only you can access your account. We never sell or share your personal information. See our Privacy Policy for full details.",
  },
  {
    q: "How do I share access with my co-parent or caregiver?",
    a: "Go to Profile and scroll to the co-parent section. Enter their email and they'll receive a magic link. Once they sign in, contact us to link your accounts so you share the same children and products.",
  },
  {
    q: "What does Pro include?",
    a: "Pro unlocks tracking for multiple children, full data export, and priority recall notifications. You can upgrade at any time from the Profile screen.",
  },
  {
    q: "How do I delete my account?",
    a: "Go to Profile → scroll to the bottom Danger Zone section → tap Delete my account. You'll be asked to confirm before anything is deleted. All your data will be permanently removed.",
  },
  {
    q: "The app isn't loading — what should I try?",
    a: "Check your internet connection and try refreshing. If the issue persists, sign out from Profile and sign back in. If you're still seeing problems, email us at the address below.",
  },
  {
    q: "How do I report a safety issue or incorrect recall information?",
    a: `Email us at ${SUPPORT_EMAIL} with the product name and the issue you noticed. We take safety accuracy very seriously and will investigate right away.`,
  },
  {
    q: "Can I use Peace of Mine without a subscription?",
    a: "Yes — the free plan lets you track one child with full product safety tracking, recall alerts, moments, and safety tips. Pro is optional and unlocks extra features.",
  },
];

function SupportPage() {
  const navigate = useNavigate();

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
          <HelpCircle className="h-4 w-4 text-primary" />
          <span className="font-display text-base font-semibold">Help & Support</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-6 space-y-4">
        <div className="rounded-3xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <p className="font-display text-base font-semibold">Contact us</p>
              <p className="font-body text-xs text-muted-foreground">We reply within 24 hours</p>
            </div>
          </div>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-[#485240]"
          >
            <Mail className="h-3.5 w-3.5" />
            {SUPPORT_EMAIL}
          </a>
        </div>

        <h2 className="font-display text-xl font-semibold px-1 pt-2">Frequently asked questions</h2>

        <div className="space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-border/60 bg-card overflow-hidden"
            >
              <summary className="flex cursor-pointer items-start justify-between gap-3 p-4 font-body text-sm font-medium text-foreground list-none select-none">
                <span>{item.q}</span>
                <span className="mt-0.5 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-45 text-lg leading-none">+</span>
              </summary>
              <div className="border-t border-border/40 px-4 pb-4 pt-3">
                <p className="font-body text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </div>
            </details>
          ))}
        </div>

        <p className="mt-6 text-center font-body text-xs text-muted-foreground pb-8">
          Still need help?{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-primary underline underline-offset-2"
          >
            Email our support team
          </a>
        </p>
      </main>
    </div>
  );
}
