// FDA's "Recalls, Market Withdrawals & Safety Alerts" RSS feed: the company
// announcements FDA posts the day a recall is announced, each with a link to
// the full article. openFDA's enforcement API (used elsewhere) only lists a
// recall once FDA classifies it, often weeks later — so a toddler-snack
// recall announced on a Friday would otherwise be missing from Recall Radar.

import { BABY_BRANDS } from "@/lib/babyBrands";
import { COMMON_BABY_FOOD_BRANDS } from "@/lib/foodSearchMatch";

export const FDA_RECALLS_RSS_URL =
  "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml";

export type FdaRecallNewsItem = {
  id: string;
  title: string;
  url: string;
  description: string;
  /** ISO date (YYYY-MM-DD) the item was published, or null if unparseable. */
  date: string | null;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  trade: "™",
  reg: "®",
};

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function tag(item: string, name: string): string {
  const m = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  let v = m[1]!.trim();
  const cdata = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) v = cdata[1]!;
  else v = decode(v);
  // Descriptions are often HTML; keep plain text only.
  return decode(v.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function isoDate(pubDate: string): string | null {
  const t = Date.parse(pubDate);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
}

export function parseFdaRecallRss(xml: string): FdaRecallNewsItem[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const out: FdaRecallNewsItem[] = [];
  for (const item of items) {
    const title = tag(item, "title");
    const url = tag(item, "link") || tag(item, "guid");
    if (!title || !/^https?:\/\//i.test(url)) continue;
    out.push({
      id: tag(item, "guid") || url,
      title,
      url,
      description: tag(item, "description"),
      date: isoDate(tag(item, "pubDate") || tag(item, "dc:date")),
    });
  }
  return out;
}

// Generic terms, matched as whole words so "kid" doesn't hit "kidney" and
// "child" doesn't hit "Childers Farms".
const BABY_TERMS = [
  "baby",
  "babies",
  "infant",
  "infants",
  "toddler",
  "toddlers",
  "newborn",
  "children",
  "child's",
  "children's",
  "kids",
  "kid's",
  "formula",
  "breast milk",
  "baby food",
  "teether",
  "teething",
  "pouch",
  "pouches",
  "puree",
  "purée",
  "sippy",
  "pacifier",
];

// Brand names only — not parent companies, since "Nestlé" or "Procter &
// Gamble" recalls are usually adult products.
const BRAND_TERMS = Array.from(
  new Set(
    [...BABY_BRANDS.map((b) => b.brand), ...COMMON_BABY_FOOD_BRANDS].map((b) => b.toLowerCase()),
  ),
).filter((b) => b.length >= 4);

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const TERM_RE = new RegExp(
  `\\b(${[...BABY_TERMS, ...BRAND_TERMS].map(escapeRe).join("|")})\\b`,
  "i",
);

export function isBabyRelatedNews(item: { title: string; description: string }): boolean {
  return TERM_RE.test(`${item.title} ${item.description}`);
}

/** Baby/kid-related items published within the last `daysBack` days, newest first. */
export function recentBabyRecallNews(
  items: FdaRecallNewsItem[],
  daysBack = 30,
  now: Date = new Date(),
): FdaRecallNewsItem[] {
  const cutoff = new Date(now.getTime() - daysBack * 86400000).toISOString().slice(0, 10);
  return items
    .filter((i) => !i.date || i.date >= cutoff)
    .filter(isBabyRelatedNews)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}
