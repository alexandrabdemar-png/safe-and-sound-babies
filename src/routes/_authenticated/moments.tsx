import { logError } from "@/lib/sanitize-error";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveChild } from "@/hooks/useActiveChild";
import { BottomNav } from "@/components/BottomNav";
import { SparkleIllustration } from "@/components/EmptyIllustration";
import {
  SketchDefs,
  MOMENT_ICONS,
  MOMENT_ICON_LABELS,
  parseLegacyNotes,
  resolveMomentIcon,
  fetchMilestonesResilient,
  type MomentIconKey,
} from "@/lib/momentIcons";

export const Route = createFileRoute("/_authenticated/moments")({
  ssr: false,
  component: MomentsPage,
  head: () => ({ meta: [{ title: "Memory Book — Peace of Mine" }] }),
});

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
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!activeChildId) return;
    // `cancelled` stops a stale response from toasting or setting state
    // after the user has already navigated off this page — sonner toasts
    // render globally, not scoped to the current route, so an unguarded
    // toast here could appear on whatever screen (e.g. Home) the user has
    // already moved to. Same bug class as the first-foods.tsx fix — see
    // that file's mountedRef comment for the reported symptom.
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [mRes, cRes] = await Promise.all([
          fetchMilestonesResilient(activeChildId),
          supabase.from("children").select("name").eq("id", activeChildId).maybeSingle(),
        ]);
        if (cancelled) return;
        if (mRes.error) toast.error(mRes.error.message);
        const parsed: ParsedMoment[] = (mRes.data ?? []).map((m: RawMoment) => {
          const { legacyType, displayNotes } = parseLegacyNotes(m.notes);
          const resolvedIcon = resolveMomentIcon(m.icon, legacyType);
          return { ...m, resolvedIcon, displayNotes };
        });
        setMoments(parsed);
        setChildName(cRes.data?.name ?? "");
      } catch (err) {
        if (cancelled) return;
        // A thrown network/unexpected failure (fetchMilestonesResilient
        // already catches its own — this covers the children query, and
        // is the safety net that keeps the page from being stuck on its
        // loading spinner forever with no error shown).
        logError("[moments] failed to load", err);
        toast.error(err instanceof Error ? err.message : "Couldn't load your moments");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeChildId]);

  const filtered = useMemo(() => {
    let result = moments;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) => m.title.toLowerCase().includes(q) || m.displayNotes.toLowerCase().includes(q),
      );
    }
    return result;
  }, [moments, search]);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-6 pt-8 pb-2">
        <div className="mx-auto max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="-ml-2 rounded-none font-body text-[10px] uppercase tracking-[0.18em]"
            >
              <Link to="/home">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Home
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="rounded-none font-body text-[10px] uppercase tracking-[0.18em]"
            >
              <Link to="/moments/new">
                <Plus className="mr-1 h-3.5 w-3.5" /> Log entry
              </Link>
            </Button>
          </div>

          {/* Ledger masthead — quiet, archival, no hero card */}
          <h1
            className="font-display text-xs uppercase tracking-[0.22em]"
            style={{ color: "#3D3935" }}
          >
            {childName ? `${childName} — Milestones` : "Milestones"}
          </h1>
          <p className="mt-2 font-body text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {moments.length > 0
              ? `${moments.length} ${moments.length === 1 ? "entry" : "entries"} recorded`
              : "No entries recorded"}
          </p>

          {/* Search — underline, not a pill */}
          <div className="relative mt-6">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search entries…"
              className="w-full border-b bg-transparent py-1.5 pr-6 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              style={{ borderColor: "#586C81" }}
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-0 top-1/2 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ) : (
              <Search className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            )}
          </div>

          {/* Categories removed — every entry is a milestone. */}
          <SketchDefs />

        </div>
      </header>

      <main className="flex-1 px-4 pt-6 sm:px-6">
        <div className="mx-auto max-w-md">
          {loading ? (
            <div className="py-10 text-center font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed px-6 py-10 text-center" style={{ borderColor: "#586C81" + "33" }}>
              <SparkleIllustration className="mx-auto mb-2 h-20 w-20" />
              <p className="font-display text-xs uppercase tracking-[0.18em]">No milestones yet</p>
              <p className="mx-auto mt-2 max-w-xs font-body text-xs italic text-muted-foreground">
                {search
                  ? "Try a different search."
                  : "Log your first milestone and it'll be recorded here."}
              </p>
              {!search && (
                <Button
                  asChild
                  variant="ghost"
                  className="mt-5 rounded-none border font-display text-[10px] uppercase tracking-[0.18em]"
                  style={{ borderColor: "#586C81" }}
                >
                  <Link to="/moments/new">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Log entry
                  </Link>
                </Button>
              )}
            </div>
          ) : (
          <div className="relative pb-8">
              {/* Hand-drawn wavy spine */}
              <svg
                className="absolute left-1/2 top-0 bottom-0 h-full w-3 -translate-x-1/2 opacity-50"
                viewBox="0 0 12 800"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M6 0 Q 9 50 6 100 T 6 200 T 6 300 T 6 400 T 6 500 T 6 600 T 6 700 T 6 800"
                  fill="none"
                  stroke="#96A5BE"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                />
              </svg>
              <ul>
                {filtered.map((m, i) => {
                  const onLeft = i % 2 === 0;
                  const Icon = MOMENT_ICONS[m.resolvedIcon];
                  return (
                    <li
                      key={m.id}
                      className={`relative mb-6 flex items-center ${onLeft ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`w-[44%] rounded-2xl p-3 ${onLeft ? "text-right" : ""}`}
                        style={{
                          backgroundColor: "#FFFFFF",
                          border: "1.5px solid rgba(169,183,201,0.55)",
                          boxShadow: "0 1px 3px rgba(150,165,190,0.18)",
                        }}
                      >
                        <span
                          className="mb-0.5 block font-body text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: "#96A5BE" }}
                        >
                          {formatDateLarge(m.logged_at)}
                        </span>
                        <h3
                          className="mb-0.5 font-display text-sm font-medium leading-tight"
                          style={{ color: "#5A677A" }}
                        >
                          {m.title}
                        </h3>
                        {m.displayNotes && (
                          <p
                            className="font-body text-[11px] italic leading-relaxed line-clamp-3"
                            style={{ color: "#96A5BE" }}
                          >
                            {m.displayNotes}
                          </p>
                        )}
                      </div>
                      {/* Round sketch marker on the spine */}
                      <span
                        className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-sm"
                        style={{
                          backgroundColor: "#FFFDF9",
                          border: "2px solid #A9B7C9",
                        }}
                        aria-label={MOMENT_ICON_LABELS[m.resolvedIcon]}
                      >
                        <Icon px={22} />
                      </span>
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

