import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HeartPulse, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/emergency-share/$token")({
  ssr: false,
  component: SharedEmergencyInfoPage,
  head: () => ({ meta: [{ title: "Emergency Info" }] }),
});

interface SharedInfo {
  child_name: string;
  allergies: string | null;
  medications: string | null;
  blood_type: string | null;
  pediatrician_name: string | null;
  pediatrician_phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
}

function SharedEmergencyInfoPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<SharedInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/public/emergency-share?token=${encodeURIComponent(token)}`);
        const body = await res.json();
        if (!res.ok || !body.ok) {
          setErrorMsg(body.error ?? "This link is invalid or has expired.");
        } else {
          setInfo(body as SharedInfo);
        }
      } catch {
        setErrorMsg("Something went wrong loading this card. Please try again.");
      }
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (errorMsg || !info) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="font-body text-lg font-semibold">
          {errorMsg ?? "This link is invalid or has expired."}
        </p>
        <p className="font-body text-sm text-muted-foreground">
          Ask the parent to send a new link.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-5 py-10 sm:px-6">
      <div className="mx-auto max-w-md rounded-3xl border border-border/60 bg-card p-6">
        <div className="mb-6 flex items-center gap-3">
          <HeartPulse className="h-8 w-8 text-accent" />
          <h1 className="font-display text-3xl font-semibold tracking-tight">{info.child_name}</h1>
        </div>

        <Row label="Blood type" value={info.blood_type} />
        <Row label="Allergies" value={info.allergies} highlight />
        <Row label="Medications" value={info.medications} />
        <Row label="Pediatrician" value={info.pediatrician_name} phone={info.pediatrician_phone} />
        <Row
          label="Emergency contact"
          value={info.emergency_contact_name}
          phone={info.emergency_contact_phone}
        />
        <Row label="Notes" value={info.notes} last />

        <p className="mt-8 text-center font-body text-xs text-muted-foreground">
          Shared from Peace of Mine. This link expires automatically.
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  phone,
  highlight,
  last,
}: {
  label: string;
  value: string | null;
  phone?: string | null;
  highlight?: boolean;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-5 border-b border-border/40 pb-5"}>
      <p className="mb-1 font-body text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`font-body text-xl ${highlight ? "font-bold text-destructive" : "font-medium text-foreground"}`}
      >
        {value || "—"}
      </p>
      {phone && (
        <a
          href={`tel:${phone.replace(/\D/g, "")}`}
          className="font-body text-xl font-medium text-accent underline"
        >
          {phone}
        </a>
      )}
    </div>
  );
}
