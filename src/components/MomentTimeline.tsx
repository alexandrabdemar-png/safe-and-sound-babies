import {
  ArrowUp,
  Baby,
  BookOpen,
  Cake,
  Footprints,
  Gem,
  Heart,
  MessageCircle,
  Moon,
  Move,
  Music,
  RotateCcw,
  Sparkles,
  Star,
  Sun,
  UtensilsCrossed,
} from "lucide-react";

export type Moment = {
  id: string;
  title: string;
  logged_at: string | null;
  notes: string | null;
};

function pickIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("smile") || t.includes("laugh") || t.includes("giggle"))
    return Heart;
  if (t.includes("tooth") || t.includes("teeth")) return Gem;
  if (t.includes("roll")) return RotateCcw;
  if (t.includes("sit")) return Baby;
  if (t.includes("crawl")) return Move;
  if (t.includes("stand") || t.includes("pull")) return ArrowUp;
  if (t.includes("walk") || t.includes("step")) return Footprints;
  if (t.includes("word") || t.includes("talk") || t.includes("speak") || t.includes("speech"))
    return MessageCircle;
  if (t.includes("dance")) return Music;
  if (t.includes("sleep") || t.includes("nap") || t.includes("bed")) return Moon;
  if (t.includes("eat") || t.includes("food") || t.includes("solid") || t.includes("feed"))
    return UtensilsCrossed;
  if (t.includes("birthday") || t.includes("cake")) return Cake;
  if (t.includes("book") || t.includes("read")) return BookOpen;
  if (t.includes("hair") || t.includes("cut")) return Sun;
  if (t.includes("first")) return Star;
  return Sparkles;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MomentTimeline({ moments }: { moments: Moment[] }) {
  return (
    <div className="relative py-2">
      {/* Vertical line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2" />

      <ul className="space-y-8">
        {moments.map((m, i) => {
          const isLeft = i % 2 === 0;
          const Icon = pickIcon(m.title);

          return (
            <li key={m.id} className="relative flex items-center">
              {/* Left side */}
              <div className={`flex-1 ${isLeft ? "text-right pr-5" : "text-left pl-5 order-3"}`}>
                {isLeft ? (
                  <>
                    <p className="font-display text-sm font-semibold tracking-tight text-foreground">
                      {m.title}
                    </p>
                    {m.logged_at && (
                      <p className="mt-0.5 font-body text-[11px] text-muted-foreground uppercase tracking-wide">
                        {formatDate(m.logged_at)}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="inline-flex items-center justify-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-card text-foreground/70 shadow-warm-sm">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                )}
              </div>

              {/* Center dot */}
              <div className="relative z-10 order-2 flex h-5 w-5 shrink-0 items-center justify-center">
                <div className="h-2.5 w-2.5 rounded-full bg-accent" />
              </div>

              {/* Right side */}
              <div className={`flex-1 ${isLeft ? "text-left pl-5 order-3" : "text-right pr-5 order-1"}`}>
                {isLeft ? (
                  <div className="inline-flex items-center justify-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-card text-foreground/70 shadow-warm-sm">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-display text-sm font-semibold tracking-tight text-foreground">
                      {m.title}
                    </p>
                    {m.logged_at && (
                      <p className="mt-0.5 font-body text-[11px] text-muted-foreground uppercase tracking-wide">
                        {formatDate(m.logged_at)}
                      </p>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
