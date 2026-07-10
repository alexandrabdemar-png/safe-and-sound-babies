import { createFileRoute } from "@tanstack/react-router";
import "@fontsource/cormorant/500.css";
import "@fontsource/cormorant/600.css";
import "@fontsource/marcellus/400.css";

export const Route = createFileRoute("/logo-mockup-preview")({
  component: LogoMockupPreview,
});

const INK = "#586C81";

function BottleIcon({ px }: { px: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g stroke={INK} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M92 42 Q92 32 100 30 Q108 32 108 42" strokeWidth="4" />
        <line x1="92" y1="42" x2="92" y2="50" strokeWidth="4" />
        <line x1="108" y1="42" x2="108" y2="50" strokeWidth="4" />
        <rect x="86" y="50" width="28" height="10" rx="4" strokeWidth="4" />
        <path
          d="M82 60 Q72 72 70 90 L70 148 Q70 164 100 164 Q130 164 130 148 L130 90 Q128 72 118 60 Z"
          strokeWidth="4.5"
        />
        <line x1="82" y1="110" x2="90" y2="110" strokeWidth="3" />
        <line x1="82" y1="122" x2="90" y2="122" strokeWidth="3" />
        <line x1="82" y1="134" x2="90" y2="134" strokeWidth="3" />
        <line x1="82" y1="146" x2="90" y2="146" strokeWidth="3" />
        <path
          d="M90 88 Q90 82 95 82 Q97 78 101 78 Q106 78 108 82 Q112 82 112 88 Q112 93 90 93 Z"
          strokeWidth="3.2"
        />
      </g>
    </svg>
  );
}

function ShieldIcon({ px }: { px: number }) {
  return (
    <svg
      width={px}
      height={Math.round(px * 1.14)}
      viewBox="0 0 28 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14 1.5L2.5 6.5V16C2.5 22.9 7.6 28.6 14 30.2C20.4 28.6 25.5 22.9 25.5 16V6.5L14 1.5Z"
        fill="#586C81"
      />
      <path
        d="M14 8.5C14 8.5 10 13.5 10 16.5C10 18.7 11.8 20.5 14 20.5C16.2 20.5 18 18.7 18 16.5C18 13.5 14 8.5 14 8.5Z"
        fill="white"
        fillOpacity="0.88"
      />
    </svg>
  );
}

function Row({
  label,
  icon,
  fontFamily,
  fontStyle = "normal",
  fontWeight = 600,
  letterSpacing = "-0.3px",
  textTransform = "none",
  fontSize = 30,
}: {
  label: string;
  icon: React.ReactNode;
  fontFamily: string;
  fontStyle?: string;
  fontWeight?: number;
  letterSpacing?: string;
  textTransform?: "none" | "uppercase";
  fontSize?: number;
}) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#7A6248", marginBottom: 10, fontWeight: 600 }}>
        {label}
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 14,
          background: "#FFFFFF",
          border: "1px solid #DDD3C4",
          borderRadius: 14,
          padding: "20px 28px",
        }}
      >
        {icon}
        <span
          style={{
            fontFamily,
            fontStyle,
            fontWeight,
            letterSpacing,
            textTransform,
            fontSize,
            color: "#2B2622",
            lineHeight: 1,
          }}
        >
          Peace of Mine
        </span>
      </div>
    </div>
  );
}

function LogoMockupPreview() {
  return (
    <div style={{ background: "#F7F4EF", minHeight: "100vh", padding: 48 }}>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 22, fontWeight: 700, color: "#2B2622", marginBottom: 4 }}>
        Logo mockups
      </div>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#5B5449", marginBottom: 32 }}>
        Current vs. hand-drawn bottle icon + alternate serif wordmarks
      </div>

      <Row
        label="CURRENT — shield icon, Playfair Display italic"
        icon={<ShieldIcon px={30} />}
        fontFamily='"Playfair Display", Georgia, serif'
        fontStyle="italic"
        fontWeight={600}
      />

      <Row
        label='OPTION A — hand-drawn bottle, Cormorant (editorial, wedding-invite delicate)'
        icon={<BottleIcon px={34} />}
        fontFamily='"Cormorant", Georgia, serif'
        fontStyle="normal"
        fontWeight={600}
        letterSpacing="0.5px"
        fontSize={34}
      />

      <Row
        label='OPTION B — hand-drawn bottle, Marcellus + tracking (clean boutique logotype, "Oliver Label" style)'
        icon={<BottleIcon px={34} />}
        fontFamily='"Marcellus", Georgia, serif'
        fontStyle="normal"
        fontWeight={400}
        letterSpacing="1.5px"
        textTransform="uppercase"
        fontSize={22}
      />

      <Row
        label="OPTION C — hand-drawn bottle, Marcellus, lowercase, no tracking (softer)"
        icon={<BottleIcon px={34} />}
        fontFamily='"Marcellus", Georgia, serif'
        fontStyle="normal"
        fontWeight={400}
        letterSpacing="0px"
        fontSize={28}
      />
    </div>
  );
}
