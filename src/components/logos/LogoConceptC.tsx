/**
 * Logo Concept C — Icon-forward cottage + leaf
 *
 * A small, simple cottage/house silhouette:
 *   3 geometric lines — roof triangle, rectangle body, tiny door.
 * A single leaf or stem grows from the peak of the roof.
 * Feels hand-drawn but stays geometric.
 * Wordmark "Peace of Mine" in DM Serif Display sits beside the icon.
 */

interface LogoConceptCProps {
  /** Color for the house icon. Default: sage */
  iconColor?: string;
  /** Color for the wordmark. Default: charcoal */
  color?: string;
  /** Height of the full lockup. Default: 40 */
  size?: number;
  className?: string;
}

export function LogoConceptC({
  iconColor = "#A3B899",
  color = "#3A3530",
  size = 40,
  className,
}: LogoConceptCProps) {
  // ViewBox: 240 × 48
  return (
    <svg
      viewBox="0 0 240 48"
      width={size * (240 / 48)}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Peace of Mine"
      role="img"
    >
      {/* ── Cottage icon ─────────────────────────────────────────── */}
      {/* Roof triangle */}
      <path
        d="M8 28 L20 14 L32 28"
        stroke={iconColor}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* House body */}
      <rect
        x="10"
        y="28"
        width="20"
        height="14"
        rx="1.5"
        stroke={iconColor}
        strokeWidth="1.8"
      />
      {/* Tiny door */}
      <path
        d="M17 42 L17 35 Q20 33 23 35 L23 42"
        stroke={iconColor}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Leaf/stem from roof peak */}
      {/* Stem */}
      <line x1="20" y1="14" x2="20" y2="6" stroke={iconColor} strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
      {/* Single leaf */}
      <path
        d="M20 10 C18 8 16 8 16 10 C16 12 18 13 20 11 C21 10 20 10 20 10Z"
        fill={iconColor}
        opacity="0.85"
      />
      <path
        d="M20 8 C22 6 24 6 24 8 C24 10 22 11 20 10 C19.5 9.5 20 8 20 8Z"
        fill={iconColor}
        opacity="0.70"
      />

      {/* ── Wordmark beside icon ───────────────────────────────── */}
      <text
        x="44"
        y="36"
        fontFamily="'DM Serif Display', 'Playfair Display', Georgia, serif"
        fontSize="22"
        fontWeight="400"
        letterSpacing="0.02em"
        fill={color}
      >
        Safe &amp; Sound
      </text>
    </svg>
  );
}
