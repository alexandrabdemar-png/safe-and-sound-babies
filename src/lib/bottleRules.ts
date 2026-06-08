// Default shelf life rules for milk/formula bottles (minutes).
// Based on CDC and AAP guidance. These are conservative defaults —
// users can adjust the alert window, but expiration follows these rules.

export type BottleType =
  | "breastmilk_fresh"
  | "breastmilk_thawed"
  | "formula_prepared"
  | "formula_opened";

export type Storage = "room" | "fridge" | "freezer";

export const BOTTLE_TYPES: { value: BottleType; label: string; hint: string }[] = [
  { value: "breastmilk_fresh", label: "Freshly pumped breastmilk", hint: "Just expressed, never frozen" },
  { value: "breastmilk_thawed", label: "Thawed breastmilk", hint: "Previously frozen, now thawed" },
  { value: "formula_prepared", label: "Prepared formula", hint: "Mixed from powder or concentrate" },
  { value: "formula_opened", label: "Opened ready-to-feed", hint: "Liquid formula container opened" },
];

export const STORAGE_OPTIONS: { value: Storage; label: string }[] = [
  { value: "room", label: "Room temperature" },
  { value: "fridge", label: "Refrigerator" },
  { value: "freezer", label: "Freezer" },
];

// Shelf life in minutes. `null` = not allowed for that storage.
const SHELF_LIFE: Record<BottleType, Record<Storage, number | null>> = {
  breastmilk_fresh: {
    room: 4 * 60,           // 4 hours
    fridge: 4 * 24 * 60,    // 4 days
    freezer: 180 * 24 * 60, // 6 months
  },
  breastmilk_thawed: {
    room: 2 * 60,           // 2 hours
    fridge: 24 * 60,        // 24 hours
    freezer: null,          // never refreeze
  },
  formula_prepared: {
    room: 2 * 60,           // 2 hours unfed (1h once feeding starts)
    fridge: 24 * 60,        // 24 hours
    freezer: null,          // do not freeze
  },
  formula_opened: {
    room: 2 * 60,
    fridge: 48 * 60,        // 48 hours
    freezer: null,
  },
};

export function shelfLifeMinutes(type: BottleType, storage: Storage): number | null {
  return SHELF_LIFE[type][storage];
}

export function computeExpiresAt(type: BottleType, storage: Storage, startedAt: Date): Date | null {
  const mins = shelfLifeMinutes(type, storage);
  if (mins == null) return null;
  return new Date(startedAt.getTime() + mins * 60_000);
}

export function bottleTypeLabel(type: BottleType): string {
  return BOTTLE_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function storageLabel(s: Storage): string {
  return STORAGE_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "Expired";
  const totalMin = Math.floor(msRemaining / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}
