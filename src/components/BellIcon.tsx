// Hand-drawn "ringing bell" for Alerts, in the same soft blue ink and
// slightly wobbly line as the app's hand-drawn food and moment icons.
// Same 24x24 viewBox as the lucide icons it sits beside, so it drops in
// wherever a lucide icon would go and takes the same size classes.
export const BELL_INK = "#6E7F96";

export function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={BELL_INK}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <defs>
        <filter id="bell-sketchy" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="0.55" />
        </filter>
      </defs>
      <g filter="url(#bell-sketchy)">
        {/* Bell body and lip */}
        <path d="M12 4.6c-3.1 0-5.1 2.3-5.1 5.5 0 2.9-.5 4.8-1.7 6.3h13.6c-1.2-1.5-1.7-3.4-1.7-6.3 0-3.2-2-5.5-5.1-5.5z" />
        <path d="M4.6 16.5c4.8.4 10 .3 14.8-.1" />
        {/* Top nub */}
        <path d="M11.2 4.6c-.1-1 .3-1.6.8-1.6s.9.6.8 1.6" />
        {/* Clapper */}
        <path d="M10.5 18.3c.2 1 .8 1.6 1.5 1.6s1.3-.6 1.5-1.6" />
        {/* Ringing marks */}
        <path d="M3.6 8.6c.1-1.3.7-2.5 1.6-3.4" />
        <path d="M20.4 8.6c-.1-1.3-.7-2.5-1.6-3.4" />
      </g>
    </svg>
  );
}
