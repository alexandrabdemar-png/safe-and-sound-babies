import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SUPPORT_EMAIL } from "@/lib/constants";
import { PRIVACY_POLICY, PRIVACY_POLICY_UPDATED } from "@/lib/privacy-policy";

// Public counterpart to /profile/privacy-policy (which lives under the
// _authenticated route tree and is therefore only reachable after signing
// in). The signup screen and the post-signup legal-consent wall both
// reference "the Privacy Policy" — before this route existed, there was
// nowhere for a prospective user to actually read it before creating an
// account. Renders the same PRIVACY_POLICY string as the in-app version so
// the two can never drift apart.
export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Peace of Mine" },
      {
        name: "description",
        content:
          "Read the Peace of Mine privacy policy: what information we collect, why, who can see it, and how to delete or export your data.",
      },
      { property: "og:title", content: "Privacy Policy — Peace of Mine" },
      {
        property: "og:description",
        content: "The privacy policy for the Peace of Mine baby safety tracking app.",
      },
      { property: "og:url", content: "https://peace-of-mine.lovable.app/privacy-policy" },
    ],
    links: [{ rel: "canonical", href: "https://peace-of-mine.lovable.app/privacy-policy" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Privacy Policy — Peace of Mine",
          url: "https://peace-of-mine.lovable.app/privacy-policy",
          description: "Privacy policy for the Peace of Mine baby safety tracking app.",
        }),
      },
    ],
  }),
  component: PublicPrivacyPolicyPage,
});

function PublicPrivacyPolicyPage() {
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
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-4 font-body text-sm text-muted-foreground">
            Last updated: {PRIVACY_POLICY_UPDATED}
          </p>

          <div className="mt-10 rounded-3xl border border-border/60 bg-card p-5">
            <pre className="whitespace-pre-wrap font-body text-sm leading-relaxed text-foreground">
              {PRIVACY_POLICY}
            </pre>
          </div>

          <p className="mt-6 text-center font-body text-xs text-muted-foreground">
            Questions?{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-primary underline underline-offset-2"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
