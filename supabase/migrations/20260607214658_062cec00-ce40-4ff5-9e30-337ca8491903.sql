-- Revoke broad execute; only the trigger (runs as table owner) and service_role need it
REVOKE ALL ON FUNCTION public.generate_milestones_for_child(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_milestones_for_child(uuid, date) TO service_role;

REVOKE ALL ON FUNCTION public.on_child_inserted() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.on_child_inserted() TO service_role;