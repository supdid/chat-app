// --- Theme (same toggle behavior as the other tool pages) ---
const themeToggleBtn = document.getElementById('theme-toggle-btn');

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.dataset.theme = 'light';
    themeToggleBtn.textContent = '☀️';
  } else {
    delete document.documentElement.dataset.theme;
    themeToggleBtn.textContent = '🌙';
  }
}

applyTheme(localStorage.getItem('valk-theme') === 'light' ? 'light' : 'dark');

themeToggleBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('valk-theme', next); } catch {}
  applyTheme(next);
});

// --- Carry the room/name from the chat page so "Send to chat" knows where to post ---
const params = new URLSearchParams(location.search);
const roomCode = params.get('room');
const myName = params.get('name');
const roomPin = params.get('pin') || '';
if (roomCode && myName) {
  document.getElementById('back-link').href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;
}

// --- Elements ---
const W = 640, H = 480;
const onionCanvas = document.getElementById('onion-canvas');
const onionCtx = onionCanvas.getContext('2d');
const drawCanvas = document.getElementById('draw-canvas');
const drawCtx = drawCanvas.getContext('2d');
drawCtx.lineCap = 'round';
drawCtx.lineJoin = 'round';

const pencilBtn = document.getElementById('pencil-btn');
const eraserBtn = document.getElementById('eraser-btn');
const colorInput = document.getElementById('color-input');
const sizeInput = document.getElementById('size-input');
const undoBtn = document.getElementById('undo-btn');
const clearBtn = document.getElementById('clear-btn');
const onionCheckbox = document.getElementById('onion-checkbox');
const newBtn = document.getElementById('new-btn');

const playBtn = document.getElementById('play-btn');
const fpsInput = document.getElementById('fps-input');
const fpsReadout = document.getElementById('fps-readout');
const loopCheckbox = document.getElementById('loop-checkbox');
const createGifBtn = document.getElementById('create-gif-btn');

const frameStripEl = document.getElementById('frame-strip');
const addFrameBtn = document.getElementById('add-frame-btn');
const duplicateFrameBtn = document.getElementById('duplicate-frame-btn');
const moveFrameLeftBtn = document.getElementById('move-frame-left-btn');
const moveFrameRightBtn = document.getElementById('move-frame-right-btn');
const deleteFrameBtn = document.getElementById('delete-frame-btn');

const playbackOverlay = document.getElementById('playback-overlay');
const playbackCanvas = document.getElementById('playback-canvas');
const playbackCtx = playbackCanvas.getContext('2d');

const renderProgress = document.getElementById('render-progress');
const renderProgressFill = document.getElementById('render-progress-fill');
const renderStatus = document.getElementById('render-status');
const resultSection = document.getElementById('result-section');
const resultGif = document.getElementById('result-gif');
const downloadBtn = document.getElementById('download-btn');
const sendChatBtn = document.getElementById('send-chat-btn');

// --- Blank-frame data URL, used for new frames and "New" ---
function blankFrameDataUrl() {
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  return off.toDataURL('image/png');
}
const BLANK_FRAME = blankFrameDataUrl();

// --- Project state (autosaved to localStorage so a refresh doesn't lose work) ---
const SAVE_KEY = 'valk-flipbook-project';
let frames = [{ dataUrl: BLANK_FRAME }];
let currentFrameIndex = 0;
let tool = 'pencil';
// Undo only covers the frame currently being edited — switching frames commits and resets it,
// same simplification a lot of single-canvas drawing tools make (whiteboard.js here has no undo
// at all, so this is already ahead of that bar for a first pass).
let undoStack = [];
const UNDO_LIMIT = 20;

let saveProjectTimer = null;
function saveProject() {
  clearTimeout(saveProjectTimer);
  saveProjectTimer = null;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ frames, currentFrameIndex })); } catch {}
}

// Re-serializing every frame's full base64 PNG on every single stroke (saveCurrentFrameCanvas
// fires on each pointerup/undo/clear) is wasted work once a project has more than a few frames —
// coalesce those into one write shortly after drawing pauses. Anything that isn't a
// mid-drawing autosave (switching frames, add/delete/reorder, New) still calls saveProject()
// directly for an immediate, un-debounced write.
function saveProjectDebounced() {
  clearTimeout(saveProjectTimer);
  saveProjectTimer = setTimeout(saveProject, 500);
}

function loadProject() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (saved && Array.isArray(saved.frames) && saved.frames.length) {
      frames = saved.frames;
      currentFrameIndex = Math.min(Math.max(0, saved.currentFrameIndex || 0), frames.length - 1);
    }
  } catch {}
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// --- Rendering the current frame + onion skin ---
async function renderCurrentFrame() {
  drawCtx.clearRect(0, 0, W, H);
  const img = await loadImage(frames[currentFrameIndex].dataUrl);
  if (img) drawCtx.drawImage(img, 0, 0);
  await renderOnionSkin();
}

async function renderOnionSkin() {
  onionCtx.clearRect(0, 0, W, H);
  if (!onionCheckbox.checked || currentFrameIndex === 0) return;
  const img = await loadImage(frames[currentFrameIndex - 1].dataUrl);
  if (img) onionCtx.drawImage(img, 0, 0);
}

function saveCurrentFrameCanvas() {
  frames[currentFrameIndex].dataUrl = drawCanvas.toDataURL('image/png');
  saveProjectDebounced();
}

// --- Frame strip UI ---
function updateFrameActionButtons() {
  deleteFrameBtn.disabled = frames.length <= 1;
  moveFrameLeftBtn.disabled = currentFrameIndex === 0;
  moveFrameRightBtn.disabled = currentFrameIndex === frames.length - 1;
}

function renderFrameStrip() {
  frameStripEl.innerHTML = '';
  frames.forEach((frame, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'frame-thumb' + (i === currentFrameIndex ? ' selected' : '');
    btn.setAttribute('aria-label', `Frame ${i + 1}`);
    const img = document.createElement('img');
    img.src = frame.dataUrl;
    btn.appendChild(img);
    const num = document.createElement('span');
    num.className = 'frame-num';
    num.textContent = String(i + 1);
    btn.appendChild(num);
    btn.addEventListener('click', () => selectFrame(i));
    frameStripEl.appendChild(btn);
  });
  updateFrameActionButtons();
}

// Cheaper than renderFrameStrip() for a plain selection change (no frame added/removed/moved) —
// re-decoding and re-appending every thumbnail just to shift which one has the "selected" border
// gets expensive once a project has many frames.
function updateFrameStripSelection() {
  frameStripEl.querySelectorAll('.frame-thumb').forEach((el, i) => {
    el.classList.toggle('selected', i === currentFrameIndex);
  });
  updateFrameActionButtons();
}

async function selectFrame(index, { rebuildStrip = false } = {}) {
  if (index < 0 || index >= frames.length || index === currentFrameIndex) return;
  currentFrameIndex = index;
  undoStack = [];
  updateUndoBtn();
  await renderCurrentFrame();
  if (rebuildStrip) renderFrameStrip();
  else updateFrameStripSelection();
  saveProject();
}

// --- Frame actions ---
addFrameBtn.addEventListener('click', async () => {
  frames.splice(currentFrameIndex + 1, 0, { dataUrl: BLANK_FRAME });
  await selectFrame(currentFrameIndex + 1, { rebuildStrip: true });
});

duplicateFrameBtn.addEventListener('click', async () => {
  frames.splice(currentFrameIndex + 1, 0, { dataUrl: frames[currentFrameIndex].dataUrl });
  await selectFrame(currentFrameIndex + 1, { rebuildStrip: true });
});

moveFrameLeftBtn.addEventListener('click', async () => {
  if (currentFrameIndex === 0) return;
  const i = currentFrameIndex;
  [frames[i - 1], frames[i]] = [frames[i], frames[i - 1]];
  currentFrameIndex = i - 1;
  undoStack = [];
  updateUndoBtn();
  await renderCurrentFrame();
  renderFrameStrip();
  saveProject();
});

moveFrameRightBtn.addEventListener('click', async () => {
  if (currentFrameIndex === frames.length - 1) return;
  const i = currentFrameIndex;
  [frames[i], frames[i + 1]] = [frames[i + 1], frames[i]];
  currentFrameIndex = i + 1;
  undoStack = [];
  updateUndoBtn();
  await renderCurrentFrame();
  renderFrameStrip();
  saveProject();
});

deleteFrameBtn.addEventListener('click', async () => {
  if (frames.length <= 1) return;
  frames.splice(currentFrameIndex, 1);
  currentFrameIndex = Math.min(currentFrameIndex, frames.length - 1);
  undoStack = [];
  updateUndoBtn();
  await renderCurrentFrame();
  renderFrameStrip();
  saveProject();
});

newBtn.addEventListener('click', async () => {
  if (!confirm('Start a new flipbook? This clears every frame you’ve drawn.')) return;
  frames = [{ dataUrl: BLANK_FRAME }];
  currentFrameIndex = 0;
  undoStack = [];
  updateUndoBtn();
  resultSection.classList.add('hidden');
  await renderCurrentFrame();
  renderFrameStrip();
  saveProject();
});

onionCheckbox.addEventListener('change', renderOnionSkin);

// --- Tools ---
pencilBtn.addEventListener('click', () => setTool('pencil'));
eraserBtn.addEventListener('click', () => setTool('eraser'));

function setTool(next) {
  tool = next;
  pencilBtn.classList.toggle('active', tool === 'pencil');
  eraserBtn.classList.toggle('active', tool === 'eraser');
}

function updateUndoBtn() {
  undoBtn.disabled = undoStack.length === 0;
}

clearBtn.addEventListener('click', () => {
  pushUndo();
  drawCtx.clearRect(0, 0, W, H);
  saveCurrentFrameCanvas();
  renderFrameStrip();
});

undoBtn.addEventListener('click', () => {
  const prev = undoStack.pop();
  if (!prev) return;
  updateUndoBtn();
  loadImage(prev).then((img) => {
    drawCtx.clearRect(0, 0, W, H);
    if (img) drawCtx.drawImage(img, 0, 0);
    saveCurrentFrameCanvas();
    renderFrameStrip();
  });
});

function pushUndo() {
  undoStack.push(drawCanvas.toDataURL('image/png'));
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  updateUndoBtn();
}

// --- Drawing input (pointer events + canvas-space coordinate mapping, same approach as
// whiteboard.js's board) ---
let isDrawing = false;
let lastPoint = null;

function getCanvasPoint(e) {
  const rect = drawCanvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) * W) / rect.width,
    y: ((e.clientY - rect.top) * H) / rect.height,
  };
}

function strokeSegment(from, to) {
  drawCtx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
  drawCtx.strokeStyle = colorInput.value;
  drawCtx.lineWidth = +sizeInput.value;
  drawCtx.beginPath();
  drawCtx.moveTo(from.x, from.y);
  drawCtx.lineTo(to.x, to.y);
  drawCtx.stroke();
}

drawCanvas.addEventListener('pointerdown', (e) => {
  isDrawing = true;
  pushUndo();
  lastPoint = getCanvasPoint(e);
  // A tap with no movement should still leave a dot, not nothing.
  strokeSegment(lastPoint, lastPoint);
  drawCanvas.setPointerCapture(e.pointerId);
});

drawCanvas.addEventListener('pointermove', (e) => {
  if (!isDrawing) return;
  const p = getCanvasPoint(e);
  strokeSegment(lastPoint, p);
  lastPoint = p;
});

['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) => {
  drawCanvas.addEventListener(evt, () => {
    if (!isDrawing) return;
    isDrawing = false;
    drawCtx.globalCompositeOperation = 'source-over';
    saveCurrentFrameCanvas();
    renderFrameStrip();
  });
});

// --- Playback ---
let playing = false;
let playTimer = null;

fpsInput.addEventListener('input', () => {
  fpsReadout.textContent = `${fpsInput.value} fps`;
});

function stopPlayback() {
  playing = false;
  clearTimeout(playTimer);
  playbackOverlay.classList.add('hidden');
  playBtn.textContent = '▶️ Play';
}

function startPlayback() {
  if (frames.length < 1) return;
  playing = true;
  playbackOverlay.classList.remove('hidden');
  playBtn.textContent = '⏸️ Stop';
  let i = 0;
  const step = () => {
    if (!playing) return;
    loadImage(frames[i].dataUrl).then((img) => {
      if (!playing) return;
      playbackCtx.fillStyle = '#ffffff';
      playbackCtx.fillRect(0, 0, W, H);
      if (img) playbackCtx.drawImage(img, 0, 0);
      i++;
      if (i >= frames.length) {
        if (!loopCheckbox.checked) {
          stopPlayback();
          return;
        }
        i = 0;
      }
      playTimer = setTimeout(step, 1000 / +fpsInput.value);
    });
  };
  step();
}

playBtn.addEventListener('click', () => {
  if (playing) stopPlayback();
  else startPlayback();
});

// --- GIF export (gif.js is self-hosted, not CDN-loaded — see flipbook.html's comment: it
// spawns its own Worker, and a Worker can't be constructed from a cross-origin script URL) ---
let resultBlob = null;
let resultUrl = null;

function renderGif() {
  return new Promise(async (resolve, reject) => {
    const gif = new GIF({ workers: 2, quality: 10, width: W, height: H, workerScript: 'vendor/gifjs/gif.worker.js' });
    const delayMs = Math.round(1000 / +fpsInput.value);
    for (const frame of frames) {
      const img = await loadImage(frame.dataUrl);
      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const octx = off.getContext('2d');
      // Frames are stored with a transparent background (so onion skin shows through) — GIF
      // export flattens each one onto solid white, same color the canvas stage's own backdrop
      // already shows during editing, so the exported animation looks the same as the preview.
      octx.fillStyle = '#ffffff';
      octx.fillRect(0, 0, W, H);
      if (img) octx.drawImage(img, 0, 0);
      gif.addFrame(octx, { delay: delayMs, copy: true });
    }
    gif.on('progress', (p) => {
      renderProgressFill.style.width = `${Math.round(p * 100)}%`;
    });
    gif.on('finished', (blob) => resolve(blob));
    gif.on('abort', () => reject(new Error('Render was aborted')));
    gif.render();
  });
}

createGifBtn.addEventListener('click', async () => {
  stopPlayback();
  createGifBtn.disabled = true;
  resultSection.classList.add('hidden');
  renderProgress.classList.remove('hidden');
  renderProgressFill.style.width = '0%';
  renderStatus.textContent = 'Rendering your animation…';
  try {
    const blob = await renderGif();
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultBlob = blob;
    resultUrl = URL.createObjectURL(blob);
    resultGif.src = resultUrl;
    sendChatBtn.classList.toggle('hidden', !(roomCode && myName));
    resultSection.classList.remove('hidden');
  } catch (err) {
    renderStatus.textContent = 'Could not render the animation — try again.';
    reportClientError('Flipbook GIF render failed', err && err.stack);
  } finally {
    renderProgress.classList.add('hidden');
    createGifBtn.disabled = false;
  }
});

downloadBtn.addEventListener('click', () => {
  if (!resultUrl) return;
  const link = document.createElement('a');
  link.href = resultUrl;
  link.download = `valk-flipbook-${Date.now()}.gif`;
  link.click();
});

sendChatBtn.addEventListener('click', async () => {
  if (!resultBlob || !roomCode || !myName) return;
  sendChatBtn.disabled = true;
  const original = sendChatBtn.textContent;
  try {
    const formData = new FormData();
    formData.append('file', resultBlob, `valk-flipbook-${Date.now()}.gif`);
    const uploadRes = await fetch('/upload', { method: 'POST', body: formData });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.url) throw new Error();
    const accountToken = localStorage.getItem('valk-account-token');
    const postHeaders = { 'Content-Type': 'application/json' };
    if (accountToken) postHeaders.Authorization = `Bearer ${accountToken}`;
    const postRes = await fetch('/post-media', {
      method: 'POST',
      headers: postHeaders,
      body: JSON.stringify({ code: roomCode, name: myName, pin: roomPin, mediaUrl: uploadData.url, mediaType: 'image', caption: '🎬 Flipbook animation' }),
    });
    if (!postRes.ok) throw new Error();
    sendChatBtn.textContent = '✅ Sent!';
  } catch {
    sendChatBtn.textContent = '❌ Failed';
  } finally {
    setTimeout(() => { sendChatBtn.textContent = original; sendChatBtn.disabled = false; }, 1600);
  }
});

// --- Init ---
loadProject();
renderCurrentFrame();
renderFrameStrip();
fpsReadout.textContent = `${fpsInput.value} fps`;
