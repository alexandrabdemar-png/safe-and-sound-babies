-- Reduces the milestones.icon options from 7 down to 4 (bear/feet/waving
-- removed) per live user feedback, right after the icon column
-- (20260713000000) shipped. No real data risk: the schema-cache lag bug
-- (see moments_.new.tsx) meant no icon writes had actually succeeded in
-- production yet, so there are no existing 'bear'/'feet'/'waving' rows to
-- migrate.
ALTER TABLE public.milestones
  DROP CONSTRAINT IF EXISTS milestones_icon_check;
ALTER TABLE public.milestones
  ADD CONSTRAINT milestones_icon_check
  CHECK (icon IS NULL OR icon IN ('star', 'smiley', 'heart', 'target'));
