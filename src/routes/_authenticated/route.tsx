import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { toast } from "sonner";
import { AlertTriangle, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
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
  // Track IDs of records recently changed by THIS user so we don't toast on our own edits.
  const ownChanges = useRef<Set<string>>(new Set());

  // Expose a helper that other parts of the app can call to register own changes.
  // (simple module-level ref — no context needed for this lightweight use case)
  useEffect(() => {
    (window as any).__ssOwnChange = (id: string) => {
      ownChanges.current.add(id);
      setTimeout(() => ownChanges.current.delete(id), 8000);
    };
    return () => { delete (window as any).__ssOwnChange; };
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

    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, navigate]);

  // ── Co-parent realtime sync ─────────────────────────────────────────────────
  // Subscribes to changes on shared tables. When a change comes from a different
  // user (co-parent or caregiver), shows a quiet in-app toast without interrupting
  // the current screen. No push notification is sent — in-app only.
  useEffect(() => {
    if (!user?.id) return;

    function handleCoParentChange(
      table: string,
      record: Record<string, unknown>,
    ) {
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
        .on(
          "postgres_changes" as any,
          { event: "*", schema: "public", table },
          (payload: any) => {
            const record = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;
            handleCoParentChange(table, record);
          },
        )
        .subscribe(),
    );

    return () => {
      channels.forEach((ch) => void supabase.removeChannel(ch));
    };
  }, [user?.id]);

  return (
    <>
      <Outlet />
      <UpgradePrompt />
    </>
  );
}
