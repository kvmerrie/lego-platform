#!/bin/sh
set -eu

PLUGIN_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PARENT_DIR=$(dirname "$PLUGIN_DIR")
OUTPUT="$PARENT_DIR/brickhunt-price-badge.zip"

cd "$PARENT_DIR"
rm -f "$OUTPUT"

zip -r "$OUTPUT" brickhunt-badge \
  -x "brickhunt-badge/package.sh" \
  -x "brickhunt-badge/assets/" \
  -x "brickhunt-badge/assets/*" \
  -x "brickhunt-badge/assets/icon-128x128.png" \
  -x "brickhunt-badge/assets/icon-256x256.png" \
  -x "brickhunt-badge/assets/banner-772x250.png" \
  -x "brickhunt-badge/assets/banner-1544x500.png" \
  -x "brickhunt-badge/assets/screenshot-1.png" \
  -x "brickhunt-badge/assets/screenshot-2.png" \
  -x "brickhunt-badge/assets/screenshot-3.png" \
  -x "brickhunt-badge/assets/screenshot-4.png" \
  -x "brickhunt-badge/assets/screenshot-5.png" \
  -x "*/package.sh" \
  -x "*/.DS_Store" \
  -x "*/__MACOSX/*" \
  -x "*/node_modules/*" \
  -x "*/.git/*" \
  -x "*.zip" \
  -x "*/brickhunt-price-badge.zip" \
  -x "*/wordpress-plugin.zip"

echo "Created $OUTPUT"
