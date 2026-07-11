// SeverityBadge — visually distinct pill for the three recall severity tiers.
// Uses semantic tokens (destructive/warning/muted) so dark-mode inherits.
import { AlertOctagon, AlertTriangle, Info } from "lucide-react";
import { classifyRecallSeverity, SEVERITY_LABEL, type SeverityTier } from "@/lib/recallSeverity";

type Fields = {
  title?: string | null;
  hazard?: string | null;
  remedy?: string | null;
  description?: string | null;
  severity_tier?: SeverityTier | string | null;
};

const KNOWN_TIERS = new Set<SeverityTier>(["life_threatening", "injury", "non_injury"]);

function readTier(fields: Fields): SeverityTier {
  const explicit = fields.severity_tier;
  if (typeof explicit === "string" && KNOWN_TIERS.has(explicit as SeverityTier)) {
    return explicit as SeverityTier;
  }
  return classifyRecallSeverity(fields);
}

export function SeverityBadge({ fields, className = "" }: { fields: Fields; className?: string }) {
  const tier = readTier(fields);
  const label = SEVERITY_LABEL[tier];

  if (tier === "life_threatening") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 font-body text-[11px] font-bold uppercase tracking-wide text-destructive-foreground ${className}`}
        aria-label={label}
      >
        <AlertOctagon className="h-3 w-3" /> {label}
      </span>
    );
  }
  if (tier === "injury") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-amber-500/60 bg-amber-500/15 px-2 py-0.5 font-body text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300 ${className}`}
        aria-label={label}
      >
        <AlertTriangle className="h-3 w-3" /> {label}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 font-body text-[11px] font-medium uppercase tracking-wide text-muted-foreground ${className}`}
      aria-label={label}
    >
      <Info className="h-3 w-3" /> {label}
    </span>
  );
}
