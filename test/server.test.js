// Regression suite for server.js — run with `npm test`. Each `describe` block gets its own room
// code (prefixed by the block name) so tests can share one running server instance without
// interfering with each other's state. This consolidates the ad-hoc scratch-test scripts written
// (and thrown away) during this session's bug-hunt/feature work into something future sessions
// can just run instead of re-deriving from scratch.
'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');
const { startTestServer, connectWs, send, waitFor, sleep, BASE_URL } = require('./helpers');

let server;
before(async () => { server = await startTestServer(); });
after(async () => { await server.stop(); });

// Used only to assert a pre-match/pre-duel map vote actually resolved to one of the real ids,
// not to exercise the list itself (that's server.js's own concern). Extracted straight from
// server.js's source rather than hand-copied — a hand-copied mirror here previously went stale
// (server.js's BB_MAP_IDS grew from 20 to 200+ entries in a later content-expansion commit,
// silently breaking every map-vote assertion below since the vote almost always resolved outside
// the small hand-copied list) and a second manual copy would only be one future edit away from
// the same failure mode.
const BB_MAP_IDS_FOR_TEST = new Function(
  `return ${fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8').match(/const BB_MAP_IDS = (\[[\s\S]*?\]);/)[1]};`
)();

async function joinRoom(username) {
  const ws = await connectWs();
  send(ws, { type: 'join-server', username });
  await waitFor(ws, (m) => m.type === 'joined-server');
  send(ws, { type: 'create-room' });
  const room = await waitFor(ws, (m) => m.type === 'joined-room');
  return { ws, code: room.code };
}
async function joinExistingRoom(username, code) {
  const ws = await connectWs();
  send(ws, { type: 'join-server', username });
  await waitFor(ws, (m) => m.type === 'joined-server');
  send(ws, { type: 'join-room', code });
  await waitFor(ws, (m) => m.type === 'joined-room');
  return ws;
}
// Same as joinExistingRoom, but authenticated — needed for anything gated on ws.accountId
// (friend-dm, create-group-dm), which is only set if join-server's accountToken resolves to a
// real session (see registerAccountConnection in server.js).
async function joinAsAccount(username, accountToken, code) {
  const ws = await connectWs();
  send(ws, { type: 'join-server', username, accountToken });
  await waitFor(ws, (m) => m.type === 'joined-server');
  if (code) {
    send(ws, { type: 'join-room', code });
    await waitFor(ws, (m) => m.type === 'joined-room');
  }
  return ws;
}
// requireAdmin only accepts the key via this header (a ?key= query-string fallback used to also
// work, but the real client — admin.html — never sent it that way either, and it was a materially
// weaker place for a permanent credential to sit: server access logs, Referer headers, etc.).
function adminAuth(key) {
  return { Authorization: `Bearer ${key}` };
}

describe('room chat', () => {
  test('a message round-trips to the sender', async () => {
    const { ws } = await joinRoom('ChatHost');
    send(ws, { type: 'message', text: 'hello world' });
    const echoed = await waitFor(ws, (m) => m.type === 'message' && m.text === 'hello world');
    assert.equal(echoed.name, 'ChatHost');
  });

  test('flood of messages is rate-limited (RATE_LIMIT_MAX_MESSAGES=8 per window)', async () => {
    const { ws } = await joinRoom('FloodHost');
    let count = 0;
    const handler = (data) => { const m = JSON.parse(data); if (m.type === 'message' && m.text?.startsWith('spam')) count++; };
    ws.on('message', handler);
    for (let i = 0; i < 15; i++) send(ws, { type: 'message', text: 'spam' + i });
    await sleep(500);
    ws.off('message', handler);
    assert.ok(count > 0 && count <= 8, `expected 1-8 messages through, got ${count}`);
  });

  test('flood of typing events is rate-limited (shares the same gate as chat messages)', async () => {
    const { ws, code } = await joinRoom('TypingFloodHost');
    const other = await joinExistingRoom('TypingFloodWatcher', code);
    let count = 0;
    const handler = (data) => { const m = JSON.parse(data); if (m.type === 'typing') count++; };
    other.on('message', handler);
    for (let i = 0; i < 15; i++) send(ws, { type: 'typing' });
    await sleep(500);
    other.off('message', handler);
    assert.ok(count > 0 && count <= 8, `expected 1-8 typing broadcasts through, got ${count}`);
  });

  // 'read' had no throttle at all despite doing a real DB write (setReadReceipt) plus a room-wide
  // broadcast on every call. Uses the generous per-stroke gate (40/2s), not the standard 8/6s
  // chat one — a legitimate 'read' fires once per *incoming* message, which in a busy room is
  // bounded by the room's aggregate traffic, not any single sender's own rate.
  test('flood of read receipts is rate-limited (generous per-stroke gate, not the tight chat one)', async () => {
    const { ws: host, code } = await joinRoom('ReadFloodHost');
    const other = await joinExistingRoom('ReadFloodWatcher', code);
    send(host, { type: 'message', text: 'read me' });
    const posted = await waitFor(host, (m) => m.type === 'message' && m.text === 'read me');
    let count = 0;
    const handler = (data) => { const m = JSON.parse(data); if (m.type === 'read-receipt') count++; };
    other.on('message', handler);
    for (let i = 0; i < 45; i++) send(host, { type: 'read', messageId: posted.id });
    await sleep(500);
    other.off('message', handler);
    assert.ok(count > 0 && count <= 40, `expected 1-40 read-receipt broadcasts through (of 45 sent), got ${count}`);
  });

  test('flood of set-name/set-status/set-avatar profile changes is rate-limited (shares the same gate)', async () => {
    const { ws } = await joinRoom('ProfileFloodHost');
    let updateCount = 0;
    const handler = (data) => { const m = JSON.parse(data); if (m.type === 'profile-updated') updateCount++; };
    ws.on('message', handler);
    for (let i = 0; i < 15; i++) send(ws, { type: 'set-status', status: 'status ' + i });
    await sleep(500);
    ws.off('message', handler);
    assert.ok(updateCount > 0 && updateCount <= 8, `expected 1-8 profile-updated echoes through, got ${updateCount}`);
  });

  test('read receipts are ignored for a message id from another room', async () => {
    const { ws: hostA } = await joinRoom('ReadReceiptHostA');
    send(hostA, { type: 'message', text: 'a message in room A' });
    const msgA = await waitFor(hostA, (m) => m.type === 'message' && m.text === 'a message in room A');

    const { ws: hostB, code: codeB } = await joinRoom('ReadReceiptHostB');
    const watcherB = await joinExistingRoom('ReadReceiptWatcherB', codeB);
    await sleep(150);

    let receiptSeen = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'read-receipt') receiptSeen = true; };
    watcherB.on('message', h);
    // Room B's client tries to mark room A's message as read — ids are opaque, so nothing stops
    // a client from sending an arbitrary string here.
    send(hostB, { type: 'read', messageId: msgA.id });
    await sleep(300);
    watcherB.off('message', h);
    assert.equal(receiptSeen, false, 'a message id from a different room must not produce a read-receipt broadcast');

    // Sanity check: a real, same-room message id still works.
    send(hostB, { type: 'message', text: 'a message in room B' });
    const msgB = await waitFor(hostB, (m) => m.type === 'message' && m.text === 'a message in room B');
    const receiptPromise = waitFor(watcherB, (m) => m.type === 'read-receipt' && m.messageId === msgB.id);
    send(hostB, { type: 'read', messageId: msgB.id });
    const receipt = await receiptPromise;
    assert.equal(receipt.name, 'ReadReceiptHostB');
  });

  // Found by a read-receipt-integrity audit: read_receipts was faithfully persisted on every
  // real 'read' (correct identity, correct room-scoping, rate-limited) but never read back —
  // joined-room hydrates reactions/pins from the DB but was missing the equivalent for read
  // receipts, so a client joining/reconnecting saw no "seen by" info until each other member's
  // next natural read event happened to re-fire it.
  test('joined-room hydrates read receipts persisted before this connection joined', async () => {
    const { ws: host, code } = await joinRoom('ReadHydrateHost');
    const watcher = await joinExistingRoom('ReadHydrateWatcher', code);
    send(host, { type: 'message', text: 'read before you join' });
    const posted = await waitFor(host, (m) => m.type === 'message' && m.text === 'read before you join');
    const receiptPromise = waitFor(host, (m) => m.type === 'read-receipt' && m.messageId === posted.id);
    send(watcher, { type: 'read', messageId: posted.id });
    await receiptPromise;

    // A fresh connection joins the SAME room afterward — its own joined-room payload must
    // already include the watcher's persisted receipt, not just future live broadcasts.
    const lateJoiner = await connectWs();
    send(lateJoiner, { type: 'join-server', username: 'ReadHydrateLate' });
    await waitFor(lateJoiner, (m) => m.type === 'joined-server');
    send(lateJoiner, { type: 'join-room', code });
    const joined = await waitFor(lateJoiner, (m) => m.type === 'joined-room');
    const receipt = (joined.readReceipts || []).find((r) => r.name === 'ReadHydrateWatcher');
    assert.ok(receipt, 'joined-room must include a persisted read receipt from before this connection joined');
    assert.equal(receipt.messageId, posted.id);

    host.close(); watcher.close(); lateJoiner.close();
  });

  test('reactions round-trip', async () => {
    const { ws } = await joinRoom('ReactHost');
    send(ws, { type: 'message', text: 'react to me' });
    const echoed = await waitFor(ws, (m) => m.type === 'message' && m.text === 'react to me');
    send(ws, { type: 'react', messageId: echoed.id, emoji: '👍' });
    const reacted = await waitFor(ws, (m) => m.type === 'reaction' && m.messageId === echoed.id);
    assert.equal(reacted.emoji, '👍');
  });

  // Found by a reaction-integrity audit: unlike edit-message/delete-message (both already refuse
  // to act on an already-deleted message), react didn't check target.deleted — letting a
  // reaction badge appear on a "message deleted" placeholder. Cosmetic only, not a security gap
  // (still correctly self- and room-scoped either way), fixed for consistency with its siblings.
  test('reacting to an already-deleted message is a no-op', async () => {
    const { ws } = await joinRoom('ReactDeletedHost');
    send(ws, { type: 'message', text: 'delete me then react' });
    const echoed = await waitFor(ws, (m) => m.type === 'message' && m.text === 'delete me then react');
    send(ws, { type: 'delete-message', messageId: echoed.id });
    await waitFor(ws, (m) => m.type === 'message-deleted' && m.messageId === echoed.id);

    let sawReaction = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'reaction' && m.messageId === echoed.id) sawReaction = true; };
    ws.on('message', h);
    send(ws, { type: 'react', messageId: echoed.id, emoji: '👍' });
    await sleep(300);
    ws.off('message', h);
    assert.equal(sawReaction, false, 'reacting to a deleted message must not broadcast a reaction');
  });

  // Posting 55 real-time messages through the flood gate would take the better part of a minute
  // for something that's really a db.js query-shape question — inserted directly into the
  // scratch server's own isolated DB (via its db.js, in-process) instead, same as how this fix
  // was originally verified. path.join(server.dir, 'db.js') is a *different* module instance
  // than ../db.js (Node's require cache is keyed by resolved path), so this exercises the exact
  // code the running test server was started from, not a stale copy.
  test('reactions on messages outside the visible history window are excluded from a fresh join', async () => {
    const scratchDb = require(require('node:path').join(server.dir, 'db.js'));
    const code = 'REACTCAP1';
    scratchDb.upsertRoom(code);
    let firstId = null, lastId = null;
    for (let i = 1; i <= 55; i++) {
      const id = require('node:crypto').randomUUID();
      scratchDb.insertMessage({ id, roomCode: code, name: 'Host', text: 'm' + i, mediaUrl: null, mediaType: null, at: Date.now() + i, accountId: null });
      if (i === 1) firstId = id;
      if (i === 55) lastId = id;
    }
    scratchDb.toggleReaction(firstId, '👍', 'Host');
    scratchDb.toggleReaction(lastId, '🔥', 'Host');

    const joiner = await connectWs();
    send(joiner, { type: 'join-server', username: 'ReactCapJoiner' });
    await waitFor(joiner, (m) => m.type === 'joined-server');
    send(joiner, { type: 'join-room', code });
    const joined = await waitFor(joiner, (m) => m.type === 'joined-room');

    assert.ok(!joined.reactions.some((r) => r.messageId === firstId), 'reaction on a message outside the 50-window should be excluded');
    assert.ok(joined.reactions.some((r) => r.messageId === lastId), 'reaction on a message inside the 50-window should be included');
  });
});

describe('friends', () => {
  let aliceToken, bobToken;
  before(async () => {
    const a = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'FriendAlice', password: 'pass1234', email: 'friendalice@test.com' }),
    }).then((r) => r.json());
    const b = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'FriendBob', password: 'pass1234', email: 'friendbob@test.com' }),
    }).then((r) => r.json());
    aliceToken = a.token;
    bobToken = b.token;
  });

  test('friend request → accept → remove → block → unblock all succeed', async () => {
    const reqRes = await fetch(`${BASE_URL}/friends/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ username: 'FriendBob' }),
    });
    assert.equal(reqRes.status, 200);

    const acceptRes = await fetch(`${BASE_URL}/friends/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({ username: 'FriendAlice' }),
    });
    assert.equal(acceptRes.status, 200);

    const removeRes = await fetch(`${BASE_URL}/friends/remove`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ username: 'FriendBob' }),
    });
    assert.equal(removeRes.status, 200);

    const blockRes = await fetch(`${BASE_URL}/friends/block`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ username: 'FriendBob' }),
    });
    assert.equal(blockRes.status, 200);

    const unblockRes = await fetch(`${BASE_URL}/friends/unblock`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ username: 'FriendBob' }),
    });
    assert.equal(unblockRes.status, 200);
  });

  test('cannot friend-request without auth', async () => {
    const res = await fetch(`${BASE_URL}/friends/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'FriendBob' }),
    });
    assert.equal(res.status, 401);
  });

  test('cannot friend-request a nonexistent user', async () => {
    const res = await fetch(`${BASE_URL}/friends/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ username: 'NoSuchUser' }),
    });
    assert.equal(res.status, 404);
  });

  test('cannot block yourself', async () => {
    const res = await fetch(`${BASE_URL}/friends/block`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ username: 'FriendAlice' }),
    });
    assert.equal(res.status, 400);
  });

  // The test above this one only ever checked that /friends/block itself returns 200 — never that
  // blocking actually stops anything. A blocked party retrying a friend request is the most basic
  // real-world case a block exists to prevent.
  test('a block actually prevents the blocked party from sending a new friend request', async () => {
    const signup = async (username, email) => fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'pass1234', email }),
    }).then((r) => r.json());
    const blocker = await signup('BlockEnforceA', 'blockenforcea@test.com');
    const blocked = await signup('BlockEnforceB', 'blockenforceb@test.com');

    const blockRes = await fetch(`${BASE_URL}/friends/block`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${blocker.token}` },
      body: JSON.stringify({ username: 'BlockEnforceB' }),
    });
    assert.equal(blockRes.status, 200);

    const reqRes = await fetch(`${BASE_URL}/friends/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${blocked.token}` },
      body: JSON.stringify({ username: 'BlockEnforceA' }),
    });
    assert.equal(reqRes.status, 403, 'the blocked party must not be able to send a fresh friend request to the blocker');

    // The block is symmetric (isBlockedBetween checks both directions) — the blocker also can't
    // "friend request" their way around their own block.
    const reverseReqRes = await fetch(`${BASE_URL}/friends/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${blocker.token}` },
      body: JSON.stringify({ username: 'BlockEnforceB' }),
    });
    assert.equal(reverseReqRes.status, 403);
  });

  test('signing into a different account on the same connection does not leave the previous account stuck showing online', async () => {
    const signup = async (username, email) => fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'pass1234', email }),
    }).then((r) => r.json());
    const a = await signup('SwitchA', 'switcha@test.com');
    const b = await signup('SwitchB', 'switchb@test.com');
    await fetch(`${BASE_URL}/friends/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.token}` },
      body: JSON.stringify({ username: 'SwitchB' }),
    });
    await fetch(`${BASE_URL}/friends/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${b.token}` },
      body: JSON.stringify({ username: 'SwitchA' }),
    });

    // One connection signs in as Account A first.
    const ws = await connectWs();
    send(ws, { type: 'join-server', username: 'SwitchA', accountToken: a.token });
    await waitFor(ws, (m) => m.type === 'joined-server');

    const presence1 = await fetch(`${BASE_URL}/friends/presence`, { headers: { Authorization: `Bearer ${b.token}` } }).then((r) => r.json());
    assert.equal(presence1.presence.find((p) => p.username === 'SwitchA').online, true);

    // The SAME still-open connection now signs into Account B instead, with no disconnect in
    // between — this is exactly what app.js's signOutAccount + re-send-join-server flow does
    // when switching accounts mid-session (see registerAccountConnection in server.js).
    send(ws, { type: 'join-server', username: 'SwitchB', accountToken: b.token });
    await waitFor(ws, (m) => m.type === 'joined-server');

    const presence2 = await fetch(`${BASE_URL}/friends/presence`, { headers: { Authorization: `Bearer ${b.token}` } }).then((r) => r.json());
    assert.equal(presence2.presence.find((p) => p.username === 'SwitchA').online, false, 'Account A must not stay stuck online after this connection switched to Account B');

    ws.close();
  });
});

describe('room moderation', () => {
  test('only the host can kick/mute/ban; the host cannot target themself', async () => {
    const { ws: host, code } = await joinRoom('ModHost');
    const guest = await joinExistingRoom('ModGuest', code);
    await sleep(150);

    let guestMuteWorked = false;
    const h1 = (data) => { const m = JSON.parse(data); if (m.type === 'user-muted') guestMuteWorked = true; };
    guest.on('message', h1);
    send(guest, { type: 'mute-user', name: 'ModHost' });
    await sleep(300);
    guest.off('message', h1);
    assert.equal(guestMuteWorked, false, 'a non-host should not be able to mute anyone');

    let selfMuteWorked = false;
    const h2 = (data) => { const m = JSON.parse(data); if (m.type === 'user-muted' && m.name === 'ModHost') selfMuteWorked = true; };
    host.on('message', h2);
    send(host, { type: 'mute-user', name: 'ModHost' });
    await sleep(300);
    host.off('message', h2);
    assert.equal(selfMuteWorked, false, 'the host should not be able to mute themself');

    send(host, { type: 'mute-user', name: 'ModGuest' });
    const muted = await waitFor(host, (m) => m.type === 'user-muted');
    assert.equal(muted.name, 'ModGuest');
  });

  test('kick disconnects the target', async () => {
    const { ws: host, code } = await joinRoom('KickHost');
    const guest = await joinExistingRoom('KickGuest', code);
    await sleep(150);
    send(host, { type: 'kick-user', name: 'KickGuest' });
    const kicked = await waitFor(guest, (m) => m.type === 'kicked');
    assert.equal(kicked.by, 'KickHost');
  });

  test('ban prevents rejoining under the same name', async () => {
    const { ws: host, code } = await joinRoom('BanHost');
    const guest = await joinExistingRoom('BanGuest', code);
    await sleep(150);
    send(host, { type: 'ban-user', name: 'BanGuest' });
    await sleep(300);
    const rejoin = await connectWs();
    send(rejoin, { type: 'join-server', username: 'BanGuest' });
    await waitFor(rejoin, (m) => m.type === 'joined-server');
    send(rejoin, { type: 'join-room', code });
    const result = await waitFor(rejoin, (m) => m.type === 'join-error' || m.type === 'joined-room');
    assert.equal(result.type, 'join-error');
  });

  // mute-user/ban-user (the forward direction) were already covered above — unmute/unban/get-bans
  // (their reverse) had zero coverage despite being the same host-only-gate shape.
  test('mute actually blocks messages; unmute lifts it and is host-only', async () => {
    const { ws: host, code } = await joinRoom('UnmuteHost');
    const guest = await joinExistingRoom('UnmuteGuest', code);
    await sleep(150);

    // roomUsers()'s `muted` field (and the presence broadcast mute/unmute now fire, added
    // alongside the client-side mute-button toggle that reads it) is what lets a host's own UI
    // flip between mute/unmute — verify both the field and that it actually refreshes promptly.
    const presenceAfterMute = waitFor(host, (m) => m.type === 'presence');
    send(host, { type: 'mute-user', name: 'UnmuteGuest' });
    await waitFor(host, (m) => m.type === 'user-muted');
    const presence1 = await presenceAfterMute;
    assert.equal(presence1.users.find((u) => u.name === 'UnmuteGuest').muted, true, 'roomUsers must report the target as muted right after mute-user');
    send(guest, { type: 'message', text: 'should be blocked' });
    const blocked = await waitFor(guest, (m) => m.type === 'error' || (m.type === 'message' && m.text === 'should be blocked'));
    assert.equal(blocked.type, 'error', 'a muted user\'s message must be rejected, not echoed');

    // A non-host unmute attempt must be a silent no-op.
    let guestUnmuteWorked = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'user-unmuted') guestUnmuteWorked = true; };
    guest.on('message', h);
    send(guest, { type: 'unmute-user', name: 'UnmuteGuest' });
    await sleep(250);
    guest.off('message', h);
    assert.equal(guestUnmuteWorked, false, 'a non-host should not be able to unmute anyone, even themself');

    const presenceAfterUnmute = waitFor(host, (m) => m.type === 'presence');
    send(host, { type: 'unmute-user', name: 'UnmuteGuest' });
    const unmuted = await waitFor(host, (m) => m.type === 'user-unmuted');
    assert.equal(unmuted.name, 'UnmuteGuest');
    const presence2 = await presenceAfterUnmute;
    assert.equal(presence2.users.find((u) => u.name === 'UnmuteGuest').muted, false, 'roomUsers must report the target as no longer muted right after unmute-user');
    send(guest, { type: 'message', text: 'should go through now' });
    const echoed = await waitFor(guest, (m) => m.type === 'message' && m.text === 'should go through now');
    assert.equal(echoed.text, 'should go through now', 'unmute must actually restore the ability to post');
  });

  test('get-bans/unban-user are host-only; unban actually lets the target rejoin', async () => {
    const { ws: host, code } = await joinRoom('UnbanHost');
    const guest = await joinExistingRoom('UnbanGuest', code);
    await sleep(150);
    send(host, { type: 'ban-user', name: 'UnbanGuest' });
    await sleep(300);

    // A non-host get-bans/unban-user attempt must be a silent no-op.
    let nonHostGotBans = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'bans-result') nonHostGotBans = true; };
    guest.on('message', h);
    send(guest, { type: 'get-bans' });
    await sleep(250);
    guest.off('message', h);
    assert.equal(nonHostGotBans, false, 'a non-host must not be able to see the ban list');

    send(host, { type: 'get-bans' });
    const bansResult = await waitFor(host, (m) => m.type === 'bans-result');
    const ban = bansResult.bans.find((b) => b.target_name === 'UnbanGuest');
    assert.ok(ban, 'the ban list must contain the just-issued ban');

    send(host, { type: 'unban-user', banId: ban.id });
    const afterUnban = await waitFor(host, (m) => m.type === 'bans-result');
    assert.ok(!afterUnban.bans.some((b) => b.target_name === 'UnbanGuest'), 'unban must actually remove the ban row');

    const rejoin = await connectWs();
    send(rejoin, { type: 'join-server', username: 'UnbanGuest' });
    await waitFor(rejoin, (m) => m.type === 'joined-server');
    send(rejoin, { type: 'join-room', code });
    const result = await waitFor(rejoin, (m) => m.type === 'join-error' || m.type === 'joined-room');
    assert.equal(result.type, 'joined-room', 'the unbanned target must actually be able to rejoin now');
    rejoin.close();
  });

  // unbanFromRoom used to delete by ban id alone, with no room_code check — every other id-based
  // handler in this app (delete-message, pin-message, etc.) already scopes to the caller's own
  // room, but this one didn't. Found by an authorization-enforcement audit.
  test('unban-user cannot be used to lift a ban belonging to a DIFFERENT room', async () => {
    const roomA = await joinRoom('UnbanScopeHostA');
    const roomB = await joinRoom('UnbanScopeHostB');
    const targetInA = await joinExistingRoom('UnbanScopeTarget', roomA.code);
    await sleep(150);

    send(roomA.ws, { type: 'ban-user', name: 'UnbanScopeTarget' });
    await sleep(300);
    send(roomA.ws, { type: 'get-bans' });
    const bansA = await waitFor(roomA.ws, (m) => m.type === 'bans-result');
    const ban = bansA.bans.find((b) => b.target_name === 'UnbanScopeTarget');
    assert.ok(ban, 'the ban must exist in room A');

    // Host B (a different room entirely) tries to unban using room A's ban id.
    send(roomB.ws, { type: 'unban-user', banId: ban.id });
    await sleep(300);

    // The ban must still be present in room A — host B's attempt must not have touched it.
    send(roomA.ws, { type: 'get-bans' });
    const bansAfter = await waitFor(roomA.ws, (m) => m.type === 'bans-result');
    assert.ok(bansAfter.bans.some((b) => b.id === ban.id), "a different room's host must not be able to lift this room's ban");

    targetInA.close();
  });
});

describe('room host identity cannot be spoofed via a matching display name', () => {
  // Found by a room-host/moderation-powers audit: host_name is a client-supplied, unauthenticated
  // display-name string with no uniqueness enforcement. join-room's own same-name eviction (any two
  // connections sharing a display name — "Reconnected from another tab") has no account check, so
  // before this fix, an attacker could join using the exact same display name as a signed-in host,
  // force-disconnect that host's live connection, and have their OWN connection now satisfy the old
  // host_name === ws.profile.name check — full host powers, with the real host actively locked out,
  // not merely impersonating an absent one. Fixed by keying host status off host_account_id
  // (isRoomHost in server.js) whenever the room's creator was signed in.
  test('an attacker joining with the host\'s exact display name does not gain host status, and the real host keeps it under any display name', async () => {
    const signup = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'HostSpoofOwner', password: 'password123', email: 'hostspoofowner@test.com' }),
    }).then((r) => r.json());

    const host = await connectWs();
    send(host, { type: 'join-server', username: 'HostSpoofVictim', accountToken: signup.token });
    await waitFor(host, (m) => m.type === 'joined-server');
    send(host, { type: 'create-room' });
    const created = await waitFor(host, (m) => m.type === 'joined-room');
    assert.equal(created.isHost, true, 'the real signed-in creator must be host');
    const code = created.code;

    // Attacker: same display name, no account of their own. This join legitimately evicts the
    // real host's connection via the pre-existing "Reconnected from another tab" mechanism (that
    // part is intended multi-tab behavior) — what must NOT happen is the attacker's own connection
    // inheriting host status just because the display-name string matches.
    const attacker = await connectWs();
    send(attacker, { type: 'join-server', username: 'HostSpoofVictim' });
    await waitFor(attacker, (m) => m.type === 'joined-server');
    send(attacker, { type: 'join-room', code });
    const attackerJoined = await waitFor(attacker, (m) => m.type === 'joined-room');
    assert.equal(attackerJoined.isHost, false, 'a name-only match must not grant host status to a different account/connection');

    // Confirm it's not just the reported flag that's wrong — an actual host-only action must be
    // refused too.
    let renamed = null;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'room-renamed') renamed = m; };
    attacker.on('message', h);
    send(attacker, { type: 'rename-room', name: 'Attacker Owns This Now' });
    await sleep(250);
    attacker.off('message', h);
    assert.equal(renamed, null, 'the attacker must not be able to exercise host-only actions either');

    // The real host, reconnecting under a DIFFERENT display name (same account), must still be
    // recognized as host — status is keyed off host_account_id, not the current name string.
    const hostReturns = await connectWs();
    send(hostReturns, { type: 'join-server', username: 'HostSpoofVictimReturns', accountToken: signup.token });
    await waitFor(hostReturns, (m) => m.type === 'joined-server');
    send(hostReturns, { type: 'join-room', code });
    const rejoinMsg = await waitFor(hostReturns, (m) => m.type === 'joined-room');
    assert.equal(rejoinMsg.isHost, true, 'the real host must still be recognized as host after reconnecting under a new display name');

    attacker.close();
    hostReturns.close();
  });

  // Found by the same audit: renameRoomHostIfMatches used to be scoped to code+oldName (only the
  // room the rename happened to occur in) — a signed-in host renaming while sitting in a DIFFERENT
  // room, or in no room at all, silently left every room they actually host still pointing at the
  // stale pre-rename host_name.
  test('renaming while in no room at all still updates host_name for every room that account hosts', async () => {
    const scratchDb = require(require('node:path').join(server.dir, 'db.js'));
    const signup = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'HostRenameOwner', password: 'password123', email: 'hostrenameowner@test.com' }),
    }).then((r) => r.json());

    const ws = await connectWs();
    send(ws, { type: 'join-server', username: 'HostRenameOld', accountToken: signup.token });
    await waitFor(ws, (m) => m.type === 'joined-server');
    send(ws, { type: 'create-room' });
    const created = await waitFor(ws, (m) => m.type === 'joined-room');
    const code = created.code;

    send(ws, { type: 'leave-room' });
    await waitFor(ws, (m) => m.type === 'left-room');

    send(ws, { type: 'set-name', name: 'HostRenameNew' });
    await waitFor(ws, (m) => m.type === 'name-updated');
    await sleep(150);

    const roomRow = scratchDb.getRoom(code);
    assert.equal(roomRow.host_name, 'HostRenameNew', 'host_name must be updated even though the rename happened while the account was in no room at all');
    ws.close();
  });
});

// Found by a moderation-enforcement-consistency audit: room ban/mute were only ever enforced on
// the real chat page's own connection (join-room, message, send-dm, etc.) — every minigame opens
// its own independent WebSocket from its own page (see bc-join's comment in server.js) and none
// of the 12 *-join handlers checked isBannedFromRoom, and the two minigame free-text channels
// (bc-chat, dg-guess) never checked room.muted either. Tested representatively (bc-join/bc-chat,
// one *-join-error shape, and dg-guess's scoring-vs-chat split) rather than exhaustively re-testing
// all 12 join handlers individually — they share one identical fix shape, same proportional-effort
// call this app's own test suite has made elsewhere for byte-for-byte identical fixes.
describe('minigame moderation enforcement', () => {
  test('a room-banned user cannot join a minigame session (bc-join), even having never joined chat', async () => {
    const { ws: host, code } = await joinRoom('MgBanHost');
    send(host, { type: 'ban-user', name: 'MgBanTarget' });
    await sleep(200);

    const target = await connectWs();
    send(target, { type: 'bc-join', code, name: 'MgBanTarget' });
    const result = await waitFor(target, (m) => m.type === 'bc-join-error' || m.type === 'bc-init');
    assert.equal(result.type, 'bc-join-error', 'a banned name must be rejected from Build Craft the same way join-room rejects it');
  });

  test('a room-banned user cannot join a second minigame either (dg-join) — the fix is not bc-only', async () => {
    const { ws: host, code } = await joinRoom('MgBanHost2');
    send(host, { type: 'ban-user', name: 'MgBanTarget2' });
    await sleep(200);

    const target = await connectWs();
    send(target, { type: 'dg-join', code, name: 'MgBanTarget2' });
    const result = await waitFor(target, (m) => m.type === 'dg-join-error' || m.type === 'dg-init');
    assert.equal(result.type, 'dg-join-error');
  });

  test('mute silences Build Craft in-game chat the same way it silences real chat', async () => {
    const { ws: host, code } = await joinRoom('BcMuteHost');
    const muted = await connectWs();
    send(muted, { type: 'bc-join', code, name: 'BcMuteTarget' });
    await waitFor(muted, (m) => m.type === 'bc-init');
    const bystander = await connectWs();
    send(bystander, { type: 'bc-join', code, name: 'BcMuteBystander' });
    await waitFor(bystander, (m) => m.type === 'bc-init');

    send(host, { type: 'mute-user', name: 'BcMuteTarget' });
    await waitFor(host, (m) => m.type === 'user-muted');

    let sawChat = false;
    const h = (data) => { if (JSON.parse(data).type === 'bc-chat') sawChat = true; };
    bystander.on('message', h);
    send(muted, { type: 'bc-chat', text: 'should not be seen' });
    await sleep(300);
    bystander.off('message', h);
    assert.equal(sawChat, false, "a muted player's Build Craft chat must not reach other players");
  });

  test('mute silences Pictionary guess-chat but does not block scoring a correct guess', async () => {
    const { ws: host, code } = await joinRoom('DgMuteHost');
    const drawer = await connectWs();
    send(drawer, { type: 'dg-join', code, name: 'DgMuteDrawer' });
    await waitFor(drawer, (m) => m.type === 'dg-init');
    const guesser = await connectWs();
    send(guesser, { type: 'dg-join', code, name: 'DgMuteGuesser' });
    await waitFor(guesser, (m) => m.type === 'dg-init');
    await sleep(150);

    send(host, { type: 'mute-user', name: 'DgMuteGuesser' });
    await waitFor(host, (m) => m.type === 'user-muted');

    send(drawer, { type: 'dg-start' });
    const wordPromise = waitFor(drawer, (m) => m.type === 'dg-word');
    await waitFor(guesser, (m) => m.type === 'dg-round-start');
    const { word } = await wordPromise;

    let sawWrongChat = false;
    const h = (data) => { if (JSON.parse(data).type === 'dg-guess-chat') sawWrongChat = true; };
    drawer.on('message', h);
    send(guesser, { type: 'dg-guess', text: 'definitelywrong' });
    await sleep(300);
    drawer.off('message', h);
    assert.equal(sawWrongChat, false, "a muted guesser's wrong-guess text must not broadcast as chat");

    send(guesser, { type: 'dg-guess', text: word });
    const correct = await waitFor(guesser, (m) => m.type === 'dg-correct' && m.name === 'DgMuteGuesser', 2000);
    assert.equal(correct.points, 3, 'mute silences chat only — the guessing mechanic itself must still work and still score');
  });

  test('ban evicts a target from an in-progress minigame session, not just the chat room', async () => {
    const signup = async (username, email) => fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'pass1234', email }),
    }).then((r) => r.json());
    const acct = await signup('BcEvictTarget', 'bcevicttarget@test.com');

    const { ws: host, code } = await joinRoom('BcEvictHost');
    // Same connection does both a real chat join (so ban-user can resolve its accountId the
    // normal way, via room.clients) and a bc-join (so it's also tracked as a live Build Craft
    // participant) — verifying the actual invariant under test (an account-linked connection
    // present in a minigame session gets closed when banned), not the separate-connection
    // architecture minigames normally use client-side, which is a client detail, not a server one.
    const target = await joinAsAccount('BcEvictTarget', acct.token, code);
    send(target, { type: 'bc-join', code, name: 'BcEvictTarget' });
    await waitFor(target, (m) => m.type === 'bc-init');

    const bystander = await connectWs();
    send(bystander, { type: 'bc-join', code, name: 'BcEvictBystander' });
    await waitFor(bystander, (m) => m.type === 'bc-init');

    const leftPromise = waitFor(bystander, (m) => m.type === 'bc-player-left', 3000);
    const closePromise = new Promise((resolve) => target.on('close', resolve));
    send(host, { type: 'ban-user', name: 'BcEvictTarget' });
    await leftPromise;
    await closePromise;
  });
});

describe('room rename requires host', () => {
  test('non-host rename is silently rejected; host rename works', async () => {
    const { ws: host, code } = await joinRoom('RenameHost');
    const guest = await joinExistingRoom('RenameGuest', code);
    await sleep(150);

    let guestRenameWorked = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'room-renamed' && m.name === 'Hacked') guestRenameWorked = true; };
    guest.on('message', h);
    send(guest, { type: 'rename-room', name: 'Hacked' });
    await sleep(300);
    guest.off('message', h);
    assert.equal(guestRenameWorked, false);

    send(host, { type: 'rename-room', name: 'Legit Name' });
    const renamed = await waitFor(host, (m) => m.type === 'room-renamed');
    assert.equal(renamed.name, 'Legit Name');
  });
});

describe('room PIN actually gates join-room', () => {
  test('no PIN is rejected, wrong PIN is rejected, correct PIN joins', async () => {
    const { ws: host, code } = await joinRoom('PinHost');
    send(host, { type: 'set-room-pin', pin: '4242' });
    await waitFor(host, (m) => m.type === 'room-pin-updated' && m.pinRequired === true);

    const noPin = await connectWs();
    send(noPin, { type: 'join-server', username: 'PinGuestNone' });
    await waitFor(noPin, (m) => m.type === 'joined-server');
    send(noPin, { type: 'join-room', code });
    const noPinResult = await waitFor(noPin, (m) => m.type === 'join-error' || m.type === 'joined-room');
    assert.equal(noPinResult.type, 'join-error', 'joining a PIN-locked room with no PIN must be rejected');
    assert.equal(noPinResult.pinRequired, true);

    const wrongPin = await connectWs();
    send(wrongPin, { type: 'join-server', username: 'PinGuestWrong' });
    await waitFor(wrongPin, (m) => m.type === 'joined-server');
    send(wrongPin, { type: 'join-room', code, pin: '0000' });
    const wrongPinResult = await waitFor(wrongPin, (m) => m.type === 'join-error' || m.type === 'joined-room');
    assert.equal(wrongPinResult.type, 'join-error', 'the wrong PIN must be rejected');

    const rightPin = await connectWs();
    send(rightPin, { type: 'join-server', username: 'PinGuestRight' });
    await waitFor(rightPin, (m) => m.type === 'joined-server');
    send(rightPin, { type: 'join-room', code, pin: '4242' });
    const rightPinResult = await waitFor(rightPin, (m) => m.type === 'join-error' || m.type === 'joined-room');
    assert.equal(rightPinResult.type, 'joined-room', 'the correct PIN must actually let the join through');

    noPin.close(); wrongPin.close(); rightPin.close();
  });

  // roomPinOk switched from a naive === to crypto.timingSafeEqual (avoids a timing side-channel
  // leaking how many leading characters of a guessed PIN were correct) — timingSafeEqual throws if
  // the two buffers aren't the same length, which a length check must guard against first. A PIN
  // shorter or longer than the real one is exactly the input that would trigger that throw if the
  // guard were missing or wrong, so it's worth its own case rather than relying on the same-length
  // '0000' vs '4242' mismatch above to exercise this.
  test('a PIN of a different length than the real one is rejected, not a server error', async () => {
    const { ws: host, code } = await joinRoom('PinLenHost');
    send(host, { type: 'set-room-pin', pin: '4242' });
    await waitFor(host, (m) => m.type === 'room-pin-updated' && m.pinRequired === true);

    const shortPin = await connectWs();
    send(shortPin, { type: 'join-server', username: 'PinLenShort' });
    await waitFor(shortPin, (m) => m.type === 'joined-server');
    send(shortPin, { type: 'join-room', code, pin: '42' });
    const shortResult = await waitFor(shortPin, (m) => m.type === 'join-error' || m.type === 'joined-room');
    assert.equal(shortResult.type, 'join-error', 'a shorter-than-real PIN must be rejected, not crash the handler');

    const longPin = await connectWs();
    send(longPin, { type: 'join-server', username: 'PinLenLong' });
    await waitFor(longPin, (m) => m.type === 'joined-server');
    send(longPin, { type: 'join-room', code, pin: '424242' });
    const longResult = await waitFor(longPin, (m) => m.type === 'join-error' || m.type === 'joined-room');
    assert.equal(longResult.type, 'join-error', 'a longer-than-real PIN must be rejected, not crash the handler');

    shortPin.close(); longPin.close();
  });

  test('the HTTP /export route also enforces the PIN with a length-mismatched guess', async () => {
    const { ws: host, code } = await joinRoom('PinHttpHost');
    send(host, { type: 'set-room-pin', pin: '4242' });
    await waitFor(host, (m) => m.type === 'room-pin-updated' && m.pinRequired === true);

    const res = await fetch(`${BASE_URL}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, pin: '42' }),
    });
    assert.equal(res.status, 403, 'a length-mismatched PIN over HTTP must 403, not 500');
  });

  // Found by the room-settings/menu-panel correctness audit: joined-room never told the client
  // whether a PIN was currently set at all -- the host-only PIN form always showed the same blank
  // field/placeholder regardless of actual state.
  test('joined-room reports pinRequired accurately for both a plain room and a PIN-locked one', async () => {
    const { ws: plainHost, code: plainCode } = await joinRoom('PinFlagPlain');
    // create-room's own joined-room (inside joinRoom() above) already exercises the no-PIN case;
    // re-fetch via a fresh join to also cover the OTHER joined-room send site (server.js's
    // join-room handler, not create-room's).
    const rejoin = await connectWs();
    send(rejoin, { type: 'join-server', username: 'PinFlagPlainRejoin' });
    await waitFor(rejoin, (m) => m.type === 'joined-server');
    send(rejoin, { type: 'join-room', code: plainCode });
    const plainJoined = await waitFor(rejoin, (m) => m.type === 'joined-room');
    assert.equal(plainJoined.pinRequired, false);

    send(plainHost, { type: 'set-room-pin', pin: '9911' });
    await waitFor(plainHost, (m) => m.type === 'room-pin-updated' && m.pinRequired === true);

    const rightPin = await connectWs();
    send(rightPin, { type: 'join-server', username: 'PinFlagRight' });
    await waitFor(rightPin, (m) => m.type === 'joined-server');
    send(rightPin, { type: 'join-room', code: plainCode, pin: '9911' });
    const lockedJoined = await waitFor(rightPin, (m) => m.type === 'joined-room');
    assert.equal(lockedJoined.pinRequired, true);

    rejoin.close(); rightPin.close();
  });
});

describe('set-wallpaper/set-announcement are host-only and enforce the upload allowlist', () => {
  test('non-host attempts are silent no-ops; host changes broadcast; a non-/uploads/ wallpaper URL is dropped', async () => {
    const { ws: host, code } = await joinRoom('WallHost');
    const guest = await joinExistingRoom('WallGuest', code);
    await sleep(150);

    let guestWallpaperWorked = false;
    const h1 = (data) => { const m = JSON.parse(data); if (m.type === 'wallpaper-updated') guestWallpaperWorked = true; };
    guest.on('message', h1);
    send(guest, { type: 'set-wallpaper', url: '/uploads/guest-tried.jpg' });
    await sleep(250);
    guest.off('message', h1);
    assert.equal(guestWallpaperWorked, false, 'a non-host must not be able to set the wallpaper');

    let guestAnnouncementWorked = false;
    const h2 = (data) => { const m = JSON.parse(data); if (m.type === 'announcement-updated') guestAnnouncementWorked = true; };
    guest.on('message', h2);
    send(guest, { type: 'set-announcement', text: 'guest announcement' });
    await sleep(250);
    guest.off('message', h2);
    assert.equal(guestAnnouncementWorked, false, 'a non-host must not be able to set the announcement');

    // A raw WS client could claim any external URL as the wallpaper — must be silently dropped to null.
    send(host, { type: 'set-wallpaper', url: 'https://evil.example/tracker.gif' });
    const trackerResult = await waitFor(host, (m) => m.type === 'wallpaper-updated');
    assert.equal(trackerResult.url, null, 'a non-/uploads/ wallpaper URL must be rejected, not stored');

    send(host, { type: 'set-wallpaper', url: '/uploads/real-wallpaper.jpg' });
    const realResult = await waitFor(host, (m) => m.type === 'wallpaper-updated');
    assert.equal(realResult.url, '/uploads/real-wallpaper.jpg');

    send(host, { type: 'set-announcement', text: 'Host announcement' });
    const announced = await waitFor(host, (m) => m.type === 'announcement-updated');
    assert.equal(announced.text, 'Host announcement');
  });
});

describe('POST /auth/logout actually invalidates the session', () => {
  // This exact flow (signup/login/me/logout/logout-invalidates-token) was manually curl-verified
  // once when accounts were first built, per this app's own project notes — but never captured as
  // a permanent regression test, so a silent regression here (logout looking successful client-side
  // while the token stays valid — a real problem on a shared device) would go unnoticed.
  test('the bearer token stops working immediately after logout', async () => {
    const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'LogoutCheck', password: 'password123', email: 'logoutcheck@test.com' }),
    });
    const { token } = await signupRes.json();

    const before = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(before.status, 200, 'the freshly-issued token must work');
    assert.equal((await before.json()).username, 'LogoutCheck');

    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    assert.equal(logoutRes.status, 200);

    const after = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(after.status, 401, 'the same token must be rejected immediately after logout');
  });

  // Found by a credential-change-security audit: logout could previously only ever kill the
  // single token the caller already holds, giving a user no way to respond to a leaked/stolen
  // token for their own account from a device where they don't have that exact token.
  test('"everywhere" mode invalidates every session for the account, not just the one presented', async () => {
    const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'LogoutEverywhereChk', password: 'password123', email: 'logouteverywherecheck@test.com' }),
    });
    const { token: tokenA } = await signupRes.json();
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'LogoutEverywhereChk', password: 'password123' }),
    });
    const { token: tokenB } = await loginRes.json();
    assert.notEqual(tokenA, tokenB, 'sanity: login must mint a genuinely different token than signup did');

    const meA = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${tokenA}` } });
    assert.equal(meA.status, 200, 'sanity: both tokens must work before logout');

    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ everywhere: true }),
    });
    assert.equal(logoutRes.status, 200);

    const afterA = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${tokenA}` } });
    assert.equal(afterA.status, 401, 'a DIFFERENT session for the same account must also be invalidated by "everywhere" logout');
    const afterB = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${tokenB}` } });
    assert.equal(afterB.status, 401, 'the session that requested "everywhere" logout must itself be invalidated too');
  });
});

describe('join-server reports whether a supplied accountToken actually resolved', () => {
  // Found by the landing/room-join-flow correctness audit: an expired/invalid accountToken used
  // to be silently ignored by join-server — the client never learned its token was rejected, so
  // its account UI kept showing "signed in" indefinitely with cross-device sync/friends/push
  // quietly doing nothing. accountTokenInvalid on the joined-server response fixes that.
  test('accountTokenInvalid is true for a garbage token, false for a real one, and absent/false when no token is sent at all', async () => {
    const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'JoinTokenCheck', password: 'password123', email: 'jointokencheck@test.com' }),
    });
    const { token: realToken } = await signupRes.json();

    const withReal = await connectWs();
    send(withReal, { type: 'join-server', username: 'JoinTokenReal', accountToken: realToken });
    const realAck = await waitFor(withReal, (m) => m.type === 'joined-server');
    assert.equal(realAck.accountTokenInvalid, false, 'a real, currently-valid token must not be flagged invalid');

    const withGarbage = await connectWs();
    send(withGarbage, { type: 'join-server', username: 'JoinTokenGarbage', accountToken: 'not-a-real-token-at-all' });
    const garbageAck = await waitFor(withGarbage, (m) => m.type === 'joined-server');
    assert.equal(garbageAck.accountTokenInvalid, true, 'a token that resolves to no session must be flagged invalid');

    const withNone = await connectWs();
    send(withNone, { type: 'join-server', username: 'JoinTokenNone' });
    const noneAck = await waitFor(withNone, (m) => m.type === 'joined-server');
    assert.ok(!noneAck.accountTokenInvalid, 'no token supplied at all is not the same as an invalid one');
  });
});

describe('POST /account/password', () => {
  test('requires the correct current password, then invalidates every other session', async () => {
    const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'PasswordChangeCheck', password: 'password123', email: 'passwordchangecheck@test.com' }),
    });
    const { token: tokenA } = await signupRes.json();
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'PasswordChangeCheck', password: 'password123' }),
    });
    const { token: tokenB } = await loginRes.json();

    const wrongRes = await fetch(`${BASE_URL}/account/password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ currentPassword: 'not-the-real-password', newPassword: 'newpassword456' }),
    });
    assert.equal(wrongRes.status, 401, 'the wrong current password must be rejected');

    const changeRes = await fetch(`${BASE_URL}/account/password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ currentPassword: 'password123', newPassword: 'newpassword456' }),
    });
    assert.equal(changeRes.status, 200);
    const { token: freshToken } = await changeRes.json();
    assert.ok(freshToken, 'a successful password change must mint a fresh token for the requesting session');

    // The OTHER, previously-valid session (tokenB) must now be dead — this is the actual fix:
    // a stolen token stops working the moment the real owner changes their password.
    const bAfter = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${tokenB}` } });
    assert.equal(bAfter.status, 401, 'every other session must be invalidated by a real password change');

    // The requesting session's OLD token is also dead (superseded by the fresh one returned above)...
    const aOldAfter = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${tokenA}` } });
    assert.equal(aOldAfter.status, 401, "the requesting session's own pre-change token must not remain valid");
    // ...but the fresh token the response handed back works immediately, so that tab/device
    // doesn't get logged out by its own password change.
    const freshAfter = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${freshToken}` } });
    assert.equal(freshAfter.status, 200, 'the newly-issued token from the response must work immediately');

    // The new password must actually be the one that works now.
    const reloginOld = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'PasswordChangeCheck', password: 'password123' }),
    });
    assert.equal(reloginOld.status, 401, 'the old password must no longer work');
    const reloginNew = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'PasswordChangeCheck', password: 'newpassword456' }),
    });
    assert.equal(reloginNew.status, 200, 'the new password must work for a fresh login');
  });
});

describe('join-room host auto-claim on a legacy host-less room', () => {
  // A room can come into existence with no host_name at all — any minigame's own -join handler
  // (bb-join here) calls setRoomActivity -> db.upsertRoom for a fresh code without ever going
  // through the main chat's create-room flow that normally claims host immediately. This exercises
  // the join-room rewrite that consolidated three separate db.getRoom(code) calls into one reused
  // value, specifically the branch where host claiming happens mid-handler and the isHost field
  // sent back must reflect that same-request change rather than the stale pre-write row.
  test('the first chat joiner into a host-less room claims host; a second joiner does not', async () => {
    const code = 'HOSTCLAIM1';
    const bb = await connectWs();
    send(bb, { type: 'bb-join', code, level: 1 });
    await waitFor(bb, (m) => m.type === 'bb-init'); // creates the room DB row with no host_name

    const first = await connectWs();
    send(first, { type: 'join-server', username: 'HostClaimFirst' });
    await waitFor(first, (m) => m.type === 'joined-server');
    send(first, { type: 'join-room', code });
    const firstJoin = await waitFor(first, (m) => m.type === 'joined-room');
    assert.equal(firstJoin.isHost, true, 'the first chat joiner into a host-less room must claim host');

    const second = await connectWs();
    send(second, { type: 'join-server', username: 'HostClaimSecond' });
    await waitFor(second, (m) => m.type === 'joined-server');
    send(second, { type: 'join-room', code });
    const secondJoin = await waitFor(second, (m) => m.type === 'joined-room');
    assert.equal(secondJoin.isHost, false, 'a second joiner must not also claim host — it was already taken');

    bb.close(); first.close(); second.close();
  });
});

describe('/export and /search', () => {
  test('GET no longer works; POST requires the correct PIN', async () => {
    const { ws, code } = await joinRoom('ExportHost');
    send(ws, { type: 'set-room-pin', pin: '1234' });
    await waitFor(ws, (m) => m.type === 'room-pin-updated');
    send(ws, { type: 'message', text: 'exportable message' });
    await waitFor(ws, (m) => m.type === 'message' && m.text === 'exportable message');
    await sleep(150);

    const getRes = await fetch(`${BASE_URL}/export?code=${code}&pin=1234`);
    assert.equal(getRes.status, 404); // route no longer exists as GET

    const noPinRes = await fetch(`${BASE_URL}/export`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    assert.equal(noPinRes.status, 403);

    const okRes = await fetch(`${BASE_URL}/export`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, pin: '1234' }),
    });
    assert.equal(okRes.status, 200);
    const text = await okRes.text();
    assert.ok(text.includes('exportable message'));
  });

  // Found by a room-export-authorization audit: /export has no live WS session to check a ban
  // against (unlike join-room), the same shape /post-image and /post-media already solve — this
  // route had neither the check nor even the identity fields needed to run one.
  test('a room-banned user cannot export the room\'s history by name', async () => {
    const { ws: host, code } = await joinRoom('ExportBanHost');
    send(host, { type: 'message', text: 'should not be exportable to a banned user' });
    await waitFor(host, (m) => m.type === 'message' && m.text === 'should not be exportable to a banned user');
    send(host, { type: 'ban-user', name: 'ExportBanTarget' });
    await sleep(200);

    const bannedRes = await fetch(`${BASE_URL}/export`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'ExportBanTarget' }),
    });
    assert.equal(bannedRes.status, 403);

    // Sanity: an unrelated, non-banned name can still export normally.
    const legitRes = await fetch(`${BASE_URL}/export`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'ExportLegit' }),
    });
    assert.equal(legitRes.status, 200);
  });

  // /search has the identical "no live WS session to check a ban against" gap /export had —
  // same audit, same fix shape, applied here too.
  test('a room-banned user cannot search the room\'s history by name', async () => {
    const { ws: host, code } = await joinRoom('SearchBanHost');
    send(host, { type: 'message', text: 'searchable but should not be to a banned user' });
    await waitFor(host, (m) => m.type === 'message' && m.text === 'searchable but should not be to a banned user');
    send(host, { type: 'ban-user', name: 'SearchBanTarget' });
    await sleep(200);

    const bannedRes = await fetch(`${BASE_URL}/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, q: 'searchable', name: 'SearchBanTarget' }),
    });
    assert.equal(bannedRes.status, 403);

    const legitRes = await fetch(`${BASE_URL}/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, q: 'searchable', name: 'SearchLegit' }),
    });
    assert.equal(legitRes.status, 200);
  });
});

describe('minigame activity keeps a room from looking abandoned', () => {
  // Every minigame's own dedicated WebSocket (this test uses Build Craft, but setRoomActivity is
  // the one shared call site for all of them) never touches the main chat's join-room/message
  // paths that normally refresh rooms.last_active_at. A room reached only via a bookmarked
  // minigame link — real ongoing play, zero chat messages ever sent — must not look "inactive"
  // to cleanupInactiveRooms' 90-day sweep just because nobody ever opened the main chat page.
  test('bc-join refreshes rooms.last_active_at even with no chat activity in the room', async () => {
    const scratchDb = require(require('node:path').join(server.dir, 'db.js'));
    const code = 'ACTIVITYFRESH1';

    // First join establishes the room in the server's in-memory state — getOrCreateRoom's own
    // upsertRoom call on first touch would otherwise mask what this test is actually checking.
    const wsA = await connectWs();
    send(wsA, { type: 'bc-join', code, name: 'ActivityFreshA' });
    await waitFor(wsA, (m) => m.type === 'bc-init');

    // Push last_active_at far into the past directly, simulating a room that's gone stale from
    // the main chat's perspective but still has an ongoing minigame session.
    const Database = require('better-sqlite3');
    const rawDb = new Database(require('node:path').join(server.dir, 'valk.db'));
    const staleTs = Date.now() - 91 * 24 * 60 * 60 * 1000;
    rawDb.prepare('UPDATE rooms SET last_active_at = ? WHERE code = ?').run(staleTs, code);
    rawDb.close();

    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    assert.ok(scratchDb.getInactiveRoomCodes(cutoff).includes(code), 'room should look inactive before more minigame activity, confirming the test setup');

    // A second player joining the SAME already-in-memory room — getOrCreateRoom's own upsert
    // doesn't fire here, isolating this to setRoomActivity's own fix.
    const wsB = await connectWs();
    send(wsB, { type: 'bc-join', code, name: 'ActivityFreshB' });
    await waitFor(wsB, (m) => m.type === 'bc-init');
    await sleep(200);

    assert.ok(!scratchDb.getInactiveRoomCodes(cutoff).includes(code), 'a room with real minigame activity must no longer look inactive, even with zero chat messages');
    wsA.close(); wsB.close();
  });
});

describe('Build Craft land claims', () => {
  test('server enforces claims even without going through the client UI (bc-block)', async () => {
    const owner = await connectWs();
    const attacker = await connectWs();
    send(owner, { type: 'bc-join', code: 'BCCLAIM1', name: 'Owner', playerId: 'owner-stable-id' });
    await waitFor(owner, (m) => m.type === 'bc-init');
    send(attacker, { type: 'bc-join', code: 'BCCLAIM1', name: 'Attacker', playerId: 'attacker-stable-id' });
    await waitFor(attacker, (m) => m.type === 'bc-init');
    await sleep(150);

    send(owner, { type: 'bc-claim', x: 0, z: 0 });
    const claim = await waitFor(owner, (m) => m.type === 'bc-claim-added');
    assert.equal(claim.owner, 'Owner');
    await sleep(150);

    let attackerBroke = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'bc-block') attackerBroke = true; };
    attacker.on('message', h);
    send(attacker, { type: 'bc-block', changes: [{ x: 2, y: 5, z: 2, t: null }] });
    await sleep(400);
    attacker.off('message', h);
    assert.equal(attackerBroke, false, 'a non-owner should not be able to break/place inside a claim');
  });

  test('two players sharing a display name but different stable ids do not share claim ownership', async () => {
    const p1 = await connectWs();
    const p2 = await connectWs();
    send(p1, { type: 'bc-join', code: 'BCCLAIM2', name: 'Player', playerId: 'stable-AAA' });
    await waitFor(p1, (m) => m.type === 'bc-init');
    send(p2, { type: 'bc-join', code: 'BCCLAIM2', name: 'Player', playerId: 'stable-BBB' });
    await waitFor(p2, (m) => m.type === 'bc-init');
    await sleep(150);

    send(p1, { type: 'bc-claim', x: 100, z: 100 });
    await waitFor(p1, (m) => m.type === 'bc-claim-added');
    await sleep(150);

    let p2Broke = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'bc-block') p2Broke = true; };
    p2.on('message', h);
    send(p2, { type: 'bc-block', changes: [{ x: 101, y: 5, z: 101, t: null }] });
    await sleep(400);
    p2.off('message', h);
    assert.equal(p2Broke, false, 'a different stable id sharing the same display name should not inherit claim ownership');
  });

  // Found by a claim-ownership audit: claim.ownerId (the raw stableId the ownership check
  // above relies on) used to be broadcast verbatim to every room member in both bc-init and
  // bc-claim-added — trivially readable off the wire, then replayable as a forged bc-join's own
  // playerId to impersonate the victim's ownership and grief inside their claim. The server now
  // computes and sends a plain isMine boolean per recipient instead of the raw id.
  test('claim payloads never leak the raw ownerId; isMine is computed correctly per recipient', async () => {
    const owner = await connectWs();
    send(owner, { type: 'bc-join', code: 'BCCLAIM3', name: 'ClaimOwner', playerId: 'real-secret-stable-id' });
    await waitFor(owner, (m) => m.type === 'bc-init');

    const bystander = await connectWs();
    send(bystander, { type: 'bc-join', code: 'BCCLAIM3', name: 'ClaimBystander', playerId: 'bystander-stable-id' });
    await waitFor(bystander, (m) => m.type === 'bc-init');
    await sleep(150);

    const ownerSeesAddedPromise = waitFor(owner, (m) => m.type === 'bc-claim-added');
    const bystanderSeesAddedPromise = waitFor(bystander, (m) => m.type === 'bc-claim-added');
    send(owner, { type: 'bc-claim', x: 200, z: 200 });
    const [ownerSaw, bystanderSaw] = await Promise.all([ownerSeesAddedPromise, bystanderSeesAddedPromise]);

    assert.equal(ownerSaw.ownerId, undefined, 'bc-claim-added must never include the raw ownerId, even to the owner themself');
    assert.equal(bystanderSaw.ownerId, undefined, 'bc-claim-added must never include the raw ownerId to a bystander');
    assert.equal(ownerSaw.isMine, true, 'the actual owner must see isMine: true for their own claim');
    assert.equal(bystanderSaw.isMine, false, 'a bystander must see isMine: false for someone else\'s claim');

    // A fresh joiner's bc-init must show the same per-recipient isMine split for a
    // pre-existing claim, and must likewise never include the raw ownerId.
    const lateJoiner = await connectWs();
    send(lateJoiner, { type: 'bc-join', code: 'BCCLAIM3', name: 'ClaimLateJoiner', playerId: 'late-stable-id' });
    const lateInit = await waitFor(lateJoiner, (m) => m.type === 'bc-init');
    const lateClaim = lateInit.claims.find((c) => c.x === 200 && c.z === 200);
    assert.ok(lateClaim, 'the pre-existing claim must be present in a fresh joiner\'s bc-init');
    assert.equal(lateClaim.ownerId, undefined, 'bc-init must never include the raw ownerId');
    assert.equal(lateClaim.isMine, false, 'a fresh joiner is not the owner of a pre-existing claim');

    const ownerRejoin = await connectWs();
    send(ownerRejoin, { type: 'bc-join', code: 'BCCLAIM3', name: 'ClaimOwner', playerId: 'real-secret-stable-id' });
    const ownerReInit = await waitFor(ownerRejoin, (m) => m.type === 'bc-init');
    const ownerReClaim = ownerReInit.claims.find((c) => c.x === 200 && c.z === 200);
    assert.equal(ownerReClaim.isMine, true, 'rejoining with the same real stableId must still show isMine: true');

    owner.close(); bystander.close(); lateJoiner.close(); ownerRejoin.close();
  });
});

describe('unbounded-memory-growth audit: Build Craft resource caps', () => {
  // Found by the audit: bc-claim was the one bc-* handler with no flood gate at all — every
  // sibling (bc-pos/bc-block via isStrokeRateLimited, bc-sleep/bc-wake/etc via isWsMsgRateLimited)
  // already had one. Proven directly: send more claims in one burst than RATE_LIMIT_MAX_MESSAGES
  // (8/6s) allows and confirm the excess get NO response at all (not even bc-claim-denied), not
  // just that the pre-existing per-player cap (3) denies them — a denial is still a real response,
  // silence is what the flood gate produces.
  test('bc-claim is flood-gated — a burst beyond the message rate limit gets no response at all', async () => {
    const ws = await connectWs();
    send(ws, { type: 'bc-join', code: 'BCCLAIMFLOOD1', name: 'ClaimFlooder', playerId: 'flood-stable-id' });
    await waitFor(ws, (m) => m.type === 'bc-init');

    let responses = 0;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'bc-claim-added' || m.type === 'bc-claim-denied') responses++; };
    ws.on('message', h);
    for (let i = 0; i < 9; i++) {
      send(ws, { type: 'bc-claim', x: i * 100, z: i * 100 });
    }
    await sleep(400);
    ws.off('message', h);
    assert.ok(responses <= 8, `expected at most 8 of 9 rapid bc-claim attempts to get any response (added or denied), got ${responses}`);
    ws.close();
  });

  // Found by the audit: room.bc.claims had no room-wide cap — only a per-player one
  // (BC_MAX_CLAIMS_PER_PLAYER), keyed on a client-supplied stableId that a connection can reset by
  // simply presenting a fresh one. A room-wide ceiling (BC_MAX_ROOM_CLAIMS) closes that regardless
  // of per-identity accounting. Overridden low so this doesn't need thousands of real messages.
  test('a room-wide claim cap is enforced independent of per-player identity', async () => {
    const claimCapServer = await startTestServer({ BC_MAX_ROOM_CLAIMS: '2' }, 3212);
    try {
      const base = `ws://localhost:${claimCapServer.port}`;
      const wsA = new WebSocket(base);
      await new Promise((resolve) => wsA.on('open', resolve));
      const wsFor = (ws, msg, pred) => { ws.send(JSON.stringify(msg)); return new Promise((resolve) => { const h = (data) => { const m = JSON.parse(data); if (pred(m)) { ws.off('message', h); resolve(m); } }; ws.on('message', h); }); };
      await wsFor(wsA, { type: 'bc-join', code: 'BCROOMCAP1', name: 'CapA', playerId: 'cap-stable-a' }, (m) => m.type === 'bc-init');
      const wsB = new WebSocket(base);
      await new Promise((resolve) => wsB.on('open', resolve));
      await wsFor(wsB, { type: 'bc-join', code: 'BCROOMCAP1', name: 'CapB', playerId: 'cap-stable-b' }, (m) => m.type === 'bc-init');
      const wsC = new WebSocket(base);
      await new Promise((resolve) => wsC.on('open', resolve));
      await wsFor(wsC, { type: 'bc-join', code: 'BCROOMCAP1', name: 'CapC', playerId: 'cap-stable-c' }, (m) => m.type === 'bc-init');

      // bc-claim-added is BROADCAST to every player in the room, not just the claimant (so
      // everyone's client can render the new claim) — unlike bc-claim-denied, which is only ever
      // sent privately to the requester. Matching on bare message type alone risks a listener
      // attached right after sending catching an EARLIER claimant's still-in-flight broadcast
      // (e.g. B's own listener catching A's broadcast of A's claim) instead of the response to
      // this connection's own request — the exact "two sockets, one trigger" pitfall this app's
      // test suite has hit before. Disambiguated by requiring the added claim's owner match this
      // player's own name; bc-claim-denied needs no such check since it's never broadcast.
      const addedA = await wsFor(wsA, { type: 'bc-claim', x: 10, z: 10 }, (m) => (m.type === 'bc-claim-added' && m.owner === 'CapA') || m.type === 'bc-claim-denied');
      assert.equal(addedA.type, 'bc-claim-added', 'the 1st claim in the room (cap=2) must succeed');
      const addedB = await wsFor(wsB, { type: 'bc-claim', x: 20, z: 20 }, (m) => (m.type === 'bc-claim-added' && m.owner === 'CapB') || m.type === 'bc-claim-denied');
      assert.equal(addedB.type, 'bc-claim-added', 'the 2nd claim in the room (cap=2) must succeed');
      // C is a totally different player, nowhere near their OWN per-player cap — only the
      // room-wide cap can explain a denial here.
      const deniedC = await wsFor(wsC, { type: 'bc-claim', x: 30, z: 30 }, (m) => (m.type === 'bc-claim-added' && m.owner === 'CapC') || m.type === 'bc-claim-denied');
      assert.equal(deniedC.type, 'bc-claim-denied', 'the 3rd claim in the room must be denied once the room-wide cap is reached, regardless of which player sent it');

      wsA.close(); wsB.close(); wsC.close();
    } finally {
      await claimCapServer.stop();
    }
  });

  // Found by the audit: room.bc.overrides (and the bc_overrides table) had no cap at all —
  // bc-block is only gated by isStrokeRateLimited (20/2s) and each message can carry up to 2000
  // changes, so a single sustained client could grow it unboundedly, and bc-init resends the
  // ENTIRE map to every new joiner. Overridden low so this test doesn't need tens of thousands of
  // real cell changes.
  test('room.bc.overrides evicts the oldest cells once over the cap, and a fresh joiner only ever sees the capped set', async () => {
    const overridesCapServer = await startTestServer({ BC_MAX_OVERRIDES: '10' }, 3213);
    try {
      const base = `ws://localhost:${overridesCapServer.port}`;
      const wsA = new WebSocket(base);
      await new Promise((resolve) => wsA.on('open', resolve));
      const wsFor = (ws, msg, pred) => { ws.send(JSON.stringify(msg)); return new Promise((resolve) => { const h = (data) => { const m = JSON.parse(data); if (pred(m)) { ws.off('message', h); resolve(m); } }; ws.on('message', h); }); };
      await wsFor(wsA, { type: 'bc-join', code: 'BCOVERCAP1', name: 'OverA', playerId: 'over-stable-a' }, (m) => m.type === 'bc-init');

      // 15 distinct cells against a cap of 10 — the oldest 5 (x: 0-4) must be evicted, leaving
      // only the newest 10 (x: 5-14).
      const changes = [];
      for (let i = 0; i < 15; i++) changes.push({ x: i, y: 0, z: 0, t: 1 });
      wsA.send(JSON.stringify({ type: 'bc-block', changes }));
      await sleep(300);

      const wsB = new WebSocket(base);
      await new Promise((resolve) => wsB.on('open', resolve));
      const init = await wsFor(wsB, { type: 'bc-join', code: 'BCOVERCAP1', name: 'OverB', playerId: 'over-stable-b' }, (m) => m.type === 'bc-init');
      assert.equal(init.overrides.length, 10, 'a fresh joiner must only ever see the capped set of overrides, not the full unbounded history');
      const xs = init.overrides.map(([key]) => Number(key.split(',')[0])).sort((a, b) => a - b);
      assert.deepEqual(xs, [5, 6, 7, 8, 9, 10, 11, 12, 13, 14], 'the oldest-changed cells (x: 0-4) must be the ones evicted, not an arbitrary subset');

      wsA.close(); wsB.close();
    } finally {
      await overridesCapServer.stop();
    }
  });

  // Found by the audit: any room member (not just the host) can pin, and getPins had no cap at
  // all — its own comment already flagged this. Calls the real db.js setPin directly (same
  // "require the scratch instance's own db.js" pattern used elsewhere in this suite for direct
  // DB-state assertions) so this exercises the actual cap-eviction code, not a reimplementation,
  // without needing 201 real rate-limited pin-message round trips.
  test('room pins are capped at MAX_PINS_PER_ROOM, oldest evicted first', async () => {
    const scratchDb = require(require('node:path').join(server.dir, 'db.js'));
    const { ws, code } = await joinRoom('PinCapHost');
    const ids = [];
    for (let i = 0; i < 205; i++) {
      const id = require('node:crypto').randomUUID();
      scratchDb.insertMessage({ id, roomCode: code, name: 'PinCapHost', text: 'm' + i, mediaUrl: null, mediaType: null, at: Date.now() + i, accountId: null });
      ids.push(id);
    }
    // setPin timestamps each pin with Date.now() internally (no way to inject a controlled value)
    // and eviction orders by that column — 205 calls in a tight synchronous loop can land multiple
    // pins in the same millisecond, making "which one is oldest" an arbitrary tie-break rather
    // than a real ordering. A tiny real delay between calls guarantees genuinely distinct,
    // monotonically increasing timestamps so the eviction-order assertion below is deterministic.
    for (const id of ids) {
      scratchDb.setPin(code, id, 'PinCapHost');
      await sleep(2);
    }

    const pins = scratchDb.getPins(code);
    assert.equal(pins.length, 200, 'pins must be capped at MAX_PINS_PER_ROOM (200), not grow unboundedly');
    const pinnedIds = new Set(pins.map((p) => p.message.id));
    assert.ok(!pinnedIds.has(ids[0]), 'the oldest pin must have been evicted');
    assert.ok(pinnedIds.has(ids[ids.length - 1]), 'the newest pin must still be present');
    ws.close();
  });
});

describe('Web Swing PvP', () => {
  test('cooldown, damage progression, death/respawn, self-target and range guards all hold', async () => {
    const a = await connectWs();
    const b = await connectWs();
    send(a, { type: 'sw-join', code: 'SWPVP1', name: 'Attacker' });
    const aInit = await waitFor(a, (m) => m.type === 'sw-init');
    assert.equal(aInit.health, 3);
    // Both waiters must be armed before b's sw-join is sent, not one after the other — the server
    // sends b's own sw-init and broadcasts sw-player-joined to a essentially back-to-back, so
    // arming a's waiter only after awaiting bInit risked missing a message that had already
    // arrived with nothing listening for it yet (the same race class fixed elsewhere in this file).
    const bInitPromise = waitFor(b, (m) => m.type === 'sw-init');
    const aJoinedPromise = waitFor(a, (m) => m.type === 'sw-player-joined');
    send(b, { type: 'sw-join', code: 'SWPVP1', name: 'Victim' });
    const [bInit] = await Promise.all([bInitPromise, aJoinedPromise]);
    await sleep(150);

    // Self-target is rejected.
    let selfHit = false;
    const h0 = (data) => { const m = JSON.parse(data); if (m.type === 'sw-hit' || m.type === 'sw-death') selfHit = true; };
    a.on('message', h0);
    send(a, { type: 'sw-strike', targetId: aInit.id });
    await sleep(300);
    a.off('message', h0);
    assert.equal(selfHit, false);

    send(a, { type: 'sw-pos', x: 0, y: 0, z: 0, yaw: 0 });
    send(b, { type: 'sw-pos', x: 1, y: 0, z: 0, yaw: 0 });
    await sleep(200);

    // Out of range is dropped.
    send(a, { type: 'sw-pos', x: 0, y: 0, z: 0, yaw: 0 });
    send(b, { type: 'sw-pos', x: 500, y: 0, z: 500, yaw: 0 });
    await sleep(200);
    let outOfRangeHit = false;
    const h1 = (data) => { const m = JSON.parse(data); if (m.type === 'sw-hit' || m.type === 'sw-death') outOfRangeHit = true; };
    b.on('message', h1);
    send(a, { type: 'sw-strike', targetId: bInit.id });
    // 600ms here (not the 300ms every other post-strike wait in this test uses) — this attempt
    // still consumes the attacker's cooldown even though it misses on range (a real swing costs
    // you the swing whether or not it connects, which is also what closes the flood-gate hole this
    // was fixed for), so the very next strike attempt needs to clear a full SW_STRIKE_COOLDOWN_MS
    // (700ms) from *this* send, not from the self-target one three sleeps ago.
    await sleep(600);
    b.off('message', h1);
    assert.equal(outOfRangeHit, false);

    // Back in range: 3 real hits eliminate (SW_MAX_HEALTH=3).
    send(a, { type: 'sw-pos', x: 5, y: 0, z: 5, yaw: 0 });
    send(b, { type: 'sw-pos', x: 5, y: 0, z: 5, yaw: 0 });
    await sleep(200);
    send(a, { type: 'sw-strike', targetId: bInit.id });
    const hit1 = await waitFor(b, (m) => m.type === 'sw-hit');
    assert.equal(hit1.health, 2);

    // Rapid second strike is blocked by cooldown (700ms).
    let cooldownBlocked = true;
    const h2 = (data) => { const m = JSON.parse(data); if (m.type === 'sw-hit' || m.type === 'sw-death') cooldownBlocked = false; };
    b.on('message', h2);
    send(a, { type: 'sw-strike', targetId: bInit.id });
    await sleep(300);
    b.off('message', h2);
    assert.equal(cooldownBlocked, true);

    await sleep(600);
    send(a, { type: 'sw-strike', targetId: bInit.id });
    const hit2 = await waitFor(b, (m) => m.type === 'sw-hit');
    assert.equal(hit2.health, 1);

    await sleep(800);
    send(a, { type: 'sw-strike', targetId: bInit.id });
    const death = await waitFor(b, (m) => m.type === 'sw-death');
    assert.equal(death.health, 3);
    assert.equal(death.killedBy, aInit.id);

    // Respawn grace period: an immediate follow-up strike is rejected.
    let duringGrace = false;
    const h3 = (data) => { const m = JSON.parse(data); if (m.type === 'sw-hit' || m.type === 'sw-death') duringGrace = true; };
    b.on('message', h3);
    send(a, { type: 'sw-strike', targetId: bInit.id });
    await sleep(200);
    b.off('message', h3);
    assert.equal(duringGrace, false);
  });

  // A raw client sending sw-join then instantly sw-score with an arbitrary value, zero elapsed
  // session time, used to land — found by a leaderboard-integrity audit. sw-score is an
  // accumulated pickup/near-miss total with no realistic way to reach a real value instantly,
  // unlike gw-complete (which deliberately skips this exact gate — a short hand-built level can
  // legitimately clear in under 3s, see its own comment).
  test('sw-score requires some minimum elapsed session time, unlike a hand-built level clear', async () => {
    const ws = await connectWs();
    send(ws, { type: 'sw-join', code: 'SWMINSESSION1', name: 'InstantSwinger' });
    await waitFor(ws, (m) => m.type === 'sw-init');

    send(ws, { type: 'sw-score', score: 99999 });
    await sleep(150);
    send(ws, { type: 'sw-leaderboard', code: 'SWMINSESSION1' });
    const tooSoon = await waitFor(ws, (m) => m.type === 'sw-leaderboard-result');
    assert.ok(!tooSoon.scores.some((s) => s.name === 'InstantSwinger'), 'an instant post-join submission must not land');
  });

  // sw-score was the one leaderboard-writing message with no submission cooldown at all, unlike
  // gw-complete/arcade-submit-score which both reuse ARCADE_SUBMIT_COOLDOWN_MS for exactly this.
  test('sw-score submissions are cooldown-throttled like every other leaderboard write', async () => {
    const ws = await connectWs();
    send(ws, { type: 'sw-join', code: 'SWSCORE1', name: 'Swinger' });
    await waitFor(ws, (m) => m.type === 'sw-init');
    await sleep(3050); // past the new min-session-time gate, isolating this test to the cooldown

    send(ws, { type: 'sw-score', score: 10 });
    await sleep(100);
    // Immediately try to overwrite with a higher score — must be dropped by the cooldown, not
    // just naturally rejected for being lower (it's deliberately higher to isolate the cooldown).
    send(ws, { type: 'sw-score', score: 20 });
    await sleep(100);

    send(ws, { type: 'sw-leaderboard', code: 'SWSCORE1' });
    const afterSpam = await waitFor(ws, (m) => m.type === 'sw-leaderboard-result');
    const entry = afterSpam.scores.find((s) => s.name === 'Swinger');
    assert.equal(entry.score, 10, 'the second, cooldown-blocked submission must not have landed');

    await sleep(2000); // past ARCADE_SUBMIT_COOLDOWN_MS (2000ms)
    send(ws, { type: 'sw-score', score: 20 });
    await sleep(100);
    send(ws, { type: 'sw-leaderboard', code: 'SWSCORE1' });
    const afterCooldown = await waitFor(ws, (m) => m.type === 'sw-leaderboard-result');
    const entry2 = afterCooldown.scores.find((s) => s.name === 'Swinger');
    assert.equal(entry2.score, 20, 'a submission after the cooldown window must land');
  });
});

describe('Pictionary guess flood gate', () => {
  test('guesses are rate-limited like every other chat path', async () => {
    const drawer = await connectWs();
    const guesser = await connectWs();
    send(drawer, { type: 'dg-join', code: 'DGFLOOD1', name: 'Drawer' });
    await waitFor(drawer, (m) => m.type === 'dg-init');
    send(guesser, { type: 'dg-join', code: 'DGFLOOD1', name: 'Guesser' });
    await waitFor(guesser, (m) => m.type === 'dg-init');
    await sleep(150);

    send(drawer, { type: 'dg-start' });
    await waitFor(drawer, (m) => m.type === 'dg-round-start');
    await waitFor(guesser, (m) => m.type === 'dg-round-start');

    let count = 0;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'dg-guess-chat') count++; };
    guesser.on('message', h);
    for (let i = 0; i < 15; i++) send(guesser, { type: 'dg-guess', text: 'wrong' + i });
    await sleep(500);
    guesser.off('message', h);
    assert.ok(count > 0 && count <= 8, `expected 1-8 guesses through, got ${count}`);
  });

  // guessedThisRound used to be keyed by a fresh per-connection id (crypto.randomUUID() on every
  // dg-join, including a reconnect) instead of the stable player name — a guesser who reconnects
  // mid-round (network blip) got a brand-new id that was never in the set, letting them re-submit
  // the correct word for a second helping of points, and dg-init had no way to tell a reconnecting
  // client it had already guessed, permanently hiding its guess box for the rest of the round.
  test('a reconnecting guesser cannot re-score the same round, and dg-init reports alreadyGuessed', async () => {
    const drawer = await connectWs();
    send(drawer, { type: 'dg-join', code: 'DGRECONNECT1', name: 'ReconnectDrawer' });
    await waitFor(drawer, (m) => m.type === 'dg-init');

    let guesser = await connectWs();
    send(guesser, { type: 'dg-join', code: 'DGRECONNECT1', name: 'ReconnectGuesser' });
    await waitFor(guesser, (m) => m.type === 'dg-init');
    // A second, silent guesser — with only one guessable player, that single correct guess would
    // immediately satisfy "everyone guessable has guessed" and end the round on its own (see
    // endDgRound's guessableCount check), resetting guessedThisRound before the reconnect below
    // gets a chance to matter. This one just needs to exist and never guess.
    const otherGuesser = await connectWs();
    send(otherGuesser, { type: 'dg-join', code: 'DGRECONNECT1', name: 'ReconnectOtherGuesser' });
    await waitFor(otherGuesser, (m) => m.type === 'dg-init');
    await sleep(150);

    send(drawer, { type: 'dg-start' });
    const wordPromise = waitFor(drawer, (m) => m.type === 'dg-word');
    await waitFor(guesser, (m) => m.type === 'dg-round-start');
    const { word } = await wordPromise;

    send(guesser, { type: 'dg-guess', text: word });
    const correct = await waitFor(guesser, (m) => m.type === 'dg-correct' && m.name === 'ReconnectGuesser');
    assert.equal(correct.points, 3, 'first correct guess of the round is worth 3');

    // Simulate a reconnect: close the old connection (real cleanup, same as a dropped socket)
    // and rejoin under the same name with a fresh connection/id, mid-round.
    guesser.close();
    await sleep(150);
    guesser = await connectWs();
    send(guesser, { type: 'dg-join', code: 'DGRECONNECT1', name: 'ReconnectGuesser' });
    const init = await waitFor(guesser, (m) => m.type === 'dg-init');
    assert.equal(init.alreadyGuessed, true, 'dg-init must tell a reconnecting client it already guessed this round');

    let secondCorrect = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'dg-correct' && m.name === 'ReconnectGuesser') secondCorrect = true; };
    guesser.on('message', h);
    send(guesser, { type: 'dg-guess', text: word });
    await sleep(300);
    guesser.off('message', h);
    assert.equal(secondCorrect, false, 'the same player reconnecting mid-round must not be able to score twice on one round');
  });
});

describe('arcade leaderboard submission throttle', () => {
  test('a score submitted immediately after join is dropped; one after the window succeeds', async () => {
    const ws = await connectWs();
    send(ws, { type: 'arcade-join', code: 'ARCADE1', name: 'Speedrunner', game: 'snake' });
    await waitFor(ws, (m) => m.type === 'arcade-leaderboard');

    let immediateResult = false;
    const h = () => { immediateResult = true; };
    ws.on('message', h);
    send(ws, { type: 'arcade-submit-score', score: 99999 });
    await sleep(500);
    ws.off('message', h);
    assert.equal(immediateResult, false, 'a submission within the 3s min-session window should be dropped');

    await sleep(3000);
    send(ws, { type: 'arcade-submit-score', score: 42 });
    const result = await waitFor(ws, (m) => m.type === 'arcade-leaderboard');
    assert.ok(result.scores.some((s) => s.score === 42));
  });

  // Found by a systematic sweep for the "second join, no leave" bug class this session's other
  // fixes already closed everywhere else — arcade-join was the one minigame *-join handler with
  // no such guard at all, unlike bc-join/gw-join/etc. A repeat join for a different room left the
  // OLD room's room.activity entry (the "X is playing Y" badge shown to real chat-page members)
  // permanently orphaned, since neither arcade-leave nor WS-close cleanup can reach it once
  // ws.arcadeRoom points elsewhere.
  test('switching arcade rooms without leaving first clears the old room\'s activity badge', async () => {
    const { ws: hostA, code: codeA } = await joinRoom('ArcadeSwitchHostA');
    const { ws: hostB, code: codeB } = await joinRoom('ArcadeSwitchHostB');

    const hostASeesJoin = waitFor(hostA, (m) => m.type === 'room-activity' && m.activity.some((a) => a.name === 'ArcadeSwitcher'));
    const player = await connectWs();
    send(player, { type: 'arcade-join', code: codeA, name: 'ArcadeSwitcher', game: 'snake' });
    await waitFor(player, (m) => m.type === 'arcade-leaderboard');
    const activityA = await hostASeesJoin;
    // The stored `game` field is ARCADE_ACTIVITY_CODE's mapped short code ('sk' for snake), not
    // the raw 'snake' key arcade-join was sent with.
    assert.ok(activityA.activity.some((a) => a.name === 'ArcadeSwitcher' && a.game === 'sk'), 'sanity: joining really does register a room-activity entry');

    // The exploit shape: switch to a different room's arcade WITHOUT arcade-leave first.
    const hostASeesClear = waitFor(hostA, (m) => m.type === 'room-activity' && !m.activity.some((a) => a.name === 'ArcadeSwitcher'));
    send(player, { type: 'arcade-join', code: codeB, name: 'ArcadeSwitcher', game: '2048' });
    await waitFor(player, (m) => m.type === 'arcade-leaderboard');
    const clearedA = await hostASeesClear;
    assert.ok(!clearedA.activity.some((a) => a.name === 'ArcadeSwitcher'), "room A's activity badge must clear the moment the player switches to room B's arcade, not stay stuck forever");

    hostA.close(); hostB.close(); player.close();
  });
});

describe('room DMs', () => {
  test('a DM only reaches the intended recipient, not the rest of the room', async () => {
    const { ws: host, code } = await joinRoom('DmHost');
    const guest = await joinExistingRoom('DmGuest', code);
    const bystander = await joinExistingRoom('DmBystander', code);
    await sleep(150);

    let bystanderSawIt = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'dm') bystanderSawIt = true; };
    bystander.on('message', h);

    send(host, { type: 'send-dm', toName: 'DmGuest', text: 'psst' });
    const received = await waitFor(guest, (m) => m.type === 'dm' && m.text === 'psst');
    assert.equal(received.fromName, 'DmHost');
    await sleep(200);
    bystander.off('message', h);
    assert.equal(bystanderSawIt, false, 'a third party in the room should never see a DM');
  });

  // Same "insert directly into the scratch server's own DB, in-process" approach as the reaction-
  // cap test above (posting 205 real-time DMs through the flood gate would be far too slow for
  // what's really a db.js query-shape question).
  test('a DM thread past the 200-message window shows the most recent messages, not the oldest', async () => {
    const scratchDb = require(require('node:path').join(server.dir, 'db.js'));
    const { ws: host, code } = await joinRoom('DmWindowHost');
    const guest = await joinExistingRoom('DmWindowGuest', code);
    for (let i = 1; i <= 205; i++) {
      scratchDb.insertDm({
        id: require('node:crypto').randomUUID(), roomCode: code,
        fromName: 'DmWindowHost', toName: 'DmWindowGuest', text: 'm' + i, at: Date.now() + i,
      });
    }
    send(host, { type: 'get-dm-thread', withName: 'DmWindowGuest' });
    const thread = await waitFor(host, (m) => m.type === 'dm-thread' && m.withName === 'DmWindowGuest');
    assert.equal(thread.messages.length, 200);
    assert.equal(thread.messages[0].text, 'm6', 'the oldest message kept should be the 6th (205 - 200 + 1), not m1');
    assert.equal(thread.messages[thread.messages.length - 1].text, 'm205', 'the newest message must be included');
    // Still returned in chronological order, not reverse-chronological.
    assert.ok(thread.messages.every((m, i) => i === 0 || Number(m.text.slice(1)) > Number(thread.messages[i - 1].text.slice(1))));
    guest.close();
  });

  test('cannot DM yourself or someone not currently in the room', async () => {
    const { ws: host } = await joinRoom('DmSelfHost');
    let sawDm = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'dm') sawDm = true; };
    host.on('message', h);
    send(host, { type: 'send-dm', toName: 'DmSelfHost', text: 'to myself' });
    await sleep(200);
    send(host, { type: 'send-dm', toName: 'NobodyHere', text: 'to a ghost' });
    await sleep(200);
    host.off('message', h);
    assert.equal(sawDm, false);
  });

  test('a muted user cannot send-dm — an otherwise-unrestricted free-text private channel', async () => {
    const { ws: host, code } = await joinRoom('DmMuteHost');
    const guest = await joinExistingRoom('DmMuteGuest', code);
    await sleep(150);

    send(host, { type: 'mute-user', name: 'DmMuteGuest' });
    await waitFor(host, (m) => m.type === 'user-muted');
    await waitFor(guest, (m) => m.type === 'user-muted');

    let sawDm = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'dm') sawDm = true; };
    host.on('message', h);
    send(guest, { type: 'send-dm', toName: 'DmMuteHost', text: 'sneaking past the mute' });
    await sleep(300);
    host.off('message', h);
    assert.equal(sawDm, false, 'a muted user must not be able to reach anyone via a fresh DM');
  });
});

describe('friend DMs and group DMs (account-gated)', () => {
  let aliceToken, bobToken, carolToken;
  before(async () => {
    const signup = async (username, email) => fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'pass1234', email }),
    }).then((r) => r.json());
    const [a, b, c] = await Promise.all([
      signup('FdmAlice', 'fdmalice@test.com'),
      signup('FdmBob', 'fdmbob@test.com'),
      signup('FdmCarol', 'fdmcarol@test.com'),
      // A real account that intentionally stays friendless with the other three — needed to
      // test the "target exists but isn't a friend" rejection path specifically, as opposed to
      // the earlier "no such account at all" check the handler runs first.
      signup('FdmDave', 'fdmdave@test.com'),
    ]);
    aliceToken = a.token; bobToken = b.token; carolToken = c.token;
    // Make them all mutual friends via the HTTP routes already covered above.
    for (const [fromToken, toUsername] of [[aliceToken, 'FdmBob'], [aliceToken, 'FdmCarol'], [bobToken, 'FdmCarol']]) {
      await fetch(`${BASE_URL}/friends/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fromToken}` },
        body: JSON.stringify({ username: toUsername }),
      });
    }
    for (const [fromToken, toUsername] of [[bobToken, 'FdmAlice'], [carolToken, 'FdmAlice'], [carolToken, 'FdmBob']]) {
      await fetch(`${BASE_URL}/friends/accept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fromToken}` },
        body: JSON.stringify({ username: toUsername }),
      });
    }
  });

  test('friend-dm requires being signed in and requires an accepted friendship', async () => {
    const anon = await joinAsAccount('AnonFdm', undefined);
    let anonError = null;
    const h1 = (data) => { const m = JSON.parse(data); if (m.type === 'error') anonError = m; };
    anon.on('message', h1);
    send(anon, { type: 'friend-dm', toUsername: 'FdmBob', text: 'hi' });
    await sleep(200);
    anon.off('message', h1);
    assert.ok(anonError && /sign in/i.test(anonError.message));

    const alice = await joinAsAccount('FdmAlice', aliceToken);
    const bob = await joinAsAccount('FdmBob', bobToken);
    await sleep(150);
    // Both waiters must be armed *before* sending — sendFriendDm() pushes to bob synchronously
    // within the same handler that acks alice, so starting bob's wait only after alice's ack
    // resolves risks missing a message that already arrived with no listener attached yet.
    const sentPromise = waitFor(alice, (m) => m.type === 'friend-dm-sent');
    const receivedPromise = waitFor(bob, (m) => m.type === 'friend-dm' && m.from === 'FdmAlice');
    send(alice, { type: 'friend-dm', toUsername: 'FdmBob', text: 'hey friend' });
    const [sent, received] = await Promise.all([sentPromise, receivedPromise]);
    assert.equal(sent.toUsername, 'FdmBob');
    assert.equal(received.text, 'hey friend');
  });

  test('create-group-dm requires signed-in members who are all accepted friends of the creator', async () => {
    const alice = await joinAsAccount('FdmAlice2', aliceToken);
    send(alice, { type: 'create-group-dm', memberUsernames: ['FdmBob', 'FdmCarol'], name: 'Test Group' });
    const created = await waitFor(alice, (m) => m.type === 'group-dm-created');
    assert.equal(created.thread.name, 'Test Group');

    let error = null;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'error') error = m; };
    alice.on('message', h);
    send(alice, { type: 'create-group-dm', memberUsernames: ['FdmDave'], name: 'Should Fail' });
    await sleep(300);
    alice.off('message', h);
    assert.ok(error && /can only add friends/i.test(error.message));
  });

  test('create-group-dm is rate-limited like every other content-creation path', async () => {
    const alice = await joinAsAccount('FdmAliceFlood', aliceToken);
    let count = 0;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'group-dm-created') count++; };
    alice.on('message', h);
    for (let i = 0; i < 15; i++) {
      send(alice, { type: 'create-group-dm', memberUsernames: ['FdmBob', 'FdmCarol'], name: 'Flood ' + i });
    }
    await sleep(500);
    alice.off('message', h);
    assert.ok(count > 0 && count <= 8, `expected 1-8 of 15 group-dm creations through, got ${count}`);
  });

  // Found by a friends/DM authorization audit: every other group-DM handler (create/send/leave)
  // already gates on isWsMsgRateLimited; these two read-only handlers had been left out, letting a
  // signed-in client hammer unlimited DB reads with no cost. Scoping to the caller's own membership
  // was already correct (no IDOR) — this only covers the flood-cost gap. Uses the shared instance
  // directly, same as the 'create-group-dm is rate-limited' test above, since RATE_LIMIT_MAX_MESSAGES
  // (unlike FRIENDS_ACTION_MAX) isn't part of this suite's "effectively unlimited" env overrides.
  test('get-group-dm-threads and get-group-dm-messages are flood-gated like every other group-DM handler', async () => {
    const alice = await joinAsAccount('FdmAliceFlood2', aliceToken);
    send(alice, { type: 'create-group-dm', memberUsernames: ['FdmBob', 'FdmCarol'], name: 'Flood Read Group' });
    const created = await waitFor(alice, (m) => m.type === 'group-dm-created');
    const groupId = created.thread.id;
    await sleep(6200); // let the flood window opened by create-group-dm's own send clear first

    let threadsCount = 0;
    const h1 = (data) => { const m = JSON.parse(data); if (m.type === 'group-dm-threads') threadsCount++; };
    alice.on('message', h1);
    for (let i = 0; i < 15; i++) send(alice, { type: 'get-group-dm-threads' });
    await sleep(500);
    alice.off('message', h1);
    assert.ok(threadsCount > 0 && threadsCount <= 8, `expected 1-8 of 15 get-group-dm-threads through, got ${threadsCount}`);

    await sleep(6200);
    let messagesCount = 0;
    const h2 = (data) => { const m = JSON.parse(data); if (m.type === 'group-dm-messages') messagesCount++; };
    alice.on('message', h2);
    for (let i = 0; i < 15; i++) send(alice, { type: 'get-group-dm-messages', groupId });
    await sleep(500);
    alice.off('message', h2);
    assert.ok(messagesCount > 0 && messagesCount <= 8, `expected 1-8 of 15 get-group-dm-messages through, got ${messagesCount}`);
  });

  // Same "insert directly into the scratch server's own DB" approach as the DM-thread window
  // test in the 'room DMs' describe block above. Must run before the blocking test below, which
  // blocks FdmBob for this same aliceToken account — create-group-dm requires every member to
  // currently be a friend, and a blocked member no longer counts as one.
  test('a group DM past the 200-message window shows the most recent messages, not the oldest', async () => {
    const scratchDb = require(require('node:path').join(server.dir, 'db.js'));
    const alice = await joinAsAccount('FdmAlice4', aliceToken);
    send(alice, { type: 'create-group-dm', memberUsernames: ['FdmBob', 'FdmCarol'], name: 'Window Test Group' });
    const created = await waitFor(alice, (m) => m.type === 'group-dm-created');
    const groupId = created.thread.id;
    const aliceAccountId = scratchDb.getSessionAccount(aliceToken).id;
    for (let i = 1; i <= 205; i++) {
      scratchDb.insertGroupDmMessage({
        id: require('node:crypto').randomUUID(), groupId, fromAccountId: aliceAccountId,
        fromName: 'FdmAlice4', text: 'm' + i, at: Date.now() + i,
      });
    }
    send(alice, { type: 'get-group-dm-messages', groupId });
    const history = await waitFor(alice, (m) => m.type === 'group-dm-messages' && m.groupId === groupId);
    assert.equal(history.messages.length, 200);
    assert.equal(history.messages[0].text, 'm6', 'the oldest message kept should be the 6th (205 - 200 + 1), not m1');
    assert.equal(history.messages[history.messages.length - 1].text, 'm205', 'the newest message must be included');
  });

  // Must run before the blocking test below, which blocks FdmBob for this same aliceToken account —
  // create-group-dm requires every member to currently be a friend, and a blocked member no longer
  // counts as one (see that test's own comment on the same constraint).
  test('get-group-dm-threads does not leak a blocked member\'s message content in the thread-list preview', async () => {
    const alice = await joinAsAccount('FdmAlice3b', aliceToken);
    send(alice, { type: 'create-group-dm', memberUsernames: ['FdmBob', 'FdmCarol'], name: 'Preview Test Group' });
    const created = await waitFor(alice, (m) => m.type === 'group-dm-created');
    const groupId = created.thread.id;

    const bob = await joinAsAccount('FdmBob2b', bobToken);
    await sleep(150);
    send(bob, { type: 'send-group-dm', groupId, text: 'preview leak attempt' });
    await waitFor(bob, (m) => m.type === 'group-dm-sent');
    await sleep(150);

    await fetch(`${BASE_URL}/friends/block`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ username: 'FdmBob' }),
    });

    send(alice, { type: 'get-group-dm-threads' });
    const { threads } = await waitFor(alice, (m) => m.type === 'group-dm-threads');
    const thread = threads.find((t) => t.id === groupId);
    assert.ok(thread, 'the group DM thread must still be listed');
    assert.ok(!thread.lastMessage || thread.lastMessage.text !== 'preview leak attempt', "the blocked member's message must not appear as the thread's preview text");

    // Unblock and re-friend so this test's own block doesn't interfere with later tests in this
    // describe block that assume aliceToken/FdmBob are still friends (including the dedicated
    // blocking test below, which expects to be the one establishing the block relationship itself)
    // — unblock only removes the 'blocked' row (db.js's unblock), it does not restore a prior
    // friendship, so without re-requesting/accepting they'd be left as total strangers.
    await fetch(`${BASE_URL}/friends/unblock`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ username: 'FdmBob' }),
    });
    await fetch(`${BASE_URL}/friends/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ username: 'FdmBob' }),
    });
    await fetch(`${BASE_URL}/friends/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({ username: 'FdmAlice' }),
    });
  });

  test('blocking a group-DM co-member silences them for the blocker only, live and on reload', async () => {
    const alice = await joinAsAccount('FdmAlice3', aliceToken);
    send(alice, { type: 'create-group-dm', memberUsernames: ['FdmBob', 'FdmCarol'], name: 'Block Test Group' });
    const created = await waitFor(alice, (m) => m.type === 'group-dm-created');
    const groupId = created.thread.id;

    await fetch(`${BASE_URL}/friends/block`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ username: 'FdmBob' }),
    });

    const bob = await joinAsAccount('FdmBob2', bobToken);
    const carol = await joinAsAccount('FdmCarol2', carolToken);
    await sleep(150);

    let aliceGotIt = false;
    const aliceHandler = (data) => { const m = JSON.parse(data); if (m.type === 'group-dm' && m.groupId === groupId) aliceGotIt = true; };
    alice.on('message', aliceHandler);
    const carolPromise = waitFor(carol, (m) => m.type === 'group-dm' && m.groupId === groupId);
    send(bob, { type: 'send-group-dm', groupId, text: 'hi from blocked bob' });
    const carolReceived = await carolPromise;
    await sleep(200);
    alice.off('message', aliceHandler);
    assert.equal(carolReceived.text, 'hi from blocked bob', 'an unblocked co-member still gets it live');
    assert.equal(aliceGotIt, false, 'the blocker must not get a live delivery from the blocked member');

    send(alice, { type: 'get-group-dm-messages', groupId });
    const history = await waitFor(alice, (m) => m.type === 'group-dm-messages' && m.groupId === groupId);
    assert.ok(!history.messages.some((msg) => msg.text === 'hi from blocked bob'), 'the blocked member\'s message must not appear in the blocker\'s reloaded history either');

    send(carol, { type: 'get-group-dm-messages', groupId });
    const carolHistory = await waitFor(carol, (m) => m.type === 'group-dm-messages' && m.groupId === groupId);
    assert.ok(carolHistory.messages.some((msg) => msg.text === 'hi from blocked bob'), 'an unblocked member still sees it in history');
  });

  // Found by a functional-correctness audit: leave-group-dm only ever sent 'group-dm-left' to
  // the one socket that issued the request. A second open tab/device signed into the same
  // account (with the same thread open there too) never heard about it, so its overlay stayed
  // open on a thread it was no longer actually a member of. Fixed by fanning 'group-dm-left' out
  // to every live connection of the leaving account, same as 'group-dm-member-left' already does
  // for the remaining members.
  test('leave-group-dm notifies every connection of the leaving account, not just the one that left', async () => {
    // The preceding test in this block leaves aliceToken/FdmBob permanently blocked (by design —
    // it's the one establishing that block relationship and nothing after it needs them friends
    // again). create-group-dm requires every member to currently be an accepted friend, so undo
    // that block/re-friend here rather than depending on suite ordering — same dance the earlier
    // "does not leak" test already does for the same reason.
    await fetch(`${BASE_URL}/friends/unblock`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ username: 'FdmBob' }),
    });
    await fetch(`${BASE_URL}/friends/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ username: 'FdmBob' }),
    });
    await fetch(`${BASE_URL}/friends/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({ username: 'FdmAlice' }),
    });

    const aliceTab1 = await joinAsAccount('FdmAliceLeave1', aliceToken);
    const bob = await joinAsAccount('FdmBobLeave', bobToken);
    send(aliceTab1, { type: 'create-group-dm', memberUsernames: ['FdmBob', 'FdmCarol'], name: 'Leave Sync Group' });
    const created = await waitFor(aliceTab1, (m) => m.type === 'group-dm-created');
    const groupId = created.thread.id;

    // A second tab/device signed into the *same* account (Alice), also with the thread "open".
    const aliceTab2 = await joinAsAccount('FdmAliceLeave2', aliceToken);

    const tab2LeftPromise = waitFor(aliceTab2, (m) => m.type === 'group-dm-left' && m.groupId === groupId);
    const bobMemberLeftPromise = waitFor(bob, (m) => m.type === 'group-dm-member-left' && m.groupId === groupId);
    send(aliceTab1, { type: 'leave-group-dm', groupId });
    await waitFor(aliceTab1, (m) => m.type === 'group-dm-left' && m.groupId === groupId);
    const [tab2Left, bobMemberLeft] = await Promise.all([tab2LeftPromise, bobMemberLeftPromise]);
    assert.equal(tab2Left.groupId, groupId, 'the same account\'s other connection must also get group-dm-left');
    assert.equal(bobMemberLeft.username, 'FdmAliceLeave1', 'remaining members still get the member-left notice');

    // And the departure is for real, not just a display glitch: neither of Alice's connections
    // can send into the group any more.
    let aliceError = null;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'error') aliceError = m; };
    aliceTab2.on('message', h);
    send(aliceTab2, { type: 'send-group-dm', groupId, text: 'should be rejected' });
    await sleep(200);
    aliceTab2.off('message', h);
    assert.ok(aliceError && /not a member/i.test(aliceError.message));
  });
});

describe('voice call signaling requires the sender to actually be on the call', () => {
  test('voice-signal from a room member who never sent voice-join is silently dropped, not relayed', async () => {
    const { ws: a, code } = await joinRoom('VoiceHostA');
    const b = await joinExistingRoom('VoiceAttackerB', code);
    const c = await joinExistingRoom('VoiceLegitC', code);

    send(a, { type: 'voice-join' });
    await waitFor(a, (m) => m.type === 'voice-peers');

    // C legitimately joins the call — this is how a real client would learn A's sub, via the
    // peers list. B (the attacker below) never calls voice-join at all, so never learns or is
    // meant to know any sub — but the test harness can see across connections, so it borrows
    // this to get a real sub value to target.
    send(c, { type: 'voice-join' });
    const cPeers = await waitFor(c, (m) => m.type === 'voice-peers');
    const aSub = cPeers.peers.find((p) => p.name === 'VoiceHostA').sub;

    let aGotForged = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'voice-signal' && m.signal && m.signal.bogus) aGotForged = true; };
    a.on('message', h);
    send(b, { type: 'voice-signal', to: aSub, signal: { type: 'offer', bogus: true } });
    await sleep(300);
    a.off('message', h);
    assert.equal(aGotForged, false, 'a room member who never joined the call must not be able to forge signaling to a real participant');

    // Sanity check: a genuine participant's signal to A still goes through — the fix must not
    // have broken real signaling.
    const legitPromise = waitFor(a, (m) => m.type === 'voice-signal' && m.signal && m.signal.legit);
    send(c, { type: 'voice-signal', to: aSub, signal: { type: 'offer', legit: true } });
    const legit = await legitPromise;
    assert.equal(legit.signal.legit, true);
  });

  // leaveVoice(ws) used to look up the voice.Map entry via ws.profile.sub at disconnect time —
  // but join-server can fire again on an already-open connection (the client does this when
  // signing into an account mid-session, see app.js's own comment on that call site) and
  // unconditionally hands out a fresh crypto.randomUUID() sub every time. A voice-join that
  // happened under the *old* sub before that reassignment became permanently unreachable: the
  // entry stayed in the map forever, the disconnect never told anyone else the person had left,
  // and every future joiner kept seeing a dead "peer" that could never actually connect.
  test('a mid-session join-server (e.g. signing in) does not orphan an existing voice-join on disconnect', async () => {
    const { ws: a, code } = await joinRoom('VoiceOrphanHost');
    send(a, { type: 'voice-join' });
    await waitFor(a, (m) => m.type === 'voice-peers');

    const b = await joinExistingRoom('VoiceOrphanB', code);
    send(b, { type: 'voice-join' });
    const bJoinedPromise = waitFor(a, (m) => m.type === 'voice-peer-joined');
    const bJoined = await bJoinedPromise;
    const oldSub = bJoined.sub;

    // Simulate a mid-session sign-in: the same still-open connection sends join-server again.
    send(b, { type: 'join-server', username: 'VoiceOrphanB' });
    const reInit = await waitFor(b, (m) => m.type === 'joined-server');
    assert.notEqual(reInit.profile.sub, oldSub, 'join-server must actually reassign a fresh sub for this test to mean anything');

    const leftPromise = waitFor(a, (m) => m.type === 'voice-peer-left');
    b.close();
    const left = await leftPromise;
    assert.equal(left.sub, oldSub, 'the departure notice must reference the sub A actually knows B by, not the reassigned one A never saw');

    // The real user-facing symptom of the orphan: a fresh joiner must not see a dead leftover peer.
    const c = await joinExistingRoom('VoiceOrphanC', code);
    send(c, { type: 'voice-join' });
    const cPeers = await waitFor(c, (m) => m.type === 'voice-peers');
    assert.ok(!cPeers.peers.some((p) => p.sub === oldSub), 'no orphaned peer entry should remain for the disconnected connection');

    a.close(); c.close();
  });

  // Found by a voice-signaling-authorization audit: join-room/create-room assigned ws.room
  // directly with no cleanup of a PRIOR ws.room the same connection already held — unlike every
  // *-join minigame handler, which all guard against this exact "second join, no leave" shape.
  // A raw client could join room A's voice call, then switch to room B via create-room/join-room
  // without ever sending leave-room/voice-leave first, leaving a permanently live, invisible
  // entry in room A's voice Map — reachable for real SDP/ICE signaling from any future joiner of
  // A's call, with no departure notice ever sent to A's real participants.
  test('switching rooms without leaving first evicts the old room\'s voice entry, not just leaves it orphaned', async () => {
    const { ws: host, code: codeA } = await joinRoom('RoomSwitchHostA');
    send(host, { type: 'voice-join' });
    await waitFor(host, (m) => m.type === 'voice-peers');

    const attacker = await joinExistingRoom('RoomSwitchAttacker', codeA);
    // Registered before the triggering send, not after awaiting attacker's own reply — the
    // server broadcasts to host in the same handler invocation that replies to attacker, so
    // awaiting attacker's reply first risks host's message arriving with no listener attached
    // yet (same "two sockets, one trigger" pitfall this file's own history already documents).
    const hostSeesAttackerJoinPromise = waitFor(host, (m) => m.type === 'voice-peer-joined' && m.name === 'RoomSwitchAttacker');
    send(attacker, { type: 'voice-join' });
    await waitFor(attacker, (m) => m.type === 'voice-peers');
    const hostSeesAttackerJoin = await hostSeesAttackerJoinPromise;
    assert.ok(hostSeesAttackerJoin, 'sanity: the attacker really is a live voice participant of room A before switching away');

    // The exploit shape: switch to a brand-new room via create-room, WITHOUT ever sending
    // leave-room or voice-leave for room A first — exactly what a real browser client never does
    // (it always leave-rooms first), but nothing server-side enforced it either.
    const hostSeesAttackerLeave = waitFor(host, (m) => m.type === 'voice-peer-left');
    send(attacker, { type: 'create-room' });
    await waitFor(attacker, (m) => m.type === 'joined-room');
    const left = await hostSeesAttackerLeave;
    assert.ok(left, 'room A must be told the attacker left the moment they switch rooms, not silently keep them as a live peer');

    // The real-world symptom: a fresh joiner to room A's call must not see the departed attacker
    // as a peer at all — before the fix, this stale entry would still be there forever.
    const lateJoiner = await joinExistingRoom('RoomSwitchLateJoiner', codeA);
    send(lateJoiner, { type: 'voice-join' });
    const latePeers = await waitFor(lateJoiner, (m) => m.type === 'voice-peers');
    assert.ok(!latePeers.peers.some((p) => p.name === 'RoomSwitchAttacker'), 'the attacker must not remain a reachable voice-signaling target in the room they switched away from');

    host.close(); attacker.close(); lateJoiner.close();
  });

  // Found by a systematic sweep for the same "identity field reassigned without tearing down the
  // old association" bug class as the two fixes above: a second voice-join after ws.profile gets
  // reassigned (join-server firing again mid-call — see leaveVoice's own comment on why that
  // happens) used to add a SECOND room.voice entry for the same connection under the new sub,
  // leaving the old one orphaned forever (leaveVoice only ever removed the first match it found).
  test('a voice-join after a mid-call profile reassignment does not leave a duplicate orphaned entry', async () => {
    const { ws: host, code } = await joinRoom('VoiceDupeHost');
    send(host, { type: 'voice-join' });
    await waitFor(host, (m) => m.type === 'voice-peers');

    const mover = await joinExistingRoom('VoiceDupeMover', code);
    const hostSeesFirstJoinPromise = waitFor(host, (m) => m.type === 'voice-peer-joined');
    send(mover, { type: 'voice-join' });
    await waitFor(mover, (m) => m.type === 'voice-peers');
    const hostSeesFirstJoin = await hostSeesFirstJoinPromise;
    const oldSub = hostSeesFirstJoin.sub;

    // Simulate the mid-call reassignment: the same still-open connection sends join-server again
    // (a real, documented scenario — signing into an account mid-session), which mints a fresh
    // sub, then rejoins the call without ever sending voice-leave first.
    send(mover, { type: 'join-server', username: 'VoiceDupeMover' });
    const reInit = await waitFor(mover, (m) => m.type === 'joined-server');
    assert.notEqual(reInit.profile.sub, oldSub, 'sanity: join-server must actually reassign a fresh sub');

    const hostSeesOldLeave = waitFor(host, (m) => m.type === 'voice-peer-left' && m.sub === oldSub);
    send(mover, { type: 'voice-join' });
    const newPeers = await waitFor(mover, (m) => m.type === 'voice-peers');
    assert.equal(newPeers.peers.length, 1, 'the rejoin must see exactly the host as a peer, not a leftover self-entry under the old sub');
    const oldLeft = await hostSeesOldLeave;
    assert.ok(oldLeft, 'the stale old-sub entry must be actively purged (announced as a departure), not just silently left as a duplicate');

    // The real-world symptom: everyone hanging up must actually end the call — a leftover
    // duplicate entry under a closed-out sub would keep room.voice non-empty forever.
    const callEndedPromise = waitFor(host, (m) => m.type === 'voice-call-ended');
    send(host, { type: 'voice-leave' });
    send(mover, { type: 'voice-leave' });
    await callEndedPromise;

    host.close(); mover.close();
  });
});

describe('whiteboard stroke sanitization', () => {
  test('out-of-range and non-finite points are dropped; valid ones survive', async () => {
    const a = await connectWs();
    const b = await connectWs();
    send(a, { type: 'wb-join', code: 'WBSTROKE1', name: 'Drawer' });
    await waitFor(a, (m) => m.type === 'wb-init');
    send(b, { type: 'wb-join', code: 'WBSTROKE1', name: 'Watcher' });
    await waitFor(b, (m) => m.type === 'wb-init');
    await sleep(150);

    send(a, {
      type: 'wb-stroke',
      color: '#ff0000',
      size: 4,
      points: [
        { x: 10, y: 20 },       // valid
        { x: 999999, y: 20 },   // out of STROKE_COORD_MAX range
        { x: 'abc', y: 20 },    // +'abc' is NaN — must be caught by the Number.isFinite check
        { x: 30, y: 40 },       // valid
        'not even an object',   // malformed entry
      ],
    });
    const stroke = await waitFor(b, (m) => m.type === 'wb-stroke');
    assert.deepEqual(stroke.stroke.points, [{ x: 10, y: 20 }, { x: 30, y: 40 }]);
  });

  test('a stroke with only invalid points is dropped entirely (no broadcast, no empty stroke)', async () => {
    const a = await connectWs();
    const b = await connectWs();
    send(a, { type: 'wb-join', code: 'WBSTROKE2', name: 'Drawer' });
    await waitFor(a, (m) => m.type === 'wb-init');
    send(b, { type: 'wb-join', code: 'WBSTROKE2', name: 'Watcher' });
    await waitFor(b, (m) => m.type === 'wb-init');
    await sleep(150);

    let sawStroke = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'wb-stroke') sawStroke = true; };
    b.on('message', h);
    send(a, { type: 'wb-stroke', color: '#000', size: 4, points: [{ x: 999999, y: 999999 }] });
    await sleep(300);
    b.off('message', h);
    assert.equal(sawStroke, false);
  });

  // wb-clear had no rate limit at all (unlike wb-stroke just above it, and unlike dg-clear which
  // is at least drawer-only) — any participant could wipe the whole shared whiteboard, a real DB
  // write plus a room-wide broadcast, as fast as the network allows.
  test('wb-clear is rate-limited like every other content-creation/mutation path', async () => {
    const a = await connectWs();
    const b = await connectWs();
    send(a, { type: 'wb-join', code: 'WBCLEAR1', name: 'Clearer' });
    await waitFor(a, (m) => m.type === 'wb-init');
    send(b, { type: 'wb-join', code: 'WBCLEAR1', name: 'Watcher' });
    await waitFor(b, (m) => m.type === 'wb-init');
    await sleep(150);

    let clearCount = 0;
    const h = (data) => { if (JSON.parse(data).type === 'wb-cleared') clearCount++; };
    b.on('message', h);
    for (let i = 0; i < 15; i++) send(a, { type: 'wb-clear' });
    await sleep(500);
    b.off('message', h);
    assert.ok(clearCount > 0 && clearCount <= 8, `expected 1-8 of 15 wb-clear calls through, got ${clearCount}`);
  });
});

describe('/post-image and /post-media external URL allowlist', () => {
  test('/post-image rejects an arbitrary external URL but accepts an /uploads/ path and the Pollinations.ai host', async () => {
    const { code } = await joinRoom('PostImageHost');

    const evilRes = await fetch(`${BASE_URL}/post-image`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'PostImageHost', mediaUrl: 'https://evil.example/track.gif', prompt: 'x' }),
    });
    assert.equal(evilRes.status, 400, 'an arbitrary external URL must be rejected outright (tracker-link risk)');

    const uploadsRes = await fetch(`${BASE_URL}/post-image`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'PostImageHost', mediaUrl: '/uploads/fake-test-file.jpg', prompt: 'x' }),
    });
    assert.equal(uploadsRes.status, 200, 'a real /uploads/ path must still be accepted');

    const pollinationsRes = await fetch(`${BASE_URL}/post-image`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'PostImageHost', mediaUrl: 'https://image.pollinations.ai/prompt/test', prompt: 'x' }),
    });
    assert.equal(pollinationsRes.status, 200, "AI Studio's own uncaptioned-image flow (a direct Pollinations URL) must still work");
  });

  test('/post-media rejects any external URL — its only real client always uploads first', async () => {
    const { code } = await joinRoom('PostMediaHost');

    const evilRes = await fetch(`${BASE_URL}/post-media`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'PostMediaHost', mediaUrl: 'https://evil.example/track.mp4', mediaType: 'video' }),
    });
    assert.equal(evilRes.status, 400);

    // Not even the Pollinations allowlist applies here — /post-media has no legitimate caller
    // that needs an external host at all.
    const pollinationsRes = await fetch(`${BASE_URL}/post-media`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'PostMediaHost', mediaUrl: 'https://image.pollinations.ai/prompt/test', mediaType: 'image' }),
    });
    assert.equal(pollinationsRes.status, 400);

    const uploadsRes = await fetch(`${BASE_URL}/post-media`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'PostMediaHost', mediaUrl: '/uploads/fake-test-video.mp4', mediaType: 'video' }),
    });
    assert.equal(uploadsRes.status, 200);
  });

  // set-avatar was the one "attach media" path in the app that never got this restriction — a
  // raw WS client (the real UI only ever sends back its own /upload result) could set any
  // external URL, which every room member's client renders as a real <img src> for that user —
  // a tracking-pixel vector, the exact class of bug this whole describe block is about.
  test('set-avatar rejects an arbitrary external URL but accepts a real /uploads/ path', async () => {
    const { ws } = await joinRoom('AvatarHost');

    send(ws, { type: 'set-avatar', avatarUrl: 'https://evil.example/track.gif' });
    const rejected = await waitFor(ws, (m) => m.type === 'profile-updated');
    assert.equal(rejected.avatarUrl, null, 'an arbitrary external URL must be dropped, not stored or broadcast');

    send(ws, { type: 'set-avatar', avatarUrl: '/uploads/fake-avatar.jpg' });
    const accepted = await waitFor(ws, (m) => m.type === 'profile-updated');
    assert.equal(accepted.avatarUrl, '/uploads/fake-avatar.jpg', 'a real /uploads/ path must still be accepted');
  });
});

// Found by a sticker-picker correctness audit: public/stickers.js builds each sticker's url as
// /images/stickers/<file> (a real static file, not an /uploads/ upload), but the WS 'message'
// handler's mediaUrl check only ever accepted an /uploads/ prefix (or the literal 'poll' sentinel)
// — every single sticker send was silently dropped end-to-end with zero error back to the sender.
// server.js now whitelists the real on-disk sticker files (STICKER_URLS) alongside /uploads/.
describe('sticker send (WS message with a /images/stickers/ mediaUrl)', () => {
  test('a real sticker file path is accepted and broadcast; an arbitrary /images/stickers/ path is not', async () => {
    const { ws } = await joinRoom('StickerHost');

    const realStickerFile = fs.readdirSync(path.join(__dirname, '..', 'public/images/stickers'))[0];
    const realUrl = `/images/stickers/${realStickerFile}`;
    send(ws, { type: 'message', mediaUrl: realUrl, mediaType: 'image' });
    const posted = await waitFor(ws, (m) => m.type === 'message' && m.mediaUrl === realUrl);
    assert.equal(posted.mediaType, 'image');

    let sawFake = false;
    const h = (data) => {
      const m = JSON.parse(data);
      if (m.type === 'message' && m.mediaUrl === '/images/stickers/not-a-real-sticker.png') sawFake = true;
    };
    ws.on('message', h);
    send(ws, { type: 'message', mediaUrl: '/images/stickers/not-a-real-sticker.png', mediaType: 'image' });
    await sleep(300);
    ws.off('message', h);
    assert.equal(sawFake, false, 'a path outside the real sticker file set must still be dropped, not posted');
  });
});

describe('admin routes require the admin key', () => {
  test('every /admin/* route rejects a missing or wrong key', async () => {
    for (const adminPath of ['/admin/errors', '/admin/reports', '/admin/patches']) {
      const noKeyRes = await fetch(`${BASE_URL}${adminPath}`);
      assert.equal(noKeyRes.status, 401, `${adminPath} without a key should 401`);
      const wrongKeyRes = await fetch(`${BASE_URL}${adminPath}`, { headers: adminAuth('definitely-not-the-real-key') });
      assert.equal(wrongKeyRes.status, 401, `${adminPath} with a wrong key should 401`);
    }
  });

  // ?key= used to also work as a fallback — a materially weaker place for a permanent credential
  // to live (server access logs, Referer headers) than the Authorization header admin.html's real
  // fetch calls actually use. Confirms the fallback is really gone, not just untested.
  test('the real admin key via ?key= query string alone is no longer accepted (Bearer-only)', async () => {
    const adminKey = JSON.parse(fs.readFileSync(path.join(server.dir, 'admin-key.json'), 'utf8')).key;
    const res = await fetch(`${BASE_URL}/admin/errors?key=${adminKey}`);
    assert.equal(res.status, 401, 'the real key in the query string, with no Authorization header, must be rejected');
  });
});

describe('security response headers', () => {
  test('every response carries clickjacking/sniffing protections and no framework fingerprint', async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.match(res.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
    assert.equal(res.headers.get('x-powered-by'), null, 'Express should not identify itself');
    // Found by a CORS/headers/transport-trust audit: cheap to add, previously absent.
    assert.equal(res.headers.get('referrer-policy'), 'same-origin');
    assert.match(res.headers.get('permissions-policy') || '', /geolocation=\(\)/);
  });
});

describe('admin error-report resolve/dismiss', () => {
  // setErrorReportStatus already existed in db.js but had no route until now — admin.html's error
  // list had no way to clear a fixed error out of the panel, unlike the reports list right next to
  // it. Covers both the new routes and the reject-without-a-key path the routes above didn't (they
  // only exercised the pre-existing GET /admin/errors).
  //
  // adminKey is read inside the test, not the describe body — the describe callback runs
  // synchronously while the file's describe/test tree is still being registered, before the outer
  // before() hook has populated `server`, so reading server.dir up here would throw.
  test('resolve and dismiss update status, and both reject a wrong key', async () => {
    const adminKey = JSON.parse(fs.readFileSync(path.join(server.dir, 'admin-key.json'), 'utf8')).key;
    await fetch(`${BASE_URL}/errors/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'admin-error-resolve-test', stack: null, url: null }),
    });
    await sleep(150);
    const listRes = await fetch(`${BASE_URL}/admin/errors`, { headers: adminAuth(adminKey) });
    const { errors } = await listRes.json();
    const target = errors.find((e) => e.message === 'admin-error-resolve-test');
    assert.ok(target, 'the reported error should show up in the admin list');
    assert.equal(target.status, 'new');

    const wrongKeyRes = await fetch(`${BASE_URL}/admin/errors/${target.id}/resolve`, { method: 'POST', headers: adminAuth('wrong') });
    assert.equal(wrongKeyRes.status, 401);

    // Found by the admin-panel functional-correctness audit: GET /admin/errors now only ever
    // returns status='new' rows (see getRecentErrorReports's own comment in db.js) — admin.html
    // itself already discarded anything else client-side, so a resolved/dismissed item correctly
    // disappearing from this list entirely (not lingering with an updated status field) is the
    // actual intended contract, not a regression.
    const resolveRes = await fetch(`${BASE_URL}/admin/errors/${target.id}/resolve`, { method: 'POST', headers: adminAuth(adminKey) });
    assert.equal(resolveRes.status, 200);
    const afterResolve = await (await fetch(`${BASE_URL}/admin/errors`, { headers: adminAuth(adminKey) })).json();
    assert.ok(!afterResolve.errors.some((e) => e.id === target.id), 'a resolved error must no longer appear in the open list');

    // Re-report the same message to get a fresh 'new' row to exercise dismiss on its own.
    await fetch(`${BASE_URL}/errors/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'admin-error-dismiss-test', stack: null, url: null }),
    });
    await sleep(150);
    const target2 = (await (await fetch(`${BASE_URL}/admin/errors`, { headers: adminAuth(adminKey) })).json())
      .errors.find((e) => e.message === 'admin-error-dismiss-test');
    assert.ok(target2, 'the second reported error should show up in the admin list');

    const dismissRes = await fetch(`${BASE_URL}/admin/errors/${target2.id}/dismiss`, { method: 'POST', headers: adminAuth(adminKey) });
    assert.equal(dismissRes.status, 200);
    const afterDismiss = await (await fetch(`${BASE_URL}/admin/errors`, { headers: adminAuth(adminKey) })).json();
    assert.ok(!afterDismiss.errors.some((e) => e.id === target2.id), 'a dismissed error must no longer appear in the open list');
  });
});

describe('WS report -> /admin/reports pipeline', () => {
  // This is explicitly the pipeline for reaching a moderator when the room host isn't around
  // (any member can report, not just the host) — had zero coverage despite /admin/errors's
  // identical resolve/dismiss shape (directly above) being tested. If this silently broke,
  // reported abuse would vanish with no visible error to the reporter or the admin.
  test('a submitted report reaches /admin/reports, and resolve/dismiss update its status', async () => {
    const adminKey = JSON.parse(fs.readFileSync(path.join(server.dir, 'admin-key.json'), 'utf8')).key;
    const { ws: reporter, code } = await joinRoom('ReportSubmitter');
    const target = await joinExistingRoom('ReportTargetUser', code);
    await sleep(150);

    send(reporter, { type: 'report', targetName: 'ReportTargetUser', reason: 'being annoying' });
    await waitFor(reporter, (m) => m.type === 'report-received');

    const { reports } = await (await fetch(`${BASE_URL}/admin/reports`, { headers: adminAuth(adminKey) })).json();
    const found = reports.find((r) => r.target_name === 'ReportTargetUser' && r.room_code === code);
    assert.ok(found, 'the submitted report must show up in the admin list');
    assert.equal(found.status, 'new');
    assert.equal(found.reason, 'being annoying');

    // Found by the admin-panel functional-correctness audit: GET /admin/reports now only ever
    // returns status='new' rows (see getRecentReports's own comment in db.js) — admin.html itself
    // already discarded anything else client-side, so a resolved/dismissed report correctly
    // disappearing from this list entirely is the actual intended contract, not a regression.
    const resolveRes = await fetch(`${BASE_URL}/admin/reports/${found.id}/resolve`, { method: 'POST', headers: adminAuth(adminKey) });
    assert.equal(resolveRes.status, 200);
    const afterResolve = await (await fetch(`${BASE_URL}/admin/reports`, { headers: adminAuth(adminKey) })).json();
    assert.ok(!afterResolve.reports.some((r) => r.id === found.id), 'a resolved report must no longer appear in the open list');

    // A second report to exercise dismiss on its own fresh 'new' row.
    send(reporter, { type: 'report', targetName: 'ReportTargetUser', reason: 'still annoying' });
    await waitFor(reporter, (m) => m.type === 'report-received');
    const found2 = (await (await fetch(`${BASE_URL}/admin/reports`, { headers: adminAuth(adminKey) })).json())
      .reports.find((r) => r.reason === 'still annoying');
    assert.ok(found2, 'the second submitted report must show up in the admin list');

    const dismissRes = await fetch(`${BASE_URL}/admin/reports/${found2.id}/dismiss`, { method: 'POST', headers: adminAuth(adminKey) });
    assert.equal(dismissRes.status, 200);
    const afterDismiss = await (await fetch(`${BASE_URL}/admin/reports`, { headers: adminAuth(adminKey) })).json();
    assert.ok(!afterDismiss.reports.some((r) => r.id === found2.id), 'a dismissed report must no longer appear in the open list');

    reporter.close(); target.close();
  });
});

describe('load-older-messages pagination', () => {
  // Every room's scrollback depends on this beforeAt/hasMore cursor logic; had zero coverage.
  // Note: as of this writing, no client anywhere (grepped all of public/*.js) actually sends
  // load-older-messages — it's a fully-built, never-wired-up feature, so this is currently
  // unreachable by any real user. Still worth a real test: dead code today doesn't mean dead
  // forever, and a WS handler this precisely defined deserves the same coverage discipline as a
  // live one. Also a real, separate finding along the way: getMessagesBefore's `at < ?` comparison
  // has no tiebreaker — a message sharing the exact millisecond of the cursor (`beforeAt`) is
  // silently excluded, since `at < beforeAt` is false when they're equal. A rowid tiebreaker was
  // added to db.js for ORDER BY stability, but that alone can't fix this — the WHERE clause itself
  // would need the client to pass a compound cursor (at + the boundary message's own id), which
  // isn't worth doing for a handler nothing currently calls (see db.js's own comment on this). This
  // test reproduced that exact gap once (two back-to-back sends landing in the same millisecond
  // under load, even with an awaited round-trip between them) — a small explicit delay between
  // sends below sidesteps it, since the point of this test is the common case, not that known gap.
  test('returns exactly the messages older than a given cursor, oldest-first, with correct hasMore', async () => {
    const { ws } = await joinRoom('LoadOlderHost');
    // Only 4 messages, not 8 — join-server itself calls isWsMsgRateLimited (a real, if easy to
    // overlook, shared-budget gotcha: it already spends 1 of RATE_LIMIT_MAX_MESSAGES's 8 slots
    // before this loop's own sends even start), so a naive loop of 8 here reliably rate-limits its
    // own 8th send. 4 is comfortably clear of that and is all this test actually needs.
    const sent = [];
    for (let i = 0; i < 4; i++) {
      const text = `loadolder-${i}`;
      send(ws, { type: 'message', text });
      sent.push(await waitFor(ws, (m) => m.type === 'message' && m.text === text));
      await sleep(5); // guarantee distinct `at` millisecond timestamps — see the tiebreaker gap noted above
    }

    // Cursor = the 4th message (index 3) — messages 0,1,2 are strictly older and must come back.
    send(ws, { type: 'load-older-messages', beforeAt: sent[3].at });
    const older = await waitFor(ws, (m) => m.type === 'older-messages');
    assert.deepEqual(older.messages.map((m) => m.text), ['loadolder-0', 'loadolder-1', 'loadolder-2'], 'must return exactly the messages before the cursor, oldest-first');
    assert.equal(older.hasMore, false, 'only 3 messages exist before the cursor, well under the page cap — hasMore must be false');

    ws.close();
  });
});

describe('Trivia reconnect mid-round', () => {
  test('a reconnected player cannot answer the same question twice, and the rejoin correctly reports alreadyAnswered', async () => {
    const code = 'TVRECONNECT1';
    const p1 = await connectWs();
    const p2 = await connectWs();
    send(p1, { type: 'tv-join', code, name: 'TvPlayer1' });
    await waitFor(p1, (m) => m.type === 'tv-init');
    send(p2, { type: 'tv-join', code, name: 'TvPlayer2' });
    await waitFor(p2, (m) => m.type === 'tv-init');
    await sleep(150);

    // Both waiters must be armed *before* sending — broadcastTv delivers to p1 and p2
    // essentially simultaneously, so awaiting p1's wait first and only then arming p2's risked
    // missing a message that already arrived with no listener attached yet (same race class as
    // an earlier friend-dm test fix elsewhere in this file).
    const p1QuestionPromise = waitFor(p1, (m) => m.type === 'tv-question');
    const p2QuestionPromise = waitFor(p2, (m) => m.type === 'tv-question');
    send(p1, { type: 'tv-start' });
    await Promise.all([p1QuestionPromise, p2QuestionPromise]);

    send(p1, { type: 'tv-answer', choice: 0 });
    await waitFor(p1, (m) => m.type === 'tv-answer-ack');
    await sleep(150);

    // A "reconnect" is really just a fresh connection under the same name — tv-join mints a new
    // per-connection id every time, which is exactly the case this fix has to survive.
    const p1b = await connectWs();
    // Same race as above, one level deeper: tv-join's handler sends tv-init and (mid-round)
    // tv-question back-to-back synchronously, with no await between them — if both arrive in the
    // same synchronous read on the client side, waiting for tv-init first and only then arming a
    // second waitFor for tv-question risks missing it, since the two messages can already both be
    // "in flight" to already-registered listeners before this code resumes after the first await.
    const initPromise = waitFor(p1b, (m) => m.type === 'tv-init');
    const questionPromise = waitFor(p1b, (m) => m.type === 'tv-question');
    send(p1b, { type: 'tv-join', code, name: 'TvPlayer1' });
    const [, question] = await Promise.all([initPromise, questionPromise]);
    assert.equal(question.alreadyAnswered, true);

    let gotAck = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'tv-answer-ack') gotAck = true; };
    p1b.on('message', h);
    send(p1b, { type: 'tv-answer', choice: 1 });
    await sleep(300);
    p1b.off('message', h);
    assert.equal(gotAck, false, 'the reconnected connection must not be able to answer again');
  });
});

describe('Hangman reveals the word on a loss', () => {
  test('hm-round-end always carries the full word as a plain string', async () => {
    const ws = await connectWs();
    send(ws, { type: 'hm-join', code: 'HMWORD1', name: 'HmSolo' });
    await waitFor(ws, (m) => m.type === 'hm-init');
    send(ws, { type: 'hm-start' });
    await waitFor(ws, (m) => m.type === 'hm-round-start');

    // Guess enough letters to force a loss (HM_MAX_WRONG wrong guesses) — the actual word is
    // unknown to this test, so this just guesses a long, letter-diverse run until a round-end
    // arrives one way or the other.
    const letters = 'qxzjvwkybgfmpcdhlnrstuoiae'.split('');
    let ended = null;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'hm-round-end') ended = m; };
    ws.on('message', h);
    for (const l of letters) {
      if (ended) break;
      send(ws, { type: 'hm-guess-letter', letter: l });
      await sleep(60);
    }
    ws.off('message', h);
    assert.ok(ended, 'the round should have ended (won or lost) within a full alphabet sweep');
    assert.equal(typeof ended.word, 'string');
    assert.ok(ended.word.length > 0, 'hm-round-end must carry the real word — the client renderWord([...data.word]) fix depends on this');
  });
});

describe('Geometry Wave leaderboard submission cooldown', () => {
  test('an immediate completion is accepted, a rapid re-submission is blocked, and it recovers after the cooldown', async () => {
    const code = 'GWCOOLDOWN1';
    const ws = await connectWs();
    send(ws, { type: 'gw-join', code, level: 'easy', name: 'GwCooldownSolo' });
    await waitFor(ws, (m) => m.type === 'gw-init');

    // No min-session gate here (unlike arcade-submit-score) — gw-join fires when the player
    // actually starts the level, not on page load, so a genuinely fast clear of a short level
    // could be well under a few seconds.
    send(ws, { type: 'gw-complete', level: 'easy', percent: 50, name: 'GwCooldownSolo' });
    await sleep(200);
    send(ws, { type: 'gw-leaderboard', code, level: 'easy' });
    const result1 = await waitFor(ws, (m) => m.type === 'gw-leaderboard-result');
    assert.ok(result1.scores.some((s) => s.name === 'GwCooldownSolo' && s.score === 50));

    // bumpLeaderboard only ever keeps the max score, so this resubmission uses a HIGHER value —
    // otherwise a blocked-by-cooldown result would be indistinguishable from "correctly ignored
    // a lower score."
    send(ws, { type: 'gw-complete', level: 'easy', percent: 100, name: 'GwCooldownSolo' });
    await sleep(200);
    send(ws, { type: 'gw-leaderboard', code, level: 'easy' });
    const result2 = await waitFor(ws, (m) => m.type === 'gw-leaderboard-result');
    assert.equal(result2.scores.find((s) => s.name === 'GwCooldownSolo').score, 50, 'the higher score submitted within the cooldown window must not land');

    await sleep(2000);
    send(ws, { type: 'gw-complete', level: 'easy', percent: 100, name: 'GwCooldownSolo' });
    await sleep(200);
    send(ws, { type: 'gw-leaderboard', code, level: 'easy' });
    const result3 = await waitFor(ws, (m) => m.type === 'gw-leaderboard-result');
    assert.equal(result3.scores.find((s) => s.name === 'GwCooldownSolo').score, 100, 'a submission after the cooldown elapses should succeed');
  });

  // Found by the leaderboard/score-submission-integrity audit: gw-complete used to take `name`
  // straight from the client message instead of the session-tracked name gw-join already recorded
  // (every sibling game's submit path does the latter) — a raw WS client could plant a leaderboard
  // entry under any name, including impersonating a real other player.
  test('gw-complete ignores a spoofed name and always attributes the score to the joined session name', async () => {
    const code = 'GWSPOOF1';
    const ws = await connectWs();
    send(ws, { type: 'gw-join', code, level: 'easy', name: 'GwRealPlayer' });
    await waitFor(ws, (m) => m.type === 'gw-init');

    send(ws, { type: 'gw-complete', level: 'easy', percent: 77, name: 'SomeoneElseEntirely' });
    await sleep(200);
    send(ws, { type: 'gw-leaderboard', code, level: 'easy' });
    const result = await waitFor(ws, (m) => m.type === 'gw-leaderboard-result');
    assert.ok(result.scores.some((s) => s.name === 'GwRealPlayer' && s.score === 77), 'score must land under the real joined name');
    assert.ok(!result.scores.some((s) => s.name === 'SomeoneElseEntirely'), 'the spoofed name must never appear on the leaderboard');
  });
});

describe('edit and delete message', () => {
  test('a message owner can edit it; another room member cannot', async () => {
    const { ws: owner, code } = await joinRoom('EditOwner');
    const other = await joinExistingRoom('EditOther', code);
    await sleep(150);

    send(owner, { type: 'message', text: 'original text' });
    const posted = await waitFor(owner, (m) => m.type === 'message' && m.text === 'original text');

    let otherEditWorked = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'message-edited') otherEditWorked = true; };
    other.on('message', h);
    send(other, { type: 'edit-message', messageId: posted.id, text: 'hijacked!' });
    await sleep(300);
    other.off('message', h);
    assert.equal(otherEditWorked, false, 'a non-owner must not be able to edit someone else\'s message');

    send(owner, { type: 'edit-message', messageId: posted.id, text: 'edited text' });
    const edited = await waitFor(owner, (m) => m.type === 'message-edited');
    assert.equal(edited.text, 'edited text');
  });

  test('a muted user cannot edit their own existing message to bypass the mute', async () => {
    const { ws: host, code } = await joinRoom('EditMuteHost');
    const guest = await joinExistingRoom('EditMuteGuest', code);
    await sleep(150);

    send(guest, { type: 'message', text: 'before mute' });
    const posted = await waitFor(guest, (m) => m.type === 'message' && m.text === 'before mute');

    send(host, { type: 'mute-user', name: 'EditMuteGuest' });
    await waitFor(host, (m) => m.type === 'user-muted');
    await waitFor(guest, (m) => m.type === 'user-muted');

    let editWorked = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'message-edited') editWorked = true; };
    guest.on('message', h);
    send(guest, { type: 'edit-message', messageId: posted.id, text: 'sneaking this past the mute' });
    await sleep(300);
    guest.off('message', h);
    assert.equal(editWorked, false, 'a muted user must not be able to edit an existing message to say something new');
  });

  test('the message owner OR the room host can delete; anyone else cannot', async () => {
    const { ws: host, code } = await joinRoom('DelHost');
    const author = await joinExistingRoom('DelAuthor', code);
    const bystander = await joinExistingRoom('DelBystander', code);
    await sleep(150);

    send(author, { type: 'message', text: 'delete me' });
    const posted = await waitFor(author, (m) => m.type === 'message' && m.text === 'delete me');

    let bystanderDeleteWorked = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'message-deleted') bystanderDeleteWorked = true; };
    bystander.on('message', h);
    send(bystander, { type: 'delete-message', messageId: posted.id });
    await sleep(300);
    bystander.off('message', h);
    assert.equal(bystanderDeleteWorked, false, 'a bystander (not the author, not the host) must not be able to delete');

    // The host — not the author — deletes it, exercising the "OR is host" half of the check.
    send(host, { type: 'delete-message', messageId: posted.id });
    const deleted = await waitFor(host, (m) => m.type === 'message-deleted');
    assert.equal(deleted.messageId, posted.id);
  });
});

describe('polls', () => {
  test('a poll can be created and voted on', async () => {
    const { ws: creator, code } = await joinRoom('PollCreator');
    const voter = await joinExistingRoom('PollVoter', code);
    await sleep(150);

    send(creator, {
      type: 'message',
      mediaType: 'poll',
      mediaUrl: 'poll',
      text: JSON.stringify({ question: 'Best minigame?', options: ['Build Craft', 'Web Swing', 'Chess'] }),
    });
    const posted = await waitFor(creator, (m) => m.type === 'message' && m.mediaType === 'poll');

    send(voter, { type: 'vote-poll', messageId: posted.id, optionIndex: 1 });
    const voteUpdate = await waitFor(creator, (m) => m.type === 'poll-voted' && m.messageId === posted.id);
    assert.ok(voteUpdate.votes.some((v) => v.name === 'PollVoter' && v.optionIndex === 1));

    // A fresh join resends history via attachPollVotes(), which should carry the same vote.
    const joiner = await connectWs();
    send(joiner, { type: 'join-server', username: 'PollJoiner' });
    await waitFor(joiner, (m) => m.type === 'joined-server');
    send(joiner, { type: 'join-room', code });
    const joined = await waitFor(joiner, (m) => m.type === 'joined-room');
    const pollMsg = joined.messages.find((m) => m.id === posted.id);
    assert.ok(pollMsg, 'the poll message should be in the room history');
    assert.ok(pollMsg.votes.some((v) => v.name === 'PollVoter' && v.optionIndex === 1), 'the recorded vote should survive a fresh join');
  });

  test('vote-poll rejects a non-numeric optionIndex instead of writing NaN into the DB', async () => {
    const { ws: creator, code } = await joinRoom('PollNaNCreator');
    const voter = await joinExistingRoom('PollNaNVoter', code);
    await sleep(150);

    send(creator, {
      type: 'message',
      mediaType: 'poll',
      mediaUrl: 'poll',
      text: JSON.stringify({ question: 'NaN test?', options: ['A', 'B'] }),
    });
    const posted = await waitFor(creator, (m) => m.type === 'message' && m.mediaType === 'poll');

    // +'not-a-number' is NaN, and both `NaN < 0` and `NaN >= options.length` are false, so a bare
    // disjunction-of-bounds check would never trip and NaN would get bound straight into the DB.
    let voteBroadcast = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'poll-voted' && m.messageId === posted.id) voteBroadcast = true; };
    creator.on('message', h);
    send(voter, { type: 'vote-poll', messageId: posted.id, optionIndex: 'not-a-number' });
    await sleep(300);
    creator.off('message', h);
    assert.equal(voteBroadcast, false, 'a non-numeric optionIndex must not produce a vote');
  });
});

describe('pin and unpin', () => {
  test('pinning and unpinning a message updates the room\'s pin list for everyone', async () => {
    const { ws: host, code } = await joinRoom('PinHost');
    const guest = await joinExistingRoom('PinGuest', code);
    await sleep(150);

    send(host, { type: 'message', text: 'pin this' });
    const posted = await waitFor(host, (m) => m.type === 'message' && m.text === 'pin this');

    send(host, { type: 'pin-message', messageId: posted.id });
    const pinnedUpdate = await waitFor(guest, (m) => m.type === 'pins-updated');
    assert.ok(pinnedUpdate.pins.some((p) => p.message.id === posted.id));

    send(host, { type: 'unpin-message', messageId: posted.id });
    const unpinnedUpdate = await waitFor(guest, (m) => m.type === 'pins-updated');
    assert.ok(!unpinnedUpdate.pins.some((p) => p.message.id === posted.id));
  });

  test('flood of pin/unpin toggles is rate-limited (shares the same gate as chat messages)', async () => {
    const { ws: host } = await joinRoom('PinFloodHost');
    send(host, { type: 'message', text: 'pin flood target' });
    const posted = await waitFor(host, (m) => m.type === 'message' && m.text === 'pin flood target');

    let count = 0;
    const handler = (data) => { const m = JSON.parse(data); if (m.type === 'pins-updated') count++; };
    host.on('message', handler);
    for (let i = 0; i < 15; i++) send(host, { type: i % 2 === 0 ? 'pin-message' : 'unpin-message', messageId: posted.id });
    await sleep(500);
    host.off('message', handler);
    assert.ok(count > 0 && count <= 8, `expected 1-8 pins-updated broadcasts through, got ${count}`);
  });
});

describe('thread replies', () => {
  test('get-thread returns the root message and its replies, scoped to the requester\'s own room', async () => {
    const { ws: root, code } = await joinRoom('ThreadRoot');
    const replier = await joinExistingRoom('ThreadReplier', code);
    await sleep(150);

    send(root, { type: 'message', text: 'root message' });
    const rootMsg = await waitFor(root, (m) => m.type === 'message' && m.text === 'root message');

    send(replier, { type: 'message', text: 'a reply', replyTo: rootMsg.id });
    await waitFor(replier, (m) => m.type === 'message' && m.text === 'a reply');
    await sleep(150);

    send(root, { type: 'get-thread', messageId: rootMsg.id });
    const thread = await waitFor(root, (m) => m.type === 'thread-result');
    assert.equal(thread.root.id, rootMsg.id);
    assert.ok(thread.replies.some((r) => r.text === 'a reply'));
  });

  // Same "insert directly into the scratch server's own DB, in-process" approach as the DM-thread
  // and group-DM window tests elsewhere in this file — posting 205 real replies through the flood
  // gate would be far too slow for what's really a db.js query-shape question.
  test('a thread past the 200-reply window shows the most recent replies, not the oldest', async () => {
    const scratchDb = require(require('node:path').join(server.dir, 'db.js'));
    const { ws: root, code } = await joinRoom('ThreadWindowRoot');
    send(root, { type: 'message', text: 'root message' });
    const rootMsg = await waitFor(root, (m) => m.type === 'message' && m.text === 'root message');
    for (let i = 1; i <= 205; i++) {
      scratchDb.insertMessage({
        id: require('node:crypto').randomUUID(), roomCode: code, name: 'ThreadWindowRoot',
        text: 'r' + i, mediaUrl: null, mediaType: null, replyToId: rootMsg.id, at: Date.now() + i, accountId: null,
      });
    }
    send(root, { type: 'get-thread', messageId: rootMsg.id });
    const thread = await waitFor(root, (m) => m.type === 'thread-result');
    assert.equal(thread.replies.length, 200);
    assert.equal(thread.replies[0].text, 'r6', 'the oldest reply kept should be the 6th (205 - 200 + 1), not r1');
    assert.equal(thread.replies[thread.replies.length - 1].text, 'r205', 'the newest reply must be included');
  });
});

describe('Scorpture watch-live and signal-relay rate limits', () => {
  // Both tests below share one pair of accounts, signed up once here — the whole test file's
  // various /auth/signup calls all come from the same IP within one short run, and each one of
  // those separately used to eat into the shared AUTH_LIMIT_MAX=8/60s cap; consolidating into a
  // single before() (matching the "friend DMs and group DMs" describe block's own pattern above)
  // keeps this suite comfortably under that limit instead of flaking when the tests run in an
  // order where the budget's already spent.
  let streamerAToken, streamerBToken;
  before(async () => {
    const signup = async (username) => fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'pass1234', email: `${username.toLowerCase()}@test.com` }),
    }).then((r) => r.json());
    const [a, b] = await Promise.all([signup('ScorptureStreamer'), signup('ScorptureStreamerB')]);
    streamerAToken = a.token;
    streamerBToken = b.token;
  });

  test('rapid watch-live/leave-live cycling and signal bursts are both rate-limited', async () => {
    const streamer = await connectWs();
    send(streamer, { type: 'scorpture-hello', accountToken: streamerAToken });
    await waitFor(streamer, (m) => m.type === 'scorpture-hello-ack');
    send(streamer, { type: 'scorpture-go-live', title: 'Test Stream' });
    await waitFor(streamer, (m) => m.type === 'scorpture-go-live-ack');

    const viewer = await connectWs();
    let joinedCount = 0;
    const h1 = (data) => { const m = JSON.parse(data); if (m.type === 'scorpture-watch-ack' && m.live) joinedCount++; };
    viewer.on('message', h1);
    for (let i = 0; i < 15; i++) {
      send(viewer, { type: 'scorpture-watch-live', streamerUsername: 'ScorptureStreamer' });
      send(viewer, { type: 'scorpture-leave-live' });
    }
    await sleep(500);
    viewer.off('message', h1);
    assert.ok(joinedCount > 0 && joinedCount <= 8, `expected 1-8 of 15 watch attempts through, got ${joinedCount}`);

    await sleep(6500); // let the rate-limit window fully clear before testing the signal path
    send(viewer, { type: 'scorpture-watch-live', streamerUsername: 'ScorptureStreamer' });
    await waitFor(viewer, (m) => m.type === 'scorpture-watch-ack' && m.live);
    await sleep(200);

    let signalsReceived = 0;
    const h2 = (data) => { const m = JSON.parse(data); if (m.type === 'scorpture-signal') signalsReceived++; };
    streamer.on('message', h2);
    for (let i = 0; i < 15; i++) send(viewer, { type: 'scorpture-signal', signal: { fake: i } });
    await sleep(500);
    streamer.off('message', h2);
    assert.ok(signalsReceived > 0 && signalsReceived <= 8, `expected 1-8 of 15 signals relayed, got ${signalsReceived}`);
  });

  // A single connection can be simultaneously live (broadcasting its own stream) and watching
  // someone else's — the mini-widget lets a broadcaster keep streaming while browsing elsewhere.
  // Before this fix, scorpture-signal always treated such a connection as "just a viewer" and
  // rerouted its own outbound signaling (meant for one of ITS viewers) to whichever stream it was
  // watching instead — silently stranding that real viewer's connection.
  test('a broadcaster who is also watching another stream still reaches its own viewer, not the stream it is watching', async () => {
    const streamerA = await connectWs();
    send(streamerA, { type: 'scorpture-hello', accountToken: streamerAToken });
    await waitFor(streamerA, (m) => m.type === 'scorpture-hello-ack');
    send(streamerA, { type: 'scorpture-go-live', title: 'Stream A' });
    await waitFor(streamerA, (m) => m.type === 'scorpture-go-live-ack');

    const streamerB = await connectWs();
    send(streamerB, { type: 'scorpture-hello', accountToken: streamerBToken });
    await waitFor(streamerB, (m) => m.type === 'scorpture-hello-ack');
    send(streamerB, { type: 'scorpture-go-live', title: 'Stream B' });
    await waitFor(streamerB, (m) => m.type === 'scorpture-go-live-ack');

    const viewerOfA = await connectWs();
    const viewerJoinedPromise = waitFor(streamerA, (m) => m.type === 'scorpture-viewer-joined');
    send(viewerOfA, { type: 'scorpture-watch-live', streamerUsername: 'ScorptureStreamer' });
    await waitFor(viewerOfA, (m) => m.type === 'scorpture-watch-ack' && m.live);
    const { viewerId } = await viewerJoinedPromise;

    // Now A also starts watching B — this is the state that previously hijacked A's outbound
    // signaling.
    send(streamerA, { type: 'scorpture-watch-live', streamerUsername: 'ScorptureStreamerB' });
    await waitFor(streamerA, (m) => m.type === 'scorpture-watch-ack' && m.live);

    let bGotIt = false;
    const bHandler = (data) => { const m = JSON.parse(data); if (m.type === 'scorpture-signal' && m.signal && m.signal.marker === 'to-real-viewer') bGotIt = true; };
    streamerB.on('message', bHandler);
    const viewerPromise = waitFor(viewerOfA, (m) => m.type === 'scorpture-signal' && m.signal && m.signal.marker === 'to-real-viewer');
    send(streamerA, { type: 'scorpture-signal', viewerId, signal: { marker: 'to-real-viewer' } });
    const receivedByViewer = await viewerPromise;
    await sleep(200);
    streamerB.off('message', bHandler);
    assert.equal(receivedByViewer.signal.marker, 'to-real-viewer', "A's real viewer must receive A's own outbound signal");
    assert.equal(bGotIt, false, 'the stream A is merely watching must not receive signaling meant for A\'s own viewer');
  });
});

// Found by a Scorpture-signaling-authorization audit — same underlying failure mode as the
// voice-room fix above (an identity/association reassignment that doesn't tear down the OLD
// association first), and the same block-enforcement gap the email-mention push channel had.
describe('Scorpture live-stream signaling authorization', () => {
  let ownerToken, otherToken;
  before(async () => {
    const signup = async (username) => fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'pass1234', email: `${username.toLowerCase()}@test.com` }),
    }).then((r) => r.json());
    const [a, b] = await Promise.all([signup('ScorpAuthOwner'), signup('ScorpAuthOther')]);
    ownerToken = a.token;
    otherToken = b.token;
  });

  test('re-authenticating as a different account mid-connection ends the OLD account\'s live stream, not orphans it', async () => {
    const broadcaster = await connectWs();
    send(broadcaster, { type: 'scorpture-hello', accountToken: ownerToken });
    await waitFor(broadcaster, (m) => m.type === 'scorpture-hello-ack');
    send(broadcaster, { type: 'scorpture-go-live', title: 'Orphan Test Stream' });
    await waitFor(broadcaster, (m) => m.type === 'scorpture-go-live-ack');

    const viewer = await connectWs();
    send(viewer, { type: 'scorpture-watch-live', streamerUsername: 'ScorpAuthOwner' });
    await waitFor(viewer, (m) => m.type === 'scorpture-watch-ack' && m.live);

    // The exploit shape: the SAME still-open connection re-authenticates as a totally different
    // account, without ever sending scorpture-end-live for the first one.
    const streamEndedPromise = waitFor(viewer, (m) => m.type === 'scorpture-stream-ended');
    send(broadcaster, { type: 'scorpture-hello', accountToken: otherToken });
    await waitFor(broadcaster, (m) => m.type === 'scorpture-hello-ack');
    await streamEndedPromise;

    const live = await fetch(`${BASE_URL}/api/scorpture/live`).then((r) => r.json());
    assert.ok(!live.streams.some((s) => s.username === 'ScorpAuthOwner'), 'the old account\'s stream must not remain listed as live forever');

    broadcaster.close(); viewer.close();
  });

  test('a blocked account cannot watch-live', async () => {
    const blockRes = await fetch(`${BASE_URL}/friends/block`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ username: 'ScorpAuthOther' }),
    });
    assert.equal(blockRes.status, 200);

    const broadcaster = await connectWs();
    send(broadcaster, { type: 'scorpture-hello', accountToken: ownerToken });
    await waitFor(broadcaster, (m) => m.type === 'scorpture-hello-ack');
    send(broadcaster, { type: 'scorpture-go-live', title: 'Block Test Stream' });
    await waitFor(broadcaster, (m) => m.type === 'scorpture-go-live-ack');

    const blockedViewer = await connectWs();
    send(blockedViewer, { type: 'scorpture-hello', accountToken: otherToken });
    await waitFor(blockedViewer, (m) => m.type === 'scorpture-hello-ack');
    send(blockedViewer, { type: 'scorpture-watch-live', streamerUsername: 'ScorpAuthOwner' });
    const ack = await waitFor(blockedViewer, (m) => m.type === 'scorpture-watch-ack');
    assert.equal(ack.live, false, 'a blocked account must not be allowed to watch this stream');

    // Sanity: an unrelated, non-blocked viewer can still watch normally.
    const legitViewer = await connectWs();
    send(legitViewer, { type: 'scorpture-watch-live', streamerUsername: 'ScorpAuthOwner' });
    const legitAck = await waitFor(legitViewer, (m) => m.type === 'scorpture-watch-ack');
    assert.equal(legitAck.live, true, 'the block must not accidentally break watching for everyone else');

    broadcaster.close(); blockedViewer.close(); legitViewer.close();
  });

  // Distinct scenario from the watch-live test above: here the viewer starts watching legitimately
  // BEFORE any block exists (so watch-live's own block check never applies), then gets blocked
  // WHILE still registered as a live viewer — live-chat's own independent check is what has to
  // catch this, not watch-live's.
  test('a live-chat message is dropped once the viewer and streamer become blocked mid-watch', async () => {
    const signup = async (username) => fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'pass1234', email: `${username.toLowerCase()}@test.com` }),
    }).then((r) => r.json());
    const chatOther = await signup('ScorpAuthChatOther');

    const broadcaster = await connectWs();
    send(broadcaster, { type: 'scorpture-hello', accountToken: ownerToken });
    await waitFor(broadcaster, (m) => m.type === 'scorpture-hello-ack');
    send(broadcaster, { type: 'scorpture-go-live', title: 'Mid-Watch Block Test Stream' });
    await waitFor(broadcaster, (m) => m.type === 'scorpture-go-live-ack');

    const viewer = await connectWs();
    send(viewer, { type: 'scorpture-hello', accountToken: chatOther.token });
    await waitFor(viewer, (m) => m.type === 'scorpture-hello-ack');
    send(viewer, { type: 'scorpture-watch-live', streamerUsername: 'ScorpAuthOwner' });
    const ack = await waitFor(viewer, (m) => m.type === 'scorpture-watch-ack');
    assert.equal(ack.live, true, 'sanity: watching must succeed while unblocked');

    const blockRes = await fetch(`${BASE_URL}/friends/block`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ username: 'ScorpAuthChatOther' }),
    });
    assert.equal(blockRes.status, 200);

    let ownerSawChat = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'scorpture-live-chat') ownerSawChat = true; };
    broadcaster.on('message', h);
    send(viewer, { type: 'scorpture-live-chat', text: 'should not be delivered' });
    await sleep(300);
    broadcaster.off('message', h);
    assert.equal(ownerSawChat, false, "a since-blocked viewer's live-chat must not reach the streamer, even though they're still a registered viewer");

    broadcaster.close(); viewer.close();
  });

  // Found by a cross-session id-forgery audit: the broadcaster branch of scorpture-signal
  // authorized purely by "is this connection's ws.accountId the stream's owner", not by "is this
  // literally the stream's own on-file connection" — unlike scorpture-end-live, which already
  // correctly checks stream.ws === ws. A second tab/device signed into the SAME account as an
  // active broadcaster (not another account — that's not reachable, liveStreams is keyed by the
  // caller's own authenticated accountId) could inject signaling into that stream's real viewers
  // despite not holding their actual RTCPeerConnections. Self-harm only (can't reach another
  // account's stream), but worth closing for consistency with the established pattern.
  test('scorpture-signal from a second tab of the SAME broadcaster account is not relayed to real viewers', async () => {
    const realBroadcaster = await connectWs();
    send(realBroadcaster, { type: 'scorpture-hello', accountToken: ownerToken });
    await waitFor(realBroadcaster, (m) => m.type === 'scorpture-hello-ack');
    send(realBroadcaster, { type: 'scorpture-go-live', title: 'Second Tab Test Stream' });
    await waitFor(realBroadcaster, (m) => m.type === 'scorpture-go-live-ack');

    const viewer = await connectWs();
    const viewerJoinedPromise = waitFor(realBroadcaster, (m) => m.type === 'scorpture-viewer-joined');
    send(viewer, { type: 'scorpture-watch-live', streamerUsername: 'ScorpAuthOwner' });
    await waitFor(viewer, (m) => m.type === 'scorpture-watch-ack' && m.live);
    const { viewerId } = await viewerJoinedPromise;

    // A second tab of the SAME account — never sent scorpture-go-live itself, so it isn't the
    // stream's real ws, but ws.accountId still resolves to the same stream via liveStreams.
    const secondTab = await connectWs();
    send(secondTab, { type: 'scorpture-hello', accountToken: ownerToken });
    await waitFor(secondTab, (m) => m.type === 'scorpture-hello-ack');

    let viewerGotForged = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'scorpture-signal' && m.signal && m.signal.forged) viewerGotForged = true; };
    viewer.on('message', h);
    send(secondTab, { type: 'scorpture-signal', viewerId, signal: { forged: true } });
    await sleep(300);
    viewer.off('message', h);
    assert.equal(viewerGotForged, false, "a second tab of the broadcaster's own account must not be able to inject signaling into the stream's real viewers");

    // Sanity: the real broadcasting tab's own signaling still reaches the viewer.
    const legitPromise = waitFor(viewer, (m) => m.type === 'scorpture-signal' && m.signal && m.signal.legit);
    send(realBroadcaster, { type: 'scorpture-signal', viewerId, signal: { legit: true } });
    const legit = await legitPromise;
    assert.equal(legit.signal.legit, true);

    realBroadcaster.close(); viewer.close(); secondTab.close();
  });
});

describe('Scorpture channel description', () => {
  test('owner can set, update, and clear a channel description; a stranger cannot', async () => {
    const signup = async (username) => fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'pass1234', email: `${username.toLowerCase()}@test.com` }),
    }).then((r) => r.json());
    const owner = await signup('DescChannelOwner');

    const getChannel = () => fetch(`${BASE_URL}/api/scorpture/channels/DescChannelOwner`).then((r) => r.json());

    assert.equal((await getChannel()).description, null, 'a fresh channel has no description');

    const unauth = await fetch(`${BASE_URL}/api/scorpture/description`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'should not be allowed' }),
    });
    assert.equal(unauth.status, 401, 'setting a description with no bearer token must be rejected');
    assert.equal((await getChannel()).description, null, 'unauthenticated attempt must not have changed anything');

    const setRes = await fetch(`${BASE_URL}/api/scorpture/description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({ description: 'Welcome to my channel!' }),
    }).then((r) => r.json());
    assert.equal(setRes.description, 'Welcome to my channel!');
    assert.equal((await getChannel()).description, 'Welcome to my channel!', 'the public channel endpoint must reflect the new description');

    const longDescription = 'x'.repeat(5000);
    const clampedRes = await fetch(`${BASE_URL}/api/scorpture/description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({ description: longDescription }),
    }).then((r) => r.json());
    assert.equal(clampedRes.description.length, 1000, 'an oversized description must be clamped to 1000 chars');

    const clearRes = await fetch(`${BASE_URL}/api/scorpture/description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({ description: '' }),
    }).then((r) => r.json());
    assert.equal(clearRes.description, null, 'an empty description clears back to null');
    assert.equal((await getChannel()).description, null);
  });
});

describe('account-recovery/email-flow audit fixes', () => {
  // Found by an account-recovery/email-flow audit: pushMentionNotifications used to page EVERY
  // account sharing a mentioned email string (db.getAccountsByEmail) — but this app never verifies
  // email ownership at signup, and MAX_ACCOUNTS_PER_EMAIL explicitly permits several accounts to
  // share one email, so an attacker could register a throwaway account claiming a real person's
  // email and silently piggyback on every future mention-push meant for that address. Narrowed to
  // db.getAccountByEmail (oldest-created-wins), the same ambiguity resolution already used for
  // Google-sign-in account linking. This tests the exact piece of logic the fix now relies on,
  // requiring the scratch test instance's own db.js (never the real repo's) — same "require via
  // server.dir" pattern already used elsewhere in this suite for direct DB-state assertions.
  test('an email shared by multiple accounts resolves to only the oldest one for mention-push purposes', async () => {
    const scratchDb = require(require('node:path').join(server.dir, 'db.js'));
    const email = 'mentionshared@test.com';
    const older = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'MentionShareOlder', password: 'password123', email }),
    }).then((r) => r.json());
    await sleep(10); // ensure a distinct created_at from the second signup below
    const newer = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'MentionShareNewer', password: 'password123', email }),
    }).then((r) => r.json());

    const resolved = scratchDb.getAccountByEmail(email);
    const olderAccount = scratchDb.getSessionAccount(older.token);
    const newerAccount = scratchDb.getSessionAccount(newer.token);
    assert.equal(resolved.id, olderAccount.id, 'mention-push must resolve to the OLDEST account sharing this email');
    assert.notEqual(resolved.id, newerAccount.id, 'a later-signed-up account sharing the same email must not be the one paged');
  });

  // Found by the same audit: isScorptureAdmin used to check account.username === 'supdid67' &&
  // account.email === 'supdid41@gmail.com' — both self-reported, unverified fields any signup can
  // claim. Since this app never verifies email and has no account deletion (so there was never a
  // real "deleted/recreated account" case to defend against), matching that exact string pair
  // provided no actual defense-in-depth. Fixed to key off account.id, this app's one truly
  // immutable identifier.
  test('the Scorpture admin gate is keyed off account id, not a matching username/email pair', async () => {
    const signup = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'supdid67', password: 'password123', email: 'supdid41@gmail.com' }),
    }).then((r) => r.json());
    const res = await fetch(`${BASE_URL}/api/scorpture/admin/bonus-subscribers`, {
      headers: { Authorization: `Bearer ${signup.token}` },
    });
    assert.equal(res.status, 403, 'an exact username+email match must not grant Scorpture admin access any more');
  });
});

describe('Scorpture video creation is rate-limited', () => {
  // Unlike its siblings (.../comments, .../report — both already rate-limited), POST
  // /api/scorpture/videos had no throttle at all — nothing stopped reusing one already-uploaded
  // videoUrl across unlimited create calls, each a fresh unbounded row in scorpture_videos.
  test('flood of video creates reusing one uploaded file is rate-limited', async () => {
    const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ScorpVideoFlood', password: 'password123', email: 'scorpvideoflood@test.com' }),
    });
    const { token } = await signupRes.json();

    // isPostMediaRateLimited is a shared per-IP budget with every other route this session added
    // it to — let it fully clear first so this test starts from a known, fresh state instead of
    // inheriting spend from whichever test ran immediately before it (same discipline as the
    // /room-qr + /link-preview pair above).
    await sleep(6500);

    const form = new FormData();
    form.append('file', new Blob(['flood video content'], { type: 'video/mp4' }), 'flood.mp4');
    const { url } = await (await fetch(`${BASE_URL}/upload`, { method: 'POST', body: form })).json();

    let created = 0;
    let sawLimited = false;
    for (let i = 0; i < 15; i++) {
      const res = await fetch(`${BASE_URL}/api/scorpture/videos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: 'Flood ' + i, videoUrl: url }),
      });
      if (res.status === 200) created++;
      else if (res.status === 429) sawLimited = true;
    }
    assert.ok(created > 0, 'at least some video creates should succeed before the limit kicks in');
    assert.ok(sawLimited, 'a burst of 15 creates reusing one upload should eventually hit the rate limit');
  });
});

describe('Scorpture comments stay in order after the N+1 fix', () => {
  // getScorptureComments used to be a plain unbounded ORDER BY created_at ASC — rewritten to a
  // capped ORDER BY created_at DESC LIMIT + .reverse() (same pattern as getWhiteboardStrokes) so
  // an unbounded comment thread can't grow forever on a hot read path. Worth a real ordering check
  // since a DESC-then-reverse rewrite is an easy place to introduce an off-by-one or reversed order.
  test('comments come back oldest-first', async () => {
    const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ScorpCommentOrder', password: 'password123', email: 'scorpcommentorder@test.com' }),
    });
    const { token } = await signupRes.json();
    await sleep(6500); // clear the shared isPostMediaRateLimited budget before this test's own requests

    const form = new FormData();
    form.append('file', new Blob(['comment order test video'], { type: 'video/mp4' }), 'order.mp4');
    const { url } = await (await fetch(`${BASE_URL}/upload`, { method: 'POST', body: form })).json();

    const video = await fetch(`${BASE_URL}/api/scorpture/videos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: 'Comment order test', videoUrl: url }),
    }).then((r) => r.json());

    for (const text of ['first', 'second', 'third']) {
      await fetch(`${BASE_URL}/api/scorpture/videos/${video.id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
    }

    const { comments } = await fetch(`${BASE_URL}/api/scorpture/videos/${video.id}/comments`).then((r) => r.json());
    assert.deepEqual(comments.map((c) => c.text), ['first', 'second', 'third'], 'comments must stay in oldest-first order after the DESC+LIMIT+reverse rewrite');
  });

  // getScorptureComments used to be a raw `SELECT *`, shipping account_id/video_id straight to
  // res.json — this route has no auth check at all, so any anonymous caller got a commenter's
  // permanent internal account id, a stable identifier that (unlike username) survives a name
  // change. The client never reads either field (it compares c.username to tell "is this mine").
  test('GET .../comments never leaks a commenter\'s internal account_id (or video_id) to an anonymous caller', async () => {
    const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ScorpCommentPriv', password: 'password123', email: 'scorpcommentpriv@test.com' }),
    });
    const { token } = await signupRes.json();
    await sleep(6500); // clear the shared isPostMediaRateLimited budget before this test's own requests

    const form = new FormData();
    form.append('file', new Blob(['comment privacy test video'], { type: 'video/mp4' }), 'priv.mp4');
    const { url } = await (await fetch(`${BASE_URL}/upload`, { method: 'POST', body: form })).json();

    const video = await fetch(`${BASE_URL}/api/scorpture/videos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: 'Comment privacy test', videoUrl: url }),
    }).then((r) => r.json());

    await fetch(`${BASE_URL}/api/scorpture/videos/${video.id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: 'no peeking at my account id' }),
    });

    // Deliberately no Authorization header — this route is reachable anonymously.
    const { comments } = await fetch(`${BASE_URL}/api/scorpture/videos/${video.id}/comments`).then((r) => r.json());
    assert.equal(comments.length, 1);
    assert.equal(comments[0].username, 'ScorpCommentPriv');
    assert.equal('account_id' in comments[0], false, 'account_id must not be present on the comment object');
    assert.equal('video_id' in comments[0], false, 'video_id must not be present on the comment object');
  });
});

describe('Scorpture video edit/delete are ownership-gated', () => {
  // POST (create) is well covered elsewhere; PUT (edit) and DELETE had zero coverage despite both
  // being ownership-gated on the uploader_id — a broken check here means any signed-in user could
  // edit or permanently delete someone else's video (DELETE also removes the files from disk).
  test('a different account cannot edit or delete someone else\'s video; the owner can', async () => {
    const signup = async (username) => fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'pass1234', email: `${username.toLowerCase()}@test.com` }),
    }).then((r) => r.json());
    const owner = await signup('ScorpOwnerCheck');
    const stranger = await signup('ScorpStrangerCheck');
    await sleep(6500); // clear the shared isPostMediaRateLimited budget

    const form = new FormData();
    form.append('file', new Blob(['ownership test video'], { type: 'video/mp4' }), 'owner.mp4');
    const { url } = await (await fetch(`${BASE_URL}/upload`, { method: 'POST', body: form })).json();
    const video = await fetch(`${BASE_URL}/api/scorpture/videos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({ title: 'Original title', videoUrl: url }),
    }).then((r) => r.json());

    const strangerEditRes = await fetch(`${BASE_URL}/api/scorpture/videos/${video.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${stranger.token}` },
      body: JSON.stringify({ title: 'Hijacked title' }),
    });
    assert.equal(strangerEditRes.status, 403, 'a non-owner must not be able to edit the video');

    const strangerDeleteRes = await fetch(`${BASE_URL}/api/scorpture/videos/${video.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${stranger.token}` },
    });
    assert.equal(strangerDeleteRes.status, 403, 'a non-owner must not be able to delete the video');

    const ownerEditRes = await fetch(`${BASE_URL}/api/scorpture/videos/${video.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({ title: 'Owner-edited title' }),
    });
    assert.equal(ownerEditRes.status, 200, 'the real owner must be able to edit their own video');
    assert.equal((await ownerEditRes.json()).title, 'Owner-edited title');

    const ownerDeleteRes = await fetch(`${BASE_URL}/api/scorpture/videos/${video.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${owner.token}` },
    });
    assert.equal(ownerDeleteRes.status, 200, 'the real owner must be able to delete their own video');

    const gone = await fetch(`${BASE_URL}/api/scorpture/videos/${video.id}`);
    assert.equal(gone.status, 404, 'the video must actually be gone after the owner deletes it');
  });
});

describe('POST /account/username enforces format and uniqueness', () => {
  test('a valid rename succeeds and is reflected in /auth/me; an invalid or taken name is rejected', async () => {
    const signup = async (username) => fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'pass1234', email: `${username.toLowerCase()}@test.com` }),
    }).then((r) => r.json());
    const a = await signup('UsernameCheckA');
    const b = await signup('UsernameCheckB');

    const badRes = await fetch(`${BASE_URL}/account/username`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.token}` },
      body: JSON.stringify({ username: 'x' }), // too short for USERNAME_RE
    });
    assert.equal(badRes.status, 400);

    const takenRes = await fetch(`${BASE_URL}/account/username`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.token}` },
      body: JSON.stringify({ username: 'UsernameCheckB' }),
    });
    assert.equal(takenRes.status, 409, 'a username already taken by another account must be rejected');

    const goodRes = await fetch(`${BASE_URL}/account/username`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.token}` },
      body: JSON.stringify({ username: 'UsernameCheckA2' }),
    });
    assert.equal(goodRes.status, 200);
    assert.equal((await goodRes.json()).username, 'UsernameCheckA2');

    const me = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${a.token}` } }).then((r) => r.json());
    assert.equal(me.username, 'UsernameCheckA2', 'the rename must actually take effect, not just report success');
  });
});

describe('Build Craft sleep consensus', () => {
  test('a non-sleeping player disconnecting re-triggers the consensus check instead of leaving sleepers stuck', async () => {
    const code = 'BCSLEEPTEST1';
    const a = await connectWs();
    const b = await connectWs();
    send(a, { type: 'bc-join', code, name: 'BcSleepA' });
    await waitFor(a, (m) => m.type === 'bc-init');
    send(b, { type: 'bc-join', code, name: 'BcSleepB' });
    await waitFor(b, (m) => m.type === 'bc-init');
    await sleep(150);

    send(a, { type: 'bc-sleep' });
    const count1 = await waitFor(a, (m) => m.type === 'bc-sleep-count');
    assert.equal(count1.sleeping, 1);
    assert.equal(count1.total, 2);

    // B disconnects without ever sleeping — players.size drops to 1, which now numerically
    // matches sleeping.size (still 1). Before the fix, nothing re-evaluated the threshold after
    // a disconnect, so A would stay stuck showing "waiting for everyone else" forever.
    b.close();
    const skipNight = await waitFor(a, (m) => m.type === 'bc-skip-night', 3000);
    assert.ok(Number.isFinite(skipNight.offsetMs));
  });

  test('bc-wake clears the sender from the sleeping set', async () => {
    // Needs a second (non-sleeping) player, or a lone sleeper's bc-sleep would immediately
    // satisfy consensus on its own and auto-clear bc.sleeping before bc-wake is even sent —
    // that would make this test pass without actually exercising the cancel path.
    const code = 'BCSLEEPTEST2';
    const ws = await connectWs();
    const other = await connectWs();
    send(ws, { type: 'bc-join', code, name: 'BcWakeSolo' });
    await waitFor(ws, (m) => m.type === 'bc-init');
    send(other, { type: 'bc-join', code, name: 'BcWakeOther' });
    await waitFor(other, (m) => m.type === 'bc-init');
    await sleep(150);

    send(ws, { type: 'bc-sleep' });
    await waitFor(ws, (m) => m.type === 'bc-sleep-count' && m.sleeping === 1 && m.total === 2);
    send(ws, { type: 'bc-wake' });
    const afterWake = await waitFor(ws, (m) => m.type === 'bc-sleep-count');
    assert.equal(afterWake.sleeping, 0);
  });
});

describe('Build Craft fall-damage flood gate', () => {
  test('bc-fall-damage is rate-limited — unlike bc-punch it had no cooldown of its own, and every call broadcasts to the whole room', async () => {
    const code = 'BCFALLFLOOD1';
    const victim = await connectWs();
    const watcher = await connectWs();
    send(victim, { type: 'bc-join', code, name: 'BcFallVictim' });
    await waitFor(victim, (m) => m.type === 'bc-init');
    send(watcher, { type: 'bc-join', code, name: 'BcFallWatcher' });
    await waitFor(watcher, (m) => m.type === 'bc-init');
    await sleep(150);

    let hitCount = 0;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'bc-hit') hitCount++; };
    watcher.on('message', h);
    for (let i = 0; i < 15; i++) send(victim, { type: 'bc-fall-damage', amount: 1 });
    await sleep(500);
    watcher.off('message', h);
    assert.ok(hitCount > 0 && hitCount <= 8, `expected 1-8 of 15 bc-hit broadcasts through, got ${hitCount}`);
  });
});

describe('Build Craft position broadcast flood gate', () => {
  // Real-time position streams (bc-pos, and the same-pattern gw-pos/sw-pos) legitimately run much
  // faster than chat — the client throttles itself to ~8/sec, but nothing server-side enforced
  // that before this fix. Uses the higher-throughput isStrokeRateLimited gate (20/sec) instead of
  // the standard chat gate (~1.3/sec), which would break real gameplay smoothness.
  test('bc-pos is rate-limited at the higher stroke-rate ceiling, not the much tighter chat-message one', async () => {
    const code = 'BCPOSFLOOD1';
    const mover = await connectWs();
    const watcher = await connectWs();
    send(mover, { type: 'bc-join', code, name: 'BcPosMover' });
    await waitFor(mover, (m) => m.type === 'bc-init');
    send(watcher, { type: 'bc-join', code, name: 'BcPosWatcher' });
    await waitFor(watcher, (m) => m.type === 'bc-init');
    await sleep(150);

    let posCount = 0;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'bc-pos') posCount++; };
    watcher.on('message', h);
    for (let i = 0; i < 60; i++) send(mover, { type: 'bc-pos', x: i, y: 0, z: 0, yaw: 0 });
    await sleep(500);
    watcher.off('message', h);
    assert.ok(posCount > 8, `expected more than the tight chat-gate ceiling (8) to get through, got ${posCount}`);
    assert.ok(posCount > 0 && posCount <= 40, `expected 1-40 of 60 bc-pos broadcasts through, got ${posCount}`);
  });
});

describe('minigame *-join leaves the previous session before joining a new one', () => {
  // Without this guard, a second *-join on the same connection for a different room/level
  // overwrites ws.XRoom without ever removing this ws from the OLD session's players Map — the
  // stale entry is then unreachable (its ws no longer reports ws.XRoom === that room), so real
  // disconnect cleanup never finds it, permanently pinning the old room's whole state in memory.
  // fg-join/bb-join/ch-join/tt-join already had this guard; bc/gw/sw/tv/hm/dg/wb-join did not.
  // The observable proof the guard works: a bystander left behind in the OLD room/level sees the
  // departing player's *-player-left broadcast the moment the second join fires, without ever
  // sending an explicit *-leave.
  test('bc-join: joining a second room leaves the first (bystander sees bc-player-left)', async () => {
    const mover = await connectWs();
    const bystander = await connectWs();
    send(mover, { type: 'bc-join', code: 'BCREJOINOLD', name: 'BcRejoinMover' });
    await waitFor(mover, (m) => m.type === 'bc-init');
    send(bystander, { type: 'bc-join', code: 'BCREJOINOLD', name: 'BcRejoinBystander' });
    await waitFor(bystander, (m) => m.type === 'bc-init');
    await sleep(150);

    send(mover, { type: 'bc-join', code: 'BCREJOINNEW', name: 'BcRejoinMover' });
    const left = await waitFor(bystander, (m) => m.type === 'bc-player-left');
    assert.ok(left, 'the old room should see the mover leave once it joins a different room');
    await waitFor(mover, (m) => m.type === 'bc-init');
  });

  test('gw-join: joining a different level in the same room leaves the old level session (bystander sees gw-player-left)', async () => {
    const mover = await connectWs();
    const bystander = await connectWs();
    const code = 'GWREJOIN1';
    send(mover, { type: 'gw-join', code, level: 'easy', name: 'GwRejoinMover' });
    await waitFor(mover, (m) => m.type === 'gw-init');
    send(bystander, { type: 'gw-join', code, level: 'easy', name: 'GwRejoinBystander' });
    await waitFor(bystander, (m) => m.type === 'gw-init');
    await sleep(150);

    send(mover, { type: 'gw-join', code, level: 'hard', name: 'GwRejoinMover' });
    const left = await waitFor(bystander, (m) => m.type === 'gw-player-left');
    assert.ok(left, 'the old level session should see the mover leave once it joins a different level');
    await waitFor(mover, (m) => m.type === 'gw-init');
  });
});

describe('cosmetic/settings toggles without natural bounding are rate-limited', () => {
  // Unlike bc-claim (capped at BC_MAX_CLAIMS_PER_PLAYER) or dg-start/tv-start (can't restart an
  // active round), these have no such natural limit — freely toggleable at will, each broadcasting
  // to the room. All share the standard isWsMsgRateLimited gate (not the higher-throughput one
  // bc-pos uses — these aren't meant to be sent at real-time-movement frequency).
  test('bc-set-skin flood is rate-limited', async () => {
    const code = 'BCSKINFLOOD1';
    const changer = await connectWs();
    const watcher = await connectWs();
    send(changer, { type: 'bc-join', code, name: 'BcSkinChanger' });
    await waitFor(changer, (m) => m.type === 'bc-init');
    send(watcher, { type: 'bc-join', code, name: 'BcSkinWatcher' });
    await waitFor(watcher, (m) => m.type === 'bc-init');
    await sleep(150);

    let count = 0;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'bc-skin-changed') count++; };
    watcher.on('message', h);
    for (let i = 0; i < 15; i++) send(changer, { type: 'bc-set-skin', color: i % 2 === 0 ? '#ff0000' : '#00ff00' });
    await sleep(500);
    watcher.off('message', h);
    assert.ok(count > 0 && count <= 8, `expected 1-8 bc-skin-changed broadcasts through, got ${count}`);
  });

  test('dg-set-spectator flood is rate-limited', async () => {
    const code = 'DGSPECFLOOD1';
    const toggler = await connectWs();
    const watcher = await connectWs();
    send(toggler, { type: 'dg-join', code, name: 'DgSpecToggler' });
    await waitFor(toggler, (m) => m.type === 'dg-init');
    send(watcher, { type: 'dg-join', code, name: 'DgSpecWatcher' });
    await waitFor(watcher, (m) => m.type === 'dg-init');
    await sleep(150);

    let count = 0;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'dg-spectator-changed') count++; };
    watcher.on('message', h);
    for (let i = 0; i < 15; i++) send(toggler, { type: 'dg-set-spectator', spectate: i % 2 === 0 });
    await sleep(500);
    watcher.off('message', h);
    assert.ok(count > 0 && count <= 8, `expected 1-8 dg-spectator-changed broadcasts through, got ${count}`);
  });
});

describe('orphaned upload sweep', () => {
  // POST /upload is public and unauthenticated (needed by every "attach media" feature), and
  // nothing ever required the returned URL to actually get used for anything — a file uploaded
  // and never attached anywhere lived on disk forever with no size quota, an unauthenticated
  // disk-fill DoS. Uses its own dedicated server instance (distinct port) with the grace/sweep
  // timers shrunk to milliseconds via env override, so this test doesn't have to wait on the real
  // 15-minute/5-minute production values or affect the one shared instance every other test uses.
  test('an unclaimed upload gets swept after the grace period; a claimed one survives it', async () => {
    const sweepServer = await startTestServer(
      { UPLOAD_CLAIM_GRACE_MS: '150', UPLOAD_SWEEP_INTERVAL_MS: '150' },
      3198
    );
    try {
      const base = `http://localhost:${sweepServer.port}`;

      const uploadOne = async (name) => {
        const form = new FormData();
        form.append('file', new Blob([`fake file content ${name}`], { type: 'image/png' }), `${name}.png`);
        const res = await fetch(`${base}/upload`, { method: 'POST', body: form });
        const data = await res.json();
        return data.url;
      };
      const unclaimedUrl = await uploadOne('unclaimed');
      const claimedUrl = await uploadOne('claimed');

      // Room needs to actually exist in-memory (rooms.get(code)) for /post-image to accept a
      // post into it — created via a real WS join, same as every other real client.
      const ws = new WebSocket(`ws://localhost:${sweepServer.port}`);
      await new Promise((resolve) => ws.on('open', resolve));
      ws.send(JSON.stringify({ type: 'join-server', username: 'UploadSweepHost' }));
      await new Promise((resolve) => {
        const h = (data) => { if (JSON.parse(data).type === 'joined-server') { ws.off('message', h); resolve(); } };
        ws.on('message', h);
      });
      ws.send(JSON.stringify({ type: 'create-room' }));
      const code = await new Promise((resolve) => {
        const h = (data) => { const m = JSON.parse(data); if (m.type === 'joined-room') { ws.off('message', h); resolve(m.code); } };
        ws.on('message', h);
      });

      const claimRes = await fetch(`${base}/post-image`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name: 'UploadSweepHost', mediaUrl: claimedUrl, prompt: 'x' }),
      });
      assert.equal(claimRes.status, 200, 'claiming the upload via /post-image should succeed');

      // Both files exist immediately after upload, before any sweep has had a chance to run.
      assert.equal((await fetch(`${base}${unclaimedUrl}`)).status, 200);
      assert.equal((await fetch(`${base}${claimedUrl}`)).status, 200);

      // Past at least one full grace-period-then-sweep-interval cycle.
      await sleep(600);

      assert.equal((await fetch(`${base}${claimedUrl}`)).status, 200, 'a claimed upload must survive the sweep');
      assert.equal((await fetch(`${base}${unclaimedUrl}`)).status, 404, 'an unclaimed upload must be swept away');

      ws.close();
    } finally {
      await sweepServer.stop();
    }
  });

  // /post-image, /post-media, and POST /api/scorpture/videos all used to call claimUpload()
  // before their own later rejection checks (room not found, banned/muted, missing title, etc.)
  // — a routine rejection (not just a rare DB failure) on a call that carried a perfectly real,
  // just-uploaded file left that file claimed-and-therefore-unsweepable forever, the exact
  // "orphaned upload lives on disk with nothing referencing it" gap this app has flagged before.
  // Fixed by moving claimUpload() to after every rejection check; these three cover one rejection
  // path per route and confirm the upload still gets swept, proving it was never (wrongly) claimed.
  test('a rejected /post-image call (room not found) leaves its upload unclaimed and sweepable', async () => {
    const sweepServer = await startTestServer(
      { UPLOAD_CLAIM_GRACE_MS: '150', UPLOAD_SWEEP_INTERVAL_MS: '150' },
      3200
    );
    try {
      const base = `http://localhost:${sweepServer.port}`;
      const form = new FormData();
      form.append('file', new Blob(['rejected post-image content'], { type: 'image/png' }), 'x.png');
      const { url } = await (await fetch(`${base}/upload`, { method: 'POST', body: form })).json();

      const res = await fetch(`${base}/post-image`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'NOSUCHROOM', name: 'Someone', mediaUrl: url, prompt: 'x' }),
      });
      assert.equal(res.status, 404, 'a nonexistent room code must be rejected');

      await sleep(600);
      assert.equal((await fetch(`${base}${url}`)).status, 404, 'the upload from a rejected post must still be swept');
    } finally {
      await sweepServer.stop();
    }
  });

  test('a rejected /post-media call (room not found) leaves its upload unclaimed and sweepable', async () => {
    const sweepServer = await startTestServer(
      { UPLOAD_CLAIM_GRACE_MS: '150', UPLOAD_SWEEP_INTERVAL_MS: '150' },
      3201
    );
    try {
      const base = `http://localhost:${sweepServer.port}`;
      const form = new FormData();
      form.append('file', new Blob(['rejected post-media content'], { type: 'video/mp4' }), 'x.mp4');
      const { url } = await (await fetch(`${base}/upload`, { method: 'POST', body: form })).json();

      const res = await fetch(`${base}/post-media`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'NOSUCHROOM', name: 'Someone', mediaUrl: url, mediaType: 'video', caption: 'x' }),
      });
      assert.equal(res.status, 404, 'a nonexistent room code must be rejected');

      await sleep(600);
      assert.equal((await fetch(`${base}${url}`)).status, 404, 'the upload from a rejected post must still be swept');
    } finally {
      await sweepServer.stop();
    }
  });

  test('a rejected Scorpture video create (missing title) leaves its uploads unclaimed and sweepable', async () => {
    const sweepServer = await startTestServer(
      { UPLOAD_CLAIM_GRACE_MS: '150', UPLOAD_SWEEP_INTERVAL_MS: '150' },
      3202
    );
    try {
      const base = `http://localhost:${sweepServer.port}`;
      const signupRes = await fetch(`${base}/auth/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ScorpUploadReject', password: 'password123', email: 'scorpuploadreject@test.com' }),
      });
      const { token } = await signupRes.json();

      const form = new FormData();
      form.append('file', new Blob(['rejected scorpture video content'], { type: 'video/mp4' }), 'x.mp4');
      const { url } = await (await fetch(`${base}/upload`, { method: 'POST', body: form })).json();

      const res = await fetch(`${base}/api/scorpture/videos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: '', videoUrl: url }),
      });
      assert.equal(res.status, 400, 'a missing title must be rejected');

      await sleep(600);
      assert.equal((await fetch(`${base}${url}`)).status, 404, 'the video upload from a rejected create must still be swept');
    } finally {
      await sweepServer.stop();
    }
  });

  test('a rejected WS chat message (empty text + invalid mediaType) leaves its upload unclaimed and sweepable', async () => {
    const sweepServer = await startTestServer(
      { UPLOAD_CLAIM_GRACE_MS: '150', UPLOAD_SWEEP_INTERVAL_MS: '150' },
      3203
    );
    try {
      const base = `http://localhost:${sweepServer.port}`;
      const form = new FormData();
      form.append('file', new Blob(['rejected chat message content'], { type: 'image/png' }), 'x.png');
      const { url } = await (await fetch(`${base}/upload`, { method: 'POST', body: form })).json();

      const ws = new WebSocket(`ws://localhost:${sweepServer.port}`);
      await new Promise((resolve) => ws.on('open', resolve));
      ws.send(JSON.stringify({ type: 'join-server', username: 'MsgUploadReject' }));
      await new Promise((resolve) => {
        const h = (data) => { if (JSON.parse(data).type === 'joined-server') { ws.off('message', h); resolve(); } };
        ws.on('message', h);
      });
      ws.send(JSON.stringify({ type: 'create-room' }));
      await new Promise((resolve) => {
        const h = (data) => { if (JSON.parse(data).type === 'joined-room') { ws.off('message', h); resolve(); } };
        ws.on('message', h);
      });

      // A real uploaded file, but an invalid mediaType and no text — the handler must silently
      // drop this (no 'message' broadcast) rather than post it.
      let sawMessage = false;
      const h = (data) => { if (JSON.parse(data).type === 'message') sawMessage = true; };
      ws.on('message', h);
      ws.send(JSON.stringify({ type: 'message', text: '', mediaUrl: url, mediaType: 'not-a-real-type' }));
      await sleep(300);
      ws.off('message', h);
      assert.equal(sawMessage, false, 'a message with an invalid mediaType and no text must be dropped, not posted');

      await sleep(600);
      assert.equal((await fetch(`${base}${url}`)).status, 404, 'the upload from a dropped message must still be swept');
      ws.close();
    } finally {
      await sweepServer.stop();
    }
  });

  test('a rejected Scorpture overlays save (one invalid item) leaves every image in the list unclaimed and sweepable', async () => {
    const sweepServer = await startTestServer(
      { UPLOAD_CLAIM_GRACE_MS: '150', UPLOAD_SWEEP_INTERVAL_MS: '150' },
      3204
    );
    try {
      const base = `http://localhost:${sweepServer.port}`;
      const signupRes = await fetch(`${base}/auth/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'OverlayUploadReject', password: 'password123', email: 'overlayuploadreject@test.com' }),
      });
      const { token } = await signupRes.json();

      const form = new FormData();
      form.append('file', new Blob(['rejected overlay content'], { type: 'image/png' }), 'ov.png');
      const { url } = await (await fetch(`${base}/upload`, { method: 'POST', body: form })).json();

      // The valid image overlay comes FIRST in the list — the bug claimed it during the loop
      // before ever reaching the second, invalid (empty content) item that aborts the whole save.
      const res = await fetch(`${base}/api/scorpture/overlays`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ overlays: [
          { type: 'image', content: url, position: 'top-left' },
          { type: 'text', content: '', position: 'top-left' },
        ] }),
      });
      assert.equal(res.status, 400, 'an overlay with empty content must be rejected');

      await sleep(600);
      assert.equal((await fetch(`${base}${url}`)).status, 404, 'the earlier valid image\'s upload must still be swept since the whole save was rejected');
    } finally {
      await sweepServer.stop();
    }
  });

  // AI Studio's gallery is entirely client-side (localStorage, no server row at all) and
  // explicitly meant to keep a captioned meme's uploaded composite around indefinitely (it has
  // its own "remove from gallery" control — a real managed collection, not a throwaway). Without
  // a way to claim an upload that's never posted to a room, a gallery-only image would silently
  // 404 once the sweep caught up to it.
  test('/claim-upload protects a file with no other server-side reference to it', async () => {
    const sweepServer = await startTestServer(
      { UPLOAD_CLAIM_GRACE_MS: '150', UPLOAD_SWEEP_INTERVAL_MS: '150' },
      3194
    );
    try {
      const base = `http://localhost:${sweepServer.port}`;
      const form = new FormData();
      form.append('file', new Blob(['gallery-only content'], { type: 'image/jpeg' }), 'meme.jpg');
      const uploadRes = await fetch(`${base}/upload`, { method: 'POST', body: form });
      const { url } = await uploadRes.json();

      const claimRes = await fetch(`${base}/claim-upload`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      assert.equal(claimRes.status, 200);

      await sleep(600); // past a full grace-period-then-sweep-interval cycle
      assert.equal((await fetch(`${base}${url}`)).status, 200, 'a claimed-via-/claim-upload file must survive the sweep with no message/video/avatar ever referencing it');
    } finally {
      await sweepServer.stop();
    }
  });
});

describe('inactive-room purge cascade', () => {
  // deleteRoomCascade used to miss reports/fg_stats/account_recent_rooms/room_mutes/room_bans —
  // found by a data-consistency audit. reports and account_recent_rooms are directly verifiable
  // through public API (an admin listing, and the account's own recent-rooms list); room_bans/
  // room_mutes have no equivalent listing that survives the room itself being gone (get-bans
  // requires being the current host of an existing room), so those two are verified by code
  // review only — same DELETE-by-room_code pattern, applied identically, right alongside the two
  // that are tested here. fg_stats (Firefight kill counts) is the lowest-severity of the five
  // (unbounded-growth-shaped, not a correctness bug) and isn't separately exercised either.
  test('purging an inactive room also removes its reports and the account recent-rooms entries pointing at it', async () => {
    const cleanupServer = await startTestServer({ ROOM_RETENTION_MS: '50' }, 3207);
    try {
      const base = `http://localhost:${cleanupServer.port}`;
      const adminKey = JSON.parse(fs.readFileSync(path.join(cleanupServer.dir, 'admin-key.json'), 'utf8')).key;

      const signup = await fetch(`${base}/auth/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'PurgeCascadeUser', password: 'pass1234', email: 'purgecascade@test.com' }),
      }).then((r) => r.json());

      const ws = new WebSocket(`ws://localhost:${cleanupServer.port}`);
      await new Promise((resolve) => ws.on('open', resolve));
      const wsSend = (obj) => ws.send(JSON.stringify(obj));
      const wsWaitFor = (pred, ms = 3000) => new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timed out waiting for ' + pred.toString())), ms);
        const h = (d) => { const m = JSON.parse(d); if (pred(m)) { clearTimeout(t); ws.off('message', h); resolve(m); } };
        ws.on('message', h);
      });
      wsSend({ type: 'join-server', username: 'PurgeCascadeUser', accountToken: signup.token });
      await wsWaitFor((m) => m.type === 'joined-server');
      wsSend({ type: 'create-room' });
      const room = await wsWaitFor((m) => m.type === 'joined-room');

      await fetch(`${base}/account/recent-rooms`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signup.token}` },
        body: JSON.stringify({ code: room.code, name: 'Purge Cascade Room' }),
      });
      const recentBefore = await fetch(`${base}/account/recent-rooms`, { headers: { Authorization: `Bearer ${signup.token}` } }).then((r) => r.json());
      assert.ok(recentBefore.rooms.some((r) => r.code === room.code), 'the room must show up in recent-rooms before the purge');

      wsSend({ type: 'report', targetName: 'SomeoneElse', reason: 'purge cascade test' });
      await wsWaitFor((m) => m.type === 'report-received');
      const reportsBefore = await fetch(`${base}/admin/reports`, { headers: adminAuth(adminKey) }).then((r) => r.json());
      assert.ok(reportsBefore.reports.some((r) => r.room_code === room.code), 'the report must show up in the admin list before the purge');

      await sleep(150); // past the 50ms retention window
      const cleanupResult = await fetch(`${base}/admin/cleanup/run`, { method: 'POST', headers: adminAuth(adminKey) }).then((r) => r.json());
      assert.ok(cleanupResult.codes.includes(room.code), 'the room must actually be the one purged');

      const reportsAfter = await fetch(`${base}/admin/reports`, { headers: adminAuth(adminKey) }).then((r) => r.json());
      assert.ok(!reportsAfter.reports.some((r) => r.room_code === room.code), 'the report must be gone after the room is purged');

      const recentAfter = await fetch(`${base}/account/recent-rooms`, { headers: { Authorization: `Bearer ${signup.token}` } }).then((r) => r.json());
      assert.ok(!recentAfter.rooms.some((r) => r.code === room.code), 'the recent-rooms entry must be gone after the room is purged');

      ws.close();
    } finally {
      await cleanupServer.stop();
    }
  });
});

describe('file-upload storage audit: deleting/replacing media actually deletes the old file', () => {
  // Found by a file-upload storage audit: deleteMessageRow nulls media_url as part of the same
  // UPDATE that marks a message deleted, and cleanupInactiveRooms' 90-day sweep finds files solely
  // via a live media_url column — so once that column is nulled, the file becomes invisible to
  // every existing cleanup mechanism, not just orphaned-until-90-days. Uses the same
  // fetch-the-/uploads/-URL-and-check-status trick as the 'orphaned upload sweep' describe block
  // above (a claimed/still-referenced file 200s, a deleted one 404s) instead of touching the
  // filesystem directly — public/ is a symlink shared with the real repo across every test
  // instance, so this stays consistent with how every other upload-lifecycle test already verifies
  // file state.
  test('deleting a message deletes its uploaded file from disk, not just the DB reference', async () => {
    const { ws, code } = await joinRoom('DeleteFileHost');

    const form = new FormData();
    form.append('file', new Blob(['delete-message file test'], { type: 'image/png' }), 'del.png');
    const { url } = await (await fetch(`${BASE_URL}/upload`, { method: 'POST', body: form })).json();

    const postedPromise = waitFor(ws, (m) => m.type === 'message' && m.mediaUrl === url);
    const postRes = await fetch(`${BASE_URL}/post-image`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name: 'DeleteFileHost', mediaUrl: url, prompt: 'x' }),
    });
    assert.equal(postRes.status, 200);
    const posted = await postedPromise;

    assert.equal((await fetch(`${BASE_URL}${url}`)).status, 200, 'the file must exist right after posting');

    send(ws, { type: 'delete-message', messageId: posted.id });
    await waitFor(ws, (m) => m.type === 'message-deleted' && m.messageId === posted.id);
    await sleep(200);

    assert.equal((await fetch(`${BASE_URL}${url}`)).status, 404, 'deleting the message must delete the underlying file, not just null out the DB reference');
    ws.close();
  });

  // Same root cause, different call sites: replacing a Scorpture banner/avatar (or a video's
  // thumbnail, or an overlay list) never deleted the file it superseded — each new upload was
  // claimUpload()'d (exempting it from the orphan sweep), but nothing ever referenced the old one
  // again once it was overwritten.
  test('replacing a Scorpture banner deletes the old banner file', async () => {
    await sleep(6500); // clear the shared isPostMediaRateLimited budget before this test's own requests
    const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'BannerReplace', password: 'password123', email: 'bannerreplace@test.com' }),
    });
    const { token } = await signupRes.json();

    const uploadOne = async (label) => {
      const form = new FormData();
      form.append('file', new Blob([`banner ${label}`], { type: 'image/png' }), `${label}.png`);
      const res = await fetch(`${BASE_URL}/upload`, { method: 'POST', body: form });
      return (await res.json()).url;
    };
    const firstUrl = await uploadOne('first');
    const secondUrl = await uploadOne('second');

    const firstRes = await fetch(`${BASE_URL}/api/scorpture/banner`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bannerUrl: firstUrl }),
    });
    assert.equal(firstRes.status, 200);
    assert.equal((await fetch(`${BASE_URL}${firstUrl}`)).status, 200, 'the first banner file must exist after being set');

    const secondRes = await fetch(`${BASE_URL}/api/scorpture/banner`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bannerUrl: secondUrl }),
    });
    assert.equal(secondRes.status, 200);

    assert.equal((await fetch(`${BASE_URL}${secondUrl}`)).status, 200, 'the new banner file must exist');
    assert.equal((await fetch(`${BASE_URL}${firstUrl}`)).status, 404, 'replacing the banner must delete the file it superseded');
  });

  test('saving a new Scorpture overlay list deletes an image overlay dropped from it', async () => {
    await sleep(6500);
    const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'OverlayReplace', password: 'password123', email: 'overlayreplace@test.com' }),
    });
    const { token } = await signupRes.json();
    const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    const form = new FormData();
    form.append('file', new Blob(['overlay image'], { type: 'image/png' }), 'overlay.png');
    const { url: overlayUrl } = await (await fetch(`${BASE_URL}/upload`, { method: 'POST', body: form })).json();

    const firstRes = await fetch(`${BASE_URL}/api/scorpture/overlays`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ overlays: [{ type: 'image', content: overlayUrl, position: 'top-left' }] }),
    });
    assert.equal(firstRes.status, 200);
    assert.equal((await fetch(`${BASE_URL}${overlayUrl}`)).status, 200, 'the overlay image must exist after being saved');

    // Replace the whole list with one that no longer includes it (a plain text overlay instead).
    const secondRes = await fetch(`${BASE_URL}/api/scorpture/overlays`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ overlays: [{ type: 'text', content: 'hello', position: 'top-left' }] }),
    });
    assert.equal(secondRes.status, 200);

    assert.equal((await fetch(`${BASE_URL}${overlayUrl}`)).status, 404, 'dropping an image overlay from the saved list must delete its file');
  });
});

describe('per-username login brute-force throttle', () => {
  // isAuthRateLimited (the pre-existing per-IP limiter) is stricter (8/60s) than a real brute-
  // force threshold needs to be and would trip first if this test just hammered /auth/login
  // directly on the shared instance — uses its own dedicated server with USERNAME_FAIL_MAX
  // shrunk via env override so a handful of requests is enough to prove the mechanism, well under
  // the per-IP cap.
  test('repeated wrong passwords against one username lock it out, without affecting a different username on the same IP', async () => {
    const throttleServer = await startTestServer({ USERNAME_FAIL_MAX: '3' }, 3197);
    try {
      const base = `http://localhost:${throttleServer.port}`;
      const signup = async (username) => fetch(`${base}/auth/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: 'realpassword123', email: `${username.toLowerCase()}@test.com` }),
      }).then((r) => r.json());
      await signup('BruteForceVictim');
      await signup('BruteForceBystander');

      const login = (username, password) => fetch(`${base}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      for (let i = 0; i < 3; i++) {
        const res = await login('BruteForceVictim', 'wrong-password');
        assert.equal(res.status, 401, `attempt ${i + 1} should be a normal wrong-password rejection`);
      }
      // The 4th attempt uses the REAL password — if the throttle only blocked wrong guesses it'd
      // succeed here, but it must lock out the account itself regardless of what's supplied next.
      const lockedOut = await login('BruteForceVictim', 'realpassword123');
      assert.equal(lockedOut.status, 429, 'the account must be locked out after repeated failures, even with the correct password');

      const bystander = await login('BruteForceBystander', 'realpassword123');
      assert.equal(bystander.status, 200, "a different username on the same IP/server must be unaffected — this isn't a per-IP limit");
    } finally {
      await throttleServer.stop();
    }
  });
});

describe('per-IP WS connection rate limit', () => {
  // Every isWsMsgRateLimited/isStrokeRateLimited flood gate in the app is tracked on the `ws`
  // connection object, so a fresh connection means a fresh, unthrottled counter — without a cap
  // on how fast new connections themselves can open, every one of those gates was trivially
  // bypassable by reconnecting whenever the per-connection limit was hit. Own dedicated instance
  // with the threshold shrunk via env override (the shared instance across the rest of this file
  // opts out entirely via test/helpers.js's default WS_CONNECT_LIMIT_MAX override, since it
  // simulates many distinct "users" from one loopback IP that would otherwise starve each other).
  test('connections beyond the per-IP cap are closed immediately; ones under it are unaffected', async () => {
    const connLimitServer = await startTestServer(
      { WS_CONNECT_LIMIT_MAX: '5', WS_CONNECT_LIMIT_WINDOW_MS: '10000' },
      3196
    );
    const opened = [];
    try {
      const url = `ws://localhost:${connLimitServer.port}`;
      for (let i = 0; i < 5; i++) {
        const ws = new WebSocket(url);
        await new Promise((resolve, reject) => {
          ws.on('open', resolve);
          ws.on('close', (code) => reject(new Error(`connection ${i + 1} was unexpectedly closed (code ${code})`)));
        });
        opened.push(ws);
      }

      // The WS handshake itself already completes before the server's 'connection' handler runs
      // application code, so the client-side socket may still fire 'open' — the rejection is the
      // server closing it right after, not refusing the handshake. What matters is that it closes
      // with the expected code shortly afterward, not whether 'open' fires first.
      const sixth = new WebSocket(url);
      const closeCode = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the 6th connection was never closed')), 3000);
        sixth.on('close', (code) => { clearTimeout(timer); resolve(code); });
      });
      assert.equal(closeCode, 1013, 'a connection beyond the cap should be closed with 1013 (Try Again Later)');
    } finally {
      opened.forEach((ws) => ws.close());
      await connLimitServer.stop();
    }
  });

  // Found by a CORS/headers/transport-trust audit: 'trust proxy' (server.js, scoped to
  // 'loopback') only governs req.ip on Express HTTP routes — the raw WS upgrade path used to
  // trust X-Forwarded-For unconditionally, with no check that the request actually arrived via a
  // loopback peer. Since this app listens on all interfaces (not just loopback), a connection
  // arriving over an actual network interface — not through the local cloudflared tunnel — could
  // forge a different X-Forwarded-For per connection and never trip the shared per-IP cap tested
  // above. Connects via this machine's own LAN-facing IP (not localhost/127.0.0.1) specifically so
  // req.socket.remoteAddress is genuinely non-loopback, exercising the real code path rather than
  // the always-loopback path every other WS test in this suite uses.
  test('X-Forwarded-For is only trusted from a loopback peer, closing a spoofable bypass of the per-IP cap', async () => {
    const os = require('node:os');
    let lanIp = null;
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const a of addrs) if (a.family === 'IPv4' && !a.internal) lanIp = a.address;
    }
    if (!lanIp) return; // no non-loopback interface available in this environment — nothing to exercise

    const connLimitServer = await startTestServer(
      { WS_CONNECT_LIMIT_MAX: '5', WS_CONNECT_LIMIT_WINDOW_MS: '10000' },
      3215
    );
    const opened = [];
    try {
      const url = `ws://${lanIp}:${connLimitServer.port}`;
      // Each connection claims a DIFFERENT spoofed X-Forwarded-For — if the server incorrectly
      // trusted it (the pre-fix behavior), these would count as 5 distinct IPs and never trip the
      // shared per-IP cap; since none of these actually arrive from loopback, only the real,
      // shared remoteAddress (this same LAN IP) may count.
      for (let i = 0; i < 5; i++) {
        const ws = new WebSocket(url, { headers: { 'x-forwarded-for': `10.0.0.${i}` } });
        await new Promise((resolve, reject) => {
          ws.on('open', resolve);
          ws.on('close', (code) => reject(new Error(`connection ${i + 1} was unexpectedly closed (code ${code})`)));
        });
        opened.push(ws);
      }
      const sixth = new WebSocket(url, { headers: { 'x-forwarded-for': '10.0.0.99' } });
      const closeCode = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the 6th connection (a different spoofed X-Forwarded-For) was never closed')), 3000);
        sixth.on('close', (code) => { clearTimeout(timer); resolve(code); });
      });
      assert.equal(closeCode, 1013, 'a spoofed X-Forwarded-For from a non-loopback peer must not create a fresh rate-limit bucket');
    } finally {
      opened.forEach((ws) => ws.close());
      await connLimitServer.stop();
    }
  });

  // Found by a sweep for the same footgun already independently caught once for
  // FG_RESPAWN_GRACE_MS/BB_RESPAWN_GRACE_MS: `Number(process.env.X) || default` silently ignores
  // a real `X=0` override since 0 is falsy. WS_CONNECT_LIMIT_MAX=0 is a sharp, easy-to-observe
  // case — with the bug, `Number('0') || 60` falls back to 60 and the very first connection would
  // succeed; with the fix (`??`), it stays 0 and even the first connection is immediately closed.
  test('WS_CONNECT_LIMIT_MAX=0 actually takes effect, not silently falling back to the default', async () => {
    const zeroLimitServer = await startTestServer({ WS_CONNECT_LIMIT_MAX: '0' }, 3211);
    try {
      const ws = new WebSocket(`ws://localhost:${zeroLimitServer.port}`);
      const closeCode = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the connection was never closed — WS_CONNECT_LIMIT_MAX=0 did not take effect')), 3000);
        ws.on('close', (code) => { clearTimeout(timer); resolve(code); });
        ws.on('open', () => { /* handshake completing doesn't mean the server accepted it — see the comment above */ });
      });
      assert.equal(closeCode, 1013, 'with the limit truly at 0, even the first connection must be rejected');
    } finally {
      await zeroLimitServer.stop();
    }
  });
});

describe('WS max payload size', () => {
  // ws defaults to a 100MiB maxPayload when unset — any connected client could send a single
  // message up to that size, fully buffered and JSON.parsed before any of this app's own
  // per-field size checks (bc-block's 2000-change cap, bc-blueprint-save's 20000-block cap, etc.)
  // ever get a chance to run.
  test('an oversized message closes the connection (1009) instead of being buffered/parsed', async () => {
    const ws = await connectWs();
    const closePromise = new Promise((resolve) => ws.on('close', (code) => resolve(code)));
    // Comfortably over the app's 4MB cap.
    ws.send(JSON.stringify({ type: 'message', text: 'x'.repeat(5 * 1024 * 1024) }));
    const code = await closePromise;
    assert.equal(code, 1009, 'an over-limit message should close with 1009 (Message Too Big)');
  });

  test('a normal-sized message still round-trips fine on the same connection type', async () => {
    const { ws } = await joinRoom('MaxPayloadHost');
    send(ws, { type: 'message', text: 'still works' });
    const echoed = await waitFor(ws, (m) => m.type === 'message' && m.text === 'still works');
    assert.equal(echoed.name, 'MaxPayloadHost');
  });
});

describe('/room-qr and /link-preview rate limits', () => {
  test('/room-qr is rate-limited', async () => {
    const { code } = await joinRoom('QrRateLimitHost');
    let okCount = 0;
    let sawLimited = false;
    for (let i = 0; i < 12; i++) {
      const res = await fetch(`${BASE_URL}/room-qr/${code}`);
      if (res.status === 429) sawLimited = true;
      else if (res.status === 200) okCount++;
    }
    assert.ok(okCount > 0, 'at least some requests should succeed before the limit kicks in');
    assert.ok(sawLimited, 'a burst of 12 requests should eventually hit the rate limit');
  });

  test('/link-preview is rate-limited (checked before any outbound fetch is attempted)', async () => {
    // /room-qr and /link-preview share the same per-IP budget as every other route this session
    // added it to (isPostMediaRateLimited) — correct, intentional behavior, but it means the
    // previous test in this block already spent part of this IP's window. Let it fully clear
    // first so this test starts from a known, fresh state instead of inheriting that one's spend.
    await sleep(6500);
    let sawLimited = false;
    let sawRejected = false;
    for (let i = 0; i < 12; i++) {
      // A private-host URL is rejected before any real network call — same code path a valid
      // external URL would take, just without this test depending on real outbound network access.
      const res = await fetch(`${BASE_URL}/link-preview?url=${encodeURIComponent('http://127.0.0.1/x')}`);
      if (res.status === 429) sawLimited = true;
      else if (res.status === 400) sawRejected = true;
    }
    assert.ok(sawRejected, 'at least some requests should reach the normal private-host rejection');
    assert.ok(sawLimited, 'a burst of 12 requests should eventually hit the rate limit');
  });
});

describe('more previously-unprotected HTTP routes are now rate-limited', () => {
  // All of these share the same isPostMediaRateLimited budget as /room-qr and /link-preview
  // above (and /upload/post-image/post-media elsewhere) — wait for a fresh window each time so
  // one test's spend doesn't leak into the next, same lesson as that describe block.
  test('/search is rate-limited', async () => {
    const { code } = await joinRoom('SearchRateLimitHost');
    let sawLimited = false;
    for (let i = 0; i < 12; i++) {
      const res = await fetch(`${BASE_URL}/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, q: 'x' }),
      });
      if (res.status === 429) sawLimited = true;
    }
    assert.ok(sawLimited, 'a burst of 12 requests should eventually hit the rate limit');
    await sleep(6500);
  });

  test('/push/subscribe is rate-limited', async () => {
    let sawLimited = false;
    for (let i = 0; i < 12; i++) {
      const res = await fetch(`${BASE_URL}/push/subscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Pusher', subscription: { endpoint: `https://example.test/ep${i}` } }),
      });
      if (res.status === 429) sawLimited = true;
    }
    assert.ok(sawLimited, 'a burst of 12 requests should eventually hit the rate limit');
    await sleep(6500);
  });

  // Found by a TURN-credential-abuse audit: the shared relay (~/valk-turn) has only 10 UDP
  // relay ports, shared across every local Valk instance. The generic per-IP media-upload gate
  // this route reused (8/6s) was generous enough that one signed-in account could mint all 10
  // credentials in ~7 seconds and hold hour-long relay allocations open. The dedicated
  // per-account limit (5/10s) fires before any network call to the real valk-turn service, so
  // this is testable without depending on that service being reachable in this environment —
  // same as every other rate-limit test in this file, only the eventual 429 is asserted on.
  test('/api/scorpture/turn-credentials is rate-limited per account, tighter than the generic media gate', async () => {
    const signup = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'TurnCredLimiter', password: 'pass1234', email: 'turncredlimiter@test.com' }),
    }).then((r) => r.json());
    const authHeaders = { Authorization: `Bearer ${signup.token}` };

    let sawLimited = false;
    for (let i = 0; i < 8; i++) {
      const res = await fetch(`${BASE_URL}/api/scorpture/turn-credentials`, { method: 'POST', headers: authHeaders });
      if (res.status === 429) sawLimited = true;
    }
    assert.ok(sawLimited, 'a burst of 8 requests from one account should eventually hit the dedicated per-account limit');
  });

  test('/api/scorpture/turn-credentials requires sign-in', async () => {
    const res = await fetch(`${BASE_URL}/api/scorpture/turn-credentials`, { method: 'POST' });
    assert.equal(res.status, 401);
  });

  test('/api/scorpture/videos/:id/report is rate-limited (unlike its sibling /like, a bounded toggle)', async () => {
    const signup = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ReportRateLimiter', password: 'pass1234', email: 'reportratelimiter@test.com' }),
    }).then((r) => r.json());
    const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${signup.token}` };

    const form = new FormData();
    form.append('file', new Blob(['fake video bytes'], { type: 'video/mp4' }), 'clip.mp4');
    const uploadRes = await fetch(`${BASE_URL}/upload`, { method: 'POST', body: form });
    const { url: videoUrl } = await uploadRes.json();
    const video = await fetch(`${BASE_URL}/api/scorpture/videos`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ title: 'Report Rate Limit Test Video', videoUrl }),
    }).then((r) => r.json());

    let sawLimited = false;
    for (let i = 0; i < 12; i++) {
      const res = await fetch(`${BASE_URL}/api/scorpture/videos/${video.id}/report`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ reason: 'spam test ' + i }),
      });
      if (res.status === 429) sawLimited = true;
    }
    assert.ok(sawLimited, 'a burst of 12 requests should eventually hit the rate limit');
  });

  test('/admin/scorpture-reports flags a report whose video has since been deleted', async () => {
    // The rate-limit test right above this one deliberately burns through the shared
    // isPostMediaRateLimited budget — let it fully clear first (same discipline used elsewhere in
    // this file for this exact shared limiter) so this test's own upload/create/report/delete
    // calls aren't spuriously 429'd by the previous test's own burst.
    await sleep(6500);
    const adminKey = JSON.parse(fs.readFileSync(path.join(server.dir, 'admin-key.json'), 'utf8')).key;
    const signup = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ReportDeleteCheck', password: 'pass1234', email: 'reportdeletecheck@test.com' }),
    }).then((r) => r.json());
    const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${signup.token}` };

    const form = new FormData();
    form.append('file', new Blob(['fake video bytes'], { type: 'video/mp4' }), 'clip.mp4');
    const { url: videoUrl } = await fetch(`${BASE_URL}/upload`, { method: 'POST', body: form }).then((r) => r.json());
    const video = await fetch(`${BASE_URL}/api/scorpture/videos`, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ title: 'Report Delete Check Video', videoUrl }),
    }).then((r) => r.json());
    await fetch(`${BASE_URL}/api/scorpture/videos/${video.id}/report`, {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ reason: 'will be deleted' }),
    });

    const before = await fetch(`${BASE_URL}/admin/scorpture-reports`, { headers: adminAuth(adminKey) }).then((r) => r.json());
    const reportBefore = before.reports.find((r) => r.reason === 'will be deleted');
    assert.ok(reportBefore, 'the report must show up in the admin list');
    assert.equal(reportBefore.videoDeleted, false, 'the video still exists at this point');

    await fetch(`${BASE_URL}/api/scorpture/videos/${video.id}`, { method: 'DELETE', headers: authHeaders });

    const after = await fetch(`${BASE_URL}/admin/scorpture-reports`, { headers: adminAuth(adminKey) }).then((r) => r.json());
    const reportAfter = after.reports.find((r) => r.id === reportBefore.id);
    assert.equal(reportAfter.videoDeleted, true, 'the same report must now flag that its video was deleted');
  });

  test('/auth/google is rate-limited, same as its /auth/signup and /auth/login siblings', async () => {
    // The shared instance every other test in this file uses defaults AUTH_LIMIT_MAX to
    // effectively unlimited (see test/helpers.js) so unrelated tests' own signups/logins never
    // get spuriously 429'd — which means it can't be used to observe this limiter actually firing.
    // A dedicated instance explicitly overriding back to the real production value, on a fresh,
    // untouched budget, actually exercises it.
    const googleAuthServer = await startTestServer({ AUTH_LIMIT_MAX: '8' }, 3195);
    try {
      const base = `http://localhost:${googleAuthServer.port}`;
      let sawLimited = false;
      for (let i = 0; i < 12; i++) {
        const res = await fetch(`${base}/auth/google`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: 'not-a-real-credential' }),
        });
        if (res.status === 429) sawLimited = true;
      }
      assert.ok(sawLimited, 'a burst of 12 requests should eventually hit the rate limit (no real Google client is configured for this scratch server, so every non-429 response is expected to be a 400)');
    } finally {
      await googleAuthServer.stop();
    }
  });

  // Found by a Google-account-linking-security audit: /auth/google used to link a fresh Google
  // sign-in onto ANY existing account sharing its verified email, with no check on how that
  // existing account got there. Since /auth/signup never verifies email ownership, an attacker
  // could pre-register a victim's real email with an attacker-chosen password — the victim's
  // later genuine Google sign-in would then silently bind onto that attacker-controlled account,
  // handing the attacker permanent access via their own known password. Same class of fix as a
  // MEDIUM finding in the same audit: an account that already has a DIFFERENT google_id linked
  // must not be silently reassigned either (e.g. an employer handing an old mailbox to a new
  // hire). The fix is a two-clause guard in server.js's /auth/google handler
  // (`!existing.password_hash && !existing.google_id`) — this can't be exercised through the real
  // route in this test environment (no real Google OAuth credentials are configured, so
  // /auth/google always short-circuits at "not configured" before ever reaching the linking
  // logic, the same pre-existing limitation an earlier session's Google-race-condition fix in
  // this exact route already hit and documented). Instead this verifies the real precondition the
  // guard relies on, through the same db.js functions the route itself calls, directly against
  // the running scratch server's own database.
  test('the account-linking guard precondition correctly identifies an unsafe-to-link (attacker-pre-registered) account', async () => {
    const scratchDb = require(require('node:path').join(server.dir, 'db.js'));
    const email = 'googlelinkguardcheck@test.com';
    const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'GoogleLinkGuardAtk', password: 'attackerpass123', email }),
    });
    assert.equal(signupRes.status, 200, 'sanity: the attacker-controlled signup must succeed (this app never verifies email ownership)');

    // Exactly what server.js's /auth/google handler does: resolve the existing account for this
    // email the same way the real linking-decision code would.
    const existing = scratchDb.getAccountByEmail(email);
    assert.ok(existing, 'sanity: the pre-registered account must be findable by email, the same lookup /auth/google performs');
    assert.ok(existing.password_hash, 'the guard\'s core precondition: a pre-registered account has a real password_hash set, which must block auto-linking a later Google identity onto it');
    assert.equal(existing.google_id, null, 'sanity: a freshly password-signed-up account has no google_id yet');

    // The actual guard expression from server.js: `existing && !existing.password_hash && !existing.google_id`.
    const wouldAutoLink = !!(existing && !existing.password_hash && !existing.google_id);
    assert.equal(wouldAutoLink, false, 'the fixed guard must evaluate to false for an attacker-pre-registered account, preventing the takeover');
  });

  // Found by a presence-exposure audit: every other /friends/* route rate-limits via
  // resolveFriendsAction, but /friends/presence bypasses that shared preamble (it takes no
  // target username) and was left with no rate limit at all. Same dedicated-instance pattern as
  // the /auth/google test just above, for the same reason — the shared instance defaults
  // FRIENDS_ACTION_MAX to effectively unlimited.
  test('/friends/presence is rate-limited, same as its /friends/* siblings', async () => {
    const presenceServer = await startTestServer({ FRIENDS_ACTION_MAX: '8' }, 3210);
    try {
      const base = `http://localhost:${presenceServer.port}`;
      const signup = await fetch(`${base}/auth/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'PresenceRateLimiter', password: 'pass1234', email: 'presenceratelimiter@test.com' }),
      }).then((r) => r.json());
      const authHeaders = { Authorization: `Bearer ${signup.token}` };

      let sawLimited = false;
      for (let i = 0; i < 12; i++) {
        const res = await fetch(`${base}/friends/presence`, { headers: authHeaders });
        if (res.status === 429) sawLimited = true;
      }
      assert.ok(sawLimited, 'a burst of 12 requests should eventually hit the rate limit');
    } finally {
      await presenceServer.stop();
    }
  });

  // Found by a friends/DM authorization audit: every /friends/* mutation route (and, as fixed just
  // above, /friends/presence) is rate-limited, but the base GET /friends listing route was left out
  // entirely. Same dedicated-instance pattern for the same reason.
  test('GET /friends is rate-limited, same as its /friends/* siblings', async () => {
    const friendsListServer = await startTestServer({ FRIENDS_ACTION_MAX: '8' }, 3211);
    try {
      const base = `http://localhost:${friendsListServer.port}`;
      const signup = await fetch(`${base}/auth/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'FriendsListRateLimiter', password: 'pass1234', email: 'friendslistratelimiter@test.com' }),
      }).then((r) => r.json());
      const authHeaders = { Authorization: `Bearer ${signup.token}` };

      let sawLimited = false;
      for (let i = 0; i < 12; i++) {
        const res = await fetch(`${base}/friends`, { headers: authHeaders });
        if (res.status === 429) sawLimited = true;
      }
      assert.ok(sawLimited, 'a burst of 12 requests should eventually hit the rate limit');
    } finally {
      await friendsListServer.stop();
    }
  });
});

describe('WebSocket heartbeat: reaps unresponsive connections', () => {
  // Found by the WS-connection-liveness audit: no heartbeat of any kind (app- or OS-level)
  // previously existed — a connection whose peer vanished without a clean TCP close (a flaky
  // mobile connection, not an attack) could linger for 15-30+ minutes or indefinitely. The
  // concrete, user-visible cost: fixed-2-slot duel games (Firefight, chess, tic-tac-toe) free a
  // seat only from the ws 'close' handler, so a zombied duelist's seat stayed "occupied" until
  // reaped, and a genuine reconnect landed the real player as a spectator in their own game.
  //
  // Dedicated instance with HEARTBEAT_INTERVAL_MS shrunk via env override so the real heartbeat
  // loop (not a reimplementation) can actually be exercised in test time.
  let hbServer;
  before(async () => {
    hbServer = await startTestServer({ HEARTBEAT_INTERVAL_MS: '150' }, 3220);
  });
  after(async () => { await hbServer.stop(); });

  function hbConnect(autoPong = true) {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://localhost:${hbServer.port}`, { autoPong });
      ws.on('open', () => resolve(ws));
    });
  }

  test('a connection that never pongs gets terminated, freeing its Firefight duelist slot for the waiting spectator', async () => {
    const code = 'HBFG1';
    const a = await hbConnect();
    send(a, { type: 'fg-join', code, name: 'HbA' });
    assert.equal((await waitFor(a, (m) => m.type === 'fg-init')).role, 'a');

    // autoPong: false — the real-world zombie shape: the TCP connection is technically still
    // there (no FIN/RST), but the peer never answers a ping, exactly what a stalled/vanished
    // mobile connection looks like from the server's side. A real ws client answers pings
    // automatically at the protocol level with no application code involved, so this is the
    // actual, supported way to simulate an unresponsive-but-not-yet-closed peer.
    const zombie = await hbConnect(false);
    send(zombie, { type: 'fg-join', code, name: 'HbZombie' });
    assert.equal((await waitFor(zombie, (m) => m.type === 'fg-init')).role, 'b');

    // The reconnecting real player (or, as here, a distinct bystander — the mechanism doesn't
    // care which) lands as a spectator, since both slots still look occupied.
    const c = await hbConnect();
    send(c, { type: 'fg-join', code, name: 'HbC' });
    const initC = await waitFor(c, (m) => m.type === 'fg-init');
    assert.equal(initC.role, 'spectator');

    // Wait past 2 heartbeat intervals: first tick pings everyone and marks isAlive=false; second
    // tick finds the zombie still false (it never pongs) and terminates it. terminate() still
    // fires the connection's 'close' event, running leaveFg exactly as a clean disconnect would.
    const slotFilled = waitFor(c, (m) => m.type === 'fg-slot-filled');
    await sleep(500);
    const filled = await slotFilled;
    assert.equal(filled.slot, 'b');
    assert.equal(filled.id, initC.id, 'the waiting spectator (c) must be the one promoted into the freed slot');

    a.close(); c.close();
  });
});

describe('Firefight (1v1 duel shooter)', () => {
  // Dedicated instance with the round/intermission timers and win threshold shrunk via env
  // override, so a full multi-round match can be driven in well under a second instead of the
  // real 90s-per-round production values.
  let fgServer, base;
  before(async () => {
    fgServer = await startTestServer(
      // FG_RESPAWN_GRACE_MS is 0 here (not just shrunk) — these tests fire their first shot within
      // a few ms of round-start, well inside even a small nonzero grace window, which would
      // silently reject that shot and throw off the exact hit-count math these tests depend on.
      // The grace period's own behavior isn't what's under test here.
      { FG_ROUND_MS: '2000', FG_INTERMISSION_MS: '150', FG_ROUNDS_TO_WIN: '2', FG_RESPAWN_GRACE_MS: '0' },
      3193
    );
    base = `http://localhost:${fgServer.port}`;
  });
  after(async () => { await fgServer.stop(); });

  function fgConnect() {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://localhost:${fgServer.port}`);
      ws.on('open', () => resolve(ws));
    });
  }

  test('join assigns the first two as duelists and everyone else as a spectator', async () => {
    const code = 'FFJOIN1';
    const a = await fgConnect();
    const b = await fgConnect();
    const c = await fgConnect();

    send(a, { type: 'fg-join', code, name: 'FfA' });
    const initA = await waitFor(a, (m) => m.type === 'fg-init');
    assert.equal(initA.role, 'a');

    send(b, { type: 'fg-join', code, name: 'FfB' });
    const initB = await waitFor(b, (m) => m.type === 'fg-init');
    assert.equal(initB.role, 'b');

    send(c, { type: 'fg-join', code, name: 'FfC' });
    const initC = await waitFor(c, (m) => m.type === 'fg-init');
    assert.equal(initC.role, 'spectator');

    a.close(); b.close(); c.close();
  });

  test('a full duel: shooting to a kill ends the round, and winning enough rounds ends the match', async () => {
    const code = 'FFDUEL1';
    const a = await fgConnect();
    const b = await fgConnect();
    send(a, { type: 'fg-join', code, name: 'FfDuelA' });
    await waitFor(a, (m) => m.type === 'fg-init');
    send(b, { type: 'fg-join', code, name: 'FfDuelB' });
    await waitFor(b, (m) => m.type === 'fg-init');
    // Selected explicitly rather than relying on whatever FG_DEFAULT_WEAPON happens to be — this
    // test's hit-count math below is specifically tuned to pistol's damage/cooldown.
    send(a, { type: 'fg-select-weapon', weapon: 'pistol' });

    const startPromiseA = waitFor(a, (m) => m.type === 'fg-round-start');
    const startPromiseB = waitFor(b, (m) => m.type === 'fg-round-start');
    send(a, { type: 'fg-start' });
    const [firstRound] = await Promise.all([startPromiseA, startPromiseB]);
    assert.equal(firstRound.roundNumber, 1);

    // FG_ROUNDS_TO_WIN=2 for this instance — play out two full rounds, A always winning.
    for (let round = 1; round <= 2; round++) {
      // Pistol deals 20 damage with a 220ms cooldown — 8 hits (140 of 150 HP, the 8th finishes it)
      // kill. Both players are at the same default position (0,0,0), well within pistol's 45-unit
      // range.
      //
      // Every waiter for this round's *entire* remaining sequence (death, then either the next
      // round-start or the match-end) is armed up front, before a single shot is fired — not
      // attached only after the previous step resolves. FG_INTERMISSION_MS is only 150ms on this
      // instance, so the death->round-end->next-round-start chain can complete faster than this
      // test's own await chain would otherwise get back around to arming the next listener,
      // missing a message that already arrived with nothing listening for it yet (the same race
      // class already fixed in the Trivia reconnect test elsewhere in this file).
      const deathPromise = waitFor(b, (m) => m.type === 'fg-death');
      const nextEventPromiseA = round < 2
        ? waitFor(a, (m) => m.type === 'fg-round-start' && m.roundNumber === round + 1)
        : waitFor(a, (m) => m.type === 'fg-match-end');
      const nextEventPromiseB = round < 2
        ? waitFor(b, (m) => m.type === 'fg-round-start' && m.roundNumber === round + 1)
        : null;

      for (let i = 0; i < 8; i++) {
        send(a, { type: 'fg-shoot' });
        await sleep(230);
      }
      await deathPromise;

      if (round < 2) {
        await Promise.all([nextEventPromiseA, nextEventPromiseB]);
      } else {
        const matchEnd = await nextEventPromiseA;
        assert.equal(matchEnd.winner, 'a');
        assert.equal(matchEnd.scoreA, 2);
      }
    }

    a.close(); b.close();
  });

  test('a queued spectator cannot deal damage, and gets promoted into an opened slot when a duelist leaves', async () => {
    const code = 'FFSPEC1';
    const a = await fgConnect();
    const b = await fgConnect();
    const c = await fgConnect();
    send(a, { type: 'fg-join', code, name: 'FfSpecA' });
    await waitFor(a, (m) => m.type === 'fg-init');
    send(b, { type: 'fg-join', code, name: 'FfSpecB' });
    await waitFor(b, (m) => m.type === 'fg-init');
    send(c, { type: 'fg-join', code, name: 'FfSpecC' });
    await waitFor(c, (m) => m.type === 'fg-init');

    send(a, { type: 'fg-start' });
    await waitFor(a, (m) => m.type === 'fg-round-start');
    await waitFor(b, (m) => m.type === 'fg-round-start');

    let sawHitFromSpectator = false;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'fg-hit' || m.type === 'fg-death') sawHitFromSpectator = true; };
    a.on('message', h);
    b.on('message', h);
    send(c, { type: 'fg-shoot' });
    await sleep(300);
    a.off('message', h);
    b.off('message', h);
    assert.equal(sawHitFromSpectator, false, 'a queued spectator has no opponent and must not be able to deal damage');

    const slotFilledPromise = waitFor(c, (m) => m.type === 'fg-slot-filled' && m.slot === 'b');
    b.close();
    const slotFilled = await slotFilledPromise;
    assert.equal(slotFilled.name, 'FfSpecC', 'the longest-waiting spectator should be promoted into the vacated slot');

    a.close(); c.close();
  });

  test('shots respect weapon cooldown and range', async () => {
    const code = 'FFCOOLDOWN1';
    const a = await fgConnect();
    const b = await fgConnect();
    send(a, { type: 'fg-join', code, name: 'FfCoolA' });
    await waitFor(a, (m) => m.type === 'fg-init');
    send(b, { type: 'fg-join', code, name: 'FfCoolB' });
    await waitFor(b, (m) => m.type === 'fg-init');
    // Selected explicitly (not relying on FG_DEFAULT_WEAPON) since the range assertion below is
    // specifically checking pistol's 45-unit range.
    send(a, { type: 'fg-select-weapon', weapon: 'pistol' });
    send(a, { type: 'fg-start' });
    await waitFor(a, (m) => m.type === 'fg-round-start');
    await waitFor(b, (m) => m.type === 'fg-round-start');

    // Two shots fired back-to-back with no wait — the second should be dropped by the cooldown,
    // so only one fg-hit should land even though two fg-shoot messages were sent.
    let hitCount = 0;
    const h = (data) => { const m = JSON.parse(data); if (m.type === 'fg-hit') hitCount++; };
    b.on('message', h);
    send(a, { type: 'fg-shoot' });
    send(a, { type: 'fg-shoot' });
    await sleep(300);
    b.off('message', h);
    assert.equal(hitCount, 1, 'a second shot within the weapon cooldown must not also land');

    // Move B far outside pistol's 45-unit range and confirm a shot from A no longer connects.
    send(b, { type: 'fg-pos', x: 500, y: 0, z: 0, yaw: 0 });
    await sleep(150);
    let hitCount2 = 0;
    const h2 = (data) => { const m = JSON.parse(data); if (m.type === 'fg-hit') hitCount2++; };
    b.on('message', h2);
    send(a, { type: 'fg-shoot' });
    await sleep(300);
    b.off('message', h2);
    assert.equal(hitCount2, 0, 'a shot at a target outside the weapon range must not land');

    a.close(); b.close();
  });

  // No weapon in the current fixed 4-slot loadout (pistol/assault_rifle/fists/grenade) defines
  // headshotDamage — that mechanic is still fully wired server-side (see FG_WEAPONS' comment) for
  // whenever a future weapon adds it, but nothing currently exercises the bonus-damage branch, so
  // this only asserts the flag is a harmless no-op today rather than testing dead code paths.
  test('a headshot flag has no effect on any current weapon — base damage always applies', async () => {
    const code = 'FFHEADSHOT1';
    const a = await fgConnect();
    const b = await fgConnect();
    send(a, { type: 'fg-join', code, name: 'FfHsA' });
    await waitFor(a, (m) => m.type === 'fg-init');
    send(b, { type: 'fg-join', code, name: 'FfHsB' });
    await waitFor(b, (m) => m.type === 'fg-init');
    send(a, { type: 'fg-select-weapon', weapon: 'pistol' });
    send(a, { type: 'fg-start' });
    await waitFor(a, (m) => m.type === 'fg-round-start');
    await waitFor(b, (m) => m.type === 'fg-round-start');

    const hitPromise = waitFor(b, (m) => m.type === 'fg-hit');
    send(a, { type: 'fg-shoot', headshot: true });
    const hit = await hitPromise;
    assert.equal(hit.health, 130, "a headshot flag on pistol must be ignored — 150 max HP minus pistol's 20 base damage");
    assert.equal(hit.headshot, false, 'no current weapon defines headshotDamage');

    a.close(); b.close();
  });

  test('fists land at melee range but not at typical gun range', async () => {
    const code = 'FFFISTS1';
    const a = await fgConnect();
    const b = await fgConnect();
    send(a, { type: 'fg-join', code, name: 'FfFistsA' });
    await waitFor(a, (m) => m.type === 'fg-init');
    send(b, { type: 'fg-join', code, name: 'FfFistsB' });
    await waitFor(b, (m) => m.type === 'fg-init');
    send(a, { type: 'fg-select-weapon', weapon: 'fists' });
    send(a, { type: 'fg-start' });
    await waitFor(a, (m) => m.type === 'fg-round-start');
    await waitFor(b, (m) => m.type === 'fg-round-start');

    // Both start at (0,0,0) — well within fists' 2.4-unit range — so a swing should land.
    const hitPromise = waitFor(b, (m) => m.type === 'fg-hit');
    send(a, { type: 'fg-shoot' });
    const hit = await hitPromise;
    assert.equal(hit.health, 125, "a fists hit must deal fists' 25 damage (150 - 25)");

    // Fists' cooldown is 500ms — wait it out, then move B out to pistol-viable range (10 units,
    // comfortably inside pistol's 45-unit range) but well past fists' 2.4-unit reach.
    await sleep(550);
    send(b, { type: 'fg-pos', x: 10, y: 0, z: 0, yaw: 0 });
    await sleep(150);
    let hitCount = 0;
    const h = (data) => { if (JSON.parse(data).type === 'fg-hit') hitCount++; };
    b.on('message', h);
    send(a, { type: 'fg-shoot' });
    await sleep(300);
    b.off('message', h);
    assert.equal(hitCount, 0, 'a fists swing must not land at a distance well within gun range but outside melee range');

    a.close(); b.close();
  });

  test('grenade deals its higher damage and enforces its long cooldown', async () => {
    const code = 'FFGRENADE1';
    const a = await fgConnect();
    const b = await fgConnect();
    send(a, { type: 'fg-join', code, name: 'FfGrenA' });
    await waitFor(a, (m) => m.type === 'fg-init');
    send(b, { type: 'fg-join', code, name: 'FfGrenB' });
    await waitFor(b, (m) => m.type === 'fg-init');
    send(a, { type: 'fg-select-weapon', weapon: 'grenade' });
    send(a, { type: 'fg-start' });
    await waitFor(a, (m) => m.type === 'fg-round-start');
    await waitFor(b, (m) => m.type === 'fg-round-start');

    const hitPromise = waitFor(b, (m) => m.type === 'fg-hit');
    send(a, { type: 'fg-shoot' });
    const hit = await hitPromise;
    assert.equal(hit.health, 85, "a grenade hit must deal grenade's 65 damage (150 - 65)");

    // Immediately throw again, well inside the 3200ms cooldown — must not land a second hit.
    let hitCount = 0;
    const h = (data) => { if (JSON.parse(data).type === 'fg-hit') hitCount++; };
    b.on('message', h);
    send(a, { type: 'fg-shoot' });
    await sleep(300);
    b.off('message', h);
    assert.equal(hitCount, 0, "a second grenade thrown inside the weapon's cooldown must not also land");

    a.close(); b.close();
  });

  // lastShotAt used to be one shared timestamp per player regardless of weapon — firing the
  // grenade (3200ms cooldown) would then leave *every other weapon* looking like it had just been
  // fired too, blocking them all for up to 3200ms. That defeats the entire point of a switchable
  // mid-fight loadout, so each weapon's cooldown must be tracked independently.
  test('switching weapons mid-fight does not carry one weapon\'s cooldown onto another', async () => {
    const code = 'FFSWITCHCOOLDOWN1';
    const a = await fgConnect();
    const b = await fgConnect();
    send(a, { type: 'fg-join', code, name: 'FfSwitchA' });
    await waitFor(a, (m) => m.type === 'fg-init');
    send(b, { type: 'fg-join', code, name: 'FfSwitchB' });
    await waitFor(b, (m) => m.type === 'fg-init');
    send(a, { type: 'fg-start' });
    await waitFor(a, (m) => m.type === 'fg-round-start');
    await waitFor(b, (m) => m.type === 'fg-round-start');

    // Fire pistol (220ms cooldown), then immediately switch to grenade and fire — the grenade
    // must land right away. Under the old bug, pistol's very-recent shot would look (from a
    // shared timestamp) like the grenade itself had *just* been fired, wrongly blocking it for
    // most of its 3200ms cooldown even though this grenade was never actually thrown before.
    send(a, { type: 'fg-select-weapon', weapon: 'pistol' });
    const pistolHitPromise = waitFor(b, (m) => m.type === 'fg-hit');
    send(a, { type: 'fg-shoot' });
    const pistolHit = await pistolHitPromise;
    assert.equal(pistolHit.health, 130, "150 max HP minus pistol's 20 damage");

    // grenade has never been fired yet in this match — under the old shared-timestamp bug, the
    // pistol shot just above would make the grenade look like it had *also* just been fired,
    // blocking it for most of its 3200ms cooldown even though this is its first-ever throw.
    send(a, { type: 'fg-select-weapon', weapon: 'grenade' });
    const grenadeHitPromise = waitFor(b, (m) => m.type === 'fg-hit');
    send(a, { type: 'fg-shoot' });
    const grenadeHit = await grenadeHitPromise;
    assert.equal(grenadeHit.health, 65, "grenade must fire immediately after a pistol shot (130 - grenade's 65 damage), unaffected by pistol's cooldown");

    // Reverse direction: switch to assault_rifle (never fired yet in this test, so this is a
    // clean check with no self-cooldown of its own to confound it) immediately after the grenade
    // throw — it must land right away too, unaffected by grenade's 3200ms cooldown.
    send(a, { type: 'fg-select-weapon', weapon: 'assault_rifle' });
    const rifleHitPromise = waitFor(b, (m) => m.type === 'fg-hit');
    send(a, { type: 'fg-shoot' });
    const rifleHit = await rifleHitPromise;
    assert.equal(rifleHit.health, 47, "assault_rifle must fire immediately after a grenade throw (65 - 18), unaffected by the grenade's cooldown");

    a.close(); b.close();
  });

  // fg.slotA/fg.slotB were only ever checked for truthiness ("is a slot open"), not "is this a
  // different connection" — a single connection sending fg-join twice used to claim both slots
  // for itself, collapsing the whole "genuine 1v1" model into fighting itself with guaranteed
  // hits (zero distance to its own position). Fixed by having fg-join ignore a repeat join for a
  // session it's already active in.
  test('a single connection cannot claim both duelist slots by joining twice', async () => {
    const code = 'FFSELFJOIN1';
    const a = await fgConnect();
    send(a, { type: 'fg-join', code, name: 'Solo1' });
    const initA = await waitFor(a, (m) => m.type === 'fg-init');
    assert.equal(initA.role, 'a');

    // The repeat join must be a silent no-op — no second fg-init, and it must not touch the
    // existing slotA assignment (confirmed below via a real second connection still getting 'b').
    let sawSecondInit = false;
    const h = (data) => { if (JSON.parse(data).type === 'fg-init') sawSecondInit = true; };
    a.on('message', h);
    send(a, { type: 'fg-join', code, name: 'Solo2' });
    await sleep(200);
    a.off('message', h);
    assert.equal(sawSecondInit, false, 'a repeat fg-join on the same connection must not be re-processed');

    const b = await fgConnect();
    send(b, { type: 'fg-join', code, name: 'RealB' });
    const initB = await waitFor(b, (m) => m.type === 'fg-init');
    assert.equal(initB.role, 'b', 'a genuinely different connection must still be able to fill slot b');

    // Belt-and-suspenders: even if slotA and slotB somehow ended up equal, fg-shoot's own
    // self-target guard must refuse to let a connection deal damage to itself.
    send(a, { type: 'fg-start' });
    await waitFor(a, (m) => m.type === 'fg-round-start');
    await waitFor(b, (m) => m.type === 'fg-round-start');
    let sawSelfHit = false;
    const h2 = (data) => { const m = JSON.parse(data); if (m.type === 'fg-hit' && m.byId === m.targetId) sawSelfHit = true; };
    a.on('message', h2);
    send(a, { type: 'fg-shoot' });
    await sleep(300);
    a.off('message', h2);
    assert.equal(sawSelfHit, false, 'a duelist must never be able to land a hit on themselves');

    a.close(); b.close();
  });

  // The unlock-gate *mechanism* (unlockKills, fgUnlockedWeapons, fg-select-weapon's enforcement
  // check) is all still live in server.js — just every weapon in the current fixed loadout is
  // unlockKills:0, so this asserts the loadout ships fully available rather than testing a gate
  // that isn't currently closed on anything.
  test('the full 4-weapon loadout is available immediately, no career kills required', async () => {
    const code = 'FFLOADOUT1';
    const a = await fgConnect();
    const b = await fgConnect();
    send(a, { type: 'fg-join', code, name: 'FfLoadoutA' });
    const initA = await waitFor(a, (m) => m.type === 'fg-init');
    assert.deepEqual(
      [...initA.unlockedWeapons].sort(),
      ['assault_rifle', 'fists', 'grenade', 'pistol'],
      'a fresh player with 0 career kills must start with the entire loadout unlocked'
    );
    assert.equal(initA.totalKills, 0);
    send(b, { type: 'fg-join', code, name: 'FfLoadoutB' });
    await waitFor(b, (m) => m.type === 'fg-init');

    // Every slot must be immediately selectable, in any order, with zero kills earned.
    for (const weapon of ['assault_rifle', 'fists', 'grenade', 'pistol']) {
      const changePromise = waitFor(a, (m) => m.type === 'fg-weapon-changed' && m.weapon === weapon);
      send(a, { type: 'fg-select-weapon', weapon });
      const change = await changePromise;
      assert.equal(change.weapon, weapon, `${weapon} must be selectable with no career kills`);
    }

    a.close(); b.close();
  });
});

// Found alongside the Firefight self-fight exploit above: chess and tic-tac-toe assign their two
// fixed roles (white/black, X/O) the same way — an id-truthiness check plus a `players` Map keyed
// by the connection, not the id — so a repeat join on one connection generates a fresh id,
// "claims" the second role with it, and silently orphans the first id forever (still sitting in
// whiteId/xId with no matching players entry left, since the Map overwrote that entry when the
// repeat join ran). Unlike Firefight this doesn't hand out guaranteed wins, but it does
// permanently soft-lock the game — nobody can ever move as the orphaned color/symbol again, and
// once both are "claimed" this way no real second player can join either.
describe('fixed-role two-player games reject a same-connection repeat join', () => {
  test('chess: a repeat ch-join on one connection cannot claim both colors', async () => {
    const code = 'CHSELFJOIN1';
    const a = await connectWs();
    send(a, { type: 'ch-join', code, name: 'Solo1' });
    const initA = await waitFor(a, (m) => m.type === 'ch-init');
    const myColor = initA.state.players.find((p) => p.id === initA.id).color;
    assert.equal(myColor, 'white');

    let sawSecondInit = false;
    const h = (data) => { if (JSON.parse(data).type === 'ch-init') sawSecondInit = true; };
    a.on('message', h);
    send(a, { type: 'ch-join', code, name: 'Solo2' });
    await sleep(200);
    a.off('message', h);
    assert.equal(sawSecondInit, false, 'a repeat ch-join on the same connection must not be re-processed');

    const b = await connectWs();
    send(b, { type: 'ch-join', code, name: 'RealB' });
    const initB = await waitFor(b, (m) => m.type === 'ch-init');
    const bColor = initB.state.players.find((p) => p.id === initB.id).color;
    assert.equal(bColor, 'black', 'black must still be claimable by a genuinely different connection');

    a.close(); b.close();
  });

  test('tic-tac-toe: a repeat tt-join on one connection cannot claim both symbols', async () => {
    const code = 'TTSELFJOIN1';
    const a = await connectWs();
    send(a, { type: 'tt-join', code, name: 'Solo1' });
    const initA = await waitFor(a, (m) => m.type === 'tt-init');
    const mySymbol = initA.state.players.find((p) => p.id === initA.id).symbol;
    assert.equal(mySymbol, 'X');

    let sawSecondInit = false;
    const h = (data) => { if (JSON.parse(data).type === 'tt-init') sawSecondInit = true; };
    a.on('message', h);
    send(a, { type: 'tt-join', code, name: 'Solo2' });
    await sleep(200);
    a.off('message', h);
    assert.equal(sawSecondInit, false, 'a repeat tt-join on the same connection must not be re-processed');

    const b = await connectWs();
    send(b, { type: 'tt-join', code, name: 'RealB' });
    const initB = await waitFor(b, (m) => m.type === 'tt-init');
    const bSymbol = initB.state.players.find((p) => p.id === initB.id).symbol;
    assert.equal(bSymbol, 'O', 'O must still be claimable by a genuinely different connection');

    a.close(); b.close();
  });

  // Found by the turn-based-minigame UI correctness audit: ttCheckWinner used to return only the
  // winning symbol, discarding exactly which cells formed the run — the client had no win-line to
  // render at all. winCells is now threaded through every tt-state/tt-init broadcast.
  test('tic-tac-toe: tt-state reports the exact cells that formed the winning line', async () => {
    const code = 'TTWINCELLS1';
    const x = await connectWs();
    send(x, { type: 'tt-join', code, name: 'WinCellsX' });
    await waitFor(x, (m) => m.type === 'tt-init');
    const o = await connectWs();
    send(o, { type: 'tt-join', code, name: 'WinCellsO' });
    await waitFor(o, (m) => m.type === 'tt-init');

    // X takes the top row (indices 0,1,2); O plays the middle row in between. Board index =
    // row*3+col for the default 3x3 tictactoe mode.
    //
    // broadcastTt fans a move's resulting tt-state out to BOTH sockets, sender included — waiting
    // for only the mover's own copy before starting the next move raced the other socket's still-
    // in-flight copy of THIS move against the next move's own send: found live (a scratch WS
    // script against production reproduced it directly) as an off-by-one board where a later
    // move's "confirmation" was actually the previous move's stale broadcast just now arriving.
    // Waiting for both sockets to receive each move's broadcast before proceeding fully drains the
    // queue every round, so no leftover message can be mistaken for the next round's response.
    async function move(mover, other, row, col) {
      const p1 = waitFor(mover, (m) => m.type === 'tt-state');
      const p2 = waitFor(other, (m) => m.type === 'tt-state');
      send(mover, { type: 'tt-move', row, col });
      const [moverState] = await Promise.all([p1, p2]);
      return moverState;
    }
    await move(x, o, 0, 0); // X: idx 0
    await move(o, x, 1, 0); // O: idx 3
    await move(x, o, 0, 1); // X: idx 1
    await move(o, x, 1, 1); // O: idx 4
    const finalX = await move(x, o, 0, 2); // X: idx 2 -- completes the top row

    assert.equal(finalX.state.winner, 'X');
    assert.deepEqual([...finalX.state.winCells].sort((a, b) => a - b), [0, 1, 2]);

    x.close(); o.close();
  });
});

describe('minigame-authority audit: missing flood gates', () => {
  // Found by a minigame-authority audit: an illegal ch-move returns early without flipping
  // ch.turn, so — unlike almost every other state-mutating handler in this file — a seated player
  // could resubmit ch-move unboundedly during their own turn. Each attempt runs chessIsLegalMove
  // (a board clone plus a full check-safety scan of all 64 squares), real synchronous work on the
  // single-threaded event loop shared by every room on the server.
  test('ch-move is flood-gated during a player\'s own turn, not just checked for legality', async () => {
    const code = 'CHFLOOD1';
    const white = await connectWs();
    send(white, { type: 'ch-join', code, name: 'FloodWhite' });
    await waitFor(white, (m) => m.type === 'ch-init');
    const black = await connectWs();
    send(black, { type: 'ch-join', code, name: 'FloodBlack' });
    await waitFor(black, (m) => m.type === 'ch-init');
    await sleep(150);

    // Illegal move: "from" is an empty square (rows 2-5 are empty on the starting board), so this
    // never flips ch.turn — if unthrottled, the same connection could resubmit this indefinitely.
    for (let i = 0; i < 9; i++) {
      send(white, { type: 'ch-move', from: { row: 4, col: 4 }, to: { row: 4, col: 5 } });
    }
    await sleep(300);

    // A genuinely legal opening move (white pawn one square forward), sent while still inside the
    // same flood window — if the gate is working, this must ALSO be silently dropped, not just the
    // illegal ones, proving the drop is the rate limiter and not a rejection of this specific move.
    let sawState = false;
    const h = (data) => { if (JSON.parse(data).type === 'ch-state') sawState = true; };
    white.on('message', h);
    send(white, { type: 'ch-move', from: { row: 1, col: 0 }, to: { row: 2, col: 0 } });
    await sleep(300);
    white.off('message', h);
    assert.equal(sawState, false, 'a move sent while still inside the flood window must be dropped regardless of its own legality');

    // Once the window clears, the exact same legal move must succeed — confirming the earlier drop
    // really was the rate limiter, not a permanent rejection of this move.
    await sleep(6200);
    const statePromise = waitFor(white, (m) => m.type === 'ch-state');
    send(white, { type: 'ch-move', from: { row: 1, col: 0 }, to: { row: 2, col: 0 } });
    const state = await statePromise;
    assert.equal(state.lastMove.from.row, 1);

    white.close(); black.close();
  });

  // Every leaderboard-fetch handler (tv/arcade/hm/ch/tt/dg) was missing the isWsMsgRateLimited
  // gate every other state-mutating handler in this file already has — a flood-cost-only gap (the
  // query itself is already correctly scoped to the caller's own room), same shape as the
  // get-group-dm-threads/get-group-dm-messages fix from an earlier dimension.
  test('ch-leaderboard is flood-gated like every other content-mutating path', async () => {
    const code = 'CHLBFLOOD1';
    const ws = await connectWs();
    send(ws, { type: 'ch-join', code, name: 'LbFlood' });
    await waitFor(ws, (m) => m.type === 'ch-init');
    await sleep(150);

    let count = 0;
    const h = (data) => { if (JSON.parse(data).type === 'ch-leaderboard-result') count++; };
    ws.on('message', h);
    for (let i = 0; i < 15; i++) send(ws, { type: 'ch-leaderboard' });
    await sleep(500);
    ws.off('message', h);
    assert.ok(count > 0 && count <= 8, `expected 1-8 of 15 ch-leaderboard fetches through, got ${count}`);
    ws.close();
  });
});

describe('Block Battle 1v1 duel: challenge, accept/decline, pre-duel map vote, rounds', () => {
  // Zero coverage existed for the original challenge/accept/shoot 1v1 flow before this — every
  // prior bb test only covered the "can't challenge someone already busy" rejection, or the newer
  // NvN plate system. Dedicated instance for the same BB_RESPAWN_GRACE_MS=0 reason as the NvN
  // block below, plus BB_MATCH_VOTE_MS shrunk so the pre-duel map vote resolves in well under a
  // second instead of the real 10s production value, and BB_ROUNDS_TO_WIN shrunk to 2 (not 1 —
  // needs at least one real round-continues-the-duel transition to be worth testing) so a full
  // duel doesn't need 5 rounds x 5 hits = 25 shots to finish.
  let duelServer;
  before(async () => {
    duelServer = await startTestServer({ BB_RESPAWN_GRACE_MS: '0', BB_MATCH_VOTE_MS: '200', BB_ROUNDS_TO_WIN: '2' }, 3205);
  });
  after(async () => { await duelServer.stop(); });

  function duelConnect() {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://localhost:${duelServer.port}`);
      ws.on('open', () => resolve(ws));
    });
  }
  async function duelJoin(code) {
    const ws = await duelConnect();
    send(ws, { type: 'bb-join', code, level: 1 });
    const init = await waitFor(ws, (m) => m.type === 'bb-init');
    return { ws, id: init.id };
  }
  // 5 shots at BB_WEAPON.damage=20 eliminate a target (BB_MAX_HEALTH=100) and win the round.
  async function fireRound(shooter) {
    for (let i = 0; i < 5; i++) {
      send(shooter, { type: 'bb-shoot' });
      await sleep(160); // just past BB_WEAPON.cooldownMs (150)
    }
  }

  test('a declined challenge notifies the challenger and leaves both free to duel someone else', async () => {
    const code = 'BBDUEL-DECLINE';
    const a = await duelJoin(code);
    const b = await duelJoin(code);

    send(a.ws, { type: 'bb-challenge', targetId: b.id });
    const challenged = await waitFor(b.ws, (m) => m.type === 'bb-challenged');
    assert.equal(challenged.fromId, a.id);

    const declined = waitFor(a.ws, (m) => m.type === 'bb-challenge-declined');
    send(b.ws, { type: 'bb-challenge-response', fromId: a.id, accept: false });
    const decline = await declined;
    assert.equal(decline.byId, b.id);

    a.ws.close(); b.ws.close();
  });

  // Found by the Block Battle client-correctness audit: a challenge to an already-busy player used
  // to be dropped with zero response, while the client shows an unconditional "Challenge sent"
  // toast regardless of whether it actually reached anyone.
  test('challenging an already-dueling player gets bb-challenge-failed, not silence', async () => {
    const code = 'BBDUEL-BUSY';
    const a = await duelJoin(code);
    const b = await duelJoin(code);
    const c = await duelJoin(code);

    // A and B lock into a duel (dueling=true fires immediately on accept, before the map vote even
    // resolves) -- busy enough for bbIsBusy without needing to actually finish the vote.
    send(a.ws, { type: 'bb-challenge', targetId: b.id });
    await waitFor(b.ws, (m) => m.type === 'bb-challenged');
    send(b.ws, { type: 'bb-challenge-response', fromId: a.id, accept: true });
    await waitFor(a.ws, (m) => m.type === 'bb-duel-map-vote');

    const failed = waitFor(c.ws, (m) => m.type === 'bb-challenge-failed');
    send(c.ws, { type: 'bb-challenge', targetId: b.id });
    const fail = await failed;
    assert.equal(fail.reason, 'busy');
    assert.equal(fail.targetId, b.id);

    a.ws.close(); b.ws.close(); c.ws.close();
  });

  // Found by the same audit: a second incoming challenge silently overwrote the client's popup for
  // the first, with no signal ever sent back to that first challenger -- who'd be left waiting
  // forever on a challenge no one could ever now answer.
  test('a second incoming challenge auto-declines the first, notifying the original challenger', async () => {
    const code = 'BBDUEL-REPLACE';
    const a = await duelJoin(code);
    const b = await duelJoin(code);
    const c = await duelJoin(code);

    send(a.ws, { type: 'bb-challenge', targetId: c.id });
    await waitFor(c.ws, (m) => m.type === 'bb-challenged');

    const aDeclined = waitFor(a.ws, (m) => m.type === 'bb-challenge-declined');
    send(b.ws, { type: 'bb-challenge', targetId: c.id });
    const bChallenged = await waitFor(c.ws, (m) => m.type === 'bb-challenged');
    assert.equal(bChallenged.fromId, b.id, "c's popup must now show b's challenge");
    const decline = await aDeclined;
    assert.equal(decline.byId, c.id, "a's original challenge must be auto-declined, not left hanging");

    // Responding to A's now-superseded challenge (a stale client popup) must be a no-op, not
    // accidentally pair A and C into a duel neither of them actually agreed to right now.
    send(c.ws, { type: 'bb-challenge-response', fromId: a.id, accept: true });
    await sleep(200);
    send(c.ws, { type: 'bb-challenge-response', fromId: b.id, accept: true });
    const vote = await waitFor(c.ws, (m) => m.type === 'bb-duel-map-vote');
    assert.equal(vote.opponentId, b.id, "accepting b's real challenge must pair c with b, not a");

    a.ws.close(); b.ws.close(); c.ws.close();
  });

  test('an accepted challenge opens a map vote (not combat) first, pairing opponentId correctly in both directions', async () => {
    const code = 'BBDUEL-VOTE';
    const a = await duelJoin(code);
    const b = await duelJoin(code);

    send(a.ws, { type: 'bb-challenge', targetId: b.id });
    await waitFor(b.ws, (m) => m.type === 'bb-challenged');

    const voteA = waitFor(a.ws, (m) => m.type === 'bb-duel-map-vote');
    const voteB = waitFor(b.ws, (m) => m.type === 'bb-duel-map-vote');
    send(b.ws, { type: 'bb-challenge-response', fromId: a.id, accept: true });
    const [va, vb] = await Promise.all([voteA, voteB]);
    assert.equal(va.opponentId, b.id, 'A must be paired with B, not itself or a third party');
    assert.equal(vb.opponentId, a.id, 'B must be paired with A — the pairing must be mutual');

    // Shooting before the vote resolves must be rejected — there's no map/round to fight on yet.
    let sawHit = false;
    const h = (data) => { if (JSON.parse(data).type === 'bb-hit-confirm') sawHit = true; };
    a.ws.on('message', h);
    send(a.ws, { type: 'bb-shoot' });
    await sleep(150);
    a.ws.off('message', h);
    assert.equal(sawHit, false, 'a shot fired during the pre-duel map vote must not land');

    const started = await waitFor(a.ws, (m) => m.type === 'bb-duel-started', 3000);
    assert.ok(BB_MAP_IDS_FOR_TEST.includes(started.mapId), 'the vote must resolve to a real map id');
    assert.equal(started.roundsWon, 0);
    assert.equal(started.roundsLost, 0);

    a.ws.close(); b.ws.close();
  });

  test('casting a vote in the pre-duel window broadcasts the tally to both duelists', async () => {
    const code = 'BBDUEL-TALLY';
    const a = await duelJoin(code);
    const b = await duelJoin(code);

    send(a.ws, { type: 'bb-challenge', targetId: b.id });
    await waitFor(b.ws, (m) => m.type === 'bb-challenged');
    // Both waitFor calls must attach their listeners BEFORE the send below triggers the server to
    // reply to both sockets in the same tick — awaiting them one at a time would let the second
    // socket's message arrive (and be dropped, nothing listening yet) while still awaiting the first.
    const voteA = waitFor(a.ws, (m) => m.type === 'bb-duel-map-vote');
    const voteB = waitFor(b.ws, (m) => m.type === 'bb-duel-map-vote');
    send(b.ws, { type: 'bb-challenge-response', fromId: a.id, accept: true });
    await Promise.all([voteA, voteB]);

    const updateB = waitFor(b.ws, (m) => m.type === 'bb-match-map-vote-update');
    send(a.ws, { type: 'bb-vote-match-map', mapId: 'garage_a' });
    const update = await updateB;
    assert.deepEqual(update.tally, { garage_a: 1 });

    await waitFor(a.ws, (m) => m.type === 'bb-duel-started', 3000); // let the vote resolve before closing
    a.ws.close(); b.ws.close();
  });

  test('first to BB_ROUNDS_TO_WIN (2) round wins takes the duel; a round win respawns and continues it', async () => {
    const code = 'BBDUEL-ROUNDS';
    const a = await duelJoin(code);
    const b = await duelJoin(code);

    send(a.ws, { type: 'bb-challenge', targetId: b.id });
    await waitFor(b.ws, (m) => m.type === 'bb-challenged');
    send(b.ws, { type: 'bb-challenge-response', fromId: a.id, accept: true });
    // Both listeners attached before either is awaited — see the tally test above's comment on why.
    const startedA = waitFor(a.ws, (m) => m.type === 'bb-duel-started', 3000);
    const startedB = waitFor(b.ws, (m) => m.type === 'bb-duel-started', 3000);
    await Promise.all([startedA, startedB]);

    // Round 1: A wins — the duel must NOT end yet (BB_ROUNDS_TO_WIN is 2), both respawn instead.
    const roundEndA = waitFor(a.ws, (m) => m.type === 'bb-duel-round-end');
    const roundEndB = waitFor(b.ws, (m) => m.type === 'bb-duel-round-end');
    await fireRound(a.ws);
    const [reA, reB] = await Promise.all([roundEndA, roundEndB]);
    assert.equal(reA.won, true); assert.equal(reA.roundsWon, 1); assert.equal(reA.roundsLost, 0);
    assert.equal(reB.won, false); assert.equal(reB.roundsWon, 0); assert.equal(reB.roundsLost, 1);

    // Round 2: A wins again — 2 round wins reached, the whole duel ends now.
    const aWon = waitFor(a.ws, (m) => m.type === 'bb-duel-won');
    const bLost = waitFor(b.ws, (m) => m.type === 'bb-duel-lost');
    await fireRound(a.ws);
    const [won, lost] = await Promise.all([aWon, bLost]);
    assert.equal(won.roundsWon, 2); assert.equal(won.roundsLost, 0);
    assert.equal(lost.roundsWon, 0); assert.equal(lost.roundsLost, 2);

    a.ws.close(); b.ws.close();
  });
});

describe('Block Battle NvN match stations', () => {
  // Dedicated instance so BB_RESPAWN_GRACE_MS can be zeroed — these tests fire shots within
  // milliseconds of a match starting, well inside the real 500ms grace window, which would
  // silently reject the shot and throw off the elimination-count math below. BB_MATCH_VOTE_MS is
  // shrunk so each match's own pre-fight map vote resolves in well under a second (every test
  // below just waits for bb-match-started, which now only fires once that vote resolves — the
  // default 3000ms waitFor timeout comfortably covers the shrunk window, no other test changes
  // needed). BB_ROUNDS_TO_WIN is set to 1 so a single elimination still ends the whole match
  // immediately, preserving every existing test's "elimination ends it" assertions unchanged — the
  // actual multi-round-continues behavior has its own dedicated test further down instead.
  let bbServer;
  before(async () => {
    bbServer = await startTestServer({ BB_RESPAWN_GRACE_MS: '0', BB_MATCH_VOTE_MS: '150', BB_ROUNDS_TO_WIN: '1' }, 3202);
  });
  after(async () => { await bbServer.stop(); });

  function bbConnect() {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://localhost:${bbServer.port}`);
      ws.on('open', () => resolve(ws));
    });
  }
  async function bbJoin(code) {
    const ws = await bbConnect();
    send(ws, { type: 'bb-join', code, level: 1 });
    const init = await waitFor(ws, (m) => m.type === 'bb-init');
    return { ws, id: init.id, stations: init.stations };
  }
  // BB_MAX_HEALTH is 100, BB_WEAPON.damage is 20 — exactly 5 hits eliminate a target. Cooldown is
  // 150ms, so each shot waits just past that before the next.
  async function bbShootUntilEliminated(shooter, targetId) {
    for (let i = 0; i < 5; i++) {
      send(shooter, { type: 'bb-shoot', targetId });
      await sleep(160);
    }
  }

  test('bb-init reports empty station occupancy; entering and leaving a plate round-trips through bb-station-update', async () => {
    const code = 'BBPLATE1';
    const a = await bbJoin(code);
    const st1 = a.stations.find((s) => s.stationId === 'st1');
    assert.deepEqual(st1.a, [null], 'a fresh station starts with an empty side A');
    assert.equal(st1.inProgress, false);

    const enterPromise = waitFor(a.ws, (m) => m.type === 'bb-station-update' && m.stationId === 'st1');
    send(a.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'a', slot: 0 });
    const afterEnter = await enterPromise;
    assert.deepEqual(afterEnter.a, ['Guest']);

    const leavePromise = waitFor(a.ws, (m) => m.type === 'bb-station-update' && m.stationId === 'st1');
    send(a.ws, { type: 'bb-plate-leave' });
    const afterLeave = await leavePromise;
    assert.deepEqual(afterLeave.a, [null]);

    a.ws.close();
  });

  test('a 1v1 station starts a match once both sides fill, elimination ends it, and the station unlocks afterward', async () => {
    const code = 'BBMATCH1';
    const a = await bbJoin(code);
    const b = await bbJoin(code);

    let matchStartedEarly = false;
    const aStarted = waitFor(a.ws, (m) => m.type === 'bb-match-started').then((m) => { matchStartedEarly = true; return m; });
    const bStarted = waitFor(b.ws, (m) => m.type === 'bb-match-started');
    send(a.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'a', slot: 0 });
    // Not yet full — no match should start off one side alone.
    await sleep(150);
    assert.equal(matchStartedEarly, false, 'a match must not start with only one side filled');
    send(b.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'b', slot: 0 });
    const [startA, startB] = await Promise.all([aStarted, bStarted]);
    assert.equal(startA.side, 'a');
    assert.equal(startB.side, 'b');
    assert.deepEqual(startA.enemies.map((e) => e.id), [b.id]);
    assert.deepEqual(startB.enemies.map((e) => e.id), [a.id]);
    assert.equal(startA.matchId, startB.matchId);

    const aEnded = waitFor(a.ws, (m) => m.type === 'bb-match-ended');
    const bEliminated = waitFor(b.ws, (m) => m.type === 'bb-match-eliminated');
    const bEnded = waitFor(b.ws, (m) => m.type === 'bb-match-ended');
    await bbShootUntilEliminated(a.ws, b.id);
    await bEliminated;
    const [endA, endB] = await Promise.all([aEnded, bEnded]);
    assert.equal(endA.won, true, 'the shooter\'s side must be told it won');
    assert.equal(endB.won, false, 'the eliminated side must be told it lost');

    // The station must be unlocked and empty again — a fresh pair can immediately start a new match there.
    const c = await bbJoin(code);
    const d = await bbJoin(code);
    const cStarted = waitFor(c.ws, (m) => m.type === 'bb-match-started');
    send(c.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'a', slot: 0 });
    send(d.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'b', slot: 0 });
    await cStarted;

    a.ws.close(); b.ws.close(); c.ws.close(); d.ws.close();
  });

  test('leaving a plate before both sides fill frees the slot for a different connection', async () => {
    const code = 'BBPLATE2';
    const a = await bbJoin(code);
    const b = await bbJoin(code);
    send(a.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'a', slot: 0 });
    await waitFor(a.ws, (m) => m.type === 'bb-station-update' && m.a[0] === 'Guest');
    send(a.ws, { type: 'bb-plate-leave' });
    await waitFor(a.ws, (m) => m.type === 'bb-station-update' && m.a[0] === null);

    const bUpdate = waitFor(b.ws, (m) => m.type === 'bb-station-update' && m.a[0] === 'Guest');
    send(b.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'a', slot: 0 });
    await bUpdate;

    a.ws.close(); b.ws.close();
  });

  test('a 2v2 match reports the right rosters and rejects shooting a teammate', async () => {
    const code = 'BBMATCH2';
    const a = await bbJoin(code); // side a slot 0
    const b = await bbJoin(code); // side a slot 1 — a's teammate
    const c = await bbJoin(code); // side b slot 0
    const d = await bbJoin(code); // side b slot 1

    const startedA = waitFor(a.ws, (m) => m.type === 'bb-match-started');
    const startedC = waitFor(c.ws, (m) => m.type === 'bb-match-started');
    send(a.ws, { type: 'bb-plate-enter', stationId: 'st2', side: 'a', slot: 0 });
    send(b.ws, { type: 'bb-plate-enter', stationId: 'st2', side: 'a', slot: 1 });
    send(c.ws, { type: 'bb-plate-enter', stationId: 'st2', side: 'b', slot: 0 });
    send(d.ws, { type: 'bb-plate-enter', stationId: 'st2', side: 'b', slot: 1 });
    const [startA, startC] = await Promise.all([startedA, startedC]);
    assert.deepEqual(startA.teammates.map((t) => t.id), [b.id]);
    assert.deepEqual(startA.enemies.map((t) => t.id).sort(), [c.id, d.id].sort());
    assert.deepEqual(startC.teammates.map((t) => t.id), [d.id]);
    assert.deepEqual(startC.enemies.map((t) => t.id).sort(), [a.id, b.id].sort());

    // A teammate must be un-shootable — B takes no damage from A's shot.
    const bHitCheck = (data) => { if (JSON.parse(data).type === 'bb-match-hit') throw new Error('a teammate must never take match damage'); };
    b.ws.on('message', bHitCheck);
    send(a.ws, { type: 'bb-shoot', targetId: b.id });
    await sleep(200);
    b.ws.off('message', bHitCheck);

    // An enemy IS shootable, and eliminating both of them ends the match for A's side as the winner.
    const aWon = waitFor(a.ws, (m) => m.type === 'bb-match-ended' && m.won === true);
    await bbShootUntilEliminated(a.ws, c.id);
    await bbShootUntilEliminated(b.ws, d.id);
    await aWon;

    a.ws.close(); b.ws.close(); c.ws.close(); d.ws.close();
  });

  test('a disconnect mid-match ends it in favor of the remaining side', async () => {
    const code = 'BBMATCH3';
    const a = await bbJoin(code);
    const b = await bbJoin(code);
    const aStarted = waitFor(a.ws, (m) => m.type === 'bb-match-started');
    const aWon = waitFor(a.ws, (m) => m.type === 'bb-match-ended' && m.won === true);
    send(a.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'a', slot: 0 });
    send(b.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'b', slot: 0 });
    await aStarted;
    b.ws.close(); // no bb-leave sent — a raw drop, same as a network blip
    await aWon;

    a.ws.close();
  });

  test('a 1v1 duel challenge to (or from) a player already in an NvN match is silently rejected', async () => {
    const code = 'BBCROSS1';
    const a = await bbJoin(code);
    const b = await bbJoin(code);
    const c = await bbJoin(code);
    const aStarted = waitFor(a.ws, (m) => m.type === 'bb-match-started');
    const bStarted = waitFor(b.ws, (m) => m.type === 'bb-match-started');
    send(a.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'a', slot: 0 });
    send(b.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'b', slot: 0 });
    await Promise.all([aStarted, bStarted]);

    // C challenges A, who is mid-match — A must never see the challenge popup.
    let aChallenged = false;
    const aChallengeCheck = (data) => { if (JSON.parse(data).type === 'bb-challenged') aChallenged = true; };
    a.ws.on('message', aChallengeCheck);
    send(c.ws, { type: 'bb-challenge', targetId: a.id });
    await sleep(200);
    a.ws.off('message', aChallengeCheck);
    assert.equal(aChallenged, false, 'a player mid-NvN-match must not be challengeable');

    // A (mid-match) tries to challenge C — C must never see it either.
    let cChallenged = false;
    const cChallengeCheck = (data) => { if (JSON.parse(data).type === 'bb-challenged') cChallenged = true; };
    c.ws.on('message', cChallengeCheck);
    send(a.ws, { type: 'bb-challenge', targetId: c.id });
    await sleep(200);
    c.ws.off('message', cChallengeCheck);
    assert.equal(cChallenged, false, 'a player mid-NvN-match must not be able to issue a challenge');

    a.ws.close(); b.ws.close(); c.ws.close();
  });

  test('two connections racing for the same plate slot: the loser gets bb-plate-rejected and the winner is unaffected', async () => {
    const code = 'BBRACE1';
    const a = await bbJoin(code);
    const b = await bbJoin(code);
    const winUpdate = waitFor(a.ws, (m) => m.type === 'bb-station-update' && m.a[0] === 'Guest');
    send(a.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'a', slot: 0 });
    await winUpdate;

    const rejected = waitFor(b.ws, (m) => m.type === 'bb-plate-rejected');
    send(b.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'a', slot: 0 });
    const rej = await rejected;
    assert.deepEqual({ stationId: rej.stationId, side: rej.side, slot: rej.slot }, { stationId: 'st1', side: 'a', slot: 0 });

    // The winner's own claim on the slot must be completely untouched by the loser's attempt.
    const check = waitFor(a.ws, (m) => m.type === 'bb-station-update' && m.stationId === 'st1');
    send(a.ws, { type: 'bb-plate-leave' }); // trigger a fresh broadcast to inspect current truth
    const after = await check;
    assert.deepEqual(after.a, [null], 'leaving must still work normally — the loser\'s rejected attempt never actually held the slot');

    a.ws.close(); b.ws.close();
  });

  test('a non-participant teammate\'s roster health updates when an ally (not them) is hit', async () => {
    const code = 'BBROSTER1';
    const a = await bbJoin(code); // side a slot 0
    const b = await bbJoin(code); // side a slot 1 — a's teammate, NOT directly involved in the hit below
    const c = await bbJoin(code); // side b slot 0 — will do the shooting
    const d = await bbJoin(code); // side b slot 1

    const startedA = waitFor(a.ws, (m) => m.type === 'bb-match-started');
    send(a.ws, { type: 'bb-plate-enter', stationId: 'st2', side: 'a', slot: 0 });
    send(b.ws, { type: 'bb-plate-enter', stationId: 'st2', side: 'a', slot: 1 });
    send(c.ws, { type: 'bb-plate-enter', stationId: 'st2', side: 'b', slot: 0 });
    send(d.ws, { type: 'bb-plate-enter', stationId: 'st2', side: 'b', slot: 1 });
    await startedA;

    // C shoots A (not B) — B is a bystander teammate who should still learn A's new health.
    const bLearnsAHealth = waitFor(b.ws, (m) => m.type === 'bb-match-roster-health' && m.id === a.id);
    send(c.ws, { type: 'bb-shoot', targetId: a.id });
    const rosterUpdate = await bLearnsAHealth;
    assert.equal(rosterUpdate.health, 80, 'B must see A drop to 80 health even though B was not the one shot');

    a.ws.close(); b.ws.close(); c.ws.close(); d.ws.close();
  });
});

describe('Block Battle NvN match: pre-match map vote and multi-round continuation', () => {
  // Own dedicated instance (distinct BB_ROUNDS_TO_WIN from the block above, which deliberately
  // uses 1 to keep its existing single-elimination-ends-it assertions unchanged) — this is the
  // test that actually exercises "a round win respawns and continues the match instead of ending
  // it," the NvN equivalent of the duel suite's own rounds test above. The two share the same
  // underlying shape (bbCheckMatchEnd's round-scoring/bbRestartMatchRound) but reach it through
  // genuinely different code (team alive-counts, not a single opponentId), so it's worth its own
  // coverage rather than assuming the duel test alone proves this half of the file too.
  let roundsServer;
  before(async () => {
    roundsServer = await startTestServer({ BB_RESPAWN_GRACE_MS: '0', BB_MATCH_VOTE_MS: '150', BB_ROUNDS_TO_WIN: '2' }, 3208);
  });
  after(async () => { await roundsServer.stop(); });

  function roundsConnect() {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://localhost:${roundsServer.port}`);
      ws.on('open', () => resolve(ws));
    });
  }
  async function roundsJoin(code) {
    const ws = await roundsConnect();
    send(ws, { type: 'bb-join', code, level: 1 });
    const init = await waitFor(ws, (m) => m.type === 'bb-init');
    return { ws, id: init.id };
  }
  async function eliminate(shooter, targetId) {
    for (let i = 0; i < 5; i++) {
      send(shooter, { type: 'bb-shoot', targetId });
      await sleep(160);
    }
  }

  test('a 1v1 station opens its own map vote before the match, and the map vote resolves to a real map', async () => {
    const code = 'BBSTATIONVOTE1';
    const a = await roundsJoin(code);
    const b = await roundsJoin(code);

    const voteA = waitFor(a.ws, (m) => m.type === 'bb-match-map-vote');
    const voteB = waitFor(b.ws, (m) => m.type === 'bb-match-map-vote');
    send(a.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'a', slot: 0 });
    send(b.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'b', slot: 0 });
    const [va, vb] = await Promise.all([voteA, voteB]);
    assert.equal(va.matchId, vb.matchId, 'both sides must be voting on the same pending match');

    const startA = await waitFor(a.ws, (m) => m.type === 'bb-match-started', 3000);
    assert.ok(BB_MAP_IDS_FOR_TEST.includes(startA.mapId), 'the vote must resolve to a real map id');

    a.ws.close(); b.ws.close();
  });

  test('a round win respawns both sides and continues the match; the 2nd round win ends it', async () => {
    const code = 'BBSTATIONROUNDS1';
    const a = await roundsJoin(code);
    const b = await roundsJoin(code);
    // Both listeners attached before either plate-enter — see the duel suite's tally test comment
    // on why (both sockets get bb-match-started in the same tick once the vote resolves).
    const startedA = waitFor(a.ws, (m) => m.type === 'bb-match-started', 3000);
    const startedB = waitFor(b.ws, (m) => m.type === 'bb-match-started', 3000);
    send(a.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'a', slot: 0 });
    send(b.ws, { type: 'bb-plate-enter', stationId: 'st1', side: 'b', slot: 0 });
    await Promise.all([startedA, startedB]);

    // Round 1: A eliminates B — the match must NOT end yet (BB_ROUNDS_TO_WIN is 2).
    const roundEndA = waitFor(a.ws, (m) => m.type === 'bb-match-round-end');
    const roundStartA = waitFor(a.ws, (m) => m.type === 'bb-match-round-start');
    const roundStartB = waitFor(b.ws, (m) => m.type === 'bb-match-round-start');
    await eliminate(a.ws, b.id);
    const re = await roundEndA;
    assert.equal(re.winnerSlot, 'a');
    assert.equal(re.roundsWonA, 1);
    assert.equal(re.roundsWonB, 0);
    await Promise.all([roundStartA, roundStartB]); // both sides respawn for round 2

    // Round 2: A eliminates B again — 2 round wins reached, the whole match ends now.
    const endA = waitFor(a.ws, (m) => m.type === 'bb-match-ended');
    const endB = waitFor(b.ws, (m) => m.type === 'bb-match-ended');
    await eliminate(a.ws, b.id);
    const [ea, eb] = await Promise.all([endA, endB]);
    assert.equal(ea.won, true); assert.equal(ea.roundsWonA, 2); assert.equal(ea.roundsWonB, 0);
    assert.equal(eb.won, false);

    a.ws.close(); b.ws.close();
  });
});

describe('Block Battle NvN match: a departed voter is dropped from the tally', () => {
  // A 2v2+ match survives one side losing a member (unlike a duel, which always ends outright on
  // either side's departure) — if that departing player had already voted in the match's still-
  // open pre-fight window, their vote used to keep counting in every later tally/tie-break
  // forever, a phantom voter biasing the map choice for teammates who are still actually there.
  // Own dedicated instance with a comfortably long vote window (unlike the 150ms used elsewhere in
  // this file's Block Battle suites) — this test needs several sequential round-trips (vote,
  // disconnect, a second vote, then check the broadcast tally) to all land inside one still-open
  // voting phase, and a razor-thin window risks flaking that sequencing under load.
  let dropServer;
  before(async () => { dropServer = await startTestServer({ BB_MATCH_VOTE_MS: '3000' }, 3209); });
  after(async () => { await dropServer.stop(); });

  function dropConnect() {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://localhost:${dropServer.port}`);
      ws.on('open', () => resolve(ws));
    });
  }
  async function dropJoin(code) {
    const ws = await dropConnect();
    send(ws, { type: 'bb-join', code, level: 1 });
    const init = await waitFor(ws, (m) => m.type === 'bb-init');
    return { ws, id: init.id };
  }

  test('a 2v2 match drops a departed player\'s vote from subsequent tally broadcasts', async () => {
    const code = 'BBVOTEDROP1';
    const a = await dropJoin(code); // side a slot 0 — will vote, then disconnect
    const b = await dropJoin(code); // side a slot 1 — a's teammate, stays
    const c = await dropJoin(code); // side b slot 0
    const d = await dropJoin(code); // side b slot 1

    const voteA = waitFor(a.ws, (m) => m.type === 'bb-match-map-vote');
    const voteB = waitFor(b.ws, (m) => m.type === 'bb-match-map-vote');
    send(a.ws, { type: 'bb-plate-enter', stationId: 'st2', side: 'a', slot: 0 });
    send(b.ws, { type: 'bb-plate-enter', stationId: 'st2', side: 'a', slot: 1 });
    send(c.ws, { type: 'bb-plate-enter', stationId: 'st2', side: 'b', slot: 0 });
    send(d.ws, { type: 'bb-plate-enter', stationId: 'st2', side: 'b', slot: 1 });
    await Promise.all([voteA, voteB]);

    // A votes, then vanishes mid-vote (a raw drop, same as a network blip) — no bb-leave sent.
    const dropUpdateB = waitFor(b.ws, (m) => m.type === 'bb-match-map-vote-update');
    send(a.ws, { type: 'bb-vote-match-map', mapId: 'garage_a' });
    await dropUpdateB; // A's own vote landing first, before the disconnect
    a.ws.close();
    await sleep(200); // let the server's close handler run leaveBb

    // B casts a different vote — the resulting tally must show only B's vote, not a stale A entry.
    const tallyAfterDrop = waitFor(b.ws, (m) => m.type === 'bb-match-map-vote-update');
    send(b.ws, { type: 'bb-vote-match-map', mapId: 'plaza_day' });
    const tally = await tallyAfterDrop;
    assert.deepEqual(tally.tally, { plaza_day: 1 }, 'the departed A\'s garage_a vote must not still be counted');

    b.ws.close(); c.ws.close(); d.ws.close();
  });
});

describe('Self-healing patcher: target-file allowlist', () => {
  // Dedicated instance — SYSTEMD_SERVICE_NAME points at a unit name that doesn't exist, so if any
  // test here ever exercised a server-file patch approval (none currently do — see the note in
  // memory about why the approve/reject race isn't covered by an automated test), the resulting
  // `systemctl --user restart ...` would fail harmlessly instead of touching the real production
  // chat-app.service. No ANTHROPIC_API_KEY is set, exactly like production today — generateProposal
  // always bails at the "no credentials" step regardless; what these tests verify is that a
  // malicious target is refused BEFORE that step (before any file read is even attempted), by
  // inspecting the scratch server's own stdout/stderr for patcher.js's log lines.
  let patcherServer;
  before(async () => { patcherServer = await startTestServer({ SYSTEMD_SERVICE_NAME: 'chat-app-test-harness-does-not-exist' }, 3203); });
  after(async () => { await patcherServer.stop(); });

  test('a path-traversal target (public/../<file>) is refused before any file read is attempted', async () => {
    const dirName = path.basename(patcherServer.dir);
    // vapid-keys.json is a real, freshly-generated secret file that genuinely exists in this
    // instance's own scratch directory (see startTestServer) — a real stand-in for the live app's
    // admin-key.json/vapid-keys.json/valk.db, all of which live in the same ROOT directory as
    // server.js. The 'public/' prefix comes from SERVER_PATH_RE's own public branch, which (unlike
    // CLIENT_URL_RE) has no required .js suffix, so this doesn't need a fake .js-named target.
    const res = await fetch(`http://localhost:${patcherServer.port}/errors/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'test error for traversal check',
        stack: `at foo (/${dirName}/public/../vapid-keys.json:1:1)`,
      }),
    });
    assert.equal(res.status, 200); // /errors/report always 200s immediately; generateProposal runs after, fire-and-forget
    await sleep(300);
    assert.match(patcherServer.getOutput(), /Refusing to touch a path outside the allowed self-healing target set: public\/\.\.\/vapid-keys\.json/);
  });

  test('a legitimate target still reaches the normal (no-API-key) bail-out, unaffected by the allowlist', async () => {
    const dirName = path.basename(patcherServer.dir);
    const before = patcherServer.getOutput().length;
    const res = await fetch(`http://localhost:${patcherServer.port}/errors/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'test error for legitimate target',
        stack: `at foo (/${dirName}/server.js:10:5)`,
      }),
    });
    assert.equal(res.status, 200);
    await sleep(300);
    const newOutput = patcherServer.getOutput().slice(before);
    // Whichever way this environment's Anthropic SDK ends up reporting "no credentials" (this
    // installed version defers that error to the actual stream() call rather than throwing at
    // `new Anthropic()`, so it's the "Claude API call failed" catch block, not the "No credentials
    // configured" one) is fine — what actually matters here is that it got PAST the allowlist and
    // successfully read the real file, neither of which a malicious target would do.
    assert.doesNotMatch(newOutput, /Refusing to touch/, 'a legitimate target must not be rejected by the allowlist');
    assert.doesNotMatch(newOutput, /not readable, skipping/, 'server.js must be read successfully, not fail as a missing/unreadable file');
  });
});

describe('Self-healing patcher: global proposal-generation rate cap', () => {
  // Own instance so its global counter (a module-level variable in patcher.js, one per process)
  // starts fresh at 0 — sharing the allowlist describe block's instance above would make this test's
  // outcome depend on how many legitimate-target requests happened to run before it.
  let patcherServer;
  before(async () => { patcherServer = await startTestServer({ SYSTEMD_SERVICE_NAME: 'chat-app-test-harness-does-not-exist' }, 3204); });
  after(async () => { await patcherServer.stop(); });

  test('a 7th distinct-target proposal within the window is capped, even though each target has its own fresh per-target cooldown', async () => {
    const dirName = path.basename(patcherServer.dir);
    // 6 distinct legitimate targets (this app's 3 server-side files plus 3 flat public/*.js files)
    // so none of them trip the separate PER-TARGET cooldown — only the shared global cap can explain
    // a rejection here. Each still reaches the (credential-less) Anthropic call and gets counted by
    // isGlobalProposalRateLimited before that call, exactly like the allowlist block's legitimate-
    // target test above.
    const targets = ['server.js', 'db.js', 'patcher.js', 'public/app.js', 'public/chess.js', 'public/firefight.js'];
    for (const target of targets) {
      const res = await fetch(`http://localhost:${patcherServer.port}/errors/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'rate cap warmup', stack: `at foo (/${dirName}/${target}:1:1)` }),
      });
      assert.equal(res.status, 200);
      await sleep(250);
    }
    const beforeSeventh = patcherServer.getOutput().length;
    const seventhRes = await fetch(`http://localhost:${patcherServer.port}/errors/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'rate cap trip', stack: `at foo (/${dirName}/public/geometrywave.js:1:1)` }),
    });
    assert.equal(seventhRes.status, 200);
    await sleep(300);
    const seventhOutput = patcherServer.getOutput().slice(beforeSeventh);
    assert.match(seventhOutput, /Global proposal-generation cap reached/, 'a 7th distinct-target proposal within the window must be blocked by the global cap');
    assert.doesNotMatch(seventhOutput, /Claude API call failed/, 'a capped proposal must never reach the actual Anthropic call');
  });
});

describe('Self-healing patcher: auth-sensitive-code detection and syntax validation before write', () => {
  // Deliberately does NOT `require('../patcher')` directly to unit-test touchesAuthSensitiveCode in
  // isolation — patcher.js requires './db' at module load, and db.js opens (and runs its
  // CREATE-TABLE-IF-NOT-EXISTS schema setup against) whatever valk.db sits next to wherever it was
  // required from; required directly from this test file, that's the REAL production database, not
  // a scratch copy. The HTTP-level test below exercises the exact same function through the
  // isolated scratch instance's own process instead, with zero risk to production.

  // Own instance (not shared with the two describes above) since these tests seed pending proposal
  // rows directly into the scratch instance's own sqlite file — real end-to-end generateProposal
  // never runs in this environment (no ANTHROPIC_API_KEY), so this is the only way to exercise
  // GET /admin/patches's touchesAuthSensitiveCode field and applyProposal's syntax check at all.
  let patcherServer, adminKey, Database;
  before(async () => {
    Database = require('better-sqlite3');
    patcherServer = await startTestServer({ SYSTEMD_SERVICE_NAME: 'chat-app-test-harness-does-not-exist' }, 3206);
    adminKey = JSON.parse(fs.readFileSync(path.join(patcherServer.dir, 'admin-key.json'), 'utf8')).key;
  });
  after(async () => { await patcherServer.stop(); });

  function seedProposal({ id, targetFile, oldString, newString }) {
    const conn = new Database(path.join(patcherServer.dir, 'valk.db'));
    conn.prepare(
      `INSERT INTO patch_proposals (id, error_report_id, target_file, old_string, new_string, explanation, status, created_at)
       VALUES (?, NULL, ?, ?, ?, 'test proposal', 'pending', ?)`
    ).run(id, targetFile, oldString, newString, Date.now());
    conn.close();
  }

  test('GET /admin/patches marks an auth-sensitive proposal but not a benign one', async () => {
    seedProposal({
      id: 'test-auth-flag-1',
      targetFile: 'public/app.js',
      oldString: 'window.addEventListener',
      newString: 'if (requireAdmin) {} window.addEventListener',
    });
    seedProposal({
      id: 'test-auth-flag-2',
      targetFile: 'public/app.js',
      oldString: 'window.addEventListener',
      newString: 'window.addEventListener',
    });
    const { patches } = await (await fetch(`http://localhost:${patcherServer.port}/admin/patches`, { headers: adminAuth(adminKey) })).json();
    const flagged = patches.find((p) => p.id === 'test-auth-flag-1');
    const unflagged = patches.find((p) => p.id === 'test-auth-flag-2');
    assert.equal(flagged.touchesAuthSensitiveCode, true);
    assert.equal(unflagged.touchesAuthSensitiveCode, false);
    // clean these two up so they don't linger and confuse the syntax-validation tests below, which
    // list/approve by id and don't expect these rows present.
    const conn = new Database(path.join(patcherServer.dir, 'valk.db'));
    conn.prepare(`DELETE FROM patch_proposals WHERE id IN ('test-auth-flag-1', 'test-auth-flag-2')`).run();
    conn.close();
  });

  test('approving a proposal that would produce invalid JavaScript is refused and leaves the file untouched', async () => {
    const targetPath = path.join(patcherServer.dir, 'patcher.js');
    const originalContent = fs.readFileSync(targetPath, 'utf8');
    seedProposal({
      id: 'test-bad-syntax-1',
      targetFile: 'patcher.js',
      oldString: 'const ROOT = __dirname;',
      newString: 'const ROOT = __dirname; function broken( {',
    });
    const res = await fetch(`http://localhost:${patcherServer.port}/admin/patches/test-bad-syntax-1/approve`, {
      method: 'POST',
      headers: adminAuth(adminKey),
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.match(body.error, /would not be valid JavaScript/);
    assert.equal(fs.readFileSync(targetPath, 'utf8'), originalContent, 'a rejected patch must never modify the file on disk');
    const conn = new Database(path.join(patcherServer.dir, 'valk.db'));
    const row = conn.prepare(`SELECT status FROM patch_proposals WHERE id = ?`).get('test-bad-syntax-1');
    conn.close();
    assert.equal(row.status, 'failed');
  });

  test('approving a proposal that produces valid JavaScript still applies normally (syntax check does not false-positive)', async () => {
    const targetPath = path.join(patcherServer.dir, 'patcher.js');
    seedProposal({
      id: 'test-good-syntax-1',
      targetFile: 'patcher.js',
      oldString: 'const ROOT = __dirname;',
      newString: 'const ROOT = __dirname; // patched by test',
    });
    const res = await fetch(`http://localhost:${patcherServer.port}/admin/patches/test-good-syntax-1/approve`, {
      method: 'POST',
      headers: adminAuth(adminKey),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.match(fs.readFileSync(targetPath, 'utf8'), /\/\/ patched by test/);
  });

  test('applying a patch prunes old backups for that target file down to the retention cap', async () => {
    // Found by the backups/secrets/ops-exposure audit: patch_backups/ had no retention at all,
    // unlike every other bounded-history collection in this app (whiteboard strokes, Build Craft
    // overrides, room pins). Pre-seed 25 fake old backups (well past the 20-per-file cap) with an
    // ascending, deliberately-spread timestamp sequence in the filename — the same naming scheme
    // applyProposal itself uses — so pruning has an unambiguous oldest-first order to enforce.
    //
    // Deliberately targets patcher.js, NOT a public/*.js file: startTestServer (helpers.js)
    // symlinks the scratch instance's public/ straight back to this real repo's own public/ dir
    // (only server.js/db.js/patcher.js/package.json get an actual per-instance copy) — an earlier
    // draft of this test used public/chess.js as the target and, via applyProposal's real
    // write-then-rename, patched the REAL production public/chess.js through that symlink. Caught
    // via `git status` after the run; reverted, no live impact (the "fix" was an inert comment
    // append, service was never restarted with it). Every other target-file choice in this describe
    // block already independently avoided this by sticking to patcher.js/server.js/db.js — this is
    // the one to point to if that pattern is ever forgotten again.
    const backupDir = path.join(patcherServer.dir, 'patch_backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const prefix = 'patcher.js.';
    for (let i = 0; i < 25; i++) {
      fs.writeFileSync(path.join(backupDir, `${prefix}${1000000000000 + i}.bak`), `fake backup ${i}`);
    }
    seedProposal({
      id: 'test-backup-prune-1',
      targetFile: 'patcher.js',
      oldString: "const vm = require('vm');",
      newString: "const vm = require('vm'); // patched by prune test",
    });
    const res = await fetch(`http://localhost:${patcherServer.port}/admin/patches/test-backup-prune-1/approve`, {
      method: 'POST',
      headers: adminAuth(adminKey),
    });
    assert.equal(res.status, 200);
    const remaining = fs.readdirSync(backupDir).filter((n) => n.startsWith(prefix)).sort();
    // 25 pre-seeded + 1 just-written by this approval = 26; capped to the newest 20.
    assert.equal(remaining.length, 20);
    assert.ok(!remaining.includes(`${prefix}1000000000000.bak`), 'oldest pre-seeded backup must have been pruned');
    assert.ok(remaining.includes(`${prefix}1000000000024.bak`), 'newest pre-seeded backup must survive');
  });
});

// Found by a push-notification authorization/target-scoping audit: /push/subscribe and
// /admin/push/subscribe accepted any subscription.endpoint at face value — the web-push library
// itself does no origin-checking either, so an attacker supplying their own valid EC subscription
// keys (no browser needed) could register an arbitrary internal host:port and have this server
// later open an outbound HTTPS connection to it the next time any real push fires. Only the
// endpoint-allowlist fix is testable without a real external network call (subscribing is
// rejected before any send is attempted); the ban/mute-push and email-mention-block fixes from
// the same audit pass were verified by code review only, since this app has no infrastructure —
// here or anywhere else in this suite — to observe an actual webpush.sendNotification call made
// from the separate server child process, and asserting on one for real would mean a real,
// slow, flaky network call to an actual push service.
describe('push subscription endpoint validation', () => {
  test('/push/subscribe rejects a non-push-service endpoint', async () => {
    const res = await fetch(`${BASE_URL}/push/subscribe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'EndpointCheck', subscription: { endpoint: 'https://evil.internal:8080/probe' } }),
    });
    assert.equal(res.status, 400);
  });

  test('/push/subscribe accepts a real push-service endpoint shape', async () => {
    const res = await fetch(`${BASE_URL}/push/subscribe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'EndpointCheck2', subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123' } }),
    });
    assert.equal(res.status, 200);
  });

  test('/push/subscribe rejects a plain-http endpoint even on an otherwise-allowed host', async () => {
    const res = await fetch(`${BASE_URL}/push/subscribe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'EndpointCheck3', subscription: { endpoint: 'http://fcm.googleapis.com/fcm/send/abc123' } }),
    });
    assert.equal(res.status, 400);
  });

  test('/admin/push/subscribe rejects a non-push-service endpoint the same way', async () => {
    const adminKey = JSON.parse(fs.readFileSync(path.join(server.dir, 'admin-key.json'), 'utf8')).key;
    const res = await fetch(`${BASE_URL}/admin/push/subscribe`, {
      method: 'POST', headers: { ...adminAuth(adminKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: { endpoint: 'https://evil.internal:8080/probe' } }),
    });
    assert.equal(res.status, 400);
  });
});
