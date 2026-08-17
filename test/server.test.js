// Regression suite for server.js — run with `npm test`. Each `describe` block gets its own room
// code (prefixed by the block name) so tests can share one running server instance without
// interfering with each other's state. This consolidates the ad-hoc scratch-test scripts written
// (and thrown away) during this session's bug-hunt/feature work into something future sessions
// can just run instead of re-deriving from scratch.
'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
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
    send(b, { type: 'sw-join', code: 'SWPVP1', name: 'Victim' });
    const bInit = await waitFor(b, (m) => m.type === 'sw-init');
    await waitFor(a, (m) => m.type === 'sw-player-joined');
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
    await sleep(300);
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

    send(p1, { type: 'tv-start' });
    await waitFor(p1, (m) => m.type === 'tv-question');
    await waitFor(p2, (m) => m.type === 'tv-question');

    send(p1, { type: 'tv-answer', choice: 0 });
    await waitFor(p1, (m) => m.type === 'tv-answer-ack');
    await sleep(150);

    // A "reconnect" is really just a fresh connection under the same name — tv-join mints a new
    // per-connection id every time, which is exactly the case this fix has to survive.
    const p1b = await connectWs();
    send(p1b, { type: 'tv-join', code, name: 'TvPlayer1' });
    await waitFor(p1b, (m) => m.type === 'tv-init');
    const question = await waitFor(p1b, (m) => m.type === 'tv-question');
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
