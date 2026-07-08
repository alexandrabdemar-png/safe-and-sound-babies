import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

// TEMP preview route — unauthenticated, static mock data, no Supabase calls.
// Mocks up two "digital memory book" timeline layouts for the Moments
// section, per reference: a flowing curved-path layout, and a vertical
// alternating-side layout with dashed connectors. Approximates STRUCTURE
// only — there's no way to reproduce the hand-illustrated watercolor icon
// style from the reference images in this environment; these use the
// existing emoji + solid-color badge system already in TYPE_STYLES.
// Remove after review.

export const Route = createFileRoute("/moments-timeline-preview")({
  ssr: false,
  component: MomentsTimelinePreview,
});

type MomentType = "First" | "Funny" | "Milestone";

const TYPE_STYLES: Record<MomentType, { accent: string; bg: string; border: string; emoji: string }> = {
  First: { accent: "#C47B2B", bg: "#FEF9F0", border: "#F0D5A0", emoji: "⭐" },
  Funny: { accent: "#6A7FBF", bg: "#F0F2FA", border: "#C5CCEC", emoji: "😄" },
  Milestone: { accent: "#4A7A47", bg: "#F0F6F0", border: "#B5D5B2", emoji: "🎯" },
};

const MOCK_MOMENTS: { id: string; type: MomentType; title: string; notes: string; date: string; age: string }[] = [
  { id: "1", type: "First", title: "First smile", notes: "Right after her morning bottle — melted my heart.", date: "Mar 2, 2026", age: "3 weeks old" },
  { id: "2", type: "Milestone", title: "Rolled over", notes: "Front to back, all on her own during tummy time.", date: "Apr 18, 2026", age: "2 months" },
  { id: "3", type: "Funny", title: "Hiccup surprise", notes: "Gasped so hard at her own hiccups she scared herself.", date: "May 6, 2026", age: "2 months and 3 weeks" },
  { id: "4", type: "First", title: "First laugh", notes: "Dad made a silly face and she full-on cackled.", date: "Jun 1, 2026", age: "3 months" },
  { id: "5", type: "Milestone", title: "Sat up unassisted", notes: "Ten whole seconds before toppling into the pillows.", date: "Jun 28, 2026", age: "4 months" },
  { id: "6", type: "Funny", title: "Stole the dog's toy", notes: "Crawled straight past all her own toys for his.", date: "Jul 3, 2026", age: "4 months and 1 week" },
];

function SectionHeader({ eyebrow, title, blurb }: { eyebrow: string; title: string; blurb: string }) {
  return (
    <div className="mb-6 text-center">
      <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mx-auto mt-1 max-w-xs font-body text-sm text-muted-foreground">{blurb}</p>
    </div>
  );
}

// ── Variant A: vertical, alternating sides, dashed connectors ──────────────
function AlternatingTimeline() {
  return (
    <div className="relative mx-auto max-w-md px-2">
      {/* Center dashed spine */}
      <div
        className="absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2"
        style={{ backgroundImage: "linear-gradient(#c9bfae 60%, transparent 0%)", backgroundSize: "1px 10px", backgroundRepeat: "repeat-y" }}
      />
      <ul className="space-y-8">
        {MOCK_MOMENTS.map((m, i) => {
          const s = TYPE_STYLES[m.type];
          const left = i % 2 === 0;
          return (
            <li key={m.id} className="relative flex items-center">
              {/* Icon badge on the spine */}
              <span
                className="absolute left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full text-sm shadow-sm"
                style={{ backgroundColor: s.bg, border: `1.5px solid ${s.accent}` }}
              >
                {s.emoji}
              </span>

              {/* Card, alternating side */}
              <div className={`flex w-1/2 ${left ? "justify-end pr-7" : "order-2 justify-start pl-7"}`}>
                <div
                  className="w-full max-w-[190px] rounded-2xl p-3.5 shadow-sm"
                  style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
                >
                  <p className="font-body text-[10px] font-semibold uppercase tracking-wide" style={{ color: s.accent }}>
                    {m.date}
                  </p>
                  <p className="mt-1 font-display text-sm font-semibold leading-snug tracking-tight text-foreground">
                    {m.title}
                  </p>
                  <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                    {m.notes}
                  </p>
                  <p className="mt-1.5 font-body text-[10px] italic text-muted-foreground/80">at {m.age}</p>
                </div>
              </div>
              <div className={left ? "order-2 w-1/2" : "w-1/2"} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Variant B: flowing curved path, stops alternating off the curve ────────
function CurvedPathTimeline() {
  const rowH = 168;
  const n = MOCK_MOMENTS.length;
  const svgH = rowH * n;
  // Gentle S-curve: x oscillates between ~30% and ~70% of width as y increases.
  const points = MOCK_MOMENTS.map((_, i) => {
    const y = rowH * i + rowH / 2;
    const xPct = i % 2 === 0 ? 30 : 70;
    return { x: xPct, y };
  });
  const pathD = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = points[i - 1];
      const midY = (prev.y + p.y) / 2;
      return `C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
    })
    .join(" ");

  return (
    <div className="relative mx-auto max-w-md">
      <svg
        viewBox={`0 0 100 ${svgH}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        style={{ height: svgH }}
      >
        <path d={pathD} fill="none" stroke="#d8cdb8" strokeWidth="1.2" strokeDasharray="0.5 3" strokeLinecap="round" />
      </svg>
      <ul style={{ height: svgH }} className="relative">
        {MOCK_MOMENTS.map((m, i) => {
          const s = TYPE_STYLES[m.type];
          const p = points[i];
          const onRight = p.x > 50;
          return (
            <li
              key={m.id}
              className="absolute flex items-center gap-3"
              style={{
                top: p.y,
                left: `${p.x}%`,
                transform: `translate(-50%, -50%)`,
                flexDirection: onRight ? "row" : "row-reverse",
              }}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base shadow-sm"
                style={{ backgroundColor: s.bg, border: `1.5px solid ${s.accent}` }}
              >
                {s.emoji}
              </span>
              <div
                className="w-40 rounded-2xl p-3 shadow-sm"
                style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, textAlign: onRight ? "left" : "right" }}
              >
                <p className="font-body text-[10px] font-semibold uppercase tracking-wide" style={{ color: s.accent }}>
                  {m.date}
                </p>
                <p className="mt-0.5 font-display text-sm font-semibold leading-snug tracking-tight text-foreground">
                  {m.title}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MomentsTimelinePreview() {
  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-10 sm:px-6">
      <div className="mx-auto mb-10 max-w-md text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-body text-[11px] font-medium text-muted-foreground shadow-sm">
          <Sparkles className="h-3 w-3 text-accent" /> Moments redesign — two directions to compare
        </p>
      </div>

      <section className="mb-16">
        <SectionHeader
          eyebrow="Variant A"
          title="Vertical, alternating sides"
          blurb="A dashed spine down the center, moments alternating left and right — closest to the wedding-day-timeline reference with connector lines."
        />
        <AlternatingTimeline />
      </section>

      <div className="mx-auto mb-16 max-w-md border-t border-dashed border-border" />

      <section>
        <SectionHeader
          eyebrow="Variant B"
          title="Flowing curved path"
          blurb="A winding path connects each moment like stops on a journey map — closest to the circular/flowing reference."
        />
        <CurvedPathTimeline />
      </section>
    </div>
  );
}
