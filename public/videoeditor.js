// --- Theme (same toggle behavior as the main chat page) ---
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
  localStorage.setItem('valk-theme', next);
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
const loadBanner = document.getElementById('load-banner');
const errorEl = document.getElementById('editor-error');
const workspace = document.getElementById('workspace');

const previewVideo = document.getElementById('preview-video');
const previewEmptyEl = document.getElementById('preview-empty');
const playBtn = document.getElementById('play-btn');
const timeReadout = document.getElementById('time-readout');

const clipFileInput = document.getElementById('clip-file-input');
const splitBtn = document.getElementById('split-btn');
const addTitleBtn = document.getElementById('add-title-btn');
const addMusicBtn = document.getElementById('add-music-btn');
const musicFileInput = document.getElementById('music-file-input');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');

const musicPickerOverlay = document.getElementById('music-picker-overlay');
const musicPicker = document.getElementById('music-picker');
const musicPickerCloseBtn = document.getElementById('music-picker-close');
const songListEl = document.getElementById('song-list');

const timelineWrap = document.getElementById('timeline-wrap');
const timelineInner = document.getElementById('timeline-inner');
const rulerEl = document.getElementById('ruler');
const trackVideo = document.getElementById('track-video');
const trackTitles = document.getElementById('track-titles');
const trackMusic = document.getElementById('track-music');
const playheadEl = document.getElementById('playhead');

const inspector = document.getElementById('inspector');

const exportBtn = document.getElementById('export-btn');
const renderProgress = document.getElementById('render-progress');
const renderProgressFill = document.getElementById('render-progress-fill');
const renderStatus = document.getElementById('render-status');

const resultSection = document.getElementById('result-section');
const resultVideo = document.getElementById('result-video');
const downloadBtn = document.getElementById('download-btn');
const sendChatBtn = document.getElementById('send-chat-btn');
const sendScorptureBtn = document.getElementById('send-scorpture-btn');
const scorptureOverlay = document.getElementById('scorpture-publish-overlay');
const scorptureCloseBtn = document.getElementById('scorpture-publish-close');
const scorptureTitleInput = document.getElementById('scorpture-title-input');
const scorptureDescriptionInput = document.getElementById('scorpture-description-input');
const scorptureStatusEl = document.getElementById('scorpture-publish-status');
const scorpturePublishSubmit = document.getElementById('scorpture-publish-submit');

if (roomCode && myName) sendChatBtn.classList.remove('hidden');
// Same account-token auth as the rest of Scorpture (see videos.js) — this editor has no login
// of its own, it just reuses whatever token app.js already stored, same-origin.
if (localStorage.getItem('valk-account-token')) sendScorptureBtn.classList.remove('hidden');

// --- State ---
let clips = [];       // { id, file, name, url, duration, width, height, trimStart, trimEnd, speed, volume, thumb }
// { id, text, start, end, pos, color, clipId, localStart, localEnd } -- start/end are in project
// (global) seconds, but those are *derived*: they shift whenever a clip before this overlay is
// reordered, trimmed, split, or deleted, since every clip's global start position depends on
// every earlier clip's current length. clipId/localStart/localEnd (offsets from that clip's own
// global start, at the time the overlay was last placed/edited — see reanchorOverlay) are the
// actual source of truth for "where this caption belongs relative to the footage"; start/end get
// recomputed from them via syncOverlaysToClips() after any clip-structure change, so a caption
// stays over the same footage instead of silently drifting onto whatever now occupies its old
// absolute-time slot.
let overlays = [];
let music = null;     // { file, name, volume, url }
let musicAudioEl = null;
let resultBlob = null;
let resultUrl = null;
let selected = { type: null, id: null }; // type: 'clip' | 'title' | 'music'

let playheadTime = 0;
let isPlaying = false;
let loadedClipId = null;
// Tracks the one-shot 'loadedmetadata' listener seekTo() attaches below, so a fresh seek that
// reassigns previewVideo.src before the previous load finished (rapid scrubbing across clip
// boundaries) removes the stale listener instead of leaving it attached forever — an aborted
// load never fires 'loadedmetadata', so the self-removing `once` pattern alone doesn't clean it
// up, and it can occasionally still fire late (e.g. a cached load) and snap the preview to a
// stale time after the user has already moved on.
let pendingSeekListener = null;
let dragCtx = null;

const PX_PER_SEC = 55;
const MIN_BLOCK_PX = 28;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fmtTime(s) {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function timeToPx(t) {
  return t * PX_PER_SEC;
}

function clipGlobalStarts() {
  let acc = 0;
  const starts = [];
  for (const c of clips) {
    starts.push(acc);
    acc += Math.max(0, c.trimEnd - c.trimStart) / c.speed;
  }
  return starts;
}

function totalDuration() {
  return clips.reduce((sum, c) => sum + Math.max(0, c.trimEnd - c.trimStart) / c.speed, 0);
}

function refreshExportButton() {
  exportBtn.disabled = !(clips.length && ffmpegReady);
}

// --- Clip loading (metadata + a thumbnail frame, from one hidden <video>) ---
function loadClipMeta(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;
    let settled = false;
    const finish = (thumb) => {
      if (settled) return;
      settled = true;
      resolve({ url, duration: v.duration, width: v.videoWidth, height: v.videoHeight, thumb });
    };
    v.addEventListener('loadedmetadata', () => {
      // Some containers (older/malformed webm, some screen recordings) report duration ===
      // Infinity until an explicit seek resolves it. Left unguarded, that Infinity flowed into
      // trimEnd/totalDuration()/timeToPx(), producing a `width: Infinitypx` timeline and a ruler
      // loop that never terminates. Seeking near the end forces Chromium/Firefox to compute and
      // fix the real duration on `durationchange` — fall back to that before proceeding.
      if (!Number.isFinite(v.duration)) {
        const onDurationFixed = () => {
          v.removeEventListener('durationchange', onDurationFixed);
          if (!Number.isFinite(v.duration)) { finish(null); return; }
          seekAndCapture();
        };
        v.addEventListener('durationchange', onDurationFixed);
        v.currentTime = 1e7; // seek far past any real video's end to force a duration fix
        setTimeout(() => { v.removeEventListener('durationchange', onDurationFixed); if (!settled) finish(null); }, 3000);
        return;
      }
      seekAndCapture();
    }, { once: true });

    function seekAndCapture() {
      try {
        v.currentTime = Math.min(0.15, Math.max(0, v.duration - 0.05));
      } catch {
        finish(null);
        return;
      }
      v.addEventListener('seeked', () => {
        // 'seeked' fires once the target time is committed, but the decoded frame isn't
        // always painted yet — drawImage right here can grab a black frame, especially
        // when seeking to an arbitrary offset on a video that just started loading.
        // Waiting two animation frames gives the decoder a couple of paints to catch up.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          let thumb = null;
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 120;
            canvas.height = 68;
            canvas.getContext('2d').drawImage(v, 0, 0, 120, 68);
            thumb = canvas.toDataURL('image/jpeg', 0.6);
          } catch {}
          finish(thumb);
        }));
      }, { once: true });
      setTimeout(() => finish(null), 3000);
    }
    v.addEventListener('error', () => reject(new Error('Could not read that video file')));
  });
}

async function addClips(fileList) {
  errorEl.classList.add('hidden');
  for (const file of fileList) {
    try {
      const meta = await loadClipMeta(file);
      clips.push({
        id: uid(),
        file,
        name: file.name,
        url: meta.url,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        trimStart: 0,
        trimEnd: meta.duration,
        speed: 1,
        volume: 100,
        thumb: meta.thumb,
      });
    } catch {
      errorEl.textContent = `Couldn't read "${file.name}" — is it a video file?`;
      errorEl.classList.remove('hidden');
    }
  }
  renderTimeline();
  refreshPreviewForEdits();
}

clipFileInput.addEventListener('change', () => {
  if (clipFileInput.files.length) addClips([...clipFileInput.files]);
  clipFileInput.value = '';
});

// --- Titles ---
addTitleBtn.addEventListener('click', () => {
  const total = totalDuration();
  if (!total) return;
  const start = Math.min(playheadTime, Math.max(0, total - 2));
  const end = Math.min(total, start + 2);
  const ov = { id: uid(), text: 'Title', start, end, pos: 'bottom', color: '#ffffff' };
  reanchorOverlay(ov);
  overlays.push(ov);
  renderTimeline();
  selectItem('title', ov.id);
  const textInput = inspector.querySelector('[data-role="title-text"]');
  if (textInput) {
    textInput.focus();
    textInput.select();
  }
});

// --- Background music ---
function ensureMusicEl() {
  if (!musicAudioEl) {
    musicAudioEl = new Audio();
    musicAudioEl.preload = 'auto';
  }
  return musicAudioEl;
}

function setMusicFromFile(file, displayName) {
  if (music && music.url) URL.revokeObjectURL(music.url);
  const url = URL.createObjectURL(file);
  music = { file, name: displayName || file.name, volume: 50, url };
  const el = ensureMusicEl();
  el.src = url;
  el.volume = 0.5;
  renderTimeline();
  selectItem('music', 'music');
}

musicFileInput.addEventListener('change', () => {
  const file = musicFileInput.files[0];
  if (!file) return;
  setMusicFromFile(file);
  musicFileInput.value = '';
  closeMusicPicker();
});

// --- Built-in song library (procedurally generated with Web Audio's
// OfflineAudioContext — no bundled audio files, so nothing to license). Each
// song is rendered to a real WAV blob on first use, then cached, so it can
// feed into the same ffmpeg export pipeline as an uploaded track. ---
const SONGS = [
  { id: 'lofi', name: 'Lo-fi Chill', mood: 'Mellow · 80 BPM', bpm: 80,
    chords: [[57, 60, 64, 67], [53, 57, 60, 64], [60, 64, 67, 71], [55, 59, 62, 65]],
    padWave: 'sine', padLevel: 0.05, bassWave: 'triangle', bassLevel: 0.14, arp: false, drum: 'lofi' },
  { id: 'pop', name: 'Upbeat Pop', mood: 'Energetic · 120 BPM', bpm: 120,
    chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
    padWave: 'sine', padLevel: 0.04, bassWave: 'triangle', bassLevel: 0.16,
    arp: true, arpWave: 'square', arpLevel: 0.07, drum: 'four' },
  { id: 'cinematic', name: 'Cinematic', mood: 'Sweeping · 70 BPM', bpm: 70,
    chords: [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]],
    padWave: 'sawtooth', padLevel: 0.07, bassWave: 'sine', bassLevel: 0.1, arp: false, drum: 'none' },
  { id: 'retro', name: '8-bit Retro', mood: 'Playful · 140 BPM', bpm: 140,
    chords: [[52, 55, 59], [60, 64, 67], [55, 59, 62], [50, 54, 57]],
    padWave: 'square', padLevel: 0.03, bassWave: 'square', bassLevel: 0.13,
    arp: true, arpWave: 'square', arpLevel: 0.09, drum: 'chip' },
  { id: 'acoustic', name: 'Acoustic Pluck', mood: 'Warm · 100 BPM', bpm: 100,
    chords: [[55, 59, 62], [50, 54, 57], [52, 55, 59], [48, 52, 55]],
    padWave: 'triangle', padLevel: 0.03, bassWave: 'triangle', bassLevel: 0.1,
    arp: true, arpWave: 'triangle', arpLevel: 0.1, drum: 'shaker' },
  { id: 'ambient', name: 'Ambient Pad', mood: 'Spacious · 60 BPM', bpm: 60,
    chords: [[48, 52, 55, 59], [53, 57, 60, 64]],
    padWave: 'sine', padLevel: 0.08, bassWave: 'sine', bassLevel: 0.06, arp: false, drum: 'none' },
];

const songCache = new Map(); // id -> Blob
let previewAudioEl = null;
let previewingSongId = null;

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function scheduleKick(ctx, dest, t, level = 1) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.5 * level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(t + 0.25);
}

function scheduleNoiseHit(ctx, dest, t, { durSec, filterType, filterFreq, level }) {
  const bufferSize = Math.floor(ctx.sampleRate * durSec);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filt = ctx.createBiquadFilter();
  filt.type = filterType;
  filt.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + durSec);
  noise.connect(filt);
  filt.connect(g);
  g.connect(dest);
  noise.start(t);
}

function scheduleSnare(ctx, dest, t, level = 1) {
  scheduleNoiseHit(ctx, dest, t, { durSec: 0.18, filterType: 'highpass', filterFreq: 1200, level: 0.35 * level });
}

function scheduleHihat(ctx, dest, t, soft = false, level = 1) {
  scheduleNoiseHit(ctx, dest, t, {
    durSec: 0.05,
    filterType: 'highpass',
    filterFreq: soft ? 6000 : 8000,
    level: (soft ? 0.08 : 0.12) * level,
  });
}

async function renderSongBlob(song) {
  const beatSec = 60 / song.bpm;
  const beatsPerChord = 8;
  const chordDur = beatsPerChord * beatSec;
  const totalBeats = song.chords.length * beatsPerChord;
  const duration = totalBeats * beatSec;
  const sampleRate = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  song.chords.forEach((chord, i) => {
    const t0 = i * chordDur;

    chord.forEach((midi) => {
      const osc = ctx.createOscillator();
      osc.type = song.padWave;
      osc.frequency.value = midiToFreq(midi);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(song.padLevel, t0 + 0.4);
      g.gain.setValueAtTime(song.padLevel, t0 + chordDur - 0.4);
      g.gain.linearRampToValueAtTime(0, t0 + chordDur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + chordDur + 0.05);
    });

    const rootFreq = midiToFreq(chord[0] - 12);
    for (let b = 0; b < beatsPerChord; b++) {
      const t = t0 + b * beatSec;
      const osc = ctx.createOscillator();
      osc.type = song.bassWave;
      osc.frequency.value = rootFreq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(song.bassLevel, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + beatSec * 0.9);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + beatSec);
    }

    if (song.arp) {
      const steps = beatsPerChord * 2;
      for (let s = 0; s < steps; s++) {
        const t = t0 + s * (beatSec / 2);
        const note = chord[s % chord.length] + 12;
        const osc = ctx.createOscillator();
        osc.type = song.arpWave;
        osc.frequency.value = midiToFreq(note);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(song.arpLevel, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + beatSec * 0.45);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + beatSec * 0.5);
      }
    }
  });

  if (song.drum && song.drum !== 'none') {
    for (let beatIdx = 0; beatIdx < totalBeats; beatIdx++) {
      const t = beatIdx * beatSec;
      if (song.drum === 'four' || song.drum === 'chip') {
        scheduleKick(ctx, master, t);
        scheduleHihat(ctx, master, t, false);
        scheduleHihat(ctx, master, t + beatSec / 2, true);
        if (beatIdx % 2 === 1) scheduleSnare(ctx, master, t);
      } else if (song.drum === 'lofi') {
        if (beatIdx % 2 === 0) scheduleKick(ctx, master, t, 0.6);
        scheduleHihat(ctx, master, t, true, 0.5);
        if (beatIdx % 4 === 2) scheduleSnare(ctx, master, t, 0.6);
      } else if (song.drum === 'shaker') {
        scheduleHihat(ctx, master, t, true, 0.3);
      }
    }
  }

  const rendered = await ctx.startRendering();
  return audioBufferToWavBlob(rendered);
}

function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const blockAlign = numChannels * 2;
  const dataSize = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData = [];
  for (let c = 0; c < numChannels; c++) channelData.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = Math.max(-1, Math.min(1, channelData[c][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

async function getSongBlob(song, onProgress) {
  if (songCache.has(song.id)) return songCache.get(song.id);
  if (onProgress) onProgress('rendering');
  const blob = await renderSongBlob(song);
  songCache.set(song.id, blob);
  if (onProgress) onProgress('ready');
  return blob;
}

function stopPreview() {
  if (previewAudioEl) previewAudioEl.pause();
  previewingSongId = null;
  buildSongList();
}

async function togglePreview(song, btn) {
  if (previewingSongId === song.id) {
    stopPreview();
    return;
  }
  if (previewAudioEl) previewAudioEl.pause();
  const originalLabel = btn.textContent;
  btn.textContent = '…';
  try {
    const blob = await getSongBlob(song);
    if (!previewAudioEl) previewAudioEl = new Audio();
    previewAudioEl.src = URL.createObjectURL(blob);
    previewAudioEl.currentTime = 0;
    previewAudioEl.volume = 0.7;
    previewAudioEl.play().catch(() => {});
    previewingSongId = song.id;
    previewAudioEl.onended = () => { previewingSongId = null; buildSongList(); };
  } catch {
    btn.textContent = originalLabel;
    return;
  }
  buildSongList();
}

async function useSong(song, btn) {
  const originalLabel = btn.textContent;
  btn.textContent = 'Loading…';
  btn.disabled = true;
  try {
    const blob = await getSongBlob(song);
    const file = new File([blob], `${song.name.replace(/\s+/g, '-').toLowerCase()}.wav`, { type: 'audio/wav' });
    setMusicFromFile(file, song.name);
    closeMusicPicker();
  } catch {
    errorEl.textContent = 'Could not generate that track — try another one.';
    errorEl.classList.remove('hidden');
  } finally {
    btn.textContent = originalLabel;
    btn.disabled = false;
  }
}

function buildSongList() {
  songListEl.innerHTML = '';
  SONGS.forEach((song) => {
    const row = document.createElement('div');
    row.className = 'song-row';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'song-play-btn';
    playBtn.textContent = previewingSongId === song.id ? '⏸️' : '▶️';
    playBtn.setAttribute('aria-label', `Preview ${song.name}`);
    playBtn.addEventListener('click', () => togglePreview(song, playBtn));

    const info = document.createElement('div');
    info.className = 'song-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'song-name';
    nameEl.textContent = song.name;
    const moodEl = document.createElement('div');
    moodEl.className = 'song-mood';
    moodEl.textContent = song.mood;
    info.append(nameEl, moodEl);

    const useBtn = document.createElement('button');
    useBtn.type = 'button';
    useBtn.className = 'song-use-btn';
    useBtn.textContent = music && music.name === song.name ? '✓ In use' : 'Use';
    useBtn.addEventListener('click', () => useSong(song, useBtn));

    row.append(playBtn, info, useBtn);
    songListEl.appendChild(row);
  });
}

function openMusicPicker() {
  buildSongList();
  musicPickerOverlay.classList.remove('hidden');
}

function closeMusicPicker() {
  musicPickerOverlay.classList.add('hidden');
  stopPreview();
}

addMusicBtn.addEventListener('click', openMusicPicker);
musicPickerCloseBtn.addEventListener('click', closeMusicPicker);
musicPickerOverlay.addEventListener('click', (e) => {
  if (e.target === musicPickerOverlay) closeMusicPicker();
});

// --- Selection & inspector ---
function selectItem(type, id) {
  selected = { type, id };
  renderTimeline();
  renderInspector();
  deleteSelectedBtn.classList.toggle('hidden', !type);
}

function clearSelection() {
  selected = { type: null, id: null };
  deleteSelectedBtn.classList.add('hidden');
  renderInspector();
}

deleteSelectedBtn.addEventListener('click', () => {
  if (selected.type === 'clip') {
    const clip = clips.find((c) => c.id === selected.id);
    if (clip) {
      clips = clips.filter((c) => c.id !== clip.id);
      // A clip produced by splitAtPlayhead() shares its blob URL with its sibling half (both
      // spread the same `...clip`) — only revoke once nothing else in the timeline still points
      // at that URL, or the sibling's preview breaks with no way to recover (seekTo() only
      // re-sets <video>.src when switching *which* clip is loaded, so a revoked URL under an
      // already-loaded clip never self-heals).
      const stillReferenced = clips.some((c) => c.url === clip.url);
      if (!stillReferenced) URL.revokeObjectURL(clip.url);
      syncOverlaysToClips();
    }
  } else if (selected.type === 'title') {
    overlays = overlays.filter((o) => o.id !== selected.id);
  } else if (selected.type === 'music') {
    if (music && music.url) URL.revokeObjectURL(music.url);
    music = null;
    if (musicAudioEl) {
      musicAudioEl.pause();
      musicAudioEl.removeAttribute('src');
    }
  }
  clearSelection();
  renderTimeline();
  refreshPreviewForEdits();
});

function renderInspector() {
  inspector.innerHTML = '';

  if (!selected.type) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Select a clip, title, or the audio track above to edit it here.';
    inspector.appendChild(p);
    return;
  }

  if (selected.type === 'clip') {
    const clip = clips.find((c) => c.id === selected.id);
    if (!clip) { clearSelection(); return; }

    const h = document.createElement('h3');
    h.id = 'inspector-title';
    h.textContent = clip.name;
    inspector.appendChild(h);

    const row = document.createElement('div');
    row.className = 'field-row';

    const startLabel = document.createElement('label');
    startLabel.textContent = 'Start ';
    const startInput = document.createElement('input');
    startInput.type = 'number';
    startInput.min = '0';
    startInput.step = '0.1';
    startInput.max = String(clip.duration.toFixed(1));
    startInput.value = clip.trimStart.toFixed(1);
    startInput.addEventListener('input', () => {
      let v = parseFloat(startInput.value) || 0;
      v = Math.max(0, Math.min(v, clip.trimEnd - 0.1));
      clip.trimStart = v;
      syncOverlaysToClips();
      renderTimeline();
      refreshPreviewForEdits();
    });
    startLabel.appendChild(startInput);

    const endLabel = document.createElement('label');
    endLabel.textContent = 'End ';
    const endInput = document.createElement('input');
    endInput.type = 'number';
    endInput.min = '0';
    endInput.step = '0.1';
    endInput.max = String(clip.duration.toFixed(1));
    endInput.value = clip.trimEnd.toFixed(1);
    endInput.addEventListener('input', () => {
      let v = parseFloat(endInput.value) || 0;
      v = Math.max(clip.trimStart + 0.1, Math.min(v, clip.duration));
      clip.trimEnd = v;
      syncOverlaysToClips();
      renderTimeline();
      refreshPreviewForEdits();
    });
    endLabel.appendChild(endInput);

    const speedLabel = document.createElement('label');
    speedLabel.textContent = 'Speed ';
    const speedSelect = document.createElement('select');
    [0.5, 0.75, 1, 1.25, 1.5, 2].forEach((s) => {
      const opt = document.createElement('option');
      opt.value = String(s);
      opt.textContent = `${s}x`;
      if (s === clip.speed) opt.selected = true;
      speedSelect.appendChild(opt);
    });
    speedSelect.addEventListener('change', () => {
      clip.speed = parseFloat(speedSelect.value);
      renderTimeline();
      refreshPreviewForEdits();
    });
    speedLabel.appendChild(speedSelect);

    const volLabel = document.createElement('label');
    volLabel.textContent = 'Volume ';
    const volInput = document.createElement('input');
    volInput.type = 'range';
    volInput.min = '0';
    volInput.max = '200';
    volInput.value = String(clip.volume);
    volInput.addEventListener('input', () => {
      clip.volume = parseInt(volInput.value, 10);
      if (loadedClipId === clip.id) previewVideo.volume = clamp01(clip.volume / 100);
    });
    volLabel.appendChild(volInput);

    row.append(startLabel, endLabel, speedLabel, volLabel);
    inspector.appendChild(row);
  } else if (selected.type === 'title') {
    const ov = overlays.find((o) => o.id === selected.id);
    if (!ov) { clearSelection(); return; }

    const h = document.createElement('h3');
    h.id = 'inspector-title';
    h.textContent = 'Title';
    inspector.appendChild(h);

    const row1 = document.createElement('div');
    row1.className = 'field-row';
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.maxLength = 120;
    textInput.value = ov.text;
    textInput.dataset.role = 'title-text';
    textInput.addEventListener('input', () => {
      ov.text = textInput.value;
      renderTimeline();
      updateCaptions(playheadTime);
    });
    row1.appendChild(textInput);
    inspector.appendChild(row1);

    const row2 = document.createElement('div');
    row2.className = 'field-row';

    const startLabel = document.createElement('label');
    startLabel.textContent = 'Start ';
    const startInput = document.createElement('input');
    startInput.type = 'number';
    startInput.min = '0';
    startInput.step = '0.1';
    startInput.value = ov.start.toFixed(1);
    startInput.addEventListener('input', () => {
      let v = parseFloat(startInput.value) || 0;
      v = Math.max(0, Math.min(v, ov.end - 0.2));
      ov.start = v;
      reanchorOverlay(ov);
      renderTimeline();
      updateCaptions(playheadTime);
    });
    startLabel.appendChild(startInput);

    const endLabel = document.createElement('label');
    endLabel.textContent = 'End ';
    const endInput = document.createElement('input');
    endInput.type = 'number';
    endInput.min = '0';
    endInput.step = '0.1';
    endInput.value = ov.end.toFixed(1);
    endInput.addEventListener('input', () => {
      let v = parseFloat(endInput.value) || 0;
      v = Math.max(ov.start + 0.2, Math.min(v, totalDuration()));
      ov.end = v;
      reanchorOverlay(ov);
      renderTimeline();
      updateCaptions(playheadTime);
    });
    endLabel.appendChild(endInput);

    const posLabel = document.createElement('label');
    posLabel.textContent = 'Position ';
    const posSelect = document.createElement('select');
    ['top', 'center', 'bottom'].forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p[0].toUpperCase() + p.slice(1);
      if (p === ov.pos) opt.selected = true;
      posSelect.appendChild(opt);
    });
    posSelect.addEventListener('change', () => {
      ov.pos = posSelect.value;
      updateCaptions(playheadTime);
    });
    posLabel.appendChild(posSelect);

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = ov.color;
    colorInput.setAttribute('aria-label', 'Text color');
    colorInput.addEventListener('input', () => {
      ov.color = colorInput.value;
      updateCaptions(playheadTime);
    });

    row2.append(startLabel, endLabel, posLabel, colorInput);
    inspector.appendChild(row2);
  } else if (selected.type === 'music') {
    if (!music) { clearSelection(); return; }

    const h = document.createElement('h3');
    h.id = 'inspector-title';
    h.textContent = music.name;
    inspector.appendChild(h);

    const row = document.createElement('div');
    row.className = 'field-row';
    const volLabel = document.createElement('label');
    volLabel.textContent = 'Volume ';
    const volInput = document.createElement('input');
    volInput.type = 'range';
    volInput.min = '0';
    volInput.max = '150';
    volInput.value = String(music.volume);
    volInput.addEventListener('input', () => {
      music.volume = parseInt(volInput.value, 10);
      if (musicAudioEl) musicAudioEl.volume = clamp01(music.volume / 100);
    });
    volLabel.appendChild(volInput);
    row.appendChild(volLabel);
    inspector.appendChild(row);
  }
}

// --- Timeline rendering ---
function renderTimeline() {
  const total = totalDuration();
  const widthPx = Math.max(timeToPx(total), 240);
  timelineInner.style.width = `${widthPx}px`;

  renderRuler(total, widthPx);
  renderVideoTrack(widthPx);
  renderTitlesTrack(total, widthPx);
  renderMusicTrack(total, widthPx);
  positionPlayhead();
  updateTimeReadout();
  refreshExportButton();
}

function renderRuler(total, widthPx) {
  rulerEl.innerHTML = '';
  rulerEl.style.width = `${widthPx}px`;
  const step = total > 120 ? 10 : total > 40 ? 5 : 1;
  for (let t = 0; t <= total + 0.001; t += step) {
    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    tick.style.left = `${timeToPx(t)}px`;
    tick.textContent = fmtTime(t);
    rulerEl.appendChild(tick);
  }
}

function renderVideoTrack(widthPx) {
  trackVideo.innerHTML = '';
  trackVideo.style.width = `${widthPx}px`;
  if (!clips.length) {
    const hint = document.createElement('div');
    hint.className = 'track-empty-hint';
    hint.textContent = 'No clips yet — tap "Media" to add one.';
    trackVideo.appendChild(hint);
    return;
  }
  const starts = clipGlobalStarts();
  clips.forEach((clip, i) => {
    const dur = Math.max(0, clip.trimEnd - clip.trimStart) / clip.speed;
    const block = document.createElement('div');
    block.className = 'clip-block' + (selected.type === 'clip' && selected.id === clip.id ? ' selected' : '');
    block.dataset.clipId = clip.id;
    block.style.left = `${timeToPx(starts[i])}px`;
    block.style.width = `${Math.max(timeToPx(dur), MIN_BLOCK_PX)}px`;
    if (clip.thumb) {
      block.style.backgroundImage = `url(${clip.thumb})`;
    }

    const label = document.createElement('div');
    label.className = 'clip-label';
    label.textContent = `${i + 1}. ${clip.name}`;
    block.appendChild(label);

    const leftHandle = document.createElement('div');
    leftHandle.className = 'trim-handle left';
    const rightHandle = document.createElement('div');
    rightHandle.className = 'trim-handle right';
    block.append(leftHandle, rightHandle);

    block.addEventListener('pointerdown', (e) => startClipDrag(e, clip));
    leftHandle.addEventListener('pointerdown', (e) => { e.stopPropagation(); startTrim(e, clip, 'left'); });
    rightHandle.addEventListener('pointerdown', (e) => { e.stopPropagation(); startTrim(e, clip, 'right'); });

    trackVideo.appendChild(block);
  });
}

function renderTitlesTrack(total, widthPx) {
  trackTitles.innerHTML = '';
  trackTitles.style.width = `${widthPx}px`;
  if (!overlays.length) {
    const hint = document.createElement('div');
    hint.className = 'track-empty-hint';
    hint.textContent = 'No titles yet — tap "Titles" to add one.';
    trackTitles.appendChild(hint);
    return;
  }
  overlays.forEach((ov) => {
    const block = document.createElement('div');
    block.className = 'title-block' + (selected.type === 'title' && selected.id === ov.id ? ' selected' : '');
    block.dataset.titleId = ov.id;
    block.style.left = `${timeToPx(ov.start)}px`;
    block.style.width = `${Math.max(timeToPx(ov.end - ov.start), MIN_BLOCK_PX)}px`;
    block.textContent = ov.text;

    const leftHandle = document.createElement('div');
    leftHandle.className = 'trim-handle left';
    const rightHandle = document.createElement('div');
    rightHandle.className = 'trim-handle right';
    block.append(leftHandle, rightHandle);

    block.addEventListener('pointerdown', (e) => startTitleDrag(e, ov, 'move'));
    leftHandle.addEventListener('pointerdown', (e) => { e.stopPropagation(); startTitleDrag(e, ov, 'left'); });
    rightHandle.addEventListener('pointerdown', (e) => { e.stopPropagation(); startTitleDrag(e, ov, 'right'); });

    trackTitles.appendChild(block);
  });
}

function renderMusicTrack(total, widthPx) {
  trackMusic.innerHTML = '';
  trackMusic.style.width = `${widthPx}px`;
  if (!music) {
    const hint = document.createElement('div');
    hint.className = 'track-empty-hint';
    hint.textContent = 'No audio track — tap "Audio" to add music.';
    trackMusic.appendChild(hint);
    return;
  }
  const block = document.createElement('div');
  block.className = 'music-block' + (selected.type === 'music' ? ' selected' : '');
  block.style.width = `${Math.max(widthPx, MIN_BLOCK_PX)}px`;
  block.textContent = `🎵 ${music.name}`;
  block.addEventListener('pointerdown', (e) => { e.preventDefault(); selectItem('music', 'music'); });
  trackMusic.appendChild(block);
}

// --- Clip reorder drag ---
function startClipDrag(e, clip) {
  e.preventDefault();
  selectItem('clip', clip.id);
  const starts = clipGlobalStarts();
  const idx = clips.findIndex((c) => c.id === clip.id);
  dragCtx = { type: 'reorder', clipId: clip.id, startX: e.clientX, startLeftPx: timeToPx(starts[idx]) };
  window.addEventListener('pointermove', onClipDragMove);
  window.addEventListener('pointerup', onClipDragEnd);
}

function onClipDragMove(e) {
  if (!dragCtx || dragCtx.type !== 'reorder') return;
  const idx = clips.findIndex((c) => c.id === dragCtx.clipId);
  if (idx < 0) return;
  const clip = clips[idx];
  const dx = e.clientX - dragCtx.startX;
  const newLeftPx = Math.max(0, dragCtx.startLeftPx + dx);
  const dur = Math.max(0, clip.trimEnd - clip.trimStart) / clip.speed;
  const centerPx = newLeftPx + timeToPx(dur) / 2;

  const starts = clipGlobalStarts();
  let targetIdx = idx;
  for (let i = 0; i < clips.length; i++) {
    if (i === idx) continue;
    const otherDur = Math.max(0, clips[i].trimEnd - clips[i].trimStart) / clips[i].speed;
    const otherCenterPx = timeToPx(starts[i]) + timeToPx(otherDur) / 2;
    if (i < idx && centerPx < otherCenterPx) targetIdx = Math.min(targetIdx, i);
    if (i > idx && centerPx > otherCenterPx) targetIdx = Math.max(targetIdx, i);
  }
  if (targetIdx !== idx) {
    const [moved] = clips.splice(idx, 1);
    clips.splice(targetIdx, 0, moved);
    syncOverlaysToClips();
    renderTimeline();
  }
  const block = trackVideo.querySelector(`[data-clip-id="${dragCtx.clipId}"]`);
  if (block) block.style.left = `${newLeftPx}px`;
}

function onClipDragEnd() {
  window.removeEventListener('pointermove', onClipDragMove);
  window.removeEventListener('pointerup', onClipDragEnd);
  dragCtx = null;
  renderTimeline();
  refreshPreviewForEdits();
}

// --- Clip trim drag ---
function startTrim(e, clip, side) {
  e.preventDefault();
  selectItem('clip', clip.id);
  dragCtx = { type: 'trim', side, clipId: clip.id, startX: e.clientX, startTrimStart: clip.trimStart, startTrimEnd: clip.trimEnd };
  window.addEventListener('pointermove', onTrimMove);
  window.addEventListener('pointerup', onTrimEnd);
}

function onTrimMove(e) {
  if (!dragCtx || dragCtx.type !== 'trim') return;
  const clip = clips.find((c) => c.id === dragCtx.clipId);
  if (!clip) return;
  const dtSec = ((e.clientX - dragCtx.startX) / PX_PER_SEC) * clip.speed;
  if (dragCtx.side === 'left') {
    let v = dragCtx.startTrimStart + dtSec;
    v = Math.max(0, Math.min(v, clip.trimEnd - 0.1));
    clip.trimStart = v;
  } else {
    let v = dragCtx.startTrimEnd + dtSec;
    v = Math.max(clip.trimStart + 0.1, Math.min(v, clip.duration));
    clip.trimEnd = v;
  }
  syncOverlaysToClips();
  renderTimeline();
}

function onTrimEnd() {
  window.removeEventListener('pointermove', onTrimMove);
  window.removeEventListener('pointerup', onTrimEnd);
  dragCtx = null;
  renderInspector();
  refreshPreviewForEdits();
}

// --- Title drag/resize ---
function startTitleDrag(e, ov, mode) {
  e.preventDefault();
  selectItem('title', ov.id);
  dragCtx = { type: 'title', mode, titleId: ov.id, startX: e.clientX, startStart: ov.start, startEnd: ov.end };
  window.addEventListener('pointermove', onTitleDragMove);
  window.addEventListener('pointerup', onTitleDragEnd);
}

function onTitleDragMove(e) {
  if (!dragCtx || dragCtx.type !== 'title') return;
  const ov = overlays.find((o) => o.id === dragCtx.titleId);
  if (!ov) return;
  const dtSec = (e.clientX - dragCtx.startX) / PX_PER_SEC;
  const total = totalDuration();
  if (dragCtx.mode === 'move') {
    const dur = dragCtx.startEnd - dragCtx.startStart;
    let start = dragCtx.startStart + dtSec;
    start = Math.max(0, Math.min(start, total - dur));
    ov.start = start;
    ov.end = start + dur;
  } else if (dragCtx.mode === 'left') {
    let start = dragCtx.startStart + dtSec;
    start = Math.max(0, Math.min(start, ov.end - 0.2));
    ov.start = start;
  } else {
    let end = dragCtx.startEnd + dtSec;
    end = Math.max(ov.start + 0.2, Math.min(end, total));
    ov.end = end;
  }
  renderTimeline();
}

function onTitleDragEnd() {
  window.removeEventListener('pointermove', onTitleDragMove);
  window.removeEventListener('pointerup', onTitleDragEnd);
  const ov = dragCtx && dragCtx.type === 'title' ? overlays.find((o) => o.id === dragCtx.titleId) : null;
  if (ov) reanchorOverlay(ov);
  dragCtx = null;
  renderInspector();
  updateCaptions(playheadTime);
}

// --- Playhead & scrubbing ---
function positionPlayhead() {
  playheadEl.style.left = `${timeToPx(playheadTime)}px`;
}

function clientXToLocalPx(clientX) {
  const rect = timelineInner.getBoundingClientRect();
  return clientX - rect.left;
}

function seekFromClientX(clientX) {
  const px = clientXToLocalPx(clientX);
  const t = Math.max(0, Math.min(px / PX_PER_SEC, totalDuration()));
  seekTo(t);
}

function startPlayheadDrag(e) {
  e.preventDefault();
  if (isPlaying) togglePlay();
  const move = (ev) => seekFromClientX(ev.clientX);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

playheadEl.addEventListener('pointerdown', startPlayheadDrag);
timelineInner.addEventListener('pointerdown', (e) => {
  if (e.target === timelineInner || e.target.classList.contains('track') || e.target === rulerEl) {
    seekFromClientX(e.clientX);
    startPlayheadDrag(e);
  }
});

// --- Preview driver ---
function findClipAt(t) {
  if (!clips.length) return null;
  const starts = clipGlobalStarts();
  for (let i = clips.length - 1; i >= 0; i--) {
    if (t >= starts[i] - 1e-6) return { index: i, clip: clips[i], clipStart: starts[i] };
  }
  return { index: 0, clip: clips[0], clipStart: 0 };
}

// Re-establishes an overlay's clip anchor from its current absolute start — called whenever the
// user directly places/moves/resizes a title (creation, drag, or the inspector's start/end
// fields), so the *next* clip-structure change has a fresh, correct anchor to recompute from.
function reanchorOverlay(ov) {
  const found = findClipAt(ov.start);
  if (!found) return;
  ov.clipId = found.clip.id;
  ov.localStart = ov.start - found.clipStart;
  ov.localEnd = ov.end - found.clipStart;
}

// Recomputes every overlay's absolute start/end from its clip anchor — call after any edit that
// changes clip order, trim, or count (reorder, trim, split, delete), since those all shift where
// "this clip's global start" actually is. An overlay whose anchor clip no longer exists (that
// clip was deleted) is dropped rather than left pointing at whatever footage now occupies its
// stale absolute-time slot.
function syncOverlaysToClips() {
  const starts = clipGlobalStarts();
  overlays = overlays.filter((ov) => {
    const idx = clips.findIndex((c) => c.id === ov.clipId);
    if (idx === -1) return false;
    ov.start = starts[idx] + ov.localStart;
    ov.end = starts[idx] + ov.localEnd;
    return true;
  });
}

function updateTimeReadout() {
  timeReadout.textContent = `${fmtTime(playheadTime)} / ${fmtTime(totalDuration())}`;
}

function updateCaptions(t) {
  const active = { top: [], center: [], bottom: [] };
  overlays.forEach((ov) => {
    if (t >= ov.start && t < ov.end && active[ov.pos]) active[ov.pos].push(ov);
  });
  ['top', 'center', 'bottom'].forEach((pos) => {
    const el = document.getElementById(`caption-${pos}`);
    el.innerHTML = '';
    active[pos].forEach((ov) => {
      const div = document.createElement('div');
      div.textContent = ov.text;
      div.style.color = ov.color;
      el.appendChild(div);
    });
  });
}

function updateSplitButtonState() {
  const found = findClipAt(playheadTime);
  if (!found) {
    splitBtn.disabled = true;
    return;
  }
  const margin = 0.12;
  const localT = found.clip.trimStart + (playheadTime - found.clipStart) * found.clip.speed;
  splitBtn.disabled = !(localT > found.clip.trimStart + margin && localT < found.clip.trimEnd - margin);
}

function captureThumbFromUrl(url, atTime) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;
    let done = false;
    const finish = (thumb) => { if (done) return; done = true; resolve(thumb); };
    v.addEventListener('loadedmetadata', () => {
      try {
        v.currentTime = Math.min(atTime, Math.max(0, v.duration - 0.05));
      } catch {
        finish(null);
        return;
      }
      v.addEventListener('seeked', () => {
        // Same black-frame race as loadClipMeta's capture — give the decoder a
        // couple of paints before reading the canvas.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          let thumb = null;
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 120;
            canvas.height = 68;
            canvas.getContext('2d').drawImage(v, 0, 0, 120, 68);
            thumb = canvas.toDataURL('image/jpeg', 0.6);
          } catch {}
          finish(thumb);
        }));
      }, { once: true });
      setTimeout(() => finish(null), 3000);
    }, { once: true });
    v.addEventListener('error', () => finish(null));
  });
}

function splitAtPlayhead() {
  const found = findClipAt(playheadTime);
  if (!found) return;
  const { clip, clipStart } = found;
  const localSplitTime = clip.trimStart + (playheadTime - clipStart) * clip.speed;
  const margin = 0.12;
  if (!(localSplitTime > clip.trimStart + margin && localSplitTime < clip.trimEnd - margin)) return;

  const idx = clips.findIndex((c) => c.id === clip.id);
  const firstPart = { ...clip, trimEnd: localSplitTime };
  const secondPart = { ...clip, id: uid(), trimStart: localSplitTime };
  clips.splice(idx, 1, firstPart, secondPart);
  syncOverlaysToClips();

  renderTimeline();
  selectItem('clip', secondPart.id);
  refreshPreviewForEdits();

  captureThumbFromUrl(clip.url, secondPart.trimStart).then((thumb) => {
    if (!thumb) return;
    const stillThere = clips.find((c) => c.id === secondPart.id);
    if (stillThere) {
      stillThere.thumb = thumb;
      renderTimeline();
    }
  });
}

splitBtn.addEventListener('click', splitAtPlayhead);

function seekTo(t, opts = {}) {
  const total = totalDuration();
  t = Math.max(0, Math.min(t, total));
  playheadTime = t;
  positionPlayhead();
  updateTimeReadout();
  updateCaptions(t);
  updateSplitButtonState();

  if (musicAudioEl && music) {
    const dur = musicAudioEl.duration;
    if (Number.isFinite(dur) && dur > 0) musicAudioEl.currentTime = t % dur;
  }

  if (!clips.length) return;
  const found = findClipAt(t);
  if (!found) return;
  const localTime = found.clip.trimStart + (t - found.clipStart) * found.clip.speed;
  const needsLoad = loadedClipId !== found.clip.id || opts.forceReload;
  if (needsLoad) {
    loadedClipId = found.clip.id;
    previewVideo.src = found.clip.url;
    previewVideo.playbackRate = found.clip.speed;
    previewVideo.volume = clamp01(found.clip.volume / 100);
    if (pendingSeekListener) previewVideo.removeEventListener('loadedmetadata', pendingSeekListener);
    pendingSeekListener = function onReady() {
      previewVideo.currentTime = localTime;
      previewVideo.removeEventListener('loadedmetadata', onReady);
      pendingSeekListener = null;
    };
    previewVideo.addEventListener('loadedmetadata', pendingSeekListener);
  } else {
    previewVideo.currentTime = localTime;
    previewVideo.playbackRate = found.clip.speed;
    previewVideo.volume = clamp01(found.clip.volume / 100);
  }
}

function refreshPreviewForEdits() {
  if (!clips.length) {
    previewVideo.pause();
    previewVideo.removeAttribute('src');
    loadedClipId = null;
    isPlaying = false;
    playBtn.textContent = '▶️';
    playheadTime = 0;
    positionPlayhead();
    updateTimeReadout();
    updateCaptions(0);
    previewEmptyEl.classList.remove('hidden');
    splitBtn.disabled = true;
    refreshExportButton();
    return;
  }
  previewEmptyEl.classList.add('hidden');
  playheadTime = Math.min(playheadTime, totalDuration());
  seekTo(playheadTime, { forceReload: true });
  refreshExportButton();
}

function advanceToNextClip() {
  const idx = clips.findIndex((c) => c.id === loadedClipId);
  if (idx < 0 || idx >= clips.length - 1) {
    previewVideo.pause();
    if (musicAudioEl) musicAudioEl.pause();
    isPlaying = false;
    playBtn.textContent = '▶️';
    playheadTime = totalDuration();
    positionPlayhead();
    updateTimeReadout();
    return;
  }
  const next = clips[idx + 1];
  loadedClipId = next.id;
  previewVideo.src = next.url;
  // Same stale-listener risk as seekTo() above (this fires on every clip-to-clip transition
  // during normal playback, so it's the more likely everyday trigger of the two) — reuses the
  // same tracking variable since both mutate previewVideo.src the same way.
  if (pendingSeekListener) previewVideo.removeEventListener('loadedmetadata', pendingSeekListener);
  pendingSeekListener = function onReady() {
    previewVideo.currentTime = next.trimStart;
    previewVideo.playbackRate = next.speed;
    previewVideo.volume = clamp01(next.volume / 100);
    previewVideo.play().catch(() => {});
    previewVideo.removeEventListener('loadedmetadata', onReady);
    pendingSeekListener = null;
  };
  previewVideo.addEventListener('loadedmetadata', pendingSeekListener);
}

previewVideo.addEventListener('timeupdate', () => {
  if (!isPlaying) return;
  const clip = clips.find((c) => c.id === loadedClipId);
  if (!clip) return;
  if (previewVideo.currentTime >= clip.trimEnd - 0.03) {
    advanceToNextClip();
    return;
  }
  const idx = clips.findIndex((c) => c.id === clip.id);
  const starts = clipGlobalStarts();
  const t = starts[idx] + (previewVideo.currentTime - clip.trimStart) / clip.speed;
  playheadTime = t;
  positionPlayhead();
  updateTimeReadout();
  updateCaptions(t);
  updateSplitButtonState();
});

function togglePlay() {
  if (!clips.length) return;
  if (isPlaying) {
    previewVideo.pause();
    if (musicAudioEl) musicAudioEl.pause();
    isPlaying = false;
    playBtn.textContent = '▶️';
    return;
  }
  seekTo(playheadTime);
  const start = () => {
    previewVideo.play().catch(() => {});
    if (musicAudioEl && music) musicAudioEl.play().catch(() => {});
  };
  if (previewVideo.readyState >= 1) start();
  else previewVideo.addEventListener('loadedmetadata', start, { once: true });
  isPlaying = true;
  playBtn.textContent = '⏸️';
}

playBtn.addEventListener('click', togglePlay);

// --- Caption rendering onto a transparent canvas (used as an ffmpeg overlay input,
// so it works with the browser's own font rendering instead of needing a font file
// inside the ffmpeg.wasm virtual filesystem) ---
function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function renderCaptionCanvas(text, color, pos, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const maxWidth = width * 0.88;
  const minFontSize = Math.max(14, Math.floor(width / 32));
  let fontSize = Math.floor(width / 14);
  let lines;
  while (true) {
    ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
    lines = wrapLines(ctx, text, maxWidth);
    if (lines.length <= 4 || fontSize <= minFontSize) break;
    fontSize -= Math.max(2, Math.floor(fontSize * 0.08));
  }
  ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(3, fontSize / 8);
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.fillStyle = color;
  const lineHeight = fontSize * 1.2;
  const padding = height * 0.06;
  const blockHeight = lines.length * lineHeight;
  let startY;
  if (pos === 'top') startY = padding + fontSize;
  else if (pos === 'bottom') startY = height - padding - blockHeight + fontSize;
  else startY = (height - blockHeight) / 2 + fontSize;
  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    ctx.strokeText(line, width / 2, y);
    ctx.fillText(line, width / 2, y);
  });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// --- FFmpeg setup ---
let ffmpeg = null;
let ffmpegReady = false;
let stepIndex = 0;
let totalSteps = 1;
let probingAudio = false;

// A stalled connection (accepted but never completing — plausible on a flaky connection or an
// unpkg hiccup) leaves both toBlobURL's fetch and ffmpeg.load()'s own internal setup with no
// error to catch, so without a hard ceiling the loading banner and disabled workspace would sit
// there indefinitely with no way out short of reloading the page.
const FFMPEG_LOAD_TIMEOUT_MS = 45000;
// ffmpeg.wasm's single-threaded core is known to occasionally hang (not throw) on malformed or
// unusual inputs — without a ceiling on each exec() call too, a hang left renderStatus frozen and
// exportBtn disabled forever, with no recovery short of reloading the page and losing every edit
// (render state is in-memory only). Generous since real encodes of multi-clip/high-res timelines
// can legitimately take a while.
const FFMPEG_STEP_TIMEOUT_MS = 120000;
function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

async function initFfmpeg() {
  try {
    const { FFmpeg } = FFmpegWASM;
    const { toBlobURL } = FFmpegUtil;
    ffmpeg = new FFmpeg();
    ffmpeg.on('progress', ({ progress }) => {
      if (probingAudio) return;
      const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
      const overall = (stepIndex + clamped) / totalSteps;
      renderProgressFill.style.width = `${Math.round(overall * 100)}%`;
    });
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await withTimeout((async () => {
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      ]);
      await ffmpeg.load({ coreURL, wasmURL });
    })(), FFMPEG_LOAD_TIMEOUT_MS, 'Timed out loading the video engine — check your internet connection and reload the page.');
    ffmpegReady = true;
    loadBanner.classList.add('hidden');
    workspace.classList.remove('hidden');
    renderTimeline();
    renderInspector();
    refreshExportButton();
  } catch (err) {
    console.error('ffmpeg load failed:', err);
    loadBanner.classList.add('hidden');
    const detail = err && (err.message || err.toString());
    errorEl.textContent = `Could not load the video engine${detail ? `: ${detail}` : ''}. Check your internet connection and reload the page.`;
    errorEl.classList.remove('hidden');
  }
}

initFfmpeg();

// --- Rendering pipeline ---
function evenify(n) {
  n = Math.round(n);
  return n % 2 === 0 ? n : n - 1;
}

function targetResolution() {
  const first = clips[0];
  const maxW = 1280;
  let w = first.width || 1280;
  let h = first.height || 720;
  if (w > maxW) {
    h = Math.round((h * maxW) / w);
    w = maxW;
  }
  return { w: evenify(w), h: evenify(h) };
}

async function fetchFileFromBlob(blob) {
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

// Some clips (e.g. screen recordings) have no audio track at all. Probe for
// one so we can synthesize silence instead of letting -af/-c:a error out on
// a nonexistent stream, which used to abort the whole render.
async function clipHasAudio(inputName) {
  let sawAudio = false;
  const logListener = ({ message }) => {
    if (/Stream #0:\d+.*: Audio:/.test(message)) sawAudio = true;
  };
  ffmpeg.on('log', logListener);
  probingAudio = true;
  try {
    await withTimeout(ffmpeg.exec(['-i', inputName, '-t', '0.1', '-f', 'null', '-']), FFMPEG_STEP_TIMEOUT_MS, 'Timed out probing the clip.');
  } catch {
    // ffmpeg exits nonzero here if there's no video stream either, but we
    // only care whether the audio-stream line showed up in the log.
  } finally {
    ffmpeg.off('log', logListener);
    probingAudio = false;
  }
  return sawAudio;
}

function musicExt(name) {
  const m = /\.[a-zA-Z0-9]+$/.exec(name);
  return m ? m[0] : '.mp3';
}

async function renderVideo() {
  if (!ffmpegReady || !clips.length) return;
  if (isPlaying) togglePlay();
  exportBtn.disabled = true;
  errorEl.classList.add('hidden');
  resultSection.classList.add('hidden');
  renderProgress.classList.remove('hidden');
  renderProgressFill.style.width = '0%';

  stepIndex = 0;
  totalSteps = clips.length + (clips.length > 1 ? 1 : 0) + (overlays.length ? 1 : 0) + (music ? 1 : 0);

  const written = [];
  const track = (name) => { written.push(name); return name; };

  try {
    const { w, h } = targetResolution();

    // Step: encode each clip to a common resolution/framerate/codec so it can be concatenated.
    const clipOutputs = [];
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      renderStatus.textContent = `Preparing clip ${i + 1} of ${clips.length}…`;
      const inputName = track(`in_${i}.mp4`);
      const outputName = `clip_${i}.mp4`;
      await ffmpeg.writeFile(inputName, await FFmpegUtil.fetchFile(clip.file));
      const hasAudio = await clipHasAudio(inputName);
      const vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,setpts=PTS/${clip.speed}`;
      const af = `atempo=${clip.speed},volume=${(clip.volume / 100).toFixed(2)}`;
      const args = ['-ss', String(clip.trimStart), '-to', String(clip.trimEnd), '-i', inputName];
      if (hasAudio) {
        args.push('-vf', vf, '-af', af);
      } else {
        // No audio stream to filter — mux in silence trimmed to the video's
        // length so every clip output has a matching audio track for concat.
        args.push(
          '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-vf', vf, '-map', '0:v:0', '-map', '1:a:0', '-shortest',
        );
      }
      args.push(
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '160k',
        outputName,
      );
      await withTimeout(ffmpeg.exec(args), FFMPEG_STEP_TIMEOUT_MS, 'Timed out preparing a clip.');
      await ffmpeg.deleteFile(inputName);
      clipOutputs.push(track(outputName));
      stepIndex++;
    }

    // Step: concatenate.
    let combined = clipOutputs[0];
    if (clipOutputs.length > 1) {
      renderStatus.textContent = 'Combining clips…';
      const listText = clipOutputs.map((f) => `file '${f}'`).join('\n');
      await ffmpeg.writeFile('list.txt', new TextEncoder().encode(listText));
      combined = 'combined.mp4';
      await withTimeout(ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', combined]), FFMPEG_STEP_TIMEOUT_MS, 'Timed out combining clips.');
      track(combined);
      for (const f of clipOutputs) await ffmpeg.deleteFile(f);
      await ffmpeg.deleteFile('list.txt');
      stepIndex++;
    }

    // Step: burn in text overlays.
    let withText = combined;
    if (overlays.length) {
      renderStatus.textContent = 'Adding text…';
      const args = ['-i', combined];
      const overlayNames = [];
      for (let i = 0; i < overlays.length; i++) {
        const ov = overlays[i];
        const blob = await renderCaptionCanvas(ov.text, ov.color, ov.pos, w, h);
        const bytes = await fetchFileFromBlob(blob);
        const name = track(`ov_${i}.png`);
        await ffmpeg.writeFile(name, bytes);
        overlayNames.push(name);
        args.push('-i', name);
      }
      let filter = '';
      let lastLabel = '0:v';
      overlays.forEach((ov, i) => {
        const outLabel = i === overlays.length - 1 ? 'outv' : `tmp${i}`;
        filter += `[${lastLabel}][${i + 1}]overlay=enable='between(t,${ov.start},${ov.end})'[${outLabel}];`;
        lastLabel = outLabel;
      });
      filter = filter.slice(0, -1);
      withText = 'withtext.mp4';
      await withTimeout(ffmpeg.exec([
        ...args,
        '-filter_complex', filter,
        '-map', '[outv]', '-map', '0:a?',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-c:a', 'copy',
        withText,
      ]), FFMPEG_STEP_TIMEOUT_MS, 'Timed out adding text overlays.');
      track(withText);
      await ffmpeg.deleteFile(combined);
      for (const n of overlayNames) await ffmpeg.deleteFile(n);
      stepIndex++;
    }

    // Step: mix in background music.
    let finalName = withText;
    if (music) {
      renderStatus.textContent = 'Mixing music…';
      const musicName = track('music_in' + musicExt(music.name));
      await ffmpeg.writeFile(musicName, await FFmpegUtil.fetchFile(music.file));
      const total = totalDuration();
      finalName = 'final.mp4';
      const musicVol = (music.volume / 100).toFixed(2);
      await withTimeout(ffmpeg.exec([
        '-i', withText,
        '-stream_loop', '-1', '-i', musicName,
        '-filter_complex',
        `[1:a]atrim=0:${total},asetpts=PTS-STARTPTS,volume=${musicVol}[bg];[0:a]volume=1[orig];[orig][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
        '-map', '0:v', '-map', '[aout]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
        finalName,
      ]), FFMPEG_STEP_TIMEOUT_MS, 'Timed out mixing music.');
      track(finalName);
      await ffmpeg.deleteFile(withText);
      await ffmpeg.deleteFile(musicName);
      stepIndex++;
    }

    renderStatus.textContent = 'Finishing up…';
    const data = await ffmpeg.readFile(finalName);
    resultBlob = new Blob([data], { type: 'video/mp4' });
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(resultBlob);
    resultVideo.src = resultUrl;
    resultVideo.addEventListener('loadedmetadata', () => { resultVideo.currentTime = 0.1; }, { once: true });
    resultSection.classList.remove('hidden');
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderProgressFill.style.width = '100%';
    renderStatus.textContent = 'Done!';
    await ffmpeg.deleteFile(finalName);
  } catch (err) {
    errorEl.textContent = 'Rendering failed — try shorter clips, or check that every clip has audio.';
    errorEl.classList.remove('hidden');
    for (const f of written) {
      try { await ffmpeg.deleteFile(f); } catch {}
    }
  } finally {
    refreshExportButton();
    setTimeout(() => renderProgress.classList.add('hidden'), 800);
  }
}

exportBtn.addEventListener('click', renderVideo);

// --- Download ---
downloadBtn.addEventListener('click', () => {
  if (!resultUrl) return;
  const link = document.createElement('a');
  link.href = resultUrl;
  link.download = `valk-video-${Date.now()}.mp4`;
  link.click();
});

// --- Send to chat ---
sendChatBtn.addEventListener('click', async () => {
  if (!resultBlob || !roomCode || !myName) return;
  sendChatBtn.disabled = true;
  const original = sendChatBtn.textContent;
  try {
    const formData = new FormData();
    formData.append('file', resultBlob, `valk-video-${Date.now()}.mp4`);
    const uploadRes = await fetch('/upload', { method: 'POST', body: formData });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.url) throw new Error();
    const accountToken = localStorage.getItem('valk-account-token');
    const postHeaders = { 'Content-Type': 'application/json' };
    if (accountToken) postHeaders.Authorization = `Bearer ${accountToken}`;
    const postRes = await fetch('/post-media', {
      method: 'POST',
      headers: postHeaders,
      body: JSON.stringify({ code: roomCode, name: myName, pin: roomPin, mediaUrl: uploadData.url, mediaType: 'video', caption: '🎬 Edited video' }),
    });
    if (!postRes.ok) throw new Error();
    sendChatBtn.textContent = '✅ Sent!';
  } catch {
    sendChatBtn.textContent = '❌ Failed';
  } finally {
    setTimeout(() => { sendChatBtn.textContent = original; sendChatBtn.disabled = false; }, 1600);
  }
});

// --- Publish to Scorpture ---
sendScorptureBtn.addEventListener('click', () => {
  if (!resultBlob) return;
  scorptureTitleInput.value = '';
  scorptureDescriptionInput.value = '';
  scorptureStatusEl.textContent = '';
  scorptureOverlay.classList.remove('hidden');
  scorptureTitleInput.focus();
});

scorptureCloseBtn.addEventListener('click', () => scorptureOverlay.classList.add('hidden'));
scorptureOverlay.addEventListener('click', (e) => { if (e.target === scorptureOverlay) scorptureOverlay.classList.add('hidden'); });

// Grabs a frame from the already-rendered result video as the thumbnail — same technique
// Scorpture's own upload modal uses (captureThumbnail in videos.js), just sourced from
// #result-video (already loaded/seekable) instead of a freshly-picked file.
function captureResultThumbnail() {
  return new Promise((resolve) => {
    const wasTime = resultVideo.currentTime;
    const seekTo = Math.min(1, (resultVideo.duration || 2) * 0.1);
    const onSeeked = () => {
      resultVideo.removeEventListener('seeked', onSeeked);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = resultVideo.videoWidth || 320;
        canvas.height = resultVideo.videoHeight || 180;
        canvas.getContext('2d').drawImage(resultVideo, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => { resultVideo.currentTime = wasTime; resolve(blob); }, 'image/jpeg', 0.85);
      } catch {
        resultVideo.currentTime = wasTime;
        resolve(null);
      }
    };
    resultVideo.addEventListener('seeked', onSeeked);
    resultVideo.currentTime = seekTo;
  });
}

async function uploadToServer(fileOrBlob, filename) {
  const formData = new FormData();
  formData.append('file', fileOrBlob, filename);
  const res = await fetch('/upload', { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');
  return data.url;
}

scorpturePublishSubmit.addEventListener('click', async () => {
  const title = scorptureTitleInput.value.trim();
  if (!title || !resultBlob) return;
  scorpturePublishSubmit.disabled = true;
  try {
    scorptureStatusEl.textContent = 'Uploading video…';
    const videoUrl = await uploadToServer(resultBlob, `valk-video-${Date.now()}.mp4`);
    scorptureStatusEl.textContent = 'Generating thumbnail…';
    const thumbBlob = await captureResultThumbnail();
    let thumbnailUrl = null;
    if (thumbBlob) {
      scorptureStatusEl.textContent = 'Uploading thumbnail…';
      thumbnailUrl = await uploadToServer(thumbBlob, 'thumb.jpg');
    }
    scorptureStatusEl.textContent = 'Publishing…';
    const token = localStorage.getItem('valk-account-token') || '';
    const res = await fetch('/api/scorpture/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, description: scorptureDescriptionInput.value.trim(), videoUrl, thumbnailUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Publish failed');
    location.href = `videos.html#/watch?v=${encodeURIComponent(data.id)}`;
  } catch (err) {
    scorptureStatusEl.textContent = `❌ ${err.message}`;
  } finally {
    scorpturePublishSubmit.disabled = false;
  }
});

// --- Escape closes whichever overlay is open --- (same fix already applied to the main chat
// page's overlays this session — this page had none of its own until now)
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!musicPickerOverlay.classList.contains('hidden')) musicPickerCloseBtn.click();
  if (!scorptureOverlay.classList.contains('hidden')) scorptureCloseBtn.click();
});

// --- Initial render ---
renderTimeline();
renderInspector();
