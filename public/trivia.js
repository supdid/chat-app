// ---------- Room/session setup (same ?room=&name= pattern as buildcraft.js/pictionary.js —
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
const questionCategoryEl = document.getElementById('question-category');
const questionTextEl = document.getElementById('question-text');
const choicesGridEl = document.getElementById('choices-grid');
const answerCountEl = document.getElementById('answer-count');
const playersOverlay = document.getElementById('players-overlay');
const playersCloseBtn = document.getElementById('players-close-btn');
const playersListEl = document.getElementById('players-list');
const leaderboardListEl = document.getElementById('leaderboard-list');

// ---------- Players list ----------
let players = new Map(); // id -> {id, name, score}

function renderPlayerList(container) {
  container.innerHTML = '';
  [...players.values()]
    .sort((a, b) => b.score - a.score)
    .forEach((p) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = p.name;
      const score = document.createElement('span');
      score.className = 'score';
      score.textContent = p.score;
      li.append(name, score);
      container.appendChild(li);
    });
}

function refreshPlayerLists() {
  renderPlayerList(lobbyPlayersEl);
  renderPlayerList(playersListEl);
}

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
  send({ type: 'tv-leaderboard' });
});
playersCloseBtn.addEventListener('click', () => playersOverlay.classList.add('hidden'));
playersOverlay.addEventListener('click', (e) => {
  if (e.target === playersOverlay) playersOverlay.classList.add('hidden');
});
// Same Escape-to-close fix already applied to every other overlay in this app this session.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !playersOverlay.classList.contains('hidden')) playersCloseBtn.click();
});

// ---------- Round state ----------
let roundActive = false;
let tvMyId = null;
let roundEndsAt = null;
let hasAnsweredThisRound = false;
let correctIndex = null;

function renderChoices(choices) {
  choicesGridEl.innerHTML = '';
  choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-btn';
    btn.textContent = choice;
    btn.addEventListener('click', () => {
      if (hasAnsweredThisRound || !roundActive) return;
      hasAnsweredThisRound = true;
      btn.classList.add('picked');
      [...choicesGridEl.children].forEach((el) => (el.disabled = true));
      send({ type: 'tv-answer', choice: i });
    });
    choicesGridEl.appendChild(btn);
  });
}

function revealCorrect(idx) {
  [...choicesGridEl.children].forEach((el, i) => {
    el.disabled = true;
    if (i === idx) el.classList.add('correct');
    else if (el.classList.contains('picked')) el.classList.add('wrong');
  });
}

function updateRoundUi() {
  gameStartBtn.classList.toggle('hidden', roundActive);
  startBtn.disabled = roundActive;
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
    send({ type: 'tv-join', code: roomCode, name: myName });
  });

  ws.addEventListener('close', () => {
    lobbyStatusEl.textContent = 'Disconnected — reconnecting…';
    setTimeout(connect, 1500);
  });

  ws.addEventListener('message', (event) => {
    try {
      handleMessage(JSON.parse(event.data));
    } catch (err) {
      reportClientError('Malformed WS frame: ' + err.message, err.stack);
    }
  });
}

function handleMessage(data) {
  switch (data.type) {
    case 'tv-init':
      tvMyId = data.id;
      players = new Map(data.players.map((p) => [p.id, p]));
      lobbyStatusEl.textContent = 'Connected!';
      lobbyEl.classList.add('hidden');
      gameEl.classList.remove('hidden');
      // Found by the turn-based-minigame UI correctness audit: unlike ch-state/tt-state (always
      // the full current game state) and hm-init (always includes roundActive/revealedWord), this
      // message carries no round info at all — a real tv-question only follows when a round is
      // actually active right now. On a WS reconnect (this page auto-reconnects in place, same
      // pattern as chess/tictactoe/hangman) while no round happens to be active — an idle lobby,
      // or the round ended during the brief drop — everything below was previously left exactly as
      // it was pre-disconnect: a stale question, clickable-looking answer buttons, a frozen timer,
      // and answering it would silently no-op server-side (tv.currentQuestion is already null) with
      // zero feedback. Reset to the idle view unconditionally here; if a round IS actually active,
      // the server always sends a real tv-question synchronously right after this same tv-join
      // handler runs, which immediately overwrites every one of these fields correctly.
      roundActive = false;
      hasAnsweredThisRound = false;
      correctIndex = null;
      roundEndsAt = null;
      questionCategoryEl.textContent = '';
      questionCategoryEl.classList.add('hidden');
      questionTextEl.textContent = '';
      choicesGridEl.innerHTML = '';
      answerCountEl.textContent = '';
      roundStatusEl.textContent = 'Waiting for a round to start…';
      roundTimerEl.textContent = '';
      refreshPlayerLists();
      updateRoundUi();
      break;

    case 'tv-player-joined':
      players.set(data.id, { id: data.id, name: data.name, score: 0 });
      refreshPlayerLists();
      break;

    case 'tv-player-left':
      players.delete(data.id);
      refreshPlayerLists();
      break;

    case 'tv-full':
      lobbyStatusEl.textContent = 'This game is full (20/20 players).';
      break;

    // Found by an app-wide audit (surfaced independently by both the Web Swing and Block Battle
    // dimensions, then confirmed present across every minigame in this app via a systematic sweep):
    // a banned player joining any minigame got zero client-side handling for the server's own
    // join-error message — silently stuck on the lobby screen with no explanation. The server never
    // closes the connection for this, so no reconnect-loop guard is needed here.
    case 'tv-join-error':
      lobbyStatusEl.textContent = data.message || "Couldn't join this room.";
      break;

    case 'tv-question':
      roundActive = true;
      // A rejoin mid-round (reconnect after a brief drop, or opening the page again) resends the
      // in-progress question — alreadyAnswered (server-side, keyed by name so it survives the
      // per-connection id changing on reconnect) tells us whether to leave the choices disabled
      // instead of always re-enabling them for someone who already locked in an answer.
      hasAnsweredThisRound = !!data.alreadyAnswered;
      correctIndex = null;
      roundEndsAt = data.endsAt;
      questionCategoryEl.textContent = data.category || '';
      questionCategoryEl.classList.toggle('hidden', !data.category);
      questionTextEl.textContent = data.question;
      renderChoices(data.choices);
      if (hasAnsweredThisRound) [...choicesGridEl.children].forEach((el) => (el.disabled = true));
      answerCountEl.textContent = '';
      roundStatusEl.textContent = hasAnsweredThisRound ? 'You already answered — waiting on everyone else…' : 'Pick an answer before time runs out!';
      updateRoundUi();
      break;

    case 'tv-answer-count':
      answerCountEl.textContent = `${data.answered}/${data.total} answered`;
      break;

    case 'tv-answer-ack':
      roundStatusEl.textContent = data.correct
        ? `✅ Correct! +${data.points} points`
        : '❌ Not quite — see what everyone else picked...';
      break;

    case 'tv-round-end':
      roundActive = false;
      roundEndsAt = null;
      correctIndex = data.correctIndex;
      revealCorrect(correctIndex);
      (data.scores || []).forEach((s) => {
        const p = players.get(s.id);
        if (p) p.score = s.score;
      });
      roundStatusEl.textContent = 'Round over — waiting for the next question…';
      refreshPlayerLists();
      updateRoundUi();
      break;

    case 'tv-leaderboard-result':
      renderLeaderboard(data.scores || []);
      break;
  }
}

startBtn.addEventListener('click', () => send({ type: 'tv-start' }));
gameStartBtn.addEventListener('click', () => send({ type: 'tv-start' }));

setInterval(tickTimer, 250);
window.addEventListener('beforeunload', () => send({ type: 'tv-leave' }));

connect();
