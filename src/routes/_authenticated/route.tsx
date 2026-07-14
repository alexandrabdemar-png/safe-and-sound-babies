import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { toast } from "sonner";
import { AlertTriangle, Users, WifiOff } from "lucide-react";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { needsLegalConsent } from "@/lib/legalConsent";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });

    // Clickwrap gate: every user, new or returning, must have accepted the
    // current Terms of Service version before reaching any authenticated
    // screen — not just at signup, since existing users need to accept a
    // material terms update too (see src/lib/legalConsent.ts).
    const { data: agreements } = await supabase
      .from("user_agreements")
      .select("terms_version")
      .eq("user_id", session.user.id);
    const acceptedVersions = (agreements ?? []).map((a) => (a as { terms_version: string }).terms_version);
    if (needsLegalConsent(acceptedVersions)) {
      throw redirect({ to: "/legal-consent", search: { next: location.pathname } });
    }

    return { user: session.user };
  },
  component: AuthenticatedLayout,
});

// Friendly descriptions for co-parent realtime events
function describeChange(table: string, record: Record<string, unknown>): string {
  switch (table) {
    case "children":
      return `updated ${(record.name as string | undefined) ?? "your child's"} profile`;
    case "products":
      return `added or updated a product${record.name ? ` — ${record.name}` : ""}`;
    case "milestones":
      return `logged a milestone${record.title ? ` — ${record.title}` : ""}`;
    case "product_recalls":
      return "flagged a new safety alert";
    default:
      return "made a change";
  }
}

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const ownChanges = useRef<Set<string>>(new Set());
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );

  usePushRegistration(user?.id ?? null);

  useEffect(() => {
    function handleOffline() {
      setIsOffline(true);
    }
    function handleOnline() {
      setIsOffline(false);
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Expose a helper that other parts of the app can call to register own changes.
  // (simple module-level ref — no context needed for this lightweight use case)
  useEffect(() => {
    (window as any).__ssOwnChange = (id: string) => {
      ownChanges.current.add(id);
      setTimeout(() => ownChanges.current.delete(id), 8000);
    };
    return () => {
      delete (window as any).__ssOwnChange;
    };
  }, []);

  // ── Recall alert channel (existing) ────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`recall-alerts:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "product_recalls",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const productId = (payload.new as { product_id?: string })?.product_id;
          let name = "one of your products";
          if (productId) {
            const { data } = await supabase
              .from("products")
              .select("name")
              .eq("id", productId)
              .maybeSingle();
            if (data?.name) name = data.name;
          }
          toast.error(`Safety recall: ${name}`, {
            description: "Tap to view what to do next.",
            icon: <AlertTriangle className="h-4 w-4" />,
            duration: 12000,
            action: {
              label: "View",
              onClick: () => navigate({ to: "/alerts" }),
            },
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, navigate]);

  // ── Co-parent realtime sync ─────────────────────────────────────────────────
  // Subscribes to changes on shared tables. When a change comes from a different
  // user (co-parent or caregiver), shows a quiet in-app toast without interrupting
  // the current screen. No push notification is sent — in-app only.
  useEffect(() => {
    if (!user?.id) return;

    function handleCoParentChange(table: string, record: Record<string, unknown>) {
      const recordId = (record.id as string | undefined) ?? "";
      const recordUserId = record.user_id as string | undefined;

      // Skip our own changes
      if (recordUserId === user.id) return;
      if (ownChanges.current.has(recordId)) return;

      // Show a gentle, non-disruptive in-app toast
      toast(`Your co-parent ${describeChange(table, record)}`, {
        icon: <Users className="h-4 w-4 text-primary" />,
        duration: 5000,
        // Low-key style — don't alarm, just inform
        style: { background: "var(--background)", border: "1px solid var(--border)" },
      });
    }

    const tables = ["children", "products", "milestones", "product_recalls"] as const;
    const channels = tables.map((table) =>
      supabase
        .channel(`co-parent:${table}:${user.id}`)
        .on("postgres_changes" as any, { event: "*", schema: "public", table }, (payload: any) => {
          const record = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;
          handleCoParentChange(table, record);
        })
        .subscribe(),
    );

    return () => {
      channels.forEach((ch) => void supabase.removeChannel(ch));
    };
  }, [user?.id]);

  // The client-side "daily retroactive recall check" that used to live here
  // has been retired in favor of the scheduled-recall-check edge function
  // (runs server-side, daily, for every user via pg_cron — see
  // supabase/migrations/20260705000000_recall_alerts_pipeline.sql). It also
  // silently never worked: it inserted into product_recalls using the
  // regular (non-admin) client, and product_recalls has no INSERT policy
  // for `authenticated` — every insert attempt was caught and swallowed by
  // its own try/catch.

  return (
    <>
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-foreground px-4 py-2.5 font-body text-xs font-medium text-background">
          <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
          You're offline — some features may not load until you reconnect.
        </div>
      )}
      <Outlet />
      <UpgradePrompt />
    </>
  );
}
