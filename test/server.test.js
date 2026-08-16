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
