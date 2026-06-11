/**
 * SplashScreen — shown during app load / auth transitions.
 *
 * Parchment background (#F5F0E8), centered Concept B petal mark,
 * "Safe & Sound" wordmark below in DM Serif Display charcoal.
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
        backgroundColor: "#F5F0E8",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
      }}
    >
      {/* Petal mark — Concept B */}
      <LogoConceptBMark
        sageColor="#A3B899"
        blushColor="#DBBFB5"
        size={80}
      />

      {/* Wordmark */}
      <svg
        viewBox="0 0 200 32"
        width="200"
        height="32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Safe & Sound"
      >
        <text
          x="100"
          y="26"
          fontFamily="'DM Serif Display', 'Playfair Display', Georgia, serif"
          fontSize="22"
          fontWeight="400"
          letterSpacing="0.06em"
          textAnchor="middle"
          fill="#3A3530"
        >
          Safe &amp; Sound
        </text>
      </svg>
    </div>
  );
}
