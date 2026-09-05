// ---------- Room/session setup (same ?room=&name= pattern as the other minigames — this page
// opens its own WebSocket connection just for the shared leaderboard, bypassing join-server). ----------
const mpParams = new URLSearchParams(location.search);
const roomCode = mpParams.get('room');
const myName = (mpParams.get('name') || 'Player').slice(0, 30);

const backLink = document.getElementById('back-link');
if (roomCode) backLink.href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;

const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
document.getElementById('controls-list-desktop').classList.toggle('hidden', isTouchDevice);
document.getElementById('controls-list-touch').classList.toggle('hidden', !isTouchDevice);

// ---------- DOM ----------
const menuEl = document.getElementById('menu');
const startBtn = document.getElementById('start-btn');
const hudEl = document.getElementById('hud');
const streakLabel = document.getElementById('streak-label');
const bestLabel = document.getElementById('best-label');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardOverlay = document.getElementById('leaderboard-overlay');
const leaderboardCloseBtn = document.getElementById('leaderboard-close-btn');
const leaderboardListEl = document.getElementById('leaderboard-list');
const gameoverOverlay = document.getElementById('gameover-overlay');
const gameoverText = document.getElementById('gameover-text');
const gameoverSub = document.getElementById('gameover-sub');
const restartBtn = document.getElementById('restart-btn');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const playerHpFill = document.getElementById('player-hp-fill');
const opponentHpFill = document.getElementById('opponent-hp-fill');
const playerNameLabel = document.getElementById('player-name-label');
const opponentNameLabel = document.getElementById('opponent-name-label');
const touchControlsEl = document.getElementById('touch-controls');
const touchJoystickEl = document.getElementById('touch-joystick');
const touchJoystickKnobEl = document.getElementById('touch-joystick-knob');
const touchPunchBtn = document.getElementById('touch-punch');
const touchKickBtn = document.getElementById('touch-kick');
const touchBlockBtn = document.getElementById('touch-block');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function groundY() {
  return canvas.height * 0.78;
}
function arenaMinX() {
  return 80;
}
function arenaMaxX() {
  return canvas.width - 80;
}

// ---------- Tuning constants ----------
const GRAVITY = 1400; // px/s^2 (downward)
const MOVE_SPEED = 220; // px/s
const JUMP_VELOCITY = 620; // px/s upward
const FRICTION = 0.86; // per-frame velocity decay for knockback
const PUNCH_RANGE = 78;
const KICK_RANGE = 100;
const PUNCH_DAMAGE = 7;
const KICK_DAMAGE = 13;
const PUNCH_DURATION = 260;
const PUNCH_ACTIVE = [90, 150];
const KICK_DURATION = 440;
const KICK_ACTIVE = [160, 250];
const PUNCH_COOLDOWN = 340;
const KICK_COOLDOWN = 560;
const HITSTUN_DURATION = 320;
const BLOCK_DAMAGE_REDUCTION = 0.72;
const KNOCKBACK_PUNCH = 90;
const KNOCKBACK_KICK = 150;
const KO_DISPLAY_MS = 1400;
const ROUND_BANNER_MS = 1100;
const ROUND_WIN_HEAL = 18;
const MAX_HEALTH = 100;

// Body proportions (local space, hip at origin, +y is down before the whole figure is rotated)
const HEAD_R = 15;
const NECK_LEN = 5;
const TORSO_LEN = 46;
const THIGH = 27;
const SHIN = 27;
const UPPER_ARM_LEN = 40; // single-segment arm, hip-relative shoulder to hand

const OPPONENT_TIERS = ['Rookie', 'Brawler', 'Bruiser', 'Enforcer', 'Heavyweight', 'Vanguard', 'Titan', 'Champion', 'Legend'];

function difficultyForStreak(streak) {
  const t = Math.min(streak, 14);
  return {
    speedMult: 1 + t * 0.045,
    aggressiveness: Math.min(0.9, 0.32 + t * 0.04),
    blockChance: Math.min(0.55, 0.08 + t * 0.032),
    healthMult: 1 + t * 0.07,
    reactionMult: Math.max(0.4, 1 - t * 0.035),
  };
}

// ---------- Fighter factory ----------
function createFighter(x, color, name, isAI) {
  return {
    x, airY: 0, vy: 0, vx: 0,
    facing: isAI ? -1 : 1,
    onGround: true,
    state: 'idle', // idle | walk | jump | punch | kick | block | hitstun | ko
    stateT: 0,
    hasHit: false,
    health: MAX_HEALTH,
    maxHealth: MAX_HEALTH,
    color, name, isAI,
    cooldownPunch: 0, cooldownKick: 0,
    animPhase: Math.random() * 10,
    flashTimer: 0,
    bodyTilt: 0,
    // AI-only scratch state
    aiThinkTimer: 0,
  };
}

let player, opponent, streak = 0, best = Number(localStorage.getItem('stickfighter_best') || 0);
bestLabel.textContent = `Best: ${best}`;
let running = false;
let banner = null; // { text, timer }
let particles = [];

function newOpponentForStreak(s) {
  const tierIndex = Math.min(OPPONENT_TIERS.length - 1, Math.floor(s / 2));
  const o = createFighter(arenaMaxX() - 20, '#ff6b6b', OPPONENT_TIERS[tierIndex], true);
  const diff = difficultyForStreak(s);
  o.maxHealth = Math.round(MAX_HEALTH * diff.healthMult);
  o.health = o.maxHealth;
  o.diff = diff;
  return o;
}

function resetPositions() {
  player.x = arenaMinX() + 20;
  opponent.x = arenaMaxX() - 20;
  player.airY = 0; player.vy = 0; player.vx = 0; player.state = 'idle'; player.stateT = 0;
  opponent.airY = 0; opponent.vy = 0; opponent.vx = 0; opponent.state = 'idle'; opponent.stateT = 0;
}

function startMatch() {
  // A key/touch button held at the moment of KO (or still held when Restart is clicked) would
  // otherwise carry straight into the new match, since nothing else ever clears this object.
  keys.left = false; keys.right = false; keys.jump = false;
  keys.punch = false; keys.kick = false; keys.block = false;
  streak = 0;
  player = createFighter(arenaMinX() + 20, '#3bb0ff', myName || 'You', false);
  opponent = newOpponentForStreak(0);
  playerNameLabel.textContent = player.name;
  opponentNameLabel.textContent = opponent.name;
  updateHpBars();
  streakLabel.textContent = `Streak: ${streak}`;
  particles = [];
  running = true;
  banner = { text: 'Fight!', timer: ROUND_BANNER_MS };
  playSound('roundStart');
}

function nextRound() {
  streak++;
  streakLabel.textContent = `Streak: ${streak}`;
  player.health = Math.min(player.maxHealth, player.health + ROUND_WIN_HEAL);
  opponent = newOpponentForStreak(streak);
  opponentNameLabel.textContent = opponent.name;
  resetPositions();
  updateHpBars();
  banner = { text: `Round ${streak + 1} — ${opponent.name}!`, timer: ROUND_BANNER_MS };
  playSound('roundStart');
}

function endMatch() {
  running = false;
  if (streak > best) {
    best = streak;
    try { localStorage.setItem('stickfighter_best', String(best)); } catch {}
    bestLabel.textContent = `Best: ${best}`;
  }
  gameoverText.textContent = player.health <= 0 ? 'Knocked out!' : 'Fight over';
  gameoverSub.textContent = `You beat ${streak} opponent${streak === 1 ? '' : 's'} in a row.`;
  gameoverOverlay.classList.remove('hidden');
  send({ type: 'arcade-submit-score', score: streak });
  playSound('gameOver');
}

function updateHpBars() {
  playerHpFill.style.width = `${Math.max(0, (player.health / player.maxHealth) * 100)}%`;
  opponentHpFill.style.width = `${Math.max(0, (opponent.health / opponent.maxHealth) * 100)}%`;
}

// ---------- Input ----------
const keys = { left: false, right: false, jump: false, punch: false, kick: false, block: false };

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyA': case 'ArrowLeft': keys.left = true; break;
    case 'KeyD': case 'ArrowRight': keys.right = true; break;
    case 'KeyW': case 'ArrowUp': case 'Space': keys.jump = true; e.preventDefault(); break;
    case 'KeyJ': keys.punch = true; break;
    case 'KeyK': keys.kick = true; break;
    case 'KeyL': keys.block = true; break;
  }
});
window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyA': case 'ArrowLeft': keys.left = false; break;
    case 'KeyD': case 'ArrowRight': keys.right = false; break;
    case 'KeyW': case 'ArrowUp': case 'Space': keys.jump = false; break;
    case 'KeyJ': keys.punch = false; break;
    case 'KeyK': keys.kick = false; break;
    case 'KeyL': keys.block = false; break;
  }
});

// Touch: joystick drag for move/jump, buttons for punch/kick/block
if (isTouchDevice) {
  touchControlsEl.classList.remove('hidden');
  let joyActive = false, joyStartX = 0, joyStartY = 0;
  const JOY_RADIUS = 50;
  touchJoystickEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyActive = true;
    const rect = touchJoystickEl.getBoundingClientRect();
    joyStartX = rect.left + rect.width / 2;
    joyStartY = rect.top + rect.height / 2;
  }, { passive: false });
  function handleJoyMove(e) {
    if (!joyActive) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    let dx = t.clientX - joyStartX;
    let dy = t.clientY - joyStartY;
    const dist = Math.min(JOY_RADIUS, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * dist, ky = Math.sin(angle) * dist;
    touchJoystickKnobEl.style.transform = `translate(${kx}px, ${ky}px)`;
    keys.left = dx < -15;
    keys.right = dx > 15;
    keys.jump = dy < -30;
  }
  touchJoystickEl.addEventListener('touchmove', handleJoyMove, { passive: false });
  function endJoy(e) {
    e.preventDefault();
    joyActive = false;
    keys.left = false; keys.right = false; keys.jump = false;
    touchJoystickKnobEl.style.transform = 'translate(0, 0)';
  }
  touchJoystickEl.addEventListener('touchend', endJoy, { passive: false });
  touchJoystickEl.addEventListener('touchcancel', endJoy, { passive: false });

  function bindTouchBtn(el, onDown, onUp) {
    el.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); if (onUp) onUp(); }, { passive: false });
    el.addEventListener('touchcancel', (e) => { e.preventDefault(); if (onUp) onUp(); }, { passive: false });
  }
  bindTouchBtn(touchPunchBtn, () => { keys.punch = true; }, () => { keys.punch = false; });
  bindTouchBtn(touchKickBtn, () => { keys.kick = true; }, () => { keys.kick = false; });
  bindTouchBtn(touchBlockBtn, () => { keys.block = true; }, () => { keys.block = false; });
}

// ---------- Actions ----------
function tryJump(f) {
  if (f.onGround && (f.state === 'idle' || f.state === 'walk')) {
    f.vy = JUMP_VELOCITY;
    f.onGround = false;
    f.state = 'jump';
    f.stateT = 0;
    playSound('jump');
  }
}

function tryPunch(f) {
  if (f.cooldownPunch > 0) return;
  if (!(f.state === 'idle' || f.state === 'walk')) return;
  f.state = 'punch';
  f.stateT = 0;
  f.hasHit = false;
  f.cooldownPunch = PUNCH_COOLDOWN;
}

function tryKick(f) {
  if (f.cooldownKick > 0) return;
  if (!(f.state === 'idle' || f.state === 'walk')) return;
  f.state = 'kick';
  f.stateT = 0;
  f.hasHit = false;
  f.cooldownKick = KICK_COOLDOWN;
}

function setBlocking(f, held) {
  if (held && (f.state === 'idle' || f.state === 'walk')) {
    f.state = 'block';
    f.stateT = 0;
  } else if (!held && f.state === 'block') {
    f.state = 'idle';
    f.stateT = 0;
  }
}

function applyHit(defender, attacker, type) {
  const blocked = defender.state === 'block';
  let dmg = type === 'punch' ? PUNCH_DAMAGE : KICK_DAMAGE;
  if (blocked) {
    dmg = Math.round(dmg * (1 - BLOCK_DAMAGE_REDUCTION));
    playSound('block');
  } else {
    playSound(type === 'punch' ? 'punchHit' : 'kickHit');
  }
  defender.health = Math.max(0, defender.health - dmg);
  defender.vx = attacker.facing * (type === 'punch' ? KNOCKBACK_PUNCH : KNOCKBACK_KICK);
  defender.flashTimer = 120;
  spawnHitParticles(defender.x, groundY() - defender.airY - TORSO_LEN * 0.7, blocked);
  if (!blocked) {
    if (defender.health <= 0) {
      defender.state = 'ko';
      defender.stateT = 0;
      playSound('ko');
    } else {
      defender.state = 'hitstun';
      defender.stateT = 0;
      playSound('grunt');
    }
  }
  updateHpBars();
}

function tryLandHit(attacker, defender, type) {
  if (attacker.hasHit) return;
  const dx = (defender.x - attacker.x) * attacker.facing;
  const range = type === 'punch' ? PUNCH_RANGE : KICK_RANGE;
  if (dx > -10 && dx < range && defender.state !== 'ko') {
    attacker.hasHit = true;
    applyHit(defender, attacker, type);
  }
}

// ---------- Particles ----------
function spawnHitParticles(x, y, blocked) {
  const count = blocked ? 5 : 8;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 120;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 260 + Math.random() * 140,
      maxLife: 400,
      color: blocked ? '#7ac8ff' : '#ffd93d',
    });
  }
}

function updateParticles(dtMs) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dtMs;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * (dtMs / 1000);
    p.y += p.vy * (dtMs / 1000);
    p.vy += 700 * (dtMs / 1000);
  }
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ---------- AI ----------
function updateAI(ai, target, dtMs) {
  if (ai.state === 'hitstun' || ai.state === 'ko') return;
  ai.aiThinkTimer -= dtMs;
  const dx = target.x - ai.x;
  const dist = Math.abs(dx);
  const dir = Math.sign(dx) || ai.facing;
  const diff = ai.diff;

  if (dist > KICK_RANGE + 30) {
    ai.vx = dir * MOVE_SPEED * diff.speedMult;
    if (ai.state === 'idle') ai.state = 'walk';
  } else {
    ai.vx = 0;
    if (ai.state === 'walk') ai.state = 'idle';
  }

  if (ai.aiThinkTimer > 0) return;
  ai.aiThinkTimer = 260 * diff.reactionMult + Math.random() * 200;

  const targetAttacking = target.state === 'punch' || target.state === 'kick';
  if (targetAttacking && Math.random() < diff.blockChance) {
    setBlocking(ai, true);
    setTimeout(() => { if (ai.state === 'block') setBlocking(ai, false); }, 300);
    return;
  }
  if (ai.state === 'block' && !targetAttacking) setBlocking(ai, false);

  if (dist <= KICK_RANGE + 30 && Math.random() < diff.aggressiveness) {
    if (dist <= PUNCH_RANGE + 10 && ai.cooldownPunch <= 0 && Math.random() < 0.55) tryPunch(ai);
    else if (ai.cooldownKick <= 0) tryKick(ai);
    else if (ai.cooldownPunch <= 0) tryPunch(ai);
  } else if (dist <= KICK_RANGE + 30 && Math.random() < 0.03) {
    tryJump(ai);
  }
}

// ---------- Physics + state update ----------
function updateFighterPhysics(f, dtMs) {
  const dt = dtMs / 1000;
  // Whether vx came from held-movement input (idle/walk/jump) or knockback from a landed hit
  // (attack/hitstun recovery), it's integrated the same way and decays via the same FRICTION
  // multiplier below — no state-based branch needed here.
  f.x += f.vx * dt;
  f.vx *= FRICTION;
  f.x = Math.max(arenaMinX(), Math.min(arenaMaxX(), f.x));

  if (!f.onGround) {
    f.vy -= GRAVITY * dt;
    f.airY += f.vy * dt;
    if (f.airY <= 0) {
      f.airY = 0;
      f.vy = 0;
      f.onGround = true;
      if (f.state === 'jump') f.state = 'idle';
    }
  }

  if (f.flashTimer > 0) f.flashTimer -= dtMs;
  if (f.cooldownPunch > 0) f.cooldownPunch -= dtMs;
  if (f.cooldownKick > 0) f.cooldownKick -= dtMs;

  f.stateT += dtMs;
  f.animPhase += dtMs * (f.state === 'walk' ? 0.012 : 0.004);

  switch (f.state) {
    case 'punch':
      if (f.stateT >= PUNCH_ACTIVE[0] && f.stateT <= PUNCH_ACTIVE[1]) {
        tryLandHit(f, f === player ? opponent : player, 'punch');
      }
      if (f.stateT >= PUNCH_DURATION) { f.state = 'idle'; f.stateT = 0; }
      break;
    case 'kick':
      if (f.stateT >= KICK_ACTIVE[0] && f.stateT <= KICK_ACTIVE[1]) {
        tryLandHit(f, f === player ? opponent : player, 'kick');
      }
      if (f.stateT >= KICK_DURATION) { f.state = 'idle'; f.stateT = 0; }
      break;
    case 'hitstun':
      if (f.stateT >= HITSTUN_DURATION) { f.state = 'idle'; f.stateT = 0; }
      break;
    default:
      break;
  }

  // Face the opponent while free to (not mid-swing/hitstun/ko so a hit can't spin them around)
  if (f.state === 'idle' || f.state === 'walk' || f.state === 'jump' || f.state === 'block') {
    const other = f === player ? opponent : player;
    f.facing = other.x >= f.x ? 1 : -1;
  }

  // Smooth body tilt toward the state's resting lean
  let targetTilt = 0;
  if (f.state === 'hitstun') targetTilt = -f.facing * 0.22;
  else if (f.state === 'ko') targetTilt = -f.facing * 1.55;
  f.bodyTilt += (targetTilt - f.bodyTilt) * Math.min(1, dtMs / 160);
}

function handlePlayerInput() {
  if (!running || banner) { player.vx = 0; return; }
  if (player.state === 'idle' || player.state === 'walk') {
    let dir = 0;
    if (keys.left) dir -= 1;
    if (keys.right) dir += 1;
    player.vx = dir * MOVE_SPEED;
    player.state = dir !== 0 ? 'walk' : 'idle';
  }
  if (keys.jump) tryJump(player);
  if (keys.block) setBlocking(player, true);
  else if (player.state === 'block') setBlocking(player, false);
  if (keys.punch) tryPunch(player);
  if (keys.kick) tryKick(player);
}

function update(dtMs) {
  if (banner) {
    banner.timer -= dtMs;
    if (banner.timer <= 0) banner = null;
    updateParticles(dtMs);
    return;
  }
  if (!running) return;

  handlePlayerInput();
  updateAI(opponent, player, dtMs);
  updateFighterPhysics(player, dtMs);
  updateFighterPhysics(opponent, dtMs);
  updateParticles(dtMs);

  if (opponent.state === 'ko' && opponent.stateT >= KO_DISPLAY_MS) {
    nextRound();
  } else if (player.state === 'ko' && player.stateT >= KO_DISPLAY_MS) {
    endMatch();
  }
}

// ---------- Rendering ----------
function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#0d1622');
  g.addColorStop(1, '#182a3b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, groundY());
  ctx.lineTo(canvas.width, groundY());
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, groundY(), canvas.width, canvas.height - groundY());
}

function limbEnd(ox, oy, angle, len) {
  return { x: ox + Math.sin(angle) * len, y: oy + Math.cos(angle) * len };
}

function drawLimb(ox, oy, angle, len) {
  const e = limbEnd(ox, oy, angle, len);
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(e.x, e.y);
  ctx.stroke();
  return e;
}

function easeOutIn(p) {
  // Rises fast to 1 then eases back to a resting extension — used for punch/kick reach.
  if (p < 0.4) return Math.min(1, p / 0.4);
  return Math.max(0, 1 - (p - 0.4) / 0.6);
}

function drawFighter(f) {
  const footY = groundY() - f.airY;
  const hipWorldY = footY - (THIGH + SHIN) + Math.sin(f.animPhase) * (f.state === 'idle' ? 1.5 : 0);

  ctx.save();
  ctx.translate(f.x, hipWorldY);
  ctx.rotate(f.bodyTilt);
  ctx.strokeStyle = f.flashTimer > 0 ? '#ffffff' : f.color;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';

  let legSwingL = 0, legSwingR = 0, armSwingL = 0.06, armSwingR = -0.06, legForward = 0, armForward = 0, blockPose = false;

  switch (f.state) {
    case 'walk':
      legSwingL = Math.sin(f.animPhase) * 0.7;
      legSwingR = -Math.sin(f.animPhase) * 0.7;
      armSwingL = -Math.sin(f.animPhase) * 0.55;
      armSwingR = Math.sin(f.animPhase) * 0.55;
      break;
    case 'jump':
      legSwingL = f.vy > 0 ? -0.35 : 0.3;
      legSwingR = f.vy > 0 ? -0.2 : 0.15;
      armSwingL = -0.7; armSwingR = 0.7;
      break;
    case 'punch':
      armForward = easeOutIn(f.stateT / PUNCH_DURATION);
      break;
    case 'kick':
      legForward = easeOutIn(f.stateT / KICK_DURATION);
      armSwingL = 0.3; armSwingR = -0.3;
      break;
    case 'block':
      blockPose = true;
      break;
    case 'hitstun':
      armSwingL = 0.5; armSwingR = -0.5;
      break;
    case 'ko':
      legSwingL = 0.3; legSwingR = -0.3;
      armSwingL = 0.6; armSwingR = 0.6;
      break;
    default:
      break;
  }

  // Legs (angle measured from straight-down; positive tips toward local +x). One segment per
  // leg — during a kick, the kicking leg replaces its normal swing angle with the extending
  // kick angle instead of drawing a third overlapping leg.
  if (f.state === 'kick') {
    drawLimb(0, 0, -legSwingR, THIGH + SHIN);
    const kickAngle = f.facing * (0.3 + legForward * 1.35);
    drawLimb(0, 0, kickAngle, (THIGH + SHIN) * 0.95);
  } else {
    drawLimb(0, 0, legSwingL, THIGH + SHIN);
    drawLimb(0, 0, legSwingR, THIGH + SHIN);
  }

  // Torso
  const shoulderY = -TORSO_LEN;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, shoulderY);
  ctx.stroke();

  // Arms
  if (blockPose) {
    const guardAngle = f.facing * 1.05;
    drawLimb(0, shoulderY, guardAngle, UPPER_ARM_LEN * 0.85);
    drawLimb(0, shoulderY, guardAngle * 0.75, UPPER_ARM_LEN * 0.85);
  } else if (f.state === 'punch') {
    const punchAngle = f.facing * (0.15 + armForward * 1.35);
    drawLimb(0, shoulderY, punchAngle, UPPER_ARM_LEN);
    drawLimb(0, shoulderY, armSwingR, UPPER_ARM_LEN);
  } else {
    drawLimb(0, shoulderY, armSwingL, UPPER_ARM_LEN);
    drawLimb(0, shoulderY, armSwingR, UPPER_ARM_LEN);
  }

  // Head
  const headY = shoulderY - NECK_LEN - HEAD_R;
  ctx.beginPath();
  ctx.arc(0, headY, HEAD_R, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawBanner() {
  if (!banner) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, canvas.height / 2 - 50, canvas.width, 100);
  ctx.fillStyle = '#eaf6ff';
  ctx.fillText(banner.text, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

function render() {
  drawBackground();
  if (player) drawFighter(player);
  if (opponent) drawFighter(opponent);
  drawParticles();
  drawBanner();
}

// ---------- Main loop ----------
let lastT = 0;
function loop(t) {
  const dt = lastT ? Math.min(50, t - lastT) : 16;
  lastT = t;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- Sound (synthesized, no audio files — same approach as this app's other minigames) ----------
let audioCtx = null;
let soundOn = localStorage.getItem('stickfighter_sound_muted') !== '1';
function updateSoundBtn() { soundToggleBtn.textContent = soundOn ? '🔊' : '🔇'; }
updateSoundBtn();
soundToggleBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  try { localStorage.setItem('stickfighter_sound_muted', soundOn ? '0' : '1'); } catch {}
  updateSoundBtn();
});

function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
}

function playTone(freq, duration, type, gain, sweepTo) {
  if (!soundOn || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (sweepTo) osc.frequency.linearRampToValueAtTime(sweepTo, audioCtx.currentTime + duration);
  g.gain.setValueAtTime(gain || 0.15, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(g).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playNoise(duration, gain) {
  if (!soundOn || !audioCtx) return;
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(gain || 0.2, audioCtx.currentTime);
  src.connect(g).connect(audioCtx.destination);
  src.start();
}

function playSound(name) {
  if (!soundOn) return;
  ensureAudio();
  if (!audioCtx) return;
  switch (name) {
    case 'punchHit': playNoise(0.08, 0.25); playTone(180, 0.08, 'square', 0.15); break;
    case 'kickHit': playNoise(0.14, 0.32); playTone(110, 0.14, 'square', 0.2); break;
    case 'block': playTone(650, 0.09, 'triangle', 0.18); break;
    case 'grunt': playTone(220, 0.12, 'sawtooth', 0.1, 140); break;
    case 'jump': playTone(400, 0.1, 'sine', 0.08, 600); break;
    case 'ko': playTone(300, 0.5, 'sawtooth', 0.15, 60); break;
    case 'roundStart': playTone(500, 0.12, 'sine', 0.12, 800); break;
    case 'gameOver': playTone(400, 0.6, 'triangle', 0.12, 120); break;
    default: break;
  }
}

// ---------- Leaderboard ----------
// Built with createElement/textContent below, not innerHTML templating, so no escaping helper
// is needed here the way fighterplane.js's identical-looking one is.
function renderLeaderboard(scores) {
  leaderboardListEl.innerHTML = '';
  if (!scores || !scores.length) {
    const li = document.createElement('li');
    li.textContent = 'No scores yet — fight a round!';
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
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !leaderboardOverlay.classList.contains('hidden')) leaderboardCloseBtn.click();
});

// ---------- WebSocket (leaderboard only) ----------
let ws;
function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);
  ws.addEventListener('open', () => send({ type: 'arcade-join', code: roomCode, name: myName, game: 'stickfighter' }));
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
connect();
window.addEventListener('beforeunload', () => send({ type: 'arcade-leave' }));

// ---------- Menu / restart ----------
startBtn.addEventListener('click', () => {
  ensureAudio();
  menuEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  canvas.classList.remove('hidden');
  startMatch();
});

restartBtn.addEventListener('click', () => {
  gameoverOverlay.classList.add('hidden');
  startMatch();
});
