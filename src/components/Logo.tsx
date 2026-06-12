import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/**
 * Primary app icon mark — the overlapping petal "S" (Concept B).
 * Uses currentColor for the sage petal; blush petal is a fixed warm tone.
 * Inherits size from className (h-* / w-*).
 */
export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-5 w-5", className)}
      aria-hidden="true"
    >
      {/* Upper petal — sage, inherits currentColor from parent text-* class */}
      <path
        d="M20 5 C13 5 8 10 10 16.5 C12 21.5 17 22.5 20 20 C23 17.5 24.5 12.5 22 9 C21 6.5 20.5 5 20 5Z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* Lower petal — soft blush, fixed brand color */}
      <path
        d="M20 18 C16.5 18 11 21 11 25.5 C11 30 16.5 34 21.5 32.5 C26.5 31 30.5 27 29 22.5 C27.5 19 23.5 18 20 18Z"
        fill="#DBBFB5"
        opacity="0.85"
      />
      {/* Overlap highlight */}
      <path
        d="M20 18 C18.5 18.5 16 19.5 15 20.5 C15 22 17 23.5 19.5 22.5 C22 21.5 23 19.5 21.5 17.5 C21 17 20.5 17.5 20 18Z"
        fill="currentColor"
        opacity="0.22"
      />
    </svg>
  );
}
