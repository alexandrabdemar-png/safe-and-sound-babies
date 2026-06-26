import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Loader2, Radio, ShieldAlert, ShieldCheck } from "lucide-react";
import { fetchRecentBabyRecalls, type CpscRecall } from "@/lib/cpscSearch";

export const Route = createFileRoute("/recalls")({
  ssr: false,
  component: PublicRecallsPage,
  head: () => ({
    meta: [
      { title: "Latest Baby Product Recalls — Safe & Sound" },
      { name: "description", content: "Free, always-updated list of CPSC baby and kids product recalls from the last 30 days. No login required." },
      { property: "og:title", content: "Latest Baby Product Recalls — Safe & Sound" },
      { property: "og:description", content: "Free list of CPSC baby product recalls updated daily. Powered by Safe & Sound." },
    ],
  }),
});

function PublicRecallsPage() {
  const [loading, setLoading] = useState(true);
  const [recalls, setRecalls] = useState<CpscRecall[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const results = await fetchRecentBabyRecalls(30);
        results.sort((a, b) => {
          const da = a.RecallDate ? new Date(a.RecallDate).getTime() : 0;
          const db = b.RecallDate ? new Date(b.RecallDate).getTime() : 0;
          return db - da;
        });
        setRecalls(results);
      } catch {
        setError("Couldn't reach the CPSC database right now. Try again or visit cpsc.gov/Recalls.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAF7F2", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid #E8E2DA" }}>
        <div className="mx-auto max-w-2xl px-5 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, borderRadius: "50%", backgroundColor: "#EBF0EA", color: "#4A7A47",
            }}>
              <Radio size={18} />
            </span>
            <div>
              <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, fontWeight: 600, color: "#3D2B1F", margin: 0 }}>
                Safe & Sound
              </p>
              <p style={{ fontSize: 11, color: "#8A8078", margin: 0, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Recall Radar
              </p>
            </div>
          </div>
          <Link to="/auth" style={{
            padding: "8px 18px", borderRadius: 999, backgroundColor: "#A3B899", color: "white",
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}>
            Get the free app →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10">
        {/* Page intro */}
        <div className="mb-8">
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, fontWeight: 600, color: "#3D2B1F", marginBottom: 8 }}>
            Baby &amp; Kids Product Recalls
          </h1>
          <p style={{ fontSize: 15, color: "#6B5B50", lineHeight: 1.6, maxWidth: 520 }}>
            All CPSC recalls involving baby and children's products in the last 30 days. Updated daily. No account needed.
          </p>
          <p style={{ fontSize: 12, color: "#8A8078", marginTop: 6 }}>Last checked: {dateStr}</p>
        </div>

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "40px 0", color: "#8A8078", fontSize: 14 }}>
            <Loader2 size={16} className="animate-spin" /> Loading recall data from CPSC…
          </div>
        )}

        {error && (
          <div style={{ borderRadius: 12, border: "1px solid rgba(185,28,28,0.3)", backgroundColor: "rgba(185,28,28,0.06)", padding: "12px 16px", color: "#b91c1c", fontSize: 14 }}>
            {error}
          </div>
        )}

        {!loading && !error && recalls.length === 0 && (
          <div style={{ borderRadius: 16, border: "1px solid #E8E2DA", backgroundColor: "white", padding: "48px 32px", textAlign: "center" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 48, height: 48, borderRadius: "50%", backgroundColor: "#EBF0EA", color: "#4A7A47", marginBottom: 12,
            }}>
              <ShieldCheck size={22} />
            </span>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#3D2B1F", margin: "0 0 6px" }}>
              All clear this month
            </p>
            <p style={{ fontSize: 14, color: "#8A8078" }}>
              No baby or kids product recalls were issued by CPSC in the last 30 days.
            </p>
          </div>
        )}

        {!loading && recalls.length > 0 && (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#b91c1c", marginBottom: 16 }}>
              {recalls.length} recall{recalls.length !== 1 ? "s" : ""} in the last 30 days
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recalls.map((r) => <RecallCard key={r.RecallID} recall={r} />)}
            </div>
          </>
        )}

        {/* Footer CTA */}
        <div style={{ marginTop: 48, borderRadius: 16, backgroundColor: "#EBF0EA", padding: "24px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "#3D2B1F", marginBottom: 6 }}>
            Get alerts for products <em>you own</em>
          </p>
          <p style={{ fontSize: 13, color: "#6B5B50", marginBottom: 16 }}>
            Safe & Sound tracks your specific products and notifies you the moment a recall is issued — even for things you bought second-hand.
          </p>
          <Link to="/auth" style={{
            display: "inline-block", padding: "10px 24px", borderRadius: 999, backgroundColor: "#A3B899", color: "white",
            fontWeight: 600, fontSize: 13, textDecoration: "none",
          }}>
            Try it free — no credit card needed
          </Link>
        </div>

        <p style={{ marginTop: 24, fontSize: 11, color: "#A89888", textAlign: "center" }}>
          Data sourced from the U.S. Consumer Product Safety Commission ·{" "}
          <a href="https://cpsc.gov/Recalls" target="_blank" rel="noopener noreferrer" style={{ color: "#8A8078" }}>
            cpsc.gov/Recalls
          </a>
        </p>
      </main>
    </div>
  );
}

function RecallCard({ recall }: { recall: CpscRecall }) {
  const description = recall.Products?.map((p) => p.Description || p.Name).filter(Boolean).join("; ");
  const dateLabel = recall.RecallDate
    ? new Date(recall.RecallDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;
  return (
    <div style={{ borderRadius: 14, border: "1px solid rgba(185,28,28,0.2)", backgroundColor: "rgba(185,28,28,0.04)", padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, borderRadius: "50%", backgroundColor: "rgba(185,28,28,0.15)", color: "#b91c1c",
          marginTop: 2,
        }}>
          <ShieldAlert size={14} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: "#1a1a1a", margin: "0 0 4px" }}>
            {recall.RecallHeading}
          </p>
          {dateLabel && <p style={{ fontSize: 12, color: "#8A8078", margin: "0 0 6px" }}>{dateLabel}</p>}
          {description && (
            <p style={{ fontSize: 12, color: "#6B5B50", lineHeight: 1.5, margin: "0 0 8px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as any }}>
              {description}
            </p>
          )}
          {recall.URL && (
            <a href={recall.URL} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#b91c1c", textDecoration: "underline" }}>
              Full recall details <ArrowUpRight size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
