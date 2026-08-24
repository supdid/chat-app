'use strict';

// Same detection firefight.js already uses for its own touch controls — the game otherwise relies
// entirely on pointer lock for mouse-look, which real touchscreens don't reliably grant at all, so
// without this the "Click to play" screen simply never unpauses on a phone.
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
let touchMoveF = 0; // analog -1..1, driven by the on-screen joystick — see the touch-controls block below
let touchMoveR = 0;

// Opened straight from a chat room's game menu (index.html's updateGameLinks, same as every
// other minigame), this carries ?room=&name= along — if present, Online Play joins THAT room's
// own Block Battle lobby instead of the public one, so friends who click in from the same chat
// room land together automatically, and back-link mirrors it right back so "Back to chat" returns
// to that same room (identical pattern to firefight.js's own roomCode/back-link handling).
const urlParams = new URLSearchParams(location.search);
const bbRoomCode = urlParams.get('room');
const bbPlayerName = urlParams.get('name');
if (bbRoomCode) {
  document.getElementById('back-link').href = `index.html?room=${encodeURIComponent(bbRoomCode)}&name=${encodeURIComponent(bbPlayerName || '')}`;
}

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

// ---- Weapon Shop: 100 purchasable weapons, browsable via the lobby's "View Weapons" button and
// bought with coins earned by clearing waves/matches (see the coin-award call sites below). A
// separate track from the 8-weapon kill-unlock ladder above — deliberately merged into the SAME
// WEAPONS lookup table (never into WEAPON_ORDER, so they can't show up in the ladder itself) so
// every bit of existing fire/reload/ammo/scope/explosive logic that already reads WEAPONS[weapon]
// works unmodified for a purchased weapon too. 10 archetypes x 10 tiers each: stats and price both
// scale up per tier within an archetype, so this reads as 10 real, coherent weapon families with
// genuine progression, not 100 interchangeable reskins.
const SHOP_ARCHETYPES = [
  { key: 'pistol', label: 'Pistols', icon: '🔫', basePrice: 40,
    base: { damage: 8, interval: 0.28, mag: 8, reload: 1.1, headshot: 20 },
    names: ['Peacemaker', 'Snub 38', 'Viper P9', 'Talon Auto', 'Nightfall 45', 'Widowmaker', 'Apex Custom', 'Oblivion Mk1', 'Zenith Prime', 'Eclipse Omega'] },
  { key: 'revolver', label: 'Revolvers', icon: '🔫', basePrice: 70,
    base: { damage: 22, interval: 0.55, mag: 6, reload: 1.7, headshot: 45 },
    names: ['Rustbelt Six', 'Copperhead', 'Judge 44', 'Longhorn', 'Coyote Special', 'Deadbolt', 'Iron Vulture', 'Graveyard King', 'Last Rites', 'Meridian 500'] },
  { key: 'smg', label: 'SMGs', icon: '🔫', basePrice: 60,
    base: { damage: 6, interval: 0.09, mag: 25, reload: 1.5, headshot: 12, auto: true },
    names: ['Wasp-9', 'Riptide', 'Scrapper', 'Buzzcut', 'Nailgun X', 'Static Storm', 'Hornet Mk2', 'Vortex SMG', 'Chainlight', 'Ravager Prime'] },
  { key: 'ar', label: 'Assault Rifles', icon: '🔫', basePrice: 90,
    base: { damage: 9, interval: 0.13, mag: 30, reload: 2.0, headshot: 18, auto: true },
    names: ['Ironclad', 'Redline', 'Sentinel-7', 'Warhawk', 'Brimstone', 'Falcon Guard', 'Vanguard X', 'Thunderclap', 'Titan Edge', 'Apocrypha'] },
  { key: 'shotgun', label: 'Shotguns', icon: '🔫', basePrice: 100,
    base: { damage: 32, interval: 0.65, mag: 6, reload: 2.2, headshot: 40 },
    names: ['Widow Kiss', 'Bonecrusher', 'Doomsayer', 'Scattergun Mk1', 'Blast Reaper', 'Hellmouth', 'Fracture', 'Judgement Day', 'Cataclysm', 'Armageddon-12'] },
  { key: 'lmg', label: 'LMGs', icon: '🔫', basePrice: 130,
    base: { damage: 8, interval: 0.1, mag: 60, reload: 3.3, headshot: 16, auto: true },
    names: ['Grindstone', 'Ironhail', 'Tempest-60', 'Juggernaut', 'Devastator', 'Meatgrinder', 'Stormbringer', 'Behemoth', 'World Ender', 'Omega Storm'] },
  { key: 'sniper', label: 'Sniper Rifles', icon: '🎯', basePrice: 160,
    base: { damage: 42, interval: 1.0, mag: 5, reload: 2.4, headshot: 90, scope: true },
    names: ['Longshot', 'Deadeye', 'Nightstalker', 'Silent Reaper', 'Vantage Point', 'Horizon', 'Perfect Silence', 'Last Word', 'Oblivion Reach', 'Eternity'] },
  { key: 'dmr', label: 'Marksman Rifles', icon: '🎯', basePrice: 140,
    base: { damage: 20, interval: 0.38, mag: 10, reload: 1.9, headshot: 45, scope: true },
    names: ['Crossfire', 'Steady Hand', 'Farsight', 'Pinpoint', 'True North', 'Clear Skies', 'Precision X', 'Keen Eye', 'Sharp Edge', 'Dead Center'] },
  { key: 'launcher', label: 'Launchers', icon: '🚀', basePrice: 220,
    base: { damage: 55, interval: 1.5, mag: 1, reload: 2.8, headshot: 55, explosive: true, headshotDoubleKill: true },
    names: ['Fat Boy', 'Hellstorm', 'Wrecking Ball', 'Meteor Strike', 'Skyfall', 'Cataclysm-9', 'Big Bertha', 'Ragnarok', 'Doomsday Device', 'World End'] },
  { key: 'energy', label: 'Energy Weapons', icon: '⚡', basePrice: 180,
    base: { damage: 11, interval: 0.09, mag: 40, reload: 2.0, headshot: 22, auto: true },
    names: ['Photon Lance', 'Plasma Whisper', 'Ion Storm', 'Volt Reaper', 'Quantum Spike', 'Neutron Flare', 'Static Fang', 'Solar Flare', 'Voidbreaker', 'Singularity'] },
];
// Tier scaling applied within each archetype (tier 1 = base stats as written above): damage/mag/
// price climb, interval/reload shrink (faster fire, faster reload) — every tier is a genuine,
// meaningful upgrade over the last, not just a name change.
const SHOP_TIER_SCALE = { damage: 1.09, interval: 0.965, mag: 1.08, reload: 0.975, headshot: 1.07, price: 1.45 };
const SHOP_WEAPONS = [];
for (const arch of SHOP_ARCHETYPES) {
  for (let tier = 1; tier <= 10; tier++) {
    const n = tier - 1;
    const id = `shop_${arch.key}_${tier}`;
    const w = {
      id,
      title: arch.names[n],
      icon: arch.icon,
      archKey: arch.key,
      archetype: arch.label,
      tier,
      price: Math.round(arch.basePrice * Math.pow(SHOP_TIER_SCALE.price, n)),
      mag: Math.max(1, Math.round(arch.base.mag * Math.pow(SHOP_TIER_SCALE.mag, n))),
      interval: +(arch.base.interval * Math.pow(SHOP_TIER_SCALE.interval, n)).toFixed(3),
      reload: +(arch.base.reload * Math.pow(SHOP_TIER_SCALE.reload, n)).toFixed(2),
      damage: Math.round(arch.base.damage * Math.pow(SHOP_TIER_SCALE.damage, n)),
      headshot: Math.round(arch.base.headshot * Math.pow(SHOP_TIER_SCALE.headshot, n)),
    };
    if (arch.base.auto) w.auto = true;
    if (arch.base.scope) w.scope = true;
    if (arch.base.explosive) w.explosive = true;
    if (arch.base.headshotDoubleKill) w.headshotDoubleKill = true;
    SHOP_WEAPONS.push(w);
    WEAPONS[id] = w; // merge into the shared lookup — see the comment block above for why
  }
}

// Weapons marked `scope: true` (the snipers) zoom while right-click is held:
// FOV shrinks to 60% — a 40% zoom in — and mouse sensitivity scales down with
// it so the magnified view doesn't turn every nudge into a flick.
const SCOPE_ZOOM = 0.6;

const canvas = document.getElementById('map');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Filmic tone mapping: without it, every material's raw lit color goes straight to the screen,
// so anything bright (the sun sprite, a muzzle flash, sunlit walls) just hard-clips to flat white
// instead of rolling off — the classic "flat, video-gamey" look. ACES gives the same soft
// highlight rolloff a camera/film would, which reads as more realistic across the board with zero
// changes to any individual material or light. Deliberately NOT touching renderer.outputEncoding
// alongside it — that half of Three.js r128's (pre-color-management-overhaul) legacy pipeline only
// looks right if every texture's own .encoding is ALSO set to match, which nothing in this file
// currently does; flipping outputEncoding alone would wash the whole scene out too bright instead
// of fixing anything, and that's not something to guess at while unable to actually look at it.
renderer.toneMapping = THREE.ACESFilmicToneMapping;

// requestPointerLock() returns a Promise in modern browsers that rejects (harmlessly) if called
// too soon after a previous exit — browsers impose a short cooldown to stop a page from
// re-trapping the cursor instantly. Left unhandled, that rejection surfaces as a reported client
// error — this exact fix already exists in fighterplane.js, where it was applied after a real
// player hit it; every other minigame using pointer lock had the same latent gap (this file has
// several call sites: the initial "Click to play", the death/respawn loadout picker, and the
// mid-round level-up loadout picker all grab the lock again in quick succession).
function requestPointerLockSafe() {
  // Touch has no pointer to lock at all (and real touchscreens don't reliably grant the API
  // regardless) — every call site here just wants "make sure the game is actually running", which
  // for touch means directly unpausing instead. Mirrors the hint's own touch branch above: hide
  // the hint if it's still showing, and credit paused time back to the shot/reload timers exactly
  // like a real pointerlockchange resume would.
  if (isTouchDevice) {
    if (!hint.classList.contains('hidden')) hint.classList.add('hidden');
    if (paused) {
      const pausedFor = performance.now() - pausedAt;
      nextShotAt += pausedFor;
      reloadEndAt += pausedFor;
      paused = false;
    }
    return;
  }
  const result = canvas.requestPointerLock();
  if (result && result.catch) result.catch(() => {});
}

// Sky: a gradient dome (deep blue overhead melting to a pale horizon) instead
// of a flat clear color. Fog is dyed the horizon color so the oversized ground
// plane fades into the same shade the dome ends in — no visible seam.
const SKY_HORIZON = '#dceef7';
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_HORIZON);
scene.fog = new THREE.Fog(SKY_HORIZON, 30, 110);

// Every outdoor-arena mesh built below (sky dome through the random cover structures) is parented
// under this one group instead of directly under `scene`, so the online lobby can swap the whole
// look to an office (see buildOffice() and officeGroup further down) by toggling one `.visible`
// flag each way rather than hiding dozens of individual meshes. The group carries no transform of
// its own, so every child's world position/raycasting is identical to being added to `scene`
// directly — purely an on/off switch, not a coordinate change.
const arenaGroup = new THREE.Group();
scene.add(arenaGroup);
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
  arenaGroup.add(dome);
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
// normalBias (distinct from the plain bias above) pushes the shadow sample along each surface's
// own normal rather than straight down the light ray — bias alone already stops most shadow acne
// on flat ground, but every box in this game has edges/corners facing the sun at a shallow angle
// (cover crates, cubicle desks, garage pillars), and those are exactly where plain bias alone
// tends to leave "peter-panning" (the shadow visibly detached from its own object's base).
sun.shadow.normalBias = 0.02;
// A second, much dimmer light from roughly the opposite side of the sun, no shadow of its own —
// real outdoor light always has SOME bounce/sky fill hitting a surface's shadow side, so a face
// fully turned away from the sun currently goes essentially flat black once the hemisphere light's
// ground-color contribution runs out; this softens that without touching the sun/hemisphere
// numbers everything else was already tuned against.
const fillLight = new THREE.DirectionalLight(0xcfe0f2, 0.18);
fillLight.position.set(-14, 16, -10);
scene.add(fillLight);
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
  arenaGroup.add(sunSprite);
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
arenaGroup.add(ground);
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
arenaGroup.add(roadPlane);

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
  arenaGroup.add(wall);
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
    arenaGroup.add(cloud);
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
    arenaGroup.add(hill);
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
    arenaGroup.add(cube);
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

// The arena's own collision layout, snapshotted right after the structures above finish — the
// online lobby's office (below) swaps `occupied`'s live contents out for its own layout while
// active, and this is what leaveOnlineLobby()/backToModeSelect() restore it from afterward.
const arenaOccupied = new Map(occupied);

// ---- Online lobby office ----
// Online Play swaps the whole outdoor crossroad arena for an indoor open-plan office (this is
// purely a look-and-collision swap between two pre-built, always-in-the-scene groups — see
// arenaGroup above — toggled by startOnlinePlay()/leaveOnlineLobby(), same pattern used for the
// camera/gun/HUD switches those functions already make). Duels happen in this same space too
// (no separate teleport-to-an-arena step exists), so the cubicle rows double as real cover.
// Tall enough that the third-person lobby camera's own steepest look-up/look-down angle (see
// tick()'s onlineActive camera branch: pivotY ± sin(camPitch)*camDist, worst case ~4.8) never
// pokes the camera through the ceiling plane.
const CEILING_HEIGHT = 5.5;
const officeGroup = new THREE.Group();
officeGroup.visible = false;
scene.add(officeGroup);
const officeOccupied = new Map(); // swapped into the live `occupied` Map exactly like arenaOccupied
// A separate, always-off-until-toggled light rather than retuning the shared sun/hemisphere
// (which the outdoor arena also depends on) — flipping one intensity between 0 and a warm value
// is enough to read as "fluorescent office lighting" without touching outdoor-mode lighting at all.
const officeAmbient = new THREE.AmbientLight(0xfff6e0, 0);
scene.add(officeAmbient);

// base/grid are optional so buildOffice()'s own no-arg calls below produce byte-for-byte the same
// texture they always have — the online-lobby map system (further down) reuses these two
// generators for its own office-family variants (office_night/office_alert) by passing a tint.
function officeFloorTexture(base, grid) {
  const px = 128;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = base || '#6b7178';
  g.fillRect(0, 0, px, px);
  for (let n = 0; n < 2000; n++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * px, Math.random() * px, 1, 1);
  }
  g.strokeStyle = grid || 'rgba(0,0,0,0.08)';
  for (let x = 0; x <= px; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, px); g.stroke(); }
  for (let y = 0; y <= px; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(px, y); g.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(MAP_BLOCKS / 2, MAP_BLOCKS / 2);
  return tex;
}

function officeCeilingTexture(base, panel) {
  const px = 128;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = base || '#aeada6';
  g.fillRect(0, 0, px, px);
  g.strokeStyle = 'rgba(120,120,110,0.5)';
  g.lineWidth = 2;
  for (let x = 0; x <= px; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, px); g.stroke(); }
  for (let y = 0; y <= px; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(px, y); g.stroke(); }
  g.fillStyle = panel || '#e8e2cf'; // recessed light panel in the middle of every other ceiling tile — still the brightest thing up there, just not full white
  for (let y = 8; y < px; y += 64) {
    for (let x = 8; x < px; x += 64) g.fillRect(x, y, 16, 16);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(MAP_BLOCKS / 2, MAP_BLOCKS / 2);
  return tex;
}

// Adds a box to officeGroup at a raw world position (unlike placeColumn's grid-cell convention —
// office furniture is shaped and placed by hand, not stacked unit cubes).
function officeBox(w, h, d, x, y, z, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  officeGroup.add(mesh);
  solids.push(mesh);
  return mesh;
}

function buildOffice() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_BLOCKS + 2, MAP_BLOCKS + 2),
    new THREE.MeshLambertMaterial({ map: officeFloorTexture() })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  officeGroup.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_BLOCKS + 2, MAP_BLOCKS + 2),
    new THREE.MeshLambertMaterial({ map: officeCeilingTexture() })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CEILING_HEIGHT;
  officeGroup.add(ceiling);

  // Same 4 perimeter positions/sizes as the arena's own walls (so the shared clampToMap() bound
  // still lines up with what the player can actually see) — just a lighter interior-drywall tone
  // and shorter, floor-to-ceiling instead of the arena's taller outdoor facade height.
  const wallMat = new THREE.MeshLambertMaterial({ map: speckleTexture(178, 174, 162, 6, 32) });
  [
    [0, -(HALF_MAP + 0.5), MAP_BLOCKS + 2, 1],
    [0, HALF_MAP + 0.5, MAP_BLOCKS + 2, 1],
    [-(HALF_MAP + 0.5), 0, 1, MAP_BLOCKS + 2],
    [HALF_MAP + 0.5, 0, 1, MAP_BLOCKS + 2],
  ].forEach(([cx, cz, sx, sz]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, CEILING_HEIGHT, sz), wallMat);
    wall.position.set(cx, CEILING_HEIGHT / 2, cz);
    wall.receiveShadow = true;
    officeGroup.add(wall);
    solids.push(wall);
  });

  // Cubicles: desk + monitor + partition + chair, one full unit cell each (same footprint
  // convention as placeColumn's cover blocks), in two facing rows either side of a clear center
  // aisle running straight through the spawn point.
  const deskMat = new THREE.MeshLambertMaterial({ color: 0xc9a06a });
  const partitionMat = new THREE.MeshLambertMaterial({ color: 0x6d8a99 });
  const monitorMat = new THREE.MeshLambertMaterial({ color: 0x1c1e22 });
  const chairMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  function cubicle(i, j, facingSouth) {
    const cx = i + 0.5, cz = j + 0.5;
    const sign = facingSouth ? -1 : 1; // which edge of the cell the partition sits against
    officeBox(0.9, 1.3, 0.08, cx, 0.65, cz + sign * 0.3, partitionMat);
    officeBox(0.8, 0.5, 0.5, cx, 0.25, cz + sign * 0.02, deskMat);
    officeBox(0.35, 0.2, 0.04, cx, 0.55, cz + sign * 0.15, monitorMat);
    officeBox(0.4, 0.4, 0.4, cx, 0.2, cz - sign * 0.3, chairMat);
    // 1.3 blocks movement (JUMP_HEIGHT is 1.15 — unjumpable, a real obstacle to walk around) while
    // still letting bullets/tracers read it as cover, same collision convention as a tower column.
    officeOccupied.set(`${i},${j}`, 1.3);
  }
  [-9, -6, -3, 3, 6, 9].forEach((i) => { cubicle(i, -6, true); cubicle(i, 6, false); });

  // Potted plants in the corners — decorative only, deliberately not registered in
  // officeOccupied (same "decoration, not an obstacle" precedent as the arena's clouds/hills).
  const potMat = new THREE.MeshLambertMaterial({ color: 0x8a5a3c });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7d4a });
  [[-10, -10], [10, -10], [-10, 10], [10, 10]].forEach(([x, z]) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.4, 8), potMat);
    pot.position.set(x, 0.2, z);
    pot.castShadow = true;
    officeGroup.add(pot);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), leafMat);
    leaves.position.set(x, 0.75, z);
    leaves.scale.y = 1.4;
    leaves.castShadow = true;
    officeGroup.add(leaves);
  });

  // A small break table near the back wall, clear of both cubicle rows.
  const tableMat = new THREE.MeshLambertMaterial({ color: 0xdad2c4 });
  officeBox(1.6, 0.5, 1, 0, 0.25, 9.5, tableMat);
  [[-0.9, 9], [0.9, 9], [-0.9, 10], [0.9, 10]].forEach(([x, z]) => officeBox(0.35, 0.4, 0.35, x, 0.2, z, chairMat));
}
buildOffice();

// ---- Hidden collectibles: Jump Shards ----
// 9 findable shards — 5 around the always-on outdoor arena (reachable in Wave/FS), 4 around the
// online lobby's office (reachable free-roaming before/after a duel). Purely client-side and
// cosmetic, same "no account needed" localStorage pattern as coins/purchases above — collection
// doesn't need the server involved at all.
const SHARD_KEY = 'valk-bb-shards';
const SHARD_REWARD_KEY = 'valk-bb-shards-reward-claimed';
const SHARD_REWARD_COINS = 1500;
function loadShards() {
  try { return new Set(JSON.parse(localStorage.getItem(SHARD_KEY)) || []); } catch { return new Set(); }
}
function saveShards(set) {
  try { localStorage.setItem(SHARD_KEY, JSON.stringify([...set])); } catch {}
}
let collectedShards = loadShards();
const shardCountEl = document.getElementById('shard-count');
function updateShardHud() {
  if (shardCountEl) shardCountEl.textContent = collectedShards.size;
}
updateShardHud();

// Arena spots sit just inside the perimeter walls (HALF_MAP - 0.6), outside STRUCTURE_RANGE (10)
// so the randomized cover towers almost never spawn on top of one. Office spots reuse buildOffice's
// own landmarks (the 4 corner planters, the break table) as easy-to-describe reference points.
const SHARD_DEFS = [
  { id: 'arena-1', area: 'arena', x: HALF_MAP - 0.6, y: 1.2, z: HALF_MAP - 0.6 },
  { id: 'arena-2', area: 'arena', x: -(HALF_MAP - 0.6), y: 1.2, z: HALF_MAP - 0.6 },
  { id: 'arena-3', area: 'arena', x: HALF_MAP - 0.6, y: 1.2, z: -(HALF_MAP - 0.6) },
  { id: 'arena-4', area: 'arena', x: -(HALF_MAP - 0.6), y: 1.2, z: -(HALF_MAP - 0.6) },
  { id: 'arena-5', area: 'arena', x: 0, y: 2.2, z: HALF_MAP - 0.6 },
  { id: 'office-1', area: 'office', x: -10, y: 1.7, z: -10 },
  { id: 'office-2', area: 'office', x: 10, y: 1.7, z: -10 },
  { id: 'office-3', area: 'office', x: -10, y: 1.7, z: 10 },
  { id: 'office-4', area: 'office', x: 0, y: 0.9, z: 9.5 },
];
const shardGeo = new THREE.IcosahedronGeometry(0.22, 0);
const shardMat = new THREE.MeshLambertMaterial({ color: 0x6fe0ff, emissive: 0x1a6a80 });
const activeShards = []; // { def, mesh } — only the not-yet-collected ones actually get built
for (const def of SHARD_DEFS) {
  if (collectedShards.has(def.id)) continue;
  const mesh = new THREE.Mesh(shardGeo, shardMat.clone());
  mesh.position.set(def.x, def.y, def.z);
  (def.area === 'arena' ? arenaGroup : officeGroup).add(mesh);
  activeShards.push({ def, mesh });
}

// Awards the collect-all-9 bonus exactly once, whichever shard happens to complete the set.
function checkShardReward() {
  if (collectedShards.size < SHARD_DEFS.length) return;
  try { if (localStorage.getItem(SHARD_REWARD_KEY)) return; } catch { return; }
  try { localStorage.setItem(SHARD_REWARD_KEY, '1'); } catch { return; }
  awardCoins(SHARD_REWARD_COINS);
  showWaveBanner(`💎 All 9 Jump Shards found! +${SHARD_REWARD_COINS} 🪙`);
}

function collectShard(entry) {
  const idx = activeShards.indexOf(entry);
  if (idx === -1) return;
  activeShards.splice(idx, 1);
  entry.mesh.parent.remove(entry.mesh);
  entry.mesh.material.dispose();
  collectedShards.add(entry.def.id);
  saveShards(collectedShards);
  updateShardHud();
  sfxPickup();
  showWaveBanner(`💎 Jump Shard ${collectedShards.size}/${SHARD_DEFS.length}`);
  checkShardReward();
}

// Proximity check, called every unpaused frame from tick() below — mirrors the health-pickup
// radius check, just gated by area: arena shards only matter in Wave/FS (the only modes that use
// the outdoor arena), office ones only while free-roaming the online lobby (not mid-duel, same as
// the plate-detection gating already used for bb-plate-enter/leave).
function updateShardPickups() {
  if (!activeShards.length || dead) return;
  const inArena = mode === 'wave' || mode === 'fs';
  const inOffice = onlineActive && !dueling;
  if (!inArena && !inOffice) return;
  // `player.y` is feet height (jump apex only reaches ~JUMP_HEIGHT, 1.15) — the shards float at
  // head height or above, so the vertical check uses the player's current eye/camera height
  // instead, same reference tick() already tracks for camera placement. Standing under one is
  // enough; jumping helps reach the higher ones, but isn't required to be frame-perfect about it.
  const py = player.y + eye;
  for (let i = activeShards.length - 1; i >= 0; i--) {
    const entry = activeShards[i];
    const activeHere = entry.def.area === 'arena' ? inArena : inOffice;
    if (!activeHere) continue;
    if (Math.hypot(player.x - entry.def.x, py - entry.def.y, player.z - entry.def.z) < 0.7) collectShard(entry);
  }
}

// ---- Block Battle NvN match stations ----
// Mirrors server.js's BB_STATIONS exactly — four match pads along the office's open center aisle,
// each aligned with one of buildOffice()'s own cubicle columns so it visually reads as "belonging"
// to that desk. Plates sit in the open aisle itself (z near 0), not on the cubicle's own solid
// furniture — nothing could stand on top of a 1.3-tall cubicle anyway (JUMP_HEIGHT is 1.15).
const BB_STATIONS = [
  { id: 'st1', n: 1, x: -9 },
  { id: 'st2', n: 2, x: -3 },
  { id: 'st3', n: 3, x: 3 },
  { id: 'st4', n: 4, x: 9 },
];
const BB_PLATE_GAP = 0.9;      // spacing between adjacent plates on the same side
const BB_PLATE_RADIUS = 0.4;   // how close the player must stand to count as "on" a plate (< half BB_PLATE_GAP so neighboring plates' zones never overlap)
const BB_PLATE_ROW_Z = 1.15;   // each side's row sits this far off the station's own center line

function bbPlatePositions(station, side) {
  const rowZ = side === 'a' ? -BB_PLATE_ROW_Z : BB_PLATE_ROW_Z;
  const start = -(station.n - 1) / 2;
  const positions = [];
  for (let i = 0; i < station.n; i++) positions.push({ x: station.x + (start + i) * BB_PLATE_GAP, z: rowZ });
  return positions;
}

function bbSignSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(20,24,30,0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd54f';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(2.1, 0.8, 1);
  return sprite;
}

const BB_PLATE_COLOR = {
  a: { empty: 0x2d4a66, filled: 0x3d7dff, self: 0x7fb8ff },
  b: { empty: 0x66302d, filled: 0xff4d4d, self: 0xff9a8a },
  locked: 0x33363c,
};

// stationId -> { plates: { a: [mesh,...], b: [mesh,...] } } — the sign itself never changes, only
// the plate colors/opacity do, driven by bb-station-update broadcasts. `let`, not `const`: with
// multiple online-lobby maps (see BB_MAPS further down), this gets reassigned to whichever map's
// own plate meshes are currently live — only one map is ever visible at a time, so only one set of
// these actually needs to exist.
let bbStationMeshes = new Map();
// Flat { stationId, side, slot, x, z }[] over every plate on every station, built once here and
// reused by updateBbPlateDetection() every frame — plate positions are identical on every map (see
// BB_MAP_KITS: only the cosmetic shell around them differs), so unlike bbStationMeshes this never
// needs rebuilding when the active map changes.
const bbFlatPlates = [];
for (const station of BB_STATIONS) {
  for (const side of ['a', 'b']) {
    bbPlatePositions(station, side).forEach((pos, slot) => {
      bbFlatPlates.push({ stationId: station.id, side, slot, x: pos.x, z: pos.z });
    });
  }
}

// Adds this map's own plate/sign meshes into `group` and returns the stationId -> {plates} map for
// bbStationMeshes. Called once per map activation (see activateMap) rather than once ever, since
// each online-lobby map needs its own copy of these visible meshes.
function buildBbStations(group) {
  const meshes = new Map();
  for (const station of BB_STATIONS) {
    const sign = bbSignSprite(`${station.n}V${station.n}`);
    sign.position.set(station.x, 2.4, 0);
    group.add(sign);
    const plates = { a: [], b: [] };
    for (const side of ['a', 'b']) {
      bbPlatePositions(station, side).forEach((pos) => {
        const mat = new THREE.MeshBasicMaterial({ color: BB_PLATE_COLOR[side].empty, transparent: true, opacity: 0.6 });
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 16), mat);
        mesh.position.set(pos.x, 0.03, pos.z);
        group.add(mesh);
        plates[side].push(mesh);
      });
    }
    meshes.set(station.id, { plates });
  }
  return meshes;
}
bbStationMeshes = buildBbStations(officeGroup);
// Cached so re-selecting the 'office' map later (see activateMap) can just restore this reference
// instead of re-building duplicate plate/sign meshes into the never-disposed officeGroup.
const officeStationMeshes = bbStationMeshes;

// ---- Online lobby maps ----
// 6 structural "kits" (genuinely distinct wall/floor/prop layouts) x color/prop-variant configs =
// 20 named maps, all sharing the exact same match-station plate positions/mechanics (BB_STATIONS,
// bbFlatPlates above) — only the cosmetic shell around them differs per map, same "same underlying
// mechanics, different look" tradeoff already used for the 100 shop weapons (10 archetypes x 10
// tiers, not 100 bespoke guns). The server (see BB_MAP_IDS in server.js — keep both lists in sync)
// only ever needs to know these ids exist, never what they look like; all rendering is client-only.
//
// A deterministic PRNG (not Math.random) for any per-map prop scattering, so every client renders
// the identical layout for a given map id — purely cosmetic (no server-side collision exists for
// Block Battle online, see bb-pos's plain clamp-and-relay), but two people standing in "the same"
// room seeing different crate placements would look broken.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function genericCeilingTexture(base, panel) {
  const px = 128;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, px, px);
  g.strokeStyle = 'rgba(0,0,0,0.15)';
  g.lineWidth = 2;
  for (let x = 0; x <= px; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, px); g.stroke(); }
  for (let y = 0; y <= px; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(px, y); g.stroke(); }
  g.fillStyle = panel;
  for (let y = 8; y < px; y += 64) for (let x = 8; x < px; x += 64) g.fillRect(x, y, 16, 16);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(MAP_BLOCKS / 2, MAP_BLOCKS / 2);
  return tex;
}

function baseFloorCanvas(base, grid) {
  const px = 128;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, px, px);
  for (let n = 0; n < 1500; n++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * px, Math.random() * px, 1, 1);
  }
  if (grid) {
    g.strokeStyle = grid;
    for (let x = 0; x <= px; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, px); g.stroke(); }
    for (let y = 0; y <= px; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(px, y); g.stroke(); }
  }
  return { c, g, px };
}
function finishFloorTexture(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(MAP_BLOCKS / 2, MAP_BLOCKS / 2);
  return tex;
}
function warehouseFloorTexture(base) {
  const { c, g, px } = baseFloorCanvas(base, 'rgba(0,0,0,0.12)');
  g.strokeStyle = '#e0b23c'; g.lineWidth = 3;
  g.strokeRect(6, 6, px - 12, px - 12); // hazard-stripe border
  return finishFloorTexture(c);
}
function rooftopFloorTexture(base) {
  const { c, g, px } = baseFloorCanvas(base, null);
  g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 3;
  g.beginPath(); g.arc(px / 2, px / 2, px * 0.3, 0, Math.PI * 2); g.stroke();
  g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillText('H', px / 2, px / 2);
  return finishFloorTexture(c);
}
function garageFloorTexture(base) {
  const { c, g, px } = baseFloorCanvas(base, null);
  g.strokeStyle = '#e8d24a'; g.lineWidth = 3;
  for (let x = 16; x < px; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, px); g.stroke(); }
  return finishFloorTexture(c);
}
function plazaFloorTexture(base) {
  const { c, g, px } = baseFloorCanvas(base, null);
  g.fillStyle = 'rgba(150,150,150,0.35)';
  for (let y = 0; y < px; y += 32) for (let x = 0; x < px; x += 32) if ((x + y) % 64 === 0) g.fillRect(x, y, 32, 32); // checkerboard pavement patches
  return finishFloorTexture(c);
}
function gymFloorTexture(base) {
  const { c, g, px } = baseFloorCanvas(base, null);
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3;
  g.strokeRect(10, 10, px - 20, px - 20);
  g.beginPath(); g.arc(px / 2, px / 2, px * 0.15, 0, Math.PI * 2); g.stroke();
  return finishFloorTexture(c);
}

// Adds a box prop to `group`, registered as a collider via `addSolid` — the shared building block
// every kit below uses, matching officeBox's own castShadow/receiveShadow convention.
function kitBox(group, addSolid, w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  addSolid(mesh);
  return mesh;
}

function buildOfficeKit(group, occupiedMap, addSolid, config) {
  const deskMat = new THREE.MeshLambertMaterial({ color: config.deskColor || 0xc9a06a });
  const partitionMat = new THREE.MeshLambertMaterial({ color: config.partitionColor || 0x6d8a99 });
  const monitorMat = new THREE.MeshLambertMaterial({ color: 0x1c1e22 });
  const chairMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  function cubicle(i, j, facingSouth) {
    const cx = i + 0.5, cz = j + 0.5;
    const sign = facingSouth ? -1 : 1;
    kitBox(group, addSolid, 0.9, 1.3, 0.08, partitionMat, cx, 0.65, cz + sign * 0.3);
    kitBox(group, addSolid, 0.8, 0.5, 0.5, deskMat, cx, 0.25, cz + sign * 0.02);
    kitBox(group, addSolid, 0.35, 0.2, 0.04, monitorMat, cx, 0.55, cz + sign * 0.15);
    kitBox(group, addSolid, 0.4, 0.4, 0.4, chairMat, cx, 0.2, cz - sign * 0.3);
    occupiedMap.set(`${i},${j}`, 1.3);
  }
  [-9, -6, -3, 3, 6, 9].forEach((i) => { cubicle(i, -6, true); cubicle(i, 6, false); });
  const tableMat = new THREE.MeshLambertMaterial({ color: 0xdad2c4 });
  kitBox(group, addSolid, 1.6, 0.5, 1, tableMat, 0, 0.25, 9.5);
  [[-0.9, 9], [0.9, 9], [-0.9, 10], [0.9, 10]].forEach(([x, z]) => kitBox(group, addSolid, 0.35, 0.4, 0.35, chairMat, x, 0.2, z));
}

function buildWarehouseKit(group, occupiedMap, addSolid, config) {
  const shelfMat = new THREE.MeshLambertMaterial({ color: config.accent || 0x8a6a3c });
  const crateMat = new THREE.MeshLambertMaterial({ color: config.crateColor || 0xb98a4a });
  [-7, -2, 3, 8].forEach((j) => {
    [-7, 7].forEach((i) => {
      kitBox(group, addSolid, 1.6, 3.4, 1.6, shelfMat, i + 0.5, 1.7, j + 0.5);
      occupiedMap.set(`${i},${j}`, 3.4);
    });
  });
  const seed = mulberry32(config.seed || 1);
  for (let n = 0; n < 10; n++) {
    const i = Math.floor(seed() * 20 - 10);
    const j = Math.floor(seed() * 20 - 10);
    if (Math.abs(i) < 2 && Math.abs(j) < 2) continue; // keep the spawn area clear
    if (occupiedMap.has(`${i},${j}`)) continue;
    const h = 0.9 + Math.floor(seed() * 2) * 0.9;
    kitBox(group, addSolid, 0.9, h, 0.9, crateMat, i + 0.5, h / 2, j + 0.5);
    occupiedMap.set(`${i},${j}`, h);
  }
}

function buildRooftopKit(group, occupiedMap, addSolid, config) {
  const acMat = new THREE.MeshLambertMaterial({ color: 0x555b61 });
  const seed = mulberry32(config.seed || 1);
  for (let n = 0; n < 8; n++) {
    const i = Math.floor(seed() * 18 - 9);
    const j = Math.floor(seed() * 18 - 9);
    if (Math.abs(i) < 2 && Math.abs(j) < 2) continue;
    if (occupiedMap.has(`${i},${j}`)) continue;
    kitBox(group, addSolid, 1.1, 1.0, 1.1, acMat, i + 0.5, 0.5, j + 0.5);
    occupiedMap.set(`${i},${j}`, 1.0);
  }
  const shedMat = new THREE.MeshLambertMaterial({ color: config.accent || 0x6a5648 });
  kitBox(group, addSolid, 2.2, 1.6, 2.2, shedMat, 0, 0.8, 0);
  ['0,0', '-1,0', '0,-1', '-1,-1'].forEach((k) => occupiedMap.set(k, 1.6));
}

function buildGarageKit(group, occupiedMap, addSolid, config) {
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x8a8d92 });
  [[-8, -8], [-8, 0], [-8, 8], [0, -8], [0, 8], [8, -8], [8, 0], [8, 8]].forEach(([i, j]) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, CEILING_HEIGHT, 12), pillarMat);
    mesh.position.set(i + 0.5, CEILING_HEIGHT / 2, j + 0.5);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh); addSolid(mesh);
    occupiedMap.set(`${i},${j}`, CEILING_HEIGHT);
  });
  const carMat = new THREE.MeshLambertMaterial({ color: config.carColor || 0xb23a3a });
  const seed = mulberry32(config.seed || 1);
  for (let n = 0; n < 6; n++) {
    const i = Math.floor(seed() * 16 - 8);
    const j = Math.floor(seed() * 16 - 8);
    if (Math.abs(i) < 2 && Math.abs(j) < 2) continue;
    if (occupiedMap.has(`${i},${j}`)) continue;
    kitBox(group, addSolid, 1.8, 0.6, 0.9, carMat, i + 0.5, 0.3, j + 0.5);
    occupiedMap.set(`${i},${j}`, 0.6);
  }
}

function buildPlazaKit(group, occupiedMap, addSolid, config) {
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x6a4a30 });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4028 });
  const leafMat = new THREE.MeshLambertMaterial({ color: config.leafColor || 0x3f7d4a });
  const seed = mulberry32(config.seed || 1);
  for (let n = 0; n < 9; n++) {
    const i = Math.floor(seed() * 18 - 9);
    const j = Math.floor(seed() * 18 - 9);
    if (Math.abs(i) < 2 && Math.abs(j) < 2) continue;
    if (occupiedMap.has(`${i},${j}`)) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.6, 8), trunkMat);
    trunk.position.set(i + 0.5, 0.8, j + 0.5);
    trunk.castShadow = true;
    group.add(trunk); addSolid(trunk);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 8), leafMat);
    leaves.position.set(i + 0.5, 1.9, j + 0.5);
    leaves.scale.y = 1.2;
    leaves.castShadow = true;
    group.add(leaves); // canopy overhead — decorative, not a collider, same precedent as buildOffice's potted plants
    occupiedMap.set(`${i},${j}`, 1.6);
  }
  [[-6, -6], [6, -6], [-6, 6], [6, 6]].forEach(([x, z]) => kitBox(group, addSolid, 1.4, 0.45, 0.4, benchMat, x, 0.22, z));
  const fountainMat = new THREE.MeshLambertMaterial({ color: 0x9aa4ab });
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.5, 16), fountainMat);
  fountain.position.set(0, 0.25, 0);
  fountain.castShadow = true; fountain.receiveShadow = true;
  group.add(fountain); addSolid(fountain);
  ['0,0', '-1,0', '0,-1', '-1,-1'].forEach((k) => occupiedMap.set(k, 0.5));
}

function buildGymKit(group, occupiedMap, addSolid, config) {
  const rackMat = new THREE.MeshLambertMaterial({ color: 0x33363c });
  [[-10, -4], [-10, 4], [10, -4], [10, 4]].forEach(([x, z]) => {
    kitBox(group, addSolid, 0.6, 1.4, 2.2, rackMat, x, 0.7, z);
    occupiedMap.set(`${Math.floor(x)},${Math.floor(z)}`, 1.4);
  });
  if (config.centerpiece === 'basketball') {
    const backboardMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
    [[-10, 0], [10, 0]].forEach(([x, z]) => {
      kitBox(group, addSolid, 0.3, 3, 0.3, rackMat, x, 1.5, z);
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 1.6), backboardMat);
      board.position.set(x - Math.sign(x) * 0.3, 2.6, z);
      group.add(board); addSolid(board);
      occupiedMap.set(`${Math.floor(x)},${Math.floor(z)}`, 3);
    });
  } else if (config.centerpiece === 'volleyball') {
    const postMat = new THREE.MeshLambertMaterial({ color: 0x33363c });
    const netMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.5 });
    [[0, -5.5], [0, 5.5]].forEach(([x, z]) => kitBox(group, addSolid, 0.25, 2.4, 0.25, postMat, x, 1.2, z));
    const net = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 11), netMat);
    net.position.set(0, 1.8, 0);
    group.add(net); addSolid(net);
  } else { // boxing
    const ropeMat = new THREE.MeshLambertMaterial({ color: 0xcc3b3b });
    const ringFloorMat = new THREE.MeshLambertMaterial({ color: 0x1e2126 });
    const ring = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 6), ringFloorMat);
    ring.position.set(0, 0.15, 0);
    group.add(ring); addSolid(ring);
    [[-3, -3], [3, -3], [-3, 3], [3, 3]].forEach(([x, z]) => kitBox(group, addSolid, 0.2, 1.4, 0.2, ropeMat, x, 0.9, z));
    ['0,0', '-1,0', '0,-1', '-1,-1', '1,0', '1,-1', '0,1', '-1,1', '1,1'].forEach((k) => occupiedMap.set(k, 0.3));
  }
}

const BB_MAP_KITS = {
  office: buildOfficeKit,
  warehouse: buildWarehouseKit,
  rooftop: buildRooftopKit,
  garage: buildGarageKit,
  plaza: buildPlazaKit,
  gym: buildGymKit,
};

// The 20 named maps voted on before each 1v1/2v2/3v3/4v4 (see bb-vote-match-map/bb-duel-map-vote/
// bb-match-map-vote) — keep the id list in sync with server.js's own BB_MAP_IDS, which validates
// votes against it but never renders anything itself. 'office' alone is special: it's the
// original, always-in-the-scene officeGroup built by buildOffice() above, not one of these
// procedurally-assembled kit instances — see activateMap.
const BB_MAPS = [
  { id: 'office', name: 'Open-Plan Office', icon: '🏢' },
  { id: 'office_night', name: 'Night Shift', icon: '🌃', kit: 'office', floorTint: '#3a3f4a', ceilingTint: '#2c2f38', wallRgb: [58, 64, 78], deskColor: 0x445066, partitionColor: 0x2c333d },
  { id: 'office_alert', name: 'Red Alert Office', icon: '🚨', kit: 'office', floorTint: '#4a2f30', ceilingTint: '#3a2426', wallRgb: [120, 70, 68], deskColor: 0x8a3a3a, partitionColor: 0x662a2a },
  { id: 'warehouse_day', name: 'Cold Storage', icon: '📦', kit: 'warehouse', floorTint: '#54555a', wallRgb: [140, 142, 148], accent: 0x8a6a3c, crateColor: 0xb98a4a, seed: 11 },
  { id: 'warehouse_dusk', name: 'Dockside Warehouse', icon: '🚚', kit: 'warehouse', floorTint: '#4a4238', wallRgb: [120, 108, 92], accent: 0x6a4a2c, crateColor: 0x9a6a38, seed: 22 },
  { id: 'warehouse_flood', name: 'Floodlit Depot', icon: '💡', kit: 'warehouse', floorTint: '#3f4448', wallRgb: [100, 112, 118], accent: 0x3c6a8a, crateColor: 0x4a8ab9, seed: 33 },
  { id: 'warehouse_frost', name: 'Frost Warehouse', icon: '❄️', kit: 'warehouse', floorTint: '#6b7680', wallRgb: [180, 190, 198], accent: 0x5a7a8a, crateColor: 0x8ab0c0, seed: 44 },
  { id: 'rooftop_day', name: 'Sunny Rooftop', icon: '☀️', kit: 'rooftop', floorTint: '#7a7d82', wallRgb: [170, 172, 176], wallHeight: 1.4, noCeiling: true, accent: 0x6a5648, seed: 55 },
  { id: 'rooftop_sunset', name: 'Sunset Heights', icon: '🌇', kit: 'rooftop', floorTint: '#8a6f68', wallRgb: [190, 140, 110], wallHeight: 1.4, noCeiling: true, accent: 0x8a5a48, seed: 66 },
  { id: 'rooftop_night', name: 'Neon Skyline', icon: '🌃', kit: 'rooftop', floorTint: '#33363f', wallRgb: [60, 64, 90], wallHeight: 1.4, noCeiling: true, accent: 0x4a3a6a, seed: 77 },
  { id: 'garage_a', name: 'Level B1 Garage', icon: '🅿️', kit: 'garage', floorTint: '#5c5f63', wallRgb: [130, 132, 138], carColor: 0xb23a3a, seed: 88 },
  { id: 'garage_b', name: 'Level B2 Garage', icon: '🚗', kit: 'garage', floorTint: '#4f5054', wallRgb: [110, 112, 118], carColor: 0x3a6ab2, seed: 99 },
  { id: 'garage_c', name: 'Valet Garage', icon: '🎫', kit: 'garage', floorTint: '#67564a', wallRgb: [150, 130, 108], carColor: 0xb2913a, seed: 111 },
  { id: 'garage_d', name: 'Impound Garage', icon: '🚔', kit: 'garage', floorTint: '#464a4f', wallRgb: [95, 100, 108], carColor: 0x4a4d52, seed: 122 },
  { id: 'plaza_day', name: 'Sunny Plaza', icon: '🌳', kit: 'plaza', floorTint: '#8a9a6a', wallRgb: [180, 176, 150], leafColor: 0x3f7d4a, seed: 133 },
  { id: 'plaza_rain', name: 'Rainy Plaza', icon: '🌧️', kit: 'plaza', floorTint: '#5c6a5e', wallRgb: [110, 116, 112], leafColor: 0x2f5a3a, seed: 144 },
  { id: 'plaza_dusk', name: 'Dusk Plaza', icon: '🌆', kit: 'plaza', floorTint: '#7a6a5a', wallRgb: [160, 128, 110], leafColor: 0x4a5a3a, seed: 155 },
  { id: 'gym_basketball', name: 'Hardwood Court', icon: '🏀', kit: 'gym', floorTint: '#b9793f', wallRgb: [180, 150, 110], centerpiece: 'basketball' },
  { id: 'gym_volleyball', name: 'Sand Court', icon: '🏐', kit: 'gym', floorTint: '#d8c48a', wallRgb: [190, 200, 210], centerpiece: 'volleyball' },
  { id: 'gym_boxing', name: 'Fight Night', icon: '🥊', kit: 'gym', floorTint: '#8a2a2a', wallRgb: [60, 30, 32], centerpiece: 'boxing' },
];
const BB_MAP_FLOOR_TEXTURE = {
  office: officeFloorTexture, warehouse: warehouseFloorTexture, rooftop: rooftopFloorTexture,
  garage: garageFloorTexture, plaza: plazaFloorTexture, gym: gymFloorTexture,
};

// Builds one non-office map fresh: shell (floor/ceiling/walls, tinted per config) + this kit's own
// obstacle layout + this map's own copy of the match-station plates/signs. Returns everything
// activateMap needs to wire in and later tear back out again — solids specifically, since three.js
// r128's Raycaster.intersectObject (checked directly: no `.visible` check anywhere in it) tests
// every mesh handed to it regardless of visibility, so a torn-down map's meshes MUST actually be
// spliced back out of the shared `solids` array, not just hidden, or they'd silently keep blocking
// bullets/movement in whichever map replaces them.
function buildExtraMap(config) {
  const group = new THREE.Group();
  const occupiedMap = new Map();
  const solidsAdded = [];
  const addSolid = (mesh) => { solidsAdded.push(mesh); };

  const wallHeight = config.wallHeight || CEILING_HEIGHT;
  const floorTexFn = BB_MAP_FLOOR_TEXTURE[config.kit];
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_BLOCKS + 2, MAP_BLOCKS + 2),
    new THREE.MeshLambertMaterial({ map: floorTexFn(config.floorTint) })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  if (!config.noCeiling) {
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_BLOCKS + 2, MAP_BLOCKS + 2),
      new THREE.MeshLambertMaterial({ map: genericCeilingTexture(config.ceilingTint || '#aeada6', '#e8e2cf') })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = wallHeight;
    group.add(ceiling);
  }

  const wallMat = new THREE.MeshLambertMaterial({ map: speckleTexture(...config.wallRgb, 6, 32) });
  [
    [0, -(HALF_MAP + 0.5), MAP_BLOCKS + 2, 1],
    [0, HALF_MAP + 0.5, MAP_BLOCKS + 2, 1],
    [-(HALF_MAP + 0.5), 0, 1, MAP_BLOCKS + 2],
    [HALF_MAP + 0.5, 0, 1, MAP_BLOCKS + 2],
  ].forEach(([cx, cz, sx, sz]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, wallHeight, sz), wallMat);
    wall.position.set(cx, wallHeight / 2, cz);
    wall.receiveShadow = true;
    group.add(wall);
    addSolid(wall);
  });

  BB_MAP_KITS[config.kit](group, occupiedMap, addSolid, config);
  const stationMeshes = buildBbStations(group);

  return { group, occupiedMap, solids: solidsAdded, stationMeshes };
}

let activeMapId = null;
let extraMapGroup = null;
let extraMapSolids = [];

function teardownExtraMap() {
  if (!extraMapGroup) return;
  scene.remove(extraMapGroup);
  disposeObject3D(extraMapGroup);
  if (extraMapSolids.length) {
    const toRemove = new Set(extraMapSolids);
    for (let i = solids.length - 1; i >= 0; i--) if (toRemove.has(solids[i])) solids.splice(i, 1);
  }
  extraMapGroup = null;
  extraMapSolids = [];
}

// Switches the online lobby's visible/collidable space to `mapId` — tears down whatever non-office
// map was previously built (office itself is never torn down, it's permanent, see buildOffice/
// officeGroup) and lazily builds the new one only if it hasn't been already. Safe to call with the
// same id twice (no-op) and with an unrecognized id (falls back to 'office' rather than leaving the
// lobby with no floor at all).
function activateMap(mapId) {
  if (mapId === activeMapId) return;
  teardownExtraMap();
  officeGroup.visible = false;
  if (mapId === 'office' || !mapId) {
    officeGroup.visible = true;
    occupied.clear();
    for (const [k, v] of officeOccupied) occupied.set(k, v);
    bbStationMeshes = officeStationMeshes;
    activeMapId = 'office';
    return;
  }
  const config = BB_MAPS.find((m) => m.id === mapId);
  if (!config) { activateMap('office'); return; }
  const built = buildExtraMap(config);
  scene.add(built.group);
  extraMapGroup = built.group;
  extraMapSolids = built.solids;
  occupied.clear();
  for (const [k, v] of built.occupiedMap) occupied.set(k, v);
  solids.push(...built.solids);
  bbStationMeshes = built.stationMeshes;
  activeMapId = mapId;
}

// ---- Map vote overlay ----
// Shown to just a match's own participants the instant a 1v1 accepts (bb-duel-map-vote) or an
// NvN station fills (bb-match-map-vote) — never to lobby bystanders, who instead get a quiet
// bb-lobby-map-changed heads-up once it resolves. Hidden the moment combat actually starts
// (bb-duel-started/bb-match-started).
const mapVoteOverlay = document.getElementById('map-vote');
const mapVoteGrid = document.getElementById('map-vote-grid');
const mapVoteTimerEl = document.getElementById('map-vote-timer');
let mapVoteCountdownTimer = null;
let myMapVote = null;
let lastMapVoteTally = {};

function renderMapVoteGrid(tally) {
  mapVoteGrid.innerHTML = '';
  for (const m of BB_MAPS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'map-vote-card' + (myMapVote === m.id ? ' picked' : '');
    const count = tally[m.id] || 0;
    const icon = document.createElement('div');
    icon.className = 'map-vote-icon';
    icon.textContent = m.icon;
    const name = document.createElement('div');
    name.className = 'map-vote-name';
    name.textContent = m.name;
    const countEl = document.createElement('div');
    countEl.className = 'map-vote-count';
    countEl.textContent = `${count} vote${count === 1 ? '' : 's'}`;
    card.append(icon, name, countEl);
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      myMapVote = m.id;
      if (bbWs && bbWs.readyState === WebSocket.OPEN) bbWs.send(JSON.stringify({ type: 'bb-vote-match-map', mapId: m.id }));
      renderMapVoteGrid(lastMapVoteTally); // instant "picked" highlight; the real broadcast tally follows moments later
    });
    mapVoteGrid.appendChild(card);
  }
}

function updateMapVoteTally(tally) {
  lastMapVoteTally = tally;
  renderMapVoteGrid(tally);
}

function showMapVote(voteEndsAt, tally) {
  myMapVote = null;
  updateMapVoteTally(tally);
  mapVoteOverlay.classList.remove('hidden');
  if (mapVoteCountdownTimer) clearInterval(mapVoteCountdownTimer);
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((voteEndsAt - Date.now()) / 1000));
    mapVoteTimerEl.textContent = `${remaining}s`;
    if (remaining <= 0) clearInterval(mapVoteCountdownTimer);
  };
  tick();
  mapVoteCountdownTimer = setInterval(tick, 250);
}

function hideMapVote() {
  mapVoteOverlay.classList.add('hidden');
  if (mapVoteCountdownTimer) { clearInterval(mapVoteCountdownTimer); mapVoteCountdownTimer = null; }
}

// Local prediction of which plate (if any) the player is standing on — the source of truth for
// self-highlighting (see updateBbStationVisual) rather than name-matching, since two connections
// can share a display name ("Guest") but never this locally-tracked slot assignment.
let bbCurrentPlate = null; // { stationId, side, slot } | null
// A slot the server just told us we don't actually hold (see 'bb-plate-rejected') — held briefly
// so updateBbPlateDetection doesn't immediately re-request the exact same slot every frame (a
// tight reject loop) while the player is still standing on it; a physical step off and back, or
// this window expiring, clears it.
let bbBlockedPlateKey = null;
let bbBlockedPlateUntil = 0;
function bbPlateKey(p) { return p ? `${p.stationId}:${p.side}:${p.slot}` : null; }

function updateBbStationVisual(stationId, data) {
  const meshes = bbStationMeshes.get(stationId);
  if (!meshes) return;
  const locked = !!data.inProgress;
  for (const side of ['a', 'b']) {
    const names = data[side] || [];
    meshes.plates[side].forEach((mesh, i) => {
      const occupantName = names[i];
      const isSelf = !locked && bbCurrentPlate && bbCurrentPlate.stationId === stationId && bbCurrentPlate.side === side && bbCurrentPlate.slot === i;
      let color;
      if (locked) color = BB_PLATE_COLOR.locked;
      else if (isSelf) color = BB_PLATE_COLOR[side].self;
      else if (occupantName) color = BB_PLATE_COLOR[side].filled;
      else color = BB_PLATE_COLOR[side].empty;
      mesh.material.color.setHex(color);
      mesh.material.opacity = locked ? 0.35 : (occupantName ? 0.9 : 0.55);
    });
  }
}

// Checks the player's own x/z against every plate on every station once per free-roam frame (see
// tick()'s onlineActive-and-not-dueling branch) and tells the server on any actual transition —
// deliberately not sent every frame, only on stepping onto/off a plate, to keep this as cheap as
// bb-challenge rather than as chatty as bb-pos.
function updateBbPlateDetection() {
  let found = null;
  for (const plate of bbFlatPlates) {
    const dx = player.x - plate.x, dz = player.z - plate.z;
    if (dx * dx + dz * dz <= BB_PLATE_RADIUS * BB_PLATE_RADIUS) { found = { stationId: plate.stationId, side: plate.side, slot: plate.slot }; break; }
  }
  if (found && bbPlateKey(found) === bbBlockedPlateKey && performance.now() < bbBlockedPlateUntil) found = null;
  const same = found && bbCurrentPlate && found.stationId === bbCurrentPlate.stationId && found.side === bbCurrentPlate.side && found.slot === bbCurrentPlate.slot;
  if (same) return;
  if (bbCurrentPlate && bbWs && bbWs.readyState === WebSocket.OPEN) bbWs.send(JSON.stringify({ type: 'bb-plate-leave' }));
  bbCurrentPlate = found;
  if (found && bbWs && bbWs.readyState === WebSocket.OPEN) {
    bbWs.send(JSON.stringify({ type: 'bb-plate-enter', stationId: found.stationId, side: found.side, slot: found.slot }));
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
  // One profile per shop archetype (not per weapon — 100 individually-designed gunshots is the
  // same disproportionate ask as 100 individual viewmodels) — every weapon in that archetype
  // shares its family's report, which is how plenty of real shooters handle large weapon rosters
  // anyway (a "pistol" sounds like a pistol regardless of which specific one it is).
  shoparch_pistol:   [0.12, 900, 0.5, 220, 90, 0.1, 0.25],
  shoparch_revolver: [0.2, 650, 0.7, 150, 50, 0.18, 0.38],
  shoparch_smg:      [0.05, 1500, 0.28, 320, 150, 0.05, 0.12],
  shoparch_ar:       [0.08, 1000, 0.42, 240, 100, 0.07, 0.2],
  shoparch_shotgun:  [0.28, 350, 0.85, 130, 45, 0.22, 0.35],
  shoparch_lmg:      [0.1, 800, 0.5, 200, 80, 0.08, 0.22],
  shoparch_sniper:   [0.3, 500, 0.8, 120, 35, 0.28, 0.4],
  shoparch_dmr:      [0.22, 600, 0.65, 140, 50, 0.2, 0.32],
  shoparch_launcher: [0.35, 400, 0.5, 90, 45, 0.3, 0.3],
  shoparch_energy:   [0.05, 1800, 0.25, 400, 900, 0.06, 0.16], // rising pitch — a charged zap, not a bang
};

function sfxShot(type) {
  const shopW = WEAPONS[type];
  const profile = GUN_SOUNDS[type] || (shopW && GUN_SOUNDS['shoparch_' + shopW.archKey]);
  if (!profile) return; // knife/fists and anything else with no gunshot have no entry — silent is correct, not a bug
  const [nd, nc, nv, f0, f1, td, tv] = profile;
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
// A tappable equivalent of the "M to change mode" text next to it — that hint was keyboard-only,
// which left touch players with no way back to mode-select after dying short of reloading the
// page. stopPropagation matters here: #death has its own document-level click listener (further
// down) that respawns on ANY click inside it, so without this a tap on the button would fire both.
document.getElementById('death-mode-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  backToModeSelect();
});
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

// Shared between a shop weapon's in-hand viewmodel tint (equipGun) and its card accent color in
// the shop UI, so what you see in the menu is what you see in your hands. Four bands reading as
// bronze -> silver -> gold -> a vivid "this is the best one" accent, independent of archetype.
function shopTierColor(tier) {
  if (tier >= 10) return 0x2fe0ff;
  if (tier >= 7) return 0xd4af37;
  if (tier >= 4) return 0xaeb4bb;
  return 0x8a715a;
}
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
  // Purchased shop weapons stand alongside the kill-unlock ladder here — both are just "things
  // you've unlocked," equipped through the exact same equipWeapon() either way.
  for (const w of SHOP_WEAPONS) {
    if (!purchasedWeapons.has(w.id)) continue;
    addTile(w.icon, w.title, () => equipWeapon(w.id));
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

// ---- Weapon Shop currency + ownership ----
// Coins are earned per wave cleared, per FS life ended, and per online duel/match win (see the
// award call sites near each of those events) and spent in the shop overlay below. Both persist in
// localStorage, same "survives refreshes, no account needed" convention as best-run/save-game —
// Block Battle has always been playable with zero sign-in, and coins/ownership shouldn't be the
// one thing that suddenly requires an account.
const COINS_KEY = 'valk-bb-coins';
function loadCoins() {
  try { return Math.max(0, parseInt(localStorage.getItem(COINS_KEY), 10)) || 0; } catch { return 0; }
}
function saveCoins(n) {
  try { localStorage.setItem(COINS_KEY, String(Math.max(0, n | 0))); } catch {}
}
let coins = loadCoins();

const PURCHASED_KEY = 'valk-bb-purchased';
function loadPurchased() {
  try { return new Set(JSON.parse(localStorage.getItem(PURCHASED_KEY)) || []); } catch { return new Set(); }
}
function savePurchased(set) {
  try { localStorage.setItem(PURCHASED_KEY, JSON.stringify([...set])); } catch {}
}
let purchasedWeapons = loadPurchased();

function updateCoinDisplays() {
  document.querySelectorAll('.bb-coin-count').forEach((el) => { el.textContent = coins.toLocaleString(); });
}
updateCoinDisplays();

// Shared by every "you did a thing, here's coins" call site (wave cleared, FS life ended, online
// duel/match won) so the state-update/persist logic can't drift out of sync between them. Doesn't
// show its own banner — each call site already shows (or is about to show) its own "you did the
// thing" message, and showWaveBanner replaces whatever's currently showing rather than queuing, so
// a second call right after would just clobber the first before it's readable.
function awardCoins(amount) {
  if (amount <= 0) return;
  coins += amount;
  saveCoins(coins);
  updateCoinDisplays();
}

// ---- Settings ----
// Persisted like coins/purchasedWeapons above — survives refreshes, no account needed. Applied
// live in tick() (movement/FOV/recoil) and wherever the crosshair/HUD reads it, so a change takes
// effect immediately without needing a respawn.
const SETTINGS_KEY = 'valk-bb-settings';
const DEFAULT_SETTINGS = {
  autoSprint: false,
  easySlide: false,
  fov: 70,
  cameraEffects: true,
  crosshairStyle: 'static',
  crosshairColor: '#ffffff',
};
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return { ...DEFAULT_SETTINGS, ...(saved || {}) };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}
let settings = loadSettings();

function applyCrosshairSettings() {
  crosshair.style.setProperty('--crosshair-color', settings.crosshairColor);
  crosshair.classList.toggle('outline', settings.crosshairStyle === 'outline');
}

const settingsPanel = document.getElementById('settings-panel');
const settingAutoSprintEl = document.getElementById('setting-auto-sprint');
const settingEasySlideEl = document.getElementById('setting-easy-slide');
const settingFovEl = document.getElementById('setting-fov');
const settingFovValueEl = document.getElementById('setting-fov-value');
const settingCameraEffectsEl = document.getElementById('setting-camera-effects');

function renderSettingsPanel() {
  settingAutoSprintEl.checked = settings.autoSprint;
  settingEasySlideEl.checked = settings.easySlide;
  settingFovEl.value = settings.fov;
  settingFovValueEl.textContent = settings.fov;
  settingCameraEffectsEl.checked = settings.cameraEffects;
  document.querySelectorAll('#setting-crosshair-style .settings-choice-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.style === settings.crosshairStyle);
  });
  document.querySelectorAll('#setting-crosshair-color .settings-swatch').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.color === settings.crosshairColor);
  });
}

settingAutoSprintEl.addEventListener('change', () => { settings.autoSprint = settingAutoSprintEl.checked; saveSettings(); });
settingEasySlideEl.addEventListener('change', () => { settings.easySlide = settingEasySlideEl.checked; saveSettings(); });
settingFovEl.addEventListener('input', () => {
  settings.fov = parseInt(settingFovEl.value, 10);
  settingFovValueEl.textContent = settings.fov;
  saveSettings();
});
settingCameraEffectsEl.addEventListener('change', () => { settings.cameraEffects = settingCameraEffectsEl.checked; saveSettings(); });
document.querySelectorAll('#setting-crosshair-style .settings-choice-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    settings.crosshairStyle = btn.dataset.style;
    saveSettings();
    applyCrosshairSettings();
    renderSettingsPanel();
  });
});
document.querySelectorAll('#setting-crosshair-color .settings-swatch').forEach((btn) => {
  btn.addEventListener('click', () => {
    settings.crosshairColor = btn.dataset.color;
    saveSettings();
    applyCrosshairSettings();
    renderSettingsPanel();
  });
});

document.getElementById('settings-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  renderSettingsPanel();
  settingsPanel.classList.remove('hidden');
});
document.getElementById('settings-close-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  settingsPanel.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !settingsPanel.classList.contains('hidden')) settingsPanel.classList.add('hidden');
});
applyCrosshairSettings();

// ---- Weapon Shop UI ----
const weaponShopOverlay = document.getElementById('weapon-shop');
const weaponShopTabs = document.getElementById('weapon-shop-tabs');
const weaponShopGrid = document.getElementById('weapon-shop-grid');
let weaponShopActiveArch = SHOP_ARCHETYPES[0].key;

function renderWeaponShopTabs() {
  weaponShopTabs.innerHTML = '';
  for (const arch of SHOP_ARCHETYPES) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'weapon-shop-tab' + (arch.key === weaponShopActiveArch ? ' active' : '');
    tab.textContent = `${arch.icon} ${arch.label}`;
    tab.addEventListener('click', () => {
      weaponShopActiveArch = arch.key;
      renderWeaponShopTabs();
      renderWeaponShopGrid();
    });
    weaponShopTabs.appendChild(tab);
  }
}

function renderWeaponShopGrid() {
  weaponShopGrid.innerHTML = '';
  const weapons = SHOP_WEAPONS.filter((w) => w.archKey === weaponShopActiveArch);
  for (const w of weapons) {
    const card = document.createElement('div');
    card.className = 'weapon-card';
    card.style.setProperty('--tier-color', `#${shopTierColor(w.tier).toString(16).padStart(6, '0')}`);

    const top = document.createElement('div');
    top.className = 'weapon-card-top';
    const icon = document.createElement('div');
    icon.className = 'weapon-card-icon';
    icon.textContent = w.icon;
    const name = document.createElement('div');
    name.className = 'weapon-card-name';
    name.textContent = w.title;
    const tier = document.createElement('div');
    tier.className = 'weapon-card-tier';
    tier.textContent = `T${w.tier}`;
    top.append(icon, name, tier);

    const stats = document.createElement('div');
    stats.className = 'weapon-card-stats';
    const dps = w.mag === 1
      ? `${w.damage} dmg / shot`
      : `${w.damage} dmg · ${Math.round(1 / Math.max(w.interval, 0.01))}/s`;
    stats.innerHTML = `${dps}<br>Mag ${w.mag} · Reload ${w.reload}s<br>Headshot ${w.headshot}`;

    const action = document.createElement('button');
    action.type = 'button';
    const owned = purchasedWeapons.has(w.id);
    if (owned) {
      action.className = 'weapon-card-action owned';
      action.textContent = '✓ Owned';
      action.disabled = true;
    } else {
      action.className = 'weapon-card-action buy';
      action.textContent = `🪙 ${w.price.toLocaleString()}`;
      action.disabled = coins < w.price;
      // Two clicks to actually spend coins: the first only arms a short confirm window (button
      // flips to "Tap to confirm" in orange) so a stray/misclick never silently buys something —
      // only a second, deliberate click inside that window does. Times back out to the normal buy
      // state on its own if you change your mind or just move on.
      action.addEventListener('click', () => {
        if (coins < w.price) return;
        if (action.dataset.confirm === '1') {
          coins -= w.price;
          saveCoins(coins);
          purchasedWeapons.add(w.id);
          savePurchased(purchasedWeapons);
          updateCoinDisplays();
          renderWeaponShopGrid();
          return;
        }
        action.dataset.confirm = '1';
        action.textContent = 'Tap to confirm';
        action.classList.add('confirming');
        clearTimeout(action._confirmTimer);
        action._confirmTimer = setTimeout(() => {
          action.dataset.confirm = '0';
          action.textContent = `🪙 ${w.price.toLocaleString()}`;
          action.classList.remove('confirming');
        }, 2500);
      });
    }

    card.append(top, stats, action);
    weaponShopGrid.appendChild(card);
  }
}

document.getElementById('view-weapons-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  renderWeaponShopTabs();
  renderWeaponShopGrid();
  weaponShopOverlay.classList.remove('hidden');
});
document.getElementById('weapon-shop-close-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  weaponShopOverlay.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !weaponShopOverlay.classList.contains('hidden')) weaponShopOverlay.classList.add('hidden');
});

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
  // -1 (not on the ladder at all — a shop weapon, or fists) used to fall through to
  // WEAPON_ORDER[0] (Glock), since -1 < length-1 is true — meaning the U-key/Upgrade button would
  // silently swap a shop weapon back to Glock the instant it was equipped. Shop weapons aren't
  // part of the kill-unlock ladder at all, so there's genuinely no "next" one to offer here.
  if (idx === -1) return null;
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

// Tags a box as "the magazine" for the reload animation: it drops free, disappears for a beat,
// then a fresh one slides back up to this same resting height. Revolvers/pump/tube-fed weapons
// (cylinder, shotgun, RPG, launcher) don't call this — they just get the gun-wide dip/tilt.
function markMag(gunGroup, mesh) {
  mesh.userData.restY = mesh.position.y;
  gunGroup.userData.mag = mesh;
  return mesh;
}

// Every mesh in a bot/ally/gun group owns its own geometry and material (none of it is a shared
// module-level singleton like packMat below), so a plain traverse-and-dispose-everything is safe
// here — matches fighterplane.js's disposeObject3D exactly.
function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse((o) => {
    // Every online-lobby map's station signs (see buildBbStations) are THREE.Sprite, not Mesh —
    // .isMesh is false for those, so they'd silently skip disposal (leaking their CanvasTexture +
    // SpriteMaterial on every map switch) without this also checking .isSprite.
    if (!o.isMesh && !o.isSprite) return;
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
    markMag(gun, addBox(gun, 0.03, 0.07, 0.03, DARK, 0, -0.14, 0.05));
  } else if (type === 'deagle') {
    addBox(gun, 0.06, 0.06, 0.22, 0xb9c2c9, 0, 0, 0);
    addBox(gun, 0.05, 0.1, 0.05, GRIP, 0, -0.07, 0.06, 0.25);
    markMag(gun, addBox(gun, 0.035, 0.08, 0.035, DARK, 0, -0.14, 0.06));
    muzzleZ = -0.14;
  } else if (type === 'uzi') {
    addBox(gun, 0.05, 0.06, 0.2, 0x24282c, 0, 0, 0);
    addBox(gun, 0.04, 0.12, 0.04, GRIP, 0, -0.08, 0.01);
    markMag(gun, addBox(gun, 0.035, 0.1, 0.035, DARK, 0, -0.08, -0.05)); // the long stick magazine
    muzzleZ = -0.13;
  } else if (type === 'mp90') {
    addBox(gun, 0.055, 0.07, 0.28, 0x3a4652, 0, 0, 0);
    addBox(gun, 0.045, 0.1, 0.05, GRIP, 0, -0.08, 0.04, 0.2);
    addBox(gun, 0.04, 0.09, 0.04, 0x2c363f, 0, -0.07, -0.06, -0.25);
    markMag(gun, addBox(gun, 0.035, 0.1, 0.035, DARK, 0, -0.1, -0.02));
    muzzleZ = -0.17;
  } else if (type === 'ak47') {
    addBox(gun, 0.05, 0.06, 0.34, 0x2e2a26, 0, 0, -0.02);
    addBox(gun, 0.045, 0.09, 0.05, WOOD, 0, -0.07, 0.06, 0.25);   // grip
    addBox(gun, 0.05, 0.06, 0.1, WOOD, 0, 0.005, 0.16);           // stock
    markMag(gun, addBox(gun, 0.045, 0.12, 0.05, DARK, 0, -0.08, -0.03, 0.35));  // curved mag
    muzzleZ = -0.21;
  } else if (type === 'sniper' || type === 'sniper3') {
    const body = type === 'sniper' ? 0x32363a : 0x1f2933;
    addBox(gun, 0.04, 0.045, 0.46, body, 0, 0, -0.06);
    addBox(gun, 0.045, 0.05, 0.12, GRIP, 0, 0.05, 0.03);          // scope
    addBox(gun, 0.05, 0.06, 0.12, type === 'sniper' ? WOOD : 0x2fb6ac, 0, -0.01, 0.16); // stock
    addBox(gun, 0.04, 0.08, 0.05, GRIP, 0, -0.06, 0.08, 0.3);
    markMag(gun, addBox(gun, 0.03, 0.05, 0.03, DARK, 0, -0.07, 0));
    muzzleZ = -0.3;
  } else if (type === 'rpg') {
    addBox(gun, 0.09, 0.09, 0.5, 0x4a5d3a, 0, 0, -0.02);
    addBox(gun, 0.13, 0.13, 0.12, 0x8a2f23, 0, 0, -0.31);         // warhead
    addBox(gun, 0.04, 0.1, 0.05, GRIP, 0, -0.09, 0.05, 0.25);
    muzzleZ = -0.38;
  } else if (type.startsWith('shop_')) {
    // 100 individually-modeled viewmodels isn't a reasonable ask — instead, one real, distinct
    // model per archetype (10 total, in the same addBox-box-kit style as every gun above), with a
    // tier-based color tint standing in for "this is a better one" the same way a fresh coat of
    // paint reads as an upgrade in plenty of real shooters. shopTierColor is shared with the shop
    // UI's own weapon-card accents, so a card's color actually matches what you see in-hand.
    const shopW = WEAPONS[type];
    const tint = shopTierColor(shopW.tier);
    if (shopW.archKey === 'pistol') {
      addBox(gun, 0.052, 0.052, 0.17, tint, 0, 0, 0);
      addBox(gun, 0.045, 0.1, 0.05, GRIP, 0, -0.07, 0.05, 0.25);
      markMag(gun, addBox(gun, 0.03, 0.07, 0.03, DARK, 0, -0.14, 0.05));
    } else if (shopW.archKey === 'revolver') {
      addBox(gun, 0.06, 0.06, 0.2, tint, 0, 0, 0);
      addBox(gun, 0.075, 0.075, 0.075, DARK, 0, 0, 0.05);          // cylinder
      addBox(gun, 0.05, 0.11, 0.05, GRIP, 0, -0.08, 0.07, 0.28);
      muzzleZ = -0.13;
    } else if (shopW.archKey === 'smg') {
      addBox(gun, 0.05, 0.06, 0.21, tint, 0, 0, 0);
      addBox(gun, 0.04, 0.12, 0.04, GRIP, 0, -0.08, 0.01);
      markMag(gun, addBox(gun, 0.035, 0.1, 0.035, DARK, 0, -0.08, -0.05));
      muzzleZ = -0.14;
    } else if (shopW.archKey === 'ar') {
      addBox(gun, 0.05, 0.06, 0.34, tint, 0, 0, -0.02);
      addBox(gun, 0.045, 0.09, 0.05, GRIP, 0, -0.07, 0.06, 0.25);
      addBox(gun, 0.05, 0.06, 0.1, tint, 0, 0.005, 0.16);
      markMag(gun, addBox(gun, 0.045, 0.12, 0.05, DARK, 0, -0.08, -0.03, 0.35));
      muzzleZ = -0.21;
    } else if (shopW.archKey === 'shotgun') {
      addBox(gun, 0.075, 0.075, 0.26, tint, 0, 0, -0.02);
      addBox(gun, 0.045, 0.045, 0.16, WOOD, 0, -0.045, 0.02);      // pump foregrip
      addBox(gun, 0.05, 0.1, 0.06, WOOD, 0, -0.03, 0.16);          // stock
      muzzleZ = -0.17;
    } else if (shopW.archKey === 'lmg') {
      addBox(gun, 0.06, 0.07, 0.36, tint, 0, 0, -0.02);
      addBox(gun, 0.05, 0.1, 0.05, GRIP, 0, -0.08, 0.08, 0.25);
      markMag(gun, addBox(gun, 0.11, 0.11, 0.09, DARK, 0, -0.1, -0.08));         // drum mag
      addBox(gun, 0.05, 0.06, 0.1, DARK, 0, 0.005, 0.17);          // stock
      muzzleZ = -0.22;
    } else if (shopW.archKey === 'sniper') {
      addBox(gun, 0.04, 0.045, 0.48, tint, 0, 0, -0.06);
      addBox(gun, 0.045, 0.05, 0.13, GRIP, 0, 0.05, 0.02);         // scope
      addBox(gun, 0.05, 0.06, 0.12, WOOD, 0, -0.01, 0.17);         // stock
      addBox(gun, 0.04, 0.08, 0.05, GRIP, 0, -0.06, 0.08, 0.3);
      markMag(gun, addBox(gun, 0.03, 0.05, 0.03, DARK, 0, -0.07, 0));
      muzzleZ = -0.31;
    } else if (shopW.archKey === 'dmr') {
      addBox(gun, 0.045, 0.05, 0.36, tint, 0, 0, -0.03);
      addBox(gun, 0.038, 0.042, 0.1, GRIP, 0, 0.045, 0.02);        // shorter scope
      addBox(gun, 0.045, 0.1, 0.05, GRIP, 0, -0.07, 0.08, 0.25);
      markMag(gun, addBox(gun, 0.045, 0.1, 0.045, DARK, 0, -0.08, -0.02, 0.3));
      muzzleZ = -0.23;
    } else if (shopW.archKey === 'launcher') {
      addBox(gun, 0.09, 0.09, 0.5, tint, 0, 0, -0.02);
      addBox(gun, 0.13, 0.13, 0.12, 0x8a2f23, 0, 0, -0.31);        // warhead
      addBox(gun, 0.04, 0.1, 0.05, GRIP, 0, -0.09, 0.05, 0.25);
      muzzleZ = -0.38;
    } else { // energy
      addBox(gun, 0.045, 0.05, 0.3, 0x14181c, 0, 0, -0.02);        // dark chassis
      addBox(gun, 0.018, 0.018, 0.26, tint, 0, 0.01, -0.02);       // glowing core strip along the top
      addBox(gun, 0.04, 0.09, 0.045, GRIP, 0, -0.07, 0.06, 0.25);
      markMag(gun, addBox(gun, 0.035, 0.07, 0.035, tint, 0, -0.14, 0.06));  // battery cell, tinted like the core
      muzzleZ = -0.19;
    }
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

// ---- First-person slide legs ----
// The player has no first-person body at all normally (the camera IS the player's head, per the
// "First person: the player has no mesh" note above) — a full always-visible body would be a much
// bigger undertaking (arms/legs tracked every frame, matching every stance). Sliding is the one
// moment it's worth the trouble: two blocky legs, camera-attached exactly like the gun viewmodel,
// that appear only during a slide in a kicked-out baseball-slide pose, then vanish again.
const slideLegs = new THREE.Group();
const slideLegLeft = new THREE.Group();
const slideLegRight = new THREE.Group();
{
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2b3a4a });
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0x1c1f22 });
  function buildLeg(pivot) {
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), pantsMat);
    thigh.position.set(0, -0.25, 0); // hangs down from the hip pivot, so rotating the pivot kicks the whole leg
    pivot.add(thigh);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.24), shoeMat);
    shoe.position.set(0, -0.5, 0.07);
    pivot.add(shoe);
  }
  buildLeg(slideLegLeft);
  buildLeg(slideLegRight);
  slideLegLeft.position.set(-0.13, -0.4, -0.12);
  slideLegRight.position.set(0.13, -0.4, -0.12);
  slideLegs.add(slideLegLeft, slideLegRight);
  slideLegs.visible = false;
  camera.add(slideLegs);
}

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
// forever, each back 5 seconds after it drops; Online Play is its own separate
// flow (startOnlinePlay below) — free-roam lobby, duels, and NvN matches.
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
  // On desktop, exitPointerLock() above re-pauses via the pointerlockchange listener. Touch never
  // engages pointer lock at all (see requestPointerLockSafe's touch branch), so that path never
  // fires here — without an explicit pause, tick() would keep running full bot AI/physics behind
  // the now-covering mode-select screen instead of freezing like the paused branch is meant to.
  paused = true;
  pausedAt = performance.now(); // both resume paths (desktop's pointerlockchange, touch's requestPointerLockSafe) credit time back against this
  keys.clear();
  mouseHeld = false;
  scoped = false;
  touchMoveF = 0;
  touchMoveR = 0;
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
          openLoadoutPicker(() => requestPointerLockSafe());
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
      // FS has no discrete waves to reward per-clear like Wave Challenge does below — a life
      // ending IS the "match completed" event here, so the reward is paid on death, scaled to
      // how much was actually accomplished this run rather than a flat amount.
      const fsCoins = 15 + runKills * 4;
      awardCoins(fsCoins);
      deathStats.textContent = `${runKills} kills this run · 🪙 +${fsCoins}`;
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
let duelRoundsWon = 0;
let duelRoundsLost = 0;
const BB_MAX_HEALTH_CLIENT = 100;
// Mirrors server.js's BB_WEAPON exactly for local cosmetics (sound/tracer/cooldown gating) — the
// server re-checks its own copy of these numbers before ever applying damage, so a modified client
// can make this local copy lie without gaining anything.
const BB_WEAPON_CLIENT = { damage: 20, range: 60, cooldownMs: 150 };
// NvN station-match state — kept alongside (not merged into) the 1v1 fields above since a player
// is only ever in one or the other. `dueling` is reused as the shared "in first-person combat"
// gate (camera/gun-visibility/shoot-routing all already branch on it) — see bb-match-started.
let inMatch = false;
let myMatchId = null;
let myMatchSide = null;
let myMatchEliminated = false;
let matchTeammates = []; // [{id, name, health, eliminated}]
let matchEnemies = [];   // [{id, name, health, eliminated}]
let matchRoundsWonMine = 0;
let matchRoundsWonTheirs = 0; // both derived from bb-match-round-*'s roundsWonA/B via myMatchSide
let bbNextShotAt = 0;
let bbPosSendT = 0;      // counts down to the next throttled bb-pos send
let bbAvatarPhase = 0;   // local third-person avatar's own walk-cycle clock

const lobbyHud = document.getElementById('lobby-hud');
const lobbyCodeLabel = document.getElementById('lobby-code-label');
const lobbyPlayerCount = document.getElementById('lobby-player-count');
const lobbyPlayersPanel = document.getElementById('lobby-players-panel');
const lobbyPlayersList = document.getElementById('lobby-players-list');
const challengePopup = document.getElementById('challenge-popup');
const challengeText = document.getElementById('challenge-text');
const duelHud = document.getElementById('duel-hud');
const duelOpponentName = document.getElementById('duel-opponent-name');
const duelRoundScoreEl = document.getElementById('duel-round-score');
const duelOpponentHealthFill = document.getElementById('duel-opponent-health-fill');
const duelResult = document.getElementById('duel-result');
const duelRoundBanner = document.getElementById('duel-round-banner');
const weaponHudEl = document.getElementById('weapon-hud');
const matchHud = document.getElementById('match-hud');
const matchHudTitle = document.getElementById('match-hud-title');
const matchHudRoundScore = document.getElementById('match-hud-round-score');
const matchHudEnemies = document.getElementById('match-hud-enemies');
const matchHudTeammates = document.getElementById('match-hud-teammates');
const matchResult = document.getElementById('match-result');
const matchRoundBanner = document.getElementById('match-round-banner');
const matchEliminatedBanner = document.getElementById('match-eliminated-banner');

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
  if (inMatch && myMatchEliminated) return; // spectating — no shots to fire
  bbNextShotAt = nowMs + BB_WEAPON_CLIENT.cooldownMs;
  gunKick = 1;
  muzzleT = 0.05;
  gun.userData.muzzle.visible = true;
  gun.userData.flash.intensity = 2.2;
  sfxShot('deagle');
  raycaster.setFromCamera(CROSSHAIR_CENTER, camera);
  spawnTracer(raycaster.ray.at(60, new THREE.Vector3()));
  if (!bbWs || bbWs.readyState !== WebSocket.OPEN) return;
  if (inMatch) {
    // bb combat has no aim/raycast model at all (see the block comment above — the server only
    // ever checks range, never direction), so this just picks whichever living enemy is nearest,
    // matching that same arcade looseness rather than inventing a new targeting scheme.
    let nearestId = null, nearestDist = Infinity;
    for (const enemy of matchEnemies) {
      if (enemy.eliminated) continue;
      const rp = bbRemotePlayers.get(enemy.id);
      if (!rp) continue;
      const dx = player.x - rp.target.x, dz = player.z - rp.target.z;
      const dist = dx * dx + dz * dz;
      if (dist < nearestDist) { nearestDist = dist; nearestId = enemy.id; }
    }
    if (nearestId) bbWs.send(JSON.stringify({ type: 'bb-shoot', targetId: nearestId }));
    return;
  }
  bbWs.send(JSON.stringify({ type: 'bb-shoot' }));
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

function renderDuelRoundScore() {
  duelRoundScoreEl.textContent = `Round ${duelRoundsWon + duelRoundsLost + 1} · You ${duelRoundsWon} – ${duelRoundsLost} Them`;
}

function showDuelRoundBanner(message) {
  duelRoundBanner.textContent = message;
  duelRoundBanner.classList.remove('hidden');
  setTimeout(() => duelRoundBanner.classList.add('hidden'), 1800);
}

function endDuel(message) {
  // A duel that ends while its pre-fight map vote was still open (e.g. the opponent disconnects
  // mid-vote, see bb-duel-ended) never got as far as bb-duel-started, which is the only other
  // place this overlay closes on the combat-starting path — without this, the survivor is left
  // staring at the opaque, full-viewport #map-vote screen with no way back to the lobby short of
  // a reload, since it also has no close/cancel button of its own by design.
  hideMapVote();
  dueling = false;
  myOpponentId = null;
  duelRoundsWon = 0;
  duelRoundsLost = 0;
  duelHud.classList.add('hidden');
  duelResult.textContent = message;
  duelResult.classList.remove('hidden');
  setTimeout(() => duelResult.classList.add('hidden'), 2500);
  health = MAX_HEALTH;
  updateHealthBar();
  if (onlineActive) lobbyHud.classList.remove('hidden');
}

function renderMatchRoster(listEl, roster) {
  listEl.innerHTML = '';
  for (const p of roster) {
    const li = document.createElement('li');
    if (p.eliminated) li.classList.add('eliminated');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'match-hud-name';
    nameSpan.textContent = p.name;
    const healthWrap = document.createElement('span');
    healthWrap.className = 'match-hud-health-wrap';
    const healthFill = document.createElement('span');
    healthFill.className = 'match-hud-health-fill';
    healthFill.style.width = `${Math.max(0, p.health) / BB_MAX_HEALTH_CLIENT * 100}%`;
    healthWrap.appendChild(healthFill);
    li.append(nameSpan, healthWrap);
    listEl.appendChild(li);
  }
}

function renderMatchHud() {
  matchHudTitle.textContent = `Your team ${matchTeammates.length + 1} vs ${matchEnemies.length}`;
  matchHudRoundScore.textContent = `Round ${matchRoundsWonMine + matchRoundsWonTheirs + 1} · You ${matchRoundsWonMine} – ${matchRoundsWonTheirs} Them`;
  renderMatchRoster(matchHudEnemies, matchEnemies);
  renderMatchRoster(matchHudTeammates, matchTeammates);
}

function showMatchRoundBanner(message) {
  matchRoundBanner.textContent = message;
  matchRoundBanner.classList.remove('hidden');
  setTimeout(() => matchRoundBanner.classList.add('hidden'), 1800);
}

function endMatch(message) {
  // Same reasoning as endDuel's own hideMapVote() call — a match that ends while its pre-fight map
  // vote was still open (e.g. a whole side disconnects before it resolves, see bbCheckMatchEnd's
  // phase !== 'active' branch) never reaches bb-match-started, the only other place this closes.
  hideMapVote();
  dueling = false;
  inMatch = false;
  myMatchId = null;
  myMatchSide = null;
  myMatchEliminated = false;
  matchTeammates = [];
  matchEnemies = [];
  matchRoundsWonMine = 0;
  matchRoundsWonTheirs = 0;
  matchHud.classList.add('hidden');
  matchEliminatedBanner.classList.add('hidden');
  matchResult.textContent = message;
  matchResult.classList.remove('hidden');
  setTimeout(() => matchResult.classList.add('hidden'), 2500);
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
      // This connection is authoritative fresh-join state (first join OR a post-drop reconnect) —
      // any 1v1/match/plate state left over from before the socket died is now stale (the server's
      // own copy of it was already torn down in leaveBb when the old connection dropped), so reset
      // every combat/plate flag and the HUD visibility that goes with it. Without this, a mid-duel
      // or mid-match disconnect left the old HUD frozen on screen forever with no way back to the
      // free-roam lobby short of leaving the page entirely.
      dueling = false; myOpponentId = null; duelHud.classList.add('hidden'); hideMapVote();
      inMatch = false; myMatchId = null; myMatchSide = null; myMatchEliminated = false;
      matchTeammates = []; matchEnemies = []; matchHud.classList.add('hidden'); matchEliminatedBanner.classList.add('hidden');
      bbCurrentPlate = null;
      lobbyHud.classList.remove('hidden');
      for (const snapshot of data.stations || []) updateBbStationVisual(snapshot.stationId, snapshot);
      // No lobby-wide vote anymore — the shared space just starts on whatever it already is
      // (bb.currentMapId server-side, 'office' until any match's own pre-fight vote has ever
      // resolved). See bb-duel-map-vote/bb-match-map-vote for where voting now actually happens.
      activateMap(data.mapId || 'office');
      break;
    }
    case 'bb-lobby-map-changed': {
      // Broadcast to literally everyone in the lobby, not just a match's own participants — there's
      // only one shared space, so a match's own pre-fight vote changes the world for free-roamers
      // too. A bystander (not this match's own participant, who already got bb-duel-started/
      // bb-match-started with the same mapId) gets a quiet heads-up instead of the vote screen.
      activateMap(data.mapId || 'office');
      if (!dueling && !inMatch) {
        const mapInfo = BB_MAPS.find((m) => m.id === data.mapId);
        showWaveBanner(`🗺️ Lobby map changed: ${mapInfo ? mapInfo.name : data.mapId}`);
      }
      break;
    }
    case 'bb-duel-map-vote': {
      myOpponentId = data.opponentId;
      myOpponentName = data.opponentName;
      lobbyPlayersPanel.classList.add('hidden');
      challengePopup.classList.add('hidden');
      showMapVote(data.voteEndsAt, data.tally || {});
      break;
    }
    case 'bb-match-map-vote': {
      lobbyPlayersPanel.classList.add('hidden');
      challengePopup.classList.add('hidden');
      showMapVote(data.voteEndsAt, data.tally || {});
      break;
    }
    case 'bb-match-map-vote-update': {
      updateMapVoteTally(data.tally || {});
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
      hideMapVote();
      dueling = true;
      myOpponentId = data.opponentId;
      myOpponentName = data.opponentName;
      duelRoundsWon = data.roundsWon || 0;
      duelRoundsLost = data.roundsLost || 0;
      opponentHealth = BB_MAX_HEALTH_CLIENT;
      health = MAX_HEALTH;
      updateHealthBar();
      duelResult.classList.add('hidden');
      duelOpponentName.textContent = myOpponentName;
      renderDuelRoundScore();
      duelOpponentHealthFill.style.width = '100%';
      duelHud.classList.remove('hidden');
      lobbyHud.classList.add('hidden');
      removeLocalAvatar(); // first-person again — nothing to gain from also rendering yourself
      if (document.pointerLockElement !== canvas) requestPointerLockSafe();
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
    // A round win/loss — the duel itself keeps going (first to 5 round wins takes the match), so
    // this just refreshes the score/health and shows a quick banner, unlike bb-duel-won/lost below.
    case 'bb-duel-round-end': {
      duelRoundsWon = data.roundsWon;
      duelRoundsLost = data.roundsLost;
      renderDuelRoundScore();
      opponentHealth = BB_MAX_HEALTH_CLIENT;
      health = MAX_HEALTH;
      updateHealthBar();
      duelOpponentHealthFill.style.width = '100%';
      showDuelRoundBanner(data.won ? `🎯 Round won! ${duelRoundsWon}–${duelRoundsLost}` : `Round lost — ${duelRoundsWon}–${duelRoundsLost}`);
      break;
    }
    case 'bb-duel-won': awardCoins(30); endDuel(`🏆 You won the duel ${data.roundsWon}–${data.roundsLost}! 🪙 +30`); break;
    case 'bb-duel-lost': endDuel(`💀 You lost the duel ${data.roundsWon}–${data.roundsLost}`); break;
    case 'bb-duel-ended': endDuel('Duel ended — opponent left'); break;
    case 'bb-station-update': {
      updateBbStationVisual(data.stationId, data);
      break;
    }
    case 'bb-plate-rejected': {
      // The server refused a plate slot we optimistically thought we'd claimed (station locked
      // mid-match, or someone else's bb-plate-enter for the same slot won a race) — only correct
      // local state if this rejection is actually for the slot we currently believe we're on;
      // a rejection for a slot we've since moved off (or already re-requested) is stale, ignore it.
      if (bbCurrentPlate && bbCurrentPlate.stationId === data.stationId && bbCurrentPlate.side === data.side && bbCurrentPlate.slot === data.slot) {
        bbCurrentPlate = null;
        bbBlockedPlateKey = bbPlateKey(data);
        bbBlockedPlateUntil = performance.now() + 800;
      }
      break;
    }
    case 'bb-match-roster-health': {
      const teammate = matchTeammates.find((t) => t.id === data.id);
      const enemy = matchEnemies.find((e) => e.id === data.id);
      if (teammate) teammate.health = data.health;
      if (enemy) enemy.health = data.health;
      if (teammate || enemy) renderMatchHud();
      break;
    }
    case 'bb-match-started': {
      hideMapVote();
      dueling = true;
      inMatch = true;
      myMatchId = data.matchId;
      myMatchSide = data.side;
      myMatchEliminated = false;
      matchTeammates = data.teammates.map((t) => ({ ...t, health: BB_MAX_HEALTH_CLIENT, eliminated: false }));
      matchEnemies = data.enemies.map((e) => ({ ...e, health: BB_MAX_HEALTH_CLIENT, eliminated: false }));
      matchRoundsWonMine = 0;
      matchRoundsWonTheirs = 0;
      health = MAX_HEALTH;
      updateHealthBar();
      lobbyPlayersPanel.classList.add('hidden');
      challengePopup.classList.add('hidden');
      matchResult.classList.add('hidden');
      matchEliminatedBanner.classList.add('hidden');
      renderMatchHud();
      matchHud.classList.remove('hidden');
      lobbyHud.classList.add('hidden');
      removeLocalAvatar();
      if (document.pointerLockElement !== canvas) requestPointerLockSafe();
      break;
    }
    case 'bb-match-hit': {
      health = Math.max(0, health - BB_WEAPON_CLIENT.damage);
      updateHealthBar();
      flashDamage();
      sfxHurt();
      break;
    }
    case 'bb-match-hit-confirm': {
      const enemy = matchEnemies.find((e) => e.id === data.targetId);
      if (enemy) { enemy.health = data.targetHealth; renderMatchHud(); }
      showHitMarker(false);
      break;
    }
    case 'bb-match-player-eliminated': {
      const teammate = matchTeammates.find((t) => t.id === data.id);
      if (teammate) teammate.eliminated = true;
      const enemy = matchEnemies.find((e) => e.id === data.id);
      if (enemy) enemy.eliminated = true;
      if (teammate || enemy) renderMatchHud();
      break;
    }
    case 'bb-match-eliminated': {
      myMatchEliminated = true;
      matchEliminatedBanner.classList.remove('hidden');
      break;
    }
    // A round win/loss — the match itself keeps going (first to 5 round wins takes it), so this
    // just updates the score and shows a quick banner; the actual respawn/reset follows right
    // behind as its own bb-match-round-start broadcast.
    case 'bb-match-round-end': {
      matchRoundsWonMine = myMatchSide === 'a' ? data.roundsWonA : data.roundsWonB;
      matchRoundsWonTheirs = myMatchSide === 'a' ? data.roundsWonB : data.roundsWonA;
      renderMatchHud();
      const won = data.winnerSlot === myMatchSide;
      showMatchRoundBanner(won ? `🎯 Round won! ${matchRoundsWonMine}–${matchRoundsWonTheirs}` : `Round lost — ${matchRoundsWonMine}–${matchRoundsWonTheirs}`);
      break;
    }
    case 'bb-match-round-start': {
      myMatchEliminated = false;
      matchEliminatedBanner.classList.add('hidden');
      for (const t of matchTeammates) { t.health = BB_MAX_HEALTH_CLIENT; t.eliminated = false; }
      for (const e of matchEnemies) { e.health = BB_MAX_HEALTH_CLIENT; e.eliminated = false; }
      health = MAX_HEALTH;
      updateHealthBar();
      renderMatchHud();
      break;
    }
    case 'bb-match-ended': {
      if (data.won === true) awardCoins(30);
      const mine = myMatchSide === 'a' ? data.roundsWonA : data.roundsWonB;
      const theirs = myMatchSide === 'a' ? data.roundsWonB : data.roundsWonA;
      endMatch(data.won === true ? `🏆 Your team won ${mine}–${theirs}! 🪙 +30` : data.won === false ? `💀 Your team lost ${mine}–${theirs}` : 'Match ended');
      break;
    }
  }
}

function connectBb() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  bbWs = new WebSocket(`${protocol}//${location.host}`);
  bbWs.addEventListener('open', () => {
    const accountToken = localStorage.getItem('valk-account-token') || '';
    // Deliberately never sends `code` (even when launched from inside a specific chat room via
    // ?room=) — Online Play is one shared world across every room/server, not siloed per room, so
    // server.js's bb-join always falls back to the single public 'GLOBAL-LOBBY'. bbRoomCode is
    // still used elsewhere on this page (the "back to room" link above) — just not here anymore.
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
  inMatch = false; myMatchId = null; myMatchSide = null; myMatchEliminated = false;
  matchTeammates = []; matchEnemies = []; bbCurrentPlate = null;
  player.x = 0; player.y = 0; player.z = 0; vy = 0; onGround = true; hasAirMomentum = false;
  health = MAX_HEALTH;
  dead = false;
  updateHealthBar();
  weaponHudEl.classList.add('hidden');
  waveCounter.classList.add('hidden');
  lobbyHud.classList.remove('hidden');
  // Always the one shared public lobby now (see connectBb's own comment) — never room-specific.
  lobbyCodeLabel.textContent = '🌐 Public lobby';
  // Swap the whole look (and collision layout) from the outdoor crossroad to whichever online-lobby
  // map ends up active — see arenaGroup/officeGroup up near buildOffice() and activateMap further
  // down. Defaults to the office as a neutral backdrop the instant online mode starts (the map vote
  // overlay covers the screen the whole time it's undecided anyway, so what's rendered behind it
  // doesn't matter) — bb-init/bb-map-decided calls activateMap again once a real map is settled.
  arenaGroup.visible = false;
  activateMap('office');
  officeAmbient.intensity = 0.22;
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
  inMatch = false; myMatchId = null; myMatchSide = null; myMatchEliminated = false;
  matchTeammates = []; matchEnemies = []; bbCurrentPlate = null;
  lobbyHud.classList.add('hidden');
  lobbyPlayersPanel.classList.add('hidden');
  challengePopup.classList.add('hidden');
  duelHud.classList.add('hidden');
  duelResult.classList.add('hidden');
  matchHud.classList.add('hidden');
  matchResult.classList.add('hidden');
  matchEliminatedBanner.classList.add('hidden');
  weaponHudEl.classList.remove('hidden');
  waveCounter.classList.remove('hidden');
  gun.visible = true;
  teardownExtraMap();
  officeGroup.visible = false;
  activeMapId = null;
  hideMapVote();
  arenaGroup.visible = true;
  officeAmbient.intensity = 0;
  occupied.clear();
  for (const [k, v] of arenaOccupied) occupied.set(k, v);
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
// Same Escape-to-close fix already applied to every other overlay in this app — these two didn't
// have it (Block Battle's own pause overlay is driven by pointer-lock-exit, not this listener, so
// it was easy to overlook that its two lobby popups never got the same app-wide treatment).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!lobbyPlayersPanel.classList.contains('hidden')) document.getElementById('lobby-players-close-btn').click();
  if (!challengePopup.classList.contains('hidden')) document.getElementById('challenge-decline-btn').click();
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
  requestPointerLockSafe(); // no-ops into a direct unpause on touch — see its own touch branch above
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

// ---- Touch controls ----
// Adapted from firefight.js's own touch scheme (same virtual-joystick + drag-to-look + button
// pattern, already proven live for another minigame in this app): a joystick for movement, a
// drag-anywhere-on-canvas look, and dedicated buttons standing in for the mouse buttons/keys the
// desktop listeners above use. Entirely additive — none of the mouse/keyboard code above changes,
// this just feeds the same shared state (touchMoveF/R, yaw/pitch, mouseHeld, scoped, keys,
// wantJump/wantSlide) from touch events instead when isTouchDevice.
const touchControlsEl = document.getElementById('touch-controls');
const touchScopeBtn = document.getElementById('touch-scope'); // referenced from tick() below too, so declared outside the isTouchDevice block
if (isTouchDevice) {
  touchControlsEl.classList.remove('hidden');
  document.getElementById('hint-controls').innerHTML =
    'Move: left joystick &nbsp;&middot;&nbsp; Look: drag anywhere on screen<br>' +
    'Fire: 🔫 &nbsp;&middot;&nbsp; Scope: hold 🎯 (snipers only) &nbsp;&middot;&nbsp; Jump: ⤒<br>' +
    'Crouch: hold ⬇️ &nbsp;&middot;&nbsp; Slide: tap ⬇️ while moving &nbsp;&middot;&nbsp; Knife: 🥊 toggles<br>' +
    'Upgrade/Save buttons: tap directly &nbsp;&middot;&nbsp; After dying: 🏠 Change Mode';

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
    touchMoveR = dx / JOYSTICK_RADIUS;
    touchMoveF = -dy / JOYSTICK_RADIUS;
  }
  function resetJoystick() {
    joystickTouchId = null;
    touchMoveF = 0; touchMoveR = 0;
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

  // Look: drag anywhere on the canvas that isn't the joystick/a button — those are separate,
  // higher-stacked elements with pointer-events:auto, so a touch starting on one of them never
  // reaches this listener at all (its target is that element, not the canvas).
  const TOUCH_LOOK_SENS = 0.0055;
  let lookTouchId = null, lastLookX = 0, lastLookY = 0;
  canvas.addEventListener('touchstart', (e) => {
    if (paused || dead || lookTouchId !== null) return;
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
      const sens = TOUCH_LOOK_SENS * (scopedNow() ? SCOPE_ZOOM : 1); // finer aim under the scope, same as mousemove
      yaw -= dx * sens;
      pitch = Math.max(-1.45, Math.min(1.45, pitch - dy * sens));
    }
  }, { passive: false });
  function releaseLookTouch(e) { for (const t of e.changedTouches) if (t.identifier === lookTouchId) lookTouchId = null; }
  canvas.addEventListener('touchend', releaseLookTouch);
  canvas.addEventListener('touchcancel', releaseLookTouch);

  const touchFireBtn = document.getElementById('touch-fire');
  touchFireBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (dead || paused) return;
    if (onlineActive && !dueling) return; // lobby is free-roam only, same gate mousedown uses
    mouseHeld = true; // automatics keep firing from the main loop while held, same as desktop
    tryFire(performance.now());
  }, { passive: false });
  touchFireBtn.addEventListener('touchend', () => { mouseHeld = false; });
  touchFireBtn.addEventListener('touchcancel', () => { mouseHeld = false; });

  touchScopeBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (dead || paused) return;
    if (onlineActive && !dueling) return; // lobby is free-roam only, same gate mousedown uses for the right-click scope
    scoped = true;
  }, { passive: false });
  touchScopeBtn.addEventListener('touchend', () => { scoped = false; });
  touchScopeBtn.addEventListener('touchcancel', () => { scoped = false; });

  document.getElementById('touch-knife').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!dead && !paused) toggleKnife();
  }, { passive: false });

  const touchJumpBtn = document.getElementById('touch-jump');
  touchJumpBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!keys.has('jump')) wantJump = true;
    keys.add('jump');
  }, { passive: false });
  touchJumpBtn.addEventListener('touchend', () => keys.delete('jump'));
  touchJumpBtn.addEventListener('touchcancel', () => keys.delete('jump'));

  const touchCrouchBtn = document.getElementById('touch-crouch');
  touchCrouchBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!keys.has('crouch')) wantSlide = true; // fresh press — same "tap while moving slides" rule the C key uses
    keys.add('crouch');
  }, { passive: false });
  touchCrouchBtn.addEventListener('touchend', () => keys.delete('crouch'));
  touchCrouchBtn.addEventListener('touchcancel', () => keys.delete('crouch'));
}

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
  openLoadoutPicker(() => requestPointerLockSafe());
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
    if (isTouchDevice) {
      // touchMoveF/touchMoveR are analog (-1..1), driven by the on-screen joystick below — the
      // hypot-normalize a couple lines down turns any nonzero tilt into a full-speed direction,
      // same "digital" feel the keyboard already has, just with an actual angle instead of 8-way.
      fwd = touchMoveF;
      strafe = touchMoveR;
    } else {
      if (keys.has('forward')) fwd += 1;
      if (keys.has('back')) fwd -= 1;
      if (keys.has('right')) strafe += 1;
      if (keys.has('left')) strafe -= 1;
    }
  }

  // Settings' Auto Sprint treats sprint as always-held (the physical Shift key still works too,
  // it's just redundant); computed once here so both the speed calc below and the slide-trigger
  // gating further down agree on whether "sprinting" is currently true. Touch has no dedicated
  // sprint button (screen space is already tight) — movement is always sprint-speed unless
  // crouching, the same default plenty of mobile shooters use for a joystick-driven control scheme.
  const sprintActive = settings.autoSprint || keys.has('sprint') || isTouchDevice;

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
      : sprintActive ? SPRINT_SPEED
      : WALK_SPEED;
    vx = (-sinY * f + cosY * s) * speed;
    vz = (-cosY * f - sinY * s) * speed;
  }

  // A slide-jump keeps the slide's speed while airborne; input only bends it.
  if (hasAirMomentum && !onGround) {
    vx = airMomX + vx * 0.25;
    vz = airMomZ + vz * 0.25;
  }

  // A fresh Ctrl tap while sprinting on the ground converts the run into a slide. Settings' Easy
  // Slide drops the "must be sprinting" requirement entirely — any crouch-tap while moving at
  // walk speed or faster slides, matching Auto Sprint/Easy Slide's "seamless single-taps" pitch.
  if (wantSlide) {
    wantSlide = false;
    const movingFast = (vx !== 0 || vz !== 0) && Math.hypot(vx, vz) >= WALK_SPEED - 0.01;
    const slideAllowed = sprintActive || (settings.easySlide && movingFast);
    if (!dead && !sliding && onGround && slideAllowed && movingFast) {
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
    const waveCoins = 20 + wave * 4; // later waves are harder-earned, so they pay a bit more
    awardCoins(waveCoins);
    showWaveBanner(`Wave ${wave} cleared! 🪙 +${waveCoins}`);
    sfxWaveClear();
    nextWaveT = WAVE_BREAK;
  }
  if (mode === 'wave' && !dead && nextWaveT >= 0) {
    nextWaveT -= dt;
    if (nextWaveT <= 0) startWave();
  }

  // Jump Shards spin and pulse like the health packs below, just cyan instead of green and
  // stationary (no bob) so they read as landmarks, not consumables you might mistake for health.
  for (const entry of activeShards) {
    entry.mesh.rotation.y += 1.6 * dt;
    entry.mesh.rotation.x += 0.9 * dt;
    entry.mesh.material.emissiveIntensity = 0.9 + Math.sin(now / 220) * 0.5;
  }
  updateShardPickups();

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

  // Gun recoil eases back; muzzle flash is a couple frames long. Settings' Camera Zoom Effects
  // toggle (RIVALS' "screen-shake and heavy weapon-recoil animations" switch) suppresses the
  // visual kick specifically — shots still fire and hit exactly the same either way, gunKick
  // still decays normally underneath so nothing else that reads it (reload dip below) breaks.
  gunKick *= Math.exp(-12 * dt);
  gun.position.z = GUN_Z + (settings.cameraEffects ? gunKick * 0.07 : 0);
  gun.rotation.x = settings.cameraEffects ? gunKick * 0.18 : 0;
  if (muzzleT > 0) {
    muzzleT -= dt;
    gun.userData.flash.intensity = Math.max(0, muzzleT / 0.05) * 2.2;
    if (muzzleT <= 0) gun.userData.muzzle.visible = false;
  }

  // Reload animation: the old magazine drops free, there's a beat where the gun is empty, then a
  // fresh one slides back up into place, while the whole gun dips and tilts down like you're
  // looking at your hands to do it. Weapons with no gun.userData.mag (revolvers, pump/tube-fed
  // shotgun, RPG/launcher — see markMag) just get the dip/tilt with no magazine to swap.
  if (!knifeOut) {
    const reloadSpec = WEAPONS[weapon];
    if (isReloading && reloadSpec.reload > 0) {
      const p = Math.min(1, Math.max(0, 1 - (reloadEndAt - now) / (reloadSpec.reload * 1000)));
      if (gun.userData.mag) {
        const mag = gun.userData.mag;
        let drop, visible = true;
        if (p < 0.35) drop = (p / 0.35) * -0.3;
        else if (p < 0.55) { visible = false; drop = -0.3; }
        else drop = (1 - (p - 0.55) / 0.45) * -0.3;
        mag.position.y = mag.userData.restY + drop;
        mag.visible = visible;
      }
      const dip = Math.sin(p * Math.PI);
      gun.position.y -= dip * 0.05;
      gun.rotation.x += dip * 0.35;
    } else if (gun.userData.mag) {
      gun.userData.mag.position.y = gun.userData.mag.userData.restY;
      gun.userData.mag.visible = true;
    }
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
  // Slide legs: kick out fast at the start of the slide (one leg extended forward, the other
  // tucked under) and hold that pose for the slide's duration, matching slideT's own 0..SLIDE_TIME
  // range so the legs stay in sync with the slide's actual speed decay above. Hidden in the online
  // lobby's third-person view (onlineActive && !dueling) — that camera already shows the real
  // local avatar body (see updateLocalAvatar/ensureLocalAvatar), so the first-person legs would be
  // both redundant and, being camera-attached, visibly wrong from a third-person angle.
  const showSlideLegs = sliding && !(onlineActive && !dueling);
  slideLegs.visible = showSlideLegs;
  if (showSlideLegs) {
    const kick = Math.min(slideT / 0.15, 1); // quick kick-out, not an instant snap
    slideLegLeft.rotation.x = -1.2 * kick;
    slideLegRight.rotation.x = 0.5 * kick;
    slideLegs.position.y = -0.03 * Math.sin(Math.min(slideT / SLIDE_TIME, 1) * Math.PI); // a small settle-and-lift bob
  }

  const eyeTarget = sliding ? EYE_SLIDE : keys.has('crouch') ? EYE_CROUCH : EYE_STAND;
  eye += (eyeTarget - eye) * (1 - Math.exp(-14 * dt));
  if (onlineActive) {
    updateRemotePlayers(dt);
    sendBbPos(dt);
  }
  if (onlineActive && !dueling) {
    updateBbPlateDetection();
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
  // A scoped sniper zooms the whole view 40% in and takes over from the sprint/slide FOV boost
  // while it's held. Both figures scale off the Settings FOV base (default 70) instead of a
  // hardcoded value, so the slider genuinely changes the whole game's field of view.
  const zoomed = scopedNow();
  // Dims the touch scope button when the current weapon can't actually zoom, same "don't jump the
  // layout around on every weapon swap" reasoning as firefight's own touch-aim dimming.
  if (isTouchDevice) touchScopeBtn.classList.toggle('unavailable', !WEAPONS[weapon].scope);
  const fovTarget = zoomed ? settings.fov * SCOPE_ZOOM
    : (sliding || hasAirMomentum || (sprintActive && (fwd !== 0 || strafe !== 0))) ? settings.fov + 8 : settings.fov;
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
