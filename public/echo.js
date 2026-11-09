// ---------- Room/session setup (same ?room=&name= pattern as the other minigames) ----------
const params = new URLSearchParams(location.search);
const roomCode = params.get('room');
const myName = (params.get('name') || 'Player').slice(0, 30);
const backLink = document.getElementById('back-link');
if (roomCode) backLink.href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;

const padsEl = document.getElementById('pads');
const pads = [...document.querySelectorAll('.pad')];
const startBtn = document.getElementById('start-btn');
const statusEl = document.getElementById('status');
const roundEl = document.getElementById('round');
const bestEl = document.getElementById('best');
const soundBtn = document.getElementById('sound-btn');
const leaderboardEl = document.getElementById('leaderboard');

const TONES = [329.63, 261.63, 220.0, 164.81];
let seq = [];
let pos = 0;
let accepting = false;
let playing = false;
let best = 0;
let soundOn = true;
try { best = Number(localStorage.getItem('valk-echo-best')) || 0; soundOn = localStorage.getItem('valk-echo-sound') !== 'off'; } catch {}
bestEl.textContent = `Best: ${best}`;
paintSound();

let audioCtx = null;
function tone(i, ms) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = TONES[i];
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + ms / 1000 + 0.05);
  } catch { /* no audio available */ }
}
function buzz() {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 90;
    g.gain.value = 0.15;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.45);
  } catch { /* no audio available */ }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function flash(i, ms) {
  pads[i].classList.add('lit');
  tone(i, ms);
  await sleep(ms);
  pads[i].classList.remove('lit');
}

function setStatus(text, cls = '') {
  statusEl.textContent = text;
  statusEl.className = `echo-status ${cls}`;
}

async function playSequence() {
  playing = true;
  accepting = false;
  padsEl.classList.add('locked');
  setStatus('Watch…');
  // Gets a little faster as the pattern grows.
  const on = Math.max(220, 520 - seq.length * 18);
  const gap = Math.max(90, 200 - seq.length * 6);
  await sleep(450);
  for (const i of seq) {
    await flash(i, on);
    await sleep(gap);
  }
  playing = false;
  accepting = true;
  pos = 0;
  padsEl.classList.remove('locked');
  setStatus('Your turn!');
}

function nextRound() {
  seq.push(Math.floor(Math.random() * 4));
  roundEl.textContent = `Round ${seq.length}`;
  playSequence();
}

function start() {
  seq = [];
  startBtn.disabled = true;
  startBtn.textContent = '…';
  nextRound();
}

async function press(i) {
  if (!accepting) return;
  flash(i, 200);
  if (i !== seq[pos]) {
    accepting = false;
    buzz();
    const score = seq.length - 1;
    setStatus(score > 0 ? `Oops! You remembered ${score} in a row.` : 'Oops! Try again.', 'bad');
    gameOver(score);
    return;
  }
  pos++;
  if (pos === seq.length) {
    accepting = false;
    setStatus('Nice!', 'good');
    await sleep(500);
    nextRound();
  }
}

function gameOver(score) {
  startBtn.disabled = false;
  startBtn.textContent = 'Again';
  roundEl.textContent = `Round ${seq.length}`;
  if (score > best) {
    best = score;
    bestEl.textContent = `Best: ${best}`;
    try { localStorage.setItem('valk-echo-best', String(best)); } catch {}
  }
  if (score > 0) send({ type: 'arcade-submit-score', score });
}

pads.forEach((p, i) => p.addEventListener('pointerdown', (e) => { e.preventDefault(); press(i); }));
startBtn.addEventListener('click', start);
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const i = ['1', '2', '3', '4'].indexOf(e.key);
  if (i >= 0) press(i);
  if ((e.key === 'Enter' || e.key === ' ') && !startBtn.disabled && document.activeElement !== startBtn) { e.preventDefault(); start(); }
});
function paintSound() {
  soundBtn.textContent = soundOn ? '🔊 Sound on' : '🔇 Sound off';
  soundBtn.setAttribute('aria-pressed', String(soundOn));
}
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  try { localStorage.setItem('valk-echo-sound', soundOn ? 'on' : 'off'); } catch {}
  paintSound();
});

// ---------- Leaderboard (per room) ----------
function renderLeaderboard(scores) {
  leaderboardEl.innerHTML = '';
  const note = (t) => { const li = document.createElement('li'); li.className = 'muted'; li.textContent = t; leaderboardEl.appendChild(li); };
  if (!roomCode) return note('Open Echo from a chat room to get on its leaderboard.');
  if (!scores.length) return note('No scores yet — be the first!');
  for (const s of scores) {
    const li = document.createElement('li');
    li.textContent = s.name;
    const t = document.createElement('span');
    t.className = 'time';
    t.textContent = `${s.score} in a row`;
    li.appendChild(t);
    leaderboardEl.appendChild(li);
  }
}

let ws;
function send(obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
function connect() {
  if (!roomCode) { renderLeaderboard([]); return; }
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);
  ws.addEventListener('open', () => {
    let token = null;
    try { token = localStorage.getItem('valk-account-token'); } catch {}
    send({ type: 'arcade-join', code: roomCode, name: myName, game: 'echo', accountToken: token });
  });
  ws.addEventListener('close', () => setTimeout(connect, 1500));
  ws.addEventListener('message', (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'arcade-leaderboard') renderLeaderboard(data.scores || []);
    if (data.type === 'arcade-join-error') { leaderboardEl.innerHTML = ''; const li = document.createElement('li'); li.className = 'muted'; li.textContent = data.message; leaderboardEl.appendChild(li); }
  });
}
window.addEventListener('beforeunload', () => send({ type: 'arcade-leave' }));
connect();
