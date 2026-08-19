import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasProSubscription } from "@/lib/serverProGate";

/**
 * Free plan tracks one child; adding a 2nd+ is Pro-only. profile.tsx's
 * useProGate() check already blocks this in the UI, but that's
 * client-side only — a free user could otherwise call
 * supabase.from("children").insert(...) directly (the `children` RLS
 * policy only checks `auth.uid() = user_id`, with no subscription
 * condition) and bypass the paywall entirely. Routing the insert through
 * this server function makes the Pro check authoritative.
 */
export const addChild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => {
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    if (!name) throw new Error("Name is required");
    if (name.length > 80) throw new Error("Name is too long (80 characters max)");
    return { name };
  })

  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { count, error: countErr } = await supabase
      .from("children")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (countErr) throw new Error(countErr.message);

    if ((count ?? 0) >= 1 && !(await hasProSubscription(supabase, userId))) {
      throw new Error("Multi-child support is a Pro feature. Upgrade to add another child.");
    }

    const { data: child, error } = await supabase
      .from("children")
      .insert({ user_id: userId, name: data.name })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    return child as { id: string; name: string };
  });
