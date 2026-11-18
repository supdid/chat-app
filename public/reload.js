// Reload — a Valk browser gun game. Original weapons, original arena, and the whole point of the
// thing: every gun has its own hand-animated reload built from moving parts (mags drop, slides
// lock back, cylinders swing out, bolts cycle, shells go in one at a time).
//
// How the animation system works (read this before touching a weapon):
//  * Each weapon is a THREE.Group ("gun") built out of named parts (mag, slide, bolt, lh, rh, ...).
//    lh/rh are the left/right hands and are children of the gun, so they tilt with it.
//  * Every part remembers its rest pose (userData.rp / rr). An animation is a set of keyframe
//    tracks, one per part: [time, [x,y,z], [rx,ry,rz], ease]. Positions are absolute in the gun's
//    own space (the "gun" track itself is relative to the hip/aim holder). Parts with no track in
//    the current animation sit at rest (or at their "locked" pose, e.g. a slide locked back on empty).
//  * Animations also carry timed events (sounds, a mag dropping away, ammo being granted).
//  * Ammo is only granted at the moment the new mag seats, so switching weapon mid-reload cancels it.
'use strict';

// ---------------------------------------------------------------- basics
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.autoClear = false;
// Realistic rendering: film-style tone mapping, correct colour space, soft sun shadows.
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 400);
camera.rotation.order = 'YXZ';
scene.add(camera);

// Viewmodel: its own scene + camera, drawn on top after a depth clear, so guns never clip into walls.
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
const vmRoot = new THREE.Group();
vmScene.add(vmRoot);
vmScene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a3c2c, 0.5));
const vmSun = new THREE.DirectionalLight(0xfff1dd, 2.4);
vmSun.position.set(0.6, 1, 0.4);
vmScene.add(vmSun);
const vmFill = new THREE.DirectionalLight(0x9fc4ff, 0.6);
vmFill.position.set(-1, 0.2, 0.6);
vmScene.add(vmFill);
// Brief warm light at the muzzle when you fire — lights up your hands and gun for a frame.
const vmFlashLight = new THREE.PointLight(0xffb060, 0, 1.2, 2);
vmScene.add(vmFlashLight);

// Image-based lighting: a little studio "room" rendered into a reflection map, so metal parts
// reflect something and everything gets soft fill light from all directions.
function makeEnvMap() {
  const pm = new THREE.PMREMGenerator(renderer);
  const room = new THREE.Scene();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 30), new THREE.MeshBasicMaterial({ color: 0x55585e, side: THREE.BackSide }));
  room.add(shell);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0x3a3630 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -6.9; room.add(floor);
  const panel = (w, h, x, y, z, rx, ry, color, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); room.add(m);
  };
  panel(14, 8, 0, 6.8, 0, Math.PI / 2, 0, 0xfff0dc, 7);        // big warm skylight
  panel(5, 3, 14.8, 2, -3, 0, -Math.PI / 2, 0xffd8a8, 9);       // sun-side window
  panel(6, 2, -14.8, 1, 4, 0, Math.PI / 2, 0xbcd4ff, 3);        // cool fill
  panel(8, 1.5, 0, 2, -14.8, 0, 0, 0xffffff, 4);
  const tex = pm.fromScene(room, 0.03).texture;
  pm.dispose();
  return tex;
}
const ENV = makeEnvMap();
vmScene.environment = ENV;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = vmCam.aspect = w / h;
  camera.updateProjectionMatrix();
  vmCam.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const sc = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const Z3 = [0, 0, 0];

// ---------------------------------------------------------------- sound (all synthesized)
let AC = null;
let noiseBuf = null;
function ac() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function noise(dur, freq, gain, type = 'bandpass', q = 1, delay = 0, endFreq) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const src = a.createBufferSource(); src.buffer = noiseBuf;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(a.destination);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
function tone(freq, dur, gain, type = 'square', delay = 0, endFreq) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
const click = (f = 3200, g = 0.25, d = 0) => { noise(0.03, f, g, 'highpass', 0.7, d); tone(f / 2.5, 0.02, g * 0.3, 'square', d); };
const SFX = {
  shot(k) {
    const p = { pistol: [1800, 0.5, 0.18], smg: [2200, 0.4, 0.12], rifle: [1500, 0.55, 0.2], lmg: [1200, 0.6, 0.22],
      shotgun: [900, 0.8, 0.35], revolver: [1100, 0.75, 0.35], sniper: [800, 0.9, 0.5], launcher: [400, 0.6, 0.5] }[k] || [1500, 0.5, 0.2];
    noise(p[2], p[0], p[1], 'lowpass', 0.8);
    tone(90, p[2] * 0.8, p[1] * 0.4, 'sine', 0, 40);
  },
  magout() { click(2400, 0.22); noise(0.06, 900, 0.18, 'bandpass', 2, 0.03); },
  magin() { click(2800, 0.25); click(3600, 0.2, 0.045); },
  slap() { noise(0.05, 700, 0.35, 'lowpass', 1); click(3000, 0.2, 0.01); },
  slide() { noise(0.09, 2500, 0.25, 'bandpass', 1.2, 0, 5200); click(3600, 0.3, 0.08); },
  boltBack() { noise(0.08, 3000, 0.2, 'bandpass', 1.5, 0, 1800); },
  boltFwd() { noise(0.07, 1800, 0.2, 'bandpass', 1.5, 0, 3200); click(3800, 0.25, 0.06); },
  shell() { click(1800, 0.2); noise(0.05, 600, 0.12, 'lowpass', 1, 0.02); },
  pump() { noise(0.07, 1400, 0.3, 'bandpass', 1, 0, 700); noise(0.07, 900, 0.3, 'bandpass', 1, 0.11, 2000); click(2600, 0.2, 0.17); },
  cylOpen() { click(2200, 0.25); noise(0.1, 1500, 0.1, 'bandpass', 3, 0.02); },
  cylShut() { noise(0.05, 900, 0.35, 'lowpass', 1); click(3000, 0.3, 0.005); },
  spin() { for (let i = 0; i < 9; i++) click(4200, 0.1 * (1 - i / 10), i * 0.035); },
  casings() { for (let i = 0; i < 6; i++) tone(rand(3500, 5200), 0.12, 0.05, 'sine', 0.25 + i * 0.04); },
  tink(d = 0.25) { tone(rand(3800, 5200), 0.1, 0.05, 'sine', d); },
  lid() { noise(0.06, 1200, 0.25, 'bandpass', 1); click(2000, 0.2, 0.02); },
  rocket() { noise(0.15, 500, 0.3, 'lowpass', 1); tone(160, 0.2, 0.15, 'sawtooth', 0.02, 80); },
  dry() { click(4500, 0.15); },
  knife() { noise(0.18, 3000, 0.25, 'bandpass', 2, 0, 900); },
  hit() { tone(1900, 0.05, 0.12, 'square'); },
  head() { tone(2600, 0.09, 0.15, 'triangle'); tone(3900, 0.12, 0.1, 'sine', 0.03); },
  kill() { tone(880, 0.08, 0.12, 'square'); tone(1320, 0.12, 0.12, 'square', 0.07); },
  hurt() { noise(0.12, 400, 0.3, 'lowpass'); },
  boom() { noise(0.7, 300, 0.9, 'lowpass', 0.6, 0, 60); tone(60, 0.6, 0.5, 'sine', 0, 30); },
  level() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 0.12, 'square', i * 0.07)); },
  step() { noise(0.04, 300, 0.05, 'lowpass'); },
};

// ---------------------------------------------------------------- procedural textures
// Everything is generated on canvases at load (no downloaded art): colour maps, plus normal maps
// built from height maps so surfaces catch light like real concrete, wood, fabric and metal.
function cnv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function blotches(ctx, w, h, n, rMin, rMax, colors, alpha) {
  for (let i = 0; i < n; i++) {
    const r = rand(rMin, rMax), x = Math.random() * w, y = Math.random() * h;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = colors[Math.floor(Math.random() * colors.length)];
    g.addColorStop(0, `rgba(${c},${alpha})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { ctx.save(); ctx.translate(ox, oy); ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore(); }
  }
}
function speckle(ctx, w, h, n, size, colors, alpha) {
  for (let i = 0; i < n; i++) {
    const c = colors[Math.floor(Math.random() * colors.length)];
    ctx.fillStyle = `rgba(${c},${Math.random() * alpha})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, size * Math.random() + 0.5, size * Math.random() + 0.5);
  }
}
// Height canvas (grey) -> tangent-space normal map canvas.
function normalFrom(hc, strength = 2) {
  const w = hc.width, h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = cnv(w, h), octx = out.getContext('2d'), img = octx.createImageData(w, h), d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const nx = -dx, ny = dy, nz = 1, l = Math.hypot(nx, ny, nz), i = (y * w + x) * 4;
    d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (nz / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  return out;
}
function tex(c, { color = true, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const TEX = {};
(() => {
  // concrete
  const cc = cnv(512), c1 = cc.getContext('2d');
  c1.fillStyle = '#7b7c79'; c1.fillRect(0, 0, 512, 512);
  blotches(c1, 512, 512, 90, 30, 140, ['70,70,66', '120,118,112', '95,92,85'], 0.22);
  speckle(c1, 512, 512, 9000, 2, ['40,40,40', '180,180,175'], 0.25);
  c1.strokeStyle = 'rgba(60,60,58,0.55)'; c1.lineWidth = 2;
  c1.strokeRect(1, 1, 510, 510); // expansion joints at tile edges
  const ch = cnv(512), h1 = ch.getContext('2d');
  h1.fillStyle = '#808080'; h1.fillRect(0, 0, 512, 512);
  blotches(h1, 512, 512, 60, 20, 90, ['60,60,60', '170,170,170'], 0.25);
  speckle(h1, 512, 512, 5000, 1.2, ['40,40,40'], 0.45);
  h1.fillStyle = '#303030'; h1.fillRect(0, 0, 512, 3); h1.fillRect(0, 0, 3, 512);
  TEX.concreteC = cc; TEX.concreteN = normalFrom(ch, 1.6);
  // wall panels (concrete with panel seams and a painted hazard band)
  const wc = cnv(512), w1 = wc.getContext('2d');
  w1.drawImage(cc, 0, 0); w1.fillStyle = 'rgba(160,160,155,0.25)'; w1.fillRect(0, 0, 512, 512);
  w1.fillStyle = 'rgba(40,40,40,0.6)'; w1.fillRect(0, 254, 512, 4); w1.fillRect(254, 0, 4, 512);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { w1.fillStyle = 'rgba(30,30,30,0.6)'; w1.beginPath(); w1.arc(64 + i * 128, 64 + j * 128, 5, 0, 7); w1.fill(); }
  blotches(w1, 512, 512, 25, 10, 60, ['70,55,40'], 0.15); // water stains
  const wh = cnv(512), wh1 = wh.getContext('2d'); wh1.drawImage(ch, 0, 0);
  wh1.fillStyle = '#202020'; wh1.fillRect(0, 254, 512, 4); wh1.fillRect(254, 0, 4, 512);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { wh1.fillStyle = '#101010'; wh1.beginPath(); wh1.arc(64 + i * 128, 64 + j * 128, 5, 0, 7); wh1.fill(); }
  TEX.wallC = wc; TEX.wallN = normalFrom(wh, 2);
  // corrugated metal (containers): ridges in the normal map, paint + rust in colour
  const rh = cnv(256), r1 = rh.getContext('2d');
  for (let x = 0; x < 256; x++) { const v = 128 + Math.sin(x / 256 * Math.PI * 2 * 16) * 110; r1.fillStyle = `rgb(${v},${v},${v})`; r1.fillRect(x, 0, 1, 256); }
  speckle(r1, 256, 256, 1500, 2, ['90,90,90'], 0.4);
  TEX.corrN = normalFrom(rh, 5);
  // wood crate
  const wo = cnv(256), o1 = wo.getContext('2d');
  for (let i = 0; i < 8; i++) {
    o1.fillStyle = `rgb(${150 + rand(-15, 15)},${112 + rand(-12, 12)},${70 + rand(-10, 10)})`; o1.fillRect(0, i * 32, 256, 32);
    for (let k = 0; k < 40; k++) { o1.strokeStyle = `rgba(80,50,25,${rand(0.05, 0.2)})`; o1.beginPath(); const y = i * 32 + rand(2, 30); o1.moveTo(0, y); o1.bezierCurveTo(80, y + rand(-3, 3), 170, y + rand(-3, 3), 256, y + rand(-2, 2)); o1.stroke(); }
    o1.fillStyle = 'rgba(40,25,12,0.7)'; o1.fillRect(0, i * 32, 256, 2);
  }
  o1.strokeStyle = 'rgba(90,62,35,1)'; o1.lineWidth = 22; o1.strokeRect(11, 11, 234, 234);
  o1.lineWidth = 16; o1.beginPath(); o1.moveTo(20, 20); o1.lineTo(236, 236); o1.stroke();
  speckle(o1, 256, 256, 600, 2, ['30,20,10'], 0.4);
  const woh = cnv(256), oh = woh.getContext('2d');
  oh.fillStyle = '#909090'; oh.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) { oh.fillStyle = '#303030'; oh.fillRect(0, i * 32, 256, 2); }
  oh.strokeStyle = '#c0c0c0'; oh.lineWidth = 22; oh.strokeRect(11, 11, 234, 234); oh.lineWidth = 16; oh.beginPath(); oh.moveTo(20, 20); oh.lineTo(236, 236); oh.stroke();
  TEX.woodC = wo; TEX.woodN = normalFrom(woh, 4);
  // fabric (camo uniform / sleeves)
  const fb = cnv(256), f1 = fb.getContext('2d');
  f1.fillStyle = '#7d7254'; f1.fillRect(0, 0, 256, 256);
  blotches(f1, 256, 256, 30, 14, 40, ['92,98,64', '110,92,64', '150,138,105', '70,66,48'], 0.9);
  speckle(f1, 256, 256, 3000, 1.5, ['40,40,30', '200,190,160'], 0.15);
  const fh = cnv(128), fh1 = fh.getContext('2d');
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const v = 128 + (((x >> 1) + (y >> 1)) % 2 ? 40 : -40) + rand(-20, 20); fh1.fillStyle = `rgb(${v},${v},${v})`; fh1.fillRect(x, y, 1, 1); }
  TEX.fabricC = fb; TEX.fabricN = normalFrom(fh, 1.5);
  // grip stipple / leather
  const st = cnv(128), s1 = st.getContext('2d');
  s1.fillStyle = '#808080'; s1.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { s1.fillStyle = Math.random() < 0.5 ? '#c8c8c8' : '#404040'; s1.beginPath(); s1.arc(Math.random() * 128, Math.random() * 128, rand(0.8, 2), 0, 7); s1.fill(); }
  TEX.stippleN = normalFrom(st, 3);
  const le = cnv(128), l1 = le.getContext('2d');
  l1.fillStyle = '#808080'; l1.fillRect(0, 0, 128, 128);
  blotches(l1, 128, 128, 120, 2, 6, ['60,60,60', '180,180,180'], 0.5);
  TEX.leatherN = normalFrom(le, 2);
  // metal wear: roughness variation + fine scratches
  const mr = cnv(256), m1 = mr.getContext('2d');
  m1.fillStyle = '#7a7a7a'; m1.fillRect(0, 0, 256, 256);
  blotches(m1, 256, 256, 40, 10, 50, ['100,100,100', '150,150,150'], 0.4);
  for (let i = 0; i < 140; i++) { m1.strokeStyle = `rgba(40,40,40,${rand(0.2, 0.6)})`; m1.lineWidth = rand(0.4, 1.2); m1.beginPath(); const x = Math.random() * 256, y = Math.random() * 256, a = rand(0, Math.PI), l = rand(4, 30); m1.moveTo(x, y); m1.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); m1.stroke(); }
  TEX.metalR = mr; TEX.metalN = normalFrom(mr, 0.8);
})();
const T = {
  concrete: tex(TEX.concreteC), concreteN: tex(TEX.concreteN, { color: false }),
  wall: tex(TEX.wallC), wallN: tex(TEX.wallN, { color: false }),
  corrN: tex(TEX.corrN, { color: false }),
  wood: tex(TEX.woodC), woodN: tex(TEX.woodN, { color: false }),
  fabric: tex(TEX.fabricC), fabricN: tex(TEX.fabricN, { color: false, repeat: [3, 3] }),
  stippleN: tex(TEX.stippleN, { color: false, repeat: [2, 2] }), leatherN: tex(TEX.leatherN, { color: false, repeat: [2, 2] }),
  metalR: tex(TEX.metalR, { color: false }), metalN: tex(TEX.metalN, { color: false }),
};

// ---------------------------------------------------------------- materials + mesh helpers
const std = (o) => new THREE.MeshStandardMaterial(o);
const MAT = {
  metal: std({ color: 0x2c2e32, metalness: 0.85, roughness: 0.42, roughnessMap: T.metalR, normalMap: T.metalN, normalScale: new THREE.Vector2(0.25, 0.25) }),
  dark: std({ color: 0x1a1b1e, metalness: 0.7, roughness: 0.5, roughnessMap: T.metalR }),
  poly: std({ color: 0x2a2c30, metalness: 0.05, roughness: 0.72, normalMap: T.stippleN, normalScale: new THREE.Vector2(0.35, 0.35) }),
  tan: std({ color: 0x6b5a42, metalness: 0.15, roughness: 0.62, roughnessMap: T.metalR }),
  orange: std({ color: 0x5e3b22, metalness: 0.55, roughness: 0.45, roughnessMap: T.metalR }), // bronze cerakote accents
  teal: std({ color: 0x33403f, metalness: 0.5, roughness: 0.45 }),
  brass: std({ color: 0xc9993c, metalness: 1.0, roughness: 0.28 }),
  red: std({ color: 0x6e1d18, metalness: 0.25, roughness: 0.5, roughnessMap: T.metalR }),
  olive: std({ color: 0x4a5136, metalness: 0.1, roughness: 0.7, normalMap: T.stippleN, normalScale: new THREE.Vector2(0.2, 0.2) }),
  steel: std({ color: 0xb4bac2, metalness: 0.95, roughness: 0.24, roughnessMap: T.metalR }),
  glove: std({ color: 0x2b2c2f, metalness: 0, roughness: 0.82, normalMap: T.leatherN, normalScale: new THREE.Vector2(0.5, 0.5) }),
  gloveDark: std({ color: 0x18191b, metalness: 0, roughness: 0.6 }),
  sleeve: std({ map: T.fabric, normalMap: T.fabricN, roughness: 0.95, metalness: 0 }),
  cuff: std({ color: 0x3b3d35, roughness: 0.9, metalness: 0 }),
  glass: std({ color: 0x0c1418, roughness: 0.05, metalness: 0.6, emissive: 0x1a0000 }),
  dot: new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
  flash: new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
};
// Port of three's RoundedBoxGeometry (examples/jsm), so nothing has hard 90-degree edges.
// Geometries are cached by size since guns reuse lots of identical little parts.
const _rbCache = new Map();
function roundedBoxGeo(w, h, d, r) {
  const key = [w, h, d, r].map((v) => v.toFixed(4)).join(',');
  if (_rbCache.has(key)) return _rbCache.get(key);
  const segments = 5;
  r = Math.min(w / 2, h / 2, d / 2, r);
  const g = new THREE.BoxGeometry(1, 1, 1, segments, segments, segments).toNonIndexed();
  const pos = g.attributes.position.array, nor = g.attributes.normal.array;
  const half = new THREE.Vector3(w, h, d).divideScalar(2).subScalar(r);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), hs = 0.5 / segments;
  for (let i = 0; i < pos.length; i += 3) {
    p.fromArray(pos, i); n.copy(p);
    n.x -= Math.sign(n.x) * hs; n.y -= Math.sign(n.y) * hs; n.z -= Math.sign(n.z) * hs; n.normalize();
    pos[i] = half.x * Math.sign(p.x) + n.x * r; pos[i + 1] = half.y * Math.sign(p.y) + n.y * r; pos[i + 2] = half.z * Math.sign(p.z) + n.z * r;
    nor[i] = n.x; nor[i + 1] = n.y; nor[i + 2] = n.z;
  }
  g.attributes.position.needsUpdate = true;
  _rbCache.set(key, g);
  return g;
}
function grp(parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rx, ry, rz); parent.add(g); return g;
}
function box(w, h, d, mat, x, y, z, parent, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(roundedBoxGeo(w, h, d, Math.min(w, h, d) * 0.28), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m;
}
function cyl(r, len, mat, x, y, z, parent, axis = 'z', seg = 24, r2) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2 == null ? r : r2, r, len, seg), mat);
  m.position.set(x, y, z);
  if (axis === 'z') m.rotation.x = Math.PI / 2; else if (axis === 'x') m.rotation.z = Math.PI / 2;
  parent.add(m); return m;
}
function sphere(r, mat, x, y, z, parent, ws = 16, hs = 12) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat); m.position.set(x, y, z); parent.add(m); return m;
}
// A limb segment: a cylinder with rounded ends, hanging down -y from its group's origin.
function limb(parent, r1, r2, len, mat) {
  const m = cyl(r1, len, mat, 0, -len / 2, 0, parent, 'y', 16, r2);
  sphere(r2, mat, 0, 0, 0, parent, 12, 8);
  return m;
}
// A cartridge pointing along -z (bullet forward), base at z=0.
function round(parent, x, y, z, len = 0.04, r = 0.005, tip = MAT.brass) {
  const g = grp(parent, x, y, z);
  cyl(r, len * 0.65, MAT.brass, 0, 0, -len * 0.33, g, 'z', 12);
  cyl(r * 0.9, len * 0.35, tip, 0, 0, -len * 0.82, g, 'z', 12, r * 0.3);
  return g;
}
// Picatinny-style rail: a bar with cross slots.
function rail(parent, len, x, y, z) {
  const g = grp(parent, x, y, z);
  box(0.022, 0.008, len, MAT.dark, 0, 0, 0, g);
  const n = Math.floor(len / 0.01);
  for (let i = 0; i < n; i += 2) box(0.024, 0.005, 0.0045, MAT.dark, 0, 0.005, -len / 2 + i * 0.01 + 0.005, g);
  return g;
}
function trigger(parent, x, y, z) {
  const tg = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0032, 8, 20, Math.PI), MAT.dark);
  tg.position.set(x, y, z); tg.rotation.set(0, Math.PI / 2, Math.PI); parent.add(tg);
  const tr = box(0.005, 0.016, 0.006, MAT.steel, x, y - 0.004, z + 0.002, parent, 0.3);
  return tr;
}
// drop = how steeply the forearm angles down and away (radians). The trigger hand uses a steep
// angle so its arm never hides the magwell the other hand is working on.
// A gloved hand with jointed fingers curled into a grip, a padded knuckle guard, a cuff and a
// fabric sleeve. Origin is the palm centre; fingers point toward -z.
function makeHand(drop = 0.5) {
  const h = new THREE.Group();
  box(0.05, 0.024, 0.066, MAT.glove, 0, 0.004, 0, h);
  box(0.048, 0.01, 0.02, MAT.gloveDark, 0, 0.018, -0.024, h); // knuckle pad
  const lens = [[1, 0.019], [1.08, 0.007], [1.02, -0.005], [0.82, -0.017]];
  for (const [k, x] of lens) {
    let j = grp(h, x, 0.002, -0.034, -0.35);
    const segs = [0.02 * k, 0.015 * k, 0.012 * k];
    segs.forEach((len, si) => {
      cyl(0.0058 - si * 0.0004, len, MAT.glove, 0, 0, -len / 2, j, 'z', 10);
      sphere(0.0058 - si * 0.0004, MAT.glove, 0, 0, 0, j, 10, 8);
      j = grp(j, 0, 0, -len, -0.85);
    });
    sphere(0.005, MAT.glove, 0, 0, 0, j, 8, 6);
  }
  const th = grp(h, 0.024, -0.004, -0.012, -0.25, -0.75, 0.35);
  cyl(0.0075, 0.024, MAT.glove, 0, 0, -0.012, th, 'z', 10);
  const th2 = grp(th, 0, 0, -0.024, -0.25, -0.25, 0);
  cyl(0.0065, 0.02, MAT.glove, 0, 0, -0.01, th2, 'z', 10); sphere(0.0065, MAT.glove, 0, 0, -0.02, th2, 8, 6);
  const arm = grp(h, 0, -0.006, 0.03, drop);
  cyl(0.029, 0.045, MAT.cuff, 0, 0, 0.012, arm, 'z', 18);
  box(0.062, 0.012, 0.03, MAT.gloveDark, 0, 0.027, 0.012, arm); // velcro strap
  cyl(0.036, 0.34, MAT.sleeve, 0, 0, 0.2, arm, 'z', 18, 0.043);
  return h;
}

// ---------------------------------------------------------------- animation core
const EASE = {
  s: (u) => u * u * (3 - 2 * u),                    // smooth in/out
  l: (u) => u,                                      // linear
  o: (u) => 1 - (1 - u) * (1 - u) * (1 - u),        // snappy out
  i: (u) => u * u * u,                              // slow start
};
function sampleTrack(keys, t) {
  if (t <= keys[0][0]) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t <= b[0]) {
      const u = EASE[b[3] || 's']((t - a[0]) / ((b[0] - a[0]) || 1));
      return [t, lerp3(a[1], b[1], u), lerp3(a[2], b[2], u)];
    }
  }
  return keys[keys.length - 1];
}
function mkDef(dur, tracks, events = []) {
  for (const k in tracks) tracks[k].sort((a, b) => a[0] - b[0]);
  events.sort((a, b) => a[0] - b[0]);
  return { dur, tracks, events };
}
function scaleDef(d, s) {
  const tracks = {};
  for (const k in d.tracks) tracks[k] = d.tracks[k].map((key) => [key[0] * s, key[1], key[2], key[3]]);
  return { dur: d.dur * s, tracks, events: d.events.map(([t, f]) => [t * s, f]) };
}

// ---------------------------------------------------------------- shared animation pieces
// Points in the gun's own space that only exist while you look at them get hidden by default.
function reg(w, name, obj, visibleByDefault = true) {
  w.parts[name] = obj;
  obj.userData.rp = obj.position.toArray();
  obj.userData.rr = [obj.rotation.x, obj.rotation.y, obj.rotation.z];
  obj.userData.vis = visibleByDefault;
  obj.visible = visibleByDefault;
}
const RP = (w, n) => w.parts[n].userData.rp.slice();
const RR = (w, n) => w.parts[n].userData.rr.slice();
const LP = (w, n) => add(RP(w, n), (w.lock[n] && w.lock[n].p) || Z3);
const LR = (w, n) => add(RR(w, n), (w.lock[n] && w.lock[n].r) || Z3);
const OFF = [-0.06, -0.5, 0.2]; // "off-screen, reaching into a pouch" spot for the left hand

function drawDef() {
  return mkDef(0.42, { gun: [[0, [0.02, -0.28, 0.1], [-0.9, 0.35, 0.45]], [0.42, Z3, Z3, 'o']] });
}
function inspectDef(w) {
  return mkDef(2.3, {
    gun: [[0, Z3, Z3], [0.4, [-0.06, 0.05, 0.03], [0.15, 0.85, 0.5]], [1.1, [-0.07, 0.06, 0.03], [0.2, 0.95, 0.55]],
      [1.45, [-0.04, 0.07, 0.02], [0.75, 0.2, -0.25]], [1.85, [-0.03, 0.06, 0.02], [0.7, 0.1, -0.3]], [2.3, Z3, Z3]],
  }, [[0.35, () => noise(0.15, 1200, 0.08)], [1.4, () => noise(0.15, 1200, 0.08)]]);
}
function dropPart(w, name, vel, spin = [rand(-6, 6), rand(-4, 4), rand(-6, 6)]) {
  const obj = w.parts[name];
  obj.updateWorldMatrix(true, true);
  const c = obj.clone(true);
  obj.matrixWorld.decompose(c.position, c.quaternion, c.scale);
  c.visible = true;
  vmScene.add(c);
  debris.push({ obj: c, v: vel.slice(), spin, life: 1.3, g: -4 });
  obj.visible = false;
}
const tmpV = new THREE.Vector3();
function casing(w, kind = 'brass', count = 1) {
  if (!w.eject) return;
  w.eject.getWorldPosition(tmpV);
  for (let i = 0; i < count; i++) {
    const m = kind === 'shell'
      ? cyl(0.009, 0.05, MAT.red, 0, 0, 0, vmScene, 'x', 8)
      : cyl(0.0045, 0.025, MAT.brass, 0, 0, 0, vmScene, 'x', 8);
    m.position.copy(tmpV);
    const spread = count > 1 ? rand(-0.25, 0.25) : 0;
    const v = count > 1 ? [rand(-0.25, 0.1), rand(-0.5, -0.2), rand(-0.05, 0.15)] : [rand(0.9, 1.3), rand(0.7, 1.1), rand(0.05, 0.3)];
    v[0] += spread;
    debris.push({ obj: m, v, spin: [rand(-20, 20), rand(-20, 20), rand(-20, 20)], life: 0.9, g: -6, geo: true });
  }
}

// Generic detachable-magazine reload. Each user tweaks it: drop vs. rip-out, how the gun tilts, and
// what the empty reload adds at the end (slide release, bolt-release press, side charging slap).
// The tactical reload (round still chambered) skips that last step and gives cap+1.
function magReload(w, o) {
  w.magInfo = o;
  const M = RP(w, 'mag'), MR = RR(w, 'mag');
  const H = RP(w, 'lh'), HR = RR(w, 'lh');
  const at = (k) => add(M, sc(o.d, k));
  const hand = (k) => add(at(k + o.grip), o.handAdj || Z3);
  const HG = o.handRot || HR; // hand rotation while holding a mag
  const T = o.tilt;
  const build = (empty) => {
    const pre = empty && o.preLock ? 0.42 : 0; // SMG: lock the handle back before swapping mags
    const t = (x) => x + pre;
    const tr = { gun: [], mag: [], lh: [] };
    const ev = [];
    tr.gun.push([0, Z3, Z3], [t(0.2), T.p, T.r], [t(0.9), add(T.p, [0, 0.006, 0]), add(T.r, [0.02, 0, 0])]);
    tr.lh.push([0, H, HR]);
    if (pre) {
      const C = RP(w, 'chg');
      tr.gun.splice(1, 0, [0.15, [-0.02, 0.02, 0], [0.05, -0.2, -0.15]], [0.4, [-0.02, 0.02, 0], [0.05, -0.2, -0.15]]);
      tr.lh.push([0.14, add(C, [-0.035, 0.0, -0.01]), [0, 0, -0.4]], [0.26, add(C, [-0.035, 0.0, 0.06]), [0, 0, -0.4], 'o'],
        [0.33, add(C, [-0.035, 0.03, 0.06]), [0, 0, -0.9]], [0.42, H, HR]);
      tr.chg = [[0, RP(w, 'chg'), RR(w, 'chg')], [0.14, RP(w, 'chg'), RR(w, 'chg')], [0.26, add(RP(w, 'chg'), [0, 0, 0.06]), RR(w, 'chg'), 'o'],
        [0.33, LP(w, 'chg'), LR(w, 'chg')]];
      ev.push([0.25, () => SFX.boltBack()], [0.33, () => click(3000, 0.2)]);
    }
    tr.mag.push([0, M, MR]);
    let freeAt;
    const retain = !empty && o.retain;
    if (retain) {
      // Tactical reload with retention: the hand pulls the partly-full mag and stows it in a pouch
      // instead of letting it fall, then comes back with a fresh one.
      tr.lh.push([t(0.14), hand(0), HG], [t(0.3), hand(0.17), HG, 'o']);
      tr.mag.push([t(0.14), M, MR], [t(0.3), at(0.17), MR, 'o'], [t(0.5), add(OFF, sub3(at(0.17), hand(0.17))), MR]);
      ev.push([t(0.17), () => SFX.magout()], [t(0.48), () => noise(0.08, 500, 0.12, 'lowpass')]);
      freeAt = t(0.32);
    } else if (o.pull) {
      // Hand grabs the mag, rips it out and flicks it away.
      tr.lh.push([t(0.14), hand(0), HG], [t(0.3), hand(0.17), HG, 'o']);
      tr.mag.push([t(0.14), M, MR], [t(0.3), at(0.17), MR, 'o']);
      ev.push([t(0.17), () => SFX.magout()], [t(0.36), (w2) => dropPart(w2, 'mag', [-0.9, -0.6, 0.2])]);
      tr.mag.push([t(0.36), at(0.2), MR]);
      freeAt = t(0.36);
    } else {
      // Thumb hits the release, the mag falls out under its own weight.
      tr.lh.push([t(0.16), add(H, [0, -0.01, 0]), HR]);
      tr.mag.push([t(0.17), M, MR], [t(0.22), at(0.035), MR, 'i']);
      ev.push([t(0.17), () => SFX.magout()], [t(0.22), (w2) => dropPart(w2, 'mag', sc(o.d, 1.4))]);
      freeAt = t(0.22);
    }
    // Off to the pouch, back with a fresh mag, line it up, push, palm-slap.
    tr.lh.push([freeAt + 0.18, OFF, [0.4, 0, 0.6]], [t(0.56), OFF, [0.4, 0, 0.6]], [t(0.74), hand(0.2), HG, 'o'],
      [t(0.9), hand(0.03), HG], [t(0.96), hand(-0.006), HG, 'o']);
    tr.mag.push([t(0.56), retain ? add(OFF, sub3(at(0.2), hand(0.2))) : at(0.5), MR], [t(0.74), at(0.2), MR, 'o'], [t(0.9), at(0.03), MR], [t(0.96), M, MR, 'o']);
    ev.push([t(0.56), (w2) => { w2.parts.mag.visible = true; }], [t(0.9), () => SFX.magin()], [t(0.96), () => SFX.slap()]);
    // Ammo lands when the mag seats.
    ev.push([t(0.95), (w2) => { w2.ammo = empty ? w2.cap : w2.cap + (w2.spec.chamber ? 1 : 0); updateAmmoHud(); }]);
    tr.gun.push([t(0.97), add(T.p, [0, 0.014, 0]), add(T.r, [0.07, 0, 0]), 'o']);
    let dur;
    if (!empty || o.charge === 'none') {
      tr.lh.push([t(1.18), H, HR]);
      tr.gun.push([t(1.25), Z3, Z3]);
      dur = t(1.3);
    } else if (o.charge === 'slide') {
      // Thumb drops the slide release: slide slams home.
      tr.lh.push([t(1.15), H, HR]);
      tr.slide = [[0, LP(w, 'slide'), LR(w, 'slide')], [t(1.08), LP(w, 'slide'), LR(w, 'slide')], [t(1.12), RP(w, 'slide'), RR(w, 'slide'), 'o']];
      tr.gun.push([t(1.08), T.p, T.r], [t(1.15), add(T.p, [0, 0.02, 0.015]), add(T.r, [0.12, 0, -0.05]), 'o'], [t(1.42), Z3, Z3]);
      ev.push([t(1.1), (w2) => { w2.locked = false; SFX.slide(); }]);
      dur = t(1.48);
    } else if (o.charge === 'boltRelease') {
      // Palm smacks the bolt catch on the left side: bolt slams forward.
      const B = o.btn;
      tr.lh.push([t(1.1), add(B, [-0.035, -0.01, 0.01]), [0, 0, -0.5]], [t(1.15), add(B, [-0.02, -0.005, 0.01]), [0, 0, -0.5], 'o'], [t(1.4), H, HR]);
      tr.bolt = [[0, LP(w, 'bolt'), LR(w, 'bolt')], [t(1.15), LP(w, 'bolt'), LR(w, 'bolt')], [t(1.18), RP(w, 'bolt'), RR(w, 'bolt'), 'o']];
      tr.gun.push([t(1.12), add(T.p, [0.01, 0, 0]), add(T.r, [0, -0.15, -0.1])], [t(1.19), add(T.p, [0.01, 0.015, 0.01]), add(T.r, [0.08, -0.15, -0.12]), 'o'], [t(1.48), Z3, Z3]);
      ev.push([t(1.16), (w2) => { w2.locked = false; SFX.boltFwd(); }]);
      dur = t(1.52);
    } else if (o.charge === 'slap') {
      // HK-style slap: hand chops the locked-up charging handle down, it rockets forward.
      const C = RP(w, 'chg');
      tr.lh.push([t(1.1), add(LP(w, 'chg'), [-0.04, 0.05, 0]), [0, 0, -1.1]], [t(1.15), add(C, [-0.04, 0.0, 0]), [0, 0, -1.0], 'o'], [t(1.42), H, HR]);
      tr.chg = [[0, LP(w, 'chg'), LR(w, 'chg')], [t(1.14), LP(w, 'chg'), LR(w, 'chg')], [t(1.17), C, RR(w, 'chg'), 'o']];
      tr.gun.push([t(1.1), add(T.p, [0, 0, 0]), add(T.r, [0, -0.25, -0.15])], [t(1.18), add(T.p, [0, 0.012, 0.01]), add(T.r, [0.06, -0.28, -0.2]), 'o'], [t(1.48), Z3, Z3]);
      ev.push([t(1.15), (w2) => { w2.locked = false; SFX.slap(); SFX.boltFwd(); }]);
      dur = t(1.52);
    }
    return scaleDef(mkDef(dur, tr, ev), o.speed || 1);
  };
  w.anims.reload = build(false);
  w.anims.reloadEmpty = build(true);
}

// ---------------------------------------------------------------- weapons
const WEAPON_DEFS = [];
function weapon(spec, build) { WEAPON_DEFS.push({ spec, build }); }

// 1. Vex P9 — pistol. Mag drops free, empty reload ends with a slide release.
weapon({ id: 'p9', name: 'Vex P9', kind: 'pistol', cap: 12, interval: 0.13, auto: false, dmg: 34, head: 2, spread: 0.008, adsSpread: 0.002,
  range: 40, chamber: true, kick: 0.035, kickR: 0.09, camKick: 0.012, zoom: 60, hip: [0.12, -0.125, -0.47], ads: [0, -0.094, -0.36] }, (w) => {
  const g = w.gun;
  box(0.032, 0.03, 0.17, MAT.poly, 0, 0.045, -0.045, g);
  box(0.028, 0.012, 0.04, MAT.poly, 0, 0.02, -0.02, g); // trigger guard area
  const slide = grp(g, 0, 0.073, -0.05);
  box(0.034, 0.03, 0.2, MAT.metal, 0, 0, 0, slide);
  box(0.035, 0.006, 0.11, MAT.steel, 0, 0.013, -0.03, slide); // flat-machined top
  for (let i = 0; i < 5; i++) box(0.036, 0.022, 0.004, MAT.dark, 0, 0, 0.06 + i * 0.008, slide); // serrations
  box(0.006, 0.01, 0.01, MAT.dark, 0, 0.02, -0.09, slide);
  box(0.022, 0.01, 0.01, MAT.dark, 0, 0.02, 0.085, slide);
  cyl(0.007, 0.02, MAT.dark, 0, 0.002, -0.1, slide);
  box(0.03, 0.105, 0.046, MAT.poly, 0, -0.012, 0.022, g, -0.22);
  const mag = grp(g, 0, -0.022, 0.024, -0.22);
  box(0.022, 0.1, 0.032, MAT.metal, 0, 0, 0, mag);
  box(0.03, 0.012, 0.042, MAT.orange, 0, -0.056, 0.002, mag);
  round(mag, 0, 0.052, 0.006, 0.026, 0.0045);
  const rh = makeHand(1.05); rh.position.set(0.004, -0.03, 0.045); rh.rotation.set(-0.22, 0, 0); g.add(rh);
  const lh = makeHand(); lh.position.set(-0.03, -0.048, 0.034); lh.rotation.set(-0.1, 0.25, -0.5); g.add(lh);
  reg(w, 'slide', slide); reg(w, 'mag', mag); reg(w, 'rh', rh); reg(w, 'lh', lh);
  w.lock = { slide: { p: [0, 0, 0.045] } };
  w.muzzle = grp(g, 0, 0.075, -0.17); w.eject = grp(g, 0.025, 0.085, -0.03);
  const d = [0, -Math.cos(0.22), Math.sin(0.22)];
  magReload(w, { d, grip: 0.07, handAdj: [0, 0, 0.004], handRot: [-0.22, 0, 0], pull: false, charge: 'slide', speed: 1.05,
    tilt: { p: [-0.04, 0.075, 0.02], r: [0.3, 0.4, 0.5] } });
  w.anims.fire = mkDef(0.1, { slide: [[0, RP(w, 'slide'), Z3], [0.025, LP(w, 'slide'), Z3, 'o'], [0.1, RP(w, 'slide'), Z3]] });
  w.anims.fireLast = mkDef(0.06, { slide: [[0, RP(w, 'slide'), Z3], [0.025, LP(w, 'slide'), Z3, 'o'], [0.06, LP(w, 'slide'), Z3]] });
});

// 2. Kestrel K7 — SMG. Hand rips the mag out; empty reload locks the side handle first, then slaps it.
weapon({ id: 'k7', name: 'Kestrel K7', kind: 'smg', cap: 30, interval: 0.072, auto: true, dmg: 21, head: 1.6, spread: 0.022, adsSpread: 0.008,
  range: 28, chamber: true, kick: 0.012, kickR: 0.025, camKick: 0.004, zoom: 58, hip: [0.12, -0.13, -0.47], ads: [0, -0.102, -0.32] }, (w) => {
  const g = w.gun;
  box(0.046, 0.06, 0.3, MAT.poly, 0, 0.05, -0.1, g);
  box(0.04, 0.012, 0.22, MAT.dark, 0, 0.086, -0.08, g);
  cyl(0.02, 0.17, MAT.metal, 0, 0.055, -0.33, g);
  for (let i = 0; i < 4; i++) cyl(0.021, 0.008, MAT.dark, 0, 0.055, -0.27 - i * 0.03, g);
  cyl(0.008, 0.05, MAT.dark, 0, 0.055, -0.43, g);
  box(0.012, 0.016, 0.01, MAT.dark, 0, 0.1, 0.02, g);
  box(0.008, 0.016, 0.01, MAT.dark, 0, 0.1, -0.26, g);
  box(0.044, 0.01, 0.07, MAT.teal, 0, 0.081, -0.15, g);
  box(0.03, 0.1, 0.044, MAT.poly, 0, -0.02, 0.025, g, -0.25);
  box(0.016, 0.016, 0.09, MAT.dark, 0, 0.05, 0.08, g); // folded stock brace
  const mag = grp(g, 0, -0.035, -0.09, 0.1);
  box(0.024, 0.15, 0.04, MAT.metal, 0, 0, 0, mag);
  box(0.03, 0.012, 0.046, MAT.teal, 0, -0.08, 0, mag);
  round(mag, 0, 0.074, 0.008, 0.026, 0.0045);
  const chg = grp(g, -0.03, 0.068, -0.26);
  box(0.018, 0.012, 0.03, MAT.teal, -0.004, 0, 0, chg);
  const rh = makeHand(1.05); rh.position.set(0.004, -0.035, 0.05); rh.rotation.set(-0.25, 0, 0); g.add(rh);
  const lh = makeHand(); lh.position.set(-0.008, 0.012, -0.3); lh.rotation.set(0.1, 0.15, -0.35); g.add(lh);
  reg(w, 'mag', mag); reg(w, 'chg', chg); reg(w, 'rh', rh); reg(w, 'lh', lh);
  w.lock = { chg: { p: [0, 0.012, 0.065], r: [0, 0, -0.9] } };
  w.muzzle = grp(g, 0, 0.055, -0.46); w.eject = grp(g, 0.025, 0.07, -0.08);
  const d = [0, -Math.cos(0.1), -Math.sin(0.1)];
  magReload(w, { d, grip: 0.1, handAdj: [0.0, 0, 0], handRot: [0.15, 0, -0.1], pull: true, charge: 'slap', preLock: true, speed: 1,
    tilt: { p: [-0.05, 0.075, 0.03], r: [0.25, 0.35, 0.55] } });
});

// 3. Halberd AR — rifle. Mag drops, new mag, slap, then (empty) palm hits the bolt catch.
weapon({ id: 'ar', name: 'Halberd AR', kind: 'rifle', cap: 30, interval: 0.098, auto: true, dmg: 29, head: 1.8, spread: 0.016, adsSpread: 0.003,
  range: 60, chamber: true, kick: 0.016, kickR: 0.03, camKick: 0.006, zoom: 50, hip: [0.12, -0.135, -0.47], ads: [0, -0.131, -0.3] }, (w) => {
  const g = w.gun;
  box(0.05, 0.07, 0.34, MAT.metal, 0, 0.058, -0.11, g);
  box(0.032, 0.014, 0.4, MAT.dark, 0, 0.1, -0.16, g);
  box(0.056, 0.064, 0.27, MAT.tan, 0, 0.06, -0.42, g);
  for (let i = 0; i < 5; i++) box(0.058, 0.01, 0.022, MAT.dark, 0, 0.06, -0.33 - i * 0.045, g);
  cyl(0.01, 0.22, MAT.dark, 0, 0.065, -0.66, g);
  cyl(0.016, 0.06, MAT.metal, 0, 0.065, -0.78, g);
  box(0.04, 0.07, 0.15, MAT.tan, 0, 0.02, 0.12, g, 0.12);
  box(0.03, 0.105, 0.046, MAT.tan, 0, -0.018, 0.03, g, -0.22);
  // red-dot sight
  box(0.034, 0.022, 0.06, MAT.dark, 0, 0.118, -0.06, g);
  const lens = box(0.026, 0.026, 0.004, MAT.glass, 0, 0.132, -0.088, g);
  lens.material = MAT.glass;
  box(0.034, 0.006, 0.05, MAT.orange, 0, 0.145, -0.06, g);
  const port = box(0.004, 0.022, 0.07, MAT.dark, 0.026, 0.07, -0.07, g);
  void port;
  const bolt = grp(g, 0.027, 0.07, -0.07);
  box(0.004, 0.016, 0.05, MAT.steel, 0, 0, 0, bolt);
  const chg = grp(g, 0, 0.098, 0.04);
  box(0.05, 0.01, 0.02, MAT.dark, 0, 0, 0, chg);
  const mag = grp(g, 0, -0.04, -0.13, 0.2);
  box(0.026, 0.17, 0.06, MAT.olive, 0, 0, 0, mag);
  box(0.032, 0.014, 0.066, MAT.dark, 0, -0.09, 0, mag);
  round(mag, 0, 0.083, 0.012, 0.03, 0.005);
  const rh = makeHand(1.05); rh.position.set(0.004, -0.035, 0.055); rh.rotation.set(-0.22, 0, 0); g.add(rh);
  const lh = makeHand(); lh.position.set(-0.01, 0.018, -0.42); lh.rotation.set(0.1, 0.18, -0.4); g.add(lh);
  reg(w, 'mag', mag); reg(w, 'bolt', bolt); reg(w, 'chg', chg); reg(w, 'rh', rh); reg(w, 'lh', lh);
  w.lock = { bolt: { p: [0, 0, 0.05] } };
  w.muzzle = grp(g, 0, 0.065, -0.82); w.eject = grp(g, 0.03, 0.07, -0.07);
  const d = [0, -Math.cos(0.2), -Math.sin(0.2)];
  magReload(w, { d, grip: 0.11, handRot: [0.2, 0, -0.15], pull: false, retain: true, charge: 'boltRelease', btn: [-0.028, 0.045, -0.09], speed: 1.1,
    tilt: { p: [-0.05, 0.08, 0.04], r: [0.22, 0.35, 0.6] } });
  w.anims.fire = mkDef(0.07, { bolt: [[0, RP(w, 'bolt'), Z3], [0.02, LP(w, 'bolt'), Z3, 'o'], [0.07, RP(w, 'bolt'), Z3]] });
  w.anims.fireLast = mkDef(0.05, { bolt: [[0, RP(w, 'bolt'), Z3], [0.02, LP(w, 'bolt'), Z3, 'o'], [0.05, LP(w, 'bolt'), Z3]] });
});

// 4. Mauler 8 — pump shotgun. Loads one shell at a time (fire to interrupt), pump on empty.
weapon({ id: 'm8', name: 'Mauler 8', kind: 'shotgun', cap: 6, interval: 0.75, auto: false, dmg: 13, pellets: 9, head: 1.4, spread: 0.06, adsSpread: 0.045,
  range: 16, chamber: false, kick: 0.07, kickR: 0.16, camKick: 0.03, zoom: 62, hip: [0.12, -0.14, -0.47], ads: [0, -0.098, -0.32] }, (w) => {
  const g = w.gun;
  box(0.05, 0.07, 0.24, MAT.red, 0, 0.05, -0.06, g);
  cyl(0.012, 0.56, MAT.dark, 0, 0.078, -0.46, g);
  cyl(0.011, 0.42, MAT.metal, 0, 0.048, -0.4, g);
  cyl(0.003, 0.006, MAT.brass, 0, 0.093, -0.73, g, 'y');
  box(0.04, 0.055, 0.1, MAT.poly, 0, 0.01, 0.1, g, 0.25);
  box(0.032, 0.095, 0.044, MAT.poly, 0, -0.016, 0.035, g, -0.25);
  box(0.03, 0.01, 0.1, MAT.dark, 0, 0.011, -0.05, g); // loading port
  const pump = grp(g, 0, 0.044, -0.34);
  box(0.052, 0.048, 0.16, MAT.poly, 0, 0, 0, pump);
  for (let i = 0; i < 6; i++) box(0.054, 0.05, 0.008, MAT.dark, 0, 0, -0.06 + i * 0.024, pump);
  const shell = grp(g, 0, 0, 0);
  cyl(0.009, 0.048, MAT.red, 0, 0, -0.024, shell);
  cyl(0.0095, 0.012, MAT.brass, 0, 0, 0.004, shell);
  const rh = makeHand(1.05); rh.position.set(0.004, -0.032, 0.06); rh.rotation.set(-0.25, 0, 0); g.add(rh);
  const lh = makeHand(); lh.position.set(-0.01, 0.006, -0.34); lh.rotation.set(0.1, 0.12, -0.3); g.add(lh);
  reg(w, 'pump', pump); reg(w, 'shell', shell, false); reg(w, 'rh', rh); reg(w, 'lh', lh);
  w.muzzle = grp(g, 0, 0.078, -0.75); w.eject = grp(g, 0.03, 0.07, -0.05);
  const P = RP(w, 'pump'), H = RP(w, 'lh'), HR = RR(w, 'lh');
  const pumpBack = add(P, [0, 0, 0.085]), hBack = add(H, [0, 0, 0.085]);
  const T = { p: [-0.05, 0.07, 0.0], r: [0.2, 0.35, 0.6] };
  const port = [0, 0.0, -0.03];
  const hPort = add(port, [-0.005, -0.04, 0.04]), hPortR = [0.5, -0.2, -0.3];
  w.anims.fire = mkDef(0.6, {
    pump: [[0, P, Z3], [0.16, P, Z3], [0.3, pumpBack, Z3, 'o'], [0.44, P, Z3, 'o']],
    lh: [[0, H, HR], [0.16, H, HR], [0.3, hBack, HR, 'o'], [0.44, H, HR, 'o']],
    gun: [[0, Z3, Z3], [0.16, Z3, Z3], [0.3, [0, -0.01, 0.01], [-0.05, 0, 0.05]], [0.5, Z3, Z3]],
  }, [[0.2, () => SFX.pump()], [0.3, (w2) => casing(w2, 'shell')]]);
  w.anims.reloadStart = mkDef(0.34, {
    gun: [[0, Z3, Z3], [0.34, T.p, T.r]], lh: [[0, H, HR], [0.34, add(hPort, [-0.03, -0.06, 0.08]), hPortR]],
  });
  // A shell: hand to the pouch, back with a shell, thumb it up into the port.
  const shellAt = (hp) => add(hp, [0.0, 0.035, -0.03]);
  const s1 = add(hPort, [-0.03, -0.06, 0.08]);
  w.anims.reloadShell = mkDef(0.5, {
    gun: [[0, T.p, T.r], [0.33, T.p, T.r], [0.37, add(T.p, [0, 0.006, 0]), add(T.r, [0.03, 0, 0]), 'o'], [0.5, T.p, T.r]],
    lh: [[0, s1, hPortR], [0.13, add(OFF, [0.05, 0.15, -0.1]), [0.6, 0, 0.3]], [0.26, add(hPort, [0, -0.02, 0.03]), hPortR, 'o'],
      [0.36, add(hPort, [0, 0, -0.03]), hPortR, 'o'], [0.5, s1, hPortR]],
    shell: [[0.13, shellAt(add(OFF, [0.05, 0.15, -0.1])), Z3], [0.26, shellAt(add(hPort, [0, -0.02, 0.03])), Z3, 'o'], [0.36, shellAt(add(hPort, [0, 0, -0.03])), Z3, 'o']],
  }, [[0.13, (w2) => { w2.parts.shell.visible = true; }], [0.36, (w2) => { w2.parts.shell.visible = false; w2.ammo = Math.min(w2.cap, w2.ammo + 1); SFX.shell(); updateAmmoHud(); }]]);
  w.anims.reloadEnd = mkDef(0.4, { gun: [[0, T.p, T.r], [0.4, Z3, Z3]], lh: [[0, s1, hPortR], [0.36, H, HR]] });
  w.anims.reloadEndPump = mkDef(0.75, {
    gun: [[0, T.p, T.r], [0.3, Z3, Z3], [0.45, [0, -0.01, 0.015], [-0.06, 0.05, 0.12]], [0.75, Z3, Z3]],
    lh: [[0, s1, hPortR], [0.28, H, HR], [0.42, hBack, HR, 'o'], [0.55, H, HR, 'o']],
    pump: [[0, P, Z3], [0.28, P, Z3], [0.42, pumpBack, Z3, 'o'], [0.55, P, Z3, 'o']],
  }, [[0.32, () => SFX.pump()]]);
});

// 5. Sixer — revolver. Cylinder swings out, ejector dumps all six, speedloader, flick shut, spin.
weapon({ id: 'six', name: 'Sixer', kind: 'revolver', cap: 6, interval: 0.42, auto: false, dmg: 64, head: 2, spread: 0.01, adsSpread: 0.0015,
  range: 50, chamber: false, kick: 0.06, kickR: 0.2, camKick: 0.026, zoom: 55, hip: [0.12, -0.13, -0.47], ads: [0, -0.108, -0.36] }, (w) => {
  const g = w.gun;
  box(0.036, 0.06, 0.1, MAT.steel, 0, 0.06, -0.03, g);
  box(0.03, 0.025, 0.21, MAT.steel, 0, 0.088, -0.17, g);
  cyl(0.011, 0.21, MAT.steel, 0, 0.08, -0.17, g);
  box(0.006, 0.012, 0.012, MAT.dark, 0, 0.104, -0.27, g);
  box(0.016, 0.006, 0.012, MAT.dark, 0, 0.104, 0.01, g);
  cyl(0.005, 0.11, MAT.steel, 0, 0.055, -0.13, g);
  box(0.032, 0.11, 0.05, MAT.olive, 0, -0.02, 0.04, g, -0.3);
  const ham = grp(g, 0, 0.085, 0.025);
  box(0.01, 0.026, 0.012, MAT.dark, 0, 0.01, 0, ham);
  // Crane pivots about a point low on the left; the cylinder rides on it.
  const crane = grp(g, -0.018, 0.04, -0.03);
  const cylG = grp(crane, 0.018, 0.025, 0);
  const drum = cyl(0.026, 0.058, MAT.steel, 0, 0, 0, cylG, 'z', 6);
  void drum;
  const rounds = grp(cylG, 0, 0, 0.03);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    cyl(0.0065, 0.004, MAT.brass, Math.cos(a) * 0.016, Math.sin(a) * 0.016, 0, rounds, 'z', 8);
  }
  const ldr = grp(g, 0, 0, 0);
  cyl(0.024, 0.012, MAT.dark, 0, 0, 0.014, ldr, 'z', 12);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    round(ldr, Math.cos(a) * 0.016, Math.sin(a) * 0.016, 0.006, 0.034, 0.0055);
  }
  const rh = makeHand(1.05); rh.position.set(0.004, -0.035, 0.06); rh.rotation.set(-0.3, 0, 0); g.add(rh);
  const lh = makeHand(); lh.position.set(-0.03, -0.05, 0.045); lh.rotation.set(-0.1, 0.25, -0.5); g.add(lh);
  reg(w, 'ham', ham); reg(w, 'crane', crane); reg(w, 'cyl', cylG); reg(w, 'rounds', rounds); reg(w, 'ldr', ldr, false);
  reg(w, 'rh', rh); reg(w, 'lh', lh);
  w.muzzle = grp(g, 0, 0.08, -0.28); w.eject = grp(g, -0.03, 0.065, 0.0);
  w.cylAngle = 0; w.cylShown = 0;
  w.post = (w2, dt) => {
    w2.cylShown = lerp(w2.cylShown, w2.cylAngle, 1 - Math.exp(-dt * (Math.abs(w2.cylAngle - w2.cylShown) > 2 ? 6 : 30)));
    w2.parts.cyl.rotation.z = w2.cylShown;
  };
  const H = RP(w, 'lh'), HR = RR(w, 'lh'), C = RP(w, 'crane');
  const OPEN = 1.25;
  // Where the cylinder sits when swung out, in gun space.
  const co = [C[0] + 0.018 * Math.cos(OPEN) - 0.025 * Math.sin(OPEN), C[1] + 0.018 * Math.sin(OPEN) + 0.025 * Math.cos(OPEN), C[2]];
  const T1 = { p: [-0.05, 0.06, 0.0], r: [0.1, 0.3, 0.75] };
  const T2 = { p: [-0.06, 0.07, 0.02], r: [0.8, 0.25, 0.55] };   // muzzle up: shells fall out
  const T3 = { p: [-0.05, 0.05, 0.0], r: [-0.4, 0.25, 0.55] };   // muzzle down: load
  const ldrBehind = add(co, [0, 0, 0.09]), ldrIn = add(co, [0, 0, 0.026]);
  const handOnLdr = (p) => add(p, [-0.004, -0.004, 0.05]);
  w.anims.fire = mkDef(0.3, { ham: [[0, RP(w, 'ham'), [0, 0, 0]], [0.02, RP(w, 'ham'), [0.5, 0, 0], 'o'], [0.3, RP(w, 'ham'), Z3]] });
  w.anims.reload = mkDef(1.95, {
    gun: [[0, Z3, Z3], [0.2, T1.p, T1.r], [0.32, add(T1.p, [0, 0.004, 0]), add(T1.r, [0, 0, 0.05]), 'o'], [0.5, T2.p, T2.r], [0.62, T2.p, add(T2.r, [0.08, 0, 0])],
      [0.82, T3.p, T3.r], [1.12, T3.p, T3.r], [1.22, [0.0, 0.01, 0.0], [-0.1, 0.05, 0.1], 'o'], [1.32, [0.0, 0.0, 0.0], [0.05, -0.05, -0.12]], [1.6, Z3, Z3]],
    crane: [[0, C, Z3], [0.2, C, Z3], [0.3, C, [0, 0, OPEN], 'o'], [1.14, C, [0, 0, OPEN]], [1.2, C, Z3, 'o']],
    lh: [[0, H, HR], [0.2, add(co, [-0.03, -0.01, 0.03]), [0, 0.2, -0.9]], [0.46, add(co, [-0.01, -0.012, -0.12]), [0.3, 0.1, -0.6]],
      [0.53, add(co, [-0.01, -0.012, -0.075]), [0.3, 0.1, -0.6], 'o'], [0.62, add(co, [-0.01, -0.012, -0.12]), [0.3, 0.1, -0.6]],
      [0.82, OFF, [0.5, 0, 0.4]], [0.98, handOnLdr(ldrBehind), [-0.1, 0, -0.2], 'o'], [1.04, handOnLdr(ldrIn), [-0.1, 0, -0.2]],
      [1.08, handOnLdr(ldrIn), [-0.1, 0, 0.4]], [1.14, add(co, [-0.06, -0.06, 0.08]), [0, 0.2, -0.6]], [1.45, H, HR]],
    ldr: [[0.82, add(OFF, [0.004, 0.004, -0.05]), Z3], [0.98, ldrBehind, Z3, 'o'], [1.04, ldrIn, Z3], [1.08, ldrIn, [0, 0, 0.6]]],
  }, [
    [0.3, () => SFX.cylOpen()],
    [0.53, (w2) => { w2.parts.rounds.visible = false; casing(w2, 'brass', 6); SFX.casings(); }],
    [0.82, (w2) => { w2.parts.ldr.visible = true; }],
    [1.04, () => SFX.magin()],
    [1.07, (w2) => { w2.parts.rounds.visible = true; w2.ammo = w2.cap; updateAmmoHud(); }],
    [1.1, (w2) => { dropPart(w2, 'ldr', [-0.5, -0.8, 0.3]); }],
    [1.2, () => SFX.cylShut()],
    [1.24, (w2) => { w2.cylAngle += Math.PI * 4; SFX.spin(); }],
  ]);
});

// 6. Bulwark — belt-fed LMG. Lid up, box off, new box, lay the belt, slam the lid, rack it.
weapon({ id: 'lmg', name: 'Bulwark', kind: 'lmg', cap: 60, interval: 0.085, auto: true, dmg: 25, head: 1.6, spread: 0.028, adsSpread: 0.01,
  range: 55, chamber: false, kick: 0.014, kickR: 0.03, camKick: 0.006, zoom: 55, hip: [0.12, -0.15, -0.52], ads: [0, -0.142, -0.32] }, (w) => {
  const g = w.gun;
  box(0.062, 0.085, 0.36, MAT.olive, 0, 0.055, -0.1, g);
  box(0.066, 0.07, 0.24, MAT.poly, 0, 0.05, -0.4, g);
  for (let i = 0; i < 6; i++) box(0.07, 0.01, 0.018, MAT.dark, 0, 0.05, -0.31 - i * 0.035, g);
  cyl(0.014, 0.3, MAT.dark, 0, 0.065, -0.66, g);
  cyl(0.022, 0.07, MAT.metal, 0, 0.065, -0.8, g);
  box(0.044, 0.075, 0.14, MAT.olive, 0, 0.02, 0.125, g, 0.12);
  box(0.034, 0.105, 0.05, MAT.poly, 0, -0.02, 0.035, g, -0.22);
  box(0.006, 0.02, 0.012, MAT.dark, 0, 0.11, -0.52, g);
  const lid = grp(g, 0, 0.1, 0.02);
  box(0.06, 0.014, 0.17, MAT.olive, 0, 0.005, -0.085, lid);
  box(0.03, 0.016, 0.02, MAT.dark, 0, 0.024, -0.03, lid); // rear sight on the lid
  const belt = grp(g, -0.034, 0.083, -0.1);
  for (let i = 0; i < 5; i++) { const r = round(belt, -i * 0.012, 0, 0, 0.034, 0.005); r.rotation.y = Math.PI / 2 * 0; r.position.z = 0; r.position.x = -i * 0.013; r.rotation.set(0, -Math.PI / 2, 0); }
  const boxMag = grp(g, -0.04, -0.03, -0.11);
  box(0.075, 0.1, 0.1, MAT.olive, 0, 0, 0, boxMag);
  box(0.077, 0.016, 0.102, MAT.dark, 0, 0.03, 0, boxMag);
  const chg = grp(g, -0.036, 0.06, -0.25);
  box(0.024, 0.014, 0.024, MAT.dark, -0.006, 0, 0, chg);
  const rh = makeHand(1.05); rh.position.set(0.004, -0.035, 0.06); rh.rotation.set(-0.22, 0, 0); g.add(rh);
  const lh = makeHand(); lh.position.set(-0.012, 0.0, -0.42); lh.rotation.set(0.1, 0.18, -0.4); g.add(lh);
  reg(w, 'lid', lid); reg(w, 'belt', belt); reg(w, 'mag', boxMag); reg(w, 'chg', chg); reg(w, 'rh', rh); reg(w, 'lh', lh);
  w.muzzle = grp(g, 0, 0.065, -0.84); w.eject = grp(g, 0.035, 0.05, -0.08);
  const H = RP(w, 'lh'), HR = RR(w, 'lh'), L = RP(w, 'lid'), B = RP(w, 'mag'), BT = RP(w, 'belt'), C = RP(w, 'chg');
  const T = { p: [-0.06, 0.08, 0.04], r: [0.25, 0.35, 0.45] };
  const lidFront = add(L, [-0.005, 0.03, -0.15]);
  const lidOpenFront = add(L, [-0.005, 0.13, -0.11]);
  const handUnderBox = (p) => add(p, [-0.01, -0.075, 0.0]);
  const boxOut = add(B, [-0.08, -0.08, 0]);
  const beltLow = add(BT, [-0.02, -0.06, 0]);
  w.anims.reload = mkDef(3.55, {
    gun: [[0, Z3, Z3], [0.25, T.p, T.r], [2.55, T.p, T.r], [2.62, add(T.p, [0, -0.012, 0]), add(T.r, [-0.06, 0, 0]), 'o'], [2.8, T.p, T.r],
      [3.05, add(T.p, [0.01, 0, 0]), add(T.r, [0, -0.2, -0.05])], [3.1, add(T.p, [0.01, 0.01, 0.01]), add(T.r, [0.05, -0.2, -0.05]), 'o'], [3.45, Z3, Z3]],
    lh: [[0, H, HR], [0.3, add(lidFront, [0, 0.02, 0.02]), [0.6, 0, -0.2]], [0.52, add(lidOpenFront, [0, 0.02, 0.02]), [1.0, 0, -0.2]],
      [0.72, handUnderBox(B), [0.1, 0, -0.6]], [0.88, handUnderBox(boxOut), [0.1, 0, -0.6]], [1.2, OFF, [0.4, 0, 0.5]], [1.4, OFF, [0.4, 0, 0.5]],
      [1.62, handUnderBox(boxOut), [0.1, 0, -0.6], 'o'], [1.82, handUnderBox(B), [0.1, 0, -0.6]], [1.86, handUnderBox(add(B, [0, 0.006, 0])), [0.1, 0, -0.6], 'o'],
      [2.02, add(beltLow, [-0.015, 0.015, 0.04]), [0.3, 0.4, -0.4]], [2.25, add(BT, [-0.015, 0.02, 0.04]), [0.3, 0.4, -0.4]],
      [2.45, add(lidOpenFront, [0, 0.03, 0.02]), [1.0, 0, -0.2]], [2.6, add(lidFront, [0, 0.0, 0.02]), [0.6, 0, -0.2], 'o'],
      [2.95, add(C, [-0.04, -0.01, -0.01]), [0, 0, -0.6]], [3.04, add(C, [-0.04, -0.01, 0.09]), [0, 0, -0.6], 'o'], [3.35, H, HR]],
    lid: [[0, L, Z3], [0.3, L, Z3], [0.52, L, [0.85, 0, 0]], [2.45, L, [0.85, 0, 0]], [2.6, L, Z3, 'o']],
    mag: [[0, B, Z3], [0.72, B, Z3], [0.88, boxOut, Z3], [1.4, boxOut, Z3], [1.62, boxOut, Z3, 'o'], [1.82, B, Z3], [1.86, add(B, [0, 0.006, 0]), Z3, 'o'], [1.92, B, Z3]],
    belt: [[0, BT, Z3], [0.5, BT, Z3], [0.72, beltLow, Z3], [2.02, beltLow, Z3], [2.25, BT, Z3]],
    chg: [[0, C, Z3], [2.95, C, Z3], [3.04, add(C, [0, 0, 0.1]), Z3, 'o'], [3.08, C, Z3, 'o']],
  }, [
    [0.4, () => SFX.lid()], [0.7, (w2) => { w2.parts.belt.visible = false; }], [0.75, () => SFX.magout()],
    [0.9, (w2) => dropPart(w2, 'mag', [-0.7, -0.6, 0.1])], [1.4, (w2) => { w2.parts.mag.visible = true; }],
    [1.86, () => SFX.magin()], [2.0, (w2) => { w2.parts.belt.visible = true; }], [2.25, () => click(2200, 0.15)],
    [2.5, (w2) => { w2.ammo = w2.cap; updateAmmoHud(); }], [2.6, () => SFX.cylShut()],
    [3.0, () => SFX.boltBack()], [3.08, () => SFX.boltFwd()],
  ]);
});

// 7. Longreach — bolt-action sniper. Works the bolt after every shot; reloads with a stripper clip.
weapon({ id: 'lr', name: 'Longreach', kind: 'sniper', cap: 5, interval: 1.05, auto: false, dmg: 105, head: 2.5, spread: 0.06, adsSpread: 0.0,
  range: 200, chamber: false, kick: 0.08, kickR: 0.18, camKick: 0.04, zoom: 18, scope: true, hip: [0.11, -0.14, -0.43], ads: [0, -0.15, -0.26] }, (w) => {
  const g = w.gun;
  box(0.045, 0.06, 0.3, MAT.metal, 0, 0.06, -0.1, g);
  box(0.058, 0.065, 0.56, MAT.olive, 0, 0.032, -0.22, g);
  cyl(0.011, 0.5, MAT.dark, 0, 0.07, -0.7, g);
  cyl(0.017, 0.06, MAT.dark, 0, 0.07, -0.96, g);
  box(0.05, 0.085, 0.13, MAT.olive, 0, 0.0, 0.18, g, 0.12);
  box(0.034, 0.1, 0.048, MAT.olive, 0, -0.025, 0.06, g, -0.3);
  // scope
  cyl(0.02, 0.24, MAT.dark, 0, 0.13, -0.1, g);
  cyl(0.027, 0.06, MAT.dark, 0, 0.13, -0.24, g, 'z', 14, 0.02);
  cyl(0.024, 0.04, MAT.dark, 0, 0.13, 0.04, g, 'z', 14, 0.02);
  box(0.012, 0.03, 0.014, MAT.dark, 0, 0.1, -0.15, g);
  box(0.012, 0.03, 0.014, MAT.dark, 0, 0.1, -0.03, g);
  cyl(0.008, 0.02, MAT.orange, 0, 0.155, -0.1, g, 'y');
  const bolt = grp(g, 0.022, 0.075, 0.02);
  cyl(0.009, 0.1, MAT.steel, -0.02, 0, -0.03, bolt);
  cyl(0.004, 0.05, MAT.steel, 0.022, 0, 0, bolt, 'x');
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), MAT.dark); knob.position.set(0.048, 0, 0); bolt.add(knob);
  const clip = grp(g, 0, 0, 0);
  box(0.014, 0.004, 0.012, MAT.steel, 0, 0.02, 0, clip);
  const clipRounds = grp(clip, 0, 0, 0);
  for (let i = 0; i < 5; i++) round(clipRounds, 0, 0.015 - i * 0.008, 0.006, 0.06, 0.0055);
  const rh = makeHand(1.05); rh.position.set(0.004, -0.035, 0.08); rh.rotation.set(-0.3, 0, 0); g.add(rh);
  const lh = makeHand(); lh.position.set(-0.012, -0.005, -0.38); lh.rotation.set(0.1, 0.15, -0.35); g.add(lh);
  reg(w, 'bolt', bolt); reg(w, 'clip', clip, false); reg(w, 'clipRounds', clipRounds); reg(w, 'rh', rh); reg(w, 'lh', lh);
  w.muzzle = grp(g, 0, 0.07, -1.0); w.eject = grp(g, 0.03, 0.08, -0.04);
  const Bo = RP(w, 'bolt'), R = RP(w, 'rh'), RRr = RR(w, 'rh'), H = RP(w, 'lh'), HR = RR(w, 'lh');
  const UP = [0, 0, 0.95], BACK = add(Bo, [0, 0, 0.085]);
  const knobAt = (p) => add(p, [0.045, -0.01, 0.045]);
  const rhKnob = [0.9, 0.15, 0.1];
  const boltWork = (t0, withEject, closeOnly) => {
    const k = { bolt: [], rh: [] };
    if (!closeOnly) {
      k.rh.push([t0, R, RRr], [t0 + 0.12, knobAt(Bo), rhKnob], [t0 + 0.2, knobAt(add(Bo, [0, 0.03, 0])), rhKnob], [t0 + 0.32, knobAt(add(BACK, [0, 0.03, 0])), rhKnob, 'o']);
      k.bolt.push([t0, Bo, Z3], [t0 + 0.12, Bo, Z3], [t0 + 0.2, Bo, UP], [t0 + 0.32, BACK, UP, 'o']);
    }
    return k;
  };
  // Cycle after a shot.
  const c = boltWork(0, true);
  c.rh.push([0.44, knobAt(add(Bo, [0, 0.03, 0])), rhKnob, 'o'], [0.52, knobAt(Bo), rhKnob], [0.7, R, RRr]);
  c.bolt.push([0.44, Bo, UP, 'o'], [0.52, Bo, Z3]);
  w.anims.cycle = mkDef(0.72, { ...c, gun: [[0, Z3, Z3], [0.2, [0.005, 0.01, 0.01], [0.05, -0.05, -0.18]], [0.5, [0.005, 0.01, 0.01], [0.05, -0.05, -0.18]], [0.72, Z3, Z3]] },
    [[0.24, () => SFX.boltBack()], [0.3, (w2) => casing(w2, 'brass')], [0.45, () => SFX.boltFwd()]]);
  // Stripper-clip reload.
  const r = boltWork(0.15, false);
  const clipTop = add(Bo, [-0.022, 0.06, -0.035]);
  const clipSeat = add(clipTop, [0, -0.045, 0]);
  const T = { p: [-0.05, 0.07, 0.04], r: [0.15, 0.25, 0.45] };
  r.rh.push([1.75, knobAt(add(BACK, [0, 0.03, 0])), rhKnob], [1.9, knobAt(add(Bo, [0, 0.03, 0])), rhKnob, 'o'], [1.98, knobAt(Bo), rhKnob], [2.25, R, RRr]);
  r.bolt.push([1.75, BACK, UP], [1.9, Bo, UP, 'o'], [1.98, Bo, Z3]);
  w.anims.reload = mkDef(2.6, {
    ...r,
    gun: [[0, Z3, Z3], [0.25, T.p, T.r], [1.3, add(T.p, [0, -0.005, 0]), add(T.r, [-0.04, 0, 0])], [1.5, T.p, T.r], [2.25, T.p, T.r], [2.55, Z3, Z3]],
    lh: [[0, H, HR], [0.5, OFF, [0.4, 0, 0.6]], [0.65, OFF, [0.4, 0, 0.6]], [0.92, add(clipTop, [-0.03, 0.04, 0.03]), [0.4, -0.35, -0.5], 'o'],
      [1.05, add(clipTop, [-0.03, 0.03, 0.03]), [0.4, -0.35, -0.5]], [1.35, add(clipSeat, [-0.03, 0.03, 0.03]), [0.4, -0.35, -0.5]],
      [1.5, add(clipTop, [-0.05, 0.06, 0.04]), [0.4, -0.35, -0.6]], [1.8, H, HR]],
    clip: [[0.65, add(OFF, [0.01, -0.035, -0.04]), Z3], [0.92, clipTop, Z3, 'o'], [1.36, clipTop, Z3], [1.5, add(clipTop, [-0.02, 0.045, 0.02]), [0, 0, 0.5]]],
    clipRounds: [[0, Z3, Z3], [1.05, Z3, Z3], [1.35, [0, -0.045, 0], Z3]],
  }, [
    [0.3, () => SFX.boltBack()], [0.65, (w2) => { w2.parts.clip.visible = true; w2.parts.clipRounds.visible = true; }],
    [0.93, () => click(2600, 0.2)], [1.1, () => SFX.shell()], [1.2, () => SFX.shell()], [1.3, () => SFX.shell()],
    [1.35, (w2) => { w2.ammo = w2.cap; w2.parts.clipRounds.visible = false; updateAmmoHud(); }],
    [1.52, (w2) => dropPart(w2, 'clip', [-0.6, 0.3, 0.2])], [1.88, () => SFX.boltFwd()],
  ]);
});

// 8. Thumper — single-shot launcher. Lowered, new rocket pushed into the muzzle, back up.
weapon({ id: 'th', name: 'Thumper', kind: 'launcher', cap: 1, interval: 0.6, auto: false, dmg: 120, splash: 4.5, head: 1, spread: 0.01, adsSpread: 0.0,
  range: 200, chamber: false, kick: 0.09, kickR: 0.2, camKick: 0.05, zoom: 55, hip: [0.15, -0.12, -0.46], ads: [0, -0.135, -0.3] }, (w) => {
  const g = w.gun;
  cyl(0.048, 0.66, MAT.olive, 0, 0.06, -0.27, g, 'z', 16);
  cyl(0.054, 0.05, MAT.dark, 0, 0.06, -0.58, g, 'z', 16);
  cyl(0.05, 0.03, MAT.olive, 0, 0.06, 0.04, g, 'z', 24);
  box(0.03, 0.1, 0.044, MAT.poly, 0, -0.03, 0.03, g, -0.15);
  box(0.03, 0.09, 0.04, MAT.poly, 0, -0.025, -0.25, g, 0.1);
  box(0.02, 0.05, 0.05, MAT.dark, -0.06, 0.1, -0.12, g);
  box(0.06, 0.012, 0.012, MAT.orange, 0, 0.118, -0.4, g);
  const rocket = grp(g, 0, 0.06, -0.54);
  cyl(0.036, 0.1, MAT.olive, 0, 0, 0, rocket);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.11, 14), MAT.orange);
  cone.rotation.x = -Math.PI / 2; cone.position.z = -0.1; rocket.add(cone);
  const rh = makeHand(1.05); rh.position.set(0.004, -0.04, 0.06); rh.rotation.set(-0.15, 0, 0); g.add(rh);
  const lh = makeHand(); lh.position.set(-0.005, -0.04, -0.22); lh.rotation.set(0.1, 0.1, -0.2); g.add(lh);
  reg(w, 'rocket', rocket); reg(w, 'rh', rh); reg(w, 'lh', lh);
  w.muzzle = grp(g, 0, 0.06, -0.66);
  w.refresh = (w2) => { w2.parts.rocket.visible = w2.ammo > 0; };
  const Ro = RP(w, 'rocket'), H = RP(w, 'lh'), HR = RR(w, 'lh');
  const T = { p: [-0.02, -0.03, 0.06], r: [0.22, 0.8, 0.25] };
  const front = add(Ro, [0, 0, -0.22]);
  const handBehindRocket = (p) => add(p, [-0.01, -0.045, -0.06]);
  w.anims.reload = mkDef(2.2, {
    gun: [[0, Z3, Z3], [0.35, T.p, T.r], [1.3, T.p, T.r], [1.36, add(T.p, [0, -0.01, 0.01]), add(T.r, [-0.05, 0, 0]), 'o'], [1.5, T.p, T.r], [1.95, Z3, Z3]],
    lh: [[0, H, HR], [0.4, OFF, [0.4, 0, 0.5]], [0.6, OFF, [0.4, 0, 0.5]], [0.95, handBehindRocket(front), [-0.2, 0, -0.3], 'o'],
      [1.3, handBehindRocket(Ro), [-0.2, 0, -0.3]], [1.42, add(handBehindRocket(Ro), [0, -0.04, -0.04]), [-0.2, 0, -0.3]], [1.85, H, HR]],
    rocket: [[0.6, add(OFF, [0.01, 0.045, 0.06]), Z3], [0.95, front, Z3, 'o'], [1.3, Ro, Z3]],
  }, [[0.6, (w2) => { w2.parts.rocket.visible = true; }], [1.3, (w2) => { w2.ammo = 1; SFX.slap(); updateAmmoHud(); }], [1.36, () => click(2000, 0.25)]]);
});

// 9. Fang — knife. The Gun Game finisher.
weapon({ id: 'knife', name: 'Fang', kind: 'knife', cap: 0, interval: 0.5, auto: true, melee: true, dmg: 100, head: 1, spread: 0, adsSpread: 0,
  range: 2.4, zoom: 75, hip: [0.15, -0.14, -0.42], ads: [0.15, -0.14, -0.42] }, (w) => {
  const g = w.gun;
  box(0.026, 0.03, 0.11, MAT.poly, 0, 0, 0.0, g);
  box(0.05, 0.034, 0.012, MAT.metal, 0, 0, -0.06, g);
  const blade = box(0.006, 0.036, 0.17, MAT.steel, 0, 0.004, -0.15, g);
  void blade;
  box(0.0035, 0.008, 0.17, MAT.steel, 0, 0.02, -0.15, g); // sharpened spine
  const rh = makeHand(1.05); rh.position.set(0.004, -0.012, 0.0); rh.rotation.set(0, 0, 0); g.add(rh);
  const lh = makeHand(); lh.position.copy(new THREE.Vector3(...OFF)); g.add(lh);
  reg(w, 'rh', rh); reg(w, 'lh', lh);
  w.anims.fire = mkDef(0.45, {
    gun: [[0, Z3, Z3], [0.08, [0.06, 0.05, 0.05], [0.3, 0.6, -0.4]], [0.22, [-0.18, -0.03, -0.12], [-0.3, -0.5, 0.9], 'o'], [0.45, Z3, Z3]],
  }, [[0.08, () => SFX.knife()]]);
  w.anims.inspect = mkDef(1.6, {
    gun: [[0, Z3, Z3], [0.3, [-0.05, 0.05, 0], [0.2, 0.6, 0.3]], [0.75, [-0.05, 0.08, 0], [0.2, 0.6, 0.3 + Math.PI * 2]], [1.1, [-0.05, 0.05, 0], [0.5, 0.2, 6.6]], [1.6, Z3, [0, 0, Math.PI * 2]]],
  });
});

const FLASH_MAT = new THREE.MeshBasicMaterial({ map: tex((() => {
  const c = cnv(128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.25, 'rgba(255,200,90,0.9)'); g.addColorStop(1, 'rgba(255,120,20,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,210,120,0.8)'; x.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + Math.random() * 0.3, l = rand(38, 62); x.lineWidth = rand(3, 7); x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a) * l, 64 + Math.sin(a) * l); x.stroke(); }
  return c;
})()), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const FLASH_SIDE_MAT = new THREE.MeshBasicMaterial({ map: tex((() => {
  const c = cnv(64, 128), x = c.getContext('2d');
  const g = x.createRadialGradient(32, 100, 0, 32, 80, 70);
  g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.4, 'rgba(255,170,60,0.7)'); g.addColorStop(1, 'rgba(255,100,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 128);
  return c;
})()), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const GUN_ORDER = ['p9', 'k7', 'ar', 'm8', 'six', 'lmg', 'lr', 'th', 'knife'];
const weapons = {};
const holder = new THREE.Group();
vmRoot.add(holder);
for (const { spec, build } of WEAPON_DEFS) {
  const w = { id: spec.id, spec, gun: new THREE.Group(), parts: {}, anims: {}, lock: {}, locked: false, ammo: spec.cap, cap: spec.cap, nextShot: 0 };
  holder.add(w.gun);
  w.gun.visible = false;
  build(w);
  reg(w, 'gun', w.gun);
  w.gun.visible = false; w.gun.userData.vis = false;
  if (!w.anims.inspect) w.anims.inspect = inspectDef(w);
  w.anims.draw = drawDef();
  // Muzzle flash: a starburst facing you plus two side plumes, all additive.
  if (w.muzzle) {
    const f = new THREE.Group();
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), FLASH_MAT);
    const side1 = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.16), FLASH_SIDE_MAT); side1.rotation.set(Math.PI / 2, 0, 0); side1.position.z = -0.06;
    const side2 = side1.clone(); side2.rotation.set(Math.PI / 2, Math.PI / 2, 0);
    f.add(front, side1, side2); f.visible = false; w.muzzle.add(f); w.flash = f;
  }
  weapons[spec.id] = w;
  addExtraAnims(w);
}


// ---------------------------------------------------------------- extra per-weapon animations
// Inspects that actually do something (press-check, mag check, cylinder spin, bolt peek), the
// "first time you pull it out" cocking animations, a second knife slash, and a dry-fire twitch.
function addExtraAnims(w) {
  const id = w.id;
  const has = (n) => !!w.parts[n];
  const H = RP(w, 'lh'), HR = RR(w, 'lh');
  const look = { p: [-0.05, 0.06, 0.03], r: [0.18, 0.75, 0.35] };
  const other = { p: [-0.03, 0.05, 0.02], r: [0.28, -0.45, -0.4] };
  w.anims.dry = mkDef(0.16, { gun: [[0, Z3, Z3], [0.04, [0, 0.002, 0.006], [0.03, 0, 0.02], 'o'], [0.16, Z3, Z3]] });
  if (id === 'p9') {
    const S = RP(w, 'slide');
    const grabFront = add(S, [-0.03, 0.02, -0.07]), grabRear = add(S, [-0.03, 0.02, 0.07]);
    w.anims.inspect = mkDef(2.5, {
      gun: [[0, Z3, Z3], [0.3, look.p, look.r], [0.6, look.p, look.r], [0.85, add(look.p, [0, 0.01, 0]), add(look.r, [0.1, 0.25, 0])],
        [1.15, add(look.p, [0, 0.01, 0]), add(look.r, [0.1, 0.25, 0])], [1.3, look.p, look.r, 'o'], [1.75, other.p, other.r], [2.1, other.p, other.r], [2.5, Z3, Z3]],
      lh: [[0, H, HR], [0.6, grabFront, [0.2, 0, -1.2]], [0.85, add(grabFront, [0, 0, 0.022]), [0.2, 0, -1.2]], [1.15, add(grabFront, [0, 0, 0.022]), [0.2, 0, -1.2]],
        [1.28, grabFront, [0.2, 0, -1.2], 'o'], [1.6, H, HR]],
      slide: [[0, S, Z3], [0.6, S, Z3], [0.85, add(S, [0, 0, 0.022]), Z3], [1.15, add(S, [0, 0, 0.022]), Z3], [1.28, S, Z3, 'o']],
    }, [[0.75, () => SFX.boltBack()], [1.27, () => click(3400, 0.25)]]);
    w.anims.firstDraw = mkDef(0.95, {
      gun: [[0, [0.02, -0.28, 0.1], [-0.9, 0.35, 0.45]], [0.35, [-0.02, 0.02, 0], [0.1, 0.25, 0.3], 'o'], [0.75, [-0.02, 0.02, 0], [0.1, 0.25, 0.3]], [0.95, Z3, Z3]],
      lh: [[0, H, HR], [0.35, H, HR], [0.5, grabRear, [0.2, 0, -1.2]], [0.6, add(grabRear, [0, 0, 0.045]), [0.2, 0, -1.2], 'o'], [0.63, add(grabRear, [0, 0.01, 0.06]), [0.2, 0, -1.2]], [0.9, H, HR]],
      slide: [[0, S, Z3], [0.5, S, Z3], [0.6, add(S, [0, 0, 0.045]), Z3, 'o'], [0.64, S, Z3, 'o']],
    }, [[0.58, () => SFX.boltBack()], [0.64, () => SFX.slide()]]);
  }
  if ((id === 'ar' || id === 'k7') && w.magInfo) {
    const o = w.magInfo, M = RP(w, 'mag'), MR = RR(w, 'mag');
    const at = (k) => add(M, sc(o.d, k)), hand = (k) => add(at(k + o.grip), o.handAdj || Z3), HG = o.handRot || HR;
    w.anims.inspect = mkDef(2.7, {
      gun: [[0, Z3, Z3], [0.3, o.tilt.p, o.tilt.r], [0.7, o.tilt.p, o.tilt.r], [1.05, add(o.tilt.p, [0, 0.01, 0.01]), add(o.tilt.r, [0.25, 0.25, 0])],
        [1.3, add(o.tilt.p, [0, 0.01, 0.01]), add(o.tilt.r, [0.25, 0.25, 0])], [1.5, o.tilt.p, o.tilt.r], [1.58, add(o.tilt.p, [0, 0.012, 0]), add(o.tilt.r, [0.06, 0, 0]), 'o'],
        [2.05, other.p, other.r], [2.3, other.p, other.r], [2.7, Z3, Z3]],
      lh: [[0, H, HR], [0.45, hand(0), HG], [0.7, hand(0.09), HG], [1.3, hand(0.09), HG], [1.5, hand(0.01), HG], [1.57, hand(-0.005), HG, 'o'], [1.85, H, HR]],
      mag: [[0, M, MR], [0.45, M, MR], [0.7, at(0.09), add(MR, [0, 0.2, 0])], [1.3, at(0.09), add(MR, [0, 0.2, 0])], [1.5, at(0.01), MR], [1.57, M, MR, 'o']],
    }, [[0.5, () => SFX.magout()], [1.5, () => SFX.magin()], [1.57, () => SFX.slap()]]);
    const C = RP(w, 'chg'), CR = RR(w, 'chg');
    const grip = id === 'ar' ? add(C, [-0.035, 0.02, 0.02]) : add(C, [-0.035, 0.0, -0.01]);
    const tr = {
      gun: [[0, [0.02, -0.28, 0.1], [-0.9, 0.35, 0.45]], [0.35, [-0.02, 0.02, 0.0], [0.05, -0.25, -0.15], 'o'], [0.8, [-0.02, 0.02, 0.0], [0.05, -0.25, -0.15]], [1.05, Z3, Z3]],
      lh: [[0, H, HR], [0.3, H, HR], [0.48, grip, [0, 0, -0.6]], [0.6, add(grip, [0, 0, 0.07]), [0, 0, -0.6], 'o'], [0.64, add(grip, [-0.01, 0.02, 0.08]), [0, 0, -0.9]], [0.95, H, HR]],
      chg: [[0, C, CR], [0.48, C, CR], [0.6, add(C, [0, 0, 0.07]), CR, 'o'], [0.64, C, CR, 'o']],
    };
    if (has('bolt')) tr.bolt = [[0, RP(w, 'bolt'), Z3], [0.48, RP(w, 'bolt'), Z3], [0.6, add(RP(w, 'bolt'), [0, 0, 0.05]), Z3, 'o'], [0.64, RP(w, 'bolt'), Z3, 'o']];
    w.anims.firstDraw = mkDef(1.05, tr, [[0.56, () => SFX.boltBack()], [0.64, () => SFX.boltFwd()]]);
  }
  if (id === 'six') {
    const C = RP(w, 'crane');
    w.anims.inspect = mkDef(2.2, {
      gun: [[0, Z3, Z3], [0.3, [-0.05, 0.05, 0], [0.1, 0.4, 0.75]], [1.1, [-0.05, 0.05, 0], [0.1, 0.45, 0.8]], [1.2, [-0.01, 0.02, 0], [-0.05, 0.1, 0.1], 'o'], [1.7, other.p, other.r], [2.2, Z3, Z3]],
      crane: [[0, C, Z3], [0.3, C, Z3], [0.42, C, [0, 0, 1.25], 'o'], [1.12, C, [0, 0, 1.25]], [1.2, C, Z3, 'o']],
    }, [[0.4, () => SFX.cylOpen()], [0.5, (w2) => { w2.cylAngle += Math.PI * 6; SFX.spin(); }], [1.2, () => SFX.cylShut()]]);
    w.anims.firstDraw = mkDef(1.0, {
      gun: [[0, [0.02, -0.28, 0.1], [-0.9, 0.35, 0.45]], [0.35, Z3, Z3, 'o'], [0.45, [0, 0.01, 0], [0, 0, 0.5]], [0.75, [0, 0.01, 0], [0, 0, Math.PI * 2 + 0.5], 'l'], [1.0, Z3, [0, 0, Math.PI * 2]]],
    }, [[0.45, () => noise(0.25, 2500, 0.08, 'bandpass', 2)], [0.9, () => SFX.cylShut()]]);
  }
  if (id === 'm8') {
    const P = RP(w, 'pump');
    w.anims.inspect = mkDef(2.0, {
      gun: [[0, Z3, Z3], [0.35, look.p, look.r], [1.0, look.p, look.r], [1.4, other.p, other.r], [2.0, Z3, Z3]],
      pump: [[0, P, Z3], [0.45, P, Z3], [0.6, add(P, [0, 0, 0.035]), Z3], [0.85, add(P, [0, 0, 0.035]), Z3], [0.95, P, Z3, 'o']],
      lh: [[0, H, HR], [0.45, H, HR], [0.6, add(H, [0, 0, 0.035]), HR], [0.85, add(H, [0, 0, 0.035]), HR], [0.95, H, HR, 'o']],
    }, [[0.55, () => noise(0.06, 1400, 0.2, 'bandpass')], [0.93, () => click(2600, 0.2)]]);
    const fire = w.anims.fire;
    w.anims.firstDraw = mkDef(0.95, {
      gun: [[0, [0.02, -0.28, 0.1], [-0.9, 0.35, 0.45]], [0.35, Z3, Z3, 'o'], [0.62, [0, -0.01, 0.015], [-0.06, 0.05, 0.12]], [0.95, Z3, Z3]],
      pump: fire.tracks.pump.map((k) => [k[0] + 0.25, k[1], k[2], k[3]]),
      lh: fire.tracks.lh.map((k) => [k[0] + 0.25, k[1], k[2], k[3]]),
    }, [[0.45, () => SFX.pump()]]);
  }
  if (id === 'lr') {
    const c = w.anims.cycle;
    const shift = (k) => [k[0] + 0.35, k[1], k[2], k[3]];
    w.anims.firstDraw = mkDef(1.07, {
      gun: [[0, [0.02, -0.28, 0.1], [-0.9, 0.35, 0.45]], [0.35, Z3, Z3, 'o'], ...c.tracks.gun.slice(1).map(shift)],
      bolt: c.tracks.bolt.map(shift), rh: c.tracks.rh.map(shift),
    }, [[0.59, () => SFX.boltBack()], [0.8, () => SFX.boltFwd()]]);
    const Bo = RP(w, 'bolt'), R = RP(w, 'rh'), RRr = RR(w, 'rh');
    const knob = add(Bo, [0.045, -0.01, 0.045]);
    w.anims.inspect = mkDef(2.3, {
      gun: [[0, Z3, Z3], [0.35, [-0.03, 0.04, 0.03], [0.12, 0.5, 0.25]], [1.4, [-0.03, 0.04, 0.03], [0.15, 0.55, 0.3]], [1.8, other.p, other.r], [2.3, Z3, Z3]],
      rh: [[0, R, RRr], [0.45, knob, [0.9, 0.15, 0.1]], [0.6, add(knob, [0, 0.03, 0]), [0.9, 0.15, 0.1]], [0.75, add(knob, [0, 0.03, 0.04]), [0.9, 0.15, 0.1]],
        [1.1, add(knob, [0, 0.03, 0.04]), [0.9, 0.15, 0.1]], [1.2, add(knob, [0, 0.03, 0]), [0.9, 0.15, 0.1], 'o'], [1.28, knob, [0.9, 0.15, 0.1]], [1.55, R, RRr]],
      bolt: [[0, Bo, Z3], [0.45, Bo, Z3], [0.6, Bo, [0, 0, 0.95]], [0.75, add(Bo, [0, 0, 0.04]), [0, 0, 0.95]], [1.1, add(Bo, [0, 0, 0.04]), [0, 0, 0.95]],
        [1.2, Bo, [0, 0, 0.95], 'o'], [1.28, Bo, Z3]],
    }, [[0.7, () => SFX.boltBack()], [1.2, () => SFX.boltFwd()]]);
  }
  if (id === 'lmg') {
    const C = RP(w, 'chg');
    w.anims.firstDraw = mkDef(1.05, {
      gun: [[0, [0.02, -0.28, 0.1], [-0.9, 0.35, 0.45]], [0.35, [-0.02, 0.02, 0], [0.05, -0.2, -0.1], 'o'], [0.8, [-0.02, 0.02, 0], [0.05, -0.2, -0.1]], [1.05, Z3, Z3]],
      lh: [[0, H, HR], [0.3, H, HR], [0.5, add(C, [-0.04, -0.01, -0.01]), [0, 0, -0.6]], [0.62, add(C, [-0.04, -0.01, 0.09]), [0, 0, -0.6], 'o'], [0.95, H, HR]],
      chg: [[0, C, Z3], [0.5, C, Z3], [0.62, add(C, [0, 0, 0.1]), Z3, 'o'], [0.66, C, Z3, 'o']],
    }, [[0.6, () => SFX.boltBack()], [0.66, () => SFX.boltFwd()]]);
  }
  if (id === 'knife') {
    w.anims.fire2 = mkDef(0.45, {
      gun: [[0, Z3, Z3], [0.08, [-0.1, 0.06, 0.05], [0.25, -0.5, 0.6]], [0.22, [0.1, -0.05, -0.12], [-0.25, 0.55, -1.0], 'o'], [0.45, Z3, Z3]],
    }, [[0.08, () => SFX.knife()]]);
  }
}

// ---------------------------------------------------------------- animation player
let anim = null;
let animSpeed = 1;
const debris = [];
function resetVis(w) {
  for (const n in w.parts) if (n !== 'gun') w.parts[n].visible = w.parts[n].userData.vis;
  if (w.refresh) w.refresh(w);
}
function play(name, onEnd) {
  const w = cur;
  if (anim) cancelAnim();
  const def = w.anims[name];
  if (!def) { if (onEnd) onEnd(); return; }
  anim = { w, def, name, t: 0, ei: 0, onEnd };
}
function cancelAnim() {
  if (!anim) return;
  const w = anim.w; anim = null; resetVis(w);
}
function updateAnim(dt) {
  if (!anim) return;
  anim.t += dt * animSpeed;
  const ev = anim.def.events;
  const a = anim;
  while (a.ei < ev.length && ev[a.ei][0] <= a.t) { ev[a.ei][1](a.w); a.ei++; if (anim !== a) return; }
  if (a.t >= a.def.dur) { anim = null; resetVis(a.w); if (a.onEnd) a.onEnd(); }
}
function applyPose(w, dt) {
  const tracks = anim && anim.w === w ? anim.def.tracks : null;
  for (const n in w.parts) {
    const o = w.parts[n];
    const tr = tracks && tracks[n];
    if (tr) {
      const k = sampleTrack(tr, anim.t);
      o.position.set(k[1][0], k[1][1], k[1][2]);
      o.rotation.set(k[2][0], k[2][1], k[2][2]);
    } else if (w.locked && w.lock[n]) {
      const p = LP(w, n), r = LR(w, n);
      o.position.set(p[0], p[1], p[2]); o.rotation.set(r[0], r[1], r[2]);
    } else {
      const p = o.userData.rp, r = o.userData.rr;
      o.position.set(p[0], p[1], p[2]); o.rotation.set(r[0], r[1], r[2]);
    }
  }
  if (w.post) w.post(w, dt);
}
const isReloading = () => !!(anim && anim.name.startsWith('reload'));

// ---------------------------------------------------------------- world
const solids = [];      // meshes bullets/LOS hit
const boxes = [];       // AABBs for movement: {x0,x1,z0,z1,top}
const worldGroup = new THREE.Group();
scene.add(worldGroup);
scene.environment = ENV;
const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x6a5a48, 0.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe4c4, 2.3);
sun.position.set(28, 50, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);
// World muzzle light (so your shots light up the walls around you).
const worldFlashLight = new THREE.PointLight(0xffb060, 0, 9, 2);
scene.add(worldFlashLight);
// Sky dome: a vertical gradient with a sun glow, drawn behind everything.
const skyUniforms = { top: { value: new THREE.Color(0x4f86c6) }, horizon: { value: new THREE.Color(0xdbe6ef) }, sunDir: { value: new THREE.Vector3(0.45, 0.6, 0.3).normalize() }, sunCol: { value: new THREE.Color(0xfff2d8) } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vDir;
    void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.55));
      float s = max(dot(normalize(vDir), sunDir), 0.0); c += sunCol * (smoothstep(0.9995, 0.9998, s) * 3.0 + pow(s, 40.0) * 0.35 + pow(s, 6.0) * 0.12);
      if (vDir.y < 0.0) c = mix(horizon, horizon * 0.7, clamp(-vDir.y * 4.0, 0.0, 1.0));
      gl_FragColor = vec4(c, 1.0); }`,
}));
scene.add(sky);
function setSky(top, horizon, sunDir) {
  skyUniforms.top.value.set(top); skyUniforms.horizon.value.set(horizon);
  skyUniforms.sunDir.value.copy(sunDir).normalize();
  sun.position.copy(sunDir).normalize().multiplyScalar(60);
  scene.fog = new THREE.Fog(horizon, 60, 220);
  scene.background = new THREE.Color(horizon);
}

function canvasTex(w, h, draw) {
  const c = cnv(w, h);
  draw(c.getContext('2d'), w, h);
  return tex(c);
}
// Materials whose texture repeat depends on the surface size get their own clone per surface.
function surfMat(base, rx, ry) {
  const m = base.clone();
  for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) { m[k] = m[k].clone(); m[k].repeat.set(rx, ry); m[k].needsUpdate = true; }
  return m;
}
const concreteBase = std({ map: T.concrete, normalMap: T.concreteN, roughness: 0.92, metalness: 0, color: 0xffffff });
const wallBase = std({ map: T.wall, normalMap: T.wallN, roughness: 0.9, metalness: 0 });
const woodBase = std({ map: T.wood, normalMap: T.woodN, roughness: 0.82, metalness: 0 });
const concrete = concreteBase;
function addSolid(x, z, w, d, h, mat, y0 = 0, opts = {}) {
  const geo = opts.sharp ? new THREE.BoxGeometry(w, h, d) : roundedBoxGeo(w, h, d, Math.min(0.04, Math.min(w, h, d) * 0.1));
  let m2 = mat;
  if (mat === concrete) m2 = surfMat(concreteBase, Math.max(w, d) / 3, h / 3);
  if (mat === wallMat) m2 = surfMat(wallBase, Math.max(w, d) / 4, h / 4);
  const m = new THREE.Mesh(geo, m2);
  m.position.set(x, y0 + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  worldGroup.add(m); solids.push(m);
  boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, top: y0 + h, bottom: y0 });
  return m;
}
function addFloor(w, l, z = 0) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, l), surfMat(concreteBase, w / 4, l / 4));
  floor.rotation.x = -Math.PI / 2; floor.position.z = z; floor.receiveShadow = true;
  worldGroup.add(floor); solids.push(floor);
  return floor;
}
function paintLine(x, z, w, d, color = 0xd9a21b) {
  const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std({ color, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1 }));
  l.rotation.x = -Math.PI / 2; l.position.set(x, 0.005, z); l.receiveShadow = true; worldGroup.add(l);
}
function clearWorld() {
  while (worldGroup.children.length) {
    const c = worldGroup.children.pop();
    c.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) { /* rounded geos are cached and shared */ } });
  }
  solids.length = 0; boxes.length = 0;
  for (const d of decals) scene.remove(d); decals.length = 0;
}
// Wooden crates in a few stains, and painted metal for the cover blocks.
const crateMats = [0xffffff, 0xd8c8b0, 0xb8a890, 0xe8dcc8, 0xc0b098].map((c) => { const m = woodBase.clone(); m.color = new THREE.Color(c); return m; });
const wallMat = wallBase;
function containerMat(color, w, h) {
  const c = cnv(512, 256), x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, 512, 256);
  blotches(x, 512, 256, 30, 10, 60, ['20,15,10'], 0.12);
  for (let i = 0; i < 26; i++) { const sx = rand(0, 512); const g = x.createLinearGradient(sx, 0, sx, rand(60, 220)); g.addColorStop(0, 'rgba(110,55,20,0.45)'); g.addColorStop(1, 'rgba(110,55,20,0)'); x.fillStyle = g; x.fillRect(sx, 0, rand(2, 6), 256); }
  speckle(x, 512, 256, 2500, 2, ['90,50,20', '230,230,220'], 0.25);
  const n = T.corrN.clone(); n.repeat.set(w / 2.5, 1); n.needsUpdate = true;
  return std({ map: tex(c, { repeat: [w / 6, 1] }), normalMap: n, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.55, metalness: 0.45 });
}
function stripedContainer(x, z, w, d, h, color, rotY = 0) {
  const ww = rotY ? d : w, dd = rotY ? w : d;
  return addSolid(x, z, ww, dd, h, containerMat(color, Math.max(ww, dd), h), 0, { sharp: true });
}
// Bullet holes: dark scorched discs stuck to whatever you hit (oldest recycled first).
const decals = [];
const decalMat = new THREE.MeshBasicMaterial({ map: tex((() => {
  const c = cnv(64), x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(10,10,10,1)'); g.addColorStop(0.25, 'rgba(25,22,20,0.95)'); g.addColorStop(0.6, 'rgba(60,55,50,0.4)'); g.addColorStop(1, 'rgba(60,55,50,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c;
})()), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const decalGeo = new THREE.PlaneGeometry(0.09, 0.09);
function addDecal(hit) {
  if (!hit.face) return;
  const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const m = new THREE.Mesh(decalGeo, decalMat);
  m.position.copy(hit.point).addScaledVector(n, 0.004);
  m.lookAt(hit.point.clone().add(n));
  m.rotateZ(Math.random() * Math.PI * 2);
  scene.add(m); decals.push(m);
  if (decals.length > 80) scene.remove(decals.shift());
}

let ARENA = 'foundry';
let SPAWNS = [];
function buildFoundry() {
  clearWorld();
  ARENA = 'foundry';
  setSky(0x5b84b8, 0xe9d2b4, new THREE.Vector3(0.7, 0.35, 0.25)); // late-afternoon sun, long shadows
  const S = 64;
  addFloor(S, S);
  for (const [x, z, w, d] of [[0, 0, 0.18, 40], [0, 0, 40, 0.18], [0, -14, 20, 0.18], [0, 14, 20, 0.18]]) paintLine(x, z, w, d);
  const H = 7;
  addSolid(0, -S / 2, S, 1, H, wallMat); addSolid(0, S / 2, S, 1, H, wallMat);
  addSolid(-S / 2, 0, 1, S, H, wallMat); addSolid(S / 2, 0, 1, S, H, wallMat);
  // central raised deck you can jump onto
  addSolid(0, 0, 8, 8, 1.0, concrete);
  addSolid(0, 0, 3, 3, 2.4, crateMats[3], 1.0);
  // shipping containers
  stripedContainer(-14, -8, 2.6, 9, 2.8, '#2f6b8f');
  stripedContainer(14, 8, 2.6, 9, 2.8, '#9c3d2a');
  stripedContainer(-8, 18, 10, 2.6, 2.8, '#5b7a33');
  stripedContainer(8, -18, 10, 2.6, 2.8, '#8f6b2f');
  stripedContainer(-22, 14, 2.6, 7, 2.8, '#6a4f7d');
  stripedContainer(22, -14, 2.6, 7, 2.8, '#2f6b8f');
  // crates
  const crates = [[-6, -6, 1.4], [6, 6, 1.4], [-6, 8, 1.2], [6, -8, 1.2], [-18, -20, 1.6], [18, 20, 1.6], [-24, -2, 1.3], [24, 2, 1.3],
    [-12, 26, 1.1], [12, -26, 1.1], [-27, 25, 1.5], [27, -25, 1.5], [16, -4, 1.0], [-16, 4, 1.0], [3, 24, 1.3], [-3, -24, 1.3]];
  crates.forEach(([x, z, s], i) => addSolid(x, z, s, s, s, crateMats[i % crateMats.length]));
  addSolid(-6, -6, 1.0, 1.0, 1.0, crateMats[2], 1.4);
  // pillars
  for (const [x, z] of [[-10, -12], [10, 12], [-10, 12], [10, -12]]) addSolid(x, z, 1.2, 1.2, 7, concrete);
  SPAWNS = [[-27, -27], [27, 27], [-27, 27], [27, -27], [0, -28], [0, 28], [-28, 0], [28, 0], [-18, 4], [18, -4], [-4, 18], [4, -18]];
}

function buildYard() {
  clearWorld();
  ARENA = 'yard';
  setSky(0x4a7fc0, 0xdfe8ef, new THREE.Vector3(0.9, 0.75, 0.05)); // side-on sun so neither spawn faces it
  const S = 40;
  addFloor(S, S);
  for (const z of [-15, 15]) { const l = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.25, 32), std({ color: 0xd9a21b, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1 })); l.rotation.x = -Math.PI / 2; l.position.set(0, 0.005, z); l.receiveShadow = true; worldGroup.add(l); }
  paintLine(0, 0, S, 0.15);
  addSolid(0, -S / 2, S, 1, 6, wallMat); addSolid(0, S / 2, S, 1, 6, wallMat);
  addSolid(-S / 2, 0, 1, S, 6, wallMat); addSolid(S / 2, 0, 1, S, 6, wallMat);
  // Mirror-symmetric cover so neither spawn has an edge.
  const half = [[-6, -8, 1.4, 1.4, 1.4], [6, -8, 1.4, 1.4, 1.4], [0, -10, 4, 0.8, 1.1], [-12, -4, 2.6, 6, 2.8], [12, -4, 2.6, 6, 2.8],
    [-5, -3, 1.2, 1.2, 1.2], [5, -3, 1.2, 1.2, 1.2], [-15, -13, 1.6, 1.6, 1.6], [15, -13, 1.6, 1.6, 1.6]];
  half.forEach(([x, z, w, d, h], i) => {
    addSolid(x, z, w, d, h, crateMats[i % crateMats.length]);
    addSolid(-x, -z, w, d, h, crateMats[i % crateMats.length]);
  });
  addSolid(0, 0, 3, 3, 1.0, concrete);
  addSolid(0, 0, 1.2, 1.2, 2.6, crateMats[3], 1.0);
  SPAWNS = [[0, -15], [0, 15]];
}

const targets = [];
function buildRange() {
  clearWorld();
  ARENA = 'range';
  setSky(0x4b80c4, 0xdde7f0, new THREE.Vector3(0.4, 0.8, 0.5));
  const W = 16, L = 120;
  addFloor(W, L, -L / 2 + 8);
  addSolid(-W / 2, -L / 2 + 8, 1, L, 6, wallMat); addSolid(W / 2, -L / 2 + 8, 1, L, 6, wallMat);
  addSolid(0, -L + 8, W, 1, 6, wallMat); addSolid(0, 8.5, W, 1, 6, wallMat);
  // firing line bench
  addSolid(0, -1.2, W - 1, 0.6, 1.0, concrete);
  // lane stripes
  for (const x of [-4, 0, 4]) paintLine(x, -L / 2 + 2, 0.08, L - 10);
  targets.length = 0;
  const rows = [[10, [-6, -2, 2, 6]], [25, [-5, 0, 5]], [50, [-4, 4]], [75, [-2, 3]], [100, [0]]];
  for (const [dist, xs] of rows) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.2), new THREE.MeshBasicMaterial({ map: canvasTex(256, 100, (c, w, h) => {
      c.fillStyle = '#14161c'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffb347'; c.font = 'bold 64px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(`${dist} m`, w / 2, h / 2 + 4);
    }), transparent: false }));
    sign.position.set(-W / 2 + 0.52, 3.6, -dist); sign.rotation.y = Math.PI / 2; worldGroup.add(sign);
    for (const x of xs) targets.push(makeTarget(x, -dist));
  }
}
const targetMat = std({ color: 0xd8cfb8, roughness: 0.9 });
const targetRing = std({ color: 0x9e2a20, roughness: 0.8 });
function makeTarget(x, z) {
  const pivot = grp(worldGroup, x, 0, z);
  box(0.12, 0.6, 0.12, MAT.dark, 0, 0.3, 0, pivot);
  const body = box(0.9, 1.1, 0.06, targetMat, 0, 1.15, 0, pivot);
  const head = box(0.45, 0.45, 0.06, targetMat, 0, 1.98, 0, pivot);
  box(0.4, 0.4, 0.07, targetRing, 0, 1.2, 0, pivot);
  box(0.16, 0.16, 0.075, targetMat, 0, 1.2, 0, pivot);
  pivot.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const t = { pivot, down: 0, hp: 100, upT: 0 };
  body.userData.target = t; head.userData.target = t; head.userData.head = true;
  t.hit = [body, head];
  return t;
}

// ---------------------------------------------------------------- bots
const BOT_NAMES = ['Rusty', 'Sprocket', 'Clank', 'Gizmo', 'Ratchet'];
const BOT_COLORS = [0xd9622b, 0x2bb3d9, 0x8fd92b, 0xd92b8c, 0xd9c22b];
const bots = [];
function nameTex(name) {
  return canvasTex(256, 64, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 8, w, 48); c.fillStyle = '#fff'; c.font = 'bold 30px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(name).slice(0, 18), w / 2, 33);
  });
}
// A soldier: camo uniform, plate carrier with pouches, helmet and goggles, gloves, boots, and a
// rifle held in both hands. `color` is the team armband/helmet-cover accent so you can tell
// fighters apart. Legs swing from the hips and bend at the knees when walking.
const SKIN_TONES = [0xc58c64, 0x8d5a3c, 0xe0b28e, 0x6b4430, 0xd9a17c, 0xb07a52];
function makeBot(i, name = BOT_NAMES[i], color = BOT_COLORS[i]) {
  const g = new THREE.Group();
  const uniform = std({ map: T.fabric, normalMap: T.fabricN, roughness: 0.95 });
  const vest = std({ color: 0x4a4a3a, normalMap: T.fabricN, roughness: 0.9 });
  const skin = std({ color: SKIN_TONES[i % SKIN_TONES.length], roughness: 0.62 });
  const helm = std({ color: 0x55573f, roughness: 0.75, normalMap: T.stippleN, normalScale: new THREE.Vector2(0.3, 0.3) });
  const accent = std({ color, roughness: 0.6 });
  const boot = std({ color: 0x2e2620, roughness: 0.8, normalMap: T.leatherN });
  const lens = std({ color: 0x101418, roughness: 0.05, metalness: 0.8 });
  const hit = [];
  const H = (m, head) => { hit.push(m); m.userData.head = !!head; return m; };
  // legs
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = grp(g, sx * 0.1, 0.92, 0);
    H(limb(hip, 0.078, 0.07, 0.42, uniform));
    const knee = grp(hip, 0, -0.43, 0);
    H(limb(knee, 0.064, 0.056, 0.4, uniform));
    box(0.12, 0.06, 0.04, vest, 0, -0.02, -0.05, knee); // knee pad
    const b = box(0.11, 0.1, 0.25, boot, 0, -0.44, -0.04, knee);
    hit.push(b);
    legs.push({ hip, knee });
  }
  H(box(0.33, 0.2, 0.21, uniform, 0, 0.98, 0, g));                 // pelvis + belt
  box(0.35, 0.05, 0.23, vest, 0, 1.06, 0, g);
  H(box(0.36, 0.48, 0.21, uniform, 0, 1.3, 0, g));                 // torso
  H(box(0.4, 0.38, 0.27, vest, 0, 1.3, -0.005, g));                // plate carrier
  for (const px of [-0.12, 0, 0.12]) box(0.1, 0.12, 0.06, vest, px, 1.2, -0.15, g); // mag pouches
  box(0.18, 0.1, 0.05, vest, 0, 1.4, 0.15, g);                    // back pouch
  cyl(0.05, 0.08, skin, 0, 1.58, 0, g, 'y', 12);                  // neck
  const headM = H(sphere(0.105, skin, 0, 1.69, 0, g, 20, 14), true);
  headM.scale.set(0.95, 1.08, 1);
  const helmet = H(new THREE.Mesh(new THREE.SphereGeometry(0.128, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), helm), true);
  helmet.position.set(0, 1.71, 0.005); g.add(helmet);
  const cover = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.012, 8, 28), accent); cover.rotation.x = Math.PI / 2; cover.position.set(0, 1.73, 0.005); g.add(cover);
  box(0.17, 0.045, 0.05, lens, 0, 1.71, -0.095, g);                // goggles
  box(0.19, 0.025, 0.02, helm, 0, 1.74, -0.105, g);
  // Arms + rifle pivot together around the chest so the whole thing tilts with aim.
  const arm = grp(g, 0, 1.4, 0);
  const rifle = grp(arm, 0.12, -0.02, -0.12);
  box(0.05, 0.07, 0.38, MAT.metal, 0, 0, -0.15, rifle);
  box(0.055, 0.06, 0.2, MAT.tan, 0, 0, -0.42, rifle);
  cyl(0.011, 0.18, MAT.dark, 0, 0.005, -0.61, rifle);
  box(0.045, 0.08, 0.18, MAT.tan, 0, -0.02, 0.1, rifle);
  box(0.03, 0.13, 0.05, MAT.olive, 0, -0.09, -0.16, rifle, 0.2);
  box(0.03, 0.03, 0.08, MAT.dark, 0, 0.055, -0.15, rifle);
  // right arm: shoulder -> elbow -> hand on grip; left arm reaches the handguard
  const shR = grp(arm, 0.2, 0.02, 0, 0.75, 0, 0.2);
  H(limb(shR, 0.058, 0.05, 0.27, uniform));
  box(0.07, 0.06, 0.03, accent, 0, -0.08, 0.0, shR).scale.set(1.05, 1, 2.2); // armband
  const elR = grp(shR, 0, -0.27, 0, 0.95, 0, 0);
  H(limb(elR, 0.048, 0.042, 0.25, uniform));
  sphere(0.04, MAT.glove, 0, -0.26, 0, elR, 10, 8);
  const shL = grp(arm, -0.2, 0.02, 0, 1.0, 0, -0.45);
  H(limb(shL, 0.058, 0.05, 0.27, uniform));
  const elL = grp(shL, 0, -0.27, 0, 0.75, 0, 0.6);
  H(limb(elL, 0.048, 0.042, 0.3, uniform));
  sphere(0.04, MAT.glove, 0, -0.31, 0, elL, 10, 8);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), FLASH_MAT); flash.position.set(0.12, -0.015, -0.78); flash.visible = false; arm.add(flash);
  const flash2 = flash.clone(); flash2.rotation.y = Math.PI / 2; flash.add(flash2); flash2.position.set(0, 0, 0);
  // Name tag
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTex(name), depthTest: false }));
  tag.scale.set(1.4, 0.35, 1); tag.position.y = 2.15; g.add(tag);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const b = { i, name, tag, g, legL: legs[0].hip, legR: legs[1].hip, kneeL: legs[0].knee, kneeR: legs[1].knee, arm, flash, flashMat: uniform,
    x: 0, z: 0, yaw: 0, hp: 100, alive: false, respawnT: 0, level: 0, fireT: 1,
    strafe: 1, strafeT: 0, target: null, retargetT: 0, walk: 0, flashT: 0, lastHurtBy: null };
  for (const m of hit) m.userData.bot = b;
  b.hit = hit;
  scene.add(g);
  g.visible = false;
  return b;
}
for (let i = 0; i < 5; i++) bots.push(makeBot(i));
// The online opponent reuses the bot body (but is never in `bots`, so no AI ever drives it).
const opp = makeBot(5, 'Opponent', 0xe8e8f0);
opp.tx = 0; opp.ty = 0; opp.tz = 0; opp.tyaw = 0; opp.pitch = 0; opp.anim = null;
const botHitMeshes = () => {
  const list = bots.filter((b) => b.alive).flatMap((b) => b.hit);
  if (mode === 'duel' && opp.alive) list.push(...opp.hit);
  return list;
};

// ---------------------------------------------------------------- player
const player = { x: 0, y: 0, z: 0, vy: 0, yaw: 0, pitch: 0, hp: 100, alive: true, onGround: true, slideT: 0, slideDir: [0, 0], level: 0, kills: 0, respawnT: 0, regenT: 0 };
const RADIUS = 0.35;
const keys = new Set();
let mouseDown = false, mouseFresh = false, aiming = false;
let mode = null; // 'gungame' | 'range'
let playing = false;
let cur = null;
let slowmo = false;
let testRun = false; // automated checks only: keeps the game ticking without pointer lock
let gameStart = 0;
let camKickPitch = 0;
let muzzleLightT = 0;
const recoil = { z: 0, rx: 0, vz: 0, vrx: 0 };
const sway = { x: 0, y: 0 };
let bobPhase = 0;
let adsAmt = 0, sprintAmt = 0;
const land = { y: 0, v: 0 };       // spring: the gun dips when you land and lifts when you jump
const camAnim = { x: 0, z: 0 };    // the camera follows the gun a little during animations

function collidePos(x, z, feetY, r = RADIUS) {
  for (const b of boxes) {
    if (b.top <= feetY + 0.45 || b.bottom >= feetY + 1.7) continue;
    const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1);
    const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2); x = cx + dx / d * r; z = cz + dz / d * r; }
      else {
        const pen = [x - b.x0 + r, b.x1 - x + r, z - b.z0 + r, b.z1 - z + r];
        const m = Math.min(...pen);
        if (m === pen[0]) x = b.x0 - r; else if (m === pen[1]) x = b.x1 + r; else if (m === pen[2]) z = b.z0 - r; else z = b.z1 + r;
      }
    }
  }
  return [x, z];
}
function groundAt(x, z, feetY, r = RADIUS) {
  let h = 0;
  for (const b of boxes) {
    if (b.top > feetY + 0.45) continue;
    if (x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1) h = Math.max(h, b.top);
  }
  return h;
}

// ---------------------------------------------------------------- HUD
const hudEls = {
  mag: $('ammo-mag'), cap: $('ammo-cap'), name: $('weapon-name'), hint: $('reload-hint'), hpFill: $('health-fill'), hpNum: $('health-num'),
  hit: $('hitmarker'), banner: $('banner'), feed: $('killfeed'), ladder: $('ladder'), dmg: $('damage-flash'), scope: $('scope'), ch: $('crosshair'),
};
function updateAmmoHud() {
  if (!cur) return;
  const s = cur.spec;
  hudEls.name.textContent = s.name;
  if (s.melee) { hudEls.mag.textContent = '∞'; hudEls.cap.textContent = ''; hudEls.hint.classList.add('hidden'); hudEls.mag.classList.remove('low'); return; }
  hudEls.mag.textContent = cur.ammo;
  hudEls.cap.textContent = `/ ${cur.cap}`;
  const low = cur.ammo <= Math.ceil(cur.cap * 0.25) && cur.ammo < cur.cap;
  hudEls.mag.classList.toggle('low', low);
  hudEls.hint.classList.toggle('hidden', !(low && !isReloading()));
}
function updateHpHud() {
  hudEls.hpFill.style.width = `${Math.max(0, player.hp)}%`;
  hudEls.hpNum.textContent = Math.max(0, Math.ceil(player.hp));
}
let hitT = 0;
function showHit(head) { hudEls.hit.classList.toggle('head', !!head); hudEls.hit.style.opacity = 1; hitT = 0.18; }
let bannerT = 0;
function banner(html, t = 1.6) { hudEls.banner.innerHTML = html; hudEls.banner.style.opacity = 1; bannerT = t; }
function feed(text, me) {
  const d = document.createElement('div'); d.textContent = text; if (me) d.className = 'me';
  hudEls.feed.prepend(d);
  while (hudEls.feed.children.length > 5) hudEls.feed.lastChild.remove();
  setTimeout(() => d.remove(), 5000);
}
function renderLadder() {
  if (mode !== 'gungame') return;
  const leader = bots.reduce((a, b) => (b.level > a.level ? b : a), bots[0]);
  let html = '<h3>GUN GAME</h3>';
  GUN_ORDER.forEach((id, i) => {
    const cls = i < player.level ? 'done' : i === player.level ? 'cur' : '';
    html += `<div class="row ${cls}"><span>${i + 1}. ${weapons[id].spec.name}</span><span>${i < player.level ? '✓' : i === player.level ? '◀' : ''}</span></div>`;
  });
  html += `<div class="lead">Top bot: ${leader.name} — ${leader.level + 1}/9</div>`;
  hudEls.ladder.innerHTML = html;
}
function floatText(text, pos, color) {
  const v = pos.clone().project(camera);
  if (v.z > 1) return;
  const d = document.createElement('div');
  d.textContent = text;
  d.style.cssText = `position:absolute;left:${(v.x + 1) / 2 * innerWidth}px;top:${(1 - v.y) / 2 * innerHeight}px;transform:translate(-50%,-50%);font:900 22px system-ui;color:${color};text-shadow:0 2px 4px #000;transition:transform .7s ease-out,opacity .7s;pointer-events:none`;
  $('hud').appendChild(d);
  requestAnimationFrame(() => { d.style.transform = 'translate(-50%,-160%)'; d.style.opacity = '0'; });
  setTimeout(() => d.remove(), 750);
}

// ---------------------------------------------------------------- weapons in hand
function equip(id, silent) {
  if (cur && cur.id === id) return;
  cancelAnim();
  if (cur) cur.gun.visible = false;
  cur = weapons[id];
  cur.gun.visible = true;
  resetVis(cur);
  cur.nextShot = 0;
  // The first time you pull a gun out it gets cocked/racked/checked; after that, a quick draw.
  if (!silent) { if (!cur.drawn && cur.anims.firstDraw) play('firstDraw'); else play('draw'); }
  cur.drawn = true;
  updateAmmoHud();
}
function startReload() {
  const w = cur, s = w.spec;
  if (s.melee || w.ammo >= w.cap + (s.chamber && w.ammo > 0 ? 1 : 0) || isReloading()) return;
  if (s.kind === 'shotgun') {
    if (w.ammo >= w.cap) return;
    const wasEmpty = w.ammo === 0;
    w.stopShells = false;
    const loop = () => {
      if (cur !== w) return;
      if (w.ammo >= w.cap || w.stopShells) { play(wasEmpty ? 'reloadEndPump' : 'reloadEnd'); return; }
      play('reloadShell', loop);
    };
    play('reloadStart', loop);
    return;
  }
  if (s.kind === 'sniper' || s.kind === 'launcher' || s.kind === 'revolver' || s.kind === 'lmg') {
    if (w.ammo >= w.cap) return;
    play('reload');
    return;
  }
  // Mag-fed with a chamber: tactical (keeps a round chambered, +1) vs. empty (has to release the slide/bolt).
  if (w.ammo > w.cap) return;
  play(w.ammo === 0 ? 'reloadEmpty' : 'reload');
  updateAmmoHud();
}
function tryInspect() {
  if (anim || !cur) return;
  play('inspect');
}

// ---------------------------------------------------------------- shooting
const ray = new THREE.Raycaster();
const tracers = [];
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.85 });
function tracer(from, to) {
  const g = new THREE.BufferGeometry().setFromPoints([from, to]);
  const l = new THREE.Line(g, tracerMat.clone());
  scene.add(l); tracers.push({ l, life: 0.06 });
}
const sparks = [];
const SPARK_GEO = new THREE.SphereGeometry(0.018, 6, 4);
function spark(p, color = 0xffd27a, n = 5) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(SPARK_GEO, new THREE.MeshBasicMaterial({ color }));
    m.position.copy(p); scene.add(m);
    sparks.push({ m, v: new THREE.Vector3(rand(-2, 2), rand(0.5, 3), rand(-2, 2)), life: 0.35 });
  }
}
function camForward() { const v = new THREE.Vector3(); camera.getWorldDirection(v); return v; }
function muzzleWorld() {
  const p = camera.position.clone();
  const r = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const u = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  return p.add(camForward().multiplyScalar(0.8)).add(r.multiplyScalar(0.18 * (1 - adsAmt))).add(u.multiplyScalar(-0.15 + 0.08 * adsAmt));
}
function tryFire(now) {
  const w = cur, s = w && w.spec;
  if (!player.alive || !w || frozen()) return;
  if (anim) {
    if (s.kind === 'shotgun' && anim.name.startsWith('reloadShell') && w.ammo > 0) { w.stopShells = true; return; }
    if (anim.name === 'inspect') cancelAnim();
    else if (anim.name !== 'fire' && anim.name !== 'fireLast' && anim.name !== 'fire2') return;
  }
  if (now < w.nextShot) return;
  if (!s.auto && !mouseFresh) return;
  mouseFresh = false;
  if (s.melee) { w.nextShot = now + s.interval; w.slashAlt = !w.slashAlt; play(w.slashAlt ? 'fire' : 'fire2'); setTimeout(() => meleeHit(), 120); return; }
  if (w.ammo <= 0) { w.nextShot = now + 0.3; SFX.dry(); if (!anim) play('dry', () => startReload()); return; }
  w.ammo--;
  w.nextShot = now + s.interval;
  shoot(w);
  if (w.ammo === 0 && w.lock && Object.keys(w.lock).length && s.chamber) w.locked = true;
  const after = () => {
    if (cur !== w) return;
    if (s.kind === 'sniper' && w.ammo > 0) play('cycle');
    else if (w.ammo === 0) setTimeout(() => { if (cur === w && !anim && w.ammo === 0 && player.alive) startReload(); }, s.kind === 'launcher' ? 250 : 200);
  };
  if (w.ammo === 0 && w.anims.fireLast) play('fireLast', after);
  else if (w.anims.fire) play('fire', after);
  else { cancelAnim(); after(); }
  if (s.kind === 'revolver') w.cylAngle += Math.PI / 3;
  if (s.kind === 'launcher') w.parts.rocket.visible = false;
  updateAmmoHud();
}
function shoot(w) {
  const s = w.spec;
  SFX.shot(s.kind);
  muzzleLightT = 0.05;
  worldFlashLight.position.copy(muzzleWorld());
  if (w.muzzle) w.muzzle.getWorldPosition(vmFlashLight.position);
  if (w.flash) { w.flash.visible = true; w.flash.rotation.z = Math.random() * Math.PI; w.flash.scale.setScalar(rand(0.8, 1.3) * (s.kind === 'shotgun' || s.kind === 'sniper' ? 1.6 : 1)); w.flashT = 0.04; }
  if (s.kind !== 'revolver' && s.kind !== 'shotgun' && s.kind !== 'sniper' && s.kind !== 'launcher') casing(w);
  recoil.vz += s.kick * 30; recoil.vrx += s.kickR * 30;
  camKickPitch += s.camKick * (1 - adsAmt * 0.4);
  if (s.kind === 'launcher') { fireRocket(); return; }
  const moving = Math.hypot(vel.x, vel.z) > 0.5;
  const spread = lerp(s.spread, s.adsSpread, adsAmt) * (moving ? 1.6 : 1) * (player.onGround ? 1 : 2);
  const pellets = s.pellets || 1;
  let oppDmg = 0, oppHead = false, firstEnd = null;
  for (let i = 0; i < pellets; i++) {
    const dir = camForward();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
    dir.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
    ray.set(camera.position, dir); ray.far = 300;
    const hits = ray.intersectObjects([...solids, ...botHitMeshes(), ...targets.flatMap((t) => t.hit)], false);
    const h = hits[0];
    const end = h ? h.point : camera.position.clone().addScaledVector(dir, 120);
    if (i < 3) tracer(muzzleWorld(), end);
    if (!firstEnd) firstEnd = end;
    if (!h) continue;
    const dist = h.distance;
    const fall = dist > s.range ? Math.max(0.45, 1 - (dist - s.range) / (s.range * 1.5)) : 1;
    const head = !!h.object.userData.head;
    const dmg = s.dmg * fall * (head ? s.head : 1);
    if (h.object.userData.bot === opp) { oppDmg += dmg; oppHead = oppHead || head; spark(h.point, 0xff5040, 4); }
    else if (h.object.userData.bot) { damageBot(h.object.userData.bot, dmg, head, 'you'); spark(h.point, 0xff5040, 4); }
    else if (h.object.userData.target) { hitTarget(h.object.userData.target, dmg, head, h.point); }
    else { spark(h.point, 0xd8c8a8, 3); addDecal(h); }
  }
  // Online: the server applies the damage (capped to what this weapon can do) and decides kills.
  if (mode === 'duel') netSend({ type: 'rl-shot', hit: oppDmg > 0, dmg: Math.round(oppDmg), head: oppHead, to: firstEnd ? [firstEnd.x, firstEnd.y, firstEnd.z] : null });
}
function meleeHit() {
  if (!player.alive) return;
  ray.set(camera.position, camForward()); ray.far = cur.spec.range;
  const hits = ray.intersectObjects([...botHitMeshes(), ...targets.flatMap((t) => t.hit)], false);
  const h = hits[0];
  if (!h) {
    // generous: any bot right in front of you
    const f = camForward();
    for (const b of bots) {
      if (!b.alive) continue;
      const dx = b.x - player.x, dz = b.z - player.z, d = Math.hypot(dx, dz);
      if (d < 2.2 && (dx * f.x + dz * f.z) / d > 0.7) { damageBot(b, 100, false, 'you'); SFX.hit(); return; }
    }
    if (mode === 'duel' && opp.alive) {
      const dx = opp.x - player.x, dz = opp.z - player.z, d = Math.hypot(dx, dz);
      if (d < 2.2 && (dx * f.x + dz * f.z) / d > 0.7) { netSend({ type: 'rl-shot', hit: true, dmg: 100, to: [opp.x, 1.2, opp.z] }); return; }
      netSend({ type: 'rl-shot', hit: false, to: null });
    }
    return;
  }
  if (h.object.userData.bot === opp) netSend({ type: 'rl-shot', hit: true, dmg: 100, to: [h.point.x, h.point.y, h.point.z] });
  else if (h.object.userData.bot) damageBot(h.object.userData.bot, 100, false, 'you');
  else if (h.object.userData.target) hitTarget(h.object.userData.target, 100, false, h.point);
}
const rockets = [];
function fireRocket() {
  const m = new THREE.Group();
  cyl(0.06, 0.3, MAT.olive, 0, 0, 0, m);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 10), MAT.orange); cone.rotation.x = -Math.PI / 2; cone.position.z = -0.23; m.add(cone);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), MAT.flash); glow.position.z = 0.2; m.add(glow);
  m.position.copy(muzzleWorld());
  const dir = camForward();
  m.lookAt(m.position.clone().add(dir));
  scene.add(m);
  rockets.push({ m, v: dir.multiplyScalar(38), life: 5 });
  SFX.rocket();
}
function explode(p) {
  SFX.boom();
  spark(p, 0xff8a2a, 18);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.8 }));
  ball.position.copy(p); scene.add(ball); sparks.push({ m: ball, v: new THREE.Vector3(), life: 0.3, grow: true });
  const s = weapons.th.spec;
  for (const b of bots) {
    if (!b.alive) continue;
    const d = Math.hypot(b.x - p.x, 1 - p.y, b.z - p.z);
    if (d < s.splash) damageBot(b, s.dmg * (1 - d / s.splash * 0.6), false, 'you');
  }
  if (mode === 'duel') {
    let dmg = 0;
    if (opp.alive) { const d = Math.hypot(opp.x - p.x, 1 - p.y, opp.z - p.z); if (d < s.splash) dmg = s.dmg * (1 - d / s.splash * 0.6); }
    netSend({ type: 'rl-shot', hit: dmg > 0, dmg: Math.round(dmg), to: [p.x, p.y, p.z] });
  }
  for (const t of targets) {
    const d = Math.hypot(t.pivot.position.x - p.x, t.pivot.position.z - p.z);
    if (d < s.splash) hitTarget(t, s.dmg * (1 - d / s.splash * 0.6), false, t.pivot.position.clone().setY(1.4));
  }
  const pd = Math.hypot(player.x - p.x, player.y + 1 - p.y, player.z - p.z);
  if (pd < s.splash && mode === 'gungame') hurtPlayer(35 * (1 - pd / s.splash), null);
  camKickPitch += Math.max(0, 0.05 * (1 - pd / 15));
}
function hitTarget(t, dmg, head, point) {
  showHit(head);
  head ? SFX.head() : SFX.hit();
  floatText(String(Math.round(dmg)), point, head ? '#ff5a4a' : '#fff');
  if (t.down) return;
  t.hp -= dmg;
  if (t.hp <= 0) { t.down = 1; t.upT = 2.2; t.hp = 100; SFX.kill(); }
}

// ---------------------------------------------------------------- damage / kills
function damageBot(b, dmg, head, by) {
  if (!b.alive) return;
  b.hp -= dmg;
  b.flashT = 0.1;
  b.lastHurtBy = by;
  if (by === 'you') { showHit(head); head ? SFX.head() : SFX.hit(); floatText(String(Math.round(dmg)), new THREE.Vector3(b.x, head ? 1.9 : 1.3, b.z), head ? '#ff5a4a' : '#fff'); }
  if (b.hp <= 0) killBot(b, by, head);
}
function killBot(b, by, head) {
  b.alive = false; b.respawnT = 2.5; b.g.visible = false;
  spark(new THREE.Vector3(b.x, 1.2, b.z), BOT_COLORS[b.i], 14);
  if (by === 'you') {
    SFX.kill();
    feed(`You ${head ? '🎯' : '→'} ${b.name} (${cur.spec.name})`, true);
    if (mode === 'gungame') playerLevelUp();
  } else if (by && by.name) {
    feed(`${by.name} → ${b.name}`);
    botLevelUp(by);
  }
}
function playerLevelUp() {
  player.kills++;
  if (player.level >= GUN_ORDER.length - 1) { endGame(true); return; }
  player.level++;
  const next = weapons[GUN_ORDER[player.level]];
  next.ammo = next.cap; next.locked = false;
  equip(next.id);
  SFX.level();
  banner(`${next.spec.name}<small>Weapon ${player.level + 1} of 9${player.level === 8 ? ' — get a knife kill to win!' : ''}</small>`);
  renderLadder();
}
function botLevelUp(b) {
  if (mode !== 'gungame') return;
  if (b.level >= GUN_ORDER.length - 1) { endGame(false, b); return; }
  b.level++;
  if (b.level === 8) banner(`<span style="color:#ff6a5a">${b.name} has the knife!</span><small>Stop them!</small>`, 2);
  renderLadder();
}
function hurtPlayer(dmg, by) {
  if (!player.alive || mode !== 'gungame') return;
  player.hp -= dmg; player.regenT = 4;
  SFX.hurt();
  hudEls.dmg.style.opacity = 1; setTimeout(() => { hudEls.dmg.style.opacity = 0; }, 160);
  updateHpHud();
  if (player.hp <= 0) {
    player.alive = false; player.respawnT = 3;
    cancelAnim();
    cur.gun.visible = false;
    banner(`Eliminated${by ? ` by ${by.name}` : ''}<small>Respawning…</small>`, 2.6);
    if (by) { feed(`${by.name} → You`); botLevelUp(by); }
  }
}
function respawnPlayer() {
  const sp = farthestSpawn();
  player.x = sp[0]; player.z = sp[1]; player.y = 0; player.vy = 0; player.hp = 100; player.alive = true;
  player.yaw = Math.atan2(player.x, player.z);
  updateHpHud();
  for (const id of GUN_ORDER) { weapons[id].ammo = weapons[id].cap; weapons[id].locked = false; }
  cur.gun.visible = true; resetVis(cur); play('draw'); updateAmmoHud();
}
function farthestSpawn() {
  let best = SPAWNS[0], bestD = -1;
  for (const s of SPAWNS) {
    let d = Infinity;
    for (const b of bots) if (b.alive) d = Math.min(d, Math.hypot(b.x - s[0], b.z - s[1]));
    if (player.alive && mode) d = Math.min(d, Math.hypot(player.x - s[0], player.z - s[1]) + 10);
    d += Math.random() * 6;
    if (d > bestD) { bestD = d; best = s; }
  }
  return best;
}
function spawnBot(b) {
  const sp = farthestSpawn();
  b.x = sp[0] + rand(-1, 1); b.z = sp[1] + rand(-1, 1); b.hp = 100; b.alive = true; b.g.visible = true; b.fireT = rand(0.8, 1.6);
}

// ---------------------------------------------------------------- bot AI
const losRay = new THREE.Raycaster();
function los(ax, ay, az, bx, by, bz) {
  const from = new THREE.Vector3(ax, ay, az), to = new THREE.Vector3(bx, by, bz);
  const d = from.distanceTo(to);
  losRay.set(from, to.sub(from).normalize()); losRay.far = d - 0.3;
  return losRay.intersectObjects(solids, false).length === 0;
}
function updateBots(dt) {
  for (const b of bots) {
    if (!b.alive) { b.respawnT -= dt; if (b.respawnT <= 0 && mode === 'gungame') spawnBot(b); continue; }
    b.retargetT -= dt;
    if (b.retargetT <= 0) {
      b.retargetT = rand(0.6, 1.2);
      let best = null, bd = Infinity;
      const cands = [];
      if (player.alive) cands.push({ ref: 'player', x: player.x, z: player.z });
      for (const o of bots) if (o !== b && o.alive) cands.push({ ref: o, x: o.x, z: o.z });
      for (const c of cands) {
        let d = Math.hypot(c.x - b.x, c.z - b.z);
        if (c.ref === 'player') d *= 0.7; // the player is the main event
        if (d < bd) { bd = d; best = c.ref; }
      }
      b.target = best;
      b.sees = best && los(b.x, 1.6, b.z, best === 'player' ? player.x : best.x, 1.4, best === 'player' ? player.z : best.z);
    }
    const t = b.target;
    if (!t || (t !== 'player' && !t.alive) || (t === 'player' && !player.alive)) { b.target = null; b.retargetT = 0; continue; }
    const tx = t === 'player' ? player.x : t.x, tz = t === 'player' ? player.z : t.z;
    const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz) || 1;
    const wantYaw = Math.atan2(-dx, -dz);
    let dy = wantYaw - b.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    b.yaw += dy * Math.min(1, dt * 6);
    const knife = b.level === 8;
    let mx = 0, mz = 0;
    if (knife || !b.sees || d > 16) { mx = dx / d; mz = dz / d; }
    else if (d < 7) { mx = -dx / d * 0.6; mz = -dz / d * 0.6; }
    b.strafeT -= dt; if (b.strafeT <= 0) { b.strafeT = rand(0.8, 2); b.strafe = Math.random() < 0.5 ? -1 : 1; }
    if (b.sees && !knife) { mx += -dz / d * b.strafe * 0.7; mz += dx / d * b.strafe * 0.7; }
    const sp = knife ? 5.2 : 3.4;
    const len = Math.hypot(mx, mz) || 1;
    const nx = b.x + mx / len * sp * dt, nz = b.z + mz / len * sp * dt;
    const [cx, cz] = collidePos(nx, nz, 0, 0.4);
    if (Math.hypot(cx - nx, cz - nz) > 0.001) b.strafe *= -1;
    b.x = cx; b.z = cz;
    b.walk += dt * 9;
    b.legL.rotation.x = Math.sin(b.walk) * 0.5; b.legR.rotation.x = -Math.sin(b.walk) * 0.5;
    b.kneeL.rotation.x = Math.max(0, -Math.cos(b.walk)) * 0.7; b.kneeR.rotation.x = Math.max(0, Math.cos(b.walk)) * 0.7;
    b.g.position.set(b.x, 0, b.z); b.g.rotation.y = b.yaw;
    b.flashT -= dt; b.flash.visible = b.flashT > 0.06;
    b.flashMat.emissive.setHex(b.flashT > 0 ? 0x551111 : 0x000000);
    // attack
    b.fireT -= dt;
    if (knife) {
      if (d < 1.8 && b.fireT <= 0) {
        b.fireT = 0.8;
        if (t === 'player') hurtPlayer(100, b); else damageBot(t, 100, false, b);
      }
      continue;
    }
    if (b.sees && b.fireT <= 0 && d < 45) {
      const ws = weapons[GUN_ORDER[b.level]].spec;
      b.fireT = clamp(ws.interval * 3, 0.35, 1.4) * rand(0.8, 1.3);
      b.flashT = 0.1;
      const from = new THREE.Vector3(b.x, 1.4, b.z).add(new THREE.Vector3(-Math.sin(b.yaw), 0, -Math.cos(b.yaw)).multiplyScalar(0.8));
      let chance = clamp(0.62 - d * 0.014, 0.12, 0.55);
      if (t === 'player') {
        const pm = Math.hypot(vel.x, vel.z);
        if (pm > 6) chance *= 0.65; if (player.slideT > 0) chance *= 0.6; if (!player.onGround) chance *= 0.7;
      }
      const hitIt = Math.random() < chance;
      const to = t === 'player' ? new THREE.Vector3(player.x + (hitIt ? 0 : rand(-1, 1)), player.y + 1.3 + (hitIt ? 0 : rand(-0.5, 1)), player.z + (hitIt ? 0 : rand(-1, 1)))
        : new THREE.Vector3(t.x + (hitIt ? 0 : rand(-1, 1)), 1.3, t.z);
      tracer(from, to);
      noise(0.08, 1500, clamp(0.25 - d * 0.004, 0.04, 0.25), 'lowpass');
      if (hitIt) {
        const dmg = clamp(ws.dmg * (ws.pellets ? 4 : 1) * 0.45, 8, 30);
        if (t === 'player') hurtPlayer(dmg, b); else damageBot(t, dmg * 1.4, false, b);
      }
    }
  }
}

// ---------------------------------------------------------------- input
canvas.addEventListener('click', () => { if (playing && !document.pointerLockElement) canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && playing && $('end').classList.contains('hidden')) { $('pause').classList.remove('hidden'); keys.clear(); mouseDown = false; aiming = false; }
  if (locked) $('pause').classList.add('hidden');
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  const sens = 0.0022 * (aiming && cur && cur.spec.scope ? 0.3 : aiming ? 0.7 : 1);
  player.yaw -= e.movementX * sens;
  player.pitch = clamp(player.pitch - e.movementY * sens, -1.5, 1.5);
  sway.x = clamp(sway.x - e.movementX * 0.0004, -0.06, 0.06);
  sway.y = clamp(sway.y - e.movementY * 0.0004, -0.06, 0.06);
});
document.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== canvas) return;
  ac();
  if (e.button === 0) { mouseDown = true; mouseFresh = true; }
  if (e.button === 2) aiming = true;
});
document.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; if (e.button === 2) aiming = false; });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('wheel', (e) => {
  if (!playing || mode !== 'range' || !player.alive) return;
  const i = GUN_ORDER.indexOf(cur.id);
  equip(GUN_ORDER[(i + (e.deltaY > 0 ? 1 : -1) + GUN_ORDER.length) % GUN_ORDER.length]);
});
document.addEventListener('keydown', (e) => {
  if (!playing) return;
  keys.add(e.code);
  if (e.code === 'KeyR' && player.alive) startReload();
  if (e.code === 'KeyF' && player.alive) tryInspect();
  if ((e.code === 'ControlLeft' || e.code === 'KeyC') && player.onGround && keys.has('ShiftLeft') && player.slideT <= 0) {
    player.slideT = 0.75; player.slideDir = [-Math.sin(player.yaw), -Math.cos(player.yaw)];
    noise(0.4, 600, 0.1, 'lowpass');
  }
  if (mode === 'range' && /^Digit[1-9]$/.test(e.code)) equip(GUN_ORDER[+e.code.slice(5) - 1]);
  if (mode === 'range' && e.code === 'KeyT') setSlowmo(!slowmo);
  if (e.code === 'ControlLeft' || e.code === 'Space') e.preventDefault();
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
function setSlowmo(on) {
  slowmo = on; animSpeed = on ? 0.25 : 1;
  $('slowmo-state').textContent = on ? 'on' : 'off';
  $('slowmo-badge').classList.toggle('hidden', !on);
}


// ---------------------------------------------------------------- online 1v1
// The server (rl-* messages in server.js) pairs players, runs the rounds and owns both players'
// health. This side just moves, shoots, and reports what it hit.
let net = null;
let duel = null; // { side, oppName, scoreA, scoreB, roundsToWin, round, weapon, startsAt, active, oppHp }
let netPosT = 0;
const qs = new URLSearchParams(location.search);
function frozen() { return mode === 'duel' && (!duel || !duel.active || performance.now() < duel.startsAt); }
function netSend(m) { if (net && net.readyState === 1) net.send(JSON.stringify(m)); }
function netConnect(then) {
  if (net && net.readyState === 1) { then(); return; }
  if (net && net.readyState === 0) { net.addEventListener('open', then, { once: true }); return; }
  net = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`);
  net.addEventListener('open', then, { once: true });
  net.addEventListener('message', (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } onNet(m); });
  net.addEventListener('close', () => {
    net = null;
    if (mode === 'duel' && duel) { duel = null; showEnd('Disconnected', 'Lost the connection to the server.'); }
    else if (!$('online').classList.contains('hidden')) onlineStatus('Lost connection — try again.');
  });
}
function identity() {
  let accountToken = ''; try { accountToken = localStorage.getItem('valk-account-token') || ''; } catch {}
  return { accountToken, name: qs.get('name') || '' };
}
function onlineStatus(html, waiting) {
  $('online-status').innerHTML = html;
  $('online-actions').classList.toggle('hidden', !!waiting);
  $('btn-online-cancel').classList.toggle('hidden', !waiting);
  $('btn-online-back').classList.toggle('hidden', !!waiting);
}
function openOnline() {
  $('menu').classList.add('hidden'); $('end').classList.add('hidden');
  $('online').classList.remove('hidden');
  onlineStatus('');
}
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function onNet(m) {
  switch (m.type) {
    case 'rl-waiting':
      if (m.mode === 'queue') onlineStatus('Looking for an opponent… <br><small>Open Reload in another tab or send a friend here to test it.</small>', true);
      else onlineStatus(`Send this code to your friend:<span class="code">${esc(m.code)}</span>Waiting for them to join…`, true);
      break;
    case 'rl-error': onlineStatus(esc(m.message)); break;
    case 'rl-match':
      duel = { side: m.side, oppName: m.oppName, scoreA: 0, scoreB: 0, roundsToWin: m.roundsToWin, round: 0, weapon: null, startsAt: Infinity, active: false, oppHp: 100 };
      opp.tag.material.map = nameTex(m.oppName); opp.tag.material.needsUpdate = true;
      $('duel-opp').textContent = m.oppName;
      $('online').classList.add('hidden');
      startGame('duel');
      banner(`Match found: ${esc(m.oppName)}<small>Click the game to lock your mouse</small>`, 3);
      break;
    case 'rl-round': {
      if (!duel) return;
      duel.round = m.round; duel.weapon = m.weapon; duel.active = true; duel.oppHp = 100;
      duel.startsAt = performance.now() + m.startsIn;
      duel.scoreA = m.scoreA; duel.scoreB = m.scoreB;
      player.x = m.spawn.x; player.z = m.spawn.z; player.y = 0; player.vy = 0; player.yaw = m.spawn.yaw; player.pitch = 0;
      player.hp = 100; player.alive = true; player.slideT = 0; vel.x = vel.z = 0;
      opp.x = opp.tx = m.oppSpawn.x; opp.z = opp.tz = m.oppSpawn.z; opp.ty = 0; opp.yaw = opp.tyaw = m.oppSpawn.yaw;
      opp.alive = true; opp.g.visible = true;
      const w = weapons[m.weapon];
      w.ammo = w.cap; w.locked = false; w.drawn = false;
      if (cur) cur.gun.visible = false;
      cur = null; equip(m.weapon);
      updateHpHud(); updateDuelHud();
      break;
    }
    case 'rl-opp-pos':
      opp.tx = m.x; opp.ty = m.y; opp.tz = m.z; opp.tyaw = m.yaw; opp.pitch = m.pitch; opp.anim = m.anim; opp.crouch = m.crouch;
      break;
    case 'rl-opp-shot': {
      const from = new THREE.Vector3(opp.x, 1.4, opp.z).add(new THREE.Vector3(-Math.sin(opp.yaw), 0, -Math.cos(opp.yaw)).multiplyScalar(0.8));
      if (m.to) tracer(from, new THREE.Vector3(m.to[0], m.to[1], m.to[2]));
      opp.flashT = 0.1;
      const d = Math.hypot(opp.x - player.x, opp.z - player.z);
      const kind = duel && weapons[duel.weapon] ? weapons[duel.weapon].spec.kind : 'pistol';
      if (kind === 'knife') SFX.knife(); else if (kind === 'launcher') { if (m.to) explodeFx(new THREE.Vector3(m.to[0], m.to[1], m.to[2])); } else noise(0.12, 1400, clamp(0.45 - d * 0.008, 0.08, 0.45), 'lowpass');
      break;
    }
    case 'rl-hit':
      if (m.target === 'you') {
        player.hp = m.hp; SFX.hurt();
        hudEls.dmg.style.opacity = 1; setTimeout(() => { hudEls.dmg.style.opacity = 0; }, 160);
        updateHpHud();
        if (m.hp <= 0) { player.alive = false; player.respawnT = 1e9; cancelAnim(); if (cur) cur.gun.visible = false; }
      } else {
        duel && (duel.oppHp = m.hp);
        showHit(m.head); m.head ? SFX.head() : SFX.hit();
        floatText(String(Math.round(m.dmg)), new THREE.Vector3(opp.x, m.head ? 1.9 : 1.3, opp.z), m.head ? '#ff5a4a' : '#fff');
        if (m.hp <= 0) { opp.alive = false; opp.g.visible = false; spark(new THREE.Vector3(opp.x, 1.2, opp.z), 0xe8e8f0, 16); SFX.kill(); }
        updateDuelHud();
      }
      break;
    case 'rl-round-end': {
      if (!duel) return;
      duel.active = false; duel.scoreA = m.scoreA; duel.scoreB = m.scoreB;
      const mine = m.winner === duel.side;
      banner(m.winner == null ? 'Draw — time ran out' : mine ? '<span style="color:#8ff0b0">Round won</span>' : '<span style="color:#ff8a7a">Round lost</span>',
        2.2);
      updateDuelHud();
      break;
    }
    case 'rl-match-end': {
      const won = duel && m.winner === duel.side;
      const my = duel ? (duel.side === 'a' ? m.scoreA : m.scoreB) : 0, their = duel ? (duel.side === 'a' ? m.scoreB : m.scoreA) : 0;
      const name = duel ? duel.oppName : 'Opponent';
      duel = null;
      setTimeout(() => showEnd(won ? '🏆 You win the 1v1!' : `${name} wins`, `Final score ${my}–${their}.`), 1200);
      break;
    }
    case 'rl-opp-left':
      if (duel) { const name = duel.oppName; duel = null; showEnd('🏆 You win!', `${name} left the match.`); }
      break;
  }
}
function updateDuelHud() {
  if (!duel) return;
  const my = duel.side === 'a' ? duel.scoreA : duel.scoreB, their = duel.side === 'a' ? duel.scoreB : duel.scoreA;
  $('duel-sa').textContent = my; $('duel-sb').textContent = their;
  $('opp-hp-fill').style.width = `${Math.max(0, duel.oppHp)}%`;
}
function explodeFx(p) {
  SFX.boom(); spark(p, 0xff8a2a, 18);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.8 }));
  ball.position.copy(p); scene.add(ball); sparks.push({ m: ball, v: new THREE.Vector3(), life: 0.3, grow: true });
}
function updateOpp(dt) {
  if (mode !== 'duel' || !opp.alive) return;
  const k = Math.min(1, dt * 14);
  const moved = Math.hypot(opp.tx - opp.x, opp.tz - opp.z);
  opp.x = lerp(opp.x, opp.tx, k); opp.z = lerp(opp.z, opp.tz, k);
  let dy = opp.tyaw - opp.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
  opp.yaw += dy * k;
  if (moved > 0.02) { opp.walk += dt * 10; } else opp.walk *= 0.9;
  opp.legL.rotation.x = Math.sin(opp.walk) * 0.5; opp.legR.rotation.x = -Math.sin(opp.walk) * 0.5;
  opp.kneeL.rotation.x = Math.max(0, -Math.cos(opp.walk)) * 0.7; opp.kneeR.rotation.x = Math.max(0, Math.cos(opp.walk)) * 0.7;
  opp.y = lerp(opp.y || 0, opp.ty, k);
  opp.g.position.set(opp.x, opp.y - (opp.crouch ? 0.3 : 0), opp.z);
  opp.g.rotation.y = opp.yaw;
  // Gun arm follows their aim; it drops while they reload.
  const reloading = opp.anim && opp.anim.startsWith('reload');
  opp.arm.rotation.x = lerp(opp.arm.rotation.x, reloading ? -0.7 : opp.pitch, k);
  opp.flashT = (opp.flashT || 0) - dt; opp.flash.visible = opp.flashT > 0.05;
}
function sendPos(dt) {
  if (mode !== 'duel' || !duel) return;
  netPosT -= dt; if (netPosT > 0) return;
  netPosT = 0.066;
  netSend({ type: 'rl-pos', x: +player.x.toFixed(3), y: +player.y.toFixed(3), z: +player.z.toFixed(3), yaw: +player.yaw.toFixed(3), pitch: +player.pitch.toFixed(3),
    crouch: player.slideT > 0 || keys.has('ControlLeft'), anim: anim ? anim.name : null });
}
function showEnd(title, sub) {
  playing = false;
  if (document.pointerLockElement) document.exitPointerLock();
  $('end-title').textContent = title; $('end-sub').textContent = sub;
  $('end').classList.remove('hidden'); $('pause').classList.add('hidden');
}
$('btn-duel').onclick = () => { ac(); openOnline(); };
$('btn-online-back').onclick = () => { $('online').classList.add('hidden'); $('menu').classList.remove('hidden'); };
$('btn-online-cancel').onclick = () => { netSend({ type: 'rl-cancel' }); onlineStatus(''); };
$('btn-quick').onclick = () => { onlineStatus('Connecting…'); netConnect(() => netSend({ type: 'rl-queue', ...identity() })); };
$('btn-create').onclick = () => { onlineStatus('Connecting…'); netConnect(() => netSend({ type: 'rl-private-create', ...identity() })); };
const joinCode = () => {
  const code = $('join-code').value.trim().toUpperCase();
  if (code.length !== 5) { onlineStatus('Codes are 5 letters.'); return; }
  onlineStatus('Connecting…');
  netConnect(() => netSend({ type: 'rl-private-join', code, ...identity() }));
};
$('btn-join').onclick = joinCode;
$('join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinCode(); });

// ---------------------------------------------------------------- game flow
const vel = { x: 0, z: 0 };
function startGame(m) {
  ac();
  mode = m; playing = true;
  for (const id of GUN_ORDER) { weapons[id].ammo = weapons[id].cap; weapons[id].locked = false; }
  player.hp = 100; player.alive = true; player.level = 0; player.kills = 0; player.vy = 0; player.pitch = 0;
  setSlowmo(false);
  for (const b of bots) { b.alive = false; b.g.visible = false; b.level = 0; b.respawnT = rand(0.5, 2.5); }
  for (const t of tracers) scene.remove(t.l); tracers.length = 0;
  for (const id of GUN_ORDER) weapons[id].drawn = false;
  opp.alive = false; opp.g.visible = false;
  if (m === 'range') {
    buildRange();
    player.x = 0; player.z = 2; player.y = 0; player.yaw = 0;
  } else if (m === 'duel') {
    buildYard();
  } else {
    buildFoundry();
    const sp = farthestSpawn(); player.x = sp[0]; player.z = sp[1]; player.y = 0; player.yaw = Math.atan2(player.x, player.z);
  }
  if (cur) cur.gun.visible = false;
  cur = null;
  if (m !== 'duel') equip(GUN_ORDER[0]);
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('pause').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('ladder').classList.toggle('hidden', m !== 'gungame');
  $('duel-hud').classList.toggle('hidden', m !== 'duel');
  $('online').classList.add('hidden');
  $('range-help').classList.toggle('hidden', m !== 'range');
  updateHpHud(); renderLadder();
  gameStart = performance.now();
  if (m !== 'duel') banner(m === 'range' ? 'Shooting Range<small>Press T for slow-motion reloads</small>' : 'Gun Game<small>Each kill gives you the next weapon</small>', 2.2);
  canvas.requestPointerLock && canvas.requestPointerLock();
}
function endGame(won, bot) {
  playing = false;
  if (document.pointerLockElement) document.exitPointerLock();
  const secs = (performance.now() - gameStart) / 1000;
  $('end-title').textContent = won ? '🏆 You win!' : `${bot.name} wins`;
  let sub = won ? `All 9 weapons in ${fmtTime(secs)}.` : 'They got the knife kill first. Run it back?';
  if (won) {
    let best = 0; try { best = +localStorage.getItem('valk-reload-best') || 0; } catch {}
    if (!best || secs < best) { try { localStorage.setItem('valk-reload-best', String(secs)); } catch {} sub += ' New personal best!'; }
  }
  $('end-sub').textContent = sub;
  $('end').classList.remove('hidden');
  $('pause').classList.add('hidden');
  showBest();
}
function fmtTime(s) { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }
function showBest() {
  let best = 0; try { best = +localStorage.getItem('valk-reload-best') || 0; } catch {}
  $('best').textContent = best ? `Best Gun Game time: ${fmtTime(best)}` : '';
}
function toMenu() {
  if (mode === 'duel') { netSend({ type: 'rl-leave' }); duel = null; }
  opp.alive = false; opp.g.visible = false;
  playing = false; mode = null;
  if (document.pointerLockElement) document.exitPointerLock();
  $('hud').classList.add('hidden'); $('pause').classList.add('hidden'); $('end').classList.add('hidden'); $('menu').classList.remove('hidden');
  for (const b of bots) { b.alive = false; b.g.visible = false; }
  showBest();
}
$('btn-gungame').onclick = () => startGame('gungame');
$('btn-range').onclick = () => startGame('range');
$('btn-resume').onclick = () => canvas.requestPointerLock();
$('btn-quit').onclick = toMenu;
$('btn-again').onclick = () => { if (mode === 'duel') { mode = null; $('hud').classList.add('hidden'); openOnline(); } else startGame(mode || 'gungame'); };
$('btn-end-menu').onclick = toMenu;
(() => {
  const q = new URLSearchParams(location.search);
  if (q.get('room')) $('back-link').href = `/?room=${encodeURIComponent(q.get('room'))}`;
  if (matchMedia('(pointer: coarse)').matches) $('touch-note').classList.remove('hidden');
})();
showBest();
buildFoundry();

// ---------------------------------------------------------------- main loop
let last = performance.now();
const tmpQ = new THREE.Vector3();
function tick(now) {
  requestAnimationFrame(tick);
  const rdt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const paused = playing && !testRun && mode !== 'duel' && document.pointerLockElement !== canvas;
  const dt = paused ? 0 : rdt;

  if (playing && !paused) {
    // --- player movement
    if (!player.alive) {
      player.respawnT -= dt;
      if (player.respawnT <= 0) respawnPlayer();
    } else {
      let fx = 0, fz = 0;
      if (keys.has('KeyW')) fz -= 1; if (keys.has('KeyS')) fz += 1; if (keys.has('KeyA')) fx -= 1; if (keys.has('KeyD')) fx += 1;
      if (frozen()) { fx = 0; fz = 0; } // countdown / between rounds: look around, but no moving
      const sprint = keys.has('ShiftLeft') && fz < 0 && !aiming;
      const crouch = keys.has('ControlLeft') || keys.has('KeyC');
      let speed = aiming ? 3.2 : sprint ? 8.2 : crouch ? 3 : 5.4;
      const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      let tx = fx * cy + fz * sy, tz = -fx * sy + fz * cy;
      const tl = Math.hypot(tx, tz); if (tl > 0) { tx /= tl; tz /= tl; }
      if (player.slideT > 0) {
        player.slideT -= dt;
        const k = Math.max(0, player.slideT / 0.75);
        vel.x = player.slideDir[0] * lerp(4, 12.5, k); vel.z = player.slideDir[1] * lerp(4, 12.5, k);
      } else {
        const acc = player.onGround ? 14 : 4;
        vel.x = lerp(vel.x, tx * speed, Math.min(1, dt * acc)); vel.z = lerp(vel.z, tz * speed, Math.min(1, dt * acc));
      }
      sprintAmt = lerp(sprintAmt, sprint && tl > 0 && !anim && player.slideT <= 0 ? 1 : 0, Math.min(1, dt * 10));
      const [nx, nz] = collidePos(player.x + vel.x * dt, player.z + vel.z * dt, player.y);
      player.x = nx; player.z = nz;
      if (keys.has('Space') && player.onGround && !frozen()) { player.vy = 7.2; player.onGround = false; land.v += 0.35; if (player.slideT > 0) player.slideT = 0.01; }
      player.vy -= 21 * dt;
      player.y += player.vy * dt;
      const gh = groundAt(player.x, player.z, player.y);
      if (player.y <= gh) { if (!player.onGround) { land.v -= Math.min(0.9, Math.max(0, -player.vy) * 0.07); if (player.vy < -6) SFX.step(); } player.y = gh; player.vy = 0; player.onGround = true; }
      else if (player.y > gh + 0.05) player.onGround = false;
      if (player.onGround && Math.hypot(vel.x, vel.z) > 1) { const before = Math.floor(bobPhase / Math.PI); bobPhase += dt * Math.hypot(vel.x, vel.z) * 1.6; if (Math.floor(bobPhase / Math.PI) !== before) SFX.step(); }
      // regen
      if (mode === 'gungame') { player.regenT -= dt; if (player.regenT <= 0 && player.hp < 100) { player.hp = Math.min(100, player.hp + dt * 18); updateHpHud(); } }
      if (mouseDown) tryFire(now / 1000);
    }
    updateBots(dt);
    updateOpp(dt);
    sendPos(dt);
    if (mode === 'duel' && duel && duel.active) {
      const left = duel.startsAt - performance.now();
      if (left > 0) banner(`Round ${duel.round} — ${weapons[duel.weapon].spec.name}<small>${Math.ceil(left / 1000)}</small>`, 0.2);
      else if (left > -700) banner('FIGHT!', 0.2);
    }
    // targets pop back up
    for (const t of targets) {
      if (t.down) { t.upT -= dt; t.pivot.rotation.x = lerp(t.pivot.rotation.x, -Math.PI / 2, Math.min(1, dt * 12)); if (t.upT <= 0) t.down = 0; }
      else t.pivot.rotation.x = lerp(t.pivot.rotation.x, 0, Math.min(1, dt * 8));
    }
  }

  // --- camera
  const eye = player.slideT > 0 ? 0.95 : (keys.has('ControlLeft') || keys.has('KeyC')) && player.alive ? 1.15 : 1.62;
  camKickPitch = lerp(camKickPitch, 0, Math.min(1, dt * 9));
  camera.position.set(player.x, player.y + eye, player.z);
  camera.rotation.set(player.pitch + camKickPitch + camAnim.x, player.yaw, camAnim.z);
  const wantAds = aiming && player.alive && !isReloading() && cur && !cur.spec.melee && !(anim && anim.name === 'cycle') ? 1 : 0;
  adsAmt = lerp(adsAmt, wantAds, Math.min(1, dt * 14));
  const zoom = cur ? cur.spec.zoom : 75;
  const fov = lerp(75, zoom, adsAmt);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const scoped = cur && cur.spec.scope && adsAmt > 0.85;
  hudEls.scope.classList.toggle('hidden', !scoped);
  // crosshair spread
  if (cur) {
    const s = cur.spec;
    const spread = (lerp(s.spread, s.adsSpread, adsAmt) * (Math.hypot(vel.x, vel.z) > 0.5 ? 1.6 : 1) * (player.onGround ? 1 : 2)) * innerHeight * 0.9 + 6;
    const ch = hudEls.ch.children;
    ch[0].style.top = `${-spread - 9}px`; ch[1].style.top = `${spread}px`; ch[2].style.left = `${-spread - 9}px`; ch[3].style.left = `${spread}px`;
    hudEls.ch.style.opacity = adsAmt > 0.5 || s.melee ? (s.melee ? 0.6 : 0) : 1;
  }

  // --- viewmodel
  if (cur) {
    updateAnim(dt);
    applyPose(cur, dt);
    const s = cur.spec;
    // recoil spring
    recoil.vz += (-recoil.z * 180 - recoil.vz * 18) * dt; recoil.z += recoil.vz * dt;
    recoil.vrx += (-recoil.rx * 160 - recoil.vrx * 16) * dt; recoil.rx += recoil.vrx * dt;
    sway.x = lerp(sway.x, 0, Math.min(1, dt * 7)); sway.y = lerp(sway.y, 0, Math.min(1, dt * 7));
    const sp = Math.hypot(vel.x, vel.z) * (player.onGround ? 1 : 0.2);
    const bob = Math.min(1, sp / 6) * (1 - adsAmt * 0.85);
    const bx = Math.sin(bobPhase) * 0.012 * bob, by = -Math.abs(Math.cos(bobPhase)) * 0.012 * bob;
    const hip = s.hip, ads = s.ads;
    const sprintP = [-0.06, -0.05, 0.04], sprintR = [-0.35, 0.75, 0.3];
    holder.position.set(
      lerp(hip[0], ads[0], adsAmt) + bx + sprintP[0] * sprintAmt + sway.x * 0.4,
      lerp(hip[1], ads[1], adsAmt) + by + sprintP[1] * sprintAmt + sway.y * 0.4 + (player.slideT > 0 ? -0.02 : 0),
      lerp(hip[2], ads[2], adsAmt) + recoil.z * 0.12 * (1 - adsAmt * 0.5) + sprintP[2] * sprintAmt);
    // Hip pose angles the gun slightly inward so you see its side, not just the back of the slide.
    const hipYaw = 0.13 * (1 - adsAmt), hipRoll = 0.07 * (1 - adsAmt);
    land.v += (-land.y * 140 - land.v * 13) * dt; land.y += land.v * dt;
    // Camera rides along with big animation moves (mag slaps, flicks, racks) — subtle, but it's what
    // makes a reload feel physical instead of happening to a floating gun.
    const gr = cur.gun.rotation, gp = cur.gun.position;
    const ta = anim ? 1 : 0;
    camAnim.x = lerp(camAnim.x, ta * (Math.sin(gr.x) * 0.035 + gp.y * 0.12), Math.min(1, dt * 14));
    camAnim.z = lerp(camAnim.z, ta * Math.sin(gr.z) * 0.035, Math.min(1, dt * 14));
    holder.position.y += land.y * 0.05;
    holder.rotation.set(recoil.rx * 0.1 + sprintR[0] * sprintAmt + sway.y - land.y * 0.12, hipYaw + sprintR[1] * sprintAmt + sway.x, hipRoll + sprintR[2] * sprintAmt + (player.slideT > 0 ? 0.25 : 0));
    vmCam.fov = lerp(58, 46, adsAmt); vmCam.updateProjectionMatrix();
    if (cur.flash) { cur.flashT -= rdt; cur.flash.visible = cur.flashT > 0; }
    cur.gun.visible = player.alive && !scoped;
  }
  // debris (dropped mags, casings) runs on animation time so slow-mo slows it too
  const ddt = dt * animSpeed;
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.life -= ddt;
    d.v[1] += d.g * ddt;
    d.obj.position.x += d.v[0] * ddt; d.obj.position.y += d.v[1] * ddt; d.obj.position.z += d.v[2] * ddt;
    d.obj.rotation.x += d.spin[0] * ddt; d.obj.rotation.y += d.spin[1] * ddt; d.obj.rotation.z += d.spin[2] * ddt;
    if (d.life <= 0) { vmScene.remove(d.obj); if (d.geo) d.obj.geometry.dispose(); debris.splice(i, 1); }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i]; t.life -= rdt; t.l.material.opacity = Math.max(0, t.life / 0.06) * 0.85;
    if (t.life <= 0) { scene.remove(t.l); t.l.geometry.dispose(); t.l.material.dispose(); tracers.splice(i, 1); }
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.life -= rdt;
    if (s.grow) { s.m.scale.setScalar(1 + (0.3 - s.life) * 10); s.m.material.opacity = Math.max(0, s.life / 0.3) * 0.8; }
    else { s.v.y -= 9 * rdt; s.m.position.addScaledVector(s.v, rdt); }
    if (s.life <= 0) { scene.remove(s.m); if (s.m.geometry !== SPARK_GEO) s.m.geometry.dispose(); s.m.material.dispose(); sparks.splice(i, 1); }
  }
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    const step = r.v.clone().multiplyScalar(dt);
    ray.set(r.m.position, r.v.clone().normalize()); ray.far = step.length() + 0.2;
    const hit = ray.intersectObjects([...solids, ...botHitMeshes(), ...targets.flatMap((t) => t.hit)], false)[0];
    r.life -= dt;
    if (hit || r.life <= 0) { explode(hit ? hit.point : r.m.position); scene.remove(r.m); rockets.splice(i, 1); continue; }
    r.m.position.add(step);
    if (Math.random() < 0.6) { tmpQ.copy(r.m.position); spark(tmpQ, 0xbbbbbb, 1); }
  }
  muzzleLightT -= rdt;
  const ml = Math.max(0, muzzleLightT / 0.05);
  worldFlashLight.intensity = ml * 60; vmFlashLight.intensity = ml * 1.5;
  hitT -= rdt; if (hitT <= 0) hudEls.hit.style.opacity = 0;
  bannerT -= rdt; if (bannerT <= 0) hudEls.banner.style.opacity = 0;
  if (cur) hudEls.hint.classList.toggle('hidden', !(cur.ammo <= Math.ceil(cur.cap * 0.25) && cur.ammo < cur.cap && !isReloading() && !cur.spec.melee));

  // --- render: world, then viewmodel on top
  renderer.clear();
  if (!playing && !mode) {
    // menu backdrop: slow orbit of the arena
    const a = now / 9000;
    camera.position.set(Math.sin(a) * 22, 9, Math.cos(a) * 22);
    camera.lookAt(0, 1, 0);
    camera.fov = 70; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    return;
  }
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(vmScene, vmCam);
}
requestAnimationFrame(tick);

// Debug/test hooks (harmless for players): lets automated checks drive the game without pointer lock.
window.__reload = { weapons, equip, startReload, play, get anim() { return anim; }, startGame, setSlowmo, get cur() { return cur; }, tryFire: (t) => { mouseFresh = true; tryFire(t); }, set testRun(v) { testRun = v; }, player, bots, keys, killBot: (i) => damageBot(bots[i], 999, false, 'you'), opp, get duel() { return duel; } };
