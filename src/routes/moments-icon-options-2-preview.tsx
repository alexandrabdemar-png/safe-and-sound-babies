import { createFileRoute } from "@tanstack/react-router";
import "@fontsource/cormorant-garamond/600-italic.css";

export const Route = createFileRoute("/moments-icon-options-2-preview")({
  component: MomentsIconOptions2Preview,
});

const INK = "#586C81";
const LINEN = "#F4F0EA";
const ESPRESSO = "#2B2927";
const TAUPE = "#605C58";

function SketchDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="sketchy3" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" />
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
const g = (children: React.ReactNode, strokeWidth = 3) => (
  <g style={{ filter: "url(#sketchy3)" }} stroke={INK} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none">
    {children}
  </g>
);

// ── "First" — batch 2 ─────────────────────────────────────────────────────
const ConfettiIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M50 50 L34 30" />
        <path d="M50 50 L70 32" />
        <path d="M50 50 L74 58" />
        <path d="M50 50 L30 66" />
        <circle cx="26" cy="24" r="3" fill={INK} stroke="none" />
        <circle cx="78" cy="26" r="2.6" fill={INK} stroke="none" />
        <path d="M76 68 L82 74 M82 68 L76 74" />
        <path d="M22 72 L28 78 M28 72 L22 78" />
      </>,
      2.6,
    ),
  );

const GiftBowIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M50 44 C40 20 16 24 22 38 C27 50 44 46 50 44 Z" />
        <path d="M50 44 C60 20 84 24 78 38 C73 50 56 46 50 44 Z" />
        <circle cx="50" cy="46" r="6" />
        <path d="M50 52 L44 90" />
        <path d="M50 52 L56 90" />
      </>,
      2.8,
    ),
  );

const RainbowIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M14 78 C14 46 34 26 50 26 C66 26 86 46 86 78" strokeWidth="4" />
        <path d="M26 78 C26 52 40 38 50 38 C60 38 74 52 74 78" strokeWidth="3.4" />
        <circle cx="16" cy="80" r="6" />
        <circle cx="84" cy="80" r="6" />
      </>,
      3,
    ),
  );

const CandleIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M42 40 h16 v50 h-16 Z" />
        <path d="M42 50 h16 M42 60 h16 M42 70 h16" strokeWidth="1.6" />
        <path d="M50 12 C56 22 58 28 50 36 C42 28 44 22 50 12 Z" />
      </>,
      2.8,
    ),
  );

// ── "Funny" — batch 2 ──────────────────────────────────────────────────────
const SillyFaceIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M50 12 C74 12 88 30 88 50 C88 72 70 88 50 88 C28 88 12 71 12 50 C12 29 28 12 50 12 Z" />
        <path d="M28 36 L40 46 M40 36 L28 46" strokeWidth="2.4" />
        <path d="M60 36 L72 46 M72 36 L60 46" strokeWidth="2.4" />
        <path d="M32 60 C38 72 62 72 68 60" />
        <path d="M42 68 C42 80 58 80 58 68 Z" />
      </>,
      3.2,
    ),
  );

const BananaPeelIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M40 16 C24 22 18 44 26 62 C32 76 48 82 58 76" />
        <path d="M40 16 C36 26 38 34 44 38" strokeWidth="2" />
        <path d="M58 76 C64 70 66 60 62 52" strokeWidth="2" />
        <path d="M40 16 C46 12 52 14 54 20" />
      </>,
      2.8,
    ),
  );

const DizzyFaceIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M50 12 C74 12 88 30 88 50 C88 72 70 88 50 88 C28 88 12 71 12 50 C12 29 28 12 50 12 Z" />
        <path d="M28 34 C32 30 38 30 38 36 C38 41 31 41 32 37" strokeWidth="2" />
        <path d="M62 34 C66 30 72 30 72 36 C72 41 65 41 66 37" strokeWidth="2" />
        <ellipse cx="50" cy="66" rx="9" ry="6" />
      </>,
      3,
    ),
  );

const LolBubbleIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    <>
      {g(<path d="M14 20 h72 a6 6 0 0 1 6 6 v34 a6 6 0 0 1 -6 6 h-42 l-14 14 v-14 h-16 a6 6 0 0 1 -6 -6 v-34 a6 6 0 0 1 6 -6 Z" />, 3)}
      <text x="50" y="49" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontStyle="italic" fontWeight={600} fontSize="22" fill={INK}>
        lol
      </text>
    </>,
  );

// ── "Milestone" — batch 2 ───────────────────────────────────────────────────
const GrowthArrowIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M16 82 L38 60 L52 72 L84 20" />
        <path d="M66 20 L84 20 L84 38" />
      </>,
      3.2,
    ),
  );

const RocketIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M50 10 C64 24 66 46 60 64 L40 64 C34 46 36 24 50 10 Z" />
        <circle cx="50" cy="38" r="7" />
        <path d="M40 56 L26 70 L40 66 Z" />
        <path d="M60 56 L74 70 L60 66 Z" />
        <path d="M44 64 L40 86 L50 76 L60 86 L56 64" strokeWidth="2.4" />
      </>,
      2.8,
    ),
  );

const MountainFlagIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M10 82 L38 34 L52 54 L64 38 L90 82 Z" />
        <path d="M52 54 L60 66 L44 66 Z" strokeWidth="2" />
        <path d="M60 16 V44" strokeWidth="2.6" />
        <path d="M60 16 L78 22 L60 28 Z" strokeWidth="2.6" />
      </>,
      2.8,
    ),
  );

const CrownIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M18 42 L34 66 L50 30 L66 66 L82 42 L76 78 H24 Z" />
        <circle cx="18" cy="38" r="4" />
        <circle cx="50" cy="26" r="4" />
        <circle cx="82" cy="38" r="4" />
      </>,
      2.8,
    ),
  );

type Option = { label: string; Icon: (p: { px: number }) => React.ReactElement };

const GROUPS: { title: string; options: Option[] }[] = [
  {
    title: "First — more options",
    options: [
      { label: "Confetti", Icon: ConfettiIcon },
      { label: "Gift bow", Icon: GiftBowIcon },
      { label: "Rainbow", Icon: RainbowIcon },
      { label: "Birthday candle", Icon: CandleIcon },
    ],
  },
  {
    title: "Funny — more options",
    options: [
      { label: "Silly face", Icon: SillyFaceIcon },
      { label: "Banana peel", Icon: BananaPeelIcon },
      { label: "Dizzy face", Icon: DizzyFaceIcon },
      { label: "“lol” bubble", Icon: LolBubbleIcon },
    ],
  },
  {
    title: "Milestone — more options",
    options: [
      { label: "Growth arrow", Icon: GrowthArrowIcon },
      { label: "Rocket", Icon: RocketIcon },
      { label: "Mountain + flag", Icon: MountainFlagIcon },
      { label: "Crown", Icon: CrownIcon },
    ],
  },
];

function MomentsIconOptions2Preview() {
  return (
    <div style={{ background: LINEN, minHeight: "100vh", padding: "48px 24px" }}>
      <SketchDefs />
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 32,
            color: INK,
            marginBottom: 36,
          }}
        >
          More hand-drawn icon options
        </h1>

        {GROUPS.map((group) => (
          <div key={group.title} style={{ marginBottom: 44 }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, color: TAUPE, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {group.title}
            </div>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              {group.options.map((opt) => (
                <div key={opt.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 110 }}>
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
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
