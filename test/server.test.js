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

// Mirrors server.js's own BB_MAP_IDS (Block Battle online-lobby map ids) — used only to assert a
// pre-match/pre-duel map vote actually resolved to one of the real ids, not to exercise the list
// itself (that's server.js's own concern). Keep in sync if that list ever changes.
const BB_MAP_IDS_FOR_TEST = [
  'office', 'office_night', 'office_alert',
  'warehouse_day', 'warehouse_dusk', 'warehouse_flood', 'warehouse_frost',
  'rooftop_day', 'rooftop_sunset', 'rooftop_night',
  'garage_a', 'garage_b', 'garage_c', 'garage_d',
  'plaza_day', 'plaza_rain', 'plaza_dusk',
  'gym_basketball', 'gym_volleyball', 'gym_boxing',
];

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

  test('reactions round-trip', async () => {
    const { ws } = await joinRoom('ReactHost');
    send(ws, { type: 'message', text: 'react to me' });
    const echoed = await waitFor(ws, (m) => m.type === 'message' && m.text === 'react to me');
    send(ws, { type: 'react', messageId: echoed.id, emoji: '👍' });
    const reacted = await waitFor(ws, (m) => m.type === 'reaction' && m.messageId === echoed.id);
    assert.equal(reacted.emoji, '👍');
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

describe('/export', () => {
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

  // sw-score was the one leaderboard-writing message with no submission cooldown at all, unlike
  // gw-complete/arcade-submit-score which both reuse ARCADE_SUBMIT_COOLDOWN_MS for exactly this.
  test('sw-score submissions are cooldown-throttled like every other leaderboard write', async () => {
    const ws = await connectWs();
    send(ws, { type: 'sw-join', code: 'SWSCORE1', name: 'Swinger' });
    await waitFor(ws, (m) => m.type === 'sw-init');

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

    const resolveRes = await fetch(`${BASE_URL}/admin/errors/${target.id}/resolve`, { method: 'POST', headers: adminAuth(adminKey) });
    assert.equal(resolveRes.status, 200);
    const afterResolve = await (await fetch(`${BASE_URL}/admin/errors`, { headers: adminAuth(adminKey) })).json();
    assert.equal(afterResolve.errors.find((e) => e.id === target.id).status, 'resolved');

    const dismissRes = await fetch(`${BASE_URL}/admin/errors/${target.id}/dismiss`, { method: 'POST', headers: adminAuth(adminKey) });
    assert.equal(dismissRes.status, 200);
    const afterDismiss = await (await fetch(`${BASE_URL}/admin/errors`, { headers: adminAuth(adminKey) })).json();
    assert.equal(afterDismiss.errors.find((e) => e.id === target.id).status, 'dismissed');
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

    const resolveRes = await fetch(`${BASE_URL}/admin/reports/${found.id}/resolve`, { method: 'POST', headers: adminAuth(adminKey) });
    assert.equal(resolveRes.status, 200);
    const afterResolve = await (await fetch(`${BASE_URL}/admin/reports`, { headers: adminAuth(adminKey) })).json();
    assert.equal(afterResolve.reports.find((r) => r.id === found.id).status, 'resolved');

    const dismissRes = await fetch(`${BASE_URL}/admin/reports/${found.id}/dismiss`, { method: 'POST', headers: adminAuth(adminKey) });
    assert.equal(dismissRes.status, 200);
    const afterDismiss = await (await fetch(`${BASE_URL}/admin/reports`, { headers: adminAuth(adminKey) })).json();
    assert.equal(afterDismiss.reports.find((r) => r.id === found.id).status, 'dismissed');

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
