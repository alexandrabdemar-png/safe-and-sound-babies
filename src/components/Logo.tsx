import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/**
 * Soft, whimsical brand mark — a sleepy crescent moon with a tiny star.
 * Uses currentColor so it inherits from text-* classes on the parent.
 */
export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-5 w-5", className)}
      aria-hidden="true"
    >
      {/* Crescent moon */}
      <path
        d="M22.5 20.2c-5.1 0-9.2-4.1-9.2-9.2 0-1.6.4-3.1 1.1-4.4-4.4 1-7.7 5-7.7 9.7 0 5.5 4.4 9.9 9.9 9.9 4.4 0 8.2-2.9 9.5-6.9-1.1.6-2.3.9-3.6.9z"
        fill="currentColor"
        opacity="0.95"
      />
      {/* Sleepy eye on the moon */}
      <path
        d="M17.4 16.6c.7-.3 1.5-.3 2.2 0"
        stroke="var(--background)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* Tiny star */}
      <path
        d="M24.5 9.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L22.5 11.5l1.5-.5z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}
