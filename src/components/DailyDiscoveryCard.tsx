import { pickDailyCard } from "@/lib/dailyCards";
import { DAILY_CARDS } from "@/lib/dailyCardsData";
import { dayOfYear, monthsFromDob } from "@/lib/dailyContent";

/**
 * A second, separate card shown under the existing day-of-week TodayCard —
 * the 365-entry "card of the day" library (dailyCardsData.ts). Deliberately
 * additive rather than merged into TodayCard's per-weekday branches: this
 * renders every day regardless of which weekday branch TodayCard is on, and
 * touches none of that component's existing (already-tested) logic.
 */
export function DailyDiscoveryCard({ dob }: { dob: string | null }) {
  const card = pickDailyCard(DAILY_CARDS, new Date(), monthsFromDob(dob), dayOfYear);

  return (
    <div
      className="mt-3 rounded-[20px] p-5"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid #EDEAE0" }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
          style={{ backgroundColor: "#586C811F" }}
          aria-hidden="true"
        >
          {card.icon}
        </span>
        <div className="min-w-0">
          <p
            className="font-body text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "#8A8078" }}
          >
            {card.category}
          </p>
          <p className="mt-0.5 font-display text-[15px] font-semibold leading-snug text-foreground">
            {card.title}
          </p>
          <p className="mt-1 font-body text-[13px] leading-relaxed text-muted-foreground">
            {card.body}
          </p>
        </div>
      </div>
    </div>
  );
}
