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

# Append sslmode to DATABASE_URL if not already present.
# Internal Railway URLs (*.railway.internal) do not use SSL; external/public proxy URLs require it.
if ! echo "$DATABASE_URL" | grep -q "sslmode"; then
  if echo "$DATABASE_URL" | grep -q "railway.internal"; then
    case "$DATABASE_URL" in
      *\?*) export DATABASE_URL="${DATABASE_URL}&sslmode=disable" ;;
      *)    export DATABASE_URL="${DATABASE_URL}?sslmode=disable" ;;
    esac
    echo "Internal Railway URL detected — sslmode=disable appended"
  else
    case "$DATABASE_URL" in
      *\?*) export DATABASE_URL="${DATABASE_URL}&sslmode=require" ;;
      *)    export DATABASE_URL="${DATABASE_URL}?sslmode=require" ;;
    esac
    echo "External URL detected — sslmode=require appended"
  fi
fi

# Run any pending migrations on every startup.
# For PostgreSQL this is safe and idempotent — already-applied migrations are skipped.
echo "Running database migrations..."
npx prisma migrate deploy

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
