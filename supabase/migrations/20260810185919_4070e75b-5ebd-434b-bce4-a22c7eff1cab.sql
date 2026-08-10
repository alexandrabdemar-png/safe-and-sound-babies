-- generate_milestones_for_child is a SECURITY DEFINER routine that writes
-- milestone rows for an arbitrary child id. It is only ever invoked from the
-- child-creation trigger, never from client code (no .rpc() call site exists),
-- so no signed-in user needs EXECUTE on it. Leaving it callable let any
-- authenticated user seed milestones onto another family's child.
--
-- has_child_access / has_product_access are deliberately left executable by
-- authenticated: they are read-only boolean helpers evaluated inside RLS
-- policies, which run as the querying role and would break without EXECUTE.
REVOKE EXECUTE ON FUNCTION public.generate_milestones_for_child(uuid, date) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_milestones_for_child(uuid, date) TO service_role;
