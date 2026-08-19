// Regression suite for server.js — run with `npm test`. Each `describe` block gets its own room
// code (prefixed by the block name) so tests can share one running server instance without
// interfering with each other's state. This consolidates the ad-hoc scratch-test scripts written
// (and thrown away) during this session's bug-hunt/feature work into something future sessions
// can just run instead of re-deriving from scratch.
'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { startTestServer, connectWs, send, waitFor, sleep, BASE_URL } = require('./helpers');

let server;
before(async () => { server = await startTestServer(); });
after(async () => { await server.stop(); });

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
    for (const path of ['/admin/errors', '/admin/reports', '/admin/patches']) {
      const noKeyRes = await fetch(`${BASE_URL}${path}`);
      assert.equal(noKeyRes.status, 401, `${path} without a key should 401`);
      const wrongKeyRes = await fetch(`${BASE_URL}${path}?key=definitely-not-the-real-key`);
      assert.equal(wrongKeyRes.status, 401, `${path} with a wrong key should 401`);
    }
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
