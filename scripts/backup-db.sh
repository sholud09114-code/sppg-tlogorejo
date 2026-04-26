#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/server/.env}"
BACKUP_DIR="$ROOT_DIR/backups"
DB_PORT="${DB_PORT:-3306}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${DB_HOST:?DB_HOST is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_NAME:?DB_NAME is required}"

if ! command -v mysqldump >/dev/null 2>&1; then
  echo "mysqldump is required but was not found in PATH." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

timestamp="$(date +%Y%m%d-%H%M%S)"
output_file="$BACKUP_DIR/${DB_NAME}_${timestamp}.sql"

if [[ -n "${DB_PASSWORD:-}" ]]; then
  MYSQL_PWD="$DB_PASSWORD" mysqldump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --user="$DB_USER" \
    --single-transaction \
    --routines \
    --triggers \
    "$DB_NAME" > "$output_file"
else
  mysqldump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --user="$DB_USER" \
    --single-transaction \
    --routines \
    --triggers \
    "$DB_NAME" > "$output_file"
fi

echo "Backup written to $output_file"
