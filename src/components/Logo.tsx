import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/**
 * Soft, hand-tied linen bow — a gentle ribbon mark for a nursery.
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
      {/* Left loop */}
      <path
        d="M16 18c-2.5-1-5.5-1.5-7.5-.5-2.5 1.2-3.5 4-2.5 6 1 2 3.5 2.5 5.5 1.5 2-1 3.5-3.5 4.5-7z"
        fill="currentColor"
        opacity="0.95"
      />
      {/* Right loop */}
      <path
        d="M16 18c2.5-1 5.5-1.5 7.5-.5 2.5 1.2 3.5 4 2.5 6-1 2-3.5 2.5-5.5 1.5-2-1-3.5-3.5-4.5-7z"
        fill="currentColor"
        opacity="0.95"
      />
      {/* Center knot */}
      <circle cx="16" cy="18" r="2.5" fill="currentColor" />
      {/* Left tail */}
      <path
        d="M14.5 20c-1 3-2 5.5-4 7-1 1-2 .5-1.5-1 .5-2 2-4.5 3.5-6z"
        fill="currentColor"
        opacity="0.7"
      />
      {/* Right tail */}
      <path
        d="M17.5 20c1 3 2 5.5 4 7 1 1 2 .5 1.5-1-.5-2-2-4.5-3.5-6z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}
