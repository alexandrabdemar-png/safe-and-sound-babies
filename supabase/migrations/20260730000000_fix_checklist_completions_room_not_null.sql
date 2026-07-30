-- checklist_completions has been silently broken since it was first
-- created: migration 20260616120001 created it with a `room text NOT
-- NULL` column and a 3-column UNIQUE(user_id, room, item_key) constraint.
-- A later migration (20260617003218) tried to redefine the table as just
-- (user_id, item_key) — but used a plain `CREATE TABLE` (no
-- `IF NOT EXISTS`), which fails outright with "relation already exists"
-- against the table the first migration had already created, so that
-- redefinition never actually took effect.
--
-- The client (checklists.tsx toggleItem) has only ever called
-- `.upsert({ user_id, item_key })` — it never supplies `room`. Verified
-- against a real Postgres with the live schema: that insert fails with
-- "null value in column room ... violates not-null constraint" every
-- single time. Since toggleItem doesn't check the write's error, a
-- checked-off item looked checked (optimistic UI state) but was never
-- actually saved — reloading the page or coming back later would show it
-- unchecked again.
--
-- item_key values already embed their room as a prefix (lr_, kitchen_,
-- bath_, nursery_, etc. — see checklistsData.ts) and are already globally
-- unique across rooms (enforced by an existing test), so a separate
-- `room` column has never been needed to reconstruct completion state.
-- This migration finishes what 20260617003218 intended to do.
ALTER TABLE public.checklist_completions
  DROP CONSTRAINT IF EXISTS checklist_completions_user_id_room_item_key_key;

ALTER TABLE public.checklist_completions
  DROP COLUMN IF EXISTS room;

ALTER TABLE public.checklist_completions
  ADD CONSTRAINT checklist_completions_user_id_item_key_key UNIQUE (user_id, item_key);
