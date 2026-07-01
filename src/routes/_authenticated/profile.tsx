import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LogOut, User as UserIcon, Sparkles, Loader2, Plus, Trash2,
  Download, CreditCard, Shield, Bell, Share2, Gift, Copy, Check, HelpCircle, AlertTriangle, MessageSquare,
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useProGate } from "@/hooks/useProGate";
import { useActiveChild, setActiveChildId } from "@/hooks/useActiveChild";
import { createPortalSession } from "@/utils/payments.functions";
import { exportUserData } from "@/utils/export.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { openUrl } from "@/lib/browser";
import { APP_VERSION, SHARE_URL } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/profile")({
  ssr: false,
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Profile — Peace of Mine" }] }),
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
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      await openUrl(result.url);
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
    if (error) { console.error("children insert error:", error); toast.error(error.message); return; }
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

  async function handleDeleteAccount() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setDeleting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");
      const tables = [
        "milestones", "first_foods", "products", "product_recalls",
        "children", "insight_dismissals", "completed_tips",
        "child_measurements",
      ];
      for (const table of tables) {
        await (supabase as any).from(table).delete().eq("user_id", uid);
      }
      await supabase.auth.signOut();
      navigate({ to: "/auth" });
      toast.success("Account deleted. We're sorry to see you go.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete account");
      setDeleting(false);
      setDeleteConfirm(false);
    }
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
                  {subLoading ? '…' : isPro ? 'Peace of Mine Pro' : 'Free plan'}
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


        {/* Refer a friend */}
        <ReferFriendSection />

        {/* Co-parent invite section */}
        <CoParentInvite children={children} />

        {/* Tools */}
        <section className="rounded-3xl border border-border/60 bg-card p-5 space-y-2">
          <Button onClick={handleExport} variant="ghost" className="w-full justify-start rounded-xl" disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Export my data
          </Button>
          <Button asChild variant="ghost" className="w-full justify-start rounded-xl">
            <Link to="/profile/notification-settings"><Bell className="h-4 w-4 mr-2" /> Notification Settings</Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start rounded-xl"
            onClick={() => {
              try { localStorage.setItem("safesound.homeProfileSetup", "pending"); } catch {}
              navigate({ to: "/home" });
            }}
          >
            <Gift className="h-4 w-4 mr-2" /> Edit home profile
          </Button>
          <Button asChild variant="ghost" className="w-full justify-start rounded-xl">
            <Link to="/profile/privacy-policy"><Shield className="h-4 w-4 mr-2" /> Privacy Policy</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full justify-start rounded-xl">
            <Link to="/profile/support"><HelpCircle className="h-4 w-4 mr-2" /> Help & Support</Link>
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
          <div className="mt-4 flex flex-col gap-2">
            <Button asChild variant="outline" className="w-full rounded-full">
              <Link to="/profile/privacy-promise">
                <Shield className="mr-2 h-4 w-4" /> Privacy Promise
              </Link>
            </Button>
            <Button onClick={signOut} variant="outline" className="w-full rounded-full">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </section>

        {/* Share */}
        <ShareSection />

        {/* Feedback */}
        <FeedbackSection />

        {/* Legal disclaimer */}
        <section className="rounded-2xl border border-amber-300/50 bg-amber-50 px-5 py-4 dark:border-amber-700/30 dark:bg-amber-950/30">
          <p className="font-body text-xs font-semibold text-amber-900 dark:text-amber-200">Safety information disclaimer</p>
          <p className="mt-1 font-body text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            Peace of Mine provides safety aggregation for informational purposes only. It does not constitute medical, legal, or professional safety advice. Always consult product manuals and pediatrician guidelines directly. Recall data is sourced from CPSC and FDA databases — always verify at{" "}
            <a href="https://www.recalls.gov" target="_blank" rel="noopener noreferrer" className="font-semibold underline">recalls.gov</a>.
            Use at your own risk.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            <Link to="/terms" className="font-body text-xs font-semibold text-amber-900 underline dark:text-amber-200">Terms & Conditions</Link>
            <Link to="/profile/privacy-policy" className="font-body text-xs font-semibold text-amber-900 underline dark:text-amber-200">Privacy Policy</Link>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="rounded-3xl border border-destructive/30 bg-card p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <p className="font-display text-base font-semibold text-destructive">Danger zone</p>
          </div>
          {!deleteConfirm ? (
            <Button
              onClick={handleDeleteAccount}
              variant="ghost"
              className="w-full justify-start rounded-xl text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete my account
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl bg-destructive/8 border border-destructive/20 px-4 py-3">
                <p className="font-body text-sm font-semibold text-destructive mb-1">Are you sure?</p>
                <p className="font-body text-xs text-muted-foreground leading-relaxed">
                  This will permanently delete your account and all data — children, products, moments, and safety alerts. This cannot be undone.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-full bg-destructive hover:bg-destructive/90 text-white"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, delete everything"}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      <p className="mt-2 mb-6 text-center font-body text-xs text-muted-foreground/50">
        Version {APP_VERSION} Beta
      </p>

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

function ReferFriendSection() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      let referralCode: string = user.user_metadata?.referral_code ?? "";
      if (!referralCode) {
        referralCode = user.id.replace(/-/g, "").slice(0, 8).toUpperCase();
        await supabase.auth.updateUser({ data: { referral_code: referralCode } });
      }
      setCode(referralCode);
    })();
  }, []);

  const referralUrl = code ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth?ref=${code}` : "";

  function copyLink() {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      toast("Link: " + referralUrl);
    });
  }

  async function shareLink() {
    if (!referralUrl) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      await navigator.share({
        title: "Peace of Mine — baby safety app",
        text: "I've been using Peace of Mine to track recalls and safety milestones for my baby. Try it free:",
        url: referralUrl,
      }).catch(() => {});
    } else {
      copyLink();
    }
  }

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Gift className="h-4 w-4" />
        </div>
        <div>
          <p className="font-display text-base font-semibold">Refer a friend</p>
          <p className="font-body text-xs text-muted-foreground">Both get 1 free month of Pro</p>
        </div>
      </div>
      <p className="mb-4 font-body text-xs text-muted-foreground leading-relaxed">
        Share Peace of Mine with another caregiver. When they sign up with your link and subscribe to Pro, you both get one free month added to your account.
      </p>
      {code ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
            <p className="font-body text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Your referral code</p>
            <p className="font-display text-2xl font-semibold tracking-widest text-foreground">{code}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={copyLink} variant="outline" className="flex-1 rounded-full font-body text-xs">
              {copied ? <><Check className="mr-1.5 h-3.5 w-3.5 text-primary" /> Copied!</> : <><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy link</>}
            </Button>
            <Button onClick={shareLink} className="flex-1 rounded-full font-body text-xs">
              <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </section>
  );
}

function CoParentInvite({ children }: { children: { id: string; name: string }[] }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
      if (error) throw error;
      // Store invite locally so we remember who was invited
      try {
        const key = `safesound.coParentInvites`;
        const existing = JSON.parse(localStorage.getItem(key) ?? "[]");
        existing.push({ email: email.trim(), childIds: children.map((c) => c.id), ts: Date.now() });
        localStorage.setItem(key, JSON.stringify(existing));
      } catch {}
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send invite");
    } finally {
      setSending(false);
    }
  }

  const childNames = children.map((c) => c.name).join(" & ");

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sand/50 text-accent">
          <Share2 className="h-4 w-4" />
        </div>
        <div>
          <p className="font-display text-base font-semibold">Share access with a co-parent or caregiver</p>
          <p className="font-body text-xs text-muted-foreground">Works for partners, grandparents, nannies, or any caregiver</p>
        </div>
      </div>
      <p className="mb-3 font-body text-xs text-muted-foreground leading-relaxed">
        Enter their email and they'll receive a magic link giving them full access to view and edit{childNames ? ` ${childNames}'s` : ""} child profiles, products, milestones, and alerts — under your shared subscription.
      </p>
      {sent ? (
        <div className="rounded-2xl bg-primary/10 px-4 py-3">
          <p className="font-body text-sm text-foreground">
            Invite sent to <span className="font-semibold">{email}</span>. They'll get a magic link to sign in — no password needed.
          </p>
          <p className="mt-1 font-body text-xs text-muted-foreground">
            Once they sign in, contact us to link your accounts. Full automatic sync coming soon.
          </p>
          <button
            type="button"
            onClick={() => { setSent(false); setEmail(""); }}
            className="mt-2 font-body text-xs font-semibold text-primary underline underline-offset-2"
          >
            Invite another caregiver
          </button>
        </div>
      ) : (
        <form onSubmit={handleInvite} className="space-y-2">
          <Input
            type="email"
            placeholder="Co-parent or caregiver's email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 rounded-xl"
          />
          <Button type="submit" disabled={sending || !email.trim()} className="w-full rounded-full">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Share2 className="mr-2 h-4 w-4" /> Send access invite</>}
          </Button>
        </form>
      )}
    </section>
  );
}

function ShareSection() {
  const [copied, setCopied] = useState(false);
  const shareMessage = `I've been using Peace of Mine to track baby safety recalls and milestones — it's really helpful for new parents. Try it here: ${SHARE_URL}`;

  async function handleShare() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "Peace of Mine", text: shareMessage, url: SHARE_URL });
        return;
      } catch {}
    }
    navigator.clipboard.writeText(SHARE_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success("Link copied to clipboard");
    }).catch(() => toast("Share: " + SHARE_URL));
  }

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Share2 className="h-4 w-4" />
        </div>
        <div>
          <p className="font-display text-base font-semibold">Share Peace of Mine</p>
          <p className="font-body text-xs text-muted-foreground">Help other parents find us</p>
        </div>
      </div>
      <Button onClick={handleShare} className="w-full rounded-full">
        {copied ? <><Check className="mr-2 h-4 w-4" /> Copied!</> : <><Share2 className="mr-2 h-4 w-4" /> Share Peace of Mine</>}
      </Button>
    </section>
  );
}

const FEEDBACK_TYPES = ["Bug report", "Feature request", "General feedback"] as const;
type FeedbackType = (typeof FEEDBACK_TYPES)[number];

function FeedbackSection() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("General feedback");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await (supabase as any).from("feedback").insert({
        user_id: user?.id ?? null,
        type,
        message: message.trim(),
        app_version: APP_VERSION,
      });
      setDone(true);
      setMessage("");
    } catch {
      toast.error("Could not send feedback — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setDone(false); }}
        className="flex w-full items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="font-display text-base font-semibold">Share feedback</p>
            <p className="font-body text-xs text-muted-foreground">Help us improve Peace of Mine</p>
          </div>
        </div>
        <span className="text-muted-foreground text-lg leading-none">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-4">
          {done ? (
            <div className="rounded-2xl bg-primary/8 border border-primary/20 px-4 py-4 text-center">
              <p className="font-display text-base font-semibold text-primary mb-1">Thank you — we read every message.</p>
              <p className="font-body text-xs text-muted-foreground">Your feedback helps make Peace of Mine better for every family.</p>
              <button type="button" onClick={() => { setDone(false); setOpen(false); }} className="mt-3 font-body text-xs font-medium text-primary underline underline-offset-2">
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block font-body text-xs font-medium text-muted-foreground mb-1.5">What type of feedback?</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as FeedbackType)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  {FEEDBACK_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-body text-xs font-medium text-muted-foreground mb-1.5">Your message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's on your mind…"
                  rows={4}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                />
              </div>
              <Button type="submit" disabled={submitting || !message.trim()} className="w-full rounded-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send feedback"}
              </Button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

