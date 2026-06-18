#!/bin/sh
set -eu

PLUGIN_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PARENT_DIR=$(dirname "$PLUGIN_DIR")
OUTPUT="$PARENT_DIR/brickhunt-price-badge.zip"

cd "$PARENT_DIR"
rm -f "$OUTPUT"

zip -r "$OUTPUT" brickhunt-badge \
  -x "*/.DS_Store" \
  -x "*/__MACOSX/*" \
  -x "*/node_modules/*" \
  -x "*/.git/*" \
  -x "*/brickhunt-price-badge.zip"

echo "Created $OUTPUT"
