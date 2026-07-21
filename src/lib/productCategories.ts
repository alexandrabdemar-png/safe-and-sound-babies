import {
  ShieldCheck, Bed, Moon, Utensils, Music, Armchair, Grid3x3, Wind, DoorClosed,
  Baby, Milk, Cookie, Brush, Radio, Tent, Package,
} from "lucide-react";
import { StrollerIcon } from "@/components/StrollerIcon";

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

// Age-appropriateness guidance per category, in months of ADJUSTED age.
// These are conservative "not-before" thresholds drawn from AAP + product-
// safety guidance (e.g. AAP: no honey/cow's milk before 12mo; solids readiness
// ~6mo; walkers/activity centers require head control; pacifier weaning
// starts ~6mo). Used by the scan flow to warn a parent when a scanned
// product isn't age-appropriate yet for the active child — the app still
// lets them save it (they may be prepping ahead), but shows a "Wait until X"
// banner so nothing gets used before the recommended start.
//   minAgeMonths: earliest recommended start
//   maxAgeMonths: outgrown / no longer safe after this age (soft ceiling)
export const CATEGORIES: {
  key: CategoryKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  minAgeMonths?: number;
  maxAgeMonths?: number;
}[] = [
  { key: "car_seat",        label: "Car seat",        icon: ShieldCheck, hint: "We'll track recalls and the manufacturer expiration date", minAgeMonths: 0 },
  { key: "crib",            label: "Crib",            icon: Bed,         hint: "We'll remind you when to lower the mattress", minAgeMonths: 0 },
  { key: "bassinet",        label: "Bassinet",        icon: Moon,        hint: "Outgrown when your baby can push up or exceeds the weight limit", minAgeMonths: 0, maxAgeMonths: 6 },
  { key: "stroller",        label: "Stroller",        icon: StrollerIcon, hint: "Tracked for recalls", minAgeMonths: 0 },
  { key: "high_chair",      label: "High chair",      icon: Utensils,    hint: "Add when your baby shows readiness for solids", minAgeMonths: 6 },
  { key: "swing",           label: "Swing",           icon: Music,       hint: "Outgrown when your baby can sit up independently", minAgeMonths: 0, maxAgeMonths: 6 },
  { key: "bouncer",         label: "Bouncer",         icon: Armchair,    hint: "We'll flag the weight limit", minAgeMonths: 0, maxAgeMonths: 6 },
  { key: "activity_center", label: "Activity center", icon: Grid3x3,     hint: "Best when your baby can hold their head up but isn't yet walking", minAgeMonths: 4, maxAgeMonths: 12 },
  { key: "sleep_sack",      label: "Sleep sack",      icon: Wind,        hint: "We'll prompt size-ups based on weight", minAgeMonths: 0 },
  { key: "baby_gate",       label: "Baby gate",       icon: DoorClosed,  hint: "Hardware-mount at the top of stairs", minAgeMonths: 6 },
  { key: "play_yard",       label: "Pack 'n Play",    icon: Tent,        hint: "Portable play yard / travel crib", minAgeMonths: 0 },
  { key: "baby_monitor",    label: "Baby monitor",    icon: Radio,       hint: "Tracked for recalls", minAgeMonths: 0 },
  { key: "pacifier",        label: "Pacifier",        icon: Baby,        hint: "We'll remind you to replace every ~2 months", minAgeMonths: 0 },
  { key: "formula",         label: "Formula",         icon: Milk,        hint: "Track expiration & opened-can dates", minAgeMonths: 0 },
  { key: "breast_milk",     label: "Breast Milk",     icon: Milk,        hint: "Storage & freshness tracking", minAgeMonths: 0 },
  { key: "baby_food",       label: "Baby Food",       icon: Cookie,      hint: "Track expiration dates", minAgeMonths: 6 },
  { key: "toothbrush",      label: "Toothbrush",      icon: Brush,       hint: "Replace every ~3 months", minAgeMonths: 6 },
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
