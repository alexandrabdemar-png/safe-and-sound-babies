import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ClipboardList, Copy, Printer, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/caregiver-card")({
  ssr: false,
  component: CaregiverCardPage,
  head: () => ({ meta: [{ title: "Caregiver Card — Safe & Sound" }] }),
});

interface Child {
  id: string;
  name: string;
  date_of_birth: string | null;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

interface CardData {
  allergies: string;
  medications: string;
  pediatricianName: string;
  pediatricianPhone: string;
  bedtimeRoutine: string;
  napRoutine: string;
  feedingNotes: string;
}

const EMPTY_CARD: CardData = {
  allergies: "",
  medications: "",
  pediatricianName: "",
  pediatricianPhone: "",
  bedtimeRoutine: "",
  napRoutine: "",
  feedingNotes: "",
};

function CaregiverCardPage() {
  const [loading, setLoading] = useState(true);
  const [child, setChild] = useState<Child | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [card, setCard] = useState<CardData>(EMPTY_CARD);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      if (!uid) {
        setLoading(false);
        return;
      }
      const [childRes, contactsRes] = await Promise.all([
        supabase
          .from("children")
          .select("id, name, date_of_birth")
          .order("created_at", { ascending: true })
          .limit(1)
          .single(),
        supabase
          .from("emergency_contacts")
          .select("id, name, phone, relationship")
          .eq("user_id", uid)
          .order("created_at", { ascending: true }),
      ]);
      const c = childRes.data as Child | null;
      setChild(c);
      setContacts((contactsRes.data ?? []) as EmergencyContact[]);
      if (c) {
        try {
          const stored = localStorage.getItem(`safesound.caregiverCard.${c.id}`);
          if (stored) setCard(JSON.parse(stored));
        } catch {}
      }
      setLoading(false);
    }
    init();
  }, []);

  function updateField(field: keyof CardData, value: string) {
    setCard((prev) => ({ ...prev, [field]: value }));
  }

  function saveCard() {
    if (!child) return;
    setSaving(true);
    try {
      localStorage.setItem(`safesound.caregiverCard.${child.id}`, JSON.stringify(card));
      toast.success("Saved!");
    } catch {
      toast.error("Could not save. Storage may be full.");
    }
    setSaving(false);
  }

  function copyToClipboard() {
    if (!child) return;
    const lines = [
      `CAREGIVER CARD — ${child.name.toUpperCase()}`,
      `Date of birth: ${child.date_of_birth ?? "unknown"}`,
      "",
      "EMERGENCY CONTACTS",
      ...(contacts.length > 0
        ? contacts.map((c) => `  ${c.name}${c.relationship ? ` (${c.relationship})` : ""}: ${c.phone}`)
        : ["  None on file"]),
      "",
      "PEDIATRICIAN",
      `  Name: ${card.pediatricianName || "—"}`,
      `  Phone: ${card.pediatricianPhone || "—"}`,
      "",
      "ALLERGIES",
      `  ${card.allergies || "None known"}`,
      "",
      "MEDICATIONS",
      `  ${card.medications || "None"}`,
      "",
      "ROUTINES",
      `  Bedtime: ${card.bedtimeRoutine || "—"}`,
      `  Nap: ${card.napRoutine || "—"}`,
      `  Feeding: ${card.feedingNotes || "—"}`,
    ].join("\n");

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!child) {
    return (
      <div className="flex min-h-screen flex-col bg-background pb-28">
        <div className="mx-auto max-w-md px-5 pt-10">
          <p className="font-body text-sm text-muted-foreground">
            Add a child profile first to create a caregiver card.
          </p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-5 pt-10 pb-6 sm:px-6 print:hidden">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-7 w-7 text-accent" />
            <h1 className="font-display text-3xl font-semibold tracking-tight">Caregiver Card</h1>
          </div>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            Fill in details for your babysitter or caregiver. Save locally, print, or copy.
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-6">
          {/* Printable card */}
          <div
            id="caregiver-print-card"
            className="rounded-3xl border border-border/60 bg-card p-6 print:rounded-none print:border-none print:p-0"
          >
            <div className="mb-5 border-b border-border/40 pb-4">
              <h2 className="font-display text-2xl font-semibold tracking-tight">{child.name}</h2>
              {child.date_of_birth && (
                <p className="mt-0.5 font-body text-sm text-muted-foreground">
                  Born: {new Date(child.date_of_birth + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                </p>
              )}
            </div>

            {/* Emergency Contacts (from Supabase, read-only here) */}
            <div className="mb-5">
              <h3 className="mb-2 font-display text-base font-semibold text-foreground">Emergency Contacts</h3>
              {contacts.length === 0 ? (
                <p className="font-body text-sm text-muted-foreground">
                  None on file —{" "}
                  <a href="/emergency" className="text-accent underline">
                    add in Emergency Hub
                  </a>
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {contacts.map((c) => (
                    <li key={c.id} className="font-body text-sm">
                      <span className="font-semibold">{c.name}</span>
                      {c.relationship && (
                        <span className="text-muted-foreground"> ({c.relationship})</span>
                      )}
                      {" — "}
                      <a href={`tel:${c.phone.replace(/\D/g, "")}`} className="text-accent">
                        {c.phone}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Pediatrician */}
            <div className="mb-5">
              <h3 className="mb-2 font-display text-base font-semibold text-foreground">Pediatrician</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-body text-xs font-semibold uppercase tracking-wide text-muted-foreground print:hidden">
                    Name
                  </label>
                  <p className="hidden font-body text-sm print:block">{card.pediatricianName || "—"}</p>
                  <input
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 font-body text-sm outline-none focus:ring-2 focus:ring-primary/30 print:hidden"
                    placeholder="Dr. Smith"
                    value={card.pediatricianName}
                    onChange={(e) => updateField("pediatricianName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-body text-xs font-semibold uppercase tracking-wide text-muted-foreground print:hidden">
                    Phone
                  </label>
                  <p className="hidden font-body text-sm print:block">{card.pediatricianPhone || "—"}</p>
                  <input
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 font-body text-sm outline-none focus:ring-2 focus:ring-primary/30 print:hidden"
                    placeholder="(555) 123-4567"
                    type="tel"
                    value={card.pediatricianPhone}
                    onChange={(e) => updateField("pediatricianPhone", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Allergies */}
            <FieldBlock
              label="Allergies"
              placeholder="e.g. peanuts, dairy (or 'none known')"
              value={card.allergies}
              onChange={(v) => updateField("allergies", v)}
            />

            {/* Medications */}
            <FieldBlock
              label="Medications"
              placeholder="Name, dose, and timing"
              value={card.medications}
              onChange={(v) => updateField("medications", v)}
            />

            {/* Routines */}
            <div className="mb-5">
              <h3 className="mb-3 font-display text-base font-semibold text-foreground">Routines</h3>
              <div className="space-y-3">
                <FieldBlock
                  label="Bedtime routine"
                  placeholder="e.g. bath at 7, bottle, story, asleep by 7:30"
                  value={card.bedtimeRoutine}
                  onChange={(v) => updateField("bedtimeRoutine", v)}
                  multiline
                />
                <FieldBlock
                  label="Nap routine"
                  placeholder="e.g. nap at 1pm, usually 1.5 hrs"
                  value={card.napRoutine}
                  onChange={(v) => updateField("napRoutine", v)}
                  multiline
                />
                <FieldBlock
                  label="Feeding notes"
                  placeholder="e.g. 6oz formula every 4hrs, no solids after 6pm"
                  value={card.feedingNotes}
                  onChange={(v) => updateField("feedingNotes", v)}
                  multiline
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 print:hidden">
            <Button
              onClick={saveCard}
              disabled={saving}
              className="rounded-full bg-primary px-5 font-body text-sm font-semibold text-primary-foreground"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="rounded-full px-5 font-body text-sm font-semibold"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print / Save PDF
            </Button>
            <Button
              variant="outline"
              onClick={copyToClipboard}
              className="rounded-full px-5 font-body text-sm font-semibold"
            >
              {copied ? (
                <Check className="mr-2 h-4 w-4 text-green-600" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? "Copied!" : "Copy text"}
            </Button>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function FieldBlock({
  label,
  placeholder,
  value,
  onChange,
  multiline,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1 block font-body text-xs font-semibold uppercase tracking-wide text-muted-foreground print:hidden">
        {label}
      </label>
      <p className="hidden font-body text-sm print:block">
        <span className="font-semibold">{label}:</span> {value || "—"}
      </p>
      {multiline ? (
        <textarea
          className="w-full resize-none rounded-xl border border-border/60 bg-background px-3 py-2 font-body text-sm outline-none focus:ring-2 focus:ring-primary/30 print:hidden"
          placeholder={placeholder}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 font-body text-sm outline-none focus:ring-2 focus:ring-primary/30 print:hidden"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
