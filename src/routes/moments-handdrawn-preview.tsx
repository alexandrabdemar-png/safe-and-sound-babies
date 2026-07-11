import { createFileRoute } from "@tanstack/react-router";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/600-italic.css";
import "@fontsource/cormorant-garamond/500.css";

export const Route = createFileRoute("/moments-handdrawn-preview")({
  component: MomentsHandDrawnPreview,
});

const INK = "#586C81";
const LINEN = "#F4F0EA";
const ESPRESSO = "#2B2927";
const TAUPE = "#605C58";

// Shared "sketchy" filter — a mild feTurbulence displacement so otherwise
// perfect geometric shapes (star, circles) read as hand-inked rather than
// vector-clean, without needing hand-authored wobble in every path.
function SketchDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="sketchy" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" />
        </filter>
      </defs>
    </svg>
  );
}

function StarIcon({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path
        d="M50,10 L59.4,37.1 L88,37.6 L65.2,54.9 L73.5,82.4 L50,66 L26.5,82.4 L34.8,54.9 L12,37.6 L40.6,37.1 Z"
        stroke={INK}
        strokeWidth="3.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: "url(#sketchy)" }}
      />
    </svg>
  );
}

function LaughIcon({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <g style={{ filter: "url(#sketchy)" }} stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M50 12 C74 12 88 30 88 50 C88 72 70 88 50 88 C28 88 12 71 12 50 C12 29 28 12 50 12 Z" />
        <path d="M30 42 C33 37 39 37 42 42" />
        <path d="M58 42 C61 37 67 37 70 42" />
        <path d="M28 58 C34 74 66 74 72 58" />
      </g>
    </svg>
  );
}

function TargetIcon({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <g style={{ filter: "url(#sketchy)" }} stroke={INK} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="50" cy="50" r="38" strokeWidth="3" />
        <circle cx="50" cy="50" r="25" strokeWidth="2.6" />
        <circle cx="50" cy="50" r="12" strokeWidth="2.4" />
        <circle cx="50" cy="50" r="3.2" fill={INK} stroke="none" />
      </g>
    </svg>
  );
}

const ICONS: Record<string, (props: { px: number }) => React.ReactElement> = {
  First: StarIcon,
  Funny: LaughIcon,
  Milestone: TargetIcon,
};

const SAMPLE = [
  { type: "First", date: "6:14 AM", title: "First smile", desc: "A big gummy grin right after her morning feed — completely unprompted.", age: "3 weeks old" },
  { type: "Milestone", date: "9 AM", title: "Rolled over", desc: "Back to tummy, twice in a row! Very proud of herself about it.", age: "4 months old" },
  { type: "Funny", date: "5:40 PM", title: "Stared down the dog", desc: "Long, serious eye contact with Biscuit over a dropped cracker.", age: "6 months old" },
  { type: "First", date: "11 AM", title: "First taste of banana", desc: "Unimpressed at first, then demanded more with both hands.", age: "6 months old" },
  { type: "Milestone", date: "7:20 PM", title: "Said \"mama\"", desc: "Clear as day, twice, while reaching for the bottle.", age: "9 months old" },
];

function MomentsHandDrawnPreview() {
  return (
    <div style={{ background: LINEN, minHeight: "100vh", padding: "56px 24px" }}>
      <SketchDefs />
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 40,
            color: INK,
            marginBottom: 4,
          }}
        >
          Moments Timeline
        </h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: TAUPE, marginBottom: 48 }}>
          Inspired by the hand-drawn wedding-timeline reference — solid ink spine, hand-sketched milestone icons.
        </p>

        <div style={{ position: "relative", paddingLeft: 64 }}>
          {/* Solid ink spine */}
          <div style={{ position: "absolute", left: 27, top: 8, bottom: 8, width: 2, background: INK, opacity: 0.55 }} />

          {SAMPLE.map((m, i) => {
            const Icon = ICONS[m.type];
            return (
              <div key={i} style={{ position: "relative", marginBottom: 44 }}>
                {/* Hand-drawn icon, straddling the spine */}
                <div style={{ position: "absolute", left: -64, top: -6, width: 56, display: "flex", justifyContent: "center" }}>
                  <Icon px={38} />
                </div>
                {/* Dot on the spine */}
                <div
                  style={{
                    position: "absolute",
                    left: -37 + 27,
                    top: 14,
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: LINEN,
                    border: `2px solid ${INK}`,
                  }}
                />

                <div
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    color: TAUPE,
                    marginBottom: 4,
                  }}
                >
                  {m.date} · {m.age}
                </div>
                <h2
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontStyle: "italic",
                    fontWeight: 600,
                    fontSize: 24,
                    color: ESPRESSO,
                    textDecoration: "underline",
                    textDecorationColor: "#B8A899",
                    textUnderlineOffset: "5px",
                    margin: "0 0 6px",
                  }}
                >
                  {m.title}
                </h2>
                <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: 14, lineHeight: 1.6, color: TAUPE, margin: 0 }}>
                  {m.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
