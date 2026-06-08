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
