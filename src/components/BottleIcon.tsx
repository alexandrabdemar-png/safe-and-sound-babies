// lucide-react's Milk icon reads as a milk carton, not a baby bottle — this
// is a hand-built substitute matching lucide's own icon conventions exactly
// (24x24 viewBox, stroke="currentColor", strokeWidth 2, round caps/joins),
// same approach as StrollerIcon.tsx, so it drops in seamlessly wherever a
// lucide icon would go and inherits surrounding text-* color classes.
export function BottleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Nipple */}
      <path d="M10.5 4c0-1.5 1-2.5 1.5-2.5s1.5 1 1.5 2.5" />
      <line x1="10.5" y1="4" x2="10.5" y2="5" />
      <line x1="13.5" y1="4" x2="13.5" y2="5" />
      {/* Collar ring */}
      <rect x="9.5" y="5" width="5" height="1.5" rx="0.5" />
      {/* Bottle body */}
      <path d="M9 6.5c-1.5 1.5-2 3.5-2 5.5v6c0 2 2 3 5 3s5-1 5-3v-6c0-2-.5-4-2-5.5Z" />
      {/* Measurement lines */}
      <line x1="8" y1="13" x2="9.5" y2="13" />
      <line x1="8" y1="15" x2="9.5" y2="15" />
      <line x1="8" y1="17" x2="9.5" y2="17" />
    </svg>
  );
}
