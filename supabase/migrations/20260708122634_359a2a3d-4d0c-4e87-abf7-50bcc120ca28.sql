-- Lock down SECURITY DEFINER function EXECUTE privileges.
-- Trigger-only functions: revoke from PUBLIC, anon, authenticated (triggers run as table owner).
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_default_car_seat_expiration() FROM PUBLIC, anon, authenticated;

-- RLS helper / app-called functions: revoke from PUBLIC and anon; keep authenticated.
REVOKE ALL ON FUNCTION public.has_child_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_child_access(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.has_product_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_product_access(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.generate_milestones_for_child(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_milestones_for_child(uuid, date) TO authenticated;