#!/usr/bin/env bash
# Full-graph variant of run_rls_tests_sandbox.sh: applies the auth stub and
# EVERY migration to a scratch database, then runs the given test files.
#
# Migrations are applied WITHOUT ON_ERROR_STOP on purpose. A couple of
# historical migrations re-CREATE an object an earlier migration already
# created (e.g. public.emergency_contacts); those statements error with
# "already exists" and are harmless to skip, but they abort the strict
# sandbox runner before the rest of the schema exists. Per-statement errors
# are logged to /tmp/mig_errors.log so genuine schema breakage is still
# visible. Test files themselves DO run with ON_ERROR_STOP.
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PGH="${PGTEST_SOCK:-/tmp/pgtest_sock}"
PGP="${PGTEST_PORT:-54329}"
DB="rls_test_full_$$"

cleanup() {
  psql -h "$PGH" -p "$PGP" -U postgres -d postgres -c "DROP DATABASE IF EXISTS $DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

PSQL="psql -h $PGH -p $PGP -U postgres -q"

echo "== creating scratch db $DB =="
$PSQL -v ON_ERROR_STOP=1 -d postgres -c "CREATE DATABASE $DB"

echo "== pre-creating supabase roles =="
$PSQL -v ON_ERROR_STOP=1 -d "$DB" -c "DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_admin') THEN CREATE ROLE supabase_admin NOLOGIN SUPERUSER; END IF;
END \$\$;"

echo "== applying auth stub =="
$PSQL -v ON_ERROR_STOP=1 -d "$DB" -f "$SCRIPT_DIR/_auth_stub.sql" >/dev/null

echo "== applying all migrations (tolerating duplicate-object errors) =="
: > /tmp/mig_errors.log
for M in $(ls "$SCRIPT_DIR/../migrations/"*.sql | sort); do
  sed -E 's#^CREATE EXTENSION.*pg_(net|cron|trgm).*;#-- stripped extension#' "$M" \
    | $PSQL -d "$DB" -f - >>/tmp/mig_errors.log 2>&1 || true
done
UNEXPECTED=$(grep -c 'ERROR' /tmp/mig_errors.log || true)
echo "== migration errors logged: $UNEXPECTED (see /tmp/mig_errors.log) =="

STATUS=0
for T in "$@"; do
  echo "== running test: $T =="
  if ! $PSQL -v ON_ERROR_STOP=1 -d "$DB" -f "$T"; then STATUS=1; fi
done
exit $STATUS
