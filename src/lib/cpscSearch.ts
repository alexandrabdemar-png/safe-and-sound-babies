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

const FOOD_KEYWORDS = ["formula", "food", "puree", "cereal", "snack", "milk", "feeding", "baby food", "infant food", "organic"];

export type CpscRecall = {
  RecallID: string;
  RecallHeading: string;
  URL: string;
  RecallDate?: string;
  Products?: Array<{ Name: string; Description: string }>;
  Inconjunctions?: Array<{ Name: string }>;
};

export type FdaRecall = {
  id: string;
  productDescription: string;
  reasonForRecall: string;
  recallDate: string;
  status: string;
  url: string;
};

export function isBabyRelated(recall: CpscRecall): boolean {
  const text = [
    recall.RecallHeading,
    ...(recall.Products?.map((p) => `${p.Name} ${p.Description}`) ?? []),
    ...(recall.Inconjunctions?.map((i) => i.Name) ?? []),
  ].join(" ").toLowerCase();
  return BABY_KEYWORDS.some((kw) => text.includes(kw));
}

export function isFoodRelated(query: string): boolean {
  const q = query.toLowerCase();
  return FOOD_KEYWORDS.some((kw) => q.includes(kw));
}

// Returns true if the recall text contains a meaningful word-boundary match for the query.
// Splits query into words of 4+ chars and checks each appears as a whole word.
export function isStrongMatch(recallText: string, query: string): boolean {
  const text = recallText.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
  if (words.length === 0) return text.includes(query.toLowerCase());
  // At least half the meaningful words must match as whole words
  const matchCount = words.filter((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text)).length;
  return matchCount >= Math.ceil(words.length / 2);
}

function recallTextFor(recall: CpscRecall): string {
  return [
    recall.RecallHeading,
    ...(recall.Products?.map((p) => `${p.Name} ${p.Description}`) ?? []),
    ...(recall.Inconjunctions?.map((i) => i.Name) ?? []),
  ].join(" ");
}

const TEN_YEARS_AGO = new Date();
TEN_YEARS_AGO.setFullYear(TEN_YEARS_AGO.getFullYear() - 10);

async function fetchWithTimeout(url: string, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function isWithinTenYears(recall: CpscRecall): boolean {
  if (!recall.RecallDate) return true; // include if date unknown
  return new Date(recall.RecallDate) >= TEN_YEARS_AGO;
}

export async function searchCpsc(query: string): Promise<CpscRecall[]> {
  const res = await fetchWithTimeout(
    `https://www.saferproducts.gov/RestWebServices/Recall?format=json&Keyword=${encodeURIComponent(query)}`
  );
  if (!res.ok) throw new Error(`CPSC API error ${res.status}`);
  const data = await res.json();
  const all: CpscRecall[] = Array.isArray(data) ? data : [];
  return all
    .filter(isBabyRelated)
    .filter(isWithinTenYears)
    .filter((r) => isStrongMatch(recallTextFor(r), query))
    .slice(0, 10);
}

const FDA_BABY_KEYWORDS = ["infant", "baby", "formula", "breast milk", "toddler", "newborn", "child food", "baby food", "nara", "infant formula", "enfamil", "similac", "gerber", "holle", "hipp", "kendamil"];

export async function searchFdaRecalls(query: string): Promise<FdaRecall[]> {
  try {
    const url = `https://api.fda.gov/food/enforcement.json?search=product_description:"${encodeURIComponent(query)}"&limit=20`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = await res.json();
    const results: Array<{
      recall_number?: string;
      product_description?: string;
      reason_for_recall?: string;
      recall_initiation_date?: string;
      status?: string;
    }> = data?.results ?? [];
    return results
      .filter((r) => {
        const text = `${r.product_description ?? ""} ${r.reason_for_recall ?? ""}`.toLowerCase();
        const isBaby = FDA_BABY_KEYWORDS.some((kw) => text.includes(kw));
        const isMatch = isStrongMatch(text, query);
        return isBaby && isMatch;
      })
      .slice(0, 10)
      .map((r) => ({
        id: r.recall_number ?? Math.random().toString(36).slice(2),
        productDescription: r.product_description ?? "",
        reasonForRecall: r.reason_for_recall ?? "",
        recallDate: r.recall_initiation_date ?? "",
        status: r.status ?? "",
        url: "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts",
      }));
  } catch {
    return [];
  }
}

export async function fetchFdaBabyRecallCount(daysBack = 30): Promise<number> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const url = `https://api.fda.gov/food/enforcement.json?search=recall_initiation_date:[${fmt(start)}+TO+${fmt(end)}]&limit=100`;
  const res = await fetchWithTimeout(url);
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

  const cpscPromise = (async () => {
    try {
      const res = await fetchWithTimeout(
        `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=${startStr}`
      );
      if (!res.ok) return [] as CpscRecall[];
      const data = await res.json();
      const all: CpscRecall[] = Array.isArray(data) ? data : [];
      return all.filter(isBabyRelated);
    } catch {
      return [] as CpscRecall[];
    }
  })();

  // FDA food recalls (formulas, baby food, breast milk, etc.) — Nara-class recalls live here, not on CPSC.
  const fdaPromise = (async () => {
    try {
      const end = new Date();
      const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
      const url = `https://api.fda.gov/food/enforcement.json?search=recall_initiation_date:[${fmt(start)}+TO+${fmt(end)}]&limit=100`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) return [] as CpscRecall[];
      const data = await res.json();
      const results: Array<{
        recall_number?: string;
        product_description?: string;
        reason_for_recall?: string;
        recall_initiation_date?: string;
        recalling_firm?: string;
      }> = data?.results ?? [];
      return results
        .filter((r) => {
          const text = `${r.product_description ?? ""} ${r.reason_for_recall ?? ""} ${r.recalling_firm ?? ""}`.toLowerCase();
          return FDA_BABY_KEYWORDS.some((kw) => text.includes(kw));
        })
        .map<CpscRecall>((r) => {
          const dateIso = r.recall_initiation_date
            ? `${r.recall_initiation_date.slice(0, 4)}-${r.recall_initiation_date.slice(4, 6)}-${r.recall_initiation_date.slice(6, 8)}`
            : undefined;
          const name = r.recalling_firm
            ? `${r.recalling_firm} — ${(r.product_description ?? "").slice(0, 120)}`
            : (r.product_description ?? "FDA recall");
          return {
            RecallID: `fda-${r.recall_number ?? Math.random().toString(36).slice(2)}`,
            RecallHeading: name,
            URL: "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts",
            RecallDate: dateIso,
            Products: [{ Name: r.product_description ?? "", Description: r.reason_for_recall ?? "" }],
          };
        });
    } catch {
      return [] as CpscRecall[];
    }
  })();

  const [cpsc, fda] = await Promise.all([cpscPromise, fdaPromise]);
  // Dedupe by RecallID
  const seen = new Set<string>();
  return [...cpsc, ...fda].filter((r) => {
    if (seen.has(r.RecallID)) return false;
    seen.add(r.RecallID);
    return true;
  });
}
