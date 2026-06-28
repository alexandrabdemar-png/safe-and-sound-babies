import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Peace of Mine" },
      { name: "description", content: "Terms and conditions for Peace of Mine." },
    ],
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
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>

          <div className="mt-10 space-y-8 font-body text-base leading-relaxed text-foreground">
            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">1. Suggestions Only</h2>
              <p className="mt-2 text-muted-foreground">
                Everything provided by Peace of Mine is for informational and suggestion purposes only. Our reminders, recommendations, timelines, and any other content are not medical advice, legal advice, or professional guidance of any kind. Always consult a qualified professional before making decisions about your child’s health, safety, or care.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">2. No Guarantee of Accuracy</h2>
              <p className="mt-2 text-muted-foreground">
                While we aim to keep information helpful and up to date, we do not guarantee that any reminder, recommendation, or piece of content is accurate, complete, reliable, or suitable for your specific situation. You use Peace of Mine at your own discretion and assume full responsibility for any actions you take based on what you see here.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">3. Not a Substitute for Professional Advice</h2>
              <p className="mt-2 text-muted-foreground">
                Peace of Mine is not a replacement for pediatricians, child safety experts, car seat technicians, lactation consultants, or any other licensed professional. If you have concerns about your child’s safety or wellbeing, please contact the appropriate expert immediately.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">4. User Responsibility</h2>
              <p className="mt-2 text-muted-foreground">
                You are responsible for verifying product expiration dates, recall notices, installation instructions, and any other safety-critical details directly with manufacturers and certified professionals. Peace of Mine is a tool to help you stay organized — not the final authority.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">5. Limitation of Liability</h2>
              <p className="mt-2 text-muted-foreground">
                To the fullest extent permitted by law, Peace of Mine and its creators will not be liable for any direct, indirect, incidental, or consequential damages arising from your use of (or inability to use) the app or its content.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">6. Changes to These Terms</h2>
              <p className="mt-2 text-muted-foreground">
                We may update these Terms from time to time. Continued use of Peace of Mine after changes means you accept the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">7. Contact</h2>
              <p className="mt-2 text-muted-foreground">
                If you have questions about these Terms, reach out to us at hello@safeandsound.app.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
