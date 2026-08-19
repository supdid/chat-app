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
const hitMarkerEl = document.getElementById('hit-marker');
const scopeOverlayEl = document.getElementById('scope-overlay');
const damageFlashEl = document.getElementById('damage-flash');
const lowHealthVignetteEl = document.getElementById('low-health-vignette');
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
    hit: { type: 'triangle', f0: 500, f1: 900, g: 0.08, dur: 0.06 },
    hurt: { type: 'square', f0: 220, f1: 90, g: 0.15, dur: 0.16 },
    death: { type: 'sawtooth', f0: 480, f1: 60, g: 0.18, dur: 0.5 },
    jump: { type: 'square', f0: 220, f1: 440, g: 0.06, dur: 0.09 },
    headshot: { type: 'triangle', f0: 1400, f1: 300, g: 0.22, dur: 0.14 },
    // Two alternating presets (left/right foot) rather than one repeated exactly — walking is the
    // most-repeated sound in the whole game, and a single identical blip on every step reads as a
    // machine-gun tick fast enough to be annoying.
    step: { type: 'triangle', f0: 130, f1: 95, g: 0.045, dur: 0.055 },
    step2: { type: 'triangle', f0: 105, f1: 78, g: 0.045, dur: 0.055 },
    punch: { type: 'square', f0: 140, f1: 55, g: 0.16, dur: 0.09 },
    throw: { type: 'sine', f0: 320, f1: 520, g: 0.07, dur: 0.12 },
    explosion: { type: 'sawtooth', f0: 160, f1: 35, g: 0.28, dur: 0.45 },
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
// Real meshes for the same obstacles, kept separately from `obstacles`' AABB-only entries — this
// is what the shot tracer's raycast needs (an actual Mesh with real geometry), while movement/
// standing collision stays on the cheap box test above.
const collidableMeshes = [];

function addObstacle(x, z, w, h, d, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color }));
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  collidableMeshes.push(mesh);
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
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  collidableMeshes.push(mesh);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.35, radius * 1.35, radius * 0.4, 12), new THREE.MeshStandardMaterial({ color }));
  cap.position.set(x, height + radius * 0.2, z);
  cap.castShadow = true;
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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight(0xfff2d9, 0x8a7550, 1.0));
  const dir = new THREE.DirectionalLight(0xffe9c2, 1.0);
  dir.position.set(25, 40, 15);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  // Frustum sized to the plaza+colonnade core (not the full ±40 wall-to-wall span) — that's where
  // duelists actually fight and where shadow resolution matters; the perimeter can go soft.
  dir.shadow.camera.left = -30; dir.shadow.camera.right = 30;
  dir.shadow.camera.top = 30; dir.shadow.camera.bottom = -30;
  dir.shadow.camera.near = 10; dir.shadow.camera.far = 80;
  dir.shadow.bias = -0.0015;
  scene.add(dir);

  // Attached to the camera so viewmodel-style effects (muzzle flash) parented to it get their
  // matrixWorld updated every frame — three.js only auto-updates objects reachable from the scene
  // graph during render(), and the camera itself isn't in that graph by default.
  scene.add(camera);
  camera.add(muzzleFlashSprite);
  camera.add(muzzleFlashLight);
  camera.add(viewmodelGroup);
  updateViewmodelWeapon();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2),
    new THREE.MeshStandardMaterial({ color: 0xe4d9bf })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
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
  plaza.receiveShadow = true;
  scene.add(plaza);

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(5.8, 6.3, 40),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, side: THREE.DoubleSide })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.03;
  scene.add(rim);
}

// The actual fountain centerpiece — LOBBY_SPAWN's own comment ("just south of the fountain,
// facing north toward it") already described this, but until now the plaza was just a flat pool
// floor with no raised centerpiece to actually be a fountain. Purely decorative like the rest of
// addLobbyDecor(), same as the palm trees/banners/balloons: not in `obstacles`, so it never blocks
// movement or shots — it only ever matters near the lobby, far from either duel spawn point.
let fountainJet = null; // { mesh } — shimmered each frame in the main loop, same pattern as `balloons`
function makeFountain() {
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.1, 0.5, 16),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8 })
  );
  pedestal.position.y = 0.25;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  scene.add(pedestal);

  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: 0xdff3fb, transparent: true, opacity: 0.85 })
  );
  basin.position.y = 0.52;
  scene.add(basin);

  // Hollow open-ended cylinder rather than a solid one, so it reads as a jet of water rather than
  // a solid glass rod — needs THREE.DoubleSide since a single-sided hollow tube is invisible from
  // the inside half of the view.
  const jet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.1, 1.1, 10, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xeaf7ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
      emissive: 0xbfe8ff, emissiveIntensity: 0.4,
    })
  );
  jet.position.y = 0.52 + 0.55;
  scene.add(jet);
  fountainJet = { mesh: jet };
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
  makeFountain();
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
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), mat);
  head.position.y = 1.85;
  head.castShadow = true;
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
  // scene.remove() only detaches from the render graph — it never frees the underlying WebGL
  // resources (geometry buffers, materials, and the name sprite's CanvasTexture), so every
  // duelist/spectator who ever leaves and gets a fresh avatar built for them (a disconnect, a
  // slot swap, a new join) permanently leaks that memory without this. Doesn't matter for a short
  // match, but does over a long-running room with a lot of connection churn.
  //
  // Sprites (the name tag) are deliberately excluded from geometry disposal: THREE.Sprite's
  // geometry is a single module-level PlaneGeometry shared by *every* sprite in the app — muzzle
  // flashes, impact sparks, wall dust, all of it — not an instance owned by this one name tag.
  // Disposing it here would have broken every other sprite effect in the game the next time any
  // player left. Only its material (and the CanvasTexture that material uniquely owns) are this
  // sprite's own.
  rp.group.traverse((o) => {
    if (!o.isMesh && !o.isSprite) return;
    if (o.isMesh && o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
  remotePlayers.delete(id);
}

// ==== Local player + input ====
const player = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vy: 0, grounded: true, health: 150, alive: false, weapon: 'assault_rifle' };
const move = { f: 0, r: 0 };
const keys = new Set();
let pointerLocked = false;
let aiming = false;
// Keyed per weapon, not one shared timestamp — mirrors the identical fix (and its full
// explanation) on server.js's attacker.lastShotAt. Without this, firing the grenade locally would
// block attemptShoot() for every other weapon too for the next 3200ms, well before the server's
// own per-weapon check ever got a chance to weigh in.
const lastShotAt = {};

// Single chokepoint for every place that sets `aiming`, rather than each call site touching the
// overlay itself — the scope only makes sense for a weapon with headshotDamage (plain ranged ADS
// is just the FOV zoom in updateFov), and this is the one place that needs to know both facts.
function setAiming(v) {
  aiming = v;
  // Keyed off the weapon actually having headshotDamage, not a hardcoded weapon name — none of
  // the current 4-slot loadout does, so the scope stays permanently hidden for now, but this
  // reactivates automatically for any future high-precision weapon added to the loadout without
  // needing this function touched again.
  const w = weapons[player.weapon];
  scopeOverlayEl.classList.toggle('hidden', !(v && w && w.headshotDamage));
}

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
  if (ny <= surface) {
    // Only a real fall (past some downward speed) kicks up dust — otherwise walking over the seam
    // between two overlapping obstacle footprints (groundHeightAt can step up/down there) would
    // spawn a puff on every ordinary step.
    if (!player.grounded && player.vy < -4) spawnLandingDust(new THREE.Vector3(player.x, surface, player.z));
    ny = surface; player.vy = 0; player.grounded = true;
  } else {
    player.grounded = false;
  }
  player.y = ny;
}

function tryJump() {
  if (!player.grounded) return;
  if (!(mySlot === 'spectator' || phase !== 'active' || player.alive)) return;
  player.vy = JUMP_SPEED;
  player.grounded = false;
  playSound('jump');
}

let damageShakeAt = 0; // performance.now() of the local player's last incoming hit, or 0
function updateCameraFromPlayer() {
  camera.position.set(player.x, player.y + EYE_HEIGHT, player.z);
  // A brief, decaying random jitter on top of the real eye position when a shot just landed on
  // you — separate from the death-tilt below (that's a deliberate held pose; this is a quick
  // startle that has to be fully gone by the time the next hit could land, or a fast weapon like
  // the rifle would stack shakes into a constant blur instead of discrete hits).
  const shakeAge = performance.now() - damageShakeAt;
  if (shakeAge < 180) {
    const s = (1 - shakeAge / 180) * 0.05;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
  }
  camera.rotation.x = player.pitch;
  camera.rotation.y = player.yaw;
  // A slow head-lean on your own death rather than snapping mouse-look away from the player —
  // roll is otherwise never touched during normal play, so this is the one axis free to use for
  // it without fighting the pitch/yaw the player is still holding the mouse over.
  camera.rotation.z = myDeathAt ? Math.min(1, (performance.now() - myDeathAt) / 500) * 0.32 : 0;
}

// Per-weapon ADS zoom — no entry (fists, grenade) means aiming has no FOV effect at all, which is
// the correct behavior for a melee/thrown weapon rather than a special case to opt out of.
const ADS_FOV = { pistol: 50, assault_rifle: 42 };
function updateFov(dt) {
  const targetFov = aiming && ADS_FOV[player.weapon] ? ADS_FOV[player.weapon] : BASE_FOV;
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
  camera.updateProjectionMatrix();
}
// Touch has no cursor/right-click affordance to make "this weapon doesn't aim" obvious the way
// desktop's mouse button does, so the aim button dims instead for fists/grenade.
function updateTouchAimAvailability() {
  touchAimBtn.classList.toggle('unavailable', !ADS_FOV[player.weapon]);
}

function readKeyboardMove() {
  if (isTouchDevice) return;
  move.f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  move.r = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
}

function clearHeldInput() {
  move.f = 0; move.r = 0; setAiming(false); keys.clear();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) clearHeldInput(); });
window.addEventListener('blur', clearHeldInput);

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Digit1') selectWeapon('pistol');
  if (e.code === 'Digit2') selectWeapon('assault_rifle');
  if (e.code === 'Digit3') selectWeapon('fists');
  if (e.code === 'Digit4') selectWeapon('grenade');
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
  else if (e.button === 2) setAiming(true);
});
canvas.addEventListener('mouseup', (e) => { if (e.button === 2) setAiming(false); });
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
  touchAimBtn.addEventListener('touchstart', (e) => { e.preventDefault(); setAiming(true); }, { passive: false });
  touchAimBtn.addEventListener('touchend', (e) => { e.preventDefault(); setAiming(false); });
  touchAimBtn.addEventListener('touchcancel', () => { setAiming(false); });
  touchJumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); tryJump(); }, { passive: false });
}

// ==== Weapons ====
// Fixed 4-slot starting loadout — a ranged primary/secondary pair, a melee fallback, and a
// grenade — all carried from the moment you join, no unlock progression gating any of them (see
// server.js's FG_WEAPONS comment: unlockKills is still live infrastructure, just 0 for all four
// right now). One shared order/label table instead of the three separate copies this used to have
// (button list, unlock banner, kill-feed unlock text) — those all read from this now.
const WEAPON_ORDER = ['pistol', 'assault_rifle', 'fists', 'grenade'];
// touchIcon is only used on the touch weapon bar, which (unlike the desktop menu/HUD) shows the
// icon alone with no name text next to it — pistol and assault_rifle share the same 🔫 icon
// (there's no widely-supported distinct "rifle" emoji), which reads fine everywhere the name is
// also visible but is genuinely ambiguous icon-only, so assault_rifle gets a short text fallback
// there instead.
const WEAPON_META = {
  pistol: { icon: '🔫', name: 'Pistol' },
  assault_rifle: { icon: '🔫', name: 'Assault Rifle', touchIcon: 'AR' },
  fists: { icon: '👊', name: 'Fists' },
  grenade: { icon: '💣', name: 'Grenade' },
};
let weapons = {}; // populated from fg-init: { pistol: {damage,cooldownMs,range,unlockKills,melee?,thrown?,headshotDamage?}, ... }
let maxHealth = 150; // overwritten from fg-init's maxHealth once connected; this default only matters for the brief pre-connect render
let totalKills = 0; // career total for this room (see fg_stats/bumpFgKills in server.js/db.js) — what weapon unlocks are keyed to, not this match's kill count
let unlockedWeapons = [...WEAPON_ORDER]; // server-computed from totalKills; also the real enforcement (see fg-select-weapon in server.js) — this is only used for the UI here. Defaults to "everything" since the whole starting loadout ships unlocked; only matters once a locked weapon exists again.
function isUnlocked(key) {
  return unlockedWeapons.includes(key);
}
function buildWeaponButtons() {
  [weaponButtonsEl, touchWeaponButtonsEl].forEach((container) => {
    container.innerHTML = '';
    WEAPON_ORDER.forEach((key) => {
      if (!weapons[key]) return;
      const unlocked = isUnlocked(key);
      const meta = WEAPON_META[key];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'weapon-btn' + (key === player.weapon ? ' active' : '') + (unlocked ? '' : ' locked');
      btn.dataset.weapon = key;
      const need = weapons[key].unlockKills || 0;
      btn.innerHTML = container === touchWeaponButtonsEl
        ? `<span>${unlocked ? (meta.touchIcon || meta.icon) : '🔒'}</span>`
        : unlocked
        ? `<span>${meta.icon} ${meta.name}</span><span>${weapons[key].damage} dmg</span>`
        : `<span>${meta.icon} ${meta.name}</span><span>🔒 ${need} kills (${totalKills}/${need})</span>`;
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
  updateViewmodelWeapon();
  updateTouchAimAvailability();
  setAiming(aiming); // re-checks the scope overlay against the new weapon — a switch made mid-aim (number keys aren't gated to between-rounds) shouldn't leave a scope up on a weapon that doesn't have one
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'fg-select-weapon', weapon: key }));
}
function updateWeaponHud() {
  weaponHudEl.textContent = WEAPON_META[player.weapon] ? WEAPON_META[player.weapon].name : '';
}

// ==== First-person weapon viewmodel ====
// There was previously no gun visible on screen at all — just a crosshair. Built from the same
// primitive-shape language the rest of the arena already uses (boxes/cylinders, flat
// MeshStandardMaterial, no textures), one group per weapon, all parented to the camera like the
// muzzle flash already is. Only the active weapon's group is visible at a time.
const viewmodelGroup = new THREE.Group();
const viewmodels = {}; // weapon key -> THREE.Group, each with its own baked-in hip position in userData.hipPos

// mesh.position/.rotation must be mutated via their own .set() (or .copy()), never replaced with a
// fresh Vector3/Euler via Object.assign or `mesh.rotation = new THREE.Euler(...)` — Object3D wires
// an internal onChange listener on the *original* rotation/position instances that keeps
// mesh.quaternion in sync, and updateMatrix() reads the quaternion, not the Euler angles directly.
// Replacing the instance drops that listener, so the mesh would silently render unrotated.
function part(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  return mesh;
}
function buildViewmodel(parts, hx, hy, hz) {
  const group = new THREE.Group();
  parts.forEach((mesh) => group.add(mesh));
  // At ~0.5 units from the camera, an unscaled part this size (built at roughly real-world scale
  // to sit right next to a similarly-real-scale avatar body) subtends nearly half the screen
  // height at this game's 75deg FOV — confirmed by an actual rendered screenshot during testing,
  // not just checking the numbers, since the angular-size math is easy to eyeball wrong. Scaling
  // the whole group down is simpler than rescaling every individual part.
  group.scale.setScalar(0.55);
  group.userData.hipPos = new THREE.Vector3(hx, hy, hz);
  group.position.copy(group.userData.hipPos);
  group.visible = false;
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; }); // first-person-only geometry; shadows from it would be visible to nobody and cost real render time
  viewmodelGroup.add(group);
  return group;
}
function buildViewmodels() {
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b2f36 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17191d });

  viewmodels.pistol = buildViewmodel([
    part(new THREE.BoxGeometry(0.09, 0.09, 0.32), metal, 0, 0, -0.12),
    part(new THREE.BoxGeometry(0.07, 0.16, 0.08), dark, 0, -0.11, 0.02, 0.15, 0, 0),
  ], 0.34, -0.28, -0.6);

  viewmodels.assault_rifle = buildViewmodel([
    part(new THREE.BoxGeometry(0.08, 0.1, 0.55), metal, 0, 0, -0.22),
    part(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), metal, 0, 0.01, -0.58, Math.PI / 2, 0, 0),
    part(new THREE.BoxGeometry(0.06, 0.15, 0.07), dark, 0, -0.1, 0.06, 0.15, 0, 0),
    part(new THREE.BoxGeometry(0.05, 0.18, 0.06), dark, 0, -0.15, -0.12, 0.35, 0, 0),
  ], 0.35, -0.29, -0.68);

  const skin = new THREE.MeshStandardMaterial({ color: 0xd6a374 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x3a3f4a });
  viewmodels.fists = buildViewmodel([
    part(new THREE.BoxGeometry(0.16, 0.16, 0.16), skin, 0, 0, -0.08),
    part(new THREE.BoxGeometry(0.14, 0.14, 0.22), sleeve, 0, -0.01, 0.14),
  ], 0.3, -0.26, -0.42);

  const olive = new THREE.MeshStandardMaterial({ color: 0x4a5a3a });
  const pinCap = new THREE.MeshStandardMaterial({ color: 0x9a9a90 });
  viewmodels.grenade = buildViewmodel([
    part(new THREE.SphereGeometry(0.13, 10, 10), olive, 0, 0, -0.1),
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), pinCap, 0, 0.14, -0.1),
  ], 0.3, -0.25, -0.42);
}

let activeViewmodel = null;
const viewmodelPos = new THREE.Vector3(); // the current lerped hip/ADS position — separate from the group's own .position so per-frame sway/recoil offsets (added on top in the render loop) never feed back into next frame's lerp target
let recoilKick = 0; // decays each frame; +z pushes the weapon back toward the camera (gun recoil), -z thrusts it forward (a punch/throw's follow-through)
let recoilTilt = 0; // decays each frame; rotation.x kick on fire
// A gun kicks back toward the camera on fire; a punch or a throw instead thrusts forward (-z) and
// springs back, since that's what the follow-through of an actual swing/throw looks like — the
// same exponential decay toward 0 in the render loop works for either sign without changes.
const RECOIL = {
  pistol: { kick: 0.05, tilt: -0.13 },
  assault_rifle: { kick: 0.04, tilt: -0.1 },
  fists: { kick: -0.12, tilt: 0.2 },
  grenade: { kick: -0.1, tilt: 0.28 },
};
function updateViewmodelWeapon() {
  if (activeViewmodel) activeViewmodel.visible = false;
  activeViewmodel = viewmodels[player.weapon] || null;
  if (activeViewmodel) {
    activeViewmodel.visible = true;
    viewmodelPos.copy(activeViewmodel.userData.hipPos);
    // A switch mid-recoil (now that switching mid-fight is the whole point of the loadout) would
    // otherwise hand the newly-selected weapon's viewmodel whatever kick/tilt the *previous*
    // weapon was still decaying from — e.g. a fists punch's forward thrust still playing out on
    // the freshly-equipped pistol a frame later.
    recoilKick = 0;
    recoilTilt = 0;
  }
}
function kickViewmodel() {
  const r = RECOIL[player.weapon] || RECOIL.pistol;
  recoilKick = r.kick;
  recoilTilt = r.tilt;
}
// ADS target is centered and pulled in, rather than the hip offset to the right — only pistol/
// assault_rifle define an ADS_FOV (see updateFov), so this position only ever actually gets
// reached by those two; fists/grenade's "aim" input is a no-op with nothing to raise to.
const VIEWMODEL_ADS_POS = new THREE.Vector3(0, -0.05, -0.55);
buildViewmodels();

// ==== Combat FX — muzzle flash, tracers, impact sparks ====
// All purely cosmetic and client-local: the server never tells anyone a shot was *fired*, only
// whether one *landed* (fg-hit/fg-death carry byId/targetId but no shot geometry). So the shooter
// gets full instant feedback from their own raycast the moment they click; everyone else only
// sees a tracer/flash/spark when fg-hit or fg-death actually arrives for that shot. A remote miss
// is invisible to bystanders — same "trust the client, cosmetics only" model the rest of this
// game's combat already uses, just extended to rendering instead of damage.

// Parented to the camera in initScene() so it rides along for free every frame — camera-local
// offset (right, down, forward), like a gun barrel low in frame with no actual viewmodel to hang
// it off of.
const muzzleFlashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthTest: false }));
muzzleFlashSprite.scale.set(0.3, 0.3, 1);
muzzleFlashSprite.position.set(0.32, -0.28, -0.6);
muzzleFlashSprite.renderOrder = 999;
const muzzleFlashLight = new THREE.PointLight(0xffcf66, 0, 6, 2);
muzzleFlashLight.position.set(0.3, -0.2, -0.5);
function flashMuzzle() {
  muzzleFlashSprite.material.opacity = 1;
  muzzleFlashLight.intensity = 3.5;
}

const activeFlashes = []; // world-space flashes for other players' confirmed shots — { light, sprite }
function flashAt(pos) {
  const light = new THREE.PointLight(0xffcf66, 4, 6, 2);
  light.position.copy(pos);
  scene.add(light);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd27a, transparent: true, opacity: 1, depthTest: false }));
  sprite.scale.set(0.5, 0.5, 1);
  sprite.position.copy(pos);
  scene.add(sprite);
  activeFlashes.push({ light, sprite });
}

const activeTracers = []; // { line, bornAt }
const TRACER_LIFE_MS = 140;
function spawnTracer(from, to, color = 0xfff2b0) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const line = new THREE.Line(geo, mat);
  line.renderOrder = 998;
  scene.add(line);
  activeTracers.push({ line, bornAt: performance.now() });
}
const TRACER_COLOR = { pistol: 0xfff2b0, assault_rifle: 0xfff2b0 }; // fists/grenade never draw a tracer at all (see attemptShoot/showLandedShot) — no entry needed

const activeSparks = []; // { sprite, vel, bornAt }
const SPARK_LIFE_MS = 380;
function spawnImpactSpark(pos, headshot) {
  const n = headshot ? 10 : 6;
  const color = headshot ? 0xff5a5a : 0xffe066;
  for (let i = 0; i < n; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color, transparent: true, opacity: 1, depthTest: false }));
    sprite.scale.set(0.1, 0.1, 1);
    sprite.position.copy(pos);
    scene.add(sprite);
    const theta = Math.random() * Math.PI * 2, phi = Math.random() * Math.PI;
    const speed = 1.5 + Math.random() * 2.5;
    const vel = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi) * 0.6 + 0.5,
      Math.sin(phi) * Math.sin(theta)
    ).multiplyScalar(speed);
    activeSparks.push({ sprite, vel, bornAt: performance.now() });
  }
}

// Landing dust from a real fall (see tickVertical) — shares the same activeSparks pool/decay loop
// as combat impact sparks, just with a dusty color and a mostly-horizontal outward velocity
// instead of impact sparks' full-sphere spray. Local-only, like every other combat FX here: this
// client only ever detects its *own* player.grounded transition, so a remote player's landing
// dust never renders for anyone but them — same "trust the client, cosmetics only" gap already
// documented above for muzzle flashes on someone else's miss.
function spawnLandingDust(pos) {
  const n = 8;
  for (let i = 0; i < n; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xcbb994, transparent: true, opacity: 1, depthTest: false }));
    sprite.scale.set(0.16, 0.16, 1);
    sprite.position.copy(pos);
    scene.add(sprite);
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.8 + Math.random() * 1.6;
    const vel = new THREE.Vector3(Math.cos(angle) * speed, 0.5 + Math.random() * 0.6, Math.sin(angle) * speed);
    activeSparks.push({ sprite, vel, bornAt: performance.now() });
  }
}

// A shot that hits a wall/pillar rather than a player — same activeSparks pool as everything else
// here, but a small stone-colored puff instead of the wide blood-yellow combat spark, and only
// ever from the local shooter's own raycast (see computeShotEnd's hitEnvironment flag); there's no
// server broadcast for a miss, so nobody else ever sees where someone else's shot actually struck.
function spawnWallImpact(pos) {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xd8cdb0, transparent: true, opacity: 1, depthTest: false }));
    sprite.scale.set(0.08, 0.08, 1);
    sprite.position.copy(pos);
    scene.add(sprite);
    const theta = Math.random() * Math.PI * 2, phi = Math.random() * Math.PI;
    const speed = 0.6 + Math.random() * 1.2;
    const vel = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi) * 0.5,
      Math.sin(phi) * Math.sin(theta)
    ).multiplyScalar(speed);
    activeSparks.push({ sprite, vel, bornAt: performance.now() });
  }
}

// A bigger, brighter version of a normal impact — reuses spawnImpactSpark's existing headshot-
// sized burst (10 red-tinted particles) rather than a third particle-count variant, plus a real
// PointLight+sprite flash from the same pool flashAt's remote-shot flashes already use, so no new
// decay/cleanup code was needed for either half of this.
function spawnExplosion(pos) {
  spawnImpactSpark(pos, true);
  const light = new THREE.PointLight(0xffb347, 8, 12, 2);
  light.position.copy(pos);
  scene.add(light);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffcf7a, transparent: true, opacity: 1, depthTest: false }));
  sprite.scale.set(1.4, 1.4, 1);
  sprite.position.copy(pos);
  scene.add(sprite);
  activeFlashes.push({ light, sprite });
  playSound('explosion');
}

// The grenade's lobbed arc — a real flying object (unlike every other weapon's instant hitscan
// tracer), purely cosmetic like the rest of this file's combat FX: damage still resolves the
// instant fg-shoot reaches the server (see attemptShoot), this is just what it looks like while
// that's in flight. Local-only, like the rest of this file — no server broadcast for a thrown-but-
// not-yet-landed grenade exists, so nobody but the thrower ever sees the arc itself, only the
// eventual explosion once fg-hit/fg-death confirms it (see GRENADE_FLIGHT_MS below).
const activeProjectiles = []; // { mesh, from, to, bornAt }
const GRENADE_FLIGHT_MS = 550;
function spawnGrenadeThrow(from, to) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a5a3a })
  );
  mesh.position.copy(from);
  scene.add(mesh);
  activeProjectiles.push({ mesh, from: from.clone(), to: to.clone(), bornAt: performance.now() });
}

// Where a given player's torso/head currently is, in world space — used to anchor tracers/flashes
// for shots the local client didn't fire itself (own position for the local id, interpolated
// avatar group position for anyone else). Returns null only if a remote id's avatar hasn't been
// created yet, which fg-hit/fg-death should never see in practice (the shooter and target are
// always already-known duelists by the time a shot can land).
function posForId(id) {
  if (id === myId) return new THREE.Vector3(player.x, player.y + EYE_HEIGHT, player.z);
  const rp = remotePlayers.get(id);
  if (!rp) return null;
  return new THREE.Vector3(rp.group.position.x, rp.group.position.y + 1.4, rp.group.position.z);
}

// A grenade's confirmed hit shows its (bigger) explosion only once the thrower's own local arc
// would have landed, not instantly on fg-hit/fg-death — keeps the explosion visually in sync with
// the lobbed projectile instead of appearing to detonate the moment it leaves the hand.
const WEAPON_IMPACT_DELAY_MS = { grenade: GRENADE_FLIGHT_MS };

// Fired from fg-hit/fg-death for every landed shot. The local shooter's own tracer+flash (guns) or
// projectile (grenade) already happened instantly in attemptShoot(); this only adds the parts that
// couldn't happen until the server confirmed it — the impact effect (needs the real target
// position, not the shooter's raycast guess) always, and the full tracer+flash for anyone else's
// gunshot (which otherwise had no visual representation at all). Melee and thrown weapons never
// draw a tracer line at all — a punch has no bullet, and the grenade's arc is its own travel
// visual, so a straight line on top of/instead of it would be redundant or wrong.
function showLandedShot(byId, targetId, headshot, weapon) {
  const targetPos = posForId(targetId);
  if (!targetPos) return;
  const w = weapons[weapon];
  const run = () => {
    if (byId !== myId && w && !w.melee && !w.thrown) {
      const shooterPos = posForId(byId);
      if (shooterPos) { spawnTracer(shooterPos, targetPos, TRACER_COLOR[weapon] || TRACER_COLOR.pistol); flashAt(shooterPos); }
    }
    if (w && w.thrown) spawnExplosion(targetPos);
    else spawnImpactSpark(targetPos, headshot);
  };
  const delay = WEAPON_IMPACT_DELAY_MS[weapon] || 0;
  if (delay) setTimeout(run, delay);
  else run();
}

// Reused across shots rather than allocated fresh each time — this only ever needs a straight
// down-the-crosshair cast (screen center), never a per-pixel one.
const shootRaycaster = new THREE.Raycaster();
const CROSSHAIR_NDC = new THREE.Vector2(0, 0);

// Where the local player's own shot actually lands visually — raycasts against real arena geometry
// plus every known remote avatar's body/head meshes, capped to the weapon's range so a shot into
// open sky doesn't draw a tracer to nowhere. This is a rendering-only guess, purely for the
// shooter's own instant feedback; the server alone decides whether the shot actually deals damage.
// Returns where the shot's tracer ends AND whether that was real arena geometry rather than an
// avatar or open air — a wall/pillar hit gets its own small impact puff (see spawnWallImpact);
// hitting a player already gets its spark from showLandedShot once the server confirms the shot
// landed, and a shot into open sky obviously has nothing to kick up dust from.
function computeShotEnd(range) {
  shootRaycaster.setFromCamera(CROSSHAIR_NDC, camera);
  shootRaycaster.far = range;
  const avatarMeshes = [...remotePlayers.values()].flatMap((rp) => rp.group.children.filter((c) => c.isMesh));
  const hits = shootRaycaster.intersectObjects([...collidableMeshes, ...avatarMeshes], false);
  if (hits.length) return { point: hits[0].point, hitEnvironment: !avatarMeshes.includes(hits[0].object) };
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  return { point: camera.position.clone().addScaledVector(dir, range), hitEnvironment: false };
}

// A real raycast from the crosshair against every visible opponent's head hitbox, same aim the
// player is actually looking at rather than a proximity guess — gated on the weapon actually
// having headshotDamage (none of the current 4-slot loadout does) rather than a hardcoded weapon
// name, so this reactivates for free if a future weapon defines one. The server ultimately decides
// whether the shot lands at all (range/cooldown/alive-state) — this only flags *which* damage
// number to ask for if it does, same loose "trust the client's aim" model this game already uses.
function computeHeadshot() {
  const w = weapons[player.weapon];
  if (!w || !w.headshotDamage) return false;
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
  if (now - (lastShotAt[player.weapon] || 0) < w.cooldownMs) return;
  lastShotAt[player.weapon] = now;
  const headshot = computeHeadshot();
  kickViewmodel();
  crosshairEl.classList.remove('fired');
  void crosshairEl.offsetWidth;
  crosshairEl.classList.add('fired');

  if (w.thrown) {
    // Grenade: no muzzle flash/tracer (neither makes sense for a lob), just the arcing projectile
    // — see spawnGrenadeThrow. Damage still resolves the instant fg-shoot reaches the server, same
    // as every other weapon; only the *visual* explosion is delayed to roughly match the throw
    // (see showLandedShot's per-weapon delay).
    playSound('throw');
    const muzzleWorldPos = muzzleFlashSprite.getWorldPosition(new THREE.Vector3());
    spawnGrenadeThrow(muzzleWorldPos, computeShotEnd(w.range).point);
  } else if (w.melee) {
    // Fists: no muzzle flash/tracer either — a punch has no bullet to draw a line for.
    playSound('punch');
  } else {
    playSound(headshot ? 'headshot' : 'shoot');
    flashMuzzle();
    const muzzleWorldPos = muzzleFlashSprite.getWorldPosition(new THREE.Vector3());
    const shot = computeShotEnd(w.range);
    spawnTracer(muzzleWorldPos, shot.point, TRACER_COLOR[player.weapon] || TRACER_COLOR.pistol);
    if (shot.hitEnvironment) spawnWallImpact(shot.point);
  }

  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'fg-shoot', headshot }));
}

// ==== HUD helpers ====
function renderHealth() {
  const hp = clamp(player.health, 0, maxHealth);
  const pct = maxHealth > 0 ? (hp / maxHealth) * 100 : 0;
  healthFillEl.style.width = pct + '%';
  healthFillEl.classList.toggle('low', pct <= 30);
  healthNumEl.textContent = Math.round(hp);
  // Same 30% threshold the health bar itself already turns red at, and off entirely at 0 — once
  // you're dead the kill-feed/death-tilt are doing the "you're in danger" job, a pulsing vignette
  // on top of a screen you can no longer act in would just be noise.
  lowHealthVignetteEl.classList.toggle('show', pct > 0 && pct <= 30);
}
function flashDamage() {
  damageFlashEl.classList.remove('show');
  void damageFlashEl.offsetWidth;
  damageFlashEl.classList.add('show');
}
function showHitMarker(headshot) {
  hitMarkerEl.classList.remove('show');
  void hitMarkerEl.offsetWidth;
  hitMarkerEl.classList.toggle('headshot', !!headshot);
  hitMarkerEl.classList.add('show');
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
  const next = WEAPON_ORDER.find((key) => weapons[key] && !unlockedWeapons.includes(key));
  if (!next) { unlockBannerEl.classList.add('hidden'); return; }
  const need = weapons[next].unlockKills || 0;
  unlockBannerEl.textContent = `🔓 Unlock ${WEAPON_META[next].name}: ${totalKills}/${need} kills`;
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
let myDeathAt = 0; // performance.now() of this client's own last fg-death, or 0 — drives the camera death-tilt in updateCameraFromPlayer
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
      updateViewmodelWeapon();
      updateTouchAimAvailability();
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
      myDeathAt = 0;
      for (const rp of remotePlayers.values()) { rp.dying = false; rp.group.rotation.x = 0; }
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
      showLandedShot(data.byId, data.targetId, data.headshot, data.weapon);
      if (data.targetId === myId) {
        player.health = data.health;
        renderHealth();
        flashDamage();
        playSound('hurt');
        damageShakeAt = performance.now();
      } else if (data.byId === myId) {
        playSound(data.headshot ? 'headshot' : 'hit');
        showHitMarker(data.headshot);
        if (data.headshot) addKillFeed('🎯 Headshot!');
      } else {
        playSound('hit');
      }
      break;
    }
    case 'fg-death': {
      showLandedShot(data.killedBy, data.id, data.headshot, data.weapon);
      const hs = data.headshot ? ' (Headshot!)' : '';
      if (data.id === myId) {
        player.alive = false;
        player.health = 0;
        renderHealth();
        addKillFeed(`💀 Eliminated by ${knownNames.get(data.killedBy) || 'your opponent'}${hs}`);
        playSound('death');
        myDeathAt = performance.now();
        damageShakeAt = performance.now(); // the fatal hit is still a hit — same brief jolt as any other incoming shot, on top of the held death-tilt
      } else if (data.killedBy === myId) {
        addKillFeed(`🎯 You eliminated ${knownNames.get(data.id) || 'your opponent'}!${hs}`);
        showHitMarker(data.headshot);
        playSound(data.headshot ? 'headshot' : 'hit');
      } else {
        addKillFeed(`${knownNames.get(data.killedBy) || 'Someone'} eliminated ${knownNames.get(data.id) || 'someone'}${hs}`);
      }
      const rp = remotePlayers.get(data.id);
      if (rp) { rp.dying = true; rp.deathAt = performance.now(); }
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
      newlyUnlocked.forEach((w) => { if (WEAPON_META[w]) addKillFeed(`🔓 ${WEAPON_META[w].name} unlocked!`); });
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
let lastStepAt = 0;
let stepToggle = false;
const STEP_INTERVAL_MS = 320;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  readKeyboardMove();
  const canMove = mySlot === 'spectator' || phase !== 'active' || player.alive;
  if (canMove) tickMovement(dt);
  // Grounded + actually holding a move input, not just "not blocked" — canMove alone is also true
  // while standing still. Client-local only, like every other cosmetic here: this only ever plays
  // for your own footsteps, never anyone else's (no fg-pos field for "is this player walking").
  if (canMove && player.grounded && (move.f || move.r) && now - lastStepAt > STEP_INTERVAL_MS) {
    playSound(stepToggle ? 'step' : 'step2');
    stepToggle = !stepToggle;
    lastStepAt = now;
  }
  tickVertical(dt);
  updateCameraFromPlayer();
  updateFov(dt);
  sendPos(false);

  viewmodelGroup.visible = mySlot === 'a' || mySlot === 'b';
  if (activeViewmodel) {
    // Same headshotDamage-driven "has a scope" check as setAiming's scope-overlay toggle — kept
    // in sync by definition rather than by two separate weapon-name checks that could drift.
    const curWeapon = weapons[player.weapon];
    const hasScope = !!(curWeapon && curWeapon.headshotDamage);
    const adsIn = aiming && !!ADS_FOV[player.weapon];
    activeViewmodel.visible = !(aiming && hasScope);
    const target = adsIn ? VIEWMODEL_ADS_POS : activeViewmodel.userData.hipPos;
    viewmodelPos.lerp(target, Math.min(1, dt * 10));
    recoilKick *= 0.8;
    recoilTilt *= 0.8;
    // Idle sway is added on top of viewmodelPos rather than folded into it — see viewmodelPos's
    // own declaration comment for why the two have to stay separate.
    const sway = canMove && (move.f || move.r) ? 1 : 0.35; // a livelier sway while actually moving, a slow idle breathe otherwise
    activeViewmodel.position.set(
      viewmodelPos.x + Math.sin(now / 450) * 0.004 * sway,
      viewmodelPos.y + Math.cos(now / 650) * 0.003 * sway - recoilKick * 0.15,
      viewmodelPos.z + recoilKick
    );
    activeViewmodel.rotation.x = recoilTilt;
  }

  for (const rp of remotePlayers.values()) {
    rp.group.position.x += (rp.target.x - rp.group.position.x) * 0.25;
    rp.group.position.y += (rp.target.y - rp.group.position.y) * 0.25;
    rp.group.position.z += (rp.target.z - rp.group.position.z) * 0.25;
    rp.group.rotation.y += (rp.target.yaw - rp.group.rotation.y) * 0.25;
    // Tips forward and sinks in place, overriding the normal position lerp above for this one
    // axis — set as an absolute offset from rp.target.y (not -=), since this branch runs every
    // frame for as long as `dying` stays true and a -= here would subtract again each frame
    // forever instead of settling at a fixed depth once t saturates at 1.
    if (rp.dying) {
      const t = Math.min(1, (now - rp.deathAt) / 650);
      rp.group.rotation.x = t * 1.5;
      rp.group.position.y = rp.target.y - t * 0.9;
    }
  }
  for (const b of balloons) b.mesh.position.y = b.baseY + Math.sin(now / 1000 + b.phase) * 0.15;
  if (fountainJet) {
    fountainJet.mesh.scale.y = 1 + Math.sin(now / 220) * 0.08;
    fountainJet.mesh.material.opacity = 0.45 + Math.sin(now / 180) * 0.1;
  }

  // Grenade arcs — simple parabola (a sine bump added on top of a straight lerp) rather than real
  // projectile physics; this only ever needs to look right over ~half a second, not be simulated.
  for (let i = activeProjectiles.length - 1; i >= 0; i--) {
    const p = activeProjectiles[i];
    const t = Math.min(1, (now - p.bornAt) / GRENADE_FLIGHT_MS);
    p.mesh.position.lerpVectors(p.from, p.to, t);
    p.mesh.position.y += Math.sin(t * Math.PI) * 1.6;
    p.mesh.rotation.x += 6 * dt;
    if (t >= 1) {
      // A landed grenade always explodes here, hit or miss — showLandedShot's explosion only
      // ever fires on a server-confirmed hit, so without this a throw that missed (out of range,
      // opponent moved, crosshair wasn't quite on them) would just have its projectile vanish
      // silently with no boom at all. activeProjectiles only ever holds the local player's own
      // throws (nothing broadcasts a remote player's grenade until it's confirmed landed), so this
      // never fires on someone else's behalf.
      spawnExplosion(p.mesh.position);
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      activeProjectiles.splice(i, 1);
    }
  }

  // Combat FX decay — exponential falloff needs no per-effect timer bookkeeping for the flash/
  // light, just a per-frame multiply; tracers and sparks age against a hard lifetime instead since
  // they need to be removed from the scene (and disposed) once fully faded, not just dimmed.
  muzzleFlashSprite.material.opacity *= 0.8;
  muzzleFlashLight.intensity *= 0.8;

  for (let i = activeFlashes.length - 1; i >= 0; i--) {
    const f = activeFlashes[i];
    f.light.intensity *= 0.75;
    f.sprite.material.opacity *= 0.75;
    if (f.light.intensity < 0.05) {
      scene.remove(f.light);
      scene.remove(f.sprite);
      f.sprite.material.dispose();
      activeFlashes.splice(i, 1);
    }
  }

  for (let i = activeTracers.length - 1; i >= 0; i--) {
    const t = activeTracers[i];
    const age = now - t.bornAt;
    if (age > TRACER_LIFE_MS) {
      scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      activeTracers.splice(i, 1);
      continue;
    }
    t.line.material.opacity = 0.9 * (1 - age / TRACER_LIFE_MS);
  }

  for (let i = activeSparks.length - 1; i >= 0; i--) {
    const s = activeSparks[i];
    const age = now - s.bornAt;
    if (age > SPARK_LIFE_MS) {
      scene.remove(s.sprite);
      s.sprite.material.dispose();
      activeSparks.splice(i, 1);
      continue;
    }
    s.sprite.position.addScaledVector(s.vel, dt);
    s.vel.y -= 9 * dt; // gravity
    s.sprite.material.opacity = 1 - age / SPARK_LIFE_MS;
  }

  updateRoundTimer();
  renderer.render(scene, camera);
}

initScene();
requestAnimationFrame(loop);
connectFg();
