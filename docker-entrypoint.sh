#!/bin/sh
set -e

CUSTOM_DIR="/app/database/custom"
DEFAULTS_LABELS_DIR="/app/defaults/labels"
CUSTOM_LABELS_DIR="$CUSTOM_DIR/labels"

echo "=== OpenLibry entrypoint ==="

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Add it to your Railway service variables."
  exit 1
fi

echo "DATABASE_URL is set (host: $(echo "$DATABASE_URL" | sed 's|.*@||' | sed 's|/.*||'))"

# Diagnostic: test raw pg connection before Prisma attempts migration.
# This tells us whether the issue is credentials/network (pg fails too)
# or Prisma-specific (pg succeeds but Prisma fails).
echo "=== Diagnostic: testing pg connection ==="
node -e "
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
client.connect()
  .then(() => {
    console.log('pg connect: SUCCESS');
    return client.end();
  })
  .catch(err => {
    console.log('pg connect FAILED — code:', err.code, '| message:', err.message);
  });
" || true
echo "=== End diagnostic ==="

# Run any pending migrations on every startup.
echo "Running database migrations..."
npx prisma migrate deploy

# Ensure cover image storage directory exists (may be a Railway Volume mount)
COVER_DIR="${COVERIMAGE_FILESTORAGE_PATH:-/app/images}"
if [ ! -d "$COVER_DIR" ]; then
  echo "Creating cover image directory at $COVER_DIR ..."
  mkdir -p "$COVER_DIR"
fi

# Ensure the custom templates directory exists
if [ ! -d "$CUSTOM_DIR" ]; then
  echo "Creating custom directory at $CUSTOM_DIR ..."
  mkdir -p "$CUSTOM_DIR"
  echo "Place your guild-specific files here to override defaults." > "$CUSTOM_DIR/README.txt"
fi

# Seed default label sheets into the volume (existing files are never overwritten)
if [ -d "$DEFAULTS_LABELS_DIR" ]; then
  for subdir in sheets templates; do
    mkdir -p "$CUSTOM_LABELS_DIR/$subdir"
    for src in "$DEFAULTS_LABELS_DIR/$subdir"/*.json; do
      [ -f "$src" ] || continue
      dest="$CUSTOM_LABELS_DIR/$subdir/$(basename "$src")"
      if [ ! -f "$dest" ]; then
        cp "$src" "$dest"
        echo "Seeded label file: $dest"
      fi
    done
  done
else
  echo "Warning: defaults labels directory not found — skipping seed."
fi

echo "Custom files in $CUSTOM_DIR:"
ls -1R "$CUSTOM_DIR" 2>/dev/null || echo "(none)"

exec "$@"
