import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, LifeBuoy } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SUPPORT_EMAIL, SHARE_URL } from "@/lib/constants";

const SUPPORT_URL = `${SHARE_URL}/support`;

const FAQ = [
  {
    q: "How does recall detection work?",
    a: "When you add a product, we check it against the CPSC and FDA recall databases as well as our own curated list of critical safety alerts, and run a daily background check on the products you've saved. If a match is found, you'll see an alert on your home screen and in the Alerts tab.",
  },
  {
    q: "What does the app track?",
    a: "Peace of Mine tracks your baby's products (car seats, cribs, strollers, bottles, formula, pacifiers, and more) for recalls and expiration, age-based safety milestones, feeding and first foods, bottles, and safety reminders. You stay in control of what you log.",
  },
  {
    q: "Is my child's data private?",
    a: "Yes. Your data is stored securely with row-level security — only you (and anyone you explicitly invite, like a co-parent or caregiver) can access your account. We never sell your personal information. See our Privacy Policy for full details.",
  },
  {
    q: "Is the app free to use?",
    a: "Yes. The free plan lets you track one child with full product safety tracking, recall alerts, and safety tips. Pro is an optional subscription that unlocks the barcode scanner, multiple children, milestones and moments, custom reminders, co-parent sharing, and data export.",
  },
  {
    q: "How do I share access with my co-parent or caregiver?",
    a: "Go to Profile and open the co-parent section. Enter their email and they'll receive an invite. Once they sign in, your accounts can be linked so you share the same children and products.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "Subscriptions are managed by Apple (on iPhone) or your card provider (on the web). On iPhone, go to Settings → Apple ID → Subscriptions and cancel there. You'll keep Pro access through the end of the current billing period.",
  },
  {
    q: "How do I delete my account?",
    a: "Go to Profile → scroll to the bottom Danger Zone section → tap Delete my account, then confirm. All your data will be permanently removed.",
  },
  {
    q: "Is Peace of Mine a substitute for medical advice?",
    a: "No. Peace of Mine provides safety tracking and general information only — it is not medical advice. Always consult your pediatrician or another qualified professional for medical questions about your child.",
  },
];

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — Peace of Mine" },
      {
        name: "description",
        content:
          "Get help with Peace of Mine. Contact our support team and find answers to common questions about recalls, subscriptions, privacy, and account management.",
      },
      { property: "og:title", content: "Support — Peace of Mine" },
      {
        property: "og:description",
        content:
          "Support and frequently asked questions for the Peace of Mine baby safety tracking app.",
      },
      { property: "og:url", content: SUPPORT_URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: SUPPORT_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          url: SUPPORT_URL,
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.a,
            },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Support — Peace of Mine",
          url: SUPPORT_URL,
          description:
            "Support and frequently asked questions for the Peace of Mine baby safety tracking app.",
        }),
      },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back home
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LifeBuoy className="h-6 w-6" />
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Support
            </h1>
          </div>
          <p className="mt-4 font-body text-base text-muted-foreground">
            We're here to help. Reach out anytime and we'll get back to you within 24 hours.
          </p>

          {/* Contact card */}
          <div className="mt-8 rounded-3xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-base font-semibold text-foreground">
                  Email us
                </p>
                <p className="font-body text-xs text-muted-foreground">
                  We reply within 24 hours
                </p>
              </div>
            </div>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-body text-sm font-medium text-primary-foreground transition-colors hover:bg-[#234E4A]"
            >
              <Mail className="h-4 w-4" />
              {SUPPORT_EMAIL}
            </a>
          </div>

          {/* FAQ */}
          <h2 className="mt-12 font-display text-xl font-semibold text-foreground">
            Frequently asked questions
          </h2>

          <div className="mt-4 space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-border/60 bg-card overflow-hidden"
              >
                <summary className="flex cursor-pointer items-start justify-between gap-3 p-4 font-body text-sm font-medium text-foreground list-none select-none">
                  <span>{item.q}</span>
                  <span className="mt-0.5 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-45 text-lg leading-none">
                    +
                  </span>
                </summary>
                <div className="border-t border-border/40 px-4 pb-4 pt-3">
                  <p className="font-body text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </div>
              </details>
            ))}
          </div>

          <p className="mt-10 text-center font-body text-xs text-muted-foreground">
            Still need help?{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-primary underline underline-offset-2"
            >
              Email our support team
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
