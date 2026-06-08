import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/**
 * Delicate wheat sprig — a gentle botanical mark.
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
      {/* Stem */}
      <path
        d="M16 28c0-6 .5-12 3.5-17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      {/* Left leaf 1 (top) */}
      <path
        d="M16 14c-3-2-5-1.5-6 .5s1 4 3 3.5 3-2 3-4z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Right leaf 1 (top) */}
      <path
        d="M17.5 12c2.5-2 4.5-1.5 5.5 .5s-1 4-3 3.5-3.5-2-2.5-4z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Left leaf 2 (mid) */}
      <path
        d="M15.5 18c-2.5-1.5-4-1-5 .5s.5 3.5 2.5 3 2.5-1.5 2.5-3.5z"
        fill="currentColor"
        opacity="0.75"
      />
      {/* Right leaf 2 (mid) */}
      <path
        d="M17.5 16c2-1.5 3.5-1 4.5 .5s-.5 3.5-2.5 3-2-1.5-2-3.5z"
        fill="currentColor"
        opacity="0.75"
      />
      {/* Left leaf 3 (lower) */}
      <path
        d="M15.5 22c-2-1-3-.5-3.5 .5s.5 2.5 2 2 1.5-1 1.5-2.5z"
        fill="currentColor"
        opacity="0.65"
      />
      {/* Right leaf 3 (lower) */}
      <path
        d="M17.5 20c1.5-1 3-.5 3.5 .5s-.5 2.5-2 2-1.5-1-1.5-2.5z"
        fill="currentColor"
        opacity="0.65"
      />
    </svg>
  );
}
