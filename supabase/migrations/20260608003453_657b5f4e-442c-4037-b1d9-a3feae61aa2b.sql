
GRANT SELECT ON public.recalls TO authenticated;
GRANT ALL ON public.recalls TO service_role;
GRANT SELECT, UPDATE ON public.product_recalls TO authenticated;
GRANT ALL ON public.product_recalls TO service_role;

-- Allow Realtime to broadcast recall matches to the affected user
ALTER TABLE public.product_recalls REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_recalls;
