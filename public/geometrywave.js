// --- Geometry Wave: the "wave" game mode from Geometry Dash, 3 hand-built levels ---

// ================= Pure logic (no DOM) — kept isolated so it's easy to reason about/test =================

const CANVAS_W = 900;
const CANVAS_H = 600;
const SCROLL_SPEED = 260; // px/s horizontal, constant
const VERT_SPEED = 260; // px/s vertical while holding/releasing (45-degree wave)
const PLAYER_HIT_RADIUS = 7;

function buildCorridor(startX, startCenter, startThickness) {
  const kfs = [{ x: startX, top: startCenter - startThickness / 2, bottom: startCenter + startThickness / 2 }];
  const spikes = [];
  let x = startX, center = startCenter, thickness = startThickness;
  const api = {
    kfs,
    spikes,
    seg(dx, dCenter, dThickness) {
      x += dx; center += dCenter; thickness += dThickness;
      kfs.push({ x, top: center - thickness / 2, bottom: center + thickness / 2 });
      return api;
    },
    hold(dx) { return api.seg(dx, 0, 0); },
    wave(dx, dCenter) { return api.seg(dx, dCenter, 0); },
    // Places a spike at an offset from the START of the most recent flat hold() section
    // (not its end), so the offset stays within that section's constant top/bottom. Call
    // right after hold().
    spike(dx, from, height, width) {
      const start = kfs.length >= 2 ? kfs[kfs.length - 2] : kfs[kfs.length - 1];
      const sx = start.x + dx;
      const baseY = from === 'bottom' ? start.bottom : start.top;
      spikes.push({ x: sx, from, height: height || 70, width: width || 34, baseY });
      return api;
    },
    build(name, color, speedMult) {
      return { name, color, corridor: kfs, spikes, length: kfs[kfs.length - 1].x, speedMult: speedMult || 1 };
    },
  };
  return api;
}

function corridorTopAt(level, x) {
  const kfs = level.corridor;
  if (x <= kfs[0].x) return kfs[0].top;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (x >= a.x && x <= b.x) return a.top + (b.top - a.top) * ((x - a.x) / (b.x - a.x));
  }
  return kfs[kfs.length - 1].top;
}
function corridorBottomAt(level, x) {
  const kfs = level.corridor;
  if (x <= kfs[0].x) return kfs[0].bottom;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (x >= a.x && x <= b.x) return a.bottom + (b.bottom - a.bottom) * ((x - a.x) / (b.x - a.x));
  }
  return kfs[kfs.length - 1].bottom;
}

function spikeVerts(spike) {
  const w = spike.width, h = spike.height;
  if (spike.from === 'bottom') {
    return [
      { x: spike.x - w / 2, y: spike.baseY },
      { x: spike.x + w / 2, y: spike.baseY },
      { x: spike.x, y: spike.baseY - h },
    ];
  }
  return [
    { x: spike.x - w / 2, y: spike.baseY },
    { x: spike.x + w / 2, y: spike.baseY },
    { x: spike.x, y: spike.baseY + h },
  ];
}

function triSign(p1, p2, p3) {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}
function pointInTriangle(pt, v1, v2, v3) {
  const d1 = triSign(pt, v1, v2), d2 = triSign(pt, v2, v3), d3 = triSign(pt, v3, v1);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function stepPlayer(state, dt, holding, speedMult) {
  const m = speedMult || 1;
  state.x += SCROLL_SPEED * m * dt;
  state.y += (holding ? -1 : 1) * VERT_SPEED * m * dt;
}

function checkDeath(level, state) {
  const top = corridorTopAt(level, state.x);
  const bottom = corridorBottomAt(level, state.x);
  if (state.y - PLAYER_HIT_RADIUS <= top || state.y + PLAYER_HIT_RADIUS >= bottom) return true;
  for (const spike of level.spikes) {
    if (Math.abs(spike.x - state.x) > spike.width) continue;
    const [v1, v2, v3] = spikeVerts(spike);
    if (pointInTriangle({ x: state.x, y: state.y }, v1, v2, v3)) return true;
  }
  return false;
}

// Dev-time sanity check: flags any segment whose wall would need to move faster than the
// player's max 45-degree slope (impossible to follow) or that pinches to near-zero width.
function validateLevel(level) {
  const kfs = level.corridor;
  const problems = [];
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    const dx = b.x - a.x;
    if (dx <= 0) { problems.push(`non-increasing x at ${i}`); continue; }
    const topSlope = Math.abs(b.top - a.top) / dx;
    const bottomSlope = Math.abs(b.bottom - a.bottom) / dx;
    if (topSlope > 0.9) problems.push(`top slope ${topSlope.toFixed(2)} at x=${a.x}`);
    if (bottomSlope > 0.9) problems.push(`bottom slope ${bottomSlope.toFixed(2)} at x=${a.x}`);
    if (b.bottom - b.top < 50) problems.push(`thickness ${(b.bottom - b.top).toFixed(0)} at x=${b.x}`);
  }
  return problems;
}

// ================= Level definitions =================

function makeEasyLevel() {
  const c = buildCorridor(0, 300, 300)
    .hold(280)
    .wave(350, 80)
    .hold(220)
    .wave(350, -140)
    .hold(220)
    .seg(300, 60, -80)
    .hold(600);
  c.spike(100, 'bottom', 55, 30);
  c.spike(240, 'top', 55, 30);
  c.spike(380, 'bottom', 55, 30);
  c.spike(520, 'top', 55, 30);
  c
    .seg(300, 0, 80)
    .hold(300)
    .wave(350, -90)
    .hold(250)
    .wave(350, 90)
    .hold(300);
  return c.build('Easy', '#34e89e');
}

function makeMediumLevel() {
  const c = buildCorridor(0, 300, 200)
    .hold(250)
    .wave(300, 120)
    .seg(250, -80, -40)
    .hold(180)
    .seg(250, -100, 0)
    .hold(180)
    .seg(280, 100, 40)
    .hold(250)
    .wave(300, -120)
    .hold(200)
    .seg(260, 60, -60)
    .seg(200, -70, 0)
    .seg(200, 70, 0)
    .hold(500);
  c.spike(120, 'bottom', 60, 30);
  c.spike(260, 'top', 60, 30);
  c.spike(400, 'bottom', 60, 30);
  c
    .seg(280, 20, 60)
    .hold(300);
  return c.build('Medium', '#f9a825');
}

function makeHardLevel() {
  const c = buildCorridor(0, 300, 170)
    .hold(200)
    .seg(220, 90, -40)
    .hold(150);
  c.spike(60, 'bottom', 45, 26);
  c.spike(170, 'top', 45, 26);
  c
    .seg(220, -90, 20)
    .hold(150)
    .seg(180, 70, -30)
    .seg(180, -70, 0)
    .seg(180, 70, 0)
    .seg(180, -70, 0)
    .hold(200)
    .seg(200, 0, -30)
    .hold(400);
  c.spike(70, 'bottom', 40, 26);
  c.spike(190, 'top', 40, 26);
  c.spike(310, 'bottom', 40, 26);
  c
    .seg(250, 0, 60)
    .hold(250)
    .seg(250, 80, 0)
    .seg(250, -80, 0)
    .seg(200, 60, -20)
    .hold(150);
  c.spike(60, 'top', 40, 26);
  c.spike(170, 'bottom', 40, 26);
  c
    .seg(200, -60, 20)
    .hold(300);
  return c.build('Hard', '#e53935');
}

function makeExtremeLevel() {
  const c = buildCorridor(0, 300, 150)
    .hold(160)
    .seg(180, 100, -30);
  c.spike(50, 'bottom', 50, 24);
  c.spike(130, 'top', 50, 24);
  c
    .seg(180, -110, 10)
    .hold(120)
    .seg(160, 90, -20)
    .seg(160, -90, 0)
    .seg(160, 90, 0)
    .seg(160, -90, 0)
    .hold(100);
  c.spike(40, 'top', 45, 22);
  c.spike(120, 'bottom', 45, 22);
  c.spike(200, 'top', 45, 22);
  c
    .seg(180, 0, -20)
    .hold(140)
    .seg(200, 100, 0)
    .seg(200, -100, 0)
    .hold(100);
  c.spike(40, 'bottom', 50, 22);
  c.spike(140, 'top', 50, 22);
  c
    .seg(160, 80, 20)
    .hold(150)
    .seg(150, -70, -30)
    .seg(150, 70, 0)
    .seg(150, -70, 0)
    .seg(150, 70, 0)
    .hold(100);
  c.spike(40, 'top', 45, 20);
  c.spike(110, 'bottom', 45, 20);
  c.spike(180, 'top', 45, 20);
  c
    .seg(200, 0, 30)
    .hold(180)
    .seg(220, 100, -20)
    .hold(120);
  c.spike(50, 'bottom', 45, 22);
  c.spike(150, 'top', 45, 22);
  c
    .seg(220, -100, 40)
    .hold(300);
  return c.build('Extreme', '#c400ff', 1.35);
}

// A different kind of challenge from the others: the centerline never shifts (every segment
// here is either hold() or a width-only seg() with dCenter 0) — no big wave swings to dodge,
// just a long flat corridor that gets tight enough that you have to keep tapping on/off in
// quick, small bursts to hold a near-straight line instead of drifting into a wall.
function makeStraightLevel() {
  const c = buildCorridor(0, 300, 260)
    .hold(300)
    .seg(250, 0, -110)
    .hold(500);
  c.spike(150, 'top', 50, 26);
  c.spike(320, 'bottom', 50, 26);
  c
    .seg(200, 0, 40)
    .hold(300)
    .seg(250, 0, -90)
    .hold(450);
  c.spike(120, 'bottom', 45, 24);
  c.spike(280, 'top', 45, 24);
  c
    .seg(200, 0, 60)
    .hold(300)
    .seg(250, 0, -60)
    .hold(500);
  c.spike(150, 'bottom', 45, 22);
  c.spike(320, 'top', 45, 22);
  c.spike(450, 'bottom', 40, 20);
  c
    .seg(200, 0, 80)
    .hold(300);
  return c.build('Straight Flight', '#4fd1ff');
}

const LEVELS = {
  easy: makeEasyLevel(),
  medium: makeMediumLevel(),
  hard: makeHardLevel(),
  extreme: makeExtremeLevel(),
  straight: makeStraightLevel(),
};

// Export for Node-based testing (no-op in the browser, where `module` is undefined).
if (typeof module !== 'undefined') {
  module.exports = {
    buildCorridor, corridorTopAt, corridorBottomAt, spikeVerts, pointInTriangle,
    stepPlayer, checkDeath, validateLevel, LEVELS,
    SCROLL_SPEED, VERT_SPEED, PLAYER_HIT_RADIUS, CANVAS_W, CANVAS_H,
  };
}

// ================= Rendering & game loop (browser only) =================
if (typeof document !== 'undefined') {
  (function () {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    const menuEl = document.getElementById('menu');
    const hudEl = document.getElementById('hud');
    const progressFill = document.getElementById('progress-fill');
    const progressLabel = document.getElementById('progress-label');
    const attemptsLabel = document.getElementById('attempts-label');
    const progressBestEl = document.getElementById('progress-best');
    const completeEl = document.getElementById('complete-overlay');
    const completeLevelName = document.getElementById('complete-level-name');

    const PROGRESS_KEY = 'geometrywave_progress';
    function loadProgress() {
      try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch { return {}; }
    }
    function saveProgress(progress) {
      // Called from inside the per-frame update loop every time progress advances past the
      // session best, not just once at level-complete — an unguarded throw here (Safari private
      // browsing, a storage-blocking extension) would crash the render loop mid-run. Same bug
      // class already fixed in seince-jump.js/fighterplane.js/webswing.js's own score/best/
      // record persistence.
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch {}
    }
    const progress = loadProgress();

    function renderMenuBests() {
      ['easy', 'medium', 'hard', 'extreme', 'straight'].forEach((key) => {
        const el = document.getElementById(`best-${key}`);
        const best = progress[key] || 0;
        el.textContent = best >= 100 ? 'Completed!' : `Best: ${Math.floor(best)}%`;
      });
    }
    renderMenuBests();

    let currentLevelKey = null;
    let level = null;
    let state = { x: 0, y: 0 };
    let holding = false;
    let running = false;
    let dying = false;
    let attempts = 0;
    let bestThisSession = 0;
    let trail = [];
    let flashUntil = 0;

    // Parallax star layer. Fixed set, wrapped modulo the canvas width at each depth, so it costs no
    // allocation per frame and never runs out however long a level is. The flat background gave the
    // scroll nothing to read against except the faint grid.
    const BG_STARS = [];
    for (let i = 0; i < 70; i++) {
      BG_STARS.push({
        x: Math.random() * CANVAS_W,
        y: Math.random() * CANVAS_H,
        r: 0.6 + Math.random() * 1.6,
        depth: 0.08 + Math.random() * 0.30,
        alpha: 0.15 + Math.random() * 0.45,
      });
    }
    let bgGradient = null; // built lazily on the first draw, once ctx is known good

    // Death burst. Plain array with in-place removal — a run can die hundreds of times, so this
    // deliberately reuses nothing and allocates only for the ~26 particles of one burst.
    const deathParticles = [];
    function spawnDeathParticles(x, y, color) {
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 220;
        deathParticles.push({
          x, y, color,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.55 + Math.random() * 0.35, max: 0.9,
        });
      }
    }
    function updateDeathParticles(dt) {
      for (let i = deathParticles.length - 1; i >= 0; i--) {
        const p = deathParticles[i];
        p.life -= dt;
        if (p.life <= 0) { deathParticles.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 420 * dt; // falls away rather than drifting, so a death reads as debris
        p.vx *= 0.99;
      }
    }

    // --- Multiplayer: same room code as chat (from the menu link) + same level = same ghosts.
    // Levels are hand-built (not random), so everyone's x/y already share one coordinate space —
    // no world state to sync here, just positions.
    const mpParams = new URLSearchParams(location.search);
    const mpRoomCode = mpParams.get('room');
    const mpPlayerName = (mpParams.get('name') || 'Player').slice(0, 30);
    if (mpRoomCode) {
      const backLink = document.getElementById('back-link');
      if (backLink) backLink.href = `index.html?room=${encodeURIComponent(mpRoomCode)}&name=${encodeURIComponent(mpPlayerName)}`;
    }
    let gwSocket = null;
    let gwConnectedLevel = null;
    let lastGwPosSent = 0;
    const gwRemotePlayers = new Map(); // id -> { x, y }

    function gwConnect(levelKey) {
      if (!mpRoomCode) return;
      if (gwSocket && gwConnectedLevel === levelKey && gwSocket.readyState === WebSocket.OPEN) return;
      if (gwSocket) gwSocket.close();
      gwRemotePlayers.clear();
      gwConnectedLevel = levelKey;
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      gwSocket = new WebSocket(`${protocol}//${location.host}`);
      gwSocket.addEventListener('open', () => {
        gwSocket.send(JSON.stringify({ type: 'gw-join', code: mpRoomCode, level: levelKey, name: mpPlayerName }));
      });
      gwSocket.addEventListener('message', (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (err) {
          reportClientError('Malformed WS frame: ' + err.message, err.stack);
          return;
        }
        if (data.type === 'gw-init') {
          data.players.forEach((p) => gwRemotePlayers.set(p.id, { x: p.x, y: p.y }));
        } else if (data.type === 'gw-player-joined') {
          gwRemotePlayers.set(data.id, { x: 0, y: state.y });
        } else if (data.type === 'gw-pos') {
          const rp = gwRemotePlayers.get(data.id);
          if (rp) { rp.x = data.x; rp.y = data.y; } else gwRemotePlayers.set(data.id, { x: data.x, y: data.y });
        } else if (data.type === 'gw-player-left') {
          gwRemotePlayers.delete(data.id);
        } else if (data.type === 'gw-full') {
          gwSocket.close();
          gwSocket = null;
        } else if (data.type === 'gw-leaderboard-result') {
          renderLeaderboard(data.scores || []);
        }
      });
    }

    // Every other multiplayer minigame in this app explicitly sends its own xx-leave on unload
    // (chess.js/pictionary.js/hangman.js/trivia.js's `beforeunload` -> send('xx-leave')) — Geometry
    // Wave never did. Harmless in practice (the server's ws.on('close') handler already runs the
    // same leaveGw() cleanup unconditionally on disconnect), but matching the established pattern
    // costs nothing.
    window.addEventListener('beforeunload', () => {
      if (gwSocket && gwSocket.readyState === WebSocket.OPEN) gwSocket.send(JSON.stringify({ type: 'gw-leave' }));
    });

    // --- Original background music: a small synth loop generated live via Web Audio
    // oscillators + a filtered-noise hi-hat — no audio files, nothing external.
    const MUSIC_MUTE_KEY = 'geometrywave_music_muted';
    const NOTE_FREQS = {
      F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
      C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00,
      A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00,
      A4: 440.00, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25,
    };
    // Am - F - C - G, a generic four-chord loop; each chord gets 8 steps of an
    // ascending/descending arpeggio while the bass bounces the root up an octave.
    const MUSIC_CHORDS = [
      { bass: 'A2', arp: ['A3', 'C4', 'E4', 'C4', 'A3', 'E4', 'C4', 'E4'] },
      { bass: 'F2', arp: ['F3', 'A3', 'C4', 'A3', 'F3', 'C4', 'A3', 'C4'] },
      { bass: 'C3', arp: ['C4', 'E4', 'G4', 'E4', 'C4', 'G4', 'E4', 'G4'] },
      { bass: 'G2', arp: ['G3', 'B3', 'D4', 'B3', 'G3', 'D4', 'B3', 'D4'] },
    ];
    const MUSIC_STEPS_PER_CHORD = 8;
    const MUSIC_TOTAL_STEPS = MUSIC_CHORDS.length * MUSIC_STEPS_PER_CHORD;
    const MUSIC_BASE_STEP_DUR = 60 / 140 / 2; // 140 BPM, 8th notes

    let audioCtx = null, masterGain = null;
    let musicOn = true;
    try { musicOn = localStorage.getItem(MUSIC_MUTE_KEY) !== '1'; } catch { /* no-op */ }
    let musicActive = false, musicStepIndex = 0, musicNextStepTime = 0, musicStepDur = MUSIC_BASE_STEP_DUR;

    function playTone(freq, startTime, duration, type, peakGain) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, startTime);
      g.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    }

    function playHat(startTime) {
      const bufferSize = Math.floor(audioCtx.sampleRate * 0.03);
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const filt = audioCtx.createBiquadFilter();
      filt.type = 'highpass';
      filt.frequency.value = 6000;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.1, startTime);
      g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.03);
      noise.connect(filt);
      filt.connect(g);
      g.connect(masterGain);
      noise.start(startTime);
      noise.stop(startTime + 0.04);
    }

    function scheduleMusicStep(index, time) {
      const chordIdx = Math.floor(index / MUSIC_STEPS_PER_CHORD) % MUSIC_CHORDS.length;
      const chord = MUSIC_CHORDS[chordIdx];
      const posInChord = index % MUSIC_STEPS_PER_CHORD;
      if (posInChord === 0 || posInChord === 4) {
        playTone(NOTE_FREQS[chord.bass], time, musicStepDur * 1.8, 'sawtooth', 0.2);
      }
      playTone(NOTE_FREQS[chord.arp[posInChord]], time, musicStepDur * 0.85, 'square', 0.09);
      if (posInChord % 2 === 1) playHat(time);
    }

    function startMusic() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.22;
        masterGain.connect(audioCtx.destination);
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      musicStepDur = MUSIC_BASE_STEP_DUR / ((level && level.speedMult) || 1);
      musicStepIndex = 0;
      musicNextStepTime = audioCtx.currentTime + 0.05;
      musicActive = true;
    }

    function stopMusic() {
      musicActive = false;
    }

    function tickMusic() {
      if (!musicActive || !audioCtx) return;
      while (musicNextStepTime < audioCtx.currentTime + 0.15) {
        if (musicOn) scheduleMusicStep(musicStepIndex % MUSIC_TOTAL_STEPS, musicNextStepTime);
        musicStepIndex += 1;
        musicNextStepTime += musicStepDur;
      }
    }

    const musicToggleBtn = document.getElementById('music-toggle-btn');
    function updateMusicBtnLabel() { musicToggleBtn.textContent = musicOn ? '🔊' : '🔇'; }
    updateMusicBtnLabel();
    musicToggleBtn.addEventListener('click', () => {
      musicOn = !musicOn;
      try { localStorage.setItem(MUSIC_MUTE_KEY, musicOn ? '0' : '1'); } catch { /* no-op */ }
      updateMusicBtnLabel();
    });

    // Personal-best marker on the run bar. The best % was only ever shown as text on level select,
    // so mid-run you had no idea whether you were about to beat it — which is the whole tension of
    // a game you replay this many times.
    function updateBestMarker() {
      const best = (currentLevelKey && progress[currentLevelKey]) || 0;
      if (best <= 0 || best >= 100) {
        progressBestEl.classList.add('hidden');
        return;
      }
      progressBestEl.style.left = `${best}%`;
      progressBestEl.classList.remove('hidden');
    }

    function startLevel(key) {
      currentLevelKey = key;
      level = LEVELS[key];
      attempts = 0;
      bestThisSession = 0;
      resetAttempt();
      menuEl.classList.add('hidden');
      completeEl.classList.add('hidden');
      hudEl.classList.remove('hidden');
      canvas.classList.remove('hidden');
      running = true;
      gwConnect(key);
      startMusic();
    }

    function resetAttempt() {
      const startTop = corridorTopAt(level, 0);
      const startBottom = corridorBottomAt(level, 0);
      state = { x: 0, y: (startTop + startBottom) / 2 };
      trail = [];
      attempts += 1;
      attemptsLabel.textContent = `Attempt ${attempts}`;
      // Refreshed here rather than as the best is being set, so the marker stays put for the attempt
      // that beats it (where it's the thing you're racing) and moves for the next one.
      updateBestMarker();
      dying = false;
    }

    function backToMenu() {
      running = false;
      dying = false;
      stopMusic();
      // Without this, a player who finishes/dies out and returns to the menu (rather than
      // immediately picking another level, which is the only other path that closes gwSocket —
      // see gwConnect) stayed registered in that level's server-side session and kept appearing
      // as a frozen ghost to everyone still playing it, until they eventually picked a level again
      // or closed the tab. Closing here triggers the server's own leaveGw cleanup via the socket's
      // close event, same as a real disconnect.
      if (gwSocket) { gwSocket.close(); gwSocket = null; }
      gwConnectedLevel = null;
      gwRemotePlayers.clear();
      menuEl.classList.remove('hidden');
      hudEl.classList.add('hidden');
      completeEl.classList.add('hidden');
      renderMenuBests();
    }

    function onDeath() {
      if (dying) return; // already handling this death — ignore repeat triggers before reset
      dying = true;
      spawnDeathParticles(state.x, state.y, level ? level.color : '#ff4d4d');
      flashUntil = performance.now() + 180;
      setTimeout(() => { if (currentLevelKey) resetAttempt(); }, 260);
    }

    function onComplete() {
      running = false;
      progress[currentLevelKey] = 100;
      saveProgress(progress);
      completeLevelName.textContent = level.name;
      completeEl.classList.remove('hidden');
      if (mpRoomCode && gwSocket && gwSocket.readyState === WebSocket.OPEN) {
        gwSocket.send(JSON.stringify({ type: 'gw-complete', level: currentLevelKey, percent: 100, name: mpPlayerName }));
      }
    }

    document.querySelectorAll('.level-btn').forEach((btn) => {
      btn.addEventListener('click', () => startLevel(btn.dataset.level));
    });
    document.getElementById('menu-btn-from-hud').addEventListener('click', backToMenu);
    document.getElementById('retry-btn').addEventListener('click', () => startLevel(currentLevelKey));
    document.getElementById('complete-menu-btn').addEventListener('click', backToMenu);

    // ---------- Leaderboard (persisted server-side per room+level, multiplayer only) ----------
    const leaderboardBtn = document.getElementById('leaderboard-btn');
    const leaderboardOverlay = document.getElementById('leaderboard-overlay');
    const leaderboardCloseBtn = document.getElementById('leaderboard-close-btn');
    const leaderboardListEl = document.getElementById('leaderboard-list');
    const leaderboardLevelNameEl = document.getElementById('leaderboard-level-name');

    function renderLeaderboard(scores) {
      leaderboardListEl.innerHTML = '';
      if (!scores.length) {
        const li = document.createElement('li');
        li.textContent = 'No scores yet on this level.';
        leaderboardListEl.appendChild(li);
        return;
      }
      scores.forEach((s, i) => {
        const li = document.createElement('li');
        const name = document.createElement('span');
        name.textContent = `${i + 1}. ${s.name}`;
        const score = document.createElement('span');
        score.textContent = `${s.score}%`;
        li.append(name, score);
        leaderboardListEl.appendChild(li);
      });
    }

    if (leaderboardBtn) {
      if (!mpRoomCode) {
        leaderboardBtn.classList.add('hidden'); // solo play has no room to compare against
      } else {
        leaderboardBtn.addEventListener('click', () => {
          if (!currentLevelKey) return;
          leaderboardLevelNameEl.textContent = (LEVELS[currentLevelKey] && LEVELS[currentLevelKey].name) || currentLevelKey;
          leaderboardOverlay.classList.remove('hidden');
          if (gwSocket && gwSocket.readyState === WebSocket.OPEN) {
            gwSocket.send(JSON.stringify({ type: 'gw-leaderboard', code: mpRoomCode, level: currentLevelKey }));
          } else {
            // Previously silently did nothing here (e.g. after a gw-full rejection nulled out
            // gwSocket) — the overlay opened but stayed permanently empty with no explanation.
            leaderboardListEl.innerHTML = '';
            const li = document.createElement('li');
            li.textContent = "Can't reach the leaderboard right now — try again in a moment.";
            leaderboardListEl.appendChild(li);
          }
        });
        leaderboardCloseBtn.addEventListener('click', () => leaderboardOverlay.classList.add('hidden'));
        leaderboardOverlay.addEventListener('click', (e) => {
          if (e.target === leaderboardOverlay) leaderboardOverlay.classList.add('hidden');
        });
        // Same Escape-to-close fix already applied to every other overlay in this app this session.
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && !leaderboardOverlay.classList.contains('hidden')) leaderboardCloseBtn.click();
        });
      }
    }

    function setHolding(v) { holding = v; }
    canvas.addEventListener('mousedown', () => setHolding(true));
    window.addEventListener('mouseup', () => setHolding(false));
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); setHolding(true); }, { passive: false });
    window.addEventListener('touchend', () => setHolding(false));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); setHolding(true); }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') setHolding(false);
    });
    // A key/mouse/touch released while the window doesn't have focus never delivers its up event,
    // so `holding` stays stuck true — same bug already fixed in webswing.js/fighterplane.js this
    // session. requestAnimationFrame pauses while hidden, so nothing happens until the player
    // returns to the tab, at which point the ship rockets straight up into the ceiling with no
    // input from them.
    window.addEventListener('blur', () => setHolding(false));
    document.addEventListener('visibilitychange', () => { if (document.hidden) setHolding(false); });

    function draw() {
      if (!bgGradient) {
        bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
        bgGradient.addColorStop(0, '#0c1e36');
        bgGradient.addColorStop(0.5, '#0a1420');
        bgGradient.addColorStop(1, '#0d1729');
      }
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      if (!level) return;
      const camX = state.x - CANVAS_W * 0.25;

      // parallax stars, behind the grid
      ctx.fillStyle = '#ffffff';
      for (const st of BG_STARS) {
        const sx = ((st.x - camX * st.depth) % CANVAS_W + CANVAS_W) % CANVAS_W;
        ctx.globalAlpha = st.alpha;
        ctx.beginPath();
        ctx.arc(sx, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // background grid (parallax)
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      const gridSpacing = 60;
      const gridOffset = -((camX * 0.5) % gridSpacing);
      for (let gx = gridOffset; gx < CANVAS_W; gx += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CANVAS_H); ctx.stroke();
      }
      for (let gy = 0; gy < CANVAS_H; gy += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CANVAS_W, gy); ctx.stroke();
      }

      // corridor walls
      const sampleStep = 20;
      ctx.fillStyle = '#132338';
      ctx.strokeStyle = level.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = level.color;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let sx = 0; sx <= CANVAS_W; sx += sampleStep) ctx.lineTo(sx, corridorTopAt(level, camX + sx));
      ctx.lineTo(CANVAS_W, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      for (let sx = 0; sx <= CANVAS_W; sx += sampleStep) {
        const y = corridorTopAt(level, camX + sx);
        if (sx === 0) ctx.moveTo(sx, y); else ctx.lineTo(sx, y);
      }
      ctx.stroke();

      // bottom wall
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_H);
      for (let sx = 0; sx <= CANVAS_W; sx += sampleStep) ctx.lineTo(sx, corridorBottomAt(level, camX + sx));
      ctx.lineTo(CANVAS_W, CANVAS_H);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      for (let sx = 0; sx <= CANVAS_W; sx += sampleStep) {
        const y = corridorBottomAt(level, camX + sx);
        if (sx === 0) ctx.moveTo(sx, y); else ctx.lineTo(sx, y);
      }
      ctx.stroke();

      // spikes
      ctx.fillStyle = '#ff4d4d';
      ctx.shadowColor = '#ff4d4d';
      ctx.shadowBlur = 6;
      for (const spike of level.spikes) {
        if (spike.x - camX < -50 || spike.x - camX > CANVAS_W + 50) continue;
        const [v1, v2, v3] = spikeVerts(spike);
        ctx.beginPath();
        ctx.moveTo(v1.x - camX, v1.y);
        ctx.lineTo(v2.x - camX, v2.y);
        ctx.lineTo(v3.x - camX, v3.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Trail, drawn per-segment so it can taper toward the tail. It's the main read on where you
      // just came from and how fast you're climbing; one constant-width line at flat alpha gave no
      // sense of direction. No shadowBlur here on purpose — 50 blurred strokes a frame is the one
      // canvas2d cost that would actually show up.
      if (trail.length > 1) {
        ctx.strokeStyle = level.color;
        ctx.lineCap = 'round';
        for (let i = 1; i < trail.length; i++) {
          const t = i / (trail.length - 1); // 0 at the oldest point, 1 at the newest
          ctx.globalAlpha = 0.08 + t * 0.72;
          ctx.lineWidth = 1 + t * 3.2;
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x - camX, trail[i - 1].y);
          ctx.lineTo(trail[i].x - camX, trail[i].y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.lineCap = 'butt';
      }

      // death debris
      for (const p of deathParticles) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - camX - 1.5, p.y - 1.5, 3, 3);
      }
      ctx.globalAlpha = 1;

      // other players (multiplayer ghosts)
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#9dd8ff';
      for (const rp of gwRemotePlayers.values()) {
        const gx = rp.x - camX;
        if (gx < -30 || gx > CANVAS_W + 30) continue;
        ctx.save();
        ctx.translate(gx, rp.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-6, -6, 12, 12);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // player (diamond)
      const px = state.x - camX, py = state.y;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = level.color;
      ctx.shadowBlur = 14;
      const s = 11;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.shadowBlur = 0;

      // death flash
      if (performance.now() < flashUntil) {
        ctx.fillStyle = 'rgba(255,60,60,0.35)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }
    }

    let lastTime = performance.now();
    function loop() {
      requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      // Outside the running/!dying gate below on purpose — the burst has to keep animating through
      // the death pause, which is the only time it's ever on screen.
      updateDeathParticles(dt);

      if (running && level && !dying) {
        stepPlayer(state, dt, holding, level.speedMult);
        trail.push({ x: state.x, y: state.y });
        if (trail.length > 50) trail.shift();

        if (gwSocket && gwSocket.readyState === WebSocket.OPEN && now - lastGwPosSent > 100) {
          lastGwPosSent = now;
          gwSocket.send(JSON.stringify({ type: 'gw-pos', x: state.x, y: state.y }));
        }

        const pct = Math.min(100, (state.x / level.length) * 100);
        progressFill.style.width = `${pct}%`;
        progressLabel.textContent = `${Math.floor(pct)}%`;
        if (pct > bestThisSession) {
          bestThisSession = pct;
          if (pct > (progress[currentLevelKey] || 0)) {
            progress[currentLevelKey] = pct;
            saveProgress(progress);
          }
        }

        if (state.x >= level.length) {
          onComplete();
        } else if (checkDeath(level, state)) {
          onDeath();
        }
      }
      tickMusic();
      draw();
    }
    loop();
  })();
}
