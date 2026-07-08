import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const exportUserData = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [children, products, milestones] = await Promise.all([
      supabase.from('children').select('*').eq('user_id', userId),
      supabase.from('products').select('*').eq('user_id', userId),
      supabase.from('milestones').select('*, children!inner(user_id)').eq('children.user_id', userId),
    ]);
    // A query-level Postgrest error resolves as {data: null, error}, not a
    // rejection — surface it explicitly instead of silently exporting an
    // empty/partial backup for whichever table happened to fail.
    const firstError = children.error ?? products.error ?? milestones.error;
    if (firstError) throw new Error(firstError.message);
    return {
      exportedAt: new Date().toISOString(),
      userId,
      children: children.data ?? [],
      products: products.data ?? [],
      milestones: milestones.data ?? [],
    };
  });
