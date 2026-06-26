export const BABY_KEYWORDS = [
  "baby", "infant", "toddler", "child", "children", "kid", "kids", "nursery",
  "car seat", "carseat", "stroller", "pram", "bassinet", "crib", "cradle",
  "pacifier", "soother", "bouncer", "swing", "high chair", "highchair",
  "carrier", "sling", "wrap", "swaddle", "sleep sack", "monitor",
  "formula", "breast", "bottle", "nipple", "teether", "teething",
  "play mat", "playmat", "activity mat", "jumper", "walker", "jolly",
  "rocker", "boppy", "dock a tot", "dockatot", "snoo", "mamaroo",
  "graco", "chicco", "evenflo", "britax", "uppababy", "nuna", "doona",
  "fisher-price", "fisher price", "4moms", "ergobaby", "babybjorn",
  "baby bjorn", "bumbo", "joovy", "bob", "thule", "cybex",
  "pack n play", "pack and play", "playard", "playpen",
  "baby food", "puree", "feeding", "sippy", "diaper", "wipe",
  "newborn", "preemie", "layette", "onesie", "sleeper",
];

export type CpscRecall = {
  RecallID: string;
  RecallHeading: string;
  URL: string;
  RecallDate?: string;
  Products?: Array<{ Name: string; Description: string }>;
  Inconjunctions?: Array<{ Name: string }>;
};

export function isBabyRelated(recall: CpscRecall): boolean {
  const text = [
    recall.RecallHeading,
    ...(recall.Products?.map((p) => `${p.Name} ${p.Description}`) ?? []),
    ...(recall.Inconjunctions?.map((i) => i.Name) ?? []),
  ].join(" ").toLowerCase();
  return BABY_KEYWORDS.some((kw) => text.includes(kw));
}

export async function searchCpsc(query: string): Promise<CpscRecall[]> {
  const res = await fetch(
    `https://www.saferproducts.gov/RestWebServices/Recall?format=json&Keyword=${encodeURIComponent(query)}`
  );
  if (!res.ok) throw new Error(`CPSC API error ${res.status}`);
  const data = await res.json();
  const all: CpscRecall[] = Array.isArray(data) ? data : [];
  return all.filter(isBabyRelated);
}

const FDA_BABY_KEYWORDS = ["infant", "baby", "formula", "breast milk", "toddler", "newborn", "child food", "baby food", "nara", "infant formula", "enfamil", "similac", "gerber", "holle", "hipp", "kendamil"];

export async function fetchFdaBabyRecallCount(daysBack = 30): Promise<number> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const url = `https://api.fda.gov/food/enforcement.json?search=recall_initiation_date:[${fmt(start)}+TO+${fmt(end)}]&limit=100`;
  const res = await fetch(url);
  if (!res.ok) return 0;
  const data = await res.json();
  const results: Array<{ product_description?: string; reason_for_recall?: string }> = data?.results ?? [];
  return results.filter((r) => {
    const text = `${r.product_description ?? ""} ${r.reason_for_recall ?? ""}`.toLowerCase();
    return FDA_BABY_KEYWORDS.some((kw) => text.includes(kw));
  }).length;
}

export async function fetchRecentBabyRecalls(daysBack = 30): Promise<CpscRecall[]> {
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const startStr = start.toISOString().slice(0, 10);
  const res = await fetch(
    `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=${startStr}`
  );
  if (!res.ok) throw new Error(`CPSC API error ${res.status}`);
  const data = await res.json();
  const all: CpscRecall[] = Array.isArray(data) ? data : [];
  return all.filter(isBabyRelated);
}
