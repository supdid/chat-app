const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'valk.db'));
db.pragma('journal_mode = WAL');

// Schema for the whole feature batch is created up front, even though only
// rooms/messages get populated right away — later phases (reactions, pins,
// read receipts, whiteboard) reuse these tables instead of adding their own.
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    code TEXT PRIMARY KEY,
    name TEXT,
    created_at INTEGER,
    last_active_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    room_code TEXT,
    name TEXT,
    text TEXT,
    media_url TEXT,
    media_type TEXT,
    reply_to_id TEXT,
    at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_messages_room_at ON messages(room_code, at);

  CREATE TABLE IF NOT EXISTS reactions (
    message_id TEXT,
    emoji TEXT,
    name TEXT,
    at INTEGER,
    PRIMARY KEY (message_id, emoji, name)
  );

  CREATE TABLE IF NOT EXISTS pins (
    room_code TEXT PRIMARY KEY,
    message_id TEXT,
    pinned_by TEXT,
    at INTEGER
  );

  CREATE TABLE IF NOT EXISTS read_receipts (
    room_code TEXT,
    name TEXT,
    last_read_message_id TEXT,
    at INTEGER,
    PRIMARY KEY (room_code, name)
  );

  CREATE TABLE IF NOT EXISTS whiteboard_strokes (
    id TEXT PRIMARY KEY,
    room_code TEXT,
    stroke_json TEXT,
    at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_wb_room ON whiteboard_strokes(room_code);

  CREATE TABLE IF NOT EXISTS bc_worlds (
    room_code TEXT PRIMARY KEY,
    seed INTEGER,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS bc_overrides (
    room_code TEXT,
    cell_key TEXT,
    type INTEGER,
    PRIMARY KEY (room_code, cell_key)
  );

  -- Land claims (see server.js's BC_MAX_CLAIMS_PER_PLAYER) -- previously in-memory only
  -- (room.bc.claims), which silently vanished the moment a Build Craft room emptied out (unlike
  -- world overrides, which persist here) since a fresh bc-join always rehydrates from bc_worlds/
  -- bc_overrides but had nothing to load claims back from. No unclaim exists (claims are purely
  -- additive, capped per player), so no id/removal machinery is needed here.
  CREATE TABLE IF NOT EXISTS bc_claims (
    room_code TEXT,
    x INTEGER,
    z INTEGER,
    radius INTEGER,
    owner TEXT,
    created_at INTEGER
  );

  -- Every sibling per-room table gets room_code as a PK prefix or an explicit index (see
  -- idx_wb_room, idx_blueprints_room, idx_room_bans_room, ...) — this one was missed, so
  -- getBcClaims/deleteBcClaims (called on bc-join, a hot path) full-scanned the entire
  -- cross-room table instead of an indexed lookup.
  CREATE INDEX IF NOT EXISTS idx_bc_claims_room ON bc_claims(room_code);

  CREATE TABLE IF NOT EXISTS profiles (
    name TEXT PRIMARY KEY,
    avatar_url TEXT,
    status TEXT,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS leaderboard (
    room_code TEXT,
    game TEXT,
    name TEXT,
    score INTEGER,
    updated_at INTEGER,
    PRIMARY KEY (room_code, game, name)
  );

  -- Firefight weapon-unlock progress. Deliberately separate from the generic leaderboard table
  -- above: that one only ever keeps the best score a name has achieved (a high-score board), not
  -- a running total, so it can't answer "how many kills has this player earned, ever" — exactly
  -- what unlocking weapons needs. total_kills only ever increases (see bumpFgKills in server.js's
  -- call site), one row per (room, name), same identity convention every other per-room stat here
  -- already uses.
  CREATE TABLE IF NOT EXISTS fg_stats (
    room_code TEXT,
    name TEXT,
    total_kills INTEGER DEFAULT 0,
    updated_at INTEGER,
    PRIMARY KEY (room_code, name)
  );

  CREATE TABLE IF NOT EXISTS bc_blueprints (
    id TEXT PRIMARY KEY,
    room_code TEXT,
    name TEXT,
    author TEXT,
    size_x INTEGER,
    size_y INTEGER,
    size_z INTEGER,
    blocks_json TEXT,
    created_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_blueprints_room ON bc_blueprints(room_code);
`);

// Idempotent column additions for tables that already existed before this feature —
// CREATE TABLE IF NOT EXISTS above won't add columns to a table that's already on disk from
// an earlier run, so new columns on existing tables go through this instead.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn('messages', 'edited', 'INTEGER DEFAULT 0');
ensureColumn('messages', 'deleted', 'INTEGER DEFAULT 0');
// See insertMessage's comment — a signed-in poster's account_id, not just their display name.
ensureColumn('messages', 'account_id', 'TEXT');
ensureColumn('rooms', 'host_name', 'TEXT');
ensureColumn('rooms', 'host_account_id', 'TEXT');
ensureColumn('rooms', 'announcement', 'TEXT');
ensureColumn('rooms', 'pin_required', 'TEXT');
ensureColumn('rooms', 'wallpaper_url', 'TEXT');
// Land claims were keyed purely by display name (owner) — two players sharing a name (plausible
// with the default "Player" or common names) treated each other's claims as their own. New claims
// also get a stable per-browser owner_id; existing pre-migration rows keep owner_id NULL and fall
// back to the old name-based check (see isClaimedByOther in server.js), so nothing already placed
// silently loses its protection.
ensureColumn('bc_claims', 'owner_id', 'TEXT');
// Found by an unbounded-memory-growth audit: bc_overrides had no cap and no timestamp column to
// even evict by — see BC_MAX_OVERRIDES in server.js and setBcOverrides below. Existing
// pre-migration rows get NULL here, which sorts before every real timestamp in ORDER BY ... ASC,
// so they're evicted first if a cap-trim is ever needed on an old install — a reasonable default
// (they're the oldest changes anyway) needing no backfill.
ensureColumn('bc_overrides', 'updated_at', 'INTEGER');

// One-time migration: pins used to be single-pin-per-room (PK: room_code) — multi-pin needs a
// composite PK (room_code, message_id) instead, which ALTER TABLE can't change in place.
// Guarded by checking the actual PK columns on disk so this only ever runs once — but that guard
// only protects against re-running a *completed* migration, not a crash *during* one. This isn't
// only a legacy-upgrade path either: the CREATE TABLE IF NOT EXISTS above always creates pins with
// the old single-column PK, so this block runs on every brand-new database too, including every
// disposable instance the test suite spins up. Wrapped in an explicit transaction (SQLite allows
// DDL inside one) so a crash between any of these four statements can't leave the table renamed
// away with no replacement — either the whole reshape lands, or none of it does, and the next boot
// finds pins exactly as it left it.
{
  const pinsInfo = db.prepare('PRAGMA table_info(pins)').all();
  const pinsHasCompositeKey = pinsInfo.filter((c) => c.pk > 0).length > 1;
  if (!pinsHasCompositeKey) {
    db.exec(`
      BEGIN;
      ALTER TABLE pins RENAME TO pins_old;
      CREATE TABLE pins (
        room_code TEXT,
        message_id TEXT,
        pinned_by TEXT,
        at INTEGER,
        PRIMARY KEY (room_code, message_id)
      );
      INSERT INTO pins (room_code, message_id, pinned_by, at) SELECT room_code, message_id, pinned_by, at FROM pins_old;
      DROP TABLE pins_old;
      COMMIT;
    `);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS poll_votes (
    message_id TEXT,
    name TEXT,
    option_index INTEGER,
    PRIMARY KEY (message_id, name)
  );

  CREATE TABLE IF NOT EXISTS dms (
    id TEXT PRIMARY KEY,
    room_code TEXT,
    from_name TEXT,
    to_name TEXT,
    text TEXT,
    at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_dms_room_pair ON dms(room_code, from_name, to_name);

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    room_code TEXT,
    name TEXT,
    subscription_json TEXT,
    at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_push_room ON push_subscriptions(room_code);

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE COLLATE NOCASE,
    password_hash TEXT,
    salt TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    account_id TEXT,
    created_at INTEGER,
    last_seen_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);

  -- One row per (requester, addressee) pair. status is 'pending' (requester asked, not yet
  -- accepted), 'accepted' (mutual friends — the pair reads the same regardless of who initiated),
  -- or 'blocked' (requester has blocked addressee; direction matters here, unlike accepted).
  CREATE TABLE IF NOT EXISTS friendships (
    requester_id TEXT,
    addressee_id TEXT,
    status TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    PRIMARY KEY (requester_id, addressee_id)
  );
  CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id, status);
  CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id, status);

  CREATE TABLE IF NOT EXISTS account_recent_rooms (
    account_id TEXT,
    room_code TEXT,
    room_name TEXT,
    at INTEGER,
    PRIMARY KEY (account_id, room_code)
  );
  CREATE INDEX IF NOT EXISTS idx_account_recent_rooms ON account_recent_rooms(account_id, at);

  -- Group DMs are account-id based (unlike the room-scoped 'dms' table above, which is keyed
  -- by ephemeral display names) so membership and history stay valid across renames and survive
  -- independent of anyone being currently connected to a room.
  CREATE TABLE IF NOT EXISTS group_dms (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_by TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS group_dm_members (
    group_id TEXT,
    account_id TEXT,
    joined_at INTEGER,
    PRIMARY KEY (group_id, account_id)
  );
  CREATE INDEX IF NOT EXISTS idx_group_dm_members_account ON group_dm_members(account_id);

  CREATE TABLE IF NOT EXISTS group_dm_messages (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    from_account_id TEXT,
    from_name TEXT,
    text TEXT,
    at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_group_dm_messages_group ON group_dm_messages(group_id, at);

  CREATE TABLE IF NOT EXISTS error_reports (
    id TEXT PRIMARY KEY,
    source TEXT,
    message TEXT,
    stack TEXT,
    context_json TEXT,
    status TEXT DEFAULT 'new',
    created_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_error_reports_status ON error_reports(status, created_at);

  CREATE TABLE IF NOT EXISTS patch_proposals (
    id TEXT PRIMARY KEY,
    error_report_id TEXT,
    target_file TEXT,
    old_string TEXT,
    new_string TEXT,
    explanation TEXT,
    status TEXT DEFAULT 'pending',
    created_at INTEGER,
    decided_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_patch_proposals_status ON patch_proposals(status, created_at);

  -- Scorpture (account-based video sharing app, standalone from the room system — videos aren't
  -- scoped to a room_code at all, just to the uploader's account, same as friendships).
  CREATE TABLE IF NOT EXISTS scorpture_videos (
    id TEXT PRIMARY KEY,
    uploader_id TEXT,
    uploader_username TEXT,
    title TEXT,
    description TEXT,
    video_url TEXT,
    thumbnail_url TEXT,
    views INTEGER DEFAULT 0,
    created_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_scorpture_videos_created ON scorpture_videos(created_at);
  CREATE INDEX IF NOT EXISTS idx_scorpture_videos_uploader ON scorpture_videos(uploader_id);

  CREATE TABLE IF NOT EXISTS scorpture_comments (
    id TEXT PRIMARY KEY,
    video_id TEXT,
    account_id TEXT,
    username TEXT,
    text TEXT,
    created_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_scorpture_comments_video ON scorpture_comments(video_id, created_at);

  CREATE TABLE IF NOT EXISTS scorpture_likes (
    video_id TEXT,
    account_id TEXT,
    created_at INTEGER,
    PRIMARY KEY (video_id, account_id)
  );

  CREATE TABLE IF NOT EXISTS scorpture_subscriptions (
    subscriber_id TEXT,
    channel_id TEXT,
    created_at INTEGER,
    PRIMARY KEY (subscriber_id, channel_id)
  );
  CREATE INDEX IF NOT EXISTS idx_scorpture_subs_channel ON scorpture_subscriptions(channel_id);

  -- Abuse reports (message or user), reviewed in the admin panel alongside error_reports/patch
  -- proposals — same "logged, nothing auto-acted-on, a human decides" shape as the self-healing
  -- pipeline, just for people-moderation instead of code-moderation.
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    room_code TEXT,
    reporter_name TEXT,
    reporter_account_id TEXT,
    target_name TEXT,
    message_id TEXT,
    message_text TEXT,
    reason TEXT,
    status TEXT DEFAULT 'new',
    created_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);

  -- Persistent mute, keyed by account when the muted person is signed in so it survives a
  -- restart and re-applies even if they rejoin the room under a different display name.
  -- Anonymous (no-account) mutes stay purely in-memory (room.muted Set in server.js), same as
  -- before this table existed — there's no stable identity to persist them against.
  CREATE TABLE IF NOT EXISTS room_mutes (
    room_code TEXT,
    target_account_id TEXT,
    target_name TEXT,
    muted_by TEXT,
    created_at INTEGER,
    PRIMARY KEY (room_code, target_account_id)
  );

  -- Bans a person from rejoining a room outright (kick-user only disconnects them once).
  -- Same account-vs-name split as room_mutes: an account-keyed row is real enforcement (checked
  -- on join-room regardless of display name), a name-only row (target_account_id NULL, for an
  -- anonymous target) is the same "weak by design" trust level as kick/host powers already are
  -- elsewhere in this codebase — trivially dodged by picking a new name, but stops casual
  -- re-entry. id is a real primary key (not room+account) so anonymous name-bans, which can't
  -- rely on a unique account_id, don't collide with each other.
  CREATE TABLE IF NOT EXISTS room_bans (
    id TEXT PRIMARY KEY,
    room_code TEXT,
    target_account_id TEXT,
    target_name TEXT,
    banned_by TEXT,
    created_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_room_bans_room ON room_bans(room_code);

  -- Lets an admin (bearer admin-key.json, no account system of its own) opt a device into push
  -- notifications for new reports — separate from the per-account push_subscriptions table since
  -- there's no account to key it on, just possession of the admin key at subscribe time.
  CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    subscription_json TEXT,
    created_at INTEGER
  );

  -- Scorpture (account-based, not room-scoped — see scorpture_videos comment above) equivalent
  -- of the chat reports table.
  CREATE TABLE IF NOT EXISTS scorpture_reports (
    id TEXT PRIMARY KEY,
    video_id TEXT,
    reporter_account_id TEXT,
    reporter_username TEXT,
    uploader_username TEXT,
    reason TEXT,
    status TEXT DEFAULT 'new',
    created_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_scorpture_reports_status ON scorpture_reports(status, created_at);
`);

// These three ensureColumn calls (and the indexes below) reference the accounts/push_subscriptions
// tables created in the db.exec() block just above — must run after it, not before, or a
// brand-new database (no accounts table on disk yet) throws "no such table: accounts".
ensureColumn('accounts', 'email', 'TEXT');
ensureColumn('accounts', 'google_id', 'TEXT');
ensureColumn('accounts', 'scorpture_banner_url', 'TEXT');
ensureColumn('accounts', 'scorpture_avatar_url', 'TEXT');
ensureColumn('accounts', 'scorpture_description', 'TEXT');
ensureColumn('accounts', 'scorpture_bonus_subscribers', 'INTEGER DEFAULT 0');
ensureColumn('accounts', 'scorpture_overlay_json', 'TEXT');
ensureColumn('scorpture_comments', 'edited', 'INTEGER DEFAULT 0');
ensureColumn('dms', 'from_account_id', 'TEXT');
ensureColumn('dms', 'to_account_id', 'TEXT');
ensureColumn('scorpture_videos', 'category', 'TEXT');
ensureColumn('push_subscriptions', 'account_id', 'TEXT');
// Was a UNIQUE index (one account per email) — relaxed to allow up to MAX_ACCOUNTS_PER_EMAIL
// (see server.js signup handler) accounts sharing one email, so drop the old unique index
// before recreating it as a plain lookup index; on a fresh DB the DROP is a harmless no-op.
db.exec('DROP INDEX IF EXISTS idx_accounts_email');
db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email COLLATE NOCASE) WHERE email IS NOT NULL');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_google_id ON accounts(google_id) WHERE google_id IS NOT NULL');
db.exec('CREATE INDEX IF NOT EXISTS idx_push_account ON push_subscriptions(account_id)');

// ---- direct messages (per-room, between two display names) ----

function insertDm(entry) {
  db.prepare(
    `INSERT INTO dms (id, room_code, from_name, to_name, text, at, from_account_id, to_account_id)
     VALUES (@id, @roomCode, @fromName, @toName, @text, @at, @fromAccountId, @toAccountId)`
  ).run({ ...entry, fromAccountId: entry.fromAccountId || null, toAccountId: entry.toAccountId || null });
}

// nameA is always "the requester" here (see get-dm-thread) — requesterAccountId is whoever is
// actually asking right now. Display names have no persistent identity (see insertMessage's
// account_id comment for the same issue), so someone who reconnects under a name a signed-in
// account previously used in this thread must not be able to read that account's side of it
// just by matching the name. A row is only excluded when its "requester side" was posted by a
// *different* signed-in account than the one asking now — anonymous-only threads (both sides
// never signed in) are untouched, exactly as name-based as they always were.
function getDmThread(code, nameA, nameB, requesterAccountId, limit = 200) {
  // DESC + reverse, not a direct ASC query — same reasoning as getRecentMessages above: LIMIT on
  // an ASC-ordered query keeps the OLDEST rows, not the most recent ones. A thread past `limit`
  // messages would otherwise be stuck showing only its ancient beginning forever on every reload,
  // silently hiding everything sent more recently (this was live for a while before being caught).
  const rows = db
    .prepare(
      `SELECT * FROM dms WHERE room_code = ? AND ((from_name = ? AND to_name = ?) OR (from_name = ? AND to_name = ?)) ORDER BY at DESC LIMIT ?`
    )
    .all(code, nameA, nameB, nameB, nameA, limit)
    .reverse();
  return rows
    .filter((r) => {
      const requesterSideAccountId = r.from_name === nameA ? r.from_account_id : r.to_account_id;
      return !requesterSideAccountId || requesterSideAccountId === requesterAccountId;
    })
    .map((r) => ({ id: r.id, fromName: r.from_name, toName: r.to_name, text: r.text, at: r.at }));
}

// ---- rooms ----

function upsertRoom(code, name) {
  const now = Date.now();
  const existing = db.prepare('SELECT code FROM rooms WHERE code = ?').get(code);
  if (existing) {
    if (name !== undefined) {
      db.prepare('UPDATE rooms SET name = ?, last_active_at = ? WHERE code = ?').run(name, now, code);
    } else {
      db.prepare('UPDATE rooms SET last_active_at = ? WHERE code = ?').run(now, code);
    }
  } else {
    db.prepare('INSERT INTO rooms (code, name, created_at, last_active_at) VALUES (?, ?, ?, ?)').run(
      code,
      name || null,
      now,
      now
    );
  }
}

function getRoom(code) {
  return db.prepare('SELECT * FROM rooms WHERE code = ?').get(code) || null;
}

// Set only the first time a room gets a host (room creation) — never overwritten by a later
// upsertRoom call (e.g. renaming), so the host stays whoever actually created the room.
// accountId (when the creator was signed in) is stored alongside host_name so authorization can be
// checked against a durable identity instead of the display-name string alone — see
// isRoomHost/the host-identity-spoofing audit note in server.js for why host_name alone isn't
// enough: it's client-supplied and has no uniqueness enforcement, so anyone who types the exact
// same display name as the host would otherwise pass a host_name-only check.
function setRoomHostIfUnset(code, name, accountId = null) {
  db.prepare("UPDATE rooms SET host_name = ?, host_account_id = ? WHERE code = ? AND (host_name IS NULL OR host_name = '')").run(name, accountId, code);
}

// Keeps host privileges attached to whoever the host actually is across a display-name rename
// (see 'set-name' in server.js). When the host is signed in, host_account_id is the real
// authorization key (see isRoomHost in server.js) — host_name is then just a display value, so
// this updates it across every room that account hosts, not only the room the rename happened in
// (previously scoped to one room via a code+oldName match, which left every OTHER room that
// account hosts pointing at a now-stale host_name, locking the real host out of it and leaving it
// squattable by name). A guest host (no accountId) has no durable identity to key off, so falls
// back to the original room-scoped, exact-name-match update — unavoidable given no account exists,
// same accepted trust model as everywhere else guest identity is handled in this app.
function renameRoomHostIfMatches(code, oldName, newName, accountId = null) {
  if (accountId) {
    db.prepare('UPDATE rooms SET host_name = ? WHERE host_account_id = ?').run(newName, accountId);
  } else {
    db.prepare('UPDATE rooms SET host_name = ? WHERE code = ? AND host_name = ?').run(newName, code, oldName);
  }
}

function setAnnouncement(code, text) {
  db.prepare('UPDATE rooms SET announcement = ? WHERE code = ?').run(text || null, code);
}

function setRoomPin(code, pin) {
  db.prepare('UPDATE rooms SET pin_required = ? WHERE code = ?').run(pin || null, code);
}

function setWallpaper(code, url) {
  db.prepare('UPDATE rooms SET wallpaper_url = ? WHERE code = ?').run(url || null, code);
}

// ---- messages ----

function insertMessage(entry) {
  db.prepare(
    `INSERT INTO messages (id, room_code, name, text, media_url, media_type, reply_to_id, at, account_id)
     VALUES (@id, @roomCode, @name, @text, @mediaUrl, @mediaType, @replyToId, @at, @accountId)`
  ).run({
    id: entry.id,
    roomCode: entry.roomCode,
    name: entry.name,
    text: entry.text || '',
    mediaUrl: entry.mediaUrl || null,
    mediaType: entry.mediaType || null,
    replyToId: entry.replyToId || null,
    at: entry.at,
    // Display names are just a self-reported string with no persistent identity — a signed-in
    // poster's own account_id is a much sturdier "who actually owns this" check than name alone,
    // since a name can be picked up by someone else the moment the original holder disconnects
    // (see edit-message/delete-message's use of this column). Null for anonymous posters, who
    // have no such identity to bind to — unchanged, name-only behavior for them.
    accountId: entry.accountId || null,
  });
}

function getMessage(id) {
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id) || null;
}

function updateMessageText(id, text) {
  db.prepare('UPDATE messages SET text = ?, edited = 1 WHERE id = ?').run(text, id);
}

// Soft delete — the row stays (reactions, pins, and reply-quotes all reference the message id)
// but its content is cleared and flagged, same idea as every chat app's "message was deleted".
function deleteMessageRow(id) {
  db.prepare("UPDATE messages SET text = '', media_url = NULL, media_type = NULL, deleted = 1 WHERE id = ?").run(id);
}

// `, rowid DESC` breaks ties deterministically when two messages land in the same millisecond
// (plausible under rapid sends — this table has no INTEGER PRIMARY KEY, so SQLite's own implicit
// rowid is a real, independent, monotonically-increasing insertion-order column here) — without
// it, `ORDER BY at DESC` alone leaves tied rows in SQLite's own implementation-defined order,
// which isn't guaranteed stable across calls. This alone doesn't fully close the gap in
// getMessagesBefore below (see its own comment) but keeps this function's own output consistent.
function getRecentMessages(code, limit) {
  const rows = db
    .prepare('SELECT * FROM messages WHERE room_code = ? ORDER BY at DESC, rowid DESC LIMIT ?')
    .all(code, limit);
  return rows.reverse().map(rowToHistoryEntry);
}

// Paginated backward scroll — getRecentMessages only ever returns the newest `limit` messages,
// with no way to reach anything older once that window's been shown. beforeAt is the `at`
// timestamp of the oldest message currently rendered on the client; strictly-less-than so the
// boundary message itself isn't returned twice.
// Known gap: the cursor is a bare timestamp with no tiebreaker, so if the boundary message shares
// its exact millisecond with another message, that other message is silently excluded here (falls
// on the wrong side of `at < beforeAt`) even though it's chronologically tied with what's already
// shown. A fully correct fix needs the client to pass a compound cursor (at + the boundary
// message's own id) instead of a bare timestamp — not done here because, as of this writing, no
// client anywhere actually calls load-older-messages (grepped all of public/*.js) to begin with;
// revisit this gap for real if that ever changes.
function getMessagesBefore(code, beforeAt, limit) {
  const rows = db
    .prepare('SELECT * FROM messages WHERE room_code = ? AND at < ? ORDER BY at DESC, rowid DESC LIMIT ?')
    .all(code, beforeAt, limit);
  return rows.reverse().map(rowToHistoryEntry);
}

function getAllMessagesForExport(code) {
  return db.prepare('SELECT * FROM messages WHERE room_code = ? ORDER BY at ASC').all(code).map(rowToHistoryEntry);
}

function searchMessages(code, query, limit) {
  const rows = db
    .prepare(
      `SELECT * FROM messages WHERE room_code = ? AND text LIKE ? COLLATE NOCASE
       ORDER BY at DESC LIMIT ?`
    )
    .all(code, `%${query}%`, limit);
  return rows.map((r) => ({ id: r.id, name: r.name, text: r.text, at: r.at }));
}

function rowToHistoryEntry(r) {
  return {
    type: 'message',
    id: r.id,
    name: r.name,
    text: r.text,
    mediaUrl: r.media_url,
    mediaType: r.media_type,
    replyToId: r.reply_to_id || null,
    at: r.at,
    edited: !!r.edited,
    deleted: !!r.deleted,
  };
}

// ---- reactions ----

function toggleReaction(messageId, emoji, name) {
  const existing = db
    .prepare('SELECT 1 FROM reactions WHERE message_id = ? AND emoji = ? AND name = ?')
    .get(messageId, emoji, name);
  if (existing) {
    db.prepare('DELETE FROM reactions WHERE message_id = ? AND emoji = ? AND name = ?').run(messageId, emoji, name);
    return false;
  }
  db.prepare('INSERT INTO reactions (message_id, emoji, name, at) VALUES (?, ?, ?, ?)').run(
    messageId,
    emoji,
    name,
    Date.now()
  );
  return true;
}

// Capped to the same window as getRecentMessages (the only messages actually ever rendered
// client-side on join) — this used to join against the room's entire all-time message history
// with no limit, so a long-running room's join cost (and payload size) grew forever even though
// reactions on messages outside the visible window are never shown anyway.
function getReactionsForRoom(code, limit) {
  return db
    .prepare(
      `SELECT r.message_id as messageId, r.emoji, r.name FROM reactions r
       WHERE r.message_id IN (SELECT id FROM messages WHERE room_code = ? ORDER BY at DESC LIMIT ?)`
    )
    .all(code, limit);
}

// ---- pins ----
// Multiple pins per room (composite PK) — see the pins table migration near ensureColumn.

// Found by an unbounded-memory-growth audit: any room member (not just the host) can pin, and
// this had no cap at all — getPins' own JOIN query and the full pins-list broadcast/rehydration-
// on-join it feeds both scale with every pin ever placed in a room's lifetime, with no eviction.
// Same "bounded history, oldest evicted" tradeoff already accepted for whiteboard/Pictionary
// strokes and (this same audit) Build Craft overrides — growth here is at ordinary chat-message
// speed (pin-message already shares isWsMsgRateLimited with every other content-mutating path),
// so this is a much slower-growing gap than those, but still genuinely unbounded without this.
const MAX_PINS_PER_ROOM = 200;
function setPin(code, messageId, pinnedBy) {
  db.prepare('INSERT OR REPLACE INTO pins (room_code, message_id, pinned_by, at) VALUES (?, ?, ?, ?)').run(
    code,
    messageId,
    pinnedBy,
    Date.now()
  );
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM pins WHERE room_code = ?').get(code);
  if (n > MAX_PINS_PER_ROOM) {
    db.prepare(
      `DELETE FROM pins WHERE room_code = ? AND message_id IN (
         SELECT message_id FROM pins WHERE room_code = ? ORDER BY at ASC LIMIT ?
       )`
    ).run(code, code, n - MAX_PINS_PER_ROOM);
  }
}

function unpinMessage(code, messageId) {
  db.prepare('DELETE FROM pins WHERE room_code = ? AND message_id = ?').run(code, messageId);
}

// Was one getMessage() point-query per pin (N+1) — this runs on every join-room AND every
// pin/unpin broadcast to the whole room, with no cap on how many messages a room can have
// pinned (any member can pin, not just the host). A single JOIN replaces N+1 queries with 1;
// the INNER JOIN naturally drops a pin whose message row is missing, same as the old
// .filter(Boolean) did (soft-deleted messages still have a row, so this only ever excludes a
// pin whose message was somehow hard-removed).
function getPins(code) {
  const rows = db
    .prepare(
      `SELECT m.*, p.pinned_by as pinnedBy FROM pins p
       JOIN messages m ON m.id = p.message_id
       WHERE p.room_code = ? ORDER BY p.at ASC`
    )
    .all(code);
  return rows.map((r) => ({ pinnedBy: r.pinnedBy, message: rowToHistoryEntry(r) }));
}

// ---- read receipts ----

function setReadReceipt(code, name, messageId) {
  db.prepare(
    `INSERT INTO read_receipts (room_code, name, last_read_message_id, at) VALUES (?, ?, ?, ?)
     ON CONFLICT(room_code, name) DO UPDATE SET last_read_message_id = excluded.last_read_message_id, at = excluded.at`
  ).run(code, name, messageId, Date.now());
}

function getReadReceipts(code) {
  return db.prepare('SELECT name, last_read_message_id as messageId FROM read_receipts WHERE room_code = ?').all(code);
}

// ---- whiteboard ----

// Matches the in-memory room.wb.strokes cap in server.js (3000) — that cap only ever trimmed
// the in-memory copy, so a long-lived active room's DB rows grew unbounded (the 90-day-inactivity
// purge never reaches a room still in regular use) and a fresh rehydration (server restart, or a
// room reload after being evicted by the activity sweep) re-sent the *entire* unbounded history.
const WB_STROKE_DB_CAP = 3000;
function insertStroke(code, stroke) {
  db.prepare('INSERT INTO whiteboard_strokes (id, room_code, stroke_json, at) VALUES (?, ?, ?, ?)').run(
    stroke.id,
    code,
    JSON.stringify(stroke),
    Date.now()
  );
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM whiteboard_strokes WHERE room_code = ?').get(code);
  if (n > WB_STROKE_DB_CAP) {
    db.prepare(
      `DELETE FROM whiteboard_strokes WHERE room_code = ? AND id IN (
         SELECT id FROM whiteboard_strokes WHERE room_code = ? ORDER BY at ASC LIMIT ?
       )`
    ).run(code, code, n - WB_STROKE_DB_CAP);
  }
}

function getWhiteboardStrokes(code) {
  const rows = db.prepare('SELECT stroke_json FROM whiteboard_strokes WHERE room_code = ? ORDER BY at DESC LIMIT ?').all(code, WB_STROKE_DB_CAP);
  return rows.map((r) => JSON.parse(r.stroke_json)).reverse();
}

function clearStrokes(code) {
  db.prepare('DELETE FROM whiteboard_strokes WHERE room_code = ?').run(code);
}

// ---- Build Craft worlds (seed + per-cell block overrides) ----

function getBcWorld(code) {
  return db.prepare('SELECT * FROM bc_worlds WHERE room_code = ?').get(code) || null;
}

function createBcWorld(code, seed) {
  db.prepare('INSERT OR IGNORE INTO bc_worlds (room_code, seed, created_at) VALUES (?, ?, ?)').run(code, seed, Date.now());
}

const setBcOverrideStmt = db.prepare(
  `INSERT INTO bc_overrides (room_code, cell_key, type, updated_at) VALUES (?, ?, ?, ?)
   ON CONFLICT(room_code, cell_key) DO UPDATE SET type = excluded.type, updated_at = excluded.updated_at`
);
// Building/mining can send up to a couple thousand cell changes in a single batch (e.g. a
// cave-in) — wrapped in one transaction so that doesn't become a couple thousand separate disk syncs.
const setBcOverridesBulk = db.transaction((code, entries, now) => {
  for (const [key, type] of entries) setBcOverrideStmt.run(code, key, type, now);
});

// BC_MAX_OVERRIDES (server.js) is enforced in-memory per bc-block call already — this mirrors the
// same cap here so a room that empties out and later reloads from disk (getBcOverrides below)
// can't resurrect the unbounded pre-cap history the in-memory eviction already trimmed away.
const BC_OVERRIDES_DB_CAP = 50000;
function setBcOverrides(code, entries) {
  if (!entries.length) return;
  setBcOverridesBulk(code, entries, Date.now());
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM bc_overrides WHERE room_code = ?').get(code);
  if (n > BC_OVERRIDES_DB_CAP) {
    db.prepare(
      `DELETE FROM bc_overrides WHERE room_code = ? AND cell_key IN (
         SELECT cell_key FROM bc_overrides WHERE room_code = ? ORDER BY updated_at ASC LIMIT ?
       )`
    ).run(code, code, n - BC_OVERRIDES_DB_CAP);
  }
}

function getBcOverrides(code) {
  return db
    .prepare('SELECT cell_key, type FROM bc_overrides WHERE room_code = ?')
    .all(code)
    .map((r) => [r.cell_key, r.type]);
}

function addBcClaim(code, x, z, radius, owner, ownerId) {
  db.prepare('INSERT INTO bc_claims (room_code, x, z, radius, owner, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(code, x, z, radius, owner, ownerId || null, Date.now());
}

function getBcClaims(code) {
  return db.prepare('SELECT x, z, radius, owner, owner_id AS ownerId FROM bc_claims WHERE room_code = ?').all(code);
}

// ---- Profiles (avatar + status, keyed by display name like rooms are keyed by code — this
// app has no accounts, so "the same name" is the closest thing to an identity to hang these on) ----

function getProfile(name) {
  return db.prepare('SELECT * FROM profiles WHERE name = ?').get(name) || null;
}

function upsertProfile(name, { avatarUrl, status }) {
  db.prepare(
    `INSERT INTO profiles (name, avatar_url, status, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       avatar_url = COALESCE(excluded.avatar_url, profiles.avatar_url),
       status = COALESCE(excluded.status, profiles.status),
       updated_at = excluded.updated_at`
  ).run(name, avatarUrl ?? null, status ?? null, Date.now());
  return getProfile(name);
}

// ---- Leaderboard (per room + game) ----

function bumpLeaderboard(code, game, name, score) {
  db.prepare(
    `INSERT INTO leaderboard (room_code, game, name, score, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(room_code, game, name) DO UPDATE SET
       score = CASE WHEN excluded.score > leaderboard.score THEN excluded.score ELSE leaderboard.score END,
       updated_at = excluded.updated_at`
  ).run(code, game, name, score, Date.now());
}

function getLeaderboard(code, game, limit = 10) {
  return db
    .prepare('SELECT name, score FROM leaderboard WHERE room_code = ? AND game = ? ORDER BY score DESC LIMIT ?')
    .all(code, game, limit);
}

// ---- Firefight weapon-unlock progress (see fg_stats above) ----

function getFgKills(code, name) {
  const row = db.prepare('SELECT total_kills FROM fg_stats WHERE room_code = ? AND name = ?').get(code, name);
  return row ? row.total_kills : 0;
}

function bumpFgKills(code, name) {
  db.prepare(
    `INSERT INTO fg_stats (room_code, name, total_kills, updated_at) VALUES (?, ?, 1, ?)
     ON CONFLICT(room_code, name) DO UPDATE SET
       total_kills = fg_stats.total_kills + 1,
       updated_at = excluded.updated_at`
  ).run(code, name, Date.now());
  return getFgKills(code, name);
}

// ---- Build Craft blueprints ----

function saveBlueprint(bp) {
  db.prepare(
    `INSERT INTO bc_blueprints (id, room_code, name, author, size_x, size_y, size_z, blocks_json, created_at)
     VALUES (@id, @roomCode, @name, @author, @sizeX, @sizeY, @sizeZ, @blocksJson, @createdAt)`
  ).run(bp);
}

function getBlueprints(code) {
  return db
    .prepare('SELECT id, name, author, size_x as sizeX, size_y as sizeY, size_z as sizeZ, created_at as createdAt FROM bc_blueprints WHERE room_code = ? ORDER BY created_at DESC')
    .all(code);
}

function getBlueprint(id) {
  const row = db.prepare('SELECT * FROM bc_blueprints WHERE id = ?').get(id);
  if (!row) return null;
  return { ...row, blocks: JSON.parse(row.blocks_json) };
}

// ---- Polls (a poll "lives" as a normal chat message with mediaType 'poll'; this just tracks votes) ----

function setPollVote(messageId, name, optionIndex) {
  db.prepare(
    `INSERT INTO poll_votes (message_id, name, option_index) VALUES (?, ?, ?)
     ON CONFLICT(message_id, name) DO UPDATE SET option_index = excluded.option_index`
  ).run(messageId, name, optionIndex);
}

function getPollVotes(messageId) {
  return db.prepare('SELECT name, option_index as optionIndex FROM poll_votes WHERE message_id = ?').all(messageId);
}

// ---- Media gallery (all images/videos ever shared in a room) ----

function getRoomMedia(code, limit = 200) {
  return db
    .prepare(
      `SELECT id, name, media_url as mediaUrl, media_type as mediaType, at FROM messages
       WHERE room_code = ? AND media_url IS NOT NULL AND deleted = 0 AND media_type IN ('image','video')
       ORDER BY at DESC LIMIT ?`
    )
    .all(code, limit);
}

// ---- Threads (direct replies to a message — one level, not deeply nested) ----

function getThreadReplies(code, messageId, limit = 200) {
  // Same DESC + reverse fix as getDmThread/getGroupDmMessages elsewhere in this file — an
  // ASC-ordered LIMIT kept only the oldest `limit` replies, so a thread past that count would be
  // stuck reshowing its oldest replies on every open and never surfacing anything more recent
  // (get-thread's result fully replaces the client's rendered thread each time, see renderThread).
  return db
    .prepare('SELECT * FROM messages WHERE room_code = ? AND reply_to_id = ? ORDER BY at DESC LIMIT ?')
    .all(code, messageId, limit)
    .reverse()
    .map(rowToHistoryEntry);
}

// ---- Push subscriptions (real OS/browser push, delivered even with the tab/app closed —
// keyed by endpoint since that's what's unique per browser+device, re-saved on every room
// join so it always reflects whichever room/name the subscriber most recently had open) ----

function savePushSubscription(roomCode, name, subscription, accountId) {
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, room_code, name, subscription_json, account_id, at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET room_code = excluded.room_code, name = excluded.name,
       subscription_json = excluded.subscription_json, account_id = excluded.account_id, at = excluded.at`
  ).run(subscription.endpoint, roomCode, name, JSON.stringify(subscription), accountId || null, Date.now());
}

function removePushSubscription(endpoint) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}

function getPushSubscriptionsForRoom(roomCode) {
  return db
    .prepare('SELECT endpoint, name, account_id, subscription_json FROM push_subscriptions WHERE room_code = ?')
    .all(roomCode)
    .map((r) => ({ endpoint: r.endpoint, name: r.name, accountId: r.account_id || null, subscription: JSON.parse(r.subscription_json) }));
}

// Every device an account has ever subscribed push from, across all rooms — used for direct
// @mention-by-email pushes, which must reach someone regardless of which room (if any) they
// currently have open, unlike getPushSubscriptionsForRoom above which is room-scoped.
function getPushSubscriptionsForAccount(accountId) {
  return db
    .prepare('SELECT endpoint, subscription_json FROM push_subscriptions WHERE account_id = ?')
    .all(accountId)
    .map((r) => ({ endpoint: r.endpoint, subscription: JSON.parse(r.subscription_json) }));
}

// ---- Accounts (optional — the app still works entirely name-only without one; an account just
// lets recent-rooms sync across devices, see account_recent_rooms below) ----

function createAccount(id, username, email, passwordHash, salt) {
  db.prepare('INSERT INTO accounts (id, username, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    username,
    email,
    passwordHash,
    salt,
    Date.now()
  );
}

function getAccountByUsername(username) {
  return db.prepare('SELECT * FROM accounts WHERE username = ? COLLATE NOCASE').get(username) || null;
}

// Returns the oldest account for this email — used both for Google-sign-in account linking and
// (since a follow-up account-recovery/email-flow audit) for mention-notification paging, since
// email ownership is never verified at signup and MAX_ACCOUNTS_PER_EMAIL (server.js) lets up to 10
// accounts share one email string — "oldest wins" is the same ambiguity-resolution this app
// already used for Google linking, reused rather than paging every account sharing the email.
function getAccountByEmail(email) {
  return db.prepare('SELECT * FROM accounts WHERE email = ? COLLATE NOCASE ORDER BY created_at ASC').get(email) || null;
}

function countAccountsByEmail(email) {
  return db.prepare('SELECT COUNT(*) as c FROM accounts WHERE email = ? COLLATE NOCASE').get(email).c;
}

function getAccountById(id) {
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) || null;
}

// Caller checks getAccountByUsername for a collision first (see /account/username in server.js),
// but the UNIQUE COLLATE NOCASE constraint is the real backstop against a same-instant race.
function updateAccountUsername(accountId, newUsername) {
  db.prepare('UPDATE accounts SET username = ? WHERE id = ?').run(newUsername, accountId);
}

function updateAccountPassword(accountId, passwordHash, salt) {
  db.prepare('UPDATE accounts SET password_hash = ?, salt = ? WHERE id = ?').run(passwordHash, salt, accountId);
}

// ---- Google sign-in (optional, alongside username/password) — an account created this way has
// no password_hash/salt (both stay NULL; verifyPassword is never called for it) until/unless the
// user later sets one, which no UI for yet exists.
function createAccountWithGoogle(id, username, email, googleId) {
  db.prepare('INSERT INTO accounts (id, username, email, google_id, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    username,
    email,
    googleId,
    Date.now()
  );
}

function getAccountByGoogleId(googleId) {
  return db.prepare('SELECT * FROM accounts WHERE google_id = ?').get(googleId) || null;
}

function linkGoogleId(accountId, googleId) {
  db.prepare('UPDATE accounts SET google_id = ? WHERE id = ?').run(googleId, accountId);
}

// ---- Sessions (bearer token handed to the client on signup/login, sent back as
// `Authorization: Bearer <token>` on subsequent requests) ----

function createSession(token, accountId) {
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token, account_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)').run(
    token,
    accountId,
    now,
    now
  );
}

function getSessionAccount(token) {
  const row = db
    .prepare(
      `SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token = ?`
    )
    .get(token);
  if (row) db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token = ?').run(Date.now(), token);
  return row || null;
}

function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// Found by a credential-change-security audit: sessions never expired and the only revocation
// path (deleteSession) could only ever kill the single token the caller already holds — meaning a
// leaked token was a permanent, unrecoverable compromise, since a user had no way to invalidate
// any OTHER session for their own account. Used by the new /account/password route (kills every
// other session on a real password change) and /auth/logout's new "everywhere" mode.
function deleteSessionsForAccount(accountId) {
  db.prepare('DELETE FROM sessions WHERE account_id = ?').run(accountId);
}

// ---- Account recent rooms (server-side mirror of the client's localStorage recent-rooms list,
// only populated for signed-in accounts, so switching devices doesn't lose the room list) ----

function upsertAccountRecentRoom(accountId, code, name) {
  db.prepare(
    `INSERT INTO account_recent_rooms (account_id, room_code, room_name, at) VALUES (?, ?, ?, ?)
     ON CONFLICT(account_id, room_code) DO UPDATE SET room_name = excluded.room_name, at = excluded.at`
  ).run(accountId, code, name || null, Date.now());
}

function getAccountRecentRooms(accountId, limit = 10) {
  return db
    .prepare(
      `SELECT room_code as code, room_name as name, at FROM account_recent_rooms
       WHERE account_id = ? ORDER BY at DESC LIMIT ?`
    )
    .all(accountId, limit);
}

// ---- Friends (account-only — needs a stable identity across devices, which anonymous
// per-room display names don't have) ----

// Order-independent lookup: a friendship/block row is stored once, keyed by who initiated it,
// but callers usually just want "is there anything between these two accounts".
function getFriendshipBetween(userA, userB) {
  return (
    db
      .prepare(
        `SELECT * FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`
      )
      .get(userA, userB, userB, userA) || null
  );
}

function isBlockedBetween(userA, userB) {
  return !!db
    .prepare(
      `SELECT 1 FROM friendships WHERE status = 'blocked' AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`
    )
    .get(userA, userB, userB, userA);
}

// Every account id blocked-with `accountId` in either direction (they blocked me, or I blocked
// them) — for filtering a whole list of messages against isBlockedBetween in one query instead of
// one per message. get-group-dm-messages used to call isBlockedBetween per message (up to 200,
// the default history limit) every time a thread was opened; this replaces that N+1 with a single
// query plus an in-memory Set.has() per message.
function getBlockedAccountIds(accountId) {
  const rows = db
    .prepare(
      `SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END as otherId
       FROM friendships WHERE status = 'blocked' AND (requester_id = ? OR addressee_id = ?)`
    )
    .all(accountId, accountId, accountId);
  return new Set(rows.map((r) => r.otherId));
}

function upsertFriendRequest(requesterId, addresseeId) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO friendships (requester_id, addressee_id, status, created_at, updated_at) VALUES (?, ?, 'pending', ?, ?)
     ON CONFLICT(requester_id, addressee_id) DO UPDATE SET status = 'pending', updated_at = excluded.updated_at`
  ).run(requesterId, addresseeId, now, now);
}

// Only flips a genuinely pending (requester -> addressee) row — a stale/mismatched call is a
// silent no-op rather than an error, callers check getFriendshipBetween first anyway.
function acceptFriendRequest(requesterId, addresseeId) {
  db.prepare(
    `UPDATE friendships SET status = 'accepted', updated_at = ? WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'`
  ).run(Date.now(), requesterId, addresseeId);
}

// Unfriend / decline / cancel are all "delete whatever row exists between these two" — but never
// a blocked row, since block/unblock go through their own dedicated functions below.
function removeFriendship(userA, userB) {
  db.prepare(
    `DELETE FROM friendships WHERE status != 'blocked' AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`
  ).run(userA, userB, userB, userA);
}

// Blocking replaces any prior relationship (pending request, accepted friendship, even a block
// in the other direction) with a fresh one-directional block row from blocker -> blocked.
function setBlocked(blockerId, blockedId) {
  const now = Date.now();
  db.prepare(
    `DELETE FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`
  ).run(blockerId, blockedId, blockedId, blockerId);
  db.prepare(
    `INSERT INTO friendships (requester_id, addressee_id, status, created_at, updated_at) VALUES (?, ?, 'blocked', ?, ?)`
  ).run(blockerId, blockedId, now, now);
}

function unblock(blockerId, blockedId) {
  db.prepare(`DELETE FROM friendships WHERE requester_id = ? AND addressee_id = ? AND status = 'blocked'`).run(
    blockerId,
    blockedId
  );
}

function getFriends(accountId) {
  return db
    .prepare(
      `SELECT a.id as accountId, a.username, f.updated_at as since
       FROM friendships f
       JOIN accounts a ON a.id = (CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END)
       WHERE f.status = 'accepted' AND (f.requester_id = ? OR f.addressee_id = ?)
       ORDER BY f.updated_at DESC`
    )
    .all(accountId, accountId, accountId);
}

function getIncomingFriendRequests(accountId) {
  return db
    .prepare(
      `SELECT a.username, f.created_at
       FROM friendships f JOIN accounts a ON a.id = f.requester_id
       WHERE f.addressee_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`
    )
    .all(accountId);
}

function getOutgoingFriendRequests(accountId) {
  return db
    .prepare(
      `SELECT a.username, f.created_at
       FROM friendships f JOIN accounts a ON a.id = f.addressee_id
       WHERE f.requester_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`
    )
    .all(accountId);
}

function getBlockedUsers(accountId) {
  return db
    .prepare(
      `SELECT a.username, f.updated_at
       FROM friendships f JOIN accounts a ON a.id = f.addressee_id
       WHERE f.requester_id = ? AND f.status = 'blocked'
       ORDER BY f.updated_at DESC`
    )
    .all(accountId);
}

// ---- Group DMs ----

function createGroupDm(id, name, createdBy, memberAccountIds) {
  const now = Date.now();
  const insertGroup = db.prepare(`INSERT INTO group_dms (id, name, created_by, created_at) VALUES (?, ?, ?, ?)`);
  const insertMember = db.prepare(
    `INSERT INTO group_dm_members (group_id, account_id, joined_at) VALUES (?, ?, ?)`
  );
  const tx = db.transaction(() => {
    insertGroup.run(id, name || null, createdBy, now);
    for (const accountId of memberAccountIds) insertMember.run(id, accountId, now);
  });
  tx();
}

function getGroupDm(id) {
  return db.prepare('SELECT * FROM group_dms WHERE id = ?').get(id) || null;
}

function getGroupDmMemberIds(groupId) {
  return db.prepare('SELECT account_id FROM group_dm_members WHERE group_id = ?').all(groupId).map((r) => r.account_id);
}

function isGroupDmMember(groupId, accountId) {
  return !!db.prepare('SELECT 1 FROM group_dm_members WHERE group_id = ? AND account_id = ?').get(groupId, accountId);
}

// Every group DM this account belongs to, with its member usernames and last message preview —
// the thread-list view, so one query per field instead of N+1 per thread.
function getGroupDmsForAccount(accountId) {
  const groups = db
    .prepare(
      `SELECT g.* FROM group_dms g
       JOIN group_dm_members m ON m.group_id = g.id
       WHERE m.account_id = ?
       ORDER BY g.created_at DESC`
    )
    .all(accountId);
  const membersStmt = db.prepare(
    `SELECT a.id, a.username FROM group_dm_members m JOIN accounts a ON a.id = m.account_id WHERE m.group_id = ?`
  );
  // Found by a friends/DM authorization audit: block enforcement was added to live delivery
  // (sendGroupDm) and full history (getGroupDmMessages, via getBlockedAccountIds) but this
  // thread-list preview was a separate, unfiltered query — so a group-mate this account has
  // blocked (or who blocked them) could still have their newest message shown here as the
  // preview text, even though it never appears in the actual message list once opened. LIMIT 20
  // (not 1) so there's a real fallback to skip to if the single newest message happens to be from
  // a blocked account; a very inactive group could in principle have >20 consecutive blocked-sender
  // messages and briefly show "No messages yet" instead of an older real one, an acceptable
  // trade-off for a preview line.
  const blockedIds = getBlockedAccountIds(accountId);
  const lastMessagesStmt = db.prepare(
    `SELECT from_account_id, from_name, text, at FROM group_dm_messages WHERE group_id = ? ORDER BY at DESC LIMIT 20`
  );
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    createdBy: g.created_by,
    createdAt: g.created_at,
    members: membersStmt.all(g.id),
    lastMessage: lastMessagesStmt.all(g.id).find((m) => !blockedIds.has(m.from_account_id)) || null,
  }));
}

function insertGroupDmMessage(entry) {
  db.prepare(
    `INSERT INTO group_dm_messages (id, group_id, from_account_id, from_name, text, at) VALUES (@id, @groupId, @fromAccountId, @fromName, @text, @at)`
  ).run(entry);
}

function getGroupDmMessages(groupId, limit = 200) {
  // Same DESC + reverse fix as getDmThread above — an ASC-ordered LIMIT kept only the oldest
  // `limit` messages, so any group DM past that count was stuck reshowing its ancient start on
  // every reopen and never surfacing anything sent more recently.
  return db
    .prepare(`SELECT * FROM group_dm_messages WHERE group_id = ? ORDER BY at DESC LIMIT ?`)
    .all(groupId, limit)
    .reverse()
    .map((r) => ({ id: r.id, groupId: r.group_id, fromAccountId: r.from_account_id, fromName: r.from_name, text: r.text, at: r.at }));
}

function removeGroupDmMember(groupId, accountId) {
  db.prepare('DELETE FROM group_dm_members WHERE group_id = ? AND account_id = ?').run(groupId, accountId);
}

// ---- Scorpture (video sharing) ----

function insertScorptureVideo(v) {
  db.prepare(
    `INSERT INTO scorpture_videos (id, uploader_id, uploader_username, title, description, video_url, thumbnail_url, category, views, created_at)
     VALUES (@id, @uploaderId, @uploaderUsername, @title, @description, @videoUrl, @thumbnailUrl, @category, 0, @createdAt)`
  ).run(v);
}

function getScorptureVideo(id) {
  return db.prepare('SELECT * FROM scorpture_videos WHERE id = ?').get(id) || null;
}

function listScorptureVideos({ search, uploaderId, category, limit = 60 } = {}) {
  const clauses = [];
  const params = [];
  if (uploaderId) {
    clauses.push('uploader_id = ?');
    params.push(uploaderId);
  }
  if (category) {
    clauses.push('category = ?');
    params.push(category);
  }
  if (search) {
    clauses.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(limit);
  return db.prepare(`SELECT * FROM scorpture_videos ${where} ORDER BY created_at DESC LIMIT ?`).all(...params);
}

// Every video from every channel this account subscribes to, newest first — the whole point of
// subscribing actually mattering day-to-day (see #/subscriptions in videos.js), not just a count
// on someone's channel page.
function getScorptureSubscriptionFeed(subscriberId, limit = 60) {
  return db
    .prepare(
      `SELECT v.* FROM scorpture_videos v
       JOIN scorpture_subscriptions s ON s.channel_id = v.uploader_id
       WHERE s.subscriber_id = ?
       ORDER BY v.created_at DESC LIMIT ?`
    )
    .all(subscriberId, limit);
}

// accountIds of everyone subscribed to this channel — used to fan out "new video"/"went live"
// push notifications, see server.js.
function getScorptureSubscriberIds(channelId) {
  return db
    .prepare('SELECT subscriber_id FROM scorpture_subscriptions WHERE channel_id = ?')
    .all(channelId)
    .map((r) => r.subscriber_id);
}

function bumpScorptureViews(id) {
  db.prepare('UPDATE scorpture_videos SET views = views + 1 WHERE id = ?').run(id);
}

// Metadata only (title/description/category) — the video file itself is immutable once
// published, same as YouTube's own edit flow. Ownership is checked by the caller before this
// runs (unlike updateScorptureComment, since the video row is also needed there to fall back to
// its existing thumbnail_url when no new one was uploaded).
function updateScorptureVideo(id, v) {
  db.prepare(
    `UPDATE scorpture_videos SET title = @title, description = @description, category = @category, thumbnail_url = @thumbnailUrl
     WHERE id = @id`
  ).run({ id, ...v });
}

function deleteScorptureVideo(id) {
  db.prepare('DELETE FROM scorpture_comments WHERE video_id = ?').run(id);
  db.prepare('DELETE FROM scorpture_likes WHERE video_id = ?').run(id);
  db.prepare('DELETE FROM scorpture_videos WHERE id = ?').run(id);
}

function insertScorptureComment(c) {
  db.prepare(
    `INSERT INTO scorpture_comments (id, video_id, account_id, username, text, created_at)
     VALUES (@id, @videoId, @accountId, @username, @text, @createdAt)`
  ).run(c);
}

// Generous cap, not real pagination (no "load more" UI exists for comments) — purely a safety net
// against the same unbounded-growth-on-a-hot-path shape already fixed once for reactions/whiteboard
// strokes, at a size well beyond anything this app's realistic comment volume would ever reach.
const SCORPTURE_COMMENTS_CAP = 2000;
function getScorptureComments(videoId) {
  const rows = db
    .prepare('SELECT * FROM scorpture_comments WHERE video_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(videoId, SCORPTURE_COMMENTS_CAP);
  // account_id is only needed internally (updateScorptureComment/deleteScorptureComment's ownership
  // check) — this is the only read path, and it's unauthenticated, so the raw row must not go out
  // as-is: it'd hand every viewer a commenter's permanent internal account id, a stable identifier
  // that (unlike the username) survives a name change, letting activity be correlated across one.
  return rows.reverse().map((r) => ({ id: r.id, username: r.username, text: r.text, created_at: r.created_at, edited: !!r.edited }));
}

// The account_id match in the WHERE clause *is* the ownership check — a mismatched id just
// updates zero rows rather than needing a separate lookup-then-compare. Returns whether it
// actually changed anything, so the route can tell "not yours"/"doesn't exist" from a real edit.
function updateScorptureComment(id, accountId, text) {
  const result = db
    .prepare('UPDATE scorpture_comments SET text = ?, edited = 1 WHERE id = ? AND account_id = ?')
    .run(text, id, accountId);
  return result.changes > 0;
}

// Returns the new liked state (true = just liked, false = just unliked) — one call toggles
// either direction, same pattern as reactions.toggleReaction elsewhere in this file.
function toggleScorptureLike(videoId, accountId) {
  const existing = db.prepare('SELECT 1 FROM scorpture_likes WHERE video_id = ? AND account_id = ?').get(videoId, accountId);
  if (existing) {
    db.prepare('DELETE FROM scorpture_likes WHERE video_id = ? AND account_id = ?').run(videoId, accountId);
    return false;
  }
  db.prepare('INSERT INTO scorpture_likes (video_id, account_id, created_at) VALUES (?, ?, ?)').run(videoId, accountId, Date.now());
  return true;
}

function getScorptureLikeCount(videoId) {
  return db.prepare('SELECT COUNT(*) as c FROM scorpture_likes WHERE video_id = ?').get(videoId).c;
}

function hasScorptureLiked(videoId, accountId) {
  if (!accountId) return false;
  return !!db.prepare('SELECT 1 FROM scorpture_likes WHERE video_id = ? AND account_id = ?').get(videoId, accountId);
}

function toggleScorptureSubscription(subscriberId, channelId) {
  const existing = db
    .prepare('SELECT 1 FROM scorpture_subscriptions WHERE subscriber_id = ? AND channel_id = ?')
    .get(subscriberId, channelId);
  if (existing) {
    db.prepare('DELETE FROM scorpture_subscriptions WHERE subscriber_id = ? AND channel_id = ?').run(subscriberId, channelId);
    return false;
  }
  db.prepare('INSERT INTO scorpture_subscriptions (subscriber_id, channel_id, created_at) VALUES (?, ?, ?)').run(
    subscriberId,
    channelId,
    Date.now()
  );
  return true;
}

// The bonus is a purely cosmetic admin-set offset (see setScorptureBonusSubscribers) — added on
// top of the real subscription count wherever it's displayed, not backed by real subscriber rows.
function getScorptureSubscriberCount(channelId) {
  const real = db.prepare('SELECT COUNT(*) as c FROM scorpture_subscriptions WHERE channel_id = ?').get(channelId).c;
  const account = db.prepare('SELECT scorpture_bonus_subscribers FROM accounts WHERE id = ?').get(channelId);
  return real + (account ? account.scorpture_bonus_subscribers || 0 : 0);
}

function setScorptureBonusSubscribers(accountId, count) {
  db.prepare('UPDATE accounts SET scorpture_bonus_subscribers = ? WHERE id = ?').run(count, accountId);
}

function getScorptureBonusSubscribers(accountId) {
  const account = db.prepare('SELECT scorpture_bonus_subscribers FROM accounts WHERE id = ?').get(accountId);
  return account ? account.scorpture_bonus_subscribers || 0 : 0;
}

// Stream overlays (text/image graphics the broadcaster composites onto their own video before
// sending) — a small per-account list, stored as one JSON blob rather than its own table since
// it's just a handful of items at most, edited as a whole list from the overlays settings page.
function getScorptureOverlays(accountId) {
  const account = db.prepare('SELECT scorpture_overlay_json FROM accounts WHERE id = ?').get(accountId);
  if (!account || !account.scorpture_overlay_json) return [];
  try {
    const parsed = JSON.parse(account.scorpture_overlay_json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setScorptureOverlays(accountId, overlays) {
  db.prepare('UPDATE accounts SET scorpture_overlay_json = ? WHERE id = ?').run(JSON.stringify(overlays), accountId);
}

function isScorptureSubscribed(subscriberId, channelId) {
  if (!subscriberId) return false;
  return !!db
    .prepare('SELECT 1 FROM scorpture_subscriptions WHERE subscriber_id = ? AND channel_id = ?')
    .get(subscriberId, channelId);
}

function setScorptureBanner(accountId, bannerUrl) {
  db.prepare('UPDATE accounts SET scorpture_banner_url = ? WHERE id = ?').run(bannerUrl, accountId);
}

function setScorptureAvatar(accountId, avatarUrl) {
  db.prepare('UPDATE accounts SET scorpture_avatar_url = ? WHERE id = ?').run(avatarUrl, accountId);
}

function setScorptureDescription(accountId, description) {
  db.prepare('UPDATE accounts SET scorpture_description = ? WHERE id = ?').run(description, accountId);
}

// ---- Self-healing: error reports (uncaught server/client errors) and the AI-drafted patch
// proposals generated from them, see patcher.js. Everything here is admin-reviewed — nothing
// in this section ever applies a change to the running app by itself. ----

function insertErrorReport(entry) {
  db.prepare(
    `INSERT INTO error_reports (id, source, message, stack, context_json, status, created_at) VALUES (?, ?, ?, ?, ?, 'new', ?)`
  ).run(entry.id, entry.source, entry.message, entry.stack || null, JSON.stringify(entry.context || {}), Date.now());
}

function getErrorReport(id) {
  return db.prepare('SELECT * FROM error_reports WHERE id = ?').get(id) || null;
}

function setErrorReportStatus(id, status) {
  db.prepare('UPDATE error_reports SET status = ? WHERE id = ?').run(status, id);
}

// Found by the admin-panel functional-correctness audit: this used to cap by RECENCY across every
// status, then admin.html filtered client-side down to status === 'new' — once a table accumulated
// more than 50 rows total (any status), an older still-unresolved report could fall entirely
// outside the top-50-by-recency window and simply never appear in the admin panel again, no matter
// how long it stayed unresolved. Filters by status server-side instead, mirroring
// getPendingPatchProposals's own established "unbounded, status-filtered" pattern just below — an
// unresolved item should never be able to silently age out of view.
function getRecentErrorReports() {
  return db.prepare("SELECT * FROM error_reports WHERE status = 'new' ORDER BY created_at DESC").all();
}

// ---- Abuse reports (message or user) ----

function insertReport(entry) {
  db.prepare(
    `INSERT INTO reports (id, room_code, reporter_name, reporter_account_id, target_name, message_id, message_text, reason, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`
  ).run(
    entry.id,
    entry.roomCode,
    entry.reporterName,
    entry.reporterAccountId || null,
    entry.targetName,
    entry.messageId || null,
    entry.messageText || null,
    entry.reason || null,
    Date.now()
  );
}

// Same fix as getRecentErrorReports above, same reasoning — see its comment.
function getRecentReports() {
  return db.prepare("SELECT * FROM reports WHERE status = 'new' ORDER BY created_at DESC").all();
}

function setReportStatus(id, status) {
  db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, id);
}

// ---- Persistent (account-based) room mutes — see room_mutes table comment above ----

function addPersistentMute(roomCode, targetAccountId, targetName, mutedBy) {
  db.prepare(
    `INSERT INTO room_mutes (room_code, target_account_id, target_name, muted_by, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(room_code, target_account_id) DO UPDATE SET target_name = excluded.target_name, muted_by = excluded.muted_by, created_at = excluded.created_at`
  ).run(roomCode, targetAccountId, targetName, mutedBy, Date.now());
}

function removePersistentMute(roomCode, targetAccountId) {
  db.prepare('DELETE FROM room_mutes WHERE room_code = ? AND target_account_id = ?').run(roomCode, targetAccountId);
}

function isPersistentlyMuted(roomCode, targetAccountId) {
  if (!targetAccountId) return false;
  return !!db.prepare('SELECT 1 FROM room_mutes WHERE room_code = ? AND target_account_id = ?').get(roomCode, targetAccountId);
}

// Fallback for unmuting someone who isn't currently connected (so their live ws.accountId isn't
// available) — looks the mute row up by the display name it was recorded under instead.
function getPersistentMuteByName(roomCode, targetName) {
  return db.prepare('SELECT * FROM room_mutes WHERE room_code = ? AND target_name = ?').get(roomCode, targetName) || null;
}

// Keeps a muted account's row findable by the by-name fallback above after they rename — without
// this, renaming while muted (even once, at any point before an offline unmute is attempted)
// permanently orphans the row: getPersistentMuteByName looks up by whatever name the host
// currently sees, which no longer matches what's stored, so removePersistentMute never fires.
function renamePersistentMuteName(roomCode, targetAccountId, newName) {
  if (!targetAccountId) return;
  db.prepare('UPDATE room_mutes SET target_name = ? WHERE room_code = ? AND target_account_id = ?').run(newName, roomCode, targetAccountId);
}

// ---- Room bans (see room_bans table comment for the account-vs-name enforcement split) ----

function banFromRoom(id, roomCode, targetAccountId, targetName, bannedBy) {
  // One row per (room, account) for signed-in targets — re-banning just refreshes it rather
  // than piling up duplicate rows every time a host re-bans the same account.
  if (targetAccountId) {
    const existing = db.prepare('SELECT id FROM room_bans WHERE room_code = ? AND target_account_id = ?').get(roomCode, targetAccountId);
    if (existing) {
      db.prepare('UPDATE room_bans SET target_name = ?, banned_by = ?, created_at = ? WHERE id = ?').run(targetName, bannedBy, Date.now(), existing.id);
      return;
    }
  }
  db.prepare('INSERT INTO room_bans (id, room_code, target_account_id, target_name, banned_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, roomCode, targetAccountId || null, targetName, bannedBy, Date.now()
  );
}

// roomCode scopes the delete to the caller's own room — without it, a host of Room A who also
// somehow knew a ban id belonging to Room B (ban ids are random UUIDs never broadcast to anyone
// but a room's own host via get-bans/bans-result, so this was low-exploitability, but every
// sibling id-based handler in server.js — delete-message, pin-message, get-thread, etc. — already
// enforces this same room-ownership check before acting on an id) could unban that row while
// connected to Room A, without ever being validated as Room B's actual host.
function unbanFromRoom(banId, roomCode) {
  db.prepare('DELETE FROM room_bans WHERE id = ? AND room_code = ?').run(banId, roomCode);
}

function getRoomBans(roomCode) {
  return db.prepare('SELECT * FROM room_bans WHERE room_code = ? ORDER BY created_at DESC').all(roomCode);
}

function isBannedFromRoom(roomCode, accountId, name) {
  if (accountId && db.prepare('SELECT 1 FROM room_bans WHERE room_code = ? AND target_account_id = ?').get(roomCode, accountId)) return true;
  if (db.prepare('SELECT 1 FROM room_bans WHERE room_code = ? AND target_account_id IS NULL AND target_name = ?').get(roomCode, name)) return true;
  return false;
}

// ---- Admin push subscriptions (see admin_push_subscriptions table comment) ----

function addAdminPushSubscription(endpoint, subscription) {
  db.prepare(
    `INSERT INTO admin_push_subscriptions (endpoint, subscription_json, created_at) VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET subscription_json = excluded.subscription_json`
  ).run(endpoint, JSON.stringify(subscription), Date.now());
}

function removeAdminPushSubscription(endpoint) {
  db.prepare('DELETE FROM admin_push_subscriptions WHERE endpoint = ?').run(endpoint);
}

function getAdminPushSubscriptions() {
  return db.prepare('SELECT endpoint, subscription_json FROM admin_push_subscriptions').all()
    .map((r) => ({ endpoint: r.endpoint, subscription: JSON.parse(r.subscription_json) }));
}

// ---- Scorpture reports (see scorpture_reports table comment) ----

function insertScorptureReport(entry) {
  db.prepare(
    `INSERT INTO scorpture_reports (id, video_id, reporter_account_id, reporter_username, uploader_username, reason, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'new', ?)`
  ).run(entry.id, entry.videoId, entry.reporterAccountId, entry.reporterUsername, entry.uploaderUsername, entry.reason || null, Date.now());
}

// Same fix as getRecentErrorReports above, same reasoning — see its comment.
function getRecentScorptureReports() {
  return db.prepare("SELECT * FROM scorpture_reports WHERE status = 'new' ORDER BY created_at DESC").all();
}

function setScorptureReportStatus(id, status) {
  db.prepare('UPDATE scorpture_reports SET status = ? WHERE id = ?').run(status, id);
}

function insertPatchProposal(entry) {
  db.prepare(
    `INSERT INTO patch_proposals (id, error_report_id, target_file, old_string, new_string, explanation, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(entry.id, entry.errorReportId, entry.targetFile, entry.oldString, entry.newString, entry.explanation, Date.now());
}

function getPatchProposal(id) {
  return db.prepare('SELECT * FROM patch_proposals WHERE id = ?').get(id) || null;
}

// Only ever moves a proposal out of 'pending' — unlike approve (patcher.js's applyProposal, which
// checks status itself before doing anything), the /admin/patches/:id/reject route used to call
// this unconditionally with no status check of its own. The admin panel's key is bookmarkable and
// has no polling/refresh, so two tabs open on the same stale pending list is realistic: if tab A
// approves a proposal (real file patched, status -> 'applied') and tab B, still showing the old
// list, then rejects the same id, the row's status would silently become 'rejected' even though
// the file change is real and permanent — a false audit trail for the one record meant to explain
// unattended changes to a production file. Returns whether the row was actually still pending, so
// the reject route can tell a stale click apart from a genuine one.
function setPatchProposalStatus(id, status) {
  const result = db.prepare(`UPDATE patch_proposals SET status = ?, decided_at = ? WHERE id = ? AND status = 'pending'`).run(status, Date.now(), id);
  return result.changes > 0;
}

function getPendingPatchProposals() {
  return db.prepare(`SELECT * FROM patch_proposals WHERE status = 'pending' ORDER BY created_at DESC`).all();
}

// ---- Room retention cleanup — nothing here ever expired before, so a long-running install's
// DB and public/uploads/ would grow forever. A room counts as inactive by rooms.last_active_at,
// which every message/game action already bumps (see touchRoom-style callers in server.js).
// A room with a missing/zero/corrupted last_active_at (e.g. from an older bug, or a row
// inserted by a raw script that skipped the column) would read as "inactive since 1970" and
// get purged the very next sweep even though it might be in active use — require the
// timestamp to also be *plausible* (after this app could possibly have existed), not just old.
const MIN_PLAUSIBLE_ROOM_TS = 1700000000000; // 2023-11-14 — long before this app existed
function getInactiveRoomCodes(cutoffTs) {
  return db.prepare('SELECT code FROM rooms WHERE last_active_at < ? AND last_active_at > ?')
    .all(cutoffTs, MIN_PLAUSIBLE_ROOM_TS).map((r) => r.code);
}

function getRoomMediaUrls(code) {
  return db.prepare("SELECT media_url FROM messages WHERE room_code = ? AND media_url IS NOT NULL")
    .all(code).map((r) => r.media_url);
}

// One transaction per room so a crash mid-sweep can't leave a room half-deleted (e.g. messages
// gone but the room row still present, which would resurrect it as an empty room on next visit).
//
// reports/fg_stats/account_recent_rooms/room_mutes/room_bans were missing here (found by a data-
// consistency audit) — reports is the same "stale, unverifiable-but-still-shown" shape as the
// scorpture_reports gap fixed alongside this, but unlike that case a genuinely-flagged fix wasn't
// worth it here: by the time a room is 90 days inactive enough to be swept, any still-open report
// against it has long since blown past any realistic admin response window, so just clearing it
// out (rather than flagging it forever) is the more proportionate choice. fg_stats is unbounded-
// growth-shaped (same class as the reactions/whiteboard-strokes issues fixed earlier this
// session). room_mutes/room_bans are the most important of the five: generateRoomCode() only
// avoids codes currently in `rooms` or with a live `rooms` DB row — neither check survives a
// purge — so a purged room's 5-character code was eligible for reuse by a brand-new, unrelated
// room while its stale bans/mutes lived on, meaning a signed-in account (or matching display
// name) banned/muted in the old room could silently inherit that ban/mute in the new one that
// happens to land on the same recycled code. account_recent_rooms just avoids a user's "recent
// rooms" list silently resurrecting an empty room under a purged code with no explanation.
const deleteRoomCascade = db.transaction((code) => {
  db.prepare('DELETE FROM reactions WHERE message_id IN (SELECT id FROM messages WHERE room_code = ?)').run(code);
  db.prepare('DELETE FROM poll_votes WHERE message_id IN (SELECT id FROM messages WHERE room_code = ?)').run(code);
  db.prepare('DELETE FROM messages WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM pins WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM read_receipts WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM whiteboard_strokes WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM bc_worlds WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM bc_overrides WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM bc_claims WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM leaderboard WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM bc_blueprints WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM dms WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM push_subscriptions WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM reports WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM fg_stats WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM account_recent_rooms WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM room_mutes WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM room_bans WHERE room_code = ?').run(code);
  db.prepare('DELETE FROM rooms WHERE code = ?').run(code);
});

module.exports = {
  upsertRoom,
  getRoom,
  insertMessage,
  getMessage,
  updateMessageText,
  deleteMessageRow,
  getRecentMessages,
  getMessagesBefore,
  getAllMessagesForExport,
  searchMessages,
  toggleReaction,
  getReactionsForRoom,
  setPin,
  unpinMessage,
  getPins,
  setReadReceipt,
  getReadReceipts,
  insertStroke,
  getWhiteboardStrokes,
  clearStrokes,
  getBcWorld,
  createBcWorld,
  setBcOverrides,
  getBcOverrides,
  addBcClaim,
  getBcClaims,
  getProfile,
  upsertProfile,
  bumpLeaderboard,
  getLeaderboard,
  getFgKills,
  bumpFgKills,
  saveBlueprint,
  getBlueprints,
  getBlueprint,
  setRoomHostIfUnset,
  renameRoomHostIfMatches,
  setAnnouncement,
  setRoomPin,
  setWallpaper,
  insertDm,
  getDmThread,
  setPollVote,
  getPollVotes,
  getRoomMedia,
  getThreadReplies,
  rowToHistoryEntry,
  savePushSubscription,
  removePushSubscription,
  getPushSubscriptionsForRoom,
  getPushSubscriptionsForAccount,
  createAccount,
  getAccountByUsername,
  getAccountByEmail,
  countAccountsByEmail,
  getAccountById,
  updateAccountUsername,
  updateAccountPassword,
  createAccountWithGoogle,
  getAccountByGoogleId,
  linkGoogleId,
  createSession,
  getSessionAccount,
  deleteSession,
  deleteSessionsForAccount,
  upsertAccountRecentRoom,
  getAccountRecentRooms,
  getFriendshipBetween,
  isBlockedBetween,
  getBlockedAccountIds,
  upsertFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  setBlocked,
  unblock,
  getFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  getBlockedUsers,
  createGroupDm,
  getGroupDm,
  getGroupDmMemberIds,
  isGroupDmMember,
  getGroupDmsForAccount,
  insertGroupDmMessage,
  getGroupDmMessages,
  removeGroupDmMember,
  insertErrorReport,
  getErrorReport,
  setErrorReportStatus,
  getRecentErrorReports,
  insertReport,
  getRecentReports,
  setReportStatus,
  addPersistentMute,
  removePersistentMute,
  isPersistentlyMuted,
  getPersistentMuteByName,
  renamePersistentMuteName,
  banFromRoom,
  unbanFromRoom,
  getRoomBans,
  isBannedFromRoom,
  addAdminPushSubscription,
  removeAdminPushSubscription,
  getAdminPushSubscriptions,
  insertScorptureReport,
  getRecentScorptureReports,
  setScorptureReportStatus,
  insertPatchProposal,
  getPatchProposal,
  setPatchProposalStatus,
  getPendingPatchProposals,
  getInactiveRoomCodes,
  getRoomMediaUrls,
  deleteRoomCascade,
  insertScorptureVideo,
  getScorptureVideo,
  listScorptureVideos,
  bumpScorptureViews,
  updateScorptureVideo,
  deleteScorptureVideo,
  insertScorptureComment,
  getScorptureComments,
  updateScorptureComment,
  getScorptureSubscriptionFeed,
  getScorptureSubscriberIds,
  toggleScorptureLike,
  getScorptureLikeCount,
  hasScorptureLiked,
  toggleScorptureSubscription,
  getScorptureSubscriberCount,
  isScorptureSubscribed,
  setScorptureBanner,
  setScorptureAvatar,
  setScorptureDescription,
  setScorptureBonusSubscribers,
  getScorptureBonusSubscribers,
  getScorptureOverlays,
  setScorptureOverlays,
};
