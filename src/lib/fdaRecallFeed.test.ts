import { describe, expect, it } from "vitest";
import { isBabyRelatedNews, parseFdaRecallRss, recentBabyRecallNews } from "./fdaRecallFeed";

const RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<title>Recalls, Market Withdrawals, &amp; Safety Alerts</title>
<item>
  <title>Once Upon a Farm Announces Recall of Tractor Wheels&#8482; Due to Potential Choking Hazard</title>
  <link>https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/once-upon-farm-tractor-wheels</link>
  <description><![CDATA[<p>Once Upon a Farm is recalling <b>Tractor Wheels</b> soft-baked bars for toddlers.</p>]]></description>
  <pubDate>Thu, 30 Oct 2026 22:10:00 EDT</pubDate>
  <guid isPermaLink="false">at-1</guid>
</item>
<item>
  <title><![CDATA[Acme Foods Recalls Frozen Pizza Because of Undeclared Milk]]></title>
  <link>https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/acme-pizza</link>
  <description>Adult frozen pizza &amp; garlic bread.</description>
  <pubDate>Fri, 31 Oct 2026 10:00:00 EDT</pubDate>
</item>
<item>
  <title>Kidney Bean Salad Recall</title>
  <link>https://www.fda.gov/x/kidney</link>
  <description>Childers Farms deli salad</description>
  <pubDate>Fri, 31 Oct 2026 10:00:00 EDT</pubDate>
</item>
<item>
  <title>Old Infant Formula Recall</title>
  <link>https://www.fda.gov/x/old</link>
  <description>Infant formula</description>
  <pubDate>Mon, 01 Sep 2026 10:00:00 EDT</pubDate>
</item>
<item><title>No link item</title><description>baby</description></item>
</channel></rss>`;

describe("FDA recall RSS feed", () => {
  const items = parseFdaRecallRss(RSS);

  it("parses titles, article links, CDATA/HTML descriptions and dates", () => {
    expect(items).toHaveLength(4);
    expect(items[0]).toEqual({
      id: "at-1",
      title: "Once Upon a Farm Announces Recall of Tractor Wheels™ Due to Potential Choking Hazard",
      url: "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/once-upon-farm-tractor-wheels",
      description: "Once Upon a Farm is recalling Tractor Wheels soft-baked bars for toddlers.",
      date: "2026-10-31",
    });
    expect(items[1]!.title).toBe("Acme Foods Recalls Frozen Pizza Because of Undeclared Milk");
  });

  it("keeps only baby/kid recalls from the last 30 days, newest first", () => {
    const recent = recentBabyRecallNews(items, 30, new Date("2026-11-02T12:00:00Z"));
    expect(recent.map((r) => r.title)).toEqual([
      "Once Upon a Farm Announces Recall of Tractor Wheels™ Due to Potential Choking Hazard",
    ]);
  });

  it("matches whole words, not 'kid' in 'kidney' or 'child' in 'Childers'", () => {
    expect(isBabyRelatedNews({ title: "Kidney Bean Salad", description: "Childers Farms" })).toBe(
      false,
    );
    expect(isBabyRelatedNews({ title: "Gerber Puffs recall", description: "" })).toBe(true);
    expect(isBabyRelatedNews({ title: "Recall of infant formula", description: "" })).toBe(true);
  });
});
