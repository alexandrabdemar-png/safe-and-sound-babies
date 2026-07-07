import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveChild } from "@/hooks/useActiveChild";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/moments")({
  ssr: false,
  component: MomentsPage,
  head: () => ({ meta: [{ title: "Memory Book — Peace of Mine" }] }),
});

export type MomentType = "First" | "Funny" | "Milestone";

export const ALL_TYPES: MomentType[] = ["First", "Funny", "Milestone"];

export const TYPE_STYLES: Record<MomentType, { accent: string; bg: string; border: string; emoji: string }> = {
  First:     { accent: "#C47B2B", bg: "#FEF9F0", border: "#F0D5A0", emoji: "⭐" },
  Funny:     { accent: "#6A7FBF", bg: "#F0F2FA", border: "#C5CCEC", emoji: "😄" },
  Milestone: { accent: "#4A7A47", bg: "#F0F6F0", border: "#B5D5B2", emoji: "🎯" },
};

export function parseMomentType(notes: string | null): { type: MomentType; displayNotes: string } {
  if (!notes) return { type: "Milestone", displayNotes: "" };
  const match = notes.match(/^\[(\w+)\]\s?/);
  if (match && ALL_TYPES.includes(match[1] as MomentType)) {
    return { type: match[1] as MomentType, displayNotes: notes.slice(match[0].length) };
  }
  return { type: "Milestone", displayNotes: notes };
}

type RawMoment = {
  id: string;
  title: string;
  logged_at: string | null;
  notes: string | null;
};

type ParsedMoment = RawMoment & {
  type: MomentType;
  displayNotes: string;
};

function calcAgeAt(dob: string, loggedAt: string): string {
  const birth = new Date(dob + "T00:00:00");
  const at = new Date(loggedAt + "T00:00:00");
  const totalDays = Math.max(0, Math.floor((at.getTime() - birth.getTime()) / 86400000));
  const totalMonths = Math.floor(totalDays / 30.44);
  const weeks = Math.floor((totalDays % 30.44) / 7);
  if (totalMonths < 3) {
    const w = Math.floor(totalDays / 7);
    return `${w} ${w === 1 ? "week" : "weeks"} old`;
  }
  if (weeks > 0) return `${totalMonths} ${totalMonths === 1 ? "month" : "months"} and ${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  return `${totalMonths} ${totalMonths === 1 ? "month" : "months"} old`;
}

function formatDateLarge(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}


function MomentsPage() {
  const { activeChildId } = useActiveChild();
  const [moments, setMoments] = useState<ParsedMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [childName, setChildName] = useState("");
  const [childDob, setChildDob] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MomentType | "all">("all");

  useEffect(() => {
    if (!activeChildId) return;
    (async () => {
      setLoading(true);
      const [mRes, cRes] = await Promise.all([
        supabase.from("milestones").select("id, title, logged_at, notes").eq("child_id", activeChildId).order("logged_at", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("children").select("name, date_of_birth").eq("id", activeChildId).maybeSingle(),
      ]);
      if (mRes.error) toast.error(mRes.error.message);
      const parsed: ParsedMoment[] = (mRes.data ?? []).map((m: RawMoment) => {
        const { type, displayNotes } = parseMomentType(m.notes);
        return { ...m, type, displayNotes };
      });
      setMoments(parsed);
      setChildName(cRes.data?.name ?? "");
      setChildDob(cRes.data?.date_of_birth ?? null);
      setLoading(false);
    })();
  }, [activeChildId]);

  const filtered = useMemo(() => {
    let result = moments;
    if (typeFilter !== "all") result = result.filter((m) => m.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((m) => m.title.toLowerCase().includes(q) || m.displayNotes.toLowerCase().includes(q));
    }
    return result;
  }, [moments, typeFilter, search]);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-5 pt-8 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between mb-4">
            <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full font-body text-xs">
              <Link to="/home">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Home
              </Link>
            </Button>
            <Button asChild size="sm" className="rounded-full font-body text-xs">
              <Link to="/moments/new">
                <Plus className="mr-1 h-3.5 w-3.5" /> Log
              </Link>
            </Button>
          </div>

          <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            <Sparkles className="mr-1 inline h-3 w-3" /> {childName || "Memory book"}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">
            Moments
          </h1>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            Every memory, beautifully kept.
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search moments…"
              className="w-full rounded-2xl border border-border bg-card pl-9 pr-4 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Type filter */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`rounded-full px-3 py-1 font-body text-xs font-medium transition-colors ${typeFilter === "all" ? "bg-foreground text-background" : "bg-card border border-border text-muted-foreground"}`}
            >
              All
            </button>
            {ALL_TYPES.map((t) => {
              const s = TYPE_STYLES[t];
              const active = typeFilter === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(active ? "all" : t)}
                  className={`rounded-full px-3 py-1 font-body text-xs font-medium transition-colors border ${active ? "" : "bg-card text-muted-foreground"}`}
                  style={active ? { backgroundColor: s.accent, color: "#fff", borderColor: s.accent } : { borderColor: "#e5e5e5" }}
                >
                  {s.emoji} {t}
                </button>
              );
            })}
          </div>

          {/* Timeline */}
          {loading ? (
            <div className="py-10 text-center font-body text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-display text-lg font-semibold">No moments yet</p>
              <p className="mt-1 font-body text-sm text-muted-foreground">
                {search || typeFilter !== "all" ? "Try a different search or filter." : "Log your first moment and it'll appear here."}
              </p>
              {!search && typeFilter === "all" && (
                <Button asChild className="mt-4 rounded-full">
                  <Link to="/moments/new">Log a moment</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="relative pb-4">
              {/* Timeline line */}
              <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border/60" />
              <ul className="space-y-5">
                {filtered.map((m) => {
                  const s = TYPE_STYLES[m.type];
                  const isLetter = (m.type as string) === "Letter";
                  const age = childDob && m.logged_at ? calcAgeAt(childDob, m.logged_at) : null;
                  return (
                    <li key={m.id} className="relative pl-7">
                      {/* Timeline dot */}
                      <span
                        className="absolute left-0 top-4 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px]"
                        style={{ backgroundColor: s.bg, border: `1.5px solid ${s.border}` }}
                      >
                        {s.emoji}
                      </span>

                      <div
                        className="rounded-2xl p-4"
                        style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
                      >
                        {/* Type tag + date row */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className="rounded-full px-2.5 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wider"
                            style={{ backgroundColor: s.accent + "22", color: s.accent }}
                          >
                            {m.type}
                          </span>
                          <span className="font-body text-[11px] text-muted-foreground">
                            {formatDateLarge(m.logged_at)}
                          </span>
                        </div>

                        {/* Age label */}
                        {age && (
                          <p className="font-body text-[11px] italic text-muted-foreground mb-1.5">
                            {childName} at {age}
                          </p>
                        )}

                        {/* Title */}
                        <p
                          className="font-display text-lg font-semibold tracking-tight leading-snug"
                          style={{ color: "#3D3935" }}
                        >
                          {m.title}
                        </p>

                        {/* Notes / letter */}
                        {m.displayNotes && (
                          <p
                            className={`mt-2 font-body text-sm leading-relaxed ${isLetter ? "italic" : ""}`}
                            style={{ color: "#5C5248" }}
                          >
                            {m.displayNotes}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
