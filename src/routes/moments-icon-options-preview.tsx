import { createFileRoute } from "@tanstack/react-router";
import "@fontsource/cormorant-garamond/600-italic.css";

export const Route = createFileRoute("/moments-icon-options-preview")({
  component: MomentsIconOptionsPreview,
});

const INK = "#586C81";
const LINEN = "#F4F0EA";
const ESPRESSO = "#2B2927";
const TAUPE = "#605C58";

function SketchDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="sketchy2" x="-20%" y="-20%" width="140%" height="140%">
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
  <g style={{ filter: "url(#sketchy2)" }} stroke={INK} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none">
    {children}
  </g>
);

// ── "First" alternatives ─────────────────────────────────────────────────
const StarIcon = ({ px }: { px: number }) =>
  wrap(px, g(<path d="M50,10 L59.4,37.1 L88,37.6 L65.2,54.9 L73.5,82.4 L50,66 L26.5,82.4 L34.8,54.9 L12,37.6 L40.6,37.1 Z" />));

const BalloonIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M50,12 C66,12 74,26 71,40 C68,55 58,66 50,66 C42,66 32,55 29,40 C26,26 34,12 50,12 Z" />
        <path d="M46,66 L44,71 L56,71 L54,66" />
        <path d="M50,71 C50,78 44,80 48,86 C52,92 46,94 50,96" strokeWidth="2.2" />
      </>,
    ),
  );

const RosetteIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <circle cx="50" cy="38" r="22" />
        <circle cx="50" cy="38" r="9" />
        <path d="M36,56 L26,90 L44,78 Z" />
        <path d="M64,56 L74,90 L56,78 Z" />
      </>,
    ),
  );

const SparkleIcon = ({ px }: { px: number }) =>
  wrap(px, g(<path d="M50,8 C53,30 70,47 92,50 C70,53 53,70 50,92 C47,70 30,53 8,50 C30,47 47,30 50,8 Z" />));

// ── "Funny" alternatives ─────────────────────────────────────────────────
const LaughIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M50 12 C74 12 88 30 88 50 C88 72 70 88 50 88 C28 88 12 71 12 50 C12 29 28 12 50 12 Z" />
        <path d="M30 42 C33 37 39 37 42 42" />
        <path d="M58 42 C61 37 67 37 70 42" />
        <path d="M28 58 C34 74 66 74 72 58" />
      </>,
      3.2,
    ),
  );

const WinkIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M50 12 C74 12 88 30 88 50 C88 72 70 88 50 88 C28 88 12 71 12 50 C12 29 28 12 50 12 Z" />
        <path d="M28 42 C31 38 39 38 42 42" />
        <circle cx="64" cy="43" r="3.4" fill={INK} stroke="none" />
        <path d="M30 58 C40 68 60 68 70 58" />
      </>,
      3.2,
    ),
  );

const TongueOutIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M50 12 C74 12 88 30 88 50 C88 72 70 88 50 88 C28 88 12 71 12 50 C12 29 28 12 50 12 Z" />
        <path d="M30 40 L40 40" />
        <path d="M60 40 L70 40" />
        <path d="M28 56 C34 68 66 68 72 56" />
        <path d="M42 66 C42 78 58 78 58 66 Z" />
      </>,
      3.2,
    ),
  );

const HaHaBubbleIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    <>
      {g(
        <>
          <path d="M14 20 h72 a6 6 0 0 1 6 6 v34 a6 6 0 0 1 -6 6 h-42 l-14 14 v-14 h-16 a6 6 0 0 1 -6 -6 v-34 a6 6 0 0 1 6 -6 Z" />
        </>,
        3,
      )}
      <text x="50" y="49" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontStyle="italic" fontWeight={600} fontSize="20" fill={INK}>
        ha ha
      </text>
    </>,
  );

// ── "Milestone" alternatives ─────────────────────────────────────────────
const TargetIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <circle cx="50" cy="50" r="38" strokeWidth="3" />
        <circle cx="50" cy="50" r="25" strokeWidth="2.6" />
        <circle cx="50" cy="50" r="12" strokeWidth="2.4" />
        <circle cx="50" cy="50" r="3.2" fill={INK} stroke="none" />
      </>,
    ),
  );

const TrophyIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M32 16 h36 v20 c0 14 -8 24 -18 24 c-10 0 -18 -10 -18 -24 Z" />
        <path d="M32 20 c-10 0 -14 6 -14 12 c0 8 8 12 16 12" />
        <path d="M68 20 c10 0 14 6 14 12 c0 8 -8 12 -16 12" />
        <path d="M50 60 v10" />
        <path d="M38 84 h24" />
        <path d="M42 70 h16 l3 14 h-22 Z" />
      </>,
      2.8,
    ),
  );

const FootprintsIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <ellipse cx="36" cy="60" rx="13" ry="20" transform="rotate(-10 36 60)" />
        <circle cx="28" cy="34" r="4" />
        <circle cx="36" cy="30" r="4.2" />
        <circle cx="44" cy="31" r="3.8" />
        <circle cx="50" cy="35" r="3.2" />
        <ellipse cx="66" cy="46" rx="13" ry="20" transform="rotate(10 66 46)" />
        <circle cx="58" cy="20" r="3.2" />
        <circle cx="64" cy="16" r="3.8" />
        <circle cx="72" cy="17" r="4.2" />
        <circle cx="80" cy="21" r="4" />
      </>,
      2.6,
    ),
  );

const FlagIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M30 92 V14" />
        <path d="M30 18 C50 10 55 26 78 18 C74 30 74 38 78 46 C55 54 50 38 30 46 Z" />
      </>,
      3,
    ),
  );

type Option = { label: string; Icon: (p: { px: number }) => React.ReactElement; current?: boolean };

const GROUPS: { title: string; options: Option[] }[] = [
  {
    title: "First",
    options: [
      { label: "Star (current)", Icon: StarIcon, current: true },
      { label: "Balloon", Icon: BalloonIcon },
      { label: "Rosette", Icon: RosetteIcon },
      { label: "Sparkle", Icon: SparkleIcon },
    ],
  },
  {
    title: "Funny",
    options: [
      { label: "Laughing face (current)", Icon: LaughIcon, current: true },
      { label: "Wink", Icon: WinkIcon },
      { label: "Tongue out", Icon: TongueOutIcon },
      { label: "“ha ha” bubble", Icon: HaHaBubbleIcon },
    ],
  },
  {
    title: "Milestone",
    options: [
      { label: "Target (current)", Icon: TargetIcon, current: true },
      { label: "Trophy", Icon: TrophyIcon },
      { label: "Footprints", Icon: FootprintsIcon },
      { label: "Flag", Icon: FlagIcon },
    ],
  },
];

function MomentsIconOptionsPreview() {
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
          Hand-drawn icon options
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
                      border: `1.5px solid ${opt.current ? INK : "#DDD3C4"}`,
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
