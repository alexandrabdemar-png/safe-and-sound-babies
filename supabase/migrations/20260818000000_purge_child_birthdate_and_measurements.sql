-- Product/privacy decision: Peace of Mine no longer collects or stores a
-- child's date of birth, gestational/due-date info, or height & weight.
-- "Up next" guidance, product age-appropriateness info, and safety-tip
-- timing are now driven entirely by the developmental milestones a family
-- logs (see src/lib/insights.ts, src/lib/ageAppropriateness.ts) or by a
-- product's own added_at date + the manufacturer's stated replacement
-- interval (src/lib/predictions.ts) — never by the child's age.
--
-- This migration purges the data already collected under the old model and
-- removes the columns/tables/trigger that supported it, so the data is
-- actually gone rather than just unused by the app going forward.

-- ── 1. Drop the cross-column validation trigger on children.due_date /
--       date_of_birth (20260711170444_...sql) before dropping the columns
--       it references. ──────────────────────────────────────────────────
DROP TRIGGER IF EXISTS children_validate_due_date_trg ON public.children;
DROP FUNCTION IF EXISTS public.children_validate_due_date();

-- ── 2. Drop the birthdate/measurement columns from children. Dropping
--       (rather than just nulling) both purges every existing value and
--       guarantees nothing can write to them again. ─────────────────────
ALTER TABLE public.children
  DROP COLUMN IF EXISTS date_of_birth,
  DROP COLUMN IF EXISTS due_date,
  DROP COLUMN IF EXISTS birth_week,
  DROP COLUMN IF EXISTS height_inches,
  DROP COLUMN IF EXISTS weight_lbs,
  DROP COLUMN IF EXISTS measurements_updated_at;

-- ── 3. Drop the per-measurement history tables. Both stored the same
--       child height/weight-over-time data the growth-tracking feature
--       (src/routes/_authenticated/growth.tsx) exposed — that feature has
--       been removed from the app entirely, and growth_logs was already a
--       dead duplicate of child_measurements with zero application code
--       ever reading or writing it. ──────────────────────────────────────
DROP TABLE IF EXISTS public.child_measurements;
DROP TABLE IF EXISTS public.growth_logs;
