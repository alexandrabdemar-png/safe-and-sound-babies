import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/**
 * Text wordmark: "Safe & Sound" in DM Serif Display.
 */
export function Logo({ className }: LogoProps) {
  return (
    <span
      className={cn("font-display text-lg font-semibold leading-none tracking-tight", className)}
      style={{ color: "#3D2B1F", fontFamily: '"DM Serif Display", Georgia, serif' }}
    >
      Safe &amp; Sound
    </span>
  );
}
