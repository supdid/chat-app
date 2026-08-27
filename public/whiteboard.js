// ---------- Room/session setup (same ?room=&name= pattern as buildcraft.js/pictionary.js —
// own WebSocket connection, bypassing join-server/ws.profile). ----------
const mpParams = new URLSearchParams(location.search);
const roomCode = mpParams.get('room');
const myName = (mpParams.get('name') || 'Player').slice(0, 30);

const backLink = document.getElementById('back-link');
if (roomCode) backLink.href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;

const statusLabel = document.getElementById('status-label');
const sendChatBtn = document.getElementById('send-chat-btn');
const clearBtn = document.getElementById('clear-btn');
const board = document.getElementById('board');
const ctx = board.getContext('2d');
const colorSwatchesEl = document.getElementById('color-swatches');
const brushSizeInput = document.getElementById('brush-size');
const toastEl = document.getElementById('toast');

const BOARD_W = 900;
const BOARD_H = 600;
board.width = BOARD_W;
board.height = BOARD_H;
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, BOARD_W, BOARD_H);
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
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.add('hidden'), 2500);
}

// ---------- Drawing input — everyone connected can draw (collaborative, unlike Pictionary) ----------
let isDrawing = false;
let pendingPoints = [];
let lastSentPoint = null;
let lastFlushAt = 0;
const STROKE_FLUSH_MS = 80;

board.addEventListener('pointerdown', (e) => {
  isDrawing = true;
  lastSentPoint = null;
  const p = getBoardPoint(e);
  // Stamped with the color/size active right now, not just {x,y} — see flushStroke's comment on
  // why this matters (a mid-stroke color/size change needs to be tracked per-point to send what
  // was actually drawn).
  pendingPoints = [{ ...p, color: currentColor, size: currentSize }];
  board.setPointerCapture(e.pointerId);
});

board.addEventListener('pointermove', (e) => {
  if (!isDrawing) return;
  const p = getBoardPoint(e);
  const prev = pendingPoints[pendingPoints.length - 1] || lastSentPoint;
  const stamped = { ...p, color: currentColor, size: currentSize };
  pendingPoints.push(stamped);
  if (prev) drawStroke({ points: [prev, stamped], color: currentColor, size: currentSize });
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

// Found by the whiteboard/pictionary drawing-correctness audit: this used to tag the WHOLE
// buffered batch (up to 80ms of points) with whatever currentColor/currentSize was active at
// flush time — if the drawer changed color/size mid-drag (reachable via a second touch point
// tapping a swatch while the first finger still holds the pen, or dragging the size slider while
// the mouse button is held), the drawer's own canvas correctly showed a two-toned segment
// (pointermove always draws with the LIVE color/size), but what got SENT — and so what every
// other live client, and anyone who joins later and replays from storage, ever sees — was the
// whole thing in one wrong color: a genuine, persistent cross-client visual divergence for that
// stroke. Splits the batch into same-style runs (each starting from the previous run's last
// point, so segments still connect with no gap) and sends one wb-stroke per run instead.
function sendStrokeRun(run) {
  if (!run.length) return;
  let points = run.map(({ x, y }) => ({ x, y }));
  // A plain click/tap (pointerdown immediately followed by pointerup with zero pointermove
  // events — normal for a stationary click) buffers exactly one point; a single point can't form
  // a line, so nothing was ever drawn OR sent, silently preventing a click/tap from placing so
  // much as a dot. Duplicating it into a degenerate zero-length segment renders as a filled dot
  // (lineCap is already 'round') instead.
  if (points.length === 1) points = [points[0], points[0]];
  if (points.length < 2) return;
  send({ type: 'wb-stroke', points, color: run[0].color, size: run[0].size });
}

function flushStroke() {
  lastFlushAt = performance.now();
  if (pendingPoints.length === 0) return;
  const pts = pendingPoints;
  pendingPoints = [];
  let run = lastSentPoint ? [{ ...lastSentPoint, color: pts[0].color, size: pts[0].size }] : [];
  for (const p of pts) {
    if (run.length && (p.color !== run[0].color || p.size !== run[0].size)) {
      sendStrokeRun(run);
      run = [{ x: run[run.length - 1].x, y: run[run.length - 1].y, color: p.color, size: p.size }];
    }
    run.push(p);
  }
  sendStrokeRun(run);
  lastSentPoint = { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
}

clearBtn.addEventListener('click', () => {
  clearBoard();
  send({ type: 'wb-clear' });
});

// ---------- Send to chat: canvas -> Blob -> /upload -> /post-media (same pipeline
// AI Studio and Video Editor already use — no new server code needed). ----------
sendChatBtn.addEventListener('click', () => {
  board.toBlob(async (blob) => {
    if (!blob) return;
    sendChatBtn.disabled = true;
    try {
      const formData = new FormData();
      formData.append('file', blob, 'whiteboard.png');
      const uploadRes = await fetch('/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');
      const postRes = await fetch('/post-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, name: myName, mediaUrl: uploadData.url, mediaType: 'image', caption: '🖌️ Whiteboard snapshot' }),
      });
      if (!postRes.ok) throw new Error('Could not post to chat');
      showToast('Sent to chat!');
    } catch (err) {
      showToast(err.message || 'Could not send to chat');
    } finally {
      sendChatBtn.disabled = false;
    }
  }, 'image/png');
});

// ---------- WebSocket ----------
let ws;
function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.addEventListener('open', () => {
    statusLabel.textContent = 'Joining room…';
    send({ type: 'wb-join', code: roomCode, name: myName });
  });

  ws.addEventListener('close', () => {
    statusLabel.textContent = 'Disconnected — reconnecting…';
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

let playerCount = 1;

function handleMessage(data) {
  switch (data.type) {
    case 'wb-init':
      clearBoard();
      (data.strokes || []).forEach(drawStroke);
      playerCount = data.count || 1;
      statusLabel.textContent = playerCount > 1
        ? `${playerCount} people on this board`
        : 'Draw together — everyone in this room can sketch here.';
      fitBoard();
      break;

    case 'wb-player-joined':
      playerCount++;
      statusLabel.textContent = `${playerCount} people on this board`;
      break;

    case 'wb-player-left':
      playerCount = Math.max(1, playerCount - 1);
      statusLabel.textContent = `${playerCount} people on this board`;
      break;

    case 'wb-full':
      statusLabel.textContent = 'This board is full (20/20 people).';
      break;

    // Found by an app-wide audit (surfaced independently by both the Web Swing and Block Battle
    // dimensions, then confirmed present across every minigame in this app via a systematic sweep):
    // a banned player joining any minigame got zero client-side handling for the server's own
    // join-error message — silently stuck on the lobby screen with no explanation. The server never
    // closes the connection for this, so no reconnect-loop guard is needed here.
    case 'wb-join-error':
      statusLabel.textContent = data.message || "Couldn't join this room.";
      break;

    case 'wb-stroke':
      drawStroke(data.stroke);
      break;

    case 'wb-cleared':
      clearBoard();
      showToast('Board cleared');
      break;
  }
}

window.addEventListener('beforeunload', () => send({ type: 'wb-leave' }));

fitBoard();
connect();
