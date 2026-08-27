// ---------- Room/session setup (same ?room=&name= pattern as the other minigames — this page
// opens its own WebSocket connection, bypassing join-server/ws.profile entirely). ----------
const mpParams = new URLSearchParams(location.search);
const roomCode = mpParams.get('room');
const myName = (mpParams.get('name') || 'Player').slice(0, 30);

const backLink = document.getElementById('back-link');
if (roomCode) backLink.href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;

const scoreLabel = document.getElementById('score-label');
const bestLabel = document.getElementById('best-label');
const menuBtnGame = document.getElementById('menu-btn-game');
const board = document.getElementById('board');
const ctx = board.getContext('2d');
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const gameoverOverlay = document.getElementById('gameover-overlay');
const gameoverText = document.getElementById('gameover-text');
const restartBtn = document.getElementById('restart-btn');
const playersOverlay = document.getElementById('players-overlay');
const playersCloseBtn = document.getElementById('players-close-btn');
const leaderboardListEl = document.getElementById('leaderboard-list');

const GRID = 20;
const CELL = board.width / GRID;
const TICK_MS = 120;

let snake, direction, nextDirection, food, score, best, running, tickTimer;

function resetState() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  direction = 'right';
  nextDirection = 'right';
  score = 0;
  placeFood();
  scoreLabel.textContent = `Score: ${score}`;
}

function placeFood() {
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
  food = pos;
}

function draw() {
  ctx.fillStyle = '#0d1826';
  ctx.fillRect(0, 0, board.width, board.height);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(food.x * CELL, food.y * CELL, CELL - 1, CELL - 1);
  snake.forEach((s, i) => {
    ctx.fillStyle = i === 0 ? '#34e89e' : '#3b9dff';
    ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
  });
}

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

function setDirection(dir) {
  if (!running) return;
  if (OPPOSITE[dir] === direction) return; // no instant 180
  nextDirection = dir;
}

function tick() {
  direction = nextDirection;
  const head = { ...snake[0] };
  if (direction === 'up') head.y -= 1;
  else if (direction === 'down') head.y += 1;
  else if (direction === 'left') head.x -= 1;
  else head.x += 1;

  const hitWall = head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID;
  const willGrow = head.x === food.x && head.y === food.y;
  // When not growing, the tail cell vacates this tick, so moving into it is legal.
  const bodyToCheck = willGrow ? snake : snake.slice(0, -1);
  const hitSelf = bodyToCheck.some((s) => s.x === head.x && s.y === head.y);
  if (hitWall || hitSelf) {
    gameOver();
    return;
  }

  snake.unshift(head);
  if (willGrow) {
    score += 1;
    scoreLabel.textContent = `Score: ${score}`;
    placeFood();
  } else {
    snake.pop();
  }
  draw();
}

function startGame() {
  resetState();
  running = true;
  startOverlay.classList.add('hidden');
  gameoverOverlay.classList.add('hidden');
  draw();
  clearInterval(tickTimer);
  tickTimer = setInterval(tick, TICK_MS);
}

function gameOver() {
  running = false;
  clearInterval(tickTimer);
  if (score > best) {
    best = score;
    bestLabel.textContent = `Best: ${best}`;
  }
  gameoverText.textContent = `Game over! Score: ${score}`;
  gameoverOverlay.classList.remove('hidden');
  send({ type: 'arcade-submit-score', score });
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

document.addEventListener('keydown', (e) => {
  const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  const dir = map[e.key];
  if (dir) { e.preventDefault(); setDirection(dir); }
});

document.getElementById('touch-up').addEventListener('click', () => setDirection('up'));
document.getElementById('touch-down').addEventListener('click', () => setDirection('down'));
document.getElementById('touch-left').addEventListener('click', () => setDirection('left'));
document.getElementById('touch-right').addEventListener('click', () => setDirection('right'));

// Basic swipe support for mobile.
let touchStartX = null, touchStartY = null;
board.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
});
board.addEventListener('touchend', (e) => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  // Found by the Snake/2048 correctness audit: with no minimum-movement threshold, a stationary
  // tap (dx=0, dy=0 — tapping to focus, a slight tremor, a mistap) fell through to the else branch
  // and `0 > 0` is false, so it silently always resolved to "turn up" — 2048.js already guards
  // this exact scenario ("ignore taps"), Snake was just missing the same check.
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? 'right' : 'left');
  else setDirection(dy > 0 ? 'down' : 'up');
  touchStartX = null;
  touchStartY = null;
});

// ---------- Leaderboard (persisted per room, shared across everyone who plays here) ----------
function renderLeaderboard(scores) {
  leaderboardListEl.innerHTML = '';
  if (!scores.length) {
    const li = document.createElement('li');
    li.textContent = 'No scores yet — play a round!';
    leaderboardListEl.appendChild(li);
    return;
  }
  scores.forEach((s, i) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = `${i + 1}. ${s.name}`;
    const sc = document.createElement('span');
    sc.className = 'score';
    sc.textContent = s.score;
    li.append(name, sc);
    leaderboardListEl.appendChild(li);
  });
}

menuBtnGame.addEventListener('click', () => {
  playersOverlay.classList.remove('hidden');
  send({ type: 'arcade-leaderboard' });
});
playersCloseBtn.addEventListener('click', () => playersOverlay.classList.add('hidden'));
playersOverlay.addEventListener('click', (e) => {
  if (e.target === playersOverlay) playersOverlay.classList.add('hidden');
});
// Same Escape-to-close fix already applied to every other overlay in this app this session.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !playersOverlay.classList.contains('hidden')) playersCloseBtn.click();
});

// ---------- WebSocket ----------
let ws;
function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);
  ws.addEventListener('open', () => send({ type: 'arcade-join', code: roomCode, name: myName, game: 'snake' }));
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

best = 0;
resetState();
draw();
connect();
