// ---------- Room/session setup (same ?room=&name= pattern as the other minigames — this page
// opens its own WebSocket connection, bypassing join-server/ws.profile entirely). ----------
const mpParams = new URLSearchParams(location.search);
const roomCode = mpParams.get('room');
const myName = (mpParams.get('name') || 'Player').slice(0, 30);

const backLink = document.getElementById('back-link');
if (roomCode) backLink.href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;

const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const menuEl = document.getElementById('menu');
const startBtn = document.getElementById('start-btn');
const hudEl = document.getElementById('hud');
const scoreLabel = document.getElementById('score-label');
const bestLabel = document.getElementById('best-label');
const healthBarEl = document.getElementById('health-bar');
const missileStatusEl = document.getElementById('missile-status');
const minimapEl = document.getElementById('minimap');
const minimapCtx = minimapEl.getContext('2d');
const speedStatusEl = document.getElementById('speed-status');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardOverlay = document.getElementById('leaderboard-overlay');
const leaderboardCloseBtn = document.getElementById('leaderboard-close-btn');
const leaderboardListEl = document.getElementById('leaderboard-list');
const gameoverOverlay = document.getElementById('gameover-overlay');
const gameoverText = document.getElementById('gameover-text');
const restartBtn = document.getElementById('restart-btn');
const crosshairEl = document.getElementById('crosshair');
const scopeOverlayEl = document.getElementById('scope-overlay');
const killToastEl = document.getElementById('kill-toast');
const canvas = document.getElementById('game-canvas');
const touchControlsEl = document.getElementById('touch-controls');
const touchFireBtn = document.getElementById('touch-fire');
const missileJoystickEl = document.getElementById('missile-joystick');
const missileJoystickKnobEl = document.getElementById('missile-joystick-knob');
const touchGunBtn = document.getElementById('touch-gun');
const touchBailBtn = document.getElementById('touch-bail');
const touchAimBtn = document.getElementById('touch-aim');
const touchNukeBtn = document.getElementById('touch-nuke');
const touchGrenadeBtn = document.getElementById('touch-grenade');
const touchCallPlaneBtn = document.getElementById('touch-call-plane');
const spidermanStartBtn = document.getElementById('spiderman-start-btn');
const touchWebBtn = document.getElementById('touch-web');
const touchJumpBtn = document.getElementById('touch-jump');
const touchEnterBtn = document.getElementById('touch-enter');
const livesStatusEl = document.getElementById('lives-status');
const warStatusEl = document.getElementById('war-status');
const attackBtn = document.getElementById('attack-btn');
const touchAttackBtn = document.getElementById('touch-attack');

// ---------- Constants ----------
const WORLD_RADIUS = 480;
const MAX_ALT = 260;
// Speed is no longer constant — energy trades with pitch (diving speeds you up, climbing bleeds
// speed off, same as a real glide/dive) via PLANE_ENERGY_ACCEL, and climbing too hard for too
// long past PLANE_STALL_SPEED forces the nose down regardless of mouse input until speed
// recovers — a real stall, not just a soft speed floor.
const PLANE_CRUISE_SPEED = 55; // starting speed
const PLANE_MIN_SPEED = 14;
const PLANE_MAX_SPEED = 105;
const PLANE_STALL_SPEED = 26;
const PLANE_ENERGY_ACCEL = 32; // units/sec^2 gained diving at max pitch, lost climbing at max pitch
const PLANE_STALL_NOSE_DROP_RATE = 0.9; // radians/sec forced pitch-down while stalling
const PLANE_COLLISION_RADIUS = 6; // flying this close to a bot is a fatal mid-air collision
const PLANE_LOOK_SENSITIVITY = 0.0026;
const CAM_MIN_PITCH = -(Math.PI / 2 - 0.08);
const CAM_MAX_PITCH = Math.PI / 2 - 0.08;
const BANK_MAX = 0.6; // radians, purely visual roll on turns

const MISSILE_SPEED = 110;
const MISSILE_TURN_RATE = 1.9; // radians/sec
const MISSILE_LIFETIME_MS = 4200;
const MISSILE_COOLDOWN_MS = 1400;
const MISSILE_HIT_RADIUS = 6;

// Machine gun (left click / touch gun button) — fast, unlimited ammo, weak per hit, so a bot
// takes several rounds instead of the missile's guided one-shot kill.
const BULLET_SPEED = 900; // near-instant hit registration across the whole map
const BULLET_COOLDOWN_MS = 130;
const BULLET_LIFETIME_MS = 1500;
const BULLET_HIT_RADIUS = 4;

const BOT_COUNT = 20;
const BOT_MAX_HP = 3;
const BOT_SPEED_MIN = 0.25, BOT_SPEED_MAX = 0.5; // radians/sec around their patrol circle
const BOT_BULLET_LIFETIME_MS = 3500; // still used by troop-vs-troop bullets, see updateTroopBullets

const PLAYER_MAX_HEALTH = 5;

// Bail out with a parachute, land, keep fighting on foot.
const GROUND_LEVEL = 1;
const DITCH_HALF_SIZE = 4; // matches the 8x8 visual patch in scatterGroundProps
const DITCH_DEPTH = 1.8;
const WALK_SPEED = 12;
const PARACHUTE_DESCENT_SPEED = 9;
const PARACHUTE_MAX_DRIFT = 16;
const GROUND_AREA_RADIUS = 170; // where settlements/forest/ditches scatter, centered on the map
const TOWN_COUNT = 4;
const CITY_COUNT = 2;
const HOUSES_PER_TOWN = 6;
const SKYSCRAPERS_PER_CITY = 7;
const FOREST_TREE_COUNT = 150; // real, collidable, flammable trees
// Purely decorative canopy layer on top of the real trees above — rendered via InstancedMesh (a
// handful of draw calls total, one per color bucket) so density can go way up without the
// per-object cost every other obstacle in this file pays (own mesh, own collision entry, own
// fire-spread bookkeeping). Covers the whole map, not just the forest ring, for a dense-hills
// look from the air, not just up close.
const FOREST_CANOPY_COUNT = 3600;
const FOREST_CANOPY_COLORS = [0x1f4d1a, 0x274f22, 0x2d5a27, 0x35662f, 0x3d6e35, 0x24421e];
// At this count, giving each troop its own real makePersonMesh() (5 sub-meshes, individually
// added to the scene) would mean ~15,000 draw calls — enough to crash/freeze the tab, the exact
// same class of problem as the dynamic-light bug fixed earlier. Troops are rendered via shared
// InstancedMeshes instead (see makeFactionInstancedMeshes/syncTroopInstances) — 4 draw calls
// total (red/blue × body/head) regardless of count — with each troop's own state (position/hp/
// AI/faction) kept as a plain object, no individual Object3D at all.
const TROOPS_PER_FACTION = 1500;
const GROUND_BOT_COUNT = TROOPS_PER_FACTION * 2;
const GROUND_BOT_HP = 2;
const GROUND_BOT_SPEED = 6; // units/sec while wandering toward a waypoint
const GROUND_BOT_STRAFE_SPEED = 3.5; // units/sec sideways movement while engaging a target
const TROOP_ENGAGE_RANGE = 45;
const TROOP_MELEE_RANGE = 3; // close enough to physically collide — melee instead of shooting
const TROOP_MELEE_COOLDOWN_MS = 500;
const TROOP_STRAFE_RANGE = 15; // inside this, hold and strafe; outside it (but still in engage range) keep closing in
const TROOP_RETARGET_INTERVAL_MS = 1500;
const TROOP_BULLET_SPEED = 55;
const TROOP_FIRE_COOLDOWN_MIN = 1200, TROOP_FIRE_COOLDOWN_MAX = 2600;
const TANK_COUNT = 6;
const TANK_SPEED = 14;
const VEHICLE_ENTER_RANGE = 8;
const PARKED_PLANE_COUNT = 6;
const TANK_SHELL_SPEED = 50;
const TANK_SHELL_COOLDOWN_MS = 900;
const TANK_SHELL_BLAST_RADIUS = 14;
const AIM_FOV = 45;
const NORMAL_FOV = 75;
const AIM_SENSITIVITY_SCALE = 0.4;
// Sniper scope zooms in much tighter than onfoot's ADS (SNIPER_FOV 20 vs AIM_FOV 45) — the same
// mouse-pixel-to-yaw/pitch sensitivity sweeps a lot more screen space at that zoom level, so it
// needs its own, lower scale rather than reusing AIM_SENSITIVITY_SCALE (which was previously
// left applying to onfoot only, meaning swinging-aim was actually running at *full* sensitivity
// on top of the tight zoom — the main reason it felt so twitchy).
const SNIPER_SENSITIVITY_SCALE = 0.15;

// Spider-Man role — same physics as public/webswing.js (constants copied over as-is where
// they're geometry-independent), adapted to fighterplane's circular {x,z,radius} obstacles
// instead of webswing's rectangular {x,z,w,d,h} buildings. Reuses this file's existing gun/
// bullets/scoring — the difference from the on-foot role is purely how you get around.
const SWING_GRAVITY = -26;
const SWING_JUMP_VEL = 9;
const SWING_RUN_SPEED = 9;
const WEB_MAX_RANGE = 60;
const SWING_ROPE_MIN = 4;
const SWING_ROPE_MAX = 90;
const SWING_REEL_SPEED = 14;
const SWING_PUMP_ACCEL = 22;
const SWING_MAX_SPEED = 55;
const SWING_CLIMB_OFFSET = 0.5;
const SWING_CLIMB_SPEED = 6;
const SWING_CLIMB_IDLE_SLIDE = -1.4;
const SWING_GRAPPLE_TOP_MARGIN = 4;
const SWING_GRAPPLE_SPEED = 40;
const SWING_PUMP_BUILD_RATE = 0.6;
const SWING_PUMP_DECAY_RATE = 0.8;
const SWING_RELEASE_BOOST_MAX = 1.8;
const SWING_PLAYER_RADIUS = 0.4;

// Fire: a nuke or missile explosion near a flammable structure ignites it; burning structures
// periodically try to ignite flammable neighbors within FIRE_SPREAD_RADIUS, so a single hit on
// one house in a town — or one tree in the forest — can spread for a while before burning out.
const FIRE_SPREAD_RADIUS = 15;
const FIRE_SPREAD_CHECK_INTERVAL_MS = 2000;
const FIRE_SPREAD_CHANCE = 0.4;
const FIRE_BURN_DURATION_MS = 18000;
const IGNITE_RADIUS_MISSILE = 22;

// ---------- Textures ----------
function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#0d3d73');
  grad.addColorStop(0.5, '#3f7fc9');
  grad.addColorStop(1, '#bcd9ee');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  return new THREE.CanvasTexture(c);
}

function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1f3a26';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 128; i += 16) {
    ctx.strokeRect(i, 0, 16, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  return tex;
}

function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------- Scene / camera / renderer ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.5, 1400);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x3f7fc9);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.Mesh(new THREE.SphereGeometry(1000, 16, 16), new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false })));
scene.fog = new THREE.Fog(0x6fa3d8, 260, 950);
scene.add(new THREE.HemisphereLight(0xdff0ff, 0x1f3a26, 1.0));
const sun = new THREE.DirectionalLight(0xfff2d9, 0.9);
sun.position.set(200, 300, 100);
scene.add(sun);

const groundMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(4000, 4000),
  new THREE.MeshLambertMaterial({ map: makeGroundTexture() })
);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.position.y = 0;
scene.add(groundMesh);

// Decorative clouds — sprites, purely visual, no collision.
const cloudTex = makeCloudTexture();
for (let i = 0; i < 40; i++) {
  const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.75, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  const scale = 60 + Math.random() * 100;
  sprite.scale.set(scale, scale * 0.6, 1);
  const angle = Math.random() * Math.PI * 2;
  const dist = 150 + Math.random() * (WORLD_RADIUS * 1.4);
  sprite.position.set(Math.cos(angle) * dist, 40 + Math.random() * 220, Math.sin(angle) * dist);
  scene.add(sprite);
}

// ---------- Mesh builders ----------
function makePlaneMesh(bodyColor, wingColor) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
  const wingMat = new THREE.MeshLambertMaterial({ color: wingColor });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.1, 6, 8), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);

  // Nose points toward local +Z, tail toward local -Z — this looks backwards at a glance since
  // "forward" is usually drawn as -Z, but it matches what Object3D.lookAt() actually does for a
  // non-camera object: unlike Camera/Light, a plain Mesh/Group's lookAt() points local +Z at the
  // target (Matrix4.lookAt is called with the eye/target arguments swapped for that case) — so
  // the nose has to live on +Z for planeGroup.lookAt(pos + forward) to face the plane forward
  // instead of flying tail-first. Same convention applies to makeMissileMesh() below and to bots
  // (they reuse this same function).
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 8), bodyMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 3.7;
  group.add(nose);

  const wings = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.25, 1.6), wingMat);
  wings.position.z = -0.2;
  group.add(wings);

  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 1), wingMat);
  tailWing.position.z = -2.7;
  group.add(tailWing);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 1.3), wingMat);
  fin.position.set(0, 0.8, -2.7);
  group.add(fin);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshLambertMaterial({ color: 0x1a2733 }));
  canopy.position.set(0, 0.55, 0.8);
  canopy.scale.set(1, 0.8, 1.6);
  group.add(canopy);

  return group;
}

function makeMissileMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 2.2, 6),
    new THREE.MeshLambertMaterial({ color: 0xdddddd })
  );
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6), new THREE.MeshLambertMaterial({ color: 0xff5a3d }));
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 1.35;
  group.add(tip);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.5), new THREE.MeshLambertMaterial({ color: 0x888888 }));
  fin.position.z = -0.9;
  group.add(fin);
  const light = new THREE.PointLight(0xff8844, 0.8, 8);
  light.position.z = -1;
  group.add(light);
  return group;
}

function makeBulletMesh() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3b3b })
  );
}

function makePlayerBulletMesh() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe066 })
  );
}

// On-foot figure — same "nose"/forward-facing detail on local +Z as makePlaneMesh(), for the
// same lookAt() reason (see the comment there): a non-camera object's lookAt() points +Z at the
// target, not -Z.
function makePersonMesh(shirtColor) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 0.6), new THREE.MeshLambertMaterial({ color: shirtColor }));
  body.position.y = 1.35;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshLambertMaterial({ color: 0xe0b28a }));
  head.position.y = 2.25;
  group.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), legMat);
  legL.position.set(-0.25, 0.55, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.25;
  group.add(legR);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  gun.position.set(0.35, 1.5, 0.6);
  group.add(gun);
  return group;
}

function makeParachuteMesh() {
  const group = new THREE.Group();
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xff5a3d, side: THREE.DoubleSide })
  );
  canopy.position.y = 4.6;
  group.add(canopy);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
  for (const [x, z] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) {
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 4), lineMat);
    line.position.set(x * 0.7, 3.0, z * 0.7);
    group.add(line);
  }
  return group;
}

// First-person weapon viewmodel — a child of the camera itself (fixed screen position,
// independent of the third-person chase-cam distance) rather than part of personGroup, so it
// stays clearly visible whether hip-firing or aiming down sights.
function makeViewmodelGun() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.85), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
  group.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.62;
  group.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.12), new THREE.MeshLambertMaterial({ color: 0x3a2a1a }));
  grip.position.set(0, -0.18, 0.28);
  group.add(grip);

  // Two simple forearms so it reads as "your character, in first person" holding the gun,
  // not just a floating weapon — skin-toned boxes angled in from off-screen to the grip/barrel.
  const armMat = new THREE.MeshLambertMaterial({ color: 0xe0b28a });
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.7), armMat);
  rightArm.position.set(0.22, -0.28, 0.35);
  rightArm.rotation.y = -0.25;
  group.add(rightArm);
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.6), armMat);
  leftArm.position.set(-0.16, -0.22, -0.15);
  leftArm.rotation.y = 0.35;
  group.add(leftArm);

  return group;
}

function makeHouseMesh() {
  const group = new THREE.Group();
  const wallColor = [0xbf9264, 0xa9a9a9, 0xc2b280][Math.floor(Math.random() * 3)];
  const body = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), new THREE.MeshLambertMaterial({ color: wallColor }));
  body.position.y = 2;
  group.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5, 2.5, 4), new THREE.MeshLambertMaterial({ color: 0x7a3b2e }));
  roof.position.y = 5.25;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
  return group;
}

function makeBarrierMesh() {
  return new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 0.7), new THREE.MeshLambertMaterial({ color: 0x5a5a4a }));
}

// Barrel sits on local +Z — same "+Z is forward" convention as every other lookAt'd entity in
// this file (see makePersonMesh's comment on why).
function makeTankMesh() {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 5), new THREE.MeshLambertMaterial({ color: 0x4a5a3a }));
  hull.position.y = 0.8;
  group.add(hull);
  const turret = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 2.2), new THREE.MeshLambertMaterial({ color: 0x3e4c30 }));
  turret.position.y = 1.8;
  group.add(turret);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 8), new THREE.MeshLambertMaterial({ color: 0x2a331f }));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 1.8, 2.2);
  group.add(barrel);
  return group;
}

function makeSkyscraperTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 64;
  const ctx = c.getContext('2d');
  const cols = 4, rows = 10;
  const cw = 32 / cols, rh = 64 / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = Math.random() < 0.4;
      ctx.fillStyle = lit ? 'rgba(255,221,150,0.9)' : 'rgba(28,34,42,0.95)';
      ctx.fillRect(col * cw + 1, r * rh + 1, cw - 2, rh - 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Returns { mesh, height } — height is needed by the caller (for placing it in `obstacles`/
// `structures` and positioning its fire effect) since it's randomized per instance.
function makeSkyscraperMesh() {
  const height = 22 + Math.random() * 26;
  const width = 5 + Math.random() * 3;
  const tex = makeSkyscraperTexture();
  tex.repeat.set(2, Math.max(1, Math.round(height / 6)));
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, width),
    new THREE.MeshLambertMaterial({ color: 0x8f9bab, map: tex })
  );
  mesh.position.y = height / 2;
  return { mesh, height, width };
}

function makeTreeMesh() {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 6), new THREE.MeshLambertMaterial({ color: 0x5c4025 }));
  trunk.position.y = 1.5;
  group.add(trunk);
  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(1.7 + Math.random() * 0.6, 3.5 + Math.random(), 7),
    new THREE.MeshLambertMaterial({ color: FOREST_CANOPY_COLORS[Math.floor(Math.random() * FOREST_CANOPY_COLORS.length)] })
  );
  foliage.position.y = 4.2;
  group.add(foliage);
  return group;
}

// A small cluster of flame cones + a warm point light, flickered each frame in updateFires().
// Not a real particle system — matches this codebase's existing "cheap procedural effect"
// approach (see spawnExplosion) rather than pulling in a particle library.
function makeFireEffect() {
  const group = new THREE.Group();
  const tiers = [
    { r: 0.65, h: 1.9, color: 0xff4500 },
    { r: 0.45, h: 1.5, color: 0xff8c00 },
    { r: 0.28, h: 1.1, color: 0xffd23f },
  ];
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 6), new THREE.MeshBasicMaterial({ color: t.color, transparent: true, opacity: 0.88 }));
    cone.position.y = i * 0.35;
    group.add(cone);
  }
  if (activeDynamicLights < MAX_DYNAMIC_LIGHTS) {
    const light = new THREE.PointLight(0xff6a00, 2, 26);
    light.position.y = 1;
    group.add(light);
    group.userData.light = light;
    activeDynamicLights++;
  }
  return group;
}

function makeDitchTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2b2116';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, 32, 6);
  ctx.fillRect(0, 26, 32, 6);
  return new THREE.CanvasTexture(c);
}

// ---------- Player plane ----------
const planeGroup = makePlaneMesh(0x2f6fd6, 0xdde6ee);
scene.add(planeGroup);

let planeYaw = 0;
let planePitch = 0;
let planeBank = 0;
let planeSpeed = PLANE_CRUISE_SPEED;
const planePos = new THREE.Vector3(0, 90, -60);

function forwardFromYawPitch(yaw, pitch) {
  return new THREE.Vector3(
    -Math.sin(yaw) * Math.cos(pitch),
    -Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch)
  );
}

// ---------- Missile / control state ----------
let missile = null; // { mesh, yaw, pitch, pos, firedAt }
let missileReadyAt = 0;
let controllingMissile = false;

// ---------- Bots ----------
const bots = [];
function randomPatrol() {
  const angle = Math.random() * Math.PI * 2;
  const dist = 60 + Math.random() * (WORLD_RADIUS * 0.55);
  return {
    centerX: Math.cos(angle) * dist,
    centerZ: Math.sin(angle) * dist,
    radius: 35 + Math.random() * 55,
    altitude: 50 + Math.random() * 150,
    angle: Math.random() * Math.PI * 2,
    speed: (BOT_SPEED_MIN + Math.random() * (BOT_SPEED_MAX - BOT_SPEED_MIN)) * (Math.random() < 0.5 ? 1 : -1),
  };
}

function createBot() {
  const mesh = makePlaneMesh(0xc0392b, 0x2a2a2a);
  scene.add(mesh);
  const patrol = randomPatrol();
  const bot = {
    mesh,
    ...patrol,
    hp: BOT_MAX_HP,
    alive: true,
  };
  return bot;
}

function respawnBot(bot) {
  Object.assign(bot, randomPatrol());
  bot.hp = BOT_MAX_HP;
  bot.alive = true;
  bot.mesh.visible = true;
}

for (let i = 0; i < BOT_COUNT; i++) bots.push(createBot());

// A missile always kills outright (bot.hp forced to 0 first); bullets chip BOT_MAX_HP down one
// at a time — shared here so both weapons' hit-detection loops end a kill the same way.
// Checked once per active bullet per frame — a plain double-loop instead of spreading
// [...bots, ...groundBots] into a new array each call, since with GROUND_BOT_COUNT in the
// thousands that reallocation would otherwise happen 60+ times/sec for no reason.
// Blue troops are teammates — no friendly fire, so every player-caused damage source (this,
// plus the grenade/nuke/tank-shell blast loops) skips bot.faction === 'blue'. Red and the
// unfactioned aerial bots are fair game.
function isFriendlyTroop(bot) {
  return bot.faction === 'blue';
}

function findBotNear(pos, radius) {
  for (const bot of bots) {
    if (bot.alive && pos.distanceTo(bot.mesh.position) <= radius) return bot;
  }
  for (const bot of groundBots) {
    if (bot.alive && !isFriendlyTroop(bot) && pos.distanceTo(bot.mesh.position) <= radius) return bot;
  }
  return null;
}

function destroyBot(bot) {
  bot.alive = false;
  bot.mesh.visible = false;
  // Permadeath for everyone — faction troops need the red/blue counters updated for the win/lose
  // check below; aerial bots have no respawn timer set at all anymore, so updateBots's dead-bot
  // branch just leaves them gone for good.
  if (bot.faction) {
    bot.target = null;
    if (bot.faction === 'red') redAliveCount--; else blueAliveCount--;
  }
  spawnExplosion(bot.mesh.position.clone(), 0xffa64d);
  addScore(1);
  sendScore();
  if (bot.faction) checkWarOutcome();
}

// ---------- Bail out: parachute down, land, fight on foot ----------
// `mode` also determines which of planeGroup/personGroup is visible and which movement function
// runs in the main loop — planePos/planeYaw/planePitch are reused as-is across all three modes
// (whichever mesh is "the player" right now), rather than tracking a separate position per mode.
let mode = 'flying'; // 'flying' | 'parachuting' | 'onfoot' | 'swinging'
// Which role was picked on the start screen — resetGame() (i.e. "Fly Again") returns to this
// same role rather than always resetting back to the fighter pilot.
let startingMode = 'flying'; // 'flying' | 'swinging'
const personGroup = makePersonMesh(0x2f6fd6);
personGroup.visible = false;
scene.add(personGroup);
const parachuteGroup = makeParachuteMesh();
parachuteGroup.visible = false;
scene.add(parachuteGroup);
const parachuteDrift = new THREE.Vector3();

// Viewmodel gun is a child of the camera (see makeViewmodelGun's comment) — the camera itself
// has to be in the scene graph for that child to actually render.
scene.add(camera);
const viewmodelGun = makeViewmodelGun();
viewmodelGun.visible = false;
const GUN_HIP_POS = new THREE.Vector3(0.32, -0.28, -0.7);
const GUN_AIM_POS = new THREE.Vector3(0, -0.14, -0.45);
viewmodelGun.position.copy(GUN_HIP_POS);
camera.add(viewmodelGun);

// ---------- Spider-Man role: third-person body + web strand ----------
const spideyGroup = makePersonMesh(0xcc2222);
spideyGroup.visible = false;
scene.add(spideyGroup);

function makeWebStrandMesh() {
  const geo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color: 0xf5f7ff, transparent: true, opacity: 0.92 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  return mesh;
}
const webStrand = makeWebStrandMesh();
scene.add(webStrand);
const WEB_STRAND_UP_AXIS = new THREE.Vector3(0, 1, 0);
function updateWebStrand(strand, from, to) {
  if (!to) { strand.visible = false; return; }
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.05) { strand.visible = false; return; }
  strand.visible = true;
  strand.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  strand.scale.set(1, len, 1);
  strand.quaternion.setFromUnitVectors(WEB_STRAND_UP_AXIS, new THREE.Vector3(dx / len, dy / len, dz / len));
}

// vx/vy/vz are real velocity (gravity-integrated), unlike planePos which every other role just
// sets directly — swinging/climbing/grappling all drive position through this instead.
const spidey = {
  vx: 0, vy: 0, vz: 0,
  grounded: true,
  swinging: false, anchor: null, ropeLen: 0, pumpMomentum: 0,
  climbing: false, climbObstacle: null, climbAngle: 0, climbRadius: 0,
  grappling: false, grappleTarget: null,
};

function randomGroundSpot(spread = GROUND_AREA_RADIUS) {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * spread;
  return { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist };
}

function randomPointNear(cx, cz, spread) {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * spread;
  return { x: cx + Math.cos(angle) * dist, z: cz + Math.sin(angle) * dist };
}

// Settlements are just placement anchors ({x,z,radius,type}) — troops (ground bots) spawn and
// patrol around whichever one they're assigned to, see randomTroopSpot(). The actual buildings
// live in `obstacles` alongside everything else solid.
const settlements = []; // { x, z, radius, type: 'town' | 'city' }

// Every solid thing on the ground: houses, skyscrapers, barriers, trees. One shared shape so
// movement collision (resolveObstacleCollisions), bullet blocking (bulletBlockedByObstacle), and
// fire spread (updateFires) can all just iterate this one array instead of three separate ones —
// `blocksBullets`/`flammable` are false/absent on the entries that don't apply (e.g. barriers
// don't burn, trees don't block bullets).
const obstacles = []; // { mesh, x, z, radius, blockHeight, blocksBullets, flammable, burning, burnedOut, ignitedAt, lastSpreadCheckAt, fireEffect, fireHeight }
const ditches = []; // { x, z } — square footprint, side length DITCH_HALF_SIZE*2

// Captured per flammable structure at creation so extinguishStructure's blackening can be
// undone on a game restart (resetGame) instead of leaving burnt buildings permanently scorched.
function captureColors(root) {
  const entries = [];
  root.traverse((child) => {
    if (child.isMesh && child.material && child.material.color) {
      entries.push({ material: child.material, color: child.material.color.clone() });
    }
  });
  return entries;
}

function scatterGroundProps() {
  for (let i = 0; i < TOWN_COUNT; i++) {
    const c = randomGroundSpot();
    settlements.push({ x: c.x, z: c.z, radius: 26, type: 'town' });
    for (let j = 0; j < HOUSES_PER_TOWN; j++) {
      const spot = randomPointNear(c.x, c.z, 22);
      const mesh = makeHouseMesh();
      mesh.position.set(spot.x, 0, spot.z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      scene.add(mesh);
      obstacles.push({
        mesh, x: spot.x, z: spot.z, radius: 4.6, blockHeight: 5.5, blocksBullets: true, climbable: true,
        flammable: true, burning: false, burnedOut: false, ignitedAt: 0, lastSpreadCheckAt: 0, fireEffect: null, fireHeight: 3,
        originalColors: captureColors(mesh),
      });
    }
  }
  for (let i = 0; i < CITY_COUNT; i++) {
    const c = randomGroundSpot();
    settlements.push({ x: c.x, z: c.z, radius: 34, type: 'city' });
    for (let j = 0; j < SKYSCRAPERS_PER_CITY; j++) {
      const spot = randomPointNear(c.x, c.z, 28);
      const { mesh, height, width } = makeSkyscraperMesh();
      mesh.position.x = spot.x;
      mesh.position.z = spot.z;
      scene.add(mesh);
      obstacles.push({
        mesh, x: spot.x, z: spot.z, radius: width * 0.75, blockHeight: height, blocksBullets: true, climbable: true,
        flammable: true, burning: false, burnedOut: false, ignitedAt: 0, lastSpreadCheckAt: 0, fireEffect: null, fireHeight: height * 0.5,
        originalColors: captureColors(mesh),
      });
    }
  }
  for (let i = 0; i < 30; i++) {
    const spot = randomGroundSpot();
    const mesh = makeBarrierMesh();
    mesh.position.set(spot.x, 0.6, spot.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(mesh);
    obstacles.push({ mesh, x: spot.x, z: spot.z, radius: 1.9, blockHeight: 1.2, blocksBullets: true, flammable: false });
  }
  // Forest fills the rest of the map — skipped near a settlement center so towns/cities stay clear.
  let treesPlaced = 0, attempts = 0;
  while (treesPlaced < FOREST_TREE_COUNT && attempts < FOREST_TREE_COUNT * 4) {
    attempts++;
    const spot = randomGroundSpot();
    if (settlements.some((s) => Math.hypot(spot.x - s.x, spot.z - s.z) < s.radius + 8)) continue;
    const mesh = makeTreeMesh();
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(mesh);
    obstacles.push({
      mesh, x: spot.x, z: spot.z, radius: 1.3, blockHeight: 5, blocksBullets: false,
      flammable: true, burning: false, burnedOut: false, ignitedAt: 0, lastSpreadCheckAt: 0, fireEffect: null, fireHeight: 3,
      originalColors: captureColors(mesh),
    });
    treesPlaced++;
  }
  const ditchTex = makeDitchTexture();
  for (let i = 0; i < 10; i++) {
    const spot = randomGroundSpot();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshLambertMaterial({ map: ditchTex }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(spot.x, 0.04, spot.z);
    scene.add(mesh);
    ditches.push({ x: spot.x, z: spot.z });
  }
}

// Decorative-only dense canopy (see FOREST_CANOPY_COUNT's comment) — one InstancedMesh per
// color bucket, covering the whole map so it reads as rolling forested hills from the air, not
// just a ring around the settlements like the real (collidable/flammable) trees above.
function scatterForestCanopy() {
  const perBatch = Math.ceil(FOREST_CANOPY_COUNT / FOREST_CANOPY_COLORS.length);
  const dummy = new THREE.Object3D();
  for (const color of FOREST_CANOPY_COLORS) {
    const geo = new THREE.ConeGeometry(1.6, 3.6, 6);
    const mat = new THREE.MeshLambertMaterial({ color });
    const inst = new THREE.InstancedMesh(geo, mat, perBatch);
    let placed = 0, attempts = 0;
    while (placed < perBatch && attempts < perBatch * 3) {
      attempts++;
      const spot = randomGroundSpot(WORLD_RADIUS);
      if (settlements.some((s) => Math.hypot(spot.x - s.x, spot.z - s.z) < s.radius + 6)) continue;
      const scale = 0.7 + Math.random() * 0.9;
      dummy.position.set(spot.x, 1.8 * scale, spot.z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      inst.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);
  }
}

scatterGroundProps();
scatterForestCanopy();

// ---------- Obstacle spatial grid — resolveObstacleCollisions/bulletBlockedByObstacle used to
// scan every one of the ~200 obstacles on every call, and with up to 3000 troops each calling
// resolveObstacleCollisions every single frame, that was ~600k distance checks/frame just for
// that one thing (the single biggest source of lag once the faction war went in). Obstacles never
// move (only their burn state changes), so a uniform grid built once is safe for the whole
// session — every real obstacle radius tops out around 6 (skyscrapers), so a 30-unit cell with a
// 3x3 neighborhood search is comfortably wide enough to never miss a real collision. ----------
const OBSTACLE_CELL_SIZE = 30;
const obstacleGrid = new Map(); // "cx,cz" -> obstacle[]
function buildObstacleGrid() {
  obstacleGrid.clear();
  for (const o of obstacles) {
    const key = Math.floor(o.x / OBSTACLE_CELL_SIZE) + ',' + Math.floor(o.z / OBSTACLE_CELL_SIZE);
    let cell = obstacleGrid.get(key);
    if (!cell) { cell = []; obstacleGrid.set(key, cell); }
    cell.push(o);
  }
}
buildObstacleGrid();

// Reused scratch array (cleared and refilled synchronously each call, never held across calls) —
// avoids allocating a fresh array on every one of the thousands of calls/frame this feeds.
const _nearbyObstacleScratch = [];
function getNearbyObstacles(x, z) {
  _nearbyObstacleScratch.length = 0;
  const cx = Math.floor(x / OBSTACLE_CELL_SIZE), cz = Math.floor(z / OBSTACLE_CELL_SIZE);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const cell = obstacleGrid.get((cx + dx) + ',' + (cz + dz));
      if (cell) for (const o of cell) _nearbyObstacleScratch.push(o);
    }
  }
  return _nearbyObstacleScratch;
}

function randomTroopSpot() {
  if (settlements.length === 0) return randomGroundSpot();
  const s = settlements[Math.floor(Math.random() * settlements.length)];
  return randomPointNear(s.x, s.z, s.radius * 0.8);
}

function groundHeightAt(x, z) {
  for (const d of ditches) {
    if (Math.abs(x - d.x) <= DITCH_HALF_SIZE && Math.abs(z - d.z) <= DITCH_HALF_SIZE) {
      return GROUND_LEVEL - DITCH_DEPTH;
    }
  }
  return GROUND_LEVEL;
}

function resolveObstacleCollisions(pos) {
  for (const o of getNearbyObstacles(pos.x, pos.z)) {
    const dx = pos.x - o.x, dz = pos.z - o.z;
    const dist = Math.hypot(dx, dz);
    const minDist = o.radius + 0.6;
    if (dist > 0.0001 && dist < minDist) {
      const push = minDist - dist;
      pos.x += (dx / dist) * push;
      pos.z += (dz / dist) * push;
    }
  }
}

function bulletBlockedByObstacle(pos) {
  for (const o of getNearbyObstacles(pos.x, pos.z)) {
    if (!o.blocksBullets || pos.y > o.blockHeight) continue;
    if (Math.hypot(pos.x - o.x, pos.z - o.z) <= o.radius) return true;
  }
  return false;
}

// ---------- Fire (nuke/missile explosions near a flammable structure ignite it, and it can
// spread from there to its flammable neighbors — houses, skyscrapers, and the forest all share
// the same `flammable`/`burning` fields on their `obstacles` entry above) ----------
function igniteStructure(o) {
  if (!o.flammable || o.burning || o.burnedOut) return;
  const now = performance.now();
  o.burning = true;
  o.ignitedAt = now;
  o.lastSpreadCheckAt = now;
  o.fireEffect = makeFireEffect();
  o.fireEffect.position.set(o.x, o.fireHeight, o.z);
  scene.add(o.fireEffect);
}

function extinguishStructure(o) {
  o.burning = false;
  o.burnedOut = true;
  if (o.fireEffect) {
    if (o.fireEffect.userData.light) activeDynamicLights--;
    scene.remove(o.fireEffect);
    o.fireEffect = null;
  }
  o.mesh.traverse((child) => {
    if (child.isMesh && child.material && child.material.color) child.material.color.set(0x211d1a);
  });
}

function igniteNearby(position, radius) {
  for (const o of obstacles) {
    if (Math.hypot(position.x - o.x, position.z - o.z) <= radius) igniteStructure(o);
  }
}

function updateFires(now) {
  for (const o of obstacles) {
    if (!o.burning) continue;
    const flicker = 0.85 + Math.sin(now * 0.02 + o.x) * 0.15 + Math.random() * 0.08;
    o.fireEffect.scale.set(flicker, flicker, flicker);
    if (o.fireEffect.userData.light) o.fireEffect.userData.light.intensity = 1.6 + Math.random() * 1.2;
    if (now - o.ignitedAt > FIRE_BURN_DURATION_MS) {
      extinguishStructure(o);
      continue;
    }
    if (now >= o.lastSpreadCheckAt + FIRE_SPREAD_CHECK_INTERVAL_MS) {
      o.lastSpreadCheckAt = now;
      for (const other of obstacles) {
        if (other === o || !other.flammable || other.burning || other.burnedOut) continue;
        if (Math.hypot(o.x - other.x, o.z - other.z) <= FIRE_SPREAD_RADIUS && Math.random() < FIRE_SPREAD_CHANCE) {
          igniteStructure(other);
        }
      }
    }
  }
}

// ---------- Faction war: TROOPS_PER_FACTION red vs. TROOPS_PER_FACTION blue, fighting each
// other. Blue is the player's side (never targeted by blue fire, only ever fires at red); red
// targets both blue troops and the player. Win by wiping out red, lose if blue is wiped out
// first — see checkWarOutcome() (called from destroyBot). No individual meshes per troop (see
// GROUND_BOT_COUNT's comment) — 4 shared InstancedMeshes (red/blue × body/head), 4 draw calls
// total regardless of headcount. Troops are permadeath (no respawn) so the war can actually end.
const RED_HOME = { x: -GROUND_AREA_RADIUS * 0.8, z: 0 };
const BLUE_HOME = { x: GROUND_AREA_RADIUS * 0.8, z: 0 };
const FACTION_SPAWN_SPREAD = GROUND_AREA_RADIUS * 0.6;

const troopDummy = new THREE.Object3D();
function makeFactionInstancedMeshes(count, bodyColor) {
  const bodyMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.5, 0.6), new THREE.MeshLambertMaterial({ color: bodyColor }), count);
  const headMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.4, 6, 5), new THREE.MeshLambertMaterial({ color: 0xe0b28a }), count);
  scene.add(bodyMesh, headMesh);
  return { bodyMesh, headMesh };
}
const redTroopMeshes = makeFactionInstancedMeshes(TROOPS_PER_FACTION, 0xc0392b);
const blueTroopMeshes = makeFactionInstancedMeshes(TROOPS_PER_FACTION, 0x2f6fd6);

// groundBots is the combined view every generic system (findBotNear for the player's own gun,
// nuke, grenade, resetGame) already expects; redTroops/blueTroops are the same objects by
// reference, split out so findNearbyEnemy/syncTroopInstances don't have to filter 3000 entries
// by faction on every call.
const groundBots = [];
const redTroops = [];
const blueTroops = [];
let redAliveCount = TROOPS_PER_FACTION;
let blueAliveCount = TROOPS_PER_FACTION;
// Both sides stay peaceful (wander near home, no target-seeking, no firing, no melee, no red fire
// on the player) until the player gives the order — see the "⚔️ Attack" button/startWar(). Once
// it flips, both factions' AI runs unconditionally the same as each other; there's no separate
// "only red retaliates once personally shot" state to track, war is just on or off.
let warStarted = false;

// `mesh` is a duck-typed stand-in (a real THREE.Vector3 position + a visible flag), not a scene
// object — every place elsewhere in this file that reads bot.mesh.position/.visible (destroyBot,
// bullet hit-detection, nuke/grenade radius checks) keeps working unmodified; `angle` replaces
// the .lookAt() calls those meshless bots can't do themselves, consumed by syncTroopInstances().
function createFactionTroop(faction, factionIndex) {
  const home = faction === 'red' ? RED_HOME : BLUE_HOME;
  const spot = randomPointNear(home.x, home.z, FACTION_SPAWN_SPREAD);
  return {
    faction, factionIndex,
    mesh: { position: new THREE.Vector3(spot.x, GROUND_LEVEL, spot.z), visible: true },
    angle: 0,
    hp: GROUND_BOT_HP,
    alive: true,
    target: null,
    nextTargetScanAt: 0,
    nextFireAt: performance.now() + 1000 + Math.random() * 2000,
    waypoint: randomPointNear(home.x, home.z, FACTION_SPAWN_SPREAD),
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    nextStrafeFlipAt: 0,
    // A handful of blue troops (more candidates than planes, since not every candidate will be
    // near an unclaimed plane at any given moment) skip combat AI entirely in favor of making a
    // beeline for the nearest unclaimed parked plane — see the isPilotCandidate branch in
    // updateGroundBots and boardPlane(). Red has no equivalent; only blue has planes to fly.
    isPilotCandidate: faction === 'blue' && factionIndex < PARKED_PLANE_COUNT * 3,
  };
}
for (let i = 0; i < TROOPS_PER_FACTION; i++) { const t = createFactionTroop('red', i); redTroops.push(t); groundBots.push(t); }
for (let i = 0; i < TROOPS_PER_FACTION; i++) { const t = createFactionTroop('blue', i); blueTroops.push(t); groundBots.push(t); }

function resetFactionTroop(bot) {
  const home = bot.faction === 'red' ? RED_HOME : BLUE_HOME;
  const spot = randomPointNear(home.x, home.z, FACTION_SPAWN_SPREAD);
  bot.mesh.position.set(spot.x, GROUND_LEVEL, spot.z);
  bot.hp = GROUND_BOT_HP;
  bot.alive = true;
  bot.mesh.visible = true;
  bot.target = null;
  bot.nextTargetScanAt = 0;
  bot.nextFireAt = performance.now() + 1000 + Math.random() * 2000;
  bot.waypoint = randomPointNear(home.x, home.z, FACTION_SPAWN_SPREAD);
  bot.nextStrafeFlipAt = 0;
}

// Writes every troop's current position/angle/visibility into its faction's InstancedMeshes —
// one CPU matrix-compose per troop (cheap: plain arithmetic, no draw call), then one GPU buffer
// upload per mesh. Dead troops are scaled to 0 instead of truly removed, which is what "hides"
// them (there's no per-instance visibility flag on InstancedMesh, only the shared material/count).
function syncTroopInstances() {
  for (const bot of groundBots) {
    const meshes = bot.faction === 'red' ? redTroopMeshes : blueTroopMeshes;
    const scale = bot.mesh.visible ? 1 : 0;
    troopDummy.position.copy(bot.mesh.position);
    troopDummy.position.y += 1.35;
    troopDummy.rotation.set(0, bot.angle, 0);
    troopDummy.scale.set(scale, scale, scale);
    troopDummy.updateMatrix();
    meshes.bodyMesh.setMatrixAt(bot.factionIndex, troopDummy.matrix);

    troopDummy.position.copy(bot.mesh.position);
    troopDummy.position.y += 2.25;
    troopDummy.updateMatrix();
    meshes.headMesh.setMatrixAt(bot.factionIndex, troopDummy.matrix);
  }
  redTroopMeshes.bodyMesh.instanceMatrix.needsUpdate = true;
  redTroopMeshes.headMesh.instanceMatrix.needsUpdate = true;
  blueTroopMeshes.bodyMesh.instanceMatrix.needsUpdate = true;
  blueTroopMeshes.headMesh.instanceMatrix.needsUpdate = true;
}

// Random-sample instead of exhaustive search — with 1500 troops per side, scanning the whole
// enemy array for every troop on every retarget would be up to 1500x1500 checks. Sampling a
// handful of random enemies and taking the nearest of those is a standard large-scale-sim
// shortcut: cheap and "good enough" (not guaranteed-globally-nearest), same trade-off
// findBotNear's per-bullet checks make in the other direction (exact, but only ever O(1) per
// bullet since each one only ever checks its own fixed target — see fireTroopBullet).
const TROOP_TARGET_SCAN_SAMPLE = 10;
function findNearbyEnemy(bot) {
  const enemyArray = bot.faction === 'red' ? blueTroops : redTroops;
  if (enemyArray.length === 0) return null;
  let best = null, bestDist = Infinity;
  for (let i = 0; i < TROOP_TARGET_SCAN_SAMPLE; i++) {
    const candidate = enemyArray[Math.floor(Math.random() * enemyArray.length)];
    if (!candidate.alive) continue;
    const d = bot.mesh.position.distanceTo(candidate.mesh.position);
    if (d < bestDist) { bestDist = d; best = candidate; }
  }
  return best;
}

// Troop-vs-troop fire — a separate array/update loop from the player-facing `bullets` (aerial +
// ground bots' fire at the player), since these follow a fixed target rather than the player.
// Hit-testing only ever checks that one target (O(1) per bullet, not a scan of the whole enemy
// array) — the bullet just does nothing if its target died before it arrived. Capped hard at
// MAX_TROOP_BULLETS: at up to ~1500 troops per side all in a firefight at once, an uncapped
// bullet count could climb into the thousands simultaneously, same class of runaway-growth risk
// the dynamic-light cap exists for.
const troopBullets = [];
const MAX_TROOP_BULLETS = 400;
function fireTroopBullet(bot, direction, target) {
  if (troopBullets.length >= MAX_TROOP_BULLETS) return;
  const mesh = makeBulletMesh();
  const pos = bot.mesh.position.clone().addScaledVector(direction, 1.5);
  mesh.position.copy(pos);
  scene.add(mesh);
  troopBullets.push({ mesh, pos, vel: direction.clone().multiplyScalar(TROOP_BULLET_SPEED), spawnedAt: performance.now(), faction: bot.faction, target });
}

function updateTroopBullets(dt) {
  const now = performance.now();
  for (let i = troopBullets.length - 1; i >= 0; i--) {
    const b = troopBullets[i];
    b.pos.addScaledVector(b.vel, dt);
    b.mesh.position.copy(b.pos);
    if (now - b.spawnedAt > BOT_BULLET_LIFETIME_MS || bulletBlockedByObstacle(b.pos)) {
      scene.remove(b.mesh);
      troopBullets.splice(i, 1);
      continue;
    }
    if (b.target && b.target.alive && b.pos.distanceTo(b.target.mesh.position) <= BULLET_HIT_RADIUS) {
      b.target.hp -= 1;
      if (b.target.hp <= 0) destroyBot(b.target);
      scene.remove(b.mesh);
      troopBullets.splice(i, 1);
    }
  }
}

// Wandering when no enemy's in range (forward movement toward a random waypoint near home,
// re-picking on arrival, same obstacle push-out the player uses); once a target's found (a
// sampled enemy troop, or — for red only — the player, checked directly since the player isn't
// in blueTroops for findNearbyEnemy to sample), advance on it until in range, then plant, turn
// to face it, fire, and strafe sideways (flipping direction every couple seconds) rather than
// standing dead still.
function updateGroundBots(dt) {
  const now = performance.now();
  for (const bot of groundBots) {
    if (!bot.alive) continue; // permadeath — the war needs to actually be able to end

    if (bot.isPilotCandidate) {
      const plane = findNearestUnclaimedPlane(bot.mesh.position);
      if (plane) {
        const dx = plane.x - bot.mesh.position.x, dz = plane.z - bot.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= VEHICLE_ENTER_RANGE) {
          boardPlane(bot, plane);
        } else {
          const dirX = dx / dist, dirZ = dz / dist;
          bot.mesh.position.x += dirX * GROUND_BOT_SPEED * dt;
          bot.mesh.position.z += dirZ * GROUND_BOT_SPEED * dt;
          resolveObstacleCollisions(bot.mesh.position);
          bot.angle = Math.atan2(dirX, dirZ);
          bot.mesh.position.y += (groundHeightAt(bot.mesh.position.x, bot.mesh.position.z) - bot.mesh.position.y) * Math.min(1, dt * 6);
        }
        continue;
      }
      // No unclaimed plane anywhere on the map right now — fight like any other blue trooper
      // instead of standing around, falling through to the normal target-seek logic below.
    }

    let target = warStarted ? bot.target : null;
    if (target && (!target.alive || bot.mesh.position.distanceTo(target.mesh.position) > TROOP_ENGAGE_RANGE * 1.6)) {
      target = null;
      bot.target = null;
    }
    if (warStarted && !target && now >= bot.nextTargetScanAt) {
      bot.nextTargetScanAt = now + TROOP_RETARGET_INTERVAL_MS + Math.random() * 500;
      target = findNearbyEnemy(bot);
      bot.target = target;
    }

    if (target) {
      const toTarget = target.mesh.position.clone().sub(bot.mesh.position);
      toTarget.y = 0;
      const dist = toTarget.length();
      if (dist > 0.001) toTarget.normalize();
      bot.angle = Math.atan2(toTarget.x, toTarget.z);
      if (dist <= TROOP_MELEE_RANGE) {
        // Close enough to physically collide — a direct melee hit instead of shooting, so two
        // opposing troops that run straight into each other still fight it out even if a bullet
        // never landed (guarantees the war always resolves, not just when shots connect).
        if (now >= bot.nextFireAt) {
          target.hp -= 1;
          if (target.hp <= 0) destroyBot(target);
          bot.nextFireAt = now + TROOP_MELEE_COOLDOWN_MS;
        }
      } else if (dist <= TROOP_ENGAGE_RANGE) {
        if (now >= bot.nextFireAt) {
          fireTroopBullet(bot, toTarget, target);
          bot.nextFireAt = now + TROOP_FIRE_COOLDOWN_MIN + Math.random() * (TROOP_FIRE_COOLDOWN_MAX - TROOP_FIRE_COOLDOWN_MIN);
        }
        if (dist <= TROOP_STRAFE_RANGE) {
          // Close range: strafe sideways instead of closing further, but drift can still carry
          // them into TROOP_MELEE_RANGE naturally.
          if (now >= bot.nextStrafeFlipAt) {
            bot.strafeDir *= -1;
            bot.nextStrafeFlipAt = now + 1500 + Math.random() * 2000;
          }
          const strafeRight = new THREE.Vector3(-toTarget.z, 0, toTarget.x);
          bot.mesh.position.x += strafeRight.x * bot.strafeDir * GROUND_BOT_STRAFE_SPEED * dt;
          bot.mesh.position.z += strafeRight.z * bot.strafeDir * GROUND_BOT_STRAFE_SPEED * dt;
        } else {
          // Still outside strafe range: keep closing the distance while shooting, rather than
          // planting at the very edge of TROOP_ENGAGE_RANGE — troops actually push into each
          // other's faces instead of trading fire from a static line.
          bot.mesh.position.x += toTarget.x * GROUND_BOT_SPEED * dt;
          bot.mesh.position.z += toTarget.z * GROUND_BOT_SPEED * dt;
        }
      } else {
        bot.mesh.position.x += toTarget.x * GROUND_BOT_SPEED * dt;
        bot.mesh.position.z += toTarget.z * GROUND_BOT_SPEED * dt;
      }
      resolveObstacleCollisions(bot.mesh.position);
      bot.mesh.position.y += (groundHeightAt(bot.mesh.position.x, bot.mesh.position.z) - bot.mesh.position.y) * Math.min(1, dt * 6);
      continue;
    }

    const toWaypoint = new THREE.Vector3(bot.waypoint.x - bot.mesh.position.x, 0, bot.waypoint.z - bot.mesh.position.z);
    const dist = toWaypoint.length();
    if (dist < 2) {
      // At peace: loiter near your own home. At war: push into the enemy's territory instead of
      // picking a fresh spot near home — this only matters for the brief gap between losing a
      // target and the next retarget scan finding a new one, since a live target always takes
      // over movement above, but it keeps that gap from reading as "wandering home" mid-battle.
      const dest = warStarted
        ? (bot.faction === 'red' ? BLUE_HOME : RED_HOME)
        : (bot.faction === 'red' ? RED_HOME : BLUE_HOME);
      bot.waypoint = randomPointNear(dest.x, dest.z, FACTION_SPAWN_SPREAD);
    } else {
      toWaypoint.normalize();
      bot.mesh.position.x += toWaypoint.x * GROUND_BOT_SPEED * dt;
      bot.mesh.position.z += toWaypoint.z * GROUND_BOT_SPEED * dt;
      resolveObstacleCollisions(bot.mesh.position);
      bot.angle = Math.atan2(toWaypoint.x, toWaypoint.z);
    }
    bot.mesh.position.y += (groundHeightAt(bot.mesh.position.x, bot.mesh.position.z) - bot.mesh.position.y) * Math.min(1, dt * 6);
  }
  syncTroopInstances();
}

function checkWarOutcome() {
  if (!gameStarted) return;
  if (redAliveCount <= 0) {
    gameStarted = false;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    gameoverText.textContent = `🎉 Victory! Every red trooper is down. Final score: ${score}`;
    gameoverOverlay.classList.remove('hidden');
    playSound('gameover');
    sendScore();
  } else if (blueAliveCount <= 0) {
    gameStarted = false;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    gameoverText.textContent = `💀 Defeat — the blues have been wiped out. Final score: ${score}`;
    gameoverOverlay.classList.remove('hidden');
    playSound('gameover');
    sendScore();
  }
}

// ---------- Vehicles: tanks scattered across the map, planes parked near blue's home. Both use
// the same E-to-enter/E-to-exit interaction from on foot — see tryEnterVehicle/exitTank/
// exitPlane and the KeyE handler. Planes reuse the single shared planeGroup/updatePlane (already
// wired for the whole flying role) rather than each parked plane being independently flyable —
// the parked mesh just hides itself and hands off to planeGroup on entry, and reappears
// wherever you land on exit. Tanks have no such shared singleton, so each one *is* directly
// player-controlled in place once entered (see updateTank). ----------
const vehicles = []; // { type: 'tank' | 'plane', mesh, x, z, occupied }
let activeTank = null;
let activePlaneSlot = null;

function scatterVehicles() {
  for (let i = 0; i < TANK_COUNT; i++) {
    const spot = randomGroundSpot();
    const mesh = makeTankMesh();
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(mesh);
    vehicles.push({ type: 'tank', mesh, x: spot.x, z: spot.z, occupied: false });
  }
  for (let i = 0; i < PARKED_PLANE_COUNT; i++) {
    // Parked out among the trees on blue's side, not in an open clearing — reject spots too
    // close to a settlement (same rule the real forest trees use) and too close to any obstacle,
    // so the plane actually sits in the forest rather than clipping into a house or trunk.
    let spot, attempts = 0;
    do {
      spot = randomPointNear(BLUE_HOME.x, BLUE_HOME.z, FACTION_SPAWN_SPREAD);
      attempts++;
    } while (
      attempts < 30 &&
      (settlements.some((s) => Math.hypot(spot.x - s.x, spot.z - s.z) < s.radius + 12) ||
        obstacles.some((o) => Math.hypot(spot.x - o.x, spot.z - o.z) < o.radius + 6))
    );
    const mesh = makePlaneMesh(0x2f6fd6, 0xdde6ee);
    mesh.position.set(spot.x, 1.2, spot.z);
    scene.add(mesh);
    vehicles.push({ type: 'plane', mesh, x: spot.x, z: spot.z, occupied: false, pilotBot: null });
  }
}
scatterVehicles();

function tryEnterVehicle() {
  if (!gameStarted || mode !== 'onfoot') return;
  let nearest = null, nearestDist = VEHICLE_ENTER_RANGE;
  for (const v of vehicles) {
    if (v.occupied) continue;
    const d = Math.hypot(planePos.x - v.x, planePos.z - v.z);
    if (d < nearestDist) { nearestDist = d; nearest = v; }
  }
  if (!nearest) return;
  nearest.occupied = true;
  personGroup.visible = false;
  viewmodelGun.visible = false;

  if (nearest.type === 'tank') {
    activeTank = nearest;
    mode = 'tank';
    planePos.set(nearest.x, GROUND_LEVEL, nearest.z);
    missileStatusEl.textContent = '🎯 Tank — left click: shell, E: exit';
  } else {
    activePlaneSlot = nearest;
    nearest.mesh.visible = false; // the shared planeGroup takes over from here, see updatePlane
    planeGroup.visible = true;
    planePos.set(nearest.x, 1.2, nearest.z);
    // Keep whatever heading the player was already facing on foot rather than snapping to 0 —
    // spinning the plane to face a fixed direction on entry would be jarring and could point
    // it straight at an obstacle.
    planePitch = 0;
    planeBank = 0;
    planeSpeed = PLANE_CRUISE_SPEED;
    mode = 'flying';
    updateMissileStatusHud();
  }
  missileStatusEl.className = '';
  updateTouchStickVisibility();
  playSound('fire');
}

function exitTank() {
  if (mode !== 'tank' || !activeTank) return;
  activeTank.occupied = false;
  activeTank = null;
  mode = 'onfoot';
  viewmodelGun.visible = true;
  missileStatusEl.textContent = '🔫 On foot — shoot, aim, F to call your plane';
  missileStatusEl.className = '';
  updateTouchStickVisibility();
}

// Parks the plane wherever you land, not back at its original spot — the placeholder mesh (and
// its tryEnterVehicle-checked x/z) move to match, so the *next* person to walk up finds it where
// you actually left it.
function exitPlane() {
  if (mode !== 'flying' || controllingMissile) return;
  mode = 'onfoot';
  planePos.y = groundHeightAt(planePos.x, planePos.z);
  planeGroup.visible = false;
  viewmodelGun.visible = true;
  if (activePlaneSlot) {
    activePlaneSlot.occupied = false;
    activePlaneSlot.x = planePos.x;
    activePlaneSlot.z = planePos.z;
    activePlaneSlot.mesh.position.set(planePos.x, 1.2, planePos.z);
    activePlaneSlot.mesh.rotation.y = planeYaw;
    activePlaneSlot.mesh.visible = true;
    activePlaneSlot = null;
  }
  missileStatusEl.textContent = '🔫 On foot — shoot, aim, F to call your plane';
  missileStatusEl.className = '';
  updateTouchStickVisibility();
}

function updateTank(dt) {
  const forward = forwardFromYawPitch(planeYaw, 0);
  forward.y = 0;
  if (forward.lengthSq() > 0) forward.normalize();
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  let moveZ = 0, moveX = 0;
  if (keys.KeyW) moveZ += 1;
  if (keys.KeyS) moveZ -= 1;
  if (keys.KeyD) moveX += 1;
  if (keys.KeyA) moveX -= 1;
  if (isTouchDevice) { moveZ -= touchMissileY; moveX += touchMissileX; }
  const move = new THREE.Vector3().addScaledVector(forward, moveZ).addScaledVector(right, moveX);
  if (move.lengthSq() > 0) move.normalize().multiplyScalar(TANK_SPEED * dt);
  planePos.x += move.x;
  planePos.z += move.z;
  resolveObstacleCollisions(planePos);
  clampToWorldBounds(planePos);
  planePos.y = groundHeightAt(planePos.x, planePos.z);
  if (activeTank) {
    activeTank.mesh.position.copy(planePos);
    const lookFwd = forwardFromYawPitch(planeYaw, planePitch);
    activeTank.mesh.lookAt(planePos.clone().add(new THREE.Vector3(lookFwd.x, 0, lookFwd.z)));
  }
}

// ---------- Tank cannon: left click fires an explosive shell (arcs slightly, blast-radius
// damage on impact) instead of the regular machine gun while driving. ----------
const tankShells = [];
let tankShellReadyAt = 0;
function fireTankShell() {
  if (!gameStarted || mode !== 'tank') return;
  const now = performance.now();
  if (now < tankShellReadyAt) return;
  tankShellReadyAt = now + TANK_SHELL_COOLDOWN_MS;
  const forward = forwardFromYawPitch(planeYaw, planePitch);
  const pos = planePos.clone().addScaledVector(forward, 4);
  pos.y += 1.8;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
  mesh.position.copy(pos);
  scene.add(mesh);
  tankShells.push({ mesh, pos, vel: forward.clone().multiplyScalar(TANK_SHELL_SPEED), spawnedAt: now });
  playSound('fire');
}

function explodeTankShell(s) {
  scene.remove(s.mesh);
  for (const bot of [...bots, ...groundBots]) {
    if (!bot.alive || isFriendlyTroop(bot)) continue;
    if (s.pos.distanceTo(bot.mesh.position) <= TANK_SHELL_BLAST_RADIUS) {
      bot.hp = 0;
      destroyBot(bot);
    }
  }
  spawnExplosion(s.pos, 0xffa64d, 22, 550, 5);
  igniteNearby(s.pos, 22);
  playSound('explosion');
}

function updateTankShells(dt) {
  const now = performance.now();
  for (let i = tankShells.length - 1; i >= 0; i--) {
    const s = tankShells[i];
    s.pos.addScaledVector(s.vel, dt);
    s.mesh.position.copy(s.pos);
    if (s.pos.y <= groundHeightAt(s.pos.x, s.pos.z) || now - s.spawnedAt > 3000 || bulletBlockedByObstacle(s.pos)) {
      tankShells.splice(i, 1);
      explodeTankShell(s);
    }
  }
}

// ---------- Blue pilots: a subset of blue troops (isPilotCandidate, see createFactionTroop) walk
// straight to the nearest unclaimed parked plane instead of fighting on the ground, and board it
// (same E-triggered condition the player uses — see updateGroundBots's isPilotCandidate branch)
// once close enough. Boarding hides the trooper (bot.alive = false, same as any other removal,
// but blueAliveCount is NOT decremented — they're airborne, not dead) and hands the plane over to
// an autonomous patrol-and-strafe loop below. findNearestUnclaimedPlane/boardPlane are also used
// directly by updateGroundBots; only the flight itself lives here. ----------
const PILOT_FLIGHT_ALT = 45;
const PILOT_FLIGHT_RADIUS = 55;
const PILOT_FLIGHT_TURN_SPEED = 0.35; // radians/sec around the patrol circle
const PILOT_STRAFE_RANGE = 18;
const PILOT_STRAFE_COOLDOWN_MS = 700;

function findNearestUnclaimedPlane(pos) {
  let nearest = null, nearestDist = Infinity;
  for (const v of vehicles) {
    if (v.type !== 'plane' || v.occupied) continue;
    const d = Math.hypot(pos.x - v.x, pos.z - v.z);
    if (d < nearestDist) { nearestDist = d; nearest = v; }
  }
  return nearest;
}

function boardPlane(bot, v) {
  v.occupied = true;
  v.pilotBot = bot;
  v.flightAngle = Math.random() * Math.PI * 2;
  v.nextStrafeAt = 0;
  bot.alive = false;
  bot.mesh.visible = false;
  bot.target = null;
}

function updateBluePilots(dt) {
  const now = performance.now();
  for (const v of vehicles) {
    if (v.type !== 'plane' || !v.pilotBot) continue;
    v.flightAngle += PILOT_FLIGHT_TURN_SPEED * dt;
    const x = v.x + Math.cos(v.flightAngle) * PILOT_FLIGHT_RADIUS;
    const z = v.z + Math.sin(v.flightAngle) * PILOT_FLIGHT_RADIUS;
    const y = PILOT_FLIGHT_ALT;
    v.mesh.position.set(x, y, z);
    // Tangent to the patrol circle at the current angle (d/dθ of (cosθ, sinθ)) — the direction
    // it's actually flying, so the nose (local +Z, see makePlaneMesh's forward convention) faces
    // the way it's moving instead of always pointing at the circle's center.
    const tangentX = -Math.sin(v.flightAngle), tangentZ = Math.cos(v.flightAngle);
    v.mesh.lookAt(new THREE.Vector3(x + tangentX, y, z + tangentZ));

    if (warStarted && now >= v.nextStrafeAt) {
      let target = null, targetDist = PILOT_STRAFE_RANGE;
      for (const bot of redTroops) {
        if (!bot.alive) continue;
        const d = Math.hypot(bot.mesh.position.x - x, bot.mesh.position.z - z);
        if (d < targetDist) { targetDist = d; target = bot; }
      }
      if (target) {
        v.nextStrafeAt = now + PILOT_STRAFE_COOLDOWN_MS;
        target.hp -= 1;
        if (target.hp <= 0) destroyBot(target);
        spawnExplosion(target.mesh.position.clone(), 0xffe066, 6, 300, 2);
      }
    }
  }
}

function updateTouchStickVisibility() {
  if (!isTouchDevice) return;
  missileJoystickEl.classList.toggle('hidden', !(controllingMissile || mode === 'onfoot' || mode === 'parachuting' || mode === 'swinging'));
}

function bailOut() {
  if (!gameStarted || mode !== 'flying' || controllingMissile) return;
  mode = 'parachuting';
  parachuteDrift.set(0, 0, 0);
  planeGroup.visible = false;
  personGroup.visible = true;
  parachuteGroup.visible = true;
  personGroup.position.copy(planePos);
  parachuteGroup.position.copy(planePos);
  missileStatusEl.textContent = '🪂 Parachuting — steer with WASD';
  missileStatusEl.className = 'guiding';
  updateTouchStickVisibility();
  playSound('fire');
}

function landOnGround() {
  mode = 'onfoot';
  parachuteGroup.visible = false;
  // First-person from here — hide the player's own third-person body model (only the ground
  // bots, who reuse the same makePersonMesh, stay visible) and show the viewmodel gun instead.
  personGroup.visible = false;
  viewmodelGun.visible = true;
  missileStatusEl.textContent = '🔫 On foot — shoot, aim, F to call your plane';
  missileStatusEl.className = '';
  updateTouchStickVisibility();
}

// Bailing out was previously one-way — the only way back to flying was dying and hitting "Fly
// Again." F calls a fresh plane in from on foot or mid-swing (not mid-parachute-fall, that's
// over in a couple seconds anyway) — climbs you to a safe altitude on the spot rather than
// simulating an actual pickup/landing sequence, same "instant but plausible" tradeoff bailOut's
// parachute already makes the other direction.
const CALL_PLANE_MIN_ALTITUDE = 60;
function callPlane() {
  if (!gameStarted || mode === 'flying' || mode === 'parachuting' || controllingMissile) return;
  mode = 'flying';
  planePos.y = Math.max(planePos.y + 50, CALL_PLANE_MIN_ALTITUDE);
  planePitch = 0;
  planeBank = 0;
  planeSpeed = PLANE_CRUISE_SPEED;
  missileReadyAt = 0;
  aiming = false;
  camera.fov = NORMAL_FOV;
  camera.updateProjectionMatrix();
  planeGroup.visible = true;
  personGroup.visible = false;
  spideyGroup.visible = false;
  parachuteGroup.visible = false;
  webStrand.visible = false;
  viewmodelGun.visible = false;
  spidey.swinging = false;
  spidey.anchor = null;
  spidey.climbing = false;
  spidey.grappling = false;
  updateMissileStatusHud();
  updateTouchStickVisibility();
  showKillToast('🛩️ Plane inbound!');
  playSound('fire');
}

function updateParachute(dt) {
  const forward = forwardFromYawPitch(planeYaw, 0);
  forward.y = 0;
  if (forward.lengthSq() > 0) forward.normalize();
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  let moveZ = 0, moveX = 0;
  if (keys.KeyW) moveZ += 1;
  if (keys.KeyS) moveZ -= 1;
  if (keys.KeyD) moveX += 1;
  if (keys.KeyA) moveX -= 1;
  if (isTouchDevice) { moveZ -= touchMissileY; moveX += touchMissileX; }
  const driftTarget = new THREE.Vector3().addScaledVector(forward, moveZ).addScaledVector(right, moveX);
  if (driftTarget.lengthSq() > 0) driftTarget.normalize().multiplyScalar(PARACHUTE_MAX_DRIFT);
  parachuteDrift.lerp(driftTarget, Math.min(1, dt * 2));

  planePos.x += parachuteDrift.x * dt;
  planePos.z += parachuteDrift.z * dt;
  planePos.y -= PARACHUTE_DESCENT_SPEED * dt;
  clampToWorldBounds(planePos);

  personGroup.position.copy(planePos);
  parachuteGroup.position.copy(planePos);
  if (forward.lengthSq() > 0) personGroup.lookAt(planePos.clone().add(forward));

  if (planePos.y <= GROUND_LEVEL) {
    planePos.y = GROUND_LEVEL;
    landOnGround();
  }
}

function updateOnFoot(dt) {
  const forward = forwardFromYawPitch(planeYaw, 0);
  forward.y = 0;
  if (forward.lengthSq() > 0) forward.normalize();
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  let moveZ = 0, moveX = 0;
  if (keys.KeyW) moveZ += 1;
  if (keys.KeyS) moveZ -= 1;
  if (keys.KeyD) moveX += 1;
  if (keys.KeyA) moveX -= 1;
  if (isTouchDevice) { moveZ -= touchMissileY; moveX += touchMissileX; }
  const move = new THREE.Vector3().addScaledVector(forward, moveZ).addScaledVector(right, moveX);
  if (move.lengthSq() > 0) move.normalize().multiplyScalar(WALK_SPEED * dt);
  planePos.x += move.x;
  planePos.z += move.z;
  resolveObstacleCollisions(planePos);
  clampToWorldBounds(planePos);
  // Eases toward the ditch-aware ground height instead of snapping, so stepping in/out of a
  // ditch looks like walking down into it rather than teleporting.
  planePos.y += (groundHeightAt(planePos.x, planePos.z) - planePos.y) * Math.min(1, dt * 6);

  personGroup.position.copy(planePos);
  const lookFwd = forwardFromYawPitch(planeYaw, planePitch);
  personGroup.lookAt(planePos.clone().add(new THREE.Vector3(lookFwd.x, 0, lookFwd.z)));
}

// ---------- Spider-Man physics (ported from webswing.js, see the constants block for what's
// unchanged) — the one real adaptation is aim/hit-testing: webswing raycasts against real
// building meshes, but fighterplane's obstacles are simple {x,z,radius} circles, not meshes with
// precomputed corner geometry, so shootWeb below raymarches along the aim ray instead and tests
// each step against every climbable obstacle's circular footprint + blockHeight. ----------
function raymarchForWeb(origin, dir) {
  const STEP = 1.5;
  const steps = Math.floor(WEB_MAX_RANGE / STEP);
  for (let i = 1; i <= steps; i++) {
    const dist = i * STEP;
    const px = origin.x + dir.x * dist, py = origin.y + dir.y * dist, pz = origin.z + dir.z * dist;
    if (py <= 0) return null; // hit the ground first — no attachment point along this ray
    for (const o of obstacles) {
      if (!o.climbable || py > o.blockHeight) continue;
      if (Math.hypot(px - o.x, pz - o.z) <= o.radius) return { point: new THREE.Vector3(px, py, pz), obstacle: o };
    }
  }
  return null;
}

// Analytic aim direction from the same planeYaw/planePitch mouse-look every other role already
// uses — this is the exact formula webswing.js's aimDirection() derives from its own camYaw/
// camPitch, so "same physics as web swing" holds for aiming too, not just the rope/gravity math.
function spideyAimDirection() {
  return forwardFromYawPitch(planeYaw, planePitch);
}

function shootWeb() {
  if (spidey.grappling) return;
  const origin = new THREE.Vector3(planePos.x, planePos.y + 1.5, planePos.z);
  const dir = spideyAimDirection();
  const hit = raymarchForWeb(origin, dir);
  const point = hit ? hit.point : origin.clone().addScaledVector(dir, WEB_MAX_RANGE);
  const b = hit ? hit.obstacle : null;
  spidey.climbing = false;
  if (b && point.y >= b.blockHeight - SWING_GRAPPLE_TOP_MARGIN) {
    // Aimed near a rooftop — grapple straight up onto it instead of swinging, matching webswing.
    spidey.swinging = false;
    spidey.anchor = null;
    spidey.grappling = true;
    spidey.grappleTarget = { x: point.x, y: b.blockHeight + 1, z: point.z };
    spidey.grounded = false;
    playSound('fire');
    return;
  }
  spidey.anchor = { x: point.x, y: point.y, z: point.z };
  spidey.ropeLen = Math.max(SWING_ROPE_MIN, origin.distanceTo(point));
  spidey.swinging = true;
  spidey.grounded = false;
  spidey.pumpMomentum = 0;
  playSound('fire');
}

function releaseWeb() {
  if (spidey.pumpMomentum > 0) {
    const boost = 1 + spidey.pumpMomentum * SWING_RELEASE_BOOST_MAX;
    spidey.vx *= boost; spidey.vy *= boost; spidey.vz *= boost;
    spidey.pumpMomentum = 0;
  }
  spidey.swinging = false;
  spidey.anchor = null;
  playSound('shoot');
}

function handleWebAction() {
  if (spidey.grappling) return;
  if (spidey.swinging) releaseWeb();
  else shootWeb();
}

function updateGrapple(dt) {
  const t = spidey.grappleTarget;
  const dx = t.x - planePos.x, dy = t.y - planePos.y, dz = t.z - planePos.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1.2) {
    planePos.set(t.x, t.y, t.z);
    spidey.vx = spidey.vy = spidey.vz = 0;
    spidey.grappling = false;
    spidey.grounded = true;
    playSound('hit');
    return;
  }
  const nx = dx / dist, ny = dy / dist, nz = dz / dist;
  planePos.x += nx * SWING_GRAPPLE_SPEED * dt;
  planePos.y += ny * SWING_GRAPPLE_SPEED * dt;
  planePos.z += nz * SWING_GRAPPLE_SPEED * dt;
  spidey.vx = nx * SWING_GRAPPLE_SPEED; spidey.vy = ny * SWING_GRAPPLE_SPEED; spidey.vz = nz * SWING_GRAPPLE_SPEED;
}

function doJumpSpidey() {
  if (spidey.swinging) return;
  if (spidey.climbing) {
    spidey.climbing = false;
    const nx = Math.cos(spidey.climbAngle), nz = Math.sin(spidey.climbAngle);
    spidey.vx = nx * 7;
    spidey.vz = nz * 7;
    spidey.vy = SWING_JUMP_VEL * 0.85;
    spidey.grounded = false;
    playSound('fire');
    return;
  }
  if (!spidey.grounded) return;
  spidey.vy = SWING_JUMP_VEL;
  spidey.grounded = false;
  playSound('fire');
}

// Grabs the nearest climbable obstacle within short range in the direction of current horizontal
// velocity — pins the player to a fixed angle+radius around that obstacle's circular footprint
// (webswing's equivalent pins to a fixed coordinate along one wall axis; a circle only has one
// "wall axis" — the angle around it — so climbAngle is the single pinned coordinate here).
function tryStartClimb() {
  const hSpeed = Math.hypot(spidey.vx, spidey.vz);
  if (hSpeed < 0.3) return;
  const dirX = spidey.vx / hSpeed, dirZ = spidey.vz / hSpeed;
  const probeX = planePos.x + dirX * 1.4, probeZ = planePos.z + dirZ * 1.4;
  for (const o of obstacles) {
    if (!o.climbable || planePos.y + 1.0 >= o.blockHeight) continue;
    if (Math.hypot(probeX - o.x, probeZ - o.z) > o.radius) continue;
    spidey.climbing = true;
    spidey.grounded = false;
    spidey.climbObstacle = o;
    spidey.climbRadius = o.radius + SWING_CLIMB_OFFSET;
    spidey.climbAngle = Math.atan2(planePos.z - o.z, planePos.x - o.x);
    spidey.vx = spidey.vy = spidey.vz = 0;
    return;
  }
}

function updateClimb(dt) {
  const { f, r } = readSpideyMoveInput();
  planePos.y += (f !== 0 ? f * SWING_CLIMB_SPEED : SWING_CLIMB_IDLE_SLIDE) * dt;
  const o = spidey.climbObstacle;
  // Shuffle sideways = walk around the circumference (angle change) instead of along a fixed
  // wall axis — the circular equivalent of webswing's linear climbFixedCoord shuffle.
  spidey.climbAngle += (r * SWING_CLIMB_SPEED * dt) / spidey.climbRadius;
  planePos.x = o.x + Math.cos(spidey.climbAngle) * spidey.climbRadius;
  planePos.z = o.z + Math.sin(spidey.climbAngle) * spidey.climbRadius;
  if (planePos.y >= o.blockHeight) { planePos.y = o.blockHeight; spidey.climbing = false; spidey.grounded = true; }
  else if (planePos.y <= 0.05) { planePos.y = 0; spidey.climbing = false; spidey.grounded = true; }
}

// Circular equivalent of webswing's padded-AABB resolveWallCollisions — push the player out to
// just past a climbable obstacle's radius if they've drifted inside it (running or swinging by).
function resolveSpideyCollisions() {
  for (const o of obstacles) {
    if (!o.climbable || planePos.y >= o.blockHeight) continue;
    const dx = planePos.x - o.x, dz = planePos.z - o.z;
    const dist = Math.hypot(dx, dz);
    const minDist = o.radius + SWING_PLAYER_RADIUS;
    if (dist > 0.0001 && dist < minDist) {
      const push = minDist - dist;
      planePos.x += (dx / dist) * push;
      planePos.z += (dz / dist) * push;
      const nx = dx / dist, nz = dz / dist;
      const vDotN = spidey.vx * nx + spidey.vz * nz;
      if (vDotN < 0) { spidey.vx -= nx * vDotN; spidey.vz -= nz * vDotN; }
    }
  }
}

function groundCheckSpidey() {
  let groundY = groundHeightAt(planePos.x, planePos.z);
  for (const o of obstacles) {
    if (!o.climbable) continue;
    if (Math.hypot(planePos.x - o.x, planePos.z - o.z) <= o.radius) groundY = Math.max(groundY, o.blockHeight);
  }
  if (planePos.y <= groundY + 0.15 && spidey.vy <= 0) {
    const fallSpeed = -spidey.vy;
    planePos.y = groundY;
    spidey.vy = 0;
    if (!spidey.grounded && fallSpeed > 6) playSound('hit');
    spidey.grounded = true;
    return;
  }
  spidey.grounded = false;
}

function readSpideyMoveInput() {
  let f = 0, r = 0;
  if (keys.KeyW) f += 1;
  if (keys.KeyS) f -= 1;
  if (keys.KeyD) r += 1;
  if (keys.KeyA) r -= 1;
  if (isTouchDevice) { f -= touchMissileY; r += touchMissileX; }
  return { f, r };
}

function updateSpideyInputMove(dt) {
  if (spidey.climbing || spidey.grappling) return;
  const { f, r } = readSpideyMoveInput();
  const fwdX = -Math.sin(planeYaw), fwdZ = -Math.cos(planeYaw);
  const rightX = -fwdZ, rightZ = fwdX;
  if (spidey.swinging) {
    if (f !== 0) spidey.ropeLen = Math.max(SWING_ROPE_MIN, Math.min(SWING_ROPE_MAX, spidey.ropeLen - f * SWING_REEL_SPEED * dt));
    if (r !== 0) {
      spidey.vx += rightX * r * SWING_PUMP_ACCEL * dt;
      spidey.vz += rightZ * r * SWING_PUMP_ACCEL * dt;
      spidey.pumpMomentum = Math.min(1, spidey.pumpMomentum + dt * SWING_PUMP_BUILD_RATE);
    } else {
      spidey.pumpMomentum = Math.max(0, spidey.pumpMomentum - dt * SWING_PUMP_DECAY_RATE);
    }
    return;
  }
  if (f || r) {
    const len = Math.hypot(f, r);
    const wishX = fwdX * (f / len) + rightX * (r / len);
    const wishZ = fwdZ * (f / len) + rightZ * (r / len);
    const speed = spidey.grounded ? SWING_RUN_SPEED : SWING_RUN_SPEED * 0.55;
    const accel = spidey.grounded ? 0.3 : 0.06;
    spidey.vx += (wishX * speed - spidey.vx) * accel;
    spidey.vz += (wishZ * speed - spidey.vz) * accel;
  } else if (spidey.grounded) {
    spidey.vx *= 0.8;
    spidey.vz *= 0.8;
  }
}

function updateSwing(dt) {
  spidey.vy += SWING_GRAVITY * dt;
  planePos.x += spidey.vx * dt;
  planePos.y += spidey.vy * dt;
  planePos.z += spidey.vz * dt;
  const a = spidey.anchor;
  const dx = planePos.x - a.x, dy = planePos.y - a.y, dz = planePos.z - a.z;
  const dist = Math.hypot(dx, dy, dz) || 0.0001;
  if (dist > spidey.ropeLen) {
    const nx = dx / dist, ny = dy / dist, nz = dz / dist;
    planePos.x = a.x + nx * spidey.ropeLen;
    planePos.y = a.y + ny * spidey.ropeLen;
    planePos.z = a.z + nz * spidey.ropeLen;
    const vDotN = spidey.vx * nx + spidey.vy * ny + spidey.vz * nz;
    if (vDotN > 0) { spidey.vx -= nx * vDotN; spidey.vy -= ny * vDotN; spidey.vz -= nz * vDotN; }
  }
}

function updateSpidey(dt) {
  updateSpideyInputMove(dt);
  if (!spidey.swinging && !spidey.climbing && !spidey.grappling) tryStartClimb();

  if (spidey.grappling) {
    updateGrapple(dt);
  } else if (spidey.climbing) {
    updateClimb(dt);
  } else if (spidey.swinging) {
    updateSwing(dt);
  } else {
    spidey.vy += SWING_GRAVITY * dt;
    planePos.x += spidey.vx * dt;
    planePos.y += spidey.vy * dt;
    planePos.z += spidey.vz * dt;
  }
  const spd = Math.hypot(spidey.vx, spidey.vy, spidey.vz);
  if (spd > SWING_MAX_SPEED) { const k = SWING_MAX_SPEED / spd; spidey.vx *= k; spidey.vy *= k; spidey.vz *= k; }

  if (!spidey.climbing && !spidey.grappling) {
    groundCheckSpidey();
    resolveSpideyCollisions();
  }
  clampToWorldBounds(planePos);
  if (spidey.grounded && spidey.swinging) releaseWeb();

  spideyGroup.position.copy(planePos);
  if (spidey.climbing) {
    spideyGroup.rotation.y = Math.atan2(-Math.cos(spidey.climbAngle), -Math.sin(spidey.climbAngle));
  } else {
    const hSpeed = Math.hypot(spidey.vx, spidey.vz);
    if (hSpeed > 0.6) spideyGroup.rotation.y = Math.atan2(spidey.vx, spidey.vz);
  }
  const ropeTarget = spidey.swinging ? spidey.anchor : (spidey.grappling ? spidey.grappleTarget : null);
  updateWebStrand(webStrand, { x: planePos.x, y: planePos.y + 1.3, z: planePos.z }, ropeTarget);
}

// ---------- Player bullets (machine gun, aimed at bots) — nothing targets the player anymore
// (see updateBots/updateGroundBots), so there's no equivalent bot-fired bullet pool here. ----------
const playerBullets = []; // { mesh, pos, vel, spawnedAt } — player-fired, can hit bots

// ---------- Explosions ----------
// Hard cap on simultaneous PointLights across explosions AND fires combined — both compete for
// the same budget. Without this, a single map-wide nuke (which can ignite every flammable
// structure and destroy every bot in range in one frame) tries to add a PointLight per event —
// hundreds at once — which is enough dynamic lights to crash or freeze the WebGL context. Past
// the cap, explosions/fires still render (the mesh/flame cones are cheap), just without their
// own light; the first dozen or so nearby ones — the only lights actually visible at once
// anyway — still get one.
const MAX_DYNAMIC_LIGHTS = 12;
let activeDynamicLights = 0;

const explosions = []; // { mesh, light, spawnedAt, duration, maxScale, intensity }
function spawnExplosion(position, color = 0xffa64d, maxScale = 15, duration = 450, intensity = 3) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 8, 8),
    // DoubleSide matters here specifically for the nuke: at WORLD_RADIUS scale the camera ends
    // up *inside* the sphere almost immediately, and MeshBasicMaterial only renders front faces
    // by default — from inside, that's invisible. BackSide faces (visible from inside) render
    // fine either way for small explosions too, so this doesn't change their look.
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  mesh.position.copy(position);
  scene.add(mesh);
  let light = null;
  if (activeDynamicLights < MAX_DYNAMIC_LIGHTS) {
    light = new THREE.PointLight(color, intensity, maxScale * 3);
    light.position.copy(position);
    scene.add(light);
    activeDynamicLights++;
  }
  explosions.push({ mesh, light, spawnedAt: performance.now(), duration, maxScale, intensity });
}

function updateExplosions() {
  const now = performance.now();
  for (let i = explosions.length - 1; i >= 0; i--) {
    const ex = explosions[i];
    const t = (now - ex.spawnedAt) / ex.duration;
    if (t >= 1) {
      scene.remove(ex.mesh);
      if (ex.light) { scene.remove(ex.light); activeDynamicLights--; }
      explosions.splice(i, 1);
      continue;
    }
    const scale = 1 + t * ex.maxScale;
    ex.mesh.scale.set(scale, scale, scale);
    ex.mesh.material.opacity = 0.9 * (1 - t);
    if (ex.light) ex.light.intensity = ex.intensity * (1 - t);
  }
}

// ---------- Game state ----------
let gameStarted = false;
// Separate from gameStarted: gameStarted gates the player's own control/input, warRunning gates
// the war simulation itself (troops, planes, HUD). They both flip on together at the start of a
// round, but gameStarted alone goes false when the player runs out of lives — warRunning stays
// true so the war keeps playing out on its own until a fresh round (resetGame) stops it.
let warRunning = false;
let health = PLAYER_MAX_HEALTH;
let score = 0;
let best = Number(localStorage.getItem('fighterplane_best') || 0);
bestLabel.textContent = `Best: ${best}`;

function updateWarHud() {
  livesStatusEl.textContent = `💙 Lives: ${livesRemaining}`;
  warStatusEl.textContent = `${warStarted ? '⚔️' : '☮️'} 🔵 ${blueAliveCount} vs 🔴 ${redAliveCount}`;
}

// Both sides sit peacefully near home until this fires — see warStarted's declaration. One-shot:
// the button hides itself, there's no going back to peace mid-round.
function startWar() {
  if (!gameStarted || warStarted) return;
  warStarted = true;
  const now = performance.now();
  // Every alive trooper on both sides gets pointed at the enemy's home — the opposite side of
  // the map — and set marching there together as one visible wave, rather than each one
  // individually snapping onto whatever random enemy its own retarget scan happens to sample
  // (which could be right next door, reading as scattered skirmishes instead of a coordinated
  // push). Target/scan timer are cleared and delayed a couple seconds so the march actually
  // reads as a march before normal engage-on-sight combat AI takes back over — troops that cross
  // paths with a real enemy before then still fight (TROOP_ENGAGE_RANGE keeps working the whole
  // time), this only holds off the *next* fresh target pick.
  for (const bot of groundBots) {
    if (!bot.alive || bot.isPilotCandidate) continue;
    bot.target = null;
    bot.nextTargetScanAt = now + 2000 + Math.random() * 1000;
    const enemyHome = bot.faction === 'red' ? BLUE_HOME : RED_HOME;
    bot.waypoint = randomPointNear(enemyHome.x, enemyHome.z, FACTION_SPAWN_SPREAD);
  }
  attackBtn.classList.add('hidden');
  touchAttackBtn.classList.add('hidden');
  showKillToast('⚔️ Attack ordered!');
  playSound('fire');
}

function renderHealth() {
  healthBarEl.innerHTML = '';
  for (let i = 0; i < PLAYER_MAX_HEALTH; i++) {
    const heart = document.createElement('span');
    heart.className = 'heart' + (i >= health ? ' empty' : '');
    heart.textContent = '❤️';
    healthBarEl.appendChild(heart);
  }
}
renderHealth();

function showKillToast(text) {
  killToastEl.textContent = text;
  killToastEl.classList.remove('hidden');
  killToastEl.style.animation = 'none';
  void killToastEl.offsetWidth;
  killToastEl.style.animation = '';
  clearTimeout(showKillToast._t);
  showKillToast._t = setTimeout(() => killToastEl.classList.add('hidden'), 900);
}

function updateMissileStatusHud() {
  if (controllingMissile) {
    missileStatusEl.textContent = '🚀 Guiding — W/S up-down, A/D left-right';
    missileStatusEl.className = 'guiding';
  } else if (performance.now() < missileReadyAt) {
    missileStatusEl.textContent = '🚀 Reloading…';
    missileStatusEl.className = 'locked';
  } else {
    missileStatusEl.textContent = '🚀 Ready (Q)';
    missileStatusEl.className = '';
  }
}

// ---------- Minimap: north-up (fixed world orientation), player heading shown as a rotating
// arrow rather than rotating the whole map — simpler math, and matches most simple game
// minimaps over the "world rotates around you" alternative. ----------
const MINIMAP_RADIUS = 70; // half of the 140px canvas
let minimapFrameCounter = 0;
function worldToMinimap(x, z) {
  const scale = MINIMAP_RADIUS / WORLD_RADIUS;
  return { x: MINIMAP_RADIUS + x * scale, y: MINIMAP_RADIUS + z * scale };
}

function drawMinimap() {
  const ctx = minimapCtx;
  ctx.clearRect(0, 0, 140, 140);
  ctx.save();
  ctx.beginPath();
  ctx.arc(MINIMAP_RADIUS, MINIMAP_RADIUS, MINIMAP_RADIUS, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = 'rgba(30, 60, 30, 0.35)';
  ctx.fillRect(0, 0, 140, 140);

  for (const s of settlements) {
    const p = worldToMinimap(s.x, s.z);
    ctx.fillStyle = s.type === 'city' ? 'rgba(170, 170, 190, 0.9)' : 'rgba(190, 150, 105, 0.9)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.type === 'city' ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#ff5a5a';
  for (const bot of bots) {
    if (!bot.alive) continue;
    const p = worldToMinimap(bot.mesh.position.x, bot.mesh.position.z);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#ffa64d';
  for (const bot of groundBots) {
    if (!bot.alive) continue;
    const p = worldToMinimap(bot.mesh.position.x, bot.mesh.position.z);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const p = worldToMinimap(planePos.x, planePos.z);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-planeYaw); // matches forwardFromYawPitch's sign convention, see the comment there
  ctx.fillStyle = '#34e89e';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(MINIMAP_RADIUS, MINIMAP_RADIUS, MINIMAP_RADIUS - 1, 0, Math.PI * 2);
  ctx.stroke();
}

function updateSpeedHud() {
  const pct = Math.round(((planeSpeed - PLANE_MIN_SPEED) / (PLANE_MAX_SPEED - PLANE_MIN_SPEED)) * 100);
  if (planeSpeed <= PLANE_STALL_SPEED) {
    speedStatusEl.textContent = '⚠️ STALLING — dive to recover';
    speedStatusEl.className = 'stalling';
  } else {
    speedStatusEl.textContent = `✈️ Speed: ${pct}%`;
    speedStatusEl.className = '';
  }
}

function addScore(n) {
  score += n;
  scoreLabel.textContent = `🎯 ${score}`;
  if (score > best) {
    best = score;
    localStorage.setItem('fighterplane_best', String(best));
    bestLabel.textContent = `Best: ${best}`;
  }
}

// 5 lives total — the first 4 deaths drop you into spectate (watching the blue side fight)
// instead of ending the round outright; only the 5th ends it for real.
const PLAYER_MAX_LIVES = 5;
let livesRemaining = PLAYER_MAX_LIVES;

function die(reason = 'Shot down!') {
  if (!gameStarted) return;
  livesRemaining--;
  controllingMissile = false;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  if (livesRemaining > 0) {
    enterSpectateMode(reason);
    return;
  }
  gameStarted = false;
  gameoverText.textContent = `${reason} Out of lives. Final score: ${score}`;
  gameoverOverlay.classList.remove('hidden');
  playSound('gameover');
  sendScore();
}

// ---------- Spectate: watches a random alive blue trooper for SPECTATE_DURATION_MS (switching
// which one every couple seconds), then drops the player back in on foot near blue's home. Only
// the player's own death goes through this — the round-ending win/lose overlay (checkWarOutcome)
// is separate and final, no spectate step. ----------
const SPECTATE_DURATION_MS = 5000;
let spectateEndAt = 0;
let spectateSwitchAt = 0;
let spectateTarget = null;

function enterSpectateMode(reason) {
  mode = 'spectating';
  spectateEndAt = performance.now() + SPECTATE_DURATION_MS;
  spectateSwitchAt = 0;
  spectateTarget = null;
  planeGroup.visible = false;
  personGroup.visible = false;
  spideyGroup.visible = false;
  parachuteGroup.visible = false;
  viewmodelGun.visible = false;
  webStrand.visible = false;
  updateTouchStickVisibility();
  showKillToast(`${reason} ${livesRemaining} ${livesRemaining === 1 ? 'life' : 'lives'} left — spectating…`);
  playSound('hit');
}

function updateSpectate(dt) {
  const now = performance.now();
  if (now >= spectateSwitchAt) {
    spectateSwitchAt = now + 2000;
    const alive = blueTroops.filter((t) => t.alive);
    spectateTarget = alive.length ? alive[Math.floor(Math.random() * alive.length)] : null;
  }
  if (spectateTarget && spectateTarget.alive) {
    const forward = forwardFromYawPitch(spectateTarget.angle + Math.PI, 0); // troop meshes face +Z at angle 0, see makePersonMesh's comment — offset by PI so the "forward" chase vector points the same way the troop is walking
    const eyePos = spectateTarget.mesh.position.clone();
    eyePos.y += 3;
    const desiredPos = eyePos.clone().addScaledVector(forward, -8);
    const lerpFactor = Math.min(1, dt * 4);
    camPos.lerp(desiredPos, lerpFactor);
    camTarget.lerp(spectateTarget.mesh.position, lerpFactor);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  }
  if (now >= spectateEndAt) respawnPlayerFromSpectate();
}

function respawnPlayerFromSpectate() {
  mode = 'onfoot';
  const spot = randomPointNear(BLUE_HOME.x, BLUE_HOME.z, FACTION_SPAWN_SPREAD * 0.4);
  planePos.set(spot.x, GROUND_LEVEL, spot.z);
  health = PLAYER_MAX_HEALTH;
  renderHealth();
  personGroup.visible = false;
  viewmodelGun.visible = true;
  missileStatusEl.textContent = `🔫 Back in the fight — ${livesRemaining} ${livesRemaining === 1 ? 'life' : 'lives'} left`;
  missileStatusEl.className = '';
  updateTouchStickVisibility();
  if (!isTouchDevice) requestPointerLockSafe();
}

// Ground-crash and plane-vs-plane collision both end the flight instantly, no health chip-down
// — a fighter plane hitting the ground or another plane doesn't survive that, unlike taking a
// bullet. Shared so updatePlane()'s two collision checks don't duplicate the death sequence.
function crashPlane(reason) {
  spawnExplosion(planePos.clone(), 0xff5a3d);
  playSound('explosion');
  planeGroup.visible = false;
  health = 0;
  renderHealth();
  die(reason);
}

// Spawns Spider-Man atop a random skyscraper if one exists (a real building, already up high,
// ready to swing down from — matching webswing's own spawn-on-a-tall-building convention),
// falling back to city-street level if this map somehow has none.
function pickSpidermanSpawn() {
  const skyscrapers = obstacles.filter((o) => o.climbable && o.blockHeight > 15);
  if (skyscrapers.length === 0) return { x: 0, y: GROUND_LEVEL, z: 0 };
  const s = skyscrapers[Math.floor(Math.random() * skyscrapers.length)];
  return { x: s.x, y: s.blockHeight + 1, z: s.z };
}

function resetGame() {
  warStarted = false;
  warRunning = false;
  attackBtn.classList.remove('hidden');
  touchAttackBtn.classList.remove('hidden');
  health = PLAYER_MAX_HEALTH;
  livesRemaining = PLAYER_MAX_LIVES;
  score = 0;
  scoreLabel.textContent = `🎯 ${score}`;
  renderHealth();
  planeYaw = 0;
  planePitch = 0;
  planeBank = 0;
  planeSpeed = PLANE_CRUISE_SPEED;
  controllingMissile = false;
  if (missile) { scene.remove(missile.mesh); missile = null; }
  missileReadyAt = 0;
  for (const b of playerBullets) scene.remove(b.mesh);
  playerBullets.length = 0;
  nextBulletAt = 0;
  for (const g of grenades) scene.remove(g.mesh);
  grenades.length = 0;
  grenadeReadyAt = 0;
  for (const b of troopBullets) scene.remove(b.mesh);
  troopBullets.length = 0;
  for (const ex of explosions) { scene.remove(ex.mesh); if (ex.light) scene.remove(ex.light); }
  explosions.length = 0;
  for (const bot of bots) respawnBot(bot);
  for (const bot of groundBots) resetFactionTroop(bot);
  redAliveCount = TROOPS_PER_FACTION;
  blueAliveCount = TROOPS_PER_FACTION;

  // Put out every fire and restore any burnt structures — a fresh round starts with an
  // unburnt map, not last round's scorched earth. Clearing both explosions and fires here
  // accounts for every light MAX_DYNAMIC_LIGHTS was tracking, so a flat reset is correct
  // (rather than trying to decrement precisely per removed light).
  activeDynamicLights = 0;
  for (const o of obstacles) {
    if (!o.flammable || (!o.burning && !o.burnedOut)) continue;
    if (o.fireEffect) { scene.remove(o.fireEffect); o.fireEffect = null; }
    o.burning = false;
    o.burnedOut = false;
    for (const c of o.originalColors) c.material.color.copy(c.color);
  }

  planeGroup.visible = false;
  personGroup.visible = false;
  parachuteGroup.visible = false;
  viewmodelGun.visible = false;
  viewmodelGun.position.copy(GUN_HIP_POS);
  spideyGroup.visible = false;
  webStrand.visible = false;
  parachuteDrift.set(0, 0, 0);
  aiming = false;
  camera.fov = NORMAL_FOV;
  camera.updateProjectionMatrix();

  if (startingMode === 'swinging') {
    mode = 'swinging';
    const spawn = pickSpidermanSpawn();
    planePos.set(spawn.x, spawn.y, spawn.z);
    planeYaw = Math.random() * Math.PI * 2;
    spidey.vx = spidey.vy = spidey.vz = 0;
    spidey.grounded = true;
    spidey.swinging = false;
    spidey.anchor = null;
    spidey.pumpMomentum = 0;
    spidey.climbing = false;
    spidey.climbObstacle = null;
    spidey.grappling = false;
    spidey.grappleTarget = null;
    // First-person, same as on foot — spideyGroup (third-person body) stays hidden, the
    // camera-mounted viewmodel gun shows instead. The web strand still draws correctly either
    // way since it's driven by planePos, not by spideyGroup's own (now unused) transform.
    spideyGroup.visible = false;
    viewmodelGun.visible = true;
    const eyePos = planePos.clone();
    eyePos.y += EYE_HEIGHT;
    camPos.copy(eyePos).addScaledVector(forwardFromYawPitch(planeYaw, 0), 10);
    camTarget.copy(eyePos);
    missileStatusEl.textContent = '🕸️ E: web, F: call your plane';
    missileStatusEl.className = '';
  } else {
    // No more auto-start-flying — you land on foot near blue's home, same as any other on-foot
    // spawn, and have to walk up to one of the parked planes and press E to actually take off.
    mode = 'onfoot';
    const spot = randomPointNear(BLUE_HOME.x, BLUE_HOME.z, FACTION_SPAWN_SPREAD * 0.3);
    planePos.set(spot.x, GROUND_LEVEL, spot.z);
    planeYaw = Math.random() * Math.PI * 2;
    personGroup.visible = false;
    viewmodelGun.visible = true;
    missileStatusEl.textContent = '🔫 Find a plane or tank — walk up and press E to get in';
    missileStatusEl.className = '';
  }

  for (const v of vehicles) {
    v.occupied = false;
    v.pilotBot = null;
    if (v.type === 'plane') {
      v.mesh.visible = true;
      v.mesh.position.set(v.x, 1.2, v.z);
      v.mesh.rotation.set(0, 0, 0);
    }
  }
  activeTank = null;
  activePlaneSlot = null;
  tankShells.length = 0;

  updateTouchStickVisibility();
}

// ---------- Grenades (G key / touch button) — thrown, not instant like the nuke: real gravity
// arc, explodes on ground contact or after a fuse, kills every bot within GRENADE_KILL_RADIUS.
// Works in every combat role (flying, on foot, swinging as Spider-Man) — only blocked mid-
// parachute-fall, where throwing one doesn't make much sense. ----------
const GRENADE_THROW_SPEED = 26;
const GRENADE_GRAVITY = -26;
const GRENADE_FUSE_MS = 2000;
const GRENADE_KILL_RADIUS = 20;
const GRENADE_COOLDOWN_MS = 1000;
let grenadeReadyAt = 0;
const grenades = []; // { mesh, pos, vel, spawnedAt }

function makeGrenadeMesh() {
  return new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshLambertMaterial({ color: 0x3a4a2e }));
}

function throwGrenade() {
  if (!gameStarted || mode === 'parachuting') return;
  const now = performance.now();
  if (now < grenadeReadyAt) return;
  grenadeReadyAt = now + GRENADE_COOLDOWN_MS;
  const forward = forwardFromYawPitch(planeYaw, planePitch);
  const originY = mode === 'onfoot' ? planePos.y + EYE_HEIGHT - 0.4 : mode === 'swinging' ? planePos.y + 1.5 : planePos.y;
  const pos = new THREE.Vector3(planePos.x, originY, planePos.z).addScaledVector(forward, 2);
  const mesh = makeGrenadeMesh();
  mesh.position.copy(pos);
  scene.add(mesh);
  const vel = forward.clone().multiplyScalar(GRENADE_THROW_SPEED);
  vel.y += 6; // a bit of extra arc on top of aim direction, so a level throw still lobs
  grenades.push({ mesh, pos, vel, spawnedAt: now });
  playSound('fire');
}

function explodeGrenade(g) {
  scene.remove(g.mesh);
  for (const bot of [...bots, ...groundBots]) {
    if (!bot.alive || isFriendlyTroop(bot)) continue;
    if (g.pos.distanceTo(bot.mesh.position) <= GRENADE_KILL_RADIUS) {
      bot.hp = 0;
      destroyBot(bot);
    }
  }
  spawnExplosion(g.pos, 0xffa64d, 30, 700, 6);
  igniteNearby(g.pos, 30);
  playSound('explosion');
}

function updateGrenades(dt) {
  const now = performance.now();
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.vel.y += GRENADE_GRAVITY * dt;
    g.pos.addScaledVector(g.vel, dt);
    g.mesh.position.copy(g.pos);
    if (g.pos.y <= groundHeightAt(g.pos.x, g.pos.z) || now - g.spawnedAt > GRENADE_FUSE_MS) {
      grenades.splice(i, 1);
      explodeGrenade(g);
    }
  }
}

// ---------- Nuke (N key / touch button) ----------
// Instantly destroys every bot (aerial and ground), anywhere on the map — NUKE_RADIUS is set
// well past WORLD_RADIUS so it unconditionally covers the whole play area regardless of where
// it's triggered from, not just "everything nearby." Never damages the player: nothing in this
// game targets or damages the player anymore (see updateBots/updateGroundBots), so this is
// unconditionally safe for whoever triggers it.
// No cooldown — unlimited, spam it as fast as you can press the key/button.
const NUKE_RADIUS = WORLD_RADIUS * 3;

function nuke() {
  if (!gameStarted) return;
  const origin = planePos.clone();
  for (const bot of [...bots, ...groundBots]) {
    if (!bot.alive || isFriendlyTroop(bot)) continue;
    if (origin.distanceTo(bot.mesh.position) <= NUKE_RADIUS) {
      bot.hp = 0;
      destroyBot(bot);
    }
  }
  // maxScale matches WORLD_RADIUS so the fireball visually engulfs the entire map, not just a
  // patch around the player — a much longer duration than a normal explosion so the expansion
  // actually reads instead of just flashing.
  spawnExplosion(origin, 0xffe066, WORLD_RADIUS, 2400, 14);
  igniteNearby(origin, NUKE_RADIUS);
  playSound('explosion');
}

// ---------- Missile firing / guidance ----------
function fireMissile() {
  if (!gameStarted || mode !== 'flying' || controllingMissile || performance.now() < missileReadyAt) return;
  const mesh = makeMissileMesh();
  const forward = forwardFromYawPitch(planeYaw, planePitch);
  const pos = planePos.clone().addScaledVector(forward, 4.5);
  mesh.position.copy(pos);
  scene.add(mesh);
  missile = { mesh, yaw: planeYaw, pitch: planePitch, pos, firedAt: performance.now() };
  controllingMissile = true;
  updateMissileStatusHud();
  playSound('fire');
  updateTouchStickVisibility();
}

function endMissile() {
  if (missile) {
    scene.remove(missile.mesh);
    missile = null;
  }
  controllingMissile = false;
  missileReadyAt = performance.now() + MISSILE_COOLDOWN_MS;
  updateMissileStatusHud();
  updateTouchStickVisibility();
  touchMissileX = 0; touchMissileY = 0;
}

function updateMissile(dt) {
  if (!missile) return;
  let turnX = 0, turnY = 0; // turnX: A/D (yaw), turnY: W/S (pitch)
  if (keys.KeyA) turnX += 1;
  if (keys.KeyD) turnX -= 1;
  if (keys.KeyW) turnY -= 1;
  if (keys.KeyS) turnY += 1;
  if (isTouchDevice) { turnX -= touchMissileX; turnY += touchMissileY; }

  missile.yaw += turnX * MISSILE_TURN_RATE * dt;
  missile.pitch += turnY * MISSILE_TURN_RATE * dt;
  missile.pitch = Math.max(CAM_MIN_PITCH, Math.min(CAM_MAX_PITCH, missile.pitch));

  const forward = forwardFromYawPitch(missile.yaw, missile.pitch);
  missile.pos.addScaledVector(forward, MISSILE_SPEED * dt);
  missile.mesh.position.copy(missile.pos);
  missile.mesh.lookAt(missile.pos.clone().add(forward));

  if (missile.pos.y <= 1) {
    spawnExplosion(missile.pos, 0x996633);
    igniteNearby(missile.pos, IGNITE_RADIUS_MISSILE);
    playSound('explosion');
    endMissile();
    return;
  }
  if (performance.now() - missile.firedAt > MISSILE_LIFETIME_MS) {
    spawnExplosion(missile.pos, 0x888888);
    igniteNearby(missile.pos, IGNITE_RADIUS_MISSILE);
    endMissile();
    return;
  }

  for (const bot of bots) {
    if (!bot.alive) continue;
    if (missile.pos.distanceTo(bot.mesh.position) <= MISSILE_HIT_RADIUS) {
      bot.hp = 0;
      destroyBot(bot);
      igniteNearby(missile.pos, IGNITE_RADIUS_MISSILE);
      endMissile();
      return;
    }
  }
}

// ---------- Plane flight ----------
function clampToWorldBounds(pos) {
  const horizDist = Math.hypot(pos.x, pos.z);
  if (horizDist > WORLD_RADIUS) {
    const scale = WORLD_RADIUS / horizDist;
    pos.x *= scale;
    pos.z *= scale;
  }
}

function updatePlane(dt) {
  const targetBank = -(lookVelocityYaw) * 3.2;
  planeBank += (Math.max(-BANK_MAX, Math.min(BANK_MAX, targetBank)) - planeBank) * Math.min(1, dt * 4);
  lookVelocityYaw = 0;

  // Energy model: pitch trades speed for altitude and back, like a real dive/climb — positive
  // planePitch is nose-down in this codebase's convention (see forwardFromYawPitch), so diving
  // (sin > 0) gains speed and climbing (sin < 0) bleeds it off.
  planeSpeed += Math.sin(planePitch) * PLANE_ENERGY_ACCEL * dt;
  planeSpeed = Math.max(PLANE_MIN_SPEED, Math.min(PLANE_MAX_SPEED, planeSpeed));
  const stalling = planeSpeed <= PLANE_STALL_SPEED;
  if (stalling) {
    // Loss of control — the nose drops regardless of mouse input until enough speed (i.e. a
    // dive) is regained. Additive on top of whatever the player's own mouse-look already did
    // this frame, so recovering by diving still feels responsive rather than fighting a hard
    // override.
    planePitch = Math.min(CAM_MAX_PITCH, planePitch + PLANE_STALL_NOSE_DROP_RATE * dt);
  }

  const forward = forwardFromYawPitch(planeYaw, planePitch);
  planePos.addScaledVector(forward, planeSpeed * dt);
  planePos.y = Math.min(MAX_ALT, planePos.y); // no floor — flying low enough crashes, see below
  clampToWorldBounds(planePos);

  if (planePos.y <= GROUND_LEVEL + 1) {
    planePos.y = GROUND_LEVEL;
    planeGroup.position.copy(planePos);
    crashPlane('Crashed into the ground!');
    return;
  }

  for (const bot of bots) {
    if (!bot.alive) continue;
    if (planePos.distanceTo(bot.mesh.position) <= PLANE_COLLISION_RADIUS) {
      destroyBot(bot);
      crashPlane('Collided with an enemy plane!');
      return;
    }
  }

  planeGroup.position.copy(planePos);
  planeGroup.lookAt(planePos.clone().add(forward));
  planeGroup.rotateZ(planeBank);
}

// ---------- Bots AI ----------
// Aerial bots just patrol now — they never target or fire on the player (see the matching
// change in updateGroundBots for red ground troops). The player can still shoot them down;
// it's one-way.
function updateBots(dt) {
  for (const bot of bots) {
    if (!bot.alive) continue; // permadeath — no respawn once destroyed
    bot.angle += bot.speed * dt;
    const x = bot.centerX + Math.cos(bot.angle) * bot.radius;
    const z = bot.centerZ + Math.sin(bot.angle) * bot.radius;
    const nextAngle = bot.angle + bot.speed * dt;
    const nx = bot.centerX + Math.cos(nextAngle) * bot.radius;
    const nz = bot.centerZ + Math.sin(nextAngle) * bot.radius;
    bot.mesh.position.set(x, bot.altitude, z);
    bot.mesh.lookAt(nx, bot.altitude, nz);
  }
}

// ---------- Player machine gun (left click / touch gun button) ----------
let nextBulletAt = 0;

// Rate-limited by nextBulletAt rather than gating the caller — lets both the held-mouse-button
// loop in animate() and a single keypress call this every frame with no extra bookkeeping.
function fireBullet() {
  if (!gameStarted || controllingMissile || mode === 'parachuting') return;
  const now = performance.now();
  if (now < nextBulletAt) return;
  nextBulletAt = now + BULLET_COOLDOWN_MS;
  const mesh = makePlayerBulletMesh();
  const forward = forwardFromYawPitch(planeYaw, planePitch);
  const pos = planePos.clone().addScaledVector(forward, 4.5);
  if (mode === 'onfoot') pos.y += EYE_HEIGHT - 0.4; // planePos is feet height on foot — spawn near the (first-person, unseen) gun instead
  else if (mode === 'swinging') pos.y += 1.5; // planePos is also feet height while swinging — spawn near spideyGroup's gun height
  mesh.position.copy(pos);
  scene.add(mesh);
  playerBullets.push({ mesh, pos, vel: forward.clone().multiplyScalar(BULLET_SPEED), spawnedAt: now });
  playSound('shoot');
}

function updatePlayerBullets(dt) {
  const now = performance.now();
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const b = playerBullets[i];
    b.pos.addScaledVector(b.vel, dt);
    b.mesh.position.copy(b.pos);
    if (now - b.spawnedAt > BULLET_LIFETIME_MS || bulletBlockedByObstacle(b.pos)) {
      scene.remove(b.mesh);
      playerBullets.splice(i, 1);
      continue;
    }
    // findBotNear (not a spread [...bots, ...groundBots]) — this runs per bullet per frame, and
    // with GROUND_BOT_COUNT in the thousands, reallocating a combined array here every time
    // would add up fast for no reason.
    const hitBot = findBotNear(b.pos, BULLET_HIT_RADIUS);
    if (hitBot) {
      hitBot.hp -= 1;
      if (hitBot.hp <= 0) destroyBot(hitBot);
      scene.remove(b.mesh);
      playerBullets.splice(i, 1);
    }
  }
}

// ---------- Camera ----------
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const EYE_HEIGHT = 1.7;
const SNIPER_FOV = 20; // Spider-Man's aim is a real sniper scope, tighter zoom than onfoot's ADS
function updateCamera(dt) {
  if (mode === 'spectating') return; // updateSpectate() drives the camera directly while spectating
  crosshairEl.classList.toggle('missile-cam', controllingMissile);
  const scoped = aiming && mode === 'swinging';
  scopeOverlayEl.classList.toggle('show', scoped);
  crosshairEl.classList.toggle('hidden', scoped);
  const targetFov = !aiming ? NORMAL_FOV : mode === 'swinging' ? SNIPER_FOV : mode === 'onfoot' ? AIM_FOV : NORMAL_FOV;
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
  camera.updateProjectionMatrix();

  // On foot and swinging (Spider-Man) are both true first-person (camera right at eye height,
  // no chase offset) — flying, parachuting, and missile-guidance stay third-person chase cams.
  if ((mode === 'onfoot' || mode === 'swinging') && !controllingMissile) {
    const forward = forwardFromYawPitch(planeYaw, planePitch);
    const desiredPos = planePos.clone();
    desiredPos.y += EYE_HEIGHT;
    const desiredTarget = desiredPos.clone().addScaledVector(forward, 10);
    const lerpFactor = Math.min(1, dt * 10);
    camPos.lerp(desiredPos, lerpFactor);
    camTarget.lerp(desiredTarget, lerpFactor);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    viewmodelGun.position.lerp(aiming ? GUN_AIM_POS : GUN_HIP_POS, Math.min(1, dt * 10));
    return;
  }

  let anchorPos, yaw, pitch;
  if (controllingMissile && missile) {
    anchorPos = missile.pos;
    yaw = missile.yaw;
    pitch = missile.pitch;
  } else {
    anchorPos = planePos;
    yaw = planeYaw;
    pitch = planePitch;
  }
  const forward = forwardFromYawPitch(yaw, pitch);
  const dist = controllingMissile ? 10 : mode === 'parachuting' ? 9 : mode === 'tank' ? 10 : 16;
  const height = controllingMissile ? 3 : mode === 'parachuting' ? 4 : mode === 'tank' ? 4 : 5;
  const desiredPos = anchorPos.clone().addScaledVector(forward, -dist);
  desiredPos.y += height;
  const desiredTarget = anchorPos.clone().addScaledVector(forward, 30);

  const lerpFactor = Math.min(1, dt * 6);
  camPos.lerp(desiredPos, lerpFactor);
  camTarget.lerp(desiredTarget, lerpFactor);
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
}
camPos.copy(planePos).addScaledVector(forwardFromYawPitch(0, 0), -16);
camTarget.copy(planePos);

// ---------- Input ----------
// requestPointerLock() returns a Promise in modern browsers that rejects (harmlessly) if called
// too soon after a previous exit — browsers impose a short cooldown to stop a page from
// re-trapping the cursor instantly. Left unhandled, that rejection surfaces as a reported client
// error on every "Fly Again" click made shortly after dying; swallowed here since the user can
// just click the canvas again a moment later.
function requestPointerLockSafe() {
  const result = canvas.requestPointerLock();
  if (result && result.catch) result.catch(() => {});
}

const keys = {};
let pointerLocked = false;
let lookVelocityYaw = 0;
let aiming = false;

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if ((e.code === 'KeyE') && !e.repeat) {
    if (mode === 'swinging') handleWebAction();
    else if (mode === 'tank') exitTank();
    else if (mode === 'flying') exitPlane();
    else if (mode === 'onfoot') tryEnterVehicle();
  }
  if ((e.code === 'KeyQ') && !e.repeat && mode === 'flying') fireMissile();
  if ((e.code === 'Space') && !e.repeat && mode === 'swinging') doJumpSpidey();
  if ((e.code === 'KeyB') && !e.repeat) bailOut();
  if ((e.code === 'KeyF') && !e.repeat) callPlane();
  if ((e.code === 'KeyN') && !e.repeat) nuke();
  if ((e.code === 'KeyG') && !e.repeat) throwGrenade();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

canvas.addEventListener('click', () => {
  if (!gameStarted || isTouchDevice || pointerLocked) return;
  requestPointerLockSafe();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
let firingBullets = false;
canvas.addEventListener('mousedown', (e) => {
  if (!gameStarted || !pointerLocked) return;
  if (e.button === 0) firingBullets = true;
  if (e.button === 2 && (mode === 'onfoot' || mode === 'swinging')) aiming = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) firingBullets = false;
  if (e.button === 2) aiming = false;
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (!pointerLocked) { firingBullets = false; aiming = false; }
});
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked || controllingMissile) return;
  let sens = PLANE_LOOK_SENSITIVITY;
  if (aiming && mode === 'onfoot') sens *= AIM_SENSITIVITY_SCALE;
  else if (aiming && mode === 'swinging') sens *= SNIPER_SENSITIVITY_SCALE;
  const dYaw = -e.movementX * sens;
  planeYaw += dYaw;
  lookVelocityYaw += dYaw;
  planePitch -= e.movementY * sens;
  planePitch = Math.max(CAM_MIN_PITCH, Math.min(CAM_MAX_PITCH, planePitch));
});

// ---------- Touch controls ----------
let touchMissileX = 0, touchMissileY = 0;
let touchFiringBullets = false;
if (isTouchDevice) {
  document.getElementById('controls-list-desktop').classList.add('hidden');
  document.getElementById('controls-list-touch').classList.remove('hidden');

  const TOUCH_LOOK_SENSITIVITY = 0.0048;
  let lookTouchId = null, lastLookX = 0, lastLookY = 0;
  canvas.addEventListener('touchstart', (e) => {
    if (!gameStarted || lookTouchId !== null) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    lookTouchId = t.identifier;
    lastLookX = t.clientX; lastLookY = t.clientY;
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== lookTouchId || controllingMissile) continue;
      e.preventDefault();
      const dx = t.clientX - lastLookX, dy = t.clientY - lastLookY;
      lastLookX = t.clientX; lastLookY = t.clientY;
      let touchSens = TOUCH_LOOK_SENSITIVITY;
      if (aiming && mode === 'onfoot') touchSens *= AIM_SENSITIVITY_SCALE;
      else if (aiming && mode === 'swinging') touchSens *= SNIPER_SENSITIVITY_SCALE;
      const dYaw = -dx * touchSens;
      planeYaw += dYaw;
      lookVelocityYaw += dYaw;
      planePitch -= dy * touchSens;
      planePitch = Math.max(CAM_MIN_PITCH, Math.min(CAM_MAX_PITCH, planePitch));
    }
  }, { passive: false });
  function releaseLookTouch(e) {
    for (const t of e.changedTouches) if (t.identifier === lookTouchId) lookTouchId = null;
  }
  canvas.addEventListener('touchend', releaseLookTouch);
  canvas.addEventListener('touchcancel', releaseLookTouch);

  touchFireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); fireMissile(); }, { passive: false });

  let touchFiringBulletsId = null;
  touchGunBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchFiringBulletsId = e.changedTouches[0].identifier;
    touchFiringBullets = true;
  }, { passive: false });
  function releaseTouchGun(e) {
    for (const t of e.changedTouches) if (t.identifier === touchFiringBulletsId) { touchFiringBullets = false; touchFiringBulletsId = null; }
  }
  touchGunBtn.addEventListener('touchend', releaseTouchGun);
  touchGunBtn.addEventListener('touchcancel', releaseTouchGun);

  touchBailBtn.addEventListener('touchstart', (e) => { e.preventDefault(); bailOut(); }, { passive: false });

  touchAimBtn.addEventListener('touchstart', (e) => { e.preventDefault(); aiming = true; }, { passive: false });
  function releaseTouchAim(e) { aiming = false; }
  touchAimBtn.addEventListener('touchend', releaseTouchAim);
  touchAimBtn.addEventListener('touchcancel', releaseTouchAim);

  touchNukeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); nuke(); }, { passive: false });
  touchGrenadeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); throwGrenade(); }, { passive: false });
  touchCallPlaneBtn.addEventListener('touchstart', (e) => { e.preventDefault(); callPlane(); }, { passive: false });
  touchAttackBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startWar(); }, { passive: false });

  touchWebBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if (mode === 'swinging') handleWebAction(); }, { passive: false });
  touchJumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if (mode === 'swinging') doJumpSpidey(); }, { passive: false });
  touchEnterBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (mode === 'tank') exitTank();
    else if (mode === 'flying') exitPlane();
    else if (mode === 'onfoot') tryEnterVehicle();
  }, { passive: false });

  const JOYSTICK_RADIUS = 45;
  let joystickTouchId = null;
  function updateMissileJoystick(t) {
    const rect = missileJoystickEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > JOYSTICK_RADIUS) { dx = (dx / dist) * JOYSTICK_RADIUS; dy = (dy / dist) * JOYSTICK_RADIUS; }
    missileJoystickKnobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    touchMissileX = dx / JOYSTICK_RADIUS;
    touchMissileY = dy / JOYSTICK_RADIUS;
  }
  function resetMissileJoystick() {
    joystickTouchId = null;
    touchMissileX = 0; touchMissileY = 0;
    missileJoystickKnobEl.style.transform = 'translate(0px, 0px)';
  }
  missileJoystickEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (joystickTouchId !== null) return;
    const t = e.changedTouches[0];
    joystickTouchId = t.identifier;
    updateMissileJoystick(t);
  }, { passive: false });
  missileJoystickEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === joystickTouchId) updateMissileJoystick(t);
  }, { passive: false });
  window.addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (t.identifier === joystickTouchId) resetMissileJoystick(); });
  window.addEventListener('touchcancel', (e) => { for (const t of e.changedTouches) if (t.identifier === joystickTouchId) resetMissileJoystick(); });
}

// ---------- Sound (synthesized, same approach as Build Craft / Web Swing — no audio files) ----------
let audioCtx = null;
let soundOn = localStorage.getItem('fighterplane_sound_muted') !== '1';
soundToggleBtn.textContent = soundOn ? '🔊' : '🔇';

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function noiseBurst(ctx, now, duration, gainValue) {
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainValue, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(now);
}

function blip(kind) {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  if (kind === 'explosion') {
    noiseBurst(ctx, now, 0.5, 0.35);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
    return;
  }
  const presets = {
    fire: { type: 'sawtooth', f0: 200, f1: 800, g: 0.14, dur: 0.22 },
    shoot: { type: 'square', f0: 900, f1: 500, g: 0.07, dur: 0.06 },
    hit: { type: 'square', f0: 500, f1: 140, g: 0.16, dur: 0.2 },
    gameover: { type: 'sine', f0: 300, f1: 60, g: 0.2, dur: 0.8 },
  };
  const p = presets[kind];
  if (!p) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = p.type;
  osc.frequency.setValueAtTime(p.f0, now);
  osc.frequency.exponentialRampToValueAtTime(p.f1, now + p.dur * 0.8);
  gain.gain.setValueAtTime(p.g, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + p.dur);
  osc.start(now);
  osc.stop(now + p.dur + 0.02);
}

function playSound(kind) {
  if (!soundOn) return;
  blip(kind);
}

// ---------- Continuous ambience: engine drone (pitch tied to airspeed) + wind bed while
// airborne. AudioBufferSourceNode/OscillatorNode can each only ever be start()ed once, so unlike
// the one-shot blips above these are created lazily on first use and then left running
// permanently at gain 0 — "always on but silent" — with gain/frequency just modulated every
// frame in updateContinuousAudio() instead of being started/stopped repeatedly. ----------
let engineOsc = null, engineGain = null;
let windSource = null, windGain = null, windFilter = null;

function ensureContinuousAudio() {
  if (engineOsc) return;
  const ctx = ensureAudio();

  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 80;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(engineGain);
  engineGain.connect(ctx.destination);
  engineOsc.start();

  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  windSource = ctx.createBufferSource();
  windSource.buffer = buffer;
  windSource.loop = true;
  windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 700;
  windGain = ctx.createGain();
  windGain.gain.value = 0;
  windSource.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(ctx.destination);
  windSource.start();
}

function updateContinuousAudio() {
  if (!engineOsc) return;
  const engineOn = soundOn && gameStarted && mode === 'flying';
  const targetEngineGain = engineOn ? 0.045 + Math.min(0.04, (planeSpeed / PLANE_MAX_SPEED) * 0.04) : 0;
  engineGain.gain.value += (targetEngineGain - engineGain.gain.value) * 0.08;
  if (engineOn) engineOsc.frequency.value = 65 + planeSpeed * 1.3;

  const windOn = soundOn && gameStarted && (mode === 'flying' || mode === 'parachuting' || mode === 'swinging');
  const targetWindGain = windOn ? (mode === 'flying' ? 0.045 : 0.028) : 0;
  windGain.gain.value += (targetWindGain - windGain.gain.value) * 0.08;
}

soundToggleBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  localStorage.setItem('fighterplane_sound_muted', soundOn ? '0' : '1');
  soundToggleBtn.textContent = soundOn ? '🔊' : '🔇';
});

attackBtn.addEventListener('click', startWar);

// ---------- Leaderboard ----------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderLeaderboard(scores) {
  leaderboardListEl.innerHTML = '';
  if (!scores || !scores.length) {
    const li = document.createElement('li');
    li.textContent = 'No scores yet — fly a round!';
    leaderboardListEl.appendChild(li);
    return;
  }
  scores.forEach((s, i) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = `${i + 1}. ${s.name}`;
    const sc = document.createElement('span');
    sc.textContent = s.score;
    li.append(name, sc);
    leaderboardListEl.appendChild(li);
  });
}

leaderboardBtn.addEventListener('click', () => {
  leaderboardOverlay.classList.remove('hidden');
  send({ type: 'arcade-leaderboard' });
});
leaderboardCloseBtn.addEventListener('click', () => leaderboardOverlay.classList.add('hidden'));
leaderboardOverlay.addEventListener('click', (e) => {
  if (e.target === leaderboardOverlay) leaderboardOverlay.classList.add('hidden');
});

// ---------- WebSocket ----------
let ws;
function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

// Debounced — destroyBot() calls this on every single kill, and a map-wide nuke or grenade can
// now destroy thousands of troops in one synchronous loop (see GROUND_BOT_COUNT). Coalescing
// into one send ~150ms after the burst settles avoids flooding the WebSocket/server with
// thousands of redundant score submissions; the debounced call always reads the live `score`
// value at fire time, so the final total still goes through correctly.
let scoreSendTimer = null;
function sendScore() {
  if (scoreSendTimer) return;
  scoreSendTimer = setTimeout(() => {
    scoreSendTimer = null;
    send({ type: 'arcade-submit-score', score });
  }, 150);
}

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);
  ws.addEventListener('open', () => send({ type: 'arcade-join', code: roomCode, name: myName, game: 'fighterplane' }));
  ws.addEventListener('close', () => setTimeout(connect, 1500));
  ws.addEventListener('message', (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (err) {
      reportClientError('Malformed WS frame: ' + err.message, err.stack);
      return;
    }
    if (data.type === 'arcade-leaderboard') renderLeaderboard(data.scores || []);
  });
}

window.addEventListener('beforeunload', () => send({ type: 'arcade-leave' }));

// ---------- Start / restart ----------
function beginGame() {
  ensureAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  ensureContinuousAudio();
  menuEl.classList.add('hidden');
  gameoverOverlay.classList.add('hidden');
  hudEl.classList.remove('hidden');
  canvas.classList.remove('hidden');
  crosshairEl.classList.remove('hidden');
  if (isTouchDevice) touchControlsEl.classList.remove('hidden');
  resetGame();
  gameStarted = true;
  warRunning = true;
  updateMissileStatusHud();
  touchWebBtn.classList.toggle('hidden', startingMode !== 'swinging');
  touchJumpBtn.classList.toggle('hidden', startingMode !== 'swinging');
  if (!isTouchDevice) requestPointerLockSafe();
}

startBtn.addEventListener('click', () => {
  startingMode = 'flying';
  beginGame();
});

spidermanStartBtn.addEventListener('click', () => {
  startingMode = 'swinging';
  beginGame();
});

restartBtn.addEventListener('click', beginGame);

// ---------- Main loop ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, clock.getDelta());

  if (gameStarted) {
    if (controllingMissile) updateMissile(dt);
    else if (mode === 'flying') updatePlane(dt);
    else if (mode === 'parachuting') updateParachute(dt);
    else if (mode === 'onfoot') updateOnFoot(dt);
    else if (mode === 'swinging') updateSpidey(dt);
    else if (mode === 'spectating') updateSpectate(dt);
    else if (mode === 'tank') updateTank(dt);

    if ((firingBullets || touchFiringBullets) && !controllingMissile && (mode === 'flying' || mode === 'onfoot' || mode === 'swinging')) fireBullet();
    if ((firingBullets || touchFiringBullets) && mode === 'tank') fireTankShell();
  }
  // The war keeps running on its own even after the player is fully out of lives and gameStarted
  // goes false — troops, planes, and the war-status HUD don't just freeze because the player's
  // own run ended. Only a fresh round (resetGame) actually stops/rewinds it.
  if (warRunning) {
    updateBots(dt);
    updateGroundBots(dt);
    updatePlayerBullets(dt);
    updateTroopBullets(dt);
    updateGrenades(dt);
    updateTankShells(dt);
    updateBluePilots(dt);
    updateFires(performance.now());
    // The minimap redraws every ~3000 dots (troops + aerial bots) from scratch each call — a
    // background overview element doesn't need that at full 60fps, so it's throttled to ~every
    // 4th frame (still reads as live) rather than costing full frame rate for no visible benefit.
    minimapFrameCounter = (minimapFrameCounter + 1) % 4;
    if (minimapFrameCounter === 0) drawMinimap();
    updateWarHud();
  }
  updateExplosions();
  updateCamera(dt);
  updateContinuousAudio(); // outside the gameStarted block so it fades to silence on death too
  if (!controllingMissile && mode === 'flying') updateMissileStatusHud();
  speedStatusEl.classList.toggle('hidden', mode !== 'flying');
  if (mode === 'flying') updateSpeedHud();

  renderer.render(scene, camera);
}

planeGroup.position.copy(planePos);
animate();
connect();
