// ---------- Room/session setup (same ?room=&name= pattern as trivia.js/tictactoe.js —
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
const wrongCountEl = document.getElementById('wrong-count');
const gameStartBtn = document.getElementById('game-start-btn');
const menuBtnGame = document.getElementById('menu-btn-game');
const wordDisplayEl = document.getElementById('word-display');
const wrongLettersEl = document.getElementById('wrong-letters');
const keyboardEl = document.getElementById('keyboard');
const playersOverlay = document.getElementById('players-overlay');
const playersCloseBtn = document.getElementById('players-close-btn');
const playersListEl = document.getElementById('players-list');
const leaderboardListEl = document.getElementById('leaderboard-list');

let players = new Map(); // id -> {id, name, score}
let roundActive = false;
let guessedLetters = new Set();
let maxWrong = 6;
let wrongCount = 0;

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
  startBtn.disabled = roundActive;
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
  send({ type: 'hm-leaderboard' });
});
playersCloseBtn.addEventListener('click', () => playersOverlay.classList.add('hidden'));
playersOverlay.addEventListener('click', (e) => {
  if (e.target === playersOverlay) playersOverlay.classList.add('hidden');
});

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
function buildKeyboard() {
  keyboardEl.innerHTML = '';
  ALPHABET.forEach((letter) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'key-btn';
    btn.textContent = letter;
    btn.dataset.letter = letter;
    btn.addEventListener('click', () => {
      if (!roundActive || guessedLetters.has(letter)) return;
      send({ type: 'hm-guess-letter', letter });
    });
    keyboardEl.appendChild(btn);
  });
}
buildKeyboard();

function updateKeyboardState() {
  [...keyboardEl.children].forEach((btn) => {
    const letter = btn.dataset.letter;
    btn.disabled = !roundActive || guessedLetters.has(letter);
  });
}

function renderWord(revealedWord) {
  wordDisplayEl.innerHTML = '';
  revealedWord.forEach((ch) => {
    const box = document.createElement('span');
    box.className = 'letter-box';
    box.textContent = ch || '';
    wordDisplayEl.appendChild(box);
  });
}

let wrongGuessedLetters = new Set();
function renderWrongLetters() {
  const wrong = [...wrongGuessedLetters];
  wrongLettersEl.textContent = wrong.length ? `Wrong: ${wrong.join(', ').toUpperCase()}` : '';
}

function updateRoundUi() {
  gameStartBtn.classList.toggle('hidden', roundActive);
  startBtn.disabled = roundActive;
  wrongCountEl.textContent = `❌ ${wrongCount}/${maxWrong}`;
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
    send({ type: 'hm-join', code: roomCode, name: myName });
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
    case 'hm-init':
      players = new Map(data.players.map((p) => [p.id, p]));
      roundActive = data.roundActive;
      guessedLetters = new Set(data.guessedLetters || []);
      wrongCount = data.wrongCount || 0;
      maxWrong = data.maxWrong || 6;
      // Derive which already-guessed letters were wrong (a late joiner never saw the individual
      // hm-letter-result events) — a guessed letter is wrong if it never shows up in the reveal.
      wrongGuessedLetters = new Set([...guessedLetters].filter((l) => !(data.revealedWord || []).includes(l)));
      lobbyStatusEl.textContent = 'Connected!';
      lobbyEl.classList.add('hidden');
      gameEl.classList.remove('hidden');
      renderWord(data.revealedWord || []);
      renderWrongLetters();
      updateKeyboardState();
      refreshPlayerLists();
      updateRoundUi();
      roundStatusEl.textContent = roundActive ? 'A round is already in progress…' : 'Waiting for a round to start…';
      break;

    case 'hm-player-joined':
      players.set(data.id, { id: data.id, name: data.name, score: 0 });
      refreshPlayerLists();
      break;

    case 'hm-player-left':
      players.delete(data.id);
      refreshPlayerLists();
      break;

    case 'hm-full':
      lobbyStatusEl.textContent = 'This game is full (20/20 players).';
      break;

    case 'hm-round-start':
      roundActive = true;
      guessedLetters = new Set();
      wrongGuessedLetters = new Set();
      wrongCount = data.wrongCount;
      maxWrong = data.maxWrong;
      renderWord(data.revealedWord);
      renderWrongLetters();
      updateKeyboardState();
      updateRoundUi();
      roundStatusEl.textContent = 'New word! Guess a letter.';
      break;

    case 'hm-letter-result':
      guessedLetters.add(data.letter);
      if (!data.correct) wrongGuessedLetters.add(data.letter);
      wrongCount = data.wrongCount;
      renderWord(data.revealedWord);
      renderWrongLetters();
      updateKeyboardState();
      updateRoundUi();
      roundStatusEl.textContent = data.correct
        ? `✅ ${data.by} guessed "${data.letter.toUpperCase()}"!`
        : `❌ ${data.by} guessed "${data.letter.toUpperCase()}" — not in the word`;
      (data.scores || []).forEach((s) => {
        const p = players.get(s.id);
        if (p) p.score = s.score;
      });
      refreshPlayerLists();
      break;

    case 'hm-round-end':
      roundActive = false;
      roundStatusEl.textContent = data.won
        ? `🎉 Solved it! The word was "${data.word}"`
        : `💀 Out of guesses! The word was "${data.word}"`;
      (data.scores || []).forEach((s) => {
        const p = players.get(s.id);
        if (p) p.score = s.score;
      });
      updateKeyboardState();
      refreshPlayerLists();
      updateRoundUi();
      break;

    case 'hm-leaderboard-result':
      renderLeaderboard(data.scores || []);
      break;
  }
}

startBtn.addEventListener('click', () => send({ type: 'hm-start' }));
gameStartBtn.addEventListener('click', () => send({ type: 'hm-start' }));

document.addEventListener('keydown', (e) => {
  if (!roundActive) return;
  const letter = e.key.toLowerCase();
  if (/^[a-z]$/.test(letter) && !guessedLetters.has(letter)) send({ type: 'hm-guess-letter', letter });
});

window.addEventListener('beforeunload', () => send({ type: 'hm-leave' }));

connect();
