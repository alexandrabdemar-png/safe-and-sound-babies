import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  ArrowLeft,
  ShieldCheck,
  Luggage,
  HeartPulse,
  Home,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { hapticSuccess, hapticLight } from "@/lib/haptic";
import { ChildSwitcher } from "@/components/ChildSwitcher";
import { ROOMS } from "@/lib/checklistsData";

export const ssr = false;

const HOMECOMING_CARD_DISMISSED_KEY = "safesound.homecomingCardDismissed";

function ChecklistsPage() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  // Shown to everyone by default (so people who might need it know it
  // exists), but dismissible for anyone it doesn't apply to — persisted so
  // an X here means gone for good, not just for this session.
  const [homecomingCardDismissed, setHomecomingCardDismissed] = useState(() => {
    try {
      return localStorage.getItem(HOMECOMING_CARD_DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  function dismissHomecomingCard(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.setItem(HOMECOMING_CARD_DISMISSED_KEY, "true");
    } catch {}
    setHomecomingCardDismissed(true);
  }

  const visibleRooms = ROOMS;

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
      const { error } = await supabase
        .from("checklist_completions")
        .delete()
        .eq("user_id", userId)
        .eq("item_key", key);
      if (error) {
        console.error("[checklists] failed to un-check item:", error.message);
        // Roll the optimistic update back so the UI reflects what's
        // actually saved, and let the user know rather than silently
        // showing an unchecked box that's still checked in the database.
        setCompleted((prev) => new Set(prev).add(key));
        toast.error("Couldn't save that — try again.");
      }
    } else {
      hapticSuccess();
      const { error } = await supabase
        .from("checklist_completions")
        // onConflict matches the table's actual unique constraint
        // (user_id, item_key) explicitly — the previous unqualified
        // upsert() defaulted to PostgREST's primary-key conflict target
        // (id, which is never supplied here), so a rapid re-check of the
        // same item could throw a duplicate-key error instead of the
        // idempotent update this is meant to be.
        .upsert({ user_id: userId, item_key: key }, { onConflict: "user_id,item_key" });
      if (error) {
        console.error("[checklists] failed to check off item:", error.message);
        setCompleted((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        toast.error("Couldn't save that — try again.");
      }
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
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 rounded-full font-body text-xs"
        >
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
        <p className="mb-6 font-body text-xs leading-relaxed" style={{ color: "#8A8078" }}>
          A starting point, not an exhaustive list — general reference checklists, not a certified
          home safety inspection or medical advice. Every home is different, so use your own
          judgment about what else applies.
        </p>

        {/* Overall progress */}
        {!loading && (
          <div className="mb-8">
            <div
              className="mb-2 flex justify-between font-body text-sm"
              style={{ color: "#8A8078" }}
            >
              <span>
                {totalCompleted} of {totalItems} items complete
              </span>
              <span>{overallPct}%</span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "#E8E2DA" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${overallPct}%`, backgroundColor: "#C4785A" }}
              />
            </div>
          </div>
        )}

        {/* Quick links to special checklists */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          {!homecomingCardDismissed && (
            <Link
              to="/homecoming-checklist"
              className="relative flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:border-[#C4785A]/50"
              style={{ borderColor: "#C8B8A2", backgroundColor: "white" }}
            >
              <button
                type="button"
                onClick={dismissHomecomingCard}
                aria-label="Not expecting — hide this card"
                className="absolute right-1.5 top-1.5 rounded-full p-1 text-muted-foreground hover:bg-black/5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: "#F5F0E8" }}
              >
                <Home className="h-5 w-5" style={{ color: "#C4785A" }} />
              </span>
              <div>
                <p className="font-display text-sm font-semibold" style={{ color: "#3D2B1F" }}>
                  Bringing Baby Home
                </p>
                <p className="font-body text-xs" style={{ color: "#8A8078" }}>
                  For expecting parents
                </p>
              </div>
            </Link>
          )}
          <Link
            to="/travel-checklist"
            className="flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:border-[#C4785A]/50"
            style={{ borderColor: "#C8B8A2", backgroundColor: "white" }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: "#F5F0E8" }}
            >
              <Luggage className="h-5 w-5" style={{ color: "#C4785A" }} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold" style={{ color: "#3D2B1F" }}>
                Travel Mode
              </p>
              <p className="font-body text-xs" style={{ color: "#8A8078" }}>
                Packing + hotel safety
              </p>
            </div>
          </Link>
          <Link
            to="/registry-check"
            className="flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:border-[#C4785A]/50"
            style={{ borderColor: "#C8B8A2", backgroundColor: "white" }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: "#F5F0E8" }}
            >
              <ShieldCheck className="h-5 w-5" style={{ color: "#C4785A" }} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold" style={{ color: "#3D2B1F" }}>
                Recall Check
              </p>
              <p className="font-body text-xs" style={{ color: "#8A8078" }}>
                Check before you add to your registry or use a hand-me-down
              </p>
            </div>
          </Link>
          <Link
            to="/emergency-info"
            className="flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:border-[#C4785A]/50"
            style={{ borderColor: "#C8B8A2", backgroundColor: "white" }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: "#F5F0E8" }}
            >
              <HeartPulse className="h-5 w-5" style={{ color: "#C4785A" }} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold" style={{ color: "#3D2B1F" }}>
                Emergency Info
              </p>
              <p className="font-body text-xs" style={{ color: "#8A8078" }}>
                Card for a babysitter or sitter
              </p>
            </div>
          </Link>
        </div>

        {loading ? (
          <p className="font-body text-sm" style={{ color: "#8A8078" }}>
            Loading checklists...
          </p>
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
                  <div
                    className="flex items-center justify-between border-b px-5 py-4"
                    style={{ borderColor: "#E8E2DA" }}
                  >
                    <h2 className="font-display text-lg font-semibold" style={{ color: "#3D2B1F" }}>
                      {room.label}
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="font-body text-xs" style={{ color: "#8A8078" }}>
                        {roomCompleted}/{room.items.length}
                      </span>
                      <div
                        className="h-1.5 w-16 overflow-hidden rounded-full"
                        style={{ backgroundColor: "#E8E2DA" }}
                      >
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
                          style={
                            idx === room.items.length - 1 ? { borderRadius: "0 0 1rem 1rem" } : {}
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
