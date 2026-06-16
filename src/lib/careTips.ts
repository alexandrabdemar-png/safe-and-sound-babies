import type { CategoryKey } from "./productCategories";

export type CareTip = {
  tip: string;
  source: string;
};

export type CategoryCareTips = {
  tips: CareTip[];
  /** If true, extending use is NOT safe — show a warning instead of tips */
  doNotExtend?: boolean;
  doNotExtendReason?: string;
};

export const CARE_TIPS: Partial<Record<CategoryKey, CategoryCareTips>> = {
  car_seat: {
    doNotExtend: true,
    doNotExtendReason:
      "Car seats should never be used past their manufacturer expiration date or after any crash, even a minor one. The materials degrade over time and structural integrity may be compromised in a collision. Replace rather than repair.",
  },
  stroller: {
    tips: [
      { tip: "Wipe the frame with a damp cloth and mild soap after outings; avoid harsh cleaners that can corrode joints.", source: "Per manufacturer care guidelines" },
      { tip: "Remove and machine-wash fabric seat pads on a gentle, cold cycle; air dry to preserve shape.", source: "Per manufacturer care guidelines" },
      { tip: "Lubricate wheel axles and folding hinges every few months with a silicone-based lubricant to prevent squeaking and stiffness.", source: "Per manufacturer care guidelines" },
      { tip: "Check and tighten all bolts and screws periodically — vibration from regular use can loosen them over time.", source: "Per ASTM F833 maintenance guidance" },
      { tip: "Store folded in a dry location; prolonged outdoor exposure can degrade UV-sensitive fabrics and rust metal parts.", source: "Per manufacturer care guidelines" },
    ],
  },
  crib: {
    tips: [
      { tip: "Wipe the crib frame with a damp, non-toxic cloth; avoid chemical sprays near sleeping surfaces.", source: "Per AAP safe sleep guidelines" },
      { tip: "Tighten all hardware monthly — mattress support bolts and slat connections can loosen with regular use.", source: "Per ASTM F1169 crib safety standard" },
      { tip: "Rotate the crib mattress (head-to-foot) every 1–2 months to distribute wear evenly and extend its life.", source: "Per manufacturer care guidelines" },
    ],
  },
  bassinet: {
    tips: [
      { tip: "Spot-clean the sleep surface with a damp cloth and baby-safe detergent; never submerge the mattress.", source: "Per manufacturer care guidelines" },
      { tip: "Check the legs and locking mechanisms weekly to ensure stability.", source: "Per ASTM F2194 bassinet safety standard" },
    ],
  },
  sleep_sack: {
    tips: [
      { tip: "Machine wash on a gentle, warm cycle and tumble dry low; high heat can shrink fabric and reduce TOG rating.", source: "Per manufacturer care guidelines" },
      { tip: "Check zipper pulls and snaps before each use — damaged closures can become a hazard.", source: "Per manufacturer care guidelines" },
      { tip: "Replace if fabric becomes pilled, torn, or if the zipper no longer closes fully.", source: "Per manufacturer care guidelines" },
    ],
  },
  pacifier: {
    doNotExtend: true,
    doNotExtendReason:
      "Pacifiers should be replaced every 4–6 weeks regardless of appearance. Silicone degrades with repeated sterilization and can develop micro-tears that harbor bacteria. Always replace after any sign of discoloration, stickiness, or thinning.",
  },
  formula: {
    doNotExtend: true,
    doNotExtendReason:
      "Formula must never be used past the printed expiration date or more than 1 month after opening (powder) or 48 hours after mixing (liquid concentrate). Using expired formula can cause nutritional deficiency and bacterial illness.",
  },
  breast_milk: {
    tips: [
      { tip: "Freshly expressed milk lasts 4 hours at room temperature, 4 days in the refrigerator (back of the shelf), or 6 months in a deep freezer at 0°F.", source: "Per CDC human milk storage guidelines" },
      { tip: "Label every bag with date and volume; always use oldest milk first.", source: "Per CDC human milk storage guidelines" },
      { tip: "Thaw frozen milk in the refrigerator overnight or under warm running water — never microwave.", source: "Per AAP breastfeeding guidelines" },
    ],
  },
  baby_food: {
    tips: [
      { tip: "Opened pouches and jars should be refrigerated and used within 24–48 hours.", source: "Per USDA food safety guidelines" },
      { tip: "Never feed directly from the jar if you plan to save the rest — saliva introduces bacteria. Spoon portions into a bowl.", source: "Per USDA food safety guidelines" },
    ],
  },
  toothbrush: {
    tips: [
      { tip: "Replace every 3 months or sooner if bristles are frayed — worn bristles are less effective and can irritate gums.", source: "Per ADA (American Dental Association) guidelines" },
      { tip: "Rinse thoroughly after each use and store upright, uncovered, to air-dry.", source: "Per ADA guidelines" },
      { tip: "Replace immediately after any illness to avoid reintroducing germs.", source: "Per ADA guidelines" },
    ],
  },
  baby_monitor: {
    tips: [
      { tip: "Wipe the camera lens and unit with a dry microfiber cloth; avoid liquids near electronics.", source: "Per manufacturer care guidelines" },
      { tip: "Check for firmware updates periodically to ensure security patches are applied.", source: "Per manufacturer care guidelines" },
    ],
  },
  high_chair: {
    tips: [
      { tip: "Remove and hand-wash the seat pad after each messy meal; most are top-rack dishwasher safe — check your model's manual.", source: "Per manufacturer care guidelines" },
      { tip: "Wipe the tray immediately after meals; dried food can harbor bacteria and stain permanently.", source: "Per manufacturer care guidelines" },
      { tip: "Check the harness straps and tray lock mechanism monthly for wear or looseness.", source: "Per ASTM F404 high chair safety standard" },
    ],
  },
  swing: {
    tips: [
      { tip: "Wipe the seat with a damp, soapy cloth after use; check if the cover is machine washable per your model.", source: "Per manufacturer care guidelines" },
      { tip: "Check the motor speed and battery contacts regularly; corrosion can reduce swing performance.", source: "Per manufacturer care guidelines" },
    ],
  },
  bouncer: {
    tips: [
      { tip: "Spot-clean the seat fabric with mild soap and a damp cloth; air dry fully before next use.", source: "Per manufacturer care guidelines" },
      { tip: "Inspect the frame hinges and harness buckles before each use.", source: "Per ASTM F2167 bouncer safety standard" },
    ],
  },
  play_yard: {
    tips: [
      { tip: "Clean the mattress pad with a damp cloth and mild soap; allow to dry completely before folding to prevent mold.", source: "Per manufacturer care guidelines" },
      { tip: "Check that all locking mechanisms fully engage before placing baby inside.", source: "Per ASTM F406 play yard safety standard" },
    ],
  },
  baby_gate: {
    tips: [
      { tip: "Re-test the gate latch daily; pressure-mount gates in particular can loosen with repeated use.", source: "Per JPMA gate safety guidelines" },
      { tip: "Only use hardware-mounted gates at the top of stairs — pressure-mount gates are not safe for stair tops.", source: "Per CPSC baby gate safety guidance" },
      { tip: "Check that wall anchors and screws remain tight; tighten if any wobble is detected.", source: "Per manufacturer care guidelines" },
    ],
  },
  activity_center: {
    tips: [
      { tip: "Wipe plastic toys and the frame with a baby-safe disinfectant cloth weekly.", source: "Per manufacturer care guidelines" },
      { tip: "Check that toy attachments are secure and show no signs of cracking before each use.", source: "Per manufacturer care guidelines" },
    ],
  },
};
