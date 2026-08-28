// ---------- Room/session setup (same ?room=&name= pattern as hangman.js/trivia.js — this page
// opens its own WebSocket connection, bypassing join-server/ws.profile entirely). ----------
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
const guessCountEl = document.getElementById('guess-count');
const gameStartBtn = document.getElementById('game-start-btn');
const menuBtnGame = document.getElementById('menu-btn-game');
const boardEl = document.getElementById('board');
const roundMessageEl = document.getElementById('round-message');
const keyboardEl = document.getElementById('keyboard');
const playersOverlay = document.getElementById('players-overlay');
const playersCloseBtn = document.getElementById('players-close-btn');
const playersListEl = document.getElementById('players-list');
const leaderboardListEl = document.getElementById('leaderboard-list');

const MAX_GUESSES = 6;
let players = new Map(); // id -> {id, name, guessCount, done, solved}
let roundActive = false;
let myGuessCount = 0;
let myDone = false;
let currentGuess = '';
let rowEls = []; // one per guess row, each an array of 5 tile elements
let letterStatus = new Map(); // letter -> best status seen ('correct' > 'present' > 'absent')

function renderPlayerList(container) {
  container.innerHTML = '';
  [...players.values()]
    // Solved players first, then fewest guesses used wins the tie (both a genuinely "better"
    // Wordle result and, for still-playing/not-done players, just a stable, sensible ordering).
    .sort((a, b) => b.solved - a.solved || a.guessCount - b.guessCount)
    .forEach((p) => {
      const li = document.createElement('li');
      if (p.done) li.classList.add('done');
      const name = document.createElement('span');
      name.textContent = p.name;
      const status = document.createElement('span');
      status.className = 'wg-status';
      status.textContent = p.solved ? `✅ ${p.guessCount}/${MAX_GUESSES}` : p.done ? '❌' : `${p.guessCount}/${MAX_GUESSES}`;
      li.append(name, status);
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
  send({ type: 'wg-leaderboard' });
});
playersCloseBtn.addEventListener('click', () => playersOverlay.classList.add('hidden'));
playersOverlay.addEventListener('click', (e) => {
  if (e.target === playersOverlay) playersOverlay.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !playersOverlay.classList.contains('hidden')) playersCloseBtn.click();
});

// ---------- Board ----------
function buildBoard() {
  boardEl.innerHTML = '';
  rowEls = [];
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement('div');
    row.className = 'wg-row';
    const tiles = [];
    for (let c = 0; c < 5; c++) {
      const tile = document.createElement('div');
      tile.className = 'wg-tile';
      row.appendChild(tile);
      tiles.push(tile);
    }
    boardEl.appendChild(row);
    rowEls.push(tiles);
  }
}
buildBoard();

function renderCurrentRow() {
  if (myGuessCount >= MAX_GUESSES) return;
  const tiles = rowEls[myGuessCount];
  for (let i = 0; i < 5; i++) {
    tiles[i].textContent = currentGuess[i] || '';
    tiles[i].classList.toggle('filled', Boolean(currentGuess[i]));
  }
}

function applyFeedbackToRow(rowIndex, guess, feedback) {
  const tiles = rowEls[rowIndex];
  feedback.forEach((status, i) => {
    tiles[i].textContent = guess[i];
    tiles[i].classList.add('filled', status);
    const letter = guess[i];
    const rank = { correct: 3, present: 2, absent: 1 };
    if (!letterStatus.has(letter) || rank[status] > rank[letterStatus.get(letter)]) {
      letterStatus.set(letter, status);
    }
  });
  updateKeyboardColors();
}

function shakeCurrentRow() {
  if (myGuessCount >= MAX_GUESSES) return;
  const row = boardEl.children[myGuessCount];
  row.classList.remove('shake');
  // Force reflow so re-adding the class re-triggers the animation on repeated invalid guesses.
  void row.offsetWidth;
  row.classList.add('shake');
}

// ---------- Keyboard ----------
const KB_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const keyEls = new Map();
function buildKeyboard() {
  keyboardEl.innerHTML = '';
  keyEls.clear();
  KB_ROWS.forEach((row, i) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'wg-kb-row';
    if (i === 2) {
      const enterBtn = document.createElement('button');
      enterBtn.type = 'button';
      enterBtn.className = 'key-btn wide';
      enterBtn.textContent = 'Enter';
      enterBtn.addEventListener('click', submitGuess);
      rowEl.appendChild(enterBtn);
    }
    [...row].forEach((letter) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'key-btn';
      btn.textContent = letter;
      btn.addEventListener('click', () => typeLetter(letter));
      rowEl.appendChild(btn);
      keyEls.set(letter, btn);
    });
    if (i === 2) {
      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'key-btn wide';
      backBtn.textContent = '⌫';
      backBtn.addEventListener('click', backspace);
      rowEl.appendChild(backBtn);
    }
    keyboardEl.appendChild(rowEl);
  });
}
buildKeyboard();

function updateKeyboardColors() {
  keyEls.forEach((btn, letter) => {
    btn.classList.remove('correct', 'present', 'absent');
    const status = letterStatus.get(letter);
    if (status) btn.classList.add(status);
  });
}

function typeLetter(letter) {
  if (!roundActive || myDone || currentGuess.length >= 5) return;
  currentGuess += letter;
  renderCurrentRow();
}

function backspace() {
  if (!roundActive || myDone) return;
  currentGuess = currentGuess.slice(0, -1);
  renderCurrentRow();
}

function submitGuess() {
  if (!roundActive || myDone || currentGuess.length !== 5) {
    if (currentGuess.length !== 5 && roundActive && !myDone) shakeCurrentRow();
    return;
  }
  send({ type: 'wg-guess', guess: currentGuess });
}

document.addEventListener('keydown', (e) => {
  if (playersOverlay && !playersOverlay.classList.contains('hidden')) return;
  if (!roundActive || myDone) return;
  if (e.key === 'Enter') { submitGuess(); return; }
  if (e.key === 'Backspace') { backspace(); return; }
  const letter = e.key.toLowerCase();
  if (/^[a-z]$/.test(letter)) typeLetter(letter);
});

function updateRoundUi() {
  gameStartBtn.classList.toggle('hidden', roundActive);
  startBtn.disabled = roundActive;
  guessCountEl.textContent = roundActive || myDone ? `${myGuessCount}/${MAX_GUESSES}` : '';
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
    send({ type: 'wg-join', code: roomCode, name: myName });
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

function resetBoardForNewRound() {
  myGuessCount = 0;
  myDone = false;
  currentGuess = '';
  letterStatus = new Map();
  buildBoard();
  updateKeyboardColors();
  roundMessageEl.textContent = '';
}

function handleMessage(data) {
  switch (data.type) {
    case 'wg-init':
      players = new Map(data.players.map((p) => [p.id, p]));
      roundActive = data.roundActive;
      lobbyStatusEl.textContent = 'Connected!';
      lobbyEl.classList.add('hidden');
      gameEl.classList.remove('hidden');
      resetBoardForNewRound();
      refreshPlayerLists();
      updateRoundUi();
      roundStatusEl.textContent = roundActive
        ? 'A round is already in progress — guess away!'
        : 'Waiting for a round to start…';
      break;

    case 'wg-player-joined':
      players.set(data.id, { id: data.id, name: data.name, guessCount: data.guessCount, done: data.done, solved: data.solved });
      refreshPlayerLists();
      break;

    case 'wg-player-left':
      players.delete(data.id);
      refreshPlayerLists();
      break;

    case 'wg-full':
      lobbyStatusEl.textContent = 'This game is full (20/20 players).';
      break;

    // Same class of fix as every other minigame's join-error handling in this app — see hm-join-error.
    case 'wg-join-error':
      lobbyStatusEl.textContent = data.message || "Couldn't join this room.";
      break;

    case 'wg-round-start':
      roundActive = true;
      resetBoardForNewRound();
      // A fresh round clears every player's own progress server-side too.
      players.forEach((p) => { p.guessCount = 0; p.done = false; p.solved = false; });
      updateRoundUi();
      refreshPlayerLists();
      roundStatusEl.textContent = 'New word! Guess away.';
      break;

    case 'wg-invalid-word':
      shakeCurrentRow();
      roundMessageEl.textContent = `"${data.guess.toUpperCase()}" isn't in the word list`;
      break;

    case 'wg-guess-result':
      applyFeedbackToRow(myGuessCount, data.guess, data.feedback);
      myGuessCount = data.guessCount;
      myDone = data.done;
      currentGuess = '';
      updateRoundUi();
      if (data.solved) {
        roundMessageEl.textContent = `🎉 Solved it in ${data.guessCount}/${MAX_GUESSES}!`;
      } else if (data.done) {
        roundMessageEl.textContent = `💀 Out of guesses! The word was "${(data.word || '').toUpperCase()}"`;
      } else {
        roundMessageEl.textContent = '';
      }
      break;

    case 'wg-player-progress': {
      const p = players.get(data.id);
      if (p) {
        p.guessCount = data.guessCount;
        p.done = data.done;
        p.solved = data.solved;
      }
      refreshPlayerLists();
      break;
    }

    case 'wg-player-finished':
      if (data.id !== undefined) {
        roundStatusEl.textContent = data.solved
          ? `🎉 ${data.name} solved it in ${data.guessCount}/${MAX_GUESSES}!`
          : `💀 ${data.name} ran out of guesses`;
      }
      break;

    case 'wg-round-end':
      roundActive = false;
      // Anyone who didn't finish (e.g. joined mid-round and never guessed) still learns the
      // answer once the whole room is done, same as every unsolved player already does via their
      // own wg-guess-result.
      if (!myDone) roundMessageEl.textContent = `Round over — the word was "${(data.word || '').toUpperCase()}"`;
      roundStatusEl.textContent = 'Round over! Start a new one whenever you\'re ready.';
      updateRoundUi();
      refreshPlayerLists();
      break;

    case 'wg-leaderboard-result':
      renderLeaderboard(data.scores || []);
      break;
  }
}

startBtn.addEventListener('click', () => send({ type: 'wg-start' }));
gameStartBtn.addEventListener('click', () => send({ type: 'wg-start' }));

window.addEventListener('beforeunload', () => send({ type: 'wg-leave' }));

connect();
