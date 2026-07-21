import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { hapticSuccess, hapticLight } from "@/lib/haptic";

export const Route = createFileRoute("/_authenticated/homecoming-checklist")({
  ssr: false,
  component: HomecomingChecklistPage,
  head: () => ({ meta: [{ title: "Bringing Baby Home — Peace of Mine" }] }),
});

export interface HomecomingItem {
  key: string;
  label: string;
  note?: string;
}

export interface HomecomingSection {
  id: string;
  label: string;
  emoji: string;
  items: HomecomingItem[];
}

export const HOMECOMING_SECTIONS: HomecomingSection[] = [
  {
    id: "before_you_leave_hospital",
    label: "Before You Leave the Hospital",
    emoji: "🏥",
    items: [
      {
        key: "home_car_seat_installed",
        label: "Rear-facing car seat installed and inspected before discharge day",
        note: "Many hospitals require this before releasing baby. Find a free inspection at nhtsa.gov/car-seats.",
      },
      {
        key: "home_car_seat_practice",
        label: "Practice buckling and unbuckling the harness ahead of time",
      },
      {
        key: "home_id_bands_matched",
        label: "Confirm ID bands match between baby and both parents before leaving",
      },
      {
        key: "home_discharge_paperwork",
        label: "Collect discharge paperwork, birth certificate forms, and newborn screening results",
      },
      {
        key: "home_pediatrician_appt",
        label: "Schedule the first pediatrician visit",
      },
      {
        key: "home_going_home_outfit",
        label: "Pack a weather-appropriate going-home outfit and extra layer for the car seat",
        note: "Avoid bulky/puffy layers under the car seat harness.",
      },
    ],
  },
  {
    id: "first_days",
    label: "First Days at Home",
    emoji: "👶",
    items: [
      {
        key: "home_feeding_diaper_tracking",
        label: "Track feeding times and wet/dirty diaper counts",
        note: "A rough guide, not a rule: expect diaper counts to climb over the first week as feeding is established.",
      },
      {
        key: "home_emergency_numbers_saved",
        label: "Save pediatrician, after-hours nurse line, and poison control in your phone",
        note: "US Poison Control: 1-800-222-1222.",
      },
    ],
  },
  {
    id: "support_logistics",
    label: "Support & Logistics",
    emoji: "🤝",
    items: [
      {
        key: "home_meal_help",
        label: "Line up meal help or a meal train for the first couple of weeks",
      },
      {
        key: "home_visitor_plan",
        label: "Set expectations with visitors: handwashing, and staying home if sick",
      },
      {
        key: "home_pediatrician_registered",
        label: "Confirm baby is registered with the pediatrician's office and insurance is on file",
      },
    ],
  },
];

const STORAGE_KEY = "safesound.homecomingChecklist.v1";

function HomecomingChecklistPage() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());

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

  const totalItems = HOMECOMING_SECTIONS.reduce((s, sec) => s + sec.items.length, 0);
  const totalCompleted = HOMECOMING_SECTIONS.reduce(
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

        <div className="mb-2 flex items-center gap-3">
          <Home className="h-7 w-7" style={{ color: "#C4785A" }} />
          <h1 className="font-display text-3xl font-semibold" style={{ color: "#3D2B1F" }}>
            Bringing Baby Home
          </h1>
        </div>
        <p className="mb-2 font-body text-sm" style={{ color: "#8A8078" }}>
          For expecting parents: what to sort out before discharge, around the house, and in the
          first days home.
        </p>
        <p className="mb-5 font-body text-xs leading-relaxed" style={{ color: "#8A8078" }}>
          A starting point, not an exhaustive list or medical advice — every hospital, family, and
          home is different, so use your own judgment about what else applies.
        </p>

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
          {HOMECOMING_SECTIONS.map((section) => {
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
              <RotateCcw className="mr-1.5 h-3 w-3" /> Reset checklist
            </Button>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
