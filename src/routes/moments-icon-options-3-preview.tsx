import { createFileRoute } from "@tanstack/react-router";
import "@fontsource/cormorant-garamond/600-italic.css";

export const Route = createFileRoute("/moments-icon-options-3-preview")({
  component: MomentsIconOptions3Preview,
});

const INK = "#586C81";
const LINEN = "#F4F0EA";
const ESPRESSO = "#2B2927";
const TAUPE = "#605C58";

function SketchDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="sketchy4" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" />
        </filter>
      </defs>
    </svg>
  );
}

const wrap = (px: number, children: React.ReactNode) => (
  <svg width={px} height={px} viewBox="0 0 100 100" fill="none" aria-hidden="true">
    {children}
  </svg>
);
// Bolder stroke weight than earlier mockups, closer to the "Scribble Line
// Art" reference's confident doodle-marker line.
const g = (children: React.ReactNode, strokeWidth = 5.5) => (
  <g style={{ filter: "url(#sketchy4)" }} stroke={INK} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none">
    {children}
  </g>
);

// ── Generic category icons ─────────────────────────────────────────────────
const SmileyIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <circle cx="50" cy="50" r="36" />
        <circle cx="37" cy="44" r="3" fill={INK} stroke="none" />
        <circle cx="63" cy="44" r="3" fill={INK} stroke="none" />
        <path d="M32 58 C38 70 62 70 68 58" />
      </>,
    ),
  );

const StarIcon = ({ px }: { px: number }) =>
  wrap(px, g(<path d="M50,10 L59.4,37.1 L88,37.6 L65.2,54.9 L73.5,82.4 L50,66 L26.5,82.4 L34.8,54.9 L12,37.6 L40.6,37.1 Z" />));

const HeartIcon = ({ px }: { px: number }) =>
  wrap(px, g(<path d="M50,32 C50,16 28,14 28,33 C28,48 50,66 50,78 C50,66 72,48 72,33 C72,14 50,16 50,32 Z" />));

const TargetIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <circle cx="50" cy="50" r="38" strokeWidth="5" />
        <circle cx="50" cy="50" r="24" strokeWidth="4.6" />
        <circle cx="50" cy="50" r="10" strokeWidth="4.2" />
      </>,
    ),
  );

// ── Specific milestone icons ────────────────────────────────────────────────
const FirstSmileIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    <>
      {g(
        <>
          <circle cx="46" cy="52" r="30" />
          <path d="M32 44 C35 40 41 40 44 44" strokeWidth="4.4" />
          <path d="M48 44 C51 40 57 40 60 44" strokeWidth="4.4" />
          <path d="M30 60 C36 72 56 72 62 60" strokeWidth="4.6" />
        </>,
      )}
      {g(<path d="M78 20 C79 26 82 29 88 30 C82 31 79 34 78 40 C77 34 74 31 68 30 C74 29 77 26 78 20 Z" />, 2.6)}
    </>,
  );

const RollingOverIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <ellipse cx="46" cy="52" rx="24" ry="18" />
        <circle cx="38" cy="46" r="2.6" fill={INK} stroke="none" />
        <path d="M70 30 C82 38 84 58 72 68" />
        <path d="M64 66 L72 68 L70 60" strokeWidth="4.4" />
      </>,
      4.8,
    ),
  );

const SittingUpIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <circle cx="35" cy="28" r="9" />
        <circle cx="65" cy="28" r="9" />
        <circle cx="50" cy="46" r="26" />
        <circle cx="41" cy="42" r="2.8" fill={INK} stroke="none" />
        <circle cx="59" cy="42" r="2.8" fill={INK} stroke="none" />
        <circle cx="50" cy="53" r="3.4" />
      </>,
    ),
  );

const CrawlingIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M16 58 C22 44 30 44 34 58 C38 72 46 72 50 58 C54 44 62 44 66 58 C70 72 78 72 82 58" strokeWidth="5" />
        <path d="M16 58 L10 50" strokeWidth="3.6" />
        <path d="M16 58 L10 66" strokeWidth="3.6" />
        <circle cx="15" cy="56" r="3" fill={INK} stroke="none" />
      </>,
    ),
  );

const FirstWordsIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M14 22 h72 a6 6 0 0 1 6 6 v32 a6 6 0 0 1 -6 6 h-40 l-16 16 v-16 h-16 a6 6 0 0 1 -6 -6 v-32 a6 6 0 0 1 6 -6 Z" />
        <path d="M30 44 h10 M46 44 h24 M30 54 h34" strokeWidth="4" />
      </>,
    ),
  );

const FirstStepsIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <ellipse cx="38" cy="62" rx="14" ry="21" transform="rotate(-8 38 62)" />
        <circle cx="30" cy="34" r="4.4" />
        <circle cx="39" cy="30" r="4.6" />
        <circle cx="48" cy="32" r="4.2" />
        <ellipse cx="66" cy="42" rx="14" ry="21" transform="rotate(8 66 42)" />
        <circle cx="58" cy="14" r="4.2" />
        <circle cx="67" cy="10" r="4.6" />
        <circle cx="76" cy="12" r="4.4" />
      </>,
      4.4,
    ),
  );

const FirstToothIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <path d="M50 14 C68 14 76 26 74 42 C72 58 68 62 66 80 C64 88 58 88 56 78 C54 68 52 64 50 64 C48 64 46 68 44 78 C42 88 36 88 34 80 C32 62 28 58 26 42 C24 26 32 14 50 14 Z" />,
    ),
  );

const WavingIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M40 88 V54" />
        <path d="M40 54 C34 54 30 48 32 40 L34 20 C34 16 40 16 40 20 L40 38" strokeWidth="4.8" />
        <path d="M40 38 L40 16 C40 12 46 12 46 16 L46 38" strokeWidth="4.8" />
        <path d="M46 38 L46 18 C46 14 52 14 52 18 L52 40" strokeWidth="4.8" />
        <path d="M52 40 L52 22 C52 18 58 19 58 23 L58 44 C58 50 54 54 48 54" strokeWidth="4.8" />
        <path d="M68 20 C71 24 71 30 68 34" strokeWidth="3.6" />
        <path d="M76 14 C81 20 81 30 76 36" strokeWidth="3.6" />
      </>,
    ),
  );

type Option = { label: string; sub?: string; Icon: (p: { px: number }) => React.ReactElement };

const GROUPS: { title: string; options: Option[] }[] = [
  {
    title: "Generic category icons (bolder style)",
    options: [
      { label: "Smiley", sub: "First", Icon: SmileyIcon },
      { label: "Star", sub: "First", Icon: StarIcon },
      { label: "Heart", sub: "First", Icon: HeartIcon },
      { label: "Target", sub: "Milestone", Icon: TargetIcon },
    ],
  },
  {
    title: "Specific milestone icons",
    options: [
      { label: "First smile", Icon: FirstSmileIcon },
      { label: "Rolling over", Icon: RollingOverIcon },
      { label: "Sitting up", Icon: SittingUpIcon },
      { label: "Crawling", Icon: CrawlingIcon },
      { label: "First words", Icon: FirstWordsIcon },
      { label: "First steps", Icon: FirstStepsIcon },
      { label: "First tooth", Icon: FirstToothIcon },
      { label: "Waving", Icon: WavingIcon },
    ],
  },
];

function MomentsIconOptions3Preview() {
  return (
    <div style={{ background: LINEN, minHeight: "100vh", padding: "48px 24px" }}>
      <SketchDefs />
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 32,
            color: INK,
            marginBottom: 8,
          }}
        >
          Milestone icon directory — bolder doodle style
        </h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: TAUPE, marginBottom: 36, maxWidth: 560 }}>
          Inspired by the "Scribble Line Art" reference — bolder, more confident strokes than the earlier delicate-ink mockups.
        </p>

        {GROUPS.map((group) => (
          <div key={group.title} style={{ marginBottom: 44 }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, color: TAUPE, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {group.title}
            </div>
            <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
              {group.options.map((opt) => (
                <div key={opt.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 104 }}>
                  <div
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      border: "1.5px solid #DDD3C4",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 8,
                    }}
                  >
                    <opt.Icon px={44} />
                  </div>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: ESPRESSO, textAlign: "center" }}>{opt.label}</span>
                  {opt.sub && <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: TAUPE }}>{opt.sub}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
