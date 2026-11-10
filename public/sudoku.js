// ---------- Room/session setup (same ?room=&name= pattern as the other minigames) ----------
const params = new URLSearchParams(location.search);
const roomCode = params.get('room');
const myName = (params.get('name') || 'Player').slice(0, 30);
const backLink = document.getElementById('back-link');
if (roomCode) backLink.href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;

// How many squares are filled in at the start.
const LEVELS = { easy: { givens: 40, label: 'Easy' }, medium: { givens: 32, label: 'Medium' }, hard: { givens: 26, label: 'Hard' } };
const SCORE_BASE = 100000; // time stored as 100000 − tenths of a second (capped below 2.7 hours)

const boardEl = document.getElementById('board');
const padEl = document.getElementById('pad');
const notesBtn = document.getElementById('notes-btn');
const mistakesEl = document.getElementById('mistakes');
const timerEl = document.getElementById('timer');
const resultEl = document.getElementById('result');
const leaderboardEl = document.getElementById('leaderboard');
const lbLevelEl = document.getElementById('lb-level');

let level = 'easy';
try { if (LEVELS[localStorage.getItem('valk-sd-level')]) level = localStorage.getItem('valk-sd-level'); } catch {}
let solution, puzzle, grid, notes, given, sel = -1, notesMode = false, mistakes = 0, startTime, timerId, over = false;

const rowOf = (i) => Math.floor(i / 9);
const colOf = (i) => i % 9;
const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
const PEERS = Array.from({ length: 81 }, (_, i) => {
  const s = new Set();
  for (let j = 0; j < 81; j++) if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) s.add(j);
  return [...s];
});
function shuffled(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function canPlace(g, i, n) { return PEERS[i].every((j) => g[j] !== n); }

function fillGrid(g) {
  const i = g.indexOf(0);
  if (i < 0) return true;
  for (const n of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (canPlace(g, i, n)) { g[i] = n; if (fillGrid(g)) return true; g[i] = 0; }
  }
  return false;
}
// Counts solutions up to 2 (we only need to know "exactly one").
function countSolutions(g, limit = 2) {
  let best = -1, bestOpts = null;
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue;
    const opts = [];
    for (let n = 1; n <= 9; n++) if (canPlace(g, i, n)) opts.push(n);
    if (!opts.length) return 0;
    if (!bestOpts || opts.length < bestOpts.length) { best = i; bestOpts = opts; if (opts.length === 1) break; }
  }
  if (best < 0) return 1;
  let count = 0;
  for (const n of bestOpts) {
    g[best] = n;
    count += countSolutions(g, limit - count);
    g[best] = 0;
    if (count >= limit) break;
  }
  return count;
}
function makePuzzle(givens) {
  const full = Array(81).fill(0);
  fillGrid(full);
  const p = full.slice();
  let filled = 81;
  for (const i of shuffled([...Array(81).keys()])) {
    if (filled <= givens) break;
    const keep = p[i];
    p[i] = 0;
    if (countSolutions(p.slice()) !== 1) p[i] = keep; else filled--;
  }
  return { solution: full, puzzle: p };
}

function newGame() {
  ({ solution, puzzle } = makePuzzle(LEVELS[level].givens));
  grid = puzzle.slice();
  given = puzzle.map((n) => n !== 0);
  notes = Array.from({ length: 81 }, () => new Set());
  sel = -1; mistakes = 0; over = false;
  clearInterval(timerId);
  startTime = performance.now();
  timerId = setInterval(paintTimer, 500);
  paintTimer();
  resultEl.classList.add('hidden');
  document.querySelectorAll('.level').forEach((b) => {
    const on = b.dataset.level === level;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  lbLevelEl.textContent = LEVELS[level].label;
  boardEl.innerHTML = '';
  for (let i = 0; i < 81; i++) {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'sd-cell' + (rowOf(i) === 3 || rowOf(i) === 6 ? ` r${rowOf(i)}` : '') + (colOf(i) === 3 || colOf(i) === 6 ? ` c${colOf(i)}` : '');
    c.dataset.i = i;
    boardEl.appendChild(c);
  }
  paint();
}

function elapsed() { return (performance.now() - startTime) / 1000; }
function fmt(secs) { const s = Math.floor(secs); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function paintTimer() { if (!over) timerEl.textContent = `⏱ ${fmt(elapsed())}`; }

function paint() {
  const selVal = sel >= 0 ? grid[sel] : 0;
  const cells = boardEl.children;
  for (let i = 0; i < 81; i++) {
    const c = cells[i];
    c.classList.toggle('given', given[i]);
    c.classList.toggle('sel', i === sel);
    c.classList.toggle('peer', sel >= 0 && i !== sel && PEERS[sel].includes(i));
    c.classList.toggle('same', !!selVal && i !== sel && grid[i] === selVal);
    c.classList.toggle('bad', !!grid[i] && !given[i] && grid[i] !== solution[i]);
    c.textContent = '';
    if (grid[i]) c.textContent = grid[i];
    else if (notes[i].size) {
      const ng = document.createElement('span');
      ng.className = 'sd-notes-grid';
      for (let n = 1; n <= 9; n++) { const s = document.createElement('span'); s.textContent = notes[i].has(n) ? n : ''; ng.appendChild(s); }
      c.appendChild(ng);
    }
    c.setAttribute('aria-label', `Row ${rowOf(i) + 1}, column ${colOf(i) + 1}: ${grid[i] || 'empty'}`);
  }
  // Fade numbers that are already all placed.
  for (const b of padEl.querySelectorAll('[data-n]')) {
    const n = Number(b.dataset.n);
    if (n) b.classList.toggle('done', grid.filter((v, i) => v === n && v === solution[i]).length === 9);
  }
  mistakesEl.textContent = `❌ ${mistakes}`;
}

function enter(n) {
  if (over || sel < 0 || given[sel]) return;
  if (n === 0) { grid[sel] = 0; notes[sel].clear(); paint(); return; }
  if (notesMode) {
    if (grid[sel]) return;
    if (notes[sel].has(n)) notes[sel].delete(n); else notes[sel].add(n);
    paint();
    return;
  }
  grid[sel] = n;
  notes[sel].clear();
  if (n !== solution[sel]) mistakes++;
  else for (const j of PEERS[sel]) notes[j].delete(n);
  paint();
  if (grid.every((v, i) => v === solution[i])) win();
}

function win() {
  over = true;
  clearInterval(timerId);
  const secs = Math.round(elapsed() * 10) / 10;
  timerEl.textContent = `⏱ ${fmt(secs)}`;
  resultEl.textContent = `🎉 Solved ${LEVELS[level].label} in ${fmt(secs)}${mistakes ? ` with ${mistakes} mistake${mistakes === 1 ? '' : 's'}` : ' with no mistakes'}!`;
  resultEl.className = 'result';
  send({ type: 'arcade-submit-score', score: Math.max(1, SCORE_BASE - Math.round(secs * 10)) });
}

boardEl.addEventListener('click', (e) => {
  const c = e.target.closest('.sd-cell');
  if (!c) return;
  sel = Number(c.dataset.i);
  paint();
});
padEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-n]');
  if (b) enter(Number(b.dataset.n));
});
notesBtn.addEventListener('click', () => {
  notesMode = !notesMode;
  notesBtn.setAttribute('aria-pressed', String(notesMode));
});
document.addEventListener('keydown', (e) => {
  if (/^[1-9]$/.test(e.key)) { enter(Number(e.key)); return; }
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { enter(0); return; }
  if (e.key === 'n' || e.key === 'N') { notesBtn.click(); return; }
  const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
  if (moves[e.key] !== undefined) {
    e.preventDefault();
    if (sel < 0) sel = 40;
    else {
      const next = sel + moves[e.key];
      if (next >= 0 && next < 81 && !(Math.abs(moves[e.key]) === 1 && rowOf(next) !== rowOf(sel))) sel = next;
    }
    paint();
  }
});
document.getElementById('face-btn').addEventListener('click', newGame);
document.querySelectorAll('.level').forEach((b) => b.addEventListener('click', () => {
  level = b.dataset.level;
  try { localStorage.setItem('valk-sd-level', level); } catch {}
  if (roomCode) send(joinMsg());
  newGame();
}));

// ---------- Leaderboard (per room, per difficulty) ----------
function renderLeaderboard(scores) {
  leaderboardEl.innerHTML = '';
  const note = (t) => { const li = document.createElement('li'); li.className = 'muted'; li.textContent = t; leaderboardEl.appendChild(li); };
  if (!roomCode) return note('Open Sudoku from a chat room to get on its leaderboard.');
  if (!scores.length) return note('No times yet — be the first!');
  for (const s of scores) {
    const li = document.createElement('li');
    li.textContent = s.name;
    const t = document.createElement('span');
    t.className = 'time';
    t.textContent = fmt((SCORE_BASE - s.score) / 10);
    li.appendChild(t);
    leaderboardEl.appendChild(li);
  }
}
let ws;
function send(obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
function joinMsg() {
  let token = null;
  try { token = localStorage.getItem('valk-account-token'); } catch {}
  return { type: 'arcade-join', code: roomCode, name: myName, game: `sudoku-${level}`, accountToken: token };
}
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
