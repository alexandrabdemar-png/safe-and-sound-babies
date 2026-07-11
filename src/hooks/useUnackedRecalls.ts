// useUnackedRecalls — realtime unread-count of unacknowledged product_recalls
// for the current user. Feeds the red dot on the Products tab so a missed
// push notification (OS throttled / notifications off) still surfaces
// in-app.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnackedRecalls(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const { data: userResp } = await supabase.auth.getUser();
      const uid = userResp?.user?.id;
      if (!uid) return;
      const { count: n } = await supabase
        .from("product_recalls")
        .select("*", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("acknowledged", false);
      if (!cancelled) setCount(n ?? 0);
    }

    void refresh();

    const channel = supabase
      .channel("unacked-recalls")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_recalls" },
        () => { void refresh(); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
