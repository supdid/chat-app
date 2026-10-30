// Communities — browse/create/join account-owned communities and post in them.
// Routes: #/ (browse), #/new (create), #/c/<id> (one community).
const appEl = document.getElementById('app');
const ICON_CHOICES = ['🏘️', '🎮', '🎨', '🎵', '⚽', '📚', '🐶', '🚀', '🔥', '💎', '🍕', '👾', '🦂', '🌈', '🏆', '😂'];

let me = null; // { username } | null
let routeToken = 0;
let browseTab = 'popular';

async function loadMe() {
  if (!getToken()) return null;
  try {
    const r = await api('/auth/me');
    return r && r.username ? { username: r.username } : null;
  } catch { return null; }
}

function route() {
  routeToken++;
  window.scrollTo(0, 0);
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash === 'new') return renderCreate();
  const m = /^c\/([\w-]+)/.exec(hash);
  if (m) return renderCommunity(m[1]);
  return renderBrowse();
}

// ---------- Browse ----------
async function renderBrowse(query = '') {
  const myToken = routeToken;
  appEl.innerHTML = `
    <div class="page-header">
      <img src="images/logo.png" alt="" class="logo">
      <div style="flex:1">
        <h1>Communities</h1>
        <p class="subtitle">Find people into the same stuff — or start your own for you or your game.</p>
      </div>
      <a class="btn primary" href="#/new" style="text-decoration:none">＋ Create a community</a>
    </div>
    <div class="panel">
      <form id="search-form" class="row" style="margin-bottom:0.8rem">
        <input id="search-input" type="search" placeholder="Search communities" value="${escapeHtml(query)}" maxlength="50">
        <button class="btn" type="submit">🔍 Search</button>
      </form>
      <div class="tabs">
        <button class="tab${browseTab === 'popular' ? ' active' : ''}" data-tab="popular">🔥 Popular</button>
        <button class="tab${browseTab === 'new' ? ' active' : ''}" data-tab="new">🆕 Newest</button>
        <button class="tab${browseTab === 'mine' ? ' active' : ''}" data-tab="mine">⭐ Joined</button>
      </div>
      <div id="community-grid" class="community-grid"><p class="muted">Loading…</p></div>
    </div>
  `;
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    renderBrowse(document.getElementById('search-input').value.trim());
  });
  appEl.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    browseTab = t.dataset.tab;
    renderBrowse(document.getElementById('search-input').value.trim());
  }));

  const grid = document.getElementById('community-grid');
  if (browseTab === 'mine' && !me) {
    grid.outerHTML = signInBoxHtml('join communities');
    return;
  }
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (browseTab === 'new') params.set('sort', 'new');
  if (browseTab === 'mine') params.set('mine', '1');
  let list;
  try {
    list = (await api(`/api/communities?${params}`)).communities;
  } catch (err) {
    if (myToken === routeToken) grid.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    return;
  }
  if (myToken !== routeToken) return;
  if (!list.length) {
    grid.innerHTML = `<p class="empty">${browseTab === 'mine' ? "You haven't joined any communities yet." : query ? 'No communities match that.' : 'No communities yet — be the first to make one!'}</p>`;
    return;
  }
  grid.innerHTML = list.map((c) => `
    <button class="community-card" data-id="${escapeHtml(c.id)}" type="button">
      <div class="card-top">
        ${iconHtml(c.icon)}
        <div>
          <div class="name">${escapeHtml(c.name)}</div>
          <div class="dim">👥 ${c.memberCount} member${c.memberCount === 1 ? '' : 's'} · 📝 ${c.postCount}</div>
        </div>
      </div>
      ${c.description ? `<div class="desc">${escapeHtml(c.description)}</div>` : ''}
      ${c.joined ? '<div><span class="joined-chip">✓ Joined</span></div>' : ''}
    </button>
  `).join('');
  grid.querySelectorAll('.community-card').forEach((card) => card.addEventListener('click', () => {
    location.hash = `#/c/${card.dataset.id}`;
  }));
}

// ---------- Create ----------
function iconPickerHtml(selected) {
  return `<div class="icon-picker" id="icon-picker">
    ${ICON_CHOICES.map((i) => `<button type="button" data-icon="${i}" class="${i === selected ? 'selected' : ''}">${i}</button>`).join('')}
    <button type="button" id="icon-upload-btn" title="Upload a picture">📷</button>
    <input type="file" id="icon-file" accept="image/*" class="hidden">
  </div>`;
}

// Wires the icon picker; returns a getter for the chosen icon (emoji or /uploads/ URL).
function wireIconPicker(initial) {
  let icon = initial;
  const picker = document.getElementById('icon-picker');
  const select = (btn) => {
    picker.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
  };
  picker.querySelectorAll('button[data-icon]').forEach((b) => b.addEventListener('click', () => { icon = b.dataset.icon; select(b); }));
  const fileInput = document.getElementById('icon-file');
  const uploadBtn = document.getElementById('icon-upload-btn');
  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      uploadBtn.textContent = '⏳';
      icon = await uploadImage(file);
      uploadBtn.innerHTML = `<img src="${escapeHtml(icon)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;
      select(uploadBtn);
    } catch (err) {
      uploadBtn.textContent = '📷';
      showToast(err.message);
    }
  });
  return () => icon;
}

function renderCreate() {
  if (!me) {
    appEl.innerHTML = `<div class="page-header"><h1>Create a community</h1></div>${signInBoxHtml('create a community')}`;
    return;
  }
  appEl.innerHTML = `
    <div class="page-header"><h1>Create a community</h1></div>
    <form class="panel stack" id="create-form">
      <label><b>Name</b></label>
      <input id="c-name" type="text" maxlength="40" placeholder="e.g. Block Battle Fans" required>
      <label><b>Icon</b></label>
      ${iconPickerHtml('🏘️')}
      <label><b>What's it about?</b></label>
      <textarea id="c-desc" maxlength="1000" placeholder="Tell people about yourself, your game, or what this community is for"></textarea>
      <p id="create-error" class="error hidden"></p>
      <div class="row">
        <button class="btn primary" type="submit">Create community</button>
        <a class="btn" href="#/" style="text-decoration:none">Cancel</a>
      </div>
    </form>
  `;
  const getIcon = wireIconPicker('🏘️');
  document.getElementById('create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('create-error');
    errEl.classList.add('hidden');
    try {
      const r = await api('/api/communities', {
        method: 'POST',
        body: JSON.stringify({ name: document.getElementById('c-name').value, description: document.getElementById('c-desc').value, icon: getIcon() }),
      });
      location.hash = `#/c/${r.community.id}`;
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });
}

// ---------- One community ----------
async function renderCommunity(id) {
  const myToken = routeToken;
  appEl.innerHTML = '<p class="muted">Loading…</p>';
  let data;
  try {
    data = await api(`/api/communities/${encodeURIComponent(id)}`);
  } catch (err) {
    if (myToken === routeToken) appEl.innerHTML = `<div class="panel empty">${escapeHtml(err.message)}<br><br><a href="#/">← All communities</a></div>`;
    return;
  }
  if (myToken !== routeToken) return;
  const c = data.community;
  const banner = c.bannerUrl ? `style="background-image:url('${escapeHtml(c.bannerUrl)}')"` : '';
  appEl.innerHTML = `
    <p><a href="#/">← All communities</a></p>
    <div class="panel">
      <div class="c-banner" ${banner}></div>
      <div class="c-head">
        ${iconHtml(c.icon, true)}
        <div class="info">
          <h2>${escapeHtml(c.name)}</h2>
          <div class="dim">👥 ${c.memberCount} member${c.memberCount === 1 ? '' : 's'} · made by ${escapeHtml(c.ownerUsername || 'someone')} · ${timeAgo(c.createdAt)}</div>
        </div>
        <div class="row">
          ${c.isOwner ? '<button class="btn" id="edit-btn">✏️ Edit</button>'
            : c.joined ? '<button class="btn" id="leave-btn">Leave</button>'
            : '<button class="btn primary" id="join-btn">＋ Join</button>'}
        </div>
      </div>
      ${c.description ? `<p class="c-about">${escapeHtml(c.description)}</p>` : ''}
      <div id="edit-area"></div>
    </div>

    <div class="panel composer" id="composer-panel"></div>

    <div class="panel">
      <h3 style="margin-top:0">Posts</h3>
      <div id="posts"><p class="muted">Loading…</p></div>
      <div style="text-align:center;margin-top:0.8rem"><button class="btn hidden" id="more-btn">Load more</button></div>
    </div>

    <div class="panel">
      <h3 style="margin-top:0">Members</h3>
      <div class="member-list">
        ${data.members.map((m) => `<span class="member">${avatarHtml(m.avatarUrl, m.username)}${escapeHtml(m.username)}${m.username === c.ownerUsername ? ' 👑' : ''}</span>`).join('')}
      </div>
    </div>
  `;

  const act = async (path) => {
    try {
      await api(`/api/communities/${encodeURIComponent(c.id)}/${path}`, { method: 'POST' });
      renderCommunity(c.id);
    } catch (err) {
      if (err.status === 401) showToast('Sign in on the Valk home screen first');
      else showToast(err.message);
    }
  };
  const joinBtn = document.getElementById('join-btn');
  if (joinBtn) joinBtn.addEventListener('click', () => act('join'));
  const leaveBtn = document.getElementById('leave-btn');
  if (leaveBtn) leaveBtn.addEventListener('click', () => { if (confirm(`Leave ${c.name}?`)) act('leave'); });
  const editBtn = document.getElementById('edit-btn');
  if (editBtn) editBtn.addEventListener('click', () => renderEditArea(c));

  renderComposer(c);
  loadPosts(c, true, myToken);
}

function renderEditArea(c) {
  const area = document.getElementById('edit-area');
  if (area.innerHTML) { area.innerHTML = ''; return; }
  area.innerHTML = `
    <form class="stack" id="edit-form" style="margin-top:1rem">
      <label><b>Icon</b></label>
      ${iconPickerHtml(c.icon)}
      <label><b>About</b></label>
      <textarea id="edit-desc" maxlength="1000">${escapeHtml(c.description)}</textarea>
      <label><b>Banner picture</b></label>
      <div class="row">
        <button type="button" class="btn small" id="banner-btn">📷 Upload banner</button>
        ${c.bannerUrl ? '<button type="button" class="btn small" id="banner-clear">Remove banner</button>' : ''}
        <input type="file" id="banner-file" accept="image/*" class="hidden">
      </div>
      <div class="row">
        <button class="btn primary" type="submit">Save</button>
        <button class="btn danger" type="button" id="delete-btn">🗑️ Delete community</button>
      </div>
    </form>
  `;
  const getIcon = wireIconPicker(c.icon);
  let bannerUrl = c.bannerUrl;
  const bannerFile = document.getElementById('banner-file');
  document.getElementById('banner-btn').addEventListener('click', () => bannerFile.click());
  bannerFile.addEventListener('change', async () => {
    if (!bannerFile.files[0]) return;
    try {
      bannerUrl = await uploadImage(bannerFile.files[0]);
      document.querySelector('.c-banner').style.backgroundImage = `url('${bannerUrl}')`;
    } catch (err) { showToast(err.message); }
  });
  const clearBtn = document.getElementById('banner-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    bannerUrl = null;
    document.querySelector('.c-banner').style.backgroundImage = '';
  });
  document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(`/api/communities/${encodeURIComponent(c.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ icon: getIcon(), description: document.getElementById('edit-desc').value, bannerUrl }),
      });
      showToast('Saved!');
      renderCommunity(c.id);
    } catch (err) { showToast(err.message); }
  });
  document.getElementById('delete-btn').addEventListener('click', async () => {
    if (!confirm(`Delete "${c.name}" and all its posts forever?`)) return;
    try {
      await api(`/api/communities/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
      location.hash = '#/';
    } catch (err) { showToast(err.message); }
  });
}

function renderComposer(c) {
  const panel = document.getElementById('composer-panel');
  if (!me) { panel.innerHTML = '<p class="muted" style="margin:0">Sign in on the Valk home screen to join and post.</p>'; return; }
  if (!c.joined) { panel.innerHTML = '<p class="muted" style="margin:0">Join this community to post in it.</p>'; return; }
  panel.innerHTML = `
    <form id="post-form" class="stack">
      <textarea id="post-text" maxlength="2000" placeholder="Share something with ${escapeHtml(c.name)} — about you, your game, anything!"></textarea>
      <img id="post-preview" class="preview-img hidden" alt="">
      <div class="row">
        <button type="button" class="btn small" id="post-img-btn">📷 Add picture</button>
        <button type="button" class="btn small hidden" id="post-img-clear">✕ Remove picture</button>
        <input type="file" id="post-img-file" accept="image/*" class="hidden">
        <span style="flex:1"></span>
        <button class="btn primary" type="submit" id="post-submit">Post</button>
      </div>
    </form>
  `;
  let imageUrl = null;
  const fileInput = document.getElementById('post-img-file');
  const preview = document.getElementById('post-preview');
  const clearBtn = document.getElementById('post-img-clear');
  document.getElementById('post-img-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    if (!fileInput.files[0]) return;
    try {
      imageUrl = await uploadImage(fileInput.files[0]);
      preview.src = imageUrl;
      preview.classList.remove('hidden');
      clearBtn.classList.remove('hidden');
    } catch (err) { showToast(err.message); }
    fileInput.value = '';
  });
  clearBtn.addEventListener('click', () => {
    imageUrl = null;
    preview.classList.add('hidden');
    clearBtn.classList.add('hidden');
  });
  document.getElementById('post-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submit = document.getElementById('post-submit');
    submit.disabled = true;
    try {
      await api(`/api/communities/${encodeURIComponent(c.id)}/posts`, {
        method: 'POST',
        body: JSON.stringify({ text: document.getElementById('post-text').value, imageUrl }),
      });
      renderComposer(c);
      loadPosts(c, true, routeToken);
    } catch (err) {
      showToast(err.message);
      submit.disabled = false;
    }
  });
}

let oldestPostAt = null;
async function loadPosts(c, reset, myToken) {
  const postsEl = document.getElementById('posts');
  const moreBtn = document.getElementById('more-btn');
  if (reset) oldestPostAt = null;
  let posts;
  try {
    posts = (await api(`/api/communities/${encodeURIComponent(c.id)}/posts${oldestPostAt ? `?before=${oldestPostAt}` : ''}`)).posts;
  } catch (err) {
    if (myToken === routeToken) postsEl.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    return;
  }
  if (myToken !== routeToken) return;
  if (reset) postsEl.innerHTML = '';
  if (reset && !posts.length) postsEl.innerHTML = '<p class="empty">No posts yet. Say hi! 👋</p>';
  for (const p of posts) postsEl.insertAdjacentHTML('beforeend', postHtml(p, c));
  if (posts.length) oldestPostAt = posts[posts.length - 1].createdAt;
  moreBtn.classList.toggle('hidden', posts.length < 30);
  moreBtn.onclick = () => loadPosts(c, false, routeToken);
  wirePosts(c);
}

function postHtml(p, c) {
  return `
    <div class="post" data-id="${escapeHtml(p.id)}">
      ${avatarHtml(p.authorAvatarUrl, p.authorUsername)}
      <div class="body">
        <div class="meta">
          <span class="author">${escapeHtml(p.authorUsername)}${p.authorUsername === c.ownerUsername ? ' 👑' : ''}</span>
          <span class="dim">${timeAgo(p.createdAt)}</span>
        </div>
        ${p.text ? `<div class="text">${escapeHtml(p.text)}</div>` : ''}
        ${p.imageUrl ? `<a href="${escapeHtml(p.imageUrl)}" target="_blank" rel="noopener"><img class="post-img" src="${escapeHtml(p.imageUrl)}" alt=""></a>` : ''}
        <div class="actions">
          <button class="btn small like-btn${p.liked ? ' liked' : ''}" data-count="${p.likeCount}">❤️ <span>${p.likeCount}</span></button>
          ${p.isMine || c.isOwner ? '<button class="btn small danger delete-post-btn">Delete</button>' : ''}
        </div>
      </div>
    </div>
  `;
}

function wirePosts(c) {
  document.querySelectorAll('.post:not([data-wired])').forEach((el) => {
    el.dataset.wired = '1';
    const id = el.dataset.id;
    el.querySelector('.like-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (!me) return showToast('Sign in on the Valk home screen to like posts');
      try {
        const r = await api(`/api/communities/${encodeURIComponent(c.id)}/posts/${encodeURIComponent(id)}/like`, { method: 'POST' });
        const count = Number(btn.dataset.count) + (r.liked ? 1 : -1);
        btn.dataset.count = count;
        btn.querySelector('span').textContent = count;
        btn.classList.toggle('liked', r.liked);
      } catch (err) { showToast(err.message); }
    });
    const del = el.querySelector('.delete-post-btn');
    if (del) del.addEventListener('click', async () => {
      if (!confirm('Delete this post?')) return;
      try {
        await api(`/api/communities/${encodeURIComponent(c.id)}/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
        el.remove();
      } catch (err) { showToast(err.message); }
    });
  });
}

window.addEventListener('hashchange', route);
loadMe().then((acct) => { me = acct; route(); });
