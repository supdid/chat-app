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
const editVideoModal = document.getElementById('edit-video-modal');
const editCloseBtn = document.getElementById('edit-close-btn');
const editTitleInput = document.getElementById('edit-title-input');
const editDescriptionInput = document.getElementById('edit-description-input');
const editCategorySelect = document.getElementById('edit-category-select');
const editStatusEl = document.getElementById('edit-status');
const editSubmitBtn = document.getElementById('edit-submit-btn');
const accountNameEl = document.getElementById('account-name');
const accountSigninBtn = document.getElementById('account-signin-btn');
const subscriptionsNavLink = document.getElementById('subscriptions-nav-link');
const toastEl = document.getElementById('toast');
const goLiveBtn = document.getElementById('golive-btn');
const goLiveModal = document.getElementById('golive-modal');
const goLiveCloseBtn = document.getElementById('golive-close-btn');
const goLiveHeader = document.getElementById('golive-header');
const goLivePreview = document.getElementById('golive-preview');
const goLiveTitleInput = document.getElementById('golive-title-input');
const goLiveSourceRow = document.getElementById('golive-source-row');
const goLiveRecordCheckbox = document.getElementById('golive-record-checkbox');
const goLiveCameraBtn = document.getElementById('golive-camera-btn');
const goLiveScreenBtn = document.getElementById('golive-screen-btn');
const goLiveStatusEl = document.getElementById('golive-status');
const goLiveControls = document.getElementById('golive-live-controls');
const goLiveViewerCountEl = document.getElementById('golive-viewer-count');
const goLiveSwitchScreenBtn = document.getElementById('golive-switch-screen-btn');
const goLiveSwitchCameraBtn = document.getElementById('golive-switch-camera-btn');
const goLiveEndBtn = document.getElementById('golive-end-btn');
const liveMiniWidget = document.getElementById('live-mini-widget');
const liveMiniVideo = document.getElementById('live-mini-video');
const liveMiniViewersEl = document.getElementById('live-mini-viewers');
const liveMiniExpandBtn = document.getElementById('live-mini-expand-btn');
const liveMiniHideBtn = document.getElementById('live-mini-hide-btn');
const liveChatToggleBtn = document.getElementById('live-chat-toggle-btn');
const liveChatWidget = document.getElementById('live-chat-widget');
const liveChatWidgetCloseBtn = document.getElementById('live-chat-widget-close-btn');
const liveChatPopoutBtn = document.getElementById('live-chat-popout-btn');
const liveChatMessagesEl = document.getElementById('live-chat-messages');
const liveChatForm = document.getElementById('live-chat-form');
const liveChatInput = document.getElementById('live-chat-input');

let currentAccount = null; // { username } | null
let pendingUpload = null; // { file, thumbnailBlob }

// Bumped on every route() dispatch (a hashchange, or a redirect like renderWatch's "no id"
// bailout to renderHome). Each async render function captures the value at its own start and
// re-checks it after every await that precedes a DOM write — without this, clicking from one
// video/channel to another before the first page's fetch finishes lets the stale response land
// after the new page is already showing, silently overwriting it with the wrong video/channel/
// comments, or throwing when it wires up listeners for element ids the new page never rendered
// (this app's other pages — see app.js's viewToken, aistudio.js's viewToken — already guard
// against exactly this same race for their own async loads).
let routeToken = 0;

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
  // See app.js's escapeHtml for why " and ' also need escaping here, not just &/</> — same fix,
  // same reasoning, kept in sync across every file that duplicates this helper.
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

// 1M+ subscribers (real + any admin bonus, see server's VERIFIED_SUBSCRIBER_THRESHOLD) gets a
// checkmark next to the channel name, wherever that name is shown.
function verifiedBadgeHtml(verified) {
  return verified ? '<span class="verified-badge" title="1M+ subscribers">✓</span>' : '';
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
    subscriptionsNavLink.classList.remove('hidden');
  } else {
    accountNameEl.classList.add('hidden');
    accountSigninBtn.classList.remove('hidden');
    subscriptionsNavLink.classList.add('hidden');
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
  routeToken++;
  const { route: name, params } = parseHash();
  window.scrollTo(0, 0);
  // Leaving the watch-live page (navigating anywhere else) should tear down the viewer
  // connection — otherwise a dangling RTCPeerConnection and its server-side viewer entry would
  // outlive the page the user's actually looking at.
  if (name !== 'watch-live') stopWatching();
  if (name === 'watch') return renderWatch(params.get('v'));
  if (name === 'channel') return renderChannel(params.get('u'));
  if (name === 'search') return renderHome(params.get('q') || '', params.get('category') || '');
  if (name === 'live') return renderLive();
  if (name === 'watch-live') return renderWatchLive(params.get('u'));
  if (name === 'overlays') return renderOverlaysPage();
  if (name === 'subscriptions') return renderSubscriptionsFeed();
  return renderHome('', params.get('category') || '');
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
            <span class="video-card-channel">${escapeHtml(v.uploaderUsername)}</span>${verifiedBadgeHtml(v.uploaderVerified)}${v.uploaderLive ? ' <span class="live-dot">🔴 LIVE</span>' : ''}<br>
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

let categoriesCache = null;
async function getCategories() {
  if (!categoriesCache) {
    try { categoriesCache = (await api('/api/scorpture/categories')).categories; } catch { categoriesCache = []; }
  }
  return categoriesCache;
}

function categoryPillsHtml(categories, query, activeCategory) {
  const qs = query ? `q=${encodeURIComponent(query)}&` : '';
  const linkFor = (cat) => (query ? `#/search?${qs}category=${encodeURIComponent(cat)}` : cat ? `#/?category=${encodeURIComponent(cat)}` : '#/');
  const all = `<a href="${query ? `#/search?q=${encodeURIComponent(query)}` : '#/'}" class="category-pill${activeCategory ? '' : ' active'}">All</a>`;
  const rest = categories
    .map((cat) => `<a href="${linkFor(cat)}" class="category-pill${activeCategory === cat ? ' active' : ''}">${escapeHtml(cat)}</a>`)
    .join('');
  return `<div class="category-pills">${all}${rest}</div>`;
}

async function renderHome(query, category) {
  const myToken = routeToken;
  searchInput.value = query || '';
  appEl.innerHTML = `<div class="state-msg">Loading videos…</div>`;
  try {
    const categories = await getCategories();
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    if (category) params.set('category', category);
    const url = `/api/scorpture/videos${params.toString() ? `?${params.toString()}` : ''}`;
    const [data, liveData] = await Promise.all([api(url), query || category ? Promise.resolve({ streams: [] }) : api('/api/scorpture/live').catch(() => ({ streams: [] }))]);
    if (myToken !== routeToken) return;

    let html = categoryPillsHtml(categories, query, category);
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
    if (myToken !== routeToken) return;
    appEl.innerHTML = `<div class="state-msg">Couldn't load videos: ${escapeHtml(err.message)}</div>`;
  }
}

// ---------- Live browse page (#/live) ----------
async function renderLive() {
  const myToken = routeToken;
  appEl.innerHTML = `<div class="state-msg">Loading live streams…</div>`;
  try {
    const data = await api('/api/scorpture/live');
    if (myToken !== routeToken) return;
    if (!data.streams.length) {
      appEl.innerHTML = `<div class="state-msg">Nobody's live right now.</div>`;
      return;
    }
    appEl.innerHTML = `<div class="video-grid">${data.streams.map(liveCardHtml).join('')}</div>`;
    wireLiveCards();
  } catch (err) {
    if (myToken !== routeToken) return;
    appEl.innerHTML = `<div class="state-msg">Couldn't load live streams: ${escapeHtml(err.message)}</div>`;
  }
}

// ---------- Subscriptions feed (#/subscriptions) ----------
async function renderSubscriptionsFeed() {
  if (!requireAccount()) { location.hash = '#/'; return; }
  const myToken = routeToken;
  appEl.innerHTML = `<div class="state-msg">Loading your subscriptions…</div>`;
  try {
    const data = await api('/api/scorpture/subscriptions/feed');
    if (myToken !== routeToken) return;
    if (!data.videos.length) {
      appEl.innerHTML = `<div class="state-msg">No videos yet from channels you're subscribed to.</div>`;
      return;
    }
    appEl.innerHTML = `<div class="video-grid">${data.videos.map(videoCardHtml).join('')}</div>`;
    wireVideoCards();
  } catch (err) {
    if (myToken !== routeToken) return;
    appEl.innerHTML = `<div class="state-msg">Couldn't load your subscriptions: ${escapeHtml(err.message)}</div>`;
  }
}

// ---------- Watch page ----------
async function renderWatch(id) {
  if (!id) return renderHome('');
  const myToken = routeToken;
  appEl.innerHTML = `<div class="state-msg">Loading video…</div>`;
  let video;
  try {
    video = await api(`/api/scorpture/videos/${encodeURIComponent(id)}`);
  } catch (err) {
    if (myToken !== routeToken) return;
    appEl.innerHTML = `<div class="state-msg">Couldn't load this video: ${escapeHtml(err.message)}</div>`;
    return;
  }
  if (myToken !== routeToken) return;

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
          ${video.isOwner ? '' : `<button id="report-video-btn" class="pill-btn">🚩 Report</button>`}
          ${video.isOwner ? `<button id="edit-video-btn" class="pill-btn">✏️ Edit</button>` : ''}
          ${video.isOwner ? `<button id="delete-video-btn" class="pill-btn danger">🗑️ Delete</button>` : ''}
        </div>
      </div>
      <div class="channel-row">
        <a class="channel-link" href="#/channel?u=${encodeURIComponent(video.uploaderUsername)}">
          ${avatarHtml(video.uploaderAvatarUrl, video.uploaderUsername)}
          <span>${escapeHtml(video.uploaderUsername)}${verifiedBadgeHtml(video.uploaderVerified)}${video.live ? ' <span class="live-dot">🔴 LIVE</span>' : ''}<br><span class="watch-stats" id="sub-count">${formatCount(video.subscriberCount)} subscribers</span></span>
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

  const reportBtn = document.getElementById('report-video-btn');
  if (reportBtn) {
    reportBtn.addEventListener('click', async () => {
      if (!requireAccount()) return;
      const reason = prompt('Report this video to the admin. Optional reason:');
      if (reason === null) return;
      try {
        await api(`/api/scorpture/videos/${encodeURIComponent(id)}/report`, { method: 'POST', body: JSON.stringify({ reason }) });
        showToast('Reported.');
      } catch (err) {
        showToast(err.message);
      }
    });
  }

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

  const editBtn = document.getElementById('edit-video-btn');
  if (editBtn) editBtn.addEventListener('click', () => openEditVideoModal(video));

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
  // Every other async render path in this file guards against exactly this with routeToken (see
  // the top of the file) — this one was missed. Without it, posting/editing a comment then
  // navigating to a different video before the await above resolves let this write the OLD
  // video's comments into the NEW video's #comments-list once it finally came back.
  const myToken = routeToken;
  const listEl = document.getElementById('comments-list');
  if (!listEl) return;
  try {
    const data = await api(`/api/scorpture/videos/${encodeURIComponent(id)}/comments`);
    if (myToken !== routeToken) return;
    document.getElementById('comments-heading').textContent = `${data.comments.length} Comment${data.comments.length === 1 ? '' : 's'}`;
    if (!data.comments.length) {
      listEl.innerHTML = `<div class="state-msg">No comments yet.</div>`;
      return;
    }
    listEl.innerHTML = data.comments
      .slice()
      .reverse()
      .map((c) => {
        const isMine = currentAccount && c.username === currentAccount.username;
        return `
        <div class="comment" data-id="${escapeHtml(c.id)}">
          <span class="comment-avatar">${escapeHtml(initials(c.username))}</span>
          <div class="comment-body">
            <span class="comment-author">${escapeHtml(c.username)}</span><span class="comment-time">${timeAgo(c.created_at)}${c.edited ? ' (edited)' : ''}</span>
            <div class="comment-text">${escapeHtml(c.text)}</div>
            ${isMine ? `<button class="comment-edit-btn">✏️ Edit</button>` : ''}
          </div>
        </div>
      `;
      })
      .join('');
    wireCommentEditButtons(id);
  } catch {
    if (myToken !== routeToken) return;
    listEl.innerHTML = `<div class="state-msg">Couldn't load comments.</div>`;
  }
}

function wireCommentEditButtons(videoId) {
  document.querySelectorAll('.comment-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.comment');
      const body = row.querySelector('.comment-body');
      const textEl = body.querySelector('.comment-text');
      const originalText = textEl.textContent;
      body.querySelectorAll('.comment-edit-btn').forEach((b) => b.remove());
      textEl.outerHTML = `
        <div class="comment-edit-form">
          <input type="text" class="comment-edit-input" maxlength="1000" value="${escapeHtml(originalText)}">
          <button class="pill-btn comment-save-btn">Save</button>
          <button class="pill-btn comment-cancel-btn">Cancel</button>
        </div>
      `;
      body.querySelector('.comment-cancel-btn').addEventListener('click', () => loadComments(videoId));
      body.querySelector('.comment-save-btn').addEventListener('click', async () => {
        const input = body.querySelector('.comment-edit-input');
        const text = input.value.trim();
        if (!text) return;
        try {
          await api(`/api/scorpture/comments/${encodeURIComponent(row.dataset.id)}`, { method: 'PUT', body: JSON.stringify({ text }) });
          loadComments(videoId);
        } catch (err) {
          showToast(err.message);
        }
      });
    });
  });
}

// ---------- Channel page ----------
async function renderChannel(username) {
  if (!username) return renderHome('');
  const myToken = routeToken;
  appEl.innerHTML = `<div class="state-msg">Loading channel…</div>`;
  let channel, videos;
  try {
    [channel, videos] = await Promise.all([
      api(`/api/scorpture/channels/${encodeURIComponent(username)}`),
      api(`/api/scorpture/videos?channel=${encodeURIComponent(username)}`),
    ]);
  } catch (err) {
    if (myToken !== routeToken) return;
    appEl.innerHTML = `<div class="state-msg">Couldn't load this channel: ${escapeHtml(err.message)}</div>`;
    return;
  }
  if (myToken !== routeToken) return;

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
        <div class="channel-header-name">${escapeHtml(channel.username)}${verifiedBadgeHtml(channel.verified)}${channel.live ? ' <span class="live-dot">🔴 LIVE</span>' : ''}</div>
        <div class="channel-header-subs" id="channel-sub-count">${formatCount(channel.subscriberCount)} subscribers</div>
      </div>
      ${channel.isOwner ? `<a href="#/overlays" class="pill-btn" style="margin-left:auto">⚙️ Stream overlays</a>` : `<button id="channel-subscribe-btn" class="pill-btn subscribe-btn${channel.subscribed ? ' subscribed' : ''}" style="margin-left:auto">${channel.subscribed ? 'Subscribed' : 'Subscribe'}</button>`}
    </div>
    ${channel.isOwner || channel.description ? `
      <div class="channel-description" id="channel-description-wrap">
        <div class="channel-description-view" id="channel-description-view">
          <span id="channel-description-text">${channel.description ? escapeHtml(channel.description) : 'No description yet.'}</span>
          ${channel.isOwner ? `<button id="edit-description-btn" class="pill-btn small">✏️ Edit</button>` : ''}
        </div>
        ${channel.isOwner ? `
          <div class="channel-description-edit hidden" id="channel-description-edit">
            <textarea id="channel-description-input" maxlength="1000" placeholder="Tell viewers about your channel...">${channel.description ? escapeHtml(channel.description) : ''}</textarea>
            <div class="channel-description-edit-actions">
              <button id="save-description-btn" class="pill-btn">Save</button>
              <button id="cancel-description-btn" class="pill-btn ghost">Cancel</button>
            </div>
          </div>
        ` : ''}
      </div>
    ` : ''}
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

  const editDescriptionBtn = document.getElementById('edit-description-btn');
  if (editDescriptionBtn) {
    const viewEl = document.getElementById('channel-description-view');
    const editEl = document.getElementById('channel-description-edit');
    const input = document.getElementById('channel-description-input');
    const textEl = document.getElementById('channel-description-text');
    editDescriptionBtn.addEventListener('click', () => {
      viewEl.classList.add('hidden');
      editEl.classList.remove('hidden');
      input.focus();
    });
    document.getElementById('cancel-description-btn').addEventListener('click', () => {
      input.value = channel.description || '';
      editEl.classList.add('hidden');
      viewEl.classList.remove('hidden');
    });
    document.getElementById('save-description-btn').addEventListener('click', async () => {
      const description = input.value.trim();
      try {
        const result = await api('/api/scorpture/description', { method: 'POST', body: JSON.stringify({ description }) });
        channel.description = result.description;
        textEl.textContent = result.description || 'No description yet.';
        editEl.classList.add('hidden');
        viewEl.classList.remove('hidden');
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

// ---------- Stream overlays settings page (#/overlays) — text/image graphics you draw onto your
// own video before broadcasting (see startGoLive's canvas-compositing) so viewers literally see
// them baked into the stream, not just something shown on this page. ----------
const OVERLAY_POSITION_LABELS = {
  'top-left': 'Top left',
  'top-right': 'Top right',
  'bottom-left': 'Bottom left',
  'bottom-right': 'Bottom right',
  center: 'Center',
};

function overlayRowHtml(o) {
  const preview = o.type === 'image' ? `<img src="${escapeHtml(o.content)}" alt="">` : escapeHtml(o.content);
  return `
    <div class="overlay-row" data-id="${escapeHtml(o.id)}">
      <div class="overlay-row-preview overlay-row-preview-${o.type}">${preview}</div>
      <div class="overlay-row-info">
        <div class="overlay-row-type">${o.type === 'image' ? '🖼️ Image' : '🔤 Text'}</div>
        <div class="overlay-row-position">${OVERLAY_POSITION_LABELS[o.position] || o.position}</div>
      </div>
      <button class="icon-btn overlay-delete-btn" aria-label="Delete overlay">🗑️</button>
    </div>
  `;
}

async function renderOverlaysPage() {
  if (!requireAccount()) { location.hash = '#/'; return; }
  const myToken = routeToken;
  appEl.innerHTML = `<div class="state-msg">Loading overlays…</div>`;
  let overlays;
  try {
    const data = await api('/api/scorpture/overlays');
    overlays = data.overlays;
  } catch (err) {
    if (myToken !== routeToken) return;
    appEl.innerHTML = `<div class="state-msg">Couldn't load overlays: ${escapeHtml(err.message)}</div>`;
    return;
  }
  if (myToken !== routeToken) return;

  appEl.innerHTML = `
    <div class="overlays-page">
      <h1 class="watch-title">⚙️ Stream overlays</h1>
      <p class="overlays-hint">Graphics drawn onto your own video the moment you go live — anyone watching your stream sees these, same as you do in the preview. Up to 10 at a time.</p>
      <div id="overlays-list">${overlays.length ? overlays.map(overlayRowHtml).join('') : '<div class="state-msg">No overlays yet.</div>'}</div>
      <div class="overlay-form">
        <div class="overlay-form-row">
          <label><input type="radio" name="overlay-type" value="text" checked> Text</label>
          <label><input type="radio" name="overlay-type" value="image"> Image</label>
        </div>
        <input type="text" id="overlay-text-input" placeholder="Overlay text" maxlength="200">
        <label id="overlay-image-label" class="pill-btn hidden" for="overlay-image-input">🖼️ Choose an image</label>
        <input type="file" id="overlay-image-input" accept="image/*" class="hidden">
        <select id="overlay-position-select">
          ${Object.entries(OVERLAY_POSITION_LABELS).map(([v, label]) => `<option value="${v}">${label}</option>`).join('')}
        </select>
        <div id="overlay-form-status"></div>
        <button id="overlay-add-btn" class="pill-btn primary">Add overlay</button>
      </div>
    </div>
  `;

  let overlaysState = overlays;
  let pendingImageUrl = null;

  const textInput = document.getElementById('overlay-text-input');
  const imageLabel = document.getElementById('overlay-image-label');
  const imageInput = document.getElementById('overlay-image-input');
  const statusEl = document.getElementById('overlay-form-status');
  const addBtn = document.getElementById('overlay-add-btn');

  for (const radio of document.querySelectorAll('input[name="overlay-type"]')) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      textInput.classList.toggle('hidden', radio.value === 'image');
      imageLabel.classList.toggle('hidden', radio.value === 'text');
    });
  }

  imageInput.addEventListener('change', async () => {
    const file = imageInput.files[0];
    if (!file) return;
    imageLabel.textContent = 'Uploading…';
    try {
      pendingImageUrl = await uploadFile(file, file.name || 'overlay.png');
      imageLabel.textContent = '🖼️ Image ready — click Add overlay';
    } catch (err) {
      imageLabel.textContent = '🖼️ Choose an image';
      showToast(err.message);
    }
  });

  async function saveOverlays(next) {
    const data = await api('/api/scorpture/overlays', { method: 'POST', body: JSON.stringify({ overlays: next }) });
    overlaysState = data.overlays;
    document.getElementById('overlays-list').innerHTML = overlaysState.length
      ? overlaysState.map(overlayRowHtml).join('')
      : '<div class="state-msg">No overlays yet.</div>';
    wireOverlayDeleteButtons();
    // If you're currently live, apply the change to the running stream immediately rather than
    // requiring you to end and restart — the draw loop already reads broadcastState.overlays
    // fresh every frame.
    if (broadcastState) broadcastState.overlays = overlaysState;
  }

  function wireOverlayDeleteButtons() {
    document.querySelectorAll('.overlay-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('.overlay-row');
        const id = row.dataset.id;
        try {
          await saveOverlays(overlaysState.filter((o) => o.id !== id));
        } catch (err) {
          showToast(err.message);
        }
      });
    });
  }
  wireOverlayDeleteButtons();

  addBtn.addEventListener('click', async () => {
    const type = document.querySelector('input[name="overlay-type"]:checked').value;
    const position = document.getElementById('overlay-position-select').value;
    if (overlaysState.length >= 10) { showToast('Max 10 overlays'); return; }
    let content;
    if (type === 'text') {
      content = textInput.value.trim();
      if (!content) { showToast('Enter some text first'); return; }
    } else {
      if (!pendingImageUrl) { showToast('Choose an image first'); return; }
      content = pendingImageUrl;
    }
    addBtn.disabled = true;
    statusEl.textContent = 'Saving…';
    try {
      await saveOverlays([...overlaysState, { type, content, position }]);
      textInput.value = '';
      pendingImageUrl = null;
      imageLabel.textContent = '🖼️ Choose an image';
      statusEl.textContent = '';
    } catch (err) {
      statusEl.textContent = `❌ ${err.message}`;
    } finally {
      addBtn.disabled = false;
    }
  });
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

uploadBtn.addEventListener('click', async () => {
  if (!requireAccount()) return;
  resetUploadModal();
  const categorySelect = document.getElementById('upload-category-select');
  if (!categorySelect.options.length) {
    const categories = await getCategories();
    categorySelect.innerHTML = categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }
  uploadModal.classList.remove('hidden');
});

uploadCloseBtn.addEventListener('click', () => uploadModal.classList.add('hidden'));
uploadModal.addEventListener('click', (e) => { if (e.target === uploadModal) uploadModal.classList.add('hidden'); });

// Captures a frame partway into the video as the thumbnail — no server-side ffmpeg exists in
// this codebase, so this is done entirely client-side via a hidden <video> + <canvas> before the
// real upload even starts.
function captureThumbnail(file) {
  return new Promise((resolve) => {
    // Picking a different file (or reopening the upload modal for a later video) re-triggers
    // this and reassigns uploadPreview.src without ever revoking the previous blob URL — leaked
    // it for the rest of the page's lifetime. Same fix as videoeditor.js's song-preview leak.
    if (uploadPreview.src && uploadPreview.src.startsWith('blob:')) URL.revokeObjectURL(uploadPreview.src);
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
    const category = document.getElementById('upload-category-select').value || null;
    const result = await api('/api/scorpture/videos', {
      method: 'POST',
      body: JSON.stringify({ title, description: uploadDescriptionInput.value.trim(), videoUrl, thumbnailUrl, category }),
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

// ---------- Edit video (title/description/category only — the file itself is fixed once
// published, see updateScorptureVideo's comment in db.js) ----------
let editingVideoId = null;

async function openEditVideoModal(video) {
  editingVideoId = video.id;
  editTitleInput.value = video.title;
  editDescriptionInput.value = video.description || '';
  editStatusEl.textContent = '';
  if (!editCategorySelect.options.length) {
    const categories = await getCategories();
    editCategorySelect.innerHTML = categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }
  if (video.category) editCategorySelect.value = video.category;
  editVideoModal.classList.remove('hidden');
}

editCloseBtn.addEventListener('click', () => editVideoModal.classList.add('hidden'));
editVideoModal.addEventListener('click', (e) => { if (e.target === editVideoModal) editVideoModal.classList.add('hidden'); });

editSubmitBtn.addEventListener('click', async () => {
  const title = editTitleInput.value.trim();
  if (!title) { editStatusEl.textContent = 'Title is required.'; return; }
  editSubmitBtn.disabled = true;
  editStatusEl.textContent = 'Saving…';
  try {
    await api(`/api/scorpture/videos/${encodeURIComponent(editingVideoId)}`, {
      method: 'PUT',
      body: JSON.stringify({ title, description: editDescriptionInput.value.trim(), category: editCategorySelect.value || null }),
    });
    editVideoModal.classList.add('hidden');
    showToast('Video updated');
    renderWatch(editingVideoId);
  } catch (err) {
    editStatusEl.textContent = '';
    showToast(err.message);
  } finally {
    editSubmitBtn.disabled = false;
  }
});

// ---------- Live streaming (WebSocket signaling + WebRTC) ----------
// Star topology, not the mesh Voice Call uses: as the broadcaster, one RTCPeerConnection per
// viewer (broadcastState.peers); as a viewer, exactly one RTCPeerConnection back to the
// broadcaster (watchState.pc). Only one of these two states is ever active at a time on a given
// tab — you can't watch your own stream in the same tab you're broadcasting from.
// STUN alone only works when both sides can find a direct P2P path — if the broadcaster and
// viewer are behind NATs/firewalls that block that (common when they're on unrelated networks,
// e.g. this app's public tunnel URL), ICE just hangs forever with no video/audio and no error.
// The TURN entry (fetched fresh per connection below, see getIceServers) is the fallback for that.
const STUN_SERVER = { urls: 'stun:stun.l.google.com:19302' };

// Ephemeral TURN credentials, minted server-side per connection attempt (see server.js's
// /api/scorpture/turn-credentials and ~/valk-turn) rather than a static secret hardcoded here —
// a leaked static credential baked into client JS would let anyone use this relay indefinitely.
// Best-effort: if the TURN service is down, still return STUN-only rather than failing the whole
// connection attempt (a direct P2P path may still work fine).
async function getIceServers() {
  try {
    const cred = await api('/api/scorpture/turn-credentials', { method: 'POST' });
    return [STUN_SERVER, { urls: cred.urls, username: cred.username, credential: cred.credential }];
  } catch {
    return [STUN_SERVER];
  }
}

let ws = null;
let broadcastState = null; // { localStream, screenStream, peers: Map<viewerId, RTCPeerConnection>, title }
// True only during the async window between clicking "Go live" and broadcastState being set —
// guards against a double-click (or clicking camera then screen before the first permission
// prompt resolves) racing two concurrent startGoLive() calls, which would otherwise leak the
// loser's camera/mic stream and requestAnimationFrame loop forever (nothing else ever references
// them once broadcastState is overwritten by whichever call finishes last).
let goLiveStarting = false;
let watchState = null; // { pc, username, token }
// FIFO of tokens for in-flight scorpture-watch-live requests, one push per renderWatchLive() call.
// scorpture-watch-ack carries no id of its own to say which request it's answering — this relies
// on the WS transport preserving order (guaranteed for one connection) so the Nth ack received is
// always the answer to the Nth request sent, letting a stale ack (for a stream already superseded
// by a newer watch attempt, e.g. clicking two live streams in quick succession before the first
// ack comes back) be told apart from the one actually describing the current watchState.
let watchAckQueue = [];
let watchTokenSeq = 0;

function connectWs() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);
  ws.addEventListener('open', () => {
    wsSend({ type: 'scorpture-hello', accountToken: getToken() });
    // The server ends a live stream (liveStreams.delete) the instant its ws closes, for *any*
    // reason — including this reconnect's own network blip, not just a real "End Stream" click.
    // Without this, the broadcaster's own tab has no idea the server already tore the stream
    // down and keeps showing "🔴 You are live" — anyone freshly asking the server (a viewer
    // joining, or this page's own pop-out chat window) correctly gets told it isn't live,
    // which is the desync a user actually hit. Re-announcing here keeps the server's live-flag
    // honest again. This does NOT repair existing viewers' video — their RTCPeerConnections
    // were signaling through the now-dead ws and can't be revived without a fresh negotiation
    // per viewer, which this doesn't attempt; only the is-live status recovers automatically.
    if (broadcastState) wsSend({ type: 'scorpture-go-live', title: broadcastState.title });
    // Same gap on the viewer side, previously unhandled entirely: the server's leaveScorptureLive
    // (triggered by the old connection closing, including this reconnect's own blip) tells the
    // broadcaster to close *this viewer's* peer connection, but this tab's own `pc` was never told
    // — it just sat there with the video frozen on the last frame forever, no error, no recovery
    // short of manually navigating away and back. renderWatchLive() already does a full
    // stopWatching()-then-rebuild, which is exactly a fresh reconnect for the viewer side too.
    if (watchState) renderWatchLive(watchState.username);
  });
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
  const iceServers = await getIceServers();
  if (!broadcastState) return; // broadcast may have ended while the credential fetch was in flight
  const pc = new RTCPeerConnection({ iceServers });
  broadcastState.peers.set(viewerId, pc);
  for (const track of broadcastState.localStream.getTracks()) pc.addTrack(track, broadcastState.localStream);
  pc.onicecandidate = (e) => {
    if (!e.candidate) return;
    wsSend({ type: 'scorpture-signal', viewerId, signal: { kind: 'ice', candidate: iceToJson(e.candidate) } });
  };
  try {
    await renegotiatePeer(pc, viewerId);
  } catch (err) {
    // Called fire-and-forget from the WS message handler (never awaited) — unlike
    // switchGoLiveSource's own call to renegotiatePeer, which is already inside that function's
    // try/catch. A thrown createOffer/setLocalDescription here would otherwise silently leave
    // this viewer's connection stuck with a peer entry but no working offer ever sent.
    broadcastState.peers.delete(viewerId);
    pc.close();
    reportClientError('handleViewerJoined failed for ' + viewerId + ': ' + err.message, err.stack);
    return;
  }
  updateViewerCountUI();
}

// Shared by the initial join above and switchGoLiveSource's mid-stream audio-track add below —
// the viewer side already handles an incoming 'offer' the same way whether it's the first one or
// a renegotiation (see handleSignal), so no separate protocol path is needed for this.
async function renegotiatePeer(pc, viewerId) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  wsSend({ type: 'scorpture-signal', viewerId, signal: { kind: 'offer', sdp: pc.localDescription.sdp } });
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
  if (!liveMiniWidget.classList.contains('hidden')) liveMiniViewersEl.textContent = `${broadcastState.peers.size} watching`;
}

function iceToJson(c) {
  return { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex };
}

// ---- Overlay compositing — the raw camera/screen stream is never sent anywhere itself. It
// feeds a hidden <video>, which a requestAnimationFrame loop draws onto an offscreen <canvas>
// each frame along with any overlays; canvas.captureStream() is what actually gets broadcast,
// recorded, and shown in your own preview — so "what you see is what viewers see" for real,
// overlays included, without needing to renegotiate anything when switching camera/screen (the
// canvas's own video track never changes, only what gets drawn onto it does). ----

const overlayImageCache = new Map(); // url -> HTMLImageElement, loaded once and reused
function getOverlayImage(url) {
  if (!overlayImageCache.has(url)) {
    const img = new Image();
    img.src = url;
    overlayImageCache.set(url, img);
  }
  return overlayImageCache.get(url);
}

function overlayAnchorPoint(position, canvasWidth, canvasHeight, pad, w, h) {
  if (position === 'top-right') return { x: canvasWidth - w - pad, y: pad };
  if (position === 'bottom-left') return { x: pad, y: canvasHeight - h - pad };
  if (position === 'bottom-right') return { x: canvasWidth - w - pad, y: canvasHeight - h - pad };
  if (position === 'center') return { x: (canvasWidth - w) / 2, y: (canvasHeight - h) / 2 };
  return { x: pad, y: pad }; // top-left, and the fallback for anything unrecognized
}

function drawOverlaysOnCanvas(ctx, canvasWidth, canvasHeight, overlays) {
  const pad = Math.max(10, canvasWidth * 0.02);
  for (const o of overlays) {
    if (o.type === 'text') {
      const fontSize = Math.max(14, Math.round(canvasWidth * 0.03));
      ctx.font = `bold ${fontSize}px sans-serif`;
      const textW = ctx.measureText(o.content).width;
      const textH = fontSize * 1.4;
      const { x, y } = overlayAnchorPoint(o.position, canvasWidth, canvasHeight, pad, textW + 16, textH);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, y, textW + 16, textH);
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(o.content, x + 8, y + textH / 2);
    } else if (o.type === 'image') {
      const img = getOverlayImage(o.content);
      if (!img.complete || !img.naturalWidth) continue;
      const w = canvasWidth * 0.18;
      const h = w * (img.naturalHeight / img.naturalWidth);
      const { x, y } = overlayAnchorPoint(o.position, canvasWidth, canvasHeight, pad, w, h);
      ctx.drawImage(img, x, y, w, h);
    }
  }
}

async function startGoLive(useScreen) {
  if (broadcastState || goLiveStarting) return;
  goLiveStarting = true;
  const title = goLiveTitleInput.value.trim() || 'Untitled stream';
  goLiveStatusEl.textContent = 'Requesting camera/mic access…';
  // Declared outside the try so the catch block below can stop it if acquisition succeeded but
  // something after it (sourceVideo.play(), etc.) threw before broadcastState ever got set —
  // otherwise the camera/mic (or screen capture) stream is left running with nothing left
  // referencing it, camera light stuck on indefinitely with only a reload to release it.
  let rawStream = null;
  try {
    rawStream = useScreen
      ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      : await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    let overlays = [];
    try { overlays = (await api('/api/scorpture/overlays')).overlays; } catch { /* stream still works with none */ }

    const sourceVideo = document.createElement('video');
    sourceVideo.muted = true;
    sourceVideo.playsInline = true;
    sourceVideo.srcObject = rawStream;
    await sourceVideo.play();

    const canvas = document.createElement('canvas');
    canvas.width = sourceVideo.videoWidth || 1280;
    canvas.height = sourceVideo.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    let compositing = true;
    function drawFrame() {
      if (!compositing) return;
      ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
      drawOverlaysOnCanvas(ctx, canvas.width, canvas.height, broadcastState ? broadcastState.overlays : overlays);
      requestAnimationFrame(drawFrame);
    }
    requestAnimationFrame(drawFrame);

    const canvasTrack = canvas.captureStream(30).getVideoTracks()[0];
    const compositedStream = new MediaStream([canvasTrack, ...rawStream.getAudioTracks()]);

    // Captured by closure directly (not read back off broadcastState) so the recorder's
    // ondataavailable callback below still has somewhere valid to push to even after
    // broadcastState is nulled out — MediaRecorder keeps firing a final flush of data
    // *asynchronously* after .stop() is called, which lands after endGoLive() has already torn
    // broadcastState down. Same array object either way, just not reached through a reference
    // that might go stale.
    const recordedChunks = [];

    broadcastState = {
      rawStream,
      sourceVideo,
      canvas,
      overlays,
      localStream: compositedStream, // what every peer connection, the preview, and the recorder all use
      stopCompositing: () => { compositing = false; },
      peers: new Map(),
      title,
      recorder: null,
      recordedChunks,
    };
    goLivePreview.srcObject = compositedStream;
    goLivePreview.classList.remove('hidden');
    goLiveSourceRow.classList.add('hidden');
    document.getElementById('golive-record-row').classList.add('hidden');
    goLiveTitleInput.disabled = true;
    goLiveControls.classList.remove('hidden');
    goLiveSwitchScreenBtn.classList.toggle('hidden', useScreen);
    goLiveSwitchCameraBtn.classList.toggle('hidden', !useScreen);
    goLiveHeader.textContent = '🔴 You are live';
    goLiveStatusEl.textContent = '';
    enableLiveChat();
    wsSend({ type: 'scorpture-go-live', title });
    // A screen-share track can be stopped by the browser's own "Stop sharing" UI, not just our
    // own End Stream button — treat that the same as pressing End Stream.
    rawStream.getVideoTracks()[0].addEventListener('ended', () => { if (broadcastState) endGoLive(); });

    // Recording is separate from the live WebRTC path entirely — MediaRecorder on the same
    // composited stream everyone else sees, so the saved replay has the overlays baked in too.
    if (goLiveRecordCheckbox.checked && window.MediaRecorder) {
      try {
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
        const recorder = new MediaRecorder(compositedStream, { mimeType });
        // A recording that grows past the shared /upload endpoint's size cap doesn't get
        // truncated — it fails to upload *at all* when the stream finally ends, silently losing
        // the entire recording (see saveRecordingAsVideo's own fallback below for when that
        // still happens some other way). Stop recording proactively before that point instead;
        // the live stream itself is unaffected, only further footage stops being captured.
        const MAX_RECORDING_BYTES = 280 * 1024 * 1024; // stay safely under the shared 300MB cap
        let recordedBytes = 0;
        recorder.ondataavailable = (e) => {
          if (!e.data || e.data.size === 0) return;
          recordedChunks.push(e.data);
          recordedBytes += e.data.size;
          if (recordedBytes >= MAX_RECORDING_BYTES && recorder.state !== 'inactive') {
            recorder.stop();
            showToast("Recording stopped automatically (max size reached) — you're still live, but further footage won't be saved.");
          }
        };
        recorder.start(1000);
        broadcastState.recorder = recorder;
      } catch {
        // Recording is a nice-to-have — the live stream itself doesn't depend on it.
      }
    }
  } catch (err) {
    goLiveStatusEl.textContent = `Couldn't start: ${err.message}`;
    if (rawStream && !broadcastState) rawStream.getTracks().forEach((t) => t.stop());
  } finally {
    goLiveStarting = false;
  }
}

// Switching source now just points the hidden sourceVideo at a new raw stream — the canvas
// track being broadcast never changes, so there's no RTCRtpSender.replaceTrack/renegotiation
// needed at all, unlike before overlays existed.
// Same reentrancy concern startGoLive() already guards against with goLiveStarting — without
// this, two rapid clicks on the switch-source buttons raced two concurrent getDisplayMedia/
// getUserMedia calls: whichever finished last overwrote broadcastState.rawStream, leaking the
// other's captured stream (webcam light / "sharing your screen" indicator stuck on with nothing
// left to stop it), and both could call pc.createOffer()/setLocalDescription() on the same
// RTCPeerConnection concurrently, throwing signaling-state glare for that viewer.
let switchingGoLiveSource = false;
async function switchGoLiveSource(useScreen) {
  if (!broadcastState || switchingGoLiveSource) return;
  switchingGoLiveSource = true;
  try {
    const newRawStream = useScreen
      ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      : await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    // The stream could have been ended (End Stream clicked) while that permission prompt was up
    // — broadcastState is null now, and using it below would throw, landing in the catch with
    // this freshly-acquired stream never stopped (the same leak class just fixed in startGoLive).
    if (!broadcastState) {
      newRawStream.getTracks().forEach((t) => t.stop());
      return;
    }
    // Audio normally keeps coming from the original source (the mic) the whole time — only the
    // video feed powering the compositing canvas changes — so the fresh audio track this request
    // also grabbed is usually unused. *Except*: if the session went live with no audio track at
    // all (e.g. started via "Share screen" without opting into "share system audio", the common
    // case since that's an extra checkbox in the OS/browser picker), there's nothing to keep
    // coming from, and the broadcast would otherwise stay silent for its entire remaining
    // duration even after switching to a source — like the camera — that does provide audio.
    const newAudioTracks = newRawStream.getAudioTracks();
    if (broadcastState.localStream.getAudioTracks().length === 0 && newAudioTracks.length > 0) {
      const [audioTrack, ...extraAudioTracks] = newAudioTracks;
      broadcastState.localStream.addTrack(audioTrack);
      for (const [viewerId, pc] of broadcastState.peers) {
        pc.addTrack(audioTrack, broadcastState.localStream);
        await renegotiatePeer(pc, viewerId);
      }
      for (const track of extraAudioTracks) track.stop();
    } else {
      for (const track of newAudioTracks) track.stop();
    }
    for (const track of broadcastState.rawStream.getVideoTracks()) track.stop();
    broadcastState.rawStream = newRawStream;
    broadcastState.sourceVideo.srcObject = newRawStream;
    await broadcastState.sourceVideo.play();
    goLiveSwitchScreenBtn.classList.toggle('hidden', useScreen);
    goLiveSwitchCameraBtn.classList.toggle('hidden', !useScreen);
    newRawStream.getVideoTracks()[0].addEventListener('ended', () => { if (broadcastState) endGoLive(); });
  } catch (err) {
    showToast(`Couldn't switch source: ${err.message}`);
  } finally {
    switchingGoLiveSource = false;
  }
}

function endGoLive() {
  if (!broadcastState) return;
  wsSend({ type: 'scorpture-end-live' });
  for (const pc of broadcastState.peers.values()) pc.close();
  const { recorder, recordedChunks, title, localStream, rawStream, stopCompositing, sourceVideo } = broadcastState;
  const finishStop = () => {
    stopCompositing();
    for (const track of localStream.getTracks()) track.stop();
    for (const track of rawStream.getTracks()) track.stop();
    sourceVideo.srcObject = null;
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
  hideLiveMiniWidget();
  if (!watchState) disableLiveChat();
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
    // The recording only ever existed in this tab's memory — if saving it to the server failed
    // for any reason (hit the shared /upload size cap, a network hiccup, whatever), that's the
    // only copy anywhere. Offer a local download instead of silently losing it outright.
    offerRecordingDownload(blob, title);
    showToast("Couldn't save to your channel — downloading it to this device instead.");
  }
}

function offerRecordingDownload(blob, title) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(title || 'stream').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60) || 'stream'}.webm`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---- Viewer side ----

function renderWatchLive(username) {
  if (!username) return renderHome('');
  stopWatching();

  // Watching your own stream from the same tab/account you're broadcasting from can't cleanly
  // go through a real WebRTC round-trip to yourself (there's only one WebSocket connection for
  // this tab, and it can't simultaneously act as both the streamer's control channel and a
  // distinct viewer's) — so instead of that, just play your own composited output directly.
  // It's literally the same thing viewers are seeing, with zero extra latency. Muted, since this
  // is the same device replaying its own live mic capture — unmuted would echo.
  if (broadcastState && currentAccount && username === currentAccount.username) {
    appEl.innerHTML = `
      <div class="watch-layout">
        <span class="watch-live-badge">🔴 LIVE — this is your stream</span>
        <div class="watch-player-wrap">
          <video id="live-player" autoplay playsinline controls muted></video>
        </div>
        <h1 class="watch-title">${escapeHtml(broadcastState.title)}</h1>
        <div class="channel-row">
          <a class="channel-link" href="#/channel?u=${encodeURIComponent(username)}">
            ${avatarHtml(null, username)}
            <span>${escapeHtml(username)}</span>
          </a>
        </div>
      </div>
    `;
    document.getElementById('live-player').srcObject = broadcastState.localStream;
    enableLiveChat();
    return;
  }

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
          <span id="live-channel-name">${escapeHtml(username)}</span>
        </a>
      </div>
    </div>
  `;
  // Best-effort, non-blocking — the WebRTC connection below doesn't wait on this, it just
  // upgrades the initials fallback to a real picture (and adds the verified badge) once the
  // channel's actual info arrives.
  api(`/api/scorpture/channels/${encodeURIComponent(username)}`)
    .then((channel) => {
      const link = document.getElementById('live-channel-link');
      if (!link) return;
      if (channel.avatarUrl) link.querySelector('.channel-avatar').outerHTML = avatarHtml(channel.avatarUrl, username);
      const nameEl = document.getElementById('live-channel-name');
      if (nameEl) nameEl.innerHTML = `${escapeHtml(username)}${verifiedBadgeHtml(channel.verified)}`;
    })
    .catch(() => {});

  const token = ++watchTokenSeq;
  // ICE servers (including the TURN credential mint) are fetched before the RTCPeerConnection
  // exists at all, so this can't race handleSignal — there's no pc for an early offer/ice message
  // to land on until this resolves, and handleSignal's `if (watchState)` guard just no-ops until
  // watchState is set below.
  getIceServers().then((iceServers) => {
    if (token !== watchTokenSeq) return; // superseded/cancelled while the credential fetch was in flight
    const pc = new RTCPeerConnection({ iceServers });
    watchState = { pc, username, token };
    watchAckQueue.push(token);
    pc.ontrack = (e) => {
      const player = document.getElementById('live-player');
      if (player) player.srcObject = e.streams[0];
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) wsSend({ type: 'scorpture-signal', signal: { kind: 'ice', candidate: iceToJson(e.candidate) } });
    };
    // Without this, a connection neither side can ever complete (e.g. TURN relay also blocked)
    // just leaves the black player box up forever with no indication anything went wrong.
    pc.onconnectionstatechange = () => {
      if (!watchState || watchState.pc !== pc) return; // stale pc from a superseded watch attempt
      if (pc.connectionState === 'failed') {
        const titleEl = document.getElementById('live-title');
        if (titleEl) titleEl.textContent = "Couldn't connect to this stream (network issue) — try refreshing.";
      }
    };
    wsSend({ type: 'scorpture-watch-live', streamerUsername: username });
  });
  enableLiveChat();
}

// ---- Live chat — a single floating box fixed to the screen (#live-chat-widget in videos.html,
// wired once below), not something baked into the watch-live page or the Go Live dialog. Its
// availability tracks whichever of broadcastState/watchState is active — see enableLiveChat/
// disableLiveChat, called from startGoLive/endGoLive and renderWatchLive/stopWatching.

function enableLiveChat() {
  liveChatMessagesEl.innerHTML = '';
  liveChatToggleBtn.classList.remove('hidden');
  liveChatWidget.classList.remove('hidden');
  liveChatInput.placeholder = currentAccount ? 'Say something…' : 'Sign in to chat';
}

function disableLiveChat() {
  liveChatToggleBtn.classList.add('hidden');
  liveChatWidget.classList.add('hidden');
}

liveChatToggleBtn.addEventListener('click', () => liveChatWidget.classList.toggle('hidden'));
liveChatWidgetCloseBtn.addEventListener('click', () => liveChatWidget.classList.add('hidden'));

// Whichever live chat is currently active — watching someone else's stream (watchState) takes
// precedence since you can't watch your own stream in the same tab you're broadcasting from
// (see the comment above renderWatchLive's own-stream branch), so the two states are already mutually exclusive; this
// just picks whichever one is actually set.
function currentLiveChatUsername() {
  if (watchState) return watchState.username;
  if (broadcastState && currentAccount) return currentAccount.username;
  return null;
}

// Opens the chat in a genuine separate OS browser window (not another in-page widget) so it can
// be dragged/resized independently of this tab — including down to something tiny, the way
// Twitch's "pop out chat" works. Same-origin, so it shares localStorage (account token) with
// this tab automatically; only the streamer's username needs to cross via the URL.
liveChatPopoutBtn.addEventListener('click', () => {
  const username = currentLiveChatUsername();
  if (!username) return;
  window.open(
    `livechat.html?u=${encodeURIComponent(username)}`,
    `valk-livechat-${username}`,
    'width=320,height=420,resizable=yes'
  );
});

// Drag the chat box anywhere on screen by its header — starts pinned bottom-right (via CSS), but
// the first drag switches it to explicit left/top positioning so it can go wherever you drop it.
// Clamped to the viewport so it can never end up dragged fully off-screen and unreachable.
function makeDraggable(handleEl, widgetEl) {
  let dragging = false, offsetX = 0, offsetY = 0;

  function start(clientX, clientY) {
    dragging = true;
    const rect = widgetEl.getBoundingClientRect();
    offsetX = clientX - rect.left;
    offsetY = clientY - rect.top;
    widgetEl.style.left = `${rect.left}px`;
    widgetEl.style.top = `${rect.top}px`;
    widgetEl.style.right = 'auto';
    widgetEl.style.bottom = 'auto';
  }

  function move(clientX, clientY) {
    if (!dragging) return;
    const rect = widgetEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(window.innerWidth - rect.width, clientX - offsetX));
    const y = Math.max(0, Math.min(window.innerHeight - rect.height, clientY - offsetY));
    widgetEl.style.left = `${x}px`;
    widgetEl.style.top = `${y}px`;
  }

  function end() { dragging = false; }

  handleEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('.icon-btn')) return; // don't hijack clicking the close button
    e.preventDefault();
    start(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
  window.addEventListener('mouseup', end);

  handleEl.addEventListener('touchstart', (e) => {
    if (e.target.closest('.icon-btn')) return;
    const t = e.touches[0];
    start(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const t = e.touches[0];
    move(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener('touchend', end);
}

makeDraggable(document.getElementById('live-chat-widget-header'), liveChatWidget);

liveChatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!requireAccount()) return;
  const text = liveChatInput.value.trim();
  if (!text) return;
  wsSend({ type: 'scorpture-live-chat', text });
  liveChatInput.value = '';
});

function appendLiveChatMessage(data) {
  const atBottom = liveChatMessagesEl.scrollHeight - liveChatMessagesEl.scrollTop - liveChatMessagesEl.clientHeight < 40;
  const row = document.createElement('div');
  row.className = 'live-chat-message';
  row.innerHTML = `<span class="live-chat-author">${escapeHtml(data.username)}</span> ${escapeHtml(data.text)}`;
  liveChatMessagesEl.appendChild(row);
  if (atBottom) liveChatMessagesEl.scrollTop = liveChatMessagesEl.scrollHeight;
}

function handleWatchAck(data) {
  const token = watchAckQueue.shift();
  // Stale ack for a watch attempt already superseded by a newer one (or the user navigated away
  // entirely, e.g. stopWatching() already nulled watchState) — ignore it. Acting on it would tear
  // down or mislabel whatever the CURRENT watchState actually is, not the one this ack is for.
  if (!watchState || token !== watchState.token) return;
  // Peer-connection cleanup must not depend on this DOM lookup succeeding — decoupled so a
  // future refactor of the watch page's markup can't silently reintroduce a leaked RTCPeerConnection.
  const offlineUsername = watchState.username;
  if (!data.live) {
    watchState.pc.close();
    watchState = null;
  }
  const titleEl = document.getElementById('live-title');
  if (!titleEl) return;
  titleEl.textContent = data.live ? data.title : `${offlineUsername} isn't live right now.`;
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
  try {
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
  } catch (err) {
    // Called fire-and-forget from the WS message handler (never awaited) — a thrown error here
    // (a stale/malformed SDP after a viewer or broadcaster left mid-negotiation, etc.) would
    // otherwise become a silent unhandled rejection with no trace anywhere, leaving that
    // connection's audio/video broken with nothing to explain why. Same fix as app.js's
    // handleVoiceSignal for the identical bug class.
    reportClientError('handleSignal failed (' + (data.signal && data.signal.kind) + '): ' + err.message, err.stack);
  }
}

function handleStreamEnded() {
  const titleEl = document.getElementById('live-title');
  if (titleEl) titleEl.textContent = 'This stream has ended.';
  stopWatching();
}

function stopWatching() {
  // Bumped unconditionally (even if watchState isn't set yet) so an in-flight getIceServers()
  // fetch from a watch attempt that's being cancelled mid-flight — see renderWatchLive — notices
  // via the token mismatch and discards its result instead of resurrecting a stale connection.
  ++watchTokenSeq;
  if (!watchState) return;
  wsSend({ type: 'scorpture-leave-live' });
  watchState.pc.close();
  watchState = null;
  if (!broadcastState) disableLiveChat();
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
}

// Once you're live, "closing" the dialog no longer ends the stream — it just tucks the preview
// into the small floating widget (bottom-left of the viewport, see #live-mini-widget) so you can
// keep browsing the rest of Scorpture, or any other app, while still broadcasting. The Go Live
// button reopens the same dialog with live controls intact instead of resetting it.
function hideGoLiveModal() {
  goLiveModal.classList.add('hidden');
  if (broadcastState) showLiveMiniWidget();
}

function showLiveMiniWidget() {
  if (!broadcastState) return;
  liveMiniVideo.srcObject = broadcastState.localStream;
  liveMiniViewersEl.textContent = `${broadcastState.peers.size} watching`;
  liveMiniWidget.classList.remove('hidden');
}

function hideLiveMiniWidget() {
  liveMiniVideo.srcObject = null;
  liveMiniWidget.classList.add('hidden');
}

goLiveBtn.addEventListener('click', () => {
  if (!requireAccount()) return;
  if (broadcastState) {
    // Already live — reopen the existing session's controls instead of wiping it.
    hideLiveMiniWidget();
    goLiveModal.classList.remove('hidden');
    return;
  }
  resetGoLiveModal();
  goLiveModal.classList.remove('hidden');
});

goLiveCloseBtn.addEventListener('click', hideGoLiveModal);

liveMiniExpandBtn.addEventListener('click', () => {
  hideLiveMiniWidget();
  goLiveModal.classList.remove('hidden');
});

// Hides the floating preview only — the stream itself keeps running untouched. Reopen it any
// time from the 🔴 Go Live button (or just end the stream from there).
liveMiniHideBtn.addEventListener('click', hideLiveMiniWidget);

goLiveCameraBtn.addEventListener('click', () => startGoLive(false));
goLiveScreenBtn.addEventListener('click', () => startGoLive(true));
goLiveSwitchScreenBtn.addEventListener('click', () => switchGoLiveSource(true));
goLiveSwitchCameraBtn.addEventListener('click', () => switchGoLiveSource(false));
goLiveEndBtn.addEventListener('click', endGoLive);

// ---------- Scorpture admin panel (right-click the logo) ----------
// This client-side username check is only ever a UX convenience — it decides whether to bother
// showing the panel, nothing more. The real boundary is server-side (isScorptureAdmin() in
// server.js, checked on every request against the signed-in account's token) — someone editing
// this file in devtools to remove the check would just get a 403 back from the API.
const logoLink = document.getElementById('logo-link');
const scorptureAdminModal = document.getElementById('scorpture-admin-modal');
const scorptureAdminCloseBtn = document.getElementById('scorpture-admin-close-btn');
const scorptureAdminBonusInput = document.getElementById('scorpture-admin-bonus-input');
const scorptureAdminStatusEl = document.getElementById('scorpture-admin-status');
const scorptureAdminSaveBtn = document.getElementById('scorpture-admin-save-btn');

logoLink.addEventListener('contextmenu', async (e) => {
  if (!currentAccount || currentAccount.username !== 'supdid67') return;
  e.preventDefault();
  scorptureAdminStatusEl.textContent = 'Loading…';
  scorptureAdminModal.classList.remove('hidden');
  try {
    const data = await api('/api/scorpture/admin/bonus-subscribers');
    scorptureAdminBonusInput.value = data.bonusSubscribers;
    scorptureAdminStatusEl.textContent = '';
  } catch (err) {
    scorptureAdminStatusEl.textContent = err.message;
  }
});

scorptureAdminCloseBtn.addEventListener('click', () => scorptureAdminModal.classList.add('hidden'));
scorptureAdminModal.addEventListener('click', (e) => { if (e.target === scorptureAdminModal) scorptureAdminModal.classList.add('hidden'); });

scorptureAdminSaveBtn.addEventListener('click', async () => {
  const count = Math.max(0, Math.floor(Number(scorptureAdminBonusInput.value) || 0));
  scorptureAdminSaveBtn.disabled = true;
  try {
    await api('/api/scorpture/admin/bonus-subscribers', { method: 'POST', body: JSON.stringify({ count }) });
    scorptureAdminStatusEl.textContent = '✅ Saved';
  } catch (err) {
    scorptureAdminStatusEl.textContent = `❌ ${err.message}`;
  } finally {
    scorptureAdminSaveBtn.disabled = false;
  }
});

// --- Escape closes whichever modal/panel is open --- (same fix already applied to the main chat
// page's overlays this session — this page had none of its own until now). goLiveModal goes
// through hideGoLiveModal() specifically, not a plain classList toggle — that function is what
// makes "closing" safe once you're actually live (tucks into the mini widget instead of ending
// the stream), so Escape gets that same safe behavior rather than a raw hide.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!uploadModal.classList.contains('hidden')) uploadCloseBtn.click();
  if (!editVideoModal.classList.contains('hidden')) editCloseBtn.click();
  if (!goLiveModal.classList.contains('hidden')) goLiveCloseBtn.click();
  if (!scorptureAdminModal.classList.contains('hidden')) scorptureAdminCloseBtn.click();
  if (!liveChatWidget.classList.contains('hidden')) liveChatWidgetCloseBtn.click();
});

// ---------- Boot ----------
connectWs();
refreshAccount();
route();
