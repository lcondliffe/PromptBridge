#!/bin/sh
set -eu

# This script ensures the DB schema is applied before starting the app.
# It is safe to run repeatedly; `prisma db push` is idempotent.

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] DATABASE_URL is not set; skipping prisma db push"
else
  echo "[entrypoint] Ensuring database schema via Prisma db push..."
  # Use the Prisma CLI installed in node_modules
  if ! node node_modules/prisma/build/index.js db push --schema packages/api/prisma/schema.prisma; then
    echo "[entrypoint] ERROR: prisma db push failed; exiting." >&2
    exit 1
  fi
  echo "[entrypoint] Schema ensured."
fi

# Exec the container's main command
exec "$@"

