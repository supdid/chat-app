// Valk Premium page — plans come from /api/premium/tiers (TIERS in server.js), so prices and perks
// are only ever defined in one place. No payment flow yet: plans are turned on by the admin.
const TIER_ORDER = ['hobbyist', 'power', 'studio'];
const TIER_PITCH = {
  hobbyist: 'For people who chat and create every day.',
  power: 'For hosts of busy rooms and serious creators.',
  studio: 'Everything, maxed out.',
};
const COLOR_LABELS = { gold: 'Gold', rose: 'Rose', sky: 'Sky', mint: 'Mint', violet: 'Violet', flame: 'Flame', rainbow: 'Rainbow (Studio)' };
const BUBBLE_LABELS = { galaxy: 'Galaxy', sunset: 'Sunset', ocean: 'Ocean', neon: 'Neon', candy: 'Candy' };

const token = (() => { try { return localStorage.getItem('valk-account-token'); } catch { return null; } })();
const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
let catalog = null;
let me = null;
let billing = 'monthly';
let pickedColor = null;
let pickedBubble = null;

function fmtMoney(n) {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

function perkList(key) {
  const t = catalog.tiers[key];
  const free = catalog.free;
  const list = [
    `${t.badge} ${t.name} badge next to your name`,
    t.rainbowName ? 'Animated rainbow name' : 'Colored name in chat',
  ];
  if (t.bubbleThemes) list.push('Chat bubble themes');
  list.push(`Rooms up to ${t.roomCapacity} people (free: ${free.roomCapacity})`);
  if (t.permanentRooms) list.push('Permanent rooms (never auto-deleted)');
  if (t.animatedWallpaper) list.push('GIF & video room wallpapers');
  if (t.roomExport) list.push('Export a room as a .zip');
  list.push('Extra AI Studio picture shapes (21:9, 9:16, 4:5, 3:2, 3:1)');
  if (t.hd) list.push('HD pictures (2048px)');
  list.push(`Saved gallery: ${t.galleryLimit} pictures (free: ${free.galleryLimit})`);
  if (t.batchSize > free.batchSize) list.push(`${t.batchSize} pictures at once`);
  return list;
}

function renderCards() {
  const wrap = document.getElementById('tier-cards');
  wrap.innerHTML = '';
  for (const key of TIER_ORDER) {
    const t = catalog.tiers[key];
    const card = document.createElement('article');
    card.className = `tier-card tier-${key}` + (key === 'power' ? ' featured' : '') + (me && me.tier === key ? ' current' : '');
    const perMonth = billing === 'annual' ? t.annual / 12 : t.monthly;
    card.innerHTML = `
      ${key === 'power' ? '<div class="ribbon">Most popular</div>' : ''}
      <div class="tier-badge">${t.badge}</div>
      <h2></h2>
      <p class="pitch"></p>
      <div class="price"><span class="amount">${fmtMoney(perMonth)}</span><span class="per">/month</span></div>
      <div class="billed">${billing === 'annual' ? `${fmtMoney(t.annual)} billed yearly` : 'billed monthly'}</div>
      <ul></ul>
      <button type="button" class="get-btn"></button>`;
    card.querySelector('h2').textContent = t.name;
    card.querySelector('.pitch').textContent = TIER_PITCH[key];
    const ul = card.querySelector('ul');
    for (const p of perkList(key)) {
      const li = document.createElement('li');
      li.textContent = p;
      ul.appendChild(li);
    }
    const btn = card.querySelector('.get-btn');
    if (me && me.tier === key) {
      btn.textContent = '✓ Your plan';
      btn.disabled = true;
    } else {
      btn.textContent = `Get ${t.name}`;
      btn.addEventListener('click', () => {
        alert(me && me.signedIn
          ? `Online payment isn't switched on yet.\n\nAsk the Valk admin to turn on ${t.name} for your account "${me.username}".`
          : 'Sign in to a Valk account first (from the chat page), then ask the Valk admin to turn on a plan for you.');
      });
    }
    wrap.appendChild(card);
  }
}

function renderTable() {
  const cols = [['Free', catalog.free], ...TIER_ORDER.map((k) => [catalog.tiers[k].name, catalog.tiers[k]])];
  const yes = '✓';
  const no = '—';
  const rows = [
    ['Price / month', (t) => (t.monthly ? fmtMoney(billing === 'annual' ? t.annual / 12 : t.monthly) : 'Free')],
    ['People per room', (t) => t.roomCapacity],
    ['Permanent rooms', (t) => (t.permanentRooms ? yes : 'Deleted after 90 days idle')],
    ['Room wallpaper', (t) => (t.animatedWallpaper ? 'Picture, GIF, video' : 'Picture')],
    ['Room .zip export', (t) => (t.roomExport ? yes : no)],
    ['Badge', (t) => t.badge || no],
    ['Name color', (t) => (t.rainbowName ? 'All + rainbow' : t.nameColor ? yes : no)],
    ['Bubble themes', (t) => (t.bubbleThemes ? yes : no)],
    ['Picture shapes', (t) => (t.extraShapes ? '8 shapes' : '3 shapes')],
    ['HD pictures', (t) => (t.hd ? '2048px' : no)],
    ['Pictures at once', (t) => t.batchSize],
    ['Saved gallery', (t) => t.galleryLimit],
  ];
  const table = document.getElementById('compare-table');
  table.innerHTML = '';
  const head = table.insertRow();
  head.appendChild(Object.assign(document.createElement('th'), { textContent: '' }));
  for (const [name] of cols) head.appendChild(Object.assign(document.createElement('th'), { textContent: name }));
  for (const [label, fn] of rows) {
    const tr = table.insertRow();
    tr.appendChild(Object.assign(document.createElement('th'), { textContent: label }));
    for (const [, t] of cols) tr.insertCell().textContent = fn(t);
  }
}

function renderMyPlan() {
  const el = document.getElementById('my-plan');
  if (!me || !me.tier) {
    el.classList.add('hidden');
    return;
  }
  const t = catalog.tiers[me.tier];
  const until = me.until ? ` until ${new Date(me.until).toLocaleDateString()}` : '';
  el.textContent = `${t.badge} You're on ${t.name}${until}`;
  el.classList.remove('hidden');
}

function renderCosmetics() {
  const section = document.getElementById('cosmetics');
  if (!me || !me.tier) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  const perks = me.perks;
  const colorRow = document.getElementById('color-options');
  colorRow.innerHTML = '';
  for (const c of [null, ...catalog.nameColors]) {
    const locked = c === 'rainbow' && !perks.rainbowName;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (pickedColor === c ? ' picked' : '');
    b.disabled = locked;
    const swatch = document.createElement('span');
    swatch.className = c ? `name-${c}` : '';
    swatch.textContent = c ? COLOR_LABELS[c] : 'Default';
    b.appendChild(swatch);
    b.addEventListener('click', () => { pickedColor = c; renderCosmetics(); });
    colorRow.appendChild(b);
  }
  const bubbleRow = document.getElementById('bubble-options');
  bubbleRow.innerHTML = '';
  document.getElementById('bubble-lock').classList.toggle('hidden', perks.bubbleThemes);
  for (const theme of [null, ...catalog.bubbleThemes]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip bubble-chip' + (theme ? ` bubble-${theme}` : '') + (pickedBubble === theme ? ' picked' : '');
    b.disabled = !perks.bubbleThemes && theme !== null;
    b.textContent = theme ? BUBBLE_LABELS[theme] : 'Default';
    b.addEventListener('click', () => { pickedBubble = theme; renderCosmetics(); });
    bubbleRow.appendChild(b);
  }
  const t = catalog.tiers[me.tier];
  const nameEl = document.getElementById('preview-name');
  nameEl.className = 'preview-name' + (pickedColor ? ` name-${pickedColor}` : '');
  nameEl.textContent = `${t.badge} ${me.username}`;
  document.getElementById('preview-bubble').className = 'preview-bubble' + (pickedBubble ? ` bubble-${pickedBubble}` : '');
}

document.getElementById('save-cosmetics').addEventListener('click', async () => {
  const status = document.getElementById('save-status');
  status.textContent = 'Saving…';
  try {
    const res = await fetch('/api/premium/cosmetics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ nameColor: pickedColor, bubble: pickedBubble }),
    });
    const data = await res.json().catch(() => ({}));
    status.textContent = res.ok ? '✓ Saved — new messages will use it' : (data.error || 'Could not save');
  } catch {
    status.textContent = 'Could not reach the server';
  }
});

for (const [id, mode] of [['bill-monthly', 'monthly'], ['bill-annual', 'annual']]) {
  document.getElementById(id).addEventListener('click', () => {
    billing = mode;
    document.getElementById('bill-monthly').classList.toggle('active', mode === 'monthly');
    document.getElementById('bill-annual').classList.toggle('active', mode === 'annual');
    renderCards();
    renderTable();
  });
}

(async function init() {
  try {
    const [tiersRes, meRes] = await Promise.all([
      fetch('/api/premium/tiers'),
      fetch('/api/premium/me', { headers: authHeaders }),
    ]);
    catalog = await tiersRes.json();
    me = await meRes.json();
  } catch {
    document.getElementById('tier-cards').textContent = 'Could not load plans — check your connection and refresh.';
    return;
  }
  pickedColor = me.nameColor || null;
  pickedBubble = me.bubble || null;
  renderMyPlan();
  renderCards();
  renderTable();
  renderCosmetics();
})();
