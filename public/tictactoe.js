// ---------- Room/session setup (same ?room=&name= pattern as pictionary.js/trivia.js —
// this page opens its own WebSocket connection, bypassing join-server/ws.profile entirely). ----------
const mpParams = new URLSearchParams(location.search);
const roomCode = mpParams.get('room');
const myName = (mpParams.get('name') || 'Player').slice(0, 30);

const backLink = document.getElementById('back-link');
if (roomCode) backLink.href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;

const titleEl = document.getElementById('title');
const lobbyEl = document.getElementById('lobby');
const lobbyStatusEl = document.getElementById('lobby-status');
const lobbyPlayersEl = document.getElementById('lobby-players');
const modeTictactoeBtn = document.getElementById('mode-tictactoe-btn');
const modeConnect4Btn = document.getElementById('mode-connect4-btn');
const gameEl = document.getElementById('game');
const roundStatusEl = document.getElementById('round-status');
const rematchBtn = document.getElementById('rematch-btn');
const boardEl = document.getElementById('board');
const seatBarEl = document.getElementById('seat-bar');
const claimXBtn = document.getElementById('claim-x-btn');

// Must match TT_MODES on the server.
const TT_MODES = {
  tictactoe: { width: 3, height: 3, winLength: 3 },
  connect4: { width: 7, height: 6, winLength: 4 },
};
const SYMBOL_EMOJI = {
  tictactoe: { X: '❌', O: '⭕' },
  connect4: { X: '🔴', O: '🟡' },
};

let myId = null;
let state = null; // { mode, board, turn, winner, xId, oId, players }

function playerName(id) {
  const p = state && state.players.find((pl) => pl.id === id);
  return p ? p.name : '…';
}

function mySymbol() {
  const p = state && state.players.find((pl) => pl.id === myId);
  return p ? p.symbol : null;
}

function renderPlayerList() {
  lobbyPlayersEl.innerHTML = '';
  if (!state) return;
  state.players.forEach((p) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    const tag = p.symbol ? ` (${SYMBOL_EMOJI[state.mode][p.symbol]})` : ' (watching)';
    name.textContent = `${p.name}${tag}`;
    const score = document.createElement('span');
    score.className = 'score';
    score.textContent = p.wins ? `${p.wins} win${p.wins === 1 ? '' : 's'}` : '';
    li.append(name, score);
    lobbyPlayersEl.appendChild(li);
  });
}

function renderBoard() {
  if (!state) return;
  const cfg = TT_MODES[state.mode];
  boardEl.className = `mode-${state.mode}`;
  boardEl.style.gridTemplateColumns = `repeat(${cfg.width}, 1fr)`;
  boardEl.innerHTML = '';
  const emoji = SYMBOL_EMOJI[state.mode];
  for (let row = 0; row < cfg.height; row++) {
    for (let col = 0; col < cfg.width; col++) {
      const idx = row * cfg.width + col;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      const val = state.board[idx];
      if (val) cell.textContent = emoji[val];
      cell.disabled = !!val || !!state.winner;
      cell.addEventListener('click', () => {
        if (state.mode === 'connect4') send({ type: 'tt-move', col });
        else send({ type: 'tt-move', col, row });
      });
      boardEl.appendChild(cell);
    }
  }
}

function renderStatus() {
  if (!state) return;
  const sym = mySymbol();
  if (state.winner === 'draw') {
    roundStatusEl.textContent = "It's a draw!";
  } else if (state.winner) {
    const winnerId = state.winner === 'X' ? state.xId : state.oId;
    roundStatusEl.textContent = winnerId === myId ? '🎉 You win!' : `${playerName(winnerId)} wins!`;
  } else if (!state.xId || !state.oId) {
    roundStatusEl.textContent = 'Waiting for a second player…';
  } else if (sym) {
    roundStatusEl.textContent = sym === state.turn ? 'Your move!' : `${playerName(state.turn === 'X' ? state.xId : state.oId)}'s move…`;
  } else {
    roundStatusEl.textContent = `${playerName(state.turn === 'X' ? state.xId : state.oId)}'s move…`;
  }
  rematchBtn.classList.toggle('hidden', !state.winner);
  const openSeat = !state.xId || !state.oId;
  seatBarEl.classList.toggle('hidden', !(!sym && openSeat));
  [modeTictactoeBtn, modeConnect4Btn].forEach((btn) => btn.classList.remove('active'));
  (state.mode === 'connect4' ? modeConnect4Btn : modeTictactoeBtn).classList.add('active');
  titleEl.textContent = state.mode === 'connect4' ? '🔴 Connect Four' : '⭕ Tic-Tac-Toe';
  const boardLocked = state.board.some((c) => c);
  modeTictactoeBtn.disabled = boardLocked;
  modeConnect4Btn.disabled = boardLocked;
}

function renderAll() {
  renderPlayerList();
  renderBoard();
  renderStatus();
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
    send({ type: 'tt-join', code: roomCode, name: myName });
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
    case 'tt-init':
      myId = data.id;
      state = data.state;
      lobbyStatusEl.textContent = 'Connected!';
      lobbyEl.classList.add('hidden');
      gameEl.classList.remove('hidden');
      renderAll();
      break;

    case 'tt-full':
      lobbyStatusEl.textContent = 'This game is full (20/20 players).';
      break;

    case 'tt-player-joined':
      if (state) {
        state.players.push({ id: data.id, name: data.name, symbol: data.symbol, wins: 0 });
        if (data.symbol === 'X') state.xId = data.id;
        else if (data.symbol === 'O') state.oId = data.id;
        renderAll();
      }
      break;

    case 'tt-player-left':
      if (state) {
        state.players = state.players.filter((p) => p.id !== data.id);
        if (state.xId === data.id) state.xId = null;
        if (state.oId === data.id) state.oId = null;
        renderAll();
      }
      break;

    case 'tt-state':
      state = data.state;
      renderAll();
      break;
  }
}

modeTictactoeBtn.addEventListener('click', () => send({ type: 'tt-set-mode', mode: 'tictactoe' }));
modeConnect4Btn.addEventListener('click', () => send({ type: 'tt-set-mode', mode: 'connect4' }));
claimXBtn.addEventListener('click', () => send({ type: 'tt-claim-seat' }));
rematchBtn.addEventListener('click', () => send({ type: 'tt-rematch' }));

window.addEventListener('beforeunload', () => send({ type: 'tt-leave' }));

connect();
