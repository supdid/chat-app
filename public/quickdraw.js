// Quick Draw — reaction-time duel. The server decides when GO happens; this page times your own
// reaction from the moment it shows GO and reports it.
const params = new URLSearchParams(location.search);
const roomCode = params.get('room');
const myName = (params.get('name') || 'Player').slice(0, 30);
const backLink = document.getElementById('back-link');
if (roomCode) backLink.href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;

const pad = document.getElementById('pad');
const startBtn = document.getElementById('start-btn');
const playersEl = document.getElementById('players');
const resultsPanel = document.getElementById('results-panel');
const resultsEl = document.getElementById('results');
const leaderboardEl = document.getElementById('leaderboard');

let ws = null;
let myId = null;
let players = [];
let phase = 'idle'; // idle | wait | go | done
let goShownAt = 0;
const taps = new Map(); // id -> { ms } | { early: true }

function setPad(cls, html) { pad.className = `pad ${cls}`; pad.innerHTML = html; }
function send(m) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); }

function renderPlayers() {
  playersEl.textContent = '';
  for (const p of players) {
    const li = document.createElement('li');
    const t = taps.get(p.id);
    li.textContent = `${p.name}${p.id === myId ? ' (you)' : ''} — 🏆 ${p.wins}${p.best ? ` · best ${p.best} ms` : ''}`;
    if (t) {
      const s = document.createElement('span');
      s.className = t.early ? 'bad' : 'ms';
      s.textContent = t.early ? 'too early!' : `${t.ms} ms`;
      li.appendChild(s);
    }
    playersEl.appendChild(li);
  }
}

function tap() {
  if (phase === 'wait') {
    phase = 'done';
    setPad('early', '😬 Too early!<br><small>Wait for green next time</small>');
    send({ type: 'qd-tap' });
  } else if (phase === 'go') {
    const ms = Math.round(performance.now() - goShownAt);
    phase = 'done';
    setPad('done', `⚡ ${ms} ms`);
    send({ type: 'qd-tap', ms });
  }
}
pad.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
document.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.key === 'Enter') { if (document.activeElement === startBtn) return; e.preventDefault(); tap(); } });

startBtn.addEventListener('click', () => send({ type: 'qd-start' }));
document.getElementById('invite-btn').addEventListener('click', (e) => {
  send({ type: 'game-invite', game: 'quickdraw', code: roomCode, name: myName });
  const b = e.currentTarget;
  b.disabled = true;
  b.textContent = '📣 Invite sent!';
  setTimeout(() => { b.disabled = false; b.textContent = '📣 Invite the chat room'; }, 30000);
});

function renderLeaderboard(scores) {
  leaderboardEl.textContent = '';
  if (!scores.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No rounds yet — be the first!';
    leaderboardEl.appendChild(li);
    return;
  }
  for (const s of scores) {
    const li = document.createElement('li');
    li.append(s.name);
    const m = document.createElement('span');
    m.className = 'ms';
    m.textContent = `${1000 - s.score} ms`;
    li.appendChild(m);
    leaderboardEl.appendChild(li);
  }
}

function connect() {
  if (!roomCode) {
    setPad('idle', 'Open Quick Draw from a chat room to play with friends.');
    startBtn.disabled = true;
    return;
  }
  const sock = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`);
  ws = sock;
  sock.addEventListener('open', () => sock.send(JSON.stringify({ type: 'qd-join', code: roomCode, name: myName, accountToken: localStorage.getItem('valk-account-token') })));
  sock.addEventListener('message', (ev) => {
    if (ws !== sock) return;
    let d;
    try { d = JSON.parse(ev.data); } catch { return; }
    switch (d.type) {
      case 'qd-init':
        myId = d.id;
        players = d.players;
        renderPlayers();
        send({ type: 'qd-leaderboard' });
        if (d.state !== 'idle') { startBtn.disabled = true; setPad('idle', 'A round is going — you’re in the next one!'); }
        break;
      case 'qd-players':
        players = d.players;
        renderPlayers();
        break;
      case 'qd-player-left':
        players = players.filter((p) => p.id !== d.id);
        renderPlayers();
        break;
      case 'qd-ready':
        taps.clear();
        phase = 'wait';
        startBtn.disabled = true;
        resultsPanel.classList.add('hidden');
        setPad('wait', 'Wait for green…');
        renderPlayers();
        break;
      case 'qd-go':
        if (phase === 'wait') {
          phase = 'go';
          setPad('go', 'TAP!');
          goShownAt = performance.now();
        }
        break;
      case 'qd-tapped':
        taps.set(d.id, d.early ? { early: true } : { ms: d.ms });
        renderPlayers();
        break;
      case 'qd-round-end': {
        phase = 'idle';
        players = d.players;
        startBtn.disabled = false;
        startBtn.textContent = 'Next round';
        resultsEl.textContent = '';
        d.results.forEach((r, i) => {
          const li = document.createElement('li');
          li.append(`${!r.early && r.ms != null && i === 0 ? '🥇 ' : ''}${r.name}${r.id === myId ? ' (you)' : ''}`);
          const s = document.createElement('span');
          s.className = r.early || r.ms == null ? 'bad' : 'ms';
          s.textContent = r.early ? 'false start' : r.ms == null ? 'no tap' : `${r.ms} ms`;
          li.appendChild(s);
          resultsEl.appendChild(li);
        });
        resultsPanel.classList.remove('hidden');
        const winner = d.results.find((r) => r.id === d.winnerId);
        setPad('idle', winner ? `${winner.id === myId ? '🎉 You win' : `🏆 ${winner.name} wins`} — ${winner.ms} ms` : 'Nobody made it — try again!');
        renderPlayers();
        send({ type: 'qd-leaderboard' });
        break;
      }
      case 'qd-leaderboard-result':
        renderLeaderboard(d.scores || []);
        break;
      case 'qd-full':
        setPad('idle', 'This game is full right now.');
        startBtn.disabled = true;
        break;
      case 'qd-join-error':
        setPad('idle', d.message || "Couldn't join");
        startBtn.disabled = true;
        break;
      default:
        break;
    }
  });
  sock.addEventListener('close', () => {
    if (ws !== sock) return;
    ws = null;
    setTimeout(connect, 1500);
  });
}
window.addEventListener('beforeunload', () => send({ type: 'qd-leave' }));
connect();
