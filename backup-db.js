// Live-safe SQLite backup, used by backup.sh instead of a raw `cp`.
//
// The server runs valk.db in WAL mode, so a plain file copy of valk.db alone can miss
// everything sitting in valk.db-wal that hasn't been checkpointed back into the main file yet
// (in practice, days' worth of writes) — better-sqlite3's built-in .backup() uses SQLite's
// online backup API, which correctly merges the WAL and produces a consistent snapshot even
// while the server keeps writing to the live database.
const path = require('path');
const Database = require('better-sqlite3');

const src = process.argv[2];
const dest = process.argv[3];
if (!src || !dest) {
  console.error('usage: node backup-db.js <src.db> <dest.db>');
  process.exit(1);
}

const db = new Database(path.resolve(src), { readonly: true, fileMustExist: true });
db.backup(path.resolve(dest))
  .then(() => { db.close(); })
  .catch((err) => { console.error('backup failed:', err); db.close(); process.exit(1); });
