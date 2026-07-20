// Travel safety checklist data. Kept dependency-free (no supabase/router
// imports) so it — and its age-relevance tagging — can be unit tested in
// isolation from src/routes/_authenticated/travel-checklist.tsx.

export interface TravelItem {
  key: string;
  label: string;
  note?: string;
  // Undefined bounds mean the item applies at any age.
  minAgeMonths?: number;
  maxAgeMonths?: number;
}

export interface TravelSection {
  id: string;
  label: string;
  emoji: string;
  items: TravelItem[];
}

export const TRAVEL_SECTIONS: TravelSection[] = [
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
        minAgeMonths: 24,
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
        minAgeMonths: 6,
      },
      { key: "travel_hotel_blind_cords", label: "Tie up blind and curtain cords out of reach" },
      {
        key: "travel_hotel_balcony",
        label: "Lock balcony door and place a piece of furniture in front of it",
        minAgeMonths: 9,
      },
      {
        key: "travel_hotel_small_objects",
        label: "Do a floor sweep for small objects, coins, and buttons",
        minAgeMonths: 4,
      },
      { key: "travel_hotel_temp", label: "Set room temperature to 68–72°F (20–22°C) for sleep" },
      {
        key: "travel_hotel_smoke_co",
        label: "Confirm smoke and CO detectors are present and working",
      },
      {
        key: "travel_hotel_bathroom_locked",
        label: "Keep bathroom door locked when not in use",
        minAgeMonths: 9,
      },
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
