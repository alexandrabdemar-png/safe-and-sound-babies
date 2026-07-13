-- Idempotent: no-op in production (column already present); makes fresh
-- database builds (including local RLS test databases) match production
-- so migration 20260713235422 can validate its policy USING clause.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS photo_url text;