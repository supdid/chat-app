// ---------- Room/session setup (same ?room=&name= pattern as tictactoe.js/trivia.js —
// this page opens its own WebSocket connection, bypassing join-server/ws.profile entirely). ----------
const mpParams = new URLSearchParams(location.search);
const roomCode = mpParams.get('room');
const myName = (mpParams.get('name') || 'Player').slice(0, 30);

const backLink = document.getElementById('back-link');
if (roomCode) backLink.href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;

const lobbyEl = document.getElementById('lobby');
const lobbyStatusEl = document.getElementById('lobby-status');
const lobbyPlayersEl = document.getElementById('lobby-players');
const gameEl = document.getElementById('game');
const roundStatusEl = document.getElementById('round-status');
const rematchBtn = document.getElementById('rematch-btn');
const boardEl = document.getElementById('board');
const seatBarEl = document.getElementById('seat-bar');
const claimSeatBtn = document.getElementById('claim-seat-btn');
const seatBarFullHintEl = document.getElementById('seat-bar-full-hint');

const PIECE_GLYPH = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
};

let myId = null;
let state = null; // { board, turn, winner, whiteId, blackId, inCheck, players }
let selected = null; // { row, col } of the currently selected piece, or null

function playerName(id) {
  const p = state && state.players.find((pl) => pl.id === id);
  return p ? p.name : '…';
}

function myColor() {
  const p = state && state.players.find((pl) => pl.id === myId);
  return p ? p.color : null;
}

function renderPlayerList() {
  lobbyPlayersEl.innerHTML = '';
  if (!state) return;
  state.players.forEach((p) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    const tag = p.color ? ` (${p.color === 'white' ? '⚪' : '⚫'})` : ' (watching)';
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
  boardEl.innerHTML = '';
  const flipped = myColor() === 'black';
  const rowsOrder = flipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const colsOrder = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  rowsOrder.forEach((row) => {
    colsOrder.forEach((col) => {
      const idx = row * 8 + col;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell ' + ((row + col) % 2 === 0 ? 'dark' : 'light');
      if (selected && selected.row === row && selected.col === col) cell.classList.add('selected');
      const piece = state.board[idx];
      if (piece) {
        cell.textContent = PIECE_GLYPH[piece.color][piece.type];
        cell.classList.add(`piece-${piece.color}`);
      }
      cell.addEventListener('click', () => onCellClick(row, col));
      boardEl.appendChild(cell);
    });
  });
}

function onCellClick(row, col) {
  if (!state || state.winner) return;
  const color = myColor();
  if (!color || color !== state.turn) return;
  const piece = state.board[row * 8 + col];
  if (selected) {
    if (selected.row === row && selected.col === col) {
      selected = null;
      renderBoard();
      return;
    }
    if (piece && piece.color === color) {
      selected = { row, col };
      renderBoard();
      return;
    }
    send({ type: 'ch-move', from: selected, to: { row, col } });
    selected = null;
    renderBoard();
    return;
  }
  if (piece && piece.color === color) {
    selected = { row, col };
    renderBoard();
  }
}

function renderStatus() {
  if (!state) return;
  const color = myColor();
  if (state.winner === 'draw') {
    roundStatusEl.textContent = 'Stalemate — draw!';
  } else if (state.winner) {
    const winnerId = state.winner === 'white' ? state.whiteId : state.blackId;
    roundStatusEl.textContent = winnerId === myId ? '🎉 Checkmate — you win!' : `Checkmate — ${playerName(winnerId)} wins!`;
  } else if (!state.whiteId || !state.blackId) {
    roundStatusEl.textContent = 'Waiting for a second player…';
  } else {
    const turnName = playerName(state.turn === 'white' ? state.whiteId : state.blackId);
    const checkNote = state.inCheck ? ' (in check!)' : '';
    roundStatusEl.textContent = color === state.turn
      ? `Your move${checkNote}`
      : `${turnName}'s move${checkNote}…`;
  }
  rematchBtn.classList.toggle('hidden', !state.winner);
  // Found by the turn-based-minigame UI correctness audit: this only ever showed the "You're
  // watching" bar when a seat was ALSO still open — once both seats fill, a 3rd+ joiner got no
  // indication anywhere that they're spectating (the board renders as ordinary buttons, clicking
  // does nothing, with nothing on screen ever explaining why). Now shown for anyone unseated
  // regardless of seat availability; only the "Play" button itself is conditional on one actually
  // being open.
  const openSeat = !state.whiteId || !state.blackId;
  seatBarEl.classList.toggle('hidden', !!color);
  claimSeatBtn.classList.toggle('hidden', !openSeat);
  seatBarFullHintEl.classList.toggle('hidden', openSeat);
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
    send({ type: 'ch-join', code: roomCode, name: myName });
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
    case 'ch-init':
      myId = data.id;
      state = data.state;
      // A reconnect (the WS auto-reconnects in-place, same JS context, no page reload) re-fires
      // ch-init, not ch-state — without clearing this too, a piece selected right before a brief
      // disconnect stayed highlighted against a state that may have moved on (opponent's turn,
      // a different piece there now, or you're no longer even seated).
      selected = null;
      lobbyStatusEl.textContent = 'Connected!';
      lobbyEl.classList.add('hidden');
      gameEl.classList.remove('hidden');
      renderAll();
      break;

    case 'ch-full':
      lobbyStatusEl.textContent = 'This game is full (20/20 players).';
      break;

    case 'ch-player-joined':
      if (state) {
        state.players.push({ id: data.id, name: data.name, color: data.color, wins: 0 });
        if (data.color === 'white') state.whiteId = data.id;
        else if (data.color === 'black') state.blackId = data.id;
        renderAll();
      }
      break;

    case 'ch-player-left':
      if (state) {
        state.players = state.players.filter((p) => p.id !== data.id);
        if (state.whiteId === data.id) state.whiteId = null;
        if (state.blackId === data.id) state.blackId = null;
        renderAll();
      }
      break;

    case 'ch-state':
      state = data.state;
      selected = null;
      renderAll();
      break;
  }
}

claimSeatBtn.addEventListener('click', () => send({ type: 'ch-claim-seat' }));
rematchBtn.addEventListener('click', () => send({ type: 'ch-rematch' }));

window.addEventListener('beforeunload', () => send({ type: 'ch-leave' }));

connect();
