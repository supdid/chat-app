(() => {
  'use strict';

  // --- Carry the room/name from the chat page back into the "Back to chat" link ---
  const sjParams = new URLSearchParams(location.search);
  const sjRoomCode = sjParams.get('room');
  const sjPlayerName = sjParams.get('name');
  if (sjRoomCode && sjPlayerName) {
    const backLink = document.getElementById('back-link');
    if (backLink) backLink.href = `index.html?room=${encodeURIComponent(sjRoomCode)}&name=${encodeURIComponent(sjPlayerName)}`;
  }

  // ---------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------
  const CANVAS_W = 960;
  const CANVAS_H = 400;
  const GROUND_Y = 320;       // y of the ground surface
  const SIZE = 34;            // player square size
  const PLAYER_SCREEN_X = 130;
  const GRAVITY = 0.5;
  const JUMP_VEL = -9.5;
  const FALL_DEATH_Y = CANVAS_H + 80;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // ---------------------------------------------------------------
  // Level builder — a tiny DSL for laying out obstacles left to right
  // ---------------------------------------------------------------
  class LevelBuilder {
    constructor(startX = 460) {
      this.x = startX;
      this.solids = [{ x1: 0, x2: startX, top: GROUND_Y, bot: GROUND_Y + 400 }];
      this.hazards = [];
    }
    flat(len) {
      this.solids.push({ x1: this.x, x2: this.x + len, top: GROUND_Y, bot: GROUND_Y + 400 });
      this.x += len;
      return this;
    }
    spikes(n = 1, w = 30, gap = 6) {
      const start = this.x;
      for (let i = 0; i < n; i++) {
        this.hazards.push({ x1: this.x, x2: this.x + w, topY: GROUND_Y - 26, baseY: GROUND_Y, kind: 'spike' });
        this.x += w + gap;
      }
      this.x -= gap;
      this.solids.push({ x1: start, x2: this.x, top: GROUND_Y, bot: GROUND_Y + 400 });
      return this;
    }
    block(w, h) {
      this.solids.push({ x1: this.x, x2: this.x + w, top: GROUND_Y - h, bot: GROUND_Y + 400 });
      this.x += w;
      return this;
    }
    spikeOnBlock(w, h) {
      this.solids.push({ x1: this.x, x2: this.x + w, top: GROUND_Y - h, bot: GROUND_Y + 400 });
      const cx = this.x + w / 2;
      this.hazards.push({ x1: cx - 14, x2: cx + 14, topY: GROUND_Y - h - 26, baseY: GROUND_Y - h, kind: 'spike' });
      this.x += w;
      return this;
    }
    pit(w) {
      this.x += w;
      return this;
    }
    stepStones(stoneW, stoneGap, count, h) {
      for (let i = 0; i < count; i++) {
        this.solids.push({ x1: this.x, x2: this.x + stoneW, top: GROUND_Y - h, bot: GROUND_Y - h + 22 });
        this.x += stoneW + stoneGap;
      }
      this.x -= stoneGap;
      return this;
    }
    ceilSpikes(w, drop = 205) {
      this.hazards.push({ x1: this.x, x2: this.x + w, botY: drop, kind: 'ceil' });
      this.solids.push({ x1: this.x, x2: this.x + w, top: GROUND_Y, bot: GROUND_Y + 400 });
      this.x += w;
      return this;
    }
    end(pad = 500) {
      this.length = this.x + pad;
      this.solids.push({ x1: this.x, x2: this.x + pad, top: GROUND_Y, bot: GROUND_Y + 400 });
      return this;
    }
  }

  // ---------------------------------------------------------------
  // Levels
  // ---------------------------------------------------------------
  function buildStereoMadness() {
    return new LevelBuilder()
      .flat(260).spikes(1)
      .flat(230).spikes(2)
      .flat(290).block(90, 45)
      .flat(200).spikes(1)
      .flat(180).pit(140)
      .flat(230).spikeOnBlock(90, 35)
      .flat(250).spikes(2)
      .flat(290).stepStones(70, 138, 3, 45)
      .flat(230).spikes(1)
      .flat(180).spikes(3)
      .flat(290).block(110, 55)
      .flat(200).pit(150)
      .flat(230).spikes(2)
      .flat(290).spikeOnBlock(100, 40)
      .flat(260)
      .end();
  }

  function buildBackOnTrack() {
    return new LevelBuilder()
      .flat(250).spikes(2)
      .flat(290).block(100, 50)
      .flat(200).spikes(1)
      .flat(290).pit(170)
      .flat(290).stepStones(70, 160, 3, 45)
      .flat(250).spikeOnBlock(100, 38)
      .flat(220).spikes(3)
      .flat(250).ceilSpikes(100, 175)
      .flat(310).block(120, 60)
      .flat(220).spikes(2)
      .flat(220).pit(180)
      .flat(310).stepStones(70, 160, 3, 45)
      .flat(250).spikeOnBlock(110, 42)
      .flat(200).spikes(1)
      .flat(260).spikes(2)
      .flat(290).block(100, 55)
      .flat(260)
      .end();
  }

  function buildPolargeist() {
    return new LevelBuilder()
      .flat(230).spikes(2)
      .flat(260).spikes(1)
      .flat(290).block(100, 55)
      .flat(220).spikeOnBlock(100, 40)
      .flat(220).pit(190)
      .flat(320).stepStones(65, 196, 4, 45)
      .flat(230).spikes(3)
      .flat(260).ceilSpikes(110, 180)
      .flat(340).block(130, 65)
      .flat(220).spikes(2)
      .flat(230).pit(200)
      .flat(290).spikeOnBlock(110, 40)
      .flat(410).stepStones(65, 196, 4, 45)
      .flat(220).spikes(1)
      .flat(290).spikes(3)
      .flat(260).ceilSpikes(100, 180)
      .flat(340).block(110, 60)
      .flat(260)
      .end();
  }

  const LEVELS = [
    {
      id: 'stereo-madness',
      name: 'Stereo Madness',
      stars: 1,
      speed: 5.6,
      color: '#2f7fe0',
      colorDark: '#0a2f66',
      bgTop: '#3d8fe0',
      bgBot: '#0a2f66',
      build: buildStereoMadness,
    },
    {
      id: 'back-on-track',
      name: 'Back on Track',
      stars: 2,
      speed: 6.2,
      color: '#e0189f',
      colorDark: '#5c0c50',
      bgTop: '#e0459f',
      bgBot: '#5c0c50',
      build: buildBackOnTrack,
    },
    {
      id: 'polargeist',
      name: 'Polargeist',
      stars: 3,
      speed: 7.0,
      color: '#2fae4e',
      colorDark: '#0d5c2a',
      bgTop: '#3dc463',
      bgBot: '#0d5c2a',
      build: buildPolargeist,
    },
  ];

  // ---------------------------------------------------------------
  // Persistence (best attempt counts)
  // ---------------------------------------------------------------
  const SAVE_KEY = 'seinceJumpBest';
  function loadBest() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; }
  }
  function saveBest(id, attempts) {
    const best = loadBest();
    if (!best[id] || attempts < best[id]) {
      best[id] = attempts;
      localStorage.setItem(SAVE_KEY, JSON.stringify(best));
    }
  }

  // ---------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------
  const menuScreen = document.getElementById('menuScreen');
  const gameScreen = document.getElementById('gameScreen');
  const levelListEl = document.getElementById('levelList');
  const levelNameEl = document.getElementById('levelName');
  const progressFillEl = document.getElementById('progressFill');
  const attemptCountEl = document.getElementById('attemptCount');
  const overlayEl = document.getElementById('overlay');
  const overlayTitleEl = document.getElementById('overlayTitle');
  const overlaySubEl = document.getElementById('overlaySub');
  const flashEl = document.getElementById('flash');
  const quitBtn = document.getElementById('quitBtn');

  function renderMenu() {
    const best = loadBest();
    levelListEl.innerHTML = '';
    LEVELS.forEach((lvl, i) => {
      const li = document.createElement('li');
      li.className = 'level-card';
      li.style.setProperty('--lvl-color', lvl.color);
      const bestAttempts = best[lvl.id];
      li.innerHTML = `
        <div class="level-num">${i + 1}</div>
        <div class="level-face">${faceSvg()}</div>
        <div class="level-info">
          <div class="name">${lvl.name}</div>
          <div class="meta">Original design &middot; ${lvl.stars === 1 ? 'Easy' : lvl.stars === 2 ? 'Medium' : 'Hard'}</div>
          ${bestAttempts ? `<div class="level-best">Best: ${bestAttempts} attempt${bestAttempts === 1 ? '' : 's'}</div>` : ''}
        </div>
        <div class="level-stars">${'★'.repeat(lvl.stars)}</div>
      `;
      li.addEventListener('click', () => startLevel(i));
      levelListEl.appendChild(li);
    });
  }

  function faceSvg() {
    return `<svg viewBox="0 0 32 32"><path d="M8 12 L15 16 L8 20 Z" fill="#0b0d12"/><path d="M24 12 L17 16 L24 20 Z" fill="#0b0d12"/></svg>`;
  }

  // ---------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------
  let state = 'menu'; // 'menu' | 'playing' | 'dead' | 'complete' | 'finished'
  let levelIndex = 0;
  let level = null;
  let world = null;
  let attempts = 1;
  let wantJump = false;
  let lastTime = 0;
  let stateTimer = 0;
  let bgOffset = 0;

  function freshWorld() {
    return {
      x: 0,
      y: GROUND_Y - SIZE,
      vy: 0,
      grounded: true,
      rotation: 0,
    };
  }

  function startLevel(i) {
    levelIndex = i;
    level = { ...LEVELS[i], ...LEVELS[i].build() };
    attempts = 1;
    world = freshWorld();
    state = 'playing';
    menuScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    overlayEl.classList.add('hidden');
    levelNameEl.textContent = level.name;
    attemptCountEl.textContent = `Attempt ${attempts}`;
    progressFillEl.style.width = '0%';
  }

  function restartLevel() {
    world = freshWorld();
    state = 'playing';
    overlayEl.classList.add('hidden');
    attemptCountEl.textContent = `Attempt ${attempts}`;
    progressFillEl.style.width = '0%';
  }

  function backToMenu() {
    state = 'menu';
    gameScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    renderMenu();
  }

  function die() {
    if (state !== 'playing') return;
    state = 'dead';
    stateTimer = 0;
    flashEl.classList.remove('win');
    flashEl.classList.remove('hit');
    void flashEl.offsetWidth; // restart animation
    flashEl.classList.add('hit');
  }

  function complete() {
    if (state !== 'playing') return;
    state = 'complete';
    stateTimer = 0;
    saveBest(level.id, attempts);
    flashEl.classList.remove('hit');
    flashEl.classList.remove('win');
    void flashEl.offsetWidth;
    flashEl.classList.add('win');
    overlayTitleEl.textContent = 'Level Complete!';
    overlaySubEl.textContent = `Beat it in ${attempts} attempt${attempts === 1 ? '' : 's'}`;
    overlayEl.classList.remove('hidden');
  }

  // ---------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------
  function pressJump() {
    if (state === 'playing') wantJump = true;
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      pressJump();
    } else if (e.code === 'Escape' && state === 'playing') {
      backToMenu();
    }
  });
  canvas.addEventListener('mousedown', pressJump);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); pressJump(); }, { passive: false });
  quitBtn.addEventListener('click', backToMenu);

  // ---------------------------------------------------------------
  // Physics / update
  // ---------------------------------------------------------------
  function update(dt) {
    if (state === 'dead' || state === 'complete') {
      stateTimer += dt;
      const waitFrames = state === 'dead' ? 40 : 55;
      if (stateTimer > waitFrames) {
        if (state === 'dead') {
          attempts += 1;
          restartLevel();
        } else {
          if (levelIndex < LEVELS.length - 1) {
            startLevel(levelIndex + 1);
          } else {
            state = 'finished';
            overlayTitleEl.textContent = 'All Levels Complete!';
            overlaySubEl.textContent = 'You beat Seince Jump. Nice work.';
            overlayEl.classList.remove('hidden');
          }
        }
      }
      return;
    }
    if (state !== 'playing') return;

    const speed = level.speed;
    world.x += speed * dt;
    bgOffset += speed * dt * 0.4;

    if (wantJump && world.grounded) {
      world.vy = JUMP_VEL;
      world.grounded = false;
    }
    wantJump = false;

    const prevBottom = world.y + SIZE;
    world.vy += GRAVITY * dt;
    world.y += world.vy * dt;

    // Rotation while airborne
    if (!world.grounded) {
      world.rotation += 0.13 * dt;
    }

    // Collision against solids
    let landed = false;
    const px1 = world.x, px2 = world.x + SIZE;
    for (const s of level.solids) {
      if (px2 > s.x1 && px1 < s.x2) {
        if (world.y + SIZE >= s.top && prevBottom <= s.top + 1 && world.vy >= 0) {
          world.y = s.top - SIZE;
          world.vy = 0;
          landed = true;
        } else if (world.y < s.bot && world.y + SIZE > s.top) {
          die();
          return;
        }
      }
    }
    world.grounded = landed;
    if (landed) world.rotation = Math.round(world.rotation / (Math.PI / 2)) * (Math.PI / 2);

    // Hazards
    const py1 = world.y, py2 = world.y + SIZE;
    for (const h of level.hazards) {
      if (px2 <= h.x1 || px1 >= h.x2) continue;
      if (h.kind === 'spike') {
        const hx1 = h.x1 + (h.x2 - h.x1) * 0.18;
        const hx2 = h.x2 - (h.x2 - h.x1) * 0.18;
        const hy1 = h.topY + 4;
        const hy2 = h.baseY;
        if (px2 > hx1 && px1 < hx2 && py2 > hy1 && py1 < hy2) { die(); return; }
      } else if (h.kind === 'ceil') {
        if (py1 < h.botY) { die(); return; }
      }
    }

    if (world.y > FALL_DEATH_Y) { die(); return; }

    if (world.x >= level.length) { complete(); return; }

    progressFillEl.style.width = `${Math.min(100, (world.x / level.length) * 100)}%`;
  }

  // ---------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------
  function draw() {
    if (state === 'menu' || !level) return;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, level.bgTop);
    grad.addColorStop(1, level.bgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Parallax grid squares
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 2;
    const tile = 90;
    const off = bgOffset % tile;
    for (let x = -tile - off; x < CANVAS_W + tile; x += tile) {
      for (let y = 10; y < GROUND_Y; y += tile) {
        ctx.strokeRect(x, y, tile - 10, tile - 10);
      }
    }

    const camX = world.x - PLAYER_SCREEN_X;

    // Solids: flush ground segments draw as a ground band; anything raised
    // draws as a block/pillar; thin platforms float with a void underneath
    // (that void is how pits/gaps read visually — no ground is drawn there).
    for (const s of level.solids) {
      const sx1 = s.x1 - camX, sx2 = s.x2 - camX;
      if (sx2 < -20 || sx1 > CANVAS_W + 20) continue;
      const extendsToBottom = s.bot >= GROUND_Y + 300;
      if (s.top === GROUND_Y) {
        ctx.fillStyle = level.colorDark;
        ctx.fillRect(sx1, GROUND_Y, sx2 - sx1, CANVAS_H - GROUND_Y);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(sx1, GROUND_Y, sx2 - sx1, 3);
      } else {
        const bottom = extendsToBottom ? CANVAS_H : s.bot;
        drawBlock(sx1, s.top, sx2 - sx1, bottom - s.top, level.color);
      }
    }

    // Hazards
    for (const h of level.hazards) {
      const hx1 = h.x1 - camX, hx2 = h.x2 - camX;
      if (hx2 < -20 || hx1 > CANVAS_W + 20) continue;
      if (h.kind === 'spike') {
        drawSpike(hx1, hx2, h.topY, h.baseY);
      } else if (h.kind === 'ceil') {
        drawCeilSpikes(hx1, hx2, h.botY);
      }
    }

    // Player
    drawPlayer(PLAYER_SCREEN_X, world.y, world.rotation);
  }

  function drawBlock(x, y, w, h, color) {
    ctx.fillStyle = '#0e1017';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  function drawSpike(x1, x2, topY, baseY) {
    const cx = (x1 + x2) / 2;
    ctx.fillStyle = '#eef1f7';
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(x2, baseY);
    ctx.lineTo(x1, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawCeilSpikes(x1, x2, botY) {
    const w = x2 - x1;
    const n = Math.max(1, Math.round(w / 26));
    const step = w / n;
    ctx.fillStyle = '#eef1f7';
    for (let i = 0; i < n; i++) {
      const sx1 = x1 + i * step;
      const sx2 = sx1 + step - 3;
      const cx = (sx1 + sx2) / 2;
      ctx.beginPath();
      ctx.moveTo(cx, botY);
      ctx.lineTo(sx2, 0);
      ctx.lineTo(sx1, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x1, 0, w, 6);
  }

  function drawPlayer(x, y, rotation) {
    ctx.save();
    ctx.translate(x + SIZE / 2, y + SIZE / 2);
    ctx.rotate(rotation);
    ctx.fillStyle = '#0e1017';
    ctx.fillRect(-SIZE / 2 - 2, -SIZE / 2 - 2, SIZE + 4, SIZE + 4);
    const grad = ctx.createLinearGradient(-SIZE / 2, -SIZE / 2, SIZE / 2, SIZE / 2);
    grad.addColorStop(0, '#4de896');
    grad.addColorStop(1, '#2bb96e');
    ctx.fillStyle = grad;
    ctx.fillRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE);
    // eyes
    ctx.fillStyle = '#0b0d12';
    ctx.beginPath();
    ctx.moveTo(-8, -7); ctx.lineTo(-1, 0); ctx.lineTo(-8, 7); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -7); ctx.lineTo(1, 0); ctx.lineTo(8, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------
  function loop(now) {
    if (!lastTime) lastTime = now;
    const dt = Math.min((now - lastTime) / (1000 / 60), 3);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  renderMenu();
  requestAnimationFrame(loop);
})();
