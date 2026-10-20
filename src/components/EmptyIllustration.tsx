/**
 * Warm, hand-drawn-style SVG illustrations for empty states.
 * All use the app's cream / sage palette.
 *
 * NOTE: Colours are passed via inline `style` (CSS), not SVG presentation
 * attributes. `var(--...)` is only honoured inside a CSS declaration — in a
 * presentation attribute like `fill="var(--cream)"` the value fails to
 * parse, the attribute is dropped, and the shape falls back to black.
 */

type IllustrationProps = { className?: string };

// Shared style fragments — var() resolves correctly here because these
// are real CSS properties, not SVG presentation attributes.
const S = {
  creamFill: { fill: "var(--cream)" },
  sageFill: { fill: "var(--sage)" },
  sageStroke: { stroke: "var(--sage)" },
  creamFillSageStroke: { fill: "var(--cream)", stroke: "var(--sage)" },
} as const;

// A little baby crib with a moon — for Products empty state
export function CribIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      {/* mattress */}
      <rect x="18" y="48" width="84" height="22" rx="4" style={S.creamFillSageStroke} strokeWidth="1.5" strokeLinejoin="round"/>
      {/* headboard */}
      <rect x="14" y="30" width="12" height="42" rx="3" style={S.creamFillSageStroke} strokeWidth="1.5"/>
      {/* footboard */}
      <rect x="94" y="30" width="12" height="42" rx="3" style={S.creamFillSageStroke} strokeWidth="1.5"/>
      {/* slats */}
      {[34, 44, 54, 64, 74, 84].map((x) => (
        <line key={x} x1={x} y1="30" x2={x} y2="48" style={S.sageStroke} strokeWidth="1.2" strokeLinecap="round"/>
      ))}
      {/* legs */}
      <line x1="20" y1="70" x2="20" y2="82" style={S.sageStroke} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="100" y1="70" x2="100" y2="82" style={S.sageStroke} strokeWidth="1.5" strokeLinecap="round"/>
      {/* moon */}
      <path d="M72 14 A10 10 0 1 1 72 14.01" fill="none" style={S.sageStroke} strokeWidth="1.5"/>
      <path d="M78 11 A7 7 0 1 0 75 20" style={S.creamFill} stroke="none"/>
      {/* stars */}
      <circle cx="55" cy="16" r="1.2" style={S.sageFill}/>
      <circle cx="88" cy="20" r="1" style={S.sageFill}/>
      <circle cx="44" cy="22" r="0.9" style={S.sageFill}/>
    </svg>
  );
}

// Sparkle / star cluster — for Moments empty state
export function SparkleIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      {/* big star */}
      <path d="M60 20 L64 34 L78 34 L67 43 L71 57 L60 48 L49 57 L53 43 L42 34 L56 34 Z" style={S.creamFillSageStroke} strokeWidth="1.5" strokeLinejoin="round"/>
      {/* small stars */}
      <path d="M28 38 L29.5 43 L35 43 L30.5 46 L32 51 L28 48 L24 51 L25.5 46 L21 43 L26.5 43 Z" style={S.creamFillSageStroke} strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M88 28 L89.2 32 L93.5 32 L90 34.5 L91.2 38.5 L88 36 L84.8 38.5 L86 34.5 L82.5 32 L86.8 32 Z" style={S.creamFillSageStroke} strokeWidth="1.2" strokeLinejoin="round"/>
      {/* dots */}
      <circle cx="40" cy="62" r="2" style={S.sageFill} opacity="0.4"/>
      <circle cx="80" cy="60" r="1.5" style={S.sageFill} opacity="0.4"/>
      <circle cx="60" cy="70" r="1.8" style={S.sageFill} opacity="0.3"/>
      {/* wavy underline */}
      <path d="M35 76 Q48 72 60 76 Q72 80 85 76" style={S.sageStroke} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.5"/>
    </svg>
  );
}

// A gentle hand-drawn bell with sound waves — for Alerts empty state
export function BellIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      {/* top loop */}
      <path d="M56 16 v-2.5 a4 4 0 0 1 8 0 V16" style={S.sageStroke} strokeWidth="1.5" strokeLinecap="round"/>
      {/* bell body — rounded dome with a gently flared skirt */}
      <path d="M60 16 C47 16 39 26 39 40 L39 55 Q39 60 44 60 L76 60 Q81 60 81 55 L81 40 C81 26 73 16 60 16 Z" style={S.creamFillSageStroke} strokeWidth="1.5" strokeLinejoin="round"/>
      {/* clapper hanging below the rim */}
      <line x1="60" y1="60" x2="60" y2="62.5" style={S.sageStroke} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="60" cy="66.5" r="4" style={S.creamFillSageStroke} strokeWidth="1.5"/>
      {/* gentle sound waves */}
      <path d="M27 36 Q22.5 43 27 50" style={S.sageStroke} strokeWidth="1.3" strokeLinecap="round" opacity="0.55"/>
      <path d="M93 36 Q97.5 43 93 50" style={S.sageStroke} strokeWidth="1.3" strokeLinecap="round" opacity="0.55"/>
      {/* sparkle dots */}
      <circle cx="46" cy="26" r="1.5" style={S.sageFill} opacity="0.5"/>
      <circle cx="75" cy="24" r="1" style={S.sageFill} opacity="0.4"/>
      <circle cx="86" cy="34" r="1.2" style={S.sageFill} opacity="0.35"/>
      <circle cx="34" cy="30" r="1" style={S.sageFill} opacity="0.35"/>
    </svg>
  );
}

// A milk bottle with a heart — for Bottles empty state
export function BottleIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      {/* bottle body */}
      <path d="M48 36 L44 46 L40 56 L40 74 Q40 80 46 80 L74 80 Q80 80 80 74 L80 56 L76 46 L72 36 Z" style={S.creamFillSageStroke} strokeWidth="1.5" strokeLinejoin="round"/>
      {/* bottle neck */}
      <rect x="50" y="22" width="20" height="16" rx="3" style={S.creamFillSageStroke} strokeWidth="1.5"/>
      {/* nipple */}
      <path d="M55 22 Q60 14 65 22" style={S.creamFillSageStroke} strokeWidth="1.5" strokeLinecap="round"/>
      {/* milk level */}
      <path d="M41 65 Q60 60 79 65 L79 74 Q79 79 74 79 L46 79 Q41 79 41 74 Z" style={S.sageFill} opacity="0.6"/>
      {/* heart */}
      <path d="M60 52 C60 52 54 47 54 43.5 A3.5 3.5 0 0 1 60 43 A3.5 3.5 0 0 1 66 43.5 C66 47 60 52 60 52 Z" style={S.sageFill} opacity="0.7"/>
      {/* dots */}
      <circle cx="35" cy="44" r="1.5" style={S.sageFill} opacity="0.3"/>
      <circle cx="85" cy="50" r="1.2" style={S.sageFill} opacity="0.3"/>
    </svg>
  );
}

// Shield with a checkmark — for Recall Check empty state
export function ShieldCheckIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      {/* shield */}
      <path d="M60 12 L88 24 L88 52 Q88 70 60 80 Q32 70 32 52 L32 24 Z" style={S.creamFillSageStroke} strokeWidth="1.5" strokeLinejoin="round"/>
      {/* inner shield */}
      <path d="M60 20 L80 30 L80 50 Q80 64 60 72 Q40 64 40 50 L40 30 Z" style={S.creamFillSageStroke} strokeWidth="1" opacity="0.7"/>
      {/* checkmark */}
      <path d="M48 46 L56 54 L74 36" style={S.sageStroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* sparkle dots */}
      <circle cx="26" cy="28" r="1.5" style={S.sageFill} opacity="0.4"/>
      <circle cx="94" cy="32" r="1.2" style={S.sageFill} opacity="0.3"/>
      <circle cx="92" cy="22" r="1" style={S.sageFill} opacity="0.3"/>
    </svg>
  );
}
