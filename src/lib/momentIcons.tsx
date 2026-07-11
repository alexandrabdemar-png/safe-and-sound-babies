// Hand-drawn icon set for logging a "moment" (src/routes/_authenticated/moments*.tsx,
// src/components/MomentTimeline.tsx). Replaces the old 3-way emoji "type"
// (First/Funny/Milestone) with a flat set of 7 hand-inked icons the user
// picks directly per moment.

export type MomentIconKey = "star" | "smiley" | "heart" | "target";

export const MOMENT_ICON_KEYS: MomentIconKey[] = ["star", "smiley", "heart", "target"];

export const MOMENT_ICON_LABELS: Record<MomentIconKey, string> = {
  star: "Star",
  smiley: "Smiley",
  heart: "Heart",
  target: "Target",
};

export const DEFAULT_MOMENT_ICON: MomentIconKey = "star";

// Single neutral ink accent shared by every icon — cards stay the same
// muted white/warm-gray regardless of which icon is picked, matching the
// app's existing "neutral except a couple of deliberate accents" direction.
export const MOMENT_ICON_ACCENT = "#586C81";

const INK = MOMENT_ICON_ACCENT;

export function SketchDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="moment-sketchy" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04"
            numOctaves="2"
            seed="7"
            result="noise"
          />
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
const g = (children: React.ReactNode, strokeWidth = 5.5) => (
  <g
    style={{ filter: "url(#moment-sketchy)" }}
    stroke={INK}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  >
    {children}
  </g>
);

const StarIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <path d="M50,10 L59.4,37.1 L88,37.6 L65.2,54.9 L73.5,82.4 L50,66 L26.5,82.4 L34.8,54.9 L12,37.6 L40.6,37.1 Z" />,
    ),
  );

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

const HeartIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <path d="M50,32 C50,16 28,14 28,33 C28,48 50,66 50,78 C50,66 72,48 72,33 C72,14 50,16 50,32 Z" />,
    ),
  );

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

export const MOMENT_ICONS: Record<MomentIconKey, (props: { px: number }) => React.ReactElement> = {
  star: StarIcon,
  smiley: SmileyIcon,
  heart: HeartIcon,
  target: TargetIcon,
};

function isMomentIconKey(value: string | null | undefined): value is MomentIconKey {
  return !!value && (MOMENT_ICON_KEYS as string[]).includes(value);
}

/**
 * Strips a legacy `[First]`/`[Funny]`/`[Milestone]` prefix (the old
 * pre-icon-column scheme — see moments.tsx history) from notes, returning
 * both the bare notes and the legacy type if one was found, so old rows
 * saved before the `icon` column existed still resolve to a sensible icon.
 */
export function parseLegacyNotes(notes: string | null): {
  legacyType: "First" | "Funny" | "Milestone" | null;
  displayNotes: string;
} {
  if (!notes) return { legacyType: null, displayNotes: "" };
  const match = notes.match(/^\[(First|Funny|Milestone)\]\s?/);
  if (match) {
    return {
      legacyType: match[1] as "First" | "Funny" | "Milestone",
      displayNotes: notes.slice(match[0].length),
    };
  }
  return { legacyType: null, displayNotes: notes };
}

const LEGACY_TYPE_TO_ICON: Record<"First" | "Funny" | "Milestone", MomentIconKey> = {
  First: "star",
  Funny: "smiley",
  Milestone: "target",
};

/** Resolves the icon to render for a moment: the dedicated `icon` column if
 * present and valid, else inferred from a legacy `[Type]` notes prefix,
 * else the default. */
export function resolveMomentIcon(
  icon: string | null | undefined,
  legacyType: "First" | "Funny" | "Milestone" | null,
): MomentIconKey {
  if (isMomentIconKey(icon)) return icon;
  if (legacyType) return LEGACY_TYPE_TO_ICON[legacyType];
  return DEFAULT_MOMENT_ICON;
}

/**
 * True when a PostgREST insert error is the live "icon column not in the
 * schema cache yet" bug (migration applied to Postgres but PostgREST's
 * cache hasn't reloaded) — the case where a moment save should be retried
 * without the `icon` field rather than failing outright.
 */
export function isIconSchemaCacheError(errorMessage: string): boolean {
  return /icon/i.test(errorMessage) && /schema cache/i.test(errorMessage);
}
