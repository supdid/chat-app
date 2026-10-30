// ValkMail — inbox/sent/compose between Valk accounts.
// Routes: #/inbox, #/sent, #/read/<id>, #/compose (optional ?to=&subject=).
const appEl = document.getElementById('app');

let me = null;
let routeToken = 0;
let unread = 0;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { path: path || 'inbox', params: new URLSearchParams(qs || '') };
}

function shell(activeFolder, inner) {
  return `
    <div class="page-header">
      <img src="images/logo.png" alt="" class="logo">
      <div style="flex:1">
        <h1>📬 ValkMail</h1>
        <p class="subtitle">Mail for your Valk account — <b>${escapeHtml(me.username)}</b></p>
      </div>
    </div>
    <div class="mail-layout">
      <nav class="mail-folders">
        <a class="btn primary" href="#/compose" style="text-decoration:none;text-align:center">✏️ Compose</a>
        <a class="tab${activeFolder === 'inbox' ? ' active' : ''}" href="#/inbox" style="text-decoration:none">📥 Inbox ${unread ? `<span class="unread-count">${unread}</span>` : ''}</a>
        <a class="tab${activeFolder === 'sent' ? ' active' : ''}" href="#/sent" style="text-decoration:none">📤 Sent</a>
      </nav>
      <section class="panel" style="margin:0">${inner}</section>
    </div>
  `;
}

async function route() {
  routeToken++;
  window.scrollTo(0, 0);
  if (!me) {
    appEl.innerHTML = `<div class="page-header"><h1>📬 ValkMail</h1></div>${signInBoxHtml('use ValkMail')}`;
    return;
  }
  const { path, params } = parseHash();
  if (path === 'compose') return renderCompose(params);
  const m = /^read\/([\w-]+)$/.exec(path);
  if (m) return renderRead(m[1]);
  return renderFolder(path === 'sent' ? 'sent' : 'inbox');
}

async function renderFolder(folder) {
  const myToken = routeToken;
  appEl.innerHTML = shell(folder, '<p class="muted">Loading…</p>');
  let data;
  try {
    data = await api(`/api/valkmail?folder=${folder}`);
  } catch (err) {
    if (myToken === routeToken) appEl.innerHTML = shell(folder, `<p class="error">${escapeHtml(err.message)}</p>`);
    return;
  }
  if (myToken !== routeToken) return;
  unread = data.unread;
  const list = data.mail.length
    ? `<ul class="mail-list">${data.mail.map((m) => `
        <li class="mail-item${folder === 'inbox' && !m.read ? ' unread' : ''}" data-id="${escapeHtml(m.id)}">
          <span class="who">${folder === 'sent' ? 'To: ' + escapeHtml(m.to) : escapeHtml(m.from)}</span>
          <span class="when">${timeAgo(m.createdAt)}</span>
          <span class="subject">${escapeHtml(m.subject)} — <span class="dim">${escapeHtml(m.body.slice(0, 80))}</span></span>
        </li>`).join('')}</ul>`
    : `<p class="empty">${folder === 'sent' ? "You haven't sent any mail yet." : 'Your inbox is empty. 📭'}</p>`;
  appEl.innerHTML = shell(folder, list);
  appEl.querySelectorAll('.mail-item').forEach((li) => li.addEventListener('click', () => {
    location.hash = `#/read/${li.dataset.id}`;
  }));
}

async function renderRead(id) {
  const myToken = routeToken;
  appEl.innerHTML = shell('', '<p class="muted">Loading…</p>');
  let mail;
  try {
    mail = (await api(`/api/valkmail/${encodeURIComponent(id)}`)).mail;
  } catch (err) {
    if (myToken === routeToken) appEl.innerHTML = shell('', `<p class="error">${escapeHtml(err.message)}</p>`);
    return;
  }
  if (myToken !== routeToken) return;
  // Opening it marked it read server-side — refresh the badge.
  try { unread = (await api('/api/valkmail/unread')).unread; } catch {}
  if (myToken !== routeToken) return;
  const folder = mail.isRecipient ? 'inbox' : 'sent';
  appEl.innerHTML = shell(folder, `
    <div class="mail-view">
      <p><a href="#/${folder}">← Back to ${folder}</a></p>
      <h2>${escapeHtml(mail.subject)}</h2>
      <div class="dim">From <b>${escapeHtml(mail.from)}</b> to <b>${escapeHtml(mail.to)}</b> · ${new Date(mail.createdAt).toLocaleString()}</div>
      <div class="mail-body">${escapeHtml(mail.body)}</div>
      <div class="row">
        ${mail.isRecipient ? '<button class="btn primary" id="reply-btn">↩️ Reply</button>' : ''}
        <button class="btn danger" id="delete-btn">🗑️ Delete</button>
      </div>
    </div>
  `);
  const replyBtn = document.getElementById('reply-btn');
  if (replyBtn) replyBtn.addEventListener('click', () => {
    const subject = /^re:/i.test(mail.subject) ? mail.subject : `Re: ${mail.subject}`;
    sessionStorage.setItem('valkmail-quote', `\n\n— On ${new Date(mail.createdAt).toLocaleString()}, ${mail.from} wrote:\n${mail.body.split('\n').map((l) => '> ' + l).join('\n')}`);
    location.hash = `#/compose?to=${encodeURIComponent(mail.from)}&subject=${encodeURIComponent(subject)}`;
  });
  document.getElementById('delete-btn').addEventListener('click', async () => {
    if (!confirm('Delete this mail?')) return;
    try {
      await api(`/api/valkmail/${encodeURIComponent(mail.id)}`, { method: 'DELETE' });
      showToast('Deleted');
      location.hash = `#/${folder}`;
    } catch (err) { showToast(err.message); }
  });
}

function renderCompose(params) {
  let quote = '';
  try { quote = sessionStorage.getItem('valkmail-quote') || ''; sessionStorage.removeItem('valkmail-quote'); } catch {}
  appEl.innerHTML = shell('', `
    <form id="compose-form" class="stack">
      <h2 style="margin:0">New mail</h2>
      <input id="mail-to" type="text" placeholder="To (Valk username)" maxlength="20" required value="${escapeHtml(params.get('to') || '')}" autocomplete="off">
      <input id="mail-subject" type="text" placeholder="Subject" maxlength="120" value="${escapeHtml(params.get('subject') || '')}">
      <textarea id="mail-body" placeholder="Write your message…" maxlength="10000" style="min-height:12rem" required>${escapeHtml(quote)}</textarea>
      <p id="compose-error" class="error hidden"></p>
      <div class="row">
        <button class="btn primary" type="submit" id="send-btn">📨 Send</button>
        <a class="btn" href="#/inbox" style="text-decoration:none">Cancel</a>
      </div>
    </form>
  `);
  const focusEl = params.get('to') ? document.getElementById('mail-body') : document.getElementById('mail-to');
  focusEl.focus();
  if (quote) document.getElementById('mail-body').setSelectionRange(0, 0);
  document.getElementById('compose-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('compose-error');
    const sendBtn = document.getElementById('send-btn');
    errEl.classList.add('hidden');
    sendBtn.disabled = true;
    try {
      await api('/api/valkmail', {
        method: 'POST',
        body: JSON.stringify({
          to: document.getElementById('mail-to').value,
          subject: document.getElementById('mail-subject').value,
          body: document.getElementById('mail-body').value,
        }),
      });
      showToast('Sent! 📨');
      location.hash = '#/sent';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
      sendBtn.disabled = false;
    }
  });
}

// Live "you've got mail" while this page is open — same account WebSocket registration
// Scorpture uses (scorpture-hello just ties this connection to the account).
function connectWs() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`);
  ws.addEventListener('open', () => ws.send(JSON.stringify({ type: 'scorpture-hello', accountToken: getToken() })));
  ws.addEventListener('message', (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch { return; }
    if (data.type !== 'valkmail-new') return;
    unread++;
    showToast(`📬 New mail from ${data.from}`);
    const { path } = parseHash();
    if (path === 'inbox') renderFolder('inbox');
    else document.querySelectorAll('.mail-folders .tab')[0].innerHTML = `📥 Inbox <span class="unread-count">${unread}</span>`;
  });
  ws.addEventListener('close', () => setTimeout(connectWs, 3000));
}

window.addEventListener('hashchange', route);
(async () => {
  if (getToken()) {
    try { me = await api('/auth/me'); } catch { me = null; }
  }
  if (me) {
    try { unread = (await api('/api/valkmail/unread')).unread; } catch {}
    connectWs();
  }
  route();
})();
