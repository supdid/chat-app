// Shared helpers for the Communities and ValkMail pages — account token, API calls, theme toggle.
const ACCOUNT_TOKEN_KEY = 'valk-account-token';

function getToken() {
  try { return localStorage.getItem(ACCOUNT_TOKEN_KEY) || ''; } catch { return ''; }
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = Object.assign({}, options.headers);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, Object.assign({}, options, { headers }));
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Returns the uploaded file's /uploads/ URL.
async function uploadImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Pick a picture file');
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/upload', { method: 'POST', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');
  return data.url;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function timeAgo(ms) {
  const seconds = Math.max(0, (Date.now() - ms) / 1000);
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, secs] of units) {
    const v = Math.floor(seconds / secs);
    if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

function avatarHtml(url, username) {
  if (url) return `<img class="avatar" src="${escapeHtml(url)}" alt="">`;
  return `<span class="avatar">${escapeHtml((username || '?').slice(0, 1).toUpperCase())}</span>`;
}

function iconHtml(icon, big) {
  const cls = `c-icon${big ? ' big' : ''}`;
  if (icon && icon.startsWith('/uploads/')) return `<img class="${cls}" src="${escapeHtml(icon)}" alt="">`;
  return `<span class="${cls}">${escapeHtml(icon || '🏘️')}</span>`;
}

let toastTimer = null;
function showToast(text) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

function signInBoxHtml(what) {
  return `<div class="panel signin-box">
    <p>You need a Valk account to ${escapeHtml(what)}.</p>
    <a class="btn primary" href="index.html" style="text-decoration:none">Sign in on the Valk home screen</a>
  </div>`;
}

(function setupTheme() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  const apply = (theme) => {
    if (theme === 'light') document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
    btn.textContent = theme === 'light' ? '☀️' : '🌙';
  };
  let saved = 'dark';
  try { saved = localStorage.getItem('valk-theme') === 'light' ? 'light' : 'dark'; } catch {}
  apply(saved);
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('valk-theme', next); } catch {}
    apply(next);
  });
})();
