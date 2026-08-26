#!/bin/bash
# Luna POS — automated backup
# Copies pb_data/ to backups/<timestamp>/
# Keeps only the 7 most recent backups
# Run via launchd daily (see launchd/com.luna.backup.plist)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$ROOT/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DEST="$BACKUP_DIR/$TIMESTAMP"

mkdir -p "$DEST"

# Copy pb_data (SQLite + file storage)
cp -r "$ROOT/pb_data" "$DEST/pb_data"

echo "[$TIMESTAMP] Backup saved to $DEST"

# Prune: keep only the 7 most recent
cd "$BACKUP_DIR"
ls -1dt */ 2>/dev/null | tail -n +8 | xargs -I{} rm -rf "{}"

KEPT=$(ls -1d */ 2>/dev/null | wc -l | tr -d ' ')
echo "[$TIMESTAMP] $KEPT backup(s) retained in $BACKUP_DIR"
