// A soft, organic background accent — never a focal element, just warmth
// behind a header or empty state. Deliberately subtle: low opacity, blurred,
// and non-interactive, so it never competes with real content or, more
// importantly, with an actual safety alert.
export function SoftBlob({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none absolute -z-10 ${className}`}
      width="360"
      height="360"
      viewBox="0 0 360 360"
      fill="none"
      aria-hidden="true"
      style={{ filter: "blur(18px)" }}
    >
      <path
        d="M267 46c34 24 55 68 58 112 3 45-12 92-46 119-34 27-88 33-131 15-43-17-75-56-88-100-13-45-8-96 21-129 29-34 79-45 122-38 15 2 51 11 64 21z"
        fill="url(#soft-blob-gradient)"
        opacity="0.9"
      />
      <defs>
        <linearGradient
          id="soft-blob-gradient"
          x1="0"
          y1="0"
          x2="360"
          y2="360"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="var(--sage)" stopOpacity="0.30" />
          <stop offset="100%" stopColor="var(--amber)" stopOpacity="0.26" />
        </linearGradient>
      </defs>
    </svg>
  );
}
