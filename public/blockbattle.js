'use strict';

// Asher & Issac's game, step 7: sound, waves, and bots with eyes.
// First person on the gray block map: click to grab the mouse, WASD/arrows to
// move, Space jumps, L-Shift sprints, Ctrl (or C) crouches, Ctrl while
// sprinting slides — and Space mid-slide is a slide-jump that keeps the
// slide's speed in the air. Bots now arrive in waves (each one bigger and
// quicker on the trigger) and only shoot what they can see: towers are real
// cover, and a bot that loses sight of you hunts your last known position
// before giving up. Wave mode also fields blue sidekicks on YOUR team — one
// joins on wave 1, a second on wave 2, never more than two — who hunt the
// reds beside you and draw their fire. Dead bots drop +25 health packs. Kills climb the upgrade
// ladder (see WEAPONS below): Glock → Desert Eagle → Uzi → MP90 → AK47 →
// Bolt Sniper → Triple Action Sniper → RPG. Click shoots (hold to spray with
// the automatics), R reloads, U (or the button) upgrades. All the audio is
// synthesized WebAudio; the death screen keeps your best run in localStorage.

// ---- Tuning knobs ----
const WALK_SPEED = 3;        // blocks per second
const SPRINT_SPEED = 6;
const CROUCH_SPEED = 1.5;
const SLIDE_SPEED = 8;       // slide entry speed, decaying to CROUCH_SPEED
const SLIDE_TIME = 0.8;      // seconds a slide lasts
const JUMP_HEIGHT = 1.15;    // peak of a jump, in blocks — just over 1 so cubes are climbable
const GRAVITY = 22;          // blocks per second squared
const PLAYER_WIDTH = 0.5;
const EYE_STAND = 0.8;       // camera height above the player's feet
const EYE_CROUCH = 0.45;
const EYE_SLIDE = 0.3;
const MOUSE_SENS = 0.0022;   // radians of turn per pixel of mouse movement

const MAP_BLOCKS = 24;       // playable ground is MAP_BLOCKS x MAP_BLOCKS
const WALL_HEIGHT = 2;       // perimeter wall — too tall to jump out
const TOWER_HEIGHT = 3;      // every tower is 3 tall: walls you go around, not over
const NUM_TOWER_WALLS = 7;   // straight wall runs built from 3-tall towers
const NUM_CUBES = 5;         // single cubes stay climbable
const STRUCTURE_RANGE = 10;  // structures spawn within this many blocks of center
const ROAD_WIDTH = 6;        // crossroad street width — shared with cellFree() so cover blocks
                              // can't spawn standing in the middle of the asphalt

const MAX_HEALTH = 100;
const BOT_MAX_HEALTH = 50;
const BOT_SPEED = 1.5;       // bots wander at crouch-walk pace
const BOT_CHASE_SPEED = 2.5; // once they've seen you, they hustle
const BOT_FIRE_INTERVAL = 5; // wave 1: seconds between each bot's shots
const BOT_MIN_FIRE_INTERVAL = 1.8; // the trigger never gets crueler than this
const BOT_FIRE_STEP = 0.35;  // seconds shaved off the interval each wave
const LOSE_SIGHT_TIME = 4;   // seconds a bot hunts after you break line of sight
const WAVE_BASE_BOTS = 2;    // wave 1 size; every wave adds one bot
const WAVE_MAX_BOTS = 8;
const WAVE_BREAK = 3;        // breather seconds between waves
const MAX_ALLIES = 2;        // wave-mode sidekicks: 1 joins on wave 1, 2 from wave 2 on
const ALLY_MAX_HEALTH = 100;
const ALLY_FIRE_INTERVAL = 1.5; // seconds between a sidekick's shots
const ALLY_DAMAGE = 10;      // sidekick bullets, out of BOT_MAX_HEALTH
const FS_BOTS = 4;           // FS mode: this many enemies, always
const FS_RESPAWN_TIME = 5;   // FS mode: seconds after death before a bot comes back
const PICKUP_HEAL = 25;      // health from a dropped pack
const PICKUP_LIFE = 10;      // seconds a pack lies around before despawning
const BULLET_DAMAGE = 25;    // bot bullets, out of MAX_HEALTH
const BULLET_SPEED = 8;      // blocks per second — visible and dodgeable
const BULLET_LIFE = 4;       // seconds before a stray bullet despawns

// The upgrade ladder. Each weapon: `unlock` kills to upgrade INTO it, `mag`
// shots per magazine, `interval` seconds between shots inside a magazine,
// `reload` seconds once the magazine is empty. Mag-1 weapons reload after
// every shot, so `reload` doubles as their fire rate. `auto` = hold to spray.
// The RPG explodes where it lands, and a direct headshot counts as 2 kills.
const WEAPON_ORDER = ['glock', 'deagle', 'uzi', 'mp90', 'ak47', 'sniper', 'sniper3', 'rpg'];
const WEAPONS = {
  glock:   { title: 'Glock',                unlock: 0,   mag: 1,  interval: 0,    reload: 1, damage: 5,  headshot: 10 },
  deagle:  { title: 'Desert Eagle',         unlock: 5,   mag: 1,  interval: 0,    reload: 2, damage: 10, headshot: 25 },
  uzi:     { title: 'Uzi',                  unlock: 15,  mag: 5,  interval: 0.25, reload: 3, damage: 5,  headshot: 10, auto: true },
  mp90:    { title: 'MP90',                 unlock: 25,  mag: 8,  interval: 0.4,  reload: 4, damage: 5,  headshot: 10, auto: true },
  ak47:    { title: 'AK47',                 unlock: 50,  mag: 12, interval: 0.2,  reload: 3, damage: 5,  headshot: 6,  auto: true },
  sniper:  { title: 'Bolt Sniper',          unlock: 75,  mag: 1,  interval: 0,    reload: 5, damage: 25, headshot: 50, scope: true },
  sniper3: { title: 'Triple Action Sniper', unlock: 100, mag: 3,  interval: 1,    reload: 3, damage: 25, headshot: 50, scope: true },
  rpg:     { title: 'RPG',                  unlock: 150, mag: 1,  interval: 0,    reload: 6, damage: 50, headshot: 50, explosive: true, headshotDoubleKill: true },
};

// The knife lives outside the ladder: Q swaps it in and out at any tier, no
// ammo, no reload. Two slashes kill — and the killing slash is a finisher:
// slow motion, a blade twirl, and the bot launched spinning across the arena.
const KNIFE = { title: 'Knife', melee: true, interval: 0.45, damage: 25, range: 1.9 };

// Weapons marked `scope: true` (the snipers) zoom while right-click is held:
// FOV shrinks to 60% — a 40% zoom in — and mouse sensitivity scales down with
// it so the magnified view doesn't turn every nudge into a flick.
const SCOPE_ZOOM = 0.6;

const canvas = document.getElementById('map');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Sky: a gradient dome (deep blue overhead melting to a pale horizon) instead
// of a flat clear color. Fog is dyed the horizon color so the oversized ground
// plane fades into the same shade the dome ends in — no visible seam.
const SKY_HORIZON = '#dceef7';
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_HORIZON);
scene.fog = new THREE.Fog(SKY_HORIZON, 30, 110);
{
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, SKY_HORIZON); // canvas flips vertically as a texture: row 0 lands at the horizon
  grad.addColorStop(0.45, '#9fcdea');
  grad.addColorStop(1, '#59a2d6');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1, 256);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(160, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), // top half only; fog hides the seam
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.BackSide, fog: false, depthWrite: false })
  );
  scene.add(dome);
}

const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
camera.rotation.order = 'YXZ'; // yaw first, then pitch — standard FPS look
scene.add(camera);             // the camera carries the gun viewmodel

scene.add(new THREE.HemisphereLight(0xd9efff, 0x9a938a, 0.85));
const sun = new THREE.DirectionalLight(0xffedc9, 0.85);
sun.position.set(18, 30, 12);
// One shadow-casting sun over the whole arena. The orthographic shadow box is
// sized to the walled map plus a margin, so drifting clouds throw shadows too.
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -24;
sun.shadow.camera.right = 24;
sun.shadow.camera.top = 24;
sun.shadow.camera.bottom = -24;
sun.shadow.camera.near = 5;
sun.shadow.camera.far = 70;
sun.shadow.bias = -0.0005;
scene.add(sun);

// The sun you can actually see: a soft radial-gradient sprite hung out along
// the light's direction, past the towers but inside the sky dome.
{
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,252,240,1)');
  grad.addColorStop(0.2, 'rgba(255,242,205,0.9)');
  grad.addColorStop(1, 'rgba(255,242,205,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), fog: false, depthWrite: false, transparent: true,
  }));
  sunSprite.scale.set(28, 28, 1);
  sunSprite.position.copy(sun.position).normalize().multiplyScalar(140);
  scene.add(sunSprite);
}

// Everything a shot can stop against (ground, walls, block columns).
const solids = [];

// Pixel-speckle canvas textures — every surface gets per-pixel color jitter
// around its base gray, so nothing reads as a flat untextured slab. Nearest
// magFilter keeps the pixels crisp up close; mipmaps handle the distance.
function speckleTexture(r, g, b, vary, px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const v = Math.round((Math.random() - 0.5) * 2 * vary);
      ctx.fillStyle = `rgb(${r + v},${g + v},${b + v})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ---- The ground, now with a horizon ----
const groundTex = speckleTexture(138, 138, 138, 7, 64);
groundTex.repeat.set(150, 150); // 2x2 blocks per tile across the 300-block plane
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshLambertMaterial({ map: groundTex })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
solids.push(ground);

// ---- Crossroad road surface ----
// A single non-tiling texture covering exactly the playable square (unlike groundTex above,
// which repeats a small tile and can't represent one big global layout), painted with two
// asphalt roads crossing in a "+" through the map center, lane markings, and a crosswalk at
// each of the 4 approaches — sidewalk-toned pavement fills the four quadrants between them.
// Layered as its own thin plane just above the original ground (left completely unchanged
// below, as generic backdrop past the walls) rather than replacing it, and deliberately not
// added to `solids` — the ground plane it sits on top of already handles that collision role,
// so none of the placement/collision logic below needs to know or care this exists.
function crossroadTexture(mapSize) {
  const px = 1024;
  const scale = px / mapSize; // pixels per world unit
  const half = px / 2;
  const roadW = ROAD_WIDTH * scale;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');

  // Sidewalk base, with a little pavement speckle so it isn't a flat slab.
  g.fillStyle = '#9a9186';
  g.fillRect(0, 0, px, px);
  for (let n = 0; n < 6000; n++) {
    const x = Math.random() * px, y = Math.random() * px;
    if (Math.abs(x - half) < roadW / 2 || Math.abs(y - half) < roadW / 2) continue; // skip the road
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
    g.fillRect(x, y, 2, 2);
  }

  // Asphalt roads, crossing in a plus, with their own speckle.
  g.fillStyle = '#37393c';
  g.fillRect(half - roadW / 2, 0, roadW, px);
  g.fillRect(0, half - roadW / 2, px, roadW);
  for (let n = 0; n < 8000; n++) {
    const onVertical = Math.random() < 0.5;
    const x = onVertical ? half - roadW / 2 + Math.random() * roadW : Math.random() * px;
    const y = onVertical ? Math.random() * px : half - roadW / 2 + Math.random() * roadW;
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
    g.fillRect(x, y, 2, 2);
  }

  // Curb line where asphalt meets sidewalk.
  g.strokeStyle = '#d8d3c8';
  g.lineWidth = Math.max(2, scale * 0.08);
  g.strokeRect(half - roadW / 2, 0, roadW, px);
  g.strokeRect(0, half - roadW / 2, px, roadW);

  // Yellow dashed center lines down each road, skipped through the intersection itself.
  g.fillStyle = '#e8c93c';
  const dash = scale * 0.7, gap = scale * 0.5, lineW = Math.max(2, scale * 0.09);
  for (let y = 0; y < px; y += dash + gap) {
    if (Math.abs(y + dash / 2 - half) < roadW / 2 + dash) continue;
    g.fillRect(half - lineW / 2, y, lineW, dash);
  }
  for (let x = 0; x < px; x += dash + gap) {
    if (Math.abs(x + dash / 2 - half) < roadW / 2 + dash) continue;
    g.fillRect(x, half - lineW / 2, dash, lineW);
  }

  // White zebra-stripe crosswalks on all 4 approaches to the intersection.
  g.fillStyle = '#e9e9e4';
  const stripeW = scale * 0.5, stripeGap = scale * 0.4, crossDepth = scale * 1.8;
  const inset = roadW / 2 + scale * 0.6; // just outside the intersection box
  for (let s = -roadW / 2 + stripeGap; s < roadW / 2; s += stripeW + stripeGap) {
    g.fillRect(half + s, half - inset - crossDepth, stripeW, crossDepth); // north
    g.fillRect(half + s, half + inset, stripeW, crossDepth);              // south
    g.fillRect(half - inset - crossDepth, half + s, crossDepth, stripeW); // west
    g.fillRect(half + inset, half + s, crossDepth, stripeW);              // east
  }

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  return tex;
}
const roadPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(MAP_BLOCKS, MAP_BLOCKS),
  new THREE.MeshLambertMaterial({ map: crossroadTexture(MAP_BLOCKS) })
);
roadPlane.rotation.x = -Math.PI / 2;
roadPlane.position.y = 0.001; // just above the base ground plane, avoids z-fighting
roadPlane.receiveShadow = true;
scene.add(roadPlane);

// ---- Perimeter walls ----
// Warmed from the old cool blue-gray to a brick-adjacent tone matching the cover blocks below —
// reads as building facades lining the crossroad instead of an abstract arena boundary.
const HALF_MAP = MAP_BLOCKS / 2;
const wallTex = speckleTexture(176, 152, 128, 8, 64);
wallTex.repeat.set(12, 1); // long faces get ~2-block-square tiles instead of one smeared stretch
const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
[
  [0, -(HALF_MAP + 0.5), MAP_BLOCKS + 2, 1],
  [0, HALF_MAP + 0.5, MAP_BLOCKS + 2, 1],
  [-(HALF_MAP + 0.5), 0, 1, MAP_BLOCKS + 2],
  [HALF_MAP + 0.5, 0, 1, MAP_BLOCKS + 2],
].forEach(([cx, cz, sx, sz]) => {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, WALL_HEIGHT, sz), wallMat);
  wall.position.set(cx, WALL_HEIGHT / 2, cz);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
  solids.push(wall);
});

// ---- Clouds ----
const clouds = [];
{
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let n = 0; n < 8; n++) {
    const cloud = new THREE.Group();
    const puffs = 2 + Math.floor(Math.random() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(
        new THREE.BoxGeometry(2 + Math.random() * 3, 0.6, 1.2 + Math.random()),
        cloudMat
      );
      puff.castShadow = true; // cloud shadows drift across the arena
      puff.position.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 1.5);
      cloud.add(puff);
    }
    cloud.position.set((Math.random() - 0.5) * 100, 11 + Math.random() * 5, (Math.random() - 0.5) * 100);
    clouds.push(cloud);
    scene.add(cloud);
  }
}

// ---- Distant hills ----
// A ring of fogged pyramid silhouettes past the walls, so the horizon reads
// as a skyline instead of a bare seam. They're scenery only — never in `solids`.
{
  const hillMat = new THREE.MeshLambertMaterial({ color: 0x7fa3b8 });
  for (let n = 0; n < 14; n++) {
    const a = (n / 14) * Math.PI * 2 + Math.random() * 0.3;
    const r = 80 + Math.random() * 25;
    const h = 6 + Math.random() * 10;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(8 + Math.random() * 10, h, 4), hillMat);
    hill.position.set(Math.cos(a) * r, h / 2 - 0.5, Math.sin(a) * r);
    hill.rotation.y = Math.random() * Math.PI;
    scene.add(hill);
  }
}

// ---- Random structures ----
// Cells are unit squares whose corners sit on grid lines: cell (i,j) spans
// x in [i, i+1), z in [j, j+1). `occupied` is also what collision checks against.
const occupied = new Map(); // "i,j" -> column height

// Warmed from flat gray to a brick tone — same placement/height logic below, unchanged, just
// reads as small buildings lining the crossroad instead of abstract Minecraft-style cover.
const blockGeo = new THREE.BoxGeometry(1, 1, 1);
const blockMat = new THREE.MeshLambertMaterial({ map: speckleTexture(168, 128, 104, 10, 32) });
const edgeGeo = new THREE.EdgesGeometry(blockGeo);
const edgeMat = new THREE.LineBasicMaterial({ color: 0x5c4736 });

function placeColumn(i, j, height) {
  occupied.set(`${i},${j}`, height);
  for (let level = 0; level < height; level++) {
    const cube = new THREE.Mesh(blockGeo, blockMat);
    cube.position.set(i + 0.5, level + 0.5, j + 0.5);
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.add(new THREE.LineSegments(edgeGeo, edgeMat));
    scene.add(cube);
    solids.push(cube);
  }
}

const ROAD_HALF = ROAD_WIDTH / 2;
function cellFree(i, j) {
  if (occupied.has(`${i},${j}`)) return false;
  if (Math.abs(i + 0.5) < 2 && Math.abs(j + 0.5) < 2) return false; // keep spawn clear
  // Keeps cover blocks off the crossroad's own asphalt — a "building" straddling the street
  // read as a visual bug the moment the road actually looked like a road (previously harmless
  // when the ground was just an abstract gray grid with no real road to stand in).
  if (Math.abs(i + 0.5) < ROAD_HALF || Math.abs(j + 0.5) < ROAD_HALF) return false;
  return true;
}

function randCell() {
  return Math.floor(Math.random() * STRUCTURE_RANGE * 2) - STRUCTURE_RANGE;
}

{
  // Tower walls: straight runs of 3-6 columns, every one TOWER_HEIGHT tall —
  // unjumpable, so the only way past is around (and they block bullets).
  for (let n = 0; n < NUM_TOWER_WALLS; n++) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const len = 3 + Math.floor(Math.random() * 4);
      const horizontal = Math.random() < 0.5;
      const i0 = randCell();
      const j0 = randCell();
      const cells = [];
      for (let s = 0; s < len; s++) cells.push(horizontal ? [i0 + s, j0] : [i0, j0 + s]);
      const fits = cells.every(([i, j]) =>
        cellFree(i, j) && Math.abs(i) <= HALF_MAP - 2 && Math.abs(j) <= HALF_MAP - 2);
      if (fits) {
        cells.forEach(([i, j]) => placeColumn(i, j, TOWER_HEIGHT));
        break;
      }
    }
  }

  // Single cubes, still hoppable for a height advantage.
  for (let n = 0; n < NUM_CUBES; n++) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const i = randCell();
      const j = randCell();
      if (cellFree(i, j)) { placeColumn(i, j, 1); break; }
    }
  }
}

// ---- Sound ----
// Every effect is synthesized with WebAudio — no audio files to load. Browsers
// only allow audio after a user gesture, so the "Click to play" click boots it.
let audioCtx = null;
let masterGain = null;
let noiseBuf = null;

function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// A pitched blip: frequency slides f0 → f1 over dur seconds while the volume decays.
function playTone(f0, f1, dur, type, vol, delay) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime + (delay || 0);
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(masterGain);
  osc.start(t);
  osc.stop(t + dur);
}

// A burst of filtered white noise — the body of every gunshot and explosion.
function playNoise(dur, cutoff, vol) {
  if (!audioCtx) return;
  if (!noiseBuf) {
    noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = audioCtx.currentTime;
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(gain).connect(masterGain);
  src.start(t, Math.random() * 0.5, dur); // random offset so no two bursts sound identical
}

// Each weapon's bang: [noise dur, noise cutoff, noise vol, thump f0, thump f1, thump dur, thump vol].
// Small guns are short and clicky, snipers boom, the RPG's launch whoosh gets
// its real payoff from the explosion sound where the rocket lands.
const GUN_SOUNDS = {
  glock:   [0.12, 900, 0.5, 220, 90, 0.1, 0.25],
  deagle:  [0.18, 700, 0.65, 160, 55, 0.16, 0.35],
  uzi:     [0.05, 1500, 0.28, 320, 150, 0.05, 0.12],
  mp90:    [0.07, 1200, 0.32, 280, 130, 0.06, 0.15],
  ak47:    [0.08, 1000, 0.42, 240, 100, 0.07, 0.2],
  sniper:  [0.3, 500, 0.8, 120, 35, 0.28, 0.4],
  sniper3: [0.25, 550, 0.7, 130, 40, 0.24, 0.35],
  rpg:     [0.35, 400, 0.5, 90, 45, 0.3, 0.3],
};

function sfxShot(type) {
  const [nd, nc, nv, f0, f1, td, tv] = GUN_SOUNDS[type];
  playNoise(nd, nc, nv);
  playTone(f0, f1, td, 'square', tv);
}
function sfxExplosion() { playNoise(0.5, 260, 0.9); playTone(90, 28, 0.45, 'sawtooth', 0.5); }
function sfxHit() { playTone(1100, 1100, 0.04, 'square', 0.12); }
function sfxHeadshot() { playTone(1500, 1500, 0.05, 'square', 0.14); playTone(230, 120, 0.09, 'square', 0.22); }
function sfxKill() { playTone(500, 500, 0.08, 'square', 0.15); playTone(750, 750, 0.1, 'square', 0.15, 0.08); }
function sfxHurt() { playTone(170, 80, 0.2, 'sawtooth', 0.3); }
function sfxDeath() { playTone(280, 50, 0.7, 'sawtooth', 0.35); }
function sfxPickup() { playTone(660, 660, 0.07, 'sine', 0.22); playTone(990, 990, 0.1, 'sine', 0.22, 0.07); }
function sfxWaveStart() { playTone(392, 392, 0.1, 'triangle', 0.2); playTone(523, 523, 0.14, 'triangle', 0.2, 0.1); }
function sfxWaveClear() { playTone(523, 523, 0.09, 'triangle', 0.2); playTone(659, 659, 0.09, 'triangle', 0.2, 0.09); playTone(784, 784, 0.14, 'triangle', 0.2, 0.18); }
function sfxBotShot(dist) { playNoise(0.08, 650, Math.max(0.04, 0.3 - dist * 0.01)); } // quieter with range
function sfxKnifeSwing() { playNoise(0.07, 1800, 0.18); playTone(700, 220, 0.1, 'sine', 0.12); }
function sfxAllyDown() { playTone(240, 70, 0.5, 'sawtooth', 0.28); }
function sfxFinisher() { playTone(180, 950, 0.22, 'sawtooth', 0.3); playTone(1200, 1200, 0.06, 'square', 0.18, 0.05); playNoise(0.25, 700, 0.4); }

// ---- Player state ----
// First person: the player has no mesh — the camera is their head.
const player = { x: 0, y: 0, z: 0 };
let yaw = 0;
let pitch = 0;
let vy = 0;
let onGround = true;
let eye = EYE_STAND;
let sliding = false;
let slideT = 0;
let slideDirX = 0;
let slideDirZ = 0;
let wantSlide = false;
let wantJump = false;   // fresh Space press, consumed once a tick — gates the fists double-jump
let jumpsUsed = 0;      // resets to 0 on landing; fists gets a 2nd jump mid-air, guns don't
let health = MAX_HEALTH;
let dead = false;
let kills = 0;
let killsAtRunStart = 0; // kills carry across deaths for the weapon ladder; the scoreboard counts per-run
let airMomX = 0;         // slide-jump momentum, held until landing
let airMomZ = 0;
let hasAirMomentum = false;
let weapon = 'glock';
let ammo = WEAPONS.glock.mag;
let nextShotAt = 0;      // ms — gate between shots inside a magazine
let reloadEndAt = 0;     // ms — when the current reload finishes
let isReloading = false;
let mouseHeld = false;   // for the hold-to-spray automatics
let scoped = false;      // right mouse button held — only means zoom on a sniper
let gunKick = 0;         // 1 right after firing, easing back to 0
let bobPhase = 0;        // viewmodel walk-bob clock, advanced by movement speed
let muzzleT = 0;
let knifeOut = false;    // Q toggles the knife; `weapon` stays your ladder gun
let swingT = 0;          // knife slash animation clock, counts down
let flourishT = 0;       // knife finisher twirl, counts down
let slowMoT = 0;         // finisher slow-motion, counts down in real time
// No pointer lock = paused. Esc (or alt-tab) drops the lock, which freezes the
// simulation behind the overlay; starting paused also means bots can't shoot
// you before you've even clicked Play.
let paused = true;
let pausedAt = performance.now(); // when the current pause began, to credit the time back on resume

// ---- HUD ----
const healthFill = document.getElementById('health-fill');
const damageFlash = document.getElementById('damage-flash');
const deathOverlay = document.getElementById('death');
const killCounter = document.getElementById('kill-counter');
const weaponName = document.getElementById('weapon-name');
const reloadFill = document.getElementById('reload-fill');
const upgradeBtn = document.getElementById('upgrade-btn');
const crosshair = document.getElementById('crosshair');
const waveCounter = document.getElementById('wave-counter');
const waveBanner = document.getElementById('wave-banner');
const deathStats = document.getElementById('death-stats');
const deathBest = document.getElementById('death-best');
const deathRecord = document.getElementById('death-record');

// ---- Loadout picker ----
// A simple emoji "picture" per weapon — matches this whole app's asset-free style (every
// minigame draws its own art or uses emoji, no external image files to load).
const WEAPON_ICONS = {
  glock: '🔫', deagle: '🔫', uzi: '🔫', mp90: '🔫', ak47: '🔫',
  sniper: '🎯', sniper3: '🎯', rpg: '🚀', knife: '🥊',
};
const loadoutOverlay = document.getElementById('loadout');
const loadoutGrid = document.getElementById('loadout-grid');

// Shows every currently-unlocked ladder weapon plus fists as clickable tiles; picking one
// equips it and calls `onDone`. Used at the start of every life (fresh mode start, and every
// respawn) and whenever a new weapon is unlocked mid-round — "until you die" per the ask, this
// is the one screen that reappears every time a fresh life begins, not just once.
function openLoadoutPicker(onDone) {
  loadoutGrid.innerHTML = '';
  const addTile = (icon, name, onPick) => {
    const tile = document.createElement('div');
    tile.className = 'loadout-tile';
    const iconEl = document.createElement('div');
    iconEl.className = 'loadout-icon';
    iconEl.textContent = icon;
    const nameEl = document.createElement('div');
    nameEl.className = 'loadout-name';
    nameEl.textContent = name;
    tile.append(iconEl, nameEl);
    tile.addEventListener('click', () => {
      loadoutOverlay.classList.add('hidden');
      onPick();
      onDone();
    });
    loadoutGrid.appendChild(tile);
  };
  for (const key of WEAPON_ORDER) {
    if (kills < WEAPONS[key].unlock) continue;
    addTile(WEAPON_ICONS[key], WEAPONS[key].title, () => equipWeapon(key));
  }
  addTile(WEAPON_ICONS.knife, 'Fists', () => selectFists());
  loadoutOverlay.classList.remove('hidden');
}

function showWaveBanner(text) {
  waveBanner.textContent = text;
  waveBanner.classList.remove('show');
  void waveBanner.offsetWidth; // restart the CSS animation
  waveBanner.classList.add('show');
}

// ---- Best run ----
// localStorage, so the number to beat survives refreshes. A run is one life;
// the best is the furthest wave, kills breaking ties.
const BEST_KEY = 'valk-fps-best';
function loadBest() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY)) || { wave: 0, kills: 0 }; }
  catch { return { wave: 0, kills: 0 }; }
}
function saveBest(best) {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch {}
}

// FS mode keeps its own scoreboard — just kills in a life, no waves involved.
const BEST_FS_KEY = 'valk-fps-best-fs';
function loadBestFs() {
  try { return JSON.parse(localStorage.getItem(BEST_FS_KEY)) || 0; } catch { return 0; }
}
function saveBestFs(k) {
  try { localStorage.setItem(BEST_FS_KEY, JSON.stringify(k)); } catch {}
}

// ---- Save & continue ----
// The Save button (or P) keeps your kills, weapon, wave, and health in
// localStorage; opening the game again picks up right where you saved.
const SAVE_KEY = 'valk-fps-save';
const saveBtn = document.getElementById('save-btn');
let saveFlashTimer = null;

// `silent` is used for autosave (every kill, every new wave) — same write, but skips the chime
// and button flash so scoring several kills in a row doesn't spam confirmation feedback for
// something the player didn't ask for. The manual Save button/P key keep that feedback exactly
// as before, since there it IS the point — confirming "yes, that press worked."
function saveGame(silent) {
  if (dead) return; // no saving from the grave
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ kills, weapon, wave, health, savedAt: Date.now() }));
  } catch { return; }
  if (silent) return;
  sfxPickup();
  saveBtn.textContent = '💾 Saved ✓';
  clearTimeout(saveFlashTimer);
  saveFlashTimer = setTimeout(() => { saveBtn.textContent = '💾 Save (P)'; }, 1200);
}
saveBtn.addEventListener('click', () => {
  ensureAudio(); // the confirmation chime needs a user gesture the first time
  saveGame();
});

// Runs once at startup, after everything below is set up.
function loadSavedGame() {
  let save = null;
  try { save = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch {}
  if (!save || !WEAPONS[save.weapon]) return;
  kills = Math.max(0, save.kills | 0);
  killsAtRunStart = kills; // loaded kills belong to past runs, not this one's scoreboard
  weapon = save.weapon;
  ammo = WEAPONS[weapon].mag;
  equipGun(weapon);
  health = Math.min(MAX_HEALTH, save.health | 0) > 0 ? Math.min(MAX_HEALTH, save.health | 0) : MAX_HEALTH;
  wave = Math.max(0, (save.wave | 0) - 1); // the wave you saved on restarts fresh
  updateHealthBar();
}

function updateHealthBar() {
  const pct = Math.max(0, health) / MAX_HEALTH * 100;
  healthFill.style.width = `${pct}%`;
  healthFill.style.background = pct > 50 ? '#4caf50' : pct > 25 ? '#ff9800' : '#f44336';
}
updateHealthBar();

function flashDamage() {
  damageFlash.style.transition = 'none';
  damageFlash.style.opacity = '0.6';
  requestAnimationFrame(() => {
    damageFlash.style.transition = 'opacity 0.5s';
    damageFlash.style.opacity = '0';
  });
}

function nextWeaponKey() {
  const idx = WEAPON_ORDER.indexOf(weapon);
  return idx < WEAPON_ORDER.length - 1 ? WEAPON_ORDER[idx + 1] : null;
}

// Level is derived from the same kill-based unlock ladder weapons already use, rather than a
// second, redundant progression system tracking its own separate thresholds — Level N means
// "N of the 8 ladder weapons unlocked so far" (Level 1 = just the starting Glock).
function getLevel() {
  const unlockedCount = WEAPON_ORDER.filter((key) => kills >= WEAPONS[key].unlock).length;
  if (unlockedCount < WEAPON_ORDER.length) return unlockedCount;
  // Uncapped past the top of the ladder (RPG, 150 kills) — every 10 kills beyond that is another
  // level, climbing indefinitely rather than freezing at 8. This is what makes Level 100+ (the
  // purple-glitch nametag threshold in the online lobby) an actual reachable, if serious, grind
  // rather than a number the ladder itself could never produce.
  const topUnlock = WEAPONS[WEAPON_ORDER[WEAPON_ORDER.length - 1]].unlock;
  return WEAPON_ORDER.length + Math.floor((kills - topUnlock) / 10);
}

function updateWeaponHud() {
  weaponName.textContent = knifeOut ? KNIFE.title : WEAPONS[weapon].title;
  killCounter.textContent = `Level ${getLevel()} · Kills: ${kills}`;
  const nk = nextWeaponKey();
  if (!nk) {
    upgradeBtn.classList.add('hidden'); // top of the ladder
  } else if (kills >= WEAPONS[nk].unlock) {
    upgradeBtn.classList.remove('hidden');
    upgradeBtn.disabled = false;
    upgradeBtn.textContent = `Upgrade → ${WEAPONS[nk].title} (U)`;
  } else {
    upgradeBtn.classList.remove('hidden');
    upgradeBtn.disabled = true;
    upgradeBtn.textContent = `Upgrade 🔒 ${kills}/${WEAPONS[nk].unlock} kills`;
  }
}

const ammoCount = document.getElementById('ammo-count');
function updateAmmoHud() {
  ammoCount.textContent = knifeOut ? '∞'
    : isReloading ? 'Reloading…'
    : `${ammo}/${WEAPONS[weapon].mag}`;
}

let hitmarkerTimer = null;
function showHitMarker(headshot) {
  crosshair.classList.remove('hit', 'headshot');
  void crosshair.offsetWidth; // restart the CSS animation
  crosshair.classList.add(headshot ? 'headshot' : 'hit');
  clearTimeout(hitmarkerTimer);
  hitmarkerTimer = setTimeout(() => crosshair.classList.remove('hit', 'headshot'), 180);
  if (headshot) sfxHeadshot(); else sfxHit();
}

// ---- Gun viewmodel ----
const GUN_Z = -0.42;
let gun = null;

function addBox(parent, w, h, d, color, x, y, z, rx) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  parent.add(m);
  return m;
}

// Every mesh in a bot/ally/gun group owns its own geometry and material (none of it is a shared
// module-level singleton like packMat below), so a plain traverse-and-dispose-everything is safe
// here — matches fighterplane.js's disposeObject3D exactly.
function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
}

function equipGun(type) {
  if (gun) { camera.remove(gun); disposeObject3D(gun); }
  gun = new THREE.Group();
  let muzzleZ = -0.11;
  const DARK = 0x2b2f33;
  const GRIP = 0x1c1f22;
  const WOOD = 0x7a4a26;
  if (type === 'glock') {
    addBox(gun, 0.05, 0.05, 0.16, DARK, 0, 0, 0);
    addBox(gun, 0.045, 0.1, 0.05, GRIP, 0, -0.07, 0.05, 0.25);
  } else if (type === 'deagle') {
    addBox(gun, 0.06, 0.06, 0.22, 0xb9c2c9, 0, 0, 0);
    addBox(gun, 0.05, 0.1, 0.05, GRIP, 0, -0.07, 0.06, 0.25);
    muzzleZ = -0.14;
  } else if (type === 'uzi') {
    addBox(gun, 0.05, 0.06, 0.2, 0x24282c, 0, 0, 0);
    addBox(gun, 0.04, 0.12, 0.04, GRIP, 0, -0.08, 0.01);
    addBox(gun, 0.035, 0.1, 0.035, DARK, 0, -0.08, -0.05); // the long stick magazine
    muzzleZ = -0.13;
  } else if (type === 'mp90') {
    addBox(gun, 0.055, 0.07, 0.28, 0x3a4652, 0, 0, 0);
    addBox(gun, 0.045, 0.1, 0.05, GRIP, 0, -0.08, 0.04, 0.2);
    addBox(gun, 0.04, 0.09, 0.04, 0x2c363f, 0, -0.07, -0.06, -0.25);
    muzzleZ = -0.17;
  } else if (type === 'ak47') {
    addBox(gun, 0.05, 0.06, 0.34, 0x2e2a26, 0, 0, -0.02);
    addBox(gun, 0.045, 0.09, 0.05, WOOD, 0, -0.07, 0.06, 0.25);   // grip
    addBox(gun, 0.05, 0.06, 0.1, WOOD, 0, 0.005, 0.16);           // stock
    addBox(gun, 0.045, 0.12, 0.05, DARK, 0, -0.08, -0.03, 0.35);  // curved mag
    muzzleZ = -0.21;
  } else if (type === 'sniper' || type === 'sniper3') {
    const body = type === 'sniper' ? 0x32363a : 0x1f2933;
    addBox(gun, 0.04, 0.045, 0.46, body, 0, 0, -0.06);
    addBox(gun, 0.045, 0.05, 0.12, GRIP, 0, 0.05, 0.03);          // scope
    addBox(gun, 0.05, 0.06, 0.12, type === 'sniper' ? WOOD : 0x2fb6ac, 0, -0.01, 0.16); // stock
    addBox(gun, 0.04, 0.08, 0.05, GRIP, 0, -0.06, 0.08, 0.3);
    muzzleZ = -0.3;
  } else if (type === 'rpg') {
    addBox(gun, 0.09, 0.09, 0.5, 0x4a5d3a, 0, 0, -0.02);
    addBox(gun, 0.13, 0.13, 0.12, 0x8a2f23, 0, 0, -0.31);         // warhead
    addBox(gun, 0.04, 0.1, 0.05, GRIP, 0, -0.09, 0.05, 0.25);
    muzzleZ = -0.38;
  } else if (type === 'knife') {
    addBox(gun, 0.028, 0.012, 0.2, 0xd7dde2, 0, 0.01, -0.06);     // blade
    addBox(gun, 0.032, 0.022, 0.045, 0xb9c2c9, 0, 0.01, 0.05);    // guard
    addBox(gun, 0.035, 0.07, 0.06, GRIP, 0, -0.03, 0.09, 0.35);   // handle
  }
  const muzzle = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.035, 0.035),
    new THREE.MeshBasicMaterial({ color: 0xffe08a })
  );
  muzzle.position.set(0, 0.01, muzzleZ);
  muzzle.visible = false;
  gun.add(muzzle);
  gun.userData.muzzle = muzzle;
  // The flash also throws real light on nearby blocks for a frame or two.
  const flash = new THREE.PointLight(0xffd9a0, 0, 7, 2);
  flash.position.copy(muzzle.position);
  gun.add(flash);
  gun.userData.flash = flash;
  gun.position.set(0.22, -0.18, GUN_Z);
  camera.add(gun);
}
equipGun('glock');

// Shared by tryUpgrade() (the U-key ladder climb) and trySelectWeapon() (the 1/2/3 quick-swap
// hotkeys, and the loadout picker's own tile clicks) — every path that puts a specific ladder
// gun in your hands funnels through here so they can't drift out of sync with each other.
function equipWeapon(key) {
  weapon = key;
  ammo = WEAPONS[key].mag;
  isReloading = false;
  nextShotAt = 0;
  knifeOut = false; // equipping a gun pulls it straight into your hands, fists put away
  equipGun(key);
  updateWeaponHud();
  updateAmmoHud();
  saveGame(true); // autosave — earning/picking a loadout is progress too, not just kill count
}

function tryUpgrade() {
  // Was missing this, unlike its siblings trySelectWeapon()/selectFists() — since takeDamage()
  // never releases pointer lock on death, U still worked in the gap right after dying, silently
  // upgrading (equipWeapon's own autosave then no-ops against "no saving from the grave").
  if (dead) return;
  const nk = nextWeaponKey();
  if (!nk || kills < WEAPONS[nk].unlock) return;
  equipWeapon(nk);
}

// Quick-swap hotkeys (1/2/3) — unlike tryUpgrade, this can select ANY already-unlocked ladder
// weapon directly, not just the next rung. No-ops silently on a locked weapon, same as the
// upgrade button already does while disabled.
function trySelectWeapon(key) {
  if (dead || !WEAPONS[key] || kills < WEAPONS[key].unlock) return;
  equipWeapon(key);
}

// Dedicated fists-select for the "3" hotkey and the loadout picker — unlike Q's toggleKnife(),
// this always SELECTS fists rather than toggling them off if already out, matching "press 3 for
// fists" as a direct pick, not a toggle.
function selectFists() {
  if (dead) return;
  knifeOut = true;
  equipGun('knife');
  nextShotAt = 0;
  swingT = 0;
  flourishT = 0;
  updateWeaponHud();
  updateAmmoHud();
  saveGame(true);
}
upgradeBtn.addEventListener('click', tryUpgrade);

// ---- Bots ----
const bots = [];
const meshToBot = new Map(); // hittable mesh -> { bot, head }
const botMeshes = [];

function randomBotCell(avoidX, avoidZ) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const i = randCell();
    const j = randCell();
    if (cellFree(i, j) && Math.hypot(i + 0.5 - avoidX, j + 0.5 - avoidZ) > 6) return [i, j];
  }
  return [randCell(), randCell()];
}

// Shared humanoid-limb builder for bots/allies — legs, torso, arms occupy the exact same overall
// vertical footprint the old single torso box did (y: 0 to 0.6, head unchanged at 0.78) so this
// is purely a silhouette upgrade: no PLAYER_WIDTH/collision/aiming-height math anywhere else in
// this file needed to change. Limbs are deliberately NOT added to botMeshes/meshToBot (the
// raycast-hittable list) — same as the eyes already weren't — so hit-detection and headshot
// logic are completely unaffected, matching the app's existing "decorative-only" precedent.
function addLimbs(group, torsoMat, limbMat) {
  const legGeo = new THREE.BoxGeometry(0.16, 0.32, 0.16);
  const legs = [-0.11, 0.11].map((xOff) => {
    const leg = new THREE.Mesh(legGeo, limbMat);
    leg.position.set(xOff, 0.16, 0);
    leg.castShadow = true;
    group.add(leg);
    return leg;
  });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(PLAYER_WIDTH, 0.28, 0.3), torsoMat);
  torso.position.y = 0.46;
  torso.castShadow = true;
  group.add(torso);
  const armGeo = new THREE.BoxGeometry(0.12, 0.28, 0.14);
  const arms = [-0.31, 0.31].map((xOff) => {
    const arm = new THREE.Mesh(armGeo, limbMat);
    arm.position.set(xOff, 0.46, 0);
    arm.castShadow = true;
    group.add(arm);
    return arm;
  });
  return { torso, legs, arms };
}

// Same phase value driving the existing step-bob (now/110 + a per-unit offset) so legs/arms swing
// in sync with it rather than introducing a second, unrelated clock. Arms counter-swing opposite
// their same-side leg — the real thing a walking gait does — rather than mirroring the legs.
function animateWalk(legs, arms, phase, moving) {
  const swing = moving ? Math.sin(phase) * 0.6 : 0;
  legs[0].rotation.x = swing;
  legs[1].rotation.x = -swing;
  arms[0].rotation.x = -swing;
  arms[1].rotation.x = swing;
}

function spawnBot(fireInterval) {
  // Each bot gets its own materials so one bot's hit-flash doesn't light them all up.
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xd9534f });
  const limbMat = new THREE.MeshLambertMaterial({ color: 0xa93f38 }); // darker — reads as clothing, not just a recolored torso
  const headMat = new THREE.MeshLambertMaterial({ color: 0xe8837b });
  const group = new THREE.Group();
  const { torso: body, legs, arms } = addLimbs(group, bodyMat, limbMat);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), headMat);
  head.position.y = 0.78;
  head.castShadow = true;
  group.add(head);
  // Eyes on the front of the head; they burn red while the bot can see you,
  // so "I've been spotted" reads at a glance even before the bot turns to walk.
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x201f22 });
  for (const ex of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), eyeMat);
    eye.position.set(ex, 0.8, 0.145);
    group.add(eye);
  }
  scene.add(group);

  const [i, j] = randomBotCell(player.x, player.z);
  const bot = {
    group, body, head, bodyMat, limbMat, headMat, eyeMat, legs, arms,
    x: i + 0.5,
    z: j + 0.5,
    dir: Math.random() * Math.PI * 2,
    walkT: 1 + Math.random() * 2,
    fireInterval,
    fireT: 2 + Math.random() * 3, // staggered so the bots don't volley in sync
    health: BOT_MAX_HEALTH,
    deadBot: false,
    deathT: 0,
    flashT: 0,
    seesTarget: false,
    tgtX: 0,       // where the current target is, refreshed every frame it's seen
    tgtY: 0,
    tgtZ: 0,
    huntT: 0,      // > 0 means "keep hunting the last place I saw the target"
    lastSeenX: 0,
    lastSeenZ: 0,
    orbitSign: Math.random() < 0.5 ? 1 : -1, // which way this bot circles you up close
    avoidT: 0,     // seconds left sidestepping an obstacle mid-chase
  };
  group.position.set(bot.x, 0, bot.z);
  bots.push(bot);
  meshToBot.set(body, { bot, head: false });
  meshToBot.set(head, { bot, head: true });
  botMeshes.push(body, head);
}

function removeBot(index) {
  const bot = bots[index];
  scene.remove(bot.group);
  disposeObject3D(bot.group);
  meshToBot.delete(bot.body);
  meshToBot.delete(bot.head);
  botMeshes.splice(botMeshes.indexOf(bot.body), 1);
  botMeshes.splice(botMeshes.indexOf(bot.head), 1);
  bots.splice(index, 1);
}

// ---- Sidekicks ----
// Wave mode fields blue bots on YOUR team: one joins on wave 1, a second on
// wave 2, never more than MAX_ALLIES. They hunt the reds, draw fire (red bots
// shoot whichever of you they can see is closest), and any that fall walk
// back in with the next wave, patched up. Your own shots pass through them —
// no friendly fire either way.
const allies = [];

function spawnAlly() {
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4a8fd9 });
  const limbMat = new THREE.MeshLambertMaterial({ color: 0x2f5f96 });
  const headMat = new THREE.MeshLambertMaterial({ color: 0x8fbce8 });
  const group = new THREE.Group();
  const { torso: body, legs, arms } = addLimbs(group, bodyMat, limbMat);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), headMat);
  head.position.y = 0.78;
  head.castShadow = true;
  group.add(head);
  // Eyes glow cyan while the sidekick has an enemy in sight — same tell as
  // the reds' burning eyes, in team colors.
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x201f22 });
  for (const ex of [-0.07, 0.07]) {
    const eyeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), eyeMat);
    eyeMesh.position.set(ex, 0.8, 0.145);
    group.add(eyeMesh);
  }
  scene.add(group);

  // They walk in right beside you: first clear spot within a couple of blocks.
  let x = player.x;
  let z = player.z;
  for (let attempt = 0; attempt < 100; attempt++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.2 + Math.random() * 2;
    const cx = clampToMap(player.x + Math.cos(a) * r);
    const cz = clampToMap(player.z + Math.sin(a) * r);
    if (!blockedAt(cx, cz, 0)) { x = cx; z = cz; break; }
  }
  const ally = {
    group, bodyMat, limbMat, headMat, eyeMat, legs, arms,
    x, z,
    dir: Math.random() * Math.PI * 2,
    fireT: 1 + Math.random(), // staggered, so two sidekicks don't volley in sync
    health: ALLY_MAX_HEALTH,
    deadAlly: false,
    deathT: 0,
    flashT: 0,
    orbitSign: Math.random() < 0.5 ? 1 : -1,
    avoidT: 0,
  };
  group.position.set(x, 0, z);
  allies.push(ally);
}

function removeAlly(index) {
  scene.remove(allies[index].group);
  disposeObject3D(allies[index].group);
  allies.splice(index, 1);
}

function damageAlly(ally, amount) {
  if (ally.deadAlly) return;
  ally.health -= amount;
  ally.flashT = 0.12;
  if (ally.health <= 0) {
    ally.deadAlly = true;
    ally.deathT = 0;
    spawnImpact(ally.x, 0.6, ally.z, 0x4a8fd9, 10);
    sfxAllyDown();
  }
}

// A bot can only see (and shoot) you when no column crosses the straight line
// between its eyes and yours — sampled every fifth of a block along the way.
// Perimeter walls don't matter here: both ends are always inside them.
function lineOfSightClear(x0, y0, z0, x1, y1, z1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  const steps = Math.ceil(Math.hypot(dx, dz) / 0.2);
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    if ((occupied.get(`${Math.floor(x0 + dx * t)},${Math.floor(z0 + dz * t)}`) || 0) > y0 + dy * t) return false;
  }
  return true;
}

// ---- Modes ----
// The mode screen shows at load, and again via M from the death screen.
// Wave Challenge is the escalating-waves game; FS keeps 4 enemies on the field
// forever, each back 5 seconds after it drops; Online Play is a placeholder
// until the 1v1-through-Valk-invites feature exists.
let mode = null; // 'wave' | 'fs' — null while the mode screen is up
const modeSelect = document.getElementById('mode-select');

function startMode(m) {
  mode = m;
  modeSelect.classList.add('hidden');
  // A clean field for the new mode; kills and weapon stay — they're the ladder.
  while (bullets.length) removeBullet(0);
  while (pickups.length) removePickup(0);
  while (bots.length) removeBot(0);
  while (allies.length) removeAlly(0);
  killsAtRunStart = kills;
  if (mode === 'fs') {
    nextWaveT = -1;
    for (let n = 0; n < FS_BOTS; n++) spawnBot(BOT_FIRE_INTERVAL);
  } else {
    nextWaveT = 1.5; // waves start counting once you click in and unpause
  }
  updateWaveHud();
  // Pick a loadout before the very first "Click to play" of a fresh life, same as after every
  // respawn/death below.
  openLoadoutPicker(() => { document.getElementById('hint-title').textContent = 'Click to play'; });
}

document.querySelectorAll('.mode-btn[data-mode]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation(); // the document-level respawn click listener isn't for this
    ensureAudio();       // a user gesture — boot audio here too
    startMode(btn.dataset.mode);
  });
});

// M from the death screen: back to the mode screen instead of respawning.
function backToModeSelect() {
  leaveOnlineLobby(); // no-op if Online Play was never entered — guarded internally
  player.x = 0;
  player.y = 0;
  player.z = 0;
  vy = 0;
  onGround = true;
  hasAirMomentum = false;
  health = MAX_HEALTH;
  dead = false;
  wave = 0;
  updateHealthBar();
  deathOverlay.classList.add('hidden');
  mode = null;
  modeSelect.classList.remove('hidden');
  updateWaveHud();
  if (document.pointerLockElement) document.exitPointerLock(); // free the cursor for the buttons
}

// ---- Waves ----
let wave = 0;
let nextWaveT = -1; // countdown to the next wave; -1 while one is being fought (or not in wave mode)

function updateWaveHud() {
  waveCounter.textContent = mode === 'fs' ? 'FS'
    : mode === null ? 'Choose a mode'
    : wave > 0 ? `Wave ${wave}` : 'Get ready…';
}

function startWave() {
  wave += 1;
  nextWaveT = -1;
  const count = Math.min(WAVE_BASE_BOTS + wave - 1, WAVE_MAX_BOTS);
  const interval = Math.max(BOT_MIN_FIRE_INTERVAL, BOT_FIRE_INTERVAL - BOT_FIRE_STEP * (wave - 1));
  for (let n = 0; n < count; n++) spawnBot(interval);
  // Sidekicks arrive with the wave: one on wave 1, a second from wave 2 on.
  // The fallen are replaced, and survivors get patched back to full health.
  for (let i = allies.length - 1; i >= 0; i--) if (allies[i].deadAlly) removeAlly(i);
  for (const ally of allies) ally.health = ALLY_MAX_HEALTH;
  while (allies.length < Math.min(wave, MAX_ALLIES)) spawnAlly();
  updateWaveHud();
  showWaveBanner(`Wave ${wave}`);
  sfxWaveStart();
  saveGame(true); // autosave — reaching a new wave is real progress too, not just kills
}

// FS mode only: a dead bot comes back somewhere else after its timer runs out.
function respawnBot(bot) {
  const [i, j] = randomBotCell(player.x, player.z);
  bot.x = i + 0.5;
  bot.z = j + 0.5;
  bot.health = BOT_MAX_HEALTH;
  bot.deadBot = false;
  bot.deathStyle = null; // a finisher launch is over once you're back
  bot.deathT = 0;
  bot.fireT = 2 + Math.random() * 3;
  bot.huntT = 0;
  bot.seesTarget = false;
  bot.avoidT = 0;
  bot.group.rotation.x = 0;
  bot.group.position.set(bot.x, 0, bot.z);
  bot.group.visible = true;
}

function damageBot(bot, amount, killCredit) {
  if (bot.deadBot) return;
  bot.health -= amount;
  bot.flashT = 0.12;
  if (bot.health <= 0) {
    bot.deadBot = true;
    bot.deathT = 0;
    spawnImpact(bot.x, 0.6, bot.z, 0xd9534f, 10); // burst apart a little on the kill
    const killsBefore = kills;
    kills += killCredit; // player shots pass 1 (2 for an RPG headshot); sidekick kills pass 0
    sfxKill();
    dropHealthPack(bot.x, bot.z);
    updateWeaponHud();
    saveGame(true); // autosave — a kill is exactly the progress a player wouldn't want to lose
    // A kill can cross a new weapon's unlock threshold (even skip clean past one, on a 2-credit
    // RPG headshot) — offer the loadout picker the instant that happens, instead of leaving it
    // to the player to notice the Upgrade button lit up.
    for (const key of WEAPON_ORDER) {
      if (killsBefore < WEAPONS[key].unlock && kills >= WEAPONS[key].unlock) {
        showWaveBanner(`⭐ LEVEL UP! Level ${getLevel()}`);
        // Skip opening the picker here if an already-in-flight enemy bullet resolved earlier in
        // this same tick() and killed the player (bullet-vs-player collision runs before this
        // point) — pointerlockchange/`paused` only flip asynchronously, so `dead` is the one
        // reliable signal available synchronously. Opening it anyway would stack it on top of
        // the death overlay in a not-actually-alive state; the (now-fixed) death/respawn click
        // flow already picks up the loadout correctly once they respawn.
        if (!dead) {
          if (document.pointerLockElement) document.exitPointerLock();
          openLoadoutPicker(() => canvas.requestPointerLock());
        }
        break;
      }
    }
  }
}

// ---- Health packs ----
// Every dead bot leaves one behind: +25 health, gone after 10 seconds. Walking
// over it at full health leaves it lying there for when you actually need it.
const pickups = [];
const packMat = new THREE.MeshLambertMaterial({ color: 0x4caf50, emissive: 0x0c3a0e });

function dropHealthPack(x, z) {
  const group = new THREE.Group();
  for (const [w, d] of [[0.34, 0.12], [0.12, 0.34]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), packMat);
    bar.castShadow = true;
    group.add(bar);
  }
  group.position.set(x, 0.35, z);
  scene.add(group);
  pickups.push({ group, x, z, life: PICKUP_LIFE });
}

function removePickup(index) {
  const group = pickups[index].group;
  scene.remove(group);
  // Geometry only — packMat above is one shared material reused by every pickup on screen, so
  // disposing it here (like disposeObject3D would) would break every other still-visible pack.
  group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  pickups.splice(index, 1);
}

// ---- Bot bullets ----
// Both teams shoot the same slow, dodgeable bullets. Red bots aim at wherever
// their target is NOW — sprint sideways, or crouch/slide under it. Sidekick
// fire (`friendly`) is blue and only hurts the red team.
const bullets = [];
const bulletGeo = new THREE.SphereGeometry(0.09, 8, 8);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
const allyBulletMat = new THREE.MeshBasicMaterial({ color: 0x4da3ff });

function fireBullet(ox, oz, tx, ty, tz, friendly) {
  const oy = 0.55;
  const dist = Math.hypot(tx - ox, ty - oy, tz - oz) || 1;
  sfxBotShot(Math.hypot(ox - player.x, oz - player.z)); // volume keys off how close the shooter is to YOU
  spawnImpact(ox, oy, oz, 0xffe08a, 2); // muzzle sparks flag who's shooting
  const mesh = new THREE.Mesh(bulletGeo, friendly ? allyBulletMat : bulletMat);
  mesh.position.set(ox, oy, oz);
  scene.add(mesh);
  bullets.push({
    mesh,
    x: ox, y: oy, z: oz,
    vx: (tx - ox) / dist * BULLET_SPEED,
    vy: (ty - oy) / dist * BULLET_SPEED,
    vz: (tz - oz) / dist * BULLET_SPEED,
    life: BULLET_LIFE,
    friendly: !!friendly,
  });
}

function removeBullet(index) {
  scene.remove(bullets[index].mesh);
  bullets.splice(index, 1);
}

function takeDamage(amount) {
  if (dead) return;
  health -= amount;
  updateHealthBar();
  flashDamage();
  if (health <= 0) {
    dead = true;
    sliding = false;
    keys.clear();
    sfxDeath();
    // Scoreboard time: this run against the best this browser has ever seen.
    // Each mode keeps its own best — FS has no waves, so it's kills only.
    const runKills = kills - killsAtRunStart;
    if (mode === 'fs') {
      const best = loadBestFs();
      const record = runKills > best;
      if (record) saveBestFs(runKills);
      deathStats.textContent = `${runKills} kills this run`;
      deathBest.textContent = record ? '' : `Best: ${best} kills`;
      deathRecord.classList.toggle('hidden', !record);
    } else {
      const best = loadBest();
      const record = wave > best.wave || (wave === best.wave && runKills > best.kills);
      if (record) saveBest({ wave, kills: runKills });
      deathStats.textContent = `Wave ${wave} · ${runKills} kills this run`;
      deathBest.textContent = record ? '' : `Best: wave ${best.wave} · ${best.kills} kills`;
      deathRecord.classList.toggle('hidden', !record);
    }
    deathOverlay.classList.remove('hidden');
  } else {
    sfxHurt();
  }
}

function respawn() {
  player.x = 0;
  player.y = 0;
  player.z = 0;
  vy = 0;
  onGround = true;
  hasAirMomentum = false;
  health = MAX_HEALTH;
  dead = false;
  killsAtRunStart = kills; // the ladder keeps its kills; the scoreboard starts over
  updateHealthBar();
  deathOverlay.classList.add('hidden');
  // A fresh run: clear the field and restart the current mode from its top.
  while (bullets.length) removeBullet(0);
  while (pickups.length) removePickup(0);
  while (bots.length) removeBot(0);
  while (allies.length) removeAlly(0);
  wave = 0;
  if (mode === 'fs') {
    nextWaveT = -1;
    for (let n = 0; n < FS_BOTS; n++) spawnBot(BOT_FIRE_INTERVAL);
  } else {
    nextWaveT = 1.5;
  }
  updateWaveHud();
}

// ---- Online lobby ----
// A real WebSocket-connected, open, free-roam lobby (see server.js's bb-* handlers) — everyone
// currently online sees everyone else walking around in third person, no combat at all, until two
// players peer-to-peer challenge/accept into a private 1v1 (dueling flips both back to
// first-person, one fixed shared weapon profile, server-authoritative damage). Deliberately kept
// as its own isolated pair of flags (onlineActive/dueling) rather than a new value threaded
// through the existing mode === 'fs'/'wave' conditionals scattered through the rest of this file —
// those are well-tested single-player paths this feature shares no state with, so branching only
// the few spots that actually differ (camera, gun visibility, shoot routing) is the lower-risk cut.
let onlineActive = false;
let dueling = false;
let bbWs = null;
let myBbId = null;
let myOpponentId = null;
let myOpponentName = '';
let opponentHealth = 100;
const BB_MAX_HEALTH_CLIENT = 100;
// Mirrors server.js's BB_WEAPON exactly for local cosmetics (sound/tracer/cooldown gating) — the
// server re-checks its own copy of these numbers before ever applying damage, so a modified client
// can make this local copy lie without gaining anything.
const BB_WEAPON_CLIENT = { damage: 20, range: 60, cooldownMs: 150 };
let bbNextShotAt = 0;
let bbPosSendT = 0;      // counts down to the next throttled bb-pos send
let bbAvatarPhase = 0;   // local third-person avatar's own walk-cycle clock

const lobbyHud = document.getElementById('lobby-hud');
const lobbyPlayerCount = document.getElementById('lobby-player-count');
const lobbyPlayersPanel = document.getElementById('lobby-players-panel');
const lobbyPlayersList = document.getElementById('lobby-players-list');
const challengePopup = document.getElementById('challenge-popup');
const challengeText = document.getElementById('challenge-text');
const duelHud = document.getElementById('duel-hud');
const duelOpponentName = document.getElementById('duel-opponent-name');
const duelOpponentHealthFill = document.getElementById('duel-opponent-health-fill');
const duelResult = document.getElementById('duel-result');
const weaponHudEl = document.getElementById('weapon-hud');

// id -> { group, legs, arms, nameSprite, name, level, target: {x,y,z,yaw}, phase }
const bbRemotePlayers = new Map();
let bbPlayers = []; // last-known roster snapshot for the players panel: { id, name, level, dueling }

// Shared by both the initial draw and every glitch-flicker redraw so the "purple glitchy" look
// (Level 100+ only) doesn't need two copies of the same drawing code.
function drawBbNameCanvas(canvas, name, purple) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = purple ? 'rgba(50,8,74,0.55)' : 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = String(name).slice(0, 16);
  if (purple) {
    // Cheap "glitch": two color-fringed copies jittered a few pixels off the true white text,
    // redrawn on a short random interval (not every frame) via updateRemotePlayers' glitchT timer.
    const jx = (Math.random() - 0.5) * 6, jy = (Math.random() - 0.5) * 3;
    ctx.fillStyle = '#ff2ee0';
    ctx.fillText(label, 128 + jx, 32 + jy);
    ctx.fillStyle = '#37f2ff';
    ctx.fillText(label, 128 - jx, 32 - jy);
    ctx.fillStyle = '#f4e9ff';
    ctx.fillText(label, 128, 32);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillText(label, 128, 32);
  }
}

function makeBbNameSprite(name, level) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const purple = level >= 100;
  drawBbNameCanvas(canvas, name, purple);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(1.6, 0.4, 1);
  sprite.position.y = 1.15;
  sprite.userData.glitchy = purple;
  sprite.userData.canvas = canvas;
  sprite.userData.name = name;
  sprite.userData.glitchT = 0.1;
  return sprite;
}

// id -> the level.100+ purple-glitch redraw is by far the more expensive path (a canvas redraw +
// needsUpdate every ~0.1s per such player); everyone else's tag is drawn once and left alone.
function redrawBbNameSprite(sprite) {
  drawBbNameCanvas(sprite.userData.canvas, sprite.userData.name, true);
  sprite.material.map.needsUpdate = true;
}

function spawnRemotePlayer(id, name, level, pos) {
  if (id === myBbId || bbRemotePlayers.has(id)) return;
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2fb6ac });
  const limbMat = new THREE.MeshLambertMaterial({ color: 0x1f7d76 });
  const headMat = new THREE.MeshLambertMaterial({ color: 0x6fe0d3 });
  const group = new THREE.Group();
  const { legs, arms } = addLimbs(group, bodyMat, limbMat);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), headMat);
  head.position.y = 0.78;
  head.castShadow = true;
  group.add(head);
  const nameSprite = makeBbNameSprite(name, level);
  group.add(nameSprite);
  const p = pos || { x: 0, y: 0, z: 0, yaw: 0 };
  group.position.set(p.x, p.y, p.z);
  group.rotation.y = p.yaw;
  scene.add(group);
  bbRemotePlayers.set(id, { group, legs, arms, nameSprite, name, level, target: { x: p.x, y: p.y, z: p.z, yaw: p.yaw }, phase: 0 });
}

function removeRemotePlayer(id) {
  const rp = bbRemotePlayers.get(id);
  if (!rp) return;
  scene.remove(rp.group);
  // Same disposal rule as firefight.js's removeRemotePlayer: every mesh's own geometry/material is
  // this instance's alone and must be freed, but the name sprite's geometry is THREE.Sprite's
  // single shared module-level PlaneGeometry (used by every sprite effect in the game) and must
  // never be disposed — only its material and the CanvasTexture the material uniquely owns are.
  rp.group.traverse((o) => {
    if (!o.isMesh && !o.isSprite) return;
    if (o.isMesh && o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
  bbRemotePlayers.delete(id);
}

function updateRemotePlayers(dt) {
  for (const rp of bbRemotePlayers.values()) {
    const g = rp.group;
    const t = rp.target;
    const lerp = 1 - Math.exp(-12 * dt);
    g.position.x += (t.x - g.position.x) * lerp;
    g.position.y += (t.y - g.position.y) * lerp;
    g.position.z += (t.z - g.position.z) * lerp;
    // Shortest-path angle lerp so a player turning from just-under to just-over ±π doesn't spin
    // the long way around.
    let dyaw = ((t.yaw - g.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    g.rotation.y += dyaw * lerp;
    const moving = Math.hypot(t.x - g.position.x, t.z - g.position.z) > 0.02;
    if (moving) rp.phase += 6 * dt;
    animateWalk(rp.legs, rp.arms, rp.phase, moving);
    if (rp.nameSprite.userData.glitchy) {
      rp.nameSprite.userData.glitchT -= dt;
      if (rp.nameSprite.userData.glitchT <= 0) {
        rp.nameSprite.userData.glitchT = 0.08 + Math.random() * 0.1;
        redrawBbNameSprite(rp.nameSprite);
      }
    }
  }
}

// The local player's own avatar only exists to be seen by the third-person lobby camera — built
// lazily on first use and torn down whenever a duel starts (first-person, no need to render
// yourself) or the lobby is left entirely.
let localAvatar = null;
function ensureLocalAvatar() {
  if (localAvatar) return;
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffb74d });
  const limbMat = new THREE.MeshLambertMaterial({ color: 0xc98a2e });
  const headMat = new THREE.MeshLambertMaterial({ color: 0xffd699 });
  const group = new THREE.Group();
  const { legs, arms } = addLimbs(group, bodyMat, limbMat);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), headMat);
  head.position.y = 0.78;
  head.castShadow = true;
  group.add(head);
  scene.add(group);
  localAvatar = { group, legs, arms };
}
function removeLocalAvatar() {
  if (!localAvatar) return;
  scene.remove(localAvatar.group);
  localAvatar.group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  localAvatar = null;
}
function updateLocalAvatar(vx, vz, dt) {
  ensureLocalAvatar();
  localAvatar.group.position.set(player.x, player.y, player.z);
  localAvatar.group.rotation.y = yaw;
  const moving = onGround && Math.hypot(vx, vz) > 0.1;
  if (moving) bbAvatarPhase += Math.hypot(vx, vz) * 1.9 * dt;
  animateWalk(localAvatar.legs, localAvatar.arms, bbAvatarPhase, moving);
}

// One fixed semi-auto profile shared by every lobby duel, entirely separate from the single-
// player ladder weapons — no ammo/reload, and the shot itself carries no target/hit-point payload
// at all (mirrors fg-shoot exactly): the server resolves the opponent via its own opponentId and
// does its own cooldown/range/alive-state check, so this function is purely cosmetic feedback.
function tryFireOnline(nowMs) {
  if (nowMs < bbNextShotAt) return;
  bbNextShotAt = nowMs + BB_WEAPON_CLIENT.cooldownMs;
  gunKick = 1;
  muzzleT = 0.05;
  gun.userData.muzzle.visible = true;
  gun.userData.flash.intensity = 2.2;
  sfxShot('deagle');
  raycaster.setFromCamera(CROSSHAIR_CENTER, camera);
  spawnTracer(raycaster.ray.at(60, new THREE.Vector3()));
  if (bbWs && bbWs.readyState === WebSocket.OPEN) bbWs.send(JSON.stringify({ type: 'bb-shoot' }));
}

function sendBbPos(dt) {
  if (!bbWs || bbWs.readyState !== WebSocket.OPEN) return;
  bbPosSendT -= dt;
  if (bbPosSendT > 0) return;
  bbPosSendT = 0.08; // ~12/sec, matching firefight.js's own fg-pos cadence
  bbWs.send(JSON.stringify({ type: 'bb-pos', x: player.x, y: player.y, z: player.z, yaw }));
}

function renderLobbyPlayersList() {
  lobbyPlayersList.innerHTML = '';
  for (const p of bbPlayers) {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${p.name}${p.level >= 100 ? ' ✨' : ''} · Lv ${p.level}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lobby-player-challenge-btn';
    btn.textContent = '⚔️ Challenge';
    btn.disabled = dueling;
    btn.addEventListener('click', () => {
      if (bbWs && bbWs.readyState === WebSocket.OPEN) bbWs.send(JSON.stringify({ type: 'bb-challenge', targetId: p.id }));
      showWaveBanner(`Challenge sent to ${p.name}`);
    });
    li.append(nameSpan, btn);
    lobbyPlayersList.appendChild(li);
  }
}

function endDuel(message) {
  dueling = false;
  myOpponentId = null;
  duelHud.classList.add('hidden');
  duelResult.textContent = message;
  duelResult.classList.remove('hidden');
  setTimeout(() => duelResult.classList.add('hidden'), 2500);
  health = MAX_HEALTH;
  updateHealthBar();
  if (onlineActive) lobbyHud.classList.remove('hidden');
}

function handleBbMessage(data) {
  switch (data.type) {
    case 'bb-init': {
      myBbId = data.id;
      for (const p of data.players) spawnRemotePlayer(p.id, p.name, p.level, p);
      bbPlayers = data.players.map((p) => ({ id: p.id, name: p.name, level: p.level, dueling: p.dueling }));
      lobbyPlayerCount.textContent = String(bbPlayers.length);
      renderLobbyPlayersList();
      break;
    }
    case 'bb-full': {
      leaveOnlineLobby();
      backToModeSelect();
      showWaveBanner('⚠️ Lobby is full — try again shortly');
      break;
    }
    case 'bb-player-joined': {
      spawnRemotePlayer(data.id, data.name, data.level, data);
      bbPlayers.push({ id: data.id, name: data.name, level: data.level, dueling: false });
      lobbyPlayerCount.textContent = String(bbPlayers.length);
      renderLobbyPlayersList();
      break;
    }
    case 'bb-player-left': {
      removeRemotePlayer(data.id);
      bbPlayers = bbPlayers.filter((p) => p.id !== data.id);
      lobbyPlayerCount.textContent = String(bbPlayers.length);
      renderLobbyPlayersList();
      break;
    }
    case 'bb-pos': {
      const rp = bbRemotePlayers.get(data.id);
      if (rp) { rp.target.x = data.x; rp.target.y = data.y; rp.target.z = data.z; rp.target.yaw = data.yaw; }
      break;
    }
    case 'bb-challenged': {
      challengeText.textContent = `${data.fromName} challenges you to a 1v1!`;
      challengePopup.dataset.fromId = data.fromId;
      challengePopup.classList.remove('hidden');
      break;
    }
    case 'bb-challenge-declined': {
      const p = bbPlayers.find((x) => x.id === data.byId);
      showWaveBanner(`${p ? p.name : 'They'} declined your challenge`);
      break;
    }
    case 'bb-duel-started': {
      dueling = true;
      myOpponentId = data.opponentId;
      myOpponentName = data.opponentName;
      opponentHealth = BB_MAX_HEALTH_CLIENT;
      health = MAX_HEALTH;
      updateHealthBar();
      lobbyPlayersPanel.classList.add('hidden');
      challengePopup.classList.add('hidden');
      duelResult.classList.add('hidden');
      duelOpponentName.textContent = myOpponentName;
      duelOpponentHealthFill.style.width = '100%';
      duelHud.classList.remove('hidden');
      lobbyHud.classList.add('hidden');
      removeLocalAvatar(); // first-person again — nothing to gain from also rendering yourself
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
      break;
    }
    case 'bb-hit-confirm': {
      opponentHealth = data.opponentHealth;
      duelOpponentHealthFill.style.width = `${Math.max(0, opponentHealth) / BB_MAX_HEALTH_CLIENT * 100}%`;
      showHitMarker(false);
      break;
    }
    case 'bb-hit': {
      health = Math.max(0, health - BB_WEAPON_CLIENT.damage);
      updateHealthBar();
      flashDamage();
      sfxHurt();
      break;
    }
    case 'bb-duel-won': endDuel('🏆 You won the duel!'); break;
    case 'bb-duel-lost': endDuel('💀 You lost the duel'); break;
    case 'bb-duel-ended': endDuel('Duel ended — opponent left'); break;
  }
}

function connectBb() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  bbWs = new WebSocket(`${protocol}//${location.host}`);
  bbWs.addEventListener('open', () => {
    const accountToken = localStorage.getItem('valk-account-token') || '';
    bbWs.send(JSON.stringify({ type: 'bb-join', accountToken, level: getLevel() }));
  });
  bbWs.addEventListener('message', (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    handleBbMessage(data);
  });
  bbWs.addEventListener('close', () => {
    for (const id of [...bbRemotePlayers.keys()]) removeRemotePlayer(id);
    bbWs = null;
    // Only auto-reconnect while the player is still actually trying to be in the lobby — a
    // deliberate Leave already flips onlineActive off before ever closing the socket itself.
    if (onlineActive) setTimeout(() => { if (onlineActive) connectBb(); }, 1500);
  });
}

function startOnlinePlay() {
  mode = 'online';
  modeSelect.classList.add('hidden');
  while (bullets.length) removeBullet(0);
  while (pickups.length) removePickup(0);
  while (bots.length) removeBot(0);
  while (allies.length) removeAlly(0);
  wave = 0;
  updateWaveHud();
  onlineActive = true;
  dueling = false;
  player.x = 0; player.y = 0; player.z = 0; vy = 0; onGround = true; hasAirMomentum = false;
  health = MAX_HEALTH;
  dead = false;
  updateHealthBar();
  weaponHudEl.classList.add('hidden');
  waveCounter.classList.add('hidden');
  lobbyHud.classList.remove('hidden');
  connectBb();
  document.getElementById('hint-title').textContent = 'Click to play';
  hint.classList.remove('hidden');
}

function leaveOnlineLobby() {
  if (bbWs) {
    try { bbWs.send(JSON.stringify({ type: 'bb-leave' })); } catch {}
    bbWs.close();
    bbWs = null;
  }
  for (const id of [...bbRemotePlayers.keys()]) removeRemotePlayer(id);
  removeLocalAvatar();
  onlineActive = false;
  dueling = false;
  myBbId = null;
  myOpponentId = null;
  lobbyHud.classList.add('hidden');
  lobbyPlayersPanel.classList.add('hidden');
  challengePopup.classList.add('hidden');
  duelHud.classList.add('hidden');
  duelResult.classList.add('hidden');
  weaponHudEl.classList.remove('hidden');
  waveCounter.classList.remove('hidden');
  gun.visible = true;
}

document.getElementById('online-play-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  ensureAudio();
  startOnlinePlay();
});
document.getElementById('lobby-players-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  renderLobbyPlayersList();
  lobbyPlayersPanel.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
});
document.getElementById('lobby-players-close-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  lobbyPlayersPanel.classList.add('hidden');
});
document.getElementById('lobby-leave-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  leaveOnlineLobby();
  backToModeSelect();
});
document.getElementById('challenge-accept-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const fromId = challengePopup.dataset.fromId;
  challengePopup.classList.add('hidden');
  if (bbWs && bbWs.readyState === WebSocket.OPEN) bbWs.send(JSON.stringify({ type: 'bb-challenge-response', fromId, accept: true }));
});
document.getElementById('challenge-decline-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const fromId = challengePopup.dataset.fromId;
  challengePopup.classList.add('hidden');
  if (bbWs && bbWs.readyState === WebSocket.OPEN) bbWs.send(JSON.stringify({ type: 'bb-challenge-response', fromId, accept: false }));
});

// ---- Player shooting (hitscan through the crosshair) ----
const raycaster = new THREE.Raycaster();
raycaster.far = 100;
const CROSSHAIR_CENTER = new THREE.Vector2(0, 0);
const tracers = [];
const tracerMat = new THREE.LineBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.9 });

function spawnTracer(endPoint) {
  const start = new THREE.Vector3(0.22, -0.22, -0.5).applyMatrix4(camera.matrixWorld);
  const geo = new THREE.BufferGeometry().setFromPoints([start, endPoint]);
  const line = new THREE.Line(geo, tracerMat);
  scene.add(line);
  tracers.push({ line, life: 0.07 });
}

// ---- Impact debris ----
// Little cubes that burst off whatever a shot hits and tumble under gravity.
// They shrink to nothing rather than fading, so one material per color is
// shared by every particle — no per-hit material allocations.
const particles = [];
const particleGeo = new THREE.BoxGeometry(0.055, 0.055, 0.055);
const particleMats = new Map(); // color -> shared MeshBasicMaterial

function spawnImpact(x, y, z, color, count) {
  let mat = particleMats.get(color);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color });
    particleMats.set(color, mat);
  }
  for (let n = 0; n < count; n++) {
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    const a = Math.random() * Math.PI * 2;
    const sp = 0.8 + Math.random() * 1.8;
    const life = 0.3 + Math.random() * 0.25;
    particles.push({
      mesh, life, maxLife: life,
      vx: Math.cos(a) * sp,
      vy: 1.2 + Math.random() * 2.2,
      vz: Math.sin(a) * sp,
    });
    scene.add(mesh);
  }
}

// ---- RPG explosions ----
const explosions = [];
const explosionMat = new THREE.MeshBasicMaterial({ color: 0xff9040, transparent: true, opacity: 0.9 });
const explosionGeo = new THREE.SphereGeometry(0.3, 12, 12);

function spawnExplosion(point) {
  const mesh = new THREE.Mesh(explosionGeo, explosionMat.clone());
  mesh.position.copy(point);
  // The blast throws real orange light on everything nearby while it balloons.
  const glow = new THREE.PointLight(0xff9040, 3, 12, 2);
  mesh.add(glow);
  scene.add(mesh);
  explosions.push({ mesh, glow, t: 0 });
  spawnImpact(point.x, point.y, point.z, 0xffb35c, 8); // sparks
  spawnImpact(point.x, point.y, point.z, 0x4c4640, 8); // scorched chunks
  sfxExplosion();
}

function shootOnce(spec) {
  gunKick = 1;
  muzzleT = 0.05;
  gun.userData.muzzle.visible = true;
  gun.userData.flash.intensity = 2.2;
  sfxShot(weapon);

  raycaster.setFromCamera(CROSSHAIR_CENTER, camera);
  // Non-recursive on purpose: the block meshes carry LineSegments children, and
  // Raycaster hits lines within a huge default threshold.
  const hits = raycaster.intersectObjects(solids.concat(botMeshes), false);
  let hit = null;
  for (const h of hits) {
    const rec = meshToBot.get(h.object);
    if (rec && rec.bot.deadBot) continue; // shots pass through a falling bot
    hit = h;
    break;
  }
  const end = hit ? hit.point : raycaster.ray.at(60, new THREE.Vector3());
  spawnTracer(end);

  if (spec.explosive) {
    // The rocket detonates wherever it lands: every living bot near the blast
    // takes full damage. A direct hit on a head pays out 2 kills.
    spawnExplosion(end);
    const rec = hit && meshToBot.get(hit.object);
    const headBot = rec && rec.head ? rec.bot : null;
    let anyHit = false;
    for (const bot of bots) {
      if (bot.deadBot) continue;
      if (Math.hypot(bot.x - end.x, 0.5 - end.y, bot.z - end.z) < 1.6) {
        damageBot(bot, spec.damage, spec.headshotDoubleKill && bot === headBot ? 2 : 1);
        anyHit = true;
      }
    }
    if (anyHit) showHitMarker(!!headBot);
  } else if (hit) {
    const rec = meshToBot.get(hit.object);
    if (rec) {
      spawnImpact(hit.point.x, hit.point.y, hit.point.z, 0xc23b36, 5);
      damageBot(rec.bot, rec.head ? spec.headshot : spec.damage, 1);
      showHitMarker(rec.head);
    } else {
      spawnImpact(hit.point.x, hit.point.y, hit.point.z, 0xa8a8a8, 5); // chips off the block
    }
  }
}

function startReload(nowMs) {
  if (isReloading) return;
  isReloading = true;
  ammo = 0; // a partial magazine is tossed — reloading always refills from empty
  reloadEndAt = nowMs + WEAPONS[weapon].reload * 1000;
  updateAmmoHud();
}

function tryFire(nowMs) {
  // During an online duel, shooting is routed entirely differently — one fixed semi-auto profile,
  // no ammo/reload, and damage resolution is server-authoritative (bb-shoot carries no target or
  // hit payload at all; the server decides range/cooldown/alive-state, matching Firefight's own
  // fg-shoot exactly), so none of the single-player ladder-weapon logic below applies.
  if (dueling) { tryFireOnline(nowMs); return; }
  if (onlineActive) return; // defense-in-depth: the lobby's mousedown handler already blocks this
  if (knifeOut) {
    if (nowMs < nextShotAt) return; // still mid-swing
    nextShotAt = nowMs + KNIFE.interval * 1000;
    knifeSlash();
    return;
  }
  const spec = WEAPONS[weapon];
  if (isReloading || nowMs < nextShotAt || ammo <= 0) return;
  shootOnce(spec);
  ammo -= 1;
  if (ammo <= 0) startReload(nowMs);
  else nextShotAt = nowMs + spec.interval * 1000;
  updateAmmoHud();
}

// ---- The knife ----
function toggleKnife() {
  if (dead) return;
  knifeOut = !knifeOut;
  equipGun(knifeOut ? 'knife' : weapon);
  nextShotAt = 0;
  swingT = 0;
  flourishT = 0;
  updateWeaponHud();
  updateAmmoHud();
}

// A slash is a short frontal arc, not a ray: every living bot close enough,
// roughly in front of you, and not behind a wall gets cut.
function knifeSlash() {
  swingT = 0.25;
  sfxKnifeSwing();
  const dirX = -Math.sin(yaw);
  const dirZ = -Math.cos(yaw);
  let killed = false;
  let struck = false;
  for (const bot of bots) {
    if (bot.deadBot) continue;
    const dx = bot.x - player.x;
    const dz = bot.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > KNIFE.range) continue;
    if ((dx * dirX + dz * dirZ) / (d || 1) < 0.55) continue; // outside the frontal arc
    if (!lineOfSightClear(player.x, player.y + eye, player.z, bot.x, 0.55, bot.z)) continue;
    struck = true;
    spawnImpact(bot.x, 0.6, bot.z, 0xc23b36, 5);
    damageBot(bot, KNIFE.damage, 1);
    if (bot.deadBot) {
      bot.deathStyle = 'launch'; // this death gets the finisher treatment
      killed = true;
    }
  }
  if (killed) {
    // The finisher: a beat of slow motion while the blade twirls.
    flourishT = 0.5;
    slowMoT = 0.45;
    sfxFinisher();
    showHitMarker(true);
  } else if (struck) {
    showHitMarker(false);
  }
}

// ---- Input ----
// e.code is the physical key, so WASD works on any keyboard layout.
// KeyC also crouches because Ctrl+W asks some browsers to close the tab.
const KEYMAP = {
  ArrowUp: 'forward', KeyW: 'forward',
  ArrowDown: 'back', KeyS: 'back',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'jump',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  ControlLeft: 'crouch', ControlRight: 'crouch', KeyC: 'crouch',
};
const keys = new Set();

window.addEventListener('keydown', (e) => {
  if (paused) {
    if (e.code === 'KeyP') saveGame(); // save still works from the pause screen
    if (e.code === 'KeyM' && dead) backToModeSelect(); // even if Esc was pressed after dying
    return;
  }
  if (e.code === 'KeyU') { tryUpgrade(); return; }
  if (e.code === 'KeyP') { saveGame(); return; }
  if (e.code === 'KeyM') { if (dead) backToModeSelect(); return; }
  // e.repeat guard: toggleKnife() rebuilds the gun viewmodel every call, so without this, holding
  // Q down (OS keyboard auto-repeat) tore down and rebuilt it many times a second, leaking a fresh
  // set of geometries/materials on every rebuild.
  if (e.code === 'KeyQ') { if (!e.repeat) toggleKnife(); return; }
  if (e.code === 'KeyR') { // manual reload, if the magazine isn't full
    if (!dead && !isReloading && ammo < WEAPONS[weapon].mag) startReload(performance.now());
    return;
  }
  // Quick-swap hotkeys — direct picks among 3 specific loadout slots, not the U-key ladder
  // climb. trySelectWeapon() silently no-ops on a weapon that isn't unlocked yet.
  if (e.code === 'Digit1') { trySelectWeapon('ak47'); return; }
  if (e.code === 'Digit2') { trySelectWeapon('glock'); return; }
  if (e.code === 'Digit3') { selectFists(); return; }
  const dir = KEYMAP[e.code];
  if (!dir) return;
  e.preventDefault();
  // Both Ctrl and C still crouch (keys.add(dir) below is unconditional either way), but sliding
  // is deliberately C-specific — Ctrl now only ever crouches, never slides.
  // e.repeat, not keys.has('crouch') — Ctrl and C share the same abstract 'crouch' entry in
  // `keys`, so checking that instead would leave a genuinely fresh C tap unable to arm a slide
  // whenever Ctrl was already held (crouch already "active" from Ctrl alone). e.repeat correctly
  // reflects whether *this key* is a fresh press vs. the OS auto-repeating it, independent of
  // whatever else is held.
  if (dir === 'crouch' && !e.repeat && e.code === 'KeyC') wantSlide = true;
  // A fresh jump press (not held/auto-repeat) while already airborne — the fists double-jump
  // below only fires on this, so holding Space doesn't just auto-hop twice on the way down.
  if (dir === 'jump' && !keys.has('jump')) wantJump = true;
  keys.add(dir);
});
window.addEventListener('keyup', (e) => {
  const dir = KEYMAP[e.code];
  if (dir) keys.delete(dir);
});
// keyup never arrives if the tab loses focus mid-press; don't leave the player walking forever.
window.addEventListener('blur', () => keys.clear());

// Mouse look via pointer lock; the "Click to play" overlay grabs the mouse.
const hint = document.getElementById('hint');
hint.addEventListener('click', () => {
  ensureAudio(); // audio can only start on a user gesture — this is the gesture
  canvas.requestPointerLock();
});
// The browser eats Esc while the pointer is locked (Esc *is* how you exit the
// lock), so pause/resume hangs off pointerlockchange instead of a keydown.
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  hint.classList.toggle('hidden', locked);
  if (locked) {
    // Resume: credit the paused time back to the wall-clock timers, so a pause
    // doesn't finish a reload (or a shot cooldown) for free.
    const pausedFor = performance.now() - pausedAt;
    nextShotAt += pausedFor;
    reloadEndAt += pausedFor;
    paused = false;
  } else {
    paused = true;
    pausedAt = performance.now();
    keys.clear();     // Esc mid-press would otherwise leave keys stuck held
    mouseHeld = false;
    document.getElementById('hint-title').textContent = 'Paused — click to resume';
  }
});
// The right button only counts as a scope while a sniper is actually in hand.
function scopedNow() {
  return scoped && !dead && !knifeOut && !!WEAPONS[weapon].scope;
}
const scopeOverlay = document.getElementById('scope-overlay');
let scopeShown = false; // what the overlay currently displays, to avoid per-frame DOM writes

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  const sens = MOUSE_SENS * (scopedNow() ? SCOPE_ZOOM : 1); // finer aim under the scope
  yaw -= e.movementX * sens;
  pitch = Math.max(-1.45, Math.min(1.45, pitch - e.movementY * sens));
});
// Under pointer lock, mouse events land on the canvas and bubble here.
document.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== canvas || dead) return;
  if (onlineActive && !dueling) return; // lobby is free-roam only — no shooting/scoping until a duel starts
  if (e.button === 2) { scoped = true; return; } // hold right-click to scope
  if (e.button !== 0) return;
  mouseHeld = true; // automatics keep firing from the main loop while held
  tryFire(performance.now());
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseHeld = false;
  if (e.button === 2) scoped = false;
});
document.addEventListener('contextmenu', (e) => e.preventDefault()); // right-click is the scope, not a menu
window.addEventListener('blur', () => { mouseHeld = false; scoped = false; });
document.addEventListener('click', () => {
  if (!dead) return;
  // The loadout tiles need a real, visible cursor — pointer lock only ever gives relative
  // movement deltas and hides the OS pointer, same reason backToModeSelect() already releases
  // it for its own buttons.
  if (document.pointerLockElement) document.exitPointerLock();
  // respawn() runs FIRST, before the picker shows — it's the only place `dead` gets cleared
  // back to false, and equipWeapon()/selectFists() (what a tile pick calls) both silently no-op
  // while dead is still true: selectFists() bails outright (fists could never actually be
  // picked post-death), and equipWeapon()'s autosave hits saveGame()'s own "no saving from the
  // grave" guard (a gun pick would work in-memory but never persist). respawn() already hides
  // deathOverlay itself, resets position/health, and clears dead — doing that before the picker
  // opens means every tile pick genuinely happens as a live player, exactly like at any other
  // loadout-picker call site.
  respawn();
  openLoadoutPicker(() => canvas.requestPointerLock());
});

// ---- Collision ----
const HALF_W = PLAYER_WIDTH / 2;
const EDGE = HALF_W - 0.001; // corner sampling stays inside the footprint

// A cell only blocks you if its column actually rises above your feet — mid-jump,
// cells you've cleared stop being walls, which is what lets you land on top of them.
function blockedAt(x, z, feetY) {
  for (const cx of [Math.floor(x - EDGE), Math.floor(x + EDGE)]) {
    for (const cz of [Math.floor(z - EDGE), Math.floor(z + EDGE)]) {
      if ((occupied.get(`${cx},${cz}`) || 0) > feetY + 0.001) return true;
    }
  }
  return false;
}

// The floor under the player: the tallest column any corner of their footprint overlaps.
function groundHeightAt(x, z) {
  let h = 0;
  for (const cx of [Math.floor(x - EDGE), Math.floor(x + EDGE)]) {
    for (const cz of [Math.floor(z - EDGE), Math.floor(z + EDGE)]) {
      h = Math.max(h, occupied.get(`${cx},${cz}`) || 0);
    }
  }
  return h;
}

function clampToMap(v) {
  return Math.max(-HALF_MAP + HALF_W, Math.min(HALF_MAP - HALF_W, v));
}

// ---- Main loop ----
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const JUMP_SPEED = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT); // launch speed that peaks at JUMP_HEIGHT

let last = performance.now();

function tick(now) {
  // Real elapsed time so speeds mean real blocks-per-second at any frame rate;
  // clamped so a hidden tab's frozen rAF doesn't teleport the player on return.
  let dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  // Finisher slow motion: the whole world runs at a third speed for a beat.
  // The timer counts down in real time; everything below runs on the scaled dt.
  if (slowMoT > 0) {
    slowMoT = Math.max(0, slowMoT - dt);
    dt *= 0.35;
  }

  if (paused) {
    // Frozen behind the pause overlay — keep drawing so the arena stays visible.
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
    return;
  }

  let fwd = 0;
  let strafe = 0;
  if (!dead) {
    if (keys.has('forward')) fwd += 1;
    if (keys.has('back')) fwd -= 1;
    if (keys.has('right')) strafe += 1;
    if (keys.has('left')) strafe -= 1;
  }

  // Horizontal velocity: a slide owns it completely; otherwise it's input
  // rotated by where you're looking, scaled by the current stance.
  let vx = 0;
  let vz = 0;
  if (sliding) {
    slideT += dt;
    const k = Math.min(slideT / SLIDE_TIME, 1);
    const sp = SLIDE_SPEED + (CROUCH_SPEED - SLIDE_SPEED) * k;
    vx = slideDirX * sp;
    vz = slideDirZ * sp;
    if (k >= 1) sliding = false; // slide over — Ctrl still held means you stay crouched
  } else if (fwd !== 0 || strafe !== 0) {
    const inv = 1 / Math.hypot(fwd, strafe); // diagonals aren't faster
    const f = fwd * inv;
    const s = strafe * inv;
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const speed = keys.has('crouch') ? CROUCH_SPEED
      : keys.has('sprint') ? SPRINT_SPEED
      : WALK_SPEED;
    vx = (-sinY * f + cosY * s) * speed;
    vz = (-cosY * f - sinY * s) * speed;
  }

  // A slide-jump keeps the slide's speed while airborne; input only bends it.
  if (hasAirMomentum && !onGround) {
    vx = airMomX + vx * 0.25;
    vz = airMomZ + vz * 0.25;
  }

  // A fresh Ctrl tap while sprinting on the ground converts the run into a slide.
  if (wantSlide) {
    wantSlide = false;
    if (!dead && !sliding && onGround && keys.has('sprint') && (vx !== 0 || vz !== 0)) {
      sliding = true;
      slideT = 0;
      const inv = 1 / Math.hypot(vx, vz);
      slideDirX = vx * inv;
      slideDirZ = vz * inv;
    }
  }

  if (!dead) {
    if (vx !== 0 || vz !== 0) {
      const nx = clampToMap(player.x + vx * dt);
      const nz = clampToMap(player.z + vz * dt);
      // One axis at a time, so hitting a block at an angle slides along it.
      if (!blockedAt(nx, player.z, player.y)) player.x = nx;
      if (!blockedAt(player.x, nz, player.y)) player.z = nz;
    }

    // Ground jump: held Space still auto-hops the instant you land, exactly as before — no
    // fresh-press requirement, unrestricted by weapon. The fists double-jump is different on
    // both counts: it needs a genuinely fresh Space press (wantJump) so holding the key doesn't
    // just auto-trigger it the moment jumpsUsed allows another, and it only works with knifeOut.
    const groundJump = keys.has('jump') && onGround;
    const fistsAirJump = wantJump && !onGround && knifeOut && jumpsUsed < 2;
    if (groundJump || fistsAirJump) {
      vy = JUMP_SPEED;
      onGround = false;
      jumpsUsed++;
      if (sliding) {
        // Slide-jump: leave the ground carrying the slide's full speed.
        hasAirMomentum = true;
        airMomX = vx;
        airMomZ = vz;
        sliding = false;
      }
    }
    wantJump = false; // consumed every tick, whether or not it triggered a jump

    vy -= GRAVITY * dt;
    let ny = player.y + vy * dt;
    const support = groundHeightAt(player.x, player.z);
    if (ny <= support && vy <= 0) {
      // Landed — on the ground, or on top of whatever we cleared.
      ny = support;
      vy = 0;
      onGround = true;
      jumpsUsed = 0; // fresh jump budget the moment you touch down
      hasAirMomentum = false; // slide-jump speed doesn't survive touching down
    } else if (ny > support) {
      onGround = false; // walked off an edge (or still rising)
    }
    player.y = ny;
  }

  // ---- Bots: hunt by sight. Blind bots wander; a bot that sees you chases
  // (or circles, up close) and shoots; one that lost you checks your last known
  // spot before giving up. The dead keel over and stay down — waves, not respawns. ----
  for (let bi = bots.length - 1; bi >= 0; bi--) {
    const bot = bots[bi];
    if (bot.deadBot) {
      bot.deathT += dt;
      if (bot.deathStyle === 'launch') {
        // Knife finisher: sent flying in an arc, spinning, gone on landing.
        const t = bot.deathT;
        bot.group.position.y = Math.max(0, 3.2 * t - 3.6 * t * t);
        bot.group.rotation.y += 14 * dt;
        bot.group.rotation.x = -t * 5;
        if (t >= 0.95) {
          if (mode === 'fs') {
            bot.group.visible = false; // waits out the respawn timer, then comes back
            if (bot.deathT >= FS_RESPAWN_TIME) respawnBot(bot);
          } else {
            removeBot(bi);
          }
        }
      } else if (bot.deathT < 0.4) {
        bot.group.rotation.x = -(bot.deathT / 0.4) * (Math.PI / 2); // keel over
      } else if (bot.deathT < 1.2) {
        bot.group.position.y -= dt * 1.2; // sink into the ground
      } else if (mode === 'fs') {
        bot.group.visible = false; // waits out the respawn timer, then comes back
        if (bot.deathT >= FS_RESPAWN_TIME) respawnBot(bot);
      } else {
        removeBot(bi);
      }
      continue;
    }

    if (bot.flashT > 0) {
      bot.flashT -= dt;
      const on = bot.flashT > 0;
      bot.bodyMat.emissive.setHex(on ? 0x991111 : 0x000000);
      bot.limbMat.emissive.setHex(on ? 0x991111 : 0x000000);
      bot.headMat.emissive.setHex(on ? 0x991111 : 0x000000);
    }

    // Pick a target: the nearest of you and your sidekicks this bot can
    // actually see. A bot busy with a sidekick isn't shooting you.
    bot.seesTarget = false;
    let tDist = Infinity;
    if (!dead) {
      const d = Math.hypot(player.x - bot.x, player.z - bot.z);
      if (lineOfSightClear(bot.x, 0.55, bot.z, player.x, player.y + eye * 0.9, player.z)) {
        bot.seesTarget = true;
        tDist = d;
        bot.tgtX = player.x;
        bot.tgtY = player.y + eye * 0.9;
        bot.tgtZ = player.z;
      }
    }
    for (const ally of allies) {
      if (ally.deadAlly) continue;
      const d = Math.hypot(ally.x - bot.x, ally.z - bot.z);
      if (d < tDist && lineOfSightClear(bot.x, 0.55, bot.z, ally.x, 0.55, ally.z)) {
        bot.seesTarget = true;
        tDist = d;
        bot.tgtX = ally.x;
        bot.tgtY = 0.55;
        bot.tgtZ = ally.z;
      }
    }
    bot.eyeMat.emissive.setHex(bot.seesTarget ? 0xff2222 : 0x000000);
    if (bot.seesTarget) {
      bot.huntT = LOSE_SIGHT_TIME;
      bot.lastSeenX = bot.tgtX;
      bot.lastSeenZ = bot.tgtZ;
    } else if (bot.huntT > 0) {
      bot.huntT -= dt;
    }

    // This frame's movement, by priority: finish sidestepping an obstacle,
    // close on (or orbit) a player in sight, check the last known spot, wander.
    let mvx = 0;
    let mvz = 0;
    if (bot.avoidT > 0) {
      bot.avoidT -= dt;
      mvx = Math.cos(bot.dir) * BOT_CHASE_SPEED;
      mvz = Math.sin(bot.dir) * BOT_CHASE_SPEED;
    } else if (bot.seesTarget) {
      const px = bot.tgtX - bot.x;
      const pz = bot.tgtZ - bot.z;
      const pd = Math.hypot(px, pz) || 1;
      if (pd > 4) {
        mvx = px / pd * BOT_CHASE_SPEED;
        mvz = pz / pd * BOT_CHASE_SPEED;
      } else {
        // Close enough — circle the target instead of hugging it.
        mvx = -pz / pd * BOT_SPEED * bot.orbitSign;
        mvz = px / pd * BOT_SPEED * bot.orbitSign;
      }
    } else if (bot.huntT > 0) {
      const hx = bot.lastSeenX - bot.x;
      const hz = bot.lastSeenZ - bot.z;
      const hd = Math.hypot(hx, hz);
      if (hd > 0.5) {
        mvx = hx / hd * BOT_CHASE_SPEED;
        mvz = hz / hd * BOT_CHASE_SPEED;
      } else {
        bot.huntT = 0; // arrived and you're not here — back to wandering
      }
    } else {
      bot.walkT -= dt;
      if (bot.walkT <= 0) {
        bot.dir = Math.random() * Math.PI * 2;
        bot.walkT = 1 + Math.random() * 2;
      }
      mvx = Math.cos(bot.dir) * BOT_SPEED;
      mvz = Math.sin(bot.dir) * BOT_SPEED;
    }

    const bx = clampToMap(bot.x + mvx * dt);
    const bz = clampToMap(bot.z + mvz * dt);
    let moved = false;
    if (!blockedAt(bx, bot.z, 0)) { bot.x = bx; moved = true; }
    if (!blockedAt(bot.x, bz, 0)) { bot.z = bz; moved = true; }
    if (!moved) {
      // Wedged against something: wanderers repick next frame, hunters sidestep.
      bot.walkT = 0;
      if (bot.seesTarget || bot.huntT > 0) {
        bot.dir = Math.atan2(mvz, mvx) + (bot.orbitSign * Math.PI) / 2;
        bot.avoidT = 0.5;
      }
    }

    // A little hop in the step whenever they're on the move sells the walk.
    const botMoving = mvx !== 0 || mvz !== 0;
    const botPhase = now / 110 + bi * 1.7;
    const stepBob = botMoving ? Math.abs(Math.sin(botPhase)) * 0.05 : 0;
    bot.group.position.set(bot.x, stepBob, bot.z);
    animateWalk(bot.legs, bot.arms, botPhase, botMoving);
    // Face what they're doing: their target when one's seen, otherwise the way they walk.
    bot.group.rotation.y = bot.seesTarget
      ? Math.atan2(bot.tgtX - bot.x, bot.tgtZ - bot.z)
      : Math.atan2(mvx, mvz);

    if (!dead) {
      bot.fireT -= dt;
      if (bot.fireT <= 0) {
        if (bot.seesTarget) {
          bot.fireT = bot.fireInterval;
          fireBullet(bot.x, bot.z, bot.tgtX, bot.tgtY, bot.tgtZ, false);
        } else {
          // Can't see anyone — hold fire, but only a beat behind once someone peeks out.
          bot.fireT = 0.3 + Math.random() * 0.4;
        }
      }
    }
  }

  // ---- Sidekicks: hunt the nearest red bot they can see, walk it down, and
  // shoot on their own clock. Nothing left to fight — they fall in beside you
  // and wait for the next wave. The fallen keel over like the reds do. ----
  for (let ai = allies.length - 1; ai >= 0; ai--) {
    const ally = allies[ai];
    if (ally.deadAlly) {
      ally.deathT += dt;
      if (ally.deathT < 0.4) ally.group.rotation.x = -(ally.deathT / 0.4) * (Math.PI / 2);
      else if (ally.deathT < 1.2) ally.group.position.y -= dt * 1.2;
      else removeAlly(ai); // gone until the next wave replaces them
      continue;
    }

    if (ally.flashT > 0) {
      ally.flashT -= dt;
      const on = ally.flashT > 0;
      ally.bodyMat.emissive.setHex(on ? 0x991111 : 0x000000);
      ally.limbMat.emissive.setHex(on ? 0x991111 : 0x000000);
      ally.headMat.emissive.setHex(on ? 0x991111 : 0x000000);
    }

    // Nearest living red bot, favoring the ones actually in sight.
    let target = null;
    let targetDist = Infinity;
    let inSight = false;
    for (const bot of bots) {
      if (bot.deadBot) continue;
      const d = Math.hypot(bot.x - ally.x, bot.z - ally.z);
      const sees = lineOfSightClear(ally.x, 0.55, ally.z, bot.x, 0.55, bot.z);
      if ((sees && !inSight) || (sees === inSight && d < targetDist)) {
        target = bot;
        targetDist = d;
        inSight = sees;
      }
    }
    ally.eyeMat.emissive.setHex(inSight ? 0x22ccff : 0x000000);

    let mvx = 0;
    let mvz = 0;
    if (ally.avoidT > 0) {
      ally.avoidT -= dt;
      mvx = Math.cos(ally.dir) * BOT_CHASE_SPEED;
      mvz = Math.sin(ally.dir) * BOT_CHASE_SPEED;
    } else if (target) {
      const px = target.x - ally.x;
      const pz = target.z - ally.z;
      const pd = targetDist || 1;
      if (!inSight || pd > 5) {
        mvx = px / pd * BOT_CHASE_SPEED;
        mvz = pz / pd * BOT_CHASE_SPEED;
      } else if (pd < 3) {
        // In range — strafe instead of charging into the line of fire.
        mvx = -pz / pd * BOT_SPEED * ally.orbitSign;
        mvz = px / pd * BOT_SPEED * ally.orbitSign;
      }
    } else {
      // Nothing to fight: fall in a couple of blocks off your shoulder.
      const px = player.x - ally.x;
      const pz = player.z - ally.z;
      const pd = Math.hypot(px, pz);
      if (pd > 2.2) {
        mvx = px / pd * BOT_CHASE_SPEED;
        mvz = pz / pd * BOT_CHASE_SPEED;
      }
    }

    const ax = clampToMap(ally.x + mvx * dt);
    const az = clampToMap(ally.z + mvz * dt);
    let moved = false;
    if (!blockedAt(ax, ally.z, 0)) { ally.x = ax; moved = true; }
    if (!blockedAt(ally.x, az, 0)) { ally.z = az; moved = true; }
    if (!moved && (mvx !== 0 || mvz !== 0)) {
      // Wedged against something — sidestep it the way the reds do.
      ally.dir = Math.atan2(mvz, mvx) + (ally.orbitSign * Math.PI) / 2;
      ally.avoidT = 0.5;
    }

    const allyMoving = mvx !== 0 || mvz !== 0;
    const allyPhase = now / 110 + ai * 2.3;
    const allyBob = allyMoving ? Math.abs(Math.sin(allyPhase)) * 0.05 : 0;
    ally.group.position.set(ally.x, allyBob, ally.z);
    animateWalk(ally.legs, ally.arms, allyPhase, allyMoving);
    ally.group.rotation.y = target
      ? Math.atan2(target.x - ally.x, target.z - ally.z)
      : (mvx !== 0 || mvz !== 0) ? Math.atan2(mvx, mvz)
      : Math.atan2(player.x - ally.x, player.z - ally.z); // idle: face you

    ally.fireT -= dt;
    if (ally.fireT <= 0) {
      if (target && inSight) {
        ally.fireT = ALLY_FIRE_INTERVAL;
        fireBullet(ally.x, ally.z, target.x, 0.5, target.z, true);
      } else {
        ally.fireT = 0.2 + Math.random() * 0.3; // quick on the trigger once one appears
      }
    }
  }

  // Between waves (Wave Challenge only): hail the clear, breathe, send the next
  // (bigger) one. FS never runs this — its bots respawn individually instead.
  if (mode === 'wave' && !dead && nextWaveT < 0 && bots.length === 0) {
    showWaveBanner(`Wave ${wave} cleared!`);
    sfxWaveClear();
    nextWaveT = WAVE_BREAK;
  }
  if (mode === 'wave' && !dead && nextWaveT >= 0) {
    nextWaveT -= dt;
    if (nextWaveT <= 0) startWave();
  }

  // Health packs spin, bob, blink near the end, and heal on touch. The shared
  // material's emissive pulses so every pack breathes with a soft green glow.
  packMat.emissiveIntensity = 1 + Math.sin(now / 150) * 0.6;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.life -= dt;
    if (p.life <= 0) { removePickup(i); continue; }
    p.group.rotation.y += 2.5 * dt;
    p.group.position.y = 0.35 + Math.sin(now / 300) * 0.06;
    p.group.visible = p.life > 2 || Math.floor(p.life * 5) % 2 === 0; // blink the last 2s
    if (!dead && health < MAX_HEALTH && player.y < 1
      && Math.hypot(p.x - player.x, p.z - player.z) < 0.7) {
      health = Math.min(MAX_HEALTH, health + PICKUP_HEAL);
      updateHealthBar();
      sfxPickup();
      removePickup(i);
    }
  }

  // ---- Bot bullets: fly straight until they hit a block, a wall, the ground, or you ----
  const playerHeight = eye + 0.15; // crouching and sliding genuinely shrink the target
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.mesh.position.set(b.x, b.y, b.z);

    const outsideMap = Math.abs(b.x) > HALF_MAP || Math.abs(b.z) > HALF_MAP;
    const inColumn = (occupied.get(`${Math.floor(b.x)},${Math.floor(b.z)}`) || 0) > b.y;
    if (b.life <= 0 || b.y < 0.02 || inColumn || (outsideMap && b.y < WALL_HEIGHT)) {
      // A puff of chips where it actually struck something (not a mid-air despawn).
      if (b.life > 0) spawnImpact(b.x, Math.max(0.05, b.y), b.z, 0xa8a8a8, 3);
      removeBullet(i);
      continue;
    }
    if (b.friendly) {
      // Sidekick fire stops on the first red bot it touches — and nothing else.
      for (const bot of bots) {
        if (bot.deadBot) continue;
        if (Math.hypot(b.x - bot.x, b.z - bot.z) < 0.35 && b.y > 0 && b.y < 0.95) {
          spawnImpact(b.x, b.y, b.z, 0xc23b36, 3);
          damageBot(bot, ALLY_DAMAGE, 0); // sidekick kills don't climb your ladder
          removeBullet(i);
          break;
        }
      }
      continue;
    }
    if (!dead
      && Math.hypot(b.x - player.x, b.z - player.z) < HALF_W + 0.1
      && b.y > player.y && b.y < player.y + playerHeight) {
      removeBullet(i);
      takeDamage(BULLET_DAMAGE);
      continue;
    }
    for (const ally of allies) {
      if (ally.deadAlly) continue;
      if (Math.hypot(b.x - ally.x, b.z - ally.z) < HALF_W + 0.1 && b.y > 0 && b.y < 0.95) {
        spawnImpact(b.x, b.y, b.z, 0x4a8fd9, 3);
        damageAlly(ally, BULLET_DAMAGE);
        removeBullet(i);
        break;
      }
    }
  }

  // Impact debris tumbles out, falls, and shrinks away.
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
      continue;
    }
    p.vy -= GRAVITY * 0.6 * dt; // lighter than the player, so debris hangs a beat
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y = Math.max(0.03, p.mesh.position.y + p.vy * dt);
    p.mesh.position.z += p.vz * dt;
    p.mesh.rotation.x += 7 * dt;
    p.mesh.rotation.y += 5 * dt;
    const s = p.life / p.maxLife;
    p.mesh.scale.set(s, s, s);
  }

  // Tracers vanish almost immediately — they're a muzzle-to-impact streak, not a laser.
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    if (tracers[i].life <= 0) {
      scene.remove(tracers[i].line);
      tracers[i].line.geometry.dispose();
      tracers.splice(i, 1);
    }
  }

  // Automatics spray while the button is held. Excluded during a duel — `weapon` still refers to
  // whatever single-player ladder gun was last equipped (unrelated to the online duel, which
  // always uses BB_WEAPON_CLIENT's own fixed semi-auto profile), so this would otherwise spray
  // duel shots too if that ladder weapon happened to be one of the automatics.
  if (mouseHeld && !dueling && WEAPONS[weapon].auto && !dead && document.pointerLockElement === canvas) {
    tryFire(now);
  }

  // Finish a reload the moment its timer is up.
  if (isReloading && now >= reloadEndAt) {
    isReloading = false;
    ammo = WEAPONS[weapon].mag;
    updateAmmoHud();
  }

  // RPG blasts balloon out and fade.
  for (let i = explosions.length - 1; i >= 0; i--) {
    const ex = explosions[i];
    ex.t += dt;
    const s = 1 + ex.t * 9;
    ex.mesh.scale.set(s, s, s);
    ex.glow.intensity = 3 * Math.max(0, 1 - ex.t / 0.35);
    ex.mesh.material.opacity = Math.max(0, 0.9 * (1 - ex.t / 0.35));
    if (ex.t >= 0.35) {
      scene.remove(ex.mesh);
      ex.mesh.material.dispose();
      explosions.splice(i, 1);
    }
  }

  // Viewmodel bob — the gun sways with your footfalls and settles when you
  // stop. The knife runs its own choreography, so it opts out.
  const planarSpeed = Math.hypot(vx, vz);
  if (!dead && onGround && planarSpeed > 0.1) bobPhase += planarSpeed * 1.9 * dt;
  if (!knifeOut) {
    const bobAmp = 0.006 + Math.min(planarSpeed / SPRINT_SPEED, 1) * 0.012;
    gun.position.x = 0.22 + Math.sin(bobPhase) * bobAmp;
    gun.position.y = -0.18 + Math.abs(Math.cos(bobPhase)) * bobAmp * 0.8;
  }

  // Gun recoil eases back; muzzle flash is a couple frames long.
  gunKick *= Math.exp(-12 * dt);
  gun.position.z = GUN_Z + gunKick * 0.07;
  gun.rotation.x = gunKick * 0.18;
  if (muzzleT > 0) {
    muzzleT -= dt;
    gun.userData.flash.intensity = Math.max(0, muzzleT / 0.05) * 2.2;
    if (muzzleT <= 0) gun.userData.muzzle.visible = false;
  }

  // Knife choreography: a diagonal slash on attack, a full twirl on a finisher.
  if (knifeOut) {
    if (flourishT > 0) {
      flourishT = Math.max(0, flourishT - dt);
      const p = 1 - flourishT / 0.5;
      gun.rotation.z = p * Math.PI * 2;
      gun.rotation.x = 0.3 * Math.sin(p * Math.PI);
    } else if (swingT > 0) {
      swingT = Math.max(0, swingT - dt);
      const arc = Math.sin((1 - swingT / 0.25) * Math.PI);
      gun.rotation.x = -arc * 0.9;
      gun.rotation.z = -arc * 0.7;
      gun.position.x = 0.22 - arc * 0.16;
      gun.position.y = -0.18 + arc * 0.05;
    } else {
      gun.rotation.z = 0;
      gun.position.x = 0.22;
      gun.position.y = -0.18;
    }
  }

  // The bar under the weapon name: amber refill during a reload, yellow tick
  // between magazine shots, solid green when ready.
  const spec = knifeOut ? KNIFE : WEAPONS[weapon];
  let readiness = 1;
  let barColor = '#4caf50';
  if (isReloading && !knifeOut) {
    readiness = 1 - Math.max(0, reloadEndAt - now) / (spec.reload * 1000);
    barColor = '#ffb74d';
  } else if (now < nextShotAt && spec.interval > 0) {
    readiness = 1 - (nextShotAt - now) / (spec.interval * 1000);
    barColor = '#ffd54f';
  }
  reloadFill.style.width = `${readiness * 100}%`;
  reloadFill.style.background = barColor;

  // Stance drives eye height; both ease so crouching/standing feels smooth.
  const eyeTarget = sliding ? EYE_SLIDE : keys.has('crouch') ? EYE_CROUCH : EYE_STAND;
  eye += (eyeTarget - eye) * (1 - Math.exp(-14 * dt));
  if (onlineActive) {
    updateRemotePlayers(dt);
    sendBbPos(dt);
  }
  if (onlineActive && !dueling) {
    // Third-person lobby camera: orbits around a pivot near the avatar's head, same distance in
    // every direction, so mouse-look (yaw AND pitch — the same input that drives first-person
    // aiming everywhere else in this file) swings the camera up/down/around exactly like an
    // over-the-shoulder third-person rig rather than only spinning flatly around the player.
    const camDist = 4.2;
    const camPitch = Math.max(-0.9, Math.min(0.9, pitch)); // clamped so it can't dip under the floor or flip overhead
    const fx = -Math.sin(yaw) * Math.cos(camPitch);
    const fy = Math.sin(camPitch);
    const fz = -Math.cos(yaw) * Math.cos(camPitch);
    const pivotY = player.y + 0.9;
    camera.position.set(player.x - fx * camDist, pivotY - fy * camDist + 0.6, player.z - fz * camDist);
    camera.lookAt(player.x, pivotY, player.z);
    updateLocalAvatar(vx, vz, dt);
  } else {
    camera.position.set(player.x, player.y + eye, player.z);
    camera.rotation.x = pitch;
    camera.rotation.y = yaw;
  }

  // A touch of extra FOV while sprinting/sliding/slide-jumping sells the speed.
  // A scoped sniper zooms the whole view 40% in (FOV 70 → 42) and takes over
  // from the sprint/slide FOV boost while it's held.
  const zoomed = scopedNow();
  const fovTarget = zoomed ? 70 * SCOPE_ZOOM
    : (sliding || hasAirMomentum || (keys.has('sprint') && (fwd !== 0 || strafe !== 0))) ? 78 : 70;
  if (Math.abs(camera.fov - fovTarget) > 0.05) {
    camera.fov += (fovTarget - camera.fov) * (1 - Math.exp(-8 * dt));
    camera.updateProjectionMatrix();
  }
  // Behind the scope: the ring overlay swaps in for the gun viewmodel.
  if (zoomed !== scopeShown) {
    scopeShown = zoomed;
    scopeOverlay.classList.toggle('hidden', !zoomed);
  }
  gun.visible = !zoomed && (!onlineActive || dueling);

  for (const cloud of clouds) {
    cloud.position.x += 0.4 * dt;
    if (cloud.position.x > 60) cloud.position.x = -60;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

loadSavedGame(); // continue where the last save left off, if there is one
updateWeaponHud();
updateAmmoHud();
updateWaveHud();
requestAnimationFrame(tick);
