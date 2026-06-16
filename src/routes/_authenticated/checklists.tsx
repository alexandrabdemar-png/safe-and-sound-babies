import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { CheckCircle2, Circle, ClipboardList } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const ssr = false;

interface ChecklistItem {
  key: string;
  label: string;
}

interface Room {
  id: string;
  label: string;
  items: ChecklistItem[];
}

const ROOMS: Room[] = [
  {
    id: "nursery",
    label: "Nursery",
    items: [
      { key: "nursery_crib_firm_mattress", label: "Firm, flat crib mattress with fitted sheet" },
      { key: "nursery_crib_no_bumpers", label: "No crib bumpers, pillows, or loose bedding" },
      { key: "nursery_crib_slat_spacing", label: "Crib slat spacing ≤ 2⅜ inches" },
      { key: "nursery_temp_68_72", label: "Room temperature 68–72°F (20–22°C)" },
      { key: "nursery_co_detector", label: "CO detector installed and tested" },
      { key: "nursery_baby_monitor", label: "Baby monitor positioned safely out of reach" },
      { key: "nursery_dresser_anchored", label: "Dresser and furniture anchored to wall" },
      { key: "nursery_outlet_covers", label: "All outlets covered" },
      { key: "nursery_cord_free", label: "No blind/curtain cords within reach" },
      { key: "nursery_diaper_pail_closed", label: "Diaper pail stays closed and latched" },
    ],
  },
  {
    id: "living_room",
    label: "Living Room",
    items: [
      { key: "lr_tv_anchored", label: "TV anchored to wall or TV stand" },
      { key: "lr_furniture_anchored", label: "Tall furniture anchored to wall" },
      { key: "lr_sharp_corners", label: "Sharp coffee table corners padded" },
      { key: "lr_small_objects_away", label: "Small objects (coins, batteries) out of reach" },
      { key: "lr_blind_cords", label: "Blind/curtain cords looped up or cut" },
      { key: "lr_outlet_covers", label: "All outlets covered" },
      { key: "lr_fireplace_gate", label: "Fireplace/heater gated or guarded" },
      { key: "lr_houseplants_safe", label: "All houseplants are non-toxic" },
      { key: "lr_rugs_secured", label: "Area rugs have non-slip backing" },
      { key: "lr_remote_batteries", label: "Remote control battery covers secured" },
    ],
  },
  {
    id: "kitchen",
    label: "Kitchen",
    items: [
      { key: "kitchen_cabinet_locks", label: "Child locks on lower cabinet doors" },
      { key: "kitchen_cleaning_products_high", label: "Cleaning products stored high or locked" },
      { key: "kitchen_knives_locked", label: "Knives in locked drawer or out of reach" },
      { key: "kitchen_stove_knob_covers", label: "Stove knob covers installed" },
      { key: "kitchen_back_burners", label: "Cook on back burners when possible" },
      { key: "kitchen_fridge_lock", label: "Refrigerator lock if needed" },
      { key: "kitchen_trash_locked", label: "Trash can locked or secured" },
      { key: "kitchen_dishwasher_latched", label: "Dishwasher door stays latched" },
      { key: "kitchen_tablecloth_removed", label: "No tablecloth to pull down" },
      { key: "kitchen_pet_food_away", label: "Pet food and bowls moved away" },
    ],
  },
  {
    id: "bathroom",
    label: "Bathroom",
    items: [
      { key: "bath_door_locked", label: "Bathroom door kept closed/locked" },
      { key: "bath_toilet_lock", label: "Toilet lid lock installed" },
      { key: "bath_non_slip_mat", label: "Non-slip mat inside and outside tub" },
      { key: "bath_water_temp_120", label: "Water heater set to ≤ 120°F (49°C)" },
      { key: "bath_never_leave_alone", label: "Never leave baby alone in water" },
      { key: "bath_meds_locked", label: "All medications in locked cabinet" },
      { key: "bath_razors_away", label: "Razors and sharp items stored out of reach" },
      { key: "bath_cosmetics_away", label: "Cosmetics and toiletries out of reach" },
      { key: "bath_outlet_covers_gfi", label: "Outlets covered; GFI outlets near water" },
      { key: "bath_hair_dryer_away", label: "Hair dryer and appliances unplugged and stored" },
    ],
  },
];

function ChecklistsPage() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

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
      await supabase
        .from("checklist_completions")
        .delete()
        .eq("user_id", userId)
        .eq("item_key", key);
    } else {
      await supabase
        .from("checklist_completions")
        .upsert({ user_id: userId, item_key: key });
    }
  }

  const totalItems = ROOMS.reduce((sum, r) => sum + r.items.length, 0);
  const totalCompleted = ROOMS.reduce(
    (sum, r) => sum + r.items.filter((i) => completed.has(i.key)).length,
    0,
  );
  const overallPct = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0;

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: "#FAF7F2" }}>
      <div className="mx-auto max-w-md px-4 pt-8">
        {/* Header */}
        <div className="mb-2 flex items-center gap-3">
          <ClipboardList className="h-7 w-7" style={{ color: "#C4785A" }} />
          <h1 className="font-display text-3xl font-semibold" style={{ color: "#3D2B1F" }}>
            Safety Checklists
          </h1>
        </div>

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

        {loading ? (
          <p className="font-body text-sm" style={{ color: "#8A8078" }}>Loading checklists...</p>
        ) : (
          <div className="flex flex-col gap-6">
            {ROOMS.map((room) => {
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
