import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { HeartPulse, Copy, Check, Link2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { computeShareExpiry, generateShareToken, hashShareToken } from "@/lib/emergencyShare";

export const Route = createFileRoute("/_authenticated/emergency-info")({
  ssr: false,
  component: EmergencyInfoPage,
  head: () => ({ meta: [{ title: "Emergency Info — Peace of Mine" }] }),
});

interface Child {
  id: string;
  name: string;
}

interface EmergencyInfo {
  allergies: string;
  medications: string;
  blood_type: string;
  pediatrician_name: string;
  pediatrician_phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  notes: string;
}

const EMPTY_INFO: EmergencyInfo = {
  allergies: "",
  medications: "",
  blood_type: "",
  pediatrician_name: "",
  pediatrician_phone: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  notes: "",
};

interface ActiveLink {
  id: string;
  expires_at: string;
}

function EmergencyInfoPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [child, setChild] = useState<Child | null>(null);
  const [info, setInfo] = useState<EmergencyInfo>(EMPTY_INFO);
  const [saving, setSaving] = useState(false);
  const [activeLink, setActiveLink] = useState<ActiveLink | null>(null);
  const [freshShareUrl, setFreshShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        setLoading(false);
        return;
      }

      const { data: c } = await supabase
        .from("children")
        .select("id, name")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      setChild(c as Child | null);

      if (c) {
        const { data: existing } = await supabase
          .from("emergency_info")
          .select(
            "allergies, medications, blood_type, pediatrician_name, pediatrician_phone, emergency_contact_name, emergency_contact_phone, notes",
          )
          .eq("child_id", c.id)
          .maybeSingle();
        if (existing) {
          setInfo((prev) => ({
            ...prev,
            ...Object.fromEntries(Object.entries(existing).map(([k, v]) => [k, v ?? ""])),
          }));
        }

        const nowIso = new Date().toISOString();
        const { data: link } = await supabase
          .from("emergency_share_links")
          .select("id, expires_at")
          .eq("child_id", c.id)
          .is("revoked_at", null)
          .gt("expires_at", nowIso)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (link) setActiveLink(link);
      }

      setLoading(false);
    }
    init();
  }, []);

  function updateField(field: keyof EmergencyInfo, value: string) {
    setInfo((prev) => ({ ...prev, [field]: value }));
  }

  async function saveInfo() {
    if (!child || !userId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("emergency_info")
        .upsert({ ...info, child_id: child.id, user_id: userId }, { onConflict: "child_id" });
      if (error) throw error;
      toast.success("Saved");
    } catch {
      toast.error("Could not save. Please try again.");
    }
    setSaving(false);
  }

  async function generateLink() {
    if (!child || !userId) return;
    setGenerating(true);
    try {
      const rawToken = generateShareToken();
      const tokenHash = await hashShareToken(rawToken);
      const expiresAt = computeShareExpiry();

      const { data, error } = await supabase
        .from("emergency_share_links")
        .insert({
          user_id: userId,
          child_id: child.id,
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString(),
        })
        .select("id, expires_at")
        .single();
      if (error) throw error;

      setActiveLink(data);
      setFreshShareUrl(`${window.location.origin}/emergency-share/${rawToken}`);
      toast.success("Share link created — expires in 24 hours");
    } catch {
      toast.error("Could not create a share link. Please try again.");
    }
    setGenerating(false);
  }

  async function revokeLink() {
    if (!activeLink) return;
    try {
      const { error } = await supabase
        .from("emergency_share_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", activeLink.id);
      if (error) throw error;
      setActiveLink(null);
      setFreshShareUrl(null);
      toast.success("Link revoked");
    } catch {
      toast.error("Could not revoke the link. Please try again.");
    }
  }

  function copyLink() {
    if (!freshShareUrl) return;
    navigator.clipboard.writeText(freshShareUrl).then(() => {
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
            Add a child profile first to set up emergency info.
          </p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-5 pt-10 pb-6 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-3">
            <HeartPulse className="h-7 w-7 text-accent" />
            <h1 className="font-display text-3xl font-semibold tracking-tight">Emergency Info</h1>
          </div>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            One card with everything a babysitter or grandparent would need in a hurry.
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-6">
          {/* Large-text emergency card */}
          <div className="rounded-3xl border border-border/60 bg-card p-6">
            <h2 className="mb-5 font-display text-2xl font-semibold tracking-tight">
              {child.name}
            </h2>

            <BigField
              label="Blood type"
              value={info.blood_type}
              onChange={(v) => updateField("blood_type", v)}
              placeholder="e.g. O+"
            />
            <BigField
              label="Allergies"
              value={info.allergies}
              onChange={(v) => updateField("allergies", v)}
              placeholder="e.g. peanuts, penicillin (or 'none known')"
              multiline
            />
            <BigField
              label="Medications"
              value={info.medications}
              onChange={(v) => updateField("medications", v)}
              placeholder="Name, dose, and timing"
              multiline
            />
            <BigField
              label="Pediatrician"
              value={info.pediatrician_name}
              onChange={(v) => updateField("pediatrician_name", v)}
              placeholder="Dr. Smith"
            />
            <BigField
              label="Pediatrician phone"
              value={info.pediatrician_phone}
              onChange={(v) => updateField("pediatrician_phone", v)}
              placeholder="(555) 123-4567"
              type="tel"
            />
            <BigField
              label="Emergency contact"
              value={info.emergency_contact_name}
              onChange={(v) => updateField("emergency_contact_name", v)}
              placeholder="Name"
            />
            <BigField
              label="Emergency contact phone"
              value={info.emergency_contact_phone}
              onChange={(v) => updateField("emergency_contact_phone", v)}
              placeholder="(555) 987-6543"
              type="tel"
            />
            <BigField
              label="Notes"
              value={info.notes}
              onChange={(v) => updateField("notes", v)}
              placeholder="Anything else a caregiver should know"
              multiline
              last
            />
          </div>

          <Button
            onClick={saveInfo}
            disabled={saving}
            className="w-full rounded-full bg-primary py-6 font-body text-base font-semibold text-primary-foreground"
          >
            {saving ? "Saving…" : "Save"}
          </Button>

          {/* Shareable link */}
          <div className="rounded-3xl border border-border/60 bg-card p-6">
            <div className="mb-3 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-accent" />
              <h3 className="font-display text-lg font-semibold">Share with a caregiver</h3>
            </div>
            <p className="mb-4 font-body text-sm text-muted-foreground">
              Create a link that lets someone view this card without logging in. It expires in 24
              hours and can be revoked anytime.
            </p>

            {activeLink && (
              <p className="mb-3 font-body text-sm text-foreground">
                A link is active until{" "}
                {new Date(activeLink.expires_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                .
              </p>
            )}

            {freshShareUrl && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2">
                <p className="flex-1 truncate font-body text-xs text-muted-foreground">
                  {freshShareUrl}
                </p>
                <Button size="sm" variant="ghost" onClick={copyLink} className="shrink-0 px-2">
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={generateLink}
                disabled={generating}
                variant="outline"
                className="rounded-full px-5 font-body text-sm font-semibold"
              >
                {generating ? "Creating…" : activeLink ? "Create new link" : "Create link"}
              </Button>
              {activeLink && (
                <Button
                  onClick={revokeLink}
                  variant="outline"
                  className="rounded-full px-5 font-body text-sm font-semibold text-destructive"
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Revoke
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function BigField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline,
  last,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  multiline?: boolean;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-5"}>
      <label className="mb-1.5 block font-body text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {multiline ? (
        <textarea
          className="w-full resize-none rounded-xl border border-border/60 bg-background px-3 py-2.5 font-body text-lg outline-none focus:ring-2 focus:ring-primary/30"
          placeholder={placeholder}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 font-body text-lg outline-none focus:ring-2 focus:ring-primary/30"
          placeholder={placeholder}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
