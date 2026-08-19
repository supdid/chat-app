// ---- Firefight — 1v1 duel shooter, on foot only, first-person Three.js client. Server (server.js,
// the fg-* handlers) is authoritative for health/kills/round state; this file owns movement, camera,
// and cosmetic feedback, and just reports position (fg-pos) and shot attempts (fg-shoot) — same
// "trust the client's aim, let the server's loose range/cooldown check decide if it landed" model as
// Web Swing's sw-strike, just ranged instead of melee. Spectators share the exact same free-look
// camera/movement code as duelists; only shooting and taking damage are gated to slots 'a'/'b'.

const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// ==== DOM ====
const canvas = document.getElementById('game-canvas');
const menuEl = document.getElementById('menu');
const joinStatusEl = document.getElementById('join-status');
const startBtn = document.getElementById('start-btn');
const topPlayersPanel = document.getElementById('top-players-panel');
const topPlayersListEl = document.getElementById('top-players-list');
const unlockBannerEl = document.getElementById('unlock-banner');
const weaponPickerEl = document.getElementById('weapon-picker');
const weaponButtonsEl = document.getElementById('weapon-buttons');
const spectatorBanner = document.getElementById('spectator-banner');
const hudEl = document.getElementById('hud');
const scoreNameA = document.getElementById('score-name-a');
const scoreNameB = document.getElementById('score-name-b');
const scoreAEl = document.getElementById('score-a');
const scoreBEl = document.getElementById('score-b');
const roundTimerEl = document.getElementById('round-timer');
const healthFillEl = document.getElementById('health-fill');
const healthNumEl = document.getElementById('health-num');
const weaponHudEl = document.getElementById('weapon-hud');
const killFeedEl = document.getElementById('kill-feed');
const roundBannerEl = document.getElementById('round-banner');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardOverlay = document.getElementById('leaderboard-overlay');
const leaderboardCloseBtn = document.getElementById('leaderboard-close-btn');
const leaderboardListEl = document.getElementById('leaderboard-list');
const matchendOverlay = document.getElementById('matchend-overlay');
const matchendTextEl = document.getElementById('matchend-text');
const rematchBtn = document.getElementById('rematch-btn');
const crosshairEl = document.getElementById('crosshair');
const damageFlashEl = document.getElementById('damage-flash');
const touchControlsEl = document.getElementById('touch-controls');
const touchWeaponButtonsEl = document.getElementById('touch-weapon-buttons');
const touchAimBtn = document.getElementById('touch-aim');
const touchFireBtn = document.getElementById('touch-fire');
const touchJumpBtn = document.getElementById('touch-jump');

if (isTouchDevice) {
  document.getElementById('controls-list-desktop').classList.add('hidden');
  document.getElementById('controls-list-touch').classList.remove('hidden');
  touchControlsEl.classList.remove('hidden');
}

// ==== Room / identity (same ?room=&name= convention every minigame link uses) ====
const urlParams = new URLSearchParams(location.search);
const roomCode = urlParams.get('room');
const playerName = (urlParams.get('name') || 'Player').slice(0, 30);
if (roomCode) {
  document.getElementById('back-link').href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(playerName)}`;
}

// ==== Sound (synthesized, no asset files — same approach as Web Swing) ====
let audioCtx = null;
let soundOn = localStorage.getItem('firefight_sound_muted') !== '1';
soundToggleBtn.textContent = soundOn ? '🔊' : '🔇';
soundToggleBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  localStorage.setItem('firefight_sound_muted', soundOn ? '0' : '1');
  soundToggleBtn.textContent = soundOn ? '🔊' : '🔇';
});
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function blip(kind) {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  const presets = {
    shoot: { type: 'square', f0: 620, f1: 180, g: 0.12, dur: 0.08 },
    sniper: { type: 'sawtooth', f0: 900, f1: 120, g: 0.2, dur: 0.18 },
    hit: { type: 'triangle', f0: 500, f1: 900, g: 0.08, dur: 0.06 },
    hurt: { type: 'square', f0: 220, f1: 90, g: 0.15, dur: 0.16 },
    death: { type: 'sawtooth', f0: 480, f1: 60, g: 0.18, dur: 0.5 },
    jump: { type: 'square', f0: 220, f1: 440, g: 0.06, dur: 0.09 },
    headshot: { type: 'triangle', f0: 1400, f1: 300, g: 0.22, dur: 0.14 },
  };
  const p = presets[kind];
  if (!p) return;
  osc.type = p.type;
  osc.frequency.setValueAtTime(p.f0, now);
  if (p.f1 !== p.f0) osc.frequency.exponentialRampToValueAtTime(p.f1, now + p.dur * 0.75);
  gain.gain.setValueAtTime(p.g, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + p.dur);
  osc.start(now);
  osc.stop(now + p.dur + 0.02);
}
function playSound(kind) {
  if (soundOn) blip(kind);
}

// ==== Arena ====
const ARENA_HALF = 40; // was 24 — a full palace courtyard, not a small arena
const EYE_HEIGHT = 1.6;
const BASE_FOV = 75;
const MOVE_SPEED = 6.5;
const PLAYER_RADIUS = 0.4;
const SPAWN_A = { x: -24, y: 0, z: 0, yaw: -Math.PI / 2 };
const SPAWN_B = { x: 24, y: 0, z: 0, yaw: Math.PI / 2 };
// Just south of the fountain, facing north toward it — where every fresh join/reconnect lands
// before a round assigns a real duel spawn point (see the fg-init handler).
const LOBBY_SPAWN = { x: 0, y: 0, z: 4, yaw: Math.PI };
function spawnFor(slot) {
  return slot === 'a' ? SPAWN_A : SPAWN_B;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

let scene, camera, renderer;
const obstacles = []; // { box: THREE.Box3, height } — height is duplicated from box.max.y for cheap access in the hot per-frame collision/standing checks below

function addObstacle(x, z, w, h, d, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color }));
  mesh.position.set(x, h / 2, z);
  scene.add(mesh);
  obstacles.push({
    box: new THREE.Box3(new THREE.Vector3(x - w / 2, 0, z - d / 2), new THREE.Vector3(x + w / 2, h, z + d / 2)),
    height: h,
  });
}

// Round palace column — a cylinder mesh visually, but collision still uses the same axis-aligned
// box every other obstacle does (the movement/collision code is AABB-only); a square footprint
// close to the cylinder's own diameter is visually unnoticeable at this scale and avoids adding a
// second collision-shape type for one prop.
function addPillar(x, z, radius, height, color) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.15, height, 12), new THREE.MeshStandardMaterial({ color }));
  mesh.position.set(x, height / 2, z);
  scene.add(mesh);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.35, radius * 1.35, radius * 0.4, 12), new THREE.MeshStandardMaterial({ color }));
  cap.position.set(x, height + radius * 0.2, z);
  scene.add(cap);
  const half = radius * 1.15;
  obstacles.push({
    box: new THREE.Box3(new THREE.Vector3(x - half, 0, z - half), new THREE.Vector3(x + half, height, z + half)),
    height,
  });
}

function initScene() {
  scene = new THREE.Scene();
  // Warm cream/gold palace courtyard instead of the old dark industrial-arena tone.
  scene.background = new THREE.Color(0xe8dcc5);
  scene.fog = new THREE.Fog(0xe8dcc5, 45, 110);

  camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.rotation.order = 'YXZ';

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene.add(new THREE.HemisphereLight(0xfff2d9, 0x8a7550, 1.0));
  const dir = new THREE.DirectionalLight(0xffe9c2, 1.0);
  dir.position.set(25, 40, 15);
  scene.add(dir);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2),
    new THREE.MeshStandardMaterial({ color: 0xe4d9bf })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Tall cream marble perimeter walls — well above the ~2.5-unit jump apex, so (as before) they
  // stay permanently impassable with no special-casing needed.
  const wallColor = 0xcbb994, wallH = 8;
  addObstacle(0, -ARENA_HALF, ARENA_HALF * 2, wallH, 1, wallColor);
  addObstacle(0, ARENA_HALF, ARENA_HALF * 2, wallH, 1, wallColor);
  addObstacle(-ARENA_HALF, 0, 1, wallH, ARENA_HALF * 2, wallColor);
  addObstacle(ARENA_HALF, 0, 1, wallH, ARENA_HALF * 2, wallColor);

  // Colonnade ring around the plaza — a columned courtyard, not a solid wall; gaps between
  // adjacent pillars are 5+ units, plenty of room to walk or shoot through.
  const pillarColor = 0xe2d3ab;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    addPillar(Math.cos(angle) * 9, Math.sin(angle) * 9, 0.6, 4.5, pillarColor);
  }

  // Mid-field pillar cover at the four diagonals — far enough from both spawns (±24,0) and each
  // other to leave real sightlines and maneuvering room, not a maze.
  [[16, 16], [16, -16], [-16, 16], [-16, -16]].forEach(([x, z]) => addPillar(x, z, 0.7, 5, pillarColor));

  // A pair of shorter pillars near each spawn's flanks for immediate cover options, well clear of
  // the spawn point itself.
  [[-30, 10], [-30, -10], [30, 10], [30, -10]].forEach(([x, z]) => addPillar(x, z, 0.6, 4.5, pillarColor));

  // Low garden hedges (jumpable, same as the old cover boxes) along the north/south ends only —
  // the east/west spawn line stays clear.
  const hedgeColor = 0x4a7a4a, hedgeH = 1.8;
  addObstacle(0, -30, 7, hedgeH, 1.6, hedgeColor);
  addObstacle(0, 30, 7, hedgeH, 1.6, hedgeColor);

  addLobbyDecor();
  window.addEventListener('resize', onResize);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ---- Lobby decoration — purely cosmetic (not in `obstacles`, so nothing here blocks movement or
// shots). The plaza circle sits at the arena's origin, which is also where a fresh connection's
// player.x/y/z starts before a round assigns a real spawn point, so duelists and spectators
// naturally end up standing in/near it while waiting — no extra "walk to the lobby" logic needed.
const balloons = []; // { mesh, baseY, phase } — bobbed each frame in the main loop

function makePlaza() {
  // Warm pink-white marble pool floor with a soft glow, matching the palace's cream/gold palette
  // instead of the old aqua-blue tone.
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(6, 40),
    new THREE.MeshStandardMaterial({ color: 0xf0dce2, emissive: 0xf5c9d6, emissiveIntensity: 0.12 })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02; // just above the ground plane, avoids z-fighting
  scene.add(plaza);

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(5.8, 6.3, 40),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, side: THREE.DoubleSide })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.03;
  scene.add(rim);
}

function makePalmTree(x, z) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.25, 4, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2f })
  );
  trunk.position.y = 2;
  trunk.rotation.z = 0.08;
  group.add(trunk);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f9c4a });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 4), frondMat);
    frond.position.set(Math.cos(angle) * 0.6, 4.1, Math.sin(angle) * 0.6);
    frond.rotation.x = Math.PI / 2.3;
    frond.rotation.z = angle;
    group.add(frond);
  }
  group.position.set(x, 0, z);
  scene.add(group);
}

function makeBanner(x, z, rotY, color) {
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.9),
    new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide })
  );
  banner.position.set(x, 5, z);
  banner.rotation.y = rotY;
  scene.add(banner);
}

function makeBalloon(x, z, color) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshStandardMaterial({ color }));
  const baseY = 5.4 + Math.random() * 0.6;
  mesh.position.set(x, baseY, z);
  scene.add(mesh);
  balloons.push({ mesh, baseY, phase: Math.random() * Math.PI * 2 });
}

function addLobbyDecor() {
  makePlaza();
  const cornerOffset = ARENA_HALF - 6; // scales with ARENA_HALF, not hardcoded to the old 24-unit arena
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => makePalmTree(sx * cornerOffset, sz * cornerOffset));
  const bannerColors = [0xffcf4a, 0x3b7dff];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    makeBanner(Math.cos(angle) * (ARENA_HALF - 0.6), Math.sin(angle) * (ARENA_HALF - 0.6), angle + Math.PI / 2, bannerColors[i % 2]);
  }
  const balloonColors = [0xff5a5a, 0xffe066, 0x5ad1ff, 0x9dffc9];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    makeBalloon(Math.cos(angle) * (ARENA_HALF - 2), Math.sin(angle) * (ARENA_HALF - 2), balloonColors[i % balloonColors.length]);
  }
}

// y is the player's current feet height — an obstacle only blocks horizontal movement while the
// player is below its top surface. Once a jump carries them above it (see tickVertical below),
// they're free to move over its footprint, same as clearing real cover.
function collides(x, z, y) {
  for (const o of obstacles) {
    if (y >= o.height - 0.05) continue;
    const b = o.box;
    if (x + PLAYER_RADIUS > b.min.x && x - PLAYER_RADIUS < b.max.x &&
        z + PLAYER_RADIUS > b.min.z && z - PLAYER_RADIUS < b.max.z) return true;
  }
  return false;
}

// The height of whatever's directly underfoot at (x, z) — the ground (0) or the top of any
// obstacle whose footprint contains this point, whichever is higher (so standing at the edge of
// two overlapping footprints doesn't clip into the shorter one).
function groundHeightAt(x, z) {
  let surface = 0;
  for (const o of obstacles) {
    const b = o.box;
    if (x + PLAYER_RADIUS > b.min.x && x - PLAYER_RADIUS < b.max.x &&
        z + PLAYER_RADIUS > b.min.z && z - PLAYER_RADIUS < b.max.z) {
      surface = Math.max(surface, o.height);
    }
  }
  return surface;
}

// ==== Avatars ====
function makeNameSprite(name) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(name).slice(0, 16), 128, 32);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  sprite.scale.set(2, 0.5, 1);
  sprite.position.y = 2.3;
  return sprite;
}

function makeAvatar(name) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xff5a3c });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 8), mat);
  body.position.y = 1.0;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), mat);
  head.position.y = 1.85;
  group.add(head);
  group.add(makeNameSprite(name));
  scene.add(group);
  return { group, head };
}

const remotePlayers = new Map(); // id -> { group, head, target: {x,y,z,yaw} }
function addRemotePlayer(id, name, pos) {
  if (id === myId || remotePlayers.has(id)) return;
  const slot = id === slotAId ? 'a' : id === slotBId ? 'b' : null;
  if (!slot) return; // spectators aren't given a 3D presence
  const sp = pos || spawnFor(slot);
  const { group, head } = makeAvatar(name);
  group.position.set(sp.x, sp.y, sp.z);
  group.rotation.y = sp.yaw;
  remotePlayers.set(id, { group, head, target: { x: sp.x, y: sp.y, z: sp.z, yaw: sp.yaw } });
}
function removeRemotePlayer(id) {
  const rp = remotePlayers.get(id);
  if (!rp) return;
  scene.remove(rp.group);
  remotePlayers.delete(id);
}

// ==== Local player + input ====
const player = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vy: 0, grounded: true, health: 150, alive: false, weapon: 'pistol' };
const move = { f: 0, r: 0 };
const keys = new Set();
let pointerLocked = false;
let aiming = false;
let lastShotAt = 0;

// Tuned so the jump apex (vy0^2 / (2*g) ≈ 2.5 units) clears the arena's cover boxes (1.6-1.8
// units tall) with comfortable margin, while the perimeter walls (6 units) stay permanently
// impassable — no special-casing needed, a normal jump just can never reach that high.
const JUMP_SPEED = 9;
const GRAVITY = 16;

function tickMovement(dt) {
  const yaw = player.yaw;
  const fwd = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  let dx = fwd.x * move.f + right.x * move.r;
  let dz = fwd.z * move.f + right.z * move.r;
  const len = Math.hypot(dx, dz);
  if (len > 1) { dx /= len; dz /= len; }
  const nx = player.x + dx * MOVE_SPEED * dt;
  const nz = player.z + dz * MOVE_SPEED * dt;
  if (!collides(nx, player.z, player.y)) player.x = clamp(nx, -ARENA_HALF + 1, ARENA_HALF - 1);
  if (!collides(player.x, nz, player.y)) player.z = clamp(nz, -ARENA_HALF + 1, ARENA_HALF - 1);
}

function tickVertical(dt) {
  player.vy -= GRAVITY * dt;
  let ny = player.y + player.vy * dt;
  const surface = groundHeightAt(player.x, player.z);
  if (ny <= surface) { ny = surface; player.vy = 0; player.grounded = true; }
  else { player.grounded = false; }
  player.y = ny;
}

function tryJump() {
  if (!player.grounded) return;
  if (!(mySlot === 'spectator' || phase !== 'active' || player.alive)) return;
  player.vy = JUMP_SPEED;
  player.grounded = false;
  playSound('jump');
}

function updateCameraFromPlayer() {
  camera.position.set(player.x, player.y + EYE_HEIGHT, player.z);
  camera.rotation.x = player.pitch;
  camera.rotation.y = player.yaw;
  camera.rotation.z = 0;
}

function updateFov(dt) {
  const targetFov = aiming ? (player.weapon === 'sniper' ? 20 : 50) : BASE_FOV;
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
  camera.updateProjectionMatrix();
}

function readKeyboardMove() {
  if (isTouchDevice) return;
  move.f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  move.r = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
}

function clearHeldInput() {
  move.f = 0; move.r = 0; aiming = false; keys.clear();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) clearHeldInput(); });
window.addEventListener('blur', clearHeldInput);

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Digit1') selectWeapon('pistol');
  if (e.code === 'Digit2') selectWeapon('rifle');
  if (e.code === 'Digit3') selectWeapon('sniper');
  if (e.code === 'Space') { e.preventDefault(); tryJump(); }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

canvas.addEventListener('click', () => {
  if (isTouchDevice) return;
  if (!menuEl.classList.contains('hidden')) return;
  if (!matchendOverlay.classList.contains('hidden')) return;
  if (!pointerLocked) canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === canvas; });

const MOUSE_SENS = 0.0022;
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  player.yaw -= e.movementX * MOUSE_SENS;
  player.pitch = clamp(player.pitch - e.movementY * MOUSE_SENS, -1.4, 1.4);
});
canvas.addEventListener('mousedown', (e) => {
  if (isTouchDevice || !pointerLocked) return;
  if (e.button === 0) attemptShoot();
  else if (e.button === 2) aiming = true;
});
canvas.addEventListener('mouseup', (e) => { if (e.button === 2) aiming = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

if (isTouchDevice) {
  const joystickBase = document.getElementById('touch-joystick');
  const joystickKnob = document.getElementById('touch-joystick-knob');
  const JOYSTICK_RADIUS = 45;
  let joystickTouchId = null;
  function updateJoystick(t) {
    const rect = joystickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > JOYSTICK_RADIUS) { dx = (dx / dist) * JOYSTICK_RADIUS; dy = (dy / dist) * JOYSTICK_RADIUS; }
    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    move.r = dx / JOYSTICK_RADIUS;
    move.f = -dy / JOYSTICK_RADIUS;
  }
  function resetJoystick() {
    joystickTouchId = null;
    move.f = 0; move.r = 0;
    joystickKnob.style.transform = 'translate(0px, 0px)';
  }
  joystickBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (joystickTouchId !== null) return;
    const t = e.changedTouches[0];
    joystickTouchId = t.identifier;
    updateJoystick(t);
  }, { passive: false });
  joystickBase.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === joystickTouchId) updateJoystick(t);
  }, { passive: false });
  window.addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (t.identifier === joystickTouchId) resetJoystick(); });
  window.addEventListener('touchcancel', (e) => { for (const t of e.changedTouches) if (t.identifier === joystickTouchId) resetJoystick(); });

  const TOUCH_LOOK_SENSITIVITY = 0.005;
  let lookTouchId = null, lastLookX = 0, lastLookY = 0;
  canvas.addEventListener('touchstart', (e) => {
    if (!menuEl.classList.contains('hidden')) return;
    if (lookTouchId !== null) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    lookTouchId = t.identifier;
    lastLookX = t.clientX; lastLookY = t.clientY;
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== lookTouchId) continue;
      e.preventDefault();
      const dx = t.clientX - lastLookX, dy = t.clientY - lastLookY;
      lastLookX = t.clientX; lastLookY = t.clientY;
      player.yaw -= dx * TOUCH_LOOK_SENSITIVITY;
      player.pitch = clamp(player.pitch - dy * TOUCH_LOOK_SENSITIVITY, -1.4, 1.4);
    }
  }, { passive: false });
  function releaseLookTouch(e) { for (const t of e.changedTouches) if (t.identifier === lookTouchId) lookTouchId = null; }
  canvas.addEventListener('touchend', releaseLookTouch);
  canvas.addEventListener('touchcancel', releaseLookTouch);

  touchFireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); attemptShoot(); }, { passive: false });
  touchAimBtn.addEventListener('touchstart', (e) => { e.preventDefault(); aiming = true; }, { passive: false });
  touchAimBtn.addEventListener('touchend', (e) => { e.preventDefault(); aiming = false; });
  touchAimBtn.addEventListener('touchcancel', () => { aiming = false; });
  touchJumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); tryJump(); }, { passive: false });
}

// ==== Weapons ====
let weapons = {}; // populated from fg-init: { pistol: {damage,cooldownMs,range,unlockKills}, ... }
let maxHealth = 150; // overwritten from fg-init's maxHealth once connected; this default only matters for the brief pre-connect render
let totalKills = 0; // career total for this room (see fg_stats/bumpFgKills in server.js/db.js) — what weapon unlocks are keyed to, not this match's kill count
let unlockedWeapons = ['pistol']; // server-computed from totalKills; also the real enforcement (see fg-select-weapon in server.js) — this is only used for the UI here
function isUnlocked(key) {
  return unlockedWeapons.includes(key);
}
function buildWeaponButtons() {
  const order = ['pistol', 'rifle', 'sniper'];
  const labels = { pistol: '🔫 Pistol', rifle: '🔫 Rifle', sniper: '🎯 Sniper' };
  [weaponButtonsEl, touchWeaponButtonsEl].forEach((container) => {
    container.innerHTML = '';
    order.forEach((key) => {
      if (!weapons[key]) return;
      const unlocked = isUnlocked(key);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'weapon-btn' + (key === player.weapon ? ' active' : '') + (unlocked ? '' : ' locked');
      btn.dataset.weapon = key;
      const need = weapons[key].unlockKills || 0;
      btn.innerHTML = container === touchWeaponButtonsEl
        ? `<span>${unlocked ? labels[key].split(' ')[0] : '🔒'}</span>`
        : unlocked
        ? `<span>${labels[key]}</span><span>${weapons[key].damage} dmg</span>`
        : `<span>${labels[key]}</span><span>🔒 ${need} kills (${totalKills}/${need})</span>`;
      btn.addEventListener('click', () => selectWeapon(key));
      container.appendChild(btn);
    });
  });
}
function selectWeapon(key) {
  if (!weapons[key] || !isUnlocked(key)) return;
  player.weapon = key;
  document.querySelectorAll('.weapon-btn').forEach((b) => b.classList.toggle('active', b.dataset.weapon === key));
  updateWeaponHud();
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'fg-select-weapon', weapon: key }));
}
function updateWeaponHud() {
  weaponHudEl.textContent = player.weapon ? player.weapon[0].toUpperCase() + player.weapon.slice(1) : '';
}

// Reused across shots rather than allocated fresh each time — this only ever needs a straight
// down-the-crosshair cast (screen center), never a per-pixel one.
const shootRaycaster = new THREE.Raycaster();
const CROSSHAIR_NDC = new THREE.Vector2(0, 0);

// Sniper-only: a real raycast from the crosshair against every visible opponent's head hitbox,
// same aim the player is actually looking at rather than a proximity guess. The server ultimately
// decides whether the shot lands at all (range/cooldown/alive-state) — this only flags *which*
// damage number to ask for if it does, same loose "trust the client's aim" model the rest of this
// game's combat already uses.
function computeHeadshot() {
  if (player.weapon !== 'sniper') return false;
  const heads = [...remotePlayers.values()].map((rp) => rp.head);
  if (!heads.length) return false;
  shootRaycaster.setFromCamera(CROSSHAIR_NDC, camera);
  return shootRaycaster.intersectObjects(heads, false).length > 0;
}

function attemptShoot() {
  if (mySlot !== 'a' && mySlot !== 'b') return;
  if (phase !== 'active' || !player.alive) return;
  const w = weapons[player.weapon];
  if (!w) return;
  const now = performance.now();
  if (now - lastShotAt < w.cooldownMs) return;
  lastShotAt = now;
  const headshot = computeHeadshot();
  playSound(headshot ? 'headshot' : player.weapon === 'sniper' ? 'sniper' : 'shoot');
  crosshairEl.classList.remove('fired');
  void crosshairEl.offsetWidth;
  crosshairEl.classList.add('fired');
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'fg-shoot', headshot }));
}

// ==== HUD helpers ====
function renderHealth() {
  const hp = clamp(player.health, 0, maxHealth);
  const pct = maxHealth > 0 ? (hp / maxHealth) * 100 : 0;
  healthFillEl.style.width = pct + '%';
  healthFillEl.classList.toggle('low', pct <= 30);
  healthNumEl.textContent = Math.round(hp);
}
function flashDamage() {
  damageFlashEl.classList.remove('show');
  void damageFlashEl.offsetWidth;
  damageFlashEl.classList.add('show');
}
let bannerTimer = null;
function showRoundBanner(text) {
  roundBannerEl.textContent = text;
  roundBannerEl.classList.remove('hidden');
  roundBannerEl.style.animation = 'none';
  void roundBannerEl.offsetWidth;
  roundBannerEl.style.animation = '';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => roundBannerEl.classList.add('hidden'), 2300);
}
function addKillFeed(text) {
  const div = document.createElement('div');
  div.className = 'kill-feed-entry';
  div.textContent = text;
  killFeedEl.appendChild(div);
  setTimeout(() => div.remove(), 3600);
  while (killFeedEl.children.length > 4) killFeedEl.removeChild(killFeedEl.firstChild);
}
function updateRoundTimer() {
  if (phase === 'active' && roundEndsAt) {
    roundTimerEl.textContent = `${Math.max(0, Math.ceil((roundEndsAt - Date.now()) / 1000))}s`;
  } else if (phase === 'intermission') {
    roundTimerEl.textContent = 'Next round…';
  } else {
    roundTimerEl.textContent = '–';
  }
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function renderLeaderboard(scores) {
  leaderboardListEl.innerHTML = '';
  if (!scores.length) {
    leaderboardListEl.innerHTML = '<li>No scores yet — be the first!</li>';
    return;
  }
  scores.forEach((s) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(s.name)}</span><span>${s.score} kills</span>`;
    leaderboardListEl.appendChild(li);
  });
  renderTopPlayersPanel(scores);
}
// The lobby's small always-visible panel — same data as the full leaderboard modal above, just
// the top 3 and no click required to see it.
function renderTopPlayersPanel(scores) {
  topPlayersPanel.classList.remove('hidden');
  topPlayersListEl.innerHTML = '';
  if (!scores.length) {
    topPlayersListEl.innerHTML = '<li>No scores yet — be the first!</li>';
    return;
  }
  scores.slice(0, 3).forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span><span class="rank">#${i + 1}</span>${escapeHtml(s.name)}</span><span>${s.score}</span>`;
    topPlayersListEl.appendChild(li);
  });
}
// The screenshot's "Unlock your new weapon!" callout, wired to the real progress from fg-init/
// fg-unlock-progress rather than a shop prompt — shows the next still-locked weapon and how close
// the player is, or hides entirely once everything is unlocked.
function updateUnlockBanner() {
  const order = ['pistol', 'rifle', 'sniper'];
  const labels = { rifle: 'Rifle', sniper: 'Sniper' };
  const next = order.find((key) => weapons[key] && !unlockedWeapons.includes(key));
  if (!next) { unlockBannerEl.classList.add('hidden'); return; }
  const need = weapons[next].unlockKills || 0;
  unlockBannerEl.textContent = `🔓 Unlock ${labels[next] || next}: ${totalKills}/${need} kills`;
  unlockBannerEl.classList.remove('hidden');
}
const knownNames = new Map();
function updateScoreboardNames() {
  scoreNameA.textContent = (slotAId && knownNames.get(slotAId)) || 'A';
  scoreNameB.textContent = (slotBId && knownNames.get(slotBId)) || 'B';
}
function updateScoreboard() {
  scoreAEl.textContent = scoreA;
  scoreBEl.textContent = scoreB;
  updateScoreboardNames();
}
function refreshMenuForState() {
  weaponPickerEl.classList.remove('hidden');
  updateUnlockBanner();
  if (mySlot === 'spectator') {
    joinStatusEl.textContent = 'Waiting for a duel slot to open…';
    startBtn.classList.add('hidden');
    spectatorBanner.classList.remove('hidden');
    return;
  }
  spectatorBanner.classList.add('hidden');
  const bothFilled = !!(slotAId && slotBId);
  if (phase === 'waiting') {
    joinStatusEl.textContent = bothFilled ? 'Both duelists ready.' : 'Waiting for an opponent to join…';
    startBtn.classList.toggle('hidden', !bothFilled);
  } else {
    joinStatusEl.textContent = 'Duel in progress…';
    startBtn.classList.add('hidden');
  }
}

startBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'fg-start' }));
});
rematchBtn.addEventListener('click', () => {
  matchendOverlay.classList.add('hidden');
  menuEl.classList.remove('hidden');
  refreshMenuForState();
});
leaderboardBtn.addEventListener('click', () => {
  leaderboardOverlay.classList.remove('hidden');
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'fg-leaderboard', code: roomCode }));
});
leaderboardCloseBtn.addEventListener('click', () => leaderboardOverlay.classList.add('hidden'));

// ==== Networking ====
let ws = null;
let myId = null;
let mySlot = 'spectator';
let slotAId = null, slotBId = null;
let phase = 'waiting';
let scoreA = 0, scoreB = 0;
let roundNumber = 0;
let roundEndsAt = null;
let roomFull = false;

function connectFg() {
  if (!roomCode) { joinStatusEl.textContent = 'No room code — open this from the room menu.'; return; }
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ type: 'fg-join', code: roomCode, name: playerName }));
  });
  ws.addEventListener('message', (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (err) {
      reportClientError('Malformed WS frame: ' + err.message, err.stack);
      return;
    }
    handleMessage(data);
  });
  ws.addEventListener('close', () => {
    for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id);
    ws = null;
    if (!roomFull) {
      joinStatusEl.textContent = 'Disconnected — reconnecting…';
      menuEl.classList.remove('hidden');
      startBtn.classList.add('hidden');
      setTimeout(connectFg, 1500);
    }
  });
}

function handleMessage(data) {
  switch (data.type) {
    case 'fg-init': {
      myId = data.id;
      mySlot = data.role;
      slotAId = data.slotAId;
      slotBId = data.slotBId;
      phase = data.phase;
      scoreA = data.scoreA; scoreB = data.scoreB;
      roundNumber = data.roundNumber;
      roundEndsAt = data.endsAt;
      weapons = data.weapons;
      maxHealth = data.maxHealth;
      totalKills = data.totalKills || 0;
      unlockedWeapons = data.unlockedWeapons || ['pistol'];
      if (!isUnlocked(player.weapon)) player.weapon = 'pistol';
      // Every fresh fg-init — a first join or a reconnect — drops the player back in the lobby
      // plaza, not wherever they happened to be standing before. player.x/y/z is a module-level
      // var that otherwise survives a reconnect's fresh WebSocket, so without this a disconnect
      // mid-wander would resume exactly where they left off instead of back at the lobby.
      player.x = LOBBY_SPAWN.x; player.y = LOBBY_SPAWN.y; player.z = LOBBY_SPAWN.z; player.yaw = LOBBY_SPAWN.yaw;
      player.pitch = 0; player.vy = 0; player.grounded = true;
      buildWeaponButtons();
      updateWeaponHud();
      data.players.forEach((p) => {
        knownNames.set(p.id, p.name);
        if (p.id !== myId) addRemotePlayer(p.id, p.name, { x: p.x, y: p.y, z: p.z, yaw: p.yaw });
      });
      canvas.classList.remove('hidden');
      hudEl.classList.remove('hidden');
      crosshairEl.classList.remove('hidden');
      updateScoreboard();
      refreshMenuForState();
      // Populates the lobby's always-visible top-players panel without waiting for a click on the
      // full leaderboard button — same request, renderLeaderboard() updates both from one result.
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'fg-leaderboard', code: roomCode }));
      break;
    }
    case 'fg-full': {
      roomFull = true;
      joinStatusEl.textContent = 'This duel room is full.';
      if (ws) ws.close();
      break;
    }
    case 'fg-player-joined': {
      knownNames.set(data.id, data.name);
      if (data.role === 'a') slotAId = data.id;
      if (data.role === 'b') slotBId = data.id;
      addRemotePlayer(data.id, data.name);
      updateScoreboard();
      refreshMenuForState();
      break;
    }
    case 'fg-slot-filled': {
      knownNames.set(data.id, data.name);
      if (data.slot === 'a') slotAId = data.id;
      if (data.slot === 'b') slotBId = data.id;
      if (data.id === myId) {
        mySlot = data.slot;
      } else {
        addRemotePlayer(data.id, data.name);
      }
      // This message only ever fires from server.js's leaveFg — a duelist just left, which always
      // resets the match to 'waiting' server-side (win a real fight, so mid-round state can't
      // carry over to whoever's newly paired up). Mirror that here and re-show the menu; without
      // it, everyone still connected was stuck looking at a dead arena with the menu (and its
      // Start button) hidden from the last round-start, no way to begin a new match short of a
      // full page reload.
      phase = 'waiting';
      scoreA = 0; scoreB = 0; roundNumber = 0;
      matchendOverlay.classList.add('hidden');
      menuEl.classList.remove('hidden');
      updateScoreboard();
      refreshMenuForState();
      break;
    }
    case 'fg-player-left': {
      // Checked before slotAId/slotBId are cleared below, since a promotion (fg-slot-filled,
      // handled above) already reassigned them if a spectator was waiting to fill the gap — this
      // still needs to catch the no-replacement-available case that fg-slot-filled never fires for.
      const wasDuelist = data.id === slotAId || data.id === slotBId;
      removeRemotePlayer(data.id);
      if (data.id === slotAId) slotAId = null;
      if (data.id === slotBId) slotBId = null;
      if (wasDuelist) {
        phase = 'waiting';
        scoreA = 0; scoreB = 0; roundNumber = 0;
        matchendOverlay.classList.add('hidden');
        menuEl.classList.remove('hidden');
      }
      updateScoreboard();
      refreshMenuForState();
      break;
    }
    case 'fg-pos': {
      const rp = remotePlayers.get(data.id);
      if (rp) { rp.target.x = data.x; rp.target.y = data.y; rp.target.z = data.z; rp.target.yaw = data.yaw; }
      break;
    }
    case 'fg-round-start': {
      phase = 'active';
      roundNumber = data.roundNumber;
      roundEndsAt = data.endsAt;
      scoreA = data.scoreA; scoreB = data.scoreB;
      player.health = maxHealth; player.alive = true;
      renderHealth();
      menuEl.classList.add('hidden');
      matchendOverlay.classList.add('hidden');
      if (mySlot === 'a' || mySlot === 'b') {
        const sp = spawnFor(mySlot);
        player.x = sp.x; player.y = sp.y; player.z = sp.z; player.yaw = sp.yaw; player.pitch = 0;
        player.vy = 0; player.grounded = true;
        sendPos(true);
      }
      const oppId = mySlot === 'a' ? slotBId : mySlot === 'b' ? slotAId : null;
      if (oppId) {
        const oppSlot = oppId === slotAId ? 'a' : 'b';
        const sp = spawnFor(oppSlot);
        const rp = remotePlayers.get(oppId);
        if (rp) {
          rp.target.x = sp.x; rp.target.y = sp.y; rp.target.z = sp.z; rp.target.yaw = sp.yaw;
          rp.group.position.set(sp.x, sp.y, sp.z);
          rp.group.rotation.y = sp.yaw;
        }
      }
      updateScoreboard();
      showRoundBanner(`Round ${roundNumber}`);
      break;
    }
    case 'fg-hit': {
      if (data.targetId === myId) {
        player.health = data.health;
        renderHealth();
        flashDamage();
        playSound('hurt');
      } else if (data.byId === myId) {
        playSound(data.headshot ? 'headshot' : 'hit');
        if (data.headshot) addKillFeed('🎯 Headshot!');
      } else {
        playSound('hit');
      }
      break;
    }
    case 'fg-death': {
      const hs = data.headshot ? ' (Headshot!)' : '';
      if (data.id === myId) {
        player.alive = false;
        player.health = 0;
        renderHealth();
        addKillFeed(`💀 Eliminated by ${knownNames.get(data.killedBy) || 'your opponent'}${hs}`);
        playSound('death');
      } else if (data.killedBy === myId) {
        addKillFeed(`🎯 You eliminated ${knownNames.get(data.id) || 'your opponent'}!${hs}`);
      } else {
        addKillFeed(`${knownNames.get(data.killedBy) || 'Someone'} eliminated ${knownNames.get(data.id) || 'someone'}${hs}`);
      }
      break;
    }
    case 'fg-round-end': {
      phase = 'intermission';
      scoreA = data.scoreA; scoreB = data.scoreB;
      updateScoreboard();
      const winnerName = data.winnerSlot === 'a' ? scoreNameA.textContent : data.winnerSlot === 'b' ? scoreNameB.textContent : null;
      showRoundBanner(winnerName ? `${winnerName} wins the round!` : 'Round over — time ran out');
      break;
    }
    case 'fg-match-end': {
      phase = 'waiting';
      const winnerName = data.winner === 'a' ? scoreNameA.textContent : scoreNameB.textContent;
      const won = data.winner === mySlot;
      matchendTextEl.textContent = (mySlot !== 'a' && mySlot !== 'b')
        ? `${winnerName} wins the match! (${data.scoreA}-${data.scoreB})`
        : (won ? `You win the match! (${data.scoreA}-${data.scoreB})` : `${winnerName} wins the match. (${data.scoreA}-${data.scoreB})`);
      rematchBtn.classList.toggle('hidden', mySlot !== 'a' && mySlot !== 'b');
      matchendOverlay.classList.remove('hidden');
      // Back to the lobby plaza once the match is over, same as a fresh join — otherwise everyone
      // stays standing wherever the final round left them (out at a duel spawn point) instead of
      // back at the fountain for the next one.
      player.x = LOBBY_SPAWN.x; player.y = LOBBY_SPAWN.y; player.z = LOBBY_SPAWN.z; player.yaw = LOBBY_SPAWN.yaw;
      player.pitch = 0; player.vy = 0; player.grounded = true;
      sendPos(true);
      break;
    }
    case 'fg-leaderboard-result': {
      renderLeaderboard(data.scores || []);
      break;
    }
    case 'fg-unlock-progress': {
      const newlyUnlocked = (data.unlockedWeapons || []).filter((w) => !unlockedWeapons.includes(w));
      totalKills = data.totalKills;
      unlockedWeapons = data.unlockedWeapons || unlockedWeapons;
      buildWeaponButtons();
      updateUnlockBanner();
      const labels = { rifle: 'Rifle', sniper: 'Sniper' };
      newlyUnlocked.forEach((w) => { if (labels[w]) addKillFeed(`🔓 ${labels[w]} unlocked!`); });
      break;
    }
  }
}

let lastPosSent = 0;
function sendPos(force) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (mySlot !== 'a' && mySlot !== 'b') return;
  const now = performance.now();
  if (!force && now - lastPosSent < 100) return;
  lastPosSent = now;
  ws.send(JSON.stringify({ type: 'fg-pos', x: player.x, y: player.y, z: player.z, yaw: player.yaw }));
}

// ==== Main loop ====
let lastFrame = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  readKeyboardMove();
  const canMove = mySlot === 'spectator' || phase !== 'active' || player.alive;
  if (canMove) tickMovement(dt);
  tickVertical(dt);
  updateCameraFromPlayer();
  updateFov(dt);
  sendPos(false);

  for (const rp of remotePlayers.values()) {
    rp.group.position.x += (rp.target.x - rp.group.position.x) * 0.25;
    rp.group.position.y += (rp.target.y - rp.group.position.y) * 0.25;
    rp.group.position.z += (rp.target.z - rp.group.position.z) * 0.25;
    rp.group.rotation.y += (rp.target.yaw - rp.group.rotation.y) * 0.25;
  }
  for (const b of balloons) b.mesh.position.y = b.baseY + Math.sin(now / 1000 + b.phase) * 0.15;

  updateRoundTimer();
  renderer.render(scene, camera);
}

initScene();
requestAnimationFrame(loop);
connectFg();
