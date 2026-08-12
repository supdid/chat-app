// ---- Constants ----
const GRAVITY = -26;
const JUMP_VEL = 9;
const RUN_SPEED = 9;
const WEB_MAX_RANGE = 60;
const SWING_ROPE_MIN = 4;
const SWING_ROPE_MAX = 90;
const REEL_SPEED = 14;
const PUMP_ACCEL = 22;
const MAX_SPEED = 55;
const CITY_SEED = 90210; // fixed (not per-room) so every player swings through the identical city
const GRID = 9;
const CELL = 24;
const BUILDING_COLORS = [0x8a97a8, 0x9c8a6e, 0x6f7f91, 0xab7a63, 0x7d8c73, 0x8f8f9a];
const ORB_COUNT = 45;
const CAM_DISTANCE_DEFAULT = 10;
const CAM_DISTANCE_MIN = 3;
const CAM_DISTANCE_MAX = 24;
const CAM_MIN_PITCH = -(Math.PI / 2 - 0.05); // near-vertical looking up from underneath
const CAM_MAX_PITCH = Math.PI / 2 - 0.05; // near-vertical looking straight down
const PLAYER_RADIUS = 0.4;
const CLIMB_OFFSET = 0.5; // how far out from the wall surface the player hangs while climbing
const CLIMB_SPEED = 6;
const CLIMB_IDLE_SLIDE = -1.4; // slow slide down when not actively climbing up/down, for a little urgency
const GRAPPLE_TOP_MARGIN = 4; // aiming within this many units of a building's roof grapples you up onto it
const GRAPPLE_SPEED = 40;
const TOWER_HEIGHT = 480; // the landmark spire at city center — dwarfs every regular building (max ~84)
const TOWER_SIZE = 20;
const PUMP_BUILD_RATE = 0.6; // momentum meter (0-1) gained per second while actively pumping A/D
const PUMP_DECAY_RATE = 0.8; // and lost per second once you stop, so it rewards sustained pumping
const RELEASE_BOOST_MAX = 1.8; // extra velocity multiplier at full pump momentum on release

const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// ---- DOM ----
const canvas = document.getElementById('game-canvas');
const menuEl = document.getElementById('menu');
const hudEl = document.getElementById('hud');
const crosshairEl = document.getElementById('crosshair');
const startBtn = document.getElementById('start-btn');
const scoreLabel = document.getElementById('score-label');
const bestLabel = document.getElementById('best-label');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardOverlay = document.getElementById('leaderboard-overlay');
const leaderboardCloseBtn = document.getElementById('leaderboard-close-btn');
const leaderboardList = document.getElementById('leaderboard-list');
const pickupToastEl = document.getElementById('pickup-toast');
const touchControlsEl = document.getElementById('touch-controls');

// ---- Seeded PRNG (same small mulberry32 implementation used by Build Craft) ----
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Procedural textures (canvas-based, nothing loaded from disk) ----
function makeWindowTexture() {
  const canvasTex = document.createElement('canvas');
  canvasTex.width = 64; canvasTex.height = 128;
  const ctx = canvasTex.getContext('2d');
  const cols = 6, rows = 12;
  const cw = 64 / cols, rh = 128 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() < 0.35;
      ctx.fillStyle = lit ? 'rgba(255,221,150,0.95)' : 'rgba(22,28,36,0.9)';
      ctx.fillRect(c * cw + 1, r * rh + 1, cw - 2, rh - 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvasTex);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeGroundTexture() {
  const canvasTex = document.createElement('canvas');
  canvasTex.width = canvasTex.height = 128;
  const ctx = canvasTex.getContext('2d');
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 126, 126);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(60, 0, 8, 128);
  ctx.fillRect(0, 60, 128, 8);
  return new THREE.CanvasTexture(canvasTex);
}

function makeSkyTexture() {
  const canvasTex = document.createElement('canvas');
  canvasTex.width = 2; canvasTex.height = 256;
  const ctx = canvasTex.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#3f6fd6');
  grad.addColorStop(0.55, '#8fb8e8');
  grad.addColorStop(1, '#e9c98a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  return new THREE.CanvasTexture(canvasTex);
}

// ---- Scene / camera / renderer ----
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 900);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x8fb8e8);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.Mesh(new THREE.SphereGeometry(600, 16, 16), new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false })));
scene.fog = new THREE.Fog(0x8fb8e8, 160, 560);
scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x33261a, 0.95));
const sun = new THREE.DirectionalLight(0xfff2d9, 0.85);
sun.position.set(120, 200, 80);
scene.add(sun);

// ---- City generation ----
const buildings = [];
const buildingMeshes = [];
const collidables = [];
let spawnPlatform = { x: 0, y: 2, z: 0 };

function buildCity() {
  const rng = mulberry32(CITY_SEED);
  const windowTex = makeWindowTexture();
  const half = (GRID - 1) / 2;
  let spawnCandidate = null;
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      // The exact center cell is reserved for the landmark tower below, always present (no plaza
      // roll, no jitter) so it's a fixed, unmistakable "middle of the city" reference point.
      if (i === half && j === half) continue;
      if (rng() < 0.1) continue; // open plaza lot, keeps the skyline from feeling like a solid wall
      const x = (i - half) * CELL + (rng() - 0.5) * 2;
      const z = (j - half) * CELL + (rng() - 0.5) * 2;
      const w = 13 + rng() * 5;
      const d = 13 + rng() * 5;
      const h = 16 + rng() * 68;
      const color = BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)];
      const tex = windowTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 4)));
      const mat = new THREE.MeshLambertMaterial({ color, map: tex });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, h / 2, z);
      scene.add(mesh);
      const info = { mesh, x, z, w, d, h };
      mesh.userData.info = info;
      buildings.push(info);
      buildingMeshes.push(mesh);
      collidables.push(mesh);
      if (Math.abs(i - half) <= 1 && Math.abs(j - half) <= 1 && (!spawnCandidate || h > spawnCandidate.h)) {
        spawnCandidate = info;
      }
    }
  }
  if (spawnCandidate) spawnPlatform = { x: spawnCandidate.x, y: spawnCandidate.h, z: spawnCandidate.z };

  // ---- Landmark tower: a single, dramatically tall spire dead-center in the city (0,0) ----
  // Reuses the exact same info shape as a regular building ({mesh,x,z,w,d,h}) and gets pushed
  // into the same buildings/buildingMeshes/collidables arrays, so wall-climbing, roof-grappling,
  // and collision push-out all work on it automatically with zero special-casing elsewhere.
  {
    const towerTex = windowTex.clone();
    towerTex.needsUpdate = true;
    towerTex.repeat.set(Math.max(1, Math.round(TOWER_SIZE / 4)), Math.max(1, Math.round(TOWER_HEIGHT / 4)));
    const towerMat = new THREE.MeshLambertMaterial({ color: 0xc0392b, map: towerTex });
    const towerMesh = new THREE.Mesh(new THREE.BoxGeometry(TOWER_SIZE, TOWER_HEIGHT, TOWER_SIZE), towerMat);
    towerMesh.position.set(0, TOWER_HEIGHT / 2, 0);
    scene.add(towerMesh);
    const towerInfo = { mesh: towerMesh, x: 0, z: 0, w: TOWER_SIZE, d: TOWER_SIZE, h: TOWER_HEIGHT };
    towerMesh.userData.info = towerInfo;
    buildings.push(towerInfo);
    buildingMeshes.push(towerMesh);
    collidables.push(towerMesh);

    // Purely decorative antenna spike on top — not in buildings/collidables, so the roof (and
    // the top a grapple/climb lands you on) is the flat top of the main tower body, same as
    // every other building; the spike just makes the landmark read as a proper spire from afar.
    const spike = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 3, 55, 8),
      new THREE.MeshLambertMaterial({ color: 0x8a8f96 })
    );
    spike.position.set(0, TOWER_HEIGHT + 27.5, 0);
    scene.add(spike);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3b30 })
    );
    beacon.position.set(0, TOWER_HEIGHT + 55, 0);
    scene.add(beacon);
  }

  const groundSize = GRID * CELL + 80;
  const groundTex = makeGroundTexture();
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(groundSize / 12, groundSize / 12);
  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, groundSize),
    new THREE.MeshLambertMaterial({ color: 0x585d66, map: groundTex })
  );
  groundMesh.rotation.x = -Math.PI / 2;
  scene.add(groundMesh);
  collidables.push(groundMesh);
}
buildCity();

// ---- Avatars (shared between the local player and remote ghosts) ----
function makeAvatar(name, showName, bodyColor = 0xcc1f36, limbColor = 0x1f3fcc, emissive = 0x000000) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor, emissive });
  const limbMat = new THREE.MeshLambertMaterial({ color: limbColor, emissive });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), bodyMat);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), bodyMat);
  head.position.y = 1.65;
  group.add(head);
  const legGeo = new THREE.BoxGeometry(0.22, 0.7, 0.22);
  [-0.14, 0.14].forEach((xOff) => {
    const leg = new THREE.Mesh(legGeo, limbMat);
    leg.position.set(xOff, 0.35, 0);
    group.add(leg);
  });
  const armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
  [-0.38, 0.38].forEach((xOff) => {
    const arm = new THREE.Mesh(armGeo, limbMat);
    arm.position.set(xOff, 1.05, 0);
    group.add(arm);
  });
  if (showName) {
    const nameCanvas = document.createElement('canvas');
    nameCanvas.width = 256; nameCanvas.height = 64;
    const ctx = nameCanvas.getContext('2d');
    ctx.fillStyle = 'rgba(6,14,22,0.75)';
    ctx.fillRect(0, 12, 256, 40);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.slice(0, 16), 128, 32);
    const tex = new THREE.CanvasTexture(nameCanvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(1.8, 0.45, 1);
    sprite.position.y = 2.15;
    group.add(sprite);
  }
  return group;
}

// ---- Player state ----
const player = {
  x: spawnPlatform.x, y: spawnPlatform.y + 1, z: spawnPlatform.z,
  vx: 0, vy: 0, vz: 0,
  yaw: 0,
  grounded: false,
  swinging: false,
  anchor: null,
  ropeLen: 0,
  climbing: false,
  climbAxis: null,
  climbFixedCoord: 0,
  climbNormal: null,
  climbBuilding: null,
  grappling: false,
  grappleTarget: null,
  pumpMomentum: 0,
};

const localAvatar = makeAvatar('You', false);
scene.add(localAvatar);

// A plain THREE.Line renders at a fixed ~1px regardless of any linewidth setting (a long-standing
// WebGL/ANGLE limitation), which makes a web strand nearly impossible to see — a thin unlit
// cylinder stretched and rotated between the two endpoints gives it real, visible thickness.
function makeWebStrand() {
  const geo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color: 0xf5f7ff, transparent: true, opacity: 0.92 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
}

const UP_AXIS = new THREE.Vector3(0, 1, 0);
function updateWebStrand(strand, from, to) {
  if (!to) { strand.visible = false; return; }
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.05) { strand.visible = false; return; }
  strand.visible = true;
  strand.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  strand.scale.set(1, len, 1);
  strand.quaternion.setFromUnitVectors(UP_AXIS, new THREE.Vector3(dx / len, dy / len, dz / len));
}

const webStrand = makeWebStrand();

// ---- Camera: third-person orbit driven by camYaw/camPitch (mouse drag or touch drag) ----
let camYaw = 0;
let camPitch = 0.35;
let camDistance = CAM_DISTANCE_DEFAULT;
function setCamDistance(d) { camDistance = Math.max(CAM_DISTANCE_MIN, Math.min(CAM_DISTANCE_MAX, d)); }

// Forward/aim direction derived analytically from the orbit angles (pitch=0 gives the same
// forward vector three.js uses for rotation.y=camYaw), so aiming, running direction and the
// camera's own position formula all agree without reading it back off the smoothed camera.
function aimDirection() {
  return new THREE.Vector3(
    -Math.sin(camYaw) * Math.cos(camPitch),
    -Math.sin(camPitch),
    -Math.cos(camYaw) * Math.cos(camPitch)
  ).normalize();
}

function updateCamera() {
  const aim = aimDirection();
  const targetPos = new THREE.Vector3(
    player.x - aim.x * camDistance,
    player.y - aim.y * camDistance + 2.2,
    player.z - aim.z * camDistance
  );
  camera.position.lerp(targetPos, 0.25);
  camera.lookAt(player.x, player.y + 1.6, player.z);
}

// ---- Collectible orbs ----
const orbGeo = new THREE.IcosahedronGeometry(0.5, 0);
const orbMat = new THREE.MeshStandardMaterial({ color: 0xffd93d, emissive: 0xff9900, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.2 });
const orbs = [];
let score = 0;
let best = Number(localStorage.getItem('webswing_best') || 0);
bestLabel.textContent = `Best: ${best}`;

function randomOrbPosition() {
  const b = buildings[Math.floor(Math.random() * buildings.length)];
  if (Math.random() < 0.5) {
    return {
      x: b.x + (Math.random() - 0.5) * b.w * 0.8,
      y: b.h + 1.2 + Math.random() * 2,
      z: b.z + (Math.random() - 0.5) * b.d * 0.8,
    };
  }
  return {
    x: b.x + (Math.random() - 0.5) * CELL * 1.4,
    y: 8 + Math.random() * (b.h * 0.7),
    z: b.z + (Math.random() - 0.5) * CELL * 1.4,
  };
}

function spawnOrbs() {
  for (let i = 0; i < ORB_COUNT; i++) {
    const pos = randomOrbPosition();
    const mesh = new THREE.Mesh(orbGeo, orbMat);
    mesh.position.set(pos.x, pos.y, pos.z);
    scene.add(mesh);
    orbs.push({ mesh, base: pos, t: Math.random() * Math.PI * 2 });
  }
}
spawnOrbs();

function showToast(text, duration = 700) {
  pickupToastEl.textContent = text;
  pickupToastEl.classList.remove('hidden');
  pickupToastEl.style.animation = 'none';
  void pickupToastEl.offsetWidth;
  pickupToastEl.style.animation = '';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => pickupToastEl.classList.add('hidden'), duration);
}

function collectOrb(orb) {
  orb.mesh.visible = false;
  score++;
  scoreLabel.textContent = `🕸️ ${score}`;
  if (score > best) {
    best = score;
    localStorage.setItem('webswing_best', String(best));
    bestLabel.textContent = `Best: ${best}`;
  }
  showToast('+1');
  playSound('collect');
  sendScore();
  setTimeout(() => {
    const pos = randomOrbPosition();
    orb.mesh.position.set(pos.x, pos.y, pos.z);
    orb.base = pos;
    orb.mesh.visible = true;
  }, 3500);
}

function updateOrbs(dt) {
  for (const orb of orbs) {
    orb.t += dt * 2;
    orb.mesh.rotation.y += dt * 1.5;
    orb.mesh.position.y = orb.base.y + Math.sin(orb.t) * 0.3;
    if (!orb.mesh.visible) continue;
    const dx = orb.mesh.position.x - player.x;
    const dy = orb.mesh.position.y - (player.y + 1);
    const dz = orb.mesh.position.z - player.z;
    if (dx * dx + dy * dy + dz * dz < 2.6 * 2.6) collectOrb(orb);
  }
}

// ---- Web-swing action ----
const raycaster = new THREE.Raycaster();
function shootWeb() {
  if (player.grappling) return;
  const origin = new THREE.Vector3(player.x, player.y + 1.5, player.z);
  const dir = aimDirection();
  raycaster.set(origin, dir);
  raycaster.far = WEB_MAX_RANGE;
  const hits = raycaster.intersectObjects(buildingMeshes, false);
  // A real building in range grapples/swings off that building same as before. Aiming at open
  // sky/plaza/ground used to just whiff — but real Spider-Man games don't require a physical
  // attachment point either, so fall back to a point straight out along the aim ray at max
  // range and swing from that instead. This is what lets you sling across the whole map (open
  // plazas, city edges, rooftop gaps) rather than only ever near a building.
  const hit = hits.length ? hits[0] : null;
  const point = hit ? hit.point : origin.clone().addScaledVector(dir, WEB_MAX_RANGE);
  const b = hit ? hit.object.userData.info : null;
  player.climbing = false;
  if (b && point.y >= b.h - GRAPPLE_TOP_MARGIN) {
    // Aimed near a rooftop — grapple straight up onto it instead of swinging from it, like
    // the "web-zip" traversal move in modern Spider-Man games.
    player.swinging = false;
    player.anchor = null;
    player.grappling = true;
    player.grappleTarget = { x: point.x, y: b.h + 1, z: point.z };
    player.grounded = false;
    playSound('shoot');
    return;
  }
  player.anchor = { x: point.x, y: point.y, z: point.z };
  player.ropeLen = Math.max(SWING_ROPE_MIN, origin.distanceTo(point));
  player.swinging = true;
  player.grounded = false;
  player.pumpMomentum = 0;
  playSound('shoot');
}

function releaseWeb() {
  // Cash in accumulated pump momentum as a launch boost — the harder you pumped before letting
  // go, the bigger the jump, same reward loop as pumping a playground swing for extra height.
  if (player.pumpMomentum > 0) {
    const boost = 1 + player.pumpMomentum * RELEASE_BOOST_MAX;
    player.vx *= boost; player.vy *= boost; player.vz *= boost;
    player.pumpMomentum = 0;
  }
  player.swinging = false;
  player.anchor = null;
  playSound('release');
}

function handleWebAction() {
  if (player.grappling) return;
  if (player.swinging) releaseWeb();
  else shootWeb();
}

// Fast zip toward a rooftop grapple target — gravity-free straight-line pull, snaps to a stand
// on arrival. Buildings-collision/ground-check are skipped while this is active (see update()),
// since the target deliberately sits right at a wall/roof edge that those would otherwise resist.
function updateGrapple(dt) {
  const t = player.grappleTarget;
  const dx = t.x - player.x, dy = t.y - player.y, dz = t.z - player.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1.2) {
    player.x = t.x; player.y = t.y; player.z = t.z;
    player.vx = player.vy = player.vz = 0;
    player.grappling = false;
    player.grounded = true;
    playSound('land');
    return;
  }
  const nx = dx / dist, ny = dy / dist, nz = dz / dist;
  player.x += nx * GRAPPLE_SPEED * dt;
  player.y += ny * GRAPPLE_SPEED * dt;
  player.z += nz * GRAPPLE_SPEED * dt;
  player.vx = nx * GRAPPLE_SPEED; player.vy = ny * GRAPPLE_SPEED; player.vz = nz * GRAPPLE_SPEED;
}

function doJump() {
  if (player.swinging) return;
  if (player.climbing) {
    // Push off the wall the player was clinging to, in whichever direction its face pointed.
    player.climbing = false;
    player.vx = player.climbNormal.x * 7;
    player.vz = player.climbNormal.z * 7;
    player.vy = JUMP_VEL * 0.85;
    player.grounded = false;
    playSound('jump');
    return;
  }
  if (!player.grounded) return; // no double-jump
  player.vy = JUMP_VEL;
  player.grounded = false;
  playSound('jump');
}

// ---- Wall climbing: a short forward raycast while running toward a building grabs its wall.
// The player is then pinned to a fixed offset outside that wall's plane (climbFixedCoord along
// climbAxis) and W/S/A/D drive climbing up/down and shuffling sideways along the face instead of
// normal ground/air movement.
const climbRay = new THREE.Raycaster();
function tryStartClimb() {
  // Gated on actual horizontal speed/direction rather than requiring the literal forward key —
  // strafing or moving diagonally into a wall grabs it too, not just running straight at it.
  const hSpeed = Math.hypot(player.vx, player.vz);
  if (hSpeed < 0.3) return;
  const dir = new THREE.Vector3(player.vx, 0, player.vz).normalize();
  climbRay.set(new THREE.Vector3(player.x, player.y + 1.0, player.z), dir);
  climbRay.far = 1.4;
  const hits = climbRay.intersectObjects(buildingMeshes, false);
  if (!hits.length) return;
  const hit = hits[0];
  const b = hit.object.userData.info;
  if (!b || player.y + 1.0 >= b.h) return; // already at/above roof height — nothing to climb
  const n = hit.face.normal;
  player.climbing = true;
  player.grounded = false;
  player.climbBuilding = b;
  if (Math.abs(n.x) > Math.abs(n.z)) {
    player.climbAxis = 'x';
    player.climbFixedCoord = b.x + Math.sign(n.x) * (b.w / 2 + CLIMB_OFFSET);
    player.climbNormal = { x: Math.sign(n.x), z: 0 };
  } else {
    player.climbAxis = 'z';
    player.climbFixedCoord = b.z + Math.sign(n.z) * (b.d / 2 + CLIMB_OFFSET);
    player.climbNormal = { x: 0, z: Math.sign(n.z) };
  }
  player.vx = 0; player.vy = 0; player.vz = 0;
}

function updateClimb(dt) {
  const { f, r } = readMoveInput();
  player.y += (f !== 0 ? f * CLIMB_SPEED : CLIMB_IDLE_SLIDE) * dt;
  const b = player.climbBuilding;
  const floorY = b.yMin !== undefined ? b.yMin : 0;
  if (player.climbAxis === 'x') {
    player.x = player.climbFixedCoord;
    player.z = Math.max(b.z - b.d / 2 - 0.5, Math.min(b.z + b.d / 2 + 0.5, player.z + r * CLIMB_SPEED * dt));
  } else {
    player.z = player.climbFixedCoord;
    player.x = Math.max(b.x - b.w / 2 - 0.5, Math.min(b.x + b.w / 2 + 0.5, player.x + r * CLIMB_SPEED * dt));
  }
  if (player.y >= b.h) { player.y = b.h; player.climbing = false; player.grounded = true; }
  else if (player.y <= floorY + 0.05) { player.y = floorY; player.climbing = false; player.grounded = true; }
}

// Simple padded-AABB push-out per wall (a building outside, or a room wall inside) so running or
// swinging can't clip through one.
function resolveWallCollisions(walls) {
  for (const b of walls) {
    const floorY = b.yMin !== undefined ? b.yMin : 0;
    if (player.y >= b.h || player.y <= floorY - 0.5) continue;
    const minX = b.x - b.w / 2 - PLAYER_RADIUS, maxX = b.x + b.w / 2 + PLAYER_RADIUS;
    const minZ = b.z - b.d / 2 - PLAYER_RADIUS, maxZ = b.z + b.d / 2 + PLAYER_RADIUS;
    if (player.x <= minX || player.x >= maxX || player.z <= minZ || player.z >= maxZ) continue;
    const penLeft = player.x - minX, penRight = maxX - player.x;
    const penBack = player.z - minZ, penFront = maxZ - player.z;
    const minPen = Math.min(penLeft, penRight, penBack, penFront);
    if (minPen === penLeft) { player.x = minX; if (player.vx > 0) player.vx = 0; }
    else if (minPen === penRight) { player.x = maxX; if (player.vx < 0) player.vx = 0; }
    else if (minPen === penBack) { player.z = minZ; if (player.vz > 0) player.vz = 0; }
    else { player.z = maxZ; if (player.vz < 0) player.vz = 0; }
  }
}

// ---- Input: keyboard + mouse (pointer lock) ----
const keys = {};
let pointerLocked = false;
let gameStarted = false;

window.addEventListener('keydown', (e) => {
  if (!gameStarted) return;
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); doJump(); }
  if (e.code === 'KeyE') { e.preventDefault(); handleWebAction(); }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

canvas.addEventListener('click', () => {
  if (!gameStarted || isTouchDevice || pointerLocked) return;
  canvas.requestPointerLock();
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || !gameStarted || !pointerLocked) return;
  handleWebAction();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
});
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  camYaw -= e.movementX * 0.0028;
  camPitch -= e.movementY * 0.0028;
  camPitch = Math.max(CAM_MIN_PITCH, Math.min(CAM_MAX_PITCH, camPitch));
});
canvas.addEventListener('wheel', (e) => {
  if (!gameStarted) return;
  e.preventDefault();
  setCamDistance(camDistance + e.deltaY * 0.015);
}, { passive: false });

// ---- Touch controls ----
let touchMoveX = 0;
let touchMoveZ = 0;

if (isTouchDevice) {
  document.getElementById('controls-list-desktop').classList.add('hidden');
  document.getElementById('controls-list-touch').classList.remove('hidden');

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
    touchMoveX = dx / JOYSTICK_RADIUS;
    touchMoveZ = dy / JOYSTICK_RADIUS;
  }
  function resetJoystick() {
    joystickTouchId = null;
    touchMoveX = 0; touchMoveZ = 0;
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
  // Tracks every finger currently on the canvas (not just the look-drag one) so a second finger
  // touching down turns the gesture into a pinch-zoom instead of look-drag.
  const canvasTouches = new Map();
  let pinchStartDist = null;
  let pinchStartCamDistance = camDistance;
  function touchPairDist() {
    const pts = [...canvasTouches.values()];
    return pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : null;
  }
  canvas.addEventListener('touchstart', (e) => {
    if (!gameStarted) return;
    for (const t of e.changedTouches) canvasTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
    if (canvasTouches.size >= 2) {
      e.preventDefault();
      pinchStartDist = touchPairDist();
      pinchStartCamDistance = camDistance;
      return;
    }
    if (lookTouchId !== null) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    lookTouchId = t.identifier;
    lastLookX = t.clientX; lastLookY = t.clientY;
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (canvasTouches.has(t.identifier)) canvasTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (canvasTouches.size >= 2 && pinchStartDist) {
      e.preventDefault();
      const d = touchPairDist();
      if (d) setCamDistance(pinchStartCamDistance * (pinchStartDist / d));
      return;
    }
    for (const t of e.changedTouches) {
      if (t.identifier !== lookTouchId) continue;
      e.preventDefault();
      const dx = t.clientX - lastLookX, dy = t.clientY - lastLookY;
      lastLookX = t.clientX; lastLookY = t.clientY;
      camYaw -= dx * TOUCH_LOOK_SENSITIVITY;
      camPitch -= dy * TOUCH_LOOK_SENSITIVITY;
      camPitch = Math.max(CAM_MIN_PITCH, Math.min(CAM_MAX_PITCH, camPitch));
    }
  }, { passive: false });
  function releaseLookTouch(e) {
    for (const t of e.changedTouches) {
      canvasTouches.delete(t.identifier);
      if (t.identifier === lookTouchId) lookTouchId = null;
    }
    if (canvasTouches.size < 2) pinchStartDist = null;
  }
  canvas.addEventListener('touchend', releaseLookTouch);
  canvas.addEventListener('touchcancel', releaseLookTouch);

  function bindTap(id, onTap) {
    document.getElementById(id).addEventListener('touchstart', (e) => { e.preventDefault(); onTap(); }, { passive: false });
  }
  bindTap('touch-jump', () => doJump());
  bindTap('touch-web', () => handleWebAction());
}

// ---- Physics ----
function readMoveInput() {
  let f = 0, r = 0;
  if (keys.KeyW) f += 1;
  if (keys.KeyS) f -= 1;
  if (keys.KeyD) r += 1;
  if (keys.KeyA) r -= 1;
  if (isTouchDevice) { f -= touchMoveZ; r += touchMoveX; }
  return { f, r };
}

function updateInputMove(dt) {
  if (player.climbing || player.grappling) return; // updateClimb()/updateGrapple() drive position themselves
  const { f, r } = readMoveInput();
  const fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw);
  const rightX = -fwdZ, rightZ = fwdX;
  if (player.swinging) {
    if (f !== 0) player.ropeLen = Math.max(SWING_ROPE_MIN, Math.min(SWING_ROPE_MAX, player.ropeLen - f * REEL_SPEED * dt));
    if (r !== 0) {
      player.vx += rightX * r * PUMP_ACCEL * dt;
      player.vz += rightZ * r * PUMP_ACCEL * dt;
      // Actively pumping (holding A/D) charges a momentum meter that releaseWeb() cashes in as a
      // big speed boost on letting go — rewards working the swing instead of just riding gravity.
      player.pumpMomentum = Math.min(1, player.pumpMomentum + dt * PUMP_BUILD_RATE);
    } else {
      player.pumpMomentum = Math.max(0, player.pumpMomentum - dt * PUMP_DECAY_RATE);
    }
    return;
  }
  if (f || r) {
    const len = Math.hypot(f, r);
    const wishX = fwdX * (f / len) + rightX * (r / len);
    const wishZ = fwdZ * (f / len) + rightZ * (r / len);
    const speed = player.grounded ? RUN_SPEED : RUN_SPEED * 0.55;
    const accel = player.grounded ? 0.3 : 0.06;
    player.vx += (wishX * speed - player.vx) * accel;
    player.vz += (wishZ * speed - player.vz) * accel;
  } else if (player.grounded) {
    player.vx *= 0.8;
    player.vz *= 0.8;
  }
}

// Rope constraint: gravity/velocity integrate freely each step, then if the player has drifted
// past the rope length, snap back onto the circle around the anchor and drop only the *radial*
// component of velocity moving away from it — that's what turns free-fall into a pendulum arc.
function updateSwing(dt) {
  player.vy += GRAVITY * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.z += player.vz * dt;
  const a = player.anchor;
  const dx = player.x - a.x, dy = player.y - a.y, dz = player.z - a.z;
  const dist = Math.hypot(dx, dy, dz) || 0.0001;
  if (dist > player.ropeLen) {
    const nx = dx / dist, ny = dy / dist, nz = dz / dist;
    player.x = a.x + nx * player.ropeLen;
    player.y = a.y + ny * player.ropeLen;
    player.z = a.z + nz * player.ropeLen;
    const vDotN = player.vx * nx + player.vy * ny + player.vz * nz;
    if (vDotN > 0) { player.vx -= nx * vDotN; player.vy -= ny * vDotN; player.vz -= nz * vDotN; }
  }
}

const downRay = new THREE.Raycaster();
function groundCheck() {
  downRay.set(new THREE.Vector3(player.x, player.y + 1.0, player.z), new THREE.Vector3(0, -1, 0));
  downRay.far = 250;
  const hits = downRay.intersectObjects(collidables, false);
  if (hits.length) {
    const groundY = hits[0].point.y;
    if (player.y <= groundY + 0.15 && player.vy <= 0) {
      const fallSpeed = -player.vy;
      player.y = groundY;
      player.vy = 0;
      if (!player.grounded && fallSpeed > 6) playSound('land');
      player.grounded = true;
      return;
    }
  }
  player.grounded = false;
}

function updateRope() {
  const ropeTarget = player.swinging ? player.anchor : (player.grappling ? player.grappleTarget : null);
  updateWebStrand(webStrand, { x: player.x, y: player.y + 1.3, z: player.z }, ropeTarget);
}

function update(dt) {
  updateInputMove(dt);
  if (!player.swinging && !player.climbing && !player.grappling) tryStartClimb();

  if (player.grappling) {
    updateGrapple(dt);
  } else if (player.climbing) {
    updateClimb(dt);
  } else if (player.swinging) {
    updateSwing(dt);
  } else {
    player.vy += GRAVITY * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.z += player.vz * dt;
  }
  const spd = Math.hypot(player.vx, player.vy, player.vz);
  if (spd > MAX_SPEED) { const k = MAX_SPEED / spd; player.vx *= k; player.vy *= k; player.vz *= k; }

  // Ground/rooftop landing must resolve before the wall push-out check below — otherwise a
  // player whose Y dips just below a roof for one frame while landing on it gets treated as
  // having hit the building's side wall and shoved off, instead of coming to a stand on top.
  if (!player.climbing && !player.grappling) {
    groundCheck();
    resolveWallCollisions(buildings);
  }
  if (player.grounded && player.swinging) releaseWeb();

  if (player.climbing) {
    player.yaw = Math.atan2(player.climbNormal.x, player.climbNormal.z);
  } else {
    const hSpeed = Math.hypot(player.vx, player.vz);
    if (hSpeed > 0.6) player.yaw = Math.atan2(-player.vx, -player.vz);
  }
  localAvatar.position.set(player.x, player.y, player.z);
  localAvatar.rotation.y = player.yaw;

  updateCamera();
  updateRope();
  updateOrbs(dt);
  updateRemoteAvatars();
  sendPosBroadcast();
}

// ---- Multiplayer: same room code as chat (from the menu link), one shared "sw" (spider-web)
// session per room — everyone sees the same deterministic city, so unlike Build Craft there's no
// world state to sync, just ghost positions + their current rope for a shared "look, they're
// swinging too" feel. ----
const mpParams = new URLSearchParams(location.search);
const mpRoomCode = mpParams.get('room');
const mpPlayerName = (mpParams.get('name') || 'Player').slice(0, 30);
if (mpRoomCode) {
  document.getElementById('back-link').href = `index.html?room=${encodeURIComponent(mpRoomCode)}&name=${encodeURIComponent(mpPlayerName)}`;
}

let swSocket = null;
let swMyId = null;
const remotePlayers = new Map();

function addRemotePlayer(id, name, pos) {
  if (id === swMyId || remotePlayers.has(id)) return;
  const group = makeAvatar(name, true);
  group.position.set(pos.x, pos.y, pos.z);
  scene.add(group);
  const strand = makeWebStrand();
  remotePlayers.set(id, { group, strand, target: { x: pos.x, y: pos.y, z: pos.z, yaw: pos.yaw || 0 }, swinging: false, anchor: null });
}

function removeRemotePlayer(id) {
  const rp = remotePlayers.get(id);
  if (!rp) return;
  scene.remove(rp.group);
  scene.remove(rp.strand);
  remotePlayers.delete(id);
}

function updateRemoteAvatars() {
  for (const rp of remotePlayers.values()) {
    rp.group.position.x += (rp.target.x - rp.group.position.x) * 0.25;
    rp.group.position.y += (rp.target.y - rp.group.position.y) * 0.25;
    rp.group.position.z += (rp.target.z - rp.group.position.z) * 0.25;
    rp.group.rotation.y += (rp.target.yaw - rp.group.rotation.y) * 0.25;
    updateWebStrand(
      rp.strand,
      { x: rp.group.position.x, y: rp.group.position.y + 1.3, z: rp.group.position.z },
      rp.swinging ? rp.anchor : null
    );
  }
}

function connectSw() {
  if (!mpRoomCode) return;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  swSocket = new WebSocket(`${protocol}//${location.host}`);
  swSocket.addEventListener('open', () => {
    swSocket.send(JSON.stringify({ type: 'sw-join', code: mpRoomCode, name: mpPlayerName }));
  });
  swSocket.addEventListener('message', (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (err) {
      reportClientError('Malformed WS frame: ' + err.message, err.stack);
      return;
    }
    if (data.type === 'sw-init') {
      swMyId = data.id;
      data.players.forEach((p) => addRemotePlayer(p.id, p.name, p));
    } else if (data.type === 'sw-player-joined') {
      addRemotePlayer(data.id, data.name, { x: spawnPlatform.x, y: spawnPlatform.y + 1, z: spawnPlatform.z, yaw: 0 });
    } else if (data.type === 'sw-pos') {
      const rp = remotePlayers.get(data.id);
      if (rp) {
        rp.target.x = data.x; rp.target.y = data.y; rp.target.z = data.z; rp.target.yaw = data.yaw;
        rp.swinging = data.swinging;
        rp.anchor = data.swinging ? { x: data.ax, y: data.ay, z: data.az } : null;
      }
    } else if (data.type === 'sw-player-left') {
      removeRemotePlayer(data.id);
    } else if (data.type === 'sw-full') {
      if (swSocket) swSocket.close();
      swSocket = null;
    } else if (data.type === 'sw-leaderboard-result') {
      renderLeaderboard(data.scores || []);
    }
  });
}

let lastPosSent = 0;
function sendPosBroadcast() {
  if (!swSocket || swSocket.readyState !== WebSocket.OPEN) return;
  const now = performance.now();
  if (now - lastPosSent < 100) return;
  lastPosSent = now;
  // Ghosts only need something to draw a rope line toward — a grapple zip is visually the same
  // as a taut swing from the remote viewer's perspective, so both share the "swinging" field.
  const ropeTarget = player.swinging ? player.anchor : (player.grappling ? player.grappleTarget : null);
  swSocket.send(JSON.stringify({
    type: 'sw-pos',
    x: player.x, y: player.y, z: player.z, yaw: player.yaw,
    swinging: !!ropeTarget,
    ax: ropeTarget ? ropeTarget.x : 0,
    ay: ropeTarget ? ropeTarget.y : 0,
    az: ropeTarget ? ropeTarget.z : 0,
  }));
}

function sendScore() {
  if (!swSocket || swSocket.readyState !== WebSocket.OPEN) return;
  swSocket.send(JSON.stringify({ type: 'sw-score', score }));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderLeaderboard(scores) {
  leaderboardList.innerHTML = '';
  if (!scores.length) {
    leaderboardList.innerHTML = '<li>No scores yet — be the first!</li>';
    return;
  }
  scores.forEach((s) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(s.name)}</span><span>${s.score}</span>`;
    leaderboardList.appendChild(li);
  });
}

leaderboardBtn.addEventListener('click', () => {
  leaderboardOverlay.classList.remove('hidden');
  if (swSocket && swSocket.readyState === WebSocket.OPEN) {
    swSocket.send(JSON.stringify({ type: 'sw-leaderboard', code: mpRoomCode }));
  } else {
    leaderboardList.innerHTML = '<li>Join a chat room to see the room leaderboard.</li>';
  }
});
leaderboardCloseBtn.addEventListener('click', () => leaderboardOverlay.classList.add('hidden'));

// ---- Sound (synthesized via Web Audio, no audio files — same approach as the app's other games) ----
let audioCtx = null;
let soundOn = localStorage.getItem('webswing_sound_muted') !== '1';
soundToggleBtn.textContent = soundOn ? '🔊' : '🔇';

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
    shoot: { type: 'sine', f0: 900, f1: 220, g: 0.15, dur: 0.16 },
    release: { type: 'sine', f0: 300, f1: 300, g: 0.08, dur: 0.1 },
    collect: { type: 'triangle', f0: 600, f1: 1200, g: 0.14, dur: 0.2 },
    jump: { type: 'square', f0: 220, f1: 440, g: 0.06, dur: 0.09 },
    land: { type: 'sine', f0: 140, f1: 140, g: 0.12, dur: 0.12 },
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
  if (!soundOn) return;
  blip(kind);
}

soundToggleBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  localStorage.setItem('webswing_sound_muted', soundOn ? '0' : '1');
  soundToggleBtn.textContent = soundOn ? '🔊' : '🔇';
});

// ---- Start / game loop ----
startBtn.addEventListener('click', () => {
  ensureAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  menuEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  canvas.classList.remove('hidden');
  crosshairEl.classList.remove('hidden');
  if (isTouchDevice) touchControlsEl.classList.remove('hidden');
  player.x = spawnPlatform.x; player.y = spawnPlatform.y + 1; player.z = spawnPlatform.z;
  player.vx = player.vy = player.vz = 0;
  player.grounded = false;
  gameStarted = true;
  connectSw();
  if (!isTouchDevice) canvas.requestPointerLock();
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (gameStarted) update(dt);
  renderer.render(scene, camera);
}
animate();
