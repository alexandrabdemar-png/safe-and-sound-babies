import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Option A — Handwritten script (like "oliver" / "les petites choses") */}
      <div className="flex flex-col items-start">
        <span className="text-[9px] font-body uppercase tracking-widest text-muted-foreground mb-0.5">Option A</span>
        <span
          style={{ fontFamily: '"Dancing Script", cursive', fontSize: "1.4rem", fontWeight: 600, color: "#3A2E24", lineHeight: 1 }}
        >
          Safe &amp; Sound
        </span>
      </div>

      {/* Option B — Elegant serif (like "Safira March" / Cormorant) */}
      <div className="flex flex-col items-start">
        <span className="text-[9px] font-body uppercase tracking-widest text-muted-foreground mb-0.5">Option B</span>
        <span
          style={{ fontFamily: '"Cormorant Garamond", "Playfair Display", Georgia, serif', fontSize: "1.1rem", fontWeight: 500, color: "#3A2E24", lineHeight: 1, letterSpacing: "0.12em", textTransform: "uppercase" }}
        >
          Safe &amp; Sound
        </span>
      </div>
    </div>
  );
}
