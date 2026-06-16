import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Phone, ExternalLink, Plus, Trash2, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const ssr = false;

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

function EmergencyPage() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRelationship, setNewRelationship] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data } = await supabase
          .from("emergency_contacts")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: true });
        setContacts(data ?? []);
      }
      setLoading(false);
    }
    init();
  }, []);

  async function addContact() {
    if (!userId || !newName.trim() || !newPhone.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("emergency_contacts")
      .insert({ user_id: userId, name: newName.trim(), phone: newPhone.trim(), relationship: newRelationship.trim() })
      .select()
      .single();
    if (!error && data) {
      setContacts((prev) => [...prev, data]);
      setNewName("");
      setNewPhone("");
      setNewRelationship("");
      setShowAddForm(false);
    }
    setSaving(false);
  }

  async function deleteContact(id: string) {
    await supabase.from("emergency_contacts").delete().eq("id", id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: "#FAF7F2" }}>
      <div className="mx-auto max-w-md px-4 pt-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Shield className="h-7 w-7" style={{ color: "#C4785A" }} />
          <h1 className="font-display text-3xl font-semibold" style={{ color: "#3D2B1F" }}>
            Emergency
          </h1>
        </div>

        {/* Poison Control CTA */}
        <a
          href="tel:18002221222"
          className="mb-4 flex w-full flex-col items-center justify-center gap-2 rounded-2xl py-6 transition-opacity hover:opacity-90 active:opacity-80"
          style={{ backgroundColor: "#C4785A" }}
        >
          <Phone className="h-8 w-8 text-white" strokeWidth={2} />
          <span className="font-display text-xl font-semibold text-white">
            Call Poison Control
          </span>
          <span className="font-body text-lg font-medium text-white/90">
            1-800-222-1222
          </span>
        </a>

        {/* Recall Links */}
        <div className="mb-8 flex flex-col gap-3">
          <a
            href="https://www.cpsc.gov/Recalls"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-2xl border px-5 py-4 transition-colors hover:bg-white/60"
            style={{ borderColor: "#C8B8A2", backgroundColor: "white" }}
          >
            <div>
              <p className="font-body font-semibold" style={{ color: "#3D2B1F" }}>
                CPSC Recall Search
              </p>
              <p className="font-body text-sm" style={{ color: "#8A8078" }}>
                Consumer Product Safety Commission
              </p>
            </div>
            <ExternalLink className="h-5 w-5 shrink-0" style={{ color: "#C4785A" }} />
          </a>

          <a
            href="https://www.nhtsa.gov/vehicle/recalls"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-2xl border px-5 py-4 transition-colors hover:bg-white/60"
            style={{ borderColor: "#C8B8A2", backgroundColor: "white" }}
          >
            <div>
              <p className="font-body font-semibold" style={{ color: "#3D2B1F" }}>
                NHTSA Vehicle Recalls
              </p>
              <p className="font-body text-sm" style={{ color: "#8A8078" }}>
                National Highway Traffic Safety Administration
              </p>
            </div>
            <ExternalLink className="h-5 w-5 shrink-0" style={{ color: "#C4785A" }} />
          </a>
        </div>

        {/* Emergency Contacts */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold" style={{ color: "#3D2B1F" }}>
              Emergency Contacts
            </h2>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-1 rounded-full px-4 py-2 font-body text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#C4785A" }}
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          {showAddForm && (
            <div
              className="mb-4 rounded-2xl border p-4"
              style={{ borderColor: "#C8B8A2", backgroundColor: "white" }}
            >
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded-lg border px-3 py-2 font-body text-sm outline-none"
                  style={{ borderColor: "#C8B8A2", color: "#3D2B1F" }}
                />
                <input
                  type="tel"
                  placeholder="Phone number"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="rounded-lg border px-3 py-2 font-body text-sm outline-none"
                  style={{ borderColor: "#C8B8A2", color: "#3D2B1F" }}
                />
                <input
                  type="text"
                  placeholder="Relationship (e.g. Pediatrician)"
                  value={newRelationship}
                  onChange={(e) => setNewRelationship(e.target.value)}
                  className="rounded-lg border px-3 py-2 font-body text-sm outline-none"
                  style={{ borderColor: "#C8B8A2", color: "#3D2B1F" }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={addContact}
                    disabled={saving || !newName.trim() || !newPhone.trim()}
                    className="flex-1 rounded-full py-2 font-body text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: "#C4785A" }}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 rounded-full border py-2 font-body text-sm font-medium transition-colors hover:bg-gray-50"
                    style={{ borderColor: "#C8B8A2", color: "#3D2B1F" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <p className="font-body text-sm" style={{ color: "#8A8078" }}>Loading contacts...</p>
          ) : contacts.length === 0 ? (
            <p className="font-body text-sm" style={{ color: "#8A8078" }}>
              No emergency contacts yet. Add your pediatrician, a trusted neighbor, or family members.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-2xl border px-5 py-4"
                  style={{ borderColor: "#C8B8A2", backgroundColor: "white" }}
                >
                  <div>
                    <p className="font-body font-semibold" style={{ color: "#3D2B1F" }}>
                      {c.name}
                    </p>
                    {c.relationship && (
                      <p className="font-body text-xs" style={{ color: "#8A8078" }}>
                        {c.relationship}
                      </p>
                    )}
                    <a
                      href={`tel:${c.phone.replace(/\D/g, "")}`}
                      className="font-body text-sm font-medium"
                      style={{ color: "#C4785A" }}
                    >
                      {c.phone}
                    </a>
                  </div>
                  <button
                    onClick={() => deleteContact(c.id)}
                    className="ml-3 rounded-full p-2 transition-colors hover:bg-red-50"
                    aria-label={`Delete ${c.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/emergency")({
  component: EmergencyPage,
  ssr: false,
});
