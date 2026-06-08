import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

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

  return (
    <>
      <Outlet />
      <UpgradePrompt />
    </>
  );
}
