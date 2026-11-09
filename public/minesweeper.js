// ---------- Room/session setup (same ?room=&name= pattern as the other minigames) ----------
const params = new URLSearchParams(location.search);
const roomCode = params.get('room');
const myName = (params.get('name') || 'Player').slice(0, 30);
const backLink = document.getElementById('back-link');
if (roomCode) backLink.href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;

const LEVELS = {
  easy: { rows: 9, cols: 9, mines: 10, label: 'Easy' },
  medium: { rows: 16, cols: 16, mines: 40, label: 'Medium' },
  hard: { rows: 16, cols: 30, mines: 99, label: 'Hard' },
};
// Leaderboard scores are "higher is better", so a time is stored as 100000 − tenths of a second.
const SCORE_BASE = 100000;

const boardEl = document.getElementById('board');
const minesLeftEl = document.getElementById('mines-left');
const timerEl = document.getElementById('timer');
const faceBtn = document.getElementById('face-btn');
const flagModeBtn = document.getElementById('flag-mode-btn');
const resultEl = document.getElementById('result');
const leaderboardEl = document.getElementById('leaderboard');
const lbLevelEl = document.getElementById('lb-level');

let level = 'easy';
try { if (LEVELS[localStorage.getItem('valk-ms-level')]) level = localStorage.getItem('valk-ms-level'); } catch {}
let cells = []; // { mine, open, flag, n, el }
let rows, cols, mineCount, started, over, startTime, timerId, flagMode = false, opened;

function idx(r, c) { return r * cols + c; }
function neighbors(i) {
  const r = Math.floor(i / cols), c = i % cols, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(idx(rr, cc));
  }
  return out;
}

function fitCellSize() {
  const avail = Math.min(window.innerWidth - 32, 960) - 12;
  const size = Math.max(19, Math.min(34, Math.floor((avail - (cols - 1) * 2) / cols)));
  boardEl.style.setProperty('--size', `${size}px`);
}

function newGame() {
  ({ rows, cols, mines: mineCount } = LEVELS[level]);
  // On a narrow phone, stand the wide Hard board up on its side so it fits without scrolling.
  if (cols > rows && window.innerWidth < 600) [rows, cols] = [cols, rows];
  started = false;
  over = false;
  opened = 0;
  clearInterval(timerId);
  timerEl.textContent = '⏱ 0.0';
  faceBtn.textContent = '🙂';
  resultEl.classList.add('hidden');
  document.querySelectorAll('.level').forEach((b) => {
    const on = b.dataset.level === level;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  lbLevelEl.textContent = LEVELS[level].label;
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--size))`;
  fitCellSize();
  cells = [];
  for (let i = 0; i < rows * cols; i++) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'cell';
    el.dataset.i = i;
    el.setAttribute('aria-label', 'Hidden square');
    boardEl.appendChild(el);
    cells.push({ mine: false, open: false, flag: false, n: 0, el });
  }
  updateMinesLeft();
  requestLeaderboard();
}

// Mines are placed on the first click, never on or next to it — so the first dig always opens space.
function placeMines(safeIndex) {
  const banned = new Set([safeIndex, ...neighbors(safeIndex)]);
  const spots = [];
  for (let i = 0; i < cells.length; i++) if (!banned.has(i)) spots.push(i);
  for (let k = 0; k < mineCount; k++) {
    const j = k + Math.floor(Math.random() * (spots.length - k));
    [spots[k], spots[j]] = [spots[j], spots[k]];
    cells[spots[k]].mine = true;
  }
  cells.forEach((cell, i) => { cell.n = neighbors(i).filter((j) => cells[j].mine).length; });
}

function startTimer() {
  started = true;
  startTime = performance.now();
  timerId = setInterval(() => { timerEl.textContent = `⏱ ${elapsed().toFixed(1)}`; }, 100);
}
function elapsed() { return (performance.now() - startTime) / 1000; }

function updateMinesLeft() {
  const flags = cells.filter((c) => c.flag).length;
  minesLeftEl.textContent = `💣 ${mineCount - flags}`;
}

function render(i) {
  const cell = cells[i];
  const el = cell.el;
  el.className = 'cell';
  if (cell.open) {
    el.classList.add('open');
    if (cell.mine) { el.classList.add('mine'); el.textContent = '💥'; el.setAttribute('aria-label', 'Mine'); return; }
    el.textContent = cell.n || '';
    if (cell.n) el.classList.add(`n${cell.n}`);
    el.setAttribute('aria-label', cell.n ? `${cell.n} mines nearby` : 'Empty');
  } else {
    el.textContent = cell.flag ? '🚩' : '';
    el.setAttribute('aria-label', cell.flag ? 'Flagged' : 'Hidden square');
  }
}

function dig(i) {
  if (over) return;
  const cell = cells[i];
  if (cell.flag) return;
  if (!started) { placeMines(i); startTimer(); }
  if (cell.open) { chord(i); return; }
  if (cell.mine) { cell.open = true; render(i); lose(i); return; }
  // Flood-fill open the empty area.
  const stack = [i];
  while (stack.length) {
    const j = stack.pop();
    const c = cells[j];
    if (c.open || c.flag) continue;
    c.open = true;
    opened++;
    render(j);
    if (c.n === 0) for (const k of neighbors(j)) if (!cells[k].open) stack.push(k);
  }
  checkWin();
}

// Clicking an opened number whose flags are all placed digs every other neighbour.
function chord(i) {
  const cell = cells[i];
  if (!cell.n) return;
  const around = neighbors(i);
  if (around.filter((j) => cells[j].flag).length !== cell.n) return;
  for (const j of around) if (!cells[j].open && !cells[j].flag) { dig(j); if (over) return; }
}

function toggleFlag(i) {
  if (over) return;
  const cell = cells[i];
  if (cell.open) return;
  cell.flag = !cell.flag;
  render(i);
  updateMinesLeft();
}

function lose(hit) {
  over = true;
  clearInterval(timerId);
  faceBtn.textContent = '😵';
  cells.forEach((c, i) => {
    if (c.mine && !c.flag && i !== hit) { c.el.textContent = '💣'; c.el.classList.add('open'); }
    if (!c.mine && c.flag) c.el.classList.add('wrong');
  });
  resultEl.textContent = '💥 Boom! Tap 🙂 to try again.';
  resultEl.className = 'result lost';
}

function checkWin() {
  if (over || opened !== rows * cols - mineCount) return;
  over = true;
  clearInterval(timerId);
  const secs = Math.round(elapsed() * 10) / 10;
  timerEl.textContent = `⏱ ${secs.toFixed(1)}`;
  faceBtn.textContent = '😎';
  cells.forEach((c, i) => { if (c.mine && !c.flag) { c.flag = true; render(i); } });
  updateMinesLeft();
  resultEl.textContent = `🎉 Cleared ${LEVELS[level].label} in ${secs.toFixed(1)} seconds!`;
  resultEl.className = 'result';
  const score = Math.max(1, SCORE_BASE - Math.round(secs * 10));
  send({ type: 'arcade-submit-score', score });
}

// ---------- Input: click to dig, right-click / long-press / flag mode to flag ----------
let pressTimer = null, longPressed = false;
boardEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const el = e.target.closest('.cell');
  if (el && !longPressed) toggleFlag(+el.dataset.i);
});
boardEl.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.cell');
  if (!el || e.pointerType === 'mouse') return;
  longPressed = false;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    longPressed = true;
    toggleFlag(+el.dataset.i);
    if (navigator.vibrate) navigator.vibrate(30);
  }, 380);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => boardEl.addEventListener(t, () => clearTimeout(pressTimer)));
boardEl.addEventListener('click', (e) => {
  const el = e.target.closest('.cell');
  if (!el) return;
  if (longPressed) { longPressed = false; return; }
  const i = +el.dataset.i;
  if (flagMode && !cells[i].open) toggleFlag(i); else dig(i);
});

faceBtn.addEventListener('click', newGame);
flagModeBtn.addEventListener('click', () => {
  flagMode = !flagMode;
  flagModeBtn.setAttribute('aria-pressed', String(flagMode));
  flagModeBtn.textContent = `🚩 Flag mode: ${flagMode ? 'on' : 'off'}`;
});
document.querySelectorAll('.level').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.level === level && !started) return;
  level = b.dataset.level;
  try { localStorage.setItem('valk-ms-level', level); } catch {}
  reconnectForLevel();
  newGame();
}));
window.addEventListener('resize', fitCellSize);
document.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') flagModeBtn.click();
  if (e.key === 'n' || e.key === 'N') newGame();
});

// ---------- Leaderboard (per room, per difficulty) ----------
function renderLeaderboard(scores) {
  leaderboardEl.innerHTML = '';
  if (!roomCode) { leaderboardEl.innerHTML = '<li class="muted">Open Minesweeper from a chat room to get on its leaderboard.</li>'; return; }
  if (!scores.length) { leaderboardEl.innerHTML = '<li class="muted">No times yet — be the first!</li>'; return; }
  for (const s of scores) {
    const li = document.createElement('li');
    li.textContent = s.name;
    const t = document.createElement('span');
    t.className = 'time';
    t.textContent = `${((SCORE_BASE - s.score) / 10).toFixed(1)}s`;
    li.appendChild(t);
    leaderboardEl.appendChild(li);
  }
}

let ws;
function send(obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
function requestLeaderboard() { send({ type: 'arcade-leaderboard' }); }
function joinMsg() {
  return { type: 'arcade-join', code: roomCode, name: myName, game: `minesweeper-${level}`, accountToken: localStorage.getItem('valk-account-token') };
}
function reconnectForLevel() { if (roomCode) send(joinMsg()); }
function connect() {
  if (!roomCode) { renderLeaderboard([]); return; }
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);
  ws.addEventListener('open', () => send(joinMsg()));
  ws.addEventListener('close', () => setTimeout(connect, 1500));
  ws.addEventListener('message', (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'arcade-leaderboard') renderLeaderboard(data.scores || []);
    if (data.type === 'arcade-join-error') { leaderboardEl.innerHTML = ''; const li = document.createElement('li'); li.className = 'muted'; li.textContent = data.message; leaderboardEl.appendChild(li); }
  });
}
window.addEventListener('beforeunload', () => send({ type: 'arcade-leave' }));

newGame();
connect();
