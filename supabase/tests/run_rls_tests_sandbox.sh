#!/usr/bin/env bash
# Sandbox variant of run_rls_tests.sh: talks to a local Postgres that was
# started as a non-root uid via setpriv (see the harness bootstrap in
# tools chat). Applies the auth stub + every migration in order, then runs
# the given test files.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PGH="/tmp/pgtest_sock"
PGP="54329"
DB="rls_test_$$"

MIGRATIONS=()
while [ "${1:-}" = "-m" ]; do
  MIGRATIONS+=("$2")
  shift 2
done

cleanup() {
  psql -h "$PGH" -p "$PGP" -U postgres -d postgres -c "DROP DATABASE IF EXISTS $DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

PSQL="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"

echo "== creating scratch db $DB =="
$PSQL -d postgres -c "CREATE DATABASE $DB"

echo "== pre-creating supabase roles =="
$PSQL -d "$DB" -c "DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_admin') THEN CREATE ROLE supabase_admin NOLOGIN SUPERUSER; END IF;
END \$\$;"

echo "== applying auth stub =="
$PSQL -d "$DB" -f "$SCRIPT_DIR/_auth_stub.sql"

echo "== applying all migrations =="
for M in $(ls "$SCRIPT_DIR/../migrations/"*.sql | sort); do
  $PSQL -d "$DB" -f "$M" > /tmp/mig_last.log 2>&1 || {
    echo "MIGRATION FAILED: $M"
    cat /tmp/mig_last.log
    exit 1
  }
done

STATUS=0
for T in "$@"; do
  echo "== running test: $T =="
  if ! $PSQL -d "$DB" -f "$T"; then STATUS=1; fi
done
exit $STATUS
