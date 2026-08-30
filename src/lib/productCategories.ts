import {
  ShieldCheck, Bed, Moon, Utensils, Music, Armchair, Grid3x3, Wind, DoorClosed,
  Baby, Milk, Cookie, Brush, Radio, Tent, Package, Backpack, ToyBrick,
  Bath, Layers, Circle,
} from "lucide-react";
import { StrollerIcon } from "@/components/StrollerIcon";
import { BottleIcon } from "@/components/BottleIcon";
// Same illustrated set shown on the public marketing home page (src/routes/
// index.tsx) — used here too so a category picked while adding a product
// looks like the same category a parent saw on the home page, instead of a
// plain outline icon. Only categories with a genuine matching illustration
// get one; the rest keep their existing lucide icon below.
import illoCarSeat from "@/assets/hd-carseat.png";
import illoCrib from "@/assets/hd-crib.png";
import illoStroller from "@/assets/hd-stroller.png";
import illoPackNPlay from "@/assets/hd-packnplay.png";
import illoSwaddle from "@/assets/hd-swaddle.png";
import illoPacifier from "@/assets/hd-pacifier.png";
import illoFormula from "@/assets/hd-formula.png";
import illoBreastmilk from "@/assets/hd-breastmilk.png";
import illoBabyFood from "@/assets/hd-babyfood.png";
import illoBouncer from "@/assets/hd-bouncer.png";
import illoBlocks from "@/assets/hd-blocks.png";
import illoCarrier from "@/assets/hd-carrier.png";
import illoBassinet from "@/assets/hd-bassinet.png";
import illoHighChair from "@/assets/hd-highchair.png";
import illoSwing from "@/assets/hd-swing.png";
import illoActivityCenter from "@/assets/hd-activitycenter.png";
import illoBabyGate from "@/assets/hd-babygate.png";
import illoMonitor from "@/assets/hd-monitor.png";
import illoToothbrush from "@/assets/hd-toothbrush.png";
import illoOther from "@/assets/hd-other.png";
import illoBottle from "@/assets/hd-bottle.png";
import illoBath from "@/assets/hd-bath.png";
import illoDiaper from "@/assets/hd-diaper.png";
import illoTeether from "@/assets/hd-teether.png";

export type CategoryKey =
  | "car_seat"
  | "crib"
  | "bassinet"
  | "stroller"
  | "carrier"
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
  | "toys"
  | "bottle"
  | "bath"
  | "diaper"
  | "teether"
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
  /** Same illustrated PNG shown for this category on the marketing home
   * page, when one exists. Undefined categories fall back to `icon` above. */
  illustration?: string;
  hint?: string;
  minAgeMonths?: number;
  maxAgeMonths?: number;
}[] = [
  { key: "car_seat",        label: "Car seat",        icon: ShieldCheck, illustration: illoCarSeat,   hint: "We'll track recalls and the manufacturer expiration date", minAgeMonths: 0 },
  { key: "crib",            label: "Crib",            icon: Bed,         illustration: illoCrib,      hint: "We'll remind you when to lower the mattress", minAgeMonths: 0 },
  { key: "bassinet",        label: "Bassinet",        icon: Moon,        illustration: illoBassinet, hint: "Outgrown when your baby can push up or exceeds the weight limit", minAgeMonths: 0, maxAgeMonths: 6 },
  { key: "stroller",        label: "Stroller",        icon: StrollerIcon, illustration: illoStroller, hint: "Tracked for recalls", minAgeMonths: 0 },
  { key: "carrier",         label: "Baby carrier",    icon: Backpack,    illustration: illoCarrier,   hint: "Tracked for recalls — check the hip and head-support guidance for your baby's age", minAgeMonths: 0 },
  { key: "high_chair",      label: "High chair",      icon: Utensils,    illustration: illoHighChair, hint: "Add when your baby shows readiness for solids", minAgeMonths: 6 },
  { key: "swing",           label: "Swing",           icon: Music,       illustration: illoSwing, hint: "Outgrown when your baby can sit up independently", minAgeMonths: 0, maxAgeMonths: 6 },
  { key: "bouncer",         label: "Bouncer",         icon: Armchair,    illustration: illoBouncer,   hint: "We'll flag the weight limit", minAgeMonths: 0, maxAgeMonths: 6 },
  { key: "activity_center", label: "Activity center", icon: Grid3x3,     illustration: illoActivityCenter, hint: "Best when your baby can hold their head up but isn't yet walking", minAgeMonths: 4, maxAgeMonths: 12 },
  { key: "sleep_sack",      label: "Sleep sack",      icon: Wind,        illustration: illoSwaddle,   hint: "We'll prompt a size-up check a few months after you add it", minAgeMonths: 0 },
  { key: "baby_gate",       label: "Baby gate",       icon: DoorClosed,  illustration: illoBabyGate, hint: "Hardware-mount at the top of stairs", minAgeMonths: 6 },
  { key: "play_yard",       label: "Pack 'n Play",    icon: Tent,        illustration: illoPackNPlay, hint: "Portable play yard / travel crib", minAgeMonths: 0 },
  { key: "baby_monitor",    label: "Baby monitor",    icon: Radio,       illustration: illoMonitor, hint: "Tracked for recalls", minAgeMonths: 0 },
  { key: "pacifier",        label: "Pacifier",        icon: Baby,        illustration: illoPacifier,  hint: "We'll remind you to replace every ~2 months", minAgeMonths: 0 },
  { key: "formula",         label: "Formula",         icon: Milk,        illustration: illoFormula,   hint: "Track expiration & opened-can dates", minAgeMonths: 0 },
  { key: "breast_milk",     label: "Breast Milk",     icon: Milk,        illustration: illoBreastmilk, hint: "Storage & freshness tracking", minAgeMonths: 0 },
  { key: "baby_food",       label: "Baby Food",       icon: Cookie,      illustration: illoBabyFood,  hint: "Track expiration dates", minAgeMonths: 6 },
  { key: "toothbrush",      label: "Toothbrush",      icon: Brush,       illustration: illoToothbrush, hint: "Replace every ~3 months", minAgeMonths: 6 },
  { key: "toys",            label: "Toys",            icon: ToyBrick,    illustration: illoBlocks,    hint: "We'll flag choking-hazard recalls, especially for small parts and batteries", minAgeMonths: 0 },
  { key: "bottle",          label: "Baby bottle",     icon: BottleIcon,  illustration: illoBottle,  hint: "We'll remind you to replace nipples and check for recalls", minAgeMonths: 0 },
  { key: "bath",            label: "Bath",            icon: Bath,        illustration: illoBath,    hint: "Tubs, soaps & lotions — tracked for recalls and expiration dates", minAgeMonths: 0 },
  { key: "diaper",          label: "Diapers & wipes", icon: Layers,      illustration: illoDiaper,  hint: "We'll remind you when it's time to size up", minAgeMonths: 0 },
  { key: "teether",         label: "Teether",         icon: Circle,      illustration: illoTeether, hint: "Tracked for recalls — check regularly for wear and small parts", minAgeMonths: 3 },
  { key: "other",           label: "Other",           icon: Package,     illustration: illoOther, hint: "Anything else you want to track" },
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
  if (/carrier|baby wrap|baby sling|ring sling/.test(hay)) return "carrier";
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
  if (/\btoys?\b|\bblocks?\b|\brattle\b|teether/.test(hay)) return "toys";
  return "";
}
