import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasProSubscription } from "@/lib/serverProGate";

/**
 * Milestone ("moment") logging is a Pro feature, but until now the only
 * check was the client-side useProGate() screen in
 * routes/_authenticated/moments_.new.tsx — the insert itself went straight
 * to `milestones` from the browser, and that table's RLS only checks child
 * access, not subscription state. A free user could log unlimited moments
 * with a direct client call. Routing the write through this server
 * function makes the paywall authoritative, the same way
 * children.functions.ts does for multi-child support.
 *
 * Keeps the icon-column fallback that saveMomentResilient had: some
 * deployments briefly had `milestones.icon` missing from the schema cache,
 * and a hard failure there loses the parent's write for a cosmetic field.
 */
export type SaveMomentInput = {
  child_id: string;
  title: string;
  logged_at: string;
  notes: string | null;
  icon: string;
};

function isIconColumnUnavailable(error: { message?: string } | null): boolean {
  const msg = error?.message?.toLowerCase() ?? "";
  return msg.includes("icon") && (msg.includes("column") || msg.includes("schema cache"));
}

export const saveMoment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SaveMomentInput) => {
    const title = typeof input?.title === "string" ? input.title.trim() : "";
    if (!title) throw new Error("Give the moment a title");
    if (title.length > 120) throw new Error("Title is too long (120 characters max)");
    if (!input?.child_id) throw new Error("Pick a child to log this moment for");
    const notes = input.notes?.trim() ? input.notes.trim() : null;
    if (notes && notes.length > 2000) throw new Error("Notes are too long (2000 characters max)");
    return {
      child_id: input.child_id,
      title,
      logged_at: input.logged_at,
      notes,
      icon: typeof input.icon === "string" ? input.icon.slice(0, 40) : input.icon,
    };
  })

  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!(await hasProSubscription(supabase, userId))) {
      throw new Error("Milestone logging is a Pro feature. Start your free trial to log moments.");
    }

    const payload = { ...data, completed: true };
    let { error } = await supabase.from("milestones").insert(payload as never);
    if (error && isIconColumnUnavailable(error)) {
      const { icon: _icon, ...base } = payload;
      ({ error } = await supabase.from("milestones").insert(base as never));
    }
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
