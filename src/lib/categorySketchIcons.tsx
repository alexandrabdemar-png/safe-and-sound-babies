// Hand-drawn category icons matching the home screen's moment-icon style
// (src/lib/momentIcons.tsx) — same sketchy filter, same blue ink color.
// Used by onboarding.tsx's "What are you tracking?" step, which previously
// used plain lucide-react outline icons that didn't match the app's
// established hand-drawn look.

import { MOMENT_ICON_ACCENT } from "@/lib/momentIcons";
import type { CategoryKey } from "@/lib/productCategories";

const INK = MOMENT_ICON_ACCENT;

const wrap = (px: number, children: React.ReactNode) => (
  <svg width={px} height={px} viewBox="0 0 100 100" fill="none" aria-hidden="true">
    {children}
  </svg>
);
const g = (children: React.ReactNode, strokeWidth = 5.5) => (
  <g
    style={{ filter: "url(#moment-sketchy)" }}
    stroke={INK}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  >
    {children}
  </g>
);

const CarSeatIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M28,85 L28,52 Q28,18 50,15 Q72,18 72,52 L72,85" />
        <path d="M20,85 L80,85" />
        <path d="M36,55 L64,80 M64,55 L36,80" strokeWidth={4} />
      </>,
    ),
  );

const CribIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M18,28 L18,82 L82,82 L82,28" />
        <path d="M34,28 L34,82 M50,28 L50,82 M66,28 L66,82" strokeWidth={4} />
        <path d="M22,82 L16,92 M78,82 L84,92" />
      </>,
    ),
  );

const BassinetIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <ellipse cx="50" cy="62" rx="32" ry="16" />
        <path d="M20,60 Q18,26 44,24" />
        <path d="M35,76 L28,92 M65,76 L72,92" />
      </>,
    ),
  );

const StrollerIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M26,32 Q45,12 64,32" />
        <path d="M28,32 L33,58 L62,58 L67,32" />
        <path d="M36,58 L30,78 M56,58 L68,78" />
        <path d="M60,58 L84,38" />
        <circle cx="30" cy="82" r="8" strokeWidth={4.5} />
        <circle cx="68" cy="82" r="8" strokeWidth={4.5} />
      </>,
    ),
  );

const HighChairIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M30,18 L30,58 L70,58 L70,18" />
        <path d="M26,58 L74,58" strokeWidth={4} />
        <path d="M32,62 L20,92 M40,62 L30,92 M60,62 L70,92 M68,62 L80,92" strokeWidth={4} />
      </>,
    ),
  );

const BouncerIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M14,78 Q50,14 86,78" />
        <path d="M26,58 Q50,76 74,58" />
        <path d="M28,59 L24,76 M72,59 L76,76" strokeWidth={4} />
      </>,
    ),
  );

const ActivityCenterIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <circle cx="50" cy="44" r="28" />
        <circle cx="50" cy="44" r="9" fill={INK} stroke="none" />
        <path d="M50,18 L50,35 M50,53 L50,70 M24,44 L41,44 M59,44 L76,44" strokeWidth={3.5} />
        <path d="M32,66 L24,90 M68,66 L76,90" strokeWidth={4} />
      </>,
    ),
  );

const SleepSackIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M36,15 L64,15 L80,52 Q80,90 50,90 Q20,90 20,52 Z" />
        <path d="M50,18 L50,86" strokeWidth={4} />
        <circle cx="28" cy="28" r="7" />
        <circle cx="72" cy="28" r="7" />
      </>,
    ),
  );

const BabyGateIcon = ({ px }: { px: number }) =>
  wrap(
    px,
    g(
      <>
        <path d="M16,20 L16,84 L84,84 L84,20" />
        <path d="M32,20 L32,84 M48,20 L48,84 M64,20 L64,84" strokeWidth={4} />
        <path d="M16,50 L84,50" strokeWidth={4} />
      </>,
    ),
  );

export const CATEGORY_SKETCH_ICONS: Partial<Record<CategoryKey, ({ px }: { px: number }) => React.ReactElement>> = {
  car_seat: CarSeatIcon,
  crib: CribIcon,
  bassinet: BassinetIcon,
  stroller: StrollerIcon,
  high_chair: HighChairIcon,
  bouncer: BouncerIcon,
  activity_center: ActivityCenterIcon,
  sleep_sack: SleepSackIcon,
  baby_gate: BabyGateIcon,
};
