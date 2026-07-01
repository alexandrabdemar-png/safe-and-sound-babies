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

          {/* Prominent disclaimer banner */}
          <div className="mt-8 rounded-2xl border border-amber-300/60 bg-amber-50 px-5 py-4 dark:border-amber-700/40 dark:bg-amber-950/30">
            <p className="font-body text-sm font-semibold text-amber-900 dark:text-amber-200">Important notice before you continue</p>
            <p className="mt-1 font-body text-sm leading-relaxed text-amber-800 dark:text-amber-300">
              Peace of Mine provides safety aggregation for informational purposes only. It does not constitute medical, legal, or professional safety advice. Always consult product manuals and pediatrician guidelines directly. Use at your own risk.
            </p>
          </div>

          <div className="mt-10 space-y-8 font-body text-base leading-relaxed text-foreground">
            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">1. Informational Purposes Only</h2>
              <p className="mt-2 text-muted-foreground">
                Everything provided by Peace of Mine — including recall data, safety guidelines, size-up reminders, and product information — is for informational purposes only. Nothing in this app constitutes medical advice, legal advice, professional safety guidance, or a guarantee of any kind. You must always consult qualified professionals (including but not limited to your pediatrician, a certified child passenger safety technician, or product manufacturers) before making decisions about your child's health, safety, or care.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">2. Full Assumption of Risk</h2>
              <p className="mt-2 text-muted-foreground">
                By using Peace of Mine, you explicitly agree that you assume all risk for the physical products you bring into your home. Peace of Mine is an informational tracking aid — not a substitute for checking manufacturer manuals, official recall notices, or seeking professional guidance. You accept full responsibility for verifying product safety, installation, and usage independently of this app. The app does not physically inspect, certify, or approve any product.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">3. Recall Data — "As-Is" and Provided for Reference Only</h2>
              <p className="mt-2 text-muted-foreground">
                Recall information is sourced from third-party government databases including the U.S. Consumer Product Safety Commission (CPSC) and the U.S. Food and Drug Administration (FDA). This data is provided "as is" and serves as a secondary reference tool — not an absolute safety guarantee. Peace of Mine is not responsible for missing, delayed, or incomplete data. The absence of a recall result in this app does not mean a product has been declared safe by any authority. Recalls can be issued at any time, and our database may not reflect the most recent updates.
              </p>
              <p className="mt-2 text-muted-foreground">
                Always verify recall status at the official authoritative source:{" "}
                <a href="https://www.recalls.gov" target="_blank" rel="noopener noreferrer" className="underline">recalls.gov</a>{" "}
                or{" "}
                <a href="https://www.cpsc.gov/Recalls" target="_blank" rel="noopener noreferrer" className="underline">cpsc.gov/Recalls</a>.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">4. No Guarantee of Accuracy or Completeness</h2>
              <p className="mt-2 text-muted-foreground">
                While we aim to keep information helpful and current, we do not guarantee that any reminder, recommendation, safety guideline, or piece of content is accurate, complete, reliable, or suitable for your specific situation. Product specifications, manufacturer guidelines, and recall databases change frequently. You use Peace of Mine at your own discretion and assume full responsibility for any actions taken based on information in this app.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">5. Not a Substitute for Professional Advice</h2>
              <p className="mt-2 text-muted-foreground">
                Peace of Mine is not a replacement for pediatricians, child safety experts, certified child passenger safety technicians, lactation consultants, or any other licensed professional. If you have concerns about your child's safety or wellbeing, contact the appropriate expert immediately. Parental supervision is required at all times regardless of what this app displays.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">6. Safety Guidelines — Manufacturer Specifications Only</h2>
              <p className="mt-2 text-muted-foreground">
                Safety metrics displayed in this app (weight limits, height limits, replacement intervals) are intended to reflect published manufacturer specifications and guidelines from recognized authorities such as the American Academy of Pediatrics (AAP) and the CPSC. These are provided as a reference convenience and must be verified directly against the physical product's manual, warning labels, and manufacturer communications. Never rely on in-app figures as a substitute for reading the actual product manual.
              </p>
              <p className="mt-2 text-muted-foreground">
                These guidelines are automated reference points based on product documentation — they are not a replacement for a pediatrician's evaluation, physical inspection of the product, or the warning labels affixed to the product itself.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">7. Limitation of Liability and Liability Cap</h2>
              <p className="mt-2 text-muted-foreground">
                To the fullest extent permitted by applicable law, Peace of Mine, its developers, officers, employees, and affiliates shall not be liable for any direct, indirect, incidental, consequential, special, or punitive damages — including but not limited to personal injury, property damage, or loss of data — arising from your use of or inability to use this app or its content, whether based in contract, tort, strict liability, or otherwise.
              </p>
              <p className="mt-2 text-muted-foreground">
                In no event shall Peace of Mine's total aggregate liability to any user exceed the greater of (a) fifty dollars ($50.00) USD or (b) the total amount you paid to Peace of Mine in the twelve (12) months preceding the claim. You expressly agree that this liability cap applies regardless of the cause of action or the theory of liability.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">8. Indemnification</h2>
              <p className="mt-2 text-muted-foreground">
                You agree to indemnify, defend, and hold harmless Peace of Mine and its developers, officers, employees, and affiliates from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in any way connected with: (a) your use of the app, (b) your violation of these Terms, (c) your violation of any third-party rights, or (d) any claim that a third-party product you tracked caused harm. Peace of Mine is not liable for defects in third-party products.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">9. Mandatory Arbitration and Class-Action Waiver</h2>
              <p className="mt-2 text-muted-foreground">
                Any dispute, claim, or controversy arising out of or relating to these Terms or your use of Peace of Mine that cannot be resolved informally shall be resolved exclusively through binding individual arbitration administered by a neutral arbitrator under applicable arbitration rules. The arbitration shall be conducted on an individual basis — you waive any right to participate in a class action, class arbitration, or any other consolidated or representative proceeding. You also waive the right to a jury trial. This arbitration provision is governed by the Federal Arbitration Act.
              </p>
              <p className="mt-2 text-muted-foreground">
                To initiate a dispute, contact us at support@peaceofmineapp.com to attempt an informal resolution first. If informal resolution fails within 30 days, either party may commence arbitration.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">10. AI-Generated Content</h2>
              <p className="mt-2 text-muted-foreground">
                Some product safety guidelines displayed in Peace of Mine may be derived from AI-assisted processing of manufacturer documentation. AI-generated content may be incomplete, incorrect, or out of date. Always verify safety information directly with the product manufacturer, a certified child passenger safety technician, or your pediatrician. AI-assisted guidelines are reference points only — not authoritative safety specifications.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">11. Data Refresh Transparency</h2>
              <p className="mt-2 text-muted-foreground">
                Recall data is pulled from government databases on a scheduled basis. A timestamp is displayed in the app whenever recall data is shown, indicating when it was last synced. Because product recalls can be issued at any time, data shown in the app may not reflect a recall issued after the last sync. Always cross-reference with official government sources. The app is a convenience tool, not a real-time monitoring service.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">12. User Responsibility</h2>
              <p className="mt-2 text-muted-foreground">
                You are responsible for independently verifying product expiration dates, recall notices, weight and height limits, installation instructions, and all other safety-critical details directly with manufacturers, certified professionals, and official government sources. Peace of Mine is an organizational tool to help you stay informed — it is not the final authority on any safety matter.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">13. Changes to These Terms</h2>
              <p className="mt-2 text-muted-foreground">
                We may update these Terms from time to time. Continued use of Peace of Mine after changes are posted constitutes acceptance of the revised Terms. Significant changes will be communicated via in-app notice or email.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">14. Contact</h2>
              <p className="mt-2 text-muted-foreground">
                If you have questions about these Terms, reach out to us at{" "}
                <a href="mailto:support@peaceofmineapp.com" className="underline">support@peaceofmineapp.com</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
