const express = require('express');
const multer = require('multer');
const http = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const QRCode = require('qrcode');
const webpush = require('web-push');
const db = require('./db');
const patcher = require('./patcher');

const app = express();
// Only trust X-Forwarded-For from the local reverse proxy (nginx in front of this process in
// production) — without this, req.ip (used by isAuthRateLimited) resolves to the proxy's own
// loopback address for every request, collapsing every visitor into one shared rate-limit bucket.
app.set('trust proxy', 'loopback');
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
// Registered this early so every route below — including the self-healing routes, which are
// defined before the rest of the app's routes — can read req.body on POST requests.
app.use(express.json());

// ---- Push notifications (real OS/browser push, delivered even with the tab/app closed —
// unlike the in-tab `Notification` API, which only fires while a page is open). Keys are
// generated once (via `node -e "require('web-push').generateVAPIDKeys()"`) and kept out of
// git since the private key would let anyone impersonate this server to push subscribers.
const vapidKeys = require('./vapid-keys.json');
webpush.setVapidDetails('mailto:admin@example.com', vapidKeys.publicKey, vapidKeys.privateKey);

// Sends a push to everyone subscribed in a room except the sender. Only bothers with
// subscribers who aren't currently an open WS client in that room — if they're connected,
// they already got the message live plus the in-tab Notification, so a system push on top
// would just be a duplicate popup.
function pushNewMessage(code, entry) {
  const room = rooms.get(code);
  const connectedNames = new Set(room ? [...room.clients].map((c) => c.profile.name) : []);
  const subs = db.getPushSubscriptionsForRoom(code);
  const body = entry.text || (entry.mediaType ? `sent a${entry.mediaType === 'image' ? 'n' : ''} ${entry.mediaType}` : '');
  const payload = JSON.stringify({ title: entry.name, body, roomCode: code, messageId: entry.id });
  for (const sub of subs) {
    if (sub.name === entry.name || connectedNames.has(sub.name)) continue;
    webpush.sendNotification(sub.subscription, payload).catch((err) => {
      if (err.statusCode === 404 || err.statusCode === 410) db.removePushSubscription(sub.endpoint);
    });
  }
}

// Matches an email address typed inline in a chat message, e.g. "jondoe@gmail.com" — used to
// let someone page a specific account holder directly, independent of the normal per-room push
// above (which only reaches people already subscribed *in that room*). A mention push goes to
// every device that account has ever subscribed push on, room or no room, online or offline —
// that's the whole point, per the user's ask ("even when they are offline").
const MENTION_EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function pushMentionNotifications(code, entry) {
  const emails = entry.text ? entry.text.match(MENTION_EMAIL_RE) : null;
  if (!emails) return;
  const seen = new Set();
  for (const email of emails) {
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Up to MAX_ACCOUNTS_PER_EMAIL accounts can now share one email — page every one of them,
    // not just a single account, since there's no longer a 1:1 email-to-account mapping.
    const accounts = db.getAccountsByEmail(email);
    for (const account of accounts) {
      const subs = db.getPushSubscriptionsForAccount(account.id);
      if (!subs.length) continue;
      const payload = JSON.stringify({
        title: `${entry.name} mentioned you`,
        body: entry.text,
        roomCode: code,
        messageId: entry.id,
      });
      for (const sub of subs) {
        webpush.sendNotification(sub.subscription, payload).catch((err) => {
          if (err.statusCode === 404 || err.statusCode === 410) db.removePushSubscription(sub.endpoint);
        });
      }
    }
  }
}

// Pages every device an admin has opted into notifications on (admin.html's "Enable
// notifications" button, see /admin/push/subscribe) the moment a new report is filed — without
// this, a report just sits in /admin.html until someone happens to open the page and check.
function pushAdminOnNewReport(roomCode, reporterName, targetName) {
  const subs = db.getAdminPushSubscriptions();
  if (!subs.length) return;
  const payload = JSON.stringify({
    title: 'New report',
    body: `${reporterName} reported ${targetName} in room ${roomCode}`,
    adminReport: true,
  });
  for (const sub of subs) {
    webpush.sendNotification(sub.subscription, payload).catch((err) => {
      if (err.statusCode === 404 || err.statusCode === 410) db.removeAdminPushSubscription(sub.endpoint);
    });
  }
}

// ---- Self-healing: error capture + AI-drafted patch proposals (see patcher.js) ----
// Every uncaught error (server crash, WS message handler, Express route) is logged to
// error_reports and handed to the patcher, which drafts a proposed fix via the Claude API
// and stores it as a pending patch_proposal — nothing is ever auto-applied. A human reviews
// and approves/rejects via /admin.html (gated by admin-key.json, generated on first boot).
function reportError(source, err, context = {}) {
  const id = crypto.randomUUID();
  db.insertErrorReport({ id, source, message: err.message || String(err), stack: err.stack || null, context });
  patcher
    .generateProposal({ id, message: err.message || String(err), stack: err.stack || null, context })
    .catch((e) => console.error('[patcher] generateProposal failed:', e.message));
  return id;
}

// An unhandled rejection doesn't corrupt process state the way a thrown exception can, so it's
// logged and the process keeps running. An uncaughtException means something escaped every
// try/catch in the codebase — log it, then exit so systemd's Restart=on-failure brings the
// service back up clean rather than continuing in a possibly-corrupted state.
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error('Unhandled rejection:', err);
  reportError('server', err, { fatal: false });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  reportError('server', err, { fatal: true });
  process.exit(1);
});

// Admin key, generated once on first boot (same pattern as vapid-keys.json) and gitignored —
// gates /admin.html's error/patch review-and-approve panel so it isn't wide open if this app
// is ever exposed past localhost (see the cloudflared-tunnel note elsewhere in this codebase).
const ADMIN_KEY_PATH = path.join(__dirname, 'admin-key.json');
let adminKey;
if (fs.existsSync(ADMIN_KEY_PATH)) {
  adminKey = JSON.parse(fs.readFileSync(ADMIN_KEY_PATH, 'utf8')).key;
} else {
  adminKey = crypto.randomBytes(24).toString('hex');
  fs.writeFileSync(ADMIN_KEY_PATH, JSON.stringify({ key: adminKey }));
  console.log(`Admin panel key generated — bookmark this: http://localhost:${process.env.PORT || 3001}/admin.html?key=${adminKey}`);
}

// Google sign-in (optional, alongside username/password accounts) — same gitignored-JSON pattern
// as admin-key.json/vapid-keys.json, auto-created empty on first boot. A Client ID isn't secret
// (it's sent to the browser either way), but keeping it in one file mirrors the other credentials
// here and means the user only has to touch one place. Only the user can create this Client ID —
// it requires a project in Google Cloud Console (console.cloud.google.com/apis/credentials) with
// an OAuth 2.0 "Web application" client whose Authorized JavaScript origins include this app's
// URL(s) (e.g. http://localhost:3001, plus the cloudflared URL if used). Until clientId is filled
// in, /auth/google-client-id reports null and the client hides the Google button entirely — every
// other account/chat feature works unaffected.
const GOOGLE_CONFIG_PATH = path.join(__dirname, 'google-config.json');
let googleConfig;
if (fs.existsSync(GOOGLE_CONFIG_PATH)) {
  googleConfig = JSON.parse(fs.readFileSync(GOOGLE_CONFIG_PATH, 'utf8'));
} else {
  googleConfig = { clientId: '' };
  fs.writeFileSync(GOOGLE_CONFIG_PATH, JSON.stringify(googleConfig, null, 2));
  console.log(`No Google sign-in configured — add your OAuth Client ID to ${GOOGLE_CONFIG_PATH} and restart to enable it.`);
}
const { OAuth2Client } = require('google-auth-library');
const googleClient = googleConfig.clientId ? new OAuth2Client(googleConfig.clientId) : null;

function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : String(req.query.key || '');
  const tokenBuf = Buffer.from(token);
  const keyBuf = Buffer.from(adminKey);
  if (!token || tokenBuf.length !== keyBuf.length || !crypto.timingSafeEqual(tokenBuf, keyBuf)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Public — clients report their own uncaught errors here (window.onerror / unhandledrejection).
app.post('/errors/report', (req, res) => {
  // req.body can be undefined if the request didn't carry a JSON content-type (e.g. a stale
  // service-worker-cached client), which used to throw here and get logged as a server error
  // by the very endpoint meant to capture errors — guard against that instead of assuming.
  const body = req.body || {};
  const message = String(body.message || '').slice(0, 2000);
  if (!message) return res.status(400).json({ error: 'Missing message' });
  const stack = typeof body.stack === 'string' ? body.stack.slice(0, 5000) : null;
  const context = {
    url: typeof body.url === 'string' ? body.url.slice(0, 500) : null,
    userAgent: (req.get('user-agent') || '').slice(0, 300),
  };
  res.json({ ok: true });
  reportError('client', { message, stack }, context);
});

app.get('/admin/errors', requireAdmin, (req, res) => {
  res.json({ errors: db.getRecentErrorReports() });
});

app.get('/admin/reports', requireAdmin, (req, res) => {
  res.json({ reports: db.getRecentReports() });
});

app.post('/admin/reports/:id/resolve', requireAdmin, (req, res) => {
  db.setReportStatus(req.params.id, 'resolved');
  res.json({ ok: true });
});

app.post('/admin/reports/:id/dismiss', requireAdmin, (req, res) => {
  db.setReportStatus(req.params.id, 'dismissed');
  res.json({ ok: true });
});

app.get('/admin/scorpture-reports', requireAdmin, (req, res) => {
  res.json({ reports: db.getRecentScorptureReports() });
});

app.post('/admin/scorpture-reports/:id/resolve', requireAdmin, (req, res) => {
  db.setScorptureReportStatus(req.params.id, 'resolved');
  res.json({ ok: true });
});

app.post('/admin/scorpture-reports/:id/dismiss', requireAdmin, (req, res) => {
  db.setScorptureReportStatus(req.params.id, 'dismissed');
  res.json({ ok: true });
});

// Gated by the admin key itself (not a session/account) — anyone who can load /admin.html at
// all can opt their device into push, which matches admin.html's existing all-or-nothing access
// model (the key is the only credential the whole panel has).
app.get('/admin/push/vapid-public-key', requireAdmin, (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/admin/push/subscribe', requireAdmin, (req, res) => {
  const subscription = req.body.subscription;
  if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Missing subscription' });
  db.addAdminPushSubscription(subscription.endpoint, subscription);
  res.json({ ok: true });
});

app.post('/admin/push/unsubscribe', requireAdmin, (req, res) => {
  const endpoint = req.body.endpoint;
  if (endpoint) db.removeAdminPushSubscription(endpoint);
  res.json({ ok: true });
});

app.get('/admin/patches', requireAdmin, (req, res) => {
  res.json({ patches: db.getPendingPatchProposals() });
});

app.post('/admin/patches/:id/approve', requireAdmin, (req, res) => {
  try {
    const result = patcher.applyProposal(req.params.id);
    res.json({ ok: true, ...result });
    if (result.restarted) {
      setTimeout(() => {
        exec('systemctl --user restart chat-app', (err) => {
          if (err) console.error('[patcher] Restart failed:', err.message);
        });
      }, 500);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/admin/patches/:id/reject', requireAdmin, (req, res) => {
  db.setPatchProposalStatus(req.params.id, 'rejected');
  res.json({ ok: true });
});

// ---- File uploads (photos/videos) ----
// The saved extension must come from this fixed map, never from file.originalname — the
// client fully controls that filename string independent of the mimetype check below, so
// e.g. Content-Type: image/png (passes the filter) + originalname "x.html" used to save and
// statically serve real attacker HTML/JS from this origin (stored XSS). Also deliberately
// excludes image/svg+xml: SVGs can carry inline <script> that runs when opened directly.
const SAFE_UPLOAD_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/ogg': '.ogv',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.weba',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
};
// MediaRecorder-produced blobs (voice clips/call recordings) report a mimetype with a codec
// parameter attached, e.g. "audio/webm;codecs=opus" — strip everything after ';' before
// matching against SAFE_UPLOAD_EXT, same as how Content-Type parameters are meant to be read.
function baseMimeType(mimetype) {
  return String(mimetype || '').split(';')[0].trim().toLowerCase();
}
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'public/uploads'),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${SAFE_UPLOAD_EXT[baseMimeType(file.mimetype)] || ''}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 300 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (Object.prototype.hasOwnProperty.call(SAFE_UPLOAD_EXT, baseMimeType(file.mimetype))) {
      cb(null, true);
    } else {
      cb(new Error('Only images, videos, and audio are allowed'));
    }
  },
});

app.use(express.static(path.join(__dirname, 'public')));

// The WS join-room handler is the only place that used to check a room's PIN — these four plain
// HTTP routes (below) could read or post into a PIN-protected room without ever supplying it.
// Shared here so all four check it the same way join-room already does.
function roomPinOk(dbRoom, suppliedPin) {
  return !dbRoom || !dbRoom.pin_required || String(suppliedPin || '').trim() === dbRoom.pin_required;
}

// Lets the AI Studio page (its own tab, no live WebSocket/presence session) drop a
// generated image into a room's chat without going through the join-server/join-room
// flow — which would spuriously fire "X joined the room" for a tab that isn't really
// sitting in the room.
app.post('/post-image', (req, res) => {
  const code = String(req.body.code || '').toUpperCase().trim();
  const name = String(req.body.name || 'Someone').slice(0, 30).trim() || 'Someone';
  const mediaUrl = typeof req.body.mediaUrl === 'string' ? req.body.mediaUrl.slice(0, 2000) : null;
  const prompt = String(req.body.prompt || '').slice(0, 500).trim();
  if (!code || !mediaUrl) return res.status(400).json({ error: 'Missing room code or image' });
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!roomPinOk(db.getRoom(code), req.body.pin)) return res.status(403).json({ error: 'Incorrect or missing room PIN' });

  const entry = {
    type: 'message',
    id: crypto.randomUUID(),
    name,
    sub: null,
    text: prompt ? `🎨 AI image: "${prompt}"` : '',
    mediaUrl,
    mediaType: 'image',
    at: Date.now(),
  };
  room.history.push(entry);
  if (room.history.length > HISTORY_LIMIT) room.history.shift();
  db.insertMessage({ id: entry.id, roomCode: code, name: entry.name, text: entry.text, mediaUrl: entry.mediaUrl, mediaType: entry.mediaType, at: entry.at });
  db.upsertRoom(code);
  broadcastRoom(code, entry);
  pushNewMessage(code, entry);
  res.json({ ok: true });
});

// Same "own tab, no live WebSocket session" case as /post-image, but generic over
// mediaType so the Video Editor can drop a finished render into the room's chat.
app.post('/post-media', (req, res) => {
  const code = String(req.body.code || '').toUpperCase().trim();
  const name = String(req.body.name || 'Someone').slice(0, 30).trim() || 'Someone';
  const mediaUrl = typeof req.body.mediaUrl === 'string' ? req.body.mediaUrl.slice(0, 2000) : null;
  const mediaType = ['video', 'image', 'audio'].includes(req.body.mediaType) ? req.body.mediaType : null;
  const caption = String(req.body.caption || '').slice(0, 500).trim();
  if (!code || !mediaUrl || !mediaType) return res.status(400).json({ error: 'Missing room code or media' });
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!roomPinOk(db.getRoom(code), req.body.pin)) return res.status(403).json({ error: 'Incorrect or missing room PIN' });

  const entry = {
    type: 'message',
    id: crypto.randomUUID(),
    name,
    sub: null,
    text: caption,
    mediaUrl,
    mediaType,
    at: Date.now(),
  };
  room.history.push(entry);
  if (room.history.length > HISTORY_LIMIT) room.history.shift();
  db.insertMessage({ id: entry.id, roomCode: code, name: entry.name, text: entry.text, mediaUrl: entry.mediaUrl, mediaType: entry.mediaType, at: entry.at });
  db.upsertRoom(code);
  broadcastRoom(code, entry);
  pushNewMessage(code, entry);
  res.json({ ok: true });
});

// Full-history search (unlike the 50-message in-memory window) — this is why SQLite
// persistence was built first, since search over just the last 50 messages wouldn't
// be very useful.
app.post('/search', (req, res) => {
  const body = req.body || {};
  const code = String(body.code || '').toUpperCase().trim();
  const q = String(body.q || '').trim();
  if (!code || !q) return res.json({ results: [] });
  const dbRoom = db.getRoom(code);
  if (!rooms.has(code) && !dbRoom) return res.status(404).json({ error: 'Room not found' });
  if (!roomPinOk(dbRoom, body.pin)) return res.status(403).json({ error: 'Incorrect or missing room PIN' });
  res.json({ results: db.searchMessages(code, q, 50) });
});

// Plain-text transcript download — reuses the same room-existence check as /search,
// and reads full history from SQLite rather than the in-memory 50-message window.
app.get('/export', (req, res) => {
  const code = String(req.query.code || '').toUpperCase().trim();
  const dbRoom = db.getRoom(code);
  if (!code || (!rooms.has(code) && !dbRoom)) return res.status(404).json({ error: 'Room not found' });
  if (!roomPinOk(dbRoom, req.query.pin)) return res.status(403).json({ error: 'Incorrect or missing room PIN' });
  const messages = db.getAllMessagesForExport(code);
  const roomLabel = dbRoom && dbRoom.name ? `${dbRoom.name} (${code})` : code;
  const lines = [`Valk chat export — ${roomLabel}`, `Exported ${new Date().toISOString()}`, ''];
  messages.forEach((m) => {
    const time = new Date(m.at).toISOString();
    if (m.deleted) { lines.push(`[${time}] ${m.name}: (message deleted)`); return; }
    let line = `[${time}] ${m.name}: ${m.text || ''}`;
    if (m.mediaUrl && m.mediaType !== 'poll') line += ` [${m.mediaType}: ${m.mediaUrl}]`;
    if (m.mediaType === 'poll') {
      try {
        const p = JSON.parse(m.text);
        line = `[${time}] ${m.name}: [POLL] ${p.question} (${p.options.join(', ')})`;
      } catch {}
    }
    lines.push(line);
  });
  const text = lines.join('\n');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="valk-${code}.txt"`);
  res.send(text);
});

// Room join QR code — encodes a URL (not just the bare code) so scanning it lands directly
// on the join screen with the room pre-filled, same deep-link param the rejoin-on-reload flow
// already reads (?room=).
app.get('/room-qr/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase().trim();
  if (!code || (!rooms.has(code) && !db.getRoom(code))) return res.status(404).end();
  const url = `${req.protocol}://${req.get('host')}/?room=${encodeURIComponent(code)}`;
  try {
    const png = await QRCode.toBuffer(url, { width: 300, margin: 1 });
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch {
    res.status(500).end();
  }
});

// ---- Link previews (og:title/og:image unfurling) ----
const LINK_PREVIEW_TTL_MS = 60 * 60 * 1000;
const LINK_PREVIEW_FAILURE_TTL_MS = 5 * 60 * 1000;
const linkPreviewCache = new Map(); // url -> { data, expiresAt }

// String-level denylist for obvious localhost/private targets — not exhaustive SSRF protection
// (doesn't resolve DNS before fetching), but blocks the easy cases for a hobby app with no
// accounts/auth surface behind it.
function isPrivateHost(hostname) {
  if (!hostname) return true;
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

// fetch() with redirect: 'follow' only validates the *initial* URL — a public URL that
// redirects to a private/internal address (e.g. the cloud metadata IP, or a localhost admin
// route) would sail straight through unchecked, since fetch never re-runs isPrivateHost on
// each hop. Handles redirects manually instead, re-validating the target host every time.
async function fetchNoSsrf(startUrl, options = {}, maxRedirects = 5) {
  let currentUrl = startUrl;
  for (let i = 0; i <= maxRedirects; i++) {
    const parsed = new URL(currentUrl);
    if (!['http:', 'https:'].includes(parsed.protocol) || isPrivateHost(parsed.hostname)) {
      throw new Error('URL not allowed');
    }
    const response = await fetch(currentUrl, { ...options, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect with no location');
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }
    return response;
  }
  throw new Error('Too many redirects');
}

function extractMetaTag(html, name) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${name}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function decodeHtmlEntities(str) {
  return str.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

app.get('/link-preview', async (req, res) => {
  const url = String(req.query.url || '');
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || isPrivateHost(parsed.hostname)) {
    return res.status(400).json({ error: 'URL not allowed' });
  }
  const cached = linkPreviewCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return res.json(cached.data);

  const empty = { url, title: null, description: null, image: null };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetchNoSsrf(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ValkLinkPreview/1.0)' },
    });
    clearTimeout(timeout);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      linkPreviewCache.set(url, { data: empty, expiresAt: Date.now() + LINK_PREVIEW_TTL_MS });
      return res.json(empty);
    }
    // og:/title tags live in <head>, near the top — read a bounded prefix instead of the whole
    // page (pages can be huge, and we only need the first ~200KB).
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    while (html.length < 200000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});
    const title = extractMetaTag(html, 'og:title') || (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || null;
    const description = extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description');
    let image = extractMetaTag(html, 'og:image');
    if (image) {
      try { image = new URL(image, url).href; } catch { image = null; }
    }
    const data = {
      url,
      title: title ? decodeHtmlEntities(title.trim()).slice(0, 200) : null,
      description: description ? decodeHtmlEntities(description.trim()).slice(0, 300) : null,
      image,
    };
    linkPreviewCache.set(url, { data, expiresAt: Date.now() + LINK_PREVIEW_TTL_MS });
    res.json(data);
  } catch {
    linkPreviewCache.set(url, { data: empty, expiresAt: Date.now() + LINK_PREVIEW_FAILURE_TTL_MS });
    res.json(empty);
  }
});

app.post('/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const mediaType = req.file.mimetype.startsWith('video/')
      ? 'video'
      : req.file.mimetype.startsWith('audio/')
      ? 'audio'
      : 'image';
    res.json({ url: `/uploads/${req.file.filename}`, mediaType });
  });
});

// Reads `Authorization: Bearer <token>`, returns the account row or null — never throws, so
// route handlers can treat "not signed in" the same as "bad/expired token". Defined ahead of
// the push routes below (moved out of the Accounts section further down) since /push/subscribe
// needs it to tie a subscription to an account for cross-room mention pushes.
function getAccountFromReq(req) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  return db.getSessionAccount(token) || null;
}

app.get('/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// roomCode is optional — an account-only subscribe (not currently in any room, e.g. right after
// sign-in) still needs a row so friend-DM push notifications below have somewhere to deliver to.
app.post('/push/subscribe', (req, res) => {
  const roomCode = String(req.body.roomCode || '').toUpperCase().trim();
  const name = String(req.body.name || '').slice(0, 30).trim();
  const subscription = req.body.subscription;
  if (!name || !subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Missing name or subscription' });
  }
  const account = getAccountFromReq(req);
  db.savePushSubscription(roomCode || null, name, subscription, account ? account.id : null);
  res.json({ ok: true });
});

app.post('/push/unsubscribe', (req, res) => {
  const endpoint = String(req.body.endpoint || '');
  if (endpoint) db.removePushSubscription(endpoint);
  res.json({ ok: true });
});

// ---- Accounts (optional — plain name-only chat still works with no account at all; signing in
// just lets your recent-rooms list follow you to another device instead of living only in this
// browser's localStorage). Passwords hashed with scrypt (Node's built-in, no extra dependency —
// bcrypt would need a native module on top of the one better-sqlite3 already brings in).
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// One email (e.g. one Gmail address) can back up to this many separate accounts/usernames.
const MAX_ACCOUNTS_PER_EMAIL = 10;

// scryptSync (used by both hashPassword and verifyPassword below) is synchronous and CPU-bound —
// on Node's single thread, a burst of concurrent auth requests would serialize and stall every
// other request (including all WebSocket message handling) for the whole process. Keyed by IP
// since these routes are unauthenticated by definition. authRateLimits is capped in size (see
// isAuthRateLimited) rather than ever fully cleared, so long-running uptime doesn't leak memory
// across many distinct IPs.
const authRateLimits = new Map();
function isAuthRateLimited(req) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const timestamps = (authRateLimits.get(ip) || []).filter((t) => now - t < AUTH_LIMIT_WINDOW_MS);
  if (timestamps.length >= AUTH_LIMIT_MAX) {
    authRateLimits.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  authRateLimits.set(ip, timestamps);
  if (authRateLimits.size > 10000) authRateLimits.clear(); // crude bound on worst-case memory
  return false;
}

app.post('/auth/signup', (req, res) => {
  if (isAuthRateLimited(req)) return res.status(429).json({ error: 'Too many attempts — try again in a minute' });
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 letters, numbers, or underscores' });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (db.getAccountByUsername(username)) return res.status(409).json({ error: 'That username is taken' });
  if (db.countAccountsByEmail(email) >= MAX_ACCOUNTS_PER_EMAIL) {
    return res.status(409).json({ error: `This email already has the maximum of ${MAX_ACCOUNTS_PER_EMAIL} accounts` });
  }

  const id = crypto.randomUUID();
  const salt = crypto.randomBytes(16).toString('hex');
  db.createAccount(id, username, email, hashPassword(password, salt), salt);
  const token = crypto.randomUUID();
  db.createSession(token, id);
  res.json({ token, username });
});

app.post('/auth/login', (req, res) => {
  if (isAuthRateLimited(req)) return res.status(429).json({ error: 'Too many attempts — try again in a minute' });
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const account = db.getAccountByUsername(username);
  if (!account || !verifyPassword(password, account.salt, account.password_hash)) {
    return res.status(401).json({ error: 'Wrong username or password' });
  }
  const token = crypto.randomUUID();
  db.createSession(token, account.id);
  res.json({ token, username: account.username });
});

// Public — the client checks this before rendering the Google button at all, so an unconfigured
// server just shows plain username/password (no broken button, no console errors about a missing
// Client ID).
app.get('/auth/google-client-id', (req, res) => {
  res.json({ clientId: googleConfig.clientId || null });
});

// Derives a valid, unique USERNAME_RE-matching username from a Google profile's name/email —
// Google accounts don't come with a username of their own, and we still want one for @mentions,
// display, etc. to work the same as password accounts.
function uniqueUsernameFrom(seed) {
  let base = String(seed).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) || 'user';
  if (base.length < 3) base = (base + '000').slice(0, 3);
  let candidate = base;
  let n = 0;
  while (db.getAccountByUsername(candidate)) {
    n += 1;
    candidate = `${base}${n}`.slice(0, 20);
  }
  return candidate;
}

app.post('/auth/google', async (req, res) => {
  if (!googleClient) return res.status(400).json({ error: 'Google sign-in is not configured on this server' });
  const credential = String(req.body.credential || '');
  if (!credential) return res.status(400).json({ error: 'Missing credential' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: googleConfig.clientId });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'Could not verify Google sign-in' });
  }

  const googleId = payload.sub;
  const email = payload.email || null;

  let account = db.getAccountByGoogleId(googleId);
  if (!account && email) {
    // Someone who already has a password account under this email — link rather than duplicate.
    const existing = db.getAccountByEmail(email);
    if (existing) {
      db.linkGoogleId(existing.id, googleId);
      account = db.getAccountById(existing.id);
    }
  }
  if (!account) {
    const id = crypto.randomUUID();
    const username = uniqueUsernameFrom(payload.name || (email ? email.split('@')[0] : 'user'));
    db.createAccountWithGoogle(id, username, email, googleId);
    account = db.getAccountById(id);
  }

  const token = crypto.randomUUID();
  db.createSession(token, account.id);
  res.json({ token, username: account.username });
});

app.post('/auth/logout', (req, res) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token) db.deleteSession(token);
  res.json({ ok: true });
});

app.get('/auth/me', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  res.json({ username: account.username });
});

app.get('/account/recent-rooms', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  res.json({ rooms: db.getAccountRecentRooms(account.id) });
});

app.post('/account/recent-rooms', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const code = String(req.body.code || '').toUpperCase().trim();
  const name = String(req.body.name || '').slice(0, 60).trim();
  if (!code) return res.status(400).json({ error: 'Missing room code' });
  db.upsertAccountRecentRoom(account.id, code, name);
  res.json({ ok: true });
});

// Changing an account's login username. Friends/friend-DMs/push are all account-id based (see
// db.js friendships/group_dm_members) so nothing there needs migrating — this only affects future
// lookups by username (sign-in, friend requests, @mentions of the new name). Past content that
// denormalized the old username at write time (chat messages, Scorpture uploads/comments) keeps
// showing it, same as a room display-name rename leaves old messages alone.
app.post('/account/username', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const username = String(req.body.username || '').trim();
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 letters, numbers, or underscores' });
  }
  const existing = db.getAccountByUsername(username);
  if (existing && existing.id !== account.id) return res.status(409).json({ error: 'That username is taken' });
  db.updateAccountUsername(account.id, username);
  res.json({ username });
});

// ---- Friends (account-only — an anonymous per-room display name isn't a stable enough
// identity to hang a friends list off of) ----

app.get('/friends', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  res.json({
    friends: db.getFriends(account.id),
    incoming: db.getIncomingFriendRequests(account.id),
    outgoing: db.getOutgoingFriendRequests(account.id),
    blocked: db.getBlockedUsers(account.id),
  });
});

app.post('/friends/request', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const target = db.getAccountByUsername(String(req.body.username || '').trim());
  if (!target) return res.status(404).json({ error: 'No account with that username' });
  if (target.id === account.id) return res.status(400).json({ error: "You can't add yourself" });
  if (db.isBlockedBetween(account.id, target.id)) {
    return res.status(403).json({ error: 'Unable to send a friend request to this user' });
  }
  const existing = db.getFriendshipBetween(account.id, target.id);
  if (existing && existing.status === 'accepted') return res.status(409).json({ error: 'Already friends' });
  if (existing && existing.status === 'pending' && existing.requester_id === target.id) {
    // They already sent us a request — this "add" completes it instead of creating a duplicate.
    db.acceptFriendRequest(target.id, account.id);
    return res.json({ status: 'accepted' });
  }
  db.upsertFriendRequest(account.id, target.id);
  res.json({ status: 'pending' });
});

app.post('/friends/accept', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const target = db.getAccountByUsername(String(req.body.username || '').trim());
  if (!target) return res.status(404).json({ error: 'No account with that username' });
  const existing = db.getFriendshipBetween(account.id, target.id);
  if (!existing || existing.status !== 'pending' || existing.requester_id !== target.id) {
    return res.status(400).json({ error: 'No pending request from that user' });
  }
  db.acceptFriendRequest(target.id, account.id);
  res.json({ ok: true });
});

// Also used to decline an incoming request and to cancel one you sent — same "remove whatever
// relationship exists" operation either way.
app.post('/friends/remove', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const target = db.getAccountByUsername(String(req.body.username || '').trim());
  if (!target) return res.status(404).json({ error: 'No account with that username' });
  db.removeFriendship(account.id, target.id);
  res.json({ ok: true });
});

app.post('/friends/block', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const target = db.getAccountByUsername(String(req.body.username || '').trim());
  if (!target) return res.status(404).json({ error: 'No account with that username' });
  if (target.id === account.id) return res.status(400).json({ error: "You can't block yourself" });
  db.setBlocked(account.id, target.id);
  res.json({ ok: true });
});

app.post('/friends/unblock', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const target = db.getAccountByUsername(String(req.body.username || '').trim());
  if (!target) return res.status(404).json({ error: 'No account with that username' });
  db.unblock(account.id, target.id);
  res.json({ ok: true });
});

app.get('/friends/presence', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const presence = db.getFriends(account.id).map((f) => {
    const friendAccount = db.getAccountByUsername(f.username);
    const p = friendAccount ? getAccountPresence(friendAccount.id) : { online: false, roomCode: null, roomName: null };
    return { username: f.username, ...p };
  });
  res.json({ presence });
});

// ---- Scorpture (account-based video sharing app) — browsing/watching works signed-out,
// uploading/commenting/liking/subscribing all require an account, same split as Friends above.
// Video/thumbnail files themselves go through the existing generic /upload endpoint (already
// accepts video/* mimetypes, 300MB limit) — these routes only ever handle the metadata rows.
const VERIFIED_SUBSCRIBER_THRESHOLD = 1000000;
const SCORPTURE_CATEGORIES = ['Gaming', 'Music', 'Education', 'Comedy', 'Vlogs', 'Tech', 'Sports', 'Other'];

app.get('/api/scorpture/categories', (req, res) => {
  res.json({ categories: SCORPTURE_CATEGORIES });
});

app.get('/api/scorpture/videos', (req, res) => {
  const search = String(req.query.search || '').slice(0, 100).trim();
  const channel = String(req.query.channel || '').trim();
  const category = SCORPTURE_CATEGORIES.includes(req.query.category) ? req.query.category : null;
  let uploaderId = null;
  if (channel) {
    const channelAccount = db.getAccountByUsername(channel);
    if (!channelAccount) return res.json({ videos: [] });
    uploaderId = channelAccount.id;
  }
  const videos = db.listScorptureVideos({ search: search || null, uploaderId, category });
  // Cached per-request — a channel page lists many videos from the same one uploader, no need to
  // re-fetch their account row/subscriber count for every single one.
  const avatarCache = new Map();
  function uploaderAvatar(id) {
    if (!avatarCache.has(id)) {
      const acc = db.getAccountById(id);
      avatarCache.set(id, acc ? acc.scorpture_avatar_url || null : null);
    }
    return avatarCache.get(id);
  }
  const verifiedCache = new Map();
  function uploaderVerified(id) {
    if (!verifiedCache.has(id)) {
      verifiedCache.set(id, db.getScorptureSubscriberCount(id) >= VERIFIED_SUBSCRIBER_THRESHOLD);
    }
    return verifiedCache.get(id);
  }
  res.json({
    videos: videos.map((v) => ({
      id: v.id,
      title: v.title,
      thumbnailUrl: v.thumbnail_url,
      uploaderUsername: v.uploader_username,
      uploaderAvatarUrl: uploaderAvatar(v.uploader_id),
      uploaderVerified: uploaderVerified(v.uploader_id),
      category: v.category,
      views: v.views,
      createdAt: v.created_at,
      uploaderLive: liveStreams.has(v.uploader_id),
    })),
  });
});

app.get('/api/scorpture/videos/:id', (req, res) => {
  const account = getAccountFromReq(req);
  const video = db.getScorptureVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  db.bumpScorptureViews(video.id);
  const uploaderAccount = db.getAccountById(video.uploader_id);
  const subscriberCount = db.getScorptureSubscriberCount(video.uploader_id);
  res.json({
    id: video.id,
    title: video.title,
    description: video.description,
    videoUrl: video.video_url,
    thumbnailUrl: video.thumbnail_url,
    category: video.category,
    uploaderUsername: video.uploader_username,
    uploaderAvatarUrl: uploaderAccount ? uploaderAccount.scorpture_avatar_url || null : null,
    uploaderVerified: subscriberCount >= VERIFIED_SUBSCRIBER_THRESHOLD,
    views: video.views + 1,
    createdAt: video.created_at,
    likeCount: db.getScorptureLikeCount(video.id),
    liked: account ? db.hasScorptureLiked(video.id, account.id) : false,
    subscriberCount,
    subscribed: account ? db.isScorptureSubscribed(account.id, video.uploader_id) : false,
    isOwner: account ? account.id === video.uploader_id : false,
    live: liveStreams.has(video.uploader_id),
  });
});

// Fans a push notification out to every subscriber of a channel — shared by "new video" (below)
// and "went live" (scorpture-go-live handler). Same webpush.sendNotification + 404/410 cleanup
// pattern as pushMentionNotifications above, just fed from getScorptureSubscriberIds instead of
// an @mention match.
function notifyScorptureSubscribers(channelId, payload) {
  const subscriberIds = db.getScorptureSubscriberIds(channelId);
  for (const subscriberId of subscriberIds) {
    const subs = db.getPushSubscriptionsForAccount(subscriberId);
    for (const sub of subs) {
      webpush.sendNotification(sub.subscription, JSON.stringify(payload)).catch((err) => {
        if (err.statusCode === 404 || err.statusCode === 410) db.removePushSubscription(sub.endpoint);
      });
    }
  }
}

app.post('/api/scorpture/videos', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const title = String(req.body.title || '').slice(0, 100).trim();
  const description = String(req.body.description || '').slice(0, 2000).trim();
  const videoUrl = typeof req.body.videoUrl === 'string' ? req.body.videoUrl.slice(0, 2000) : '';
  const thumbnailUrl = typeof req.body.thumbnailUrl === 'string' ? req.body.thumbnailUrl.slice(0, 2000) : null;
  const category = SCORPTURE_CATEGORIES.includes(req.body.category) ? req.body.category : null;
  if (!title || !videoUrl.startsWith('/uploads/')) return res.status(400).json({ error: 'Missing title or video file' });
  const id = crypto.randomUUID();
  db.insertScorptureVideo({
    id,
    uploaderId: account.id,
    uploaderUsername: account.username,
    title,
    description,
    videoUrl,
    thumbnailUrl,
    category,
    createdAt: Date.now(),
  });
  notifyScorptureSubscribers(account.id, { title: `${account.username} uploaded a new video`, body: title });
  res.json({ id });
});

// Metadata-only edit (title/description/category, optionally a re-uploaded thumbnail) — the
// video file itself stays fixed once published, same split delete has vs. what it can't undo.
app.put('/api/scorpture/videos/:id', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const video = db.getScorptureVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  if (video.uploader_id !== account.id) return res.status(403).json({ error: 'Not your video' });
  const title = String(req.body.title || '').slice(0, 100).trim();
  if (!title) return res.status(400).json({ error: 'Title required' });
  const description = String(req.body.description || '').slice(0, 2000).trim();
  const category = SCORPTURE_CATEGORIES.includes(req.body.category) ? req.body.category : null;
  const thumbnailUrl = typeof req.body.thumbnailUrl === 'string' && req.body.thumbnailUrl.startsWith('/uploads/')
    ? req.body.thumbnailUrl.slice(0, 2000)
    : video.thumbnail_url;
  db.updateScorptureVideo(video.id, { title, description, category, thumbnailUrl });
  res.json({ ok: true, title, description, category, thumbnailUrl });
});

app.delete('/api/scorpture/videos/:id', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const video = db.getScorptureVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  if (video.uploader_id !== account.id) return res.status(403).json({ error: 'Not your video' });
  db.deleteScorptureVideo(video.id);
  res.json({ ok: true });
});

app.get('/api/scorpture/videos/:id/comments', (req, res) => {
  res.json({ comments: db.getScorptureComments(req.params.id) });
});

app.post('/api/scorpture/videos/:id/comments', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const video = db.getScorptureVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  const text = String(req.body.text || '').slice(0, 1000).trim();
  if (!text) return res.status(400).json({ error: 'Empty comment' });
  const comment = {
    id: crypto.randomUUID(),
    videoId: video.id,
    accountId: account.id,
    username: account.username,
    text,
    createdAt: Date.now(),
  };
  db.insertScorptureComment(comment);
  res.json({ comment: { id: comment.id, username: comment.username, text: comment.text, created_at: comment.createdAt } });
});

app.put('/api/scorpture/comments/:id', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const text = String(req.body.text || '').slice(0, 1000).trim();
  if (!text) return res.status(400).json({ error: 'Empty comment' });
  // updateScorptureComment's WHERE clause is the ownership check — a comment id that exists but
  // belongs to someone else updates zero rows, same 403 either way as one that doesn't exist.
  const updated = db.updateScorptureComment(req.params.id, account.id, text);
  if (!updated) return res.status(403).json({ error: "Comment not found or not yours" });
  res.json({ ok: true, text });
});

app.post('/api/scorpture/videos/:id/like', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const video = db.getScorptureVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  const liked = db.toggleScorptureLike(video.id, account.id);
  res.json({ liked, likeCount: db.getScorptureLikeCount(video.id) });
});

app.post('/api/scorpture/videos/:id/report', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const video = db.getScorptureVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  db.insertScorptureReport({
    id: crypto.randomUUID(),
    videoId: video.id,
    reporterAccountId: account.id,
    reporterUsername: account.username,
    uploaderUsername: video.uploader_username,
    reason: String(req.body.reason || '').slice(0, 300).trim() || null,
  });
  res.json({ ok: true });
});

// Newest videos across every channel this account subscribes to — the actual payoff for
// subscribing, see getScorptureSubscriptionFeed's comment in db.js.
app.get('/api/scorpture/subscriptions/feed', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const videos = db.getScorptureSubscriptionFeed(account.id);
  const avatarCache = new Map();
  function uploaderAvatar(id) {
    if (!avatarCache.has(id)) {
      const acc = db.getAccountById(id);
      avatarCache.set(id, acc ? acc.scorpture_avatar_url || null : null);
    }
    return avatarCache.get(id);
  }
  res.json({
    videos: videos.map((v) => ({
      id: v.id,
      title: v.title,
      thumbnailUrl: v.thumbnail_url,
      uploaderUsername: v.uploader_username,
      uploaderAvatarUrl: uploaderAvatar(v.uploader_id),
      uploaderVerified: db.getScorptureSubscriberCount(v.uploader_id) >= VERIFIED_SUBSCRIBER_THRESHOLD,
      category: v.category,
      views: v.views,
      createdAt: v.created_at,
      uploaderLive: liveStreams.has(v.uploader_id),
    })),
  });
});

app.get('/api/scorpture/channels/:username', (req, res) => {
  const account = getAccountFromReq(req);
  const channelAccount = db.getAccountByUsername(req.params.username);
  if (!channelAccount) return res.status(404).json({ error: 'No such channel' });
  const liveStream = liveStreams.get(channelAccount.id);
  const subscriberCount = db.getScorptureSubscriberCount(channelAccount.id);
  res.json({
    username: channelAccount.username,
    subscriberCount,
    verified: subscriberCount >= VERIFIED_SUBSCRIBER_THRESHOLD,
    subscribed: account ? db.isScorptureSubscribed(account.id, channelAccount.id) : false,
    isOwner: account ? account.id === channelAccount.id : false,
    live: !!liveStream,
    liveTitle: liveStream ? liveStream.title : null,
    bannerUrl: channelAccount.scorpture_banner_url || null,
    avatarUrl: channelAccount.scorpture_avatar_url || null,
  });
});

app.post('/api/scorpture/channels/:username/subscribe', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const channelAccount = db.getAccountByUsername(req.params.username);
  if (!channelAccount) return res.status(404).json({ error: 'No such channel' });
  if (channelAccount.id === account.id) return res.status(400).json({ error: "Can't subscribe to your own channel" });
  const subscribed = db.toggleScorptureSubscription(account.id, channelAccount.id);
  res.json({ subscribed, subscriberCount: db.getScorptureSubscriberCount(channelAccount.id) });
});

// Banner image is set for your own channel only (there's no username in the URL — it always
// targets whichever account the bearer token resolves to), same "already uploaded via /upload,
// this just records the URL" pattern as posting a video.
app.post('/api/scorpture/banner', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const bannerUrl = typeof req.body.bannerUrl === 'string' ? req.body.bannerUrl.slice(0, 2000) : '';
  if (!bannerUrl.startsWith('/uploads/')) return res.status(400).json({ error: 'Missing banner image' });
  db.setScorptureBanner(account.id, bannerUrl);
  res.json({ ok: true, bannerUrl });
});

// Same "own account only" shape as /api/scorpture/banner — replaces the auto-generated
// initial-letter avatar (see avatarHtml() client-side) with an uploaded picture.
app.post('/api/scorpture/avatar', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const avatarUrl = typeof req.body.avatarUrl === 'string' ? req.body.avatarUrl.slice(0, 2000) : '';
  if (!avatarUrl.startsWith('/uploads/')) return res.status(400).json({ error: 'Missing avatar image' });
  db.setScorptureAvatar(account.id, avatarUrl);
  res.json({ ok: true, avatarUrl });
});

// Cosmetic-only admin panel, hardcoded to one specific account by username *and* email (not just
// username — a deleted/recreated account with the same name shouldn't inherit this). The
// right-click-the-logo UI gate in videos.js is purely a discovery mechanic; this check here is
// the actual boundary, same getAccountFromReq(req) auth every other route uses, so there is no
// way to hit this by guessing a URL — it 403s anyone whose token doesn't resolve to this exact
// account.
function isScorptureAdmin(account) {
  return !!account && account.username === 'supdid67' && account.email === 'supdid41@gmail.com';
}

app.get('/api/scorpture/admin/bonus-subscribers', (req, res) => {
  const account = getAccountFromReq(req);
  if (!isScorptureAdmin(account)) return res.status(403).json({ error: 'Not authorized' });
  res.json({ bonusSubscribers: db.getScorptureBonusSubscribers(account.id) });
});

app.post('/api/scorpture/admin/bonus-subscribers', (req, res) => {
  const account = getAccountFromReq(req);
  if (!isScorptureAdmin(account)) return res.status(403).json({ error: 'Not authorized' });
  const count = Math.max(0, Math.min(1000000000, Math.floor(Number(req.body.count))));
  if (!Number.isFinite(count)) return res.status(400).json({ error: 'Invalid count' });
  db.setScorptureBonusSubscribers(account.id, count);
  res.json({ ok: true, bonusSubscribers: count });
});

// ---- Stream overlays — text/image graphics a broadcaster composites onto their own video
// client-side (see startGoLive/drawOverlaysOnCanvas in videos.js) before it ever reaches a
// viewer, so nothing server-side renders these; this is just the saved list of what to draw.
// Always your own account only, same "own account only" shape as banner/avatar above. ----
const OVERLAY_TYPES = ['text', 'image'];
const OVERLAY_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];
const MAX_OVERLAYS = 10;

app.get('/api/scorpture/overlays', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  res.json({ overlays: db.getScorptureOverlays(account.id) });
});

app.post('/api/scorpture/overlays', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const input = Array.isArray(req.body.overlays) ? req.body.overlays : null;
  if (!input) return res.status(400).json({ error: 'Missing overlays list' });
  if (input.length > MAX_OVERLAYS) return res.status(400).json({ error: `Max ${MAX_OVERLAYS} overlays` });
  const overlays = [];
  for (const raw of input) {
    const type = OVERLAY_TYPES.includes(raw.type) ? raw.type : null;
    const position = OVERLAY_POSITIONS.includes(raw.position) ? raw.position : 'top-left';
    const content = String(raw.content || '').slice(0, type === 'text' ? 200 : 2000).trim();
    if (!type || !content) return res.status(400).json({ error: 'Each overlay needs a type and content' });
    if (type === 'image' && !content.startsWith('/uploads/')) {
      return res.status(400).json({ error: 'Image overlays must reference an uploaded file' });
    }
    overlays.push({ id: crypto.randomUUID(), type, content, position });
  }
  db.setScorptureOverlays(account.id, overlays);
  res.json({ overlays });
});

// roomCode -> { history: [], clients: Set<ws>, bc?: {...}, gw?: Map<level, {...}> }
const rooms = new Map();

// accountId -> Set<ws> — every live connection an account is signed into (a friend can have
// several tabs/devices open), used for the online dot / "join their room" in the friends panel.
// Populated from join-server (below) when the client includes its account token; anonymous
// (no-account) connections never appear here since there's no stable identity to key on.
const accountConnections = new Map();

function registerAccountConnection(ws, accountId) {
  ws.accountId = accountId;
  if (!accountConnections.has(accountId)) accountConnections.set(accountId, new Set());
  accountConnections.get(accountId).add(ws);
}

function unregisterAccountConnection(ws) {
  if (!ws.accountId) return;
  const set = accountConnections.get(ws.accountId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) accountConnections.delete(ws.accountId);
}

// Online = has any live connection at all; roomCode/roomName come from whichever of those
// connections happens to be in a room (picking the first is fine — in practice one account is
// only ever actually chatting in one room at a time, extra tabs are usually just idle).
function getAccountPresence(accountId) {
  const set = accountConnections.get(accountId);
  if (!set || set.size === 0) return { online: false, roomCode: null, roomName: null };
  let roomCode = null;
  for (const c of set) {
    if (c.room) {
      roomCode = c.room;
      break;
    }
  }
  const dbRoom = roomCode ? db.getRoom(roomCode) : null;
  return { online: true, roomCode, roomName: dbRoom ? dbRoom.name : null };
}

// ---- Scorpture live streaming — one-to-many WebRTC, entirely in-memory/ephemeral (no DB rows,
// a stream that isn't currently running has nothing to persist). Star topology, not a mesh like
// Voice Call: the broadcaster holds one RTCPeerConnection per viewer, each viewer holds exactly
// one connection back to the broadcaster. Scoped by account id (accountId -> stream), not by
// room, since Scorpture channels are account-based — see scorpture-hello below for how a
// videos.html tab gets registered in accountConnections without going through join-server's
// room-oriented profile setup.
// accountId -> { ws, username, title, startedAt, viewers: Map<viewerId, ws> }
const liveStreams = new Map();

function endScorptureLive(accountId) {
  const stream = liveStreams.get(accountId);
  if (!stream) return;
  liveStreams.delete(accountId);
  for (const viewerWs of stream.viewers.values()) {
    send(viewerWs, { type: 'scorpture-stream-ended' });
    viewerWs.scorptureStreamerAccountId = null;
    viewerWs.scorptureViewerId = null;
  }
}

// A viewer's own connection dropping — tell the streamer so it can close that one peer connection
// instead of leaving a dead RTCPeerConnection open forever.
function leaveScorptureLive(ws) {
  if (!ws.scorptureStreamerAccountId) return;
  const stream = liveStreams.get(ws.scorptureStreamerAccountId);
  if (stream && ws.scorptureViewerId) {
    stream.viewers.delete(ws.scorptureViewerId);
    send(stream.ws, { type: 'scorpture-viewer-left', viewerId: ws.scorptureViewerId });
  }
  ws.scorptureStreamerAccountId = null;
  ws.scorptureViewerId = null;
}

app.get('/api/scorpture/live', (req, res) => {
  const streams = [...liveStreams.values()].map((s) => ({
    username: s.username,
    title: s.title,
    startedAt: s.startedAt,
    viewerCount: s.viewers.size,
  }));
  res.json({ streams });
});

// Friend DMs are deliberately not persisted anywhere (no thread/inbox to load later) — this is
// a one-shot "poke" a friend with a message, delivered live to any open tab/device they have
// (accountConnections) and, since the ask is to notify them "if they are offline or online",
// unconditionally via real push too — unlike pushNewMessage's room broadcasts above, this never
// skips someone just because they're currently connected.
function sendFriendDm(fromName, targetAccountId, text) {
  const livePayload = JSON.stringify({ type: 'friend-dm', from: fromName, text, at: Date.now() });
  const liveConnections = accountConnections.get(targetAccountId);
  if (liveConnections) {
    for (const c of liveConnections) {
      if (c.readyState === c.OPEN) c.send(livePayload);
    }
  }
  const subs = db.getPushSubscriptionsForAccount(targetAccountId);
  const pushPayload = JSON.stringify({ title: `${fromName} sent you a DM`, body: text, friendDm: true, fromUsername: fromName });
  for (const sub of subs) {
    webpush.sendNotification(sub.subscription, pushPayload).catch((err) => {
      if (err.statusCode === 404 || err.statusCode === 410) db.removePushSubscription(sub.endpoint);
    });
  }
}

// Group DMs are persisted (unlike friend-dm above) since membership needs to survive everyone
// being offline. Delivery still reuses the same two-part pattern: live push over accountConnections
// for anyone currently connected, plus unconditional real push so offline members get notified too.
function sendGroupDm(groupId, fromAccountId, fromName, text, excludeWs) {
  const memberIds = db.getGroupDmMemberIds(groupId);
  const livePayload = JSON.stringify({ type: 'group-dm', groupId, fromAccountId, fromName, text, at: Date.now() });
  for (const accountId of memberIds) {
    const liveConnections = accountConnections.get(accountId);
    if (liveConnections) {
      for (const c of liveConnections) {
        if (c !== excludeWs && c.readyState === c.OPEN) c.send(livePayload);
      }
    }
    if (accountId === fromAccountId) continue;
    const subs = db.getPushSubscriptionsForAccount(accountId);
    const pushPayload = JSON.stringify({ title: `${fromName} (group)`, body: text, groupDm: true, groupId });
    for (const sub of subs) {
      webpush.sendNotification(sub.subscription, pushPayload).catch((err) => {
        if (err.statusCode === 404 || err.statusCode === 410) db.removePushSubscription(sub.endpoint);
      });
    }
  }
}
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const HISTORY_LIMIT = 50;
const MAX_GAME_PLAYERS = 20;
const MAX_SCORPTURE_VIEWERS = 500;

// Whiteboard/Pictionary points are only ever meant to be small {x, y} pixel coordinates on a
// 900x600 canvas (see BOARD_W/BOARD_H in whiteboard.js) — the existing .slice(0, 500) only
// capped the *count* of points, not their shape/size, so a client could send up to 500 points
// each an arbitrarily large string/object, broadcast verbatim to every room member and (for
// whiteboard specifically) persisted to SQLite forever. This keeps only well-formed, small,
// in-range numeric pairs.
const STROKE_COORD_MIN = -2000;
const STROKE_COORD_MAX = 2000;
function sanitizeStrokePoints(rawPoints) {
  if (!Array.isArray(rawPoints)) return [];
  const out = [];
  for (const p of rawPoints.slice(0, 500)) {
    if (!p || typeof p !== 'object') continue;
    const x = +p.x;
    const y = +p.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < STROKE_COORD_MIN || x > STROKE_COORD_MAX || y < STROKE_COORD_MIN || y > STROKE_COORD_MAX) continue;
    out.push({ x, y });
  }
  return out;
}
const BC_MAX_HEALTH = 10;
const BC_ARMOR_TIERS = ['Wooden', 'Stone', 'Iron', 'Gold', 'Diamond']; // must match ARMOR_REDUCTION's keys on the client
const BC_PUNCH_RANGE = 4.5; // a little slack beyond the client's own reach check, not authoritative geometry
const BC_PUNCH_COOLDOWN_MS = 450;
const BC_REGEN_INTERVAL_MS = 4000; // +1 heart every 4s once eligible
const BC_REGEN_DAMAGE_COOLDOWN_MS = 5000; // must go this long without taking damage before regen starts
const BC_CLAIM_RADIUS = 8; // must match CLAIM_RADIUS on the client
const BC_MAX_CLAIMS_PER_PLAYER = 3;
// Sanity bound on a block-change's type index — BLOCK_TYPES (public/buildcraft.js) is currently
// ~180 entries; comfortably above that with room to grow, bump if that catalog ever exceeds it.
// Without this, a client sending an out-of-range type (e.g. via raw WebSocket, no UI needed)
// crashes every other client's materialFor() lookup and — worse — gets persisted to overrides,
// so anyone who joins that room afterward hits the same crash forever.
const BC_MAX_BLOCK_TYPE = 300;
// Sanity bound on player position coordinates — not real anti-cheat (this game already trusts
// client-reported position by design, see comments elsewhere), just enough to stop a client from
// broadcasting coordinates so large they break other players' rendering/camera math.
const BC_MAX_COORD = 10000;
// ---- Single-player arcade games (Snake, 2048) — no shared room state to speak of, just a
// per-room best-score leaderboard reusing the same generic `leaderboard` table every other
// game already uses. One handler pair covers both instead of duplicating near-identical code.
const ARCADE_LEADERBOARD_KEY = { snake: 'snake', '2048': 'g2048', fighterplane: 'fighterplane' };
const ARCADE_ACTIVITY_CODE = { snake: 'sk', '2048': 'tf', fighterplane: 'fp' };
const RATE_LIMIT_WINDOW_MS = 6000;
const RATE_LIMIT_MAX_MESSAGES = 8; // generous for real typing/conversation, tight enough to stop a flood
const ROOM_CREATE_WINDOW_MS = 60000;
const ROOM_CREATE_MAX = 5; // one connection shouldn't need more than a handful of rooms a minute
const REPORT_WINDOW_MS = 300000;
const REPORT_MAX = 5; // real abuse reporting is rare enough that 5/5min is generous, not restrictive
const AUTH_LIMIT_WINDOW_MS = 60000;
const AUTH_LIMIT_MAX = 8; // signup/login call scryptSync (CPU-bound, synchronous) — cheap to flood without this
const BC_DAY_CYCLE_MS = 20 * 60 * 1000; // must match DAY_CYCLE_MS on the client
const BC_SLEEP_PHASE_TARGET = 0.27; // roughly sunrise — same constant the client uses to render it
const BC_SPAWN = { x: 0, y: 2.4, z: 0, yaw: 0 }; // feet-level spawn (matches yawObject.position.set(0,4,0) minus EYE_HEIGHT)
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
const DG_ROUND_MS = 80000;
// Curated word lists — free/no-signup, no external word-list API. Grouped into categories
// so the lobby can offer a themed round instead of always drawing from everything at once.
const DG_CATEGORIES = {
  'Animals': ['elephant', 'giraffe', 'penguin', 'octopus', 'butterfly', 'spider', 'snail', 'kangaroo', 'flamingo', 'jellyfish', 'shark', 'whale'],
  'Food & Drink': ['apple', 'banana', 'sandwich', 'pizza', 'ice cream', 'birthday cake', 'cupcake', 'donut', 'pretzel', 'popcorn', 'lollipop'],
  'Fantasy & Characters': ['dragon', 'wizard', 'robot', 'pirate', 'ninja', 'astronaut', 'dinosaur', 'unicorn', 'mermaid', 'crown', 'sword', 'shield', 'juggler', 'clown', 'magic wand', 'top hat'],
  'Nature & Weather': ['volcano', 'snowman', 'mountain', 'waterfall', 'rainbow', 'thunderstorm', 'tornado', 'igloo', 'scarecrow', 'beehive', 'cactus', 'palm tree', 'mushroom', 'acorn', 'pumpkin'],
  'Vehicles & Travel': ['rocket', 'bicycle', 'submarine', 'helicopter', 'train', 'skateboard', 'surfboard', 'tractor', 'campervan', 'hot air balloon'],
  'Everyday Objects': ['umbrella', 'backpack', 'trophy', 'clock', 'telescope', 'microscope', 'compass', 'anchor', 'scarf', 'mitten', 'sunglasses', 'toothbrush', 'ladder', 'wheelbarrow', 'lawnmower', 'chimney', 'staircase', 'flip flops'],
  'Music & Instruments': ['guitar', 'piano', 'guitar pick', 'drum set', 'saxophone', 'violin', 'accordion'],
  'Adventure & Fair': ['castle', 'campfire', 'lighthouse', 'windmill', 'campsite', 'tent', 'balloon', 'kite', 'treasure chest', 'castle wall', 'drawbridge', 'campfire smoke', 'trampoline', 'seesaw', 'swing set', 'sandcastle', 'snorkel', 'ferris wheel', 'roller coaster', 'carousel', 'circus tent'],
};
const DG_CATEGORY_NAMES = Object.keys(DG_CATEGORIES);
const DG_ALL_WORDS = DG_CATEGORY_NAMES.flatMap((name) => DG_CATEGORIES[name]);

function dgPickWord(category) {
  const list = DG_CATEGORIES[category] || DG_ALL_WORDS;
  return list[Math.floor(Math.random() * list.length)];
}

// A room absent from the in-memory Map might still exist in SQLite (server was
// restarted) — hydrate its recent history from there instead of starting empty.
function getOrCreateRoom(code) {
  let room = rooms.get(code);
  if (!room) {
    room = { history: db.getRecentMessages(code, HISTORY_LIMIT), clients: new Set() };
    rooms.set(code, room);
    db.upsertRoom(code);
  }
  return room;
}

// Remembers the last signed-in account seen under a given display name in this room, so
// ban-user/mute-user can still persist a proper account-linked (rejoin-proof) ban/mute even if
// the target already disconnected by the time the host acts — e.g. kick-then-ban in one go, or
// the target closing the tab during the client's confirm() prompt. Without this, those very
// common flows silently fall back to a name-only ban that a signed-in target can trivially evade
// by reconnecting under a new display name. Bounded (oldest evicted first) since it's just a
// best-effort recent-departures cache, not meant to be a durable identity record.
const RECENT_ACCOUNT_BY_NAME_CAP = 200;
function rememberRecentAccountForName(room, name, accountId) {
  if (!room.recentAccountsByName) room.recentAccountsByName = new Map();
  const map = room.recentAccountsByName;
  map.delete(name); // re-insert at the end so it counts as freshest for eviction purposes
  map.set(name, accountId);
  if (map.size > RECENT_ACCOUNT_BY_NAME_CAP) map.delete(map.keys().next().value);
}

function generateRoomCode() {
  let code;
  do {
    code = Array.from({ length: 5 }, () =>
      ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code) || db.getRoom(code));
  return code;
}

function send(ws, data) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
}

function broadcastRoom(code, data, exclude) {
  const room = rooms.get(code);
  if (!room) return;
  const payload = JSON.stringify(data);
  for (const client of room.clients) {
    if (client !== exclude && client.readyState === client.OPEN) client.send(payload);
  }
}

function roomUsers(code) {
  const room = rooms.get(code);
  if (!room) return [];
  return [...room.clients].map((c) => ({ name: c.profile.name, avatarUrl: c.profile.avatarUrl, status: c.profile.status }));
}

// ---- "Who's in a minigame right now" activity, shown as a badge in the chat menu's
// online list. Lives on the shared room object (not a socket) because a minigame opens
// its own separate WebSocket connection from the chat page — the only thing correlating
// "this chat tab" and "that game tab" for the same person is their display name. ----
function roomActivityList(room) {
  return room.activity ? [...room.activity].map(([name, a]) => ({ name, game: a.game })) : [];
}

// Poll messages don't carry their vote tally in room.history (that'd go stale the moment
// anyone votes) — attach current counts from SQLite only when actually sending history out.
function attachPollVotes(historyEntries) {
  return historyEntries.map((e) => (e.mediaType === 'poll' ? { ...e, votes: db.getPollVotes(e.id) } : e));
}

function setRoomActivity(code, name, game) {
  const room = rooms.get(code);
  if (!room) return;
  if (!room.activity) room.activity = new Map();
  room.activity.set(name, { game, since: Date.now() });
  broadcastRoom(code, { type: 'room-activity', activity: roomActivityList(room) });
}

function clearRoomActivity(code, name) {
  const room = rooms.get(code);
  if (!room || !room.activity || !room.activity.has(name)) return;
  room.activity.delete(name);
  broadcastRoom(code, { type: 'room-activity', activity: roomActivityList(room) });
}

function broadcastWorldwideCount() {
  let count = 0;
  for (const client of wss.clients) {
    if (client.profile && client.readyState === client.OPEN) count++;
  }
  const payload = JSON.stringify({ type: 'worldwide', count });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

function leaveRoom(ws, announce = true) {
  const code = ws.room;
  if (!code) return;
  leaveVoice(ws);
  const room = rooms.get(code);
  if (room) {
    if (ws.accountId && ws.profile) rememberRecentAccountForName(room, ws.profile.name, ws.accountId);
    room.clients.delete(ws);
    if (announce) {
      broadcastRoom(code, { type: 'system', text: `${ws.profile.name} left the room`, at: Date.now() });
      broadcastRoom(code, { type: 'presence', users: roomUsers(code) });
    }
  }
  ws.room = null;
}

// ---- Voice call (WebRTC signaling relay only — audio itself flows peer-to-peer) ----
// room.voice: Map<sub, { ws, name }> of who currently has the call open, per room.
function voiceRoom(code, create) {
  const room = rooms.get(code);
  if (!room) return null;
  if (!room.voice && create) room.voice = new Map();
  return room.voice || null;
}

function leaveVoice(ws) {
  const code = ws.room;
  if (!code || !ws.profile) return;
  const voice = voiceRoom(code, false);
  if (!voice) return;
  const sub = ws.profile.sub;
  if (!voice.has(sub)) return;
  voice.delete(sub);
  for (const peer of voice.values()) send(peer.ws, { type: 'voice-peer-left', sub });
  if (voice.size === 0) {
    const room = rooms.get(code);
    if (room) delete room.voice;
    broadcastRoom(code, { type: 'voice-call-ended' });
  }
}

// ---- Build Craft (shared world per room: a seed + a diff of every block changed since) ----
function broadcastBc(code, data, exclude) {
  const room = rooms.get(code);
  if (!room || !room.bc) return;
  const payload = JSON.stringify(data);
  for (const client of room.bc.players.keys()) {
    if (client !== exclude && client.readyState === client.OPEN) client.send(payload);
  }
}

// Health is server-authoritative (unlike position, which is trust-the-client like every other
// minigame here) so one player's client can't just decide someone else died. Used by both
// bc-punch (PvP) and bc-fall-damage (self-inflicted, byId null).
function applyBcDamage(code, targetWs, targetEntry, amount, byId) {
  // Armor is a flat "% chance to block 1 damage" rather than %-of-amount — most hits here are
  // worth exactly 1 point (a punch, a mob bite), and a fractional reduction would just round
  // back up to 1 every time. See ARMOR_REDUCTION on the client for the matching solo-mode logic.
  let dealt = amount;
  if (targetEntry.armorReduction && Math.random() < targetEntry.armorReduction) dealt = Math.max(0, dealt - 1);
  // Creative players can still be hit (health visibly drops, regen brings it back) but never
  // actually die — floor at 1 instead of 0 so the death branch below is unreachable for them.
  const minHealth = targetEntry.gameMode === 'creative' ? 1 : 0;
  targetEntry.health = Math.max(minHealth, targetEntry.health - dealt);
  targetEntry.lastDamageAt = Date.now();
  if (targetEntry.health > 0) {
    broadcastBc(code, { type: 'bc-hit', targetId: targetEntry.id, health: targetEntry.health, byId });
    return;
  }
  targetEntry.health = BC_MAX_HEALTH;
  targetEntry.x = BC_SPAWN.x;
  targetEntry.y = BC_SPAWN.y;
  targetEntry.z = BC_SPAWN.z;
  targetEntry.yaw = BC_SPAWN.yaw;
  broadcastBc(code, {
    type: 'bc-death',
    id: targetEntry.id,
    killedBy: byId,
    health: BC_MAX_HEALTH,
    respawn: BC_SPAWN,
  });
}

// Passive regen — only sent to the healed player (others don't render remote health at all),
// gated behind BC_REGEN_DAMAGE_COOLDOWN_MS so regen doesn't blunt a fight already in progress.
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (!room.bc) continue;
    for (const [ws, p] of room.bc.players) {
      if (p.health <= 0 || p.health >= BC_MAX_HEALTH) continue;
      if (now - (p.lastDamageAt || 0) < BC_REGEN_DAMAGE_COOLDOWN_MS) continue;
      p.health = Math.min(BC_MAX_HEALTH, p.health + 1);
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'bc-heal', health: p.health }));
    }
  }
}, BC_REGEN_INTERVAL_MS);

// ---- Build Craft voice chat (WebRTC signaling relay, same shape as the chat page's voice
// system, but scoped to room.bc.voice since bc sessions run on their own WS connection with
// no ws.profile/ws.room — bcId is the peer identity here instead of profile.sub. ----
function leaveBcVoice(ws) {
  const code = ws.bcRoom;
  if (!code) return;
  const room = rooms.get(code);
  const voice = room && room.bc && room.bc.voice;
  if (!voice || !voice.has(ws.bcId)) return;
  voice.delete(ws.bcId);
  for (const p of voice.values()) send(p.ws, { type: 'bc-voice-peer-left', id: ws.bcId });
}

function leaveBc(ws) {
  const code = ws.bcRoom;
  if (!code) return;
  const room = rooms.get(code);
  if (room && room.bc) {
    leaveBcVoice(ws);
    const player = room.bc.players.get(ws);
    room.bc.players.delete(ws);
    if (room.bc.sleeping) room.bc.sleeping.delete(ws);
    broadcastBc(code, { type: 'bc-player-left', id: ws.bcId });
    if (player) clearRoomActivity(code, player.name);
    // World overrides are already persisted to SQLite (db.setBcOverrides) and rehydrated on the
    // next bc-join (see that handler, which reloads via db.getBcOverrides), so it's safe to drop
    // this in-memory session once nobody's left playing — otherwise it (claims, voice map, and
    // all) stays resident forever, same pattern leaveTv/leaveDg already use below.
    if (room.bc.players.size === 0) delete room.bc;
  }
  ws.bcRoom = null;
}

// ---- Geometry Wave (ghost sessions per room+level, position-only, nothing persists) ----
function broadcastGw(code, level, data, exclude) {
  const room = rooms.get(code);
  const session = room && room.gw && room.gw.get(level);
  if (!session) return;
  const payload = JSON.stringify(data);
  for (const client of session.players.keys()) {
    if (client !== exclude && client.readyState === client.OPEN) client.send(payload);
  }
}

function leaveGw(ws) {
  const code = ws.gwRoom;
  const level = ws.gwLevel;
  if (!code || !level) return;
  const room = rooms.get(code);
  const session = room && room.gw && room.gw.get(level);
  if (session) {
    const player = session.players.get(ws);
    session.players.delete(ws);
    broadcastGw(code, level, { type: 'gw-player-left', id: ws.gwId });
    if (player) clearRoomActivity(code, player.name);
    // Nothing persists for Geometry Wave sessions — an empty level entry is pure dead weight,
    // same reasoning as leaveBc/leaveTv/leaveDg's cleanup just above/below.
    if (session.players.size === 0) {
      room.gw.delete(level);
      if (room.gw.size === 0) delete room.gw;
    }
  }
  ws.gwRoom = null;
  ws.gwLevel = null;
}

// ---- Web Swing (room.sw) — one shared ghost session per room, position + current rope only,
// nothing persists. The city itself is a fixed client-side seed (not server-generated), so unlike
// Build Craft there's no world state to hand out on join. ----
function broadcastSw(code, data, exclude) {
  const room = rooms.get(code);
  const session = room && room.sw;
  if (!session) return;
  const payload = JSON.stringify(data);
  for (const client of session.players.keys()) {
    if (client !== exclude && client.readyState === client.OPEN) client.send(payload);
  }
}

function leaveSw(ws) {
  const code = ws.swRoom;
  if (!code) return;
  const room = rooms.get(code);
  const session = room && room.sw;
  if (session) {
    const player = session.players.get(ws);
    session.players.delete(ws);
    broadcastSw(code, { type: 'sw-player-left', id: ws.swId });
    if (player) clearRoomActivity(code, player.name);
    // Nothing persists for Web Swing sessions — same cleanup reasoning as leaveBc/leaveGw above.
    if (room.sw.players.size === 0) delete room.sw;
  }
  ws.swRoom = null;
  ws.swId = null;
}

// ---- Trivia Night (room.tv) — curated question bank, free/no-signup, no external trivia API.
const TV_ROUND_MS = 15000;
const TV_QUESTIONS = [
  { q: 'What planet is known as the Red Planet?', choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'], answerIndex: 1, category: 'Science' },
  { q: 'What is the chemical symbol for gold?', choices: ['Go', 'Gd', 'Au', 'Ag'], answerIndex: 2, category: 'Science' },
  { q: 'How many bones are in the adult human body?', choices: ['186', '206', '226', '246'], answerIndex: 1, category: 'Science' },
  { q: 'What gas do plants absorb from the atmosphere?', choices: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], answerIndex: 2, category: 'Science' },
  { q: 'What is the largest planet in our solar system?', choices: ['Earth', 'Saturn', 'Neptune', 'Jupiter'], answerIndex: 3, category: 'Science' },
  { q: 'What is the speed of light approximately?', choices: ['300,000 km/s', '150,000 km/s', '1,000 km/s', '3,000 km/s'], answerIndex: 0, category: 'Science' },
  { q: 'Which country built the Great Wall?', choices: ['Japan', 'China', 'Mongolia', 'Korea'], answerIndex: 1, category: 'History' },
  { q: 'Who was the first President of the United States?', choices: ['Thomas Jefferson', 'John Adams', 'George Washington', 'Benjamin Franklin'], answerIndex: 2, category: 'History' },
  { q: 'In what year did World War II end?', choices: ['1943', '1945', '1947', '1950'], answerIndex: 1, category: 'History' },
  { q: 'Which ancient civilization built the pyramids of Giza?', choices: ['Romans', 'Greeks', 'Egyptians', 'Mayans'], answerIndex: 2, category: 'History' },
  { q: 'The Titanic sank in which year?', choices: ['1905', '1912', '1918', '1923'], answerIndex: 1, category: 'History' },
  { q: 'What is the capital of France?', choices: ['Lyon', 'Marseille', 'Paris', 'Nice'], answerIndex: 2, category: 'Geography' },
  { q: 'Which is the longest river in the world?', choices: ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], answerIndex: 1, category: 'Geography' },
  { q: 'What is the smallest country in the world?', choices: ['Monaco', 'San Marino', 'Vatican City', 'Liechtenstein'], answerIndex: 2, category: 'Geography' },
  { q: 'Which continent is the Sahara Desert located on?', choices: ['Asia', 'Africa', 'Australia', 'South America'], answerIndex: 1, category: 'Geography' },
  { q: 'What is the tallest mountain in the world?', choices: ['K2', 'Kilimanjaro', 'Denali', 'Mount Everest'], answerIndex: 3, category: 'Geography' },
  { q: 'Which country has the most population?', choices: ['USA', 'India', 'China', 'Indonesia'], answerIndex: 2, category: 'Geography' },
  { q: 'Who painted the Mona Lisa?', choices: ['Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Donatello'], answerIndex: 1, category: 'Art' },
  { q: 'Which artist is known for cutting off part of his own ear?', choices: ['Pablo Picasso', 'Claude Monet', 'Vincent van Gogh', 'Salvador Dalí'], answerIndex: 2, category: 'Art' },
  { q: 'What does "RGB" stand for in digital color?', choices: ['Red Green Blue', 'Right Grid Box', 'Render Graphic Bitmap', 'Red Gold Bronze'], answerIndex: 0, category: 'Tech' },
  { q: 'Who is credited with inventing the World Wide Web?', choices: ['Bill Gates', 'Steve Jobs', 'Tim Berners-Lee', 'Alan Turing'], answerIndex: 2, category: 'Tech' },
  { q: 'What does "HTTP" stand for?', choices: ['HyperText Transfer Protocol', 'High Transfer Text Program', 'Home Tool Transfer Protocol', 'HyperText Type Program'], answerIndex: 0, category: 'Tech' },
  { q: 'Which company created the PlayStation?', choices: ['Nintendo', 'Microsoft', 'Sega', 'Sony'], answerIndex: 3, category: 'Tech' },
  { q: 'Which fruit is known for keeping the doctor away?', choices: ['Banana', 'Apple', 'Orange', 'Grape'], answerIndex: 1, category: 'Food' },
  { q: 'What is the main ingredient in guacamole?', choices: ['Tomato', 'Avocado', 'Cucumber', 'Pepper'], answerIndex: 1, category: 'Food' },
  { q: 'Which country is credited with inventing pizza as we know it?', choices: ['France', 'Greece', 'Italy', 'Spain'], answerIndex: 2, category: 'Food' },
  { q: 'What spice comes from the Crocus flower?', choices: ['Cinnamon', 'Saffron', 'Paprika', 'Turmeric'], answerIndex: 1, category: 'Food' },
  { q: 'Which musical instrument has 88 keys?', choices: ['Organ', 'Piano', 'Accordion', 'Harpsichord'], answerIndex: 1, category: 'Music' },
  { q: 'Which band released the album "Abbey Road"?', choices: ['The Rolling Stones', 'The Beatles', 'Led Zeppelin', 'Pink Floyd'], answerIndex: 1, category: 'Music' },
  { q: 'How many strings does a standard guitar have?', choices: ['4', '5', '6', '7'], answerIndex: 2, category: 'Music' },
  { q: 'What is the highest score possible in ten-pin bowling?', choices: ['200', '250', '300', '350'], answerIndex: 2, category: 'Sports' },
  { q: 'How many players are on a soccer team on the field at once?', choices: ['9', '10', '11', '12'], answerIndex: 2, category: 'Sports' },
  { q: 'In which sport would you perform a slam dunk?', choices: ['Volleyball', 'Basketball', 'Tennis', 'Badminton'], answerIndex: 1, category: 'Sports' },
  { q: 'Which sea creature has three hearts?', choices: ['Shark', 'Octopus', 'Dolphin', 'Jellyfish'], answerIndex: 1, category: 'Animals' },
  { q: 'What is a group of lions called?', choices: ['Pack', 'Herd', 'Pride', 'Flock'], answerIndex: 2, category: 'Animals' },
  { q: 'Which animal is the tallest in the world?', choices: ['Elephant', 'Giraffe', 'Camel', 'Horse'], answerIndex: 1, category: 'Animals' },
  { q: 'What do you call a baby kangaroo?', choices: ['Cub', 'Kit', 'Joey', 'Pup'], answerIndex: 2, category: 'Animals' },
];

function broadcastTv(code, data, exclude) {
  const room = rooms.get(code);
  if (!room || !room.tv) return;
  const payload = JSON.stringify(data);
  for (const client of room.tv.players.keys()) {
    if (client !== exclude && client.readyState === client.OPEN) client.send(payload);
  }
}

function tvScores(tv) {
  return [...tv.players.values()].map((p) => ({ id: p.id, name: p.name, score: p.score }));
}

// Wrapped in try/catch (unlike every other handler in this file, which is covered by the single
// try/catch around the whole ws.on('message') dispatch) because this also runs from a bare
// setTimeout callback (see the tv.timer assignment below) — a throw there is an uncaughtException
// that takes the entire process down, not just this one room, per this file's exit-on-uncaught
// policy (see the top-level handler near reportError's definition).
function endTvRound(code) {
  try {
    const room = rooms.get(code);
    const tv = room && room.tv;
    if (!tv || tv.currentQuestion === null) return;
    clearTimeout(tv.timer);
    const q = TV_QUESTIONS[tv.currentQuestion];
    broadcastTv(code, { type: 'tv-round-end', correctIndex: q.answerIndex, scores: tvScores(tv) });
    tv.currentQuestion = null;
    tv.answeredThisRound = new Map();
    tv.roundEndAt = null;
  } catch (err) {
    reportError('server', err, { fn: 'endTvRound', code });
  }
}

function leaveTv(ws) {
  const code = ws.tvRoom;
  if (!code) return;
  const room = rooms.get(code);
  if (room && room.tv) {
    const tv = room.tv;
    const me = tv.players.get(ws);
    tv.players.delete(ws);
    if (me) broadcastTv(code, { type: 'tv-player-left', id: me.id });
    if (me) clearRoomActivity(code, me.name);
    if (tv.players.size === 0) {
      clearTimeout(tv.timer);
      delete room.tv;
    }
  }
  ws.tvRoom = null;
}

// ---- Tic-Tac-Toe / Connect Four (room.tt) — one shared 1v1 match per room, same "single shared
// instance" convention as room.bc/room.dg/room.tv, with everyone past the first two players
// watching as spectators. Board is a flat row-major array; win-checking is generic over the
// board size so both games share one implementation instead of two near-duplicates.
const TT_MODES = {
  tictactoe: { width: 3, height: 3, winLength: 3 },
  connect4: { width: 7, height: 6, winLength: 4 },
};

function broadcastTt(code, data, exclude) {
  const room = rooms.get(code);
  if (!room || !room.tt) return;
  const payload = JSON.stringify(data);
  for (const client of room.tt.players.keys()) {
    if (client !== exclude && client.readyState === client.OPEN) client.send(payload);
  }
}

function ttCheckWinner(board, width, height, winLength) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const sym = board[row * width + col];
      if (!sym) continue;
      for (const [dc, dr] of dirs) {
        let count = 1;
        for (let i = 1; i < winLength; i++) {
          const r = row + dr * i, c = col + dc * i;
          if (r < 0 || r >= height || c < 0 || c >= width || board[r * width + c] !== sym) break;
          count++;
        }
        if (count >= winLength) return sym;
      }
    }
  }
  if (board.every((c) => c)) return 'draw';
  return null;
}

function ttPublicState(tt) {
  return {
    mode: tt.mode,
    board: tt.board,
    turn: tt.turn,
    winner: tt.winner,
    xId: tt.xId,
    oId: tt.oId,
    players: [...tt.players.values()].map((p) => ({ id: p.id, name: p.name, symbol: p.symbol, wins: p.wins })),
  };
}

function leaveTt(ws) {
  const code = ws.ttRoom;
  if (!code) return;
  const room = rooms.get(code);
  if (room && room.tt) {
    const tt = room.tt;
    const me = tt.players.get(ws);
    tt.players.delete(ws);
    if (me) broadcastTt(code, { type: 'tt-player-left', id: me.id });
    if (me) clearRoomActivity(code, me.name);
    // Freeing the seat (rather than leaving it permanently claimed) lets a spectator take over
    // instead of the match being stuck at 1 player forever.
    if (me && me.symbol === 'X' && tt.xId === me.id) tt.xId = null;
    if (me && me.symbol === 'O' && tt.oId === me.id) tt.oId = null;
    if (tt.players.size === 0) delete room.tt;
  }
  ws.ttRoom = null;
}

// ---- Chess (room.ch) — same "single shared 1v1 match per room" convention as room.tt, with a
// real (if simplified — no castling/en passant, pawns auto-promote to queen) rules engine so
// moves are actually validated server-side rather than trusted from the client.
function chessIdx(row, col) { return row * 8 + col; }
function chessInBounds(row, col) { return row >= 0 && row < 8 && col >= 0 && col < 8; }

function chessInitialBoard() {
  const back = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  const board = new Array(64).fill(null);
  for (let c = 0; c < 8; c++) {
    board[chessIdx(0, c)] = { type: back[c], color: 'white' };
    board[chessIdx(1, c)] = { type: 'pawn', color: 'white' };
    board[chessIdx(6, c)] = { type: 'pawn', color: 'black' };
    board[chessIdx(7, c)] = { type: back[c], color: 'black' };
  }
  return board;
}

function chessPseudoMoves(board, row, col) {
  const piece = board[chessIdx(row, col)];
  if (!piece) return [];
  const moves = [];
  const addIfEmptyOrEnemy = (r, c) => {
    if (!chessInBounds(r, c)) return;
    const target = board[chessIdx(r, c)];
    if (!target || target.color !== piece.color) moves.push({ row: r, col: c });
  };
  const slide = (deltas) => {
    for (const [dr, dc] of deltas) {
      let r = row + dr, c = col + dc;
      while (chessInBounds(r, c)) {
        const target = board[chessIdx(r, c)];
        if (!target) {
          moves.push({ row: r, col: c });
        } else {
          if (target.color !== piece.color) moves.push({ row: r, col: c });
          break;
        }
        r += dr; c += dc;
      }
    }
  };
  if (piece.type === 'pawn') {
    const dir = piece.color === 'white' ? 1 : -1;
    const oneStep = row + dir;
    if (chessInBounds(oneStep, col) && !board[chessIdx(oneStep, col)]) {
      moves.push({ row: oneStep, col });
      const startRow = piece.color === 'white' ? 1 : 6;
      const twoStep = row + 2 * dir;
      if (row === startRow && !board[chessIdx(twoStep, col)]) moves.push({ row: twoStep, col });
    }
    for (const dc of [-1, 1]) {
      const r = row + dir, c = col + dc;
      if (chessInBounds(r, c) && board[chessIdx(r, c)] && board[chessIdx(r, c)].color !== piece.color) {
        moves.push({ row: r, col: c });
      }
    }
  } else if (piece.type === 'knight') {
    [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([dr, dc]) => addIfEmptyOrEnemy(row + dr, col + dc));
  } else if (piece.type === 'bishop') {
    slide([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  } else if (piece.type === 'rook') {
    slide([[1, 0], [-1, 0], [0, 1], [0, -1]]);
  } else if (piece.type === 'queen') {
    slide([[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]);
  } else if (piece.type === 'king') {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (dr || dc) addIfEmptyOrEnemy(row + dr, col + dc); }
  }
  return moves;
}

function chessFindKing(board, color) {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.type === 'king' && p.color === color) return { row: Math.floor(i / 8), col: i % 8 };
  }
  return null;
}

function chessIsSquareAttacked(board, row, col, byColor) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[chessIdx(r, c)];
      if (p && p.color === byColor && chessPseudoMoves(board, r, c).some((m) => m.row === row && m.col === col)) return true;
    }
  }
  return false;
}

function chessIsInCheck(board, color) {
  const king = chessFindKing(board, color);
  if (!king) return false;
  return chessIsSquareAttacked(board, king.row, king.col, color === 'white' ? 'black' : 'white');
}

function chessCloneBoard(board) {
  return board.map((c) => (c ? { ...c } : null));
}

function chessApplyMove(board, from, to) {
  const b = chessCloneBoard(board);
  const piece = b[chessIdx(from.row, from.col)];
  b[chessIdx(to.row, to.col)] = piece;
  b[chessIdx(from.row, from.col)] = null;
  // Auto-promote — simplification, no under-promotion choice.
  if (piece && piece.type === 'pawn' && (to.row === 0 || to.row === 7)) piece.type = 'queen';
  return b;
}

function chessIsLegalMove(board, from, to, color) {
  const piece = board[chessIdx(from.row, from.col)];
  if (!piece || piece.color !== color) return false;
  if (!chessPseudoMoves(board, from.row, from.col).some((m) => m.row === to.row && m.col === to.col)) return false;
  return !chessIsInCheck(chessApplyMove(board, from, to), color);
}

function chessHasAnyLegalMove(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[chessIdx(r, c)];
      if (p && p.color === color) {
        for (const m of chessPseudoMoves(board, r, c)) {
          if (chessIsLegalMove(board, { row: r, col: c }, m, color)) return true;
        }
      }
    }
  }
  return false;
}

function broadcastCh(code, data, exclude) {
  const room = rooms.get(code);
  if (!room || !room.ch) return;
  const payload = JSON.stringify(data);
  for (const client of room.ch.players.keys()) {
    if (client !== exclude && client.readyState === client.OPEN) client.send(payload);
  }
}

function chPublicState(ch) {
  return {
    board: ch.board,
    turn: ch.turn,
    winner: ch.winner,
    whiteId: ch.whiteId,
    blackId: ch.blackId,
    inCheck: ch.winner ? null : (chessIsInCheck(ch.board, ch.turn) ? ch.turn : null),
    players: [...ch.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, wins: p.wins })),
  };
}

function leaveCh(ws) {
  const code = ws.chRoom;
  if (!code) return;
  const room = rooms.get(code);
  if (room && room.ch) {
    const ch = room.ch;
    const me = ch.players.get(ws);
    ch.players.delete(ws);
    if (me) broadcastCh(code, { type: 'ch-player-left', id: me.id });
    if (me) clearRoomActivity(code, me.name);
    if (me && me.color === 'white' && ch.whiteId === me.id) ch.whiteId = null;
    if (me && me.color === 'black' && ch.blackId === me.id) ch.blackId = null;
    if (ch.players.size === 0) delete room.ch;
  }
  ws.chRoom = null;
}

// ---- Hangman (room.hm) — cooperative shared-word guessing, reusing Pictionary's word bank
// (DG_ALL_WORDS) since it's already a curated, no-signup, no-external-API word list.
const HM_MAX_WRONG = 6;

function broadcastHm(code, data, exclude) {
  const room = rooms.get(code);
  if (!room || !room.hm) return;
  const payload = JSON.stringify(data);
  for (const client of room.hm.players.keys()) {
    if (client !== exclude && client.readyState === client.OPEN) client.send(payload);
  }
}

function hmScores(hm) {
  return [...hm.players.values()].map((p) => ({ id: p.id, name: p.name, score: p.score }));
}

function hmRevealedWord(hm) {
  if (!hm.word) return [];
  return hm.word.split('').map((ch) => (ch === ' ' || hm.guessedLetters.has(ch) ? ch : null));
}

function leaveHm(ws) {
  const code = ws.hmRoom;
  if (!code) return;
  const room = rooms.get(code);
  if (room && room.hm) {
    const hm = room.hm;
    const me = hm.players.get(ws);
    hm.players.delete(ws);
    if (me) broadcastHm(code, { type: 'hm-player-left', id: me.id });
    if (me) clearRoomActivity(code, me.name);
    if (hm.players.size === 0) delete room.hm;
  }
  ws.hmRoom = null;
}

// ---- Pictionary-style drawing/guessing game (room.dg) ----
// Modeled on room.bc/room.gw: a lazy per-room Map of players keyed by ws. Only one round
// runs at a time per room; the word is sent solely to the drawer, never broadcast.
function broadcastDg(code, data, exclude) {
  const room = rooms.get(code);
  if (!room || !room.dg) return;
  const payload = JSON.stringify(data);
  for (const client of room.dg.players.keys()) {
    if (client !== exclude && client.readyState === client.OPEN) client.send(payload);
  }
}

function dgScores(dg) {
  return [...dg.players.values()].map((p) => ({ id: p.id, name: p.name, score: p.score, isSpectator: !!p.isSpectator }));
}

// See endTvRound's comment above — same reasoning, this also runs from a bare setTimeout
// callback (dg.timer below), so it needs its own try/catch rather than relying on the dispatch
// wrapper, or a throw here would take the whole process down.
function endDgRound(code) {
  try {
    const room = rooms.get(code);
    const dg = room && room.dg;
    if (!dg || !dg.roundEndAt) return;
    clearTimeout(dg.timer);
    dg.timer = null;
    const word = dg.word;
    dg.roundEndAt = null;
    dg.drawerId = null;
    dg.word = null;
    dg.guessedThisRound = new Set();
    broadcastDg(code, { type: 'dg-round-end', word, scores: dgScores(dg) });
  } catch (err) {
    reportError('server', err, { fn: 'endDgRound', code });
  }
}

function leaveDg(ws) {
  const code = ws.dgRoom;
  if (!code) return;
  const room = rooms.get(code);
  if (room && room.dg) {
    const dg = room.dg;
    const me = dg.players.get(ws);
    dg.players.delete(ws);
    if (me) broadcastDg(code, { type: 'dg-player-left', id: me.id });
    if (me) clearRoomActivity(code, me.name);
    if (me && dg.drawerId === me.id) endDgRound(code);
    if (dg.players.size === 0) {
      clearTimeout(dg.timer);
      delete room.dg;
    }
  }
  ws.dgRoom = null;
}

// ---- Collaborative whiteboard (room.wb) — unlike Pictionary, everyone connected can draw
// at once; strokes persist to SQLite so a fresh joiner (or a server restart) sees the full
// board, hydrated the same way chat history is. ----
function broadcastWb(code, data, exclude) {
  const room = rooms.get(code);
  if (!room || !room.wb) return;
  const payload = JSON.stringify(data);
  for (const client of room.wb.players.keys()) {
    if (client !== exclude && client.readyState === client.OPEN) client.send(payload);
  }
}

function leaveWb(ws) {
  const code = ws.wbRoom;
  if (!code) return;
  const room = rooms.get(code);
  if (room && room.wb) {
    const player = room.wb.players.get(ws);
    room.wb.players.delete(ws);
    if (player) {
      broadcastWb(code, { type: 'wb-player-left', id: ws.wbId });
      clearRoomActivity(code, player.name);
    }
  }
  ws.wbRoom = null;
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    // The entire dispatch below is one big try/catch: a bug in any single message handler
    // must not kill this connection's message loop (or, since all clients share one process,
    // every other connection too). See reportError() near the top of this file.
    try {
    if (msg.type === 'join-server') {
      const name = String(msg.username || 'Anonymous').slice(0, 30).trim() || 'Anonymous';
      const saved = db.getProfile(name);
      ws.profile = {
        name,
        sub: crypto.randomUUID(),
        avatarUrl: saved ? saved.avatar_url : null,
        status: saved ? saved.status : null,
      };
      if (msg.accountToken) {
        const account = db.getSessionAccount(String(msg.accountToken));
        if (account) registerAccountConnection(ws, account.id);
      }
      send(ws, { type: 'joined-server', profile: ws.profile });
      broadcastWorldwideCount();
      return;
    }

    // Scorpture (videos.html) opens its own WebSocket, independent of the room-oriented
    // join-server flow above — it has no room, no display-name profile, just an account. This is
    // the minimal registration it needs: resolve the token, register in accountConnections (so a
    // viewer can look a streamer up by username -> account id), and nothing else.
    if (msg.type === 'scorpture-hello') {
      const account = msg.accountToken ? db.getSessionAccount(String(msg.accountToken)) : null;
      if (account) registerAccountConnection(ws, account.id);
      send(ws, { type: 'scorpture-hello-ack', username: account ? account.username : null });
      return;
    }

    if (msg.type === 'scorpture-go-live') {
      if (!ws.accountId) return;
      const title = String(msg.title || 'Untitled stream').slice(0, 100).trim() || 'Untitled stream';
      const account = db.getAccountById(ws.accountId);
      if (!account) return;
      liveStreams.set(ws.accountId, { ws, username: account.username, title, startedAt: Date.now(), viewers: new Map() });
      send(ws, { type: 'scorpture-go-live-ack', ok: true });
      notifyScorptureSubscribers(ws.accountId, { title: `${account.username} is live`, body: title });
      return;
    }

    if (msg.type === 'scorpture-end-live') {
      if (ws.accountId) endScorptureLive(ws.accountId);
      return;
    }

    if (msg.type === 'scorpture-watch-live') {
      const streamerAccount = db.getAccountByUsername(String(msg.streamerUsername || '').trim());
      const stream = streamerAccount ? liveStreams.get(streamerAccount.id) : null;
      if (!stream) {
        send(ws, { type: 'scorpture-watch-ack', live: false });
        return;
      }
      // A connection can only ever watch one stream at a time (ws.scorptureViewerId is a single
      // scalar field) — clear out any prior viewer registration first, whether it's for this same
      // stream or a different one. Without this, repeated watch-live calls from the same socket
      // (same streamer or switching streamers) leak an orphaned entry into stream.viewers on every
      // call — never removed since ws.scorptureViewerId just gets overwritten — and force the
      // streamer's browser to open a brand-new RTCPeerConnection each time.
      if (ws.scorptureStreamerAccountId) leaveScorptureLive(ws);
      if (stream.viewers.size >= MAX_SCORPTURE_VIEWERS) {
        send(ws, { type: 'scorpture-watch-ack', live: false });
        return;
      }
      const viewerId = crypto.randomUUID();
      stream.viewers.set(viewerId, ws);
      ws.scorptureStreamerAccountId = streamerAccount.id;
      ws.scorptureViewerId = viewerId;
      send(ws, { type: 'scorpture-watch-ack', live: true, title: stream.title });
      send(stream.ws, { type: 'scorpture-viewer-joined', viewerId });
      return;
    }

    if (msg.type === 'scorpture-leave-live') {
      leaveScorptureLive(ws);
      return;
    }

    // Generic SDP offer/answer + ICE relay, both directions. A viewer only ever has one
    // streamer, so it addresses implicitly via ws.scorptureStreamerAccountId; the streamer
    // addresses a specific viewer explicitly via msg.viewerId (it may be broadcasting to several).
    if (msg.type === 'scorpture-signal') {
      if (ws.scorptureStreamerAccountId) {
        const stream = liveStreams.get(ws.scorptureStreamerAccountId);
        if (stream) send(stream.ws, { type: 'scorpture-signal', viewerId: ws.scorptureViewerId, signal: msg.signal });
        return;
      }
      if (ws.accountId && msg.viewerId) {
        const stream = liveStreams.get(ws.accountId);
        const viewerWs = stream && stream.viewers.get(msg.viewerId);
        if (viewerWs) send(viewerWs, { type: 'scorpture-signal', signal: msg.signal });
      }
      return;
    }

    // Live chat — one flat broadcast to the streamer + every current viewer (including the
    // sender, so their own message renders the same way whether they sent it or received it
    // back). Sign-in required (need a real username to attribute it to); watching itself doesn't.
    if (msg.type === 'scorpture-live-chat') {
      const text = String(msg.text || '').slice(0, 300).trim();
      if (!text || !ws.accountId) return;
      const account = db.getAccountById(ws.accountId);
      if (!account) return;
      const stream = ws.scorptureStreamerAccountId
        ? liveStreams.get(ws.scorptureStreamerAccountId)
        : liveStreams.get(ws.accountId);
      if (!stream) return;
      // Same flood gate as regular chat/DM messages — was missing here, letting an unthrottled
      // viewer spam every other viewer + the streamer at unlimited speed.
      const nowLc = Date.now();
      ws.msgTimestamps = (ws.msgTimestamps || []).filter((t) => nowLc - t < RATE_LIMIT_WINDOW_MS);
      if (ws.msgTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) return;
      ws.msgTimestamps.push(nowLc);
      const chatMsg = { type: 'scorpture-live-chat', username: account.username, text, at: Date.now() };
      send(stream.ws, chatMsg);
      for (const viewerWs of stream.viewers.values()) send(viewerWs, chatMsg);
      return;
    }

    // Build Craft and Geometry Wave each open their own WebSocket connection from their own page
    // (not the chat page), so these never go through 'join-server' / ws.profile — handled here,
    // before the chat-identity gate below.
    if (msg.type === 'bc-join') {
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      const color = /^#[0-9a-fA-F]{6}$/.test(msg.color || '') ? msg.color : '#2fb6ac';
      if (!code) return;
      const room = getOrCreateRoom(code);
      if (!room.bc) {
        // A room absent from memory (server restart) might still have a saved world in
        // SQLite — hydrate seed + overrides from there instead of generating a fresh one,
        // the same pattern chat history and whiteboard strokes already use.
        let world = db.getBcWorld(code);
        if (!world) {
          const seed = Math.floor(Math.random() * 2 ** 31);
          db.createBcWorld(code, seed);
          world = { seed };
        }
        room.bc = { seed: world.seed, overrides: new Map(db.getBcOverrides(code)), players: new Map(), dayNightOffsetMs: 0, sleeping: new Set(), claims: [] };
      }
      if (room.bc.players.size >= MAX_GAME_PLAYERS) {
        send(ws, { type: 'bc-full' });
        return;
      }
      const id = crypto.randomUUID();
      ws.bcRoom = code;
      ws.bcId = id;
      const players = [...room.bc.players.values()].map((p) => ({ id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw, health: p.health, color: p.color, armorTier: p.armorTier || null }));
      // gameMode starts unset (treated as survival by applyBcDamage) — bc-join fires the instant
      // the socket opens, before the player has actually picked Creative/Survival on the start
      // screen; the real value arrives moments later via bc-set-mode once they click a mode.
      room.bc.players.set(ws, { id, name, x: 0, y: 2.4, z: 0, yaw: 0, health: BC_MAX_HEALTH, lastPunchAt: 0, lastDamageAt: 0, armorReduction: 0, armorTier: null, color, gameMode: null });
      send(ws, {
        type: 'bc-init',
        id,
        seed: room.bc.seed,
        overrides: [...room.bc.overrides.entries()],
        players,
        dayNightOffsetMs: room.bc.dayNightOffsetMs || 0,
        claims: room.bc.claims || [],
      });
      broadcastBc(code, { type: 'bc-player-joined', id, name, color }, ws);
      setRoomActivity(code, name, 'bc');
      return;
    }

    if (msg.type === 'bc-block' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      if (!room || !room.bc) return;
      const rawChanges = Array.isArray(msg.changes) ? msg.changes.slice(0, 2000) : [];
      const validChanges = [];
      const persistEntries = [];
      for (const c of rawChanges) {
        const type = (c.t === null || c.t === undefined) ? null : (c.t | 0);
        if (type !== null && (type < 0 || type > BC_MAX_BLOCK_TYPE)) continue;
        const key = `${c.x | 0},${c.y | 0},${c.z | 0}`;
        room.bc.overrides.set(key, type);
        persistEntries.push([key, type]);
        validChanges.push({ x: c.x | 0, y: c.y | 0, z: c.z | 0, t: type });
      }
      if (persistEntries.length) db.setBcOverrides(ws.bcRoom, persistEntries);
      if (validChanges.length) broadcastBc(ws.bcRoom, { type: 'bc-block', changes: validChanges }, ws);
      return;
    }

    if (msg.type === 'bc-pos' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const p = room && room.bc && room.bc.players.get(ws);
      if (!p) return;
      const clamp = (n) => Math.max(-BC_MAX_COORD, Math.min(BC_MAX_COORD, +n || 0));
      p.x = clamp(msg.x); p.y = clamp(msg.y); p.z = clamp(msg.z); p.yaw = +msg.yaw || 0;
      broadcastBc(ws.bcRoom, { type: 'bc-pos', id: ws.bcId, x: p.x, y: p.y, z: p.z, yaw: p.yaw }, ws);
      return;
    }

    if (msg.type === 'bc-punch' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const dg = room && room.bc;
      if (!dg) return;
      const attacker = dg.players.get(ws);
      if (!attacker || attacker.health <= 0) return;
      const now = Date.now();
      if (now - (attacker.lastPunchAt || 0) < BC_PUNCH_COOLDOWN_MS) return;

      let targetWs = null;
      let target = null;
      for (const [w, p] of dg.players) {
        if (p.id === msg.targetId) { targetWs = w; target = p; break; }
      }
      if (!target || target.health <= 0) return;
      // Loose sanity check against each side's last-reported position — positions here are
      // trust-the-client (same as every other bc-pos-driven thing), this just stops a wildly
      // out-of-range punch, not a fully server-validated hit.
      const dx = attacker.x - target.x, dy = attacker.y - target.y, dz = attacker.z - target.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) > BC_PUNCH_RANGE + 3) return;

      attacker.lastPunchAt = now;
      applyBcDamage(ws.bcRoom, targetWs, target, 1, attacker.id);
      return;
    }

    if (msg.type === 'bc-fall-damage' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const dg = room && room.bc;
      const me = dg && dg.players.get(ws);
      if (!me || me.health <= 0) return;
      const amount = Math.max(0, Math.min(BC_MAX_HEALTH, Math.floor(+msg.amount || 0)));
      if (amount <= 0) return;
      applyBcDamage(ws.bcRoom, ws, me, amount, null);
      return;
    }

    if (msg.type === 'bc-set-mode' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const me = room && room.bc && room.bc.players.get(ws);
      if (!me) return;
      me.gameMode = msg.gameMode === 'creative' ? 'creative' : 'survival';
      return;
    }

    if (msg.type === 'bc-set-armor' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const me = room && room.bc && room.bc.players.get(ws);
      if (!me) return;
      // Clamp well below what any real armor tier grants (max 0.55) — a malicious client
      // sending reduction:1 shouldn't be able to make itself unkillable.
      me.armorReduction = Math.max(0, Math.min(0.6, +msg.reduction || 0));
      me.armorTier = BC_ARMOR_TIERS.includes(msg.armorTier) ? msg.armorTier : null;
      broadcastBc(ws.bcRoom, { type: 'bc-armor-changed', id: me.id, armorTier: me.armorTier }, ws);
      return;
    }

    if (msg.type === 'bc-set-skin' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const me = room && room.bc && room.bc.players.get(ws);
      if (!me || !/^#[0-9a-fA-F]{6}$/.test(msg.color || '')) return;
      me.color = msg.color;
      broadcastBc(ws.bcRoom, { type: 'bc-skin-changed', id: me.id, color: me.color }, ws);
      return;
    }

    if (msg.type === 'bc-claim' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const dg = room && room.bc;
      const me = dg && dg.players.get(ws);
      if (!dg || !me) return;
      if (!dg.claims) dg.claims = [];
      const ownedCount = dg.claims.filter((c) => c.owner === me.name).length;
      if (ownedCount >= BC_MAX_CLAIMS_PER_PLAYER) {
        send(ws, { type: 'bc-claim-denied' });
        return;
      }
      const claim = { x: Math.floor(+msg.x || 0), z: Math.floor(+msg.z || 0), radius: BC_CLAIM_RADIUS, owner: me.name };
      dg.claims.push(claim);
      broadcastBc(ws.bcRoom, { type: 'bc-claim-added', ...claim });
      return;
    }

    if (msg.type === 'bc-sleep' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const dg = room && room.bc;
      const me = dg && dg.players.get(ws);
      if (!dg || !me) return;
      if (!dg.sleeping) dg.sleeping = new Set();
      dg.sleeping.add(ws);
      broadcastBc(ws.bcRoom, { type: 'bc-sleep-count', sleeping: dg.sleeping.size, total: dg.players.size });
      if (dg.sleeping.size >= dg.players.size && dg.players.size > 0) {
        const now = Date.now();
        const offset = dg.dayNightOffsetMs || 0;
        const phase = ((now + offset) % BC_DAY_CYCLE_MS) / BC_DAY_CYCLE_MS;
        const targetPhase = phase > 0.8 ? 1 + BC_SLEEP_PHASE_TARGET : BC_SLEEP_PHASE_TARGET;
        dg.dayNightOffsetMs = offset + (targetPhase - phase) * BC_DAY_CYCLE_MS;
        dg.sleeping.clear();
        broadcastBc(ws.bcRoom, { type: 'bc-skip-night', offsetMs: dg.dayNightOffsetMs });
      }
      return;
    }

    if (msg.type === 'bc-wake' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const dg = room && room.bc;
      if (!dg || !dg.sleeping) return;
      dg.sleeping.delete(ws);
      broadcastBc(ws.bcRoom, { type: 'bc-sleep-count', sleeping: dg.sleeping.size, total: dg.players.size });
      return;
    }

    if (msg.type === 'bc-eat' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const dg = room && room.bc;
      const me = dg && dg.players.get(ws);
      if (!me || me.health <= 0) return;
      const amount = Math.max(0, Math.min(BC_MAX_HEALTH, Math.floor(+msg.amount || 0)));
      if (amount <= 0) return;
      me.health = Math.min(BC_MAX_HEALTH, me.health + amount);
      send(ws, { type: 'bc-heal', health: me.health });
      return;
    }

    if (msg.type === 'bc-leave') {
      leaveBc(ws);
      return;
    }

    if (msg.type === 'bc-voice-join' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const dg = room && room.bc;
      const me = dg && dg.players.get(ws);
      if (!dg || !me) return;
      if (!dg.voice) dg.voice = new Map();
      const existing = [...dg.voice.entries()].map(([id, p]) => ({ id, name: p.name }));
      dg.voice.set(ws.bcId, { ws, name: me.name });
      send(ws, { type: 'bc-voice-peers', peers: existing });
      for (const [id, p] of dg.voice) {
        if (id !== ws.bcId) send(p.ws, { type: 'bc-voice-peer-joined', id: ws.bcId, name: me.name });
      }
      return;
    }

    if (msg.type === 'bc-voice-signal' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const voice = room && room.bc && room.bc.voice;
      const target = voice && voice.get(String(msg.to || ''));
      if (!target) return;
      send(target.ws, { type: 'bc-voice-signal', from: ws.bcId, signal: msg.signal });
      return;
    }

    if (msg.type === 'bc-voice-leave' && ws.bcRoom) {
      leaveBcVoice(ws);
      return;
    }

    if (msg.type === 'bc-chat' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const me = room && room.bc && room.bc.players.get(ws);
      if (!me) return;
      const text = String(msg.text || '').slice(0, 300).trim();
      if (!text) return;
      broadcastBc(ws.bcRoom, { type: 'bc-chat', name: me.name, text });
      return;
    }

    if (msg.type === 'bc-blueprint-save' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const me = room && room.bc && room.bc.players.get(ws);
      if (!me) return;
      const name = String(msg.name || 'Untitled').slice(0, 40).trim() || 'Untitled';
      const blocks = Array.isArray(msg.blocks) ? msg.blocks.slice(0, 20000) : [];
      if (!blocks.length) return;
      const sizeX = Math.max(1, Math.min(64, Math.floor(+msg.sizeX || 1)));
      const sizeY = Math.max(1, Math.min(64, Math.floor(+msg.sizeY || 1)));
      const sizeZ = Math.max(1, Math.min(64, Math.floor(+msg.sizeZ || 1)));
      db.saveBlueprint({
        id: crypto.randomUUID(),
        roomCode: ws.bcRoom,
        name,
        author: me.name,
        sizeX,
        sizeY,
        sizeZ,
        blocksJson: JSON.stringify(blocks),
        createdAt: Date.now(),
      });
      send(ws, { type: 'bc-blueprint-list-result', blueprints: db.getBlueprints(ws.bcRoom) });
      return;
    }

    if (msg.type === 'bc-blueprint-list' && ws.bcRoom) {
      send(ws, { type: 'bc-blueprint-list-result', blueprints: db.getBlueprints(ws.bcRoom) });
      return;
    }

    if (msg.type === 'bc-blueprint-get' && ws.bcRoom) {
      const id = String(msg.id || '');
      const bp = db.getBlueprint(id);
      if (!bp || bp.room_code !== ws.bcRoom) return;
      send(ws, { type: 'bc-blueprint-get-result', id: bp.id, name: bp.name, blocks: bp.blocks });
      return;
    }

    if (msg.type === 'gw-join') {
      const code = String(msg.code || '').toUpperCase().trim();
      const level = String(msg.level || 'easy').slice(0, 20);
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      const room = getOrCreateRoom(code);
      if (!room.gw) room.gw = new Map();
      if (!room.gw.has(level)) room.gw.set(level, { players: new Map() });
      const session = room.gw.get(level);
      if (session.players.size >= MAX_GAME_PLAYERS) {
        send(ws, { type: 'gw-full' });
        return;
      }
      const id = crypto.randomUUID();
      ws.gwRoom = code;
      ws.gwLevel = level;
      ws.gwId = id;
      const players = [...session.players.values()].map((p) => ({ id: p.id, name: p.name, x: p.x, y: p.y }));
      session.players.set(ws, { id, name, x: 0, y: 0 });
      send(ws, { type: 'gw-init', id, players });
      broadcastGw(code, level, { type: 'gw-player-joined', id, name }, ws);
      setRoomActivity(code, name, 'gw');
      return;
    }

    if (msg.type === 'gw-pos' && ws.gwRoom) {
      const room = rooms.get(ws.gwRoom);
      const session = room && room.gw && room.gw.get(ws.gwLevel);
      const p = session && session.players.get(ws);
      if (!p) return;
      const gwClamp = (n) => Math.max(-BC_MAX_COORD, Math.min(BC_MAX_COORD, +n || 0));
      p.x = gwClamp(msg.x); p.y = gwClamp(msg.y);
      broadcastGw(ws.gwRoom, ws.gwLevel, { type: 'gw-pos', id: ws.gwId, x: p.x, y: p.y }, ws);
      return;
    }

    if (msg.type === 'gw-leave') {
      leaveGw(ws);
      return;
    }

    if (msg.type === 'gw-complete' && ws.gwRoom) {
      const level = String(msg.level || ws.gwLevel || '').slice(0, 20);
      const name = String(msg.name || '').slice(0, 30).trim();
      const percent = Math.max(0, Math.min(100, Math.floor(+msg.percent || 0)));
      if (!level || !name || !percent) return;
      db.bumpLeaderboard(ws.gwRoom, `gw-${level}`, name, percent);
      return;
    }

    if (msg.type === 'gw-leaderboard') {
      // Deliberately not gated on ws.gwRoom (an active session) — the level-select screen wants
      // to show a leaderboard before joining any level, same as it already shows local best %.
      const code = String(msg.code || '').toUpperCase().trim();
      const level = String(msg.level || '').slice(0, 20);
      if (!code || !level) return;
      send(ws, { type: 'gw-leaderboard-result', level, scores: db.getLeaderboard(code, `gw-${level}`, 10) });
      return;
    }

    if (msg.type === 'sw-join') {
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      const room = getOrCreateRoom(code);
      if (!room.sw) room.sw = { players: new Map() };
      if (room.sw.players.size >= MAX_GAME_PLAYERS) {
        send(ws, { type: 'sw-full' });
        return;
      }
      const id = crypto.randomUUID();
      ws.swRoom = code;
      ws.swId = id;
      const players = [...room.sw.players.values()].map((p) => ({ id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw }));
      room.sw.players.set(ws, { id, name, x: 0, y: 0, z: 0, yaw: 0 });
      send(ws, { type: 'sw-init', id, players });
      broadcastSw(code, { type: 'sw-player-joined', id, name }, ws);
      setRoomActivity(code, name, 'sw');
      return;
    }

    if (msg.type === 'sw-pos' && ws.swRoom) {
      const room = rooms.get(ws.swRoom);
      const p = room && room.sw && room.sw.players.get(ws);
      if (!p) return;
      const swClamp = (n) => Math.max(-BC_MAX_COORD, Math.min(BC_MAX_COORD, +n || 0));
      p.x = swClamp(msg.x); p.y = swClamp(msg.y); p.z = swClamp(msg.z); p.yaw = +msg.yaw || 0;
      broadcastSw(ws.swRoom, {
        type: 'sw-pos', id: ws.swId, x: p.x, y: p.y, z: p.z, yaw: p.yaw,
        swinging: !!msg.swinging, ax: swClamp(msg.ax), ay: swClamp(msg.ay), az: swClamp(msg.az),
      }, ws);
      return;
    }

    if (msg.type === 'sw-leave') {
      leaveSw(ws);
      return;
    }

    if (msg.type === 'sw-score' && ws.swRoom) {
      const room = rooms.get(ws.swRoom);
      const p = room && room.sw && room.sw.players.get(ws);
      const score = Math.max(0, Math.min(100000, Math.floor(+msg.score || 0)));
      if (!p || !score) return;
      db.bumpLeaderboard(ws.swRoom, 'sw', p.name, score);
      return;
    }

    if (msg.type === 'sw-leaderboard') {
      const code = String(msg.code || '').toUpperCase().trim();
      if (!code) return;
      send(ws, { type: 'sw-leaderboard-result', scores: db.getLeaderboard(code, 'sw', 10) });
      return;
    }

    if (msg.type === 'tv-join') {
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      const room = getOrCreateRoom(code);
      if (!room.tv) {
        room.tv = { players: new Map(), currentQuestion: null, usedQuestions: new Set(), answeredThisRound: new Map(), roundEndAt: null, timer: null };
      }
      const tv = room.tv;
      if (tv.players.size >= MAX_GAME_PLAYERS) {
        send(ws, { type: 'tv-full' });
        return;
      }
      const id = crypto.randomUUID();
      ws.tvRoom = code;
      ws.tvId = id;
      tv.players.set(ws, { id, name, score: 0 });
      const inRound = tv.currentQuestion !== null;
      send(ws, { type: 'tv-init', id, players: tvScores(tv) });
      if (inRound) {
        const q = TV_QUESTIONS[tv.currentQuestion];
        send(ws, { type: 'tv-question', question: q.q, choices: q.choices, category: q.category, endsAt: tv.roundEndAt });
      }
      broadcastTv(code, { type: 'tv-player-joined', id, name }, ws);
      setRoomActivity(code, name, 'tv');
      return;
    }

    if (msg.type === 'tv-start' && ws.tvRoom) {
      const room = rooms.get(ws.tvRoom);
      const tv = room && room.tv;
      if (!tv || tv.currentQuestion !== null) return;
      if (tv.usedQuestions.size >= TV_QUESTIONS.length) tv.usedQuestions.clear();
      let idx;
      do { idx = Math.floor(Math.random() * TV_QUESTIONS.length); } while (tv.usedQuestions.has(idx));
      tv.usedQuestions.add(idx);
      tv.currentQuestion = idx;
      tv.answeredThisRound = new Map();
      tv.roundEndAt = Date.now() + TV_ROUND_MS;
      clearTimeout(tv.timer);
      tv.timer = setTimeout(() => endTvRound(ws.tvRoom), TV_ROUND_MS);
      const q = TV_QUESTIONS[idx];
      broadcastTv(ws.tvRoom, { type: 'tv-question', question: q.q, choices: q.choices, category: q.category, endsAt: tv.roundEndAt });
      return;
    }

    if (msg.type === 'tv-answer' && ws.tvRoom) {
      const room = rooms.get(ws.tvRoom);
      const tv = room && room.tv;
      if (!tv || tv.currentQuestion === null || !tv.roundEndAt) return;
      const me = tv.players.get(ws);
      if (!me || tv.answeredThisRound.has(me.id)) return;
      const q = TV_QUESTIONS[tv.currentQuestion];
      const choice = Math.floor(+msg.choice);
      const correct = choice === q.answerIndex;
      tv.answeredThisRound.set(me.id, correct);
      let points = 0;
      if (correct) {
        const rank = [...tv.answeredThisRound.values()].filter(Boolean).length;
        points = rank === 1 ? 3 : rank === 2 ? 2 : 1; // speed bonus for the first couple of correct answers
        me.score += points;
        db.bumpLeaderboard(ws.tvRoom, 'trivia', me.name, me.score);
      }
      send(ws, { type: 'tv-answer-ack', correct, points, score: me.score });
      broadcastTv(ws.tvRoom, { type: 'tv-answer-count', answered: tv.answeredThisRound.size, total: tv.players.size }, ws);
      if (tv.answeredThisRound.size >= tv.players.size) endTvRound(ws.tvRoom);
      return;
    }

    if (msg.type === 'tv-leave') {
      leaveTv(ws);
      return;
    }

    if (msg.type === 'tv-leaderboard' && ws.tvRoom) {
      send(ws, { type: 'tv-leaderboard-result', scores: db.getLeaderboard(ws.tvRoom, 'trivia', 10) });
      return;
    }

    if (msg.type === 'arcade-join') {
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      const game = String(msg.game || '');
      if (!code || !ARCADE_LEADERBOARD_KEY[game]) return;
      ws.arcadeRoom = code;
      ws.arcadeGame = game;
      ws.arcadeName = name;
      setRoomActivity(code, name, ARCADE_ACTIVITY_CODE[game]);
      send(ws, { type: 'arcade-leaderboard', scores: db.getLeaderboard(code, ARCADE_LEADERBOARD_KEY[game], 10) });
      return;
    }

    if (msg.type === 'arcade-submit-score' && ws.arcadeRoom) {
      const score = Math.max(0, Math.min(100000, Math.floor(+msg.score || 0)));
      db.bumpLeaderboard(ws.arcadeRoom, ARCADE_LEADERBOARD_KEY[ws.arcadeGame], ws.arcadeName, score);
      send(ws, { type: 'arcade-leaderboard', scores: db.getLeaderboard(ws.arcadeRoom, ARCADE_LEADERBOARD_KEY[ws.arcadeGame], 10) });
      return;
    }

    if (msg.type === 'arcade-leaderboard' && ws.arcadeRoom) {
      send(ws, { type: 'arcade-leaderboard', scores: db.getLeaderboard(ws.arcadeRoom, ARCADE_LEADERBOARD_KEY[ws.arcadeGame], 10) });
      return;
    }

    if (msg.type === 'arcade-leave') {
      if (ws.arcadeRoom && ws.arcadeName) clearRoomActivity(ws.arcadeRoom, ws.arcadeName);
      ws.arcadeRoom = null;
      ws.arcadeGame = null;
      return;
    }

    if (msg.type === 'hm-join') {
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      const room = getOrCreateRoom(code);
      if (!room.hm) {
        room.hm = { players: new Map(), word: null, guessedLetters: new Set(), wrongCount: 0, roundActive: false };
      }
      const hm = room.hm;
      if (hm.players.size >= MAX_GAME_PLAYERS) {
        send(ws, { type: 'hm-full' });
        return;
      }
      const id = crypto.randomUUID();
      ws.hmRoom = code;
      ws.hmId = id;
      hm.players.set(ws, { id, name, score: 0 });
      send(ws, {
        type: 'hm-init',
        id,
        players: hmScores(hm),
        roundActive: hm.roundActive,
        revealedWord: hmRevealedWord(hm),
        guessedLetters: [...hm.guessedLetters],
        wrongCount: hm.wrongCount,
        maxWrong: HM_MAX_WRONG,
      });
      broadcastHm(code, { type: 'hm-player-joined', id, name }, ws);
      setRoomActivity(code, name, 'hm');
      return;
    }

    if (msg.type === 'hm-start' && ws.hmRoom) {
      const room = rooms.get(ws.hmRoom);
      const hm = room && room.hm;
      if (!hm || hm.roundActive) return;
      hm.word = DG_ALL_WORDS[Math.floor(Math.random() * DG_ALL_WORDS.length)].toLowerCase();
      hm.guessedLetters = new Set();
      hm.wrongCount = 0;
      hm.roundActive = true;
      broadcastHm(ws.hmRoom, {
        type: 'hm-round-start',
        revealedWord: hmRevealedWord(hm),
        wrongCount: 0,
        maxWrong: HM_MAX_WRONG,
      });
      return;
    }

    if (msg.type === 'hm-guess-letter' && ws.hmRoom) {
      const room = rooms.get(ws.hmRoom);
      const hm = room && room.hm;
      if (!hm || !hm.roundActive) return;
      const me = hm.players.get(ws);
      if (!me) return;
      const letter = String(msg.letter || '').toLowerCase().slice(0, 1);
      if (!/^[a-z]$/.test(letter) || hm.guessedLetters.has(letter)) return;
      hm.guessedLetters.add(letter);
      const correct = hm.word.includes(letter);
      if (correct) {
        me.score += 1;
        db.bumpLeaderboard(ws.hmRoom, 'hangman', me.name, me.score);
      } else {
        hm.wrongCount += 1;
      }
      const revealedWord = hmRevealedWord(hm);
      const won = !revealedWord.includes(null);
      const lost = hm.wrongCount >= HM_MAX_WRONG;
      broadcastHm(ws.hmRoom, {
        type: 'hm-letter-result',
        letter,
        correct,
        by: me.name,
        revealedWord,
        wrongCount: hm.wrongCount,
        scores: hmScores(hm),
      });
      if (won || lost) {
        hm.roundActive = false;
        broadcastHm(ws.hmRoom, { type: 'hm-round-end', won, word: hm.word, scores: hmScores(hm) });
      }
      return;
    }

    if (msg.type === 'hm-leaderboard' && ws.hmRoom) {
      send(ws, { type: 'hm-leaderboard-result', scores: db.getLeaderboard(ws.hmRoom, 'hangman', 10) });
      return;
    }

    if (msg.type === 'hm-leave') {
      leaveHm(ws);
      return;
    }

    if (msg.type === 'ch-join') {
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      const room = getOrCreateRoom(code);
      if (!room.ch) {
        room.ch = { players: new Map(), board: chessInitialBoard(), turn: 'white', winner: null, whiteId: null, blackId: null };
      }
      const ch = room.ch;
      if (ch.players.size >= MAX_GAME_PLAYERS) {
        send(ws, { type: 'ch-full' });
        return;
      }
      const id = crypto.randomUUID();
      ws.chRoom = code;
      ws.chId = id;
      let color = null;
      if (!ch.whiteId) { color = 'white'; ch.whiteId = id; }
      else if (!ch.blackId) { color = 'black'; ch.blackId = id; }
      ch.players.set(ws, { id, name, color, wins: 0 });
      send(ws, { type: 'ch-init', id, state: chPublicState(ch) });
      broadcastCh(code, { type: 'ch-player-joined', id, name, color }, ws);
      setRoomActivity(code, name, 'ch');
      return;
    }

    if (msg.type === 'ch-claim-seat' && ws.chRoom) {
      const room = rooms.get(ws.chRoom);
      const ch = room && room.ch;
      const me = ch && ch.players.get(ws);
      if (!ch || !me || me.color) return;
      if (!ch.whiteId) { ch.whiteId = me.id; me.color = 'white'; }
      else if (!ch.blackId) { ch.blackId = me.id; me.color = 'black'; }
      else return;
      broadcastCh(ws.chRoom, { type: 'ch-state', state: chPublicState(ch) });
      return;
    }

    if (msg.type === 'ch-move' && ws.chRoom) {
      const room = rooms.get(ws.chRoom);
      const ch = room && room.ch;
      if (!ch || ch.winner) return;
      const me = ch.players.get(ws);
      if (!me || !me.color || me.color !== ch.turn) return;
      const from = { row: Math.floor(+msg.from?.row), col: Math.floor(+msg.from?.col) };
      const to = { row: Math.floor(+msg.to?.row), col: Math.floor(+msg.to?.col) };
      if (!chessInBounds(from.row, from.col) || !chessInBounds(to.row, to.col)) return;
      if (!chessIsLegalMove(ch.board, from, to, me.color)) return;
      ch.board = chessApplyMove(ch.board, from, to);
      const opponent = me.color === 'white' ? 'black' : 'white';
      const opponentInCheck = chessIsInCheck(ch.board, opponent);
      const opponentHasMove = chessHasAnyLegalMove(ch.board, opponent);
      if (!opponentHasMove) {
        ch.winner = opponentInCheck ? me.color : 'draw';
        if (ch.winner !== 'draw') {
          me.wins += 1;
          db.bumpLeaderboard(ws.chRoom, 'chess', me.name, me.wins);
        }
      } else {
        ch.turn = opponent;
      }
      broadcastCh(ws.chRoom, { type: 'ch-state', state: chPublicState(ch), lastMove: { from, to } });
      return;
    }

    if (msg.type === 'ch-rematch' && ws.chRoom) {
      const room = rooms.get(ws.chRoom);
      const ch = room && room.ch;
      if (!ch || !ch.winner) return;
      ch.board = chessInitialBoard();
      ch.winner = null;
      ch.turn = 'white';
      const oldWhite = ch.whiteId, oldBlack = ch.blackId; // swap seats so the loser doesn't always play the same color
      ch.whiteId = oldBlack;
      ch.blackId = oldWhite;
      for (const p of ch.players.values()) {
        if (p.id === ch.whiteId) p.color = 'white';
        else if (p.id === ch.blackId) p.color = 'black';
      }
      broadcastCh(ws.chRoom, { type: 'ch-state', state: chPublicState(ch) });
      return;
    }

    if (msg.type === 'ch-leaderboard' && ws.chRoom) {
      send(ws, { type: 'ch-leaderboard-result', scores: db.getLeaderboard(ws.chRoom, 'chess', 10) });
      return;
    }

    if (msg.type === 'ch-leave') {
      leaveCh(ws);
      return;
    }

    if (msg.type === 'tt-join') {
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      const room = getOrCreateRoom(code);
      if (!room.tt) {
        room.tt = { players: new Map(), mode: 'tictactoe', board: new Array(9).fill(null), turn: 'X', winner: null, xId: null, oId: null };
      }
      const tt = room.tt;
      if (tt.players.size >= MAX_GAME_PLAYERS) {
        send(ws, { type: 'tt-full' });
        return;
      }
      const id = crypto.randomUUID();
      ws.ttRoom = code;
      ws.ttId = id;
      let symbol = null;
      if (!tt.xId) { symbol = 'X'; tt.xId = id; }
      else if (!tt.oId) { symbol = 'O'; tt.oId = id; }
      tt.players.set(ws, { id, name, symbol, wins: 0 });
      send(ws, { type: 'tt-init', id, state: ttPublicState(tt) });
      broadcastTt(code, { type: 'tt-player-joined', id, name, symbol }, ws);
      setRoomActivity(code, name, 'tt');
      return;
    }

    if (msg.type === 'tt-set-mode' && ws.ttRoom) {
      const room = rooms.get(ws.ttRoom);
      const tt = room && room.tt;
      if (!tt || !TT_MODES[msg.mode] || tt.board.some((c) => c)) return; // only before the first move
      tt.mode = msg.mode;
      const cfg = TT_MODES[tt.mode];
      tt.board = new Array(cfg.width * cfg.height).fill(null);
      tt.winner = null;
      tt.turn = 'X';
      broadcastTt(ws.ttRoom, { type: 'tt-state', state: ttPublicState(tt) });
      return;
    }

    if (msg.type === 'tt-claim-seat' && ws.ttRoom) {
      const room = rooms.get(ws.ttRoom);
      const tt = room && room.tt;
      const me = tt && tt.players.get(ws);
      if (!tt || !me || me.symbol) return;
      if (!tt.xId) { tt.xId = me.id; me.symbol = 'X'; }
      else if (!tt.oId) { tt.oId = me.id; me.symbol = 'O'; }
      else return;
      broadcastTt(ws.ttRoom, { type: 'tt-state', state: ttPublicState(tt) });
      return;
    }

    if (msg.type === 'tt-move' && ws.ttRoom) {
      const room = rooms.get(ws.ttRoom);
      const tt = room && room.tt;
      if (!tt || tt.winner) return;
      const me = tt.players.get(ws);
      if (!me || !me.symbol || me.symbol !== tt.turn) return;
      const cfg = TT_MODES[tt.mode];
      const col = Math.floor(+msg.col);
      if (!(col >= 0 && col < cfg.width)) return;
      let row;
      if (tt.mode === 'connect4') {
        row = -1;
        for (let r = cfg.height - 1; r >= 0; r--) {
          if (!tt.board[r * cfg.width + col]) { row = r; break; }
        }
        if (row === -1) return; // column full
      } else {
        row = Math.floor(+msg.row);
        if (!(row >= 0 && row < cfg.height) || tt.board[row * cfg.width + col]) return;
      }
      tt.board[row * cfg.width + col] = me.symbol;
      const winner = ttCheckWinner(tt.board, cfg.width, cfg.height, cfg.winLength);
      tt.winner = winner;
      if (winner && winner !== 'draw') {
        for (const p of tt.players.values()) {
          if (p.symbol === winner) { p.wins += 1; db.bumpLeaderboard(ws.ttRoom, `tictactoe-${tt.mode}`, p.name, p.wins); }
        }
      }
      tt.turn = tt.turn === 'X' ? 'O' : 'X';
      broadcastTt(ws.ttRoom, { type: 'tt-state', state: ttPublicState(tt), lastMove: { row, col, symbol: me.symbol } });
      return;
    }

    if (msg.type === 'tt-rematch' && ws.ttRoom) {
      const room = rooms.get(ws.ttRoom);
      const tt = room && room.tt;
      if (!tt || !tt.winner) return;
      const cfg = TT_MODES[tt.mode];
      tt.board = new Array(cfg.width * cfg.height).fill(null);
      tt.winner = null;
      tt.turn = 'X';
      const oldX = tt.xId, oldO = tt.oId; // swap seats so the loser doesn't always go second
      tt.xId = oldO;
      tt.oId = oldX;
      for (const p of tt.players.values()) {
        if (p.id === tt.xId) p.symbol = 'X';
        else if (p.id === tt.oId) p.symbol = 'O';
      }
      broadcastTt(ws.ttRoom, { type: 'tt-state', state: ttPublicState(tt) });
      return;
    }

    if (msg.type === 'tt-leaderboard' && ws.ttRoom) {
      const room = rooms.get(ws.ttRoom);
      const tt = room && room.tt;
      const mode = tt ? tt.mode : 'tictactoe';
      send(ws, { type: 'tt-leaderboard-result', scores: db.getLeaderboard(ws.ttRoom, `tictactoe-${mode}`, 10) });
      return;
    }

    if (msg.type === 'tt-leave') {
      leaveTt(ws);
      return;
    }

    if (msg.type === 'dg-join') {
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      const room = getOrCreateRoom(code);
      if (!room.dg) {
        room.dg = {
          players: new Map(),
          drawerId: null,
          drawerIndex: -1,
          word: null,
          category: 'Random',
          roundEndAt: null,
          strokes: [],
          guessedThisRound: new Set(),
          timer: null,
        };
      }
      const dg = room.dg;
      if (dg.players.size >= MAX_GAME_PLAYERS) {
        send(ws, { type: 'dg-full' });
        return;
      }
      const id = crypto.randomUUID();
      ws.dgRoom = code;
      ws.dgId = id;
      const isSpectator = !!msg.spectate;
      dg.players.set(ws, { id, name, score: 0, isSpectator });
      send(ws, {
        type: 'dg-init',
        id,
        players: dgScores(dg),
        drawerId: dg.drawerId,
        endsAt: dg.roundEndAt,
        strokes: dg.strokes,
        categories: DG_CATEGORY_NAMES,
        category: dg.category,
      });
      broadcastDg(code, { type: 'dg-player-joined', id, name, isSpectator }, ws);
      setRoomActivity(code, name, 'dg');
      return;
    }

    if (msg.type === 'dg-set-spectator' && ws.dgRoom) {
      const room = rooms.get(ws.dgRoom);
      const dg = room && room.dg;
      const me = dg && dg.players.get(ws);
      if (!me) return;
      me.isSpectator = !!msg.spectate;
      // Switching to spectate mid-round shouldn't let you dodge a round you're already
      // drawing, or leave the guess-count denominator wrong for everyone still playing.
      if (me.isSpectator && dg.roundEndAt && dg.drawerId === me.id) endDgRound(ws.dgRoom);
      broadcastDg(ws.dgRoom, { type: 'dg-spectator-changed', id: me.id, isSpectator: me.isSpectator });
      return;
    }

    if (msg.type === 'dg-set-category' && ws.dgRoom) {
      const room = rooms.get(ws.dgRoom);
      const dg = room && room.dg;
      if (!dg || dg.roundEndAt) return;
      const category = String(msg.category || 'Random');
      dg.category = category === 'Random' || DG_CATEGORIES[category] ? category : 'Random';
      broadcastDg(ws.dgRoom, { type: 'dg-category-changed', category: dg.category });
      return;
    }

    if (msg.type === 'dg-start' && ws.dgRoom) {
      const room = rooms.get(ws.dgRoom);
      const dg = room && room.dg;
      if (!dg || dg.roundEndAt) return;
      const playerIds = [...dg.players.entries()].filter(([, p]) => !p.isSpectator).map(([w]) => w);
      if (playerIds.length < 2) {
        send(ws, { type: 'dg-error', message: 'Need at least 2 non-spectator players to start' });
        return;
      }
      dg.drawerIndex = (dg.drawerIndex + 1) % playerIds.length;
      const drawerWs = playerIds[dg.drawerIndex];
      const drawerInfo = dg.players.get(drawerWs);
      dg.word = dgPickWord(dg.category);
      dg.drawerId = drawerInfo.id;
      dg.strokes = [];
      dg.guessedThisRound = new Set();
      dg.roundEndAt = Date.now() + DG_ROUND_MS;
      clearTimeout(dg.timer);
      dg.timer = setTimeout(() => endDgRound(ws.dgRoom), DG_ROUND_MS);
      broadcastDg(ws.dgRoom, {
        type: 'dg-round-start',
        drawerId: dg.drawerId,
        drawerName: drawerInfo.name,
        endsAt: dg.roundEndAt,
        wordLength: dg.word.length,
        category: dg.category,
      });
      send(drawerWs, { type: 'dg-word', word: dg.word });
      return;
    }

    if (msg.type === 'dg-stroke' && ws.dgRoom) {
      const room = rooms.get(ws.dgRoom);
      const dg = room && room.dg;
      if (!dg || !dg.roundEndAt) return;
      const me = dg.players.get(ws);
      if (!me || me.id !== dg.drawerId) return;
      const points = sanitizeStrokePoints(msg.points);
      if (!points.length) return;
      const stroke = {
        points,
        color: String(msg.color || '#000000').slice(0, 20),
        size: Math.max(1, Math.min(40, +msg.size || 4)),
      };
      dg.strokes.push(stroke);
      if (dg.strokes.length > 3000) dg.strokes.shift();
      broadcastDg(ws.dgRoom, { type: 'dg-stroke', stroke }, ws);
      return;
    }

    if (msg.type === 'dg-clear' && ws.dgRoom) {
      const room = rooms.get(ws.dgRoom);
      const dg = room && room.dg;
      if (!dg) return;
      const me = dg.players.get(ws);
      if (!me || me.id !== dg.drawerId) return;
      dg.strokes = [];
      broadcastDg(ws.dgRoom, { type: 'dg-cleared' });
      return;
    }

    if (msg.type === 'dg-guess' && ws.dgRoom) {
      const room = rooms.get(ws.dgRoom);
      const dg = room && room.dg;
      if (!dg || !dg.roundEndAt) return;
      const me = dg.players.get(ws);
      if (!me || me.id === dg.drawerId || me.isSpectator) return;
      const text = String(msg.text || '').slice(0, 100).trim();
      if (!text) return;
      if (dg.guessedThisRound.has(me.id)) {
        // A player who's already guessed correctly can still chat, but not by typing the literal
        // answer again — this used to broadcast their text unfiltered, letting the secret word
        // leak straight into the guess-chat feed for everyone still trying to guess it.
        if (text.toLowerCase() === String(dg.word || '').toLowerCase()) return;
        broadcastDg(ws.dgRoom, { type: 'dg-guess-chat', name: me.name, text });
        return;
      }
      if (text.toLowerCase() === String(dg.word || '').toLowerCase()) {
        dg.guessedThisRound.add(me.id);
        const points = dg.guessedThisRound.size === 1 ? 3 : 1;
        me.score += points;
        db.bumpLeaderboard(ws.dgRoom, 'pictionary', me.name, me.score);
        broadcastDg(ws.dgRoom, { type: 'dg-correct', id: me.id, name: me.name, points, score: me.score });
        const guessableCount = [...dg.players.values()].filter((p) => !p.isSpectator).length - 1;
        if (guessableCount > 0 && dg.guessedThisRound.size >= guessableCount) endDgRound(ws.dgRoom);
      } else {
        broadcastDg(ws.dgRoom, { type: 'dg-guess-chat', name: me.name, text });
      }
      return;
    }

    if (msg.type === 'dg-leave') {
      leaveDg(ws);
      return;
    }

    if (msg.type === 'dg-leaderboard' && ws.dgRoom) {
      send(ws, { type: 'dg-leaderboard-result', scores: db.getLeaderboard(ws.dgRoom, 'pictionary', 10) });
      return;
    }

    if (msg.type === 'wb-join') {
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      const room = getOrCreateRoom(code);
      if (!room.wb) room.wb = { strokes: db.getWhiteboardStrokes(code), players: new Map() };
      if (room.wb.players.size >= MAX_GAME_PLAYERS) {
        send(ws, { type: 'wb-full' });
        return;
      }
      const id = crypto.randomUUID();
      ws.wbRoom = code;
      ws.wbId = id;
      room.wb.players.set(ws, { id, name });
      send(ws, { type: 'wb-init', id, strokes: room.wb.strokes, count: room.wb.players.size });
      broadcastWb(code, { type: 'wb-player-joined', id, name }, ws);
      setRoomActivity(code, name, 'wb');
      return;
    }

    if (msg.type === 'wb-stroke' && ws.wbRoom) {
      const room = rooms.get(ws.wbRoom);
      if (!room || !room.wb) return;
      const points = sanitizeStrokePoints(msg.points);
      if (!points.length) return;
      const stroke = {
        id: crypto.randomUUID(),
        points,
        color: String(msg.color || '#000000').slice(0, 20),
        size: Math.max(1, Math.min(40, +msg.size || 4)),
      };
      room.wb.strokes.push(stroke);
      if (room.wb.strokes.length > 3000) room.wb.strokes.shift();
      db.insertStroke(ws.wbRoom, stroke);
      broadcastWb(ws.wbRoom, { type: 'wb-stroke', stroke }, ws);
      return;
    }

    if (msg.type === 'wb-clear' && ws.wbRoom) {
      const room = rooms.get(ws.wbRoom);
      if (!room || !room.wb) return;
      room.wb.strokes = [];
      db.clearStrokes(ws.wbRoom);
      broadcastWb(ws.wbRoom, { type: 'wb-cleared' });
      return;
    }

    if (msg.type === 'wb-leave') {
      leaveWb(ws);
      return;
    }

    if (!ws.profile) {
      send(ws, { type: 'error', message: 'Not joined' });
      return;
    }

    if (msg.type === 'friend-dm') {
      if (!ws.accountId) {
        send(ws, { type: 'error', message: 'Sign in to send private DMs' });
        return;
      }
      const toUsername = String(msg.toUsername || '').trim();
      const text = String(msg.text || '').slice(0, 500).trim();
      if (!toUsername || !text) {
        send(ws, { type: 'error', message: 'Missing recipient or message' });
        return;
      }
      const targetAccount = db.getAccountByUsername(toUsername);
      if (!targetAccount) {
        send(ws, { type: 'error', message: 'No account with that username' });
        return;
      }
      const friendship = db.getFriendshipBetween(ws.accountId, targetAccount.id);
      if (!friendship || friendship.status !== 'accepted') {
        send(ws, { type: 'error', message: 'You can only send private DMs to friends' });
        return;
      }
      sendFriendDm(ws.profile.name, targetAccount.id, text);
      send(ws, { type: 'friend-dm-sent', toUsername });
      return;
    }

    if (msg.type === 'create-group-dm') {
      if (!ws.accountId) {
        send(ws, { type: 'error', message: 'Sign in to start a group DM' });
        return;
      }
      const memberUsernames = Array.isArray(msg.memberUsernames) ? msg.memberUsernames.slice(0, 20) : [];
      const name = msg.name ? String(msg.name).slice(0, 60).trim() : null;
      const memberIds = new Set([ws.accountId]);
      for (const raw of memberUsernames) {
        const username = String(raw || '').trim();
        if (!username) continue;
        const account = db.getAccountByUsername(username);
        if (!account) {
          send(ws, { type: 'error', message: `No account with username "${username}"` });
          return;
        }
        const friendship = db.getFriendshipBetween(ws.accountId, account.id);
        if (!friendship || friendship.status !== 'accepted') {
          send(ws, { type: 'error', message: `You can only add friends to a group DM (${username} isn't one)` });
          return;
        }
        memberIds.add(account.id);
      }
      if (memberIds.size < 3) {
        send(ws, { type: 'error', message: 'Pick at least 2 friends to start a group DM' });
        return;
      }
      const groupId = crypto.randomUUID();
      db.createGroupDm(groupId, name, ws.accountId, [...memberIds]);
      const threads = db.getGroupDmsForAccount(ws.accountId);
      const thread = threads.find((t) => t.id === groupId);
      for (const accountId of memberIds) {
        if (accountId === ws.accountId) continue;
        const liveConnections = accountConnections.get(accountId);
        if (!liveConnections) continue;
        const theirThreads = db.getGroupDmsForAccount(accountId);
        const theirThread = theirThreads.find((t) => t.id === groupId);
        for (const c of liveConnections) {
          if (c.readyState === c.OPEN) send(c, { type: 'group-dm-created', thread: theirThread });
        }
      }
      send(ws, { type: 'group-dm-created', thread });
      return;
    }

    if (msg.type === 'get-group-dm-threads') {
      if (!ws.accountId) {
        send(ws, { type: 'error', message: 'Sign in to view group DMs' });
        return;
      }
      send(ws, { type: 'group-dm-threads', threads: db.getGroupDmsForAccount(ws.accountId) });
      return;
    }

    if (msg.type === 'get-group-dm-messages') {
      if (!ws.accountId) {
        send(ws, { type: 'error', message: 'Sign in to view group DMs' });
        return;
      }
      const groupId = String(msg.groupId || '');
      if (!db.isGroupDmMember(groupId, ws.accountId)) {
        send(ws, { type: 'error', message: 'Not a member of that group DM' });
        return;
      }
      send(ws, { type: 'group-dm-messages', groupId, messages: db.getGroupDmMessages(groupId) });
      return;
    }

    if (msg.type === 'send-group-dm') {
      if (!ws.accountId) {
        send(ws, { type: 'error', message: 'Sign in to send group DMs' });
        return;
      }
      const groupId = String(msg.groupId || '');
      const text = String(msg.text || '').slice(0, 500).trim();
      if (!text) {
        send(ws, { type: 'error', message: 'Empty message' });
        return;
      }
      if (!db.isGroupDmMember(groupId, ws.accountId)) {
        send(ws, { type: 'error', message: 'Not a member of that group DM' });
        return;
      }
      // Same flood gate as regular chat/DM messages (see the 'dm' handler) — this was missing
      // here, and group DMs fan out a push notification to every other member on every send, so
      // an unthrottled sender could spam real push notifications to everyone in the group.
      const now = Date.now();
      ws.msgTimestamps = (ws.msgTimestamps || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (ws.msgTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
        send(ws, { type: 'error', message: 'You are sending messages too fast — slow down a bit.' });
        return;
      }
      ws.msgTimestamps.push(now);
      const entry = { id: crypto.randomUUID(), groupId, fromAccountId: ws.accountId, fromName: ws.profile.name, text, at: now };
      db.insertGroupDmMessage(entry);
      sendGroupDm(groupId, ws.accountId, ws.profile.name, text, ws);
      send(ws, { type: 'group-dm-sent', message: entry });
      return;
    }

    if (msg.type === 'leave-group-dm') {
      if (!ws.accountId) {
        send(ws, { type: 'error', message: 'Sign in required' });
        return;
      }
      const groupId = String(msg.groupId || '');
      if (!db.isGroupDmMember(groupId, ws.accountId)) {
        send(ws, { type: 'error', message: 'Not a member of that group DM' });
        return;
      }
      db.removeGroupDmMember(groupId, ws.accountId);
      send(ws, { type: 'group-dm-left', groupId });
      return;
    }

    if (msg.type === 'create-room') {
      const nowCreate = Date.now();
      ws.roomCreateTimestamps = (ws.roomCreateTimestamps || []).filter((t) => nowCreate - t < ROOM_CREATE_WINDOW_MS);
      if (ws.roomCreateTimestamps.length >= ROOM_CREATE_MAX) {
        send(ws, { type: 'error', message: 'Too many rooms created too quickly — slow down a bit.' });
        return;
      }
      ws.roomCreateTimestamps.push(nowCreate);
      const code = generateRoomCode();
      db.upsertRoom(code);
      db.setRoomHostIfUnset(code, ws.profile.name);
      rooms.set(code, { history: [], clients: new Set([ws]) });
      ws.room = code;
      send(ws, { type: 'joined-room', code, messages: [], users: roomUsers(code), name: null, reactions: [], pins: [], activity: [], isHost: true, announcement: null, wallpaperUrl: null });
      return;
    }

    if (msg.type === 'join-room') {
      const code = String(msg.code || '').toUpperCase().trim();
      if (!rooms.has(code) && !db.getRoom(code)) {
        send(ws, { type: 'join-error', message: 'Room not found' });
        return;
      }
      const dbRoom = db.getRoom(code);
      if (db.isBannedFromRoom(code, ws.accountId || null, ws.profile.name)) {
        send(ws, { type: 'join-error', message: "You've been banned from this room" });
        return;
      }
      // A lightweight join gate, not real security (no accounts here to hash a PIN against) —
      // just enough to keep a room from being joined by anyone who guesses/finds the 5-char code.
      if (dbRoom && dbRoom.pin_required) {
        const suppliedPin = String(msg.pin || '').trim();
        if (suppliedPin !== dbRoom.pin_required) {
          send(ws, { type: 'join-error', message: suppliedPin ? 'Incorrect PIN' : 'This room requires a PIN', pinRequired: true });
          return;
        }
      }
      const room = getOrCreateRoom(code);
      // Room-scoped features (kick/mute-by-name, DMs, read receipts, push-suppression-by-name)
      // all assume one connection per display name per room. A same-named connection already
      // present is almost always this same tab's *previous* socket (e.g. it just navigated to
      // a minigame and back) rather than a genuine second person — the browser's close frame
      // for the old socket and the new socket's join-room can arrive in either order, so by the
      // time we get here the old one may still self-report readyState OPEN even though it's on
      // its way out. So the newest connection always wins: evict whichever old same-named
      // socket is here (closing it too, in case it's a real still-live second tab, so that tab
      // visibly disconnects rather than silently losing room updates) and let this join proceed.
      for (const c of [...room.clients]) {
        if (c !== ws && c.profile && c.profile.name === ws.profile.name) {
          leaveRoom(c, false);
          try { c.close(4000, 'Reconnected from another tab'); } catch {}
        }
      }
      room.clients.add(ws);
      ws.room = code;
      // Rooms created before this feature existed have no host_name yet — the first person
      // to (re)join effectively becomes the host rather than leaving the room host-less forever.
      if (dbRoom && !dbRoom.host_name) db.setRoomHostIfUnset(code, ws.profile.name);
      // Re-apply a persistent (account-based) mute even if they rejoined under a new display
      // name — otherwise a signed-in target could dodge a mute just by picking a new name.
      if (ws.accountId && db.isPersistentlyMuted(code, ws.accountId)) {
        if (!room.muted) room.muted = new Set();
        room.muted.add(ws.profile.name);
      }
      send(ws, {
        type: 'joined-room',
        code,
        messages: attachPollVotes(room.history),
        users: roomUsers(code),
        name: dbRoom ? dbRoom.name : null,
        reactions: db.getReactionsForRoom(code),
        pins: db.getPins(code),
        activity: roomActivityList(room),
        isHost: (db.getRoom(code) || {}).host_name === ws.profile.name,
        announcement: dbRoom ? dbRoom.announcement : null,
        wallpaperUrl: dbRoom ? dbRoom.wallpaper_url : null,
        voiceCallActive: !!(room.voice && room.voice.size > 0),
      });
      broadcastRoom(code, { type: 'system', text: `${ws.profile.name} joined the room`, at: Date.now() }, ws);
      broadcastRoom(code, { type: 'presence', users: roomUsers(code) });
      return;
    }

    if (msg.type === 'set-avatar') {
      const avatarUrl = typeof msg.avatarUrl === 'string' ? msg.avatarUrl.slice(0, 500) : null;
      ws.profile.avatarUrl = avatarUrl;
      db.upsertProfile(ws.profile.name, { avatarUrl });
      const payload = { type: 'profile-updated', name: ws.profile.name, avatarUrl, status: ws.profile.status };
      send(ws, payload);
      if (ws.room) broadcastRoom(ws.room, payload, ws);
      return;
    }

    if (msg.type === 'set-status') {
      const status = String(msg.status || '').slice(0, 60).trim() || null;
      ws.profile.status = status;
      db.upsertProfile(ws.profile.name, { status });
      const payload = { type: 'profile-updated', name: ws.profile.name, avatarUrl: ws.profile.avatarUrl, status };
      send(ws, payload);
      if (ws.room) broadcastRoom(ws.room, payload, ws);
      return;
    }

    // Renaming your own display name — works identically whether you're a guest or signed in,
    // since both use ws.profile.name as their in-room identity (an account's login username,
    // changed separately via POST /account/username, is a different thing entirely). ws.profile
    // is mutated in place rather than replaced so every closure that already captured it (room
    // membership matching, kick/mute target lookups) keeps working with no other changes needed.
    if (msg.type === 'set-name') {
      const newName = String(msg.name || '').slice(0, 30).trim();
      if (!newName) {
        send(ws, { type: 'error', message: 'Name cannot be empty' });
        return;
      }
      if (newName === ws.profile.name) {
        send(ws, { type: 'name-updated', name: newName });
        return;
      }
      if (ws.room) {
        const room = rooms.get(ws.room);
        if (room) {
          for (const c of room.clients) {
            if (c !== ws && c.profile && c.profile.name === newName) {
              send(ws, { type: 'error', message: 'Someone else in this room already has that name' });
              return;
            }
          }
        }
      }
      const oldName = ws.profile.name;
      ws.profile.name = newName;
      db.upsertProfile(newName, { avatarUrl: ws.profile.avatarUrl, status: ws.profile.status });
      if (ws.room) {
        const room = rooms.get(ws.room);
        db.renameRoomHostIfMatches(ws.room, oldName, newName);
        if (ws.accountId) db.renamePersistentMuteName(ws.room, ws.accountId, newName);
        if (room && room.muted && room.muted.has(oldName)) {
          room.muted.delete(oldName);
          room.muted.add(newName);
        }
      }
      send(ws, { type: 'name-updated', oldName, name: newName });
      if (ws.room) {
        broadcastRoom(ws.room, { type: 'system', text: `${oldName} is now known as ${newName}`, at: Date.now() }, ws);
        broadcastRoom(ws.room, { type: 'presence', users: roomUsers(ws.room) });
      }
      return;
    }

    if (msg.type === 'rename-room' && ws.room) {
      const name = String(msg.name || '').slice(0, 50).trim() || null;
      db.upsertRoom(ws.room, name);
      broadcastRoom(ws.room, { type: 'room-renamed', name });
      return;
    }

    if (msg.type === 'set-room-pin' && ws.room) {
      const dbRoom = db.getRoom(ws.room);
      if (!dbRoom || dbRoom.host_name !== ws.profile.name) return;
      const pin = String(msg.pin || '').slice(0, 12).trim() || null;
      db.setRoomPin(ws.room, pin);
      send(ws, { type: 'room-pin-updated', pinRequired: !!pin });
      return;
    }

    if (msg.type === 'set-wallpaper' && ws.room) {
      const dbRoom = db.getRoom(ws.room);
      if (!dbRoom || dbRoom.host_name !== ws.profile.name) return;
      const url = typeof msg.url === 'string' ? msg.url.slice(0, 500) : null;
      db.setWallpaper(ws.room, url);
      broadcastRoom(ws.room, { type: 'wallpaper-updated', url });
      return;
    }

    if (msg.type === 'set-announcement' && ws.room) {
      const dbRoom = db.getRoom(ws.room);
      if (!dbRoom || dbRoom.host_name !== ws.profile.name) return;
      const text = String(msg.text || '').slice(0, 200).trim() || null;
      db.setAnnouncement(ws.room, text);
      broadcastRoom(ws.room, { type: 'announcement-updated', text });
      return;
    }

    // ---- Moderation: whoever created the room (host_name, set once at creation) can kick/mute.
    // Weak by design, same trust model as everything else here (no accounts to actually verify
    // identity) — this stops accidental/casual disruption, not a determined impersonator. ----
    if (msg.type === 'kick-user' && ws.room) {
      const dbRoom = db.getRoom(ws.room);
      if (!dbRoom || dbRoom.host_name !== ws.profile.name) return;
      const targetName = String(msg.name || '').trim();
      if (!targetName || targetName === ws.profile.name) return;
      const room = rooms.get(ws.room);
      if (!room) return;
      for (const client of [...room.clients]) {
        if (client.profile && client.profile.name === targetName) {
          send(client, { type: 'kicked', by: ws.profile.name });
          leaveRoom(client);
        }
      }
      return;
    }

    if (msg.type === 'mute-user' && ws.room) {
      const dbRoom = db.getRoom(ws.room);
      if (!dbRoom || dbRoom.host_name !== ws.profile.name) return;
      const targetName = String(msg.name || '').trim();
      if (!targetName || targetName === ws.profile.name) return;
      const room = rooms.get(ws.room);
      if (!room) return;
      if (!room.muted) room.muted = new Set();
      room.muted.add(targetName);
      // If the target is signed in, also persist the mute by account_id — otherwise it's only
      // in-memory for this display name and evaporates the moment they rejoin under a new one.
      // Falls back to recentAccountsByName (populated on disconnect) if the target already left
      // by the time this runs — e.g. kick-then-ban, or the target closing the tab during the
      // client's confirm() prompt — so those common flows still produce a real account-linked,
      // rejoin-proof mute instead of a silently bypassable name-only one.
      const targetClient = [...room.clients].find((c) => c.profile && c.profile.name === targetName);
      const targetAccountId = (targetClient && targetClient.accountId)
        || (room.recentAccountsByName && room.recentAccountsByName.get(targetName))
        || null;
      if (targetAccountId) {
        db.addPersistentMute(ws.room, targetAccountId, targetName, ws.profile.name);
      }
      broadcastRoom(ws.room, { type: 'user-muted', name: targetName });
      return;
    }

    if (msg.type === 'unmute-user' && ws.room) {
      const dbRoom = db.getRoom(ws.room);
      if (!dbRoom || dbRoom.host_name !== ws.profile.name) return;
      const targetName = String(msg.name || '').trim();
      const room = rooms.get(ws.room);
      if (room && room.muted) room.muted.delete(targetName);
      const targetClient = room && [...room.clients].find((c) => c.profile && c.profile.name === targetName);
      const targetAccountId = targetClient && targetClient.accountId
        ? targetClient.accountId
        : (db.getPersistentMuteByName(ws.room, targetName) || {}).target_account_id;
      if (targetAccountId) db.removePersistentMute(ws.room, targetAccountId);
      broadcastRoom(ws.room, { type: 'user-unmuted', name: targetName });
      return;
    }

    // Anyone in a room can report a specific message or just a user, independent of host
    // status — the host-only kick/mute above only helps if the host happens to be watching;
    // this reaches an admin even when they're not. Logged, never auto-acted-on (same "a human
    // reviews it" shape as the self-healing error/patch pipeline) — see /admin/reports.
    if (msg.type === 'report' && ws.room) {
      const now = Date.now();
      ws.reportTimestamps = (ws.reportTimestamps || []).filter((t) => now - t < REPORT_WINDOW_MS);
      if (ws.reportTimestamps.length >= REPORT_MAX) return;
      ws.reportTimestamps.push(now);
      const targetName = String(msg.targetName || '').trim().slice(0, 30);
      if (!targetName || targetName === ws.profile.name) return;
      const messageId = msg.messageId ? String(msg.messageId).slice(0, 100) : null;
      let messageEntry = messageId ? db.getMessage(messageId) : null;
      // A client could supply any messageId, from any room — only trust it as this report's
      // quoted text if it actually belongs to the room being reported from.
      if (messageEntry && messageEntry.room_code !== ws.room) messageEntry = null;
      db.insertReport({
        id: crypto.randomUUID(),
        roomCode: ws.room,
        reporterName: ws.profile.name,
        reporterAccountId: ws.accountId || null,
        targetName,
        messageId,
        messageText: messageEntry ? messageEntry.text : null,
        reason: String(msg.reason || '').slice(0, 300).trim() || null,
      });
      pushAdminOnNewReport(ws.room, ws.profile.name, targetName);
      send(ws, { type: 'report-received' });
      return;
    }

    // Bans persist (room_bans, see db.js) unlike kick above, which only disconnects once —
    // see the room_bans table comment for the account-vs-name enforcement split.
    if (msg.type === 'ban-user' && ws.room) {
      const dbRoom = db.getRoom(ws.room);
      if (!dbRoom || dbRoom.host_name !== ws.profile.name) return;
      const targetName = String(msg.name || '').trim();
      if (!targetName || targetName === ws.profile.name) return;
      const room = rooms.get(ws.room);
      if (!room) return;
      const targetClient = [...room.clients].find((c) => c.profile && c.profile.name === targetName);
      // Same recentAccountsByName fallback as mute-user above, for the same reason: the target
      // is very often already disconnected by the time a ban is issued (kick-then-ban, or they
      // left mid-confirm()-prompt), and without this a signed-in target could trivially evade a
      // ban by rejoining under a new display name.
      const targetAccountId = (targetClient && targetClient.accountId)
        || (room.recentAccountsByName && room.recentAccountsByName.get(targetName))
        || null;
      db.banFromRoom(crypto.randomUUID(), ws.room, targetAccountId, targetName, ws.profile.name);
      if (targetClient) {
        send(targetClient, { type: 'kicked', by: ws.profile.name });
        leaveRoom(targetClient);
      }
      broadcastRoom(ws.room, { type: 'user-banned', name: targetName });
      return;
    }

    if (msg.type === 'unban-user' && ws.room) {
      const dbRoom = db.getRoom(ws.room);
      if (!dbRoom || dbRoom.host_name !== ws.profile.name) return;
      const banId = String(msg.banId || '');
      if (!banId) return;
      db.unbanFromRoom(banId);
      send(ws, { type: 'bans-result', bans: db.getRoomBans(ws.room) });
      return;
    }

    if (msg.type === 'get-bans' && ws.room) {
      const dbRoom = db.getRoom(ws.room);
      if (!dbRoom || dbRoom.host_name !== ws.profile.name) return;
      send(ws, { type: 'bans-result', bans: db.getRoomBans(ws.room) });
      return;
    }

    if (msg.type === 'get-media' && ws.room) {
      send(ws, { type: 'media-result', media: db.getRoomMedia(ws.room) });
      return;
    }

    if (msg.type === 'get-thread' && ws.room) {
      const messageId = String(msg.messageId || '');
      const root = db.getMessage(messageId);
      if (!root || root.room_code !== ws.room) return;
      send(ws, {
        type: 'thread-result',
        root: db.rowToHistoryEntry(root),
        replies: db.getThreadReplies(ws.room, messageId),
      });
      return;
    }

    if (msg.type === 'vote-poll' && ws.room) {
      const messageId = String(msg.messageId || '');
      const target = db.getMessage(messageId);
      if (!target || target.room_code !== ws.room || target.media_type !== 'poll' || target.deleted) return;
      let options;
      try { options = JSON.parse(target.text).options; } catch { return; }
      const optionIndex = Math.floor(+msg.optionIndex);
      if (!Array.isArray(options) || optionIndex < 0 || optionIndex >= options.length) return;
      db.setPollVote(messageId, ws.profile.name, optionIndex);
      broadcastRoom(ws.room, { type: 'poll-voted', messageId, votes: db.getPollVotes(messageId) });
      return;
    }

    if (msg.type === 'leave-room') {
      leaveRoom(ws);
      send(ws, { type: 'left-room' });
      return;
    }

    if (msg.type === 'voice-join' && ws.room) {
      const code = ws.room;
      const voice = voiceRoom(code, true);
      const sub = ws.profile.sub;
      const name = ws.profile.name;
      const wasEmpty = voice.size === 0;
      const existing = [...voice.entries()]
        .filter(([s]) => s !== sub)
        .map(([s, p]) => ({ sub: s, name: p.name }));
      voice.set(sub, { ws, name });
      send(ws, { type: 'voice-peers', peers: existing });
      for (const [s, p] of voice) {
        if (s !== sub) send(p.ws, { type: 'voice-peer-joined', sub, name });
      }
      // Let everyone else in the room (not just people already on the call) know a
      // call just started, so they see a one-tap "join" prompt instead of having to
      // open the menu and guess whether anyone's actually on a call right now.
      if (wasEmpty) broadcastRoom(code, { type: 'voice-call-started', name }, ws);
      return;
    }

    if (msg.type === 'voice-signal' && ws.room) {
      const voice = voiceRoom(ws.room, false);
      const target = voice && voice.get(String(msg.to || ''));
      if (!target) return;
      send(target.ws, { type: 'voice-signal', from: ws.profile.sub, signal: msg.signal });
      return;
    }

    if (msg.type === 'voice-share' && ws.room) {
      const voice = voiceRoom(ws.room, false);
      if (!voice) return;
      const sub = ws.profile.sub;
      for (const [s, p] of voice) {
        if (s !== sub) send(p.ws, { type: 'voice-share', sub, sharing: !!msg.sharing });
      }
      return;
    }

    if ((msg.type === 'raise-hand' || msg.type === 'lower-hand') && ws.room) {
      const voice = voiceRoom(ws.room, false);
      if (!voice) return;
      const sub = ws.profile.sub;
      const raised = msg.type === 'raise-hand';
      for (const [s, p] of voice) {
        if (s !== sub) send(p.ws, { type: raised ? 'hand-raised' : 'hand-lowered', sub, name: ws.profile.name });
      }
      return;
    }

    // A request, not an enforced mute — this app has no roles/auth, so nothing should ever
    // let one participant force-mute another's mic. Every peer decides for itself.
    if (msg.type === 'mute-all-request' && ws.room) {
      const voice = voiceRoom(ws.room, false);
      if (!voice) return;
      const sub = ws.profile.sub;
      for (const [s, p] of voice) {
        if (s !== sub) send(p.ws, { type: 'mute-all-request', fromName: ws.profile.name });
      }
      return;
    }

    if (msg.type === 'voice-leave') {
      leaveVoice(ws);
      return;
    }

    if (msg.type === 'send-dm' && ws.room) {
      const toName = String(msg.toName || '').trim();
      const text = String(msg.text || '').slice(0, 2000).trim();
      if (!toName || !text || toName === ws.profile.name) return;
      const room = rooms.get(ws.room);
      if (!room) return;
      const targetClient = [...room.clients].find((c) => c.profile && c.profile.name === toName);
      if (!targetClient) {
        send(ws, { type: 'error', message: `${toName} is not currently in this room` });
        return;
      }
      // Shares the same flood gate as regular chat messages so DMs can't be used to dodge it.
      const now = Date.now();
      ws.msgTimestamps = (ws.msgTimestamps || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (ws.msgTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
        send(ws, { type: 'error', message: 'You are sending messages too fast — slow down a bit.' });
        return;
      }
      ws.msgTimestamps.push(now);
      const entry = { id: crypto.randomUUID(), roomCode: ws.room, fromName: ws.profile.name, toName, text, at: now };
      db.insertDm(entry);
      const payload = { type: 'dm', id: entry.id, fromName: entry.fromName, toName: entry.toName, text: entry.text, at: entry.at };
      send(ws, payload);
      send(targetClient, payload);
      return;
    }

    if (msg.type === 'get-dm-thread' && ws.room) {
      const withName = String(msg.withName || '').trim();
      if (!withName) return;
      send(ws, { type: 'dm-thread', withName, messages: db.getDmThread(ws.room, ws.profile.name, withName) });
      return;
    }

    // Scroll-to-top pagination — the room's initial history (see 'joined-room') only ever sends
    // the newest HISTORY_LIMIT messages; this is the only way to reach anything older.
    if (msg.type === 'load-older-messages' && ws.room) {
      const beforeAt = Number(msg.beforeAt);
      if (!Number.isFinite(beforeAt)) return;
      const LOAD_OLDER_LIMIT = 50;
      const messages = db.getMessagesBefore(ws.room, beforeAt, LOAD_OLDER_LIMIT);
      send(ws, { type: 'older-messages', messages, hasMore: messages.length === LOAD_OLDER_LIMIT });
      return;
    }

    if (msg.type === 'message' && ws.room) {
      const room = rooms.get(ws.room);
      if (!room) return;
      if (room.muted && room.muted.has(ws.profile.name)) {
        send(ws, { type: 'error', message: 'You have been muted in this room' });
        return;
      }
      const now = Date.now();
      ws.msgTimestamps = (ws.msgTimestamps || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (ws.msgTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
        send(ws, { type: 'error', message: 'You are sending messages too fast — slow down a bit.' });
        return;
      }
      ws.msgTimestamps.push(now);
      const text = String(msg.text || '').slice(0, 2000).trim();
      const mediaUrl = typeof msg.mediaUrl === 'string' ? msg.mediaUrl : null;
      const mediaType = ['video', 'image', 'audio', 'poll'].includes(msg.mediaType) ? msg.mediaType : null;
      if (!text && !(mediaUrl && mediaType)) return;

      let replyToId = null;
      let replyPreview = null;
      if (msg.replyTo) {
        const target = db.getMessage(String(msg.replyTo));
        if (target && target.room_code === ws.room) {
          replyToId = target.id;
          replyPreview = { id: target.id, name: target.name, text: target.text || (target.media_type ? '(a photo/video)' : '') };
        }
      }

      const entry = {
        type: 'message',
        id: crypto.randomUUID(),
        name: ws.profile.name,
        sub: ws.profile.sub,
        text,
        mediaUrl,
        mediaType,
        replyPreview,
        at: Date.now(),
      };
      room.history.push(entry);
      if (room.history.length > HISTORY_LIMIT) room.history.shift();
      db.insertMessage({ id: entry.id, roomCode: ws.room, name: entry.name, text: entry.text, mediaUrl: entry.mediaUrl, mediaType: entry.mediaType, replyToId, at: entry.at });
      db.upsertRoom(ws.room);
      broadcastRoom(ws.room, entry);
      pushNewMessage(ws.room, entry);
      pushMentionNotifications(ws.room, entry);
      return;
    }

    if (msg.type === 'edit-message' && ws.room) {
      const messageId = String(msg.messageId || '');
      const text = String(msg.text || '').slice(0, 2000).trim();
      if (!messageId || !text) return;
      const target = db.getMessage(messageId);
      if (!target || target.room_code !== ws.room || target.name !== ws.profile.name || target.deleted) return;
      db.updateMessageText(messageId, text);
      const room = rooms.get(ws.room);
      const entry = room && room.history.find((m) => m.id === messageId);
      if (entry) { entry.text = text; entry.edited = true; }
      broadcastRoom(ws.room, { type: 'message-edited', messageId, text });
      return;
    }

    if (msg.type === 'delete-message' && ws.room) {
      const messageId = String(msg.messageId || '');
      if (!messageId) return;
      const target = db.getMessage(messageId);
      if (!target || target.room_code !== ws.room || target.deleted) return;
      const dbRoom = db.getRoom(ws.room);
      const isHost = dbRoom && dbRoom.host_name === ws.profile.name;
      if (target.name !== ws.profile.name && !isHost) return;
      db.deleteMessageRow(messageId);
      const room = rooms.get(ws.room);
      const entry = room && room.history.find((m) => m.id === messageId);
      if (entry) { entry.text = ''; entry.mediaUrl = null; entry.mediaType = null; entry.deleted = true; }
      broadcastRoom(ws.room, { type: 'message-deleted', messageId });
      return;
    }

    if (msg.type === 'react' && ws.room) {
      const messageId = String(msg.messageId || '');
      // Not restricted to REACTION_EMOJIS anymore (that's just the quick-pick set in the UI) —
      // any short string is accepted so a custom/rare emoji typed via the OS picker still works.
      // Length-bounded rather than validated against a strict emoji regex (those are unreliable
      // for multi-codepoint sequences like flags/skin tones/ZWJ combos).
      const raw = typeof msg.emoji === 'string' ? msg.emoji.trim() : '';
      const emoji = raw && raw.length <= 8 ? raw : null;
      if (!messageId || !emoji) return;
      const added = db.toggleReaction(messageId, emoji, ws.profile.name);
      broadcastRoom(ws.room, { type: 'reaction', messageId, emoji, name: ws.profile.name, added });
      return;
    }

    if (msg.type === 'pin-message' && ws.room) {
      const messageId = String(msg.messageId || '');
      const target = db.getMessage(messageId);
      if (!target || target.room_code !== ws.room) return;
      db.setPin(ws.room, messageId, ws.profile.name);
      broadcastRoom(ws.room, { type: 'pins-updated', pins: db.getPins(ws.room) });
      return;
    }

    if (msg.type === 'unpin-message' && ws.room) {
      const messageId = String(msg.messageId || '');
      db.unpinMessage(ws.room, messageId);
      broadcastRoom(ws.room, { type: 'pins-updated', pins: db.getPins(ws.room) });
      return;
    }

    if (msg.type === 'typing' && ws.room) {
      broadcastRoom(ws.room, { type: 'typing', name: ws.profile.name }, ws);
      return;
    }

    if (msg.type === 'read' && ws.room) {
      const messageId = String(msg.messageId || '');
      if (!messageId) return;
      db.setReadReceipt(ws.room, ws.profile.name, messageId);
      broadcastRoom(ws.room, { type: 'read-receipt', name: ws.profile.name, messageId }, ws);
      return;
    }
    } catch (err) {
      reportError('server', err, { wsMessageType: msg.type, room: ws.room || null });
    }
  });

  ws.on('close', () => {
    unregisterAccountConnection(ws);
    if (ws.room) leaveRoom(ws);
    if (ws.profile) broadcastWorldwideCount();
    if (ws.bcRoom) leaveBc(ws);
    if (ws.gwRoom) leaveGw(ws);
    if (ws.swRoom) leaveSw(ws);
    if (ws.dgRoom) leaveDg(ws);
    if (ws.wbRoom) leaveWb(ws);
    if (ws.tvRoom) leaveTv(ws);
    if (ws.ttRoom) leaveTt(ws);
    if (ws.chRoom) leaveCh(ws);
    if (ws.hmRoom) leaveHm(ws);
    if (ws.arcadeRoom && ws.arcadeName) clearRoomActivity(ws.arcadeRoom, ws.arcadeName);
    if (ws.accountId && liveStreams.has(ws.accountId)) endScorptureLive(ws.accountId);
    leaveScorptureLive(ws);
  });
});

// ---- Persistent data retention — DB rows and public/uploads/ files never expired before, so
// a long-running install grows forever. Rooms untouched for ROOM_RETENTION_DAYS (tracked via
// rooms.last_active_at, bumped by any real activity — see the db.upsertRoom callers above) get
// fully purged: messages, reactions, pins, whiteboard strokes, Build Craft world/blueprints,
// leaderboard entries, DMs, push subscriptions, and any uploaded media those messages posted.
const ROOM_RETENTION_DAYS = 90;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

function deleteUploadFile(mediaUrl) {
  if (typeof mediaUrl !== 'string' || !mediaUrl.startsWith('/uploads/')) return;
  const uploadsDir = path.join(__dirname, 'public/uploads');
  const resolved = path.join(__dirname, 'public', mediaUrl);
  if (!resolved.startsWith(uploadsDir + path.sep)) return; // guard against a stray '..' in a stored URL
  fs.unlink(resolved, () => {}); // best-effort — already-missing file isn't an error here
}

function cleanupInactiveRooms() {
  const cutoff = Date.now() - ROOM_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const codes = db.getInactiveRoomCodes(cutoff);
  let filesDeleted = 0;
  for (const code of codes) {
    for (const url of db.getRoomMediaUrls(code)) {
      deleteUploadFile(url);
      filesDeleted += 1;
    }
    db.deleteRoomCascade(code);
    rooms.delete(code);
  }
  if (codes.length) {
    // Logged with the actual room codes, not just a count — a purge is irreversible (no DB
    // backup mechanism exists here), so this is the only forensic trail if one ever looks wrong.
    console.log(`[cleanup] Purged ${codes.length} room(s) inactive ${ROOM_RETENTION_DAYS}+ days: ${codes.join(', ')} — removed ${filesDeleted} media file(s).`);
  }
  return { roomsDeleted: codes.length, filesDeleted, codes };
}

setTimeout(cleanupInactiveRooms, 30 * 1000); // shortly after boot, not instantly — let startup settle first
setInterval(cleanupInactiveRooms, CLEANUP_INTERVAL_MS);

app.post('/admin/cleanup/run', requireAdmin, (req, res) => {
  try {
    res.json({ ok: true, ...cleanupInactiveRooms() });
  } catch (err) {
    reportError('server', err, { path: req.path, method: req.method });
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

// Express error-handling middleware — must be registered after every route above. Catches
// synchronous throws and anything passed to next(err); async route handlers that don't
// catch their own rejections won't reach this (Express doesn't await handlers), but every
// route in this file uses synchronous db calls, so a thrown error here is the common case.
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  reportError('server', err, { path: req.path, method: req.method });
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong' });
});

// Nothing else ever removes an entry from `rooms` (see its declaration above) — every room
// created since the process last restarted stays resident in memory forever, even ones nobody
// has touched in weeks. An in-memory entry is safe to evict once it has zero connections across
// chat *and* every minigame session, since SQLite still holds the room row and message history
// (getOrCreateRoom rehydrates from there on the next join/game-join).
const ROOM_SWEEP_INTERVAL_MS = 10 * 60 * 1000;
function isRoomFullyEmpty(room) {
  if (room.clients && room.clients.size > 0) return false;
  if (room.voice && room.voice.size > 0) return false;
  if (room.bc && room.bc.players && room.bc.players.size > 0) return false;
  if (room.gw) {
    for (const session of room.gw.values()) {
      if (session.players && session.players.size > 0) return false;
    }
  }
  if (room.sw && room.sw.players && room.sw.players.size > 0) return false;
  if (room.tv && room.tv.players && room.tv.players.size > 0) return false;
  if (room.dg && room.dg.players && room.dg.players.size > 0) return false;
  return true;
}
setInterval(() => {
  for (const [code, room] of rooms) {
    if (isRoomFullyEmpty(room)) rooms.delete(code);
  }
}, ROOM_SWEEP_INTERVAL_MS);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Chat app running at http://localhost:${PORT}`);
});
