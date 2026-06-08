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
    return {
      exportedAt: new Date().toISOString(),
      userId,
      children: children.data ?? [],
      products: products.data ?? [],
      milestones: milestones.data ?? [],
    };
  });
