const loginScreen = document.getElementById('login-screen');
const roomSelectScreen = document.getElementById('room-select-screen');
const chatScreen = document.getElementById('chat-screen');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const loginErrorEl = document.getElementById('login-error');
const appToastEl = document.getElementById('app-toast');
const welcomeTextEl = document.getElementById('welcome-text');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomForm = document.getElementById('join-room-form');
const roomCodeInput = document.getElementById('room-code-input');
const roomErrorEl = document.getElementById('room-error');
const roomPinInput = document.getElementById('room-pin-input');
const roomPinForm = document.getElementById('room-pin-form');
const roomPinFormInput = document.getElementById('room-pin-form-input');
const roomCodeChip = document.getElementById('room-code-chip');
const messagesEl = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');
const menuBtn = document.getElementById('menu-btn');
const menuOverlay = document.getElementById('menu-overlay');
const menuCloseBtn = document.getElementById('menu-close-btn');
const menuRoomCode = document.getElementById('menu-room-code');
const menuOnlineList = document.getElementById('menu-online-list');
const renameRoomForm = document.getElementById('rename-room-form');
const renameRoomInput = document.getElementById('rename-room-input');
const myAvatarBtn = document.getElementById('my-avatar-btn');
const avatarFileInput = document.getElementById('avatar-file-input');
const myNameInput = document.getElementById('my-name-input');
const myNameError = document.getElementById('my-name-error');
const myStatusInput = document.getElementById('my-status-input');
const accountUsernameToggleBtn = document.getElementById('account-username-toggle-btn');
const accountUsernameForm = document.getElementById('account-username-form');
const accountUsernameFormInput = document.getElementById('account-username-form-input');
const accountUsernameError = document.getElementById('account-username-error');
const recentRoomsSection = document.getElementById('recent-rooms-section');
const recentRoomsList = document.getElementById('recent-rooms-list');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const accountToggleBtn = document.getElementById('account-toggle-btn');
const accountPanel = document.getElementById('account-panel');
const accountForm = document.getElementById('account-form');
const accountUsernameInput = document.getElementById('account-username-input');
const accountEmailInput = document.getElementById('account-email-input');
const accountPasswordInput = document.getElementById('account-password-input');
const accountSignupBtn = document.getElementById('account-signup-btn');
const accountErrorEl = document.getElementById('account-error');
const accountSignedOutView = document.getElementById('account-signed-out-view');
const accountSignedInView = document.getElementById('account-signed-in-view');
const accountSignedInName = document.getElementById('account-signed-in-name');
const accountSignoutBtn = document.getElementById('account-signout-btn');
const accountSignoutMenuBtn = document.getElementById('account-signout-menu-btn');
const accountSignoutMenuName = document.getElementById('account-signout-menu-name');
const aistudioLink = document.getElementById('aistudio-link');
const videoeditorLink = document.getElementById('videoeditor-link');
const webswingLink = document.getElementById('webswing-link');
const buildcraftLink = document.getElementById('buildcraft-link');
const geometrywaveLink = document.getElementById('geometrywave-link');
const seincejumpLink = document.getElementById('seincejump-link');
const fighterplaneLink = document.getElementById('fighterplane-link');
const pictionaryLink = document.getElementById('pictionary-link');
const triviaLink = document.getElementById('trivia-link');
const tictactoeLink = document.getElementById('tictactoe-link');
const chessLink = document.getElementById('chess-link');
const hangmanLink = document.getElementById('hangman-link');
const snakeLink = document.getElementById('snake-link');
const g2048Link = document.getElementById('g2048-link');
const whiteboardLink = document.getElementById('whiteboard-link');
const micBtn = document.getElementById('mic-btn');
const voiceClipBtn = document.getElementById('voice-clip-btn');
const stickerBtn = document.getElementById('sticker-btn');
const stickerPicker = document.getElementById('sticker-picker');
const worldwideBadge = document.getElementById('worldwide-badge');
const worldwideCountEl = document.getElementById('worldwide-count');
const headerWorldwideEl = document.getElementById('header-worldwide');
const worldwideCountChatEl = document.getElementById('worldwide-count-chat');
const voicecallBtn = document.getElementById('voicecall-btn');
const voiceCallBanner = document.getElementById('voice-call-banner');
const voiceCallBannerText = document.getElementById('voice-call-banner-text');
const voiceErrorEl = document.getElementById('voice-error');
const callOverlay = document.getElementById('call-overlay');
const callRoomCodeEl = document.getElementById('call-room-code');
const callGrid = document.getElementById('call-grid');
const callExpandBtn = document.getElementById('call-expand-btn');
const micRetryBtn = document.getElementById('mic-retry-btn');
const micMuteBtn = document.getElementById('mic-mute-btn');
const micDeviceSelect = document.getElementById('mic-device-select');
const callBar = document.getElementById('call-bar');
const callDragHandle = document.getElementById('call-drag-handle');
const callShareBtn = document.getElementById('call-share-btn');
const callHangupBtn = document.getElementById('call-hangup-btn');
const pttToggleBtn = document.getElementById('ptt-toggle-btn');
const pttBtn = document.getElementById('ptt-btn');
const raiseHandBtn = document.getElementById('raise-hand-btn');
const muteAllBtn = document.getElementById('mute-all-btn');
const callRecordBtn = document.getElementById('call-record-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const menuMusicToggleBtn = document.getElementById('menu-music-toggle-btn');
const notifySoundSelect = document.getElementById('notify-sound-select');
const notifySoundTestBtn = document.getElementById('notify-sound-test-btn');
const wallpaperRow = document.getElementById('wallpaper-row');
const wallpaperFileInput = document.getElementById('wallpaper-file-input');
const wallpaperSetBtn = document.getElementById('wallpaper-set-btn');
const wallpaperClearBtn = document.getElementById('wallpaper-clear-btn');
const bansRow = document.getElementById('bans-row');
const manageBansBtn = document.getElementById('manage-bans-btn');
const bansListEl = document.getElementById('bans-list');
const themeToggleSlot = document.getElementById('theme-toggle-slot');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const searchBtn = document.getElementById('search-btn');
const searchOverlay = document.getElementById('search-overlay');
const searchCloseBtn = document.getElementById('search-close-btn');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const searchResultsEl = document.getElementById('search-results');
const galleryBtn = document.getElementById('gallery-btn');
const galleryOverlay = document.getElementById('gallery-overlay');
const galleryCloseBtn = document.getElementById('gallery-close-btn');
const galleryGridEl = document.getElementById('gallery-grid');
const friendsOpenBtn = document.getElementById('friends-open-btn');
const friendsMenuBtn = document.getElementById('friends-menu-btn');
const friendsOverlay = document.getElementById('friends-overlay');
const friendsCloseBtn = document.getElementById('friends-close-btn');
const friendsSignedOutMsg = document.getElementById('friends-signed-out-msg');
const friendsSignedInContent = document.getElementById('friends-signed-in-content');
const friendAddForm = document.getElementById('friend-add-form');
const friendAddInput = document.getElementById('friend-add-input');
const friendsErrorEl = document.getElementById('friends-error');
const friendRequestsSection = document.getElementById('friend-requests-section');
const friendRequestsList = document.getElementById('friend-requests-list');
const friendOutgoingSection = document.getElementById('friend-outgoing-section');
const friendOutgoingList = document.getElementById('friend-outgoing-list');
const friendsListEl = document.getElementById('friends-list');
const friendsEmptyMsg = document.getElementById('friends-empty-msg');
const friendBlockedSection = document.getElementById('friend-blocked-section');
const friendBlockedList = document.getElementById('friend-blocked-list');
const friendContextMenu = document.getElementById('friend-context-menu');
const friendDmContextBtn = document.getElementById('friend-dm-context-btn');
const friendDmOverlay = document.getElementById('friend-dm-overlay');
const friendDmCloseBtn = document.getElementById('friend-dm-close-btn');
const friendDmTargetName = document.getElementById('friend-dm-target-name');
const friendDmForm = document.getElementById('friend-dm-form');
const friendDmInput = document.getElementById('friend-dm-input');
const groupsOpenBtn = document.getElementById('groups-open-btn');
const groupsMenuBtn = document.getElementById('groups-menu-btn');
const groupsOverlay = document.getElementById('groups-overlay');
const groupsCloseBtn = document.getElementById('groups-close-btn');
const groupsSignedOutMsg = document.getElementById('groups-signed-out-msg');
const groupsSignedInContent = document.getElementById('groups-signed-in-content');
const groupNewBtn = document.getElementById('group-new-btn');
const groupNewForm = document.getElementById('group-new-form');
const groupNameInput = document.getElementById('group-name-input');
const groupFriendPicker = document.getElementById('group-friend-picker');
const groupNewError = document.getElementById('group-new-error');
const groupCreateBtn = document.getElementById('group-create-btn');
const groupsListEl = document.getElementById('groups-list');
const groupsEmptyMsg = document.getElementById('groups-empty-msg');
const groupDmOverlay = document.getElementById('group-dm-overlay');
const groupDmCloseBtn = document.getElementById('group-dm-close-btn');
const groupDmTitleEl = document.getElementById('group-dm-title');
const groupDmMembersEl = document.getElementById('group-dm-members');
const groupDmMessagesEl = document.getElementById('group-dm-messages');
const groupDmForm = document.getElementById('group-dm-form');
const groupDmInput = document.getElementById('group-dm-input');
const exportLink = document.getElementById('export-link');
const savedBtn = document.getElementById('saved-btn');
const savedOverlay = document.getElementById('saved-overlay');
const savedCloseBtn = document.getElementById('saved-close-btn');
const savedListEl = document.getElementById('saved-list');
const qrBtn = document.getElementById('qr-btn');
const qrOverlay = document.getElementById('qr-overlay');
const qrCloseBtn = document.getElementById('qr-close-btn');
const qrImage = document.getElementById('qr-image');
const qrLinkEl = document.getElementById('qr-link');
const threadOverlay = document.getElementById('thread-overlay');
const threadCloseBtn = document.getElementById('thread-close-btn');
const threadRootEl = document.getElementById('thread-root');
const threadRepliesEl = document.getElementById('thread-replies');
const threadReplyForm = document.getElementById('thread-reply-form');
const threadReplyInput = document.getElementById('thread-reply-input');
const dmOverlay = document.getElementById('dm-overlay');
const dmCloseBtn = document.getElementById('dm-close-btn');
const dmTitleEl = document.getElementById('dm-title');
const dmMessagesEl = document.getElementById('dm-messages');
const dmForm = document.getElementById('dm-form');
const dmInput = document.getElementById('dm-input');
const pollBtn = document.getElementById('poll-btn');
const pollOverlay = document.getElementById('poll-overlay');
const pollCloseBtn = document.getElementById('poll-close-btn');
const pollCreateForm = document.getElementById('poll-create-form');
const pollQuestionInput = document.getElementById('poll-question-input');
const pollOptionsListEl = document.getElementById('poll-options-list');
const pollAddOptionBtn = document.getElementById('poll-add-option-btn');
const mentionDropdownEl = document.getElementById('mention-dropdown');
const pinnedBannerEl = document.getElementById('pinned-banner');
const announcementBannerEl = document.getElementById('announcement-banner');
const announcementForm = document.getElementById('announcement-form');
const announcementInput = document.getElementById('announcement-input');
const typingIndicatorEl = document.getElementById('typing-indicator');
const replyPreviewEl = document.getElementById('reply-preview');

let ws;
let myProfile = null;
let myUsername = null;
let currentRoomCode = null;
let currentRoomName = null;
let isHost = false;
// The WS join-room handler is the only place that ever verifies a room's PIN — /search,
// /export, and the AI Studio/Video Editor post-to-chat endpoints are plain HTTP and need the
// PIN threaded through separately. currentRoomPin is set once 'joined-room' actually confirms
// the join succeeded (pendingJoinPin carries whatever was typed through that async gap); kept
// in sync afterward if the host changes the PIN mid-session (see the roomPinForm handler).
let pendingJoinPin = '';
let currentRoomPin = '';
let appToastTimeout = null;

function showAppToast(msg) {
  appToastEl.textContent = msg;
  appToastEl.classList.add('show');
  clearTimeout(appToastTimeout);
  appToastTimeout = setTimeout(() => appToastEl.classList.remove('show'), 3200);
}
let hasWorldwideCount = false;

// --- Reactions / replies / pins / typing / read receipts state ---
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👀', '🙏', '💯', '😍', '🤔', '👏', '🎂', '😭', '🥳'];
const reactionsByMessage = new Map(); // messageId -> Map<emoji, Set<name>>
let replyingTo = null; // { id, name, text }
let pinnedMessages = []; // [{ pinnedBy, message }, ...]
let currentAnnouncement = null;
const typingTimers = new Map(); // name -> timeoutId
let lastTypingSentAt = 0;
let lastMessageEl = null;
let lastMessageId = null;
const readReceiptsByName = new Map(); // name -> last-read messageId
let activeReactionPopover = null;

// --- Minigame activity badges ---
const roomActivity = new Map(); // name -> game code ('bc'|'gw'|'dg')
const ACTIVITY_BADGES = { bc: '🏝️', gw: '🔺', dg: '🖍️', wb: '🖌️', tv: '❓', tt: '⭕', ch: '♟️', hm: '🪢', sk: '🐍', tf: '🔢', fp: '🛩️' };
let lastRoomUsers = [];

// --- Saved messages — purely client-side (localStorage), stores a content snapshot (not just
// an id) so a saved message still shows something even if the original is later deleted or the
// room it came from isn't the one currently open. ---
const SAVED_KEY = 'valk-saved-messages';
let savedMessages = [];
try {
  const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
  if (Array.isArray(parsed)) savedMessages = parsed;
} catch {}

function isSaved(id) {
  return savedMessages.some((m) => m.id === id);
}

function toggleSaveMessage(data) {
  const idx = savedMessages.findIndex((m) => m.id === data.id);
  if (idx !== -1) {
    savedMessages.splice(idx, 1);
  } else {
    savedMessages.unshift({
      id: data.id,
      name: data.name,
      text: data.text || '',
      mediaUrl: data.mediaUrl || null,
      mediaType: data.mediaType || null,
      at: data.at,
      roomCode: currentRoomCode,
      savedAt: Date.now(),
    });
    savedMessages = savedMessages.slice(0, 200);
  }
  localStorage.setItem(SAVED_KEY, JSON.stringify(savedMessages));
  document.querySelectorAll(`[data-message-id="${CSS.escape(data.id)}"] .save-btn`).forEach((btn) => {
    btn.classList.toggle('saved', isSaved(data.id));
  });
}

function renderSavedList() {
  savedListEl.innerHTML = '';
  if (!savedMessages.length) {
    const li = document.createElement('li');
    li.className = 'saved-empty';
    li.textContent = 'Nothing saved yet — tap 🔖 on any message to save it.';
    savedListEl.appendChild(li);
    return;
  }
  savedMessages.forEach((m) => {
    const li = document.createElement('li');
    const meta = document.createElement('div');
    meta.className = 'saved-meta';
    meta.textContent = `${m.name} · ${new Date(m.at).toLocaleString()}`;
    li.appendChild(meta);
    if (m.mediaUrl && m.mediaType !== 'poll') {
      const media = m.mediaType === 'video' ? document.createElement('video') : document.createElement('img');
      media.src = m.mediaUrl;
      media.className = 'saved-media';
      if (m.mediaType === 'video') media.controls = true;
      else media.alt = 'shared image';
      li.appendChild(media);
    }
    if (m.text) {
      const text = document.createElement('div');
      text.className = 'saved-text';
      text.textContent = m.text;
      li.appendChild(text);
    }
    const actions = document.createElement('div');
    actions.className = 'saved-actions';
    if (m.roomCode === currentRoomCode && document.getElementById(`msg-${m.id}`)) {
      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'small-btn';
      jumpBtn.textContent = 'Jump to message';
      jumpBtn.addEventListener('click', () => {
        savedOverlay.classList.add('hidden');
        jumpToMessage(m.id);
      });
      actions.appendChild(jumpBtn);
    }
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'small-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      toggleSaveMessage({ id: m.id });
      renderSavedList();
    });
    actions.appendChild(removeBtn);
    li.appendChild(actions);
    savedListEl.appendChild(li);
  });
}

// --- Personal block/mute — purely client-side (localStorage), no server involvement at all,
// since this only affects what *you* see, unlike host moderation (kick/mute) which is shared. ---
const BLOCKED_KEY = 'valk-blocked-users';
let blockedNamesInit = [];
try {
  const parsed = JSON.parse(localStorage.getItem(BLOCKED_KEY) || '[]');
  if (Array.isArray(parsed)) blockedNamesInit = parsed;
} catch {}
const blockedNames = new Set(blockedNamesInit);
function toggleBlockUser(name) {
  if (blockedNames.has(name)) blockedNames.delete(name); else blockedNames.add(name);
  localStorage.setItem(BLOCKED_KEY, JSON.stringify([...blockedNames]));
  document.querySelectorAll(`[data-sender-name="${CSS.escape(name)}"]`).forEach((el) => {
    el.classList.toggle('blocked-hidden', blockedNames.has(name));
  });
  renderOnlineList(lastRoomUsers);
}

// --- Report to admin (server-side, unlike block above) — reaches an admin even when no host
// is watching, see the WS 'report' handler / room_mutes+reports tables in server.js/db.js.
function reportUser(targetName, messageId, messageText) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const reason = prompt(`Report ${targetName} to the admin. Optional reason:`);
  if (reason === null) return; // cancelled
  ws.send(JSON.stringify({ type: 'report', targetName, messageId: messageId || undefined, reason }));
  showAppToast(`Reported ${targetName}.`);
}

function seedActivity(list) {
  roomActivity.clear();
  (list || []).forEach((a) => roomActivity.set(a.name, a.game));
}

// --- Unread badge (tab title + favicon) ---
const faviconLink = document.querySelector('link[rel="icon"]');
const baseTitle = document.title;
const baseFaviconHref = faviconLink ? faviconLink.href : null;
let unreadCount = 0;

// --- Voice call state ---
let voiceActive = false;
// Bumped by hangUpVoiceCall so a startVoiceCall() still awaiting the mic permission prompt can
// tell, once it resolves, whether the call was torn down in the meantime (e.g. a WS drop/
// reconnect while the browser's native permission dialog was still up — see startVoiceCall).
let voiceCallGeneration = 0;
let callAutoHangupTimer = null;
const CALL_MAX_DURATION_MS = 32 * 60 * 60 * 1000; // 32 hours
let localStream = null;
let localVoiceStop = null; // stop function for the local speaking-ring detector
let screenStream = null; // local outgoing screen-share stream, null when not sharing
let screenShareStarting = false; // guards against a second getDisplayMedia() call racing the first while its OS picker is still up
const voicePeers = new Map(); // sub -> { name, pc, audioEl, stopDetector }
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
let pttMode = false;
let pttActive = false; // currently holding the push-to-talk button/key
let handRaised = false;
let callRecorder = null;
let callRecordDest = null; // MediaStreamAudioDestinationNode mixing all call audio
let callRecordCtx = null;
let muteAllNoticeTimer = null;

// --- Dark / light theme ---
function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.dataset.theme = 'light';
    if (themeToggleBtn) themeToggleBtn.textContent = '☀️';
  } else {
    delete document.documentElement.dataset.theme;
    if (themeToggleBtn) themeToggleBtn.textContent = '🌙';
  }
}

applyTheme(localStorage.getItem('valk-theme') === 'light' ? 'light' : 'dark');

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('valk-theme', next);
    applyTheme(next);
  });
}

// --- Menu song: soft synth pads generated live via Web Audio (same "no audio files, generate
// it" approach as Build Craft's ambient music and Geometry Wave's chiptune loop), playing only
// while picking a name/room — stops the moment an actual chat room opens, since background
// music during a real conversation (or a voice call) would just be noise. ---
const MENU_MUSIC_MUTE_KEY = 'valk-menu-music-muted';
const MENU_NOTE_FREQS = {
  A2: 110.0, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0,
};
// I - V - vi - IV in C major — a warm, familiar progression, brighter/more welcoming than
// Build Craft's moodier Am7 pads to match "menu" rather than "ambient world" mood.
const MENU_CHORDS = [
  ['C3', 'E3', 'G3', 'C4'],
  ['G3', 'B3', 'D4', 'G4'],
  ['A2', 'C3', 'E3', 'A3'],
  ['F3', 'A3', 'C4', 'F4'],
];
const MENU_CHORD_DUR = 4.5;

let menuMusicCtx = null, menuMusicGain = null, menuMusicFilter = null;
let menuMusicOn = true;
try { menuMusicOn = localStorage.getItem(MENU_MUSIC_MUTE_KEY) !== '1'; } catch { /* no-op */ }
let menuMusicActive = false, menuMusicChordIndex = 0, menuMusicNextChordTime = 0, menuMusicTimer = null;

function playMenuPadNote(freq, startTime, duration, peakGain) {
  const osc = menuMusicCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const g = menuMusicCtx.createGain();
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(peakGain, startTime + duration * 0.3);
  g.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.connect(g);
  g.connect(menuMusicFilter);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

function scheduleMenuChord(index, time) {
  const chord = MENU_CHORDS[index % MENU_CHORDS.length];
  chord.forEach((note, i) => playMenuPadNote(MENU_NOTE_FREQS[note], time, MENU_CHORD_DUR * 1.1, 0.045 - i * 0.006));
}

function tickMenuMusic() {
  if (!menuMusicActive || !menuMusicCtx) return;
  while (menuMusicNextChordTime < menuMusicCtx.currentTime + 0.5) {
    if (menuMusicOn) scheduleMenuChord(menuMusicChordIndex, menuMusicNextChordTime);
    menuMusicChordIndex += 1;
    menuMusicNextChordTime += MENU_CHORD_DUR;
  }
}

function startMenuMusic() {
  if (!menuMusicCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    menuMusicCtx = new AudioCtx();
    menuMusicFilter = menuMusicCtx.createBiquadFilter();
    menuMusicFilter.type = 'lowpass';
    menuMusicFilter.frequency.value = 1600;
    menuMusicGain = menuMusicCtx.createGain();
    menuMusicGain.gain.value = 0.22;
    menuMusicFilter.connect(menuMusicGain);
    menuMusicGain.connect(menuMusicCtx.destination);
  }
  // Resume even if already "active" — creating/starting a context before any user gesture
  // leaves it suspended under browser autoplay policy, and the first click/keypress needs to
  // actually unstick it rather than no-op just because scheduling was already running.
  if (menuMusicCtx.state === 'suspended') menuMusicCtx.resume();
  if (menuMusicActive) return;
  menuMusicChordIndex = 0;
  menuMusicNextChordTime = menuMusicCtx.currentTime + 0.1;
  menuMusicActive = true;
  clearInterval(menuMusicTimer);
  menuMusicTimer = setInterval(tickMenuMusic, 200);
}

function stopMenuMusic() {
  menuMusicActive = false;
  clearInterval(menuMusicTimer);
  menuMusicTimer = null;
}

if (menuMusicToggleBtn) {
  menuMusicToggleBtn.textContent = menuMusicOn ? '🔊' : '🔇';
  menuMusicToggleBtn.addEventListener('click', () => {
    menuMusicOn = !menuMusicOn;
    try { localStorage.setItem(MENU_MUSIC_MUTE_KEY, menuMusicOn ? '0' : '1'); } catch { /* no-op */ }
    menuMusicToggleBtn.textContent = menuMusicOn ? '🔊' : '🔇';
    if (menuMusicOn) startMenuMusic();
  });
}

// Autoplay policies block audio until a real user gesture — start (or resume) on the first
// click/keypress anywhere on the menu screens, in addition to the showScreen() hook below.
function primeMenuMusicOnce() {
  if (menuMusicOn) startMenuMusic();
  document.removeEventListener('pointerdown', primeMenuMusicOnce);
  document.removeEventListener('keydown', primeMenuMusicOnce);
}
document.addEventListener('pointerdown', primeMenuMusicOnce, { once: true });
document.addEventListener('keydown', primeMenuMusicOnce, { once: true });

// --- Fullscreen ---
// The voice-call panel is `position: fixed`, which only reaches the edge of the
// browser's own viewport, not the physical screen — going fullscreen makes those
// the same thing, since it removes the browser chrome/window entirely.
if (fullscreenBtn && document.documentElement.requestFullscreen) {
  fullscreenBtn.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  });

  document.addEventListener('fullscreenchange', () => {
    fullscreenBtn.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
  });
} else if (fullscreenBtn) {
  fullscreenBtn.classList.add('hidden');
}

function showScreen(screen) {
  [loginScreen, roomSelectScreen, chatScreen].forEach((s) => s.classList.add('hidden'));
  screen.classList.remove('hidden');
  updateWorldwideVisibility();
  if (menuMusicToggleBtn) menuMusicToggleBtn.classList.toggle('hidden', screen === chatScreen);
  if (screen === chatScreen) {
    stopMenuMusic();
  } else if (menuMusicOn) {
    startMenuMusic();
  }
  if (themeToggleBtn && themeToggleSlot) {
    if (screen === chatScreen) {
      themeToggleSlot.appendChild(themeToggleBtn);
      themeToggleBtn.classList.add('inline');
    } else {
      document.body.appendChild(themeToggleBtn);
      themeToggleBtn.classList.remove('inline');
    }
  }
}

function updateWorldwideVisibility() {
  const inChat = !chatScreen.classList.contains('hidden');
  worldwideBadge.classList.toggle('hidden', !hasWorldwideCount || inChat);
  headerWorldwideEl.classList.toggle('hidden', !hasWorldwideCount || !inChat);
}

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.addEventListener('open', () => {
    if (myUsername) {
      ws.send(JSON.stringify({ type: 'join-server', username: myUsername, accountToken: accountToken || undefined }));
    }
  });

  ws.addEventListener('message', (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (err) {
      reportClientError('Malformed WS frame: ' + err.message, err.stack);
      return;
    }
    handleServerMessage(data);
  });

  ws.addEventListener('close', () => {
    // The server already drops this client from any active voice call the moment its socket
    // closes (leaveRoom → the call roster loses this participant, everyone else gets
    // removeVoicePeer) — but without this, the client's own state doesn't know that happened:
    // voiceActive stays true, the mic (localStream) keeps recording, every RTCPeerConnection in
    // voicePeers is left dangling, and the call overlay stays on screen. A brief network drop or
    // tab suspend during a call used to leave the user talking into a call that looks fully live
    // but is actually already over for everyone else, with no indication anything happened.
    if (voiceActive) hangUpVoiceCall();
    setTimeout(connect, 1500);
  });
}

function handleServerMessage(data) {
  switch (data.type) {
    case 'joined-server':
      clearTimeout(loginTimeoutId);
      setLoginPending(false);
      myProfile = data.profile;
      roomProfiles.set(myProfile.name, { avatarUrl: myProfile.avatarUrl, status: myProfile.status });
      renderMyProfile();
      loginErrorEl.classList.add('hidden');
      welcomeTextEl.textContent = `Hey, ${myProfile.name}`;
      requestNotificationPermission();
      if (accountToken) subscribeToPush();
      if (currentRoomCode) {
        pendingJoinPin = '';
        ws.send(JSON.stringify({ type: 'join-room', code: currentRoomCode }));
      } else {
        renderRecentRooms();
        showScreen(roomSelectScreen);
      }
      break;

    case 'error':
      console.error(data.message);
      if (data.message) showAppToast(data.message);
      break;

    case 'kicked':
      showAppToast(`You were removed from the room by ${data.by}`);
      currentRoomCode = null;
      messagesEl.innerHTML = '';
      closeMenu();
      hangUpVoiceCall();
      showScreen(roomSelectScreen);
      break;

    case 'user-muted':
      renderSystem({ text: `🔇 ${data.name} was muted` });
      break;

    case 'user-unmuted':
      renderSystem({ text: `🔊 ${data.name} was unmuted` });
      break;

    case 'user-banned':
      renderSystem({ text: `🚫 ${data.name} was banned` });
      break;

    case 'bans-result':
      renderBansList(data.bans || []);
      break;

    case 'media-result':
      renderGallery(data.media || []);
      break;

    case 'thread-result':
      renderThread(data.root, data.replies || []);
      break;

    case 'poll-voted': {
      seedPollVotes(data.messageId, data.votes);
      const el = document.getElementById(`msg-${data.messageId}`);
      const bubble = el && el.querySelector('.bubble');
      const oldCard = bubble && bubble.querySelector('.poll-card');
      if (bubble && oldCard) {
        // Re-render just the poll card in place — everything renderPoll needs (data.id/text)
        // is already on the message, we just need the freshly-seeded vote counts.
        const msgData = { id: data.messageId, text: oldCard.dataset.pollText };
        oldCard.remove();
        renderPoll(bubble, msgData);
      }
      break;
    }

    case 'joined-room':
      currentRoomCode = data.code;
      currentRoomName = data.name || null;
      isHost = !!data.isHost;
      currentRoomPin = pendingJoinPin;
      pendingJoinPin = '';
      roomPinInput.classList.add('hidden');
      roomPinInput.value = '';
      messagesEl.innerHTML = '';
      lastMessageEl = null;
      lastMessageId = null;
      readReceiptsByName.clear();
      typingTimers.forEach((t) => clearTimeout(t));
      typingTimers.clear();
      renderTypingIndicator();
      clearReplyingTo();
      // A thread left open while switching rooms kept pointing at the old room's root message —
      // the server silently drops the reply link for a cross-room id (room_code mismatch), so a
      // reply typed there posted as an ordinary top-level message with no error shown.
      threadOverlay.classList.add('hidden');
      currentThreadRootId = null;
      seedReactions(data.reactions);
      seedActivity(data.activity);
      pinnedMessages = data.pins || [];
      renderPinnedBanner();
      currentAnnouncement = data.announcement || null;
      renderAnnouncementBanner();
      if (data.voiceCallActive && !voiceActive) {
        voiceCallBannerText.textContent = 'Voice call in progress';
        voiceCallBanner.classList.remove('hidden');
      } else {
        voiceCallBanner.classList.add('hidden');
      }
      announcementForm.classList.toggle('hidden', !isHost);
      announcementInput.value = currentAnnouncement || '';
      roomPinForm.classList.toggle('hidden', !isHost);
      roomPinFormInput.value = '';
      wallpaperRow.classList.toggle('hidden', !isHost);
      applyWallpaper(data.wallpaperUrl || null);
      bansRow.classList.toggle('hidden', !isHost);
      bansListEl.classList.add('hidden');
      unreadCount = 0;
      updateUnreadBadge();
      data.messages.forEach(renderMessage);
      if (data.messages.length) sendReadReceipt(data.messages[data.messages.length - 1].id);
      roomCodeChip.textContent = currentRoomName ? `${currentRoomName} (${data.code})` : data.code;
      menuRoomCode.textContent = data.code;
      renameRoomInput.value = currentRoomName || '';
      renderOnlineList(data.users);
      updateGameLinks();
      saveRecentRoom(data.code, currentRoomName);
      showScreen(chatScreen);
      messageInput.focus();
      subscribeToPush();
      break;

    case 'join-error':
      if (data.nameTaken) {
        // currentRoomCode stays set (unlike the other join-error cases below) so the existing
        // auto-rejoin-on-joined-server path retries this same room once a new name is picked.
        loginErrorEl.textContent = data.message;
        loginErrorEl.classList.remove('hidden');
        usernameInput.value = myProfile ? myProfile.name : usernameInput.value;
        showScreen(loginScreen);
        usernameInput.focus();
        usernameInput.select();
        break;
      }
      currentRoomCode = null;
      roomErrorEl.textContent = data.message;
      roomErrorEl.classList.remove('hidden');
      if (data.pinRequired) {
        roomPinInput.classList.remove('hidden');
        roomPinInput.focus();
      }
      showScreen(roomSelectScreen);
      break;

    case 'left-room':
      currentRoomCode = null;
      isHost = false;
      messagesEl.innerHTML = '';
      closeMenu();
      hangUpVoiceCall();
      voiceCallBanner.classList.add('hidden');
      unreadCount = 0;
      updateUnreadBadge();
      showScreen(roomSelectScreen);
      break;

    case 'message':
      renderMessage(data);
      sendReadReceipt(data.id);
      if (currentThreadRootId && data.replyPreview && data.replyPreview.id === currentThreadRootId) {
        const emptyState = threadRepliesEl.querySelector('.search-status');
        if (emptyState) threadRepliesEl.innerHTML = '';
        renderThreadMessage(threadRepliesEl, data);
      }
      if (data.sub !== myProfile.sub) {
        const mentioned = messageHasMention(data.text, myProfile.name);
        notify(mentioned ? `${data.name} mentioned you` : data.name, data.text, { messageId: data.id });
        playNotifySound();
        if (document.hidden) {
          unreadCount++;
          updateUnreadBadge();
        }
      }
      break;

    case 'system':
      renderSystem(data);
      break;

    case 'presence':
      renderOnlineList(data.users);
      break;

    case 'room-renamed':
      currentRoomName = data.name || null;
      roomCodeChip.textContent = currentRoomName ? `${currentRoomName} (${currentRoomCode})` : currentRoomCode;
      renameRoomInput.value = currentRoomName || '';
      saveRecentRoom(currentRoomCode, currentRoomName);
      break;

    case 'room-pin-updated':
      showAppToast(data.pinRequired ? '🔒 Room PIN set' : '🔓 Room PIN removed');
      roomPinFormInput.value = '';
      break;

    case 'wallpaper-updated':
      applyWallpaper(data.url);
      showAppToast(data.url ? '🖼️ Wallpaper updated' : '🚫 Wallpaper cleared');
      break;

    case 'dm-thread':
      if (currentDmWithName === data.withName) {
        dmMessagesEl.innerHTML = '';
        if (!data.messages.length) {
          dmMessagesEl.innerHTML = '<p class="search-status">No messages yet — say hi!</p>';
        } else {
          data.messages.forEach(renderDmMessage);
          dmMessagesEl.scrollTop = dmMessagesEl.scrollHeight;
        }
      }
      break;

    case 'dm': {
      const otherName = data.fromName === (myProfile && myProfile.name) ? data.toName : data.fromName;
      if (dmOverlay && !dmOverlay.classList.contains('hidden') && currentDmWithName === otherName) {
        const empty = dmMessagesEl.querySelector('.search-status');
        if (empty) dmMessagesEl.innerHTML = '';
        renderDmMessage(data);
        dmMessagesEl.scrollTop = dmMessagesEl.scrollHeight;
      } else if (data.fromName !== (myProfile && myProfile.name)) {
        showAppToast(`💬 New DM from ${data.fromName}`);
        playNotifySound();
      }
      break;
    }

    // Friend DM landing live (the sender is signed in and we have an open connection right
    // now) — the server also always fires a real push notification alongside this, per the
    // "notified whether online or offline" ask, so offline devices still get it.
    case 'friend-dm':
      showAppToast(`💬 ${data.from} sent you a DM: ${data.text}`);
      playNotifySound();
      notify(`${data.from} sent you a DM`, data.text);
      break;

    case 'friend-dm-sent':
      showAppToast(`💬 DM sent to ${data.toUsername}`);
      break;

    case 'group-dm-threads':
      lastLoadedThreads = data.threads;
      renderGroupThreads(data.threads);
      break;

    case 'group-dm-created':
      showAppToast(`💬 Group DM ${data.thread.name ? `"${data.thread.name}"` : 'started'}`);
      if (groupsOverlay && !groupsOverlay.classList.contains('hidden')) loadGroupThreads();
      break;

    case 'group-dm-messages':
      if (currentGroupDmId === data.groupId) {
        groupDmMessagesEl.innerHTML = '';
        if (!data.messages.length) {
          groupDmMessagesEl.innerHTML = '<p class="search-status">No messages yet — say hi!</p>';
        } else {
          data.messages.forEach(renderGroupDmMessage);
          groupDmMessagesEl.scrollTop = groupDmMessagesEl.scrollHeight;
        }
      }
      break;

    case 'group-dm-sent':
      if (currentGroupDmId === data.message.groupId) {
        const empty = groupDmMessagesEl.querySelector('.search-status');
        if (empty) groupDmMessagesEl.innerHTML = '';
        renderGroupDmMessage(data.message);
        groupDmMessagesEl.scrollTop = groupDmMessagesEl.scrollHeight;
      }
      break;

    // A group DM landing live from someone else — same "live if connected, push if not" delivery
    // as friend-dm above, just fanned out to every member instead of one recipient.
    case 'group-dm':
      if (currentGroupDmId === data.groupId && groupDmOverlay && !groupDmOverlay.classList.contains('hidden')) {
        const empty = groupDmMessagesEl.querySelector('.search-status');
        if (empty) groupDmMessagesEl.innerHTML = '';
        renderGroupDmMessage(data);
        groupDmMessagesEl.scrollTop = groupDmMessagesEl.scrollHeight;
      } else {
        showAppToast(`💬 ${data.fromName} (group): ${data.text}`);
        playNotifySound();
      }
      break;

    case 'announcement-updated':
      currentAnnouncement = data.text || null;
      renderAnnouncementBanner();
      if (isHost) announcementInput.value = currentAnnouncement || '';
      break;

    case 'name-updated': {
      const previousName = myProfile ? myProfile.name : null;
      if (myProfile) myProfile.name = data.name;
      myUsername = data.name;
      if (previousName && previousName !== data.name) {
        roomProfiles.set(data.name, roomProfiles.get(previousName) || { avatarUrl: myProfile && myProfile.avatarUrl, status: myProfile && myProfile.status });
      }
      renderMyProfile();
      break;
    }

    case 'profile-updated':
      roomProfiles.set(data.name, { avatarUrl: data.avatarUrl, status: data.status });
      if (myProfile && data.name === myProfile.name) {
        myProfile.avatarUrl = data.avatarUrl;
        myProfile.status = data.status;
        renderMyProfile();
      }
      renderOnlineList(lastRoomUsers);
      break;

    case 'reaction':
      applyReaction(data.messageId, data.emoji, data.name, data.added);
      break;

    case 'message-edited': {
      const bubble = document.querySelector(`#msg-${data.messageId} .bubble`);
      const textEl = bubble && bubble.querySelector('.text, .edit-message-form');
      if (textEl) {
        const fresh = document.createElement('span');
        fresh.className = 'text';
        fresh.dataset.rawText = data.text;
        fresh.appendChild(renderTextWithMentions(data.text));
        textEl.replaceWith(fresh);
      }
      const metaEl = bubble && bubble.querySelector('.meta');
      if (metaEl && !metaEl.textContent.includes('edited')) metaEl.textContent += ' · edited';
      break;
    }

    case 'message-deleted': {
      const el = document.getElementById(`msg-${data.messageId}`);
      if (el) {
        const bubble = el.querySelector('.bubble');
        const metaText = bubble.querySelector('.meta')?.textContent || '';
        bubble.innerHTML = '';
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = metaText;
        const text = document.createElement('span');
        text.className = 'text deleted-text';
        text.textContent = 'This message was deleted';
        bubble.append(meta, text);
      }
      break;
    }

    case 'pins-updated':
      pinnedMessages = data.pins || [];
      renderPinnedBanner();
      break;

    case 'typing':
      showTyping(data.name);
      break;

    case 'read-receipt':
      readReceiptsByName.set(data.name, data.messageId);
      renderSeenBy();
      break;

    case 'room-activity':
      seedActivity(data.activity);
      renderOnlineList(lastRoomUsers);
      break;

    case 'worldwide':
      hasWorldwideCount = true;
      worldwideCountEl.textContent = data.count;
      worldwideCountChatEl.textContent = data.count;
      updateWorldwideVisibility();
      break;

    // --- Voice call signaling (server just relays; audio is peer-to-peer) ---
    case 'voice-peers':
      // We just joined the call — we already know about everyone here, so
      // we're the ones who make the offer to each of them.
      data.peers.forEach((p) => {
        addVoicePeer(p.sub, p.name);
        makeVoiceOffer(p.sub);
      });
      break;

    case 'voice-peer-joined':
      // Someone joined after us — they'll send us an offer, we just wait for it.
      addVoicePeer(data.sub, data.name);
      break;

    case 'voice-signal':
      handleVoiceSignal(data.from, data.signal);
      break;

    case 'voice-peer-left':
      removeVoicePeer(data.sub);
      break;

    case 'voice-call-started':
      // Someone else started a call in this room — surface a tap-to-join banner
      // instead of making everyone open the menu to discover a call is live.
      if (!voiceActive) {
        voiceCallBannerText.textContent = `${data.name} started a voice call`;
        voiceCallBanner.classList.remove('hidden');
      }
      break;

    case 'voice-call-ended':
      voiceCallBanner.classList.add('hidden');
      break;

    case 'voice-share':
      // sharing:true is handled by the video track arriving via 'track' above;
      // sharing:false we act on directly so the tile reverts even if the
      // track-ended signal is slow or missed.
      if (!data.sharing) clearTileSharing(data.sub);
      break;

    case 'hand-raised':
      setTileHandRaised(data.sub, true);
      break;

    case 'hand-lowered':
      setTileHandRaised(data.sub, false);
      break;

    case 'mute-all-request': {
      const track = localStream && localStream.getAudioTracks()[0];
      if (track && track.enabled) {
        if (pttMode) pttStop();
        else toggleMic();
      }
      voiceErrorEl.textContent = `${data.fromName} asked everyone to mute — tap Unmute anytime.`;
      voiceErrorEl.classList.remove('hidden');
      setCallExpanded(true);
      clearTimeout(muteAllNoticeTimer);
      muteAllNoticeTimer = setTimeout(() => voiceErrorEl.classList.add('hidden'), 6000);
      break;
    }
  }
}

function initials(name) {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 55%)`;
}

const roomProfiles = new Map(); // name -> { avatarUrl, status }

function makeAvatar(name, size) {
  const el = document.createElement('div');
  el.className = 'avatar' + (size === 'small' ? ' small' : '');
  const profile = roomProfiles.get(name);
  if (profile && profile.avatarUrl) {
    const img = document.createElement('img');
    img.src = profile.avatarUrl;
    img.alt = name;
    el.appendChild(img);
  } else {
    el.textContent = initials(name);
    el.style.background = avatarColor(name);
  }
  return el;
}

// --- Link previews (URL unfurl) --- session-only cache, avoids re-fetching the same URL twice.
const linkPreviewCache = new Map();
function renderLinkPreview(bubble, url) {
  const card = document.createElement('a');
  card.className = 'link-preview-card hidden';
  card.href = url;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';
  bubble.appendChild(card);

  const apply = (data) => {
    if (!data || (!data.title && !data.image)) return;
    card.innerHTML = '';
    if (data.image) {
      const img = document.createElement('img');
      img.className = 'link-preview-image';
      img.src = data.image;
      img.alt = '';
      card.appendChild(img);
    }
    const info = document.createElement('div');
    info.className = 'link-preview-info';
    if (data.title) {
      const title = document.createElement('div');
      title.className = 'link-preview-title';
      title.textContent = data.title;
      info.appendChild(title);
    }
    if (data.description) {
      const desc = document.createElement('div');
      desc.className = 'link-preview-desc';
      desc.textContent = data.description;
      info.appendChild(desc);
    }
    card.appendChild(info);
    card.classList.remove('hidden');
  };

  if (linkPreviewCache.has(url)) {
    apply(linkPreviewCache.get(url));
    return;
  }
  fetch(`/link-preview?url=${encodeURIComponent(url)}`)
    .then((r) => r.json())
    .then((data) => {
      linkPreviewCache.set(url, data);
      apply(data);
    })
    .catch(() => {});
}

function renderMessage(data, opts = {}) {
  const prepend = !!opts.prepend;
  const el = document.createElement('div');
  const isOwn = myProfile && data.sub === myProfile.sub;
  const isBlocked = !isOwn && blockedNames.has(data.name);
  el.className = 'message' + (isOwn ? ' own' : '') + (isBlocked ? ' blocked-hidden' : '');
  el.dataset.senderName = data.name;
  if (data.id) {
    el.id = `msg-${data.id}`;
    el.dataset.messageId = data.id;
  }
  const time = new Date(data.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = `${data.name} · ${time}${data.edited ? ' · edited' : ''}`;
  bubble.appendChild(meta);

  if (data.deleted) {
    const text = document.createElement('span');
    text.className = 'text deleted-text';
    text.textContent = 'This message was deleted';
    bubble.appendChild(text);
    el.appendChild(makeAvatar(data.name));
    el.appendChild(bubble);
    messagesEl.appendChild(el);
    scrollToBottom();
    return;
  }

  if (data.replyPreview) {
    const quote = document.createElement('div');
    quote.className = 'reply-quote';
    quote.textContent = `↩ ${data.replyPreview.name}: ${(data.replyPreview.text || '').slice(0, 80)}`;
    quote.addEventListener('click', () => jumpToMessage(data.replyPreview.id));
    bubble.appendChild(quote);
  }

  if (data.mediaType === 'poll') {
    renderPoll(bubble, data);
  } else if (data.mediaUrl) {
    let media;
    let extraClass = '';
    if (data.mediaType === 'video') {
      media = document.createElement('video');
      media.src = data.mediaUrl;
      media.controls = true;
    } else if (data.mediaType === 'audio') {
      media = document.createElement('audio');
      media.src = data.mediaUrl;
      media.controls = true;
      extraClass = ' audio-clip';
    } else {
      media = document.createElement('img');
      media.src = data.mediaUrl;
      media.alt = 'shared image';
    }
    media.className = 'media' + extraClass;
    bubble.appendChild(media);
  }

  if (data.text && data.mediaType !== 'poll') {
    const text = document.createElement('span');
    text.className = 'text';
    // renderTextWithMentions turns **bold**/*italic*/`code` into real elements, so .textContent
    // on this span never contains the original markdown delimiters — startEditingMessage needs
    // the actual raw source text (not the rendered/stripped version) to edit without silently
    // destroying the formatting the moment Save or Cancel is clicked.
    text.dataset.rawText = data.text;
    text.appendChild(renderTextWithMentions(data.text));
    bubble.appendChild(text);
    if (!data.mediaUrl) {
      const urlMatch = data.text.match(/https?:\/\/[^\s<]+/i);
      if (urlMatch) renderLinkPreview(bubble, urlMatch[0]);
    }
  }

  if (data.id) {
    bubble.appendChild(makeMessageActions(data));
    const pillsRow = document.createElement('div');
    pillsRow.className = 'reaction-pills';
    bubble.appendChild(pillsRow);
    renderReactionPills(bubble, data.id);
  }

  el.appendChild(makeAvatar(data.name));
  el.appendChild(bubble);
  messagesEl.appendChild(el);
  scrollToBottom();

  if (data.id) {
    lastMessageEl = el;
    lastMessageId = data.id;
    renderSeenBy();
  }
}

// --- @mentions ---
// Only tokens matching a name currently known to be in the room (via lastRoomUsers) get
// highlighted — an arbitrary "@word" in someone's message shouldn't light up as a mention.
function messageHasMention(text, name) {
  if (!text || !name) return false;
  const re = /@(\S+)/g;
  let m;
  while ((m = re.exec(text))) {
    const token = m[1].replace(/[.,!?;:]+$/, '').toLowerCase();
    if (token === name.toLowerCase() || token === 'everyone') return true;
  }
  return false;
}

// Single left-to-right pass handling **bold**, *italic*, `code`, and @mentions (including the
// special @everyone) together, so e.g. "**@everyone**" or "`@name`" don't fight each other over
// the same text. Bold is checked before italic so "**x**" isn't consumed as "*" + "*x*" + "*".
const FORMAT_RE = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+?)`|@(\S+)/g;

function renderTextWithMentions(text) {
  const frag = document.createDocumentFragment();
  let lastIndex = 0;
  let m;
  FORMAT_RE.lastIndex = 0;
  while ((m = FORMAT_RE.exec(text))) {
    if (m.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
    if (m[1] !== undefined) {
      const strong = document.createElement('strong');
      strong.textContent = m[1];
      frag.appendChild(strong);
    } else if (m[2] !== undefined) {
      const em = document.createElement('em');
      em.textContent = m[2];
      frag.appendChild(em);
    } else if (m[3] !== undefined) {
      const code = document.createElement('code');
      code.className = 'inline-code';
      code.textContent = m[3];
      frag.appendChild(code);
    } else {
      const token = m[4].replace(/[.,!?;:]+$/, '');
      const trailing = m[4].slice(token.length);
      const isEveryone = token.toLowerCase() === 'everyone';
      const isKnown = isEveryone || lastRoomUsers.some((u) => u.name.toLowerCase() === token.toLowerCase());
      if (isKnown) {
        const span = document.createElement('span');
        span.className = isEveryone
          ? 'mention mention-everyone'
          : 'mention' + (myProfile && token.toLowerCase() === myProfile.name.toLowerCase() ? ' mention-me' : '');
        span.textContent = '@' + token;
        frag.appendChild(span);
        if (trailing) frag.appendChild(document.createTextNode(trailing));
      } else {
        frag.appendChild(document.createTextNode('@' + m[4]));
      }
    }
    lastIndex = FORMAT_RE.lastIndex;
  }
  if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
  return frag;
}

function currentMentionQuery() {
  const value = messageInput.value;
  const cursor = messageInput.selectionStart;
  const match = value.slice(0, cursor).match(/@(\S*)$/);
  return match ? match[1] : null;
}

function updateMentionDropdown() {
  const query = currentMentionQuery();
  let matches = query === null ? [] : lastRoomUsers.filter((u) => u.name.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5);
  if (query !== null && 'everyone'.startsWith(query.toLowerCase())) matches = [{ name: 'everyone' }, ...matches].slice(0, 5);
  if (!matches.length) {
    mentionDropdownEl.classList.add('hidden');
    return;
  }
  mentionDropdownEl.innerHTML = '';
  matches.forEach((u) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'mention-dropdown-item';
    item.appendChild(makeAvatar(u.name, 'small'));
    const label = document.createElement('span');
    label.textContent = u.name;
    item.appendChild(label);
    item.addEventListener('mousedown', (e) => { e.preventDefault(); insertMention(u.name); });
    mentionDropdownEl.appendChild(item);
  });
  mentionDropdownEl.classList.remove('hidden');
}

function insertMention(name) {
  const value = messageInput.value;
  const cursor = messageInput.selectionStart;
  const before = value.slice(0, cursor).replace(/@(\S*)$/, `@${name} `);
  messageInput.value = before + value.slice(cursor);
  mentionDropdownEl.classList.add('hidden');
  messageInput.focus();
}

function jumpToMessage(id) {
  const target = document.getElementById(`msg-${id}`);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('highlight');
  setTimeout(() => target.classList.remove('highlight'), 1500);
}

// --- Per-message actions: react / reply / pin ---
function makeMessageActions(data) {
  const actions = document.createElement('div');
  actions.className = 'message-actions';

  const reactBtn = document.createElement('button');
  reactBtn.type = 'button';
  reactBtn.className = 'msg-action-btn';
  reactBtn.textContent = '😀';
  reactBtn.setAttribute('aria-label', 'React');
  reactBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openReactionPicker(reactBtn, data.id);
  });
  actions.appendChild(reactBtn);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'msg-action-btn save-btn' + (isSaved(data.id) ? ' saved' : '');
  saveBtn.textContent = '🔖';
  saveBtn.setAttribute('aria-label', 'Save message');
  saveBtn.addEventListener('click', () => toggleSaveMessage(data));
  actions.appendChild(saveBtn);

  const replyBtn = document.createElement('button');
  replyBtn.type = 'button';
  replyBtn.className = 'msg-action-btn';
  replyBtn.textContent = '↩';
  replyBtn.setAttribute('aria-label', 'Reply');
  replyBtn.addEventListener('click', () => setReplyingTo(data));
  actions.appendChild(replyBtn);

  const threadBtn = document.createElement('button');
  threadBtn.type = 'button';
  threadBtn.className = 'msg-action-btn';
  threadBtn.textContent = '💬';
  threadBtn.setAttribute('aria-label', 'View thread');
  threadBtn.addEventListener('click', () => openThread(data.id));
  actions.appendChild(threadBtn);

  const pinBtn = document.createElement('button');
  pinBtn.type = 'button';
  const alreadyPinned = pinnedMessages.some((p) => p.message.id === data.id);
  pinBtn.className = 'msg-action-btn' + (alreadyPinned ? ' saved' : '');
  pinBtn.textContent = '📌';
  pinBtn.setAttribute('aria-label', alreadyPinned ? 'Unpin message' : 'Pin message');
  pinBtn.addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const type = pinnedMessages.some((p) => p.message.id === data.id) ? 'unpin-message' : 'pin-message';
    ws.send(JSON.stringify({ type, messageId: data.id }));
  });
  actions.appendChild(pinBtn);

  const isOwn = myProfile && data.sub === myProfile.sub;
  if (!isOwn && data.name) {
    const reportBtn = document.createElement('button');
    reportBtn.type = 'button';
    reportBtn.className = 'msg-action-btn';
    reportBtn.textContent = '🚩';
    reportBtn.setAttribute('aria-label', `Report ${data.name}`);
    reportBtn.addEventListener('click', () => reportUser(data.name, data.id, data.text));
    actions.appendChild(reportBtn);
  }
  if (isOwn && !data.mediaUrl) {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'msg-action-btn';
    editBtn.textContent = '✏️';
    editBtn.setAttribute('aria-label', 'Edit message');
    editBtn.addEventListener('click', () => startEditingMessage(data.id));
    actions.appendChild(editBtn);
  }
  if (isOwn || isHost) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'msg-action-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.setAttribute('aria-label', isOwn ? 'Delete message' : `Delete message (host)`);
    deleteBtn.addEventListener('click', () => {
      if (!confirm('Delete this message? This can\'t be undone.')) return;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'delete-message', messageId: data.id }));
    });
    actions.appendChild(deleteBtn);
  }

  return actions;
}

function startEditingMessage(messageId) {
  const bubble = document.querySelector(`#msg-${messageId} .bubble`);
  const textEl = bubble && bubble.querySelector('.text');
  if (!bubble || !textEl) return;
  // .textContent would give the *rendered* text with markdown delimiters already stripped by
  // renderTextWithMentions (e.g. "important" instead of "**important**") — dataset.rawText (set
  // in renderMessage/message-edited) holds the actual source. Fall back to textContent only for
  // a message rendered before this fix shipped and never re-rendered since (page reload picks up
  // the fix on every message going forward).
  const originalText = textEl.dataset.rawText ?? textEl.textContent;

  const editForm = document.createElement('form');
  editForm.className = 'edit-message-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = originalText;
  input.maxLength = 2000;
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.textContent = 'Save';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'edit-cancel-btn';
  editForm.append(input, saveBtn, cancelBtn);

  textEl.replaceWith(editForm);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  const restore = () => {
    const freshText = document.createElement('span');
    freshText.className = 'text';
    freshText.dataset.rawText = originalText;
    freshText.appendChild(renderTextWithMentions(originalText));
    editForm.replaceWith(freshText);
  };
  cancelBtn.addEventListener('click', restore);
  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || text === originalText) { restore(); return; }
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'edit-message', messageId, text }));
  });
}

function openReactionPicker(anchorBtn, messageId) {
  closeReactionPicker();
  const popover = document.createElement('div');
  popover.className = 'reaction-popover';

  const grid = document.createElement('div');
  grid.className = 'reaction-popover-grid';
  REACTION_EMOJIS.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      toggleReaction(messageId, emoji);
      closeReactionPicker();
    });
    grid.appendChild(btn);
  });
  popover.appendChild(grid);

  // Anything not in the quick-pick grid — paste or use the OS's own emoji picker
  // (Win+. / Cmd+Ctrl+Space / mobile emoji keyboard) rather than building a full emoji browser.
  const customForm = document.createElement('form');
  customForm.className = 'reaction-custom-form';
  const customInput = document.createElement('input');
  customInput.type = 'text';
  customInput.placeholder = 'Other emoji…';
  customInput.maxLength = 8;
  const customBtn = document.createElement('button');
  customBtn.type = 'submit';
  customBtn.textContent = 'Add';
  customForm.append(customInput, customBtn);
  customForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const emoji = customInput.value.trim();
    if (!emoji) return;
    toggleReaction(messageId, emoji);
    closeReactionPicker();
  });
  popover.appendChild(customForm);

  anchorBtn.parentElement.appendChild(popover);
  activeReactionPopover = popover;
  setTimeout(() => document.addEventListener('click', closeReactionPickerOnOutsideClick), 0);
}

function closeReactionPicker() {
  if (activeReactionPopover) {
    activeReactionPopover.remove();
    activeReactionPopover = null;
  }
  document.removeEventListener('click', closeReactionPickerOnOutsideClick);
}

function closeReactionPickerOnOutsideClick(e) {
  if (activeReactionPopover && !activeReactionPopover.contains(e.target)) closeReactionPicker();
}

function toggleReaction(messageId, emoji) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'react', messageId, emoji }));
}

function seedReactions(list) {
  reactionsByMessage.clear();
  (list || []).forEach((r) => {
    let reactions = reactionsByMessage.get(r.messageId);
    if (!reactions) {
      reactions = new Map();
      reactionsByMessage.set(r.messageId, reactions);
    }
    let names = reactions.get(r.emoji);
    if (!names) {
      names = new Set();
      reactions.set(r.emoji, names);
    }
    names.add(r.name);
  });
}

function applyReaction(messageId, emoji, name, added) {
  let reactions = reactionsByMessage.get(messageId);
  if (!reactions) {
    reactions = new Map();
    reactionsByMessage.set(messageId, reactions);
  }
  let names = reactions.get(emoji);
  if (!names) {
    names = new Set();
    reactions.set(emoji, names);
  }
  if (added) names.add(name);
  else names.delete(name);
  const el = document.getElementById(`msg-${messageId}`);
  const bubble = el && el.querySelector('.bubble');
  if (bubble) renderReactionPills(bubble, messageId);
}

function renderReactionPills(bubble, messageId) {
  let row = bubble.querySelector('.reaction-pills');
  if (!row) {
    row = document.createElement('div');
    row.className = 'reaction-pills';
    bubble.appendChild(row);
  }
  row.innerHTML = '';
  const reactions = reactionsByMessage.get(messageId);
  if (!reactions) return;
  for (const [emoji, names] of reactions) {
    if (names.size === 0) continue;
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'reaction-pill' + (myProfile && names.has(myProfile.name) ? ' mine' : '');
    pill.textContent = `${emoji} ${names.size}`;
    pill.addEventListener('click', () => toggleReaction(messageId, emoji));
    row.appendChild(pill);
  }
}

// --- Reply preview ---
function setReplyingTo(data) {
  replyingTo = { id: data.id, name: data.name, text: data.text || (data.mediaType ? '(a photo/video)' : '') };
  renderReplyPreview();
  messageInput.focus();
}

function clearReplyingTo() {
  replyingTo = null;
  renderReplyPreview();
}

function renderReplyPreview() {
  if (!replyingTo) {
    replyPreviewEl.classList.add('hidden');
    replyPreviewEl.innerHTML = '';
    return;
  }
  replyPreviewEl.classList.remove('hidden');
  replyPreviewEl.innerHTML = '';
  const text = document.createElement('span');
  text.textContent = `Replying to ${replyingTo.name}: ${replyingTo.text.slice(0, 80)}`;
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'icon-btn';
  cancel.textContent = '✕';
  cancel.setAttribute('aria-label', 'Cancel reply');
  cancel.addEventListener('click', clearReplyingTo);
  replyPreviewEl.append(text, cancel);
}

// --- Room announcement banner (host-set, distinct from pinning an individual message) ---
function renderAnnouncementBanner() {
  if (!currentAnnouncement) {
    announcementBannerEl.classList.add('hidden');
    announcementBannerEl.textContent = '';
    return;
  }
  announcementBannerEl.classList.remove('hidden');
  announcementBannerEl.textContent = `📣 ${currentAnnouncement}`;
}

// --- Pinned messages banner (a room can have several pins now, not just one) ---
function renderPinnedBanner() {
  pinnedBannerEl.innerHTML = '';
  if (!pinnedMessages.length) {
    pinnedBannerEl.classList.add('hidden');
    return;
  }
  pinnedBannerEl.classList.remove('hidden');
  pinnedMessages.forEach((pin) => {
    const row = document.createElement('div');
    row.className = 'pinned-row';
    const text = document.createElement('span');
    const m = pin.message;
    text.textContent = `📌 ${m.name}: ${m.text || '(shared media)'}`;
    text.addEventListener('click', () => jumpToMessage(m.id));
    const unpinBtn = document.createElement('button');
    unpinBtn.type = 'button';
    unpinBtn.className = 'icon-btn';
    unpinBtn.textContent = '✕';
    unpinBtn.setAttribute('aria-label', 'Unpin message');
    unpinBtn.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'unpin-message', messageId: m.id }));
    });
    row.append(text, unpinBtn);
    pinnedBannerEl.appendChild(row);
  });
}

// --- Typing indicator ---
function showTyping(name) {
  if (typingTimers.has(name)) clearTimeout(typingTimers.get(name));
  typingTimers.set(
    name,
    setTimeout(() => {
      typingTimers.delete(name);
      renderTypingIndicator();
    }, 3000)
  );
  renderTypingIndicator();
}

function renderTypingIndicator() {
  const names = [...typingTimers.keys()];
  if (names.length === 0) {
    typingIndicatorEl.classList.add('hidden');
    typingIndicatorEl.textContent = '';
    return;
  }
  typingIndicatorEl.classList.remove('hidden');
  if (names.length === 1) typingIndicatorEl.textContent = `${names[0]} is typing…`;
  else if (names.length === 2) typingIndicatorEl.textContent = `${names[0]} and ${names[1]} are typing…`;
  else typingIndicatorEl.textContent = 'Several people are typing…';
}

// --- Read receipts ---
function sendReadReceipt(messageId) {
  if (!messageId || document.hidden || !document.hasFocus()) return;
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'read', messageId }));
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && lastMessageId) sendReadReceipt(lastMessageId);
});
window.addEventListener('focus', () => {
  if (lastMessageId) sendReadReceipt(lastMessageId);
});

// Tab title/favicon badge clears once the tab is actually looked at again.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !chatScreen.classList.contains('hidden')) {
    unreadCount = 0;
    updateUnreadBadge();
  }
});

function updateUnreadBadge() {
  document.title = unreadCount > 0 ? `(${unreadCount > 99 ? '99+' : unreadCount}) ${baseTitle}` : baseTitle;
  if (!faviconLink || !baseFaviconHref) return;
  if (unreadCount === 0) {
    faviconLink.href = baseFaviconHref;
    return;
  }
  const img = new Image();
  img.onload = () => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    const r = size * 0.32;
    const cx = size - r - 2;
    const cy = r + 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#e0245e';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${r * 1.15}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unreadCount > 9 ? '9+' : String(unreadCount), cx, cy + 1);
    faviconLink.href = canvas.toDataURL('image/png');
  };
  img.src = baseFaviconHref;
}

function renderSeenBy() {
  if (!lastMessageEl) return;
  let row = lastMessageEl.querySelector('.seen-by');
  if (!row) {
    row = document.createElement('div');
    row.className = 'seen-by';
    lastMessageEl.appendChild(row);
  }
  row.innerHTML = '';
  for (const [name, messageId] of readReceiptsByName) {
    if (messageId === lastMessageId && (!myProfile || name !== myProfile.name)) {
      row.appendChild(makeAvatar(name, 'small'));
    }
  }
}

function renderSystem(data) {
  const el = document.createElement('div');
  el.className = 'system';
  el.textContent = data.text;
  messagesEl.appendChild(el);
  scrollToBottom();
}

function renderOnlineList(users) {
  lastRoomUsers = users;
  users.forEach((u) => roomProfiles.set(u.name, { avatarUrl: u.avatarUrl, status: u.status }));
  menuOnlineList.innerHTML = '';
  users.forEach((u) => {
    const li = document.createElement('li');
    const nameWrap = document.createElement('span');
    nameWrap.className = 'online-name-wrap';
    const name = document.createElement('span');
    name.textContent = u.name;
    nameWrap.appendChild(name);
    if (u.status) {
      const status = document.createElement('span');
      status.className = 'status-text';
      status.textContent = u.status;
      nameWrap.appendChild(status);
    }
    li.appendChild(makeAvatar(u.name, 'small'));
    li.appendChild(nameWrap);
    const game = roomActivity.get(u.name);
    if (game) {
      const badge = document.createElement('span');
      badge.className = 'activity-badge';
      badge.textContent = ACTIVITY_BADGES[game] || '🎮';
      badge.title = 'Playing a minigame';
      li.appendChild(badge);
    }
    if (myProfile && u.name !== myProfile.name) {
      const personalActions = document.createElement('span');
      personalActions.className = 'mod-actions';
      const dmBtn = document.createElement('button');
      dmBtn.type = 'button';
      dmBtn.className = 'mod-btn';
      dmBtn.textContent = '💬';
      dmBtn.title = `Direct message ${u.name}`;
      dmBtn.addEventListener('click', () => openDm(u.name));
      personalActions.appendChild(dmBtn);
      const blockBtn = document.createElement('button');
      blockBtn.type = 'button';
      blockBtn.className = 'mod-btn';
      const isUserBlocked = blockedNames.has(u.name);
      blockBtn.textContent = isUserBlocked ? '🚫' : '🙈';
      blockBtn.title = isUserBlocked ? `Unblock ${u.name}` : `Block ${u.name} (hide their messages for just you)`;
      blockBtn.addEventListener('click', () => toggleBlockUser(u.name));
      personalActions.appendChild(blockBtn);
      const reportBtn = document.createElement('button');
      reportBtn.type = 'button';
      reportBtn.className = 'mod-btn';
      reportBtn.textContent = '🚩';
      reportBtn.title = `Report ${u.name} to the admin`;
      reportBtn.addEventListener('click', () => reportUser(u.name));
      personalActions.appendChild(reportBtn);
      li.appendChild(personalActions);
    }
    if (isHost && myProfile && u.name !== myProfile.name) {
      const modActions = document.createElement('span');
      modActions.className = 'mod-actions';
      const muteBtn = document.createElement('button');
      muteBtn.type = 'button';
      muteBtn.className = 'mod-btn';
      muteBtn.textContent = '🔇';
      muteBtn.title = `Mute ${u.name}`;
      muteBtn.addEventListener('click', () => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'mute-user', name: u.name }));
      });
      const kickBtn = document.createElement('button');
      kickBtn.type = 'button';
      kickBtn.className = 'mod-btn';
      kickBtn.textContent = '⛔';
      kickBtn.title = `Kick ${u.name}`;
      kickBtn.addEventListener('click', () => {
        if (!confirm(`Remove ${u.name} from this room?`)) return;
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'kick-user', name: u.name }));
      });
      const banBtn = document.createElement('button');
      banBtn.type = 'button';
      banBtn.className = 'mod-btn';
      banBtn.textContent = '🚫';
      banBtn.title = `Ban ${u.name} (can't rejoin this room)`;
      banBtn.addEventListener('click', () => {
        if (!confirm(`Ban ${u.name} from this room? They won't be able to rejoin until unbanned.`)) return;
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ban-user', name: u.name }));
      });
      modActions.append(muteBtn, kickBtn, banBtn);
      li.appendChild(modActions);
    }
    menuOnlineList.appendChild(li);
  });
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// Real push (delivered even with the tab/app fully closed), on top of the in-tab
// Notification API above. Re-subscribes on every room join so the server always has the
// subscriber's current room+name — subscriptions are keyed by push endpoint, which is
// stable per browser+device, so re-saving just updates which room it points at. Also called
// with no room joined at all (right after 'joined-server', see handleServerMessage) so a
// signed-in account still has a subscription for friend-DM push even between rooms.
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  if (!myProfile) return;
  // requestNotificationPermission() (fired on joined-server) is async and often hasn't
  // resolved yet by the time we get here — wait on the same pending browser prompt rather
  // than bailing out on a still-'default' permission and never retrying.
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      return;
    }
  }
  if (Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      const { publicKey } = await fetch('/push/vapid-public-key').then((r) => r.json());
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    const headers = { 'Content-Type': 'application/json' };
    if (accountToken) headers.Authorization = `Bearer ${accountToken}`;
    await fetch('/push/subscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({ roomCode: currentRoomCode || '', name: myProfile.name, subscription }),
    });
  } catch (err) {
    console.error('Push subscribe failed:', err);
  }
}

// Called on sign-out so this device's push subscription (an app.js:711 joined-room, still
// tied to the account they just signed out of, doesn't silently keep receiving that account's
// friend-DM/@mention pushes. Deliberately narrower than subscribeToPush(): only re-links an
// *existing* subscription as anonymous (server-side account_id -> null, same UPSERT either
// path already goes through) — never creates a fresh subscription or prompts for permission,
// since sign-out isn't the moment to ask someone who never opted into push to opt in.
async function unlinkPushFromAccount() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (!subscription || !myProfile) return;
    await fetch('/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: currentRoomCode || '', name: myProfile.name, subscription }),
    });
  } catch (err) {
    console.error('Push unlink failed:', err);
  }
}

function notify(name, text, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  // Only interrupt with an OS notification when the tab isn't already being looked at — the
  // message is already visible live in the DOM otherwise, so a popup on top would just be noise.
  if (!document.hidden && document.hasFocus()) return;
  const n = new Notification(name, { body: text });
  if (options.messageId) {
    n.onclick = () => {
      window.focus();
      jumpToMessage(options.messageId);
      n.close();
    };
  }
}

// --- Notification sound: synthesized (same "no audio files" approach as the menu song and
// Build Craft's music) so a preference can just be a couple of oscillator tones instead of
// needing shipped sound assets. Plays on every message from someone else, independent of the
// document.hidden gating notify() uses — a quiet chime while the tab is focused is normal chat
// behavior, unlike a popping OS notification. ---
const NOTIFY_SOUND_KEY = 'valk-notify-sound';
let notifySoundChoice = 'chime';
try { notifySoundChoice = localStorage.getItem(NOTIFY_SOUND_KEY) || 'chime'; } catch { /* no-op */ }
let notifyAudioCtx = null;

function ensureNotifyAudioCtx() {
  if (!notifyAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    notifyAudioCtx = new AudioCtx();
  }
  if (notifyAudioCtx.state === 'suspended') notifyAudioCtx.resume();
  return notifyAudioCtx;
}

function playNotifyTone(ctx, freq, startTime, duration, type, gain) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(gain, startTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

const NOTIFY_SOUNDS = {
  chime: (ctx) => {
    const t = ctx.currentTime;
    playNotifyTone(ctx, 880, t, 0.18, 'sine', 0.2);
    playNotifyTone(ctx, 1318.51, t + 0.09, 0.22, 'sine', 0.15);
  },
  pop: (ctx) => playNotifyTone(ctx, 600, ctx.currentTime, 0.08, 'sine', 0.25),
  blip: (ctx) => {
    const t = ctx.currentTime;
    playNotifyTone(ctx, 1200, t, 0.05, 'square', 0.1);
    playNotifyTone(ctx, 1600, t + 0.05, 0.05, 'square', 0.1);
  },
};

function playNotifySound() {
  const fn = NOTIFY_SOUNDS[notifySoundChoice];
  if (!fn) return; // 'none' (or anything unrecognized) stays silent
  const ctx = ensureNotifyAudioCtx();
  if (ctx) fn(ctx);
}

if (notifySoundSelect) {
  notifySoundSelect.value = notifySoundChoice;
  notifySoundSelect.addEventListener('change', () => {
    notifySoundChoice = notifySoundSelect.value;
    try { localStorage.setItem(NOTIFY_SOUND_KEY, notifySoundChoice); } catch { /* no-op */ }
  });
}
if (notifySoundTestBtn) {
  notifySoundTestBtn.addEventListener('click', () => {
    const ctx = ensureNotifyAudioCtx();
    const fn = NOTIFY_SOUNDS[notifySoundSelect.value];
    if (ctx && fn) fn(ctx);
  });
}

function closeMenu() {
  menuOverlay.classList.add('hidden');
}

// Carries the room code + display name into each mini-game's own URL, so its separate
// WebSocket connection knows which shared multiplayer session to join.
function updateGameLinks() {
  if (!currentRoomCode || !myProfile) return;
  // pin is only actually read by aistudio.js/videoeditor.js (for /post-image, /post-media —
  // see server.js) but carried on every link for simplicity; the other games ignore it.
  const params = `?room=${encodeURIComponent(currentRoomCode)}&name=${encodeURIComponent(myProfile.name)}&pin=${encodeURIComponent(currentRoomPin)}`;
  aistudioLink.href = `aistudio.html${params}`;
  videoeditorLink.href = `videoeditor.html${params}`;
  webswingLink.href = `webswing.html${params}`;
  buildcraftLink.href = `buildcraft.html${params}`;
  geometrywaveLink.href = `geometrywave.html${params}`;
  seincejumpLink.href = `seince-jump.html${params}`;
  fighterplaneLink.href = `fighterplane.html${params}`;
  pictionaryLink.href = `pictionary.html${params}`;
  triviaLink.href = `trivia.html${params}`;
  tictactoeLink.href = `tictactoe.html${params}`;
  chessLink.href = `chess.html${params}`;
  hangmanLink.href = `hangman.html${params}`;
  snakeLink.href = `snake.html${params}`;
  g2048Link.href = `2048.html${params}`;
  whiteboardLink.href = `whiteboard.html${params}`;
}

// --- Recent rooms (localStorage by default — this app has no stable per-person identity across
// reconnects, so "your rooms" is normally per-device; signing in to an account, below, syncs
// this same list across devices via the server) ---
const RECENT_ROOMS_KEY = 'valk-recent-rooms';
const RECENT_ROOMS_MAX = 10;

function getRecentRooms() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_ROOMS_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveRecentRoom(code, name) {
  const list = getRecentRooms().filter((r) => r.code !== code);
  list.unshift({ code, name: name || null, lastJoined: Date.now() });
  localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(list.slice(0, RECENT_ROOMS_MAX)));
  if (accountToken) {
    fetch('/account/recent-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
      body: JSON.stringify({ code, name: name || '' }),
    }).catch(() => {
      /* best-effort — the local copy above is already saved either way */
    });
  }
}

function renderRecentRooms() {
  const list = getRecentRooms();
  recentRoomsList.innerHTML = '';
  recentRoomsSection.classList.toggle('hidden', list.length === 0);
  list.forEach((r) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'recent-room-chip';
    chip.textContent = r.name ? `${r.name} (${r.code})` : r.code;
    chip.addEventListener('click', () => {
      roomErrorEl.classList.add('hidden');
      pendingJoinPin = '';
      ws.send(JSON.stringify({ type: 'join-room', code: r.code }));
    });
    recentRoomsList.appendChild(chip);
  });
}

// --- Account (optional — signing in doesn't gate anything else in the app, it only makes the
// recent-rooms list above follow you to another device instead of living solely in this
// browser's localStorage) ---
const ACCOUNT_TOKEN_KEY = 'valk-account-token';
const ACCOUNT_USERNAME_KEY = 'valk-account-username';
let accountToken = localStorage.getItem(ACCOUNT_TOKEN_KEY) || null;
let accountUsername = localStorage.getItem(ACCOUNT_USERNAME_KEY) || null;

function renderAccountState() {
  const signedIn = !!accountToken;
  accountSignedOutView.classList.toggle('hidden', signedIn);
  accountSignedInView.classList.toggle('hidden', !signedIn);
  accountSignoutMenuBtn.classList.toggle('hidden', !signedIn);
  accountToggleBtn.classList.toggle('hidden', signedIn);
  if (signedIn) {
    accountSignedInName.textContent = accountUsername;
    accountSignoutMenuName.textContent = accountUsername;
    accountPanel.classList.remove('hidden');
    if (!usernameInput.value) usernameInput.value = accountUsername;
  }
}

accountToggleBtn.addEventListener('click', () => {
  accountPanel.classList.toggle('hidden');
});

// Shared by password sign-in/signup and Google sign-in below — stores the session, refreshes the
// panel, and syncs recent-rooms both ways so it behaves identically regardless of which auth
// method produced the token.
async function finishAccountSignIn(data) {
  accountToken = data.token;
  accountUsername = data.username;
  localStorage.setItem(ACCOUNT_TOKEN_KEY, accountToken);
  localStorage.setItem(ACCOUNT_USERNAME_KEY, accountUsername);
  renderAccountState();
  // Covers signing into an account after the WebSocket already sent its (accountless)
  // join-server — without this, ws.accountId on the server stays unset until the next
  // reconnect, and friend-DM push subscribing below would have nothing to attach to.
  if (ws && ws.readyState === WebSocket.OPEN && myProfile) {
    ws.send(JSON.stringify({ type: 'join-server', username: myProfile.name, accountToken }));
  }
  subscribeToPush();
  await pushLocalRecentRoomsToAccount();
  syncRecentRoomsFromAccount();
}

async function handleAccountAuth(path) {
  const username = accountUsernameInput.value.trim();
  const email = accountEmailInput.value.trim();
  const password = accountPasswordInput.value;
  accountErrorEl.classList.add('hidden');
  if (!username || !password) return;
  if (path === '/auth/signup' && !email) {
    accountErrorEl.textContent = 'Email is required to create an account';
    accountErrorEl.classList.remove('hidden');
    return;
  }
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    await finishAccountSignIn(data);
    accountPasswordInput.value = '';
    accountEmailInput.value = '';
  } catch (err) {
    accountErrorEl.textContent = err.message;
    accountErrorEl.classList.remove('hidden');
  }
}

// --- Google sign-in (optional, alongside the password form above) — only renders the button at
// all once the server confirms it has a Client ID configured (google-config.json); otherwise this
// silently does nothing and the password form is all the user ever sees, no broken button. ---
(async function initGoogleSignIn() {
  try {
    const res = await fetch('/auth/google-client-id');
    const { clientId } = await res.json();
    if (!clientId || !window.google || !window.google.accounts) return;
    const container = document.getElementById('google-signin-container');
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        accountErrorEl.classList.add('hidden');
        try {
          const authRes = await fetch('/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential }),
          });
          const data = await authRes.json().catch(() => ({}));
          if (!authRes.ok) throw new Error(data.error || 'Google sign-in failed');
          await finishAccountSignIn(data);
        } catch (err) {
          accountErrorEl.textContent = err.message;
          accountErrorEl.classList.remove('hidden');
        }
      },
    });
    window.google.accounts.id.renderButton(container, { theme: 'outline', size: 'large', width: 280 });
    container.classList.remove('hidden');
  } catch {
    // Network hiccup or GIS script blocked (e.g. by an ad/tracker blocker, since accounts.google.com
    // is a third-party origin) — fine either way, the password form still works unaffected.
  }
})();

accountForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleAccountAuth('/auth/login');
});
accountSignupBtn.addEventListener('click', () => handleAccountAuth('/auth/signup'));

function signOutAccount() {
  if (accountToken) {
    fetch('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${accountToken}` } }).catch(() => {});
  }
  unlinkPushFromAccount();
  accountToken = null;
  accountUsername = null;
  localStorage.removeItem(ACCOUNT_TOKEN_KEY);
  localStorage.removeItem(ACCOUNT_USERNAME_KEY);
  // Account-scoped overlays (friends/DMs/group DMs) were otherwise left open showing the
  // signed-out-out account's data — if a different account then signed in in the same tab,
  // stale friend/DM state could persist on screen until the next explicit fetch.
  friendsOverlay.classList.add('hidden');
  dmOverlay.classList.add('hidden');
  currentDmWithName = null;
  groupDmOverlay.classList.add('hidden');
  currentGroupDmId = null;
  renderAccountState();
}
accountSignoutBtn.addEventListener('click', signOutAccount);
accountSignoutMenuBtn.addEventListener('click', signOutAccount);

// Pushes rooms chatted in anonymously before this signup/login to the account's server-side
// list — without this, only rooms joined *after* signing in ever sync to other devices, and
// pre-signup history silently never does. Pushed oldest-first so their server-assigned
// timestamps (the endpoint always stamps `now()`, it doesn't take a client timestamp) still
// come out in roughly the right relative order.
async function pushLocalRecentRoomsToAccount() {
  if (!accountToken) return;
  const local = [...getRecentRooms()].sort((a, b) => a.lastJoined - b.lastJoined);
  for (const r of local) {
    try {
      await fetch('/account/recent-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
        body: JSON.stringify({ code: r.code, name: r.name || '' }),
      });
    } catch {
      /* offline or server unreachable — these just won't have synced yet */
    }
  }
}

// Merges the server-synced list into the local one (newest `lastJoined`/`at` wins per room code)
// rather than replacing it outright, so a room joined on this device moments ago — before the
// fetch below resolves — doesn't get clobbered by an older server copy.
async function syncRecentRoomsFromAccount() {
  if (!accountToken) return;
  try {
    const res = await fetch('/account/recent-rooms', { headers: { Authorization: `Bearer ${accountToken}` } });
    if (!res.ok) return;
    const data = await res.json();
    const byCode = new Map(getRecentRooms().map((r) => [r.code, r]));
    for (const r of data.rooms) {
      const existing = byCode.get(r.code);
      if (!existing || r.at > existing.lastJoined) byCode.set(r.code, { code: r.code, name: r.name || null, lastJoined: r.at });
    }
    const merged = [...byCode.values()].sort((a, b) => b.lastJoined - a.lastJoined).slice(0, RECENT_ROOMS_MAX);
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(merged));
    renderRecentRooms();
  } catch {
    /* offline or server unreachable — keep showing the local list as-is */
  }
}

renderAccountState();
if (accountToken) syncRecentRoomsFromAccount();

// Sign-in/out only fires this in *other* tabs (the tab that made the change already updated
// its own in-memory state directly) — without it, a second open tab keeps showing "signed in"
// after logout and its account-gated requests just silently start 401ing.
window.addEventListener('storage', (e) => {
  if (e.key !== ACCOUNT_TOKEN_KEY) return;
  accountToken = localStorage.getItem(ACCOUNT_TOKEN_KEY) || null;
  accountUsername = localStorage.getItem(ACCOUNT_USERNAME_KEY) || null;
  renderAccountState();
  if (accountToken) syncRecentRoomsFromAccount();
});

// --- Friends (account-only) ---
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// presence is only ever set on entries in the "Your friends" list (requests/outgoing/blocked
// rows don't get a dot) — { online, roomCode } or omitted entirely.
function friendRow(username, actions, presence) {
  const li = document.createElement('li');
  li.className = 'friend-row';
  const buttonsHtml = actions
    .map((a) => {
      const roomAttr = a.roomCode ? ` data-room-code="${escapeHtml(a.roomCode)}"` : '';
      return `<button type="button" class="friend-action-btn${a.danger ? ' danger' : ''}" data-action="${a.action}" data-username="${escapeHtml(username)}"${roomAttr}>${a.label}</button>`;
    })
    .join('');
  const dotHtml = presence
    ? `<span class="presence-dot ${presence.online ? 'online' : 'offline'}" title="${presence.online ? 'Online' : 'Offline'}"></span>`
    : '';
  li.innerHTML = `${dotHtml}<span class="friend-name">${escapeHtml(username)}</span><span class="friend-actions">${buttonsHtml}</span>`;
  return li;
}

async function loadFriends() {
  if (!accountToken) return;
  friendsErrorEl.classList.add('hidden');
  try {
    const [friendsRes, presenceRes] = await Promise.all([
      fetch('/friends', { headers: { Authorization: `Bearer ${accountToken}` } }),
      fetch('/friends/presence', { headers: { Authorization: `Bearer ${accountToken}` } }),
    ]);
    if (!friendsRes.ok) return;
    const data = await friendsRes.json();
    const presenceByName = new Map();
    if (presenceRes.ok) {
      const presenceData = await presenceRes.json();
      presenceData.presence.forEach((p) => presenceByName.set(p.username, p));
    }
    data.friends = data.friends.map((f) => ({
      ...f,
      ...(presenceByName.get(f.username) || { online: false, roomCode: null, roomName: null }),
    }));
    renderFriends(data);
  } catch {
    /* offline or server unreachable — panel just keeps showing whatever it last had */
  }
}

function renderFriends(data) {
  friendRequestsList.innerHTML = '';
  friendRequestsSection.classList.toggle('hidden', data.incoming.length === 0);
  data.incoming.forEach((r) => {
    friendRequestsList.appendChild(
      friendRow(r.username, [
        { action: 'accept', label: 'Accept' },
        { action: 'remove', label: 'Decline', danger: true },
      ])
    );
  });

  friendOutgoingList.innerHTML = '';
  friendOutgoingSection.classList.toggle('hidden', data.outgoing.length === 0);
  data.outgoing.forEach((r) => {
    friendOutgoingList.appendChild(friendRow(r.username, [{ action: 'remove', label: 'Cancel', danger: true }]));
  });

  friendsListEl.innerHTML = '';
  friendsEmptyMsg.classList.toggle('hidden', data.friends.length !== 0);
  data.friends.forEach((f) => {
    const actions = [];
    if (f.online && f.roomCode) actions.push({ action: 'join', label: 'Join', roomCode: f.roomCode });
    actions.push({ action: 'remove', label: 'Remove', danger: true });
    actions.push({ action: 'block', label: 'Block', danger: true });
    friendsListEl.appendChild(friendRow(f.username, actions, { online: f.online }));
  });

  friendBlockedList.innerHTML = '';
  friendBlockedSection.classList.toggle('hidden', data.blocked.length === 0);
  data.blocked.forEach((b) => {
    friendBlockedList.appendChild(friendRow(b.username, [{ action: 'unblock', label: 'Unblock' }]));
  });
}

async function friendAction(action, username) {
  friendsErrorEl.classList.add('hidden');
  try {
    const res = await fetch(`/friends/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
      body: JSON.stringify({ username }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    await loadFriends();
  } catch (err) {
    friendsErrorEl.textContent = err.message;
    friendsErrorEl.classList.remove('hidden');
  }
}

// Switches straight into a friend's room: leaves the current one first (if any — same two
// messages, sent back to back, that "Leave room" then a manual join would produce) so this
// works identically whether it's clicked from the login screen or from inside another room.
function joinFriendRoom(code) {
  if (!code || !ws || ws.readyState !== WebSocket.OPEN) return;
  friendsOverlay.classList.add('hidden');
  clearInterval(friendsPollInterval);
  closeMenu();
  roomErrorEl.classList.add('hidden');
  pendingJoinPin = '';
  if (currentRoomCode) ws.send(JSON.stringify({ type: 'leave-room' }));
  ws.send(JSON.stringify({ type: 'join-room', code }));
}

let friendsPollInterval = null;
const FRIENDS_POLL_MS = 8000;

function openFriendsPanel() {
  const signedIn = !!accountToken;
  friendsSignedOutMsg.classList.toggle('hidden', signedIn);
  friendsSignedInContent.classList.toggle('hidden', !signedIn);
  friendsOverlay.classList.remove('hidden');
  if (signedIn) {
    loadFriends();
    clearInterval(friendsPollInterval);
    friendsPollInterval = setInterval(loadFriends, FRIENDS_POLL_MS);
  }
}

function closeFriendsPanel() {
  friendsOverlay.classList.add('hidden');
  clearInterval(friendsPollInterval);
}

friendsOpenBtn.addEventListener('click', openFriendsPanel);
friendsMenuBtn.addEventListener('click', () => {
  closeMenu();
  openFriendsPanel();
});
friendsCloseBtn.addEventListener('click', closeFriendsPanel);
friendsOverlay.addEventListener('click', (e) => {
  if (e.target === friendsOverlay) closeFriendsPanel();
});

friendAddForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = friendAddInput.value.trim();
  if (!username) return;
  friendAddInput.value = '';
  friendAction('request', username);
});

[friendRequestsList, friendOutgoingList, friendsListEl, friendBlockedList].forEach((list) => {
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.friend-action-btn');
    if (!btn) return;
    if (btn.dataset.action === 'join') {
      joinFriendRoom(btn.dataset.roomCode);
      return;
    }
    friendAction(btn.dataset.action, btn.dataset.username);
  });
});

// --- Friend DM: right-click a name in "Your friends" for a context menu, "Send private DM"
// opens a one-line compose box, Enter (form submit) or the button sends it. ---
let friendContextTarget = null;

function hideFriendContextMenu() {
  friendContextMenu.classList.add('hidden');
  friendContextTarget = null;
}

friendsListEl.addEventListener('contextmenu', (e) => {
  const nameEl = e.target.closest('.friend-name');
  if (!nameEl) return;
  e.preventDefault();
  friendContextTarget = nameEl.closest('.friend-row').querySelector('.friend-action-btn').dataset.username;
  const menuWidth = 200;
  const left = Math.min(e.clientX, window.innerWidth - menuWidth);
  friendContextMenu.style.left = `${Math.max(4, left)}px`;
  friendContextMenu.style.top = `${e.clientY}px`;
  friendContextMenu.classList.remove('hidden');
});

document.addEventListener('click', (e) => {
  if (!friendContextMenu.classList.contains('hidden') && !friendContextMenu.contains(e.target)) {
    hideFriendContextMenu();
  }
});

friendDmContextBtn.addEventListener('click', () => {
  const target = friendContextTarget;
  hideFriendContextMenu();
  if (!target) return;
  friendDmTargetName.textContent = target;
  friendDmForm.dataset.username = target;
  friendDmInput.value = '';
  friendDmOverlay.classList.remove('hidden');
  friendDmInput.focus();
});

friendDmCloseBtn.addEventListener('click', () => friendDmOverlay.classList.add('hidden'));
friendDmOverlay.addEventListener('click', (e) => {
  if (e.target === friendDmOverlay) friendDmOverlay.classList.add('hidden');
});

friendDmForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const toUsername = friendDmForm.dataset.username;
  const text = friendDmInput.value.trim();
  if (!toUsername || !text || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'friend-dm', toUsername, text }));
  friendDmOverlay.classList.add('hidden');
  friendDmInput.value = '';
});

// --- Group DMs: persisted multi-person threads among friends, account-based (works across
// rooms/devices, unlike the room-scoped 1:1 dm-overlay above). ---
let currentGroupDmId = null;
let lastLoadedFriends = [];
let lastLoadedThreads = [];

function renderGroupDmMessage(data) {
  const el = document.createElement('div');
  el.className = 'thread-message' + (myProfile && data.fromName === myProfile.name ? ' own' : '');
  const meta = document.createElement('span');
  meta.className = 'meta';
  const time = new Date(data.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  meta.textContent = `${data.fromName} · ${time}`;
  el.appendChild(meta);
  const text = document.createElement('div');
  text.appendChild(renderTextWithMentions(data.text));
  el.appendChild(text);
  groupDmMessagesEl.appendChild(el);
}

function groupThreadLabel(thread) {
  if (thread.name) return thread.name;
  return thread.members.map((m) => m.username).filter((u) => u !== accountUsername).join(', ') || 'Group DM';
}

function renderGroupThreads(threads) {
  groupsListEl.innerHTML = '';
  groupsEmptyMsg.classList.toggle('hidden', threads.length !== 0);
  threads.forEach((thread) => {
    const li = document.createElement('li');
    li.className = 'friend-row';
    li.dataset.groupId = thread.id;
    // .title is a plain DOM property (not parsed as HTML), so it takes the raw text —
    // unlike the innerHTML below, which needs the escaped version.
    const preview = thread.lastMessage ? `${thread.lastMessage.from_name}: ${thread.lastMessage.text}` : 'No messages yet';
    li.innerHTML = `<span class="friend-name">${escapeHtml(groupThreadLabel(thread))}</span><span class="friend-actions"><button type="button" class="friend-action-btn" data-group-id="${thread.id}">Open</button></span>`;
    li.title = preview;
    groupsListEl.appendChild(li);
  });
}

function loadGroupThreads() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'get-group-dm-threads' }));
}

function openGroupDm(groupId, thread) {
  currentGroupDmId = groupId;
  groupDmTitleEl.textContent = thread ? groupThreadLabel(thread) : 'Group';
  groupDmMembersEl.textContent = thread ? `With ${thread.members.map((m) => m.username).join(', ')}` : '';
  groupDmMessagesEl.innerHTML = '<p class="search-status">Loading…</p>';
  groupsOverlay.classList.add('hidden');
  groupDmOverlay.classList.remove('hidden');
  ws.send(JSON.stringify({ type: 'get-group-dm-messages', groupId }));
  groupDmInput.focus();
}

function renderGroupFriendPicker() {
  groupFriendPicker.innerHTML = '';
  lastLoadedFriends.forEach((f) => {
    const li = document.createElement('li');
    li.className = 'friend-row';
    li.innerHTML = `<label class="friend-name"><input type="checkbox" value="${escapeHtml(f.username)}"> ${escapeHtml(f.username)}</label>`;
    groupFriendPicker.appendChild(li);
  });
}

function openGroupsPanel() {
  const signedIn = !!accountToken;
  groupsSignedOutMsg.classList.toggle('hidden', signedIn);
  groupsSignedInContent.classList.toggle('hidden', !signedIn);
  groupNewForm.classList.add('hidden');
  groupsOverlay.classList.remove('hidden');
  if (signedIn) loadGroupThreads();
}

function closeGroupsPanel() {
  groupsOverlay.classList.add('hidden');
}

groupsOpenBtn.addEventListener('click', openGroupsPanel);
groupsMenuBtn.addEventListener('click', () => {
  closeMenu();
  openGroupsPanel();
});
groupsCloseBtn.addEventListener('click', closeGroupsPanel);
groupsOverlay.addEventListener('click', (e) => {
  if (e.target === groupsOverlay) closeGroupsPanel();
});

groupsListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-group-id]');
  if (!btn) return;
  const groupId = btn.dataset.groupId;
  const thread = lastLoadedThreads.find((t) => t.id === groupId) || null;
  openGroupDm(groupId, thread);
});

groupNewBtn.addEventListener('click', async () => {
  groupNewError.classList.add('hidden');
  groupNewForm.classList.toggle('hidden');
  if (!groupNewForm.classList.contains('hidden')) {
    // Friends list is fetched fresh each time the composer opens rather than trusting whatever
    // was last rendered into the friends overlay (which may never have been opened this session).
    try {
      const res = await fetch('/friends', { headers: { Authorization: `Bearer ${accountToken}` } });
      const data = await res.json();
      lastLoadedFriends = data.friends || [];
      renderGroupFriendPicker();
    } catch {
      groupNewError.textContent = 'Could not load your friends list';
      groupNewError.classList.remove('hidden');
    }
  }
});

groupCreateBtn.addEventListener('click', () => {
  groupNewError.classList.add('hidden');
  const memberUsernames = [...groupFriendPicker.querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.value);
  if (memberUsernames.length < 2) {
    groupNewError.textContent = 'Pick at least 2 friends';
    groupNewError.classList.remove('hidden');
    return;
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'create-group-dm', name: groupNameInput.value.trim(), memberUsernames }));
  groupNewForm.classList.add('hidden');
  groupNameInput.value = '';
});

groupDmCloseBtn.addEventListener('click', () => { groupDmOverlay.classList.add('hidden'); currentGroupDmId = null; });
groupDmOverlay.addEventListener('click', (e) => {
  if (e.target === groupDmOverlay) { groupDmOverlay.classList.add('hidden'); currentGroupDmId = null; }
});

groupDmForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = groupDmInput.value.trim();
  if (!text || !currentGroupDmId || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'send-group-dm', groupId: currentGroupDmId, text }));
  groupDmInput.value = '';
});

renameRoomForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentRoomCode || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'rename-room', name: renameRoomInput.value.trim() }));
});

announcementForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentRoomCode || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'set-announcement', text: announcementInput.value.trim() }));
});

roomPinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentRoomCode || ws.readyState !== WebSocket.OPEN) return;
  const newPin = roomPinFormInput.value.trim();
  ws.send(JSON.stringify({ type: 'set-room-pin', pin: newPin }));
  // Optimistic — the host is the one setting it, so there's no real risk of this being wrong;
  // keeps /search, the export button (reads currentRoomPin live at click time), and the
  // game-page links (see updateGameLinks) working with the new PIN immediately rather than
  // only after some other event happens to refresh them.
  currentRoomPin = newPin;
  updateGameLinks();
});

// --- Room wallpaper (host only) — reuses the same /upload endpoint media messages already use. ---
function applyWallpaper(url) {
  if (url) {
    messagesEl.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url("${url}")`;
    messagesEl.style.backgroundSize = 'cover';
    messagesEl.style.backgroundPosition = 'center';
  } else {
    messagesEl.style.backgroundImage = '';
  }
  wallpaperClearBtn.classList.toggle('hidden', !url);
}

wallpaperSetBtn.addEventListener('click', () => wallpaperFileInput.click());

wallpaperFileInput.addEventListener('change', async () => {
  const file = wallpaperFileInput.files[0];
  wallpaperFileInput.value = '';
  if (!file || !ws || ws.readyState !== WebSocket.OPEN) return;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) return;
    ws.send(JSON.stringify({ type: 'set-wallpaper', url: data.url }));
  } catch {
    console.error('Wallpaper upload failed');
  }
});

wallpaperClearBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'set-wallpaper', url: null }));
});

// --- Room bans (host only) — persistent version of kick, see server.js/db.js room_bans. ---
manageBansBtn.addEventListener('click', () => {
  if (!bansListEl.classList.contains('hidden')) {
    bansListEl.classList.add('hidden');
    return;
  }
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'get-bans' }));
});

function renderBansList(bans) {
  bansListEl.innerHTML = '';
  bansListEl.classList.remove('hidden');
  if (!bans.length) {
    const li = document.createElement('li');
    li.textContent = 'No one is banned from this room.';
    bansListEl.appendChild(li);
    return;
  }
  bans.forEach((b) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${b.target_name} — banned by ${b.banned_by}`;
    li.appendChild(label);
    const unbanBtn = document.createElement('button');
    unbanBtn.type = 'button';
    unbanBtn.className = 'mod-btn';
    unbanBtn.textContent = 'Unban';
    unbanBtn.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'unban-user', banId: b.id }));
    });
    li.appendChild(unbanBtn);
    bansListEl.appendChild(li);
  });
}

// --- My profile: avatar + status, persisted server-side by display name ---
function renderMyProfile() {
  if (!myProfile) return;
  myAvatarBtn.innerHTML = '';
  if (myProfile.avatarUrl) {
    myAvatarBtn.style.background = 'none';
    const img = document.createElement('img');
    img.src = myProfile.avatarUrl;
    img.alt = 'Your profile picture';
    myAvatarBtn.appendChild(img);
  } else {
    myAvatarBtn.textContent = initials(myProfile.name);
    myAvatarBtn.style.background = avatarColor(myProfile.name);
  }
  myNameInput.value = myProfile.name;
  myStatusInput.value = myProfile.status || '';
}

myAvatarBtn.addEventListener('click', () => avatarFileInput.click());

avatarFileInput.addEventListener('change', async () => {
  const file = avatarFileInput.files[0];
  avatarFileInput.value = '';
  if (!file || !ws || ws.readyState !== WebSocket.OPEN) return;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) return;
    ws.send(JSON.stringify({ type: 'set-avatar', avatarUrl: data.url }));
  } catch {
    console.error('Avatar upload failed');
  }
});

function sendStatusUpdate() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'set-status', status: myStatusInput.value.trim() }));
}
myStatusInput.addEventListener('blur', sendStatusUpdate);
myStatusInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); myStatusInput.blur(); }
});

// Display-name rename — works for guests and signed-in accounts alike, since both use
// ws.profile.name as their in-room identity (see 'set-name' in server.js). A signed-in
// account's separate login username is changed via the account-username-form below instead.
function sendNameUpdate() {
  myNameError.classList.add('hidden');
  if (!myProfile || !ws || ws.readyState !== WebSocket.OPEN) return;
  const newName = myNameInput.value.trim();
  if (!newName) {
    myNameInput.value = myProfile.name;
    return;
  }
  if (newName === myProfile.name) return;
  ws.send(JSON.stringify({ type: 'set-name', name: newName }));
}
myNameInput.addEventListener('blur', sendNameUpdate);
myNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); myNameInput.blur(); }
});

accountUsernameToggleBtn.addEventListener('click', () => {
  accountUsernameError.classList.add('hidden');
  accountUsernameForm.classList.toggle('hidden');
  if (!accountUsernameForm.classList.contains('hidden')) {
    accountUsernameFormInput.value = accountUsername || '';
    accountUsernameFormInput.focus();
  }
});

accountUsernameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  accountUsernameError.classList.add('hidden');
  const username = accountUsernameFormInput.value.trim();
  if (!username || !accountToken) return;
  try {
    const res = await fetch('/account/username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
      body: JSON.stringify({ username }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    accountUsername = data.username;
    localStorage.setItem(ACCOUNT_USERNAME_KEY, accountUsername);
    accountSignedInName.textContent = accountUsername;
    accountUsernameForm.classList.add('hidden');
    showAppToast(`✏️ Username changed to ${accountUsername}`);
  } catch (err) {
    accountUsernameError.textContent = err.message;
    accountUsernameError.classList.remove('hidden');
  }
});

// --- Voice call ---
// One RTCPeerConnection per other participant (mesh). The server only relays
// signaling messages (offer/answer/ICE candidates/share-state) — audio and
// screen-share video both flow directly between browsers. Whoever joins the
// call second makes the offer to everyone already on it, so each pair only
// ever gets one offer to start; sharing/un-sharing a screen renegotiates
// that same connection rather than opening a new one.

// Browsers only show the native "Allow microphone?" prompt once per site — if it was
// ever dismissed with Block, later getUserMedia() calls fail silently (no prompt) until
// the user clears that block themselves in the browser's site settings. We can't force
// the prompt back open, so on denial we surface *why* clearly and force the call view
// open (the docked pill hides .error/.call-action-label — see style.css — so a silent
// failure there would look identical to "the app just doesn't ask").
function micErrorMessage(err) {
  if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
    return 'Microphone blocked for this site. Click the padlock/site-info icon next to the address bar → Microphone → Allow, then hit “Enable microphone” below.';
  }
  if (err && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
    return 'No microphone found on this device — you can still listen.';
  }
  return 'Joined without a microphone — you can listen, but others won’t hear you.';
}

async function startVoiceCall() {
  if (voiceActive || !currentRoomCode) return;
  // Set before the getUserMedia await below, not after — otherwise a double-click/double-tap
  // before the prompt resolves passes this guard twice and creates a duplicate call join.
  voiceActive = true;
  const myCallGeneration = voiceCallGeneration;
  voiceCallBanner.classList.add('hidden');
  voiceErrorEl.classList.add('hidden');
  micRetryBtn.classList.add('hidden');

  // A microphone is optional — if it's missing, blocked, or unsupported, we still
  // join so the person can listen; we just send no audio track of our own.
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      localStream = null;
      voiceErrorEl.textContent = micErrorMessage(err);
      voiceErrorEl.classList.remove('hidden');
      micRetryBtn.classList.remove('hidden');
      setCallExpanded(true);
    }
  } else {
    localStream = null;
    voiceErrorEl.textContent = 'Joined without a microphone — this browser can’t access one here (voice calls need HTTPS or localhost).';
    voiceErrorEl.classList.remove('hidden');
    setCallExpanded(true);
  }

  // hangUpVoiceCall() ran while the mic permission prompt was still up (voiceActive is already
  // reset to false in that case, e.g. a WS drop-and-reconnect happening mid-prompt) — resurrecting
  // the call here would leave voiceActive/the Hang Up button permanently out of sync with a live
  // mic capture and no way to stop it. Abandon this stale attempt instead.
  if (myCallGeneration !== voiceCallGeneration) {
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
    return;
  }

  voicecallBtn.textContent = '📞 In call';
  voicecallBtn.disabled = true;
  callOverlay.classList.remove('hidden');
  callRoomCodeEl.textContent = currentRoomCode;
  createCallTile('me', myProfile.name, true);
  if (localStream) {
    localVoiceStop = attachSpeakingDetector(localStream, (speaking) => setTileSpeaking('me', speaking));
  }
  updateMicMuteButton();
  populateMicDevices();

  // Calls don't hang up on their own otherwise — this is a backstop against a tab
  // left open in a call indefinitely (e.g. overnight), not a normal-use limit.
  callAutoHangupTimer = setTimeout(hangUpVoiceCall, CALL_MAX_DURATION_MS);

  ws.send(JSON.stringify({ type: 'voice-join' }));
  closeMenu();
}

// Shows the mute toggle only once there's an actual mic track to mute, and always
// resets it to the unmuted icon/label — a fresh or retried mic track starts enabled.
// When push-to-talk mode is on, it owns the mic track's enabled state instead — the
// normal mute button stays hidden and this just re-applies the current hold state.
function updateMicMuteButton() {
  const track = localStream && localStream.getAudioTracks()[0];
  if (pttMode) {
    micMuteBtn.classList.add('hidden');
    if (track) track.enabled = pttActive;
    return;
  }
  micMuteBtn.classList.toggle('hidden', !track);
  if (track) track.enabled = true;
  micMuteBtn.classList.remove('active');
  document.getElementById('mic-mute-icon').textContent = '🎤';
  micMuteBtn.querySelector('.call-action-label').textContent = ' Mute';
  micMuteBtn.setAttribute('aria-label', 'Mute microphone');
}

function toggleMic() {
  const track = localStream && localStream.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  micMuteBtn.classList.toggle('active', !track.enabled);
  document.getElementById('mic-mute-icon').textContent = track.enabled ? '🎤' : '🔇';
  micMuteBtn.querySelector('.call-action-label').textContent = track.enabled ? ' Mute' : ' Unmute';
  micMuteBtn.setAttribute('aria-label', track.enabled ? 'Mute microphone' : 'Unmute microphone');
}

// --- Push-to-talk ---
// An alternative to always-open mic: while on, the mic track starts (and stays) muted
// except for the moment the hold button/Space bar is actually held down.
function setPttMode(on) {
  pttMode = on;
  pttActive = false;
  pttToggleBtn.classList.toggle('active', on);
  pttToggleBtn.setAttribute('aria-label', on ? 'Disable push-to-talk' : 'Enable push-to-talk');
  pttBtn.classList.toggle('hidden', !on);
  pttBtn.classList.remove('active');
  updateMicMuteButton();
}

function pttStart() {
  if (!pttMode || pttActive) return;
  const track = localStream && localStream.getAudioTracks()[0];
  if (!track) return;
  pttActive = true;
  track.enabled = true;
  pttBtn.classList.add('active');
}

function pttStop() {
  if (!pttMode || !pttActive) return;
  const track = localStream && localStream.getAudioTracks()[0];
  if (track) track.enabled = false;
  pttActive = false;
  pttBtn.classList.remove('active');
}

pttToggleBtn.addEventListener('click', () => setPttMode(!pttMode));
pttBtn.addEventListener('pointerdown', pttStart);
pttBtn.addEventListener('pointerup', pttStop);
pttBtn.addEventListener('pointerleave', pttStop);

// Space bar as an alternative to holding the on-screen button — guarded so it doesn't
// hijack Space while someone's actually typing in the message box.
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && pttMode && document.activeElement !== messageInput && !e.repeat) {
    e.preventDefault();
    pttStart();
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && pttMode) pttStop();
});

// --- Escape closes whichever slide-out overlay is open ---
// Every overlay already supports click-outside-to-close, but none had a keyboard equivalent —
// a keyboard/screen-reader user had to Tab all the way to the ✕ button to get out. Clicking each
// overlay's own close button (rather than just toggling .hidden here) reuses whatever extra
// cleanup it already does — e.g. thread/dm/group-dm close buttons also null out the
// currentThreadRootId/currentDmWithName/currentGroupDmId tracking variables, the same state a
// stale room-switch bug (fixed earlier this session) showed is easy to forget. callOverlay is
// deliberately excluded: Escape hanging up an active voice/video call would be surprising and
// hard to undo.
const ESCAPE_CLOSABLE = [
  [menuOverlay, menuCloseBtn], [searchOverlay, searchCloseBtn], [galleryOverlay, galleryCloseBtn],
  [friendsOverlay, friendsCloseBtn], [friendDmOverlay, friendDmCloseBtn], [groupsOverlay, groupsCloseBtn],
  [groupDmOverlay, groupDmCloseBtn], [savedOverlay, savedCloseBtn], [qrOverlay, qrCloseBtn],
  [threadOverlay, threadCloseBtn], [dmOverlay, dmCloseBtn], [pollOverlay, pollCloseBtn],
];
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const [overlay, closeBtn] of ESCAPE_CLOSABLE) {
    if (overlay && closeBtn && !overlay.classList.contains('hidden')) closeBtn.click();
  }
});

// --- Raise hand / "ask everyone to mute" ---
// Both are *requests*, not server-enforced — this app has no roles/auth, so nothing
// should ever force-mute someone else's mic against their will.
function setHandRaised(raised) {
  handRaised = raised;
  raiseHandBtn.classList.toggle('active', raised);
  raiseHandBtn.setAttribute('aria-label', raised ? 'Lower hand' : 'Raise hand');
  raiseHandBtn.querySelector('.call-action-label').textContent = raised ? ' Lower hand' : ' Raise hand';
  setTileHandRaised('me', raised);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: raised ? 'raise-hand' : 'lower-hand' }));
  }
}

raiseHandBtn.addEventListener('click', () => setHandRaised(!handRaised));

muteAllBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'mute-all-request' }));
});

function setTileHandRaised(sub, raised) {
  const tile = document.getElementById(`call-tile-${sub}`);
  if (tile) tile.classList.toggle('hand-raised', raised);
}

// --- Call recording (client-side, audio-only) ---
// Mixes the local mic and every remote peer's incoming audio into one MediaRecorder via
// a shared AudioContext — recording never touches the server, it's a pure local download.
function startCallRecording() {
  if (callRecorder || !window.MediaRecorder) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  callRecordCtx = new AudioCtx();
  callRecordDest = callRecordCtx.createMediaStreamDestination();

  if (localStream && localStream.getAudioTracks()[0]) {
    callRecordCtx.createMediaStreamSource(new MediaStream([localStream.getAudioTracks()[0]])).connect(callRecordDest);
  }
  for (const peer of voicePeers.values()) {
    if (peer.audioEl && peer.audioEl.srcObject) {
      callRecordCtx.createMediaStreamSource(peer.audioEl.srcObject).connect(callRecordDest);
    }
  }

  const chunks = [];
  const recorder = new MediaRecorder(callRecordDest.stream);
  callRecorder = recorder;
  recorder.addEventListener('dataavailable', (e) => { if (e.data.size) chunks.push(e.data); });
  recorder.addEventListener('stop', () => {
    if (chunks.length) {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `valk-call-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    if (callRecordCtx) callRecordCtx.close();
    callRecordCtx = null;
    callRecordDest = null;
  });
  callRecorder.start();
  callRecordBtn.classList.add('active', 'recording');
  callRecordBtn.setAttribute('aria-label', 'Stop recording');
  callRecordBtn.querySelector('.call-action-label').textContent = ' Stop recording';
}

function stopCallRecording() {
  if (!callRecorder) return;
  if (callRecorder.state !== 'inactive') callRecorder.stop();
  callRecorder = null;
  callRecordBtn.classList.remove('active', 'recording');
  callRecordBtn.setAttribute('aria-label', 'Start recording');
  callRecordBtn.querySelector('.call-action-label').textContent = ' Record';
}

callRecordBtn.addEventListener('click', () => {
  if (callRecorder) stopCallRecording();
  else startCallRecording();
});

// Re-requests the mic without hanging up — lets someone who fixed the browser-level
// block (or plugged in a mic) start being heard mid-call instead of rejoining.
async function retryEnableMicrophone() {
  if (!voiceActive || localStream) return;
  // Same stale-attempt guard as startVoiceCall() — if the call ends while this permission
  // prompt is still up, resurrecting it here would leak a hot mic track + speaking-detector
  // loop with no UI left to stop them.
  const myCallGeneration = voiceCallGeneration;
  let newStream;
  try {
    newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    voiceErrorEl.textContent = micErrorMessage(err);
    voiceErrorEl.classList.remove('hidden');
    return;
  }
  if (myCallGeneration !== voiceCallGeneration) {
    newStream.getTracks().forEach((t) => t.stop());
    return;
  }
  localStream = newStream;
  voiceErrorEl.classList.add('hidden');
  micRetryBtn.classList.add('hidden');
  localVoiceStop = attachSpeakingDetector(localStream, (speaking) => setTileSpeaking('me', speaking));
  updateMicMuteButton();

  const track = localStream.getAudioTracks()[0];
  for (const [sub, peer] of voicePeers) {
    peer.pc.addTrack(track, localStream);
    await makeVoiceOffer(sub);
  }
  populateMicDevices();
}

// --- Microphone device picker ---
// getUserMedia({ audio: true }) just grabs whatever the OS calls the "default" input,
// which is frequently NOT a Bluetooth/USB headset — Bluetooth mics in particular often
// sit on a separate profile the OS doesn't switch to automatically, so "call connects
// fine but no sound comes through" is usually a wrong-device problem, not a broken app.
// This lets someone pick their headset explicitly instead of fighting OS sound settings.
async function populateMicDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  let devices;
  try {
    devices = await navigator.mediaDevices.enumerateDevices();
  } catch {
    return;
  }
  const mics = devices.filter((d) => d.kind === 'audioinput');
  if (mics.length < 2) {
    micDeviceSelect.classList.add('hidden');
    return;
  }
  const currentTrack = localStream && localStream.getAudioTracks()[0];
  const currentId = currentTrack && currentTrack.getSettings().deviceId;
  micDeviceSelect.innerHTML = '';
  mics.forEach((mic, i) => {
    const option = document.createElement('option');
    option.value = mic.deviceId;
    option.textContent = mic.label || `Microphone ${i + 1}`;
    if (mic.deviceId === currentId) option.selected = true;
    micDeviceSelect.appendChild(option);
  });
  micDeviceSelect.classList.remove('hidden');
}

// Swaps the live track on every peer connection via replaceTrack — no renegotiation
// needed, so switching mid-call doesn't cause a reconnect blip for anyone listening.
async function switchMicrophone(deviceId) {
  if (!voiceActive || !deviceId) return;
  // Same stale-attempt guard as startVoiceCall()/retryEnableMicrophone() — picking a device
  // right as the call ends would otherwise leave a hot mic track + speaking-detector loop
  // leaked with no UI left to stop them.
  const myCallGeneration = voiceCallGeneration;
  let newStream;
  try {
    newStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
  } catch (err) {
    voiceErrorEl.textContent = micErrorMessage(err);
    voiceErrorEl.classList.remove('hidden');
    return;
  }
  if (myCallGeneration !== voiceCallGeneration) {
    newStream.getTracks().forEach((t) => t.stop());
    return;
  }
  const newTrack = newStream.getAudioTracks()[0];
  const oldTrack = localStream && localStream.getAudioTracks()[0];
  newTrack.enabled = oldTrack ? oldTrack.enabled : true;

  for (const [, peer] of voicePeers) {
    const sender = peer.pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
    if (sender) await sender.replaceTrack(newTrack);
  }

  if (localVoiceStop) localVoiceStop();
  if (oldTrack) oldTrack.stop();
  localStream = newStream;
  localVoiceStop = attachSpeakingDetector(localStream, (speaking) => setTileSpeaking('me', speaking));
}

micDeviceSelect.addEventListener('change', () => switchMicrophone(micDeviceSelect.value));

// Refreshes the list live if a headset is plugged in / connects over Bluetooth mid-call.
if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    if (voiceActive) populateMicDevices();
  });
}

function hangUpVoiceCall() {
  if (!voiceActive) return;
  voiceActive = false;
  voiceCallGeneration++;
  clearTimeout(callAutoHangupTimer);
  callAutoHangupTimer = null;
  voicecallBtn.textContent = '📞 Start Voice Call';
  voicecallBtn.disabled = false;
  micRetryBtn.classList.add('hidden');
  micMuteBtn.classList.add('hidden');
  micDeviceSelect.classList.add('hidden');

  stopCallRecording();
  setPttMode(false);
  pttBtn.classList.add('hidden');
  if (handRaised) setHandRaised(false);

  if (screenStream) stopScreenShare();

  if (localVoiceStop) localVoiceStop();
  localVoiceStop = null;
  if (localStream) localStream.getTracks().forEach((t) => t.stop());
  localStream = null;

  for (const sub of [...voicePeers.keys()]) removeVoicePeer(sub);

  callGrid.innerHTML = '';
  callOverlay.classList.add('hidden');
  setCallExpanded(false);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'voice-leave' }));
  }
}

function createCallTile(sub, name, isSelf) {
  const tile = document.createElement('div');
  tile.className = 'call-tile';
  tile.id = `call-tile-${sub}`;

  const video = document.createElement('video');
  video.className = 'call-tile-video hidden';
  video.autoplay = true;
  video.playsInline = true;
  if (isSelf) video.muted = true;

  const avatar = document.createElement('div');
  avatar.className = 'call-tile-avatar';
  avatar.style.background = avatarColor(name);
  avatar.textContent = initials(name);

  const live = document.createElement('span');
  live.className = 'call-tile-live hidden';
  live.textContent = '🔴 LIVE';

  const label = document.createElement('span');
  label.className = 'call-tile-name';
  label.textContent = isSelf ? 'You' : name;

  tile.append(video, avatar, live, label);
  callGrid.appendChild(tile);
}

function setTileSpeaking(sub, speaking) {
  const tile = document.getElementById(`call-tile-${sub}`);
  if (tile) tile.classList.toggle('speaking', speaking);
}

function setTileSharing(sub, stream) {
  const tile = document.getElementById(`call-tile-${sub}`);
  if (!tile) return;
  tile.querySelector('.call-tile-video').srcObject = stream;
  tile.querySelector('.call-tile-video').classList.remove('hidden');
  tile.querySelector('.call-tile-avatar').classList.add('hidden');
  tile.querySelector('.call-tile-live').classList.remove('hidden');
}

function clearTileSharing(sub) {
  const tile = document.getElementById(`call-tile-${sub}`);
  if (!tile) return;
  tile.querySelector('.call-tile-video').srcObject = null;
  tile.querySelector('.call-tile-video').classList.add('hidden');
  tile.querySelector('.call-tile-avatar').classList.remove('hidden');
  tile.querySelector('.call-tile-live').classList.add('hidden');
}

function makePeerConnection(sub) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  } else {
    // No mic track to add — without this, an offer built from this connection would
    // carry no audio m-line at all, so we'd never receive the other side's audio either.
    pc.addTransceiver('audio', { direction: 'recvonly' });
  }
  // A screen share already in progress predates this peer connection (e.g. someone joined
  // the call after sharing started) — without this, that share was only ever attached to
  // peers that existed at startScreenShare() time and a late joiner would never see it.
  if (screenStream) {
    const screenTrack = screenStream.getVideoTracks()[0];
    if (screenTrack) pc.addTrack(screenTrack, screenStream);
  }

  pc.addEventListener('icecandidate', (e) => {
    if (e.candidate) {
      ws.send(JSON.stringify({ type: 'voice-signal', to: sub, signal: { type: 'ice', candidate: e.candidate } }));
    }
  });

  pc.addEventListener('track', (e) => {
    const peer = voicePeers.get(sub);
    if (!peer) return;

    if (e.track.kind === 'video') {
      setTileSharing(sub, e.streams[0]);
      return;
    }

    if (!peer.audioEl) {
      peer.audioEl = document.createElement('audio');
      peer.audioEl.autoplay = true;
      peer.audioEl.playsInline = true;
      document.body.appendChild(peer.audioEl);
    }
    peer.audioEl.srcObject = e.streams[0];
    if (peer.stopDetector) peer.stopDetector();
    peer.stopDetector = attachSpeakingDetector(e.streams[0], (speaking) => setTileSpeaking(sub, speaking));
  });

  return pc;
}

function addVoicePeer(sub, name) {
  if (voicePeers.has(sub)) {
    // An offer can beat voice-peer-joined here in rare cases — that earlier
    // path doesn't know the peer's name yet, so fill it in once we do.
    const peer = voicePeers.get(sub);
    if (name && !peer.name) {
      peer.name = name;
      const tile = document.getElementById(`call-tile-${sub}`);
      if (tile) {
        tile.querySelector('.call-tile-name').textContent = name;
        const avatar = tile.querySelector('.call-tile-avatar');
        avatar.style.background = avatarColor(name);
        avatar.textContent = initials(name);
      }
    }
    return;
  }
  const pc = makePeerConnection(sub);
  voicePeers.set(sub, { name, pc, audioEl: null, stopDetector: null, pendingCandidates: [] });
  createCallTile(sub, name, false);
}

async function makeVoiceOffer(sub) {
  const peer = voicePeers.get(sub);
  if (!peer) return;
  try {
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'voice-signal', to: sub, signal: { type: 'offer', sdp: peer.pc.localDescription } }));
  } catch (err) {
    // Every call site either fires this without awaiting (voice-peers) or awaits it inside a
    // for-loop over multiple peers (startScreenShare/toggleMicMute-equivalent re-offer paths) —
    // letting one peer's failure (e.g. its connection was already torn down by a fast leave/
    // rejoin) throw uncaught would silently leave that peer's tile with no audio/screen-share
    // forever, and in the loop cases would abort processing every peer after it too.
    reportClientError('makeVoiceOffer failed for ' + sub + ': ' + err.message, err.stack);
  }
}

async function handleVoiceSignal(from, signal) {
  let peer = voicePeers.get(from);
  if (!peer && signal.type === 'offer') {
    // An offer can arrive before we've heard voice-peer-joined; that's fine,
    // this is the same peer's real name announced separately in that event.
    const pc = makePeerConnection(from);
    peer = { name: '', pc, audioEl: null, stopDetector: null, pendingCandidates: [] };
    voicePeers.set(from, peer);
    createCallTile(from, '', false);
  }
  if (!peer) return;

  if (signal.type === 'offer') {
    await peer.pc.setRemoteDescription(signal.sdp);
    for (const c of peer.pendingCandidates) await peer.pc.addIceCandidate(c);
    peer.pendingCandidates = [];
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: 'voice-signal', to: from, signal: { type: 'answer', sdp: peer.pc.localDescription } }));
    // A screen share already added to this connection (see makePeerConnection) can't ride
    // along in this initial answer — an SDP answer can't add m-lines the offer didn't
    // request — so immediately renegotiate with a follow-up offer to actually deliver it.
    if (screenStream) await makeVoiceOffer(from);
  } else if (signal.type === 'answer') {
    await peer.pc.setRemoteDescription(signal.sdp);
  } else if (signal.type === 'ice') {
    if (peer.pc.remoteDescription) {
      await peer.pc.addIceCandidate(signal.candidate);
    } else {
      peer.pendingCandidates.push(signal.candidate);
    }
  }
}

function removeVoicePeer(sub) {
  const peer = voicePeers.get(sub);
  if (!peer) return;
  if (peer.stopDetector) peer.stopDetector();
  if (peer.pc) peer.pc.close();
  if (peer.audioEl) peer.audioEl.remove();
  voicePeers.delete(sub);
  const el = document.getElementById(`call-tile-${sub}`);
  if (el) el.remove();
}

// --- Screen sharing ---
// Adds/removes a video track on every existing peer connection and renegotiates
// (a fresh offer) each time, rather than opening separate connections for video.
// `voice-share` is sent purely so the *other* side can flip its tile to video
// immediately and reliably, instead of guessing from low-level track events.

async function toggleScreenShare() {
  if (screenStream) {
    stopScreenShare();
  } else {
    await startScreenShare();
  }
}

async function startScreenShare() {
  // Without this, clicking twice before the OS share picker even appears (nothing disables the
  // button in the meantime) fires two independent getDisplayMedia() calls; whichever resolves
  // second silently overwrites `screenStream`, leaking the first capture — its track is never
  // stopped, so the browser's native "sharing this tab/screen" indicator for it never clears.
  if (screenShareStarting || screenStream) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    voiceErrorEl.textContent = 'This browser can’t share your screen.';
    voiceErrorEl.classList.remove('hidden');
    return;
  }
  screenShareStarting = true;

  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  } catch (err) {
    return; // user cancelled the share picker
  } finally {
    screenShareStarting = false;
  }

  const track = screenStream.getVideoTracks()[0];
  track.addEventListener('ended', stopScreenShare); // browser's own "Stop sharing" control

  setTileSharing('me', screenStream);
  callShareBtn.textContent = '🖥️ Stop sharing';
  callShareBtn.classList.add('active');

  for (const [sub, peer] of voicePeers) {
    peer.pc.addTrack(track, screenStream);
    await makeVoiceOffer(sub);
  }
  ws.send(JSON.stringify({ type: 'voice-share', sharing: true }));
}

function stopScreenShare() {
  if (!screenStream) return;
  const track = screenStream.getVideoTracks()[0];

  for (const [sub, peer] of voicePeers) {
    const sender = peer.pc.getSenders().find((s) => s.track === track);
    if (sender) peer.pc.removeTrack(sender);
  }
  screenStream.getTracks().forEach((t) => t.stop());
  screenStream = null;

  clearTileSharing('me');
  callShareBtn.textContent = '🖥️ Share screen';
  callShareBtn.classList.remove('active');

  for (const sub of voicePeers.keys()) makeVoiceOffer(sub);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'voice-share', sharing: false }));
  }
}

// Lights up a participant's ring while their mic is picking up sound above a
// small noise floor, with a short hold so it doesn't flicker between words.
function attachSpeakingDetector(stream, onChange) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return () => {};

  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);
  let speaking = false;
  let holdUntil = 0;
  let rafId;

  function tick() {
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    const now = performance.now();

    if (rms > 0.035) {
      holdUntil = now + 250;
      if (!speaking) { speaking = true; onChange(true); }
    } else if (speaking && now > holdUntil) {
      speaking = false;
      onChange(false);
    }
    rafId = requestAnimationFrame(tick);
  }
  tick();

  return () => {
    cancelAnimationFrame(rafId);
    source.disconnect();
    ctx.close();
  };
}

// --- Login ---
const loginSubmitBtn = loginForm.querySelector('button[type="submit"]');
const loginSubmitLabel = loginSubmitBtn.textContent;
let loginTimeoutId = null;

function setLoginPending(pending) {
  loginSubmitBtn.disabled = pending;
  loginSubmitBtn.textContent = pending ? 'Connecting…' : loginSubmitLabel;
}

// Shared by the manual submit handler below and the two auto-continue paths (rejoin-from-
// minigame-link, auto-signed-in-account) further down this file — those two used to call
// setLoginPending(true) with no timeout armed at all, so an outage during either of them left
// the submit button stuck reading "Connecting…"/"Rejoining…" indefinitely with zero feedback,
// unlike a manual submit which already told the user something was wrong after 8 seconds.
function armLoginTimeout() {
  clearTimeout(loginTimeoutId);
  loginTimeoutId = setTimeout(() => {
    setLoginPending(false);
    loginErrorEl.textContent = "Couldn't connect. Check your connection and try again.";
    loginErrorEl.classList.remove('hidden');
  }, 8000);
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = usernameInput.value.trim();
  if (!name) return;
  myUsername = name;
  loginErrorEl.classList.add('hidden');
  setLoginPending(true);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'join-server', username: myUsername, accountToken: accountToken || undefined }));
  }
  armLoginTimeout();
});

// --- Room select ---
createRoomBtn.addEventListener('click', () => {
  roomErrorEl.classList.add('hidden');
  pendingJoinPin = '';
  ws.send(JSON.stringify({ type: 'create-room' }));
});

joinRoomForm.addEventListener('submit', (e) => {
  e.preventDefault();
  roomErrorEl.classList.add('hidden');
  const code = roomCodeInput.value.trim();
  if (!code) return;
  const payload = { type: 'join-room', code };
  const pin = roomPinInput.value.trim();
  if (pin) payload.pin = pin;
  pendingJoinPin = pin;
  ws.send(JSON.stringify(payload));
});

// --- Chat ---
// Resolved locally (no server round-trip needed) then sent as a normal chat message, so the
// result persists/broadcasts/exports exactly like anything else typed in the box. Unrecognized
// "/word" text is left alone and sent as-is rather than treated as an error.
function resolveSlashCommand(text) {
  const rollMatch = text.match(/^\/roll(?:\s+(\d*)d(\d+))?\s*$/i);
  if (rollMatch) {
    const count = Math.min(20, Math.max(1, parseInt(rollMatch[1] || '1', 10) || 1));
    const sides = Math.min(1000, Math.max(2, parseInt(rollMatch[2] || '6', 10) || 6));
    const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
    const total = rolls.reduce((a, b) => a + b, 0);
    return `🎲 rolled ${count}d${sides}: ${rolls.join(' + ')} = ${total}`;
  }
  if (/^\/flip\s*$/i.test(text)) {
    return `🪙 flipped a coin: ${Math.random() < 0.5 ? 'Heads' : 'Tails'}`;
  }
  const shrugMatch = text.match(/^\/shrug\s*(.*)$/i);
  if (shrugMatch) {
    const prefix = shrugMatch[1].trim();
    return prefix ? `${prefix} ¯\\_(ツ)_/¯` : '¯\\_(ツ)_/¯';
  }
  return text;
}

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = messageInput.value.trim();
  if (!raw || ws.readyState !== WebSocket.OPEN) return;
  const text = resolveSlashCommand(raw);
  const payload = { type: 'message', text };
  if (replyingTo) payload.replyTo = replyingTo.id;
  ws.send(JSON.stringify(payload));
  messageInput.value = '';
  clearReplyingTo();
});

messageInput.addEventListener('input', () => {
  updateMentionDropdown();
  const now = Date.now();
  if (now - lastTypingSentAt < 2000) return;
  lastTypingSentAt = now;
  if (ws && ws.readyState === WebSocket.OPEN && currentRoomCode) ws.send(JSON.stringify({ type: 'typing' }));
});

messageInput.addEventListener('blur', () => {
  setTimeout(() => mentionDropdownEl.classList.add('hidden'), 150);
});

// --- Media upload ---
attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file || ws.readyState !== WebSocket.OPEN) return;

  const formData = new FormData();
  formData.append('file', file);

  attachBtn.disabled = true;
  try {
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      roomErrorEl.textContent = data.error || 'Upload failed';
      return;
    }
    ws.send(JSON.stringify({ type: 'message', mediaUrl: data.url, mediaType: data.mediaType }));
  } catch {
    console.error('Upload failed');
  } finally {
    attachBtn.disabled = false;
  }
});

// --- Sticker picker ---
// Zero server involvement — a sticker send is just a normal chat message whose
// mediaUrl points at a static file Express already serves from public/images/stickers/.
(function initStickerPicker() {
  if (typeof STICKERS === 'undefined') return;
  STICKERS.forEach((s) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sticker-option';
    const img = document.createElement('img');
    img.src = s.url;
    img.alt = s.label;
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'message', mediaUrl: s.url, mediaType: 'image' }));
      }
      stickerPicker.classList.add('hidden');
    });
    stickerPicker.appendChild(btn);
  });
})();

stickerBtn.addEventListener('click', () => {
  stickerPicker.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!stickerPicker.classList.contains('hidden') && !stickerPicker.contains(e.target) && e.target !== stickerBtn) {
    stickerPicker.classList.add('hidden');
  }
});

// --- Voice message clips ---
// A short recorded clip (MediaRecorder), not a live call — reuses the same /upload +
// chat-message pipeline as a file attachment, rather than the WebRTC voice-call path.
// Uses a fresh getUserMedia stream each time, independent of any active call's mic.
let clipRecorder = null;
let clipChunks = [];
let clipStream = null;

if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder) {
  voiceClipBtn.classList.remove('hidden');

  voiceClipBtn.addEventListener('click', async () => {
    if (clipRecorder && clipRecorder.state === 'recording') {
      clipRecorder.stop();
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      roomErrorEl.textContent = micErrorMessage(err);
      return;
    }
    clipStream = stream;
    clipChunks = [];
    clipRecorder = new MediaRecorder(stream);
    clipRecorder.addEventListener('dataavailable', (e) => {
      if (e.data.size) clipChunks.push(e.data);
    });
    clipRecorder.addEventListener('stop', async () => {
      voiceClipBtn.classList.remove('recording');
      clipStream.getTracks().forEach((t) => t.stop());
      clipStream = null;
      if (!clipChunks.length || ws.readyState !== WebSocket.OPEN) return;
      const blob = new Blob(clipChunks, { type: clipRecorder.mimeType || 'audio/webm' });
      const formData = new FormData();
      formData.append('file', blob, 'voice-clip.webm');
      voiceClipBtn.disabled = true;
      try {
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) {
          roomErrorEl.textContent = data.error || 'Upload failed';
          return;
        }
        ws.send(JSON.stringify({ type: 'message', mediaUrl: data.url, mediaType: data.mediaType }));
      } catch {
        console.error('Voice clip upload failed');
      } finally {
        voiceClipBtn.disabled = false;
      }
    });
    clipRecorder.start();
    voiceClipBtn.classList.add('recording');
  });
}

// --- Voice typer ---
// Uses the browser's own built-in speech-to-text (free, no server/API key involved) —
// only Chrome/Edge/Safari ship it under one prefixed name or another, so the button
// stays hidden (see index.html's initial "hidden" class) on browsers without it.
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
let listening = false;
let baseTextBeforeListening = '';

if (SpeechRecognitionCtor) {
  micBtn.classList.remove('hidden');

  recognizer = new SpeechRecognitionCtor();
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.lang = navigator.language || 'en-US';

  recognizer.addEventListener('result', (e) => {
    let finalText = '';
    let interimText = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const chunk = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += chunk;
      else interimText += chunk;
    }
    if (finalText) baseTextBeforeListening = `${baseTextBeforeListening}${finalText} `.replace(/^\s+/, '');
    messageInput.value = `${baseTextBeforeListening}${interimText}`;
  });

  recognizer.addEventListener('end', () => {
    listening = false;
    micBtn.classList.remove('listening');
    micBtn.setAttribute('aria-label', 'Speak your message');
  });

  recognizer.addEventListener('error', () => {
    listening = false;
    micBtn.classList.remove('listening');
    micBtn.setAttribute('aria-label', 'Speak your message');
  });

  micBtn.addEventListener('click', () => {
    if (listening) {
      recognizer.stop();
      return;
    }
    baseTextBeforeListening = messageInput.value ? `${messageInput.value.trim()} ` : '';
    listening = true;
    micBtn.classList.add('listening');
    micBtn.setAttribute('aria-label', 'Stop listening');
    try {
      recognizer.start();
    } catch {
      listening = false;
      micBtn.classList.remove('listening');
    }
  });
}

// --- Menu ---
menuBtn.addEventListener('click', () => menuOverlay.classList.remove('hidden'));
menuCloseBtn.addEventListener('click', closeMenu);
menuOverlay.addEventListener('click', (e) => {
  if (e.target === menuOverlay) closeMenu();
});
leaveRoomBtn.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'leave-room' }));
});

// --- Search ---
searchBtn.addEventListener('click', () => {
  closeMenu();
  searchResultsEl.innerHTML = '';
  searchInput.value = '';
  searchOverlay.classList.remove('hidden');
  searchInput.focus();
});
searchCloseBtn.addEventListener('click', () => searchOverlay.classList.add('hidden'));
searchOverlay.addEventListener('click', (e) => {
  if (e.target === searchOverlay) searchOverlay.classList.add('hidden');
});

// --- Media gallery ---
galleryBtn.addEventListener('click', () => {
  closeMenu();
  galleryGridEl.innerHTML = '<p class="search-status">Loading…</p>';
  galleryOverlay.classList.remove('hidden');
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'get-media' }));
});
galleryCloseBtn.addEventListener('click', () => galleryOverlay.classList.add('hidden'));
galleryOverlay.addEventListener('click', (e) => {
  if (e.target === galleryOverlay) galleryOverlay.classList.add('hidden');
});

// --- Saved messages ---
savedBtn.addEventListener('click', () => {
  closeMenu();
  renderSavedList();
  savedOverlay.classList.remove('hidden');
});
savedCloseBtn.addEventListener('click', () => savedOverlay.classList.add('hidden'));
savedOverlay.addEventListener('click', (e) => {
  if (e.target === savedOverlay) savedOverlay.classList.add('hidden');
});

// --- Room QR code ---
qrBtn.addEventListener('click', () => {
  if (!currentRoomCode) return;
  closeMenu();
  qrImage.src = `/room-qr/${encodeURIComponent(currentRoomCode)}`;
  qrLinkEl.textContent = `${location.origin}/?room=${currentRoomCode}`;
  qrOverlay.classList.remove('hidden');
});
qrCloseBtn.addEventListener('click', () => qrOverlay.classList.add('hidden'));
qrOverlay.addEventListener('click', (e) => {
  if (e.target === qrOverlay) qrOverlay.classList.add('hidden');
});

// POST + blob download rather than a plain <a href> navigation — the room PIN has to travel in
// the request somehow, and a GET query string leaks it into browser history/Referer headers
// (same concern already fixed for /search). Same fetch-then-synthetic-click pattern AI Studio's
// own download button already uses.
exportLink.addEventListener('click', async () => {
  if (!currentRoomCode) return;
  const original = exportLink.textContent;
  exportLink.disabled = true;
  try {
    const res = await fetch('/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: currentRoomCode, pin: currentRoomPin }),
    });
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `valk-${currentRoomCode}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch {
    exportLink.textContent = '❌ Export failed';
    setTimeout(() => { exportLink.textContent = original; }, 2000);
  } finally {
    exportLink.disabled = false;
  }
});

function renderGallery(media) {
  galleryGridEl.innerHTML = '';
  if (!media.length) {
    galleryGridEl.innerHTML = '<p class="search-status">No photos or videos shared yet.</p>';
    return;
  }
  media.forEach((m) => {
    const item = document.createElement('div');
    item.className = 'gallery-item' + (m.mediaType === 'video' ? ' video-item' : '');
    const el = m.mediaType === 'video' ? document.createElement('video') : document.createElement('img');
    el.src = m.mediaUrl;
    if (m.mediaType === 'video') el.muted = true;
    else el.alt = 'shared image';
    item.appendChild(el);
    item.addEventListener('click', () => {
      if (document.getElementById(`msg-${m.id}`)) {
        galleryOverlay.classList.add('hidden');
        jumpToMessage(m.id);
      } else {
        window.open(m.mediaUrl, '_blank');
      }
    });
    galleryGridEl.appendChild(item);
  });
}

// --- Threads (a message + its direct replies, flat — not deeply nested) ---
let currentThreadRootId = null;

function openThread(messageId) {
  currentThreadRootId = messageId;
  threadRootEl.innerHTML = '<p class="search-status">Loading…</p>';
  threadRepliesEl.innerHTML = '';
  threadOverlay.classList.remove('hidden');
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'get-thread', messageId }));
}

threadCloseBtn.addEventListener('click', () => { threadOverlay.classList.add('hidden'); currentThreadRootId = null; });
threadOverlay.addEventListener('click', (e) => {
  if (e.target === threadOverlay) { threadOverlay.classList.add('hidden'); currentThreadRootId = null; }
});

function renderThreadMessage(container, data) {
  const el = document.createElement('div');
  el.className = 'thread-message';
  const meta = document.createElement('span');
  meta.className = 'meta';
  const time = new Date(data.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  meta.textContent = `${data.name} · ${time}`;
  el.appendChild(meta);
  const text = document.createElement('div');
  text.textContent = data.deleted ? 'This message was deleted' : data.text;
  el.appendChild(text);
  container.appendChild(el);
}

function renderThread(root, replies) {
  threadRootEl.innerHTML = '';
  renderThreadMessage(threadRootEl, root);
  threadRepliesEl.innerHTML = '';
  if (!replies.length) {
    threadRepliesEl.innerHTML = '<p class="search-status">No replies yet — start the thread!</p>';
    return;
  }
  replies.forEach((r) => renderThreadMessage(threadRepliesEl, r));
}

threadReplyForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = threadReplyInput.value.trim();
  if (!text || !currentThreadRootId || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'message', text, replyTo: currentThreadRootId }));
  threadReplyInput.value = '';
});

// --- Direct messages (1:1 within a room, separate from the main feed and persisted per room+pair) ---
let currentDmWithName = null;

function renderDmMessage(data) {
  const el = document.createElement('div');
  el.className = 'thread-message' + (myProfile && data.fromName === myProfile.name ? ' own' : '');
  const meta = document.createElement('span');
  meta.className = 'meta';
  const time = new Date(data.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  meta.textContent = `${data.fromName} · ${time}`;
  el.appendChild(meta);
  const text = document.createElement('div');
  text.appendChild(renderTextWithMentions(data.text));
  el.appendChild(text);
  dmMessagesEl.appendChild(el);
}

function openDm(name) {
  currentDmWithName = name;
  dmTitleEl.textContent = `Direct message with ${name}`;
  dmMessagesEl.innerHTML = '<p class="search-status">Loading…</p>';
  dmOverlay.classList.remove('hidden');
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'get-dm-thread', withName: name }));
  dmInput.focus();
}

dmCloseBtn.addEventListener('click', () => { dmOverlay.classList.add('hidden'); currentDmWithName = null; });
dmOverlay.addEventListener('click', (e) => {
  if (e.target === dmOverlay) { dmOverlay.classList.add('hidden'); currentDmWithName = null; }
});

dmForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = dmInput.value.trim();
  if (!text || !currentDmWithName || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'send-dm', toName: currentDmWithName, text }));
  dmInput.value = '';
});

// --- Polls ---
const pollVotesByMessage = new Map(); // messageId -> Map<name, optionIndex>

function addPollOptionRow(value) {
  if (pollOptionsListEl.children.length >= 6) return;
  const row = document.createElement('div');
  row.className = 'poll-option-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = `Option ${pollOptionsListEl.children.length + 1}`;
  input.maxLength = 60;
  if (value) input.value = value;
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => {
    if (pollOptionsListEl.children.length > 2) row.remove();
  });
  row.append(input, removeBtn);
  pollOptionsListEl.appendChild(row);
}

pollBtn.addEventListener('click', () => {
  closeMenu();
  pollQuestionInput.value = '';
  pollOptionsListEl.innerHTML = '';
  addPollOptionRow();
  addPollOptionRow();
  pollOverlay.classList.remove('hidden');
  pollQuestionInput.focus();
});
pollCloseBtn.addEventListener('click', () => pollOverlay.classList.add('hidden'));
pollOverlay.addEventListener('click', (e) => {
  if (e.target === pollOverlay) pollOverlay.classList.add('hidden');
});
pollAddOptionBtn.addEventListener('click', () => addPollOptionRow());

pollCreateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const question = pollQuestionInput.value.trim();
  const options = [...pollOptionsListEl.querySelectorAll('input')]
    .map((i) => i.value.trim())
    .filter(Boolean);
  if (!question || options.length < 2 || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    type: 'message',
    text: JSON.stringify({ question, options }),
    mediaUrl: 'poll',
    mediaType: 'poll',
  }));
  pollOverlay.classList.add('hidden');
});

function seedPollVotes(messageId, votes) {
  const map = new Map();
  (votes || []).forEach((v) => map.set(v.name, v.optionIndex));
  pollVotesByMessage.set(messageId, map);
}

function renderPoll(container, data) {
  let poll;
  try { poll = JSON.parse(data.text); } catch { return; }
  if (!pollVotesByMessage.has(data.id)) seedPollVotes(data.id, data.votes);
  const votes = pollVotesByMessage.get(data.id) || new Map();
  const counts = poll.options.map((_, i) => [...votes.values()].filter((v) => v === i).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const myVote = myProfile ? votes.get(myProfile.name) : undefined;

  const card = document.createElement('div');
  card.className = 'poll-card';
  card.dataset.pollText = data.text;
  const q = document.createElement('div');
  q.className = 'poll-question';
  q.textContent = `📊 ${poll.question}`;
  card.appendChild(q);

  poll.options.forEach((label, i) => {
    const opt = document.createElement('div');
    opt.className = 'poll-option' + (myVote === i ? ' voted' : '');
    const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
    const fill = document.createElement('div');
    fill.className = 'poll-option-fill';
    fill.style.width = `${pct}%`;
    const labelRow = document.createElement('div');
    labelRow.className = 'poll-option-label';
    const labelText = document.createElement('span');
    labelText.textContent = label;
    const countText = document.createElement('span');
    countText.textContent = total > 0 ? `${pct}% (${counts[i]})` : '';
    labelRow.append(labelText, countText);
    opt.append(fill, labelRow);
    opt.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'vote-poll', messageId: data.id, optionIndex: i }));
    });
    card.appendChild(opt);
  });

  const totalEl = document.createElement('div');
  totalEl.className = 'poll-total-votes';
  totalEl.textContent = `${total} vote${total === 1 ? '' : 's'}`;
  card.appendChild(totalEl);

  container.appendChild(card);
}

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (!q || !currentRoomCode) return;
  searchResultsEl.innerHTML = '<li class="search-status">Searching…</li>';
  try {
    // POST, not a query string — a room PIN in the URL would end up in browser history and any
    // Referer header sent by the page (the /post-image /post-media routes already made this same
    // call via POST body for the same reason; this brings /search in line with that pattern).
    const res = await fetch('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: currentRoomCode, q, pin: currentRoomPin }),
    });
    const data = await res.json();
    renderSearchResults(data.results || []);
  } catch {
    searchResultsEl.innerHTML = '<li class="search-status">Search failed</li>';
  }
});

function renderSearchResults(results) {
  searchResultsEl.innerHTML = '';
  if (results.length === 0) {
    searchResultsEl.innerHTML = '<li class="search-status">No matches</li>';
    return;
  }
  results.forEach((r) => {
    const li = document.createElement('li');
    li.className = 'search-result';

    const meta = document.createElement('div');
    meta.className = 'search-result-meta';
    const name = document.createElement('strong');
    name.textContent = r.name;
    const time = document.createElement('span');
    time.textContent = new Date(r.at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
    meta.append(name, time);

    const text = document.createElement('div');
    text.className = 'search-result-text';
    text.textContent = r.text;

    li.append(meta, text);
    li.addEventListener('click', () => {
      if (document.getElementById(`msg-${r.id}`)) {
        searchOverlay.classList.add('hidden');
        jumpToMessage(r.id);
      }
    });
    searchResultsEl.appendChild(li);
  });
}

function setCallExpanded(expanded) {
  callOverlay.classList.toggle('expanded', expanded);
  callExpandBtn.setAttribute('aria-label', expanded ? 'Exit fullscreen' : 'Expand fullscreen');
  callExpandBtn.querySelector('.call-action-label').textContent = expanded ? ' Exit fullscreen' : ' Fullscreen';
  if (!expanded) resetCallBarPosition();
}

function resetCallBarPosition() {
  callBar.classList.remove('floating');
  callBar.style.position = '';
  callBar.style.left = '';
  callBar.style.top = '';
  callBar.style.margin = '';
}

// Drag the call bar anywhere within the browser's own viewport — a page can't place
// anything outside its own window, but combined with the ⛶ fullscreen button (which
// makes the window fill the whole screen) this reaches the entire physical screen.
let dragOffsetX = 0;
let dragOffsetY = 0;

callDragHandle.addEventListener('pointerdown', (e) => {
  if (!callOverlay.classList.contains('expanded')) return;
  const rect = callBar.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  callBar.classList.add('floating');
  callBar.style.position = 'fixed';
  callBar.style.margin = '0';
  callBar.style.left = `${rect.left}px`;
  callBar.style.top = `${rect.top}px`;
  callDragHandle.setPointerCapture(e.pointerId);
});

callDragHandle.addEventListener('pointermove', (e) => {
  if (!callDragHandle.hasPointerCapture(e.pointerId)) return;
  const maxX = window.innerWidth - callBar.offsetWidth;
  const maxY = window.innerHeight - callBar.offsetHeight;
  callBar.style.left = `${Math.min(Math.max(0, e.clientX - dragOffsetX), maxX)}px`;
  callBar.style.top = `${Math.min(Math.max(0, e.clientY - dragOffsetY), maxY)}px`;
});

callDragHandle.addEventListener('pointerup', (e) => {
  if (callDragHandle.hasPointerCapture(e.pointerId)) callDragHandle.releasePointerCapture(e.pointerId);
});

voicecallBtn.addEventListener('click', startVoiceCall);
voiceCallBanner.addEventListener('click', () => {
  voiceCallBanner.classList.add('hidden');
  startVoiceCall();
});
callHangupBtn.addEventListener('click', hangUpVoiceCall);
micRetryBtn.addEventListener('click', retryEnableMicrophone);
micMuteBtn.addEventListener('click', toggleMic);
callShareBtn.addEventListener('click', toggleScreenShare);
callExpandBtn.addEventListener('click', () => setCallExpanded(!callOverlay.classList.contains('expanded')));

// --- Rejoin the room a minigame's "Back to chat" link was launched from ---
// updateGameLinks() puts ?room=&name= on every minigame link so its own WebSocket knows
// which room to join; the games mirror those same params back onto their own back-link,
// so landing here again with them present means "return me to that room," not the
// name-entry screen. Reuses the exact reconnect path already wired for 'joined-server'
// (currentRoomCode set -> auto join-room), so no new server logic is needed.
const rejoinParams = new URLSearchParams(location.search);
const rejoinRoom = rejoinParams.get('room');
const rejoinName = rejoinParams.get('name');
if (rejoinRoom) {
  currentRoomCode = rejoinRoom.trim().toUpperCase();
  if (rejoinName) {
    myUsername = rejoinName.trim().slice(0, 30);
    usernameInput.value = myUsername;
    document.querySelector('#login-screen .subtitle').textContent = 'Rejoining your room…';
    setLoginPending(true);
    armLoginTimeout();
  } else {
    // A room code with no name means someone scanned a room's QR code — they still need to
    // type their own name and submit normally, but land straight in that room afterward.
    document.querySelector('#login-screen .subtitle').textContent = `Joining room ${currentRoomCode}…`;
  }
}

// --- Auto-continue past the name screen for a signed-in account ---
// localStorage is shared across every tab on the same browser/device, so a second tab already
// has accountToken/accountUsername the moment the first tab signs in — reuses the same
// join-server-on-ws-open mechanism the rejoin block above relies on (setting myUsername before
// connect() runs is enough; ws.addEventListener('open', ...) sends it automatically) rather than
// making the user re-type their name and press Continue every time they open a new tab.
if (!myUsername && accountToken && accountUsername) {
  myUsername = accountUsername;
  usernameInput.value = myUsername;
  if (!rejoinRoom) {
    document.querySelector('#login-screen .subtitle').textContent = `Signing in as ${myUsername}…`;
  }
  setLoginPending(true);
  armLoginTimeout();
}

connect();

// --- Self-healing: report uncaught errors so the server can log them and draft a fix
// (see reportError()/patcher.js on the server) — best-effort, never throws itself. ---
function reportClientError(message, stack) {
  fetch('/errors/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: String(message).slice(0, 2000), stack: stack || null, url: location.href }),
  }).catch(() => {});
}
window.addEventListener('error', (e) => {
  reportClientError(e.message, e.error && e.error.stack);
});
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  reportClientError(reason && reason.message ? reason.message : String(reason), reason && reason.stack);
});
