import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500.css";

export const Route = createFileRoute("/landing-hero-mockup-preview")({
  component: LandingHeroMockup,
});

const LINEN = "#F4F0EA";
const ESPRESSO = "#2B2927";
const SAGE = "#9BB2A7";
const TAUPE_TEXT = "#605C58";
const TAUPE_BORDER = "#B8A899";
const CLAY_BUTTON = "#7D756D";

function LandingHeroMockup() {
  return (
    <div style={{ background: LINEN, minHeight: "100vh" }}>
      <Header />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section style={{ padding: "72px 24px 96px", maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ maxWidth: "60%", minWidth: 320 }}>
          {/* Micro-headline (was the pill) */}
          <div
            style={{
              fontFamily: '"Inter", sans-serif',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: TAUPE_TEXT,
              marginBottom: 20,
            }}
          >
            A higher standard for baby safety
          </div>

          {/* Headline */}
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 400,
              fontSize: 64,
              lineHeight: 1.08,
              color: ESPRESSO,
              margin: 0,
            }}
          >
            Stay on top of every{" "}
            <em style={{ fontStyle: "italic", color: SAGE }}>safety</em>
            <br />
            milestone.
          </h1>

          {/* Generous space before body copy */}
          <div style={{ height: 48 }} />

          {/* Main hook */}
          <p
            style={{
              fontFamily: '"Inter", sans-serif',
              fontWeight: 300,
              fontSize: 19,
              lineHeight: 1.6,
              color: TAUPE_TEXT,
              maxWidth: 480,
              margin: 0,
            }}
          >
            Peace of Mine keeps track of the vital details for you—from gear
            expiry to age-specific safety fits—with effortless, timely
            reminders.
          </p>

          {/* Lightweight CTA — text link with delicate arrow */}
          <Link
            to="/auth"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: 36,
              fontFamily: '"Inter", sans-serif',
              fontWeight: 400,
              fontSize: 15,
              letterSpacing: "0.03em",
              color: ESPRESSO,
              textDecoration: "none",
              borderBottom: `1px solid ${TAUPE_BORDER}`,
              paddingBottom: 4,
            }}
          >
            Get started free <span style={{ fontWeight: 300 }}>→</span>
          </Link>
        </div>

        {/* Detail split — offset lower, generous spacing */}
        <div
          style={{
            marginTop: 88,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 56,
            maxWidth: 720,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 500,
                fontSize: 22,
                color: ESPRESSO,
                marginBottom: 10,
              }}
            >
              Track Effortlessly
            </div>
            <p
              style={{
                fontFamily: '"Inter", sans-serif',
                fontWeight: 300,
                fontSize: 15,
                lineHeight: 1.6,
                color: TAUPE_TEXT,
                margin: 0,
              }}
            >
              Add any baby essential—from car seats and cribs to bottles and
              carriers. We monitor the details so you don't have to.
            </p>
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 500,
                fontSize: 22,
                color: ESPRESSO,
                marginBottom: 10,
              }}
            >
              Informed Guidance
            </div>
            <p
              style={{
                fontFamily: '"Inter", sans-serif',
                fontWeight: 300,
                fontSize: 15,
                lineHeight: 1.6,
                color: TAUPE_TEXT,
                margin: 0,
              }}
            >
              Tailored reminders tell you exactly when it's time to replace,
              resize, or double-check the fit.
            </p>
          </div>
        </div>

        {/* Reference-only alternate CTA styles, so the choice is visible side by side */}
        <div style={{ marginTop: 72, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 12, color: TAUPE_TEXT }}>
            Alternate CTA styles (for comparison only):
          </span>
          <button
            style={{
              background: "transparent",
              border: `1px solid ${TAUPE_BORDER}`,
              borderRadius: 50,
              padding: "12px 28px",
              fontFamily: '"Inter", sans-serif',
              fontWeight: 400,
              letterSpacing: "0.03em",
              color: ESPRESSO,
              cursor: "pointer",
            }}
          >
            Get started free
          </button>
          <button
            style={{
              background: CLAY_BUTTON,
              color: LINEN,
              border: "none",
              borderRadius: 50,
              padding: "12px 28px",
              fontFamily: '"Inter", sans-serif',
              fontWeight: 400,
              letterSpacing: "0.03em",
              cursor: "pointer",
            }}
          >
            Get started free
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
