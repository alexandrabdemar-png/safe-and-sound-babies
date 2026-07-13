#!/usr/bin/env bash
# Sandbox variant of run_rls_tests.sh — no sudo. Applies auth stub + a
# selected subset of migrations (via -m migration.sql, repeatable), then
# runs the given test files. Selected-subset because a couple of migrations
# require Supabase-only extensions (pg_net, pg_cron) not available here.
set -eo pipefail

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

if [ ${#MIGRATIONS[@]} -eq 0 ]; then
  echo "== applying all migrations (skipping pg_net/pg_cron/pg_trgm CREATE EXTENSION lines) =="
  for M in $(ls "$SCRIPT_DIR/../migrations/"*.sql | sort); do
    # Strip CREATE EXTENSION for extensions not available in the sandbox.
    sed -E "s|^CREATE EXTENSION.*pg_(net|cron|trgm).*;|-- stripped extension|" "$M" \
      | $PSQL -d "$DB" -f - > /tmp/mig_last.log 2>&1 || {
        echo "MIGRATION FAILED: $M"; cat /tmp/mig_last.log; exit 1;
      }
  done
else
  for M in "${MIGRATIONS[@]}"; do
    echo "== applying migration: $M =="
    $PSQL -d "$DB" -f "$M"
  done
fi

STATUS=0
for T in "$@"; do
  echo "== running test: $T =="
  if ! $PSQL -d "$DB" -f "$T"; then STATUS=1; fi
done
exit $STATUS
