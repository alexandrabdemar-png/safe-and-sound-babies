import { cn } from "@/lib/utils";
import "@fontsource/marcellus/400.css";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md" }: LogoProps) {
  const textSizes = {
    sm: { fontSize: 17 },
    md: { fontSize: 21 },
    lg: { fontSize: 26 },
  };
  const ts = textSizes[size];

  return (
    <span className={cn("inline-flex select-none items-center", className)}>
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
        Peace of <span style={{ fontStyle: "italic" }}>Mine</span>
      </span>
    </span>
  );
}
