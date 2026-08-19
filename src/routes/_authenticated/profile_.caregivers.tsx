import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShieldOff, Users, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listCaregiverAccess,
  revokeCaregiverAccess,
  revokeCaregiverInvite,
  type CaregiverGrant,
  type PendingInvite,
} from "@/lib/caregiverAccess.functions";
import { sanitizeError, logError } from "@/lib/sanitize-error";

export const Route = createFileRoute("/_authenticated/profile_/caregivers")({
  head: () => ({
    meta: [
      { title: "Manage caregiver access — Peace of Mine" },
      {
        name: "description",
        content:
          "See everyone who can view or edit your child's profile, and remove their access at any time.",
      },
      { property: "og:title", content: "Manage caregiver access — Peace of Mine" },
      {
        property: "og:description",
        content: "Review and revoke shared access to your child's safety profile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaregiversScreen,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CaregiversScreen() {
  const [grants, setGrants] = useState<CaregiverGrant[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await listCaregiverAccess();
      setGrants(result.grants);
      setInvites(result.invites);
    } catch (err) {
      logError("[caregivers] load failed", err);
      toast.error("Couldn't load caregiver access");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRevokeGrant(grant: CaregiverGrant) {
    setBusyId(grant.id);
    try {
      await revokeCaregiverAccess({ data: { grantId: grant.id } });
      setGrants((prev) => prev.filter((g) => g.id !== grant.id));
      toast.success(`Access to ${grant.childName} removed`);
    } catch (err) {
      logError("[caregivers] revoke failed", err);
      toast.error("Couldn't remove that access");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeInvite(invite: PendingInvite) {
    setBusyId(invite.id);
    try {
      await revokeCaregiverInvite({ data: { inviteId: invite.id } });
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      toast.success("Invite cancelled");
    } catch (err) {
      logError("[caregivers] invite revoke failed", err);
      toast.error("Couldn't cancel that invite");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="px-5 pt-8 pb-4 sm:px-6">
        <div className="mx-auto max-w-md space-y-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full font-body text-xs">
            <Link to="/profile">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Profile
            </Link>
          </Button>
          <h1 className="font-display text-2xl font-semibold">Caregiver access</h1>
          <p className="font-body text-sm text-muted-foreground">
            Everyone below can view and edit the children you shared with them. Removing access
            takes effect immediately.
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <section className="rounded-3xl border border-border/60 bg-card p-5">
                <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                  <Users className="h-4 w-4 text-primary" /> Active access
                </h2>
                {grants.length === 0 ? (
                  <p className="mt-2 font-body text-sm text-muted-foreground">
                    No one else has access to your children's profiles.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {grants.map((grant) => (
                      <li
                        key={grant.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-body text-sm font-medium">
                            {grant.childName}
                          </p>
                          <p className="font-body text-xs text-muted-foreground">
                            {grant.role === "editor" ? "Can view and edit" : "View only"} · since{" "}
                            {formatDate(grant.createdAt)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full font-body text-xs"
                          disabled={busyId === grant.id}
                          onClick={() => void handleRevokeGrant(grant)}
                        >
                          {busyId === grant.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <ShieldOff className="mr-1 h-3.5 w-3.5" /> Remove
                            </>
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-3xl border border-border/60 bg-card p-5">
                <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                  <Mail className="h-4 w-4 text-primary" /> Pending invites
                </h2>
                {invites.length === 0 ? (
                  <p className="mt-2 font-body text-sm text-muted-foreground">
                    No invites waiting to be accepted.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {invites.map((invite) => (
                      <li
                        key={invite.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-body text-sm font-medium">{invite.email}</p>
                          <p className="font-body text-xs text-muted-foreground">
                            Expires {formatDate(invite.expiresAt)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full font-body text-xs"
                          disabled={busyId === invite.id}
                          onClick={() => void handleRevokeInvite(invite)}
                        >
                          {busyId === invite.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Cancel"
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
