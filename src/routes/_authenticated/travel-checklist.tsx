import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Luggage, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { hapticSuccess, hapticLight } from "@/lib/haptic";

export const Route = createFileRoute("/_authenticated/travel-checklist")({
  ssr: false,
  component: TravelChecklistPage,
  head: () => ({ meta: [{ title: "Travel Checklist — Peace of Mine" }] }),
});

interface TravelItem {
  key: string;
  label: string;
  note?: string;
}

interface TravelSection {
  id: string;
  label: string;
  emoji: string;
  items: TravelItem[];
}

const TRAVEL_SECTIONS: TravelSection[] = [
  {
    id: "before_you_leave",
    label: "Before You Leave",
    emoji: "📋",
    // Most important first: first aid, health/ID records, how to reach help,
    // then the car seat, then everything else.
    items: [
      {
        key: "travel_meds_packed",
        label: "Pack a baby first-aid kit",
        note: "Include a digital thermometer, saline drops, gas drops, and any prescription medications.",
      },
      {
        key: "travel_health_records",
        label: "Bring immunization records and insurance card",
        note: "Take a photo as backup in case the physical copies are lost.",
      },
      {
        key: "travel_emergency_contacts",
        label: "Save local emergency and poison control numbers",
        note: "US Poison Control: 1-800-222-1222. Research the nearest pediatric ER at your destination.",
      },
      {
        key: "travel_car_seat_install",
        label: "Inspect car seat based on fit and ensure properly installed",
        note: "Check for a snug fit with no more than an inch of movement side-to-side and front-to-back at the belt path.",
      },
      {
        key: "travel_car_seat_expiry",
        label: "Check car seat expiration date",
        note: "Printed on the bottom or back of the seat. Don't travel with an expired seat.",
      },
      {
        key: "travel_recall_check",
        label: "Check all travel gear for active recalls",
        note: "Search your stroller, carrier, and car seat at cpsc.gov/Recalls before departing.",
      },
      {
        key: "travel_safe_sleep_surface",
        label: "Confirm your accommodation has a safe sleep option",
        note: "A pack-and-play or travel crib — never let baby sleep in an adult bed or a hotel chair.",
      },
    ],
  },
  {
    id: "car_seat_safety",
    label: "Car Seat Safety",
    emoji: "🚗",
    items: [
      {
        key: "travel_cs_rear_facing",
        label: "Baby is rear-facing (until 2+ years or seat max weight)",
      },
      {
        key: "travel_cs_harness_snug",
        label: "Harness straps are snug — you can't pinch the webbing at the shoulder",
      },
      { key: "travel_cs_chest_clip", label: "Chest clip is at armpit level, not on the belly" },
      { key: "travel_cs_no_coat", label: "No puffy coat under the harness" },
      {
        key: "travel_cs_tether",
        label: "Top tether strap attached and tight (forward-facing only)",
      },
      {
        key: "travel_cs_base_angle",
        label: "Infant seat recline angle is correct (check indicator on seat)",
      },
      {
        key: "travel_cs_no_accessories",
        label: "No aftermarket inserts, mirrors, or toys attached to the seat",
      },
      {
        key: "travel_plane_faa_seat",
        label: "If flying: use an FAA-approved car seat on the plane",
        note: 'Look for "This restraint is certified for use in motor vehicles and aircraft" on the label.',
      },
    ],
  },
  {
    id: "hotel_room_safety",
    label: "Hotel Room Safety",
    emoji: "🏨",
    items: [
      {
        key: "travel_hotel_no_bed_sleep",
        label: "Baby sleeps in pack-and-play, not the adult bed or sofa",
      },
      {
        key: "travel_hotel_firm_mattress",
        label: "Pack-and-play mattress is firm and flat — no extra padding added",
      },
      {
        key: "travel_hotel_outlet_covers",
        label: "Bring outlet covers for hotel room outlets",
        note: "Pack a few in your bag — hotel rooms rarely have them.",
      },
      { key: "travel_hotel_blind_cords", label: "Tie up blind and curtain cords out of reach" },
      {
        key: "travel_hotel_balcony",
        label: "Lock balcony door and place a piece of furniture in front of it",
      },
      {
        key: "travel_hotel_small_objects",
        label: "Do a floor sweep for small objects, coins, and buttons",
      },
      { key: "travel_hotel_temp", label: "Set room temperature to 68–72°F (20–22°C) for sleep" },
      {
        key: "travel_hotel_smoke_co",
        label: "Confirm smoke and CO detectors are present and working",
      },
      { key: "travel_hotel_bathroom_locked", label: "Keep bathroom door locked when not in use" },
      {
        key: "travel_hotel_iron_unplugged",
        label: "Unplug the iron and hair dryer and store out of reach",
      },
    ],
  },
  {
    id: "if_recall_while_traveling",
    label: "If a Recall Happens While Traveling",
    emoji: "⚠️",
    items: [
      { key: "travel_recall_stop_using", label: "Stop using the recalled product immediately" },
      {
        key: "travel_recall_register",
        label:
          "Check if your product is registered at cpsc.gov — registered owners get direct recall notices",
      },
      {
        key: "travel_recall_alternatives",
        label: "Contact your destination hotel or rental company for a safe alternative",
        note: "Many hotels have cribs and pack-and-plays available on request.",
      },
      {
        key: "travel_recall_cpsc_remedy",
        label:
          "Follow the remedy: request a free repair, replacement, or refund at cpsc.gov/Recalls",
      },
      {
        key: "travel_recall_document",
        label: "Document the product (photo, model number) before returning it for warranty claims",
      },
    ],
  },
];

const STORAGE_KEY = "safesound.travelChecklist.v1";

function TravelChecklistPage() {
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

  const totalItems = TRAVEL_SECTIONS.reduce((s, sec) => s + sec.items.length, 0);
  const totalCompleted = TRAVEL_SECTIONS.reduce(
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
          <Luggage className="h-7 w-7" style={{ color: "#C4785A" }} />
          <h1 className="font-display text-3xl font-semibold" style={{ color: "#3D2B1F" }}>
            Travel Safety
          </h1>
        </div>
        <p className="mb-2 font-body text-sm" style={{ color: "#8A8078" }}>
          Pack smart, travel safe. Check off every item before and during your trip.
        </p>
        <p className="mb-5 font-body text-xs leading-relaxed" style={{ color: "#A89888" }}>
          A starting point, not an exhaustive list — every trip and destination is different, so use
          your own judgment about what else applies.
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
          {TRAVEL_SECTIONS.map((section) => {
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
