import { cn } from "@/lib/utils";
import "@fontsource/marcellus/400.css";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Stack the wordmark under the mark (default) or place it beside. */
  layout?: "stacked" | "inline";
}

export function Logo({ className, size = "md", layout = "stacked" }: LogoProps) {
  const config = {
    sm: { fontSize: 12, mark: 28 },
    md: { fontSize: 14, mark: 36 },
    lg: { fontSize: 18, mark: 56 },
  };
  const ts = config[size];
  const stacked = layout === "stacked";

  return (
    <span
      className={cn(
        "inline-flex select-none",
        stacked ? "flex-col items-center gap-1" : "flex-row items-center gap-1.5",
        className,
      )}
    >

      <span
        style={{
          fontFamily: '"Marcellus", Georgia, serif',
          fontSize: ts.fontSize,
          letterSpacing: "0.02em",
          color: "#2B2622",
          fontWeight: 400,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        Peace of <span style={{ fontStyle: "italic" }}>Mine</span>
      </span>
    </span>
  );
}
