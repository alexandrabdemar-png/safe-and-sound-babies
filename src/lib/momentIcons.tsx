// Hand-drawn icon set for logging a "moment" (src/routes/_authenticated/moments*.tsx,
// src/components/MomentTimeline.tsx). Replaces the old 3-way emoji "type"
// (First/Funny/Milestone) with a flat set of 7 hand-inked icons the user
// picks directly per moment.

import { supabase } from "@/integrations/supabase/client";

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
      console.error(
        "[fetchMilestonesResilient] icon column unavailable — retrying without it",
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
    console.error("[fetchMilestonesResilient] network/unexpected failure", err);
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : "Network error — couldn't load moments" },
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
      console.error("[saveMomentResilient] icon column unavailable — retrying without it", error);
      const { icon: _icon, ...basePayload } = payload;
      ({ error } = await supabase.from("milestones").insert(basePayload as never));
    }
    return { error };
  } catch (err) {
    console.error("[saveMomentResilient] network/unexpected failure", err);
    return {
      error: { message: err instanceof Error ? err.message : "Network error — couldn't save that moment" },
    };
  }
}
