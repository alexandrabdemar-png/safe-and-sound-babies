import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LogOut, User as UserIcon, Sparkles, Loader2, Plus, Trash2,
  Download, BarChart3, CreditCard,
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useProGate } from "@/hooks/useProGate";
import { useActiveChild, setActiveChildId } from "@/hooks/useActiveChild";
import { createPortalSession } from "@/utils/payments.functions";
import { exportUserData } from "@/utils/export.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Profile — Safe & Sound" }] }),
});

function ProfilePage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const { isPro, subscription, loading: subLoading } = useSubscription();
  const { requirePro } = useProGate();
  const { children, refresh: refreshChildren } = useActiveChild();
  const [newChildName, setNewChildName] = useState("");
  const [newChildDob, setNewChildDob] = useState("");
  const [addingChild, setAddingChild] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else { toast.success("Signed out"); navigate({ to: "/auth" }); }
  }

  async function handleManage() {
    setPortalLoading(true);
    try {
      const result = await createPortalSession({
        data: { returnUrl: window.location.href, environment: getStripeEnvironment() },
      });
      if ('error' in result) throw new Error(result.error);
      window.open(result.url, '_blank');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open billing portal');
    } finally { setPortalLoading(false); }
  }

  async function handleAddChild(e: React.FormEvent) {
    e.preventDefault();
    if (!newChildName.trim()) return;
    if (children.length >= 1 && !requirePro('Multi-child support', 'Free plan tracks one child. Upgrade to Pro to add siblings.')) {
      return;
    }
    setAddingChild(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setAddingChild(false); return; }
    const { error } = await supabase.from('children').insert({
      user_id: uid,
      name: newChildName.trim(),
      date_of_birth: newChildDob || null,
    });
    setAddingChild(false);
    if (error) { toast.error(error.message); return; }
    setNewChildName(""); setNewChildDob("");
    await refreshChildren();
    toast.success('Child added');
  }

  async function handleDeleteChild(id: string) {
    if (children.length <= 1) {
      toast.error('You need at least one child');
      return;
    }
    if (!confirm('Remove this child and all their data?')) return;
    const { error } = await supabase.from('children').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setActiveChildId(null);
    await refreshChildren();
    toast.success('Removed');
  }

  async function handleExport() {
    if (!requirePro('Export your data', 'Download a complete backup of your children, products and moments as JSON.')) return;
    setExporting(true);
    try {
      const data = await exportUserData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `safesound-export-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally { setExporting(false); }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-5 pt-10 pb-6 sm:px-6">
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 font-body text-sm text-muted-foreground">{email ?? ""}</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-5 sm:px-6 space-y-4">
        {/* Subscription card */}
        <section className="rounded-3xl border border-border/60 bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-base font-semibold">
                  {subLoading ? '…' : isPro ? 'Safe & Sound Pro' : 'Free plan'}
                </p>
                {isPro && subscription?.current_period_end && (
                  <p className="font-body text-xs text-muted-foreground">
                    {subscription.cancel_at_period_end ? 'Ends' : 'Renews'}{' '}
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {isPro ? (
              <Button onClick={handleManage} variant="outline" className="flex-1 rounded-full" disabled={portalLoading}>
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CreditCard className="h-4 w-4 mr-2" /> Manage</>}
              </Button>
            ) : (
              <Button asChild className="flex-1 rounded-full">
                <Link to="/pricing">Upgrade to Pro</Link>
              </Button>
            )}
          </div>
        </section>

        {/* Children */}
        <section className="rounded-3xl border border-border/60 bg-card p-5">
          <h2 className="font-display text-base font-semibold mb-3">Children</h2>
          <ul className="space-y-2 mb-4">
            {children.map((c) => (
              <ChildRow key={c.id} child={c} onRemove={() => handleDeleteChild(c.id)} disableRemove={children.length <= 1} onUpdated={refreshChildren} />
            ))}
          </ul>
          <form onSubmit={handleAddChild} className="space-y-2">
            <Input
              placeholder="Name"
              value={newChildName}
              onChange={(e) => setNewChildName(e.target.value)}
              className="h-10 rounded-xl"
            />
            <Input
              type="date"
              value={newChildDob}
              onChange={(e) => setNewChildDob(e.target.value)}
              className="h-10 rounded-xl"
            />
            <Button type="submit" disabled={addingChild || !newChildName.trim()} className="w-full rounded-full">
              {addingChild ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-2" /> Add child</>}
            </Button>
            {!isPro && children.length >= 1 && (
              <p className="text-xs text-muted-foreground text-center">Pro unlocks multiple children.</p>
            )}
          </form>
        </section>


        {/* Tools */}
        <section className="rounded-3xl border border-border/60 bg-card p-5 space-y-2">
          <Button asChild variant="ghost" className="w-full justify-start rounded-xl">
            <Link to="/insights"><BarChart3 className="h-4 w-4 mr-2" /> Insights</Link>
          </Button>
          <Button onClick={handleExport} variant="ghost" className="w-full justify-start rounded-xl" disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Export my data
          </Button>
        </section>

        {/* Account */}
        <section className="rounded-3xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sand/50 text-accent">
              <UserIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-display text-base font-semibold">Account</p>
              <p className="font-body text-xs text-muted-foreground">{email ?? ""}</p>
            </div>
          </div>
          <Button onClick={signOut} variant="outline" className="mt-4 w-full rounded-full">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </section>
      </div>

      <BottomNav />
    </div>
  );
}

function ChildRow({
  child,
  onRemove,
  disableRemove,
  onUpdated,
}: {
  child: { id: string; name: string; date_of_birth: string | null; height_inches: number | null; weight_lbs: number | null; measurements_updated_at: string | null };
  onRemove: () => void;
  disableRemove: boolean;
  onUpdated: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [heightStr, setHeightStr] = useState("");
  const [weightStr, setWeightStr] = useState("");
  const [saving, setSaving] = useState(false);

  function open() {
    setHeightStr(child.height_inches != null ? child.height_inches.toFixed(1) : "");
    setWeightStr(child.weight_lbs != null ? child.weight_lbs.toFixed(1) : "");
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    const h = parseFloat(heightStr);
    const w = parseFloat(weightStr);
    const height_inches = Number.isFinite(h) && h > 0 ? h : null;
    const weight_lbs = Number.isFinite(w) && w > 0 ? w : null;
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("children")
      .update({
        height_inches,
        weight_lbs,
        measurements_updated_at: (height_inches !== null || weight_lbs !== null) ? nowIso : null,
      } as never)
      .eq("id", child.id);
    if (!error && (height_inches !== null || weight_lbs !== null)) {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        await supabase.from("child_measurements").insert({
          user_id: u.user.id,
          child_id: child.id,
          height_inches,
          weight_lbs,
          recorded_at: nowIso,
        } as never);
      }
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Measurements updated");
    setEditing(false);
    await onUpdated();
  }

  const displayHeight = child.height_inches != null ? `${child.height_inches.toFixed(1)}"` : null;
  const displayWeight = child.weight_lbs != null ? `${child.weight_lbs.toFixed(1)} lb` : null;

  return (
    <li className="rounded-2xl bg-muted/40 px-3 py-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-body text-sm font-medium">{child.name}</p>
          {child.date_of_birth && (
            <p className="font-body text-xs text-muted-foreground">
              Born {(() => { const [y,m,d] = child.date_of_birth.split('-').map(Number); return new Date(y, (m||1)-1, d||1).toLocaleDateString(); })()}
            </p>
          )}
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            {displayHeight || "Height —"} · {displayWeight || "Weight —"}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove} disabled={disableRemove}>
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {!editing ? (
        <Button variant="outline" size="sm" onClick={open} className="rounded-full text-xs">
          {displayHeight || displayWeight ? "Update measurements" : "Add height & weight"}
        </Button>
      ) : (
        <div className="space-y-2 rounded-xl border border-border bg-background p-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              step="0.1"
              min="0"
              placeholder="Height (in)"
              value={heightStr}
              onChange={(e) => setHeightStr(e.target.value)}
              className="h-10 rounded-xl"
            />
            <Input
              type="number"
              step="0.1"
              min="0"
              placeholder="Weight (lb)"
              value={weightStr}
              onChange={(e) => setWeightStr(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="flex-1 rounded-full">Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving} className="flex-1 rounded-full">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

