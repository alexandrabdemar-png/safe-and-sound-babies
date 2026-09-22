-- Removes the Emergency Info card feature entirely: the per-child
-- allergies/medications/blood-type/emergency-contact record and its
-- shareable-link mechanism. CASCADE drops each table's policies, triggers,
-- and indexes along with it. The unrelated legacy public.emergency_contacts
-- table (a dead, never-wired-up predecessor) is left untouched.
DROP TABLE IF EXISTS public.emergency_share_links CASCADE;
DROP TABLE IF EXISTS public.emergency_info CASCADE;
