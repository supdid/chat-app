// ---------- Room/session setup (same ?room=&name= pattern as the other minigames) ----------
const params = new URLSearchParams(location.search);
const roomCode = params.get('room');
const myName = (params.get('name') || 'Player').slice(0, 30);
const backLink = document.getElementById('back-link');
if (roomCode) backLink.href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;

const LEVELS = {
  easy: { pairs: 8, cols: 4, label: 'Easy' },
  medium: { pairs: 12, cols: 6, phoneCols: 4, label: 'Medium' },
  hard: { pairs: 18, cols: 6, label: 'Hard' },
};
const EMOJI = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐨', '🐙', '🦄', '🐝', '🍕', '🍩', '🍉', '🍓', '🌮', '🍔',
  '⚽', '🏀', '🎸', '🚀', '🌈', '⭐', '🔥', '💎', '🎈', '🎃', '👻', '🤖', '👾', '🎮'];
// Leaderboard scores are "higher is better", so a time is stored as 100000 − tenths of a second.
const SCORE_BASE = 100000;

const boardEl = document.getElementById('board');
const pairsEl = document.getElementById('pairs-left');
const movesEl = document.getElementById('moves');
const timerEl = document.getElementById('timer');
const faceBtn = document.getElementById('face-btn');
const resultEl = document.getElementById('result');
const leaderboardEl = document.getElementById('leaderboard');
const lbLevelEl = document.getElementById('lb-level');

let level = 'easy';
try { if (LEVELS[localStorage.getItem('valk-mm-level')]) level = localStorage.getItem('valk-mm-level'); } catch {}
let cards, flipped, found, moves, started, over, startTime, timerId, busy;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function newGame() {
  const L = LEVELS[level];
  clearInterval(timerId);
  started = false; over = false; busy = false;
  flipped = []; found = 0; moves = 0;
  timerEl.textContent = '⏱ 0.0';
  resultEl.classList.add('hidden');
  document.querySelectorAll('.level').forEach((b) => {
    const on = b.dataset.level === level;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  lbLevelEl.textContent = L.label;
  const cols = window.innerWidth < 600 && L.phoneCols ? L.phoneCols : L.cols;
  boardEl.style.setProperty('--cols', cols);
  const faces = shuffle(EMOJI.slice()).slice(0, L.pairs);
  cards = shuffle([...faces, ...faces]).map((face) => ({ face, matched: false }));
  boardEl.innerHTML = '';
  cards.forEach((c, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'card';
    el.dataset.i = i;
    el.setAttribute('aria-label', 'Face-down card');
    el.innerHTML = '<span class="card-inner"><span class="card-face card-back"></span><span class="card-face card-front"></span></span>';
    el.querySelector('.card-front').textContent = c.face;
    c.el = el;
    boardEl.appendChild(el);
  });
  updateHud();
  requestLeaderboard();
}

function updateHud() {
  pairsEl.textContent = `✅ ${found}/${LEVELS[level].pairs}`;
  movesEl.textContent = `👆 ${moves}`;
}
function elapsed() { return (performance.now() - startTime) / 1000; }

function flip(i) {
  if (over || busy) return;
  const c = cards[i];
  if (c.matched || flipped.includes(i)) return;
  if (!started) {
    started = true;
    startTime = performance.now();
    timerId = setInterval(() => { timerEl.textContent = `⏱ ${elapsed().toFixed(1)}`; }, 100);
  }
  c.el.classList.add('up');
  c.el.setAttribute('aria-label', c.face);
  flipped.push(i);
  if (flipped.length < 2) return;
  moves++;
  const [a, b] = flipped.map((k) => cards[k]);
  if (a.face === b.face) {
    a.matched = b.matched = true;
    a.el.classList.add('matched');
    b.el.classList.add('matched');
    flipped = [];
    found++;
    updateHud();
    if (found === LEVELS[level].pairs) win();
    return;
  }
  updateHud();
  busy = true;
  a.el.classList.add('miss');
  b.el.classList.add('miss');
  setTimeout(() => {
    for (const c2 of [a, b]) { c2.el.classList.remove('up', 'miss'); c2.el.setAttribute('aria-label', 'Face-down card'); }
    flipped = [];
    busy = false;
  }, 700);
}

function win() {
  over = true;
  clearInterval(timerId);
  const secs = Math.round(elapsed() * 10) / 10;
  timerEl.textContent = `⏱ ${secs.toFixed(1)}`;
  resultEl.textContent = `🎉 All ${LEVELS[level].pairs} pairs in ${secs.toFixed(1)} seconds and ${moves} moves!`;
  resultEl.className = 'result';
  send({ type: 'arcade-submit-score', score: Math.max(1, SCORE_BASE - Math.round(secs * 10)) });
}

boardEl.addEventListener('click', (e) => {
  const el = e.target.closest('.card');
  if (el) flip(+el.dataset.i);
});
faceBtn.addEventListener('click', newGame);
document.querySelectorAll('.level').forEach((b) => b.addEventListener('click', () => {
  level = b.dataset.level;
  try { localStorage.setItem('valk-mm-level', level); } catch {}
  if (roomCode) send(joinMsg());
  newGame();
}));

// ---------- Leaderboard (per room, per difficulty) ----------
function renderLeaderboard(scores) {
  leaderboardEl.innerHTML = '';
  const note = (t) => { const li = document.createElement('li'); li.className = 'muted'; li.textContent = t; leaderboardEl.appendChild(li); };
  if (!roomCode) return note('Open Memory Match from a chat room to get on its leaderboard.');
  if (!scores.length) return note('No times yet — be the first!');
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
  let token = null;
  try { token = localStorage.getItem('valk-account-token'); } catch {}
  return { type: 'arcade-join', code: roomCode, name: myName, game: `memory-${level}`, accountToken: token };
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
