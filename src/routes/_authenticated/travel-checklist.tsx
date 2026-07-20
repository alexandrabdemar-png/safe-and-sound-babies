import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Luggage, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { hapticSuccess, hapticLight } from "@/lib/haptic";
import { useActiveChild } from "@/hooks/useActiveChild";
import { ChildSwitcher } from "@/components/ChildSwitcher";
import { computeAdjustedAge } from "@/lib/adjustedAge";
import { formatAgeMonths } from "@/lib/profileType";
import { isItemRelevantForAge } from "@/lib/checklistAgeFilter";
import { TRAVEL_SECTIONS } from "@/lib/travelChecklistData";

export const Route = createFileRoute("/_authenticated/travel-checklist")({
  ssr: false,
  component: TravelChecklistPage,
  head: () => ({ meta: [{ title: "Travel Checklist — Peace of Mine" }] }),
});

const STORAGE_KEY = "safesound.travelChecklist.v1";

function TravelChecklistPage() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
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
  const visibleSections = useMemo(
    () =>
      TRAVEL_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => isItemRelevantForAge(item, filterAge)),
      })),
    [filterAge],
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setCompleted(new Set(JSON.parse(stored) as string[]));
    } catch {}
  }, []);

  function toggleItem(key: string) {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        hapticLight();
      } else {
        next.add(key);
        hapticSuccess();
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  function resetAll() {
    setCompleted(new Set());
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  const totalItems = visibleSections.reduce((s, sec) => s + sec.items.length, 0);
  const totalCompleted = visibleSections.reduce(
    (s, sec) => s + sec.items.filter((i) => completed.has(i.key)).length,
    0,
  );
  const pct = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0;

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: "#FAF7F2" }}>
      <div className="mx-auto max-w-md px-4 pt-8">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 rounded-full font-body text-xs"
        >
          <Link to="/checklists">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Checklists
          </Link>
        </Button>

        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Luggage className="h-7 w-7" style={{ color: "#C4785A" }} />
            <h1 className="font-display text-3xl font-semibold" style={{ color: "#3D2B1F" }}>
              Travel Safety
            </h1>
          </div>
          <ChildSwitcher />
        </div>
        <p className="mb-2 font-body text-sm" style={{ color: "#8A8078" }}>
          Pack smart, travel safe. Check off every item before and during your trip.
        </p>
        <p
          className={`font-body text-xs leading-relaxed ${ageMonths != null ? "mb-2" : "mb-5"}`}
          style={{ color: "#A89888" }}
        >
          A starting point, not an exhaustive list — every trip and destination is different, so use
          your own judgment about what else applies.
        </p>
        {ageMonths != null && (
          <p className="mb-5 font-body text-xs" style={{ color: "#A89888" }}>
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

        {/* Progress */}
        <div className="mb-6">
          <div className="mb-2 flex justify-between font-body text-sm" style={{ color: "#8A8078" }}>
            <span>
              {totalCompleted} of {totalItems} items checked
            </span>
            <span>{pct}%</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: "#E8E2DA" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: "#C4785A" }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {visibleSections.map((section) => {
            if (section.items.length === 0) return null;
            const secCompleted = section.items.filter((i) => completed.has(i.key)).length;
            const secPct = Math.round((secCompleted / section.items.length) * 100);
            return (
              <div
                key={section.id}
                className="rounded-2xl border"
                style={{ borderColor: "#C8B8A2", backgroundColor: "white" }}
              >
                <div
                  className="flex items-center justify-between border-b px-5 py-4"
                  style={{ borderColor: "#E8E2DA" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{section.emoji}</span>
                    <h2 className="font-display text-lg font-semibold" style={{ color: "#3D2B1F" }}>
                      {section.label}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-body text-xs" style={{ color: "#8A8078" }}>
                      {secCompleted}/{section.items.length}
                    </span>
                    <div
                      className="h-1.5 w-16 overflow-hidden rounded-full"
                      style={{ backgroundColor: "#E8E2DA" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${secPct}%`, backgroundColor: "#C4785A" }}
                      />
                    </div>
                  </div>
                </div>
                <div className="divide-y" style={{ borderColor: "#F5F0E8" }}>
                  {section.items.map((item, idx) => {
                    const done = completed.has(item.key);
                    return (
                      <button
                        key={item.key}
                        onClick={() => toggleItem(item.key)}
                        className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50/50 active:bg-gray-100/50"
                        style={
                          idx === section.items.length - 1 ? { borderRadius: "0 0 1rem 1rem" } : {}
                        }
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
                        <div className="min-w-0">
                          <span
                            className="font-body text-sm leading-relaxed"
                            style={{
                              color: done ? "#8A8078" : "#3D2B1F",
                              textDecoration: done ? "line-through" : "none",
                            }}
                          >
                            {item.label}
                          </span>
                          {item.note && !done && (
                            <p
                              className="mt-0.5 font-body text-xs leading-relaxed"
                              style={{ color: "#A89888" }}
                            >
                              {item.note}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {totalCompleted > 0 && (
          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAll}
              className="rounded-full font-body text-xs text-muted-foreground"
            >
              <RotateCcw className="mr-1.5 h-3 w-3" /> Reset for next trip
            </Button>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
