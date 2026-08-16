// ---------- Room/session setup (same ?room=&name= pattern as buildcraft.js/geometrywave.js —
// this page opens its own WebSocket connection, bypassing join-server/ws.profile entirely). ----------
const mpParams = new URLSearchParams(location.search);
const roomCode = mpParams.get('room');
const myName = (mpParams.get('name') || 'Player').slice(0, 30);

const backLink = document.getElementById('back-link');
if (roomCode) backLink.href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;

const lobbyEl = document.getElementById('lobby');
const lobbyStatusEl = document.getElementById('lobby-status');
const lobbyPlayersEl = document.getElementById('lobby-players');
const startBtn = document.getElementById('start-btn');
const gameEl = document.getElementById('game');
const roundStatusEl = document.getElementById('round-status');
const roundTimerEl = document.getElementById('round-timer');
const gameStartBtn = document.getElementById('game-start-btn');
const menuBtnGame = document.getElementById('menu-btn-game');
const board = document.getElementById('board');
const ctx = board.getContext('2d');
const toolbarEl = document.getElementById('toolbar');
const colorSwatchesEl = document.getElementById('color-swatches');
const brushSizeInput = document.getElementById('brush-size');
const clearBtn = document.getElementById('clear-btn');
const feedEl = document.getElementById('feed');
const guessForm = document.getElementById('guess-form');
const guessInput = document.getElementById('guess-input');
const playersOverlay = document.getElementById('players-overlay');
const playersCloseBtn = document.getElementById('players-close-btn');
const playersListEl = document.getElementById('players-list');
const spectateToggleBtn = document.getElementById('spectate-toggle-btn');
const categorySelect = document.getElementById('category-select');

const BOARD_W = 800;
const BOARD_H = 600;
board.width = BOARD_W;
board.height = BOARD_H;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

const COLORS = ['#111111', '#e74c3c', '#3b9dff', '#34e89e', '#f1c40f', '#e67e22', '#9b59b6', '#ffffff'];
// Swatches are pure background-color buttons with no text — without an aria-label a screen
// reader gets "button" with no indication of which color it picks.
const COLOR_NAMES = ['Black', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'White'];
let currentColor = COLORS[0];
let currentSize = +brushSizeInput.value;

COLORS.forEach((c, i) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'color-swatch' + (i === 0 ? ' active' : '');
  btn.style.background = c;
  btn.setAttribute('aria-label', COLOR_NAMES[i] || c);
  btn.addEventListener('click', () => {
    currentColor = c;
    colorSwatchesEl.querySelectorAll('.color-swatch').forEach((el) => el.classList.remove('active'));
    btn.classList.add('active');
  });
  colorSwatchesEl.appendChild(btn);
});
brushSizeInput.addEventListener('input', () => { currentSize = +brushSizeInput.value; });

function fitBoard() {
  const wrap = document.getElementById('board-wrap');
  const availW = wrap.clientWidth - 16;
  const availH = wrap.clientHeight - 16;
  const scale = Math.max(0.1, Math.min(availW / BOARD_W, availH / BOARD_H, 1));
  board.style.width = `${BOARD_W * scale}px`;
  board.style.height = `${BOARD_H * scale}px`;
}
window.addEventListener('resize', fitBoard);

function getBoardPoint(e) {
  const rect = board.getBoundingClientRect();
  return {
    x: Math.round(((e.clientX - rect.left) * BOARD_W) / rect.width),
    y: Math.round(((e.clientY - rect.top) * BOARD_H) / rect.height),
  };
}

function drawStroke(stroke) {
  if (!stroke.points || stroke.points.length < 2) return;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  ctx.stroke();
}

function clearBoard() {
  ctx.clearRect(0, 0, BOARD_W, BOARD_H);
}

// ---------- Drawing input (drawer only) ----------
let isDrawing = false;
let pendingPoints = []; // points collected since the last throttled flush
let lastSentPoint = null;
let lastFlushAt = 0;
const STROKE_FLUSH_MS = 80;

function canDraw() {
  return dgIAmDrawer && roundActive;
}

board.addEventListener('pointerdown', (e) => {
  if (!canDraw()) return;
  isDrawing = true;
  lastSentPoint = null;
  const p = getBoardPoint(e);
  pendingPoints = [p];
  board.setPointerCapture(e.pointerId);
});

board.addEventListener('pointermove', (e) => {
  if (!isDrawing || !canDraw()) return;
  const p = getBoardPoint(e);
  const prev = pendingPoints[pendingPoints.length - 1] || lastSentPoint;
  pendingPoints.push(p);
  if (prev) drawStroke({ points: [prev, p], color: currentColor, size: currentSize });
  const now = performance.now();
  if (now - lastFlushAt > STROKE_FLUSH_MS) flushStroke();
});

['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) => {
  board.addEventListener(evt, () => {
    if (!isDrawing) return;
    isDrawing = false;
    flushStroke();
  });
});

function flushStroke() {
  lastFlushAt = performance.now();
  if (pendingPoints.length === 0) return;
  const points = lastSentPoint ? [lastSentPoint, ...pendingPoints] : [...pendingPoints];
  lastSentPoint = pendingPoints[pendingPoints.length - 1];
  pendingPoints = [];
  if (points.length < 2) return;
  send({ type: 'dg-stroke', points, color: currentColor, size: currentSize });
}

clearBtn.addEventListener('click', () => {
  if (!dgIAmDrawer) return;
  clearBoard();
  send({ type: 'dg-clear' });
});

// ---------- Feed ----------
function addFeedLine(text, className) {
  const line = document.createElement('div');
  if (className) line.className = className;
  line.textContent = text;
  feedEl.appendChild(line);
  feedEl.scrollTop = feedEl.scrollHeight;
}

// ---------- Players list ----------
let players = new Map(); // id -> {id, name, score}
let dgDrawerId = null;

function playingCount() {
  return [...players.values()].filter((p) => !p.isSpectator).length;
}

function renderPlayerList(container) {
  container.innerHTML = '';
  [...players.values()]
    .sort((a, b) => (a.isSpectator === b.isSpectator ? b.score - a.score : a.isSpectator ? 1 : -1))
    .forEach((p) => {
      const li = document.createElement('li');
      if (p.id === dgDrawerId) li.classList.add('is-drawer');
      const name = document.createElement('span');
      name.textContent = p.isSpectator ? `👀 ${p.name}` : p.id === dgDrawerId ? `✏️ ${p.name}` : p.name;
      const score = document.createElement('span');
      score.className = 'score';
      score.textContent = p.isSpectator ? '—' : p.score;
      li.append(name, score);
      container.appendChild(li);
    });
}

function refreshPlayerLists() {
  renderPlayerList(lobbyPlayersEl);
  renderPlayerList(playersListEl);
  startBtn.disabled = playingCount() < 2;
}

// ---------- All-time leaderboard (persisted server-side per room) ----------
const leaderboardListEl = document.getElementById('leaderboard-list');

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
    const score = document.createElement('span');
    score.className = 'score';
    score.textContent = s.score;
    li.append(name, score);
    leaderboardListEl.appendChild(li);
  });
}

menuBtnGame.addEventListener('click', () => {
  playersOverlay.classList.remove('hidden');
  send({ type: 'dg-leaderboard' });
});
playersCloseBtn.addEventListener('click', () => playersOverlay.classList.add('hidden'));
spectateToggleBtn.addEventListener('click', () => send({ type: 'dg-set-spectator', spectate: !myIsSpectator }));
playersOverlay.addEventListener('click', (e) => {
  if (e.target === playersOverlay) playersOverlay.classList.add('hidden');
});
// Same Escape-to-close fix already applied to every other overlay in this app this session.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !playersOverlay.classList.contains('hidden')) playersCloseBtn.click();
});

// ---------- Round state ----------
let roundActive = false;
let dgIAmDrawer = false;
let dgMyId = null;
let roundEndsAt = null;
let timerInterval = null;
let guessedAlready = false;
let myIsSpectator = false;

function updateRoundUi() {
  toolbarEl.classList.toggle('hidden', !canDraw());
  guessForm.classList.toggle('hidden', !roundActive || dgIAmDrawer || guessedAlready || myIsSpectator);
  gameStartBtn.classList.toggle('hidden', roundActive || playingCount() < 2 || myIsSpectator);
  startBtn.disabled = playingCount() < 2 || roundActive;
  spectateToggleBtn.textContent = myIsSpectator ? '🖍️ Switch to playing' : '👀 Switch to watch-only';
}

function tickTimer() {
  if (!roundEndsAt) {
    roundTimerEl.textContent = '';
    return;
  }
  const remaining = Math.max(0, Math.ceil((roundEndsAt - Date.now()) / 1000));
  roundTimerEl.textContent = `${remaining}s`;
}

// ---------- WebSocket ----------
let ws;
function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.addEventListener('open', () => {
    lobbyStatusEl.textContent = 'Joining room…';
    send({ type: 'dg-join', code: roomCode, name: myName });
  });

  ws.addEventListener('close', () => {
    lobbyStatusEl.textContent = 'Disconnected — reconnecting…';
    setTimeout(connect, 1500);
  });

  ws.addEventListener('message', (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (err) {
      reportClientError('Malformed WS frame: ' + err.message, err.stack);
      return;
    }
    handleMessage(data);
  });
}

function handleMessage(data) {
  switch (data.type) {
    case 'dg-init':
      dgMyId = data.id;
      players = new Map(data.players.map((p) => [p.id, p]));
      myIsSpectator = !!(players.get(dgMyId) || {}).isSpectator;
      dgDrawerId = data.drawerId;
      roundActive = !!data.endsAt;
      dgIAmDrawer = dgDrawerId === dgMyId;
      roundEndsAt = data.endsAt;
      clearBoard();
      (data.strokes || []).forEach(drawStroke);
      if (data.categories && categorySelect.options.length <= 1) {
        data.categories.forEach((name) => {
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          categorySelect.appendChild(opt);
        });
      }
      categorySelect.value = data.category || 'Random';
      lobbyStatusEl.textContent = 'Connected!';
      lobbyEl.classList.add('hidden');
      gameEl.classList.remove('hidden');
      fitBoard();
      refreshPlayerLists();
      updateRoundUi();
      roundStatusEl.textContent = roundActive
        ? (dgIAmDrawer ? 'It’s your turn to draw!' : 'A round is already in progress…')
        : 'Waiting for a round to start…';
      break;

    case 'dg-player-joined':
      players.set(data.id, { id: data.id, name: data.name, score: 0, isSpectator: !!data.isSpectator });
      addFeedLine(data.isSpectator ? `${data.name} is watching` : `${data.name} joined`, 'feed-system');
      refreshPlayerLists();
      updateRoundUi();
      break;

    case 'dg-spectator-changed': {
      const p = players.get(data.id);
      if (p) p.isSpectator = data.isSpectator;
      if (data.id === dgMyId) myIsSpectator = data.isSpectator;
      refreshPlayerLists();
      updateRoundUi();
      break;
    }

    case 'dg-player-left': {
      const p = players.get(data.id);
      players.delete(data.id);
      if (p) addFeedLine(`${p.name} left`, 'feed-system');
      refreshPlayerLists();
      updateRoundUi();
      break;
    }

    case 'dg-full':
      lobbyStatusEl.textContent = 'This game is full (20/20 players).';
      break;

    case 'dg-category-changed':
      categorySelect.value = data.category;
      break;

    case 'dg-error':
      addFeedLine(data.message, 'feed-system');
      break;

    case 'dg-round-start':
      dgDrawerId = data.drawerId;
      dgIAmDrawer = dgDrawerId === dgMyId;
      roundActive = true;
      guessedAlready = false;
      roundEndsAt = data.endsAt;
      clearBoard();
      feedEl.innerHTML = '';
      roundStatusEl.textContent = dgIAmDrawer
        ? 'Draw the word above — everyone else is guessing!'
        : `${data.drawerName} is drawing (${data.wordLength} letters)`;
      addFeedLine(
        `New round! ${data.drawerName} is drawing.${data.category && data.category !== 'Random' ? ` Category: ${data.category}` : ''}`,
        'feed-system'
      );
      refreshPlayerLists();
      updateRoundUi();
      break;

    case 'dg-word':
      roundStatusEl.textContent = `Draw: ${data.word}`;
      break;

    case 'dg-stroke':
      drawStroke(data.stroke);
      break;

    case 'dg-cleared':
      clearBoard();
      break;

    case 'dg-guess-chat':
      addFeedLine(`${data.name}: ${data.text}`);
      break;

    case 'dg-correct': {
      const p = players.get(data.id);
      if (p) p.score = data.score;
      addFeedLine(`🎉 ${data.name} guessed it! (+${data.points})`, 'feed-correct');
      if (data.id === dgMyId) {
        guessedAlready = true;
        updateRoundUi();
      }
      refreshPlayerLists();
      break;
    }

    case 'dg-round-end':
      roundActive = false;
      dgDrawerId = null;
      dgIAmDrawer = false;
      roundEndsAt = null;
      guessedAlready = false;
      (data.scores || []).forEach((s) => {
        const p = players.get(s.id);
        if (p) p.score = s.score;
      });
      addFeedLine(`Round over — the word was "${data.word}"`, 'feed-system');
      roundStatusEl.textContent = `The word was "${data.word}" — waiting for the next round…`;
      refreshPlayerLists();
      updateRoundUi();
      break;

    case 'dg-leaderboard-result':
      renderLeaderboard(data.scores || []);
      break;
  }
}

startBtn.addEventListener('click', () => send({ type: 'dg-start' }));
gameStartBtn.addEventListener('click', () => send({ type: 'dg-start' }));
categorySelect.addEventListener('change', () => send({ type: 'dg-set-category', category: categorySelect.value }));

guessForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = guessInput.value.trim();
  if (!text) return;
  send({ type: 'dg-guess', text });
  guessInput.value = '';
});

setInterval(tickTimer, 250);
window.addEventListener('beforeunload', () => send({ type: 'dg-leave' }));

fitBoard();
connect();
