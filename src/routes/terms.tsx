import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SUPPORT_EMAIL } from "@/lib/constants";
import { CURRENT_TERMS_VERSION } from "@/lib/legalConsent";

// Single source of truth for the displayed date is CURRENT_TERMS_VERSION
// (legalConsent.ts) — previously this rendered new Date() directly, so the
// page always showed "today" on every visit regardless of whether the
// content had actually changed, which is misleading in the opposite
// direction from being stale: it looked freshly updated on every single
// day. Deriving it from the same version string that gates re-consent
// means the two can never drift apart.
const TERMS_LAST_UPDATED = new Date(`${CURRENT_TERMS_VERSION}T00:00:00Z`).toLocaleDateString(
  "en-US",
  { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" },
);

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Peace of Mine" },
      { name: "description", content: "Read the Peace of Mine terms and conditions covering suggestions-only guidance, user responsibility, and limitations of liability for our baby safety tracking app." },
      { property: "og:title", content: "Terms & Conditions — Peace of Mine" },
      { property: "og:description", content: "The terms of use for the Peace of Mine baby safety tracking app, including disclaimers and user responsibilities." },
      { property: "og:url", content: "https://peace-of-mine.lovable.app/terms" },
    ],
    links: [{ rel: "canonical", href: "https://peace-of-mine.lovable.app/terms" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Terms & Conditions — Peace of Mine",
        url: "https://peace-of-mine.lovable.app/terms",
        description: "Terms and conditions for the Peace of Mine baby safety tracking app.",
      }),
    }],
  }),
  component: TermsPage,
});

function TermsPage() {
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
            Terms & Conditions
          </h1>
          <p className="mt-4 font-body text-sm text-muted-foreground">
            Last updated: {TERMS_LAST_UPDATED}
          </p>

          <div className="mt-10 space-y-8 font-body text-base leading-relaxed text-foreground">
            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">1. Eligibility</h2>
              <p className="mt-2 text-muted-foreground">
                Peace of Mine is intended for use by adults who are 18 years of age or older. By creating an account or using the app, you represent and confirm that you meet this age requirement. Peace of Mine is not directed at children, and no one under 18 may create an account or use the service, regardless of whether a parent or guardian is involved.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">2. Suggestions Only</h2>
              <p className="mt-2 text-muted-foreground">
                Everything provided by Peace of Mine is for informational and suggestion purposes only. Our reminders, recommendations, timelines, and any other content are not medical advice, legal advice, or professional guidance of any kind. Always consult a qualified professional before making decisions about your child’s health, safety, or care.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">3. No Guarantee of Accuracy</h2>
              <p className="mt-2 text-muted-foreground">
                While we aim to keep information helpful and up to date, we do not guarantee that any reminder, recommendation, or piece of content is accurate, complete, reliable, or suitable for your specific situation. You use Peace of Mine at your own discretion and assume full responsibility for any actions you take based on what you see here.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">4. Not a Substitute for Professional Advice</h2>
              <p className="mt-2 text-muted-foreground">
                Peace of Mine is not a replacement for pediatricians, child safety experts, car seat technicians, lactation consultants, or any other licensed professional. If you have concerns about your child’s safety or wellbeing, please contact the appropriate expert immediately.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">5. User Responsibility</h2>
              <p className="mt-2 text-muted-foreground">
                You are responsible for verifying product expiration dates, recall notices, installation instructions, and any other safety-critical details directly with manufacturers and certified professionals. Peace of Mine is a tool to help you stay organized — not the final authority.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">6. Safety Disclaimer &amp; Assumption of Risk</h2>
              <p className="mt-2 text-muted-foreground">
                Peace of Mine is an informational tracking tool only. It is designed to help you organize, track, and receive informational reminders about baby products, milestones, recalls, and related topics. It is not a substitute for manufacturer instructions, product manuals, product labeling, safety warnings, healthcare providers, or your own independent judgment.
              </p>
              <p className="mt-2 text-muted-foreground">
                You are solely responsible for the safety of your child and the products you choose to purchase, use, install, inspect, maintain, store, and replace. You are responsible for reading and following all manufacturer instructions, warnings, age and weight limits, expiration dates, installation requirements, maintenance recommendations, and recall notices applicable to every product you use.
              </p>
              <p className="mt-2 text-muted-foreground">
                By using Peace of Mine, you assume all risks associated with the baby products and equipment that you bring into your home or otherwise use. Peace of Mine does not manufacture, inspect, test, certify, endorse, install, maintain, or monitor any physical product, and cannot guarantee that any reminder, recommendation, recall information, milestone, or notification will be complete, accurate, timely, or applicable to your specific circumstances.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">7. Data Freshness &amp; the Sync Gap</h2>
              <p className="mt-2 text-muted-foreground">
                Recall, guideline, and product information shown in Peace of Mine is only as current as the last time it was synced from CPSC, FDA, and other official sources — it is not real-time. A manufacturer or government agency can issue a recall or safety update at any moment, including in the window between one sync and the next, before it has reached the app. Every product screen shows when that product's information was actually last synced, for exactly this reason.
              </p>
              <p className="mt-2 text-muted-foreground">
                You understand and agree that the absence of a recall, alert, or notification in Peace of Mine at any given moment does not mean a product is safe, appropriate, or free from recalls or hazards — it may only mean the relevant information had not yet synced. Failure to receive a notification or reminder does not mean a product is safe. You agree to independently verify all important safety information directly with the product manufacturer and other official sources before relying on it, and not to treat the absence of an alert in this app as confirmation of safety.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">7a. Product Data Sources &amp; Attribution</h2>
              <p className="mt-2 text-muted-foreground">
                Product names, brands, categories, and images shown after a barcode scan come from public and licensed product databases, used under their own terms: Open Food Facts, Open Beauty Facts, and Open Products Facts (product data available under the Open Database License, ODbL; product images under CC BY-SA), UPCitemdb, Go-UPC, and Barcode Lookup. Peace of Mine does not scrape retailer or manufacturer websites. Recall data comes from official government sources (CPSC, NHTSA, USDA FSIS, Health Canada, EU Safety Gate). We are not affiliated with, endorsed by, or sponsored by any of these organizations or by the brands whose products you track; brand and product names are used only to identify products.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">8. Release</h2>
              <p className="mt-2 text-muted-foreground">
                To the fullest extent permitted by applicable law, you assume full responsibility for any decisions you make regarding your child's care and the use of any products, and you release and hold harmless Peace of Mine, its owners, employees, contractors, affiliates, licensors, and partners from claims arising from your use of the app, except where such liability cannot legally be excluded.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">9. Limitation of Liability</h2>
              <p className="mt-2 text-muted-foreground">
                To the fullest extent permitted by law, Peace of Mine and its creators will not be liable for any direct, indirect, incidental, consequential, special, or punitive damages arising from your use of (or inability to use) the app or its content, including any damages resulting from a product recall, injury, or safety incident, regardless of the legal theory under which such damages are sought.
              </p>
              <p className="mt-2 text-muted-foreground">
                Where liability cannot be excluded entirely under applicable law, you agree that Peace of Mine's total, aggregate liability to you for any and all claims arising from or relating to your use of the app is limited to fifty dollars ($50 USD), regardless of the number of claims, the number of children or products involved, or the legal theory asserted. This cap does not apply where prohibited by law.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">10. Class-Action Waiver</h2>
              <p className="mt-2 text-muted-foreground">
                To the fullest extent permitted by applicable law, you agree that any claim against Peace of Mine will be brought individually, and not as a plaintiff or class member in any purported class, collective, consolidated, or representative action. You waive any right to have your claim heard or resolved as part of a class action, and to join your claim with the claims of other users, including in connection with a recall that Peace of Mine's notifications did not flag or flagged late. This section does not apply where prohibited by law.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">11. Subscriptions &amp; Billing</h2>
              <p className="mt-2 text-muted-foreground">
                Core safety features — recall alerts, replacement reminders, and all safety notifications — are free and always will be. Pro is an optional paid subscription that unlocks additional convenience features (currently $3.33/month, with a 7-day free trial for new subscribers). Pricing, trial length, and included features are shown on the subscription screen before you purchase and may change over time; we will show you current terms before any purchase.
              </p>
              <p className="mt-2 text-muted-foreground">
                On the web, Pro is billed through Stripe. On iOS, Pro is billed through Apple's In-App Purchase system, and Apple is the merchant of record for that purchase — Apple's own terms and refund policies apply to purchases made through the App Store, in addition to these Terms.
              </p>
              <p className="mt-2 text-muted-foreground">
                Pro renews automatically at the end of each billing period unless you cancel before it renews. On the web, you can cancel anytime from the subscription management page linked in the app. On iOS, subscriptions are managed and cancelled through your Apple ID account settings, not through us — we cannot cancel or refund an App Store purchase on your behalf; Apple handles all billing, cancellation, and refund requests for purchases made that way.
              </p>
              <p className="mt-2 text-muted-foreground">
                If you cancel, you keep Pro access through the end of the period you already paid for. We do not prorate partial-period refunds ourselves; on iOS, any refund request goes through Apple.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">12. Changes to These Terms</h2>
              <p className="mt-2 text-muted-foreground">
                We may update these Terms from time to time. When we make a material change, you will be asked to explicitly accept the updated Terms again before continuing to use the app. Continued use of Peace of Mine after a non-material change means you accept the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">13. Contact</h2>
              <p className="mt-2 text-muted-foreground">
                If you have questions about these Terms, reach out to us at {SUPPORT_EMAIL}.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
