import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  FDA_RECALLS_RSS_URL,
  parseFdaRecallRss,
  recentBabyRecallNews,
  type FdaRecallNewsItem,
} from "@/lib/fdaRecallFeed";

export type { FdaRecallNewsItem } from "@/lib/fdaRecallFeed";

let cache: { at: number; items: FdaRecallNewsItem[] } | null = null;
const CACHE_MS = 15 * 60 * 1000;

/**
 * Baby/kid recalls from FDA's live recall-announcement feed, last 30 days.
 * Fetched server-side (fda.gov doesn't allow browser CORS) and cached for
 * 15 minutes per server instance. Throws on failure so Recall Radar can show
 * its "couldn't load" banner instead of silently showing fewer recalls.
 */
export const fetchFdaRecallNews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<FdaRecallNewsItem[]> => {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.items;
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 8000);
    try {
      const res = await fetch(FDA_RECALLS_RSS_URL, {
        signal: c.signal,
        headers: {
          "User-Agent": "PeaceOfMine/1.0 (+https://peace-of-mine.lovable.app)",
          Accept: "application/rss+xml, application/xml, text/xml",
        },
      });
      if (!res.ok) throw new Error(`FDA feed HTTP ${res.status}`);
      const items = recentBabyRecallNews(parseFdaRecallRss(await res.text()), 30);
      cache = { at: Date.now(), items };
      return items;
    } finally {
      clearTimeout(t);
    }
  });
