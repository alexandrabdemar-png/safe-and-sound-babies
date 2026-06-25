export type Moment = {
  id: string;
  title: string;
  logged_at: string | null;
  notes: string | null;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function MomentTimeline({ moments }: { moments: Moment[] }) {
  return (
    <ul className="space-y-3">
      {moments.map((m) => (
        <li key={m.id} className="rounded-2xl border border-border/60 bg-card px-4 py-3">
          <p className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {formatDate(m.logged_at)}
          </p>
          <p className="mt-1 font-display text-sm font-semibold tracking-tight text-foreground">
            {m.title}
          </p>
          {m.notes && (
            <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
              {m.notes}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
