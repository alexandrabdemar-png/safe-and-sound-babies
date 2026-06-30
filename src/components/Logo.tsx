import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  /** When true, renders only the shield icon (no wordmark) */
  iconOnly?: boolean;
}

export function Logo({ className, size = "md", iconOnly = false }: LogoProps) {
  const iconSizes = { sm: 22, md: 28, lg: 36 };
  const px = iconSizes[size];

  const shield = (
    <svg
      width={px}
      height={Math.round(px * 1.14)}
      viewBox="0 0 28 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Shield body */}
      <path
        d="M14 1.5L2.5 6.5V16C2.5 22.9 7.6 28.6 14 30.2C20.4 28.6 25.5 22.9 25.5 16V6.5L14 1.5Z"
        fill="#2C5F5A"
      />
      {/* Leaf / droplet accent */}
      <path
        d="M14 8.5C14 8.5 10 13.5 10 16.5C10 18.7 11.8 20.5 14 20.5C16.2 20.5 18 18.7 18 16.5C18 13.5 14 8.5 14 8.5Z"
        fill="white"
        fillOpacity="0.88"
      />
      {/* Small inner highlight */}
      <path
        d="M13 12C13 12 11.2 14.8 11.2 16.5C11.2 17.5 11.8 18.4 12.7 18.9"
        stroke="white"
        strokeOpacity="0.4"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </svg>
  );

  if (iconOnly) return <span className={cn("inline-flex", className)}>{shield}</span>;

  const textSizes = {
    sm: { fontSize: 15, letterSpacing: "-0.2px" },
    md: { fontSize: 19, letterSpacing: "-0.3px" },
    lg: { fontSize: 24, letterSpacing: "-0.4px" },
  };
  const ts = textSizes[size];

  return (
    <span className={cn("inline-flex select-none items-center gap-2", className)}>
      {shield}
      <span
        style={{
          fontFamily: '"DM Serif Display", Georgia, serif',
          fontSize: ts.fontSize,
          letterSpacing: ts.letterSpacing,
          color: "#1C2B2B",
          fontWeight: 400,
          lineHeight: 1,
        }}
      >
        Peace of Mine
      </span>
    </span>
  );
}
