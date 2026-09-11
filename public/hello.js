// ---------- Room/session setup (same ?room=&name= pattern as the other minigames — this page
// opens its own WebSocket connection, bypassing join-server/ws.profile entirely). ----------
const mpParams = new URLSearchParams(location.search);
const roomCode = mpParams.get('room');
const myName = (mpParams.get('name') || 'Player').slice(0, 30);

const backLink = document.getElementById('back-link');
if (roomCode) backLink.href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;

(function(){
  var village = document.getElementById('village');
  var timeVal = document.getElementById('timeVal');
  var scoreVal = document.getElementById('scoreVal');
  var streakVal = document.getElementById('streakVal');
  var startOverlay = document.getElementById('startOverlay');
  var endOverlay = document.getElementById('endOverlay');
  var startBtn = document.getElementById('startBtn');
  var againBtn = document.getElementById('againBtn');
  var finalScore = document.getElementById('finalScore');
  var bestLine = document.getElementById('bestLine');
  var bestStartLine = document.getElementById('bestStartLine');
  var soundToggle = document.getElementById('soundToggle');
  var showBoardBtn = document.getElementById('showBoardBtn');
  var endBoardBtn = document.getElementById('endBoardBtn');
  var closeBoardBtn = document.getElementById('closeBoardBtn');
  var boardOverlay = document.getElementById('boardOverlay');
  var boardList = document.getElementById('boardList');

  var GAME_LEN = 60;
  var HIGH_KEY = 'valk-hello-highscore';
  var SOUND_KEY = 'valk-hello-sound';

  var soundOn = true;
  try { soundOn = localStorage.getItem(SOUND_KEY) !== '0'; } catch(e){}

  var audioCtx = null;
  function ensureAudio(){
    if (!audioCtx){
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function playTone(freq, delay, duration){
    if (!soundOn || !audioCtx) return;
    var t = audioCtx.currentTime + (delay || 0);
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (duration || 0.16));
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + (duration || 0.16) + 0.02);
  }
  function playCatchSound(bonus){
    playTone(720, 0, 0.14);
    if (bonus) playTone(1080, 0.09, 0.18);
  }
  function updateSoundBtn(){
    soundToggle.classList.toggle('muted', !soundOn);
    soundToggle.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    soundToggle.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Unmute sound');
  }
  soundToggle.addEventListener('click', function(){
    soundOn = !soundOn;
    try { localStorage.setItem(SOUND_KEY, soundOn ? '1' : '0'); } catch(e){}
    updateSoundBtn();
    ensureAudio();
    if (soundOn) playTone(660, 0, 0.12);
  });
  updateSoundBtn();

  var greetings = [
    ['Hola','Spanish'], ['Bonjour','French'], ['Ciao','Italian'],
    ['Konnichiwa','Japanese'], ['Namaste','Hindi'], ['Jambo','Swahili'],
    ['Salaam','Arabic'], ['Aloha','Hawaiian'], ['Shalom','Hebrew'],
    ['Privet','Russian'], ['Nǐ hǎo','Mandarin'], ['Annyeong','Korean']
  ];

  var houseLayout = [
    { left:4,  width:15, height:58, windows:2 },
    { left:20, width:12, height:44, windows:1 },
    { left:34, width:17, height:66, windows:2 },
    { left:53, width:13, height:50, windows:2 },
    { left:68, width:16, height:60, windows:2 },
    { left:86, width:12, height:46, windows:1 }
  ];

  var windows = [];

  function buildVillage(){
    village.innerHTML = '';
    windows = [];
    houseLayout.forEach(function(h, hi){
      var house = document.createElement('div');
      house.className = 'house ' + (hi % 2 ? 'b' : 'a');
      house.style.left = h.left + '%';
      house.style.width = h.width + '%';
      house.style.height = h.height + '%';
      var roof = document.createElement('div');
      var rw = 8 + h.width * 0.9;
      roof.className = 'roof';
      roof.style.borderLeftWidth = rw + 'px';
      roof.style.borderRightWidth = rw + 'px';
      roof.style.borderBottomWidth = (h.height * 0.42) + 'px';
      house.appendChild(roof);

      for (var w = 0; w < h.windows; w++){
        var win = document.createElement('div');
        win.className = 'window';
        var wSize = Math.max(30, h.width * 2.1);
        win.style.width = wSize + '%';
        win.style.height = (wSize * 1.15) + '%';
        var topPct = h.windows === 1 ? 30 : (20 + w * 40);
        win.style.top = topPct + '%';
        win.style.left = h.windows === 1 ? '30%' : (w === 0 ? '14%' : '56%');

        var face = document.createElement('div');
        face.className = 'face';
        face.innerHTML =
          '<svg width="30" height="30" viewBox="0 0 30 30">' +
            '<circle cx="10.5" cy="13" r="2.1" fill="#241a3f"/>' +
            '<circle cx="19.5" cy="13" r="2.1" fill="#241a3f"/>' +
            '<path d="M9 18 Q15 23 21 18" stroke="#241a3f" stroke-width="2.1" fill="none" stroke-linecap="round"/>' +
          '</svg>' +
          '<div class="hand">' +
            '<svg viewBox="0 0 24 24"><g fill="#241a3f">' +
              '<rect x="9" y="0" width="4" height="13" rx="2"/>' +
              '<rect x="4" y="2" width="4" height="11" rx="2" transform="rotate(-14 6 2)"/>' +
              '<rect x="14" y="2" width="4" height="11" rx="2" transform="rotate(14 16 2)"/>' +
              '<rect x="6" y="10" width="12" height="10" rx="5"/>' +
            '</g></svg>' +
          '</div>';
        win.appendChild(face);

        var bar = document.createElement('div');
        bar.className = 'timebar';
        win.appendChild(bar);

        house.appendChild(win);
        windows.push({ el: win, bar: bar, active: false, timer: null });
        win.addEventListener('click', makeClickHandler(windows.length - 1));
      }
      village.appendChild(house);
    });
  }

  var score = 0, streak = 0, timeLeft = GAME_LEN, running = false;
  var spawnTimeout = null, tickInterval = null;

  function difficultyT(){
    return Math.min(1, (GAME_LEN - timeLeft) / GAME_LEN);
  }
  function spawnDelay(){
    var t = difficultyT();
    return 1000 - t * 500 + Math.random() * 300;
  }
  function activeDuration(){
    var t = difficultyT();
    return 1500 - t * 700;
  }

  function makeClickHandler(idx){
    return function(){
      var slot = windows[idx];
      if (!slot.active) return;
      clearWindow(idx, true);
      score += 10;
      streak += 1;
      var bonus = 0;
      if (streak % 5 === 0){
        bonus = 10;
        var g = greetings[Math.floor(Math.random() * greetings.length)];
        popGreeting(slot.el, g[0] + '! (' + g[1] + ') +' + bonus);
        score += bonus;
      }
      scoreVal.textContent = score;
      streakVal.textContent = streak;
      playCatchSound(bonus > 0);
    };
  }

  function popGreeting(win, text){
    var pop = document.createElement('div');
    pop.className = 'greetpop';
    pop.textContent = text;
    win.appendChild(pop);
    setTimeout(function(){ pop.remove(); }, 1150);
  }

  function clearWindow(idx, caught){
    var slot = windows[idx];
    slot.active = false;
    slot.el.classList.remove('lit');
    if (slot.timer){ clearTimeout(slot.timer); slot.timer = null; }
    if (!caught) streak = 0;
    streakVal.textContent = streak;
  }

  function activateRandomWindow(){
    if (!running) return;
    var idle = [];
    for (var i = 0; i < windows.length; i++){ if (!windows[i].active) idle.push(i); }
    var activeCount = windows.length - idle.length;
    if (idle.length && activeCount < 3){
      var idx = idle[Math.floor(Math.random() * idle.length)];
      var slot = windows[idx];
      slot.active = true;
      slot.el.classList.add('lit');
      var dur = activeDuration();
      slot.bar.style.transitionDuration = '0ms';
      slot.bar.style.transform = 'scaleX(1)';
      void slot.bar.offsetWidth;
      slot.bar.style.transitionDuration = dur + 'ms';
      slot.bar.style.transform = 'scaleX(0)';
      slot.timer = setTimeout(function(){ clearWindow(idx, false); }, dur);
    }
    spawnTimeout = setTimeout(activateRandomWindow, spawnDelay());
  }

  function startGame(){
    score = 0; streak = 0; timeLeft = GAME_LEN; running = true;
    scoreVal.textContent = 0; streakVal.textContent = 0; timeVal.textContent = timeLeft;
    startOverlay.hidden = true; endOverlay.hidden = true; boardOverlay.hidden = true;
    buildVillage();
    spawnTimeout = setTimeout(activateRandomWindow, 500);
    tickInterval = setInterval(function(){
      timeLeft -= 1;
      timeVal.textContent = Math.max(0, timeLeft);
      if (timeLeft <= 0) endGame();
    }, 1000);
  }

  function endGame(){
    running = false;
    clearTimeout(spawnTimeout);
    clearInterval(tickInterval);
    windows.forEach(function(_, i){ clearWindow(i, true); });

    var best = 0;
    try { best = parseInt(localStorage.getItem(HIGH_KEY) || '0', 10) || 0; } catch(e){}
    var isNew = score > best;
    if (isNew){
      best = score;
      try { localStorage.setItem(HIGH_KEY, String(best)); } catch(e){}
    }
    finalScore.textContent = score;
    bestLine.innerHTML = isNew
      ? 'New best score! <b>&#127881;</b>'
      : 'Your best: <b>' + best + '</b>.';
    endOverlay.hidden = false;
    refreshBestStart();
    send({ type: 'arcade-submit-score', score: score });
  }

  function refreshBestStart(){
    var best = 0;
    try { best = parseInt(localStorage.getItem(HIGH_KEY) || '0', 10) || 0; } catch(e){}
    if (best > 0){
      bestStartLine.textContent = 'Your best: ' + best;
      bestStartLine.hidden = false;
    } else {
      bestStartLine.hidden = true;
    }
  }

  // ---------- Leaderboard (persisted per room, shared across everyone who plays here) ----------
  var lastScores = [];
  function renderBoard(){
    boardList.innerHTML = '';
    if (!lastScores.length){
      var empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'No scores yet — be the first to say hello!';
      boardList.appendChild(empty);
      return;
    }
    lastScores.forEach(function(entry, i){
      var li = document.createElement('li');
      li.innerHTML =
        '<div class="rank">' + (i + 1) + '</div>' +
        '<div class="name"></div>' +
        '<div class="points"></div>';
      li.querySelector('.name').textContent = entry.name || 'Anonymous';
      li.querySelector('.points').textContent = entry.score;
      boardList.appendChild(li);
    });
  }

  var boardReturnTo = startOverlay;
  function openBoard(fromOverlay){
    boardReturnTo = fromOverlay;
    renderBoard();
    fromOverlay.hidden = true;
    boardOverlay.hidden = false;
    send({ type: 'arcade-leaderboard' });
  }
  showBoardBtn.addEventListener('click', function(){ openBoard(startOverlay); });
  endBoardBtn.addEventListener('click', function(){ openBoard(endOverlay); });
  closeBoardBtn.addEventListener('click', function(){
    boardOverlay.hidden = true;
    boardReturnTo.hidden = false;
  });

  buildVillage();
  refreshBestStart();
  startBtn.addEventListener('click', function(){ ensureAudio(); startGame(); });
  againBtn.addEventListener('click', function(){ ensureAudio(); startGame(); });

  // ---------- WebSocket ----------
  var ws;
  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }

  function connect() {
    var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(protocol + '//' + location.host);
    ws.addEventListener('open', function(){ send({ type: 'arcade-join', code: roomCode, name: myName, game: 'hello' }); });
    ws.addEventListener('close', function(){ setTimeout(connect, 1500); });
    ws.addEventListener('message', function(event){
      var data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        reportClientError('Malformed WS frame: ' + err.message, err.stack);
        return;
      }
      if (data.type === 'arcade-leaderboard') {
        lastScores = data.scores || [];
        if (!boardOverlay.hidden) renderBoard();
      }
    });
  }

  window.addEventListener('beforeunload', function(){ send({ type: 'arcade-leave' }); });

  connect();
})();
