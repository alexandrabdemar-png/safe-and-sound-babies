-- Minimal stand-in for Supabase's auth schema, enough to exercise RLS
-- policies locally (auth.uid()/auth.role() driven by GUCs, plus the three
-- Postgres roles Supabase RLS policies are normally written against).
--
-- Not a full Supabase emulation — just enough surface area for policies
-- written as `TO authenticated USING (auth.uid() = user_id)` etc. to behave
-- the same way they do against a real Supabase project.

CREATE SCHEMA IF NOT EXISTS auth;
-- Real Supabase projects always have this schema for extension objects
-- (pg_trgm, pg_net, pg_cron, etc.); vanilla Postgres does not.
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')::text;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- Test helper: switch the simulated session to a given role + user id.
-- Usage: SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');
--        SELECT test.login('anon', NULL);
-- Minimal stand-in for Supabase Storage, enough to exercise storage.objects
-- RLS policies (bucket_id / name / owner + storage.foldername()).
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT SELECT ON storage.buckets TO anon, authenticated, service_role;
GRANT ALL ON storage.objects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;

-- Real implementation returns all path segments except the filename; since
-- policies here only ever index [1], a plain split is equivalent for tests.
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(name, '/'); $$;

-- Project-wide helper defined in an earlier migration
-- (20260607212106_*.sql) that later migrations assume already exists.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE SCHEMA IF NOT EXISTS test;
GRANT USAGE ON SCHEMA test TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION test.login(p_role text, p_uid uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.role', p_role, false);
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_uid::text, ''), false);
  EXECUTE format('SET ROLE %I', p_role);
END;
$$;

CREATE OR REPLACE FUNCTION test.logout() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', '', false);
  PERFORM set_config('request.jwt.claim.sub', '', false);
END;
$$;

-- Assertion helper: raises (aborting the script, since psql is run with
-- ON_ERROR_STOP) on failure, prints a PASS notice on success.
CREATE OR REPLACE FUNCTION test.assert(p_condition boolean, p_message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_condition THEN
    RAISE NOTICE 'PASS: %', p_message;
  ELSE
    RAISE EXCEPTION 'FAIL: %', p_message;
  END IF;
END;
$$;

-- Wraps a statement expected to fail (e.g. blocked by RLS) and turns
-- "it raised" into a pass / "it didn't raise" into a failure.
-- Call as: SELECT test.assert_raises('insert into ...', 'description');
CREATE OR REPLACE FUNCTION test.assert_raises(p_sql text, p_message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'FAIL: % (expected an error, statement succeeded)', p_message;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN
      RAISE;
    END IF;
    RAISE NOTICE 'PASS: % (blocked as expected: %)', p_message, SQLERRM;
END;
$$;
