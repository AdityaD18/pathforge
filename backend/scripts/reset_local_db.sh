#!/usr/bin/env bash
# Recreate a LOCAL PostgreSQL database with the Supabase auth stub, all migrations and seed data.
# For local development/tests without the Supabase CLI. Never point this at a hosted project.
#
#   DB_NAME=pathforge PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./scripts/reset_local_db.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DB_NAME="${DB_NAME:-pathforge}"

case "${PGHOST:-localhost}" in
  *supabase.co*|*supabase.com*) echo "Refusing to reset a hosted Supabase database." >&2; exit 1 ;;
esac

psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists \"$DB_NAME\" with (force)" -c "create database \"$DB_NAME\""
run() { psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME" -f "$1"; }

run "$ROOT/backend/tests/sql/supabase_auth_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do run "$f"; done
run "$ROOT/supabase/seed.sql"
echo "Database '$DB_NAME' ready."
