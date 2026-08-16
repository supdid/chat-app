// ---------- Room/session setup (same ?room=&name= pattern as the other minigames — this page
// opens its own WebSocket connection, bypassing join-server/ws.profile entirely). ----------
const mpParams = new URLSearchParams(location.search);
const roomCode = mpParams.get('room');
const myName = (mpParams.get('name') || 'Player').slice(0, 30);

const backLink = document.getElementById('back-link');
if (roomCode) backLink.href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;

const scoreLabel = document.getElementById('score-label');
const bestLabel = document.getElementById('best-label');
const newGameBtn = document.getElementById('new-game-btn');
const menuBtnGame = document.getElementById('menu-btn-game');
const boardEl = document.getElementById('board');
const gameoverOverlay = document.getElementById('gameover-overlay');
const gameoverText = document.getElementById('gameover-text');
const restartBtn = document.getElementById('restart-btn');
const playersOverlay = document.getElementById('players-overlay');
const playersCloseBtn = document.getElementById('players-close-btn');
const leaderboardListEl = document.getElementById('leaderboard-list');

let grid, score, best, running;

function emptyGrid() {
  return [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]];
}

function emptyCells() {
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (grid[r][c] === null) cells.push({ r, c });
  return cells;
}

function spawnTile() {
  const cells = emptyCells();
  if (!cells.length) return;
  const { r, c } = cells[Math.floor(Math.random() * cells.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function slideRow(row) {
  const compacted = row.filter((v) => v !== null);
  const merged = [];
  let gained = 0;
  for (let i = 0; i < compacted.length; i++) {
    if (i < compacted.length - 1 && compacted[i] === compacted[i + 1]) {
      const val = compacted[i] * 2;
      merged.push(val);
      gained += val;
      i++;
    } else {
      merged.push(compacted[i]);
    }
  }
  while (merged.length < 4) merged.push(null);
  const moved = merged.some((v, i) => v !== row[i]);
  return { row: merged, gained, moved };
}

function getLine(dir, index) {
  if (dir === 'left') return [grid[index][0], grid[index][1], grid[index][2], grid[index][3]];
  if (dir === 'right') return [grid[index][3], grid[index][2], grid[index][1], grid[index][0]];
  if (dir === 'up') return [grid[0][index], grid[1][index], grid[2][index], grid[3][index]];
  return [grid[3][index], grid[2][index], grid[1][index], grid[0][index]];
}

function setLine(dir, index, line) {
  if (dir === 'left') { for (let i = 0; i < 4; i++) grid[index][i] = line[i]; }
  else if (dir === 'right') { for (let i = 0; i < 4; i++) grid[index][3 - i] = line[i]; }
  else if (dir === 'up') { for (let i = 0; i < 4; i++) grid[i][index] = line[i]; }
  else { for (let i = 0; i < 4; i++) grid[3 - i][index] = line[i]; }
}

function hasMovesLeft() {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === null) return true;
      if (c < 3 && grid[r][c] === grid[r][c + 1]) return true;
      if (r < 3 && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}

const TILE_COLORS = {
  2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b',
  128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e',
};

function render() {
  boardEl.innerHTML = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = grid[r][c];
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (val) {
        cell.textContent = val;
        cell.style.background = TILE_COLORS[val] || '#3c3a32';
        cell.style.color = val <= 4 ? '#5a5248' : '#f9f6f2';
        cell.style.fontSize = val >= 1000 ? '1.3rem' : val >= 100 ? '1.6rem' : '2rem';
      }
      boardEl.appendChild(cell);
    }
  }
  scoreLabel.textContent = `Score: ${score}`;
}

function move(dir) {
  if (!running) return;
  let anyMoved = false;
  let totalGained = 0;
  for (let i = 0; i < 4; i++) {
    const { row, gained, moved } = slideRow(getLine(dir, i));
    if (moved) anyMoved = true;
    totalGained += gained;
    setLine(dir, i, row);
  }
  if (!anyMoved) return;
  score += totalGained;
  spawnTile();
  render();
  if (!hasMovesLeft()) gameOver();
}

function startGame() {
  grid = emptyGrid();
  score = 0;
  running = true;
  gameoverOverlay.classList.add('hidden');
  spawnTile();
  spawnTile();
  render();
}

function gameOver() {
  running = false;
  if (score > best) {
    best = score;
    bestLabel.textContent = `Best: ${best}`;
  }
  gameoverText.textContent = `Game over! Score: ${score}`;
  gameoverOverlay.classList.remove('hidden');
  send({ type: 'arcade-submit-score', score });
}

newGameBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

document.addEventListener('keydown', (e) => {
  const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  const dir = map[e.key];
  if (dir) { e.preventDefault(); move(dir); }
});

let touchStartX = null, touchStartY = null;
boardEl.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
});
boardEl.addEventListener('touchend', (e) => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return; // ignore taps
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
  else move(dy > 0 ? 'down' : 'up');
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
  ws.addEventListener('open', () => send({ type: 'arcade-join', code: roomCode, name: myName, game: '2048' }));
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
startGame();
connect();
