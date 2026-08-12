// Summary line formatters for the Track tab cards. Kept pure (no Supabase,
// no React) so the wording/pluralisation is unit-testable and so Track can
// show live state instead of looking like a duplicate menu of /add.

export function formatRelativeTime(iso: string | null, now: number = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const mins = Math.floor((now - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30.44);
  return months <= 1 ? "1mo ago" : `${months}mo ago`;
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function firstFoodsSummary(total: number, allergens: number): string {
  if (total === 0) return "Nothing logged yet — start with a single food";
  const base = `${plural(total, "food")} introduced`;
  return allergens > 0 ? `${base} · ${plural(allergens, "allergen")} tried` : base;
}

export function bottlesSummary(active: number, lastStartedAt: string | null, now?: number): string {
  if (active > 0) return `${plural(active, "bottle")} in the safe-use window`;
  const rel = formatRelativeTime(lastStartedAt, now);
  return rel ? `Last bottle ${rel}` : "No bottles logged yet";
}

export function momentsSummary(total: number, lastLoggedAt: string | null, now?: number): string {
  if (total === 0) return "No moments yet — log the first one";
  const rel = formatRelativeTime(lastLoggedAt, now);
  return rel ? `${plural(total, "moment")} · latest ${rel}` : plural(total, "moment");
}

export function growthSummary(
  weightLbs: number | null,
  heightInches: number | null,
  updatedAt: string | null,
  now?: number,
): string {
  const parts: string[] = [];
  if (weightLbs != null) parts.push(`${weightLbs.toFixed(1)} lb`);
  if (heightInches != null) parts.push(`${heightInches.toFixed(1)}"`);
  if (!parts.length) return "No measurements yet";
  const rel = formatRelativeTime(updatedAt, now);
  return rel ? `${parts.join(" · ")} · ${rel}` : parts.join(" · ");
}

export function checklistsSummary(completed: number): string {
  if (completed === 0) return "Room-by-room babyproofing and travel guides";
  return `${plural(completed, "item")} checked off`;
}
