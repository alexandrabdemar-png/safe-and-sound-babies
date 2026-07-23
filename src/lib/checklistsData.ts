// Room-by-room home safety checklist data. Kept dependency-free (no
// supabase/router imports) so it — and its age-relevance tagging — can be
// unit tested in isolation from src/routes/_authenticated/checklists.tsx.

export interface ChecklistItem {
  key: string;
  label: string;
  // Developmental stage the hazard applies to — e.g. cabinet locks only
  // matter once a baby is mobile enough to reach them. Undefined bounds
  // mean the item applies from birth onward.
  minAgeMonths?: number;
  maxAgeMonths?: number;
}

export interface Room {
  id: string;
  label: string;
  items: ChecklistItem[];
}

export const ROOMS: Room[] = [
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
      { key: "lr_furniture_anchored", label: "Tall furniture anchored to wall", minAgeMonths: 4 },
      { key: "lr_sharp_corners", label: "Sharp coffee table corners padded", minAgeMonths: 6 },
      {
        key: "lr_small_objects_away",
        label: "Small objects (coins, batteries) out of reach",
        minAgeMonths: 4,
      },
      { key: "lr_blind_cords", label: "Blind/curtain cords looped up or cut" },
      { key: "lr_outlet_covers", label: "All outlets covered", minAgeMonths: 6 },
      { key: "lr_fireplace_gate", label: "Fireplace/heater gated or guarded", minAgeMonths: 6 },
      { key: "lr_houseplants_safe", label: "All houseplants are non-toxic", minAgeMonths: 6 },
      { key: "lr_rugs_secured", label: "Area rugs have non-slip backing", minAgeMonths: 9 },
      {
        key: "lr_remote_batteries",
        label: "Remote control battery covers secured",
        minAgeMonths: 6,
      },
    ],
  },
  {
    id: "kitchen",
    label: "Kitchen",
    items: [
      {
        key: "kitchen_cabinet_locks",
        label: "Child locks on lower cabinet doors",
        minAgeMonths: 6,
      },
      {
        key: "kitchen_cleaning_products_high",
        label: "Cleaning products stored high or locked",
        minAgeMonths: 6,
      },
      { key: "kitchen_knives_locked", label: "Knives in locked drawer or out of reach" },
      { key: "kitchen_stove_knob_covers", label: "Stove knob covers installed", minAgeMonths: 9 },
      { key: "kitchen_back_burners", label: "Cook on back burners when possible" },
      { key: "kitchen_fridge_lock", label: "Refrigerator lock if needed", minAgeMonths: 9 },
      { key: "kitchen_trash_locked", label: "Trash can locked or secured", minAgeMonths: 6 },
      {
        key: "kitchen_dishwasher_latched",
        label: "Dishwasher door stays latched",
        minAgeMonths: 6,
      },
      { key: "kitchen_tablecloth_removed", label: "No tablecloth to pull down", minAgeMonths: 6 },
      { key: "kitchen_pet_food_away", label: "Pet food and bowls moved away", minAgeMonths: 6 },
    ],
  },
  {
    id: "bathroom",
    label: "Bathroom",
    items: [
      { key: "bath_door_locked", label: "Bathroom door kept closed/locked", minAgeMonths: 9 },
      { key: "bath_toilet_lock", label: "Toilet lid lock installed", minAgeMonths: 9 },
      { key: "bath_non_slip_mat", label: "Non-slip mat inside and outside tub", minAgeMonths: 6 },
      { key: "bath_water_temp_120", label: "Water heater set to ≤ 120°F (49°C)" },
      { key: "bath_never_leave_alone", label: "Never leave baby alone in water" },
      { key: "bath_meds_locked", label: "All medications in locked cabinet" },
      {
        key: "bath_razors_away",
        label: "Razors and sharp items stored out of reach",
        minAgeMonths: 9,
      },
      {
        key: "bath_cosmetics_away",
        label: "Cosmetics and toiletries out of reach",
        minAgeMonths: 9,
      },
      { key: "bath_hair_dryer_away", label: "Hair dryer and appliances unplugged and stored" },
    ],
  },
];
