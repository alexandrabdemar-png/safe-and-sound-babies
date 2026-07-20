import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, Circle, ClipboardList, ArrowLeft, Gift, Luggage, HeartPulse, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { hapticSuccess, hapticLight } from "@/lib/haptic";
import { useActiveChild } from "@/hooks/useActiveChild";
import { ChildSwitcher } from "@/components/ChildSwitcher";
import { computeAdjustedAge } from "@/lib/adjustedAge";
import { formatAgeMonths } from "@/lib/profileType";
import { isItemRelevantForAge } from "@/lib/checklistAgeFilter";
import { ROOMS } from "@/lib/checklistsData";

export const ssr = false;

function ChecklistsPage() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showAllAges, setShowAllAges] = useState(false);

  const { activeChild } = useActiveChild();
  const ageMonths = useMemo(() => {
    if (!activeChild?.date_of_birth) return null;
    const age = computeAdjustedAge({
      dateOfBirth: activeChild.date_of_birth,
      dueDate: activeChild.due_date,
    });
    return age ? age.adjustedMonths : null;
  }, [activeChild?.date_of_birth, activeChild?.due_date]);

  const filterAge = showAllAges ? null : ageMonths;
  const visibleRooms = useMemo(
    () =>
      ROOMS.map((room) => ({
        ...room,
        items: room.items.filter((item) => isItemRelevantForAge(item, filterAge)),
      })),
    [filterAge],
  );

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data } = await supabase
          .from("checklist_completions")
          .select("item_key")
          .eq("user_id", uid);
        if (data) {
          setCompleted(new Set(data.map((r: { item_key: string }) => r.item_key)));
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  async function toggleItem(key: string) {
    if (!userId) return;
    const wasCompleted = completed.has(key);

    setCompleted((prev) => {
      const next = new Set(prev);
      if (wasCompleted) next.delete(key);
      else next.add(key);
      return next;
    });

    if (wasCompleted) {
      hapticLight();
      await supabase
        .from("checklist_completions")
        .delete()
        .eq("user_id", userId)
        .eq("item_key", key);
    } else {
      hapticSuccess();
      await supabase
        .from("checklist_completions")
        .upsert({ user_id: userId, item_key: key });
    }
  }

  const totalItems = visibleRooms.reduce((sum, r) => sum + r.items.length, 0);
  const totalCompleted = visibleRooms.reduce(
    (sum, r) => sum + r.items.filter((i) => completed.has(i.key)).length,
    0,
  );
  const overallPct = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0;

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: "#FAF7F2" }}>
      <div className="mx-auto max-w-md px-4 pt-8">
        {/* Back to Home */}
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 rounded-full font-body text-xs">
          <Link to="/home">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Home
          </Link>
        </Button>
        {/* Header */}
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-7 w-7" style={{ color: "#C4785A" }} />
            <h1 className="font-display text-3xl font-semibold" style={{ color: "#3D2B1F" }}>
              Safety Checklists
            </h1>
          </div>
          <ChildSwitcher />
        </div>
        <p
          className={`font-body text-xs leading-relaxed ${ageMonths != null ? "mb-2" : "mb-6"}`}
          style={{ color: "#8A8078" }}
        >
          A starting point, not an exhaustive list — general reference checklists, not a certified
          home safety inspection or medical advice. Every home is different, so use your own
          judgment about what else applies.
        </p>
        {ageMonths != null && (
          <p className="mb-6 font-body text-xs" style={{ color: "#A89888" }}>
            Showing items relevant for {activeChild?.name ?? "your child"} at{" "}
            {formatAgeMonths(ageMonths)} old.{" "}
            <button
              type="button"
              onClick={() => setShowAllAges((v) => !v)}
              className="underline underline-offset-2"
              style={{ color: "#C4785A" }}
            >
              {showAllAges ? "Show age-relevant items only" : "Show full checklist"}
            </button>
          </p>
        )}

        {/* Overall progress */}
        {!loading && (
          <div className="mb-8">
            <div className="mb-2 flex justify-between font-body text-sm" style={{ color: "#8A8078" }}>
              <span>{totalCompleted} of {totalItems} items complete</span>
              <span>{overallPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "#E8E2DA" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${overallPct}%`, backgroundColor: "#C4785A" }}
              />
            </div>
          </div>
        )}

        {/* Quick links to special checklists */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <Link to="/homecoming-checklist"
            className="flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:border-[#C4785A]/50"
            style={{ borderColor: "#C8B8A2", backgroundColor: "white" }}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "#F5F0E8" }}>
              <Home className="h-5 w-5" style={{ color: "#C4785A" }} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold" style={{ color: "#3D2B1F" }}>Bringing Baby Home</p>
              <p className="font-body text-xs" style={{ color: "#8A8078" }}>For expecting parents</p>
            </div>
          </Link>
          <Link to="/travel-checklist"
            className="flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:border-[#C4785A]/50"
            style={{ borderColor: "#C8B8A2", backgroundColor: "white" }}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "#F5F0E8" }}>
              <Luggage className="h-5 w-5" style={{ color: "#C4785A" }} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold" style={{ color: "#3D2B1F" }}>Travel Mode</p>
              <p className="font-body text-xs" style={{ color: "#8A8078" }}>Packing + hotel safety</p>
            </div>
          </Link>
          <Link to="/registry-check"
            className="flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:border-[#C4785A]/50"
            style={{ borderColor: "#C8B8A2", backgroundColor: "white" }}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "#F5F0E8" }}>
              <Gift className="h-5 w-5" style={{ color: "#C4785A" }} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold" style={{ color: "#3D2B1F" }}>Registry Check</p>
              <p className="font-body text-xs" style={{ color: "#8A8078" }}>Recall check before you add</p>
            </div>
          </Link>
          <Link to="/emergency-info"
            className="flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:border-[#C4785A]/50"
            style={{ borderColor: "#C8B8A2", backgroundColor: "white" }}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "#F5F0E8" }}>
              <HeartPulse className="h-5 w-5" style={{ color: "#C4785A" }} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold" style={{ color: "#3D2B1F" }}>Emergency Info</p>
              <p className="font-body text-xs" style={{ color: "#8A8078" }}>Card for a babysitter or sitter</p>
            </div>
          </Link>
        </div>

        {loading ? (
          <p className="font-body text-sm" style={{ color: "#8A8078" }}>Loading checklists...</p>
        ) : (
          <div className="flex flex-col gap-6">
            {visibleRooms.map((room) => {
              if (room.items.length === 0) return null;
              const roomCompleted = room.items.filter((i) => completed.has(i.key)).length;
              const roomPct = Math.round((roomCompleted / room.items.length) * 100);
              return (
                <div
                  key={room.id}
                  className="rounded-2xl border"
                  style={{ borderColor: "#C8B8A2", backgroundColor: "white" }}
                >
                  <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "#E8E2DA" }}>
                    <h2 className="font-display text-lg font-semibold" style={{ color: "#3D2B1F" }}>
                      {room.label}
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="font-body text-xs" style={{ color: "#8A8078" }}>
                        {roomCompleted}/{room.items.length}
                      </span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full" style={{ backgroundColor: "#E8E2DA" }}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${roomPct}%`, backgroundColor: "#C4785A" }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="divide-y" style={{ borderColor: "#F5F0E8" }}>
                    {room.items.map((item, idx) => {
                      const done = completed.has(item.key);
                      return (
                        <button
                          key={item.key}
                          onClick={() => toggleItem(item.key)}
                          className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50/50 active:bg-gray-100/50"
                          style={idx === room.items.length - 1 ? { borderRadius: "0 0 1rem 1rem" } : {}}
                        >
                          {done ? (
                            <CheckCircle2
                              className="mt-0.5 h-5 w-5 shrink-0"
                              style={{ color: "#C4785A" }}
                            />
                          ) : (
                            <Circle
                              className="mt-0.5 h-5 w-5 shrink-0"
                              style={{ color: "#C8B8A2" }}
                            />
                          )}
                          <span
                            className="font-body text-sm leading-relaxed"
                            style={{
                              color: done ? "#8A8078" : "#3D2B1F",
                              textDecoration: done ? "line-through" : "none",
                            }}
                          >
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/checklists")({
  component: ChecklistsPage,
  ssr: false,
});
