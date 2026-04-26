#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/server/.env}"
DB_PORT="${DB_PORT:-3306}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${DB_HOST:?DB_HOST is required}"
: "${DB_USER:?DB_USER is required}"

if ! command -v mysql >/dev/null 2>&1; then
  echo "mysql is required but was not found in PATH." >&2
  exit 1
fi

MYSQL_SSL_ARGS=()
DB_SSL_NORMALIZED="$(printf '%s' "${DB_SSL:-}" | tr '[:upper:]' '[:lower:]')"
if [[ "$DB_SSL_NORMALIZED" =~ ^(1|true|yes|on|required)$ ]]; then
  MYSQL_SSL_ARGS+=(--ssl-mode=REQUIRED)
  if [[ -n "${DB_SSL_CA_FILE:-}" ]]; then
    MYSQL_SSL_ARGS+=(--ssl-ca="$DB_SSL_CA_FILE")
  fi
fi

run_sql_file() {
  local file="$1"
  echo "Running $file"

  if [[ -n "${DB_PASSWORD:-}" ]]; then
    MYSQL_PWD="$DB_PASSWORD" mysql \
      --host="$DB_HOST" \
      --port="$DB_PORT" \
      --user="$DB_USER" \
      "${MYSQL_SSL_ARGS[@]}" \
      < "$file"
  else
    mysql \
      --host="$DB_HOST" \
      --port="$DB_PORT" \
      --user="$DB_USER" \
      "${MYSQL_SSL_ARGS[@]}" \
      < "$file"
  fi
}

for file in "$ROOT_DIR"/database/migrations/*.sql; do
  run_sql_file "$file"
done

for file in "$ROOT_DIR"/database/seeds/*.sql; do
  run_sql_file "$file"
done

echo "Database migration and seed completed."
