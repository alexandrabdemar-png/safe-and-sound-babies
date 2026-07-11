// PediatricianDisclaimer — single source of truth for the "general guidance,
// not medical advice" line. Rendered once at the bottom of any page that
// shows age-derived reminders, milestone guidance, or recall verdicts.
export function PediatricianDisclaimer({
  variant = "default",
  className = "",
}: {
  variant?: "default" | "compact" | "recall";
  className?: string;
}) {
  const copy =
    variant === "recall"
      ? "Recall data is aggregated from official sources (CPSC, FDA, NHTSA, USDA FSIS, Health Canada). \"No active recalls found\" reflects the last successful sync only. Verify with the manufacturer and cpsc.gov/Recalls before relying on it for safety-critical decisions."
      : variant === "compact"
      ? "General guidance — not a substitute for your pediatrician."
      : "Guidance in Peace of Mine is general safety information intended to help parents stay organized. It is not medical advice and does not replace individualized guidance from your pediatrician. Always consult your child's healthcare provider for decisions about their care.";

  return (
    <p className={`font-body text-[11px] leading-relaxed text-muted-foreground/70 ${className}`}>
      {copy}
    </p>
  );
}
