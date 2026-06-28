import { parseMomentType, TYPE_STYLES } from "@/routes/_authenticated/moments";

export type Moment = {
  id: string;
  title: string;
  logged_at: string | null;
  notes: string | null;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function calcAgeAt(dob: string, loggedAt: string): string {
  const birth = new Date(dob + "T00:00:00");
  const at = new Date(loggedAt + "T00:00:00");
  const totalDays = Math.max(0, Math.floor((at.getTime() - birth.getTime()) / 86400000));
  const totalMonths = Math.floor(totalDays / 30.44);
  const weeks = Math.floor((totalDays % 30.44) / 7);
  if (totalMonths < 3) {
    const w = Math.floor(totalDays / 7);
    return `${w}w`;
  }
  if (weeks > 0) return `${totalMonths}m ${weeks}w`;
  return `${totalMonths}m`;
}

export function MomentTimeline({
  moments,
  childName,
  childDob,
}: {
  moments: Moment[];
  childName?: string;
  childDob?: string | null;
}) {
  return (
    <ul className="space-y-3">
      {moments.map((m) => {
        const { type, displayNotes } = parseMomentType(m.notes);
        const s = TYPE_STYLES[type];
        const age = childName && childDob && m.logged_at ? calcAgeAt(childDob, m.logged_at) : null;
        const isLetter = type === "Letter";
        return (
          <li
            key={m.id}
            className="rounded-2xl px-4 py-3"
            style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span
                className="rounded-full px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider"
                style={{ backgroundColor: s.accent + "22", color: s.accent }}
              >
                {s.emoji} {type}
              </span>
              <div className="flex items-center gap-1.5">
                {age && childName && (
                  <span className="font-body text-[10px] italic text-muted-foreground">
                    {childName} at {age}
                  </span>
                )}
                <span className="font-body text-[10px] text-muted-foreground">{formatDate(m.logged_at)}</span>
              </div>
            </div>
            <p className="font-display text-sm font-semibold tracking-tight text-foreground">
              {m.title}
            </p>
            {displayNotes && (
              <p className={`mt-1 font-body text-xs leading-relaxed text-muted-foreground ${isLetter ? "italic" : ""}`}>
                {displayNotes.length > 120 ? displayNotes.slice(0, 120) + "…" : displayNotes}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
