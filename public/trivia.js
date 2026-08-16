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

    case 'tv-question':
      roundActive = true;
      hasAnsweredThisRound = false;
      correctIndex = null;
      roundEndsAt = data.endsAt;
      questionCategoryEl.textContent = data.category || '';
      questionCategoryEl.classList.toggle('hidden', !data.category);
      questionTextEl.textContent = data.question;
      renderChoices(data.choices);
      answerCountEl.textContent = '';
      roundStatusEl.textContent = 'Pick an answer before time runs out!';
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
