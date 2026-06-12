import {
  ShieldCheck, Bed, Moon, Footprints, Utensils, Music, Armchair, Grid3x3, Wind, DoorClosed,
  Baby, Milk, Cookie, Brush, Radio, Tent, Package,
} from "lucide-react";

export type CategoryKey =
  | "car_seat"
  | "crib"
  | "bassinet"
  | "stroller"
  | "high_chair"
  | "swing"
  | "bouncer"
  | "activity_center"
  | "sleep_sack"
  | "baby_gate"
  | "pacifier"
  | "formula"
  | "breast_milk"
  | "baby_food"
  | "toothbrush"
  | "baby_monitor"
  | "play_yard"
  | "other";

export const CATEGORIES: {
  key: CategoryKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}[] = [
  { key: "car_seat",        label: "Car seat",        icon: ShieldCheck, hint: "We'll track recalls and the manufacturer expiry date" },
  { key: "crib",            label: "Crib",            icon: Bed,         hint: "We'll remind you when to lower the mattress" },
  { key: "bassinet",        label: "Bassinet",        icon: Moon,        hint: "Outgrown when your baby can push up or exceeds the weight limit" },
  { key: "stroller",        label: "Stroller",        icon: Footprints,  hint: "Tracked for recalls" },
  { key: "high_chair",      label: "High chair",      icon: Utensils,    hint: "Add when your baby shows readiness for solids" },
  { key: "swing",           label: "Swing",           icon: Music,       hint: "Outgrown when your baby can sit up independently" },
  { key: "bouncer",         label: "Bouncer",         icon: Armchair,    hint: "We'll flag the weight limit" },
  { key: "activity_center", label: "Activity center", icon: Grid3x3,     hint: "Best when your baby can hold their head up but isn't yet walking" },
  { key: "sleep_sack",      label: "Sleep sack",      icon: Wind,        hint: "We'll prompt size-ups based on weight" },
  { key: "baby_gate",       label: "Baby gate",       icon: DoorClosed,  hint: "Hardware-mount at the top of stairs" },
  { key: "play_yard",       label: "Pack 'n Play",    icon: Tent,        hint: "Portable play yard / travel crib" },
  { key: "baby_monitor",    label: "Baby monitor",    icon: Radio,       hint: "Tracked for recalls" },
  { key: "pacifier",        label: "Pacifier",        icon: Baby,        hint: "We'll remind you to replace every ~2 months" },
  { key: "formula",         label: "Formula",         icon: Milk,        hint: "Track expiry & opened-can dates" },
  { key: "breast_milk",     label: "Breast Milk",     icon: Milk,        hint: "Storage & freshness tracking" },
  { key: "baby_food",       label: "Baby Food",       icon: Cookie,      hint: "Track expiry dates" },
  { key: "toothbrush",      label: "Toothbrush",      icon: Brush,       hint: "Replace every ~3 months" },
  { key: "other",           label: "Other",           icon: Package,     hint: "Anything else you want to track" },
];

export const CATEGORY_BY_KEY: Record<CategoryKey, (typeof CATEGORIES)[number]> =
  CATEGORIES.reduce((acc, c) => { acc[c.key] = c; return acc; }, {} as Record<CategoryKey, (typeof CATEGORIES)[number]>);

export function categoryFromLabel(label: string | null | undefined): (typeof CATEGORIES)[number] | undefined {
  if (!label) return undefined;
  const lc = label.toLowerCase();
  return CATEGORIES.find((c) => c.label.toLowerCase() === lc || c.key === lc);
}

export function guessCategoryFromText(text: string): CategoryKey | "" {
  const hay = text.toLowerCase();
  if (/car ?seat/.test(hay)) return "car_seat";
  if (/bassinet/.test(hay)) return "bassinet";
  if (/crib|cot\b/.test(hay)) return "crib";
  if (/stroller|pram|buggy/.test(hay)) return "stroller";
  if (/high ?chair/.test(hay)) return "high_chair";
  if (/baby swing|infant swing|\bswing\b/.test(hay)) return "swing";
  if (/bouncer/.test(hay)) return "bouncer";
  if (/activity ?center|jumperoo|exersaucer/.test(hay)) return "activity_center";
  if (/sleep ?sack|swaddle|wearable blanket/.test(hay)) return "sleep_sack";
  if (/baby ?gate|safety gate/.test(hay)) return "baby_gate";
  if (/pack ?n ?play|play ?yard|playard|travel crib/.test(hay)) return "play_yard";
  if (/baby monitor|video monitor/.test(hay)) return "baby_monitor";
  if (/pacifier|soother|binky|dummy/.test(hay)) return "pacifier";
  if (/formula/.test(hay)) return "formula";
  if (/breast ?milk/.test(hay)) return "breast_milk";
  if (/baby food|puree|stage [1-4]/.test(hay)) return "baby_food";
  if (/toothbrush|tooth ?brush/.test(hay)) return "toothbrush";
  return "";
}
