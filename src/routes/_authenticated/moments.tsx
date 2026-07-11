import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveChild } from "@/hooks/useActiveChild";
import { BottomNav } from "@/components/BottomNav";
import {
  MOMENT_ICON_KEYS,
  MOMENT_ICON_LABELS,
  MOMENT_ICONS,
  MOMENT_ICON_ACCENT,
  SketchDefs,
  parseLegacyNotes,
  resolveMomentIcon,
  type MomentIconKey,
} from "@/lib/momentIcons";

export const Route = createFileRoute("/_authenticated/moments")({
  ssr: false,
  component: MomentsPage,
  head: () => ({ meta: [{ title: "Memory Book — Peace of Mine" }] }),
});

const CARD_BG = "#FFFFFF";
const CARD_BORDER = "#E8E1D4";

type RawMoment = {
  id: string;
  title: string;
  logged_at: string | null;
  notes: string | null;
  icon: string | null;
};

type ParsedMoment = RawMoment & {
  resolvedIcon: MomentIconKey;
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
  if (weeks > 0)
    return `${totalMonths} ${totalMonths === 1 ? "month" : "months"} and ${weeks} ${weeks === 1 ? "week" : "weeks"}`;
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
  const [iconFilter, setIconFilter] = useState<MomentIconKey | "all">("all");

  useEffect(() => {
    if (!activeChildId) return;
    (async () => {
      setLoading(true);
      const [mRes, cRes] = await Promise.all([
        supabase
          .from("milestones")
          .select("id, title, logged_at, notes, icon")
          .eq("child_id", activeChildId)
          .order("logged_at", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("children")
          .select("name, date_of_birth")
          .eq("id", activeChildId)
          .maybeSingle(),
      ]);
      if (mRes.error) toast.error(mRes.error.message);
      const parsed: ParsedMoment[] = (mRes.data ?? []).map((m: RawMoment) => {
        const { legacyType, displayNotes } = parseLegacyNotes(m.notes);
        const resolvedIcon = resolveMomentIcon(m.icon, legacyType);
        return { ...m, resolvedIcon, displayNotes };
      });
      setMoments(parsed);
      setChildName(cRes.data?.name ?? "");
      setChildDob(cRes.data?.date_of_birth ?? null);
      setLoading(false);
    })();
  }, [activeChildId]);

  const filtered = useMemo(() => {
    let result = moments;
    if (iconFilter !== "all") result = result.filter((m) => m.resolvedIcon === iconFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) => m.title.toLowerCase().includes(q) || m.displayNotes.toLowerCase().includes(q),
      );
    }
    return result;
  }, [moments, iconFilter, search]);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-5 pt-8 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between mb-4">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="-ml-2 rounded-full font-body text-xs"
            >
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
          <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">Moments</h1>
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
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Icon filter */}
          <SketchDefs />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setIconFilter("all")}
              className={`rounded-full px-3 py-1 font-body text-xs font-medium transition-colors ${iconFilter === "all" ? "bg-foreground text-background" : "bg-card border border-border text-muted-foreground"}`}
            >
              All
            </button>
            {MOMENT_ICON_KEYS.map((key) => {
              const Icon = MOMENT_ICONS[key];
              const active = iconFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIconFilter(active ? "all" : key)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-body text-xs font-medium transition-colors border ${active ? "" : "bg-card text-muted-foreground"}`}
                  style={
                    active
                      ? {
                          backgroundColor: MOMENT_ICON_ACCENT,
                          color: "#fff",
                          borderColor: MOMENT_ICON_ACCENT,
                        }
                      : { borderColor: "#e5e5e5" }
                  }
                >
                  <Icon px={14} />
                  {MOMENT_ICON_LABELS[key]}
                </button>
              );
            })}
          </div>

          {/* Timeline */}
          {loading ? (
            <div className="py-10 text-center font-body text-sm text-muted-foreground">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-display text-lg font-semibold">No moments yet</p>
              <p className="mt-1 font-body text-sm text-muted-foreground">
                {search || iconFilter !== "all"
                  ? "Try a different search or filter."
                  : "Log your first moment and it'll appear here."}
              </p>
              {!search && iconFilter === "all" && (
                <Button asChild className="mt-4 rounded-full">
                  <Link to="/moments/new">Log a moment</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="relative pb-4">
              {/* Dashed center spine */}
              <div
                className="absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2"
                style={{
                  backgroundImage: "linear-gradient(var(--border) 60%, transparent 0%)",
                  backgroundSize: "1px 9px",
                  backgroundRepeat: "repeat-y",
                }}
              />
              <ul className="space-y-7">
                {filtered.map((m, i) => {
                  const Icon = MOMENT_ICONS[m.resolvedIcon];
                  const age = childDob && m.logged_at ? calcAgeAt(childDob, m.logged_at) : null;
                  const onLeft = i % 2 === 0;
                  return (
                    <li key={m.id} className="relative flex items-start">
                      {/* Icon badge on the spine */}
                      <span
                        className="absolute left-1/2 top-2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full shadow-sm"
                        style={{
                          backgroundColor: CARD_BG,
                          border: `1.5px solid ${MOMENT_ICON_ACCENT}`,
                        }}
                      >
                        <Icon px={18} />
                      </span>

                      {/* Card, alternating side */}
                      <div
                        className={`flex w-1/2 ${onLeft ? "justify-end pr-6" : "order-2 justify-start pl-6"}`}
                      >
                        <div
                          className="w-full max-w-[210px] rounded-2xl p-3.5"
                          style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
                        >
                          {/* Icon tag + date */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
                            <span
                              className="rounded-full px-2 py-0.5 font-body text-[9px] font-semibold uppercase tracking-wider"
                              style={{
                                backgroundColor: MOMENT_ICON_ACCENT + "22",
                                color: MOMENT_ICON_ACCENT,
                              }}
                            >
                              {MOMENT_ICON_LABELS[m.resolvedIcon]}
                            </span>
                            <span className="font-body text-[10px] text-muted-foreground">
                              {formatDateLarge(m.logged_at)}
                            </span>
                          </div>

                          {/* Age label */}
                          {age && (
                            <p className="font-body text-[10px] italic text-muted-foreground mb-1">
                              {childName} at {age}
                            </p>
                          )}

                          {/* Title */}
                          <p
                            className="font-display text-sm font-semibold tracking-tight leading-snug"
                            style={{ color: "#3D3935" }}
                          >
                            {m.title}
                          </p>

                          {/* Notes */}
                          {m.displayNotes && (
                            <p
                              className="mt-1.5 font-body text-xs leading-relaxed line-clamp-4"
                              style={{ color: "#5C5248" }}
                            >
                              {m.displayNotes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className={onLeft ? "order-2 w-1/2" : "w-1/2"} />
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
