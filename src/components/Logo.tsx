import { cn } from "@/lib/utils";
import logoSvg from "@/assets/logo-handdrawn.svg";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 36 }: LogoProps) {
  return (
    <img
      src={logoSvg}
      alt="Peace of Mine"
      width={size}
      height={size}
      className={cn("select-none", className)}
    />
  );
}
