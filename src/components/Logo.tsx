import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <span
      className={cn(className)}
      style={{
        fontFamily: '"Cormorant Garamond", "Playfair Display", Georgia, serif',
        fontSize: "1.1rem",
        fontWeight: 500,
        color: "#3A2E24",
        lineHeight: 1,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}
    >
      Safe &amp; Sound
    </span>
  );
}
