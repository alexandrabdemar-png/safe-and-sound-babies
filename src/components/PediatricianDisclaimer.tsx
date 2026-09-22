// PediatricianDisclaimer — single source of truth for the "general
// informational guidance, not medical advice, no safety guarantee" line.
// Rendered once at the bottom of any page that shows age-derived
// reminders, milestone guidance, or recall verdicts.
export function PediatricianDisclaimer({
  variant = "default",
  className = "",
}: {
  variant?: "default" | "compact" | "recall";
  className?: string;
}) {
  const copy =
    variant === "recall"
      ? "Recall data is aggregated from official sources (CPSC, FDA, NHTSA, USDA FSIS, Health Canada). \"No active recalls found\" reflects the last successful sync only and is not a guarantee that a product is safe or free from hazards. New recalls may be issued at any time and there may be a delay before they appear — or they may never appear — in the app. Always verify with the manufacturer and cpsc.gov/Recalls before relying on this for safety-critical decisions."
      : variant === "compact"
      ? "General information — not medical advice or a safety guarantee. Check with your pediatrician."
      : "Peace of Mine provides general safety information to help you stay organized. It is not medical advice, not a substitute for your pediatrician or other qualified professional, and not a guarantee that any product is safe or free from recalls. Always verify safety-critical decisions with your child's healthcare provider, the product manufacturer, and official recall sources.";

  return (
    <p className={`font-body text-[11px] leading-relaxed text-muted-foreground/70 ${className}`}>
      {copy}
    </p>
  );
}
