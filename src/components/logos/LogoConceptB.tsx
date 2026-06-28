/**
 * Logo Concept B — Petal monogram mark
 *
 * A soft rounded "S" formed from two overlapping petal/leaf shapes:
 *   - Upper petal: dusty sage (#A3B899)
 *   - Lower petal: soft blush (#DBBFB5)
 * They overlap to create a letter-S implied form.
 * Wordmark "Peace of Mine" in DM Sans light sits below the mark.
 *
 * This is the primary brand mark. Used on the splash screen and app icon.
 */

interface LogoConceptBProps {
  /** Override the mark colors. Defaults to brand palette. */
  sageColor?: string;
  blushColor?: string;
  /** Text / wordmark color. Default: charcoal */
  color?: string;
  /** Height of the full lockup (mark + wordmark). Default: 64 */
  size?: number;
  /** Show wordmark below the mark. Default: true */
  showWordmark?: boolean;
  className?: string;
}

export function LogoConceptB({
  sageColor = "#A3B899",
  blushColor = "#DBBFB5",
  color = "#3A3530",
  size = 64,
  showWordmark = true,
  className,
}: LogoConceptBProps) {
  const markH = showWordmark ? size * 0.65 : size;
  const totalH = showWordmark ? size : markH;
  const markW = markH;
  const totalW = showWordmark ? Math.max(markW, 120) : markW;

  return (
    <svg
      viewBox={`0 0 ${showWordmark ? 120 : 64} ${showWordmark ? 80 : 64}`}
      width={(totalW / (showWordmark ? 120 : 64)) * (showWordmark ? 120 : 64) * (size / (showWordmark ? 80 : 64))}
      height={totalH}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Peace of Mine"
      role="img"
    >
      {/* ── Petal mark — overlapping leaf/petal shapes ─────────────── */}
      {/* Upper petal (sage) — sweeps upper-left to center */}
      <path
        d="M32 8 C20 8 12 16 14 26 C16 34 26 36 32 32 C38 28 40 20 36 14 C34 10 33 8 32 8Z"
        fill={sageColor}
        opacity="0.92"
      />
      {/* Lower petal (blush) — sweeps center to lower-right */}
      <path
        d="M32 28 C26 28 18 32 18 40 C18 48 26 54 34 52 C42 50 48 44 46 36 C44 30 38 28 32 28Z"
        fill={blushColor}
        opacity="0.88"
      />
      {/* Overlap highlight — slightly brighter zone where petals meet */}
      <path
        d="M32 28 C30 29 26 30 24 31 C24 33 26 35 30 34 C34 33 36 30 34 27 C33 26.5 32.5 27.5 32 28Z"
        fill={sageColor}
        opacity="0.35"
      />

      {/* ── Wordmark below mark ───────────────────────────────────── */}
      {showWordmark && (
        <>
          <text
            x="60"
            y="70"
            fontFamily="'DM Sans', 'Jost', system-ui, sans-serif"
            fontSize="10"
            fontWeight="300"
            letterSpacing="0.08em"
            textAnchor="middle"
            fill={color}
          >
            SAFE &amp; SOUND
          </text>
        </>
      )}
    </svg>
  );
}

/** Just the petal mark (no wordmark), useful for app icon and small spaces */
export function LogoConceptBMark({
  sageColor = "#A3B899",
  blushColor = "#DBBFB5",
  size = 40,
  className,
}: Omit<LogoConceptBProps, "color" | "showWordmark">) {
  return (
    <LogoConceptB
      sageColor={sageColor}
      blushColor={blushColor}
      size={size}
      showWordmark={false}
      className={className}
    />
  );
}
