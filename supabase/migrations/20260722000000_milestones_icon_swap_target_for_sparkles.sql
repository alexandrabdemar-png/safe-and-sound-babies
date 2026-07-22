-- Replaces the "target" moment icon with "sparkles" (first-time
-- experiences) per updated design direction — the app now offers
-- star/smiley/heart/sparkles. Unlike 20260714000000 (which had the luxury
-- of no real data yet), this feature has been live for a while, so any
-- existing 'target' rows are remapped to 'star' (the default icon) rather
-- than assumed not to exist — the CHECK constraint would otherwise reject
-- the ALTER outright on a database with real 'target' rows in it.
UPDATE public.milestones SET icon = 'star' WHERE icon = 'target';

ALTER TABLE public.milestones
  DROP CONSTRAINT IF EXISTS milestones_icon_check;
ALTER TABLE public.milestones
  ADD CONSTRAINT milestones_icon_check
  CHECK (icon IS NULL OR icon IN ('star', 'smiley', 'heart', 'sparkles'));
