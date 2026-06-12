REVOKE ALL ON FUNCTION public.generate_milestones_for_child(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_milestones_for_child(uuid, date) TO service_role;