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
const newMessagesPill = document.getElementById('new-messages-pill');
const connectionBannerEl = document.getElementById('connection-banner');
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
const accountPasswordToggleBtn = document.getElementById('account-password-toggle-btn');
const accountPasswordForm = document.getElementById('account-password-form');
const accountPasswordCurrentInput = document.getElementById('account-password-current-input');
const accountPasswordNewInput = document.getElementById('account-password-new-input');
const accountPasswordError = document.getElementById('account-password-error');
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
const stickfighterLink = document.getElementById('stickfighter-link');
const firefightLink = document.getElementById('firefight-link');
const blockbattleLink = document.getElementById('blockbattle-link');
const pictionaryLink = document.getElementById('pictionary-link');
const triviaLink = document.getElementById('trivia-link');
const tictactoeLink = document.getElementById('tictactoe-link');
const chessLink = document.getElementById('chess-link');
const hangmanLink = document.getElementById('hangman-link');
const wordguessLink = document.getElementById('wordguess-link');
const typeraceLink = document.getElementById('typerace-link');
const snakeLink = document.getElementById('snake-link');
const g2048Link = document.getElementById('g2048-link');
const whiteboardLink = document.getElementById('whiteboard-link');
const flipbookLink = document.getElementById('flipbook-link');
const helloLink = document.getElementById('hello-link');
const micBtn = document.getElementById('mic-btn');
const voiceClipBtn = document.getElementById('voice-clip-btn');
const stickerBtn = document.getElementById('sticker-btn');
const stickerPicker = document.getElementById('sticker-picker');
const gifBtn = document.getElementById('gif-btn');
const gifPicker = document.getElementById('gif-picker');
const gifSearchInput = document.getElementById('gif-search-input');
const gifResults = document.getElementById('gif-results');
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
const voiceEffectSelect = document.getElementById('voice-effect-select');
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
const roomExportBtn = document.getElementById('room-export-btn');
const premiumLink = document.getElementById('premium-link');
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
const friendDmMessagesEl = document.getElementById('friend-dm-messages');
const friendDmStatusEl = document.getElementById('friend-dm-status');
const groupDmStatusEl = document.getElementById('group-dm-status');
let currentFriendDmUsername = null;
// Typing / seen state for the open friend DM and group DM.
let friendDmOtherReadAt = 0;
let friendDmTypingTimer = null;
let friendDmTypingName = null;
let lastFriendDmTypingSentAt = 0;
let groupDmReads = new Map(); // username -> read_at
const groupDmTyping = new Map(); // display name -> timeout id
let lastGroupDmTypingSentAt = 0;
const onlineContextMenu = document.getElementById('online-context-menu');
const privateCallContextBtn = document.getElementById('private-call-context-btn');
const privateCallIncomingOverlay = document.getElementById('private-call-incoming');
const privateCallIncomingAvatar = document.getElementById('private-call-incoming-avatar');
const privateCallIncomingTitle = document.getElementById('private-call-incoming-title');
const privateCallIncomingSub = document.getElementById('private-call-incoming-sub');
const privateCallIncomingActions = document.getElementById('private-call-incoming-actions');
const privateCallOutgoingActions = document.getElementById('private-call-outgoing-actions');
const privateCallAcceptBtn = document.getElementById('private-call-accept-btn');
const privateCallDeclineBtn = document.getElementById('private-call-decline-btn');
const privateCallCancelBtn = document.getElementById('private-call-cancel-btn');
const privateCallOverlay = document.getElementById('private-call-overlay');
const privateCallPeerNameEl = document.getElementById('private-call-peer-name');
const privateCallErrorEl = document.getElementById('private-call-error');
const privateCallGrid = document.getElementById('private-call-grid');
const privateCallMicRetryBtn = document.getElementById('private-call-mic-retry-btn');
const privateCallMuteBtn = document.getElementById('private-call-mute-btn');
const privateCallHangupBtn = document.getElementById('private-call-hangup-btn');
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
const groupFriendFilter = document.getElementById('group-friend-filter');
const groupNewError = document.getElementById('group-new-error');
const groupCreateBtn = document.getElementById('group-create-btn');
const groupsListEl = document.getElementById('groups-list');
const groupsEmptyMsg = document.getElementById('groups-empty-msg');
const groupDmOverlay = document.getElementById('group-dm-overlay');
const groupDmCloseBtn = document.getElementById('group-dm-close-btn');
const groupDmLeaveBtn = document.getElementById('group-dm-leave-btn');
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
const qrErrorEl = document.getElementById('qr-error');
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
const disappearRow = document.getElementById('disappear-row');
const disappearSelect = document.getElementById('disappear-select');
const DISAPPEAR_LABELS = { 3600: '1 hour', 86400: '24 hours', 604800: '7 days' };
const invitesRow = document.getElementById('invites-row');
const invitesToggleBtn = document.getElementById('invites-toggle-btn');
const invitesManager = document.getElementById('invites-manager');
const inviteCreateForm = document.getElementById('invite-create-form');
const inviteExpiry = document.getElementById('invite-expiry');
const inviteUses = document.getElementById('invite-uses');
const invitesListEl = document.getElementById('invites-list');
const wordFilterRow = document.getElementById('word-filter-row');
const wordFilterToggleBtn = document.getElementById('word-filter-toggle-btn');
const wordFilterForm = document.getElementById('word-filter-form');
const wordFilterDefault = document.getElementById('word-filter-default');
const wordFilterWords = document.getElementById('word-filter-words');
const roomEmojisRow = document.getElementById('room-emojis-row');
const roomEmojisToggleBtn = document.getElementById('room-emojis-toggle-btn');
const roomEmojisManager = document.getElementById('room-emojis-manager');
const roomEmojiAddForm = document.getElementById('room-emoji-add-form');
const roomEmojiNameInput = document.getElementById('room-emoji-name-input');
const roomEmojiFileInput = document.getElementById('room-emoji-file-input');
const roomEmojisList = document.getElementById('room-emojis-list');
// Custom emojis for the current room: name -> image url. Used as :name: in text and reactions.
let roomEmojis = new Map();
const eventBanner = document.getElementById('event-banner');
const eventBannerOpen = document.getElementById('event-banner-open');
const eventBannerRsvp = document.getElementById('event-banner-rsvp');
const eventsBtn = document.getElementById('events-btn');
const eventsOverlay = document.getElementById('events-overlay');
const eventsCloseBtn = document.getElementById('events-close-btn');
const eventsListEl = document.getElementById('events-list');
const eventCreateForm = document.getElementById('event-create-form');
const eventTitleInput = document.getElementById('event-title-input');
const eventTimeInput = document.getElementById('event-time-input');
const eventDescInput = document.getElementById('event-desc-input');
let roomEvents = [];
const slowModeRow = document.getElementById('slow-mode-row');
const slowModeSelect = document.getElementById('slow-mode-select');
let roomSlowMode = 0;
let slowModeReadyAt = 0;

function slowModeLabel(seconds) {
  return seconds >= 60 ? `${seconds / 60} min` : `${seconds}s`;
}

function applySlowMode(seconds) {
  roomSlowMode = seconds || 0;
  slowModeSelect.value = String(roomSlowMode);
  updateComposerLock();
}
// Announcement-only rooms: non-hosts can still read, react and vote, but the composer is locked.
let roomHostsOnly = false;
function updateComposerLock() {
  const locked = roomHostsOnly && !isMod();
  messageInput.disabled = locked;
  messageForm.classList.toggle('composer-locked', locked);
  messageForm.querySelectorAll('button').forEach((b) => { b.disabled = locked; });
  if (locked) messageInput.placeholder = '📢 Only the host and co-hosts can post here';
  else messageInput.placeholder = roomSlowMode && !isMod() ? `Slow mode is on — one message every ${slowModeLabel(roomSlowMode)}` : 'Type a message...';
}
const announcementInput = document.getElementById('announcement-input');
const typingIndicatorEl = document.getElementById('typing-indicator');
const replyPreviewEl = document.getElementById('reply-preview');

let ws;
let myProfile = null;
let myUsername = null;
let currentRoomCode = null;
let currentRoomName = null;
let isHost = false;
// Co-host = a member the host promoted to help moderate (server: room_cohosts). isMod() is what
// the moderation UI (delete any message, mute/kick/ban, announcement, slow mode, bans) keys off.
let isCohost = false;
let roomCohosts = [];
function isMod() { return isHost || isCohost; }
function applyModVisibility() {
  announcementForm.classList.toggle('hidden', !isMod());
  slowModeRow.classList.toggle('hidden', !isMod());
  bansRow.classList.toggle('hidden', !isMod());
  document.getElementById('mod-log-btn').classList.toggle('hidden', !isMod());
  welcomeForm.classList.toggle('hidden', !isHost);
  cohostHint.classList.toggle('hidden', !isHost);
  document.getElementById('hosts-only-row').classList.toggle('hidden', !isHost);
  document.getElementById('accent-row').classList.toggle('hidden', !isHost);
  updateComposerLock();
}
const welcomeForm = document.getElementById('welcome-form');
const welcomeInput = document.getElementById('welcome-input');
const cohostHint = document.getElementById('cohost-hint');
const welcomeModal = document.getElementById('welcome-modal');
const editHistoryModal = document.getElementById('edit-history-modal');
const editHistoryList = document.getElementById('edit-history-list');
let roomWelcomeText = null;

function welcomeSeenKey(code) { return `valk-welcome-seen:${code}`; }
function maybeShowWelcome(code, text, roomName) {
  if (!text) return;
  let seen = null;
  try { seen = localStorage.getItem(welcomeSeenKey(code)); } catch (err) { /* private mode */ }
  if (seen === text) return;
  document.getElementById('welcome-room-name').textContent = roomName || code;
  const body = document.getElementById('welcome-modal-text');
  body.textContent = '';
  body.appendChild(renderTextWithMentions(text));
  welcomeModal.classList.remove('hidden');
  try { localStorage.setItem(welcomeSeenKey(code), text); } catch (err) { /* ignore */ }
  document.getElementById('welcome-modal-ok').focus();
}
document.getElementById('welcome-modal-ok').addEventListener('click', () => welcomeModal.classList.add('hidden'));
welcomeModal.addEventListener('click', (e) => { if (e.target === welcomeModal) welcomeModal.classList.add('hidden'); });
welcomeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'set-welcome', text: welcomeInput.value }));
});

function openEditHistory(messageId) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'get-edit-history', messageId }));
}
function showEditHistory(data) {
  editHistoryList.textContent = '';
  const versions = data.versions || [];
  if (!versions.length) {
    const li = document.createElement('li');
    li.textContent = 'No earlier versions saved (this message was edited before history was kept).';
    editHistoryList.appendChild(li);
  }
  for (const v of versions) {
    const li = document.createElement('li');
    const when = document.createElement('span');
    when.className = 'eh-when';
    when.textContent = `Before ${new Date(v.editedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    li.append(when, renderTextWithMentions(v.text));
    editHistoryList.appendChild(li);
  }
  const cur = document.createElement('li');
  cur.className = 'eh-current';
  const curWhen = document.createElement('span');
  curWhen.className = 'eh-when';
  curWhen.textContent = 'Now';
  cur.append(curWhen, renderTextWithMentions(data.current || ''));
  editHistoryList.appendChild(cur);
  editHistoryModal.classList.remove('hidden');
}
document.getElementById('edit-history-close').addEventListener('click', () => editHistoryModal.classList.add('hidden'));
editHistoryModal.addEventListener('click', (e) => { if (e.target === editHistoryModal) editHistoryModal.classList.add('hidden'); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // Every pop-up card (welcome, edit history, scheduled, stats, shortcuts, room switcher).
  document.querySelectorAll('.modal-backdrop').forEach((m) => m.classList.add('hidden'));
});

function makeEditedTag(messageId) {
  const tag = document.createElement('span');
  tag.className = 'edited-tag';
  tag.textContent = 'edited';
  tag.title = 'See edit history';
  tag.tabIndex = 0;
  tag.setAttribute('role', 'button');
  const open = (e) => { e.stopPropagation(); openEditHistory(messageId); };
  tag.addEventListener('click', open);
  tag.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } });
  return tag;
}
// The WS join-room handler is the only place that ever verifies a room's PIN — /search,
// /export, and the AI Studio/Video Editor post-to-chat endpoints are plain HTTP and need the
// PIN threaded through separately. currentRoomPin is set once 'joined-room' actually confirms
// the join succeeded (pendingJoinPin carries whatever was typed through that async gap); kept
// in sync afterward if the host changes the PIN mid-session (see the roomPinForm handler).
let pendingJoinPin = '';
let currentRoomPin = '';
let appToastTimeout = null;

// --- Premium flair: badge + name color + bubble theme (see TIERS in server.js). ---
const PREMIUM_BADGES = { hobbyist: '🥉', power: '🥈', studio: '🥇' };
const PREMIUM_NAMES = { hobbyist: 'Hobbyist', power: 'Power Creator', studio: 'Studio' };
function makeFlairName(name, flair) {
  const wrap = document.createElement('span');
  wrap.className = 'flair-name' + (flair && flair.nameColor ? ` name-${flair.nameColor}` : '');
  if (flair && PREMIUM_BADGES[flair.tier]) {
    const badge = document.createElement('span');
    badge.className = 'premium-badge';
    badge.textContent = PREMIUM_BADGES[flair.tier];
    badge.title = `Valk Premium — ${PREMIUM_NAMES[flair.tier]}`;
    wrap.appendChild(badge);
  }
  wrap.appendChild(document.createTextNode(name));
  return wrap;
}

// This user's own plan — only widens what the UI offers; the server checks every perk itself.
let myPremium = null;
async function refreshMyPremium() {
  myPremium = null;
  if (accountToken) {
    try {
      const res = await fetch('/api/premium/me', { headers: { Authorization: `Bearer ${accountToken}` } });
      if (res.ok) myPremium = await res.json();
    } catch {}
  }
  const perks = myPremium && myPremium.perks;
  wallpaperFileInput.accept = perks && perks.animatedWallpaper ? 'image/*,video/mp4,video/webm' : 'image/*';
  wallpaperSetBtn.textContent = perks && perks.animatedWallpaper
    ? '🖼️ Set room wallpaper — picture, GIF or video (host only)'
    : '🖼️ Set room wallpaper (host only)';
  premiumLink.textContent = myPremium && myPremium.tier
    ? `${PREMIUM_BADGES[myPremium.tier]} Your ${PREMIUM_NAMES[myPremium.tier]} plan`
    : '⭐ Valk Premium';
}

function showAppToast(msg) {
  appToastEl.textContent = hideSpoilerText(msg);
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
const ACTIVITY_BADGES = { bc: '🏝️', gw: '🔺', dg: '🖍️', wb: '🖌️', tv: '❓', tt: '⭕', ch: '♟️', hm: '🪢', sk: '🐍', tf: '🔢', fp: '🛩️', sw: '🕸️', fg: '🔫', wg: '🟩', sf: '🥊', he: '👋', tr: '⌨️' };
let lastRoomUsers = [];
// Found by the room-chat client-side correctness audit: tracks the single currently-open message
// edit form ({ messageId, restore }), so starting a second edit can auto-cancel the first instead
// of leaving both open at once (see startEditingMessage).
let activeMessageEdit = null;

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
  syncSavedChangeToAccount(idx !== -1 ? { removedId: data.id } : { added: savedMessages[0] });
  // A throw here (Safari private browsing, a storage-blocking extension) previously aborted the
  // rest of this function too, leaving the save-button icon stuck showing the OLD state even
  // though savedMessages had already been mutated in memory above.
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(savedMessages)); } catch {}
  document.querySelectorAll(`[data-message-id="${CSS.escape(data.id)}"] .save-btn`).forEach((btn) => {
    btn.classList.toggle('saved', isSaved(data.id));
  });
}

// Signed in: every save/unsave also goes to the account so the list follows you to other devices.
function syncSavedChangeToAccount({ added, removedId }) {
  if (!accountToken) return;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` };
  const req = removedId
    ? fetch(`/account/saved-messages/${encodeURIComponent(removedId)}`, { method: 'DELETE', headers })
    : fetch('/account/saved-messages', { method: 'POST', headers, body: JSON.stringify(added) });
  req.catch(() => { /* best-effort — the local copy is already updated */ });
}

// On sign-in / page load: upload anything saved on this device that the account doesn't have yet,
// then take the account's list as the truth.
async function syncSavedMessagesFromAccount() {
  if (!accountToken) return;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` };
  try {
    const res = await fetch('/account/saved-messages', { headers });
    if (!res.ok) return;
    const data = await res.json();
    const onServer = new Set(data.messages.map((m) => m.id));
    const localOnly = savedMessages.filter((m) => m && m.id && !onServer.has(m.id));
    for (const m of localOnly) {
      await fetch('/account/saved-messages', { method: 'POST', headers, body: JSON.stringify(m) }).catch(() => {});
    }
    savedMessages = [...data.messages, ...localOnly].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)).slice(0, 200);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(savedMessages)); } catch {}
    document.querySelectorAll('[data-message-id]').forEach((el) => {
      const btn = el.querySelector('.save-btn');
      if (btn) btn.classList.toggle('saved', isSaved(el.dataset.messageId));
    });
    if (!savedOverlay.classList.contains('hidden')) renderSavedList();
  } catch {
    /* offline — keep the local list */
  }
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
      // Found by the saved-messages audit: this only ever branched video-vs-image, unlike the
      // live chat renderer (which also has an 'audio' branch) — a saved voice message rendered
      // as a broken <img> with the audio completely inaccessible from this panel.
      let media;
      if (m.mediaType === 'video') { media = document.createElement('video'); media.controls = true; }
      else if (m.mediaType === 'audio') { media = document.createElement('audio'); media.controls = true; }
      else { media = document.createElement('img'); media.alt = 'shared image'; }
      media.src = m.mediaUrl;
      media.className = 'saved-media';
      // Same gap as above: the live chat renderer already has a broken-media fallback for a
      // 404'd/deleted upload (see its own comment) — this panel's whole documented point is "a
      // saved message still shows something even if the original is later deleted," but that
      // promise never actually covered the media itself, which just showed a bare broken glyph.
      media.addEventListener('error', () => {
        const fallback = document.createElement('span');
        fallback.className = 'media-unavailable';
        fallback.textContent = m.mediaType === 'video' ? '🎬 Video unavailable'
          : m.mediaType === 'audio' ? '🔊 Audio unavailable'
          : '🖼️ Image unavailable';
        media.replaceWith(fallback);
      }, { once: true });
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
    if (m.roomCode === currentRoomCode) {
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
  // A throw here previously aborted the rest of this function too, leaving that sender's
  // messages not actually hidden/shown even though blockedNames had already toggled in memory.
  try { localStorage.setItem(BLOCKED_KEY, JSON.stringify([...blockedNames])); } catch {}
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
// The raw, unprocessed getUserMedia() capture — kept separate from `localStream` (what's
// actually sent to peers) once a voice effect is active, since `localStream` then becomes a
// synthesized MediaStream built from this via Web Audio. Switching effects re-processes this
// same raw capture rather than re-prompting for the microphone; switching microphones replaces
// this (see switchMicrophone) and re-applies whatever effect was already selected.
let rawMicStream = null;
let voiceEffect = 'none';
// Bumped at the start of every applyVoiceEffect/switchMicrophone attempt so the two can't clobber
// each other if a user changes the effect and the mic device in quick succession — whichever
// attempt's own awaits resolve last discards its result instead of overwriting newer state.
let micOpGeneration = 0;
let voiceEffectCleanup = null; // tears down the current Web Audio graph; no-op when effect is 'none'
let screenStream = null; // local outgoing screen-share stream, null when not sharing
let screenShareStarting = false; // guards against a second getDisplayMedia() call racing the first while its OS picker is still up
const voicePeers = new Map(); // sub -> { name, pc, audioEl, stopDetector }
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
// A TURN relay credential (from the server's valk-turn, when it's running) lets calls connect
// even when both people are behind strict NATs (phones on mobile data, school/work Wi-Fi) where
// a direct connection is impossible. Cached ~50 minutes (credentials last an hour).
let turnIceServer = null;
let turnFetchedAt = 0;
let turnWaiters = [];
function callIceServers() {
  return turnIceServer ? [...ICE_SERVERS, turnIceServer] : ICE_SERVERS;
}
function prefetchTurn(timeoutMs = 2000) {
  if (turnIceServer && Date.now() - turnFetchedAt < 50 * 60 * 1000) return Promise.resolve();
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentRoomCode) return Promise.resolve();
  return new Promise((resolve) => {
    turnWaiters.push(resolve);
    if (turnWaiters.length === 1) ws.send(JSON.stringify({ type: 'get-turn' }));
    setTimeout(resolve, timeoutMs);
  });
}
let pttMode = false;
let pttActive = false; // currently holding the push-to-talk button/key
let handRaised = false;
let callRecorder = null;
let callRecordDest = null; // MediaStreamAudioDestinationNode mixing all call audio
let callRecordCtx = null;
let recordedRemoteStreams = null; // Set of remote MediaStreams already mixed into the current recording — avoids double-mixing the same peer's audio if their track re-negotiates mid-recording
let muteAllNoticeTimer = null;

// --- Private (1:1) call state — separate from the room-wide voice call above: exactly one
// RTCPeerConnection, no mesh, and only ever the two people who agreed to it (server-enforced,
// see server.js's endPrivateCall). ---
let privateCallId = null; // set once invited/ringing, cleared on any teardown
let privateCallRole = null; // 'caller' | 'callee', set as soon as a callId exists
let privateCallPeerName = null;
let privateCallPc = null;
let privateCallLocalStream = null;
let privateCallAudioEl = null;
let privateCallLocalStopDetector = null; // stop function for the local mic's speaking ring
let privateCallStopDetector = null; // stop function for the remote peer's speaking ring
let privateCallRingTimer = null;
let onlineContextTargetName = null;

function stopPrivateCallRing() {
  clearInterval(privateCallRingTimer);
  privateCallRingTimer = null;
}

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
    // A throw here previously aborted applyTheme() below too, making the toggle look unresponsive.
    try { localStorage.setItem('valk-theme', next); } catch {}
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
    // Any message at all proves the round trip is back up — simplest, most robust place to clear
    // the connection banner (see the close handler below for where it's shown). Deliberately not
    // scattered across every individual terminal state (joined-room, join-error, kicked, etc.) that
    // could follow a reconnect; ANY server response, whichever it is, means we're connected again.
    connectionBannerEl.classList.add('hidden');
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
    // Found by the room-chat client-side correctness audit: a dropped connection had no visible
    // indicator anywhere — the UI just silently stopped updating during the retry loop below, with
    // no explanation. Only shown once actually in the chat/room-select UI (not during the very
    // first page load, before any screen has been shown yet) — an initial connection failure
    // already has its own dedicated login-screen error path (see setLoginPending/loginErrorEl).
    if (myProfile) connectionBannerEl.classList.remove('hidden');
    setTimeout(connect, 1500);
  });
}

function handleServerMessage(data) {
  switch (data.type) {
    case 'joined-server':
      clearTimeout(loginTimeoutId);
      setLoginPending(false);
      // Found by the landing/room-join-flow correctness audit: a stale/expired accountToken was
      // previously never surfaced to the client at all — the account panel/menu kept showing
      // "signed in" indefinitely while cross-device sync, friends, and push silently did nothing.
      // Only acts when we actually believed we had a token (accountToken truthy) — the server sets
      // this flag any time a supplied token didn't resolve, but there's nothing to clean up if we
      // never had one to begin with.
      if (data.accountTokenInvalid && accountToken) {
        signOutAccount('Your session expired — signed out. Sign in again to sync across devices.');
      }
      myProfile = data.profile;
      roomProfiles.set(myProfile.name, { avatarUrl: myProfile.avatarUrl, status: myProfile.status });
      renderMyProfile();
      loginErrorEl.classList.add('hidden');
      welcomeTextEl.textContent = `Hey, ${myProfile.name}`;
      requestNotificationPermission();
      if (accountToken) subscribeToPush();
      if (pendingInviteToken) {
        pendingJoinPin = '';
        ws.send(JSON.stringify({ type: 'join-room', invite: pendingInviteToken }));
      } else if (currentRoomCode) {
        pendingJoinPin = '';
        ws.send(JSON.stringify({ type: 'join-room', code: currentRoomCode }));
      } else {
        renderRecentRooms();
        showScreen(roomSelectScreen);
      }
      if (pendingOpenUrl) {
        const openUrl = pendingOpenUrl;
        pendingOpenUrl = null;
        handleOpenRequest(openUrl);
      }
      break;

    case 'error':
      console.error(data.message);
      if (data.message) showAppToast(data.message);
      // Found by the profile-editing client-side audit: a rejected rename (e.g. name already
      // taken in this room) left myNameInput sitting on the rejected value forever — since
      // myProfile.name never changed, the very next blur (even from an unrelated click, no
      // further edits needed) saw a still-different value and resent the identical rejected name,
      // re-showing the same toast in a loop until the user noticed and manually retyped their
      // real name. Reverting here isn't perfectly scoped to "this error was specifically about my
      // rename" (case 'error' is generic, shared by many handlers), but reverting is harmless even
      // if triggered by an unrelated coincidental error — worst case is retyping a fresh edit.
      if (pendingNameUpdate) {
        pendingNameUpdate = false;
        if (myProfile) myNameInput.value = myProfile.name;
      }
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

    case 'poll-voted':
      // Re-render just the poll card in place (replaceWith keeps its position in the bubble —
      // the old remove-then-append moved it below the reaction buttons after the first vote).
      seedPollVotes(data.messageId, data);
      rerenderPollCard(data.messageId);
      break;

    case 'poll-closed':
      rerenderPollCard(data.messageId, data.text);
      if (myProfile && data.by !== myProfile.name) showAppToast(`📊 ${data.by} ended a poll`);
      break;

    case 'joined-room':
      currentRoomCode = data.code;
      currentRoomName = data.name || null;
      isHost = !!data.isHost;
      isCohost = !!data.isCohost;
      roomCohosts = data.cohosts || [];
      roomWelcomeText = data.welcome || null;
      roomHostsOnly = !!data.hostsOnly;
      applyRoomAccent(data.accent || null);
      // Each room keeps its own unsent draft (survives switching rooms and reloading).
      saveDraftNow(); // flush the previous room's draft first
      draftRoomCode = data.code;
      messageInput.value = loadDraft(data.code);
      requestAnimationFrame(autoGrowComposer);
      loadRoomNotifyPref(data.code, data.notifyPref);
      sentAway = false;
      lastActivityAt = Date.now();
      document.getElementById('hosts-only-input').checked = roomHostsOnly;
      welcomeInput.value = roomWelcomeText || '';
      currentRoomPin = data.invitePass || pendingJoinPin;
      pendingJoinPin = '';
      pendingInviteToken = null;
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
      // A visible @mention dropdown's matches come from the OLD room's lastRoomUsers — left open
      // across a room switch, it kept showing suggestions from a member list that no longer
      // applies to where the composer now actually posts.
      mentionDropdownEl.classList.add('hidden');
      mentionHighlightIndex = -1;
      // A thread left open while switching rooms kept pointing at the old room's root message —
      // the server silently drops the reply link for a cross-room id (room_code mismatch), so a
      // reply typed there posted as an ordinary top-level message with no error shown.
      threadOverlay.classList.add('hidden');
      currentThreadRootId = null;
      // Same class of bug as the thread overlay above, just never applied here: room DMs are
      // explicitly room-scoped (send-dm resolves the recipient by scanning the *current* room's
      // connected clients), but nothing closed dmOverlay on a room switch. Left open, it kept
      // showing the old room's thread — and since display names aren't globally unique, sending
      // from it could silently DM an unrelated same-named person in the new room instead of
      // erroring, or (if nobody by that name is present) just leave the stale panel open forever.
      dmOverlay.classList.add('hidden');
      currentDmWithName = null;
      // Same staleness problem as the two above, just missed when group DMs were built: this also
      // fires on a plain WS reconnect (join-server -> auto-rejoin), not just an actual room switch,
      // and nothing ever refreshed an open group DM afterward — a message sent by another member
      // during the drop was delivered live-only (the server doesn't re-push it later) and so was
      // silently missing from the thread until manually closed and reopened. Closing it here, same
      // as dmOverlay/threadOverlay, is simpler than trying to reconcile a gap of unknown size.
      if (groupDmOverlay) { groupDmOverlay.classList.add('hidden'); currentGroupDmId = null; }
      // Found by the QR-code join-flow audit: same staleness class as the overlays above, just
      // missed for the Room QR code panel — its image/link both encode the OLD room's code, and
      // this fires on a plain reconnect too, not just a deliberate switch.
      qrOverlay.classList.add('hidden');
      // Same staleness class as the three overlays above, just missed for search: left open across
      // a reconnect/room-switch, it kept showing whatever room's results were last rendered even
      // though currentRoomCode (and the message list a hit would jump to) had already moved on.
      searchOverlay.classList.add('hidden');
      // Lower stakes than the others (its own click handler already falls back to opening the raw
      // media URL if the message isn't in the current room's DOM, so this was never actually
      // reachable as a wrong-room jump) but still cosmetically stale — a fresh get-media re-fetches
      // once reopened anyway, so there's no reason to leave the old room's grid showing.
      galleryOverlay.classList.add('hidden');
      // Same staleness class as the overlays above, just missed for the sticker picker — left open
      // across a room switch/reconnect, a stray click on a still-visible sticker would fire the
      // send handler against whatever room the composer now actually posts to.
      if (stickerPicker) stickerPicker.classList.add('hidden');
      if (gifPicker) gifPicker.classList.add('hidden');
      seedReactions(data.reactions);
      // read_receipts was being persisted server-side on every real read event but never sent
      // back on join — found by a read-receipt-integrity audit. Without this, a client
      // joining/reconnecting saw no "seen by" info until each other member's next natural read
      // event happened to re-fire it. readReceiptsByName was already cleared above; this just
      // seeds it from the server's persisted state before the message render loop below (which
      // is what actually triggers renderSeenBy()) runs.
      (data.readReceipts || []).forEach((r) => readReceiptsByName.set(r.name, r.messageId));
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
      // Found by the room-settings/menu-panel correctness audit: unlike every sibling host-only
      // control here (announcement/PIN/wallpaper/bans, all gated the same way just below), the
      // rename-room form had no isHost gate at all — a non-host member saw a fully live, editable
      // "rename this room" control that always silently no-oped server-side (isRoomHost fails,
      // the handler just returns with no error sent back), with zero feedback explaining why.
      renameRoomForm.classList.toggle('hidden', !isHost);
      announcementForm.classList.toggle('hidden', !isHost);
      announcementInput.value = currentAnnouncement || '';
      slowModeRow.classList.toggle('hidden', !isHost);
      roomEmojisRow.classList.toggle('hidden', !isHost);
      wordFilterRow.classList.toggle('hidden', !isHost);
      disappearRow.classList.toggle('hidden', !isHost);
      invitesRow.classList.toggle('hidden', !isHost);
      invitesManager.classList.add('hidden');
      disappearSelect.value = String(data.disappearAfter || 0);
      pendingDisappearNotice = data.disappearAfter || 0;
      applyWordFilterSettings(data.wordFilter || {});
      setRoomEmojis(data.emojis || []);
      setRoomEvents(data.events || []);
      slowModeReadyAt = 0;
      applySlowMode(data.slowMode);
      roomPinForm.classList.toggle('hidden', !isHost);
      roomPinFormInput.value = '';
      // Found by the room-settings/menu-panel correctness audit: this field was always blank with
      // the same static placeholder whether or not a PIN was actually currently set — no way to
      // tell state without trying to rejoin blind. The raw PIN itself is never sent (roomPinOk
      // only ever compares a hash server-side) — just whether one is required, mirrored into the
      // placeholder the same way room-pin-updated's own live toast already communicates it.
      roomPinFormInput.placeholder = data.pinRequired
        ? 'PIN is set — new PIN, or blank to remove'
        : 'No PIN set — enter one to require it';
      wallpaperRow.classList.toggle('hidden', !isHost);
      applyWallpaper(data.wallpaperUrl || null);
      bansRow.classList.toggle('hidden', !isHost);
      bansListEl.classList.add('hidden');
      applyModVisibility();
      if (!isHost) maybeShowWelcome(data.code, roomWelcomeText, data.name);
      setTimeout(maybeShowWhatsNew, 800);
      unreadCount = 0;
      updateUnreadBadge();
      // Found by the room-chat client-side correctness audit: renderOnlineList (the only place
      // that (re)assigns lastRoomUsers, which mention-highlighting keys off) used to run AFTER
      // this history render loop — so on a fresh join lastRoomUsers was still [] (or, on a room
      // switch, still the PREVIOUS room's roster) while every scrollback message rendered, and
      // every @mention in that history rendered as plain unhighlighted text. Messages that arrive
      // live afterward were already correct, since lastRoomUsers is set by then. Moved ahead of
      // the render loop so history gets the same highlighting live messages always had.
      renderOnlineList(data.users);
      // Screen readers announce new messages (#messages is role=log); don't read out the whole
      // history every time a room loads.
      messagesEl.setAttribute('aria-busy', 'true');
      data.messages.forEach((m) => renderMessage(m, { history: true }));
      setTimeout(() => messagesEl.removeAttribute('aria-busy'), 0);
      // "New messages" divider: where this person's saved read receipt (from before this join)
      // sits in the history, if others have posted since — the chat then opens there instead of
      // at the very bottom, so you can catch up from where you left off.
      const myReceipt = myProfile && (data.readReceipts || []).find((r) => r.name === myProfile.name);
      const newMsgsDivider = placeNewMessagesDivider(myReceipt && myReceipt.messageId, data.messages);
      resetOlderMessages(data.messages);
      if (data.messages.length) sendReadReceipt(data.messages[data.messages.length - 1].id);
      if (pendingDisappearNotice) renderSystem({ text: `⏳ Disappearing messages are on — messages here are deleted after ${DISAPPEAR_LABELS[pendingDisappearNotice] || 'a while'}` });
      roomCodeChip.textContent = currentRoomName ? `${currentRoomName} (${data.code})` : data.code;
      menuRoomCode.textContent = data.code;
      renameRoomInput.value = currentRoomName || '';
      updateGameLinks();
      saveRecentRoom(data.code, currentRoomName);
      showScreen(chatScreen);
      // The history render loop above (data.messages.forEach(renderMessage)) runs while
      // chatScreen still has the .hidden class, so every maybeScrollToBottom() call it triggers
      // reads a display:none messagesEl (scrollHeight 0) and no-ops — the container then opens
      // at the default scrollTop 0 (top) instead of the bottom. Force one real scroll now that
      // the screen is actually visible and has real layout dimensions.
      scrollToBottom();
      if (newMsgsDivider && !pendingLinkMsgId) newMsgsDivider.scrollIntoView({ block: 'center' });
      flushOutbox(data.code);
      if (pendingLinkMsgId && data.code === pendingLinkRoom) {
        const id = pendingLinkMsgId;
        pendingLinkMsgId = null;
        setTimeout(() => jumpToMessage(id), 50);
      }
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
      pendingInviteToken = null;
      currentRoomCode = null;
      roomErrorEl.textContent = data.message;
      roomErrorEl.classList.remove('hidden');
      // Found by the landing/room-join-flow correctness audit: the PIN field was only ever
      // explicitly hidden on a *successful* join — an unrelated later failure (room not found,
      // banned) for a DIFFERENT room left it visibly open with whatever PIN was typed for the
      // previous attempt still sitting in it. Reset unconditionally first, then re-show only if
      // this specific error actually needs one.
      roomPinInput.classList.add('hidden');
      roomPinInput.value = '';
      if (data.pinRequired) {
        roomPinInput.classList.remove('hidden');
        roomPinInput.focus();
      } else if (data.message === 'Room not found') {
        removeRecentRoom(roomCodeInput.value.trim().toUpperCase());
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
      // Same room-scoped-DM/thread staleness this session already fixed for the joined-room path
      // — leaving a room entirely (not just switching to another) is an even more direct case of
      // "this room's context no longer applies."
      threadOverlay.classList.add('hidden');
      currentThreadRootId = null;
      dmOverlay.classList.add('hidden');
      currentDmWithName = null;
      // Found by the QR-code join-flow audit: leaving the room entirely (kicked/banned, or a
      // server-side room cleanup) left a still-open QR panel showing a join code/link for a room
      // you're no longer in, on a screen that had already switched to roomSelectScreen underneath.
      qrOverlay.classList.add('hidden');
      eventsOverlay.classList.add('hidden');
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
      // Found by the personal block/mute audit: this used to fire for every non-own message
      // regardless of blockedNames — the bubble itself renders hidden for a blocked sender, but a
      // real OS notification (full name + text, shown even backgrounded) and the notify sound
      // still fired anyway, and the unread badge still counted them — exactly the content this
      // feature exists to hide, leaking through every surface that isn't the message list itself.
      if (data.sub !== myProfile.sub && !blockedNames.has(data.name)) {
        const keywordHit = matchesKeywordAlert(data.text);
        const mentioned = messageHasMention(data.text, myProfile.name) || keywordHit;
        const roomMode = currentRoomNotifyMode();
        if (roomMode === 'all' || (roomMode === 'mentions' && mentioned)) {
          notify(keywordHit ? `🔎 ${data.name} said "${keywordHit}"` : mentioned ? `${data.name} mentioned you` : data.name, notificationPreview(data), { messageId: data.id });
          playNotifySound();
        }
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
      roomPinFormInput.placeholder = data.pinRequired
        ? 'PIN is set — new PIN, or blank to remove'
        : 'No PIN set — enter one to require it';
      break;

    case 'premium-required':
      showAppToast(`⭐ ${data.message}`);
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
      if (isFriendDmOpenWith(data.fromUsername)) {
        renderFriendDmMessage(data);
        ws.send(JSON.stringify({ type: 'friend-dm-read', withUsername: data.fromUsername }));
        if (document.hidden) notify(`${data.from} sent you a DM`, data.text);
      } else {
        showAppToast(`💬 ${data.from} sent you a DM: ${data.text}`);
        playNotifySound();
        notify(`${data.from} sent you a DM`, data.text);
        if (!friendsOverlay.classList.contains('hidden')) loadFriends();
      }
      break;

    case 'friend-dm-typing':
      if (isFriendDmOpenWith(data.fromUsername)) {
        clearTimeout(friendDmTypingTimer);
        friendDmTypingName = data.fromUsername;
        friendDmTypingTimer = setTimeout(() => { friendDmTypingName = null; renderFriendDmStatus(); }, 4000);
        renderFriendDmStatus();
      }
      break;

    case 'friend-dm-seen':
      if (isFriendDmOpenWith(data.byUsername)) {
        friendDmOtherReadAt = Math.max(friendDmOtherReadAt, data.at || 0);
        renderFriendDmStatus();
      }
      break;

    case 'group-dm-typing':
      if (currentGroupDmId === data.groupId && groupDmOverlay && !groupDmOverlay.classList.contains('hidden')) {
        const who = data.name || data.username;
        clearTimeout(groupDmTyping.get(who));
        groupDmTyping.set(who, setTimeout(() => { groupDmTyping.delete(who); renderGroupDmStatus(); }, 4000));
        renderGroupDmStatus();
      }
      break;

    case 'group-dm-seen':
      if (currentGroupDmId === data.groupId) {
        groupDmReads.set(data.username, Math.max(groupDmReads.get(data.username) || 0, data.at || 0));
        renderGroupDmStatus();
      }
      break;

    case 'friend-dm-history':
      if (isFriendDmOpenWith(data.withUsername)) {
        friendDmOtherReadAt = data.otherReadAt || 0;
        friendDmTargetName.textContent = data.withUsername;
        friendDmMessagesEl.innerHTML = '';
        if (!data.messages.length) {
          friendDmMessagesEl.innerHTML = `<p class="search-status">${data.isFriend ? 'No messages yet — say hi!' : 'You can only send messages to friends.'}</p>`;
        } else {
          data.messages.forEach(renderFriendDmMessage);
        }
      }
      break;

    case 'valkmail-new':
      showAppToast(`📬 New ValkMail from ${data.from}: ${data.subject}`);
      playNotifySound();
      notify(`📬 ValkMail from ${data.from}`, data.subject);
      refreshValkmailBadge();
      break;

    case 'friend-request':
      showAppToast(`👋 ${data.from} sent you a friend request — open Friends to accept`);
      playNotifySound();
      notify(`👋 ${data.from} sent you a friend request`, 'Open Friends to accept or decline');
      if (!friendsOverlay.classList.contains('hidden')) loadFriends();
      break;

    case 'friend-dm-sent':
      if (data.message && isFriendDmOpenWith(data.toUsername)) renderFriendDmMessage(data.message);
      else showAppToast(`💬 DM sent to ${data.toUsername}`);
      break;

    case 'group-dm-threads':
      lastLoadedThreads = data.threads;
      renderGroupThreads(data.threads);
      if (currentGroupDmId && groupDmTitleEl.textContent === 'Group') {
        const t = data.threads.find((th) => th.id === currentGroupDmId);
        if (t) {
          currentGroupDmMemberNames = t.members.map((m) => m.username);
          groupDmTitleEl.textContent = groupThreadLabel(t);
          groupDmMembersEl.textContent = currentGroupDmMemberNames.length ? `With ${currentGroupDmMemberNames.join(', ')}` : '';
        }
      }
      break;

    case 'group-dm-created':
      showAppToast(`💬 Group DM ${data.thread.name ? `"${data.thread.name}"` : 'started'}`);
      // Found by the group-DM creation-flow audit: this only ever showed a toast — the creator
      // had to manually reopen the Groups panel and click into the fresh entry themselves. Now
      // auto-opens for the tab that actually submitted the create; a friend's OWN unrelated
      // group-dm-created (from being added to a DIFFERENT group someone else just made) still
      // only gets the toast, since pendingGroupDmCreate is specific to this tab's own submission.
      if (pendingGroupDmCreate) {
        pendingGroupDmCreate = false;
        groupNewForm.classList.add('hidden');
        groupNameInput.value = '';
        openGroupDm(data.thread.id, data.thread);
      }
      if (groupsOverlay && !groupsOverlay.classList.contains('hidden')) loadGroupThreads();
      break;

    case 'group-dm-member-left':
      if (currentGroupDmId === data.groupId) {
        currentGroupDmMemberNames = currentGroupDmMemberNames.filter((n) => n !== data.username);
        groupDmMembersEl.textContent = currentGroupDmMemberNames.length ? `With ${currentGroupDmMemberNames.join(', ')}` : '';
        showAppToast(`👋 ${data.username} left the group`);
      }
      break;

    case 'group-dm-messages':
      if (currentGroupDmId === data.groupId) {
        groupDmReads = new Map((data.reads || []).map((r) => [r.username, r.at]));
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
        ws.send(JSON.stringify({ type: 'group-dm-read', groupId: data.groupId }));
      } else {
        showAppToast(`💬 ${data.fromName} (group): ${data.text}`);
        playNotifySound();
        // Was missing here — friend-dm above gets a real OS notification for a backgrounded tab,
        // but this sibling case only ever showed an in-tab toast, easy to miss while minimized.
        notify(`${data.fromName} (group)`, data.text);
      }
      break;

    case 'group-dm-left':
      groupDmOverlay.classList.add('hidden');
      currentGroupDmId = null;
      if (groupsOverlay && !groupsOverlay.classList.contains('hidden')) loadGroupThreads();
      break;

    case 'reminder-set':
      showAppToast(`⏰ Got it — I'll remind you at ${formatReminderDue(data.dueAt)}: ${data.text}`);
      break;

    case 'reminders-list':
      if (!data.reminders.length) showAppToast('⏰ No reminders. Try /remind 10m feed the dog');
      else renderSystem({ text: `⏰ Your reminders (only you can see this): ${data.reminders.map((r) => `${formatReminderDue(r.dueAt)} — ${r.text}`).join(' · ')}` });
      break;

    case 'reminders-cleared':
      showAppToast(`⏰ Cleared ${data.count} reminder${data.count === 1 ? '' : 's'}`);
      break;

    case 'reminder':
      showAppToast(`⏰ Reminder: ${data.text}`);
      playNotifySound();
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && (document.hidden || !document.hasFocus())) {
        new Notification('⏰ Reminder', { body: hideSpoilerText(data.text) });
      }
      renderSystem({ text: `⏰ Reminder (only you can see this): ${data.text}` });
      break;

    case 'profile-card':
      renderProfileCard(data);
      break;

    case 'events-updated':
      setRoomEvents(data.events || []);
      if (data.created && data.created.by !== (myProfile && myProfile.name)) {
        showAppToast(`📅 ${data.created.by} scheduled "${data.created.title}"`);
      }
      if (data.cancelled) showAppToast(`📅 "${data.cancelled.title}" was cancelled`);
      break;

    case 'event-reminder': {
      const msgText = data.startingNow ? `📅 "${data.title}" is starting now!` : `📅 "${data.title}" starts in 15 minutes`;
      showAppToast(msgText);
      playNotifySound();
      const ev = roomEvents.find((e) => e.id === data.id);
      if (ev && myProfile && ev.going.includes(myProfile.name)) notify('📅 Event reminder', msgText);
      break;
    }

    case 'invites-list':
      renderInvites(data.invites || []);
      if (data.created && data.invites && data.invites[0]) {
        if (pendingFriendInvite) {
          const who = pendingFriendInvite;
          pendingFriendInvite = null;
          sendFriendRoomInvite(who, `${location.origin}/?invite=${data.invites[0].token}`, '');
        } else {
          copyInviteLink(data.invites[0].token);
        }
      }
      break;

    case 'disappearing-updated':
      disappearSelect.value = String(data.seconds || 0);
      renderSystem({ text: data.seconds ? `⏳ ${data.by} turned on disappearing messages — messages are deleted after ${DISAPPEAR_LABELS[data.seconds]}` : `⏳ ${data.by} turned off disappearing messages` });
      break;

    case 'messages-expired':
      for (const id of data.ids || []) {
        const el = document.getElementById(`msg-${id}`);
        if (el) el.remove();
      }
      break;

    case 'word-filter-settings':
      applyWordFilterSettings(data);
      break;

    case 'word-filter-updated':
      showAppToast(data.useDefault || data.count ? `🚫 ${data.by} updated this room's word filter` : `🚫 ${data.by} turned off this room's word filter`);
      break;

    case 'room-emojis-updated':
      setRoomEmojis(data.emojis || []);
      if (data.added) showAppToast(`😀 New room emoji :${data.added}: — find it in the 🙂 picker`);
      break;

    case 'accent-updated':
      applyRoomAccent(data.accent || null);
      if (myProfile && data.by !== myProfile.name) showAppToast(`🎨 ${data.by} changed the room color`);
      break;

    case 'hosts-only-updated':
      roomHostsOnly = !!data.on;
      document.getElementById('hosts-only-input').checked = roomHostsOnly;
      updateComposerLock();
      showAppToast(data.on ? `📢 ${data.by} made this an announcement-only room` : `📢 ${data.by} opened the room back up — everyone can post`);
      break;

    case 'slow-mode-updated':
      applySlowMode(data.seconds);
      showAppToast(data.seconds ? `🐢 ${data.by} turned on slow mode: one message every ${slowModeLabel(data.seconds)}` : `🐢 ${data.by} turned off slow mode`);
      break;

    case 'slow-mode-wait':
      slowModeReadyAt = Date.now() + data.seconds * 1000;
      showAppToast(`🐢 Slow mode — you can send again in ${data.seconds}s`);
      break;

    case 'announcement-updated':
      currentAnnouncement = data.text || null;
      renderAnnouncementBanner();
      if (isHost) announcementInput.value = currentAnnouncement || '';
      break;

    case 'name-updated': {
      pendingNameUpdate = false;
      const previousName = myProfile ? myProfile.name : null;
      if (myProfile) myProfile.name = data.name;
      myUsername = data.name;
      if (previousName && previousName !== data.name) {
        roomProfiles.set(data.name, roomProfiles.get(previousName) || { avatarUrl: myProfile && myProfile.avatarUrl, status: myProfile && myProfile.status });
        // pushNewMessage (server.js) skips a push to whoever's *live* in the room already, keyed
        // by their current connected name — but the stored subscription row still had the old
        // name until the next room join re-subscribed. Renaming mid-session (no rejoin) left that
        // filter mismatched, so a user got a real OS push for every message in the room —
        // including their own — until they next switched/rejoined. Re-subscribing here keeps the
        // row's name current immediately instead of waiting on that indirect trigger.
        subscribeToPush();
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

    case 'cohosts-updated':
      roomCohosts = data.cohosts || [];
      if (isCohost !== !!data.isCohost) {
        isCohost = !!data.isCohost;
        showAppToast(isCohost ? '⭐ You are now a co-host of this room' : 'You are no longer a co-host of this room');
        rerenderModControls();
      }
      applyModVisibility();
      break;

    case 'welcome-updated':
      roomWelcomeText = data.text || null;
      if (isHost) {
        welcomeInput.value = roomWelcomeText || '';
        showAppToast(roomWelcomeText ? '👋 Welcome message saved' : 'Welcome message turned off');
      }
      break;

    case 'scheduled-list':
      renderScheduledList(data.items || []);
      if (data.action === 'schedule-message') {
        showAppToast(`⏰ Scheduled! Type /scheduled to see or cancel (${(data.items || []).length} waiting)`);
      }
      break;

    case 'turn-credential':
      if (data.iceServer) { turnIceServer = data.iceServer; turnFetchedAt = Date.now(); }
      turnWaiters.forEach((r) => r());
      turnWaiters = [];
      break;

    case 'account-deleted':
      signOutAccount('Your account was deleted');
      break;

    case 'room-notify-updated':
      showAppToast(data.mode === 'all' ? '🔔 Notifications on for this room'
        : data.mode === 'mentions' ? '🔔 Only @mentions will notify you here'
        : data.until ? `🔕 Muted until ${formatReminderDue(data.until)}` : '🔕 This room is muted');
      break;

    case 'recent-unread':
      recentRoomsList.querySelectorAll('.recent-room-chip').forEach((chip) => {
        const n = data.counts && data.counts[chip.dataset.code];
        let badge = chip.querySelector('.recent-unread-badge');
        if (!n) { if (badge) badge.remove(); return; }
        if (!badge) { badge = document.createElement('span'); badge.className = 'recent-unread-badge'; chip.appendChild(badge); }
        badge.textContent = n >= 100 ? '99+' : String(n);
        badge.title = `${n >= 100 ? '99+' : n} new message${n === 1 ? '' : 's'}`;
      });
      break;

    case 'bio-updated':
      showAppToast('✏️ About me saved');
      break;

    case 'room-stats':
      if (data.code === currentRoomCode) renderRoomStats(data);
      break;

    case 'mentions':
      renderMentions(data.mentions || []);
      break;

    case 'mod-log':
      renderModLog(data.entries || []);
      break;

    case 'my-stickers':
      renderMyStickers(data.stickers || [], !!data.signedOut);
      break;

    case 'game-invite':
      renderGameInvite(data);
      if (myProfile && data.from !== myProfile.name) {
        notify(`🎮 ${data.from} wants to play`, data.label);
      }
      break;

    case 'room-champions':
      renderChampions(data.games || {});
      break;

    case 'edit-history':
      showEditHistory(data);
      break;

    case 'older-messages':
      handleOlderMessages(data);
      break;

    case 'message-edited': {
      const msgEl = document.getElementById(`msg-${data.messageId}`);
      // Found by the room-chat client-side correctness audit: a message-edited broadcast that
      // arrives (or is still in flight) for a message that has since been deleted used to silently
      // resurrect deleted text — the deleted placeholder still carries class "text", which this
      // handler's own selector matches just as readily as a real live message. dataset.deleted
      // (set below in message-deleted) makes that state explicit instead of relying on server-side
      // event ordering to never produce this sequence.
      if (msgEl && msgEl.dataset.deleted) break;
      const bubble = msgEl && msgEl.querySelector('.bubble');
      const textEl = bubble && bubble.querySelector('.text, .edit-message-form');
      if (textEl) {
        const fresh = document.createElement('span');
        fresh.className = 'text';
        fresh.dataset.rawText = data.text;
        if (bubble.dataset.mePrefix) {
          fresh.classList.add('me-action');
          fresh.appendChild(document.createTextNode(bubble.dataset.mePrefix));
        }
        fresh.appendChild(renderTextWithMentions(data.text));
        textEl.replaceWith(fresh);
      }
      // Found by the link-preview client-side audit: an edit never touched the link-preview card
      // at all — an edit that removed/changed the URL left the OLD card showing forever, and an
      // edit that added a URL to a previously-plain message never got a card at all. This handler
      // has no mediaUrl field to check (the broadcast only ever carries messageId/text, since only
      // text is editable), so a media message is instead recognized by an existing '.media'
      // element — renderMessage never generates a link-preview card alongside one, so this stays
      // consistent with that rule rather than growing a new "media message got a card" case.
      if (bubble && !bubble.querySelector('.media')) {
        const oldCard = bubble.querySelector('.link-preview-card, .yt-card');
        if (oldCard) oldCard.remove();
        const urlMatch = data.text.includes('||') ? null : data.text.match(/https?:\/\/[^\s<]+/i);
        if (urlMatch) renderLinkPreview(bubble, trimTrailingUrlPunctuation(urlMatch[0]));
      }
      const metaEl = bubble && bubble.querySelector('.meta');
      if (metaEl && !metaEl.querySelector('.edited-tag') && !/· edited/.test(metaEl.textContent)) {
        const canSee = isMod() || (msgEl && msgEl.classList.contains('own'));
        metaEl.append(document.createTextNode(' · '), canSee ? makeEditedTag(data.messageId) : document.createTextNode('edited'));
      }
      break;
    }

    case 'message-deleted': {
      const el = document.getElementById(`msg-${data.messageId}`);
      if (el) {
        el.dataset.deleted = '1';
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
        // Found by the voice-call client-side audit: without this, a hand raised before we
        // joined (or before we rejoined after a network blip) looked lowered on our screen
        // forever, since nothing ever re-sent the raise once we were already missing it.
        if (p.raised) setTileHandRaised(p.sub, true);
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

    case 'private-call-ringing':
      // Confirms our own invite went through — the popup's already showing (see
      // privateCallContextBtn's click handler), this just reconciles the callId. Guarded on
      // role rather than unconditionally assigning: if Cancel was clicked in the brief window
      // before this arrived, teardownPrivateCall() already reset privateCallRole to null, and a
      // late-arriving ringing for that already-cancelled invite must not resurrect it.
      if (privateCallRole === 'caller') privateCallId = data.callId;
      break;

    case 'private-call-incoming':
      if (privateCallId) {
        // Already on/ringing a different call — the server would reject a second invite
        // anyway (see privateCallByWs), so just let the caller's own client time out silently.
        break;
      }
      privateCallId = data.callId;
      privateCallRole = 'callee';
      privateCallPeerName = data.fromName;
      showIncomingCallPopup(data.fromName); // starts the repeating ring tone itself
      break;

    case 'private-call-connected':
      privateCallPeerName = data.peerName;
      hideCallPopup();
      startPrivateCallMedia();
      break;

    case 'private-call-signal':
      handlePrivateCallSignal(data.signal);
      break;

    case 'private-call-ended': {
      const reasonText = { declined: `${privateCallPeerName || 'They'} declined the call`, cancelled: 'Call cancelled', timeout: 'No answer', ended: 'Call ended' }[data.reason] || 'Call ended';
      if (privateCallId === data.callId) showAppToast(`📵 ${reasonText}`);
      teardownPrivateCall();
      break;
    }

    case 'voice-share':
      // sharing:true is handled by the video track arriving via 'track' above;
      // sharing:false we act on directly so the tile reverts even if the
      // track-ended signal is slow or missed.
      if (!data.sharing) clearTileSharing(data.sub);
      break;

    case 'hand-raised':
      setTileHandRaised(data.sub, true);
      // Found by the voice-call client-side audit: raising a hand had no effect at all while
      // docked (the default view) — the tile's little raised-hand marker is CSS-hidden unless
      // the call is expanded, and nothing here ever expanded it or said anything, so a docked
      // caller had no way to ever notice. Mirrors the mute-all-request notice just below.
      voiceErrorEl.textContent = `${data.name} raised their hand.`;
      voiceErrorEl.classList.remove('hidden');
      setCallExpanded(true);
      clearTimeout(muteAllNoticeTimer);
      muteAllNoticeTimer = setTimeout(() => voiceErrorEl.classList.add('hidden'), 6000);
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

// Found by the link-preview client-side audit: the URL-detection regex has no trailing-
// punctuation trim, unlike the near-identical @mention regex elsewhere in this file — a message
// like "check this out: https://example.com/page." sent the trailing "." to the server as part
// of the URL, which either 404s (no preview ever appears for what's actually a valid link) or,
// if it happens to 200 anyway, makes the card's own click-through link carry the same garbage.
// Balance-aware for ")": a trailing paren is only stripped if it's not matched by an earlier "("
// in the same URL, since real URLs legitimately end in one (e.g. Wikipedia disambiguation links).
function trimTrailingUrlPunctuation(url) {
  let trimmed = url.replace(/[.,!?;:'"]+$/, '');
  while (trimmed.endsWith(')') && (trimmed.match(/\(/g) || []).length < (trimmed.match(/\)/g) || []).length) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed;
}

// --- Link previews (URL unfurl) --- session-only cache, avoids re-fetching the same URL twice.
const linkPreviewCache = new Map();
// youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, m.youtube.com, music.youtube.com
function youTubeIdFromUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else {
        const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/);
        if (m) id = m[2];
      }
    }
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    const t = u.searchParams.get('t') || u.searchParams.get('start');
    const start = t ? (parseInt(t, 10) || 0) : 0;
    return { id, start, isShort: u.pathname.startsWith('/shorts/') };
  } catch (err) {
    return null;
  }
}

// A thumbnail with ▶ — the real player (an iframe) only loads when tapped, so a chat full of
// links doesn't pull in YouTube until someone actually wants to watch.
function renderYouTubeCard(bubble, yt, url) {
  const wrap = document.createElement('div');
  wrap.className = 'yt-card' + (yt.isShort ? ' yt-short' : '');
  const thumb = document.createElement('button');
  thumb.type = 'button';
  thumb.className = 'yt-thumb';
  thumb.setAttribute('aria-label', 'Play YouTube video');
  const img = document.createElement('img');
  img.src = `https://i.ytimg.com/vi/${yt.id}/hqdefault.jpg`;
  img.alt = '';
  img.loading = 'lazy';
  const play = document.createElement('span');
  play.className = 'yt-play';
  play.textContent = '▶';
  thumb.append(img, play);
  thumb.addEventListener('click', (e) => {
    e.stopPropagation();
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${yt.id}?autoplay=1&playsinline=1${yt.start ? `&start=${yt.start}` : ''}`;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.title = 'YouTube video';
    thumb.replaceWith(iframe);
  });
  const link = document.createElement('a');
  link.className = 'yt-link';
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Open on YouTube ↗';
  wrap.append(thumb, link);
  bubble.appendChild(wrap);
  // Fill in the title from the normal link-preview fetch, if it has one.
  fetch(`/link-preview?url=${encodeURIComponent(url)}`).then((r) => (r.ok ? r.json() : null)).then((data) => {
    if (data && data.title) {
      const title = document.createElement('div');
      title.className = 'yt-title';
      title.textContent = data.title;
      wrap.insertBefore(title, link);
    }
  }).catch(() => {});
}

function renderLinkPreview(bubble, url) {
  const yt = youTubeIdFromUrl(url);
  if (yt) { renderYouTubeCard(bubble, yt, url); return; }
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
      // Found by the link-preview client-side audit: a 404'd/hotlink-protected og:image showed a
      // bare broken-image glyph inside an otherwise-fine card (title/desc still there) — same gap
      // this app already closed for message media, just not applied here. Removing the element
      // (rather than swapping in fallback text, as message media does) is enough on its own since
      // the title/description alongside it already make this a complete, non-broken-looking card.
      img.addEventListener('error', () => img.remove(), { once: true });
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

  // Found by the link-preview client-side audit: this used to only cache a RESOLVED response —
  // room history renders every message synchronously in one loop, so the same URL posted/reposted
  // several times fired one independent fetch per occurrence, all racing to land before the first
  // one's .then() ever populated the cache. The cache now stores the in-flight Promise itself,
  // set synchronously before the fetch resolves, so a repeat call within the same page load always
  // reuses the one real request already underway.
  let pending = linkPreviewCache.get(url);
  if (!pending) {
    pending = fetch(`/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .catch(() => null);
    linkPreviewCache.set(url, pending);
  }
  pending.then((data) => { if (data) apply(data); });
}

function renderMessage(data, opts = {}) {
  const prepend = !!opts.prepend;
  const el = document.createElement('div');
  const isOwn = !!(myProfile && (data.sub === myProfile.sub || data.own));
  const isBlocked = !isOwn && blockedNames.has(data.name);
  el.className = 'message' + (isOwn ? ' own' : '') + (isBlocked ? ' blocked-hidden' : '');
  el.dataset.senderName = data.name;
  el.dataset.at = String(data.at || 0);
  if (data.id) {
    el.id = `msg-${data.id}`;
    el.dataset.messageId = data.id;
  }
  const time = new Date(data.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.append(makeFlairName(data.name, data.flair), document.createTextNode(` · ${time}${data.scheduled ? ' · ⏰ scheduled' : ''}`));
  if (data.edited) meta.append(document.createTextNode(' · '), (isOwn || isMod()) ? makeEditedTag(data.id) : document.createTextNode('edited'));
  bubble.appendChild(meta);
  if (data.flair && data.flair.bubble) bubble.classList.add(`bubble-${data.flair.bubble}`);

  if (data.deleted) {
    el.dataset.deleted = '1'; // see the message-edited handler's own comment on why this matters
    const text = document.createElement('span');
    text.className = 'text deleted-text';
    text.textContent = 'This message was deleted';
    bubble.appendChild(text);
    el.appendChild(makeAvatar(data.name));
    el.appendChild(bubble);
    messagesEl.appendChild(el);
    maybeScrollToBottom();
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
    // Found by the room-chat client-side correctness audit: a 404'd/expired upload (deleted file,
    // orphan-sweep reclaim, etc.) had no fallback at all — just the browser's bare default broken-
    // image glyph, or a blank/inert player with zero explanation. One shared handler for all three
    // element types (img/video/audio all fire a plain, non-bubbling 'error' event the same way).
    media.addEventListener('error', () => {
      const fallback = document.createElement('span');
      fallback.className = 'media-unavailable';
      fallback.textContent = data.mediaType === 'video' ? '🎬 Video unavailable'
        : data.mediaType === 'audio' ? '🔊 Audio unavailable'
        : '🖼️ Image unavailable';
      media.replaceWith(fallback);
    }, { once: true });
    bubble.appendChild(media);
  }

  if (data.text && data.mediaType !== 'poll') {
    if (!isOwn && matchesKeywordAlert(data.text)) bubble.classList.add('keyword-hit');
    const text = document.createElement('span');
    text.className = 'text';
    // renderTextWithMentions turns **bold**/*italic*/`code` into real elements, so .textContent
    // on this span never contains the original markdown delimiters — startEditingMessage needs
    // the actual raw source text (not the rendered/stripped version) to edit without silently
    // destroying the formatting the moment Save or Cancel is clicked.
    text.dataset.rawText = data.text;
    if (data.kind === 'me') {
      text.classList.add('me-action');
      bubble.dataset.mePrefix = `* ${data.name} `;
      text.appendChild(document.createTextNode(bubble.dataset.mePrefix));
    }
    text.appendChild(renderTextWithMentions(data.text));
    bubble.appendChild(text);
    if (data.kind === 'countdown' && data.meta && data.meta.endsAt) {
      text.textContent = '';
      bubble.classList.add('countdown-bubble');
      const label = document.createElement('div');
      label.className = 'countdown-label';
      label.appendChild(renderTextWithMentions(data.text));
      const clock = document.createElement('div');
      clock.className = 'countdown-clock';
      clock.dataset.endsAt = String(data.meta.endsAt);
      text.append(label, clock);
      tickCountdown(clock);
      ensureCountdownTicker();
    }
    if (data.kind === 'effect' && data.meta && data.meta.effect) {
      bubble.classList.add('effect-bubble');
      // Only live messages rain on the screen — not every time history loads.
      if (!opts.history && Date.now() - (data.at || 0) < 15000) playScreenEffect(data.meta.effect);
    }
    if (data.kind === 'roll') {
      bubble.classList.add('roll-bubble');
      const fair = document.createElement('span');
      fair.className = 'roll-verified';
      fair.textContent = '✓ rolled by Valk';
      fair.title = 'This result was picked by the server, so it can\'t be faked';
      bubble.appendChild(fair);
    }
    if (!data.mediaUrl) {
      const urlMatch = data.text.includes('||') ? null : data.text.match(/https?:\/\/[^\s<]+/i);
      if (urlMatch) renderLinkPreview(bubble, trimTrailingUrlPunctuation(urlMatch[0]));
    }
  }

  if (data.id) {
    bubble.appendChild(makeMessageActions(data));
    const pillsRow = document.createElement('div');
    pillsRow.className = 'reaction-pills';
    bubble.appendChild(pillsRow);
    renderReactionPills(bubble, data.id);
  }

  if (data.replyCount > 0) setThreadCount(bubble, data.id, data.replyCount);
  el.appendChild(makeAvatar(data.name));
  el.appendChild(bubble);
  messagesEl.appendChild(el);
  groupWithPrevious(el);
  // A live reply bumps the count on the message it replies to.
  const parentId = (data.replyPreview && data.replyPreview.id) || data.replyToId;
  if (parentId && !opts.history) {
    const parentBubble = document.querySelector(`#msg-${CSS.escape(parentId)} .bubble`);
    if (parentBubble) setThreadCount(parentBubble, parentId, (Number(parentBubble.dataset.replyCount) || 0) + 1);
  }
  // force for your own outgoing message — sending should always show what you just sent
  // regardless of scroll position, same as every mainstream chat app.
  maybeScrollToBottom(Boolean(myProfile && data.sub === myProfile.sub));

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
// Group 7/8: a ```fenced code block``` (optional language tag on the first line, e.g. ```js).
// Listed first so three backticks never get read as inline `code`.
const FORMAT_RE = /```(?:([a-zA-Z0-9+#.-]{1,15})[ \t]*\n)?([\s\S]+?)```|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+?)`|:([a-z0-9_]{2,20}):|@(\S+)|\|\|(.+?)\|\|/g;

function hideSpoilerText(text) {
  return typeof text === 'string' ? text.replace(/\|\|([\s\S]+?)\|\|/g, '▒▒▒▒') : text;
}

function makeCustomEmojiImg(name) {
  const img = document.createElement('img');
  img.className = 'custom-emoji';
  img.src = roomEmojis.get(name);
  img.alt = `:${name}:`;
  img.title = `:${name}:`;
  return img;
}

function makeCodeBlock(code, lang) {
  const wrap = document.createElement('div');
  wrap.className = 'fenced-code';
  const bar = document.createElement('div');
  bar.className = 'fenced-code-bar';
  const label = document.createElement('span');
  label.textContent = lang || 'code';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'fenced-code-copy';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const done = () => { copyBtn.textContent = 'Copied!'; setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => { copyBtn.textContent = 'Copy failed'; });
    else {
      const ta = document.createElement('textarea');
      ta.value = code; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (err) { copyBtn.textContent = 'Copy failed'; }
      ta.remove();
    }
  });
  bar.append(label, copyBtn);
  const pre = document.createElement('pre');
  const codeEl = document.createElement('code');
  codeEl.textContent = code;
  pre.appendChild(codeEl);
  wrap.append(bar, pre);
  return wrap;
}

function renderTextWithMentions(text) {
  const frag = document.createDocumentFragment();
  let lastIndex = 0;
  let m;
  FORMAT_RE.lastIndex = 0;
  while ((m = FORMAT_RE.exec(text))) {
    if (m.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
    if (m[2] !== undefined) {
      frag.appendChild(makeCodeBlock(m[2].replace(/^\n+|\s+$/g, ''), m[1] || ''));
    } else if (m[3] !== undefined) {
      const strong = document.createElement('strong');
      strong.textContent = m[3];
      frag.appendChild(strong);
    } else if (m[4] !== undefined) {
      const em = document.createElement('em');
      em.textContent = m[4];
      frag.appendChild(em);
    } else if (m[5] !== undefined) {
      const code = document.createElement('code');
      // A multi-line backtick-wrapped snippet (e.g. AI Studio's "Generate code" send-to-chat) reads
      // as a squished single line without this — `.inline-code` alone has no white-space rule, and
      // <code> collapses newlines like any other inline element by default.
      code.className = m[5].includes('\n') ? 'inline-code code-block' : 'inline-code';
      code.textContent = m[5];
      frag.appendChild(code);
    } else if (m[8] !== undefined) {
      // ||spoiler||: blurred until tapped.
      const spoiler = document.createElement('span');
      spoiler.className = 'spoiler';
      spoiler.textContent = m[8];
      spoiler.tabIndex = 0;
      spoiler.setAttribute('role', 'button');
      spoiler.setAttribute('aria-label', 'Spoiler — tap to reveal');
      const reveal = (e) => {
        e.stopPropagation();
        spoiler.classList.add('revealed');
        spoiler.removeAttribute('role');
        spoiler.removeAttribute('aria-label');
      };
      spoiler.addEventListener('click', reveal);
      spoiler.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') reveal(e); });
      frag.appendChild(spoiler);
    } else if (m[6] !== undefined) {
      if (roomEmojis.has(m[6])) frag.appendChild(makeCustomEmojiImg(m[6]));
      else frag.appendChild(document.createTextNode(m[0]));
    } else {
      const token = m[7].replace(/[.,!?;:]+$/, '');
      const trailing = m[7].slice(token.length);
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
        frag.appendChild(document.createTextNode('@' + m[7]));
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

// Tracks which dropdown row is keyboard-highlighted (see the messageInput keydown handler
// below) — reset to 0 (the first match pre-highlighted, matching the usual chat-app UX where
// Enter alone picks the top suggestion) every time the match list is rebuilt, since the old
// index otherwise silently refers to a different row after a keystroke changes the filter.
let mentionHighlightIndex = -1;

function highlightMentionItem(index) {
  const items = [...mentionDropdownEl.children];
  mentionHighlightIndex = items.length ? Math.max(0, Math.min(index, items.length - 1)) : -1;
  items.forEach((item, i) => item.classList.toggle('active', i === mentionHighlightIndex));
}

function updateMentionDropdown() {
  if (updateCommandSuggestions()) return;
  if (updateEmojiSuggestions()) return;
  const query = currentMentionQuery();
  let matches = query === null ? [] : lastRoomUsers.filter((u) => u.name.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5);
  if (query !== null && 'everyone'.startsWith(query.toLowerCase())) matches = [{ name: 'everyone' }, ...matches].slice(0, 5);
  if (!matches.length) {
    mentionDropdownEl.classList.add('hidden');
    mentionHighlightIndex = -1;
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
  highlightMentionItem(0);
  // Found by the sticker-picker audit: the two composer popups had no awareness of each other,
  // so typing "@" while the sticker picker was open left both stacked on screen at once.
  if (stickerPicker) stickerPicker.classList.add('hidden');
}

function insertMention(name) {
  const value = messageInput.value;
  const cursor = messageInput.selectionStart;
  const before = value.slice(0, cursor).replace(/@(\S*)$/, `@${name} `);
  messageInput.value = before + value.slice(cursor);
  mentionDropdownEl.classList.add('hidden');
  mentionHighlightIndex = -1;
  // Assigning .value resets the caret to the end of the whole string, not just past what was
  // inserted — with no follow-up here, picking a mention mid-message (e.g. "hi @al there" →
  // "alice") left the caret after the rest of the message instead of right after the mention,
  // so anything typed next landed in the wrong place.
  const caretPos = before.length;
  messageInput.setSelectionRange(caretPos, caretPos);
  messageInput.focus();
}

// If the message is further back than what's loaded, fetch everything up to it first (one
// request — see load-older-messages' untilId), then jump. Used by pins, reply quotes, search,
// the media gallery, saved messages, notifications and message links.
let pendingJumpId = null;
function jumpToMessage(id) {
  const target = document.getElementById(`msg-${id}`);
  if (!target) {
    if (!id || !oldestLoaded || !olderHasMore || !ws || ws.readyState !== WebSocket.OPEN) {
      showAppToast("Couldn't find that message — it may have been deleted.");
      return;
    }
    pendingJumpId = id;
    showAppToast('Loading older messages…');
    olderLoading = true;
    olderRequestedBefore = oldestLoaded.id;
    ws.send(JSON.stringify({ type: 'load-older-messages', beforeAt: oldestLoaded.at, beforeId: oldestLoaded.id, untilId: id }));
    return;
  }
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('highlight');
  setTimeout(() => target.classList.remove('highlight'), 1500);
}

// --- Per-message actions: react / reply / pin ---
// Remembers which message each action row was built for, so becoming (or stopping being) a
// co-host mid-session can rebuild the rows with/without the 🗑️ delete-anyone button.
const messageActionData = new WeakMap();
function rerenderModControls() {
  renderOnlineList(lastRoomUsers);
  document.querySelectorAll('#messages .message-actions').forEach((row) => {
    const d = messageActionData.get(row);
    if (d) row.replaceWith(makeMessageActions(d));
  });
}

function makeMessageActions(data) {
  const actions = document.createElement('div');
  actions.className = 'message-actions';
  messageActionData.set(actions, data);

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

  const isOwn = !!(myProfile && (data.sub === myProfile.sub || data.own));
  if (!isOwn && data.name) {
    const reportBtn = document.createElement('button');
    reportBtn.type = 'button';
    reportBtn.className = 'msg-action-btn';
    reportBtn.textContent = '🚩';
    reportBtn.setAttribute('aria-label', `Report ${data.name}`);
    reportBtn.addEventListener('click', () => reportUser(data.name, data.id, data.text));
    actions.appendChild(reportBtn);
  }
  if (isOwn && !data.mediaUrl && data.kind !== 'roll' && data.kind !== 'countdown') {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'msg-action-btn';
    editBtn.textContent = '✏️';
    editBtn.setAttribute('aria-label', 'Edit message');
    editBtn.addEventListener('click', () => startEditingMessage(data.id));
    actions.appendChild(editBtn);
  }
  const authorProtected = !isHost && isCohost && (roomCohosts.includes(data.name) || lastRoomUsers.some((u) => u.name === data.name && (u.host || u.cohost)));
  if (isOwn || (isMod() && !authorProtected)) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'msg-action-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.setAttribute('aria-label', isOwn ? 'Delete message' : (isHost ? 'Delete message (host)' : 'Delete message (co-host)'));
    deleteBtn.addEventListener('click', () => {
      if (!confirm('Delete this message? This can\'t be undone.')) return;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'delete-message', messageId: data.id }));
    });
    actions.appendChild(deleteBtn);
  }

  // ⋯ More: the less-used actions live here so the row stays short on phones.
  const moreBtn = document.createElement('button');
  moreBtn.type = 'button';
  moreBtn.className = 'msg-action-btn';
  moreBtn.textContent = '⋯';
  moreBtn.setAttribute('aria-label', 'More actions');
  moreBtn.title = 'More';
  moreBtn.addEventListener('click', (e) => { e.stopPropagation(); openMoreMenu(moreBtn, data); });
  actions.appendChild(moreBtn);
  return actions;
}

function startEditingMessage(messageId) {
  const bubble = document.querySelector(`#msg-${messageId} .bubble`);
  const textEl = bubble && bubble.querySelector('.text');
  if (!bubble || !textEl) return;
  // Found by the room-chat client-side correctness audit: clicking Edit on a second message while
  // one was already being edited left BOTH forms open with no cancel-the-other or block — auto-
  // cancel whatever was already open, matching how most chat apps only allow one open edit at a
  // time.
  if (activeMessageEdit) activeMessageEdit.restore();
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
    if (activeMessageEdit && activeMessageEdit.messageId === messageId) activeMessageEdit = null;
  };
  cancelBtn.addEventListener('click', restore);
  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || text === originalText) { restore(); return; }
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'edit-message', messageId, text }));
    // The form stays visible (showing the submitted text) until the server's message-edited
    // broadcast replaces it — untrack it as "the active edit" now since the user's done
    // interacting with it either way, so a newly-started edit elsewhere won't also try to restore
    // this already-submitted one.
    if (activeMessageEdit && activeMessageEdit.messageId === messageId) activeMessageEdit = null;
  });
  activeMessageEdit = { messageId, restore };
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
  for (const name of roomEmojis.keys()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.appendChild(makeCustomEmojiImg(name));
    btn.addEventListener('click', () => {
      toggleReaction(messageId, `:${name}:`);
      closeReactionPicker();
    });
    grid.appendChild(btn);
  }
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

function reactorsLabel(names) {
  const shown = names.map((n) => (myProfile && n === myProfile.name ? 'You' : n));
  if (shown.length <= 4) return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0];
  return `${shown.slice(0, 3).join(', ')} and ${shown.length - 3} others`;
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
    // Found by the personal block/mute audit: a blocked user's reaction was counted into the
    // pill total indistinguishably from anyone else's — filtered out of the displayed count here
    // (the underlying Set in reactionsByMessage is left untouched, so unblocking later and
    // re-rendering this message naturally shows their reaction again with no separate bookkeeping
    // needed).
    const visibleNames = [...names].filter((n) => !blockedNames.has(n));
    if (visibleNames.length === 0) continue;
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'reaction-pill' + (myProfile && visibleNames.includes(myProfile.name) ? ' mine' : '');
    const customName = emoji.match(/^:([a-z0-9_]{2,20}):$/);
    if (customName && roomEmojis.has(customName[1])) {
      pill.append(makeCustomEmojiImg(customName[1]), ` ${visibleNames.length}`);
    } else {
      pill.textContent = `${emoji} ${visibleNames.length}`;
    }
    // Who reacted: hover tooltip on desktop; press-and-hold on phones shows it as a toast
    // (and doesn't toggle your own reaction).
    const who = reactorsLabel(visibleNames);
    pill.title = `${who} reacted with ${emoji}`;
    pill.setAttribute('aria-label', `${emoji}: ${who}`);
    let holdTimer = null;
    let held = false;
    pill.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      held = false;
      holdTimer = setTimeout(() => { held = true; showAppToast(`${emoji} ${who}`); }, 450);
    });
    const cancelHold = () => clearTimeout(holdTimer);
    pill.addEventListener('pointerup', cancelHold);
    pill.addEventListener('pointerleave', cancelHold);
    pill.addEventListener('pointercancel', cancelHold);
    pill.addEventListener('contextmenu', (e) => e.preventDefault());
    pill.addEventListener('click', () => {
      if (held) { held = false; return; }
      toggleReaction(messageId, emoji);
    });
    row.appendChild(pill);
  }
}

// --- Reply preview ---
function setReplyingTo(data) {
  replyingTo = { id: data.id, name: data.name, text: data.text || (data.mediaType ? '(a photo/video)' : '') };
  renderReplyPreview();
  messageInput.focus();
}

// Photo/video uploads, voice clips, stickers and GIFs all send through here so a media send
// answers whatever "Replying to…" is showing and then clears it — they used to ignore the reply
// bar entirely and leave it stuck on the composer.
function sendMediaMessage(mediaUrl, mediaType, caption) {
  const payload = { type: 'message', mediaUrl, mediaType };
  if (caption) payload.text = caption;
  if (replyingTo) payload.replyTo = replyingTo.id;
  ws.send(JSON.stringify(payload));
  clearReplyingTo();
}

// GIFs from the GIF picker: only the GIPHY id is sent; the server builds the media URL.
function sendGifMessage(gifId) {
  const payload = { type: 'message', gifId, mediaType: 'image' };
  if (replyingTo) payload.replyTo = replyingTo.id;
  ws.send(JSON.stringify(payload));
  clearReplyingTo();
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

// Found by the poll-creation-UI audit: renderMessage/renderPoll already know to JSON.parse a
// poll message's .text to get its real question, but every OTHER surface that displays a
// message's .text verbatim (pinned banner, saved-messages panel, reply-quote preview) had no
// equivalent — a poll's raw JSON blob (`{"question":"...","options":[...]}`) showed up literally
// instead of the question. Shared here so all three surfaces stay in sync with renderPoll's own
// parsing logic rather than three separate hand-rolled copies.
function pollDisplayText(m) {
  if (m.mediaType !== 'poll') return m.text;
  try { return `📊 ${JSON.parse(m.text).question}`; } catch { return m.text; }
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

function placeNewMessagesDivider(lastReadId, messages) {
  if (!lastReadId || !myProfile || !messages.length) return null;
  const idx = messages.findIndex((m) => m.id === lastReadId);
  if (idx < 0 || idx === messages.length - 1) return null;
  const fresh = messages.slice(idx + 1).filter((m) => m.name !== myProfile.name);
  if (!fresh.length) return null;
  const anchor = document.getElementById(`msg-${lastReadId}`);
  if (!anchor) return null;
  const divider = document.createElement('div');
  divider.className = 'new-messages-divider';
  divider.setAttribute('role', 'separator');
  const label = document.createElement('span');
  label.textContent = fresh.length === 1 ? '1 new message' : `${fresh.length} new messages`;
  divider.appendChild(label);
  anchor.after(divider);
  return divider;
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
  // Installed-app icon badge (home screen / taskbar), where the browser supports it.
  try {
    if (unreadCount > 0 && navigator.setAppBadge) navigator.setAppBadge(unreadCount).catch(() => {});
    else if (unreadCount === 0 && navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  } catch (err) { /* not supported */ }
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
  maybeScrollToBottom();
}

function renderOnlineList(users) {
  lastRoomUsers = users;
  users.forEach((u) => roomProfiles.set(u.name, { avatarUrl: u.avatarUrl, status: u.status }));
  menuOnlineList.innerHTML = '';
  users.forEach((u) => {
    const li = document.createElement('li');
    li.dataset.username = u.name;
    const nameWrap = document.createElement('span');
    nameWrap.className = 'online-name-wrap';
    nameWrap.appendChild(makeFlairName(u.name, u.flair));
    if (u.away) {
      li.classList.add('user-away');
      const awayBadge = document.createElement('span');
      awayBadge.className = 'cohost-badge';
      awayBadge.textContent = '🌙';
      awayBadge.title = 'Away';
      nameWrap.appendChild(awayBadge);
    }
    if (u.host || u.cohost) {
      const roleBadge = document.createElement('span');
      roleBadge.className = 'cohost-badge';
      roleBadge.textContent = u.host ? '👑' : '🛡️';
      roleBadge.title = u.host ? 'Room host' : 'Co-host';
      nameWrap.appendChild(roleBadge);
    }
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
    // Co-hosts get mute/kick/ban for regular members only (the server enforces the same rule —
    // see isProtectedFromCohost). The host also gets a ⭐ toggle to promote/demote co-hosts.
    const targetIsCohost = !!u.cohost || roomCohosts.includes(u.name);
    if (isMod() && myProfile && u.name !== myProfile.name && (isHost || (!targetIsCohost && !u.host))) {
      const modActions = document.createElement('span');
      modActions.className = 'mod-actions';
      if (isHost) {
        const cohostBtn = document.createElement('button');
        cohostBtn.type = 'button';
        cohostBtn.className = 'mod-btn';
        cohostBtn.textContent = targetIsCohost ? '🌟' : '⭐';
        cohostBtn.title = targetIsCohost ? `Remove ${u.name} as co-host` : `Make ${u.name} a co-host (they can mute, kick, ban, delete messages)`;
        cohostBtn.addEventListener('click', () => {
          if (!targetIsCohost && !confirm(`Make ${u.name} a co-host? They'll be able to mute, kick and ban people and delete messages.`)) return;
          if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: targetIsCohost ? 'remove-cohost' : 'add-cohost', name: u.name }));
        });
        modActions.appendChild(cohostBtn);
      }
      const muteBtn = document.createElement('button');
      muteBtn.type = 'button';
      muteBtn.className = 'mod-btn';
      // Toggles between mute/unmute (mirrors the block/unblock button above) — unmute-user has
      // always existed and worked server-side, but the client never tracked who was already muted,
      // so this button could only ever mute, never undo it. u.muted comes from roomUsers() (see
      // server.js), refreshed on every 'presence' broadcast, so this is accurate even right after
      // a page refresh mid-session, not just for mutes issued during the current tab's lifetime.
      muteBtn.textContent = u.muted ? '🔊' : '🔇';
      muteBtn.title = u.muted ? `Unmute ${u.name}` : `Mute ${u.name}`;
      muteBtn.addEventListener('click', () => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: u.muted ? 'unmute-user' : 'mute-user', name: u.name }));
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

// Found by the room-chat client-side correctness audit: scrollToBottom() used to fire
// unconditionally from every incoming message/system line, yanking anyone who'd scrolled up to
// read history straight back down to the newest message. maybeScrollToBottom replaces those call
// sites: it still scrolls immediately when the user is already near the bottom (or force=true, for
// the user's own outgoing message — sending always shows what you just sent, regardless of scroll
// position) but otherwise leaves the viewport alone and shows a "new messages" pill instead, the
// same pattern Discord/Slack/iMessage all use. During a bulk history render on room join, the
// container starts empty (trivially "near the bottom") and each append keeps it pinned there, so
// this naturally still lands at the bottom by the end without needing a separate code path.
const NEAR_BOTTOM_PX = 100;
let unseenNewCount = 0;

function isScrolledNearBottom() {
  return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < NEAR_BOTTOM_PX;
}

function hideNewMessagesPill() {
  unseenNewCount = 0;
  newMessagesPill.classList.add('hidden');
}

function maybeScrollToBottom(force = false) {
  if (force || isScrolledNearBottom()) {
    scrollToBottom();
    hideNewMessagesPill();
  } else {
    unseenNewCount++;
    newMessagesPill.textContent = `↓ ${unseenNewCount} new message${unseenNewCount === 1 ? '' : 's'}`;
    newMessagesPill.classList.remove('hidden');
  }
}

newMessagesPill.addEventListener('click', () => {
  scrollToBottom();
  hideNewMessagesPill();
});

// Catches the user manually scrolling back down themselves (not just clicking the pill).
messagesEl.addEventListener('scroll', () => {
  if (!newMessagesPill.classList.contains('hidden') && isScrolledNearBottom()) hideNewMessagesPill();
});

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
  if (isLocalDndActive()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  // Only interrupt with an OS notification when the tab isn't already being looked at — the
  // message is already visible live in the DOM otherwise, so a popup on top would just be noise.
  if (!document.hidden && document.hasFocus()) return;
  const n = new Notification(hideSpoilerText(name), { body: hideSpoilerText(text) });
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
  if (isLocalDndActive()) return;
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
  // Found by the room-settings/menu-panel correctness audit: bansListEl was only ever reset to
  // hidden on a full room switch, never on menu close — reopening the menu later showed the same
  // now-possibly-stale list from last time, and manageBansBtn's own click handler treats "already
  // visible" as "the user wants to collapse it" rather than "refetch," so a stale list took an
  // extra click (collapse, then reopen-and-refetch) to actually refresh. Hiding it here means the
  // next "Manage banned users" click always starts from a real get-bans fetch again.
  bansListEl.classList.add('hidden');
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
  stickfighterLink.href = `stickfighter.html${params}`;
  firefightLink.href = `firefight.html${params}`;
  blockbattleLink.href = `blockbattle.html${params}`;
  pictionaryLink.href = `pictionary.html${params}`;
  triviaLink.href = `trivia.html${params}`;
  tictactoeLink.href = `tictactoe.html${params}`;
  chessLink.href = `chess.html${params}`;
  hangmanLink.href = `hangman.html${params}`;
  wordguessLink.href = `wordguess.html${params}`;
  typeraceLink.href = `typerace.html${params}`;
  snakeLink.href = `snake.html${params}`;
  g2048Link.href = `2048.html${params}`;
  whiteboardLink.href = `whiteboard.html${params}`;
  flipbookLink.href = `flipbook.html${params}`;
  helloLink.href = `hello.html${params}`;
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

// Found by the landing/room-join-flow correctness audit: a 'Room not found' error means the room
// genuinely no longer exists (distinct from a wrong-PIN or banned error, where the room is still
// real) — without this, a deleted room's recent-rooms chip lingered forever with no indication
// it's now dead.
function removeRecentRoom(code) {
  const list = getRecentRooms().filter((r) => r.code !== code);
  try { localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(list)); } catch {}
  renderRecentRooms();
}

function saveRecentRoom(code, name) {
  const list = getRecentRooms().filter((r) => r.code !== code);
  list.unshift({ code, name: name || null, lastJoined: Date.now() });
  // A throw here previously skipped the account-sync fetch below too, not just local persistence.
  try { localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(list.slice(0, RECENT_ROOMS_MAX))); } catch {}
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
      // Found by the landing/room-join-flow correctness audit: this handler used to send the join
      // directly without ever writing the code into #room-code-input — fine for an ordinary
      // success, but if the room turned out to need a PIN, the resulting join-error handler reveals
      // the PIN field while the code field stays blank/stale, so pressing Join afterward tried to
      // join whatever (if anything) was already typed there, not this recent room. Pre-filling
      // keeps the normal joinRoomForm submit path (which reads roomCodeInput, not r.code) correct
      // for that follow-up attempt.
      roomCodeInput.value = r.code;
      roomPinInput.value = '';
      roomPinInput.classList.add('hidden');
      wsSendOrWarnDisconnected({ type: 'join-room', code: r.code });
    });
    chip.dataset.code = r.code;
    recentRoomsList.appendChild(chip);
  });
  if (list.length && myProfile && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'recent-unread', codes: list.map((r) => r.code) }));
  }
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
  refreshMyPremium();
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
  // A throw here (Safari private browsing, a storage-blocking extension) previously aborted the
  // rest of sign-in too — renderAccountState() and the WS account-linking below never ran, so
  // sign-in silently failed to actually complete even though the server-side auth had already
  // succeeded (the caller's own try/catch would show a confusing raw error like
  // "QuotaExceededError" instead of the app just working for this session without persistence).
  try {
    localStorage.setItem(ACCOUNT_TOKEN_KEY, accountToken);
    localStorage.setItem(ACCOUNT_USERNAME_KEY, accountUsername);
  } catch {}
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
  syncSavedMessagesFromAccount();
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

// toastMessage lets a caller override the default "you clicked sign out" toast — used by the
// accountTokenInvalid handler below, where the real story is "your session already expired
// server-side," not a fresh action the user just took.
function signOutAccount(toastMessage) {
  if (accountToken) {
    fetch('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${accountToken}` } }).catch(() => {});
  }
  unlinkPushFromAccount();
  accountToken = null;
  accountUsername = null;
  localStorage.removeItem(ACCOUNT_TOKEN_KEY);
  localStorage.removeItem(ACCOUNT_USERNAME_KEY);
  // Found by a service-worker cache security audit: the SW's own fetch handler no longer caches
  // personalized responses going forward (fixed alongside this), but this clears out anything a
  // PRE-fix version of the worker already wrote to Cache Storage for this account, and is cheap
  // defense-in-depth against any future regression — without this, a shared/public computer could
  // have let the next person to use it read the signed-out account's cached data straight out of
  // Cache Storage (DevTools, or the SW's offline fallback), since server-side session revocation
  // alone never touches anything client-cached.
  if ('caches' in window) {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
  }
  // Found by the same shared-device audit that flagged the Cache Storage gap above:
  // syncRecentRoomsFromAccount() (see below) merges an account's full cross-device recent-rooms
  // history into this same key on sign-in — after sign-out that history stayed on screen (the
  // landing page's own clickable room chips, no DevTools needed) and one click was enough for the
  // next person to use this device to join a room the previous account had been in. This app's
  // room codes have no other access control by design, so that's a direct room-access exposure,
  // not just a cosmetic leftover. Cleared unconditionally on sign-out (rather than trying to
  // separate "was this entry here before the account merge" from "did the merge add it") since
  // that's the simplest correct behavior once an account merge has touched this list at all.
  try { localStorage.removeItem(RECENT_ROOMS_KEY); } catch {}
  renderRecentRooms();
  // Found by the saved-messages audit: same shared-device exposure shape as the recent-rooms fix
  // just above, arguably worse — saved entries store full message TEXT/IMAGE/VIDEO content
  // inline (see SAVED_KEY's own comment), not just a room code, and nothing ever cleared them on
  // sign-out. Unlike recent-rooms this list was never account-synced in the first place (it's
  // purely per-device, populated by whoever used this browser regardless of which account, if
  // any, was signed in at the time) — but that's exactly why leaving it forces the NEXT person to
  // use this device to inherit it: they get no fresh-account merge to notice, it's just already
  // sitting there. Signing out is this app's one clear "I'm done using this device as me" signal,
  // so it's the right place to clear it, same as every other shared-device fix in this function.
  try { localStorage.removeItem(SAVED_KEY); } catch {}
  savedMessages = [];
  document.querySelectorAll('.save-btn.saved').forEach((btn) => btn.classList.remove('saved'));
  if (!savedOverlay.classList.contains('hidden')) renderSavedList();
  // Account-scoped overlays (friends/DMs/group DMs) were otherwise left open showing the
  // signed-out-out account's data — if a different account then signed in in the same tab,
  // stale friend/DM state could persist on screen until the next explicit fetch.
  friendsOverlay.classList.add('hidden');
  dmOverlay.classList.add('hidden');
  currentDmWithName = null;
  groupDmOverlay.classList.add('hidden');
  currentGroupDmId = null;
  // closeFriendsPanel() already does this when the panel is closed normally — signing out while
  // it happens to be open skipped that, leaving the 8s poll interval running forever (harmless
  // since loadFriends() itself no-ops with no accountToken, but a permanent stray timer).
  clearInterval(friendsPollInterval);
  renderAccountState();
  // Found by the landing/room-join-flow correctness audit: triggering this from the in-room
  // hamburger menu gave zero feedback — the button just disappeared from the still-open menu with
  // nothing else visibly different, easy to misread as "did that even do anything" (signing out
  // doesn't leave the room by design, see the comment above — a toast makes clear it worked
  // without implying anything else changed).
  showAppToast(toastMessage || 'Signed out of your account');
}
// Wrapped rather than passed directly: signOutAccount now takes an optional toastMessage
// parameter, and addEventListener would otherwise forward the click Event itself into it.
accountSignoutBtn.addEventListener('click', () => signOutAccount());
accountSignoutMenuBtn.addEventListener('click', () => signOutAccount());

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
    // A throw here was already caught by this function's own outer catch (degrades gracefully,
    // see its comment below), but it also skipped renderRecentRooms() on the next line — the
    // freshly-merged list just never got drawn, correctable but no reason to let it happen.
    try { localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(merged)); } catch {}
    renderRecentRooms();
  } catch {
    /* offline or server unreachable — keep showing the local list as-is */
  }
}

renderAccountState();
if (accountToken) syncRecentRoomsFromAccount();
if (accountToken) syncSavedMessagesFromAccount();

// Sign-in/out only fires this in *other* tabs (the tab that made the change already updated
// its own in-memory state directly) — without it, a second open tab keeps showing "signed in"
// after logout and its account-gated requests just silently start 401ing.
window.addEventListener('storage', (e) => {
  if (e.key !== ACCOUNT_TOKEN_KEY) return;
  accountToken = localStorage.getItem(ACCOUNT_TOKEN_KEY) || null;
  accountUsername = localStorage.getItem(ACCOUNT_USERNAME_KEY) || null;
  renderAccountState();
  if (accountToken) syncRecentRoomsFromAccount();
  if (accountToken) syncSavedMessagesFromAccount();
});

// --- Friends (account-only) ---
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  // A Text node's innerHTML getter only escapes &/</> (per the HTML fragment-serialization spec) —
  // not " or ' — which is fine for placement as element text content, but every call site here that
  // interpolates this into a double-quoted HTML *attribute* (e.g. an <input value="...">) needs
  // those escaped too, or an embedded " breaks out of the attribute. No currently-reachable call
  // site in this app can actually exploit that gap (every attribute-context use is server-validated
  // content — usernames, upload paths, enum values), but relying on that staying true forever for
  // every *future* free-text field wired through this same "trusted" helper is exactly the kind of
  // landmine worth closing now while it's free and harmless to every existing caller.
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// presence is only ever set on entries in the "Your friends" list (requests/outgoing/blocked
// rows don't get a dot) — { online, roomCode } or omitted entirely.
// Sends the friend a private DM with a link straight into the room you're in. In a PIN room the
// host sends a one-day, single-use invite link (no PIN needed); anyone else's invite just says
// there's a PIN.
let pendingFriendInvite = null;
function sendFriendRoomInvite(username, link, note) {
  const where = currentRoomName ? `${currentRoomName} (${currentRoomCode})` : currentRoomCode;
  ws.send(JSON.stringify({ type: 'friend-dm', toUsername: username, text: `📨 Come chat with me in ${where}!${note}\n${link}` }));
  showAppToast(`📨 Invite sent to ${username}`);
}
function inviteFriendHere(username) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentRoomCode) return;
  const pinRoom = !!(roomPinFormInput && /PIN is set/.test(roomPinFormInput.placeholder));
  if (pinRoom && isHost) {
    pendingFriendInvite = username;
    ws.send(JSON.stringify({ type: 'create-invite', expiresIn: 86400, maxUses: 1 }));
    return;
  }
  sendFriendRoomInvite(username, `${location.origin}/?room=${encodeURIComponent(currentRoomCode)}`, pinRoom ? ' (it has a PIN — ask me for it)' : '');
}

function friendRow(username, actions, presence) {
  const li = document.createElement('li');
  li.className = 'friend-row';
  const buttonsHtml = actions
    .map((a) => {
      const roomAttr = a.roomCode ? ` data-room-code="${escapeHtml(a.roomCode)}"` : '';
      const titleAttr = a.title ? ` title="${escapeHtml(a.title)}" aria-label="${escapeHtml(a.title)}"` : '';
      const badge = a.unread ? `<span class="unread-badge">${a.unread > 99 ? '99+' : a.unread}</span>` : '';
      return `<button type="button" class="friend-action-btn${a.danger ? ' danger' : ''}" data-action="${a.action}" data-username="${escapeHtml(username)}"${roomAttr}${titleAttr}>${a.label}${badge}</button>`;
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
    const actions = [{ action: 'dm', label: '💬', unread: f.unreadDms || 0, title: `Message ${f.username}` }];
    if (f.online && f.roomCode) actions.push({ action: 'join', label: 'Join', roomCode: f.roomCode });
    if (currentRoomCode && !(f.online && f.roomCode === currentRoomCode)) actions.push({ action: 'invite', label: '📨', title: `Invite ${f.username} to this room` });
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
    if (btn.dataset.action === 'dm') {
      openFriendDm(btn.dataset.username);
      return;
    }
    if (btn.dataset.action === 'invite') {
      inviteFriendHere(btn.dataset.username);
      btn.disabled = true;
      btn.textContent = '✓';
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
  if (target) openFriendDm(target);
});

function lastMessageAt(container, ownOnly) {
  const els = container.querySelectorAll(ownOnly ? '.thread-message.own' : '.thread-message');
  const last = els[els.length - 1];
  return last ? Number(last.dataset.at) || 0 : 0;
}

function lastMessageIsOwn(container) {
  const els = container.querySelectorAll('.thread-message');
  const last = els[els.length - 1];
  return !!last && last.classList.contains('own');
}

function renderFriendDmStatus() {
  if (friendDmTypingName) {
    friendDmStatusEl.textContent = `${friendDmTypingName} is typing…`;
    return;
  }
  const lastOwn = lastMessageAt(friendDmMessagesEl, true);
  friendDmStatusEl.textContent = lastOwn && lastMessageIsOwn(friendDmMessagesEl) && friendDmOtherReadAt >= lastOwn ? 'Seen ✓' : '';
}

function renderGroupDmStatus() {
  if (groupDmTyping.size) {
    const names = [...groupDmTyping.keys()];
    groupDmStatusEl.textContent = names.length === 1 ? `${names[0]} is typing…` : `${names.slice(0, 3).join(', ')} are typing…`;
    return;
  }
  const lastAt = lastMessageAt(groupDmMessagesEl, false);
  const seenBy = lastAt ? [...groupDmReads].filter(([u, at]) => at >= lastAt && (!accountUsername || u.toLowerCase() !== accountUsername.toLowerCase())).map(([u]) => u) : [];
  groupDmStatusEl.textContent = seenBy.length ? `Seen by ${seenBy.slice(0, 5).join(', ')}${seenBy.length > 5 ? ` +${seenBy.length - 5}` : ''}` : '';
}

function clearFriendDmTyping() {
  clearTimeout(friendDmTypingTimer);
  friendDmTypingName = null;
}

// Saved 1-on-1 chat with a friend: loads the history from the server (which also marks it read).
function openFriendDm(username) {
  if (!username) return;
  if (!accountToken) {
    showAppToast('Sign in to message friends');
    return;
  }
  currentFriendDmUsername = username;
  friendDmTargetName.textContent = username;
  friendDmForm.dataset.username = username;
  friendDmInput.value = '';
  friendDmMessagesEl.innerHTML = '<p class="search-status">Loading…</p>';
  friendDmOtherReadAt = 0;
  clearFriendDmTyping();
  friendDmStatusEl.textContent = '';
  friendDmOverlay.classList.remove('hidden');
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'get-friend-dm-history', withUsername: username }));
  friendDmInput.focus();
}

function closeFriendDm() {
  friendDmOverlay.classList.add('hidden');
  currentFriendDmUsername = null;
  if (!friendsOverlay.classList.contains('hidden')) loadFriends();
}

function isFriendDmOpenWith(username) {
  return !!currentFriendDmUsername && !friendDmOverlay.classList.contains('hidden')
    && !!username && currentFriendDmUsername.toLowerCase() === String(username).toLowerCase();
}

function renderFriendDmMessage(m) {
  const empty = friendDmMessagesEl.querySelector('.search-status');
  if (empty) empty.remove();
  if (m.id && friendDmMessagesEl.querySelector(`[data-dm-id="${CSS.escape(m.id)}"]`)) return;
  const own = !!accountUsername && m.fromUsername && m.fromUsername.toLowerCase() === accountUsername.toLowerCase();
  const el = document.createElement('div');
  el.className = 'thread-message' + (own ? ' own' : '');
  if (m.id) el.dataset.dmId = m.id;
  el.dataset.at = m.at;
  const meta = document.createElement('span');
  meta.className = 'meta';
  const d = new Date(m.at);
  const sameDay = d.toDateString() === new Date().toDateString();
  const when = sameDay ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  meta.textContent = `${own ? 'You' : m.fromUsername || '?'} · ${when}`;
  el.appendChild(meta);
  const text = document.createElement('div');
  text.appendChild(renderTextWithMentions(m.text));
  el.appendChild(text);
  friendDmMessagesEl.appendChild(el);
  friendDmMessagesEl.scrollTop = friendDmMessagesEl.scrollHeight;
  if (!own && friendDmTypingName) clearFriendDmTyping();
  renderFriendDmStatus();
}

friendDmInput.addEventListener('input', () => {
  const to = friendDmForm.dataset.username;
  if (!to || !friendDmInput.value.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
  if (Date.now() - lastFriendDmTypingSentAt < 2500) return;
  lastFriendDmTypingSentAt = Date.now();
  ws.send(JSON.stringify({ type: 'friend-dm-typing', toUsername: to }));
});

friendDmCloseBtn.addEventListener('click', closeFriendDm);
friendDmOverlay.addEventListener('click', (e) => {
  if (e.target === friendDmOverlay) closeFriendDm();
});

friendDmForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const toUsername = friendDmForm.dataset.username;
  const text = friendDmInput.value.trim();
  if (!toUsername || !text) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showAppToast("Not connected — your message wasn't sent.");
    return;
  }
  ws.send(JSON.stringify({ type: 'friend-dm', toUsername, text }));
  friendDmInput.value = '';
  friendDmInput.focus();
});

// --- Private (1:1) call: right-click a name in "Online in this room" for a context menu,
// "Private call" invites just that person — unlike the room-wide voice call button, nobody
// else can join. Reuses .friend-context-menu's positioning logic above almost verbatim. ---
function hideOnlineContextMenu() {
  onlineContextMenu.classList.add('hidden');
  onlineContextTargetName = null;
}

menuOnlineList.addEventListener('contextmenu', (e) => {
  const row = e.target.closest('li[data-username]');
  if (!row) return;
  e.preventDefault();
  onlineContextTargetName = row.dataset.username;
  const menuWidth = 200;
  const left = Math.min(e.clientX, window.innerWidth - menuWidth);
  onlineContextMenu.style.left = `${Math.max(4, left)}px`;
  onlineContextMenu.style.top = `${e.clientY}px`;
  onlineContextMenu.classList.remove('hidden');
});

document.addEventListener('click', (e) => {
  if (!onlineContextMenu.classList.contains('hidden') && !onlineContextMenu.contains(e.target)) {
    hideOnlineContextMenu();
  }
});

privateCallContextBtn.addEventListener('click', () => {
  const target = onlineContextTargetName;
  hideOnlineContextMenu();
  if (!target || !ws || ws.readyState !== WebSocket.OPEN) return;
  if (privateCallId) {
    showAppToast("You're already on a private call.");
    return;
  }
  privateCallRole = 'caller';
  privateCallPeerName = target;
  closeMenu();
  showOutgoingCallPopup(target);
  prefetchTurn();
  ws.send(JSON.stringify({ type: 'private-call-invite', toName: target }));
});

function playRingTone() {
  const ctx = ensureNotifyAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  playNotifyTone(ctx, 740, t, 0.3, 'sine', 0.18);
  playNotifyTone(ctx, 880, t + 0.32, 0.3, 'sine', 0.18);
}

function showIncomingCallPopup(fromName) {
  stopPrivateCallRing();
  privateCallIncomingAvatar.style.background = avatarColor(fromName);
  privateCallIncomingAvatar.textContent = initials(fromName);
  privateCallIncomingTitle.textContent = 'Incoming private call';
  privateCallIncomingSub.textContent = `${fromName} is calling you`;
  privateCallIncomingActions.classList.remove('hidden');
  privateCallOutgoingActions.classList.add('hidden');
  privateCallIncomingOverlay.classList.remove('hidden');
  playRingTone();
  privateCallRingTimer = setInterval(playRingTone, 2500);
  notify(`📞 ${fromName}`, 'Incoming private call');
}

function showOutgoingCallPopup(toName) {
  stopPrivateCallRing();
  privateCallIncomingAvatar.style.background = avatarColor(toName);
  privateCallIncomingAvatar.textContent = initials(toName);
  privateCallIncomingTitle.textContent = 'Calling…';
  privateCallIncomingSub.textContent = toName;
  privateCallIncomingActions.classList.add('hidden');
  privateCallOutgoingActions.classList.remove('hidden');
  privateCallIncomingOverlay.classList.remove('hidden');
}

function hideCallPopup() {
  stopPrivateCallRing();
  privateCallIncomingOverlay.classList.add('hidden');
}

privateCallAcceptBtn.addEventListener('click', () => {
  if (!privateCallId || !ws || ws.readyState !== WebSocket.OPEN) return;
  hideCallPopup();
  prefetchTurn();
  ws.send(JSON.stringify({ type: 'private-call-accept' }));
});

privateCallDeclineBtn.addEventListener('click', () => {
  if (privateCallId && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'private-call-decline' }));
  }
  teardownPrivateCall();
});

privateCallCancelBtn.addEventListener('click', () => {
  // Deliberately not gated on privateCallId being set yet — the server resolves this by ws
  // identity (see its own comment), not by a callId we might not have learned back from
  // private-call-ringing yet if this is clicked in that brief window right after inviting.
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'private-call-cancel' }));
  }
  teardownPrivateCall();
});

async function startPrivateCallMedia() {
  privateCallOverlay.classList.remove('hidden');
  privateCallPeerNameEl.textContent = privateCallPeerName;
  privateCallErrorEl.classList.add('hidden');
  privateCallMicRetryBtn.classList.add('hidden');
  privateCallGrid.innerHTML = '';
  const meTile = document.createElement('div');
  meTile.className = 'call-tile';
  meTile.id = 'private-call-tile-me';
  const meAvatar = document.createElement('div');
  meAvatar.className = 'call-tile-avatar';
  meAvatar.style.background = avatarColor(myProfile.name);
  meAvatar.textContent = initials(myProfile.name);
  const meLabel = document.createElement('span');
  meLabel.className = 'call-tile-name';
  meLabel.textContent = 'You';
  meTile.append(meAvatar, meLabel);
  const peerTile = document.createElement('div');
  peerTile.className = 'call-tile';
  peerTile.id = 'private-call-tile-peer';
  const peerAvatar = document.createElement('div');
  peerAvatar.className = 'call-tile-avatar';
  peerAvatar.style.background = avatarColor(privateCallPeerName);
  peerAvatar.textContent = initials(privateCallPeerName);
  const peerLabel = document.createElement('span');
  peerLabel.className = 'call-tile-name';
  peerLabel.textContent = privateCallPeerName;
  peerTile.append(peerAvatar, peerLabel);
  privateCallGrid.append(meTile, peerTile);

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      privateCallLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      privateCallLocalStream = null;
      privateCallErrorEl.textContent = micErrorMessage(err);
      privateCallErrorEl.classList.remove('hidden');
      privateCallMicRetryBtn.classList.remove('hidden');
    }
  } else {
    privateCallLocalStream = null;
  }
  // The invite/accept exchange (and any WS drop/reconnect in between) can outrace the mic
  // permission prompt — abandon a stale attempt exactly like startVoiceCall does.
  if (!privateCallId) {
    if (privateCallLocalStream) privateCallLocalStream.getTracks().forEach((t) => t.stop());
    privateCallLocalStream = null;
    return;
  }
  if (privateCallLocalStream) {
    privateCallLocalStopDetector = attachSpeakingDetector(privateCallLocalStream, (speaking) => {
      meTile.classList.toggle('speaking', speaking);
    });
  }
  updatePrivateCallMuteButton();
  createPrivatePeerConnection();
  if (privateCallRole === 'caller') await makePrivateCallOffer();
}

function updatePrivateCallMuteButton() {
  const track = privateCallLocalStream && privateCallLocalStream.getAudioTracks()[0];
  privateCallMuteBtn.classList.toggle('hidden', !track);
  if (!track) return;
  track.enabled = true;
  privateCallMuteBtn.classList.remove('active');
  document.getElementById('private-call-mute-icon').textContent = '🎤';
  privateCallMuteBtn.querySelector('.call-action-label').textContent = ' Mute';
}

privateCallMuteBtn.addEventListener('click', () => {
  const track = privateCallLocalStream && privateCallLocalStream.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  privateCallMuteBtn.classList.toggle('active', !track.enabled);
  document.getElementById('private-call-mute-icon').textContent = track.enabled ? '🎤' : '🔇';
  privateCallMuteBtn.querySelector('.call-action-label').textContent = track.enabled ? ' Mute' : ' Unmute';
});

privateCallMicRetryBtn.addEventListener('click', async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  try {
    privateCallLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    privateCallErrorEl.classList.add('hidden');
    privateCallMicRetryBtn.classList.add('hidden');
    if (privateCallPc) {
      privateCallLocalStream.getTracks().forEach((t) => privateCallPc.addTrack(t, privateCallLocalStream));
      if (privateCallRole === 'caller') await makePrivateCallOffer();
    }
    updatePrivateCallMuteButton();
  } catch (err) {
    privateCallErrorEl.textContent = micErrorMessage(err);
    privateCallErrorEl.classList.remove('hidden');
  }
});

function createPrivatePeerConnection() {
  const pc = new RTCPeerConnection({ iceServers: callIceServers() });
  if (privateCallLocalStream) {
    privateCallLocalStream.getTracks().forEach((track) => pc.addTrack(track, privateCallLocalStream));
  } else {
    pc.addTransceiver('audio', { direction: 'recvonly' });
  }
  pc.addEventListener('icecandidate', (e) => {
    if (e.candidate && privateCallId && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'private-call-signal', callId: privateCallId, signal: { type: 'ice', candidate: e.candidate } }));
    }
  });
  pc.addEventListener('iceconnectionstatechange', () => {
    if (pc.iceConnectionState === 'failed') {
      showAppToast(`📵 Lost connection to ${privateCallPeerName || 'the call'}`);
      teardownPrivateCall();
      return;
    }
    const tile = document.getElementById('private-call-tile-peer');
    if (tile) tile.classList.toggle('reconnecting', pc.iceConnectionState === 'disconnected');
  });
  pc.addEventListener('track', (e) => {
    if (!privateCallAudioEl) {
      privateCallAudioEl = document.createElement('audio');
      privateCallAudioEl.autoplay = true;
      privateCallAudioEl.playsInline = true;
      document.body.appendChild(privateCallAudioEl);
    }
    privateCallAudioEl.srcObject = e.streams[0];
    if (privateCallStopDetector) privateCallStopDetector();
    privateCallStopDetector = attachSpeakingDetector(e.streams[0], (speaking) => {
      const tile = document.getElementById('private-call-tile-peer');
      if (tile) tile.classList.toggle('speaking', speaking);
    });
  });
  privateCallPc = pc;
  return pc;
}

async function makePrivateCallOffer() {
  if (!privateCallPc || !privateCallId) return;
  try {
    const offer = await privateCallPc.createOffer();
    await privateCallPc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'private-call-signal', callId: privateCallId, signal: { type: 'offer', sdp: privateCallPc.localDescription } }));
  } catch (err) {
    reportClientError('makePrivateCallOffer failed: ' + err.message, err.stack);
  }
}

async function handlePrivateCallSignal(signal) {
  if (!privateCallPc) return;
  try {
    if (signal.type === 'offer') {
      await privateCallPc.setRemoteDescription(signal.sdp);
      const answer = await privateCallPc.createAnswer();
      await privateCallPc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'private-call-signal', callId: privateCallId, signal: { type: 'answer', sdp: privateCallPc.localDescription } }));
    } else if (signal.type === 'answer') {
      await privateCallPc.setRemoteDescription(signal.sdp);
    } else if (signal.type === 'ice') {
      await privateCallPc.addIceCandidate(signal.candidate);
    }
  } catch (err) {
    reportClientError('handlePrivateCallSignal failed: ' + err.message, err.stack);
  }
}

function teardownPrivateCall() {
  hideCallPopup();
  privateCallOverlay.classList.add('hidden');
  if (privateCallPc) {
    privateCallPc.close();
    privateCallPc = null;
  }
  if (privateCallLocalStream) {
    privateCallLocalStream.getTracks().forEach((t) => t.stop());
    privateCallLocalStream = null;
  }
  if (privateCallLocalStopDetector) {
    privateCallLocalStopDetector();
    privateCallLocalStopDetector = null;
  }
  if (privateCallStopDetector) {
    privateCallStopDetector();
    privateCallStopDetector = null;
  }
  if (privateCallAudioEl) {
    privateCallAudioEl.remove();
    privateCallAudioEl = null;
  }
  privateCallId = null;
  privateCallRole = null;
  privateCallPeerName = null;
}

privateCallHangupBtn.addEventListener('click', () => {
  if (privateCallId && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'private-call-hangup' }));
  }
  teardownPrivateCall();
});

// --- Group DMs: persisted multi-person threads among friends, account-based (works across
// rooms/devices, unlike the room-scoped 1:1 dm-overlay above). ---
let currentGroupDmId = null;
let currentGroupDmMemberNames = [];
let lastLoadedFriends = [];
let lastLoadedThreads = [];
// Found by the group-DM creation-flow audit: set right before sending create-group-dm, cleared
// once its response (success or error) is handled — lets the 'group-dm-created' handler tell
// "this is my own just-submitted create finishing" apart from "a friend created a DIFFERENT
// group DM and added me," which fires the identical event type on this same connection.
let pendingGroupDmCreate = false;

function renderGroupDmMessage(data) {
  const el = document.createElement('div');
  el.className = 'thread-message' + (myProfile && data.fromName === myProfile.name ? ' own' : '');
  el.dataset.at = data.at;
  // A message from someone means they've stopped typing.
  if (data.fromName && groupDmTyping.has(data.fromName)) {
    clearTimeout(groupDmTyping.get(data.fromName));
    groupDmTyping.delete(data.fromName);
  }
  const meta = document.createElement('span');
  meta.className = 'meta';
  const time = new Date(data.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  meta.textContent = `${data.fromName} · ${time}`;
  el.appendChild(meta);
  const text = document.createElement('div');
  text.appendChild(renderTextWithMentions(data.text));
  el.appendChild(text);
  groupDmMessagesEl.appendChild(el);
  renderGroupDmStatus();
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
  groupDmReads = new Map();
  for (const t of groupDmTyping.values()) clearTimeout(t);
  groupDmTyping.clear();
  groupDmStatusEl.textContent = '';
  currentGroupDmMemberNames = thread ? thread.members.map((m) => m.username) : [];
  groupDmTitleEl.textContent = thread ? groupThreadLabel(thread) : 'Group';
  groupDmMembersEl.textContent = currentGroupDmMemberNames.length ? `With ${currentGroupDmMemberNames.join(', ')}` : '';
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
  // Found by the group-DM creation audit: the picker had no way to narrow down a long friend
  // list at all — plain checkboxes, no search, real friction once someone has more than a
  // handful of friends. Only shown once there's actually enough friends for it to matter.
  groupFriendFilter.value = '';
  groupFriendFilter.classList.toggle('hidden', lastLoadedFriends.length <= 8);
  filterGroupFriendPicker();
}

function filterGroupFriendPicker() {
  const q = groupFriendFilter.value.trim().toLowerCase();
  groupFriendPicker.querySelectorAll('.friend-row').forEach((li) => {
    const name = li.querySelector('input[type="checkbox"]').value.toLowerCase();
    li.classList.toggle('hidden', q.length > 0 && !name.includes(q));
  });
}
groupFriendFilter.addEventListener('input', filterGroupFriendPicker);

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
  // Guards against a stale flag from a previous submission that never got a response (panel
  // closed and reopened mid-flight) wrongly auto-opening/closing the form for an unrelated later
  // group-dm-created event.
  pendingGroupDmCreate = false;
  if (!groupNewForm.classList.contains('hidden')) {
    // Friends list is fetched fresh each time the composer opens rather than trusting whatever
    // was last rendered into the friends overlay (which may never have been opened this session).
    try {
      const res = await fetch('/friends', { headers: { Authorization: `Bearer ${accountToken}` } });
      // Unlike a network failure, a non-2xx response (e.g. an expired accountToken) doesn't throw
      // — without this check it silently fell through to an empty picker with no visible error,
      // instead of the message the catch block below is meant to show.
      if (!res.ok) throw new Error('friends fetch failed');
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
  // Found by the group-DM creation-flow audit: the server silently truncates to 20 members
  // (memberUsernames.slice(0, 20)) with no indication anyone was dropped — the creator would
  // only discover it later by noticing who's missing from the member list. Caught here instead,
  // before ever sending, so nothing is silently dropped.
  if (memberUsernames.length > 20) {
    groupNewError.textContent = `Group DMs support at most 20 members — you picked ${memberUsernames.length}, deselect ${memberUsernames.length - 20} to continue`;
    groupNewError.classList.remove('hidden');
    return;
  }
  // Found by the group-DM creation-flow audit: nothing checked for an already-existing group
  // with this exact member set — clicking Create twice (or just forgetting a group already
  // exists) silently made a second, functionally-identical thread with no warning either time.
  const pickedSet = new Set(memberUsernames);
  const existing = lastLoadedThreads.find((t) => {
    const others = t.members.map((m) => m.username).filter((u) => u !== accountUsername);
    return others.length === pickedSet.size && others.every((u) => pickedSet.has(u));
  });
  if (existing && !confirm(`You already have a group DM with exactly these members${existing.name ? ` ("${existing.name}")` : ''}. Create another one anyway?`)) {
    return;
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'create-group-dm', name: groupNameInput.value.trim(), memberUsernames }));
  // Found by the group-DM creation-flow audit: this used to hide the form and clear the name
  // field immediately on send, before the server had actually confirmed anything — a rejection
  // (a friend removed in the meantime, the rate limit, etc.) still landed as an 'error' toast a
  // moment later, but by then every picked checkbox was already gone, forcing a full re-pick from
  // a freshly-refetched friends list. The form now only closes once 'group-dm-created' actually
  // confirms success (see that handler, gated on pendingGroupDmCreate below); on an error it just
  // stays open exactly as the user left it, nothing lost.
  pendingGroupDmCreate = true;
});

groupDmCloseBtn.addEventListener('click', () => { groupDmOverlay.classList.add('hidden'); currentGroupDmId = null; });
// The server's leave-group-dm/group-dm-left round trip already existed — this was the only piece
// missing, no way to actually reach it from the UI (the panel only ever had a close button).
groupDmLeaveBtn.addEventListener('click', () => {
  if (!currentGroupDmId || !ws || ws.readyState !== WebSocket.OPEN) return;
  if (!confirm('Leave this group DM? You can only rejoin if someone adds you back.')) return;
  ws.send(JSON.stringify({ type: 'leave-group-dm', groupId: currentGroupDmId }));
});
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

function formatEventTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
}

function amGoing(ev) {
  return !!myProfile && ev.going.includes(myProfile.name);
}

function rsvpEvent(ev, going) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showAppToast('Not connected — try again in a moment.');
    return;
  }
  ws.send(JSON.stringify({ type: 'rsvp-event', id: ev.id, going }));
}

function setRoomEvents(list) {
  roomEvents = list;
  // Banner: the next event that hasn't started more than an hour ago, if it's within a week.
  const now = Date.now();
  const next = roomEvents.find((e) => e.startsAt > now - 60 * 60 * 1000 && e.startsAt < now + 7 * 24 * 60 * 60 * 1000);
  if (next) {
    const started = next.startsAt <= now;
    eventBannerOpen.textContent = `📅 ${next.title} · ${started ? 'happening now' : formatEventTime(next.startsAt)} · ${next.going.length} going`;
    eventBannerRsvp.textContent = amGoing(next) ? 'Going ✓' : "I'm going";
    eventBannerRsvp.onclick = () => rsvpEvent(next, !amGoing(next));
    eventBanner.classList.remove('hidden');
  } else {
    eventBanner.classList.add('hidden');
  }
  if (!eventsOverlay.classList.contains('hidden')) renderEventsList();
}

function renderEventsList() {
  eventsListEl.innerHTML = '';
  if (!roomEvents.length) {
    const li = document.createElement('li');
    li.className = 'search-status';
    li.textContent = 'No events scheduled yet.';
    eventsListEl.appendChild(li);
    return;
  }
  for (const ev of roomEvents) {
    const li = document.createElement('li');
    const title = document.createElement('div');
    title.className = 'event-title';
    title.textContent = ev.title;
    const when = document.createElement('div');
    when.className = 'event-when';
    when.textContent = `${ev.startsAt <= Date.now() ? 'Started ' : ''}${formatEventTime(ev.startsAt)} · by ${ev.createdBy}`;
    li.append(title, when);
    if (ev.description) {
      const desc = document.createElement('div');
      desc.className = 'event-desc';
      desc.textContent = ev.description;
      li.appendChild(desc);
    }
    const going = document.createElement('div');
    going.className = 'event-going';
    going.textContent = ev.going.length ? `Going (${ev.going.length}): ${ev.going.join(', ')}` : 'Nobody going yet';
    li.appendChild(going);
    const actions = document.createElement('div');
    actions.className = 'event-actions';
    const rsvpBtn = document.createElement('button');
    rsvpBtn.type = 'button';
    rsvpBtn.className = 'small-btn';
    rsvpBtn.textContent = amGoing(ev) ? 'Going ✓ (tap to cancel)' : "I'm going";
    rsvpBtn.addEventListener('click', () => rsvpEvent(ev, !amGoing(ev)));
    actions.appendChild(rsvpBtn);
    if (isMod() || (myProfile && ev.createdBy === myProfile.name)) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'small-btn danger';
      del.textContent = 'Cancel event';
      del.addEventListener('click', () => {
        if (!confirm(`Cancel "${ev.title}"?`)) return;
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'delete-event', id: ev.id }));
      });
      actions.appendChild(del);
    }
    li.appendChild(actions);
    eventsListEl.appendChild(li);
  }
}

function openEventsPanel() {
  closeMenu();
  renderEventsList();
  if (!eventTimeInput.value) {
    // Default: the next whole hour, in local time.
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    eventTimeInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  eventsOverlay.classList.remove('hidden');
}

eventsBtn.addEventListener('click', openEventsPanel);
eventBannerOpen.addEventListener('click', openEventsPanel);
eventsCloseBtn.addEventListener('click', () => eventsOverlay.classList.add('hidden'));
eventsOverlay.addEventListener('click', (e) => {
  if (e.target === eventsOverlay) eventsOverlay.classList.add('hidden');
});

eventCreateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = eventTitleInput.value.trim();
  const startsAt = new Date(eventTimeInput.value).getTime();
  if (!title || !Number.isFinite(startsAt)) return;
  if (startsAt < Date.now() - 60 * 1000) {
    showAppToast('Pick a time in the future');
    return;
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showAppToast("Not connected — the event wasn't scheduled.");
    return;
  }
  ws.send(JSON.stringify({ type: 'create-event', title, description: eventDescInput.value.trim(), startsAt }));
  eventTitleInput.value = '';
  eventDescInput.value = '';
  eventTimeInput.value = '';
  showAppToast('📅 Event scheduled');
});

let pendingDisappearNotice = 0;
disappearSelect.addEventListener('change', () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const seconds = Number(disappearSelect.value);
  if (seconds && !confirm(`Turn on disappearing messages? Messages older than ${DISAPPEAR_LABELS[seconds]} will be deleted for everyone, starting now.`)) {
    disappearSelect.value = '0';
    return;
  }
  ws.send(JSON.stringify({ type: 'set-disappearing', seconds }));
});

function applyWordFilterSettings(f) {
  wordFilterDefault.checked = !!f.useDefault;
  wordFilterWords.value = Array.isArray(f.words) ? f.words.join(', ') : '';
}

wordFilterToggleBtn.addEventListener('click', () => wordFilterForm.classList.toggle('hidden'));
wordFilterForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const words = wordFilterWords.value.split(/[,\n]/).map((w) => w.trim()).filter(Boolean);
  ws.send(JSON.stringify({ type: 'set-word-filter', useDefault: wordFilterDefault.checked, words }));
});

function setRoomEmojis(list) {
  roomEmojis = new Map(list.map((e) => [e.name, e.url]));
  renderRoomEmojiPicker();
  roomEmojisList.innerHTML = '';
  for (const [name, url] of roomEmojis) {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.className = 'custom-emoji';
    img.src = url;
    img.alt = '';
    const label = document.createElement('span');
    label.textContent = `:${name}:`;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'small-btn danger';
    del.textContent = 'Remove';
    del.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'remove-room-emoji', name }));
    });
    li.append(img, label, del);
    roomEmojisList.appendChild(li);
  }
}

// Room emojis sit at the top of the 🙂 sticker picker; tapping one types :name: into the message box.
function renderRoomEmojiPicker() {
  if (!stickerPicker) return;
  stickerPicker.querySelectorAll('.room-emoji-picker-heading, .room-emoji-option').forEach((el) => el.remove());
  if (!roomEmojis.size) return;
  const first = stickerPicker.firstChild;
  const heading = document.createElement('p');
  heading.className = 'room-emoji-picker-heading';
  heading.textContent = 'Room emojis';
  stickerPicker.insertBefore(heading, first);
  for (const name of roomEmojis.keys()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sticker-option room-emoji-option';
    btn.title = `:${name}:`;
    btn.appendChild(makeCustomEmojiImg(name));
    btn.addEventListener('click', () => {
      const v = messageInput.value;
      messageInput.value = `${v}${v && !v.endsWith(' ') ? ' ' : ''}:${name}: `;
      stickerPicker.classList.add('hidden');
      messageInput.focus();
    });
    stickerPicker.insertBefore(btn, first);
  }
  const stickersHeading = document.createElement('p');
  stickersHeading.className = 'room-emoji-picker-heading';
  stickersHeading.textContent = 'Stickers';
  stickerPicker.insertBefore(stickersHeading, first);
}

roomEmojisToggleBtn.addEventListener('click', () => roomEmojisManager.classList.toggle('hidden'));

roomEmojiAddForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = roomEmojiNameInput.value.trim().toLowerCase().replace(/^:|:$/g, '');
  const file = roomEmojiFileInput.files[0];
  if (!/^[a-z0-9_]{2,20}$/.test(name)) {
    showAppToast('Emoji names are 2-20 letters, numbers or _ (like party_cat)');
    return;
  }
  if (!file) return;
  if (file.size > 512 * 1024) {
    showAppToast('That image is too big for an emoji (max 512 KB)');
    return;
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showAppToast("Not connected — the emoji wasn't added.");
    return;
  }
  const submitBtn = roomEmojiAddForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    ws.send(JSON.stringify({ type: 'add-room-emoji', name, url: data.url }));
    roomEmojiNameInput.value = '';
    roomEmojiFileInput.value = '';
  } catch (err) {
    showAppToast(err.message || 'Upload failed');
  } finally {
    submitBtn.disabled = false;
  }
});

slowModeSelect.addEventListener('change', () => {
  if (!currentRoomCode || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'set-slow-mode', seconds: Number(slowModeSelect.value) }));
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
// Video wallpapers (Power Creator/Studio) play in a muted looping <video> layered behind the
// message list; GIFs work as a normal background-image.
const WALLPAPER_VIDEO_RE = /\.(mp4|webm|mov|ogv)$/i;
let wallpaperVideo = null;
function positionWallpaperVideo() {
  if (!wallpaperVideo) return;
  const parent = messagesEl.parentElement;
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
  Object.assign(wallpaperVideo.style, {
    top: `${messagesEl.offsetTop}px`,
    left: `${messagesEl.offsetLeft}px`,
    width: `${messagesEl.offsetWidth}px`,
    height: `${messagesEl.offsetHeight}px`,
  });
}
if (window.ResizeObserver) new ResizeObserver(positionWallpaperVideo).observe(messagesEl);
function applyWallpaper(url) {
  if (wallpaperVideo) { wallpaperVideo.remove(); wallpaperVideo = null; }
  messagesEl.classList.remove('has-video-wallpaper');
  if (url && WALLPAPER_VIDEO_RE.test(url)) {
    wallpaperVideo = document.createElement('video');
    wallpaperVideo.className = 'wallpaper-video';
    Object.assign(wallpaperVideo, { src: url, muted: true, loop: true, autoplay: true, playsInline: true });
    wallpaperVideo.setAttribute('aria-hidden', 'true');
    messagesEl.parentElement.insertBefore(wallpaperVideo, messagesEl);
    messagesEl.classList.add('has-video-wallpaper');
    positionWallpaperVideo();
    messagesEl.style.backgroundImage = '';
    wallpaperVideo.play().catch(() => {});
  } else if (url) {
    messagesEl.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url("${url}")`;
    messagesEl.style.backgroundSize = 'cover';
    messagesEl.style.backgroundPosition = 'center';
  } else {
    messagesEl.style.backgroundImage = '';
  }
  wallpaperClearBtn.classList.toggle('hidden', !url);
}

wallpaperSetBtn.addEventListener('click', () => wallpaperFileInput.click());

// Mirrors the server's own real limits (server.js's shared multer `upload` instance) — not a
// security boundary (the server still enforces both for real), just gets the user a same-second
// answer instead of waiting on a whole upload for something that was always going to be rejected.
const WALLPAPER_MAX_BYTES = 300 * 1024 * 1024;

wallpaperFileInput.addEventListener('change', async () => {
  const file = wallpaperFileInput.files[0];
  wallpaperFileInput.value = '';
  if (!file || !ws || ws.readyState !== WebSocket.OPEN) return;
  // Found by the room-settings/menu-panel correctness audit: a rejected upload (wrong type, over
  // the size cap) was completely silent — no toast, no error, the host had no way to tell whether
  // their click had registered, was still uploading, or had failed. `accept="image/*"` on the file
  // input is only a picker HINT, not enforcement (many OS pickers let it be bypassed), so this
  // client-side check is the first real gate, not just the server's.
  const animatedOk = !!(myPremium && myPremium.perks && myPremium.perks.animatedWallpaper);
  const isVideo = file.type.startsWith('video/');
  if (!file.type.startsWith('image/') && !(isVideo && animatedOk)) {
    showAppToast(isVideo ? '⭐ Video wallpapers come with Power Creator and Studio' : 'Wallpaper must be an image file');
    return;
  }
  if (!animatedOk && file.type === 'image/gif') {
    showAppToast('⭐ Animated GIF wallpapers come with Power Creator and Studio');
    return;
  }
  if (file.size > WALLPAPER_MAX_BYTES) {
    showAppToast('That image is too large (300MB max)');
    return;
  }
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || 'Wallpaper upload failed');
      return;
    }
    ws.send(JSON.stringify({ type: 'set-wallpaper', url: data.url }));
  } catch {
    showAppToast('Wallpaper upload failed');
  }
});

// Power Creator/Studio hosts: download the whole room (transcript + media) as a .zip.
roomExportBtn.addEventListener('click', async () => {
  if (!currentRoomCode) return;
  if (!accountToken) { showAppToast('Sign in to an account to export rooms'); return; }
  if (!(myPremium && myPremium.perks && myPremium.perks.roomExport)) {
    showAppToast('⭐ Room export comes with Power Creator and Studio');
    return;
  }
  roomExportBtn.disabled = true;
  showAppToast('📦 Preparing your export…');
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(currentRoomCode)}/export`, { headers: { Authorization: `Bearer ${accountToken}` } });
    if (!res.ok) {
      let msg = 'Export failed';
      try { msg = (await res.json()).error || msg; } catch {}
      showAppToast(msg);
      return;
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `valk-room-${currentRoomCode}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  } catch {
    showAppToast('Export failed — check your connection');
  } finally {
    roomExportBtn.disabled = false;
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

// Found by the profile-editing client-side audit: mirrors the same fix an earlier dimension
// already applied to wallpaper uploads (see its own comment) — a rejected/failed avatar upload
// used to be completely silent (a bare `return` on a non-2xx response, console-only on a network
// error), giving zero indication the click had registered, was still working, or had failed.
const AVATAR_MAX_BYTES = 300 * 1024 * 1024;

// Same disabled-during-upload guard the message-attach button already uses (attachBtn.disabled) —
// without it, reopening the picker and choosing a second file before the first upload's fetch
// resolved raced two independent uploads against each other, and whichever fetch happened to
// resolve last silently won as the final avatar, regardless of which was actually picked more
// recently/intentionally. disabled also gives real visual feedback, not just a silent no-op click.
myAvatarBtn.addEventListener('click', () => {
  if (myAvatarBtn.disabled) return;
  avatarFileInput.click();
});

avatarFileInput.addEventListener('change', async () => {
  const file = avatarFileInput.files[0];
  avatarFileInput.value = '';
  if (!file || !ws || ws.readyState !== WebSocket.OPEN) return;
  if (!file.type.startsWith('image/')) {
    showAppToast('Avatar must be an image file');
    return;
  }
  if (file.size > AVATAR_MAX_BYTES) {
    showAppToast('That image is too large (300MB max)');
    return;
  }
  myAvatarBtn.disabled = true;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      showAppToast(data.error || 'Avatar upload failed');
      return;
    }
    ws.send(JSON.stringify({ type: 'set-avatar', avatarUrl: data.url }));
  } catch {
    showAppToast('Avatar upload failed');
  } finally {
    myAvatarBtn.disabled = false;
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
let pendingNameUpdate = false;
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
  pendingNameUpdate = true;
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
    // A throw here previously aborted the rest of this handler too — the account would already
    // be renamed server-side, but the UI would show a raw storage error instead of confirming it.
    try { localStorage.setItem(ACCOUNT_USERNAME_KEY, accountUsername); } catch {}
    accountSignedInName.textContent = accountUsername;
    accountUsernameForm.classList.add('hidden');
    showAppToast(`✏️ Username changed to ${accountUsername}`);
  } catch (err) {
    accountUsernameError.textContent = err.message;
    accountUsernameError.classList.remove('hidden');
  }
});

accountPasswordToggleBtn.addEventListener('click', () => {
  accountPasswordError.classList.add('hidden');
  accountPasswordForm.classList.toggle('hidden');
  if (!accountPasswordForm.classList.contains('hidden')) {
    accountPasswordCurrentInput.value = '';
    accountPasswordNewInput.value = '';
    accountPasswordCurrentInput.focus();
  }
});

accountPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  accountPasswordError.classList.add('hidden');
  const currentPassword = accountPasswordCurrentInput.value;
  const newPassword = accountPasswordNewInput.value;
  if (!currentPassword || !newPassword || !accountToken) return;
  try {
    const res = await fetch('/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    // The server invalidated every other session for this account and minted a fresh token for
    // this one — swap to it so this tab stays signed in seamlessly instead of getting logged out
    // by its own password change.
    accountToken = data.token;
    try { localStorage.setItem(ACCOUNT_TOKEN_KEY, accountToken); } catch {}
    accountPasswordForm.classList.add('hidden');
    accountPasswordCurrentInput.value = '';
    accountPasswordNewInput.value = '';
    showAppToast('🔒 Password changed — you\'ve been signed out everywhere else');
  } catch (err) {
    accountPasswordError.textContent = err.message;
    accountPasswordError.classList.remove('hidden');
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
  const turnReady = prefetchTurn(); // runs alongside the mic prompt

  // A microphone is optional — if it's missing, blocked, or unsupported, we still
  // join so the person can listen; we just send no audio track of our own.
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      rawMicStream = localStream; // a fresh call always starts with no effect applied (see hangUpVoiceCall)
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
  await turnReady;
  if (myCallGeneration !== voiceCallGeneration) {
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
    rawMicStream = null;
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
  // Same visibility condition as the mute button — a voice effect only makes sense once
  // there's an actual outgoing mic track to process (matches this stream's own track being
  // whatever the effect chain currently outputs, see applyVoiceEffect).
  voiceEffectSelect.classList.toggle('hidden', !track);
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
// pointercancel — an OS/browser gesture takeover mid-press (e.g. a touch edge-swipe) — is
// distinct from pointerleave: it can fire while the pointer is still physically over the button,
// so pointerleave never catches it. Without this, that specific interruption left the mic
// permanently unmuted (pttActive stuck true) with no further pointer event ever able to stop it
// short of toggling push-to-talk mode off and back on. Same bug class just fixed in
// videoeditor.js's drag handlers, found by checking for the same gap elsewhere in the app.
pttBtn.addEventListener('pointercancel', pttStop);

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
  [eventsOverlay, eventsCloseBtn],
];
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const [overlay, closeBtn] of ESCAPE_CLOSABLE) {
    if (overlay && closeBtn && !overlay.classList.contains('hidden')) closeBtn.click();
  }
  // Found by the sticker-picker audit: every other overlay/panel in this app closes on Escape via
  // ESCAPE_CLOSABLE above, but stickerPicker has no dedicated close button for that list to drive
  // (it's a bare toggled div, not a full overlay) — toggled directly here instead.
  if (stickerPicker && !stickerPicker.classList.contains('hidden')) stickerPicker.classList.add('hidden');
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
  // Found by the voice-call client-side audit: the receiving side gets a clear forced-expand
  // notice, but the sender previously had zero feedback either way — indistinguishable from a
  // silently rate-limit-dropped request (server.js drops this WS-flood-gated like everything
  // else). A toast here doesn't confirm delivery, but at least confirms the click registered.
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'mute-all-request' }));
    showAppToast('Asked everyone on the call to mute.');
  }
});

function setTileHandRaised(sub, raised) {
  const tile = document.getElementById(`call-tile-${sub}`);
  if (tile) tile.classList.toggle('hand-raised', raised);
}

// --- Call recording (client-side, audio-only) ---
// Mixes the local mic and every remote peer's incoming audio into one MediaRecorder via
// a shared AudioContext — recording never touches the server, it's a pure local download.
// Mixes one more remote peer's stream into the in-progress recording, if there is one — called
// both from startCallRecording() (for peers already on the call) and from the peer-connection
// 'track' handler (for anyone whose audio arrives, or re-negotiates, after recording began).
// Without this, a call recording silently excluded any peer who joined mid-recording: the
// MediaRecorder graph was only ever wired up once, at the moment Record was clicked.
function addStreamToCallRecording(stream) {
  if (!callRecordCtx || !callRecordDest || !stream || recordedRemoteStreams.has(stream)) return;
  recordedRemoteStreams.add(stream);
  callRecordCtx.createMediaStreamSource(stream).connect(callRecordDest);
}

// Reconnects the current local mic track into an in-progress recording — called after
// startVoiceCall/retryEnableMicrophone/switchMicrophone replace `localStream`. Without this, the
// recording's local-audio source stayed wired to whichever MediaStreamTrack existed at the moment
// Record was clicked; once that track was stopped (mic switch, or the initial permission grant
// happening after Record was already running) the recording lost the local side of the
// conversation for its entire remainder with no indication anything was wrong.
function reconnectLocalTrackToCallRecording() {
  if (!callRecordCtx || !callRecordDest) return;
  const track = localStream && localStream.getAudioTracks()[0];
  if (track) callRecordCtx.createMediaStreamSource(new MediaStream([track])).connect(callRecordDest);
}

function startCallRecording() {
  if (callRecorder || !window.MediaRecorder) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  callRecordCtx = new AudioCtx();
  callRecordDest = callRecordCtx.createMediaStreamDestination();
  recordedRemoteStreams = new Set();

  if (localStream && localStream.getAudioTracks()[0]) {
    callRecordCtx.createMediaStreamSource(new MediaStream([localStream.getAudioTracks()[0]])).connect(callRecordDest);
  }
  for (const peer of voicePeers.values()) {
    if (peer.audioEl && peer.audioEl.srcObject) {
      addStreamToCallRecording(peer.audioEl.srcObject);
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
    recordedRemoteStreams = null;
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
    // Found by the voice-call client-side audit: startVoiceCall's own equivalent catch block
    // expands the call view for this exact reason (see its comment) — this retry path is
    // reachable from the docked pill too (the retry button stays visible there), but was
    // missing the same call, so a still-blocked retry looked like nothing happened at all.
    setCallExpanded(true);
    return;
  }
  if (myCallGeneration !== voiceCallGeneration) {
    newStream.getTracks().forEach((t) => t.stop());
    return;
  }
  rawMicStream = newStream;
  const { stream: outgoing, cleanup } = buildOutgoingStream(newStream, voiceEffect);
  localStream = outgoing;
  voiceEffectCleanup = cleanup;
  voiceErrorEl.classList.add('hidden');
  micRetryBtn.classList.add('hidden');
  localVoiceStop = attachSpeakingDetector(localStream, (speaking) => setTileSpeaking('me', speaking));
  updateMicMuteButton();
  reconnectLocalTrackToCallRecording();

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
  // Reads rawMicStream, not localStream — while a voice effect is active, localStream's track is
  // the effect chain's synthesized output, which has no real device identity to report here.
  const currentTrack = rawMicStream && rawMicStream.getAudioTracks()[0];
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

// Swaps the outgoing track on every peer connection via replaceTrack — no renegotiation
// needed, so switching mid-call doesn't cause a reconnect blip for anyone listening. Shared by
// switchMicrophone and applyVoiceEffect, both of which need to push a freshly-built track (raw
// device audio, or a voice-effect chain's output) out to every current peer the same way.
// Returns true on full success; on a partial failure, some peers may already be on newTrack
// (see the comment below) — the caller decides what to do about that.
async function replaceOutgoingTrackAcrossPeers(newTrack) {
  try {
    for (const [, peer] of voicePeers) {
      const sender = peer.pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
      if (sender) await sender.replaceTrack(newTrack);
    }
    return true;
  } catch (err) {
    // An uncaught throw here (e.g. InvalidStateError on a peer connection that closed mid-switch)
    // would otherwise abort this loop partway through with no trace anywhere. Not stopping
    // newTrack here: by the time this fires, some peers' senders may already have been switched
    // onto it — killing it would silence audio for exactly the connections that *did* succeed,
    // worse than leaving a harmless still-open track around. Surfacing the failure is the goal,
    // not a full rollback.
    reportClientError('replaceOutgoingTrackAcrossPeers failed mid-switch: ' + err.message, err.stack);
    return false;
  }
}

// ---- Voice effects: a small Web Audio processing chain applied to the mic before it's sent to
// every peer. `localStream` (used everywhere else — peer connections for newly-joining peers,
// mute/PTT, recording, the speaking-ring detector) always points at whatever this currently
// outputs; `rawMicStream` is kept separately as the actual device capture so switching effects
// mid-call re-processes the same input instead of re-prompting for microphone permission. ----

// A simple granular pitch shifter: two overlapping "grains" read the recent input at `ratio`
// speed (each periodically jumping back to a fresh spot near real time and crossfading via a
// Hann window to hide the jump, the standard trick for keeping a resampling shifter in sync with
// a live, indefinitely-long input rather than a fixed buffer). Real-time and dependency-free,
// at the cost of a faint granular/robotic texture on top of the pitch shift — acceptable for a
// fun call effect, not aiming for studio-quality pitch correction.
function createGranularPitchShifter(ctx, ratio) {
  const node = ctx.createScriptProcessor(2048, 1, 1);
  const sampleRate = ctx.sampleRate;
  const grainSamples = Math.floor(sampleRate * 0.08); // ~80ms grains
  const ringSize = Math.floor(sampleRate * 0.5); // 500ms of history — plenty of headroom
  const ring = new Float32Array(ringSize);
  let writePos = 0;
  let written = 0;
  const grains = [
    { readPos: 0, phase: 0 },
    { readPos: 0, phase: 0.5 }, // offset half a cycle so one fades in as the other fades out
  ];
  let initialized = false;

  function hann(x) {
    const c = x < 0 ? 0 : x > 1 ? 1 : x;
    return 0.5 - 0.5 * Math.cos(2 * Math.PI * c);
  }
  function readRing(pos) {
    let i = Math.floor(pos) % ringSize;
    if (i < 0) i += ringSize;
    return ring[i];
  }
  function freshGrainStart() {
    // A safety margin behind the write head so a fast-advancing (helium) grain never laps past
    // what's actually been written yet before its next reset.
    return (writePos - grainSamples * 2 + ringSize * 2) % ringSize;
  }

  node.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    const output = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < input.length; i++) {
      ring[writePos] = input[i];
      writePos = (writePos + 1) % ringSize;
      written++;
    }
    if (!initialized && written > grainSamples * 3) {
      const start = freshGrainStart();
      grains[0].readPos = start;
      grains[1].readPos = (start + Math.floor(grainSamples / 2)) % ringSize;
      initialized = true;
    }
    if (!initialized) { output.fill(0); return; }
    for (let i = 0; i < output.length; i++) {
      let sample = 0;
      for (const g of grains) {
        sample += readRing(g.readPos) * hann(g.phase);
        g.readPos += ratio;
        g.phase += 1 / grainSamples;
        if (g.phase >= 1) {
          g.phase -= 1;
          g.readPos = freshGrainStart();
        }
      }
      output[i] = sample; // two 50%-overlapped Hann windows sum to ~1 (constant-overlap-add), no extra gain needed
    }
  };
  return node;
}

// Builds the stream actually sent to peers for a given raw capture + effect choice. 'none' is a
// pure passthrough (the raw stream itself, zero Web Audio overhead) — everything else runs the
// raw track through an AudioContext graph into a fresh MediaStream.
function buildOutgoingStream(rawStream, effect) {
  if (effect === 'none' || !rawStream) return { stream: rawStream, cleanup: () => {} };
  const rawTrack = rawStream.getAudioTracks()[0];
  if (!rawTrack) return { stream: rawStream, cleanup: () => {} };

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return { stream: rawStream, cleanup: () => {} };
  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(rawStream);
  const destination = ctx.createMediaStreamDestination();
  const startedNodes = [];

  if (effect === 'robot') {
    // Ring modulation: multiply the voice by a low-frequency bipolar carrier — the classic cheap,
    // artifact-free "robot" effect. Connecting the oscillator straight into the gain node's own
    // .gain AudioParam modulates that gain between roughly -1 and +1 at the carrier frequency.
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = 35;
    const ringGain = ctx.createGain();
    ringGain.gain.value = 0;
    carrier.connect(ringGain.gain);
    source.connect(ringGain);
    ringGain.connect(destination);
    carrier.start();
    startedNodes.push(carrier);
  } else if (effect === 'deep' || effect === 'helium') {
    const ratio = effect === 'deep' ? 0.7 : 1.5;
    const shifter = createGranularPitchShifter(ctx, ratio);
    source.connect(shifter);
    shifter.connect(destination);
  } else {
    source.connect(destination);
  }

  const outStream = new MediaStream([destination.stream.getAudioTracks()[0]]);
  return {
    stream: outStream,
    cleanup: () => {
      for (const n of startedNodes) { try { n.stop(); } catch { /* already stopped */ } }
      ctx.close().catch(() => {});
    },
  };
}

// Called on selecting a new voice effect mid-call, and internally whenever the raw mic itself
// changes (switchMicrophone) so the currently-selected effect carries over to the new device.
async function applyVoiceEffect(effect) {
  if (!voiceActive || !rawMicStream) { voiceEffect = effect; return; }
  const myCallGeneration = voiceCallGeneration;
  const myOpGen = ++micOpGeneration;
  const { stream: newOutgoing, cleanup: newCleanup } = buildOutgoingStream(rawMicStream, effect);
  const newTrack = newOutgoing.getAudioTracks()[0];
  const oldTrack = localStream && localStream.getAudioTracks()[0];
  if (oldTrack) newTrack.enabled = oldTrack.enabled;

  const ok = await replaceOutgoingTrackAcrossPeers(newTrack);
  // The call may have ended, or a newer switchMicrophone()/applyVoiceEffect() attempt may have
  // already committed its own result, while the await above was in flight — committing this one
  // now would either resurrect a hot mic + AudioContext with no UI left to stop them, or clobber
  // whatever that newer attempt already set up. Either way, just discard this one.
  if (myCallGeneration !== voiceCallGeneration || myOpGen !== micOpGeneration) {
    newCleanup();
    return;
  }
  if (!ok) {
    newCleanup();
    voiceErrorEl.textContent = 'Could not switch voice effects — try again.';
    voiceErrorEl.classList.remove('hidden');
    voiceEffectSelect.value = voiceEffect; // roll the UI back to what's actually still playing
    return;
  }

  if (localVoiceStop) localVoiceStop();
  const oldCleanup = voiceEffectCleanup;
  localStream = newOutgoing;
  voiceEffect = effect;
  voiceEffectCleanup = newCleanup;
  localVoiceStop = attachSpeakingDetector(localStream, (speaking) => setTileSpeaking('me', speaking));
  reconnectLocalTrackToCallRecording();
  if (oldCleanup) oldCleanup(); // torn down last so there's no gap with nothing feeding `destination`
}

voiceEffectSelect.addEventListener('change', () => applyVoiceEffect(voiceEffectSelect.value));

async function switchMicrophone(deviceId) {
  if (!voiceActive || !deviceId) return;
  // Same stale-attempt guard as startVoiceCall()/retryEnableMicrophone() — picking a device
  // right as the call ends would otherwise leave a hot mic track + speaking-detector loop
  // leaked with no UI left to stop them. micOpGeneration additionally guards against this
  // racing a concurrent applyVoiceEffect() attempt (see its own comment).
  const myCallGeneration = voiceCallGeneration;
  const myOpGen = ++micOpGeneration;
  let newRawStream;
  try {
    newRawStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
  } catch (err) {
    voiceErrorEl.textContent = micErrorMessage(err);
    voiceErrorEl.classList.remove('hidden');
    return;
  }
  if (myCallGeneration !== voiceCallGeneration || myOpGen !== micOpGeneration) {
    newRawStream.getTracks().forEach((t) => t.stop());
    return;
  }
  const { stream: newOutgoing, cleanup: newCleanup } = buildOutgoingStream(newRawStream, voiceEffect);
  const newTrack = newOutgoing.getAudioTracks()[0];
  const oldTrack = localStream && localStream.getAudioTracks()[0];
  newTrack.enabled = oldTrack ? oldTrack.enabled : true;

  const ok = await replaceOutgoingTrackAcrossPeers(newTrack);
  // Re-check after this second await too — the first check above only covers a stale/superseded
  // attempt during the getUserMedia prompt; this one covers the same happening during the
  // (usually much faster, but not instant) replaceTrack round-trip that follows it.
  if (myCallGeneration !== voiceCallGeneration || myOpGen !== micOpGeneration) {
    newCleanup();
    newRawStream.getTracks().forEach((t) => t.stop());
    return;
  }
  if (!ok) {
    newCleanup();
    newRawStream.getTracks().forEach((t) => t.stop());
    voiceErrorEl.textContent = 'Could not switch microphones — try again.';
    voiceErrorEl.classList.remove('hidden');
    return;
  }

  if (localVoiceStop) localVoiceStop();
  const oldRawStream = rawMicStream;
  const oldCleanup = voiceEffectCleanup;
  rawMicStream = newRawStream;
  localStream = newOutgoing;
  voiceEffectCleanup = newCleanup;
  localVoiceStop = attachSpeakingDetector(localStream, (speaking) => setTileSpeaking('me', speaking));
  reconnectLocalTrackToCallRecording();
  if (oldCleanup) oldCleanup();
  if (oldRawStream) oldRawStream.getTracks().forEach((t) => t.stop());
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
  voiceEffectSelect.classList.add('hidden');
  voiceEffectSelect.value = 'none';

  stopCallRecording();
  setPttMode(false);
  pttBtn.classList.add('hidden');
  if (handRaised) setHandRaised(false);

  if (screenStream) stopScreenShare();

  if (localVoiceStop) localVoiceStop();
  localVoiceStop = null;
  // localStream and rawMicStream are different MediaStream objects whenever a voice effect was
  // active (localStream is then the effect chain's synthesized output) — both need stopping:
  // localStream's track to stop feeding the (about to be torn down) Web Audio graph, and
  // rawMicStream's track to actually release the microphone hardware, which stopping only the
  // synthesized track never touches.
  if (localStream) localStream.getTracks().forEach((t) => t.stop());
  if (rawMicStream && rawMicStream !== localStream) rawMicStream.getTracks().forEach((t) => t.stop());
  localStream = null;
  rawMicStream = null;
  if (voiceEffectCleanup) voiceEffectCleanup();
  voiceEffectCleanup = null;
  voiceEffect = 'none';

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
  const pc = new RTCPeerConnection({ iceServers: callIceServers() });
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

  // Nothing previously watched connection health at all — a genuine ICE failure for this one
  // peer pair (the WS itself, and every other peer's connection, can stay perfectly fine) left a
  // dead RTCPeerConnection and a permanently frozen call tile with no indication anything was
  // wrong; only a full hangup ever cleared it. 'failed' is the terminal state (unlike
  // 'disconnected', which is often transient and can recover on its own) — tear down just this
  // one peer on it, same as if they'd left, so the rest of the call isn't affected and the user
  // gets an honest signal instead of a tile that looks connected but isn't.
  pc.addEventListener('iceconnectionstatechange', () => {
    if (pc.iceConnectionState === 'failed') {
      const peer = voicePeers.get(sub);
      const name = peer && peer.name;
      removeVoicePeer(sub);
      showAppToast(`📵 Lost connection to ${name || 'a participant'}`);
      return;
    }
    // Found by the voice-call client-side audit: the transient 'disconnected' state (unlike
    // 'failed' above, often recovers on its own within seconds) previously got no UI treatment
    // at all — a stalled tile looked identical to a healthy one the whole time it was stuck.
    const tile = document.getElementById(`call-tile-${sub}`);
    if (tile) tile.classList.toggle('reconnecting', pc.iceConnectionState === 'disconnected');
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
    addStreamToCallRecording(e.streams[0]);
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

  try {
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
  } catch (err) {
    // Same reasoning as makeVoiceOffer's own try/catch: called fire-and-forget from the WS
    // message handler (never awaited), so a thrown error here — a malformed/stale SDP after a
    // fast peer rejoin, addIceCandidate racing a connection that already closed, etc. — would
    // otherwise become a silent unhandled rejection that never reaches this app's own
    // error-reporting pipeline, leaving that peer's audio broken with nothing to explain why.
    reportClientError('handleVoiceSignal failed for ' + from + ' (' + signal.type + '): ' + err.message, err.stack);
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
    // Found by the voice-call client-side audit: every getDisplayMedia() rejection used to be
    // treated identically to a plain cancel, with zero feedback — including a real failure
    // (blocked by OS/browser policy, no capturable source, hardware error). Browsers report a
    // user-cancelled picker as NotAllowedError too, so it can't be told apart from a real
    // permission denial — but AbortError/NotFoundError/NotReadableError/etc. are never just a
    // cancel, so those get the same visible-error treatment micErrorMessage() already gives
    // getUserMedia failures instead of staying silent.
    if (err && err.name !== 'NotAllowedError') {
      voiceErrorEl.textContent = `Couldn't share your screen: ${err.message || err.name || 'unknown error'}.`;
      voiceErrorEl.classList.remove('hidden');
    }
    return;
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
// Found by the landing/room-join-flow correctness audit: Create/Join/recent-room-chip all called
// ws.send(...) unconditionally — during the ~1.5s auto-reconnect window after a drop (connect()'s
// close handler), the socket sits in CONNECTING and .send() throws synchronously and uncaught,
// silently swallowing the click with nothing beyond the connection-banner already up. Same class
// of gap as the message-composer's own not-connected guard, applied here too.
function wsSendOrWarnDisconnected(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showAppToast('Not connected — try again in a moment.');
    return false;
  }
  ws.send(JSON.stringify(payload));
  return true;
}

createRoomBtn.addEventListener('click', () => {
  roomErrorEl.classList.add('hidden');
  pendingJoinPin = '';
  wsSendOrWarnDisconnected({ type: 'create-room' });
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
  wsSendOrWarnDisconnected(payload);
});

// --- Chat ---
// Resolved locally (no server round-trip needed) then sent as a normal chat message, so the
// result persists/broadcasts/exports exactly like anything else typed in the box. Unrecognized
// "/word" text is left alone and sent as-is rather than treated as an error.
// /remind 10m feed the dog · /remind 2 hours homework · /reminders · /reminders clear
// Private to you (never posted in the room); the server holds the reminder so it still arrives
// as a notification if the tab is closed.
const REMIND_UNITS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
function parseRemindCommand(text) {
  const m = text.match(/^\/remind(?:me)?\s+(?:in\s+)?(\d+(?:\.\d+)?)\s*(s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?)\b\s*(?:to\s+)?(.*)$/i);
  if (!m) return null;
  const unit = m[2][0].toLowerCase();
  return { inMs: Math.round(parseFloat(m[1]) * REMIND_UNITS[unit]), text: m[3].trim() || 'Reminder!' };
}

function handleReminderCommand(raw) {
  if (/^\/reminders\s+clear\s*$/i.test(raw)) {
    ws.send(JSON.stringify({ type: 'clear-reminders' }));
    return true;
  }
  if (/^\/reminders\s*$/i.test(raw)) {
    ws.send(JSON.stringify({ type: 'list-reminders' }));
    return true;
  }
  if (/^\/scheduled\s*$/i.test(raw)) {
    ws.send(JSON.stringify({ type: 'list-scheduled' }));
    scheduledModal.classList.remove('hidden');
    return true;
  }
  if (/^\/later\b/i.test(raw)) {
    const r = parseLaterCommand(raw);
    if (!r) {
      showAppToast('Try: /later 30m Happy birthday!  or  /later 6:30pm Game time');
      return true;
    }
    ws.send(JSON.stringify({ type: 'schedule-message', text: r.text, sendAt: r.sendAt }));
    return true;
  }
  if (/^\/remind(me)?\b/i.test(raw)) {
    const r = parseRemindCommand(raw);
    if (!r) {
      showAppToast('Try: /remind 10m feed the dog  (s, m, h or d)');
      return true;
    }
    ws.send(JSON.stringify({ type: 'set-reminder', text: r.text, inMs: r.inMs }));
    return true;
  }
  return false;
}

function formatReminderDue(ts) {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function resolveSlashCommand(text) {
  // /roll, /flip, /8ball, /pick and /me are handled by the server (so dice can't be faked) —
  // they're sent as typed.
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
  if (!raw) return;
  // Found by the room-chat client-side correctness audit: sending while disconnected used to be a
  // silent no-op — the text just stayed in the box with zero indication anything was wrong, easy
  // to mistake for the message having actually gone through. The connection-banner (shown/hidden
  // by the ws close/reconnect handlers) already explains WHY, but a per-attempt toast makes each
  // specific failed send unmissable too.
  if (ws.readyState !== WebSocket.OPEN) {
    // Plain messages wait in an outbox and go out automatically once we're reconnected to this
    // room; commands (/remind, /later, …) still need a live connection.
    if (currentRoomCode && !raw.startsWith('/')) {
      queueOutbox(raw);
      messageInput.value = '';
      saveDraftNow();
      autoGrowComposer();
      clearReplyingTo();
      return;
    }
    showAppToast("Not connected — your message wasn't sent. It'll stay in the box until you're back online.");
    return;
  }
  if (handleReminderCommand(raw)) {
    messageInput.value = '';
    saveDraftNow();
    return;
  }
  const playMatch = raw.match(/^\/play(?:\s+(\S+))?\s*$/i);
  if (playMatch) {
    const wanted = (playMatch[1] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const game = Object.keys(GAME_ALIASES).find((g) => g === wanted || GAME_ALIASES[g].includes(wanted));
    if (!game) {
      showAppToast('Try: /play typerace, /play wordguess, /play chess, /play trivia, /play blockbattle…');
      return;
    }
    ws.send(JSON.stringify({ type: 'game-invite', game }));
    messageInput.value = '';
    saveDraftNow();
    return;
  }
  if (/^\/wyr\s*$/i.test(raw)) {
    const [a, b] = WYR_QUESTIONS[Math.floor(Math.random() * WYR_QUESTIONS.length)];
    ws.send(JSON.stringify({ type: 'message', text: JSON.stringify({ question: 'Would you rather…', options: [a, b] }), mediaUrl: 'poll', mediaType: 'poll' }));
    messageInput.value = '';
    saveDraftNow();
    return;
  }
  if (roomSlowMode && !isMod() && Date.now() < slowModeReadyAt) {
    showAppToast(`🐢 Slow mode — you can send again in ${Math.ceil((slowModeReadyAt - Date.now()) / 1000)}s`);
    return;
  }
  if (roomSlowMode && !isMod()) slowModeReadyAt = Date.now() + roomSlowMode * 1000;
  const text = resolveSlashCommand(raw);
  const payload = { type: 'message', text };
  if (replyingTo) payload.replyTo = replyingTo.id;
  ws.send(JSON.stringify(payload));
  messageInput.value = '';
  saveDraftNow();
  clearReplyingTo();
  // The dropdown could still be showing stale matches from the just-sent text (e.g. the message
  // ended with an unfinished "@al") — previously nothing here hid it, so it stayed visible over
  // the now-empty composer until the next keystroke.
  mentionDropdownEl.classList.add('hidden');
  mentionHighlightIndex = -1;
});

// Selection only ever worked via mouse click before this — there was no keyboard path at all,
// so pressing Enter while the dropdown was open just submitted the literal "@al" text instead of
// picking a match, and Escape didn't close it either.
messageInput.addEventListener('keydown', (e) => {
  if (mentionDropdownEl.classList.contains('hidden')) return;
  const items = [...mentionDropdownEl.children];
  if (!items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightMentionItem(mentionHighlightIndex + 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightMentionItem(mentionHighlightIndex - 1);
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();
    const picked = items[mentionHighlightIndex];
    if (picked && picked.dataset.command) {
      // Enter on an exact, argument-free command (e.g. "/flip") sends it straight away.
      if (e.key === 'Enter' && messageInput.value.trim() === picked.dataset.insert.trim() && !/\s\S/.test(picked.querySelector('code').textContent)) {
        mentionDropdownEl.classList.add('hidden');
        mentionHighlightIndex = -1;
        messageForm.requestSubmit();
        return;
      }
      insertCommandSuggestion(picked.dataset.insert);
      return;
    }
    if (picked && picked.dataset.insert) { insertEmojiSuggestion(picked.dataset.insert); return; }
    const label = picked && picked.querySelector('span');
    if (label) insertMention(label.textContent);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    mentionDropdownEl.classList.add('hidden');
    mentionHighlightIndex = -1;
  }
});

// Enter sends, Shift+Enter adds a new line (the composer is a textarea now so pasted code and
// multi-line messages keep their line breaks). Registered AFTER the @mention keydown handler
// above, which calls preventDefault when Enter picks a mention — so that case is skipped here.
messageInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.defaultPrevented) return;
  // Inside an unfinished ``` block, Enter adds a line instead of sending half the code.
  const before = messageInput.value.slice(0, messageInput.selectionStart);
  if (((before.match(/```/g) || []).length % 2) === 1) return;
  e.preventDefault();
  messageForm.requestSubmit ? messageForm.requestSubmit() : messageForm.dispatchEvent(new Event('submit', { cancelable: true }));
});

function autoGrowComposer() {
  messageInput.style.height = 'auto';
  const h = Math.min(messageInput.scrollHeight + 2, 152);
  messageInput.style.height = h + 'px';
  messageInput.style.overflowY = messageInput.scrollHeight + 2 > 152 ? 'auto' : 'hidden';
}
// Any code path that sets messageInput.value directly (send, edit-cancel, drafts, slash commands)
// doesn't fire 'input', so re-measure on the next frame after a submit too.
messageForm.addEventListener('submit', () => requestAnimationFrame(autoGrowComposer));

messageInput.addEventListener('input', () => {
  autoGrowComposer();
  scheduleDraftSave();
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

// Shared by the 📎 button, pasting an image into the message box, and dragging files onto the chat.
// Text already typed in the message box rides along as the photo's caption (not slash commands).
function takeCaption() {
  const t = messageInput.value.trim();
  if (!t || t.startsWith('/')) return '';
  messageInput.value = '';
  autoGrowComposer();
  saveDraftNow();
  return t.slice(0, 2000);
}

// Phone photos are often 3–8 MB and 4000+ px — far bigger than a chat needs, and slow for
// everyone to load. Anything over 1.5 MB gets resized to at most 2048 px (JPEG, or WebP if it
// might have transparency). GIFs are left alone (re-encoding would kill the animation), and the
// original is kept if shrinking doesn't actually make it smaller.
const SHRINK_OVER_BYTES = 1.5 * 1024 * 1024;
const SHRINK_MAX_DIM = 2048;
async function shrinkImageIfLarge(file) {
  try {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= SHRINK_OVER_BYTES || !window.createImageBitmap) return file;
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, SHRINK_MAX_DIM / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
    const blob = await new Promise((r) => canvas.toBlob(r, type, 0.85));
    if (!blob || blob.size >= file.size) return file;
    const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
    return new File([blob], `${base}${type === 'image/jpeg' ? '.jpg' : '.webp'}`, { type });
  } catch (err) {
    return file; // anything odd (decode failure, old browser) — just send the original
  }
}

async function uploadAndSendFile(file, withCaption = true) {
  if (!file) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showAppToast("Not connected — your file wasn't sent.");
    return;
  }
  if (!/^(image|video)\//.test(file.type)) {
    showAppToast('Only photos and videos can be sent here.');
    return;
  }
  file = await shrinkImageIfLarge(file);
  const formData = new FormData();
  formData.append('file', file, file.name || (file.type.startsWith('video/') ? 'clip.mp4' : 'pasted.png'));
  attachBtn.disabled = true;
  showAppToast(file.type.startsWith('video/') ? '⏫ Uploading video…' : '⏫ Uploading photo…');
  try {
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    // Used to write into roomErrorEl, which lives on the room-select screen — invisible from
    // inside a room, so a failed upload just silently did nothing.
    if (!res.ok) {
      showAppToast(`Upload failed: ${data.error || `error ${res.status}`}`);
      return;
    }
    sendMediaMessage(data.url, data.mediaType, withCaption ? takeCaption() : '');
  } catch {
    showAppToast('Upload failed — check your connection and try again.');
  } finally {
    attachBtn.disabled = false;
  }
}

fileInput.addEventListener('change', async () => {
  const all = [...fileInput.files];
  const files = all.slice(0, 10);
  fileInput.value = '';
  if (all.length > 10) showAppToast('Sending the first 10 photos/videos');
  for (let i = 0; i < files.length; i++) await uploadAndSendFile(files[i], i === 0);
});

// Paste a screenshot/photo straight into the message box.
messageInput.addEventListener('paste', (e) => {
  const items = e.clipboardData ? [...e.clipboardData.items] : [];
  const fileItem = items.find((it) => it.kind === 'file' && /^(image|video)\//.test(it.type));
  if (!fileItem) return; // plain text paste — leave it alone
  e.preventDefault();
  uploadAndSendFile(fileItem.getAsFile());
});

// Drag photos/videos onto the chat to send them.
let dragDepth = 0;
function dragHasFiles(e) { return e.dataTransfer && [...e.dataTransfer.types].includes('Files'); }
chatScreen.addEventListener('dragenter', (e) => {
  if (!dragHasFiles(e)) return;
  e.preventDefault();
  dragDepth++;
  chatScreen.classList.add('drag-over');
});
chatScreen.addEventListener('dragover', (e) => {
  if (!dragHasFiles(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
chatScreen.addEventListener('dragleave', (e) => {
  if (!dragHasFiles(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) chatScreen.classList.remove('drag-over');
});
chatScreen.addEventListener('drop', async (e) => {
  if (!dragHasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  chatScreen.classList.remove('drag-over');
  const files = [...e.dataTransfer.files].filter((f) => /^(image|video)\//.test(f.type)).slice(0, 5);
  if (!files.length) { showAppToast('Only photos and videos can be sent here.'); return; }
  for (let i = 0; i < files.length; i++) await uploadAndSendFile(files[i], i === 0);
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
      // Found by the sticker-picker audit: this used to silently drop the send and still close
      // the picker when disconnected, indistinguishable from the sticker having actually gone
      // through — same failure shape the plain-text send path already guards against above.
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        showAppToast("Not connected — your sticker wasn't sent.");
        stickerPicker.classList.add('hidden');
        return;
      }
      sendMediaMessage(s.url, 'image');
      stickerPicker.classList.add('hidden');
    });
    stickerPicker.appendChild(btn);
  });
})();

stickerBtn.addEventListener('click', () => {
  stickerPicker.classList.toggle('hidden');
  // Same mutual-exclusion fix as updateMentionDropdown() above, the other direction.
  if (!stickerPicker.classList.contains('hidden')) {
    mentionDropdownEl.classList.add('hidden');
    mentionHighlightIndex = -1;
  }
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
        sendMediaMessage(data.url, data.mediaType);
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
// Unread ValkMail count next to the menu's ValkMail link — refreshed whenever the menu opens.
const valkmailUnreadBadge = document.getElementById('valkmail-unread-badge');
async function refreshValkmailBadge() {
  const token = localStorage.getItem(ACCOUNT_TOKEN_KEY);
  if (!token) { valkmailUnreadBadge.classList.add('hidden'); return; }
  try {
    const res = await fetch('/api/valkmail/unread', { headers: { Authorization: `Bearer ${token}` } });
    const { unread } = await res.json();
    valkmailUnreadBadge.textContent = unread;
    valkmailUnreadBadge.classList.toggle('hidden', !unread);
  } catch {}
}

menuBtn.addEventListener('click', () => {
  menuOverlay.classList.remove('hidden');
  refreshValkmailBadge();
});
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
// Found by the QR-code join-flow audit: a 404 (room gone between opening the menu and clicking)
// or a 429 (rate limit) previously left the bare browser broken-image glyph with no explanation
// — the same failure shape this app already has a fallback pattern for on message media.
qrImage.addEventListener('error', () => {
  qrImage.classList.add('hidden');
  qrErrorEl.classList.remove('hidden');
});
qrBtn.addEventListener('click', () => {
  if (!currentRoomCode) return;
  closeMenu();
  qrImage.classList.remove('hidden');
  qrErrorEl.classList.add('hidden');
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
    // name (and the account token, if signed in) are needed server-side to check ban status —
    // /export has no live WS session to check ws.room/ws.accountId against, the same "no live
    // session to gate on" shape /post-image and /post-media already solve, found by an audit.
    const exportHeaders = { 'Content-Type': 'application/json' };
    if (accountToken) exportHeaders.Authorization = `Bearer ${accountToken}`;
    const res = await fetch('/export', {
      method: 'POST',
      headers: exportHeaders,
      body: JSON.stringify({ code: currentRoomCode, pin: currentRoomPin, name: myProfile ? myProfile.name : '' }),
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
      if (document.getElementById(`msg-${m.id}`) || (m.id && olderHasMore)) {
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
  // Found by the personal block/mute audit: the main message list hides a blocked sender's
  // bubbles via this exact data attribute + class (toggleBlockUser's own querySelectorAll
  // retroactively re-applies it here too, for free, once tagged the same way) — thread replies
  // never got either, so a blocked user's replies (including as the thread's own root message)
  // rendered in full here regardless of block state.
  el.dataset.senderName = data.name;
  el.className = 'thread-message' + (blockedNames.has(data.name) ? ' blocked-hidden' : '');
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
// Found by the poll-creation-UI audit: this used to be messageId -> Map<name, optionIndex>,
// built from a raw per-voter name/optionIndex list the server broadcast to every room member —
// the poll UI only ever displays aggregate counts + your own vote highlighted, never anyone
// else's identity, but the full name-to-vote mapping was sitting in plaintext in every
// 'poll-voted'/'joined-room' WS message regardless, trivially readable via DevTools even though
// nothing in the UI ever claimed anonymity. Server now sends only an aggregate counts array plus
// this specific recipient's own myVote — this map mirrors that shape 1:1.
const pollVotesByMessage = new Map(); // messageId -> { counts: number[], myVote: number|null }

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
  document.getElementById('poll-multi-input').checked = false;
  document.getElementById('poll-ends-select').value = '0';
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
  const pollDef = { question, options };
  if (document.getElementById('poll-multi-input').checked) pollDef.multi = true;
  const endsIn = Number(document.getElementById('poll-ends-select').value) || 0;
  if (endsIn > 0) pollDef.endsAt = Date.now() + endsIn;
  ws.send(JSON.stringify({
    type: 'message',
    text: JSON.stringify(pollDef),
    mediaUrl: 'poll',
    mediaType: 'poll',
  }));
  pollOverlay.classList.add('hidden');
});

function seedPollVotes(messageId, data) {
  const myVote = data && data.myVote != null ? data.myVote : null;
  pollVotesByMessage.set(messageId, {
    counts: (data && data.counts) || [],
    myVote,
    myVotes: data && Array.isArray(data.myVotes) ? data.myVotes : (myVote != null ? [myVote] : []),
    voters: data && Number.isFinite(data.voters) ? data.voters : null,
  });
}

function formatTimeLeft(ms) {
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'}`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'}`;
}

function rerenderPollCard(messageId, text) {
  const el = document.getElementById(`msg-${messageId}`);
  const bubble = el && el.querySelector('.bubble');
  const oldCard = bubble && bubble.querySelector('.poll-card');
  if (!bubble || !oldCard) return;
  const fresh = document.createElement('div');
  renderPoll(fresh, { id: messageId, text: text || oldCard.dataset.pollText, name: oldCard.dataset.pollAuthor, own: oldCard.dataset.pollOwn === '1' });
  if (fresh.firstChild) oldCard.replaceWith(fresh.firstChild);
}

function renderPoll(container, data) {
  let poll;
  try { poll = JSON.parse(data.text); } catch { return; }
  if (!pollVotesByMessage.has(data.id)) seedPollVotes(data.id, data);
  const state = pollVotesByMessage.get(data.id) || {};
  const counts = state.counts && state.counts.length ? state.counts : poll.options.map(() => 0);
  const myVotes = state.myVotes || [];
  const total = counts.reduce((a, b) => a + b, 0);
  const ended = !!poll.closedAt || (poll.endsAt && Date.now() >= poll.endsAt);
  const isOwnPoll = !!(myProfile && (data.own || (data.sub && data.sub === myProfile.sub)));

  const card = document.createElement('div');
  card.className = 'poll-card' + (ended ? ' poll-ended' : '');
  card.dataset.pollText = data.text;
  card.dataset.pollAuthor = data.name || '';
  card.dataset.pollOwn = isOwnPoll ? '1' : '';
  const q = document.createElement('div');
  q.className = 'poll-question';
  q.textContent = `📊 ${poll.question}`;
  card.appendChild(q);
  if (poll.multi && !ended) {
    const hint = document.createElement('div');
    hint.className = 'poll-hint';
    hint.textContent = 'Pick as many as you like';
    card.appendChild(hint);
  }

  // When it ends, the winning option(s) get a 🏆.
  const top = Math.max(0, ...counts);
  poll.options.forEach((label, i) => {
    const mine = myVotes.includes(i);
    const opt = document.createElement(ended ? 'div' : 'button');
    if (!ended) opt.type = 'button';
    opt.className = 'poll-option' + (mine ? ' voted' : '') + (ended && top > 0 && counts[i] === top ? ' winner' : '');
    // Percent of people who picked it (multi-choice can add up to more than 100%).
    const base = poll.multi ? (state.voters || total) : total;
    const pct = base > 0 ? Math.round((counts[i] / base) * 100) : 0;
    const fill = document.createElement('div');
    fill.className = 'poll-option-fill';
    fill.style.width = `${Math.min(100, pct)}%`;
    const labelRow = document.createElement('div');
    labelRow.className = 'poll-option-label';
    const labelText = document.createElement('span');
    labelText.textContent = (poll.multi ? (mine ? '☑ ' : '☐ ') : '') + label + (ended && top > 0 && counts[i] === top ? ' 🏆' : '');
    const countText = document.createElement('span');
    countText.textContent = total > 0 ? `${pct}% (${counts[i]})` : '';
    labelRow.append(labelText, countText);
    opt.append(fill, labelRow);
    if (!ended) {
      opt.addEventListener('click', () => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'vote-poll', messageId: data.id, optionIndex: i }));
      });
    }
    card.appendChild(opt);
  });

  const footer = document.createElement('div');
  footer.className = 'poll-total-votes';
  const voters = poll.multi ? (state.voters != null ? state.voters : total) : total;
  let footText = `${voters} ${poll.multi ? 'voter' : 'vote'}${voters === 1 ? '' : 's'}`;
  if (ended) footText += ' · Final results';
  else if (poll.endsAt) footText += ` · ends in ${formatTimeLeft(poll.endsAt - Date.now())}`;
  footer.textContent = footText;
  if (!ended && (isOwnPoll || isMod())) {
    const endBtn = document.createElement('button');
    endBtn.type = 'button';
    endBtn.className = 'poll-end-btn';
    endBtn.textContent = 'End poll';
    endBtn.addEventListener('click', () => {
      if (!confirm('End this poll now? Nobody will be able to vote after this.')) return;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'close-poll', messageId: data.id }));
    });
    footer.append(' · ', endBtn);
  }
  card.appendChild(footer);

  // Flip to "Final results" by itself when the timer runs out.
  if (!ended && poll.endsAt) {
    const wait = poll.endsAt - Date.now() + 500;
    if (wait < 2147483647) setTimeout(() => { if (card.isConnected) rerenderPollCard(data.id, data.text); }, wait);
  }

  container.appendChild(card);
}

// Bumped on every submit so a response that arrives out of order (fetch B's response landing
// before an earlier fetch A's, plausible under normal network jitter if the user edits and
// resubmits before the first result comes back) can tell it's stale and discard itself instead
// of overwriting a newer, correct result with an older one.
let searchRequestId = 0;
searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (!q || !currentRoomCode) return;
  const myRequestId = ++searchRequestId;
  searchResultsEl.innerHTML = '<li class="search-status">Searching…</li>';
  try {
    // POST, not a query string — a room PIN in the URL would end up in browser history and any
    // Referer header sent by the page (the /post-image /post-media routes already made this same
    // call via POST body for the same reason; this brings /search in line with that pattern).
    // name (and the account token, if signed in) are needed server-side to check ban status —
    // same "no live WS session to gate on" shape /export already needed this for.
    const searchHeaders = { 'Content-Type': 'application/json' };
    if (accountToken) searchHeaders.Authorization = `Bearer ${accountToken}`;
    const res = await fetch('/search', {
      method: 'POST',
      headers: searchHeaders,
      body: JSON.stringify({ code: currentRoomCode, q, pin: currentRoomPin, name: myProfile ? myProfile.name : '' }),
    });
    const data = await res.json();
    if (myRequestId !== searchRequestId) return;
    // Found by the search-feature correctness audit: fetch doesn't throw on a non-2xx, and this
    // never checked res.ok — a banned user, a wrong room PIN, or a rate-limited request (403/404/
    // 429, per server.js's own /search route) all came back with no `results` field, silently
    // rendered as "No matches" via `data.results || []` — factually wrong feedback that hides the
    // real reason (e.g. a banned user is told their search simply found nothing). Matches
    // exportLink's own res.ok check a couple hundred lines above in this same file for the same
    // shape of route.
    if (!res.ok) {
      searchResultsEl.innerHTML = '';
      const status = document.createElement('li');
      status.className = 'search-status';
      status.textContent = data.error || 'Search failed';
      searchResultsEl.appendChild(status);
      return;
    }
    renderSearchResults(data.results || []);
  } catch {
    if (myRequestId !== searchRequestId) return;
    searchResultsEl.innerHTML = '<li class="search-status">Search failed</li>';
  }
});

function renderSearchResults(results) {
  searchResultsEl.innerHTML = '';
  // Found by the personal block/mute audit: unlike the main message list, search never checked
  // blockedNames at all — a blocked user's messages surfaced here in full, name and text both,
  // even though the exact same content is hidden everywhere it's normally read from. Filtered out
  // here rather than rendered-then-hidden, since this panel is a one-shot render per search with
  // no later re-toggle expectation the way the always-live message list has.
  results = results.filter((r) => !blockedNames.has(r.name));
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
      searchOverlay.classList.add('hidden');
      jumpToMessage(r.id);
      return;
      // Found by the search-feature correctness audit: search exists specifically to reach
      // messages beyond the ~50-message in-memory/DOM window (see server.js's own comment on
      // HISTORY_LIMIT) — a hit on exactly that kind of older message used to be a silent dead
      // click: overlay stays open, nothing happens, no error, no hint why. This app has no
      // scroll-to-top pagination wired up client-side at all yet (server.js's load-older-messages
      // handler exists but nothing on this page ever sends it — a real, separate feature gap, not
      // something to build unprompted as a side effect of this fix); until that exists, a clear
      // message is the honest, complete fix for the actual bug here (misleading silence), not a
      // dead click.
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

// --- Invite links: /?invite=<token> joins that room (skipping its PIN) once you've picked a name.
let pendingInviteToken = /^[a-f0-9]{24}$/.test(rejoinParams.get('invite') || '') ? rejoinParams.get('invite') : null;
if (pendingInviteToken) {
  history.replaceState(null, '', location.pathname);
  const sub = document.querySelector('#login-screen .subtitle');
  if (sub) sub.textContent = "You've been invited to a room — pick a name to join";
}

function inviteUrl(token) {
  return `${location.origin}/?invite=${token}`;
}

async function copyInviteLink(token) {
  try {
    await navigator.clipboard.writeText(inviteUrl(token));
    showAppToast('🔗 Invite link copied');
  } catch {
    showAppToast('🔗 Invite link created — copy it from the list');
  }
}

function renderInvites(list) {
  invitesListEl.innerHTML = '';
  const now = Date.now();
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'search-status';
    li.textContent = 'No invite links yet.';
    invitesListEl.appendChild(li);
    return;
  }
  for (const inv of list) {
    const li = document.createElement('li');
    const expired = inv.expiresAt && inv.expiresAt <= now;
    const usedUp = inv.maxUses && inv.uses >= inv.maxUses;
    const link = document.createElement('span');
    link.className = 'invite-link-text';
    link.textContent = inviteUrl(inv.token);
    const info = document.createElement('span');
    info.className = 'event-going';
    const uses = inv.maxUses ? `${inv.uses}/${inv.maxUses} used` : `${inv.uses} used`;
    const exp = expired ? 'expired' : usedUp ? 'used up' : inv.expiresAt ? `expires ${new Date(inv.expiresAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'never expires';
    info.textContent = `${uses} · ${exp}`;
    const actions = document.createElement('div');
    actions.className = 'invite-actions';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'small-btn';
    copy.textContent = 'Copy';
    copy.disabled = !!(expired || usedUp);
    copy.addEventListener('click', () => copyInviteLink(inv.token));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'small-btn danger';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'delete-invite', token: inv.token }));
    });
    actions.append(copy, del);
    li.append(link, info, actions);
    invitesListEl.appendChild(li);
  }
}

invitesToggleBtn.addEventListener('click', () => {
  const opening = invitesManager.classList.contains('hidden');
  invitesManager.classList.toggle('hidden', !opening);
  if (opening && ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'list-invites' }));
});
inviteCreateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'create-invite', expiresIn: Number(inviteExpiry.value), maxUses: Number(inviteUses.value) }));
});

// --- Notification deep links: "/?open=friends" / "/?open=group&id=..." ---
// Set by friend-request / friend-DM / group-DM push notifications (server.js). On a fresh page
// load it waits for 'joined-server' (needs a live socket + account); an already-open tab gets it
// from the service worker via postMessage instead of a reload, so it doesn't lose its room.
let pendingOpenUrl = rejoinParams.get('open') ? location.search : null;
if (pendingOpenUrl) history.replaceState(null, '', location.pathname);

function handleOpenRequest(url) {
  let params;
  try { params = new URLSearchParams(new URL(url, location.origin).search); } catch { return; }
  const what = params.get('open');
  if (what === 'dm' && params.get('with')) {
    if (!ws || ws.readyState !== WebSocket.OPEN) { pendingOpenUrl = url; return; }
    openFriendDm(params.get('with'));
  } else if (what === 'friends') {
    openFriendsPanel();
    const dmFrom = params.get('dmFrom');
    if (dmFrom) showAppToast(`💬 ${dmFrom}: ${params.get('dmText') || ''}`);
  } else if (what === 'group' && params.get('id')) {
    if (!ws || ws.readyState !== WebSocket.OPEN) { pendingOpenUrl = url; return; }
    const id = params.get('id');
    const thread = (lastLoadedThreads || []).find((t) => t.id === id);
    openGroupDm(id, thread);
    if (!thread) loadGroupThreads();
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== 'valk-open' || typeof e.data.url !== 'string') return;
    if (myProfile && ws && ws.readyState === WebSocket.OPEN) handleOpenRequest(e.data.url);
    else pendingOpenUrl = e.data.url;
  });
}
const rejoinRoom = rejoinParams.get('room');
// ?room=CODE&msg=ID (a copied message link) — jump to that message once the room is joined.
let pendingLinkMsgId = rejoinParams.get('msg') || null;
let pendingLinkRoom = rejoinRoom ? rejoinRoom.trim().toUpperCase() : null;
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

// --- GIF picker (GIPHY via the server's /api/gifs/*; hidden unless the server has a key) ---
(function initGifPicker() {
  if (!gifBtn) return;
  fetch('/api/gifs/status').then((r) => r.json()).then((d) => {
    if (d && d.enabled) gifBtn.classList.remove('hidden');
  }).catch(() => {});

  let searchTimer = null;
  let searchSeq = 0;

  async function loadGifs(q) {
    const seq = ++searchSeq;
    gifResults.innerHTML = '<p class="search-status">Loading…</p>';
    try {
      const res = await fetch(`/api/gifs/search${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      const data = await res.json();
      if (seq !== searchSeq) return; // a newer search already replaced this one
      if (!res.ok) throw new Error(data.error || 'GIF search failed');
      gifResults.innerHTML = '';
      if (!data.gifs.length) {
        gifResults.innerHTML = '<p class="search-status">No GIFs found.</p>';
        return;
      }
      for (const g of data.gifs) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = g.title || 'GIF';
        const img = document.createElement('img');
        img.src = g.preview;
        img.alt = g.title || 'GIF';
        img.loading = 'lazy';
        btn.appendChild(img);
        btn.addEventListener('click', () => {
          if (!ws || ws.readyState !== WebSocket.OPEN) {
            showAppToast("Not connected — your GIF wasn't sent.");
            return;
          }
          sendGifMessage(g.id);
          gifPicker.classList.add('hidden');
        });
        gifResults.appendChild(btn);
      }
    } catch (err) {
      if (seq === searchSeq) gifResults.innerHTML = `<p class="search-status">${escapeHtml(err.message || 'GIF search failed')}</p>`;
    }
  }

  gifBtn.addEventListener('click', () => {
    const opening = gifPicker.classList.contains('hidden');
    gifPicker.classList.toggle('hidden', !opening);
    if (stickerPicker) stickerPicker.classList.add('hidden');
    if (opening) {
      gifSearchInput.value = '';
      loadGifs('');
      gifSearchInput.focus();
    }
  });
  if (stickerPicker) {
    document.getElementById('sticker-btn').addEventListener('click', () => gifPicker.classList.add('hidden'));
  }
  gifSearchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadGifs(gifSearchInput.value.trim()), 400);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !gifPicker.classList.contains('hidden')) gifPicker.classList.add('hidden');
  });
})();

// Group DM "typing…" signal (throttled).
groupDmInput.addEventListener('input', () => {
  if (!currentGroupDmId || !groupDmInput.value.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
  if (Date.now() - lastGroupDmTypingSentAt < 2500) return;
  lastGroupDmTypingSentAt = Date.now();
  ws.send(JSON.stringify({ type: 'group-dm-typing', groupId: currentGroupDmId }));
});

// --- Profile cards: tap a name or avatar in the chat or the online list ---
const profileCardOverlay = document.getElementById('profile-card-overlay');
const profileCardBody = document.getElementById('profile-card-body');
const profileCardCloseBtn = document.getElementById('profile-card-close-btn');
let profileCardRequestedName = null;

function openProfileCard(name) {
  if (!name || !ws || ws.readyState !== WebSocket.OPEN || !currentRoomCode) return;
  profileCardRequestedName = name;
  profileCardBody.innerHTML = '<p class="search-status">Loading…</p>';
  profileCardOverlay.classList.remove('hidden');
  ws.send(JSON.stringify({ type: 'get-profile-card', name }));
}

function closeProfileCard() {
  profileCardOverlay.classList.add('hidden');
  profileCardRequestedName = null;
}

function renderProfileCard(data) {
  if (data.name !== profileCardRequestedName) return;
  profileCardBody.innerHTML = '';
  if (data.avatarUrl) roomProfiles.set(data.name, { ...(roomProfiles.get(data.name) || {}), avatarUrl: data.avatarUrl });
  profileCardBody.appendChild(makeAvatar(data.name));
  const nameEl = document.createElement('div');
  nameEl.className = 'profile-card-name';
  nameEl.appendChild(makeFlairName(data.name, data.account && data.account.flair));
  profileCardBody.appendChild(nameEl);
  const sub = document.createElement('div');
  sub.className = 'profile-card-sub';
  const bits = [data.online ? '🟢 Online' : '⚪ Not here right now'];
  if (data.isHost) bits.push('👑 Room host');
  else if (data.isCohost) bits.push('🛡️ Co-host');
  sub.textContent = bits.join(' · ');
  profileCardBody.appendChild(sub);
  if (data.status) {
    const st = document.createElement('div');
    st.className = 'profile-card-status';
    st.textContent = data.status;
    profileCardBody.appendChild(st);
  }
  const acct = data.account;
  const info = document.createElement('div');
  info.className = 'profile-card-sub';
  if (acct) {
    const joined = acct.joinedAt ? new Date(acct.joinedAt).toLocaleDateString([], { month: 'long', year: 'numeric' }) : null;
    info.textContent = `Valk account: ${acct.username}${joined ? ` · joined ${joined}` : ''}`;

  } else {
    info.textContent = 'Guest (no Valk account)';
  }
  profileCardBody.appendChild(info);
  if (acct && acct.streak >= 2) {
    const streak = document.createElement('div');
    streak.className = 'profile-streak';
    streak.textContent = `🔥 ${acct.streak}-day chat streak`;
    streak.title = 'Days in a row this person has chatted on Valk';
    profileCardBody.appendChild(streak);
  }

  if (acct && (acct.bio || acct.friendStatus === 'self')) {
    const bioWrap = document.createElement('div');
    bioWrap.className = 'profile-card-bio';
    const bioText = document.createElement('div');
    bioText.className = 'profile-bio-text';
    bioText.textContent = acct.bio || 'Add a little "about me" so people know who you are.';
    if (!acct.bio) bioText.classList.add('empty');
    bioWrap.appendChild(bioText);
    if (acct.friendStatus === 'self') {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'small-btn-link';
      editBtn.textContent = acct.bio ? '✏️ Edit about me' : '✏️ Write about me';
      editBtn.addEventListener('click', () => {
        const ta = document.createElement('textarea');
        ta.maxLength = 300;
        ta.rows = 3;
        ta.value = acct.bio || '';
        ta.placeholder = 'Hobbies, favorite games, what you like to chat about… (300 characters)';
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'small-btn';
        save.textContent = 'Save';
        save.addEventListener('click', () => {
          if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'set-bio', bio: ta.value }));
          acct.bio = ta.value.trim() || null;
          bioText.textContent = acct.bio || 'Add a little "about me" so people know who you are.';
          bioText.classList.toggle('empty', !acct.bio);
          ta.replaceWith(bioText);
          save.remove();
          editBtn.hidden = false;
        });
        bioText.replaceWith(ta);
        editBtn.hidden = true;
        bioWrap.appendChild(save);
        ta.focus();
      });
      bioWrap.appendChild(editBtn);
    }
    profileCardBody.appendChild(bioWrap);
  }

  if (acct) {
    const badges = document.createElement('div');
    badges.className = 'profile-badges';
    if (!acct.badges.length) {
      const none = document.createElement('p');
      none.className = 'search-status';
      none.style.gridColumn = '1 / -1';
      none.textContent = 'No badges yet';
      badges.appendChild(none);
    }
    for (const b of acct.badges) {
      const el = document.createElement('div');
      el.className = 'profile-badge';
      el.title = b.desc;
      const em = document.createElement('span');
      em.className = 'badge-emoji';
      em.textContent = b.emoji;
      el.append(em, document.createTextNode(b.label));
      badges.appendChild(el);
    }
    profileCardBody.appendChild(badges);

    const actions = document.createElement('div');
    actions.className = 'profile-card-actions';
    const addBtn = (label, onClick, cls = '') => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'small-btn ' + cls;
      btn.textContent = label;
      if (onClick) btn.addEventListener('click', onClick); else btn.disabled = true;
      actions.appendChild(btn);
    };
    const signedIn = !!accountToken;
    const friendCall = async (action) => {
      try {
        const res = await fetch(`/friends/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
          body: JSON.stringify({ username: acct.username }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || 'Something went wrong');
        showAppToast(action === 'request' ? (out.status === 'accepted' ? `🤝 You and ${acct.username} are now friends` : `👋 Friend request sent to ${acct.username}`) : `🤝 You and ${acct.username} are now friends`);
        openProfileCard(data.name);
      } catch (err) {
        showAppToast(err.message);
      }
    };
    switch (acct.friendStatus) {
      case 'self': addBtn("That's you!", null); break;
      case 'friends': addBtn('💬 Message', () => { closeProfileCard(); openFriendDm(acct.username); }); break;
      case 'pending-out': addBtn('Friend request sent', null); break;
      case 'pending-in': addBtn('✅ Accept friend request', () => friendCall('accept')); break;
      case 'blocked': addBtn('Blocked', null); break;
      default:
        if (signedIn) addBtn('➕ Add friend', () => friendCall('request'));
        else addBtn('Sign in to add friends', null);
    }
    profileCardBody.appendChild(actions);
  }
}

document.addEventListener('click', (e) => {
  const inMessages = e.target.closest('#messages .avatar, #messages .message .bubble > .meta .flair-name');
  if (inMessages) {
    const msgEl = inMessages.closest('.message');
    if (msgEl && msgEl.dataset.senderName) openProfileCard(msgEl.dataset.senderName);
    return;
  }
  const inOnline = e.target.closest('#menu-online-list .avatar, #menu-online-list .flair-name');
  if (inOnline) {
    const row = inOnline.closest('li[data-username]');
    if (row) { closeMenu(); openProfileCard(row.dataset.username); }
  }
});
profileCardCloseBtn.addEventListener('click', closeProfileCard);
profileCardOverlay.addEventListener('click', (e) => {
  if (e.target === profileCardOverlay) closeProfileCard();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !profileCardOverlay.classList.contains('hidden')) closeProfileCard();
});

// --- Do Not Disturb ---
const DND_KEY = 'valk-dnd';
let dndSettings = null;
try { dndSettings = JSON.parse(localStorage.getItem(DND_KEY) || 'null'); } catch {}

function isLocalDndActive(now = Date.now()) {
  const s = dndSettings;
  if (!s) return false;
  if (s.until && s.until > now) return true;
  if (s.schedStart == null || s.schedEnd == null || s.schedStart === s.schedEnd) return false;
  const d = new Date(now);
  const mins = d.getHours() * 60 + d.getMinutes();
  return s.schedStart < s.schedEnd ? mins >= s.schedStart && mins < s.schedEnd : mins >= s.schedStart || mins < s.schedEnd;
}

const dndBtn = document.getElementById('dnd-btn');
const dndOverlay = document.getElementById('dnd-overlay');
const dndCloseBtn = document.getElementById('dnd-close-btn');
const dndStatusEl = document.getElementById('dnd-status');
const dndScheduleForm = document.getElementById('dnd-schedule-form');
const dndScheduleOn = document.getElementById('dnd-schedule-on');
const dndStart = document.getElementById('dnd-start');
const dndEnd = document.getElementById('dnd-end');

const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const fromHHMM = (v) => { const [h, m] = String(v || '').split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null; };

function renderDnd() {
  const s = dndSettings;
  const active = isLocalDndActive();
  let text = 'Off — notifications are on';
  if (s && s.until && s.until > Date.now()) text = `On until ${new Date(s.until).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
  else if (active) text = 'On — quiet hours';
  if (s && s.schedStart != null && s.schedEnd != null) text += ` · Quiet hours ${toHHMM(s.schedStart)}–${toHHMM(s.schedEnd)} every day`;
  dndStatusEl.textContent = text;
  dndBtn.textContent = active ? '🔕 Do Not Disturb (on)' : '🔕 Do Not Disturb';
  dndScheduleOn.checked = !!(s && s.schedStart != null && s.schedEnd != null);
  if (s && s.schedStart != null) dndStart.value = toHHMM(s.schedStart);
  if (s && s.schedEnd != null) dndEnd.value = toHHMM(s.schedEnd);
}

async function currentPushEndpoint() {
  try {
    if (!('serviceWorker' in navigator)) return null;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? sub.endpoint : null;
  } catch {
    return null;
  }
}

async function saveDnd(next) {
  const body = {
    endpoint: await currentPushEndpoint(),
    until: next.until || 0,
    schedStart: next.schedStart ?? null,
    schedEnd: next.schedEnd ?? null,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
  dndSettings = (body.until || (body.schedStart != null && body.schedEnd != null)) ? body : null;
  try { localStorage.setItem(DND_KEY, JSON.stringify(dndSettings)); } catch {}
  renderDnd();
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (accountToken) headers.Authorization = `Bearer ${accountToken}`;
    const res = await fetch('/dnd', { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok && (accountToken || body.endpoint)) {
      const out = await res.json().catch(() => ({}));
      showAppToast(out.error || "Couldn't save Do Not Disturb on the server — it still works in this tab");
    }
  } catch {
    /* offline: the local copy still silences this tab */
  }
}

async function loadDndFromServer() {
  try {
    const endpoint = await currentPushEndpoint();
    const headers = accountToken ? { Authorization: `Bearer ${accountToken}` } : {};
    const res = await fetch(`/dnd${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ''}`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    if (!accountToken && !endpoint) return;
    dndSettings = data.settings;
    try { localStorage.setItem(DND_KEY, JSON.stringify(dndSettings)); } catch {}
    renderDnd();
  } catch {}
}

const keepSchedule = () => (dndSettings && dndSettings.schedStart != null ? { schedStart: dndSettings.schedStart, schedEnd: dndSettings.schedEnd } : {});

dndBtn.addEventListener('click', () => {
  closeMenu();
  renderDnd();
  dndOverlay.classList.remove('hidden');
});
dndCloseBtn.addEventListener('click', () => dndOverlay.classList.add('hidden'));
dndOverlay.addEventListener('click', (e) => {
  if (e.target === dndOverlay) dndOverlay.classList.add('hidden');
  const hoursBtn = e.target.closest('[data-dnd-hours]');
  if (hoursBtn) {
    saveDnd({ ...keepSchedule(), until: Date.now() + Number(hoursBtn.dataset.dndHours) * 60 * 60 * 1000 });
    showAppToast(`🔕 Notifications paused for ${hoursBtn.textContent}`);
  }
  if (e.target.closest('[data-dnd-morning]')) {
    const d = new Date();
    if (d.getHours() >= 7) d.setDate(d.getDate() + 1);
    d.setHours(7, 0, 0, 0);
    saveDnd({ ...keepSchedule(), until: d.getTime() });
    showAppToast('🔕 Notifications paused until 7 AM');
  }
});
document.getElementById('dnd-off-btn').addEventListener('click', () => {
  saveDnd({});
  showAppToast('🔔 Notifications are back on');
});
dndScheduleForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const until = dndSettings && dndSettings.until > Date.now() ? dndSettings.until : 0;
  if (dndScheduleOn.checked) {
    const schedStart = fromHHMM(dndStart.value);
    const schedEnd = fromHHMM(dndEnd.value);
    if (schedStart == null || schedEnd == null) return;
    saveDnd({ until, schedStart, schedEnd });
    showAppToast(`🔕 Quiet hours saved: ${dndStart.value}–${dndEnd.value}`);
  } else {
    saveDnd({ until });
    showAppToast('Quiet hours turned off');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !dndOverlay.classList.contains('hidden')) dndOverlay.classList.add('hidden');
});
renderDnd();
loadDndFromServer();
setInterval(renderDnd, 60 * 1000);


// --- Keyboard shortcuts: Ctrl/Cmd+K room switcher, ↑ edits your last message, ? cheat sheet ---
const switcherModal = document.getElementById('switcher-modal');
const switcherInput = document.getElementById('switcher-input');
const switcherList = document.getElementById('switcher-list');
const shortcutsModal = document.getElementById('shortcuts-modal');
let switcherIndex = 0;
let switcherItems = [];

function renderSwitcher() {
  const q = switcherInput.value.trim().toLowerCase();
  const rooms = getRecentRooms().filter((r) => !q || r.code.toLowerCase().includes(q) || (r.name && r.name.toLowerCase().includes(q)));
  switcherItems = rooms.slice(0, 12);
  // A typed 5-character code that isn't in the list can still be joined directly.
  const typedCode = switcherInput.value.trim().toUpperCase();
  if (/^[A-Z0-9]{5}$/.test(typedCode) && !switcherItems.some((r) => r.code === typedCode)) {
    switcherItems.unshift({ code: typedCode, name: null, typed: true });
  }
  switcherIndex = Math.min(switcherIndex, Math.max(0, switcherItems.length - 1));
  switcherList.textContent = '';
  if (!switcherItems.length) {
    const li = document.createElement('li');
    li.textContent = q ? 'No matching rooms — type a 5-letter room code to join it' : 'No recent rooms yet';
    li.style.cursor = 'default';
    switcherList.appendChild(li);
    return;
  }
  switcherItems.forEach((r, i) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    if (i === switcherIndex) li.classList.add('active');
    if (r.code === currentRoomCode) li.classList.add('current');
    const name = document.createElement('span');
    name.textContent = r.typed ? `Join room ${r.code}` : (r.name || `Room ${r.code}`) + (r.code === currentRoomCode ? ' (you are here)' : '');
    const code = document.createElement('span');
    code.className = 'sw-code';
    code.textContent = r.code;
    li.append(name, code);
    li.addEventListener('click', () => pickSwitcher(i));
    switcherList.appendChild(li);
  });
}

function openSwitcher() {
  switcherInput.value = '';
  switcherIndex = 0;
  renderSwitcher();
  switcherModal.classList.remove('hidden');
  switcherInput.focus();
}
function closeSwitcher() { switcherModal.classList.add('hidden'); }

function pickSwitcher(i) {
  const r = switcherItems[i];
  if (!r) return;
  closeSwitcher();
  if (r.code === currentRoomCode) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) { showAppToast('Not connected right now — try again in a moment'); return; }
  if (currentRoomCode) {
    joinFriendRoom(r.code);
  } else {
    roomCodeInput.value = r.code;
    pendingJoinPin = '';
    ws.send(JSON.stringify({ type: 'join-room', code: r.code }));
  }
}

switcherInput.addEventListener('input', () => { switcherIndex = 0; renderSwitcher(); });
switcherInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); switcherIndex = Math.min(switcherIndex + 1, switcherItems.length - 1); renderSwitcher(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); switcherIndex = Math.max(switcherIndex - 1, 0); renderSwitcher(); }
  else if (e.key === 'Enter') { e.preventDefault(); pickSwitcher(switcherIndex); }
  else if (e.key === 'Escape') { e.preventDefault(); closeSwitcher(); }
});
switcherModal.addEventListener('click', (e) => { if (e.target === switcherModal) closeSwitcher(); });
document.getElementById('shortcuts-close').addEventListener('click', () => shortcutsModal.classList.add('hidden'));
shortcutsModal.addEventListener('click', (e) => { if (e.target === shortcutsModal) shortcutsModal.classList.add('hidden'); });

function isTypingTarget(el) {
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

document.addEventListener('keydown', (e) => {
  const loggedIn = !!myProfile;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) {
    if (!loggedIn) return;
    e.preventDefault();
    if (switcherModal.classList.contains('hidden')) openSwitcher(); else closeSwitcher();
    return;
  }
  if (e.key === 'Escape') {
    if (!shortcutsModal.classList.contains('hidden')) { shortcutsModal.classList.add('hidden'); return; }
    if (document.activeElement === messageInput && replyingTo) { clearReplyingTo(); return; }
  }
  if (isTypingTarget(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return;
  const inChat = !chatScreen.classList.contains('hidden');
  if (e.key === '?' && inChat) {
    e.preventDefault();
    shortcutsModal.classList.remove('hidden');
    document.getElementById('shortcuts-close').focus();
  } else if (e.key === '/' && inChat) {
    e.preventDefault();
    messageInput.focus();
  }
});

// ↑ in an empty composer edits your most recent (text) message, like most chat apps.
messageInput.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowUp' || e.defaultPrevented || messageInput.value || !myProfile) return;
  if (!mentionDropdownEl.classList.contains('hidden')) return;
  const mine = [...messagesEl.querySelectorAll('.message.own')].reverse()
    .find((el) => !el.dataset.deleted && el.querySelector('.bubble > .text') && el.querySelector('[aria-label="Edit message"]'));
  if (!mine) return;
  e.preventDefault();
  startEditingMessage(mine.id.replace(/^msg-/, ''));
});


// --- Scroll back through older history (the room only sends the newest 50 on join) ---
const OLDER_PAGE = 50;
let olderHasMore = false;
let olderLoading = false;
let olderRequestedBefore = null;
let oldestLoaded = null; // { at, id }
let loadOlderBtn = null;

function resetOlderMessages(messages) {
  olderLoading = false;
  olderRequestedBefore = null;
  oldestLoaded = messages.length ? { at: messages[0].at, id: messages[0].id } : null;
  olderHasMore = messages.length >= OLDER_PAGE;
  loadOlderBtn = document.createElement('button');
  loadOlderBtn.type = 'button';
  loadOlderBtn.className = 'load-older-btn';
  loadOlderBtn.textContent = '⬆ Load earlier messages';
  loadOlderBtn.addEventListener('click', requestOlderMessages);
  loadOlderBtn.classList.toggle('hidden', !olderHasMore);
  messagesEl.prepend(loadOlderBtn);
}

function requestOlderMessages() {
  if (!olderHasMore || olderLoading || !oldestLoaded || !ws || ws.readyState !== WebSocket.OPEN) return;
  olderLoading = true;
  olderRequestedBefore = oldestLoaded.id;
  if (loadOlderBtn) loadOlderBtn.textContent = 'Loading…';
  ws.send(JSON.stringify({ type: 'load-older-messages', beforeAt: oldestLoaded.at, beforeId: oldestLoaded.id }));
  // If the reply never comes (rate limit, dropped connection) let the user try again.
  setTimeout(() => {
    if (olderLoading && olderRequestedBefore === oldestLoaded.id) {
      olderLoading = false;
      if (loadOlderBtn) loadOlderBtn.textContent = '⬆ Load earlier messages';
    }
  }, 6000);
}

function handleOlderMessages(data) {
  if (!olderLoading || data.beforeId !== olderRequestedBefore) return; // stale (room switched)
  olderLoading = false;
  const msgs = (data.messages || []).filter((m) => !document.getElementById(`msg-${m.id}`));
  // Merge (not replace) reactions so the already-shown messages keep theirs.
  (data.reactions || []).forEach((r) => {
    let reactions = reactionsByMessage.get(r.messageId);
    if (!reactions) { reactions = new Map(); reactionsByMessage.set(r.messageId, reactions); }
    let names = reactions.get(r.emoji);
    if (!names) { names = new Set(); reactions.set(r.emoji, names); }
    names.add(r.name);
  });
  const savedLastEl = lastMessageEl;
  const savedLastId = lastMessageId;
  const prevHeight = messagesEl.scrollHeight;
  const prevTop = messagesEl.scrollTop;
  const startCount = messagesEl.children.length;
  msgs.forEach((m) => renderMessage(m, { history: true }));
  const added = [...messagesEl.children].slice(startCount);
  const anchor = loadOlderBtn && loadOlderBtn.parentNode === messagesEl ? loadOlderBtn.nextSibling : messagesEl.firstChild;
  added.forEach((node) => messagesEl.insertBefore(node, anchor));
  lastMessageEl = savedLastEl;
  lastMessageId = savedLastId;
  regroupAllMessages();
  if (typeof renderSeenBy === 'function') renderSeenBy();
  messagesEl.scrollTop = prevTop + (messagesEl.scrollHeight - prevHeight);
  if (data.messages && data.messages.length) oldestLoaded = { at: data.messages[0].at, id: data.messages[0].id };
  olderHasMore = !!data.hasMore;
  if (pendingJumpId) {
    const want = pendingJumpId;
    pendingJumpId = null;
    if (document.getElementById(`msg-${want}`)) requestAnimationFrame(() => jumpToMessage(want));
    else showAppToast("Couldn't find that message — it may have been deleted or be too far back.");
  }
  if (loadOlderBtn) {
    loadOlderBtn.textContent = olderHasMore ? '⬆ Load earlier messages' : '— Start of this room —';
    loadOlderBtn.disabled = !olderHasMore;
    loadOlderBtn.classList.remove('hidden');
  }
}

messagesEl.addEventListener('scroll', () => {
  if (messagesEl.scrollTop < 60 && olderHasMore && !olderLoading) requestOlderMessages();
});


document.getElementById('hosts-only-input').addEventListener('change', (e) => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'set-hosts-only', on: e.target.checked }));
});

// --- Auto-away: 🌙 after 5 minutes with no activity (or the tab hidden that long) ---
const AWAY_AFTER_MS = 5 * 60 * 1000;
let lastActivityAt = Date.now();
let sentAway = false;
function noteActivity() {
  lastActivityAt = Date.now();
  if (sentAway && !document.hidden) setAway(false);
}
function setAway(away) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentRoomCode) return;
  sentAway = away;
  ws.send(JSON.stringify({ type: 'set-away', away }));
}
['pointerdown', 'keydown', 'mousemove', 'touchstart', 'focus'].forEach((ev) => window.addEventListener(ev, noteActivity, { passive: true }));
document.addEventListener('visibilitychange', () => { if (!document.hidden) noteActivity(); });
setInterval(() => {
  if (!sentAway && currentRoomCode && Date.now() - lastActivityAt > AWAY_AFTER_MS) setAway(true);
}, 30000);


// --- /later scheduled messages ---
const scheduledModal = document.getElementById('scheduled-modal');
const scheduledListEl = document.getElementById('scheduled-list');
document.getElementById('scheduled-close').addEventListener('click', () => scheduledModal.classList.add('hidden'));
scheduledModal.addEventListener('click', (e) => { if (e.target === scheduledModal) scheduledModal.classList.add('hidden'); });

// "/later 30m text", "/later 2h text", "/later 1d text", "/later 18:30 text", "/later 6pm text",
// "/later 6:30pm text" (a clock time that's already passed today means tomorrow).
function parseLaterCommand(raw) {
  let m = raw.match(/^\/later\s+(?:in\s+)?(\d+(?:\.\d+)?)\s*(m|mins?|minutes?|h|hrs?|hours?|d|days?)\b\s+([\s\S]+)$/i);
  if (m) {
    const unit = m[2][0].toLowerCase();
    return { sendAt: Date.now() + Math.round(parseFloat(m[1]) * REMIND_UNITS[unit]), text: m[3].trim() };
  }
  m = raw.match(/^\/later\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+([\s\S]+)$/i);
  if (m && (m[2] || m[3])) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3] ? m[3].toLowerCase() : null;
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    const d = new Date();
    d.setHours(h, min, 0, 0);
    if (d.getTime() <= Date.now() + 30 * 1000) d.setDate(d.getDate() + 1);
    return { sendAt: d.getTime(), text: m[4].trim() };
  }
  return null;
}

function renderScheduledList(items) {
  scheduledListEl.textContent = '';
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'search-status';
    li.textContent = 'Nothing scheduled in this room.';
    scheduledListEl.appendChild(li);
    return;
  }
  for (const it of items) {
    const li = document.createElement('li');
    const when = document.createElement('span');
    when.className = 'eh-when';
    when.textContent = formatReminderDue(it.sendAt);
    const text = document.createElement('span');
    text.className = 'scheduled-text';
    text.textContent = it.text;
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'small-btn';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'cancel-scheduled', id: it.id }));
    });
    li.append(when, text, cancel);
    scheduledListEl.appendChild(li);
  }
}


// --- Delete my account ---
const accountDeleteForm = document.getElementById('account-delete-form');
const accountDeleteError = document.getElementById('account-delete-error');
document.getElementById('account-delete-toggle-btn').addEventListener('click', () => {
  accountDeleteForm.classList.toggle('hidden');
  accountDeleteError.classList.add('hidden');
});
accountDeleteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  accountDeleteError.classList.add('hidden');
  const password = document.getElementById('account-delete-password').value;
  const confirmText = document.getElementById('account-delete-confirm').value.trim();
  const fail = (msg) => { accountDeleteError.textContent = msg; accountDeleteError.classList.remove('hidden'); };
  if (confirmText !== 'DELETE') return fail('Type DELETE (in capitals) to confirm');
  if (!accountToken) return fail('You are not signed in');
  try {
    const res = await fetch('/auth/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
      body: JSON.stringify({ password, confirmUsername: accountUsername }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return fail(data.error || 'Something went wrong');
    accountDeleteForm.classList.add('hidden');
    document.getElementById('account-delete-password').value = '';
    document.getElementById('account-delete-confirm').value = '';
    // The server already ended every session; this just clears it from this browser.
    accountToken = null;
    signOutAccount('🗑️ Your account has been deleted');
  } catch {
    fail('Could not reach the server — try again');
  }
});


// --- Photo viewer: tap a photo to see it big; zoom (wheel / pinch / double-tap), pan, swipe or
// arrow keys between the room's photos, download. ---
const viewerEl = document.getElementById('viewer');
const viewerImg = document.getElementById('viewer-img');
const viewerPrev = document.getElementById('viewer-prev');
const viewerNext = document.getElementById('viewer-next');
let viewerList = [];
let viewerIndex = 0;
let vz = { scale: 1, x: 0, y: 0 };
const vPointers = new Map();
let vPinchStart = null;
let vDragStart = null;
let vSwipeStart = null;

function applyViewerTransform() {
  viewerImg.style.transform = `translate(${vz.x}px, ${vz.y}px) scale(${vz.scale})`;
  viewerEl.classList.toggle('zoomed', vz.scale > 1.01);
}
function resetViewerZoom() { vz = { scale: 1, x: 0, y: 0 }; applyViewerTransform(); }
function showViewerImage(i) {
  viewerIndex = (i + viewerList.length) % viewerList.length;
  const src = viewerList[viewerIndex];
  viewerImg.src = src;
  const dl = document.getElementById('viewer-download');
  dl.href = src;
  dl.setAttribute('download', src.split('/').pop() || 'photo');
  document.getElementById('viewer-count').textContent = viewerList.length > 1 ? `${viewerIndex + 1} / ${viewerList.length}` : '';
  viewerPrev.hidden = viewerNext.hidden = viewerList.length < 2;
  resetViewerZoom();
}
function openViewer(src) {
  viewerList = [...messagesEl.querySelectorAll('.bubble img.media')].map((img) => img.getAttribute('src')).filter(Boolean);
  let i = viewerList.indexOf(src);
  if (i < 0) { viewerList.push(src); i = viewerList.length - 1; }
  viewerEl.classList.remove('hidden');
  showViewerImage(i);
}
function closeViewer() { viewerEl.classList.add('hidden'); viewerImg.removeAttribute('src'); vPointers.clear(); }

messagesEl.addEventListener('click', (e) => {
  const img = e.target.closest('.bubble img.media');
  if (!img || img.closest('.poll-card')) return;
  e.preventDefault();
  openViewer(img.getAttribute('src'));
});
document.getElementById('viewer-close').addEventListener('click', closeViewer);
viewerPrev.addEventListener('click', (e) => { e.stopPropagation(); showViewerImage(viewerIndex - 1); });
viewerNext.addEventListener('click', (e) => { e.stopPropagation(); showViewerImage(viewerIndex + 1); });
viewerEl.addEventListener('click', (e) => { if (e.target === viewerEl) closeViewer(); });
document.addEventListener('keydown', (e) => {
  if (viewerEl.classList.contains('hidden')) return;
  if (e.key === 'Escape') { e.stopPropagation(); closeViewer(); }
  else if (e.key === 'ArrowLeft') showViewerImage(viewerIndex - 1);
  else if (e.key === 'ArrowRight') showViewerImage(viewerIndex + 1);
}, true);

function zoomViewerAt(newScale, cx, cy) {
  newScale = Math.min(6, Math.max(1, newScale));
  const rect = viewerEl.getBoundingClientRect();
  const ox = cx - rect.width / 2;
  const oy = cy - rect.height / 2;
  // Keep the point under the cursor/fingers where it is.
  vz.x = ox - ((ox - vz.x) * newScale) / vz.scale;
  vz.y = oy - ((oy - vz.y) * newScale) / vz.scale;
  vz.scale = newScale;
  if (newScale === 1) { vz.x = 0; vz.y = 0; }
  applyViewerTransform();
}
viewerEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomViewerAt(vz.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
}, { passive: false });
viewerImg.addEventListener('dblclick', (e) => zoomViewerAt(vz.scale > 1.01 ? 1 : 2.5, e.clientX, e.clientY));

viewerImg.addEventListener('pointerdown', (e) => {
  viewerImg.setPointerCapture(e.pointerId);
  vPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (vPointers.size === 2) {
    const [a, b] = [...vPointers.values()];
    vPinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: vz.scale };
    vDragStart = null;
    vSwipeStart = null;
  } else if (vPointers.size === 1) {
    if (vz.scale > 1.01) vDragStart = { x: e.clientX, y: e.clientY, vx: vz.x, vy: vz.y };
    else vSwipeStart = { x: e.clientX, y: e.clientY, t: Date.now() };
  }
});
viewerImg.addEventListener('pointermove', (e) => {
  if (!vPointers.has(e.pointerId)) return;
  vPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (vPointers.size === 2 && vPinchStart) {
    const [a, b] = [...vPointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    zoomViewerAt(vPinchStart.scale * (dist / vPinchStart.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
  } else if (vDragStart) {
    vz.x = vDragStart.vx + (e.clientX - vDragStart.x);
    vz.y = vDragStart.vy + (e.clientY - vDragStart.y);
    applyViewerTransform();
  }
});
function endViewerPointer(e) {
  vPointers.delete(e.pointerId);
  if (vPointers.size < 2) vPinchStart = null;
  if (vSwipeStart && vPointers.size === 0) {
    const dx = e.clientX - vSwipeStart.x;
    const dy = e.clientY - vSwipeStart.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - vSwipeStart.t < 800) showViewerImage(viewerIndex + (dx < 0 ? 1 : -1));
    else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) closeViewer(); // swipe down to close
  }
  if (vPointers.size === 0) { vDragStart = null; vSwipeStart = null; }
}
viewerImg.addEventListener('pointerup', endViewerPointer);
viewerImg.addEventListener('pointercancel', endViewerPointer);

// Voice messages / audio clips: tap the speed pill to cycle 1× → 1.5× → 2×.
const AUDIO_SPEEDS = [1, 1.5, 2];
new MutationObserver((muts) => {
  for (const m of muts) {
    for (const node of m.addedNodes) {
      if (!(node instanceof Element)) continue;
      node.querySelectorAll && node.querySelectorAll('audio.media.audio-clip').forEach((audio) => {
        if (audio.dataset.speedBtn) return;
        audio.dataset.speedBtn = '1';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'audio-speed-btn';
        btn.textContent = '1×';
        btn.title = 'Playback speed';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const next = AUDIO_SPEEDS[(AUDIO_SPEEDS.indexOf(audio.playbackRate) + 1) % AUDIO_SPEEDS.length] || 1;
          audio.playbackRate = next;
          btn.textContent = `${next}×`;
        });
        audio.after(btn);
      });
    }
  }
}).observe(messagesEl, { childList: true, subtree: true });


// --- Per-room notifications (Every message / Only @mentions / Off) ---
const roomNotifySelect = document.getElementById('room-notify-select');
let roomNotify = { mode: 'all', until: 0 };
function roomNotifyKey(code) { return `valk-room-notify:${code}`; }
function currentRoomNotifyMode() {
  if (roomNotify.until && roomNotify.until <= Date.now()) roomNotify = { mode: 'all', until: 0 };
  return roomNotify.mode || 'all';
}
function loadRoomNotifyPref(code, serverPref) {
  roomNotify = { mode: 'all', until: 0 };
  try { const v = JSON.parse(localStorage.getItem(roomNotifyKey(code)) || 'null'); if (v && v.mode) roomNotify = v; } catch (err) { /* ignore */ }
  if (serverPref && serverPref.mode) roomNotify = { mode: serverPref.mode, until: serverPref.until || 0 };
  const mode = currentRoomNotifyMode();
  roomNotifySelect.value = mode === 'off' ? 'off' : mode;
}
roomNotifySelect.addEventListener('change', async () => {
  const [mode, dur] = roomNotifySelect.value.split(':');
  roomNotify = { mode, until: dur ? Date.now() + Number(dur) : 0 };
  try { localStorage.setItem(roomNotifyKey(currentRoomCode), JSON.stringify(roomNotify)); } catch (err) { /* ignore */ }
  let endpoint = null;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
    endpoint = sub ? sub.endpoint : null;
  } catch (err) { /* no push on this device — the setting still silences this tab */ }
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'set-room-notify', mode, until: roomNotify.until, endpoint }));
});

function notificationPreview(data) {
  if (data.mediaType === 'poll') {
    try { return `📊 Poll: ${JSON.parse(data.text).question}`; } catch (err) { return '📊 Poll'; }
  }
  if (data.kind === 'me') return `* ${data.name} ${data.text}`;
  return data.text || (data.mediaType ? `sent a${data.mediaType === 'image' ? 'n' : ''} ${data.mediaType}` : '');
}

// --- Text size ---
const textSizeSelect = document.getElementById('text-size-select');
function applyTextSize(size) {
  document.body.classList.remove('ts-small', 'ts-large', 'ts-xl');
  if (size && size !== 'normal') document.body.classList.add(`ts-${size}`);
}
let savedTextSize = 'normal';
try { savedTextSize = localStorage.getItem('valk-text-size') || 'normal'; } catch (err) { /* ignore */ }
textSizeSelect.value = savedTextSize;
applyTextSize(savedTextSize);
textSizeSelect.addEventListener('change', () => {
  applyTextSize(textSizeSelect.value);
  try { localStorage.setItem('valk-text-size', textSizeSelect.value); } catch (err) { /* ignore */ }
});


// --- Room stats ---
const statsModal = document.getElementById('stats-modal');
const statsBody = document.getElementById('stats-body');
document.getElementById('room-stats-btn').addEventListener('click', () => {
  closeMenu();
  statsBody.innerHTML = '<p class="search-status">Loading…</p>';
  statsModal.classList.remove('hidden');
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'get-room-stats' }));
});
document.getElementById('stats-close').addEventListener('click', () => statsModal.classList.add('hidden'));
statsModal.addEventListener('click', (e) => { if (e.target === statsModal) statsModal.classList.add('hidden'); });

function renderRoomStats(s) {
  statsBody.textContent = '';
  const tiles = document.createElement('div');
  tiles.className = 'stats-tiles';
  for (const [n, label] of [[s.today, 'messages today'], [s.week, 'this week'], [s.people30, 'people this month']]) {
    const t = document.createElement('div');
    t.className = 'stats-tile';
    const b = document.createElement('b');
    b.textContent = Number(n || 0).toLocaleString();
    const sp = document.createElement('span');
    sp.textContent = label;
    t.append(b, sp);
    tiles.appendChild(t);
  }
  statsBody.appendChild(tiles);

  const h = (text) => { const el = document.createElement('h3'); el.textContent = text; statsBody.appendChild(el); };
  h('🏆 Top chatters this week');
  if (!s.topChatters.length) {
    const p = document.createElement('p'); p.className = 'search-status'; p.textContent = 'Nobody has said anything this week yet.'; statsBody.appendChild(p);
  }
  const max = Math.max(1, ...s.topChatters.map((c) => c.n));
  s.topChatters.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'stats-row';
    const name = document.createElement('span');
    name.className = 'stats-name';
    name.textContent = `${['🥇', '🥈', '🥉', '4.', '5.'][i]} ${c.name}`;
    const barWrap = document.createElement('div');
    const bar = document.createElement('div');
    bar.className = 'stats-bar';
    bar.style.width = `${(c.n / max) * 100}%`;
    barWrap.appendChild(bar);
    const n = document.createElement('span');
    n.className = 'stats-n';
    n.textContent = c.n;
    row.append(name, barWrap, n);
    statsBody.appendChild(row);
  });

  // Shift UTC hour buckets into this browser's local time.
  const offsetH = -new Date().getTimezoneOffset() / 60;
  const local = Array(24).fill(0);
  s.hoursUtc.forEach((n, utcH) => { local[((Math.round(utcH + offsetH) % 24) + 24) % 24] += n; });
  const peak = local.indexOf(Math.max(...local));
  const fmtHour = (hr) => new Date(2000, 0, 1, hr).toLocaleTimeString([], { hour: 'numeric' });
  h(`⏰ Busiest time (last 30 days)${Math.max(...local) ? `: around ${fmtHour(peak)}` : ''}`);
  const hours = document.createElement('div');
  hours.className = 'stats-hours';
  const hmax = Math.max(1, ...local);
  local.forEach((n, hr) => {
    const bar = document.createElement('div');
    bar.style.height = `${(n / hmax) * 100}%`;
    bar.title = `${fmtHour(hr)}: ${n} message${n === 1 ? '' : 's'}`;
    hours.appendChild(bar);
  });
  statsBody.appendChild(hours);
  const labels = document.createElement('div');
  labels.className = 'stats-hours-labels';
  for (const hr of [0, 6, 12, 18, 23]) { const sp = document.createElement('span'); sp.textContent = fmtHour(hr); labels.appendChild(sp); }
  statsBody.appendChild(labels);

  if (s.topReactions.length) {
    h('😀 Favorite reactions');
    const wrap = document.createElement('div');
    wrap.className = 'stats-reactions';
    for (const r of s.topReactions) {
      const sp = document.createElement('span');
      const custom = r.emoji.match(/^:([a-z0-9_]{2,20}):$/);
      if (custom && roomEmojis.has(custom[1])) sp.appendChild(makeCustomEmojiImg(custom[1]));
      else sp.appendChild(document.createTextNode(r.emoji));
      const small = document.createElement('small');
      small.textContent = `×${r.n}`;
      sp.appendChild(small);
      wrap.appendChild(sp);
    }
    statsBody.appendChild(wrap);
  }
  if (s.mostLoved && s.mostLoved.length) {
    h('🌟 Most-loved messages this week');
    for (const m of s.mostLoved) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'stats-loved';
      const who = document.createElement('span');
      who.className = 'stats-loved-meta';
      who.textContent = `${m.name} · ${m.n} reaction${m.n === 1 ? '' : 's'}`;
      const t = document.createElement('span');
      t.className = 'stats-loved-text';
      t.textContent = hideSpoilerText(m.text);
      row.append(who, t);
      row.addEventListener('click', () => { statsModal.classList.add('hidden'); jumpToMessage(m.id); });
      statsBody.appendChild(row);
    }
  }
  const foot = document.createElement('p');
  foot.className = 'search-status';
  foot.textContent = `${Number(s.total).toLocaleString()} messages all time${s.firstMessageAt ? ` · first one on ${new Date(s.firstMessageAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}` : ''}`;
  statsBody.appendChild(foot);
}


// --- Per-room drafts ---
function draftKey(code) { return `valk-draft:${code}`; }
// The room the composer's current text belongs to (currentRoomCode changes first on a switch).
let draftRoomCode = null;
function loadDraft(code) {
  try { return localStorage.getItem(draftKey(code)) || ''; } catch (err) { return ''; }
}
let draftTimer = null;
function saveDraftNow() {
  clearTimeout(draftTimer);
  if (!draftRoomCode) return;
  try {
    const v = messageInput.value;
    if (v.trim()) localStorage.setItem(draftKey(draftRoomCode), v.slice(0, 2000));
    else localStorage.removeItem(draftKey(draftRoomCode));
  } catch (err) { /* storage full / private mode */ }
}
function scheduleDraftSave() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraftNow, 400);
}
window.addEventListener('pagehide', saveDraftNow);


// --- :emoji autocomplete — type ":fire" and pick 🔥 (or a room's own :custom: emoji) ---
const EMOJI_SHORTCODES = {
  smile: '😄', grin: '😁', joy: '😂', rofl: '🤣', laugh: '😆', sweat_smile: '😅', wink: '😉', blush: '😊',
  innocent: '😇', heart_eyes: '😍', star_struck: '🤩', kiss: '😘', yum: '😋', tongue: '😛', crazy: '🤪',
  thinking: '🤔', shush: '🤫', zipper: '🤐', neutral: '😐', expressionless: '😑', smirk: '😏', unamused: '😒',
  eyeroll: '🙄', grimace: '😬', relieved: '😌', pensive: '😔', sleepy: '😪', sleeping: '😴', drool: '🤤',
  mask: '😷', sick: '🤢', vomit: '🤮', hot: '🥵', cold: '🥶', dizzy: '😵', mindblown: '🤯', cowboy: '🤠',
  party: '🥳', cool: '😎', nerd: '🤓', monocle: '🧐', confused: '😕', worried: '😟', frown: '☹️',
  open_mouth: '😮', hushed: '😯', astonished: '😲', flushed: '😳', pleading: '🥺', cry: '😢', sob: '😭',
  scream: '😱', angry: '😠', rage: '😡', skull: '💀', poop: '💩', clown: '🤡', ghost: '👻', alien: '👽',
  robot: '🤖', devil: '😈', cat: '🐱', dog: '🐶', fox: '🦊', panda: '🐼', frog: '🐸', monkey: '🐵',
  see_no_evil: '🙈', unicorn: '🦄', dragon: '🐉', shark: '🦈', snake: '🐍', turtle: '🐢', bee: '🐝',
  heart: '❤️', orange_heart: '🧡', yellow_heart: '💛', green_heart: '💚', blue_heart: '💙', purple_heart: '💜',
  black_heart: '🖤', broken_heart: '💔', sparkling_heart: '💖', hundred: '💯', fire: '🔥', sparkles: '✨',
  star: '⭐', boom: '💥', zap: '⚡', rainbow: '🌈', sun: '☀️', moon: '🌙', snowflake: '❄️', cloud: '☁️',
  thumbsup: '👍', thumbsdown: '👎', ok: '👌', clap: '👏', wave: '👋', pray: '🙏', muscle: '💪', fist: '✊',
  punch: '👊', v: '✌️', crossed_fingers: '🤞', point_up: '☝️', point_right: '👉', eyes: '👀', brain: '🧠',
  raised_hands: '🙌', shrug: '🤷', facepalm: '🤦', salute: '🫡', handshake: '🤝', writing: '✍️',
  pizza: '🍕', burger: '🍔', fries: '🍟', taco: '🌮', popcorn: '🍿', cake: '🎂', cookie: '🍪', donut: '🍩',
  icecream: '🍦', candy: '🍬', apple: '🍎', banana: '🍌', watermelon: '🍉', coffee: '☕', boba: '🧋',
  tada: '🎉', confetti: '🎊', gift: '🎁', balloon: '🎈', trophy: '🏆', medal: '🏅', crown: '👑', gem: '💎',
  money: '💰', moneybag: '💰', rocket: '🚀', car: '🚗', plane: '✈️', soccer: '⚽', basketball: '🏀',
  football: '🏈', game: '🎮', controller: '🎮', dice: '🎲', music: '🎵', guitar: '🎸', microphone: '🎤',
  headphones: '🎧', camera: '📷', phone: '📱', laptop: '💻', bulb: '💡', book: '📖', pencil: '✏️',
  lock: '🔒', key: '🔑', bell: '🔔', check: '✅', x: '❌', warning: '⚠️', question: '❓', exclamation: '❗',
  stop: '🛑', clock: '⏰', hourglass: '⏳', calendar: '📅', pin: '📌', link: '🔗', bomb: '💣', sword: '⚔️',
  shield: '🛡️', magic: '🪄', earth: '🌍', mountain: '⛰️', tree: '🌳', flower: '🌸', rose: '🌹', sunflower: '🌻',
  cactus: '🌵', mushroom: '🍄', snowman: '⛄', christmas_tree: '🎄', jackolantern: '🎃', goat: '🐐',
  cap: '🧢', sus: '🤨', raised_eyebrow: '🤨', melting: '🫠', saluting: '🫡', nail_care: '💅', moai: '🗿',
};
const EMOJI_NAMES = Object.keys(EMOJI_SHORTCODES);

function currentEmojiQuery() {
  const cursor = messageInput.selectionStart;
  const m = messageInput.value.slice(0, cursor).match(/(?:^|\s):([a-z0-9_+-]{2,20})$/i);
  return m ? m[1].toLowerCase() : null;
}

function updateEmojiSuggestions() {
  const q = currentEmojiQuery();
  if (!q) return false;
  const custom = [...roomEmojis.keys()].filter((n) => n.includes(q)).sort((a, b) => a.indexOf(q) - b.indexOf(q)).slice(0, 4)
    .map((n) => ({ name: n, custom: true }));
  const builtIn = EMOJI_NAMES.filter((n) => n.includes(q))
    .sort((a, b) => (a.startsWith(q) ? 0 : 1) - (b.startsWith(q) ? 0 : 1) || a.length - b.length)
    .slice(0, 6 - custom.length).map((n) => ({ name: n, char: EMOJI_SHORTCODES[n] }));
  const matches = [...custom, ...builtIn];
  if (!matches.length) return false;
  mentionDropdownEl.innerHTML = '';
  for (const mt of matches) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'mention-dropdown-item emoji-suggest-item';
    item.dataset.insert = mt.custom ? `:${mt.name}:` : mt.char;
    const icon = mt.custom ? makeCustomEmojiImg(mt.name) : document.createElement('b');
    if (!mt.custom) icon.textContent = mt.char;
    const label = document.createElement('span');
    label.textContent = `:${mt.name}:`;
    item.append(icon, label);
    item.addEventListener('mousedown', (e) => { e.preventDefault(); insertEmojiSuggestion(item.dataset.insert); });
    mentionDropdownEl.appendChild(item);
  }
  mentionDropdownEl.classList.remove('hidden');
  highlightMentionItem(0);
  return true;
}

function insertEmojiSuggestion(text) {
  const value = messageInput.value;
  const cursor = messageInput.selectionStart;
  const before = value.slice(0, cursor).replace(/:([a-z0-9_+-]{2,20})$/i, `${text} `);
  messageInput.value = before + value.slice(cursor);
  mentionDropdownEl.classList.add('hidden');
  mentionHighlightIndex = -1;
  messageInput.setSelectionRange(before.length, before.length);
  messageInput.focus();
  autoGrowComposer();
  scheduleDraftSave();
}


// --- Mentions inbox ---
const mentionsModal = document.getElementById('mentions-modal');
const mentionsList = document.getElementById('mentions-list');
document.getElementById('mentions-btn').addEventListener('click', () => {
  closeMenu();
  mentionsList.innerHTML = '<li class="search-status">Loading…</li>';
  mentionsModal.classList.remove('hidden');
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'get-mentions' }));
});
document.getElementById('mentions-close').addEventListener('click', () => mentionsModal.classList.add('hidden'));
mentionsModal.addEventListener('click', (e) => { if (e.target === mentionsModal) mentionsModal.classList.add('hidden'); });

function renderMentions(list) {
  mentionsList.textContent = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'search-status';
    li.textContent = accountToken
      ? 'Nobody has @mentioned you in the last 30 days.'
      : 'Nobody has @mentioned you here in the last 30 days. (Sign in to see mentions from all your rooms.)';
    mentionsList.appendChild(li);
    return;
  }
  for (const m of list) {
    const li = document.createElement('li');
    const meta = document.createElement('div');
    meta.className = 'mention-meta';
    const where = m.roomCode === currentRoomCode ? 'this room' : (m.roomName ? `${m.roomName} (${m.roomCode})` : m.roomCode);
    meta.textContent = `${m.name} · ${where} · ${formatReminderDue(m.at)}`;
    const text = document.createElement('div');
    text.className = 'mention-text';
    text.appendChild(renderTextWithMentions(hideSpoilerText(m.text)));
    li.append(meta, text);
    li.addEventListener('click', () => {
      mentionsModal.classList.add('hidden');
      if (m.roomCode === currentRoomCode) { jumpToMessage(m.id); return; }
      pendingLinkMsgId = m.id;
      pendingLinkRoom = m.roomCode;
      joinFriendRoom(m.roomCode);
    });
    mentionsList.appendChild(li);
  }
}


// --- /countdown timers: tick once a second while any are on screen ---
let countdownTicker = null;
function tickCountdown(clock) {
  const left = Number(clock.dataset.endsAt) - Date.now();
  if (left <= 0) {
    if (!clock.classList.contains('done')) {
      clock.classList.add('done');
      clock.textContent = "🎉 Time's up!";
      // Only chime for countdowns that finish while you're watching (not old ones in history).
      if (clock.dataset.live === '1' && left > -3000) { try { playNotifySound(); } catch (err) { /* ignore */ } }
    }
    return false;
  }
  clock.dataset.live = '1';
  const s = Math.ceil(left / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  clock.textContent = `⏳ ${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(sec).padStart(2, '0')}`;
  return true;
}
function ensureCountdownTicker() {
  if (countdownTicker) return;
  countdownTicker = setInterval(() => {
    let any = false;
    document.querySelectorAll('.countdown-clock:not(.done)').forEach((c) => { if (tickCountdown(c)) any = true; });
    if (!any) { clearInterval(countdownTicker); countdownTicker = null; }
  }, 1000);
}


// --- Phones: swipe a message right to reply, double-tap it to ❤️ ---
function messageDataFromEl(msgEl) {
  const row = msgEl && msgEl.querySelector('.message-actions');
  return row ? messageActionData.get(row) : null;
}
let swipe = null;
let lastTap = { id: null, at: 0 };
messagesEl.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) { swipe = null; return; }
  const msgEl = e.target.closest('.message');
  // Swipes may start anywhere on the bubble (the action-button row covers a lot of it on phones);
  // double-taps only count on the message itself, not on a button/link/player.
  if (!msgEl || msgEl.dataset.deleted || e.target.closest('input, textarea, video, audio, .poll-card, .fenced-code, .edit-message-form')) { swipe = null; return; }
  const t = e.touches[0];
  swipe = { el: msgEl, bubble: msgEl.querySelector('.bubble'), x: t.clientX, y: t.clientY, dx: 0, locked: null, onControl: !!e.target.closest('button, a, .spoiler') };
}, { passive: true });
messagesEl.addEventListener('touchmove', (e) => {
  if (!swipe || !swipe.bubble) return;
  const t = e.touches[0];
  const dx = t.clientX - swipe.x;
  const dy = t.clientY - swipe.y;
  if (swipe.locked === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) swipe.locked = Math.abs(dx) > Math.abs(dy) * 1.3 && dx > 0 ? 'x' : 'y';
  if (swipe.locked !== 'x') return;
  swipe.dx = Math.max(0, Math.min(90, dx));
  swipe.bubble.style.transform = `translateX(${swipe.dx}px)`;
  swipe.bubble.style.transition = 'none';
}, { passive: true });
messagesEl.addEventListener('touchend', (e) => {
  if (!swipe) return;
  const s = swipe;
  swipe = null;
  if (s.bubble) {
    s.bubble.style.transition = 'transform 0.18s ease';
    s.bubble.style.transform = '';
  }
  if (s.locked === 'x' && s.dx > 60) {
    const data = messageDataFromEl(s.el);
    if (data && !roomHostsOnlyLocked()) { setReplyingTo(data); messageInput.focus(); if (navigator.vibrate) navigator.vibrate(10); }
    return;
  }
  if (s.locked !== null || s.onControl) return;
  // A tap that didn't move: two quick taps on the same message = ❤️.
  const id = s.el.dataset.messageId;
  const now = Date.now();
  if (id && lastTap.id === id && now - lastTap.at < 320) {
    lastTap = { id: null, at: 0 };
    if (e.cancelable) e.preventDefault();
    // Double-tap only ever adds a heart (like Instagram) — tap the ❤️ pill to take it back.
    const hearts = reactionsByMessage.get(id) && reactionsByMessage.get(id).get('❤️');
    if (!(hearts && myProfile && hearts.has(myProfile.name))) toggleReaction(id, '❤️');
    const heart = document.createElement('span');
    heart.className = 'double-tap-heart';
    heart.textContent = '❤️';
    s.bubble && s.bubble.appendChild(heart);
    setTimeout(() => heart.remove(), 700);
  } else {
    lastTap = { id, at: now };
  }
});
function roomHostsOnlyLocked() { return roomHostsOnly && !isMod(); }


// --- Forward a message to a friend (as a private DM) ---
const forwardModal = document.getElementById('forward-modal');
const forwardList = document.getElementById('forward-list');
document.getElementById('forward-close').addEventListener('click', () => forwardModal.classList.add('hidden'));
forwardModal.addEventListener('click', (e) => { if (e.target === forwardModal) forwardModal.classList.add('hidden'); });

function forwardText(data) {
  const where = currentRoomName ? `${currentRoomName} (${currentRoomCode})` : currentRoomCode;
  let body = data.text || '';
  if (data.kind === 'me') body = `* ${data.name} ${body}`;
  if (data.mediaUrl) body = `${body ? body + '\n' : ''}${location.origin}${data.mediaUrl}`;
  const link = data.id ? `\n${location.origin}/?room=${encodeURIComponent(currentRoomCode)}&msg=${encodeURIComponent(data.id)}` : '';
  return `↪️ ${data.name} in ${where}:\n${body}${link}`.slice(0, 500);
}

async function openForward(data) {
  if (!accountToken) { showAppToast('Sign in to forward messages to friends'); return; }
  const preview = document.getElementById('forward-preview');
  preview.textContent = (data.text || (data.mediaUrl ? '(photo/video)' : '')).slice(0, 160);
  forwardList.innerHTML = '<li class="search-status">Loading friends…</li>';
  forwardModal.classList.remove('hidden');
  let friends = [];
  try {
    const res = await fetch('/friends', { headers: { Authorization: `Bearer ${accountToken}` } });
    if (res.ok) friends = (await res.json()).friends || [];
  } catch (err) { /* offline */ }
  forwardList.textContent = '';
  if (!friends.length) {
    const li = document.createElement('li');
    li.className = 'search-status';
    li.textContent = 'No friends yet — add some from 👥 Friends.';
    forwardList.appendChild(li);
    return;
  }
  for (const f of friends) {
    const li = document.createElement('li');
    li.setAttribute('role', 'button');
    li.tabIndex = 0;
    const name = document.createElement('span');
    name.textContent = f.username;
    const go = document.createElement('span');
    go.className = 'sw-code';
    go.textContent = 'Send ↪️';
    li.append(name, go);
    const send = () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) { showAppToast("Not connected — it wasn't sent."); return; }
      ws.send(JSON.stringify({ type: 'friend-dm', toUsername: f.username, text: forwardText(data) }));
      forwardModal.classList.add('hidden');
      showAppToast(`↪️ Forwarded to ${f.username}`);
    };
    li.addEventListener('click', send);
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    forwardList.appendChild(li);
  }
}


// --- ⋯ More menu on messages: copy text, copy link, forward, read aloud ---
let openMore = null;
function closeMoreMenu() { if (openMore) { openMore.remove(); openMore = null; } }
document.addEventListener('click', (e) => { if (openMore && !openMore.contains(e.target)) closeMoreMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMoreMenu(); });

function copyToClipboard(text, okMsg) {
  const done = () => showAppToast(okMsg);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => prompt('Copy this:', text));
  else prompt('Copy this:', text);
}

function speakMessage(data) {
  if (!('speechSynthesis' in window)) { showAppToast("This browser can't read messages aloud"); return; }
  speechSynthesis.cancel();
  let text = data.text || '';
  if (data.mediaType === 'poll') { try { const p = JSON.parse(text); text = `Poll: ${p.question}. Options: ${p.options.join(', ')}`; } catch (err) { text = 'A poll'; } }
  text = hideSpoilerText(text).replace(/```[\s\S]*?```/g, ' (code) ').replace(/https?:\/\/\S+/g, ' (link) ');
  const u = new SpeechSynthesisUtterance(`${data.name} says: ${text || (data.mediaType ? `a ${data.mediaType}` : '')}`);
  u.rate = 1;
  speechSynthesis.speak(u);
}

function openMoreMenu(anchor, data) {
  const wasOpenHere = openMore && openMore.dataset.for === (data.id || '');
  closeMoreMenu();
  if (wasOpenHere) return;
  const menu = document.createElement('div');
  menu.className = 'more-menu';
  menu.dataset.for = data.id || '';
  menu.setAttribute('role', 'menu');
  const item = (label, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.textContent = label;
    b.addEventListener('click', (e) => { e.stopPropagation(); closeMoreMenu(); fn(); });
    menu.appendChild(b);
  };
  if (data.text && data.mediaType !== 'poll') item('📋 Copy text', () => copyToClipboard(data.text, '📋 Copied'));
  if (data.id) item('🔗 Copy link to message', () => copyToClipboard(`${location.origin}/?room=${encodeURIComponent(currentRoomCode)}&msg=${encodeURIComponent(data.id)}`, '🔗 Link copied — anyone in this room can open it'));
  if (accountToken && data.mediaType !== 'poll') item('↪️ Forward to a friend', () => openForward(data));
  if (data.text || data.mediaType === 'poll') item('🔊 Read aloud', () => speakMessage(data));
  if (data.id) {
    const remindText = () => {
      let t = data.text || (data.mediaType ? `a ${data.mediaType}` : 'a message');
      if (data.mediaType === 'poll') { try { t = `poll: ${JSON.parse(data.text).question}`; } catch (err) { t = 'a poll'; } }
      return `${data.name}'s message: ${hideSpoilerText(t)}`.slice(0, 200);
    };
    item('⏰ Remind me in 1 hour', () => ws.send(JSON.stringify({ type: 'set-reminder', text: remindText(), inMs: 60 * 60 * 1000 })));
    item('⏰ Remind me tomorrow', () => ws.send(JSON.stringify({ type: 'set-reminder', text: remindText(), inMs: 24 * 60 * 60 * 1000 })));
  }
  if (data.mediaUrl && data.mediaType !== 'poll') {
    item('⬇️ Download', () => {
      const a = document.createElement('a');
      a.href = data.mediaUrl;
      a.download = data.mediaUrl.split('/').pop() || 'file';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }
  // Fixed to the viewport (some bubbles clip overflow), placed above the ⋯ button when there's
  // room, otherwise below, and kept inside the screen edges.
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw));
  const top = r.top - mh - 6 >= 8 ? r.top - mh - 6 : Math.min(window.innerHeight - mh - 8, r.bottom + 6);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  openMore = menu;
  const first = menu.querySelector('button');
  if (first) first.focus();
}
messagesEl.addEventListener('scroll', () => closeMoreMenu(), { passive: true });


// --- Group back-to-back messages from the same person (within 3 minutes): the name line shows
// once at the top of the run and the avatar once at the bottom, like most chat apps. ---
const GROUP_WINDOW_MS = 3 * 60 * 1000;
function sameGroup(prev, el) {
  return !!(prev && prev.classList && prev.classList.contains('message') && !prev.classList.contains('blocked-hidden')
    && !el.classList.contains('blocked-hidden')
    && prev.dataset.senderName === el.dataset.senderName
    && Math.abs(Number(el.dataset.at) - Number(prev.dataset.at)) < GROUP_WINDOW_MS);
}
function groupWithPrevious(el) {
  const prev = el.previousElementSibling;
  const grouped = sameGroup(prev, el);
  el.classList.toggle('group-cont', grouped);
  if (grouped) {
    prev.classList.add('group-has-next');
    const bubble = el.querySelector('.bubble');
    if (bubble && !bubble.title) bubble.title = new Date(Number(el.dataset.at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
function regroupAllMessages() {
  const all = messagesEl.querySelectorAll('.message');
  all.forEach((el) => el.classList.remove('group-cont', 'group-has-next'));
  all.forEach((el) => groupWithPrevious(el));
}


// --- Keyword alerts (this device only) ---
const keywordInput = document.getElementById('keyword-alerts-input');
let keywordAlerts = [];
function loadKeywordAlerts() {
  let raw = '';
  try { raw = localStorage.getItem('valk-keyword-alerts') || ''; } catch (err) { /* ignore */ }
  keywordInput.value = raw;
  keywordAlerts = raw.split(',').map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 2).slice(0, 20);
}
function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
// Returns the matched keyword (whole words, any case) or ''.
function matchesKeywordAlert(text) {
  if (!text || !keywordAlerts.length) return '';
  const plain = hideSpoilerText(text).toLowerCase();
  for (const k of keywordAlerts) {
    if (new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(k)}($|[^\\p{L}\\p{N}])`, 'u').test(plain)) return k;
  }
  return '';
}
keywordInput.addEventListener('change', () => {
  try { localStorage.setItem('valk-keyword-alerts', keywordInput.value.slice(0, 200)); } catch (err) { /* ignore */ }
  loadKeywordAlerts();
  showAppToast(keywordAlerts.length ? `🔎 You'll be alerted for: ${keywordAlerts.join(', ')}` : '🔎 Keyword alerts off');
});
loadKeywordAlerts();


// /wyr — posts a random "Would you rather…" as a two-option poll.
const WYR_QUESTIONS = [
  ['be able to fly', 'be invisible'], ['live in a treehouse', 'live in a submarine'],
  ['have a pet dragon', 'have a pet robot'], ['only eat pizza forever', 'only eat tacos forever'],
  ['be really fast', 'be really strong'], ['talk to animals', 'speak every language'],
  ['explore space', 'explore the deep ocean'], ['never have homework', 'never have chores'],
  ['be a famous gamer', 'be a famous musician'], ['have summer all year', 'have winter all year'],
  ['ride a giant cat', 'ride a tiny horse'], ['have a rewind button', 'have a pause button for life'],
  ['always be 10 minutes early', 'always be 10 minutes late'], ['live in a castle', 'live in a spaceship'],
  ['have super hearing', 'have night vision'], ['be the funniest person', 'be the smartest person'],
  ['eat a bug', 'sing in front of the whole school'], ['have a personal chef', 'have a personal driver'],
  ['go back to the dinosaurs', 'go forward 1000 years'], ['never use a phone again', 'never watch TV again'],
  ['have unlimited snacks', 'have unlimited games'], ['be a wizard', 'be a superhero'],
  ['live on the moon', 'live under the sea'], ['have hands for feet', 'have feet for hands'],
  ['know every song', 'know every movie by heart'], ['have a slide instead of stairs', 'have a trampoline floor'],
  ['teleport anywhere', 'read minds'], ['be a cat for a day', 'be a dog for a day'],
  ['have a snowball fight', 'have a water balloon fight'], ['build a giant LEGO city', 'build a giant snow fort'],
  ['be in a movie', 'be in a video game'], ['only whisper', 'only shout'],
  ['have rainbow hair', 'have glow-in-the-dark skin'], ['win a cooking contest', 'win a dance contest'],
  ['have a robot best friend', 'have an alien best friend'], ['never get tired', 'never get hungry'],
  ['live in a candy house', 'live in a bouncy castle'], ['find a treasure map', 'find a magic wand'],
  ['be a pro skateboarder', 'be a pro snowboarder'], ['shrink to ant size', 'grow to giant size'],
];


// --- Room color (host picks; everyone sees it) ---
const accentSelect = document.getElementById('accent-select');
function applyRoomAccent(accent) {
  if (accent) chatScreen.dataset.accent = accent;
  else delete chatScreen.dataset.accent;
  accentSelect.value = accent || '';
}
accentSelect.addEventListener('change', () => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'set-accent', accent: accentSelect.value || null }));
});


// --- Offline outbox: messages typed while disconnected send themselves on reconnect ---
function outboxKey(code) { return `valk-outbox:${code}`; }
function readOutbox(code) {
  try { return JSON.parse(localStorage.getItem(outboxKey(code)) || '[]'); } catch (err) { return []; }
}
function writeOutbox(code, list) {
  try {
    if (list.length) localStorage.setItem(outboxKey(code), JSON.stringify(list.slice(0, 20)));
    else localStorage.removeItem(outboxKey(code));
  } catch (err) { /* ignore */ }
}
function renderPendingBubble(item) {
  const el = document.createElement('div');
  el.className = 'message own pending-message';
  el.dataset.pendingId = item.id;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = '⏳ Waiting to send — will go out when you’re back online';
  const text = document.createElement('span');
  text.className = 'text';
  text.textContent = item.text;
  bubble.append(meta, text);
  el.appendChild(bubble);
  messagesEl.appendChild(el);
  scrollToBottom();
}
function queueOutbox(text) {
  const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: text.slice(0, 2000), replyTo: replyingTo ? replyingTo.id : null, at: Date.now() };
  const list = readOutbox(currentRoomCode);
  if (list.length >= 20) { showAppToast('Too many messages waiting — wait until you’re back online.'); return; }
  list.push(item);
  writeOutbox(currentRoomCode, list);
  renderPendingBubble(item);
  showAppToast('📴 Offline — your message will send when you’re reconnected');
}
function flushOutbox(code) {
  const list = readOutbox(code);
  if (!list.length || !ws || ws.readyState !== WebSocket.OPEN) return;
  writeOutbox(code, []);
  messagesEl.querySelectorAll('.pending-message').forEach((el) => el.remove());
  // Spaced out so a burst doesn't trip the server's flood limit.
  list.forEach((item, i) => setTimeout(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN || currentRoomCode !== code) { writeOutbox(code, [...readOutbox(code), item]); return; }
    const payload = { type: 'message', text: item.text };
    if (item.replyTo) payload.replyTo = item.replyTo;
    ws.send(JSON.stringify(payload));
  }, i * 900));
  showAppToast(`📶 Back online — sending ${list.length} waiting message${list.length === 1 ? '' : 's'}`);
}


// --- ✨ What's new (shown once per update to people who've used Valk before) ---
const WHATS_NEW_VERSION = '2026-11-09';
const WHATS_NEW = [
  ['⌨️', 'Type Race', 'A new game! Everyone types the same sentence — fastest fingers win. Menu → ⌨️ Play Type Race.'],
  ['🛡️', 'Co-hosts', 'Hosts can tap ⭐ next to someone to make them a co-host who helps moderate.'],
  ['📊', 'Better polls', 'Pick-several polls, polls that end on a timer, and /wyr for a random "Would you rather".'],
  ['🎲', 'Fun commands', '/roll, /flip, /8ball, /pick pizza or tacos, /countdown 5m, /me waves, /later 1h text.'],
  ['⌨️', 'Command list', 'Type / in the message box to see every command.'],
  ['🎉', 'Screen effects', '/confetti Happy birthday! — also /hearts, /snow and /stars rain on everyone’s screen.'],
  ['⬆️', 'Scroll back forever', 'Scroll up to load older messages. Search, pins and replies jump to any message.'],
  ['🖼️', 'Photos', 'Tap a photo to zoom. Paste or drag photos in, add a caption, send up to 10 at once.'],
  ['▶️', 'YouTube in chat', 'YouTube links play right inside the chat.'],
  ['📱', 'Phone tricks', 'Swipe a message right to reply, double-tap to ❤️.'],
  ['🔕', 'Your notifications', 'Per-room: every message, only @mentions, or muted. Plus 🔎 keyword alerts.'],
  ['🎨', 'Room colors', 'Hosts can pick a color for the room (menu → 🎨 Room color).'],
  ['＠', 'Mentions inbox', 'Menu → ＠ Mentions of me shows everyone who @mentioned you.'],
  ['📈', 'Room stats', 'Top chatters, busiest times and the most-loved messages this week.'],
  ['💻', 'Code blocks', 'Wrap code in ``` to get a box with a Copy button. Shift+Enter for a new line.'],
  ['🔥', 'Streaks & About me', 'Profile cards show your chat streak and an "about me" you can write.'],
  ['⭐', 'Make your own stickers', 'Open 🙂 stickers → ＋ under My stickers to turn any photo into a sticker.'],
  ['📨', 'Invite friends', 'In 👥 Friends, tap 📨 to invite a friend to the room you’re in.'],
  ['🎮', 'Game invites', 'Type /play typerace (or chess, trivia, wordle…) to call the room to a game. 🏆 Room champions shows the top players.'],
];
const whatsNewModal = document.getElementById('whats-new-modal');
function openWhatsNew() {
  const list = document.getElementById('whats-new-list');
  list.textContent = '';
  for (const [icon, title, desc] of WHATS_NEW) {
    const li = document.createElement('li');
    const ic = document.createElement('span');
    ic.className = 'wn-icon';
    ic.textContent = icon;
    const body = document.createElement('div');
    const t = document.createElement('b');
    t.textContent = title;
    const d = document.createElement('span');
    d.textContent = desc;
    body.append(t, d);
    li.append(ic, body);
    list.appendChild(li);
  }
  whatsNewModal.classList.remove('hidden');
  try { localStorage.setItem('valk-whats-new-seen', WHATS_NEW_VERSION); } catch (err) { /* ignore */ }
}
// Judged once at page load — joining a room saves a recent room, which would otherwise make a
// brand-new visitor look like a returning one a second later.
let wasReturningVisitor = false;
try {
  wasReturningVisitor = !!(localStorage.getItem(RECENT_ROOMS_KEY) || localStorage.getItem('valk-theme') || localStorage.getItem(ACCOUNT_TOKEN_KEY) || localStorage.getItem('valk-whats-new-seen'));
} catch (err) { /* storage blocked */ }
function maybeShowWhatsNew() {
  let seen = null;
  const returning = wasReturningVisitor;
  try {
    seen = localStorage.getItem('valk-whats-new-seen');
  } catch (err) { return; }
  if (seen === WHATS_NEW_VERSION) return;
  if (!returning) { try { localStorage.setItem('valk-whats-new-seen', WHATS_NEW_VERSION); } catch (err) { /* ignore */ } return; }
  if (!welcomeModal.classList.contains('hidden')) return; // don't stack on the room's welcome card
  openWhatsNew();
}
document.getElementById('whats-new-btn').addEventListener('click', () => { closeMenu(); openWhatsNew(); });
document.getElementById('whats-new-close').addEventListener('click', () => whatsNewModal.classList.add('hidden'));
whatsNewModal.addEventListener('click', (e) => { if (e.target === whatsNewModal) whatsNewModal.classList.add('hidden'); });


// --- 📜 Moderation log (host + co-hosts) ---
const modLogModal = document.getElementById('mod-log-modal');
const modLogList = document.getElementById('mod-log-list');
document.getElementById('mod-log-btn').addEventListener('click', () => {
  closeMenu();
  modLogList.innerHTML = '<li class="search-status">Loading…</li>';
  modLogModal.classList.remove('hidden');
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'get-mod-log' }));
});
document.getElementById('mod-log-close').addEventListener('click', () => modLogModal.classList.add('hidden'));
modLogModal.addEventListener('click', (e) => { if (e.target === modLogModal) modLogModal.classList.add('hidden'); });
const MOD_ACTION_TEXT = {
  kick: (e) => `⛔ kicked ${e.target}`,
  mute: (e) => `🔇 muted ${e.target}`,
  unmute: (e) => `🔊 unmuted ${e.target}`,
  ban: (e) => `🚫 banned ${e.target}`,
  unban: (e) => `✅ unbanned ${e.target || 'someone'}`,
  delete: (e) => `🗑️ deleted a message from ${e.target}${e.detail ? `: "${e.detail}"` : ''}`,
  'slow-mode': (e) => `🐢 set slow mode ${e.detail}`,
  'announcement-only': (e) => `📢 turned announcement-only ${e.detail}`,
  announcement: (e) => `📌 set the announcement: ${e.detail}`,
  'add-cohost': (e) => `⭐ made ${e.target} a co-host`,
  'remove-cohost': (e) => `☆ removed ${e.target} as co-host`,
  'word-filter': () => '🚫 changed the word filter',
};
function renderModLog(entries) {
  modLogList.textContent = '';
  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'search-status';
    li.textContent = 'Nothing yet — all quiet. 😌';
    modLogList.appendChild(li);
    return;
  }
  for (const e of entries) {
    const li = document.createElement('li');
    const when = document.createElement('span');
    when.className = 'eh-when';
    when.textContent = formatReminderDue(e.at);
    const what = document.createElement('span');
    const fmt = MOD_ACTION_TEXT[e.action];
    what.textContent = `${e.actor} ${fmt ? fmt(e) : e.action}`;
    li.append(when, what);
    modLogList.appendChild(li);
  }
}


// --- My stickers: turn any photo into a sticker (saved to your account) ---
const myStickersWrap = document.createElement('div');
myStickersWrap.className = 'my-stickers';
stickerPicker.appendChild(myStickersWrap);
const stickerFileInput = document.createElement('input');
stickerFileInput.type = 'file';
stickerFileInput.accept = 'image/*';
stickerFileInput.className = 'hidden';
document.body.appendChild(stickerFileInput);

function renderMyStickers(urls, signedOut) {
  myStickersWrap.textContent = '';
  const head = document.createElement('div');
  head.className = 'my-stickers-head';
  head.textContent = '⭐ My stickers';
  myStickersWrap.appendChild(head);
  if (signedOut || !accountToken) {
    const p = document.createElement('div');
    p.className = 'my-stickers-note';
    p.textContent = 'Sign in to make stickers from your own photos.';
    myStickersWrap.appendChild(p);
    return;
  }
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'sticker-option make-sticker-btn';
  add.title = 'Make a sticker from a photo';
  add.textContent = '＋';
  add.addEventListener('click', () => stickerFileInput.click());
  myStickersWrap.appendChild(add);
  for (const url of urls) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sticker-option';
    btn.title = 'Send (right-click or press and hold to remove)';
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'my sticker';
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) { showAppToast("Not connected — your sticker wasn't sent."); return; }
      sendMediaMessage(url, 'image');
      stickerPicker.classList.add('hidden');
    });
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (confirm('Remove this sticker from your collection? (Messages that already used it stay.)')) {
        ws.send(JSON.stringify({ type: 'remove-my-sticker', url }));
      }
    });
    myStickersWrap.appendChild(btn);
  }
}

// Square center-crop to 320px with rounded corners, saved as a WebP.
async function photoToSticker(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const size = 320;
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const r = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.arcTo(size, 0, size, size, r); ctx.arcTo(size, size, 0, size, r); ctx.arcTo(0, size, 0, 0, r); ctx.arcTo(0, 0, size, 0, r);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  if (bmp.close) bmp.close();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.9));
  return new File([blob], 'sticker.webp', { type: 'image/webp' });
}

stickerFileInput.addEventListener('change', async () => {
  const file = stickerFileInput.files[0];
  stickerFileInput.value = '';
  if (!file || !/^image\//.test(file.type)) return;
  try {
    showAppToast('✂️ Making your sticker…');
    const sticker = await photoToSticker(file);
    const fd = new FormData();
    fd.append('file', sticker, 'sticker.webp');
    const res = await fetch('/upload', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) { showAppToast(`Couldn't make the sticker: ${data.error || res.status}`); return; }
    ws.send(JSON.stringify({ type: 'add-my-sticker', url: data.url }));
    showAppToast('⭐ Sticker added to My stickers');
  } catch (err) {
    showAppToast("Couldn't read that picture — try a different one");
  }
});

// Press-and-hold on phones = right-click.
let stickerHold = null;
myStickersWrap.addEventListener('touchstart', (e) => {
  const btn = e.target.closest('.sticker-option:not(.make-sticker-btn)');
  if (!btn) return;
  stickerHold = setTimeout(() => btn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })), 600);
}, { passive: true });
['touchend', 'touchmove', 'touchcancel'].forEach((ev) => myStickersWrap.addEventListener(ev, () => clearTimeout(stickerHold), { passive: true }));

stickerBtn.addEventListener('click', () => {
  if (stickerPicker.classList.contains('hidden')) return;
  if (accountToken && ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'get-my-stickers' }));
  else renderMyStickers([], true);
});


function setThreadCount(bubble, messageId, n) {
  bubble.dataset.replyCount = String(n);
  let link = bubble.querySelector(':scope > .thread-count-link');
  if (!link) {
    link = document.createElement('button');
    link.type = 'button';
    link.className = 'thread-count-link';
    link.addEventListener('click', (e) => { e.stopPropagation(); openThread(messageId); });
    const actions = bubble.querySelector(':scope > .message-actions');
    if (actions) bubble.insertBefore(link, actions); else bubble.appendChild(link);
  }
  link.textContent = `💬 ${n} ${n === 1 ? 'reply' : 'replies'}`;
}


// --- 🎮 Game invites + 🏆 Room champions ---
const GAME_ALIASES = {
  typerace: ['type', 'typing', 'race'], wordguess: ['wordle', 'word', 'wg'], hangman: ['hang'], trivia: ['quiz'],
  pictionary: ['draw', 'drawing'], chess: [], tictactoe: ['ttt', 'xo', 'connect4', 'connectfour'], blockbattle: ['bb', 'block'],
  buildcraft: ['build', 'craft'], webswing: ['swing', 'spider'], firefight: ['fps', 'shooter'], fighterplane: ['plane', 'planes'],
  geometrywave: ['geometry', 'gw', 'dash'], stickfighter: ['stick', 'fight'], whiteboard: ['board', 'paint'], hello: [],
};
const GAME_LABELS = {
  typerace: '⌨️ Type Race (WPM)', wordguess: '🟩 Word Guess', hangman: '🪢 Hangman', trivia: '❓ Trivia', snake: '🐍 Snake',
  g2048: '🔢 2048', fighterplane: '🛩️ Fighter Plane', stickfighter: '🥊 Stick Fighter', sw: '🕸️ Web Swing', hello: '👋 Hello',
  bblevel: '🧱 Block Battle (level)', bbplaytime: '🧱 Block Battle (minutes played)', bbwave: '🧱 Block Battle (waves)',
  bbjuggernaut: '🧱 Block Battle (Juggernaut)', bboneshot: '🧱 Block Battle (One Shot)',
  'gw-easy': '🔺 Geometry Wave (easy)', 'gw-medium': '🔺 Geometry Wave (medium)', 'gw-hard': '🔺 Geometry Wave (hard)',
  'gw-straight': '🔺 Geometry Wave (straight)', 'tictactoe-tictactoe': '⭕ Tic-Tac-Toe', 'tictactoe-connect4': '🔴 Connect Four',
};

function renderGameInvite(data) {
  const el = document.createElement('div');
  el.className = 'system game-invite';
  const text = document.createElement('span');
  text.textContent = `🎮 ${data.from} wants to play ${data.label}!`;
  const join = document.createElement('a');
  join.className = 'game-invite-join';
  join.textContent = 'Join';
  const params = myProfile ? `?room=${encodeURIComponent(currentRoomCode)}&name=${encodeURIComponent(myProfile.name)}&pin=${encodeURIComponent(currentRoomPin || '')}` : '';
  join.href = `${data.page}${params}`;
  el.append(text, ' ', join);
  messagesEl.appendChild(el);
  maybeScrollToBottom();
}

const championsModal = document.getElementById('champions-modal');
document.getElementById('champions-btn').addEventListener('click', () => {
  closeMenu();
  document.getElementById('champions-body').innerHTML = '<p class="search-status">Loading…</p>';
  championsModal.classList.remove('hidden');
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'get-room-champions' }));
});
document.getElementById('champions-close').addEventListener('click', () => championsModal.classList.add('hidden'));
championsModal.addEventListener('click', (e) => { if (e.target === championsModal) championsModal.classList.add('hidden'); });

function renderChampions(games) {
  const body = document.getElementById('champions-body');
  body.textContent = '';
  const keys = Object.keys(games).sort((a, b) => (GAME_LABELS[a] || a).localeCompare(GAME_LABELS[b] || b));
  if (!keys.length) {
    const p = document.createElement('p');
    p.className = 'search-status';
    p.textContent = 'No scores in this room yet — play a game from the menu (or /play typerace) to get on the board!';
    body.appendChild(p);
    return;
  }
  for (const g of keys) {
    const sec = document.createElement('div');
    sec.className = 'champ-game';
    const h = document.createElement('div');
    h.className = 'champ-title';
    h.textContent = GAME_LABELS[g] || g;
    sec.appendChild(h);
    games[g].forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'champ-row';
      const n = document.createElement('span');
      n.textContent = `${['🥇', '🥈', '🥉'][i]} ${r.name}`;
      const sc = document.createElement('b');
      sc.textContent = Number(r.score).toLocaleString();
      row.append(n, sc);
      sec.appendChild(row);
    });
    body.appendChild(sec);
  }
}


// --- /confetti /hearts /snow /stars: a few seconds of falling things for everyone ---
const EFFECT_CHARS = { confetti: ['🎉', '🎊', '✨', '🟨', '🟦', '🟥', '🟩'], hearts: ['💖', '💗', '💕', '❤️', '💜'], snow: ['❄️', '❅', '❆', '⛄'], stars: ['⭐', '🌟', '✨', '💫'] };
let effectRunning = false;
function playScreenEffect(effect) {
  const chars = EFFECT_CHARS[effect];
  if (!chars || effectRunning) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  effectRunning = true;
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  layer.setAttribute('aria-hidden', 'true');
  const count = window.innerWidth < 600 ? 28 : 46;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'fx-piece';
    p.textContent = chars[Math.floor(Math.random() * chars.length)];
    p.style.left = `${Math.random() * 100}%`;
    p.style.fontSize = `${14 + Math.random() * 18}px`;
    p.style.animationDuration = `${2.4 + Math.random() * 2.2}s`;
    p.style.animationDelay = `${Math.random() * 1.2}s`;
    p.style.setProperty('--drift', `${(Math.random() - 0.5) * 120}px`);
    p.style.setProperty('--spin', `${(Math.random() - 0.5) * 720}deg`);
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => { layer.remove(); effectRunning = false; }, 5200);
}


// --- "/" command suggestions ---
const SLASH_COMMANDS = [
  ['/roll', '2d6', 'Roll dice (fair — rolled by Valk)'],
  ['/flip', '', 'Flip a coin'],
  ['/8ball', 'will it snow?', 'Ask the magic 8-ball'],
  ['/pick', 'pizza, tacos or sushi', 'Let Valk choose'],
  ['/me', 'waves', 'Say an action'],
  ['/countdown', '5m Lunch!', 'Live timer for everyone'],
  ['/confetti', 'Happy birthday!', 'Confetti on everyone’s screen'],
  ['/hearts', '', 'Hearts on everyone’s screen'],
  ['/snow', '', 'Snow on everyone’s screen'],
  ['/stars', '', 'Stars on everyone’s screen'],
  ['/wyr', '', 'Random "Would you rather…" poll'],
  ['/play', 'typerace', 'Invite the room to a game'],
  ['/later', '30m text', 'Send a message later'],
  ['/scheduled', '', 'See or cancel scheduled messages'],
  ['/remind', '10m feed the dog', 'Remind yourself'],
  ['/reminders', '', 'List your reminders'],
  ['/shrug', '', '¯\\_(ツ)_/¯'],
];
function updateCommandSuggestions() {
  const v = messageInput.value;
  const m = v.match(/^\/([a-z0-9]*)$/i);
  if (!m || messageInput.selectionStart !== v.length) return false;
  const q = m[1].toLowerCase();
  const matches = SLASH_COMMANDS.filter(([c]) => c.slice(1).startsWith(q)).slice(0, 20);
  if (!matches.length) return false;
  mentionDropdownEl.innerHTML = '';
  for (const [cmd, example, desc] of matches) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'mention-dropdown-item command-suggest-item';
    item.dataset.insert = `${cmd} `;
    item.dataset.command = '1';
    const c = document.createElement('code');
    c.textContent = example ? `${cmd} ${example}` : cmd;
    const d = document.createElement('span');
    d.textContent = desc;
    item.append(c, d);
    item.addEventListener('mousedown', (e) => { e.preventDefault(); insertCommandSuggestion(item.dataset.insert); });
    mentionDropdownEl.appendChild(item);
  }
  mentionDropdownEl.classList.remove('hidden');
  highlightMentionItem(0);
  return true;
}
function insertCommandSuggestion(text) {
  messageInput.value = text;
  mentionDropdownEl.classList.add('hidden');
  mentionHighlightIndex = -1;
  messageInput.setSelectionRange(text.length, text.length);
  messageInput.focus();
  autoGrowComposer();
}
