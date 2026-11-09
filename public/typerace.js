// Type Race — everyone in the room types the same passage. The server picks the passage, sets the
// start time, and works out each finisher's WPM from its own clock; this page just shows the
// race and reports how many characters you've typed correctly so far.
const params = new URLSearchParams(location.search);
const roomCode = params.get('room');
const myName = (params.get('name') || 'Player').slice(0, 30);

const backLink = document.getElementById('back-link');
if (roomCode) backLink.href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;

const lanesEl = document.getElementById('lanes');
const statusEl = document.getElementById('status');
const passageEl = document.getElementById('passage');
const inputEl = document.getElementById('type-input');
const startBtn = document.getElementById('start-btn');
const myWpmEl = document.getElementById('my-wpm');
const myAccEl = document.getElementById('my-acc');
const myTimeEl = document.getElementById('my-time');
const resultsEl = document.getElementById('results');
const resultsList = document.getElementById('results-list');
const leaderboardEl = document.getElementById('leaderboard');
const countdownEl = document.getElementById('countdown');

let ws = null;
let myId = null;
let players = new Map(); // id -> { id, name, chars, wpm, place, racing }
let state = 'idle';
let text = '';
let startAtLocal = 0;
let clockOffset = 0; // serverNow - localNow
let racing = false; // am I in the current race
let finished = false;
let keystrokes = 0;
let mistakes = 0;
let lastSentChars = 0;
let lastSentAt = 0;
let tickTimer = null;

const CARS = ['🏎️', '🚗', '🚙', '🚕', '🚓', '🛻', '🚌', '🏍️', '🚜', '🚒'];
function carFor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CARS[h % CARS.length];
}

function setStatus(msg) { statusEl.textContent = msg; }

// ---------- Rendering ----------
function renderLanes() {
  lanesEl.textContent = '';
  const list = [...players.values()].sort((a, b) => (a.id === myId ? -1 : b.id === myId ? 1 : 0));
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.style.margin = '0';
    p.textContent = 'Nobody here yet.';
    lanesEl.appendChild(p);
    return;
  }
  for (const p of list) {
    const lane = document.createElement('div');
    lane.className = 'lane' + (p.id === myId ? ' me' : '') + (state !== 'idle' && !p.racing ? ' waiting' : '') + (p.place ? ' finished' : '');
    const name = document.createElement('span');
    name.className = 'lane-name';
    name.textContent = (p.place ? ['🥇', '🥈', '🥉'][p.place - 1] || `#${p.place}` : '') + ' ' + p.name + (p.id === myId ? ' (you)' : '');
    const track = document.createElement('div');
    track.className = 'lane-track';
    const car = document.createElement('span');
    car.className = 'lane-car';
    car.textContent = carFor(p.id);
    // Cars stay where they finished until the next race starts (chars reset then).
    const pct = text ? Math.min(1, (p.chars || 0) / text.length) : 0;
    car.style.left = `calc(${pct} * (100% - 2.4rem))`;
    track.appendChild(car);
    const wpm = document.createElement('span');
    wpm.className = 'lane-wpm';
    wpm.textContent = state !== 'idle' && !p.racing ? 'next race' : `${p.wpm || 0} WPM`;
    if (state === 'idle' && !p.place && p.chars && p.chars < (text || '').length) wpm.textContent += ' ⏱️';
    lane.append(name, track, wpm);
    lanesEl.appendChild(lane);
  }
}

function correctPrefixLength(typed) {
  let i = 0;
  while (i < typed.length && i < text.length && typed[i] === text[i]) i++;
  return i;
}

function renderPassage() {
  passageEl.textContent = '';
  if (!text) {
    passageEl.classList.add('empty');
    passageEl.textContent = state === 'idle' ? 'Press "Start a race" — everyone in the room races on the same sentence.' : '';
    return;
  }
  passageEl.classList.remove('empty');
  const typed = inputEl.value;
  const ok = correctPrefixLength(typed);
  const bad = Math.max(0, Math.min(typed.length, text.length) - ok);
  const parts = [
    ['ok', text.slice(0, ok)],
    ['bad', text.slice(ok, ok + bad)],
    ['cur', text.slice(ok + bad, ok + bad + 1)],
    ['todo', text.slice(ok + bad + 1)],
  ];
  for (const [cls, str] of parts) {
    if (!str) continue;
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = str;
    passageEl.appendChild(span);
  }
}

function updateMyStats() {
  const elapsed = Math.max(0, Date.now() - startAtLocal);
  const ok = correctPrefixLength(inputEl.value);
  const wpm = elapsed > 1000 ? Math.round((ok / 5) / (elapsed / 60000)) : 0;
  if (!finished) myWpmEl.textContent = `${wpm} WPM`;
  const acc = keystrokes ? Math.max(0, Math.round(((keystrokes - mistakes) / keystrokes) * 100)) : 100;
  myAccEl.textContent = `${acc}% accuracy`;
  if (racing && !finished && Date.now() >= startAtLocal) myTimeEl.textContent = `${(elapsed / 1000).toFixed(1)}s`;
}

// ---------- Typing ----------
inputEl.addEventListener('paste', (e) => e.preventDefault()); // no pasting the sentence in
inputEl.addEventListener('drop', (e) => e.preventDefault());
let prevValue = '';
inputEl.addEventListener('input', () => {
  if (!racing || finished) return;
  let v = inputEl.value;
  // Can't run more than a few characters past a mistake — fix it first.
  const ok = correctPrefixLength(v);
  if (v.length > ok + 6) { v = v.slice(0, ok + 6); inputEl.value = v; }
  if (v.length > prevValue.length) {
    const added = v.length - prevValue.length;
    keystrokes += added;
    if (correctPrefixLength(v) < v.length) mistakes += 1;
  }
  prevValue = v;
  inputEl.classList.toggle('error', correctPrefixLength(v) < v.length);
  renderPassage();
  updateMyStats();
  const me = players.get(myId);
  const chars = correctPrefixLength(v);
  if (me) { me.chars = chars; renderLanes(); }
  sendProgress(chars, chars >= text.length);
});

function sendProgress(chars, force) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const now = Date.now();
  if (!force && (chars === lastSentChars || now - lastSentAt < 120)) {
    // Make sure the latest count still goes out shortly after a burst of typing.
    clearTimeout(sendProgress.t);
    sendProgress.t = setTimeout(() => sendProgress(correctPrefixLength(inputEl.value), true), 140);
    return;
  }
  lastSentChars = chars;
  lastSentAt = now;
  ws.send(JSON.stringify({ type: 'tr-progress', chars }));
}

// ---------- Race flow ----------
function beginRace(data) {
  text = data.text;
  clockOffset = data.now - Date.now();
  startAtLocal = data.startAt - clockOffset;
  state = 'racing';
  players = new Map((data.players || []).map((p) => [p.id, p]));
  racing = !!(players.get(myId) && players.get(myId).racing);
  finished = false;
  keystrokes = 0;
  mistakes = 0;
  lastSentChars = 0;
  prevValue = '';
  inputEl.value = '';
  inputEl.classList.remove('error');
  inputEl.disabled = true;
  inputEl.placeholder = 'Get ready…';
  myWpmEl.textContent = '0 WPM';
  myTimeEl.textContent = '';
  resultsEl.classList.add('hidden');
  startBtn.disabled = true;
  renderPassage();
  renderLanes();
  runCountdown();
}

function runCountdown() {
  clearInterval(tickTimer);
  const tick = () => {
    const left = startAtLocal - Date.now();
    if (left > 0) {
      countdownEl.classList.remove('hidden');
      countdownEl.textContent = String(Math.ceil(left / 1000));
      setStatus(racing ? 'Get ready…' : 'A race is starting — you can join the next one!');
      return;
    }
    if (!countdownEl.classList.contains('hidden')) {
      countdownEl.textContent = 'GO!';
      setTimeout(() => countdownEl.classList.add('hidden'), 450);
      if (racing) {
        inputEl.disabled = false;
        inputEl.placeholder = 'Type the sentence above…';
        inputEl.focus();
        setStatus('Go go go! Type the sentence exactly — mistakes turn red.');
      } else {
        setStatus('Race in progress — you can join the next one.');
      }
    }
    updateMyStats();
  };
  tick();
  tickTimer = setInterval(tick, 100);
}

function showResults(results) {
  resultsList.textContent = '';
  if (!results.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Nobody finished.';
    resultsList.appendChild(li);
  }
  for (const r of results) {
    const li = document.createElement('li');
    const medal = r.finished ? (['🥇', '🥈', '🥉'][r.place - 1] || '') : '⏱️';
    li.append(`${medal} ${r.name}${r.id === myId ? ' (you)' : ''}`);
    const w = document.createElement('span');
    w.className = 'wpm';
    w.textContent = `${r.wpm} WPM${r.finished ? '' : ' (didn’t finish)'}`;
    li.appendChild(w);
    resultsList.appendChild(li);
  }
  resultsEl.classList.remove('hidden');
}

function requestLeaderboard() {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'tr-leaderboard' }));
}

function renderLeaderboard(scores) {
  leaderboardEl.textContent = '';
  if (!scores.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No races finished in this room yet — be the first!';
    leaderboardEl.appendChild(li);
    return;
  }
  for (const s of scores) {
    const li = document.createElement('li');
    li.append(s.name);
    const w = document.createElement('span');
    w.className = 'wpm';
    w.textContent = `${s.score} WPM`;
    li.appendChild(w);
    leaderboardEl.appendChild(li);
  }
}

startBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'tr-start' }));
});

// ---------- Connection ----------
function connect() {
  if (!roomCode) {
    setStatus('Open Type Race from a chat room (menu → ⌨️ Type Race) to race your friends.');
    startBtn.disabled = true;
    return;
  }
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const sock = new WebSocket(`${protocol}//${location.host}`);
  ws = sock;
  sock.addEventListener('open', () => {
    sock.send(JSON.stringify({ type: 'tr-join', code: roomCode, name: myName, accountToken: localStorage.getItem('valk-account-token') }));
  });
  sock.addEventListener('message', (event) => {
    if (ws !== sock) return;
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    switch (data.type) {
      case 'tr-init':
        myId = data.id;
        players = new Map(data.players.map((p) => [p.id, p]));
        state = data.state;
        text = data.text || '';
        if (state !== 'idle') {
          clockOffset = data.now - Date.now();
          startAtLocal = data.startAt - clockOffset;
          racing = false;
          startBtn.disabled = true;
          runCountdown();
        } else {
          startBtn.disabled = false;
          setStatus(players.size > 1 ? `${players.size} racers here. Press Start when everyone's ready!` : 'Waiting for friends — or start a race and practice solo.');
        }
        renderPassage();
        renderLanes();
        requestLeaderboard();
        break;
      case 'tr-player-joined':
        players.set(data.id, { id: data.id, name: data.name, chars: 0, wpm: 0, place: null, racing: false });
        renderLanes();
        if (state === 'idle') setStatus(`${data.name} joined! ${players.size} racers here.`);
        break;
      case 'tr-player-left':
        players.delete(data.id);
        renderLanes();
        break;
      case 'tr-race-start':
        beginRace(data);
        break;
      case 'tr-progress': {
        const p = players.get(data.id);
        if (p) { if (data.id !== myId) p.chars = data.chars; p.wpm = data.wpm; renderLanes(); }
        break;
      }
      case 'tr-finished': {
        const p = players.get(data.id);
        if (p) { p.chars = text.length; p.wpm = data.wpm; p.place = data.place; }
        if (data.id === myId) {
          finished = true;
          inputEl.disabled = true;
          myWpmEl.textContent = `${data.wpm} WPM`;
          myTimeEl.textContent = `${(data.ms / 1000).toFixed(1)}s`;
          const placeText = ['1st 🥇', '2nd 🥈', '3rd 🥉'][data.place - 1] || `#${data.place}`;
          setStatus(`You finished ${placeText} at ${data.wpm} WPM! Waiting for the others…`);
        }
        renderLanes();
        break;
      }
      case 'tr-race-end':
        state = 'idle';
        racing = false;
        clearInterval(tickTimer);
        countdownEl.classList.add('hidden');
        inputEl.disabled = true;
        inputEl.placeholder = 'Wait for the race to start…';
        startBtn.disabled = false;
        startBtn.textContent = 'Race again';
        for (const p of players.values()) p.racing = false;
        showResults(data.results || []);
        setStatus('Race over! Press "Race again" for a new sentence.');
        renderLanes();
        requestLeaderboard();
        break;
      case 'tr-leaderboard-result':
        renderLeaderboard(data.scores || []);
        break;
      case 'tr-full':
        setStatus('This race is full (20 players) — try again in a bit.');
        startBtn.disabled = true;
        break;
      case 'tr-join-error':
        setStatus(data.message || "Couldn't join this room's race");
        startBtn.disabled = true;
        break;
      default:
        break;
    }
  });
  sock.addEventListener('close', () => {
    if (ws !== sock) return;
    ws = null;
    setStatus('Connection lost — reconnecting…');
    setTimeout(connect, 1500);
  });
}

window.addEventListener('beforeunload', () => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'tr-leave' }));
});

renderPassage();
renderLanes();
connect();
