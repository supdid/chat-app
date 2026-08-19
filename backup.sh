#!/bin/bash
# Backs up valk.db + the three secret/key files to ~/chat-app-backups,
# keeping the 14 most recent snapshots (roughly 2 weeks at one run/day).
set -euo pipefail

SRC="/home/isaac/chat-app"
DEST="/home/isaac/chat-app-backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DEST/$STAMP"

mkdir -p "$OUT"
chmod 700 "$OUT"
# valk.db runs in WAL mode, so a plain `cp` of the main file alone can miss everything sitting
# in valk.db-wal that hasn't been checkpointed yet (in practice this silently produced stale,
# unchanging backups for days). backup-db.js uses better-sqlite3's online backup API instead,
# which correctly merges the WAL and snapshots safely even while the live server keeps writing.
node "$SRC/backup-db.js" "$SRC/valk.db" "$OUT/valk.db" 2>/dev/null || true
cp "$SRC/admin-key.json" "$OUT/" 2>/dev/null || true
cp "$SRC/vapid-keys.json" "$OUT/" 2>/dev/null || true
cp "$SRC/google-config.json" "$OUT/" 2>/dev/null || true
chmod 600 "$OUT"/* 2>/dev/null || true

# Prune to the 14 most recent snapshots.
cd "$DEST"
ls -1d */ 2>/dev/null | sort | head -n -14 | xargs -r rm -rf --
