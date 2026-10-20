// lucide-react's Bell reads as a generic, slightly "weird" notification glyph —
// this is a hand-built substitute with a softer, friendlier school-bell shape
// (rounder dome, gentle skirt, top loop, hanging clapper) matching lucide's
// own icon conventions exactly (24x24 viewBox, stroke="currentColor",
// strokeWidth 2, round caps/joins), same approach as BottleIcon.tsx and
// StrollerIcon.tsx, so it drops in seamlessly wherever a lucide icon would go
// and inherits surrounding text-* color classes.
export function BellIcon({ className }: { className?: string }) {
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
      {/* Top loop */}
      <path d="M10.8 4.5v-.4a1.2 1.2 0 0 1 2.4 0v.4" />
      {/* Bell body — rounded dome with a gently flared skirt */}
      <path d="M12 4.5c-2.9 0-4.8 2-4.8 5 0 3.2-.5 5.4-1.4 6.6-.3.5.05 1.2.65 1.2h11.1c.6 0 .95-.7.65-1.2-.9-1.2-1.4-3.4-1.4-6.6 0-3-1.9-5-4.8-5Z" />
      {/* Clapper peeking below the rim */}
      <path d="M10.3 20.7a1.85 1.85 0 0 0 3.4 0" />
    </svg>
  );
}
