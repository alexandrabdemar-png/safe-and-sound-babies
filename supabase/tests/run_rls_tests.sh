#!/usr/bin/env bash
# Spins up a scratch database, applies the auth stub + one or more
# migrations, runs one or more adversarial RLS test files against it, then
# drops the database.
#
# Usage: supabase/tests/run_rls_tests.sh -m migration1.sql [-m migration2.sql ...] test1.sql [test2.sql ...]
#
# Requires a local Postgres server the current user can connect to via the
# `postgres` role (peer/trust auth). Does not touch any real Supabase project.
set -euo pipefail

MIGRATIONS=()
while [ "${1:-}" = "-m" ]; do
  MIGRATIONS+=("$2")
  shift 2
done

if [ "${#MIGRATIONS[@]}" -eq 0 ] || [ "$#" -lt 1 ]; then
  echo "usage: $0 -m migration1.sql [-m migration2.sql ...] test1.sql [test2.sql ...]" >&2
  exit 1
fi

TEST_FILES=("$@")

DB="rls_test_$$"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  sudo -u postgres dropdb --if-exists "$DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "== creating scratch database $DB =="
sudo -u postgres createdb "$DB"

echo "== applying auth stub =="
sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$SCRIPT_DIR/_auth_stub.sql"

for MIGRATION in "${MIGRATIONS[@]}"; do
  echo "== applying migration: $MIGRATION =="
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$MIGRATION"
done

STATUS=0
for TEST_FILE in "${TEST_FILES[@]}"; do
  echo "== running test: $TEST_FILE =="
  if ! sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$TEST_FILE"; then
    STATUS=1
  fi
done

exit $STATUS
