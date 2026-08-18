import { cn } from "@/lib/utils";
import "@fontsource/marcellus/400.css";
import logoHands from "@/assets/logo-hands.png";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md" }: LogoProps) {
  const config = {
    sm: { fontSize: 13, mark: 26 },
    md: { fontSize: 16, mark: 32 },
    lg: { fontSize: 20, mark: 42 },
  };
  const ts = config[size];

  return (
    <span className={cn("inline-flex select-none items-center gap-1.5", className)}>
      <img
        src={logoHands}
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={ts.mark}
        height={ts.mark}
        style={{ width: ts.mark, height: ts.mark, objectFit: "contain" }}
      />
      <span
        style={{
          fontFamily: '"Marcellus", Georgia, serif',
          fontSize: ts.fontSize,
          letterSpacing: "0.01em",
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
