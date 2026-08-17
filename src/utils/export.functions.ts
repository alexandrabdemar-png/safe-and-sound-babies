import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const exportUserData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Previously only children/products/milestones — the Privacy Policy
    // promises "a complete JSON export of all their data," but bottles,
    // emergency_info, and first_foods (all personal, some of it health
    // data — allergies, medications, blood type) were silently missing.
    // emergency_info and bottles have their own user_id column;
    // first_foods only has child_id, so it's scoped the same way
    // milestones already was, via the owning child.
    const [children, products, milestones, bottles, emergencyInfo, firstFoods] = await Promise.all([
      supabase.from("children").select("*").eq("user_id", userId),
      supabase.from("products").select("*").eq("user_id", userId),
      supabase
        .from("milestones")
        .select("*, children!inner(user_id)")
        .eq("children.user_id", userId),
      supabase.from("bottles").select("*").eq("user_id", userId),
      supabase.from("emergency_info").select("*").eq("user_id", userId),
      supabase
        .from("first_foods")
        .select("*, children!inner(user_id)")
        .eq("children.user_id", userId),
    ]);
    // A query-level Postgrest error resolves as {data: null, error}, not a
    // rejection — surface it explicitly instead of silently exporting an
    // empty/partial backup for whichever table happened to fail.
    const firstError =
      children.error ??
      products.error ??
      milestones.error ??
      bottles.error ??
      emergencyInfo.error ??
      firstFoods.error;
    if (firstError) throw new Error(firstError.message);
    return {
      exportedAt: new Date().toISOString(),
      userId,
      children: children.data ?? [],
      products: products.data ?? [],
      milestones: milestones.data ?? [],
      bottles: bottles.data ?? [],
      emergencyInfo: emergencyInfo.data ?? [],
      firstFoods: firstFoods.data ?? [],
    };
  });
