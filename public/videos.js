// ---------- Scorpture — a standalone YouTube-style video app living outside the room system.
// Same account/localStorage-token auth as Friends (see ACCOUNT_TOKEN_KEY in app.js) rather than
// the per-room display-name pattern the minigames use — videos/comments/likes/subscriptions are
// tied to a durable account, not an ephemeral room visit. Browsing/watching works signed out;
// uploading/commenting/liking/subscribing all require a sign-in (done from the main chat page —
// this page has no login form of its own, it just reads the token app.js already stored). ------

const ACCOUNT_TOKEN_KEY = 'valk-account-token';

const appEl = document.getElementById('app');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const uploadBtn = document.getElementById('upload-btn');
const uploadModal = document.getElementById('upload-modal');
const uploadCloseBtn = document.getElementById('upload-close-btn');
const fileDrop = document.getElementById('file-drop');
const fileDropLabel = document.getElementById('file-drop-label');
const uploadFileInput = document.getElementById('upload-file-input');
const uploadPreview = document.getElementById('upload-preview');
const uploadTitleInput = document.getElementById('upload-title-input');
const uploadDescriptionInput = document.getElementById('upload-description-input');
const uploadStatusEl = document.getElementById('upload-status');
const uploadSubmitBtn = document.getElementById('upload-submit-btn');
const accountNameEl = document.getElementById('account-name');
const accountSigninBtn = document.getElementById('account-signin-btn');
const toastEl = document.getElementById('toast');
const goLiveBtn = document.getElementById('golive-btn');
const goLiveModal = document.getElementById('golive-modal');
const goLiveCloseBtn = document.getElementById('golive-close-btn');
const goLiveHeader = document.getElementById('golive-header');
const goLivePreview = document.getElementById('golive-preview');
const goLiveTitleInput = document.getElementById('golive-title-input');
const goLiveSourceRow = document.getElementById('golive-source-row');
const goLiveRecordCheckbox = document.getElementById('golive-record-checkbox');
const goLiveChatContainer = document.getElementById('golive-chat-container');
const goLiveCameraBtn = document.getElementById('golive-camera-btn');
const goLiveScreenBtn = document.getElementById('golive-screen-btn');
const goLiveStatusEl = document.getElementById('golive-status');
const goLiveControls = document.getElementById('golive-live-controls');
const goLiveViewerCountEl = document.getElementById('golive-viewer-count');
const goLiveSwitchScreenBtn = document.getElementById('golive-switch-screen-btn');
const goLiveSwitchCameraBtn = document.getElementById('golive-switch-camera-btn');
const goLiveEndBtn = document.getElementById('golive-end-btn');

let currentAccount = null; // { username } | null
let pendingUpload = null; // { file, thumbnailBlob }

function getToken() {
  return localStorage.getItem(ACCOUNT_TOKEN_KEY) || '';
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = Object.assign({}, options.headers);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, Object.assign({}, options, { headers }));
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function timeAgo(ms) {
  const seconds = Math.max(0, (Date.now() - ms) / 1000);
  const units = [
    ['year', 31536000], ['month', 2592000], ['week', 604800],
    ['day', 86400], ['hour', 3600], ['minute', 60],
  ];
  for (const [name, secs] of units) {
    const v = Math.floor(seconds / secs);
    if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function initials(name) {
  return (name || '?').trim().slice(0, 1).toUpperCase();
}

// Shared by every avatar spot (video cards, watch page, channel page, live watch) — an uploaded
// picture if the channel has one, else the auto-generated initial-letter circle.
function avatarHtml(avatarUrl, name, extraClass) {
  const cls = `channel-avatar${extraClass ? ` ${extraClass}` : ''}`;
  if (avatarUrl) return `<img class="${cls}" src="${escapeHtml(avatarUrl)}" alt="">`;
  return `<span class="${cls}">${escapeHtml(initials(name))}</span>`;
}

let toastTimer = null;
function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2600);
}

// ---------- Auth header ----------
async function refreshAccount() {
  const token = getToken();
  if (!token) { currentAccount = null; renderAccountArea(); return; }
  try {
    const me = await api('/auth/me');
    currentAccount = me;
  } catch {
    currentAccount = null;
  }
  renderAccountArea();
}

function renderAccountArea() {
  if (currentAccount) {
    accountNameEl.textContent = `👤 ${currentAccount.username}`;
    accountNameEl.href = `#/channel?u=${encodeURIComponent(currentAccount.username)}`;
    accountNameEl.classList.remove('hidden');
    accountSigninBtn.classList.add('hidden');
  } else {
    accountNameEl.classList.add('hidden');
    accountSigninBtn.classList.remove('hidden');
  }
}

accountSigninBtn.addEventListener('click', () => { location.href = 'index.html'; });

function requireAccount() {
  if (currentAccount) return true;
  showToast('Sign in from the main Valk page first');
  return false;
}

// ---------- Router ----------
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [route, queryStr] = raw.split('?');
  const params = new URLSearchParams(queryStr || '');
  return { route: route || '', params };
}

window.addEventListener('hashchange', route);

async function route() {
  const { route: name, params } = parseHash();
  window.scrollTo(0, 0);
  // Leaving the watch-live page (navigating anywhere else) should tear down the viewer
  // connection — otherwise a dangling RTCPeerConnection and its server-side viewer entry would
  // outlive the page the user's actually looking at.
  if (name !== 'watch-live') stopWatching();
  if (name === 'watch') return renderWatch(params.get('v'));
  if (name === 'channel') return renderChannel(params.get('u'));
  if (name === 'search') return renderHome(params.get('q') || '');
  if (name === 'live') return renderLive();
  if (name === 'watch-live') return renderWatchLive(params.get('u'));
  return renderHome('');
}

// ---------- Video card ----------
function videoCardHtml(v) {
  const thumb = v.thumbnailUrl
    ? `<img src="${escapeHtml(v.thumbnailUrl)}" alt="">`
    : '🦂';
  return `
    <div class="video-card" data-id="${escapeHtml(v.id)}">
      <div class="video-thumb">${thumb}</div>
      <div class="video-card-row">
        ${avatarHtml(v.uploaderAvatarUrl, v.uploaderUsername, 'video-card-avatar')}
        <div>
          <div class="video-card-title">${escapeHtml(v.title)}</div>
          <div class="video-card-meta">
            <span class="video-card-channel">${escapeHtml(v.uploaderUsername)}</span>${v.uploaderLive ? ' <span class="live-dot">🔴 LIVE</span>' : ''}<br>
            ${formatCount(v.views)} views &middot; ${timeAgo(v.createdAt)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function wireVideoCards() {
  appEl.querySelectorAll('.video-card').forEach((card) => {
    card.addEventListener('click', () => { location.hash = `#/watch?v=${encodeURIComponent(card.dataset.id)}`; });
  });
}

// ---------- Home / search ----------
function liveCardHtml(s) {
  return `
    <div class="video-card live-card" data-username="${escapeHtml(s.username)}">
      <div class="video-thumb"><span class="live-badge">LIVE</span>🔴</div>
      <div class="video-card-title">${escapeHtml(s.title)}</div>
      <div class="live-card-meta">
        <span class="video-card-channel">${escapeHtml(s.username)}</span> &middot; ${formatCount(s.viewerCount)} watching
      </div>
    </div>
  `;
}

function wireLiveCards() {
  appEl.querySelectorAll('.live-card').forEach((card) => {
    card.addEventListener('click', () => { location.hash = `#/watch-live?u=${encodeURIComponent(card.dataset.username)}`; });
  });
}

async function renderHome(query) {
  searchInput.value = query || '';
  appEl.innerHTML = `<div class="state-msg">Loading videos…</div>`;
  try {
    const url = query ? `/api/scorpture/videos?search=${encodeURIComponent(query)}` : '/api/scorpture/videos';
    const [data, liveData] = await Promise.all([api(url), query ? Promise.resolve({ streams: [] }) : api('/api/scorpture/live').catch(() => ({ streams: [] }))]);

    let html = '';
    if (liveData.streams.length) {
      html += `<div class="live-section"><div class="live-section-heading">🔴 Live now</div><div class="video-grid">${liveData.streams.map(liveCardHtml).join('')}</div></div>`;
    }
    if (data.videos.length) {
      html += `<div class="video-grid">${data.videos.map(videoCardHtml).join('')}</div>`;
    } else if (!liveData.streams.length) {
      html += `<div class="state-msg">${query ? `No videos found for "${escapeHtml(query)}".` : 'No videos yet — be the first to upload one!'}</div>`;
    }
    appEl.innerHTML = html;
    wireVideoCards();
    wireLiveCards();
  } catch (err) {
    appEl.innerHTML = `<div class="state-msg">Couldn't load videos: ${escapeHtml(err.message)}</div>`;
  }
}

// ---------- Live browse page (#/live) ----------
async function renderLive() {
  appEl.innerHTML = `<div class="state-msg">Loading live streams…</div>`;
  try {
    const data = await api('/api/scorpture/live');
    if (!data.streams.length) {
      appEl.innerHTML = `<div class="state-msg">Nobody's live right now.</div>`;
      return;
    }
    appEl.innerHTML = `<div class="video-grid">${data.streams.map(liveCardHtml).join('')}</div>`;
    wireLiveCards();
  } catch (err) {
    appEl.innerHTML = `<div class="state-msg">Couldn't load live streams: ${escapeHtml(err.message)}</div>`;
  }
}

// ---------- Watch page ----------
async function renderWatch(id) {
  if (!id) return renderHome('');
  appEl.innerHTML = `<div class="state-msg">Loading video…</div>`;
  let video;
  try {
    video = await api(`/api/scorpture/videos/${encodeURIComponent(id)}`);
  } catch (err) {
    appEl.innerHTML = `<div class="state-msg">Couldn't load this video: ${escapeHtml(err.message)}</div>`;
    return;
  }

  appEl.innerHTML = `
    <div class="watch-layout">
      <div class="watch-player-wrap">
        <video src="${escapeHtml(video.videoUrl)}" controls autoplay playsinline></video>
      </div>
      <h1 class="watch-title">${escapeHtml(video.title)}</h1>
      <div class="watch-stats-row">
        <div class="watch-stats">${formatCount(video.views)} views &middot; ${timeAgo(video.createdAt)}</div>
        <div class="watch-actions">
          <button id="like-btn" class="pill-btn like-btn${video.liked ? ' liked' : ''}">👍 <span id="like-count">${formatCount(video.likeCount)}</span></button>
          ${video.isOwner ? `<button id="delete-video-btn" class="pill-btn danger">🗑️ Delete</button>` : ''}
        </div>
      </div>
      <div class="channel-row">
        <a class="channel-link" href="#/channel?u=${encodeURIComponent(video.uploaderUsername)}">
          ${avatarHtml(video.uploaderAvatarUrl, video.uploaderUsername)}
          <span>${escapeHtml(video.uploaderUsername)}${video.live ? ' <span class="live-dot">🔴 LIVE</span>' : ''}<br><span class="watch-stats" id="sub-count">${formatCount(video.subscriberCount)} subscribers</span></span>
        </a>
        ${video.live ? `<a href="#/watch-live?u=${encodeURIComponent(video.uploaderUsername)}" class="pill-btn danger">🔴 Watch live</a>` : ''}
        ${video.isOwner ? '' : `<button id="subscribe-btn" class="pill-btn subscribe-btn${video.subscribed ? ' subscribed' : ''}">${video.subscribed ? 'Subscribed' : 'Subscribe'}</button>`}
      </div>
      ${video.description ? `<div class="watch-description">${escapeHtml(video.description)}</div>` : ''}
      <div class="comments-section">
        <div class="comments-heading" id="comments-heading">Comments</div>
        <form id="comment-form" class="comment-form">
          <input id="comment-input" type="text" placeholder="${currentAccount ? 'Add a comment…' : 'Sign in to comment'}" maxlength="1000">
          <button type="submit" class="pill-btn">Post</button>
        </form>
        <div id="comments-list"></div>
      </div>
    </div>
  `;

  document.getElementById('like-btn').addEventListener('click', async () => {
    if (!requireAccount()) return;
    try {
      const result = await api(`/api/scorpture/videos/${encodeURIComponent(id)}/like`, { method: 'POST' });
      document.getElementById('like-btn').classList.toggle('liked', result.liked);
      document.getElementById('like-count').textContent = formatCount(result.likeCount);
    } catch (err) {
      showToast(err.message);
    }
  });

  const subBtn = document.getElementById('subscribe-btn');
  if (subBtn) {
    subBtn.addEventListener('click', async () => {
      if (!requireAccount()) return;
      try {
        const result = await api(`/api/scorpture/channels/${encodeURIComponent(video.uploaderUsername)}/subscribe`, { method: 'POST' });
        subBtn.textContent = result.subscribed ? 'Subscribed' : 'Subscribe';
        subBtn.classList.toggle('subscribed', result.subscribed);
        document.getElementById('sub-count').textContent = `${formatCount(result.subscriberCount)} subscribers`;
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  const deleteBtn = document.getElementById('delete-video-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Delete this video? This can\'t be undone.')) return;
      try {
        await api(`/api/scorpture/videos/${encodeURIComponent(id)}`, { method: 'DELETE' });
        showToast('Video deleted');
        location.hash = '#/';
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  document.getElementById('comment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireAccount()) return;
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if (!text) return;
    try {
      await api(`/api/scorpture/videos/${encodeURIComponent(id)}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
      input.value = '';
      loadComments(id);
    } catch (err) {
      showToast(err.message);
    }
  });

  loadComments(id);
}

async function loadComments(id) {
  const listEl = document.getElementById('comments-list');
  if (!listEl) return;
  try {
    const data = await api(`/api/scorpture/videos/${encodeURIComponent(id)}/comments`);
    document.getElementById('comments-heading').textContent = `${data.comments.length} Comment${data.comments.length === 1 ? '' : 's'}`;
    if (!data.comments.length) {
      listEl.innerHTML = `<div class="state-msg">No comments yet.</div>`;
      return;
    }
    listEl.innerHTML = data.comments
      .slice()
      .reverse()
      .map(
        (c) => `
        <div class="comment">
          <span class="comment-avatar">${escapeHtml(initials(c.username))}</span>
          <div class="comment-body">
            <span class="comment-author">${escapeHtml(c.username)}</span><span class="comment-time">${timeAgo(c.created_at)}</span>
            <div class="comment-text">${escapeHtml(c.text)}</div>
          </div>
        </div>
      `
      )
      .join('');
  } catch {
    listEl.innerHTML = `<div class="state-msg">Couldn't load comments.</div>`;
  }
}

// ---------- Channel page ----------
async function renderChannel(username) {
  if (!username) return renderHome('');
  appEl.innerHTML = `<div class="state-msg">Loading channel…</div>`;
  let channel, videos;
  try {
    [channel, videos] = await Promise.all([
      api(`/api/scorpture/channels/${encodeURIComponent(username)}`),
      api(`/api/scorpture/videos?channel=${encodeURIComponent(username)}`),
    ]);
  } catch (err) {
    appEl.innerHTML = `<div class="state-msg">Couldn't load this channel: ${escapeHtml(err.message)}</div>`;
    return;
  }

  appEl.innerHTML = `
    <div class="channel-banner${channel.bannerUrl ? '' : ' empty'}" id="channel-banner"${channel.bannerUrl ? ` style="background-image:url('${escapeHtml(channel.bannerUrl)}')"` : ''}>
      ${channel.isOwner ? `
        <label id="banner-upload-label" class="pill-btn" for="banner-file-input">🖼️ ${channel.bannerUrl ? 'Change' : 'Add a'} banner</label>
        <input type="file" id="banner-file-input" accept="image/*" class="hidden">
      ` : ''}
    </div>
    ${channel.live ? `
      <a href="#/watch-live?u=${encodeURIComponent(channel.username)}" class="live-banner">
        <span class="watch-live-badge">🔴 LIVE</span> ${escapeHtml(channel.username)} is streaming now &mdash; ${escapeHtml(channel.liveTitle)}. Click to watch &rarr;
      </a>
    ` : ''}
    <div class="channel-header">
      <div class="channel-header-avatar-wrap" id="channel-header-avatar-wrap">
        ${avatarHtml(channel.avatarUrl, channel.username, 'channel-header-avatar')}
        ${channel.isOwner ? `
          <label id="avatar-upload-label" for="avatar-file-input" title="Change avatar">🖉</label>
          <input type="file" id="avatar-file-input" accept="image/*" class="hidden">
        ` : ''}
      </div>
      <div>
        <div class="channel-header-name">${escapeHtml(channel.username)}${channel.live ? ' <span class="live-dot">🔴 LIVE</span>' : ''}</div>
        <div class="channel-header-subs" id="channel-sub-count">${formatCount(channel.subscriberCount)} subscribers</div>
      </div>
      ${channel.isOwner ? '' : `<button id="channel-subscribe-btn" class="pill-btn subscribe-btn${channel.subscribed ? ' subscribed' : ''}" style="margin-left:auto">${channel.subscribed ? 'Subscribed' : 'Subscribe'}</button>`}
    </div>
    ${
      videos.videos.length
        ? `<div class="video-grid">${videos.videos.map(videoCardHtml).join('')}</div>`
        : `<div class="state-msg">${escapeHtml(channel.username)} hasn't uploaded any videos yet.</div>`
    }
  `;
  wireVideoCards();

  const bannerFileInput = document.getElementById('banner-file-input');
  if (bannerFileInput) {
    bannerFileInput.addEventListener('change', async () => {
      const file = bannerFileInput.files[0];
      if (!file) return;
      const label = document.getElementById('banner-upload-label');
      const originalText = label.textContent;
      label.textContent = 'Uploading…';
      try {
        const bannerUrl = await uploadFile(file, file.name || 'banner.jpg');
        await api('/api/scorpture/banner', { method: 'POST', body: JSON.stringify({ bannerUrl }) });
        document.getElementById('channel-banner').style.backgroundImage = `url('${bannerUrl}')`;
        document.getElementById('channel-banner').classList.remove('empty');
        label.textContent = '🖼️ Change banner';
      } catch (err) {
        label.textContent = originalText;
        showToast(err.message);
      }
    });
  }

  const avatarFileInput = document.getElementById('avatar-file-input');
  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', async () => {
      const file = avatarFileInput.files[0];
      if (!file) return;
      const wrap = document.getElementById('channel-header-avatar-wrap');
      try {
        const avatarUrl = await uploadFile(file, file.name || 'avatar.jpg');
        await api('/api/scorpture/avatar', { method: 'POST', body: JSON.stringify({ avatarUrl }) });
        wrap.querySelector('.channel-header-avatar').outerHTML = avatarHtml(avatarUrl, channel.username, 'channel-header-avatar');
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  const subBtn = document.getElementById('channel-subscribe-btn');
  if (subBtn) {
    subBtn.addEventListener('click', async () => {
      if (!requireAccount()) return;
      try {
        const result = await api(`/api/scorpture/channels/${encodeURIComponent(username)}/subscribe`, { method: 'POST' });
        subBtn.textContent = result.subscribed ? 'Subscribed' : 'Subscribe';
        subBtn.classList.toggle('subscribed', result.subscribed);
        document.getElementById('channel-sub-count').textContent = `${formatCount(result.subscriberCount)} subscribers`;
      } catch (err) {
        showToast(err.message);
      }
    });
  }
}

// ---------- Search ----------
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/';
});

// ---------- Upload modal ----------
function resetUploadModal() {
  pendingUpload = null;
  uploadFileInput.value = '';
  uploadTitleInput.value = '';
  uploadDescriptionInput.value = '';
  uploadStatusEl.textContent = '';
  uploadPreview.classList.add('hidden');
  uploadPreview.removeAttribute('src');
  fileDropLabel.classList.remove('hidden');
  uploadSubmitBtn.disabled = true;
}

uploadBtn.addEventListener('click', () => {
  if (!requireAccount()) return;
  resetUploadModal();
  uploadModal.classList.remove('hidden');
});

uploadCloseBtn.addEventListener('click', () => uploadModal.classList.add('hidden'));
uploadModal.addEventListener('click', (e) => { if (e.target === uploadModal) uploadModal.classList.add('hidden'); });

// Captures a frame partway into the video as the thumbnail — no server-side ffmpeg exists in
// this codebase, so this is done entirely client-side via a hidden <video> + <canvas> before the
// real upload even starts.
function captureThumbnail(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    uploadPreview.src = url;
    uploadPreview.onloadedmetadata = () => {
      uploadPreview.currentTime = Math.min(1, (uploadPreview.duration || 2) * 0.1);
    };
    uploadPreview.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = uploadPreview.videoWidth || 320;
        canvas.height = uploadPreview.videoHeight || 180;
        canvas.getContext('2d').drawImage(uploadPreview, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
      } catch {
        resolve(null);
      }
    };
    uploadPreview.onerror = () => resolve(null);
  });
}

uploadFileInput.addEventListener('change', async () => {
  const file = uploadFileInput.files[0];
  if (!file) return;
  fileDropLabel.classList.add('hidden');
  uploadPreview.classList.remove('hidden');
  uploadStatusEl.textContent = 'Generating thumbnail…';
  const thumbnailBlob = await captureThumbnail(file);
  pendingUpload = { file, thumbnailBlob };
  uploadStatusEl.textContent = '';
  uploadSubmitBtn.disabled = !uploadTitleInput.value.trim();
});

uploadTitleInput.addEventListener('input', () => {
  uploadSubmitBtn.disabled = !pendingUpload || !uploadTitleInput.value.trim();
});

async function uploadFile(fileOrBlob, filename) {
  const formData = new FormData();
  formData.append('file', fileOrBlob, filename);
  const token = getToken();
  const res = await fetch('/upload', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url;
}

uploadSubmitBtn.addEventListener('click', async () => {
  if (!pendingUpload || !requireAccount()) return;
  const title = uploadTitleInput.value.trim();
  if (!title) return;
  uploadSubmitBtn.disabled = true;
  try {
    uploadStatusEl.textContent = 'Uploading video…';
    const videoUrl = await uploadFile(pendingUpload.file, pendingUpload.file.name || 'video.mp4');
    let thumbnailUrl = null;
    if (pendingUpload.thumbnailBlob) {
      uploadStatusEl.textContent = 'Uploading thumbnail…';
      thumbnailUrl = await uploadFile(pendingUpload.thumbnailBlob, 'thumb.jpg');
    }
    uploadStatusEl.textContent = 'Publishing…';
    const result = await api('/api/scorpture/videos', {
      method: 'POST',
      body: JSON.stringify({ title, description: uploadDescriptionInput.value.trim(), videoUrl, thumbnailUrl }),
    });
    uploadModal.classList.add('hidden');
    showToast('Video published!');
    location.hash = `#/watch?v=${encodeURIComponent(result.id)}`;
  } catch (err) {
    uploadStatusEl.textContent = '';
    showToast(err.message);
  } finally {
    uploadSubmitBtn.disabled = false;
  }
});

// ---------- Live streaming (WebSocket signaling + WebRTC) ----------
// Star topology, not the mesh Voice Call uses: as the broadcaster, one RTCPeerConnection per
// viewer (broadcastState.peers); as a viewer, exactly one RTCPeerConnection back to the
// broadcaster (watchState.pc). Only one of these two states is ever active at a time on a given
// tab — you can't watch your own stream in the same tab you're broadcasting from.
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

let ws = null;
let broadcastState = null; // { localStream, screenStream, peers: Map<viewerId, RTCPeerConnection>, title }
let watchState = null; // { pc, username }

function connectWs() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);
  ws.addEventListener('open', () => wsSend({ type: 'scorpture-hello', accountToken: getToken() }));
  ws.addEventListener('close', () => setTimeout(connectWs, 1500));
  ws.addEventListener('message', (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    handleWsMessage(data);
  });
}

function wsSend(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function handleWsMessage(data) {
  if (data.type === 'scorpture-viewer-joined') return handleViewerJoined(data.viewerId);
  if (data.type === 'scorpture-viewer-left') return handleViewerLeft(data.viewerId);
  if (data.type === 'scorpture-signal') return handleSignal(data);
  if (data.type === 'scorpture-watch-ack') return handleWatchAck(data);
  if (data.type === 'scorpture-stream-ended') return handleStreamEnded();
  if (data.type === 'scorpture-live-chat') return appendLiveChatMessage(data);
}

// ---- Broadcaster side ----

async function handleViewerJoined(viewerId) {
  if (!broadcastState) return;
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  broadcastState.peers.set(viewerId, pc);
  for (const track of broadcastState.localStream.getTracks()) pc.addTrack(track, broadcastState.localStream);
  pc.onicecandidate = (e) => {
    if (!e.candidate) return;
    wsSend({ type: 'scorpture-signal', viewerId, signal: { kind: 'ice', candidate: iceToJson(e.candidate) } });
  };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  wsSend({ type: 'scorpture-signal', viewerId, signal: { kind: 'offer', sdp: pc.localDescription.sdp } });
  updateViewerCountUI();
}

function handleViewerLeft(viewerId) {
  if (!broadcastState) return;
  const pc = broadcastState.peers.get(viewerId);
  if (pc) { pc.close(); broadcastState.peers.delete(viewerId); }
  updateViewerCountUI();
}

function updateViewerCountUI() {
  if (!broadcastState) return;
  goLiveViewerCountEl.textContent = `${broadcastState.peers.size} watching`;
}

function iceToJson(c) {
  return { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex };
}

async function startGoLive(useScreen) {
  const title = goLiveTitleInput.value.trim() || 'Untitled stream';
  goLiveStatusEl.textContent = 'Requesting camera/mic access…';
  try {
    const stream = useScreen
      ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      : await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    broadcastState = { localStream: stream, peers: new Map(), title, recorder: null, recordedChunks: [] };
    goLivePreview.srcObject = stream;
    goLivePreview.classList.remove('hidden');
    goLiveSourceRow.classList.add('hidden');
    document.getElementById('golive-record-row').classList.add('hidden');
    goLiveTitleInput.disabled = true;
    goLiveControls.classList.remove('hidden');
    goLiveSwitchScreenBtn.classList.toggle('hidden', useScreen);
    goLiveSwitchCameraBtn.classList.toggle('hidden', !useScreen);
    goLiveHeader.textContent = '🔴 You are live';
    goLiveStatusEl.textContent = '';
    goLiveChatContainer.innerHTML = liveChatPanelHtml();
    wireLiveChatPanel();
    wsSend({ type: 'scorpture-go-live', title });
    // A screen-share track can be stopped by the browser's own "Stop sharing" UI, not just our
    // own End Stream button — treat that the same as pressing End Stream.
    stream.getVideoTracks()[0].addEventListener('ended', () => { if (broadcastState) endGoLive(); });

    // Recording is separate from the live WebRTC path entirely — just MediaRecorder capturing
    // your own local tracks the whole time, saved as a normal Scorpture upload once you end the
    // stream (see endGoLive). Best-effort: a browser that can't produce webm just skips it, the
    // live stream itself is unaffected either way.
    if (goLiveRecordCheckbox.checked && window.MediaRecorder) {
      try {
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType });
        recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) broadcastState.recordedChunks.push(e.data); };
        recorder.start(1000);
        broadcastState.recorder = recorder;
      } catch {
        // Recording is a nice-to-have — the live stream itself doesn't depend on it.
      }
    }
  } catch (err) {
    goLiveStatusEl.textContent = `Couldn't start: ${err.message}`;
  }
}

// Swaps the outgoing video track on every active viewer connection at once (RTCRtpSender.replaceTrack)
// instead of renegotiating each one — same technique the Voice Call screen-share feature already
// uses elsewhere in this app (see app.js's startScreenShare), just applied to every peer here
// instead of just one.
async function switchGoLiveSource(useScreen) {
  if (!broadcastState) return;
  try {
    const newStream = useScreen
      ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      : await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const newVideoTrack = newStream.getVideoTracks()[0];
    // Audio keeps coming from the original source (the mic) the whole time — only the video
    // track ever gets swapped — so the fresh audio track this request also grabbed is unused;
    // stop it immediately rather than leaving an extra live mic/system-audio capture open.
    for (const track of newStream.getAudioTracks()) track.stop();
    for (const pc of broadcastState.peers.values()) {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) sender.replaceTrack(newVideoTrack);
    }
    for (const track of broadcastState.localStream.getVideoTracks()) track.stop();
    broadcastState.localStream = newStream;
    goLivePreview.srcObject = newStream;
    goLiveSwitchScreenBtn.classList.toggle('hidden', useScreen);
    goLiveSwitchCameraBtn.classList.toggle('hidden', !useScreen);
    newVideoTrack.addEventListener('ended', () => { if (broadcastState) endGoLive(); });
  } catch (err) {
    showToast(`Couldn't switch source: ${err.message}`);
  }
}

function endGoLive() {
  if (!broadcastState) return;
  wsSend({ type: 'scorpture-end-live' });
  for (const pc of broadcastState.peers.values()) pc.close();
  const { recorder, recordedChunks, title, localStream } = broadcastState;
  const finishStop = () => {
    for (const track of localStream.getTracks()) track.stop();
    saveRecordingAsVideo(recordedChunks, title);
  };
  if (recorder && recorder.state !== 'inactive') {
    recorder.onstop = finishStop;
    recorder.stop();
  } else {
    finishStop();
  }
  broadcastState = null;
  resetGoLiveModal();
  goLiveModal.classList.add('hidden');
  showToast('Stream ended');
}

async function saveRecordingAsVideo(chunks, title) {
  if (!chunks || !chunks.length) return;
  const blob = new Blob(chunks, { type: 'video/webm' });
  showToast('Saving your stream as a video…');
  try {
    const videoUrl = await uploadFile(blob, `stream-${Date.now()}.webm`);
    await api('/api/scorpture/videos', {
      method: 'POST',
      body: JSON.stringify({ title: `${title} (stream replay)`, description: '', videoUrl, thumbnailUrl: null }),
    });
    showToast('Your stream was saved to your channel as a video!');
  } catch (err) {
    showToast(`Couldn't save the recording: ${err.message}`);
  }
}

// ---- Viewer side ----

function renderWatchLive(username) {
  if (!username) return renderHome('');
  stopWatching();
  appEl.innerHTML = `
    <div class="watch-layout">
      <span class="watch-live-badge">🔴 LIVE</span>
      <div class="watch-player-wrap">
        <video id="live-player" autoplay playsinline controls></video>
      </div>
      <h1 class="watch-title" id="live-title">Connecting…</h1>
      <div class="channel-row">
        <a class="channel-link" href="#/channel?u=${encodeURIComponent(username)}" id="live-channel-link">
          ${avatarHtml(null, username)}
          <span>${escapeHtml(username)}</span>
        </a>
      </div>
      ${liveChatPanelHtml()}
    </div>
  `;
  wireLiveChatPanel();
  // Best-effort, non-blocking — the WebRTC connection below doesn't wait on this, it just
  // upgrades the initials fallback to a real picture once (if) it arrives.
  api(`/api/scorpture/channels/${encodeURIComponent(username)}`)
    .then((channel) => {
      const link = document.getElementById('live-channel-link');
      if (link && channel.avatarUrl) link.querySelector('.channel-avatar').outerHTML = avatarHtml(channel.avatarUrl, username);
    })
    .catch(() => {});

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  watchState = { pc, username };
  pc.ontrack = (e) => {
    const player = document.getElementById('live-player');
    if (player) player.srcObject = e.streams[0];
  };
  pc.onicecandidate = (e) => {
    if (e.candidate) wsSend({ type: 'scorpture-signal', signal: { kind: 'ice', candidate: iceToJson(e.candidate) } });
  };
  wsSend({ type: 'scorpture-watch-live', streamerUsername: username });
}

// ---- Live chat (shared markup/wiring between the viewer's watch-live page and the
// broadcaster's Go Live modal — same panel, just mounted in two different places) ----

function liveChatPanelHtml() {
  return `
    <div class="live-chat-panel">
      <div class="live-chat-heading">💬 Live chat</div>
      <div class="live-chat-messages" id="live-chat-messages"></div>
      <form class="live-chat-form" id="live-chat-form">
        <input id="live-chat-input" type="text" placeholder="${currentAccount ? 'Say something…' : 'Sign in to chat'}" maxlength="300" autocomplete="off">
        <button type="submit" class="pill-btn">Send</button>
      </form>
    </div>
  `;
}

function wireLiveChatPanel() {
  const form = document.getElementById('live-chat-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!requireAccount()) return;
    const input = document.getElementById('live-chat-input');
    const text = input.value.trim();
    if (!text) return;
    wsSend({ type: 'scorpture-live-chat', text });
    input.value = '';
  });
}

function appendLiveChatMessage(data) {
  const list = document.getElementById('live-chat-messages');
  if (!list) return;
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  const row = document.createElement('div');
  row.className = 'live-chat-message';
  row.innerHTML = `<span class="live-chat-author">${escapeHtml(data.username)}</span> ${escapeHtml(data.text)}`;
  list.appendChild(row);
  if (atBottom) list.scrollTop = list.scrollHeight;
}

function handleWatchAck(data) {
  const titleEl = document.getElementById('live-title');
  if (!titleEl) return;
  titleEl.textContent = data.live ? data.title : `${watchState ? watchState.username : 'This channel'} isn't live right now.`;
  if (!data.live && watchState) {
    watchState.pc.close();
    watchState = null;
  }
}

// Offer/answer and ICE candidates travel over the same ordered WebSocket, but that doesn't
// guarantee a candidate is only ever *processed* after the remote description that has to be
// set first — the offer/answer handler is itself async (awaits setRemoteDescription), and a
// same-tick 'ice' message can start running before that await resolves. addIceCandidate before
// any remote description exists throws, so early candidates are queued here and flushed right
// after setRemoteDescription resolves, instead of being silently dropped by the old bare
// `.catch(() => {})`.
function queueOrAddIceCandidate(pc, candidateInit) {
  const candidate = new RTCIceCandidate(candidateInit);
  if (pc.remoteDescription) {
    pc.addIceCandidate(candidate).catch(() => {});
  } else {
    pc._pendingCandidates = pc._pendingCandidates || [];
    pc._pendingCandidates.push(candidate);
  }
}

async function flushPendingCandidates(pc) {
  if (!pc._pendingCandidates) return;
  const pending = pc._pendingCandidates;
  pc._pendingCandidates = [];
  for (const c of pending) await pc.addIceCandidate(c).catch(() => {});
}

async function handleSignal(data) {
  if (broadcastState && data.viewerId) {
    const pc = broadcastState.peers.get(data.viewerId);
    if (!pc) return;
    if (data.signal.kind === 'answer') {
      await pc.setRemoteDescription({ type: 'answer', sdp: data.signal.sdp });
      await flushPendingCandidates(pc);
    } else if (data.signal.kind === 'ice') {
      queueOrAddIceCandidate(pc, data.signal.candidate);
    }
    return;
  }
  if (watchState) {
    const pc = watchState.pc;
    if (data.signal.kind === 'offer') {
      await pc.setRemoteDescription({ type: 'offer', sdp: data.signal.sdp });
      await flushPendingCandidates(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsSend({ type: 'scorpture-signal', signal: { kind: 'answer', sdp: pc.localDescription.sdp } });
    } else if (data.signal.kind === 'ice') {
      queueOrAddIceCandidate(pc, data.signal.candidate);
    }
  }
}

function handleStreamEnded() {
  const titleEl = document.getElementById('live-title');
  if (titleEl) titleEl.textContent = 'This stream has ended.';
  stopWatching();
}

function stopWatching() {
  if (!watchState) return;
  wsSend({ type: 'scorpture-leave-live' });
  watchState.pc.close();
  watchState = null;
}

// ---- Go Live modal wiring ----

function resetGoLiveModal() {
  goLivePreview.classList.add('hidden');
  goLivePreview.srcObject = null;
  goLiveSourceRow.classList.remove('hidden');
  document.getElementById('golive-record-row').classList.remove('hidden');
  goLiveTitleInput.disabled = false;
  goLiveTitleInput.value = '';
  goLiveControls.classList.add('hidden');
  goLiveStatusEl.textContent = '';
  goLiveHeader.textContent = 'Go live';
  goLiveChatContainer.innerHTML = '';
}

goLiveBtn.addEventListener('click', () => {
  if (!requireAccount()) return;
  resetGoLiveModal();
  goLiveModal.classList.remove('hidden');
});

goLiveCloseBtn.addEventListener('click', () => {
  if (broadcastState) { showToast('End your stream first'); return; }
  goLiveModal.classList.add('hidden');
});

goLiveCameraBtn.addEventListener('click', () => startGoLive(false));
goLiveScreenBtn.addEventListener('click', () => startGoLive(true));
goLiveSwitchScreenBtn.addEventListener('click', () => switchGoLiveSource(true));
goLiveSwitchCameraBtn.addEventListener('click', () => switchGoLiveSource(false));
goLiveEndBtn.addEventListener('click', endGoLive);

// ---------- Boot ----------
connectWs();
refreshAccount();
route();
