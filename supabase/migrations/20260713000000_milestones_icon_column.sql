-- Adds a dedicated icon column to milestones for the hand-drawn icon picker
-- (bear/feet/waving/star/smiley/heart/target), replacing the old scheme of
-- stuffing a "[First]"/"[Funny]"/"[Milestone]" prefix into the notes text.
-- That prefix scheme had a real bug: it was only ever written when the
-- type was non-default AND notes were non-empty, so the default type was
-- silently indistinguishable from "no type recorded". A real column
-- doesn't have that ambiguity — old rows just get NULL, and the app falls
-- back to inferring an icon from any legacy notes prefix at read time.
ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS icon text;

ALTER TABLE public.milestones
  DROP CONSTRAINT IF EXISTS milestones_icon_check;
ALTER TABLE public.milestones
  ADD CONSTRAINT milestones_icon_check
  CHECK (icon IS NULL OR icon IN ('bear', 'feet', 'waving', 'star', 'smiley', 'heart', 'target'));
