// ---- Constants ----
const GRAVITY = -26;
const JUMP_VEL = 9;
const RUN_SPEED = 9;
const WEB_MAX_RANGE = 60;
const SWING_ROPE_MIN = 4;
const SWING_ROPE_MAX = 90;
const REEL_SPEED = 14;
const WEB_CLIMB_SPEED = 8; // rope shortened per second while holding jump on a web (hand-over-hand ascent)
const PUMP_ACCEL = 22;
const MAX_SPEED = 55;
const CITY_SEED = 90210; // fixed (not per-room) so every player swings through the identical city
const GRID = 9;
const CELL = 24;
// Ground plane extent. Module-scope because the physics needs the same numbers the mesh is built
// from — computing them twice is how the floor check and the actual ground silently drift apart.
const GROUND_TILES = GRID + 4;
const GROUND_SIZE = GROUND_TILES * CELL;
const GROUND_HALF = GROUND_SIZE / 2;
// Below this you are under the world with nothing to catch you. Nothing legitimate reaches it: the
// ground is at y=0 and is solid across the whole plane, so this is only attainable off the edge.
const VOID_Y = -25;
const BUILDING_COLORS = [0x8a97a8, 0x9c8a6e, 0x6f7f91, 0xab7a63, 0x7d8c73, 0x8f8f9a];
const ORB_COUNT = 45;
const CAM_DISTANCE_DEFAULT = 10;
const CAM_DISTANCE_MIN = 3;
const CAM_DISTANCE_MAX = 24;
const CAM_MIN_PITCH = -(Math.PI / 2 - 0.05); // near-vertical looking up from underneath
const CAM_MAX_PITCH = Math.PI / 2 - 0.05; // near-vertical looking straight down
const PLAYER_RADIUS = 0.4;
const CLIMB_OFFSET = 0.5; // how far out from the wall surface the player hangs while climbing
// How far inward to step when topping out a climb. Must clear CLIMB_OFFSET plus the player's own
// radius, with margin, so the downward ray in groundCheck() lands on roof rather than past the lip.
const MANTLE_INSET = CLIMB_OFFSET + PLAYER_RADIUS + 0.3;
const CLIMB_SPEED = 6;
const CLIMB_IDLE_SLIDE = -1.4; // slow slide down when not actively climbing up/down, for a little urgency
const GRAPPLE_TOP_MARGIN = 4; // aiming within this many units of a building's roof grapples you up onto it
const GRAPPLE_SPEED = 40;
// ---- PvP web strikes ---- (must match SW_MAX_HEALTH/SW_STRIKE_RANGE/SW_STRIKE_COOLDOWN_MS on
// the server — the server is authoritative on health/hits, these are just for local UX: showing
// the right health bar width and graying out the strike input during its own cooldown so it
// doesn't fire a request that the server would silently drop anyway.)
const SW_MAX_HEALTH_CLIENT = 3;
const SW_STRIKE_RANGE_CLIENT = 30;
const SW_STRIKE_COOLDOWN_MS_CLIENT = 700;
const SW_STRIKE_AIM_DOT_MIN = 0.55; // how tightly you have to be aiming at someone to hit them, 1 = dead-on
const TOWER_HEIGHT = 480; // the landmark spire at city center — dwarfs every regular building (max ~84)
const TOWER_SIZE = 20;
const PUMP_BUILD_RATE = 0.6; // momentum meter (0-1) gained per second while actively pumping A/D
const PUMP_DECAY_RATE = 0.8; // and lost per second once you stop, so it rewards sustained pumping
const RELEASE_BOOST_MAX = 1.8; // extra velocity multiplier at full pump momentum on release
const DIVE_ACCEL = -34; // extra downward accel while diving, on top of gravity
const DIVE_STEER = 16; // how hard a dive pulls toward where you're aiming, so it can be steered
const FOV_BASE = 72;
const FOV_SPEED_ADD = 16; // extra FOV at top speed — the whole sense of velocity comes from this
const FOV_SPEED_FLOOR = 18; // below this speed the FOV sits at base
const AIR_CHAIN_MAX_BONUS = 4; // orbs stack up to +4 while you stay off the ground
const THRILL_SPEED_MIN = 22; // below this a close pass reads as loitering, not a near miss
const THRILL_RADIUS = 3.4; // gap to a facade that counts as a near miss (player radius is 0.4)
const THRILL_COOLDOWN = 1.3; // per-building re-arm, so one wall can't be farmed by hugging it
const THRILL_CHAIN_WINDOW = 2.2; // land another near miss inside this and the streak keeps building
const THRILL_CHAIN_MAX = 5;
const WIPEOUT_SPEED = 32; // downward speed at ground contact that turns a landing into a crash
const WIPEOUT_DURATION = 1.05; // seconds of no control after a crash
// Wind. Driven off the same speed normalisation as the FOV kick and the edge rush, so all three
// agree about how fast you're going. Squared gain keeps it out of the way at cruising speed and only
// really arrives near the top end — a linear ramp made a gentle swing sound like a gale.
const WIND_SPEED_FLOOR = 14; // below this there's no wind at all
const WIND_MAX_GAIN = 0.16;
const WIND_CUTOFF_MIN = 240; // Hz — a dull rumble when slow
const WIND_CUTOFF_MAX = 1800; // opens to a bright rush at full speed
// A release only pays the "perfect" bonus if you were both charged AND still rising. Letting go at
// the top of the arc, or on the way down, squanders the charge however hard you pumped — and that
// distinction is the actual skill the release boost was always meant to reward.
const PERFECT_PUMP_MIN = 0.55;
const PERFECT_RISE_MIN = 2.0; // upward velocity needed to count as "on the way up"
const PERFECT_BONUS_MULT = 1.25; // extra multiplier on the release boost for nailing it
const TRAIL_SAMPLES = 22; // ribbon history length
const TRAIL_MIN_SPEED = 19; // ribbon fades in above this
const TRAIL_WIDTH = 0.45;

const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// ---- Reduced motion ----
// The camera shake, the speed FOV kick and the edge rush are all camera-space motion effects, which
// is precisely the category that triggers vestibular symptoms. For someone susceptible an
// unconditioned shake doesn't make the game unpleasant, it makes it unplayable. The CSS already
// honoured this setting for the pump meter's pulse; nothing in the 3D layer did.
//
// The speed *readout* and the world-space ribbon are deliberately left alone — they carry the same
// "how fast am I going" information without moving the camera, so honouring the setting costs the
// player no information, only nausea.
const REDUCED_SPEED_FX = 0.3; // the edge rush is a static vignette, so it's damped rather than cut
const reducedMotionQuery = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;
let reducedMotion = !!(reducedMotionQuery && reducedMotionQuery.matches);
if (reducedMotionQuery) {
  const onReducedMotionChange = (e) => {
    reducedMotion = e.matches;
    if (reducedMotion) shakeAmp = 0; // drop any shake already in flight rather than letting it ring out
  };
  // addEventListener is the modern MediaQueryList form; addListener is the Safari < 14 fallback.
  if (reducedMotionQuery.addEventListener) reducedMotionQuery.addEventListener('change', onReducedMotionChange);
  else if (reducedMotionQuery.addListener) reducedMotionQuery.addListener(onReducedMotionChange);
}

// Split out so each effect's response can be asserted directly rather than inferred from rendering.
function shakeScale() { return reducedMotion ? 0 : 1; }
function fovSpeedAdd() { return reducedMotion ? 0 : FOV_SPEED_ADD; }
function speedFxScale() { return reducedMotion ? REDUCED_SPEED_FX : 1; }

// ---- DOM ----
const canvas = document.getElementById('game-canvas');
const menuEl = document.getElementById('menu');
const hudEl = document.getElementById('hud');
const crosshairEl = document.getElementById('crosshair');
const startBtn = document.getElementById('start-btn');
const scoreLabel = document.getElementById('score-label');
const chainLabel = document.getElementById('chain-label');
const speedLabel = document.getElementById('speed-label');
const speedFxEl = document.getElementById('speed-fx');
const pumpMeterEl = document.getElementById('pump-meter');
const pumpFillEl = document.getElementById('pump-fill');
const pumpHintEl = document.getElementById('pump-hint');
const bestLabel = document.getElementById('best-label');
const healthBarEl = document.getElementById('health-bar');
const damageFlashEl = document.getElementById('damage-flash');
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
// A real curtain wall isn't flat panes on a void — it's glass punched into a concrete frame, with a
// slab edge between floors and glass that mirrors the sky rather than being uniformly black. Double
// the old resolution buys room for those three details, which is most of what sells a facade when
// you're swinging past it a few metres away.
function makeWindowTexture() {
  const canvasTex = document.createElement('canvas');
  canvasTex.width = 128; canvasTex.height = 256;
  const ctx = canvasTex.getContext('2d');
  const cols = 6, rows = 12;
  const cw = 128 / cols, rh = 256 / rows;
  ctx.fillStyle = '#6d7480';
  ctx.fillRect(0, 0, 128, 256);
  // Concrete grain, so a facade held close to the camera isn't one dead flat colour.
  for (let i = 0; i < 1100; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
  }
  for (let r = 0; r < rows; r++) {
    ctx.fillStyle = 'rgba(0,0,0,0.20)'; // floor slab edge
    ctx.fillRect(0, r * rh, 128, 3);
    for (let c = 0; c < cols; c++) {
      const x = c * cw + 2, y = r * rh + 4, w = cw - 4, h = rh - 7;
      const lit = Math.random() < 0.3;
      if (lit) {
        ctx.fillStyle = `rgb(255,${205 + Math.floor(Math.random() * 40)},${140 + Math.floor(Math.random() * 55)})`;
      } else {
        // Unlit glass reflects sky, and reflects less of it the lower down the facade you look.
        const s = 42 + Math.round((1 - r / rows) * 40 + Math.random() * 16);
        ctx.fillStyle = `rgb(${Math.round(s * 0.68)},${Math.round(s * 0.86)},${s + 22})`;
      }
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = `rgba(255,255,255,${lit ? 0.20 : 0.11})`; // glancing highlight off the top of each pane
      ctx.fillRect(x, y, w, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvasTex);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = MAX_ANISOTROPY;
  return tex;
}

// One tile == one city block (see the repeat maths in buildCity), so the pale border drawn here
// lands as the pavement around each block and the dashes fall down the middle of the road between
// them, instead of the old grid that tiled every 12 units with no relation to where buildings sit.
function makeGroundTexture() {
  const canvasTex = document.createElement('canvas');
  canvasTex.width = canvasTex.height = 256;
  const ctx = canvasTex.getContext('2d');
  ctx.fillStyle = '#33373d';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) { // asphalt grain
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.055})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  ctx.fillStyle = '#83878e'; // pavement slab around the block
  ctx.fillRect(0, 0, 256, 20); ctx.fillRect(0, 236, 256, 20);
  ctx.fillRect(0, 0, 20, 256); ctx.fillRect(236, 0, 20, 256);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; // kerb line
  ctx.lineWidth = 2;
  ctx.strokeRect(21, 21, 214, 214);
  ctx.fillStyle = 'rgba(230,218,152,0.7)'; // centre-line dashes, both axes
  for (let i = 0; i < 256; i += 34) {
    ctx.fillRect(126, i + 7, 4, 18);
    ctx.fillRect(i + 7, 126, 18, 4);
  }
  const tex = new THREE.CanvasTexture(canvasTex);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = MAX_ANISOTROPY;
  return tex;
}

function makeSkyTexture() {
  const canvasTex = document.createElement('canvas');
  canvasTex.width = 2; canvasTex.height = 256;
  const ctx = canvasTex.getContext('2d');
  // Extra stops through the middle: a real sky loses saturation faster than it loses brightness on
  // the way down to the horizon, and a plain three-stop ramp reads as a painted backdrop instead.
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2f5fc9');
  grad.addColorStop(0.35, '#5f8fdd');
  grad.addColorStop(0.62, '#9cc0e9');
  grad.addColorStop(0.82, '#c8d8e4');
  grad.addColorStop(1, '#e9c98a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(canvasTex);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

// ---- Scene / camera / renderer ----
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 900);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x8fb8e8);
// Colour pipeline: without sRGB output three does its lighting maths in sRGB space, which is what
// makes untouched WebGL scenes read as flat and slightly plasticky. Encoding the output correctly
// and rolling the highlights off through ACES is the single cheapest realism win available here —
// it costs one extra shader step and no geometry.
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
// Sun shadows are the other big one, but they're the expensive part of this pass, so touch devices
// keep the old unshadowed look rather than eating the fill-rate cost on a phone GPU.
const SHADOWS_ENABLED = !isTouchDevice;
renderer.shadowMap.enabled = SHADOWS_ENABLED;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Building facades and the road are almost always viewed at a grazing angle in this game, which is
// exactly the case where isotropic mipmapping turns texture detail into grey mush.
const MAX_ANISOTROPY = renderer.capabilities.getMaxAnisotropy();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// toneMapped:false keeps the gradient exactly as authored — ACES would otherwise desaturate the
// sky along with everything else, and the sky is the one surface with no lighting to roll off.
scene.add(new THREE.Mesh(new THREE.SphereGeometry(600, 32, 24), new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false, toneMapped: false })));
// Fog tinted toward the pale horizon band rather than mid-sky blue, so distant towers fade into the
// skyline the way haze actually works instead of turning blue.
scene.fog = new THREE.Fog(0xc3d4e6, 170, 620);
scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x4a3b2c, 0.62));
const sun = new THREE.DirectionalLight(0xfff2d9, 1.35);
// Same direction as before (this is the old vector x3), but pushed far enough out that the 480-unit
// landmark tower still falls inside the shadow camera's near plane instead of poking through it.
sun.position.set(360, 600, 240);
if (SHADOWS_ENABLED) {
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  // Wide enough to hold the whole city plus the very long shadow the centre tower throws.
  const SHADOW_EXTENT = 260;
  sun.shadow.camera.left = -SHADOW_EXTENT;
  sun.shadow.camera.right = SHADOW_EXTENT;
  sun.shadow.camera.top = SHADOW_EXTENT;
  sun.shadow.camera.bottom = -SHADOW_EXTENT;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 1600;
  // normalBias is what stops acne on the big flat facades at this texel density; a plain depth
  // bias large enough to do the same job would visibly detach shadows from the buildings casting them.
  sun.shadow.normalBias = 0.5;
  sun.shadow.bias = -0.0004;
}
scene.add(sun);

// ---- City generation ----
const buildings = [];
const buildingMeshes = [];
const collidables = [];
let spawnPlatform = { x: 0, y: 2, z: 0 };

// Rooftop clutter — plant housings, vents, a stair head. Shared geometry and two shared materials
// so ~150 extra props cost almost nothing in state changes. These DO go into collidables (unlike
// the tower spike) purely so you can land on top of one instead of sinking through it; they stay
// out of `buildings`, so wall push-out and climbing still see a clean flat-topped box.
const ROOF_PROP_GEO = new THREE.BoxGeometry(1, 1, 1);
const roofPropMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.86, metalness: 0.1 });
const roofVentMat = new THREE.MeshStandardMaterial({ color: 0x6f757c, roughness: 0.65, metalness: 0.35 });

function addRoofDetail(b, rng) {
  const count = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const pw = 1.6 + rng() * 3.0;
    const pd = 1.6 + rng() * 3.0;
    const ph = 1.0 + rng() * 2.4;
    const mesh = new THREE.Mesh(ROOF_PROP_GEO, rng() < 0.4 ? roofVentMat : roofPropMat);
    mesh.scale.set(pw, ph, pd);
    mesh.position.set(
      b.x + (rng() - 0.5) * Math.max(0, b.w - pw - 1.5),
      b.h + ph / 2,
      b.z + (rng() - 0.5) * Math.max(0, b.d - pd - 1.5)
    );
    mesh.castShadow = SHADOWS_ENABLED;
    mesh.receiveShadow = SHADOWS_ENABLED;
    scene.add(mesh);
    collidables.push(mesh);
  }
}

function buildCity() {
  const rng = mulberry32(CITY_SEED);
  // Roof props draw from their own stream. Sharing `rng` would shift every subsequent draw and
  // silently regenerate the entire skyline — still identical for everyone, but a different city
  // than the one that existed before, and a different one again for anyone on a stale cached JS.
  const roofRng = mulberry32(CITY_SEED ^ 0x5bf03635);
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
      const mat = new THREE.MeshStandardMaterial({ color, map: tex, roughness: 0.72, metalness: 0.08 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, h / 2, z);
      mesh.castShadow = SHADOWS_ENABLED;
      mesh.receiveShadow = SHADOWS_ENABLED;
      scene.add(mesh);
      const info = { mesh, x, z, w, d, h };
      addRoofDetail(info, roofRng);
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
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, map: towerTex, roughness: 0.6, metalness: 0.18 });
    const towerMesh = new THREE.Mesh(new THREE.BoxGeometry(TOWER_SIZE, TOWER_HEIGHT, TOWER_SIZE), towerMat);
    towerMesh.position.set(0, TOWER_HEIGHT / 2, 0);
    towerMesh.castShadow = SHADOWS_ENABLED;
    towerMesh.receiveShadow = SHADOWS_ENABLED;
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
      new THREE.CylinderGeometry(0.6, 3, 55, 12),
      new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.45, metalness: 0.7 })
    );
    spike.castShadow = SHADOWS_ENABLED;
    spike.position.set(0, TOWER_HEIGHT + 27.5, 0);
    scene.add(spike);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3b30 })
    );
    beacon.position.set(0, TOWER_HEIGHT + 55, 0);
    scene.add(beacon);
  }

  // A whole number of cells wide, with exactly one texture tile per cell, so tile centres land on
  // city-cell centres — that's what puts the pavement border around each block and the road dashes
  // in the gaps between them. Padding that isn't a whole multiple of CELL breaks the alignment.
  const groundTex = makeGroundTexture();
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(GROUND_TILES, GROUND_TILES);
  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
    // White base: the texture now carries the road/pavement colour itself, so a tinted material
    // colour (which multiplies) would just crush it back down to flat grey.
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: groundTex, roughness: 0.95, metalness: 0 })
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = SHADOWS_ENABLED;
  scene.add(groundMesh);
  collidables.push(groundMesh);
}
buildCity();

// ---- Roof parapets ----
// The lip around the edge of every roof, including the landmark tower. All four sides of all
// buildings go into one InstancedMesh, so ~290 slabs cost a single draw call — the reason the
// rooftop props above are loose meshes but these are not is simply that these are uniform.
// Decorative only, not in buildings/collidables: the surface you land on stays the flat box top.
function buildParapets() {
  const T = 0.4;  // thickness
  const PH = 0.7; // height above the roof — a lip, not a wall you'd have to climb
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x8b9099, roughness: 0.85, metalness: 0.06 }),
    buildings.length * 4
  );
  mesh.castShadow = SHADOWS_ENABLED;
  mesh.receiveShadow = SHADOWS_ENABLED;
  const d3 = new THREE.Object3D();
  let i = 0;
  const put = (px, py, pz, sx, sy, sz) => {
    d3.position.set(px, py, pz);
    d3.scale.set(sx, sy, sz);
    d3.updateMatrix();
    mesh.setMatrixAt(i++, d3.matrix);
  };
  for (const b of buildings) {
    const y = b.h + PH / 2;
    put(b.x + b.w / 2 - T / 2, y, b.z, T, PH, b.d);
    put(b.x - b.w / 2 + T / 2, y, b.z, T, PH, b.d);
    put(b.x, y, b.z + b.d / 2 - T / 2, b.w, PH, T);
    put(b.x, y, b.z - b.d / 2 + T / 2, b.w, PH, T);
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
}
buildParapets();

// ---- Distant skyline ----
// A silhouette ring well outside the playable grid, so the city reads as one district of something
// larger instead of stopping dead at the edge of the ground plane. One InstancedMesh, so 160
// background towers cost a single draw call. Never added to buildings/collidables — the ring starts
// at radius 340 and WEB_MAX_RANGE is 60, so it is permanently out of reach.
function buildDistantSkyline() {
  const rng = mulberry32(CITY_SEED ^ 0x2f1b3c5d);
  const COUNT = 160;
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0x93a7bb }),
    COUNT
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < COUNT; i++) {
    const ang = (i / COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.05;
    const rad = 340 + rng() * 160;
    const h = 40 + rng() * 180;
    const w = 18 + rng() * 26;
    dummy.position.set(Math.cos(ang) * rad, h / 2, Math.sin(ang) * rad);
    dummy.scale.set(w, h, w);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
}
buildDistantSkyline();

// ---- Clouds ----
// Sprites rather than geometry, parked between 250 and 380 — below the 480-unit landmark tower on
// purpose, so climbing it takes you out above the cloud layer.
function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  // Several overlapping soft blobs read as a puff; one radial gradient alone reads as a ball.
  for (let i = 0; i < 7; i++) {
    const x = 28 + Math.random() * 72, y = 46 + Math.random() * 36, r = 16 + Math.random() * 24;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

const clouds = [];
function buildClouds() {
  const mat = new THREE.SpriteMaterial({
    map: makeCloudTexture(), transparent: true, opacity: 0.85, depthWrite: false, fog: false,
  });
  for (let i = 0; i < 18; i++) {
    const s = new THREE.Sprite(mat);
    const scale = 90 + Math.random() * 130;
    s.scale.set(scale, scale * 0.45, 1);
    s.position.set((Math.random() - 0.5) * 900, 250 + Math.random() * 130, (Math.random() - 0.5) * 900);
    scene.add(s);
    clouds.push({ sprite: s, drift: 0.9 + Math.random() * 1.6 });
  }
}
buildClouds();

function updateClouds(dt) {
  for (const c of clouds) {
    c.sprite.position.x += c.drift * dt;
    if (c.sprite.position.x > 470) c.sprite.position.x = -470;
  }
}

// ---- Landing dust ----
// One fixed-size Points cloud reused for every impact rather than allocating particles per landing,
// so a hard landing costs no garbage. Hidden entirely while dead so it isn't drawn for nothing.
const DUST_COUNT = 26;
const dustPositions = new Float32Array(DUST_COUNT * 3);
const dustVel = new Float32Array(DUST_COUNT * 3);
let dustLife = 0;
const DUST_DURATION = 0.55;

// One soft radial falloff, shared by the dust puff, the orb haloes and the sun glow — they only
// differ by colour, scale and blend mode, so three separate canvases would be three for nothing.
function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const GLOW_TEXTURE = makeGlowTexture();

// Sun glow: sits just inside the sky sphere along the light's own direction, so the bright spot in
// the sky and the direction shadows actually fall can never disagree.
{
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: GLOW_TEXTURE, color: 0xffe9b0, transparent: true, opacity: 0.8,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  glow.scale.set(170, 170, 1);
  glow.position.copy(sun.position).normalize().multiplyScalar(560);
  scene.add(glow);
}

const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dustMat = new THREE.PointsMaterial({
  color: 0xd6cfc2, size: 0.6, transparent: true, opacity: 0, depthWrite: false, map: GLOW_TEXTURE,
});
const dustPoints = new THREE.Points(dustGeo, dustMat);
dustPoints.visible = false;
dustPoints.frustumCulled = false;
scene.add(dustPoints);

function spawnDust(x, y, z, strength) {
  const spread = 1.6 + strength * 0.14;
  for (let i = 0; i < DUST_COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.5;
    dustPositions[i * 3] = x + Math.cos(a) * r;
    dustPositions[i * 3 + 1] = y + 0.1 + Math.random() * 0.2;
    dustPositions[i * 3 + 2] = z + Math.sin(a) * r;
    dustVel[i * 3] = Math.cos(a) * spread * (0.4 + Math.random() * 0.8);
    dustVel[i * 3 + 1] = 0.7 + Math.random() * 1.5;
    dustVel[i * 3 + 2] = Math.sin(a) * spread * (0.4 + Math.random() * 0.8);
  }
  dustLife = DUST_DURATION;
  dustPoints.visible = true;
  dustGeo.attributes.position.needsUpdate = true;
}

function updateDust(dt) {
  if (dustLife <= 0) return;
  dustLife -= dt;
  if (dustLife <= 0) { dustPoints.visible = false; dustMat.opacity = 0; return; }
  for (let i = 0; i < DUST_COUNT; i++) {
    dustPositions[i * 3] += dustVel[i * 3] * dt;
    dustPositions[i * 3 + 1] += dustVel[i * 3 + 1] * dt;
    dustPositions[i * 3 + 2] += dustVel[i * 3 + 2] * dt;
    dustVel[i * 3 + 1] -= 3.2 * dt; // settles back down rather than rising forever
    dustVel[i * 3] *= 0.94;
    dustVel[i * 3 + 2] *= 0.94;
  }
  dustGeo.attributes.position.needsUpdate = true;
  const k = dustLife / DUST_DURATION;
  dustMat.opacity = k * 0.7;
  dustMat.size = 0.6 + (1 - k) * 0.5;
}

// ---- Speed ribbon ----
// A billboarded triangle strip through the player's recent positions. This is the only thing that
// draws the *shape* of an arc while you're inside it — the FOV kick and edge rush both say "fast"
// but say nothing about the line you're travelling. Additive blending is what gives the fade for
// free: the tail vertices are coloured black, which is transparent under additive, so no per-vertex
// alpha (and therefore no custom shader) is needed.
const trailPos = new Float32Array(TRAIL_SAMPLES * 3);
const trailVerts = new Float32Array(TRAIL_SAMPLES * 2 * 3);
const trailCols = new Float32Array(TRAIL_SAMPLES * 2 * 3);
let trailActive = false;
let trailStrength = 0;

const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailVerts, 3));
trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCols, 3));
{
  const idx = [];
  for (let i = 0; i < TRAIL_SAMPLES - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  trailGeo.setIndex(idx);
}
const trailMat = new THREE.MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const trailMesh = new THREE.Mesh(trailGeo, trailMat);
trailMesh.frustumCulled = false; // vertices are rewritten in world space every frame
trailMesh.visible = false;
scene.add(trailMesh);

function seedTrail(x, y, z) {
  for (let i = 0; i < TRAIL_SAMPLES; i++) {
    trailPos[i * 3] = x; trailPos[i * 3 + 1] = y; trailPos[i * 3 + 2] = z;
  }
}

const trailDir = new THREE.Vector3();
const trailToCam = new THREE.Vector3();
const trailSide = new THREE.Vector3();
const trailLastSide = new THREE.Vector3(1, 0, 0);

function updateTrail(dt) {
  const spd = Math.hypot(player.vx, player.vy, player.vz);
  const want = !player.grounded && !player.climbing && spd > TRAIL_MIN_SPEED;
  if (want && !trailActive) seedTrail(player.x, player.y + 1.1, player.z);
  trailActive = want;
  // Strength eases both ways so the ribbon doesn't pop in and out at the threshold.
  const target = want ? Math.min(1, (spd - TRAIL_MIN_SPEED) / (MAX_SPEED - TRAIL_MIN_SPEED)) : 0;
  trailStrength += (target - trailStrength) * Math.min(1, dt * 6);
  if (trailStrength < 0.01) { trailMesh.visible = false; return; }
  trailMesh.visible = true;

  trailPos.copyWithin(3, 0, (TRAIL_SAMPLES - 1) * 3);
  trailPos[0] = player.x; trailPos[1] = player.y + 1.1; trailPos[2] = player.z;

  for (let i = 0; i < TRAIL_SAMPLES; i++) {
    const j = i * 3;
    const k = Math.min(i, TRAIL_SAMPLES - 2); // last sample borrows the segment before it
    trailDir.set(
      trailPos[k * 3] - trailPos[(k + 1) * 3],
      trailPos[k * 3 + 1] - trailPos[(k + 1) * 3 + 1],
      trailPos[k * 3 + 2] - trailPos[(k + 1) * 3 + 2]
    );
    trailToCam.set(camera.position.x - trailPos[j], camera.position.y - trailPos[j + 1], camera.position.z - trailPos[j + 2]);
    trailSide.crossVectors(trailDir, trailToCam);
    // Degenerate while the ribbon is still filling (all samples coincident) — hold the last good
    // side vector rather than emitting NaN vertices, which would blank the whole mesh.
    if (trailSide.lengthSq() < 1e-8) trailSide.copy(trailLastSide);
    else { trailSide.normalize(); trailLastSide.copy(trailSide); }
    const taper = (1 - i / (TRAIL_SAMPLES - 1));
    const w = TRAIL_WIDTH * taper * trailStrength;
    const v = i * 6;
    trailVerts[v] = trailPos[j] + trailSide.x * w;
    trailVerts[v + 1] = trailPos[j + 1] + trailSide.y * w;
    trailVerts[v + 2] = trailPos[j + 2] + trailSide.z * w;
    trailVerts[v + 3] = trailPos[j] - trailSide.x * w;
    trailVerts[v + 4] = trailPos[j + 1] - trailSide.y * w;
    trailVerts[v + 5] = trailPos[j + 2] - trailSide.z * w;
    const c = taper * taper * trailStrength;
    trailCols[v] = 0.45 * c; trailCols[v + 1] = 0.72 * c; trailCols[v + 2] = 1.0 * c;
    trailCols[v + 3] = 0.45 * c; trailCols[v + 4] = 0.72 * c; trailCols[v + 5] = 1.0 * c;
  }
  trailGeo.attributes.position.needsUpdate = true;
  trailGeo.attributes.color.needsUpdate = true;
}

// ---- Web impact pop ----
// A one-shot flare at the point a web actually bites. Without it the strand simply exists on the
// frame after the shot, and there is no read on *where* it caught — which is the one thing you need
// to judge the swing you're about to take.
const IMPACT_DURATION = 0.32;
let impactLife = 0;
const impactMat = new THREE.SpriteMaterial({
  map: GLOW_TEXTURE,
  color: 0xffffff,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  opacity: 0,
});
const impactSprite = new THREE.Sprite(impactMat);
impactSprite.visible = false;
scene.add(impactSprite);

function spawnImpact(x, y, z) {
  impactSprite.position.set(x, y, z);
  impactLife = IMPACT_DURATION;
  impactSprite.visible = true;
}

function updateImpact(dt) {
  if (impactLife <= 0) return;
  impactLife -= dt;
  if (impactLife <= 0) { impactSprite.visible = false; impactMat.opacity = 0; return; }
  const k = impactLife / IMPACT_DURATION;
  const s = 1.2 + (1 - k) * 3.4; // expands as it fades
  impactSprite.scale.set(s, s, 1);
  impactMat.opacity = k * k * 0.95;
}

// ---- Camera shake ----
// Positional jitter applied after lookAt, so the aim direction the player is steering with is never
// disturbed — only the framing shakes. Amplitude is taken as a max rather than summed, so a crash
// landing during a near miss doesn't stack into a seizure.
let shakeAmp = 0;
function addShake(amount) {
  const a = amount * shakeScale();
  if (a <= 0) return;
  shakeAmp = Math.min(1.4, Math.max(shakeAmp, a));
}

// ---- Avatars (shared between the local player and remote ghosts) ----
// Built as a joint hierarchy rather than four loose boxes: every limb hangs off a pivot group placed
// at the shoulder or hip, with a second pivot at the elbow/knee, so rotating a pivot swings the limb
// from the joint the way a real one bends. That's what makes the climb cycles below possible at all
// — the old avatar had nothing to rotate around. Overall height is unchanged (~1.9), so nothing in
// the physics, camera or rope-attachment maths had to move.
function makeAvatar(name, showName, bodyColor = 0xcc1f36, limbColor = 0x1f3fcc, emissive = 0x000000) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, emissive, roughness: 0.62, metalness: 0.05 });
  const limbMat = new THREE.MeshStandardMaterial({ color: limbColor, emissive, roughness: 0.62, metalness: 0.05 });

  const addMesh = (parent, geo, mat, y) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = SHADOWS_ENABLED;
    parent.add(m);
    return m;
  };

  // Torso as pelvis → waist → chest, each a little wider than the last, which gives a shoulder line
  // and a waist taper instead of the single slab it used to be.
  const torso = new THREE.Group();
  group.add(torso);
  addMesh(torso, new THREE.BoxGeometry(0.34, 0.20, 0.22), limbMat, 0.92);
  addMesh(torso, new THREE.BoxGeometry(0.36, 0.28, 0.22), bodyMat, 1.16);
  addMesh(torso, new THREE.BoxGeometry(0.44, 0.34, 0.25), bodyMat, 1.44);
  addMesh(torso, new THREE.CylinderGeometry(0.085, 0.095, 0.10, 8), bodyMat, 1.645);
  const head = addMesh(torso, new THREE.SphereGeometry(0.17, 14, 12), bodyMat, 1.79);
  head.scale.set(0.95, 1.06, 1);
  [-0.24, 0.24].forEach((x) => { addMesh(torso, new THREE.SphereGeometry(0.105, 10, 8), bodyMat, 1.52).position.x = x; });

  const upperArmGeo = new THREE.BoxGeometry(0.130, 0.34, 0.130);
  const foreArmGeo = new THREE.BoxGeometry(0.115, 0.32, 0.115);
  const handGeo = new THREE.BoxGeometry(0.13, 0.13, 0.14);
  const thighGeo = new THREE.BoxGeometry(0.170, 0.42, 0.170);
  const shinGeo = new THREE.BoxGeometry(0.150, 0.40, 0.150);
  const footGeo = new THREE.BoxGeometry(0.16, 0.09, 0.26);

  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.265, 1.52, 0);
    torso.add(shoulder);
    addMesh(shoulder, upperArmGeo, limbMat, -0.17);
    const elbow = new THREE.Group();
    elbow.position.y = -0.34;
    shoulder.add(elbow);
    addMesh(elbow, foreArmGeo, limbMat, -0.16);
    addMesh(elbow, handGeo, bodyMat, -0.37);
    return { shoulder, elbow };
  }
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.115, 0.86, 0);
    torso.add(hip);
    addMesh(hip, thighGeo, limbMat, -0.21);
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    hip.add(knee);
    addMesh(knee, shinGeo, limbMat, -0.20);
    addMesh(knee, footGeo, bodyMat, -0.435).position.z = -0.05;
    return { hip, knee };
  }
  const armL = makeArm(-1), armR = makeArm(1);
  const legL = makeLeg(-1), legR = makeLeg(1);
  group.userData.parts = { torso, armL, armR, legL, legR };
  group.userData.phase = Math.random() * Math.PI * 2;

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
  diving: false,
  wipeout: 0, // seconds of post-crash sprawl left; > 0 means input is locked out
  health: SW_MAX_HEALTH_CLIENT,
};

for (let i = 0; i < SW_MAX_HEALTH_CLIENT; i++) {
  const heart = document.createElement('span');
  heart.className = 'heart';
  heart.textContent = '❤️';
  healthBarEl.appendChild(heart);
}
function renderHealth() {
  const hearts = healthBarEl.children;
  for (let i = 0; i < hearts.length; i++) {
    hearts[i].classList.toggle('empty', i >= player.health);
  }
}

// ---- Avatar animation ----
// A pose is just a set of target joint angles; the live rotations ease toward them every frame, so
// changing pose mid-stride blends instead of snapping. Limbs hang down -Y, so a positive X rotation
// on a pivot swings that limb forward, and angles approaching PI reach it up over the head.
const POSE_BLEND = 11; // easing rate per second toward the target pose
// Phase advance is in rad/s and a full limb cycle is 2*PI, so 12 is already ~2 cycles a second — a
// hard sprint. Past that the legs stop reading as steps and start reading as strobe, so both the
// local player and the remote ghosts are capped here.
const MAX_POSE_CYCLE = 12;

function poseTargets(pose, ph) {
  const s = Math.sin(ph);
  switch (pose) {
    // Belly to the wall: opposite arm and leg reach together, the other pair pushes down.
    case 'wall':
      return { aL: 2.72 + s * 0.40, aR: 2.72 - s * 0.40, eL: 0.55 - s * 0.40, eR: 0.55 + s * 0.40,
               lL: 0.30 - s * 0.34, lR: 0.30 + s * 0.34, kL: 0.55 + s * 0.34, kR: 0.55 - s * 0.34,
               spread: 0.34, lean: 0.10 };
    // Hauling up the strand hand over hand, arms tighter to the body than on a wall, legs gripping.
    // Centred so the reach tops out at PI (straight up) and never goes past it — beyond PI the arm
    // folds back behind the head, which is not how you pull on a rope hanging in front of you.
    case 'rope':
      return { aL: 2.88 + s * 0.26, aR: 2.88 - s * 0.26, eL: 0.70 - s * 0.45, eR: 0.70 + s * 0.45,
               lL: 0.42 - s * 0.26, lR: 0.42 + s * 0.26, kL: 0.85 + s * 0.22, kR: 0.85 - s * 0.22,
               spread: 0.12, lean: 0.06 };
    // Riding the web: both hands overhead on the strand, body trailing, legs tucked back.
    case 'swing':
      return { aL: 2.92 + s * 0.05, aR: 2.92 - s * 0.05, eL: 0.30, eR: 0.30,
               lL: -0.52 + s * 0.20, lR: -0.52 - s * 0.20, kL: 0.95, kR: 0.75,
               spread: 0.20, lean: -0.20 };
    case 'run':
      return { aL: 0.85 * s, aR: -0.85 * s, eL: 0.55, eR: 0.55,
               lL: -0.80 * s, lR: 0.80 * s, kL: Math.max(0, 0.9 * s), kR: Math.max(0, -0.9 * s),
               spread: 0.10, lean: 0.16 };
    case 'air':
      return { aL: 2.30, aR: 2.30, eL: 0.45, eR: 0.45,
               lL: -0.25, lR: 0.20, kL: 0.55, kR: 0.30,
               spread: 0.45, lean: -0.05 };
    // Crashed: face down, arms flung out ahead, legs splayed. Held (no cycle) — the stillness is
    // what sells it against every other pose in the set, all of which are animated.
    case 'sprawl':
      return { aL: 2.60, aR: 2.60, eL: 0.05, eR: 0.05,
               lL: 0.10, lR: -0.10, kL: 0.30, kR: 0.20,
               spread: 0.85, lean: 1.35 };
    // Diving: arms swept back along the body, legs together, pitched head-first into the fall.
    case 'dive':
      return { aL: -1.20, aR: -1.20, eL: 0.15, eR: 0.15,
               lL: -0.10, lR: 0.10, kL: 0.10, kR: 0.10,
               spread: 0.28, lean: 0.38 };
    default:
      return { aL: 0.06, aR: 0.06, eL: 0.10, eR: 0.10, lL: 0, lR: 0, kL: 0.05, kR: 0.05,
               spread: 0.13, lean: 0.02 };
  }
}

function updateAvatarPose(group, pose, cycleSpeed, dt) {
  const p = group.userData.parts;
  if (!p) return;
  group.userData.phase += dt * cycleSpeed;
  const t = poseTargets(pose, group.userData.phase);
  const k = Math.min(1, dt * POSE_BLEND);
  const ease = (node, axis, target) => { node.rotation[axis] += (target - node.rotation[axis]) * k; };
  ease(p.armL.shoulder, 'x', t.aL); ease(p.armR.shoulder, 'x', t.aR);
  ease(p.armL.elbow, 'x', t.eL);    ease(p.armR.elbow, 'x', t.eR);
  ease(p.legL.hip, 'x', t.lL);      ease(p.legR.hip, 'x', t.lR);
  ease(p.legL.knee, 'x', t.kL);     ease(p.legR.knee, 'x', t.kR);
  ease(p.armL.shoulder, 'z', -t.spread); ease(p.armR.shoulder, 'z', t.spread);
  ease(p.torso, 'x', t.lean); // pivots at the feet, so this reads as a whole-body lean
}

// Which pose the local player is in, and how fast to run its cycle. Wall and rope cycles are driven
// by how fast you're actually moving, so the limbs keep pace with the climb rather than idling
// through a fixed loop — a slow slide down a wall animates slower than a hard climb up it.
function localPose() {
  // Checked before everything else: a crash cancels the swing/climb states anyway, and the sprawl
  // has to win over the run pose the moment you come to rest on the ground.
  if (player.wipeout > 0) return { pose: 'sprawl', speed: 0 };
  if (player.climbing) {
    const { f } = readMoveInput();
    return { pose: 'wall', speed: f !== 0 ? 4.0 + Math.abs(f) * 3.0 : 1.5 };
  }
  if (player.swinging) {
    // Only counts as climbing the rope while it's actually still shortening.
    if (webClimbHeld() && player.ropeLen > SWING_ROPE_MIN) return { pose: 'rope', speed: 7.5 };
    return { pose: 'swing', speed: 2.4 };
  }
  if (player.grappling) return { pose: 'air', speed: 1 };
  if (!player.grounded) return { pose: player.diving ? 'dive' : 'air', speed: 1 };
  const h = Math.hypot(player.vx, player.vz);
  if (h > 0.8) return { pose: 'run', speed: Math.min(MAX_POSE_CYCLE, 2.2 + h * 0.85) };
  return { pose: 'idle', speed: 1.4 };
}

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

// ---- Scratch vectors ----
// The update loop was allocating 4-6 THREE.Vector3 per frame (~300/s at 60fps). Each one is small,
// but the churn is GC pressure, and a GC pause lands as a frame hitch during exactly the fast swings
// this game is built around. These are reused in place instead.
//
// The rule for all of them: a scratch vector is consumed *within the call that fills it*. Never hold
// one across a call that might refill it. Every consumer below is either immediate arithmetic or a
// three.js method that copies its argument (Raycaster.set, Quaternion.setFromUnitVectors).
const DOWN_AXIS = new THREE.Vector3(0, -1, 0);
const _aim = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _strandDir = new THREE.Vector3();

function updateWebStrand(strand, from, to) {
  if (!to) { strand.visible = false; return; }
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.05) { strand.visible = false; return; }
  strand.visible = true;
  strand.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  strand.scale.set(1, len, 1);
  strand.quaternion.setFromUnitVectors(UP_AXIS, _strandDir.set(dx / len, dy / len, dz / len));
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
// Returns the shared `_aim` scratch, not a fresh vector — copy it if you ever need to keep it past
// the next aimDirection() call. Every current caller consumes it immediately.
function aimDirection() {
  return _aim.set(
    -Math.sin(camYaw) * Math.cos(camPitch),
    -Math.sin(camPitch),
    -Math.cos(camYaw) * Math.cos(camPitch)
  ).normalize();
}

function updateCamera(dt) {
  const aim = aimDirection();
  const targetPos = _camTarget.set(
    player.x - aim.x * camDistance,
    player.y - aim.y * camDistance + 2.2,
    player.z - aim.z * camDistance
  );
  camera.position.lerp(targetPos, 0.25);
  camera.lookAt(player.x, player.y + 1.6, player.z);
  if (shakeAmp > 0.001) {
    // Applied after lookAt so it shifts the frame without rotating the aim.
    camera.position.x += (Math.random() - 0.5) * shakeAmp;
    camera.position.y += (Math.random() - 0.5) * shakeAmp;
    camera.position.z += (Math.random() - 0.5) * shakeAmp;
    shakeAmp *= Math.max(0, 1 - dt * 5.5);
  } else shakeAmp = 0;
  // Speed pulls the FOV open. Nothing else in the scene conveys how fast you're going — the camera
  // trails at a fixed distance, so without this a 50-unit/s swing looks identical to a 15-unit/s one.
  const spd = Math.hypot(player.vx, player.vy, player.vz);
  const k = Math.max(0, Math.min(1, (spd - FOV_SPEED_FLOOR) / (MAX_SPEED - FOV_SPEED_FLOOR)));
  const targetFov = FOV_BASE + k * fovSpeedAdd();
  if (Math.abs(targetFov - camera.fov) > 0.01) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();
  }
  // Edge-of-frame rush, driven off the same normalised speed as the FOV so the two never disagree.
  // A CSS overlay rather than a post-processing pass — three's EffectComposer isn't loaded here, and
  // this costs one style write per frame.
  speedFxEl.style.opacity = (k * k * 0.85 * speedFxScale()).toFixed(3);
  speedLabel.textContent = `${Math.round(spd)} m/s`;
}

// ---- Collectible orbs ----
const orbGeo = new THREE.IcosahedronGeometry(0.5, 0);
const orbMat = new THREE.MeshStandardMaterial({ color: 0xffd93d, emissive: 0xff9900, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.2 });
const orbs = [];
let score = 0;
let best = Number(localStorage.getItem('webswing_best') || 0);
bestLabel.textContent = `Best: ${best}`;

// An orb this close to a facade can't be taken without clipping the wall on the way in, so it may as
// well be inside it. Pickup radius is 2.6 and the player is 0.4, which is what sets the floor here.
const ORB_CLEARANCE = 2.2;
// Rooftop orbs are always reachable and reward perching, but taking one means *landing*, which
// resets the air chain — the headline mechanic. They were half the set; now they're a minority.
const ORB_ROOF_SHARE = 0.3;
const ORB_PLACE_TRIES = 12;

// True when nothing occupies this point. The margin is horizontal only: a point above a building's
// roofline is clear of it no matter how close, which is exactly the case for a rooftop orb.
function orbClearOfBuildings(x, y, z, margin) {
  for (const b of buildings) {
    if (y > b.h) continue;
    if (Math.abs(x - b.x) <= b.w / 2 + margin && Math.abs(z - b.z) <= b.d / 2 + margin) return false;
  }
  return true;
}

function randomRoofOrbPosition() {
  const b = buildings[Math.floor(Math.random() * buildings.length)];
  return {
    x: b.x + (Math.random() - 0.5) * b.w * 0.8,
    y: b.h + 1.2 + Math.random() * 2,
    z: b.z + (Math.random() - 0.5) * b.d * 0.8,
  };
}

// Out into the street from one face of a building, at a height you'd actually swing past. The old
// version scattered ±16.8 around a building's *centre*, which with 24-unit cells and 13-18 unit
// footprints put a large share of them inside that building or its neighbour.
function randomAirOrbPosition() {
  const b = buildings[Math.floor(Math.random() * buildings.length)];
  const side = Math.floor(Math.random() * 4);
  const out = b.w / 2 + ORB_CLEARANCE + 1.5 + Math.random() * 5.0;
  const outZ = b.d / 2 + ORB_CLEARANCE + 1.5 + Math.random() * 5.0;
  const alongX = (Math.random() - 0.5) * b.w * 0.9;
  const alongZ = (Math.random() - 0.5) * b.d * 0.9;
  // Hugs the facade over its full height rather than bottoming out near the street, so the orb sits
  // in the corridor you swing down — which is also where near misses pay.
  const y = 12 + Math.random() * Math.max(4, b.h - 12);
  switch (side) {
    case 0: return { x: b.x + out, y, z: b.z + alongZ };
    case 1: return { x: b.x - out, y, z: b.z + alongZ };
    case 2: return { x: b.x + alongX, y, z: b.z + outZ };
    default: return { x: b.x + alongX, y, z: b.z - outZ };
  }
}

function randomOrbPosition() {
  if (Math.random() < ORB_ROOF_SHARE) return randomRoofOrbPosition();
  for (let i = 0; i < ORB_PLACE_TRIES; i++) {
    const p = randomAirOrbPosition();
    if (orbClearOfBuildings(p.x, p.y, p.z, ORB_CLEARANCE)) return p;
  }
  // Boxed in (a dense corner of the grid, or a face pointing straight at its neighbour). A rooftop
  // is clear by construction, so fall back to one rather than returning a point inside a wall.
  return randomRoofOrbPosition();
}

// Additive halo parented to the orb, so hiding the orb on pickup hides the glow with it and the
// two can never drift apart. Without it a 0.5-unit icosahedron is invisible from across a block,
// which is most of the map.
const orbHaloMat = new THREE.SpriteMaterial({
  map: GLOW_TEXTURE, color: 0xffc93d, transparent: true, opacity: 0.7,
  depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
});

function spawnOrbs() {
  for (let i = 0; i < ORB_COUNT; i++) {
    const pos = randomOrbPosition();
    const mesh = new THREE.Mesh(orbGeo, orbMat);
    mesh.position.set(pos.x, pos.y, pos.z);
    const halo = new THREE.Sprite(orbHaloMat);
    halo.scale.set(3.2, 3.2, 1);
    mesh.add(halo);
    scene.add(mesh);
    orbs.push({ mesh, halo, base: pos, t: Math.random() * Math.PI * 2 });
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

// Orbs taken without touching the ground stack a bonus. The whole skill of the game is stringing a
// swing line together, and flat scoring rewarded landing between every pickup exactly as well.
let airChain = 0;

function setChainLabel() {
  if (airChain > 1) {
    chainLabel.textContent = `×${airChain} air`;
    chainLabel.classList.remove('hidden');
  } else {
    chainLabel.classList.add('hidden');
  }
}

// Orb pickups and near-miss bonuses both score, so the best-tracking and leaderboard push live here
// once instead of being repeated (and drifting) in each scoring path.
function addScore(n) {
  score += n;
  scoreLabel.textContent = `🕸️ ${score}`;
  if (score > best) {
    best = score;
    localStorage.setItem('webswing_best', String(best));
    bestLabel.textContent = `Best: ${best}`;
  }
  sendScore();
}

// Pump charge meter. The boost on release is worth up to ~2.25x your velocity, and until now none of
// it was visible: the menu said "let go at the right moment" and the game never showed the charge or
// the moment. The bar is the charge; the "ready" state fires when isPerfectRelease() would pay out,
// so the window is shown rather than guessed at.
let pumpMeterState = ''; // '' | 'hot' | 'ready' — cached so classList isn't rewritten every frame
let pumpMeterShown = false;

function updatePumpMeter() {
  if (!player.swinging) {
    if (pumpMeterShown) {
      pumpMeterEl.classList.add('hidden');
      pumpMeterShown = false;
      pumpMeterState = '';
      pumpMeterEl.classList.remove('hot', 'ready');
    }
    return;
  }
  if (!pumpMeterShown) {
    pumpMeterEl.classList.remove('hidden');
    pumpMeterShown = true;
  }
  const p = player.pumpMomentum;
  pumpFillEl.style.width = `${(p * 100).toFixed(1)}%`;
  const state = p < PERFECT_PUMP_MIN ? '' : (isPerfectRelease() ? 'ready' : 'hot');
  if (state !== pumpMeterState) {
    pumpMeterEl.classList.remove('hot', 'ready');
    if (state) pumpMeterEl.classList.add(state);
    pumpHintEl.textContent = state === 'ready' ? 'Release!' : 'Pump';
    pumpMeterState = state;
  }
}

function collectOrb(orb) {
  orb.mesh.visible = false;
  if (!player.grounded) airChain++; else airChain = 0;
  const gain = 1 + Math.min(AIR_CHAIN_MAX_BONUS, Math.floor(airChain / 2));
  addScore(gain);
  setChainLabel();
  showToast(airChain > 1 ? `+${gain}   ×${airChain} air` : `+${gain}`);
  playSound('collect');
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
    const pulse = 3.0 + Math.sin(orb.t * 1.5) * 0.45;
    orb.halo.scale.set(pulse, pulse, 1);
    if (!orb.mesh.visible) continue;
    const dx = orb.mesh.position.x - player.x;
    const dy = orb.mesh.position.y - (player.y + 1);
    const dz = orb.mesh.position.z - player.z;
    if (dx * dx + dy * dy + dz * dz < 2.6 * 2.6) collectOrb(orb);
  }
}

// ---- Near misses ----
// The physics already rewarded threading a swing tight to a facade, but nothing ever acknowledged
// it, so the safe line through the middle of a street scored exactly as well as the exciting one
// down the glass. A fast close pass now pays, and chains while you keep stringing them together.
// The cooldown is stored per building rather than globally: without it, hugging one wall on a long
// swing would tick a payout every frame, and with a single global timer a genuine slalom between two
// towers would only score the first of them.
let thrillChain = 0;
let thrillWindow = 0;
let gameTime = 0;

function updateThrill(dt) {
  if (thrillWindow > 0) {
    thrillWindow -= dt;
    if (thrillWindow <= 0) thrillChain = 0;
  }
  if (player.grounded || player.climbing || player.wipeout > 0) return;
  const spd = Math.hypot(player.vx, player.vy, player.vz);
  if (spd < THRILL_SPEED_MIN) return;
  const py = player.y + 1.0;
  for (const b of buildings) {
    if (py > b.h) continue; // over the roof — that's a flyover, not a wall pass
    if (b.thrillAt !== undefined && gameTime - b.thrillAt < THRILL_COOLDOWN) continue;
    // Horizontal gap from the player to this building's footprint (0 when inside it).
    const ex = Math.max(Math.abs(player.x - b.x) - b.w / 2, 0);
    const ez = Math.max(Math.abs(player.z - b.z) - b.d / 2, 0);
    const gap = Math.hypot(ex, ez);
    // gap === 0 means overlapping the footprint, which resolveWallCollisions() owns — not a miss.
    if (gap <= 0 || gap > THRILL_RADIUS) continue;
    b.thrillAt = gameTime;
    thrillChain = Math.min(THRILL_CHAIN_MAX, thrillChain + 1);
    thrillWindow = THRILL_CHAIN_WINDOW;
    const closeness = 1 - gap / THRILL_RADIUS;
    const gain = Math.max(1, Math.round((1 + closeness * 2) * thrillChain * 0.6));
    addScore(gain);
    showToast(thrillChain > 1 ? `⚡ +${gain}   ×${thrillChain} close` : `⚡ +${gain}`, 620);
    playSound('thrill');
    addShake(0.10 + closeness * 0.16);
    break; // one award per frame; clipping a corner is otherwise two faces of the same gap
  }
}

// Where a rooftop zip should actually put you down.
//
// The raycast point sits ON the building's surface, and this branch fires for hits within
// GRAPPLE_TOP_MARGIN of the top — usually an upper *wall* face, whose x/z is exactly on the
// footprint boundary. Zipping to a target directly above that left the player balanced on the roof
// lip: the same failure the wall-climb mantle had, where groundCheck()'s downward ray can miss the
// roof and find the ground plane instead, dropping them to the street.
//
// Height is roof + a hair rather than roof + 1 for a second reason: updateGrapple() marks the player
// grounded on arrival, but groundCheck() only agrees within 0.15 of the surface. Arriving a full
// unit up made that flag wrong on the very next frame, so every single zip ended in a small drop.
function roofArrivalPoint(b, point) {
  const limitX = Math.max(0, b.w / 2 - MANTLE_INSET);
  const limitZ = Math.max(0, b.d / 2 - MANTLE_INSET);
  return {
    x: b.x + Math.max(-limitX, Math.min(limitX, point.x - b.x)),
    y: b.h + 0.05,
    z: b.z + Math.max(-limitZ, Math.min(limitZ, point.z - b.z)),
  };
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
  // (see roofArrivalPoint below for why the grapple branch doesn't zip straight to the hit point)
  const point = hit ? hit.point : origin.clone().addScaledVector(dir, WEB_MAX_RANGE);
  const b = hit ? hit.object.userData.info : null;
  player.climbing = false;
  if (b && point.y >= b.h - GRAPPLE_TOP_MARGIN) {
    // Aimed near a rooftop — grapple straight up onto it instead of swinging from it, like
    // the "web-zip" traversal move in modern Spider-Man games.
    player.swinging = false;
    player.anchor = null;
    player.grappling = true;
    player.grappleTarget = roofArrivalPoint(b, point);
    player.grounded = false;
    spawnImpact(point.x, point.y, point.z); // the flare marks where the web bit, not where you land
    playSound('shoot');
    return;
  }
  player.anchor = { x: point.x, y: point.y, z: point.z };
  player.ropeLen = Math.max(SWING_ROPE_MIN, origin.distanceTo(point));
  player.swinging = true;
  player.grounded = false;
  player.pumpMomentum = 0;
  spawnImpact(point.x, point.y, point.z);
  playSound('shoot');
}

// Charged and still rising — the condition the HUD meter's "ready" state mirrors, so the player can
// see the window rather than having to infer it. Split out so it can be asserted on directly.
function isPerfectRelease() {
  return player.pumpMomentum >= PERFECT_PUMP_MIN && player.vy >= PERFECT_RISE_MIN;
}

function releaseWeb() {
  // Cash in accumulated pump momentum as a launch boost — the harder you pumped before letting
  // go, the bigger the jump, same reward loop as pumping a playground swing for extra height.
  const pump = player.pumpMomentum;
  const perfect = isPerfectRelease();
  if (pump > 0) {
    const boost = 1 + pump * RELEASE_BOOST_MAX * (perfect ? PERFECT_BONUS_MULT : 1);
    player.vx *= boost; player.vy *= boost; player.vz *= boost;
    player.pumpMomentum = 0;
  }
  player.swinging = false;
  player.anchor = null;
  if (perfect) {
    const gain = 2 + Math.round(pump * 3);
    addScore(gain);
    showToast(`✨ Perfect release   +${gain}`, 800);
    playSound('perfect');
    addShake(0.22);
  } else {
    playSound('release');
  }
}

// Bail out of a rooftop zip mid-flight, keeping whatever velocity the zip had built. Previously a
// grapple locked out every action until it landed — no jump (you aren't grounded), no new web, no
// cancel — so a mis-aimed zip meant watching yourself get dragged somewhere you didn't want to go.
function cancelGrapple() {
  player.grappling = false;
  player.grappleTarget = null;
  playSound('release');
}

function handleWebAction() {
  if (player.wipeout > 0) return; // no shooting your way out of a crash early
  if (player.grappling) { cancelGrapple(); return; }
  if (player.swinging) releaseWeb();
  else shootWeb();
}

// ---- PvP: web strike ----
// Not a raycast against player meshes — hitting a fast-moving swinging target with a thin ray is
// nearly impossible and would feel terrible. Instead: find whichever remote player is within range
// AND roughly where the camera is pointed (aim-cone via dot product), same "am I facing them"
// shape fighterplane.js's own bot-aim check already uses, then pick whichever candidate is most
// precisely aimed at (not just closest) so an off-angle nearer player doesn't steal a shot meant
// for someone further away but dead-center.
let lastStrikeAttemptAt = 0;
function attemptWebStrike() {
  if (!mpRoomCode || !swSocket || swSocket.readyState !== WebSocket.OPEN) return;
  if (player.wipeout > 0 || player.health <= 0) return;
  const now = performance.now();
  if (now - lastStrikeAttemptAt < SW_STRIKE_COOLDOWN_MS_CLIENT) return;

  const aim = aimDirection();
  const aimX = aim.x, aimY = aim.y, aimZ = aim.z;
  let bestId = null;
  let best = null;
  let bestDot = -Infinity;
  for (const [id, rp] of remotePlayers) {
    const dx = rp.group.position.x - player.x;
    const dy = rp.group.position.y - player.y;
    const dz = rp.group.position.z - player.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.001 || dist > SW_STRIKE_RANGE_CLIENT) continue;
    const dot = (dx / dist) * aimX + (dy / dist) * aimY + (dz / dist) * aimZ;
    if (dot < SW_STRIKE_AIM_DOT_MIN || dot <= bestDot) continue;
    bestDot = dot;
    bestId = id;
    best = rp;
  }
  if (!best) return;

  lastStrikeAttemptAt = now;
  swSocket.send(JSON.stringify({ type: 'sw-strike', targetId: bestId }));
  spawnImpact(best.group.position.x, best.group.position.y + 1, best.group.position.z);
  playSound('strike');
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
  if (player.wipeout > 0) return;
  if (player.swinging) return;
  // Jump also bails out of a zip, so both action buttons can break you out of one.
  if (player.grappling) { cancelGrapple(); player.vy = Math.max(player.vy, JUMP_VEL * 0.6); return; }
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
  const dir = _rayDir.set(player.vx, 0, player.vz).normalize();
  climbRay.set(_rayOrigin.set(player.x, player.y + 1.0, player.z), dir);
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
  if (player.y >= b.h) {
    // Mantle inward over the lip. Stopping at roof height alone left the player hovering
    // CLIMB_OFFSET *outside* the facade with nothing beneath them — and groundCheck() runs later in
    // this very frame (climbing is already false by then), casts down past the roof edge, hits the
    // ground plane instead, and drops them the full height of the building. Climbing a tower ended
    // in falling off the top of it.
    player.y = b.h;
    if (player.climbAxis === 'x') player.x -= player.climbNormal.x * MANTLE_INSET;
    else player.z -= player.climbNormal.z * MANTLE_INSET;
    player.climbing = false;
    player.grounded = true;
  }
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
  if (e.code === 'KeyF') { e.preventDefault(); attemptWebStrike(); }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

canvas.addEventListener('click', () => {
  if (!gameStarted || isTouchDevice || pointerLocked) return;
  canvas.requestPointerLock();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (!gameStarted || !pointerLocked) return;
  if (e.button === 0) handleWebAction();
  else if (e.button === 2) attemptWebStrike();
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
let touchJumpHeld = false; // ⤒ held down — the touch equivalent of holding Space, so web-climbing works here too
let touchDiveHeld = false; // ⤓ held down — the touch equivalent of holding Shift

// ---- Held-input reset ----
// A key released while the window doesn't have focus never delivers a keyup, so it stays latched.
// keyup was the only thing clearing `keys`, which meant alt-tabbing mid-dive brought you back still
// diving — permanently, until you pressed and released Shift again. Same for W (running forever)
// and Space (hauling up the web forever). Nothing cleared any of it.
let resetJoystickVisual = () => {}; // replaced by the touch block below, when there is one

function clearHeldInput() {
  for (const code in keys) keys[code] = false;
  touchJumpHeld = false;
  touchDiveHeld = false;
  touchMoveX = 0;
  touchMoveZ = 0;
  resetJoystickVisual();
}

window.addEventListener('blur', clearHeldInput);
// Switching tabs doesn't reliably fire blur on the window, and backgrounding a phone browser
// generally fires only this one.
document.addEventListener('visibilitychange', () => { if (document.hidden) clearHeldInput(); });

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
  // So a blur/visibility reset also re-centres the knob and drops the tracked touch id — otherwise
  // the stick stays visually pushed over, and its id never matches a later touchend.
  resetJoystickVisual = resetJoystick;
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
  // Jump is press-and-hold rather than a plain tap: the press still jumps, but keeping it down
  // while attached to a web climbs the strand, matching holding Space on desktop.
  const jumpBtn = document.getElementById('touch-jump');
  jumpBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchJumpHeld = true;
    doJump();
  }, { passive: false });
  const releaseTouchJump = () => { touchJumpHeld = false; };
  jumpBtn.addEventListener('touchend', releaseTouchJump);
  jumpBtn.addEventListener('touchcancel', releaseTouchJump);
  const diveBtn = document.getElementById('touch-dive');
  diveBtn.addEventListener('touchstart', (e) => { e.preventDefault(); touchDiveHeld = true; }, { passive: false });
  const releaseTouchDive = () => { touchDiveHeld = false; };
  diveBtn.addEventListener('touchend', releaseTouchDive);
  diveBtn.addEventListener('touchcancel', releaseTouchDive);
  bindTap('touch-web', () => handleWebAction());
  bindTap('touch-strike', () => attemptWebStrike());
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

// Holding jump while attached to a web climbs it. Space and the touch ⤒ button are the same
// input as far as the swing is concerned, so both reach updateInputMove() through here.
function webClimbHeld() {
  return !!keys.Space || touchJumpHeld;
}

// Either Shift, or the touch ⤓ button.
function diveHeld() {
  return !!(keys.ShiftLeft || keys.ShiftRight) || touchDiveHeld;
}

function updateInputMove(dt) {
  // Cleared up here rather than beside the dive itself, because every path below can return early —
  // grabbing a wall or firing a web mid-dive would otherwise leave the flag (and the pose) stuck on.
  player.diving = false;
  if (player.wipeout > 0) return; // sprawled on the deck — no steering, no dive, no reel
  if (player.climbing || player.grappling) return; // updateClimb()/updateGrapple() drive position themselves
  const { f, r } = readMoveInput();
  const fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw);
  const rightX = -fwdZ, rightZ = fwdX;
  if (player.swinging) {
    // Hold jump to haul yourself up the strand. Shortening the rope is the whole move —
    // updateSwing()'s constraint pulls the player onto the smaller circle on the same step, which
    // reads as climbing. Stacks with a W reel-in if you hold both, same as pulling with both arms.
    if (webClimbHeld()) {
      player.ropeLen = Math.max(SWING_ROPE_MIN, player.ropeLen - WEB_CLIMB_SPEED * dt);
    }
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
  // Dive: tuck and drive yourself downward to trade height for speed, the standard way to set up a
  // long swing. It steers toward where you're aiming, so a dive can be aimed down a gap between
  // towers rather than only ever going straight down.
  if (!player.grounded && diveHeld()) {
    player.diving = true;
    player.vy += DIVE_ACCEL * dt;
    const aim = aimDirection();
    player.vx += aim.x * DIVE_STEER * dt;
    player.vz += aim.z * DIVE_STEER * dt;
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
  downRay.set(_rayOrigin.set(player.x, player.y + 1.0, player.z), DOWN_AXIS);
  downRay.far = 250;
  const hits = downRay.intersectObjects(collidables, false);
  if (hits.length) {
    const groundY = hits[0].point.y;
    if (player.y <= groundY + 0.15 && player.vy <= 0) {
      const fallSpeed = -player.vy;
      const wasAirborne = !player.grounded;
      player.y = groundY;
      player.vy = 0;
      // Until now every landing was survivable, so there was no reason not to take the fastest,
      // steepest line everywhere — a dive straight into the street cost nothing. Coming in above
      // WIPEOUT_SPEED now sprawls you, locks input for a beat and forfeits the air chain, which is
      // what gives the dive and the pump-release boost an actual downside to weigh.
      if (wasAirborne && fallSpeed > WIPEOUT_SPEED) {
        player.wipeout = WIPEOUT_DURATION;
        player.vx *= 0.15; player.vz *= 0.15;
        playSound('wipeout');
        spawnDust(player.x, groundY, player.z, fallSpeed * 1.6);
        addShake(0.85);
        showToast('💥 Wipeout', 900);
      } else if (wasAirborne && fallSpeed > 6) {
        playSound('land');
        spawnDust(player.x, groundY, player.z, fallSpeed);
        addShake(Math.min(0.28, fallSpeed * 0.012));
      }
      if (wasAirborne && airChain > 0) { airChain = 0; setChainLabel(); }
      player.grounded = true;
      return;
    }
  }
  player.grounded = false;
}

// Shared by respawnFromVoid() and the PvP death handler below — both put the player back on the
// spawn tower with a clean physics/traversal state, they just differ in toast/sound/score effect.
function resetPlayerPhysics() {
  player.x = spawnPlatform.x;
  player.y = spawnPlatform.y + 1;
  player.z = spawnPlatform.z;
  player.vx = player.vy = player.vz = 0;
  player.swinging = false;
  player.anchor = null;
  player.grappling = false;
  player.grappleTarget = null;
  player.climbing = false;
  player.grounded = false;
  player.wipeout = 0;
  player.pumpMomentum = 0;
  if (airChain > 0) { airChain = 0; setChainLabel(); }
  trailActive = false;
  trailStrength = 0;
}

// Put the player back on the spawn tower. Deliberately does NOT touch the score: falling off the
// edge of the map is a hole in the world, not a mistake the player made, so it shouldn't cost them a
// run. The air chain does reset, since they've effectively touched down.
function respawnFromVoid() {
  resetPlayerPhysics();
  showToast('↩ Returned to the tower', 1100);
  playSound('land');
}

// Two backstops against leaving the world, both of which were missing entirely.
//
// 1. A hard floor inside the plane's footprint. groundCheck() casts from player.y + 1.0, so if a
//    single frame carries the player more than ~1 unit below the ground the ray *starts underneath
//    it* and misses — and at MAX_SPEED with a 0.05s frame (the dt cap) one step is 2.75 units, so
//    this is reachable on a slow device during a fast dive. Inside the plane, y below 0 is always
//    wrong, so clamping is unambiguous.
// 2. A void respawn for everything else. The ground plane is finite and shootWeb() will happily
//    anchor to empty air at max range, which is exactly what lets you sling past the city edge —
//    beyond it there is nothing to raycast against, so the player used to fall forever with no way
//    back short of reloading the page.
function enforceWorldBounds() {
  if (player.y < 0 && Math.abs(player.x) <= GROUND_HALF && Math.abs(player.z) <= GROUND_HALF) {
    player.y = 0;
    if (player.vy < 0) player.vy = 0;
    player.grounded = true;
    return;
  }
  if (player.y < VOID_Y) respawnFromVoid();
}

// Both poses that draw a strand hold their hands overhead, so the web now leaves the hands rather
// than the chest — WEB_HAND_Y is where the wrists sit once the arms are raised.
const WEB_HAND_Y = 2.05;
function updateRope() {
  const ropeTarget = player.swinging ? player.anchor : (player.grappling ? player.grappleTarget : null);
  updateWebStrand(webStrand, { x: player.x, y: player.y + WEB_HAND_Y, z: player.z }, ropeTarget);
}

function update(dt) {
  gameTime += dt;
  // Ticked before the movement code so the frame a wipeout expires is the frame control returns.
  if (player.wipeout > 0) player.wipeout = Math.max(0, player.wipeout - dt);
  updateInputMove(dt);
  // A sprawled player must not grab a wall they slid into, or they'd stand back up mid-crash.
  if (!player.swinging && !player.climbing && !player.grappling && player.wipeout <= 0) tryStartClimb();

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
  // After the collision pass, so it only fires on positions the normal physics failed to catch.
  enforceWorldBounds();
  if (player.grounded && player.swinging) releaseWeb();

  if (player.climbing) {
    player.yaw = Math.atan2(player.climbNormal.x, player.climbNormal.z);
  } else {
    const hSpeed = Math.hypot(player.vx, player.vz);
    if (hSpeed > 0.6) player.yaw = Math.atan2(-player.vx, -player.vz);
  }
  localAvatar.position.set(player.x, player.y, player.z);
  localAvatar.rotation.y = player.yaw;
  const lp = localPose();
  updateAvatarPose(localAvatar, lp.pose, lp.speed, dt);

  // Thrill check runs on the post-collision position, so a pass that actually clipped the wall has
  // already been pushed out and won't be paid as a near miss.
  updateThrill(dt);
  updatePumpMeter();
  updateCamera(dt);
  updateTrail(dt); // after updateCamera — the ribbon billboards against this frame's camera position
  updateRope();
  updateOrbs(dt);
  updateClouds(dt);
  updateDust(dt);
  updateImpact(dt);
  updateWind();
  updateRemoteAvatars(dt);
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
  remotePlayers.set(id, { group, strand, name, target: { x: pos.x, y: pos.y, z: pos.z, yaw: pos.yaw || 0 }, swinging: false, anchor: null });
}

function removeRemotePlayer(id) {
  const rp = remotePlayers.get(id);
  if (!rp) return;
  scene.remove(rp.group);
  scene.remove(rp.strand);
  remotePlayers.delete(id);
}

// Ghosts get position and a swinging flag over the wire and nothing else (the server relays a fixed
// field set), so their pose is inferred from how their target is moving: climbing is the one state
// that is almost all vertical motion with no web out, which separates it cleanly from running.
function remotePose(rp) {
  if (rp.swinging) return { pose: 'swing', speed: 2.4 };
  const h = rp.hSpeed || 0, v = rp.vSpeed || 0;
  if (v > 1.5 && h < 2.5) return { pose: 'wall', speed: Math.min(MAX_POSE_CYCLE, 4.0 + Math.min(v, 8) * 0.4) };
  if (Math.abs(v) > 6) return { pose: 'air', speed: 1 };
  if (h > 1.2) return { pose: 'run', speed: Math.min(MAX_POSE_CYCLE, 2.2 + h * 0.85) };
  return { pose: 'idle', speed: 1.4 };
}

// Floor on the measured gap, so a burst of packets arriving back-to-back can't divide by ~0.
const REMOTE_MIN_INTERVAL = 0.03;

// Estimate a ghost's speed from consecutive position packets.
//
// This used to be `delta * 10`, hard-coding "10 packets a second". sendPosBroadcast() only
// guarantees *at most* 10/s: it's throttled inside the frame loop, so the real gap is ~116ms at
// 60fps, and far longer whenever the sender's tab is backgrounded (rAF drops to roughly 1Hz) or the
// network stalls. At a 1s gap the old maths reported speeds 10x too high, which flipped the ghost
// into the 'air' pose and drove its limb cycle fast enough to strobe. Measured against the clock now.
function updateRemoteSpeed(rp, x, y, z, now) {
  if (rp.lastPosAt === undefined) {
    // First packet from this ghost. It was parked at the spawn platform (or at the world origin, for
    // players already in the room when we joined — the server registers them at 0,0,0 until their
    // first update), so this delta is a placement correction, not movement.
    rp.hSpeed = 0;
    rp.vSpeed = 0;
    rp.lastPosAt = now;
    return;
  }
  const dt = Math.max(REMOTE_MIN_INTERVAL, (now - rp.lastPosAt) / 1000);
  rp.lastPosAt = now;
  // A ghost can't legitimately be moving faster than the cap the local player is held to.
  rp.hSpeed = Math.min(MAX_SPEED, Math.hypot(x - rp.target.x, z - rp.target.z) / dt);
  rp.vSpeed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, (y - rp.target.y) / dt));
}

function updateRemoteAvatars(dt) {
  for (const rp of remotePlayers.values()) {
    rp.group.position.x += (rp.target.x - rp.group.position.x) * 0.25;
    rp.group.position.y += (rp.target.y - rp.group.position.y) * 0.25;
    rp.group.position.z += (rp.target.z - rp.group.position.z) * 0.25;
    rp.group.rotation.y += (rp.target.yaw - rp.group.rotation.y) * 0.25;
    const pose = remotePose(rp);
    updateAvatarPose(rp.group, pose.pose, pose.speed, dt);
    updateWebStrand(
      rp.strand,
      { x: rp.group.position.x, y: rp.group.position.y + WEB_HAND_Y, z: rp.group.position.z },
      rp.swinging ? rp.anchor : null
    );
  }
}

let swRoomFull = false; // set on 'sw-full' so the close handler below doesn't reconnect-loop into a full room
function connectSw() {
  if (!mpRoomCode) return;
  swRoomFull = false;
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
      if (Number.isFinite(data.health)) { player.health = data.health; renderHealth(); }
      data.players.forEach((p) => addRemotePlayer(p.id, p.name, p));
    } else if (data.type === 'sw-hit') {
      if (data.targetId === swMyId) {
        player.health = data.health;
        renderHealth();
        damageFlashEl.classList.remove('show');
        void damageFlashEl.offsetWidth; // restart the CSS animation
        damageFlashEl.classList.add('show');
        playSound('hurt');
      }
    } else if (data.type === 'sw-death') {
      // Teleport the dead player's ghost to the spawn tower immediately rather than waiting for
      // their next ~100ms-throttled sw-pos broadcast — otherwise every other client briefly sees
      // them frozen at the spot they died.
      const rp = remotePlayers.get(data.id);
      if (rp) {
        rp.target.x = spawnPlatform.x; rp.target.y = spawnPlatform.y + 1; rp.target.z = spawnPlatform.z;
        rp.swinging = false; rp.anchor = null;
      }
      if (data.id === swMyId) {
        resetPlayerPhysics();
        player.health = data.health;
        renderHealth();
        const killerName = (data.killedBy && remotePlayers.get(data.killedBy)?.name) || 'someone';
        showToast(`💀 Eliminated by ${killerName}`, 1600);
        playSound('eliminated');
      } else if (data.killedBy === swMyId) {
        addScore(SW_KILL_SCORE_BONUS);
        const victimName = rp?.name || 'a player';
        showToast(`🕸️ You eliminated ${victimName}! +${SW_KILL_SCORE_BONUS}`, 1600);
      }
    } else if (data.type === 'sw-player-joined') {
      addRemotePlayer(data.id, data.name, { x: spawnPlatform.x, y: spawnPlatform.y + 1, z: spawnPlatform.z, yaw: 0 });
    } else if (data.type === 'sw-pos') {
      const rp = remotePlayers.get(data.id);
      if (rp) {
        // Must run before target is overwritten — it measures against the previous position.
        updateRemoteSpeed(rp, data.x, data.y, data.z, performance.now());
        rp.target.x = data.x; rp.target.y = data.y; rp.target.z = data.z; rp.target.yaw = data.yaw;
        rp.swinging = data.swinging;
        rp.anchor = data.swinging ? { x: data.ax, y: data.ay, z: data.az } : null;
      }
    } else if (data.type === 'sw-player-left') {
      removeRemotePlayer(data.id);
    } else if (data.type === 'sw-full') {
      swRoomFull = true;
      if (swSocket) swSocket.close();
      swSocket = null;
    } else if (data.type === 'sw-leaderboard-result') {
      renderLeaderboard(data.scores || []);
    }
  });
  // Without this, a dropped connection (server restart, brief network blip) left every remote
  // ghost frozen in its last position forever with no indication anything broke and no way to
  // recover short of reloading the page — same reconnect pattern fighterplane.js's leaderboard
  // socket already uses. Existing ghosts are cleared since their positions are now stale; a fresh
  // sw-init snapshot repopulates them once reconnected.
  swSocket.addEventListener('close', () => {
    for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id);
    swSocket = null;
    if (!swRoomFull) setTimeout(connectSw, 1500);
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
    // Near miss: a short upward whip, deliberately quiet — these fire often when you're swinging well.
    thrill: { type: 'sine', f0: 1500, f1: 640, g: 0.07, dur: 0.13 },
    // Crash: lower and longer than 'land', so a wipeout is audibly not just a heavy landing.
    wipeout: { type: 'square', f0: 150, f1: 48, g: 0.16, dur: 0.34 },
    // Perfect release: rises where plain 'release' falls, so the two are never confusable.
    perfect: { type: 'triangle', f0: 520, f1: 1560, g: 0.13, dur: 0.26 },
    // PvP: a short sharp crack for landing a strike, a lower thud for taking one, and a longer
    // descending tone (distinct from 'wipeout', which is a crash-landing, not a kill) for dying.
    strike: { type: 'sawtooth', f0: 700, f1: 180, g: 0.16, dur: 0.12 },
    hurt: { type: 'square', f0: 200, f1: 90, g: 0.15, dur: 0.16 },
    eliminated: { type: 'sawtooth', f0: 480, f1: 60, g: 0.18, dur: 0.5 },
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

// ---- Wind ----
// Everything that conveyed speed until now was visual — the FOV kick, the edge rush, the ribbon —
// so the fastest swing in the game sounded exactly like standing still. This is a single looping
// noise source held open for the whole session, with its gain and filter cutoff driven from the
// current speed; starting and stopping a source per swing would click and would cost an allocation
// every time you let go.
let windSource = null;
let windGain = null;
let windFilter = null;

// Pure — kept separate from the audio graph so the curve can be asserted on without a real
// AudioContext (under test the whole graph is a stub and every assignment to it is a no-op).
function windParamsForSpeed(spd) {
  const span = MAX_SPEED - WIND_SPEED_FLOOR;
  const k = Math.max(0, Math.min(1, (spd - WIND_SPEED_FLOOR) / span));
  return {
    k,
    gain: k * k * WIND_MAX_GAIN,
    cutoff: WIND_CUTOFF_MIN + k * (WIND_CUTOFF_MAX - WIND_CUTOFF_MIN),
  };
}

function startWind() {
  if (windSource) return; // one source for the whole session
  const ctx = ensureAudio();
  // Two seconds of white noise, looped. Long enough that the loop point isn't audible as a pulse.
  const frames = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  windSource = ctx.createBufferSource();
  windSource.buffer = buffer;
  windSource.loop = true;
  windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = WIND_CUTOFF_MIN;
  windGain = ctx.createGain();
  windGain.gain.value = 0;
  windSource.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(ctx.destination);
  windSource.start();
}

function updateWind() {
  if (!windGain) return;
  const spd = Math.hypot(player.vx, player.vy, player.vz);
  const p = windParamsForSpeed(spd);
  // Muting has to zero the gain rather than stop the source: a stopped BufferSource can never be
  // restarted, so unmuting would leave the wind gone for the rest of the session.
  const target = soundOn ? p.gain : 0;
  // setTargetAtTime rather than assigning .value — the mute toggle moves the gain across its whole
  // range in a single frame, and an instantaneous jump on an audio param is an audible click.
  const now = audioCtx.currentTime;
  windGain.gain.setTargetAtTime(target, now, 0.05);
  windFilter.frequency.setTargetAtTime(p.cutoff, now, 0.08);
}

soundToggleBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  localStorage.setItem('webswing_sound_muted', soundOn ? '0' : '1');
  soundToggleBtn.textContent = soundOn ? '🔊' : '🔇';
  updateWind(); // take the change immediately instead of waiting for the next frame
});

// ---- Start / game loop ----
startBtn.addEventListener('click', () => {
  ensureAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  startWind(); // must follow the click — autoplay policy blocks a source started before a gesture
  menuEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  canvas.classList.remove('hidden');
  crosshairEl.classList.remove('hidden');
  if (isTouchDevice) touchControlsEl.classList.remove('hidden');
  player.x = spawnPlatform.x; player.y = spawnPlatform.y + 1; player.z = spawnPlatform.z;
  player.vx = player.vy = player.vz = 0;
  player.grounded = false;
  // Clear the run-scoped state too, so restarting doesn't inherit a crash or a live near-miss chain.
  player.wipeout = 0;
  thrillChain = 0;
  thrillWindow = 0;
  shakeAmp = 0;
  trailActive = false;
  trailStrength = 0;
  trailMesh.visible = false;
  player.pumpMomentum = 0;
  pumpMeterState = '';
  pumpMeterShown = false;
  pumpMeterEl.classList.add('hidden');
  pumpMeterEl.classList.remove('hot', 'ready');
  gameStarted = true;
  connectSw();
  if (mpRoomCode) { player.health = SW_MAX_HEALTH_CLIENT; renderHealth(); healthBarEl.classList.remove('hidden'); }
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
