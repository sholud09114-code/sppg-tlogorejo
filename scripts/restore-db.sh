#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/server/.env}"
DB_PORT="${DB_PORT:-3306}"

if [[ $# -ne 1 ]]; then
  echo "Usage: ENV_FILE=/path/to/vps.env CONFIRM_RESTORE=yes $0 /path/to/backup.sql" >&2
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${DB_HOST:?DB_HOST is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_NAME:?DB_NAME is required}"

if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "Refusing to restore without CONFIRM_RESTORE=yes." >&2
  echo "This import may drop and replace tables in database: $DB_NAME" >&2
  exit 1
fi

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

echo "Restoring $BACKUP_FILE into $DB_HOST:$DB_PORT/$DB_NAME"

if [[ -n "${DB_PASSWORD:-}" ]]; then
  MYSQL_PWD="$DB_PASSWORD" mysql \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --user="$DB_USER" \
    "${MYSQL_SSL_ARGS[@]}" \
    "$DB_NAME" < "$BACKUP_FILE"
else
  mysql \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --user="$DB_USER" \
    "${MYSQL_SSL_ARGS[@]}" \
    "$DB_NAME" < "$BACKUP_FILE"
fi

echo "Restore completed."
