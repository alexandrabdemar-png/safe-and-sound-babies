/**
 * SplashScreen — shown during app load / auth transitions.
 *
 * Parchment background, centered Concept B petal mark, "Peace of Mine"
 * wordmark below in the app's display serif (Playfair Display).
 */
import { LogoConceptBMark } from "@/components/logos/LogoConceptB";

interface SplashScreenProps {
  className?: string;
}

export function SplashScreen({ className }: SplashScreenProps) {
  return (
    <div
      className={className}
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--cream)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
      }}
    >
      {/* Petal mark — Concept B (sage/blush colors from the brand palette) */}
      <LogoConceptBMark size={80} />

      {/* Wordmark */}
      <svg
        viewBox="0 0 200 32"
        width="200"
        height="32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Peace of Mine"
      >
        <text
          x="100"
          y="26"
          fontFamily="'Playfair Display', Georgia, serif"
          fontSize="22"
          fontWeight="400"
          letterSpacing="0.06em"
          textAnchor="middle"
          style={{ fill: "var(--foreground)" }}
        >
          Peace of Mine
        </text>
      </svg>
    </div>
  );
}
