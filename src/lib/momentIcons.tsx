// Hand-drawn icon set for logging a "moment" (src/routes/_authenticated/moments*.tsx,
// src/components/MomentTimeline.tsx). Replaces the old 3-way emoji "type"
// (First/Funny/Milestone) with a flat set of 7 hand-inked icons the user
// picks directly per moment.

import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/sanitize-error";

export type MomentIconKey = "star" | "smiley" | "heart" | "sparkles";

export const MOMENT_ICON_KEYS: MomentIconKey[] = ["star", "smiley", "heart", "sparkles"];

// Neutral, gender-neutral ledger labels. The underlying keys stay the same
// ("star" etc.) so already-saved rows keep resolving, but nothing in the UI
// reads as a heart/star sticker any more.
export const MOMENT_ICON_LABELS: Record<MomentIconKey, string> = {
  star: "Movement",
  smiley: "Words & Sounds",
  heart: "Keepsake",
  sparkles: "Firsts",
};



export const DEFAULT_MOMENT_ICON: MomentIconKey = "star";

// Single neutral ink accent shared by every icon — cards stay the same
// muted white/warm-gray regardless of which icon is picked, matching the
// app's existing "neutral except a couple of deliberate accents" direction.
export const MOMENT_ICON_ACCENT = "#96A5BE";

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

// Whimsical pencil-sketch marks in light periwinkle, matching the hand-drawn
// home page icons (chosen "Whimsical pencil sketch" direction): footprints
// for movement, a round speech bubble for words, a heart for keepsakes, and
// a wobbly five-point star for firsts (replacing the old flag mark).
const StarIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        {/* two little footprints */}
        <path d="M38 30 c-7 0 -11 6 -11 13 c0 6 4 10 9 10 c6 0 10 -6 10 -13 c0 -5 -3 -10 -8 -10 Z" />
        <path d="M62 52 c-7 0 -11 6 -11 13 c0 6 4 10 9 10 c6 0 10 -6 10 -13 c0 -5 -3 -10 -8 -10 Z" />
        <path d="M30 20 c2 -3 6 -3 8 0 M24 30 c1 -3 4 -4 6 -2 M70 40 c2 -3 6 -3 8 0 M64 50 c1 -3 4 -4 6 -2" />
      </>,
      3.5,
    ),
  );

const SmileyIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        {/* round wobbly speech bubble */}
        <path d="M50 16 c-20 0 -34 12 -34 27 c0 9 5 17 13 22 l-4 15 l14 -9 c3 1 7 2 11 2 c20 0 34 -12 34 -27 c0 -15 -14 -30 -34 -30 Z" />
        <path d="M36 42 h6 M48 42 h6 M60 42 h6" />
      </>,
      3.5,
    ),
  );

const HeartIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <path d="M50 82 c-14 -12 -28 -22 -28 -37 c0 -10 8 -17 16 -17 c6 0 10 3 12 8 c2 -5 6 -8 12 -8 c8 0 16 7 16 17 c0 15 -14 25 -28 37 Z" />,
      3.5,
    ),
  );

const SparklesIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        {/* wobbly hand-drawn five-point star */}
        <path d="M50 14 L59 39 L85 40 L64 56 L72 82 L50 66 L28 82 L36 56 L15 40 L41 39 Z" />
        <path d="M84 18 l0 8 M80 22 l8 0 M18 74 l0 8 M14 78 l8 0" />
      </>,
      3.5,
    ),
  );


export const MOMENT_ICONS: Record<MomentIconKey, (props: { px: number }) => React.ReactElement> = {
  star: StarIcon,
  smiley: SmileyIcon,
  heart: HeartIcon,
  sparkles: SparklesIcon,
};

// Milestone-specific hand-drawn marks. When a moment's title names one of
// these milestones, the timeline shows its own mark instead of the generic
// category icon. Same ink, stroke and sketchy filter as the icons above.
const Dot = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
  <circle cx={cx} cy={cy} r={r} fill={INK} stroke="none" />
);

const FootprintsIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        {/* two baby footprints with toes, like an ink footprint keepsake */}
        <path d="M31 91 c-6 0 -10 -5 -9 -12 c1 -6 4 -10 3 -17 c-1 -9 4 -17 13 -17 c8 0 12 7 10 15 c-2 8 -7 12 -8 20 c-1 7 -3 11 -9 11 Z" />
        <Dot cx={46} cy={37} r={4} />
        <Dot cx={39} cy={34.5} r={3.1} />
        <Dot cx={32.8} cy={35.5} r={2.6} />
        <Dot cx={27.6} cy={38.6} r={2.3} />
        <Dot cx={24} cy={43.6} r={2} />
        <path d="M69 65 c6 0 10 -5 9 -12 c-1 -6 -4 -10 -3 -17 c1 -9 -4 -17 -13 -17 c-8 0 -12 7 -10 15 c2 8 7 12 8 20 c1 7 3 11 9 11 Z" />
        <Dot cx={54} cy={11} r={4} />
        <Dot cx={61} cy={8.5} r={3.1} />
        <Dot cx={67.2} cy={9.5} r={2.6} />
        <Dot cx={72.4} cy={12.6} r={2.3} />
        <Dot cx={76} cy={17.6} r={2} />
      </>,
      3.5,
    ),
  );

const SmileIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        {/* wobbly hand-drawn smiley face */}
        <path d="M52 15 c19 0 33 15 33 34 c0 20 -15 36 -35 36 c-19 0 -35 -15 -35 -35 c0 -19 15 -34 33 -35 c5 0 9 1 12 3" />
        <Dot cx={38} cy={42} r={3.6} />
        <Dot cx={62} cy={42} r={3.6} />
        <path d="M33 58 c5 10 13 14 18 14 c7 0 14 -5 17 -14" />
      </>,
      3.5,
    ),
  );

const RollIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        {/* a little round shape with a curling arrow all the way around it */}
        <path d="M80 50 c0 17 -13 30 -30 30 c-17 0 -30 -13 -30 -30 c0 -17 13 -30 30 -30 c10 0 18 4 23 11" />
        <path d="M75 17 l-1 15 l-14 -2" />
        <circle cx="50" cy="50" r="9" />
      </>,
      3.5,
    ),
  );

const CribPeekIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        {/* baby peeking over the crib rail, hands gripping the top */}
        <circle cx="50" cy="30" r="14" />
        <Dot cx={45} cy={28} r={1.8} />
        <Dot cx={55} cy={28} r={1.8} />
        <path d="M12 46 c20 -1 56 1 76 0" />
        <path d="M14 88 c20 1 54 -1 74 0" />
        <path d="M20 46 v42 M38 46 v42 M62 46 v42 M80 46 v42" />
        <path d="M30 47 c-1 -6 3 -9 7 -8 c4 1 5 5 3 8" fill="#FFFDF9" />
        <path d="M70 47 c1 -6 -3 -9 -7 -8 c-4 1 -5 5 -3 8" fill="#FFFDF9" />
      </>,
      3.5,
    ),
  );

export type MilestoneGlyphKey = "first_steps" | "first_smile" | "rolled_over" | "pulling_to_stand";

type MomentGlyph = {
  key: MilestoneGlyphKey;
  label: string;
  Icon: (props: { px: number }) => React.ReactElement;
};

// Order matters: "pulled up to stand and took steps" should read as steps,
// so the more advanced milestone is checked first.
const MILESTONE_GLYPHS: (MomentGlyph & { pattern: RegExp })[] = [
  { key: "first_steps", label: "First steps", Icon: FootprintsIcon, pattern: /\bsteps?\b|\bwalk(ed|ing|s)?\b/i },
  {
    key: "pulling_to_stand",
    label: "Pulling to stand",
    Icon: CribPeekIcon,
    pattern: /\bpull(ed|ing|s)?\s+(up|to\s+stand|(him|her|them)sel(f|ves)\s+up)|\bstood\b|\bstand(ing)?\b/i,
  },
  { key: "rolled_over", label: "Rolled over", Icon: RollIcon, pattern: /\broll(ed|ing|s)?\b/i },
  { key: "first_smile", label: "First smile", Icon: SmileIcon, pattern: /\bsmil(e|ed|es|ing)\b/i },
];

/** The milestone-specific mark for a moment title, or null if none applies. */
export function milestoneGlyphFor(title: string | null | undefined): MomentGlyph | null {
  if (!title) return null;
  const hit = MILESTONE_GLYPHS.find(({ pattern }) => pattern.test(title));
  return hit ? { key: hit.key, label: hit.label, Icon: hit.Icon } : null;
}

/** Icon and accessible label to draw for a moment: its milestone mark when
 * the title names one, otherwise its saved category icon. */
export function momentGlyph(
  title: string | null | undefined,
  resolvedIcon: MomentIconKey,
): { Icon: (props: { px: number }) => React.ReactElement; label: string } {
  return milestoneGlyphFor(title) ?? { Icon: MOMENT_ICONS[resolvedIcon], label: MOMENT_ICON_LABELS[resolvedIcon] };
}

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
  Milestone: "star",
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
 * True when a milestones insert error means the `icon` column isn't
 * usable yet on the live database — either PostgREST's schema cache
 * hasn't reloaded after the migration ("Could not find the 'icon'
 * column ... in the schema cache"), or the column genuinely doesn't
 * exist there yet ("column milestones.icon does not exist", Postgres
 * error code 42703 / undefined_column). Either way, a moment save
 * should retry without the `icon` field rather than failing outright.
 */
export function isIconColumnUnavailableError(error: {
  message: string;
  code?: string | null;
}): boolean {
  if (!/icon/i.test(error.message)) return false;
  if (error.code === "42703") return true; // Postgres: undefined_column
  return /schema cache/i.test(error.message) || /does not exist/i.test(error.message);
}

type RawMilestoneRow = {
  id: string;
  title: string;
  logged_at: string | null;
  notes: string | null;
  icon: string | null;
};

/**
 * Reads recent milestones ("moments") for a child, tolerating the live
 * icon-column-unavailable bug: if the select including `icon` fails for
 * that specific reason, transparently retries without it (icon defaults to
 * null on every row) instead of surfacing an error and leaving the page
 * looking like nothing was ever saved. Used by both the Home page's
 * moments widget and the full Moments timeline page so the fallback only
 * has to be written — and tested — once.
 */
export async function fetchMilestonesResilient(
  childId: string,
  opts: { limit?: number } = {},
): Promise<{
  data: RawMilestoneRow[] | null;
  error: { message: string; code?: string | null } | null;
}> {
  try {
    const baseQuery = supabase
      .from("milestones")
      .select("id, title, logged_at, notes, icon")
      .eq("child_id", childId)
      .order("logged_at", { ascending: false })
      .order("created_at", { ascending: false });
    const first = await (opts.limit ? baseQuery.limit(opts.limit) : baseQuery);

    if (first.error && isIconColumnUnavailableError(first.error)) {
      logError("[fetchMilestonesResilient] icon column unavailable — retrying without it",
        first.error,
      );
      const fallbackQuery = supabase
        .from("milestones")
        .select("id, title, logged_at, notes")
        .eq("child_id", childId)
        .order("logged_at", { ascending: false })
        .order("created_at", { ascending: false });
      const retry = await (opts.limit ? fallbackQuery.limit(opts.limit) : fallbackQuery);
      return {
        data: retry.data ? retry.data.map((m) => ({ ...m, icon: null })) : null,
        error: retry.error,
      };
    }
    return first as unknown as {
      data: RawMilestoneRow[] | null;
      error: { message: string; code?: string | null } | null;
    };
  } catch (err) {
    // A thrown (not resolved-with-error) exception — e.g. the network
    // request itself failing outright (offline, DNS, CORS) rather than
    // the server returning an error response. Without this, the caller's
    // loading state can get stuck forever (see saveMomentResilient below
    // for the write-side version of the same bug class).
    logError("[fetchMilestonesResilient] network/unexpected failure", err);
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : "Network error — couldn't load moments",
      },
    };
  }
}

type MomentInsertPayload = {
  child_id: string;
  title: string;
  logged_at: string;
  notes: string | null;
  completed: boolean;
  icon: string;
};

/**
 * Saves a new moment, tolerating the live icon-column-unavailable bug the
 * same way fetchMilestonesResilient does for reads: retries without
 * `icon` if that specific column is the problem. Also catches any thrown
 * (not resolved-with-error) exception — e.g. a genuine network failure —
 * so a caller's "saving" state can always be cleared and an honest error
 * shown, instead of the save silently hanging with no feedback (reported
 * bug: "moments may not be saving reliably").
 */
export async function saveMomentResilient(
  payload: MomentInsertPayload,
): Promise<{ error: { message: string; code?: string | null } | null }> {
  try {
    let { error } = await supabase.from("milestones").insert(payload as never);
    if (error && isIconColumnUnavailableError(error)) {
      logError("[saveMomentResilient] icon column unavailable — retrying without it", error);
      const { icon: _icon, ...basePayload } = payload;
      ({ error } = await supabase.from("milestones").insert(basePayload as never));
    }
    return { error };
  } catch (err) {
    logError("[saveMomentResilient] network/unexpected failure", err);
    return {
      error: {
        message: err instanceof Error ? err.message : "Network error — couldn't save that moment",
      },
    };
  }
}
