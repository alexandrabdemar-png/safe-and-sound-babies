// lucide-react has no stroller/pram icon — the Stroller category previously
// (mis)used Footprints, which reads as two feet, not a stroller. This is a
// hand-built substitute matching lucide's own icon conventions exactly
// (24x24 viewBox, stroke="currentColor", strokeWidth 2, round caps/joins)
// so it drops in seamlessly next to the real lucide icons in the same list.
export function StrollerIcon({ className }: { className?: string }) {
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
      {/* Canopy */}
      <path d="M5 8c1-3.5 4-5 6.5-5s4.5 1.5 5 5" />
      {/* Seat/frame back */}
      <path d="M5 8h12l-1 6H8z" />
      {/* Push handle */}
      <path d="M17 8l3-4" />
      {/* Front leg to wheel */}
      <path d="M8 14l-1 4" />
      {/* Back leg to wheel */}
      <path d="M15 14l1 4" />
      {/* Wheels */}
      <circle cx="6.5" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </svg>
  );
}
