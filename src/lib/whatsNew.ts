// "What's New" home-screen banner content and dismissal-key logic. Split
// out of home.tsx so the version-scoping behavior is unit-testable: the
// dismissal is keyed by version, not a fixed key, so shipping a new entry
// (which becomes WHATS_NEW[0], and therefore the new LATEST_VERSION)
// naturally makes the banner reappear even for someone who dismissed the
// previous version — no separate "content changed" tracking needed.

export type WhatsNewEntry = {
  version: string;
  date: string;
  updates: string[];
};

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    version: "v1.4",
    date: "June 2025",
    updates: [
      "Recall Radar: live CPSC baby recall count right on your home screen",
      "Hand-Me-Down Checker flags expired and recalled second-hand gear you've logged",
      "Travel Safety Mode — a full 30-item checklist for traveling with baby",
    ],
  },
  {
    version: "v1.3",
    date: "May 2025",
    updates: [
      "Age jump alerts when your baby crosses a milestone — with relevant safety actions",
      "Gift Registry Safety Check: paste any URL to check for recalls before adding to your list",
      "Haptic feedback and smoother entrance animations throughout",
    ],
  },
];

export const LATEST_VERSION = WHATS_NEW[0].version;

/** The localStorage key a given version's dismissal is stored under. */
export function whatsNewDismissalKey(version: string): string {
  return `safesound.whatsNew.${version}`;
}
