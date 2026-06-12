/**
 * Logo Concept A — Wordmark with botanical sprig
 *
 * "Safe & Sound" in DM Serif Display, slightly wide tracking.
 * Three-leaf sprig rendered in SVG, sitting above the ampersand.
 * Clean, editorial, linen-and-cream energy.
 */

interface LogoConceptAProps {
  /** Primary color for text and icon. Default: charcoal #3A3530 */
  color?: string;
  /** Height in px. Width scales proportionally. Default: 40 */
  size?: number;
  className?: string;
}

export function LogoConceptA({
  color = "#3A3530",
  size = 40,
  className,
}: LogoConceptAProps) {
  // Viewbox: 280 × 56 — wordmark with sprig above ampersand
  const aspect = 280 / 56;
  const width = size * aspect;

  return (
    <svg
      viewBox="0 0 280 56"
      width={width}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Safe & Sound"
      role="img"
    >
      {/* ── Sprig mark — 3 leaves, minimal linework ───────────────── */}
      {/* Central stem */}
      <line x1="114" y1="22" x2="114" y2="6" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />

      {/* Left leaf */}
      <path
        d="M114 16 C112 13 109 12 108 14 C107 16 109 18 111 17.5 C113 17 114 16 114 16Z"
        fill={color}
        opacity="0.80"
      />
      {/* Right leaf */}
      <path
        d="M114 13 C116 10 119 10 119.5 12 C120 14 118 16 116 15 C114.5 14.2 114 13 114 13Z"
        fill={color}
        opacity="0.80"
      />
      {/* Top small leaf */}
      <path
        d="M114 9 C113 7 111 6.5 111 8 C111 9.5 113 10 114 9Z"
        fill={color}
        opacity="0.65"
      />

      {/* ── Wordmark: "Safe & Sound" ──────────────────────────────── */}
      <text
        x="0"
        y="46"
        fontFamily="'DM Serif Display', 'Playfair Display', Georgia, serif"
        fontSize="28"
        fontWeight="400"
        letterSpacing="0.05em"
        fill={color}
      >
        Safe &amp; Sound
      </text>
    </svg>
  );
}
