import { cn } from "@/lib/utils";
import "@fontsource/marcellus/400.css";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  /** When true, renders only the bottle icon (no wordmark) */
  iconOnly?: boolean;
}

export function Logo({ className, size = "md", iconOnly = false }: LogoProps) {
  // Bigger than the old shield mark (bottle reads smaller than a solid
  // shield shape at the same box size since it's thin line art).
  const iconSizes = { sm: 32, md: 42, lg: 54 };
  const px = iconSizes[size];

  const bottle = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g stroke="#586C81" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Nipple top */}
        <path d="M92 42 Q92 32 100 30 Q108 32 108 42" strokeWidth="4" />
        <line x1="92" y1="42" x2="92" y2="50" strokeWidth="4" />
        <line x1="108" y1="42" x2="108" y2="50" strokeWidth="4" />
        {/* Collar ring */}
        <rect x="86" y="50" width="28" height="10" rx="4" strokeWidth="4" />
        {/* Bottle body */}
        <path
          d="M82 60 Q72 72 70 90 L70 148 Q70 164 100 164 Q130 164 130 148 L130 90 Q128 72 118 60 Z"
          strokeWidth="4.5"
        />
        {/* Measurement lines */}
        <line x1="82" y1="110" x2="90" y2="110" strokeWidth="3" />
        <line x1="82" y1="122" x2="90" y2="122" strokeWidth="3" />
        <line x1="82" y1="134" x2="90" y2="134" strokeWidth="3" />
        <line x1="82" y1="146" x2="90" y2="146" strokeWidth="3" />
        {/* Cloud decoration */}
        <path
          d="M90 88 Q90 82 95 82 Q97 78 101 78 Q106 78 108 82 Q112 82 112 88 Q112 93 90 93 Z"
          strokeWidth="3.2"
        />
      </g>
    </svg>
  );

  if (iconOnly) return <span className={cn("inline-flex", className)}>{bottle}</span>;

  const textSizes = {
    sm: { fontSize: 17 },
    md: { fontSize: 21 },
    lg: { fontSize: 26 },
  };
  const ts = textSizes[size];

  return (
    <span className={cn("inline-flex select-none items-center gap-2", className)}>
      {bottle}
      <span
        style={{
          fontFamily: '"Marcellus", Georgia, serif',
          fontSize: ts.fontSize,
          letterSpacing: "0px",
          color: "#2B2622",
          fontWeight: 400,
          lineHeight: 1,
        }}
      >
        Peace of{" "}
        <span style={{ fontStyle: "italic" }}>Mine</span>
      </span>
    </span>
  );
}
